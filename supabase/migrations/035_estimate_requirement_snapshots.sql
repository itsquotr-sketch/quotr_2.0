-- REQ-4A — append-only estimate requirement snapshots (LOCAL COMPLETE; remote not applied).
-- Additive only. Does not mutate estimate line money, pricing, or quotes.
-- Snapshots are historical calculation evidence. They are not commercial authority.

-- ---------------------------------------------------------------------------
-- A. Table
-- ---------------------------------------------------------------------------

create table public.estimate_requirement_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  estimate_id uuid not null references public.estimates (id) on delete cascade,
  generation_id uuid not null,
  schema_version text not null
    check (
      char_length(btrim(schema_version)) > 0
      and char_length(schema_version) <= 64
    ),
  payload jsonb not null
    check (
      jsonb_typeof(payload) = 'object'
      and pg_column_size(payload) <= 524288
    ),
  created_at timestamptz not null default now(),
  constraint estimate_requirement_snapshots_generation_id_key unique (generation_id)
);

comment on table public.estimate_requirement_snapshots is
  'Append-only requirement calculation evidence per estimate generation. Not commercial money authority.';

comment on column public.estimate_requirement_snapshots.generation_id is
  'UUID minted at persist time. Identifies this generation; not a timestamp.';

comment on column public.estimate_requirement_snapshots.payload is
  'Versioned EstimateRequirementSnapshotV1 JSON. Rate outcomes and assumptions at generation time.';

create index estimate_requirement_snapshots_org_created_idx
  on public.estimate_requirement_snapshots (org_id, created_at desc);

create index estimate_requirement_snapshots_estimate_created_idx
  on public.estimate_requirement_snapshots (estimate_id, created_at desc);

create index estimate_requirement_snapshots_project_idx
  on public.estimate_requirement_snapshots (project_id, created_at desc);

-- ---------------------------------------------------------------------------
-- B. Current-generation link on estimates
-- ---------------------------------------------------------------------------

alter table public.estimates
  add column if not exists requirement_generation_id uuid;

alter table public.estimates
  add column if not exists latest_requirement_snapshot_id uuid;

comment on column public.estimates.requirement_generation_id is
  'Generation UUID for the current estimate persist. Links to estimate_requirement_snapshots.generation_id.';

comment on column public.estimates.latest_requirement_snapshot_id is
  'Pointer to the snapshot inserted for the current generation. Null if snapshot persist failed.';

create unique index if not exists estimates_requirement_generation_id_uidx
  on public.estimates (requirement_generation_id)
  where requirement_generation_id is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'estimates_latest_requirement_snapshot_id_fkey'
  ) then
    alter table public.estimates
      add constraint estimates_latest_requirement_snapshot_id_fkey
      foreign key (latest_requirement_snapshot_id)
      references public.estimate_requirement_snapshots (id)
      on delete set null;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- C. Commercial document lineage + component identity (REQ-4A-R1)
-- ---------------------------------------------------------------------------

alter table public.estimate_line_items
  add column if not exists component_key text
  check (
    component_key is null
    or (
      char_length(btrim(component_key)) > 0
      and char_length(component_key) <= 128
    )
  );

comment on column public.estimate_line_items.component_key is
  'Semantic estimate component identity (e.g. decking.surface, deck.labour). Not rate key or label. Null for legacy lines.';

alter table public.pricing_documents
  add column if not exists requirement_snapshot_id uuid;

comment on column public.pricing_documents.requirement_snapshot_id is
  'Immutable link to the estimate requirement snapshot at pricing create time. Does not change when estimate regenerates.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pricing_documents_requirement_snapshot_id_fkey'
  ) then
    alter table public.pricing_documents
      add constraint pricing_documents_requirement_snapshot_id_fkey
      foreign key (requirement_snapshot_id)
      references public.estimate_requirement_snapshots (id)
      on delete set null;
  end if;
end
$$;

create index if not exists pricing_documents_requirement_snapshot_idx
  on public.pricing_documents (requirement_snapshot_id)
  where requirement_snapshot_id is not null;

alter table public.pricing_items
  add column if not exists component_key text
  check (
    component_key is null
    or (
      char_length(btrim(component_key)) > 0
      and char_length(component_key) <= 128
    )
  );

comment on column public.pricing_items.component_key is
  'Copied from estimate_line_items.component_key at pricing create/recalibration. Null for legacy lines.';

-- ---------------------------------------------------------------------------
-- D. Parent org / estimate match + immutability
-- ---------------------------------------------------------------------------

drop trigger if exists estimate_requirement_snapshots_project_org_match
  on public.estimate_requirement_snapshots;
create trigger estimate_requirement_snapshots_project_org_match
  before insert or update on public.estimate_requirement_snapshots
  for each row
  execute function public.enforce_child_project_org_match();

create or replace function public.enforce_estimate_requirement_snapshot_parent_match()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  estimate_org uuid;
  estimate_project uuid;
begin
  select org_id, project_id
    into estimate_org, estimate_project
  from public.estimates
  where id = new.estimate_id;

  if estimate_org is null then
    raise exception 'estimate not found';
  end if;

  if new.org_id is distinct from estimate_org
     or new.project_id is distinct from estimate_project then
    raise exception 'estimate_requirement_snapshots org/project must match estimate';
  end if;

  return new;
end;
$$;

drop trigger if exists estimate_requirement_snapshots_estimate_match
  on public.estimate_requirement_snapshots;
create trigger estimate_requirement_snapshots_estimate_match
  before insert or update on public.estimate_requirement_snapshots
  for each row
  execute function public.enforce_estimate_requirement_snapshot_parent_match();

create or replace function public.protect_estimate_requirement_snapshot_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'REQ_SNAPSHOT:IMMUTABLE'
    using errcode = 'P0001';
end;
$$;

drop trigger if exists estimate_requirement_snapshots_protect_immutable
  on public.estimate_requirement_snapshots;
create trigger estimate_requirement_snapshots_protect_immutable
  before update on public.estimate_requirement_snapshots
  for each row
  execute function public.protect_estimate_requirement_snapshot_immutable();

-- ---------------------------------------------------------------------------
-- E. RLS
-- ---------------------------------------------------------------------------

alter table public.estimate_requirement_snapshots enable row level security;

create policy "Users can select requirement snapshots in their organisation"
  on public.estimate_requirement_snapshots
  for select
  using (org_id = public.auth_org_id());

create policy "Users can insert requirement snapshots in their organisation"
  on public.estimate_requirement_snapshots
  for insert
  with check (
    org_id = public.auth_org_id()
    and exists (
      select 1
      from public.estimates e
      where e.id = estimate_id
        and e.org_id = public.auth_org_id()
        and e.project_id = project_id
    )
  );

-- No authenticated UPDATE or DELETE policies. Payload is insert-only.
-- Deletion occurs only via project/estimate cascade (owner), matching current retention.

-- ---------------------------------------------------------------------------
-- F. Grants — override 026 default SIDU for this immutable table
-- ---------------------------------------------------------------------------

revoke all on table public.estimate_requirement_snapshots from anon, authenticated, service_role;

grant select, insert on table public.estimate_requirement_snapshots to authenticated;
grant select, insert, update, delete on table public.estimate_requirement_snapshots to service_role;

notify pgrst, 'reload schema';
