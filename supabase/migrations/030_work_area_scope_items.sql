-- Stage 3.1B.7F-R2 — User-authored work-area scope items (LOCAL FIRST).
-- Additive. Does not mutate Facts, discovery suggestions, commercial formulas,
-- Company DNA, or Analyse Job. Origin is always 'user' — never a fake AI proposal.
--
-- Remote apply is NOT part of this migration task — owner deploy step separately.

-- ---------------------------------------------------------------------------
-- A. work_area_scope_items — definition rows (user provenance only)
-- ---------------------------------------------------------------------------

create table public.work_area_scope_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  work_area_id uuid not null references public.work_areas (id) on delete cascade,
  identity text not null,
  title text not null,
  description text null,
  scope_item_type text null,
  origin text not null default 'user'
    check (origin = 'user'),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_area_scope_items_title_len
    check (char_length(btrim(title)) between 1 and 200),
  constraint work_area_scope_items_description_len
    check (description is null or char_length(description) <= 2000),
  constraint work_area_scope_items_identity_len
    check (char_length(identity) between 1 and 160),
  constraint work_area_scope_items_type_len
    check (scope_item_type is null or char_length(scope_item_type) <= 80),
  constraint work_area_scope_items_project_wa_identity_unique
    unique (project_id, work_area_id, identity)
);

comment on table public.work_area_scope_items is
  'User-authored scope items under a confirmed Work Area. Not discovery suggestions. No Facts, no commercial values, no Company DNA.';

comment on column public.work_area_scope_items.origin is
  'Always user — truthful provenance. Never deterministic/ai/merged.';

comment on column public.work_area_scope_items.scope_item_type is
  'Optional canonical type when the builder selects/matches one; otherwise null (user-defined).';

create index work_area_scope_items_project_idx
  on public.work_area_scope_items (project_id);

create index work_area_scope_items_wa_idx
  on public.work_area_scope_items (work_area_id);

create index work_area_scope_items_org_idx
  on public.work_area_scope_items (org_id);

-- Keep org/project/work_area aligned with parent work_areas row.
create or replace function public.work_area_scope_items_enforce_parent()
returns trigger
language plpgsql
as $$
declare
  wa record;
begin
  select id, org_id, project_id, status
    into wa
  from public.work_areas
  where id = new.work_area_id;

  if wa.id is null then
    raise exception 'work_area_scope_items: work area not found';
  end if;
  if wa.org_id is distinct from new.org_id
     or wa.project_id is distinct from new.project_id then
    raise exception 'work_area_scope_items: org/project must match parent work area';
  end if;
  if wa.status is distinct from 'confirmed' then
    raise exception 'work_area_scope_items: parent work area must be confirmed';
  end if;
  return new;
end;
$$;

create trigger work_area_scope_items_enforce_parent_trg
  before insert or update of org_id, project_id, work_area_id
  on public.work_area_scope_items
  for each row
  execute function public.work_area_scope_items_enforce_parent();

drop trigger if exists set_updated_at on public.work_area_scope_items;
create trigger set_updated_at
  before update on public.work_area_scope_items
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- B. work_area_scope_item_decisions — append-only INCLUDE / EXCLUDE
-- ---------------------------------------------------------------------------

create table public.work_area_scope_item_decisions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  scope_item_id uuid not null
    references public.work_area_scope_items (id) on delete cascade,
  decision_type text not null
    check (decision_type in ('INCLUDE', 'EXCLUDE')),
  decided_by uuid not null references public.profiles (id),
  decided_at timestamptz not null default now(),
  reason_code text null,
  created_at timestamptz not null default now()
);

comment on table public.work_area_scope_item_decisions is
  'Append-only include/exclude history for user-authored scope items. Latest decision wins. No Facts.';

create index work_area_scope_item_decisions_item_decided_idx
  on public.work_area_scope_item_decisions (scope_item_id, decided_at desc);

create index work_area_scope_item_decisions_project_idx
  on public.work_area_scope_item_decisions (project_id);

create or replace function public.work_area_scope_item_decisions_enforce_parent()
returns trigger
language plpgsql
as $$
declare
  item record;
begin
  select id, org_id, project_id
    into item
  from public.work_area_scope_items
  where id = new.scope_item_id;

  if item.id is null then
    raise exception 'work_area_scope_item_decisions: scope item not found';
  end if;
  if item.org_id is distinct from new.org_id
     or item.project_id is distinct from new.project_id then
    raise exception 'work_area_scope_item_decisions: org/project must match scope item';
  end if;
  return new;
end;
$$;

create trigger work_area_scope_item_decisions_enforce_parent_trg
  before insert
  on public.work_area_scope_item_decisions
  for each row
  execute function public.work_area_scope_item_decisions_enforce_parent();

-- No UPDATE/DELETE of decisions for authenticated users (append-only).

-- ---------------------------------------------------------------------------
-- C. RLS
-- ---------------------------------------------------------------------------

alter table public.work_area_scope_items enable row level security;
alter table public.work_area_scope_item_decisions enable row level security;

create policy "work_area_scope_items_select_own_org"
  on public.work_area_scope_items for select
  using (org_id = public.auth_org_id());

create policy "work_area_scope_items_insert_own_org"
  on public.work_area_scope_items for insert
  with check (org_id = public.auth_org_id());

create policy "work_area_scope_items_update_own_org"
  on public.work_area_scope_items for update
  using (org_id = public.auth_org_id())
  with check (org_id = public.auth_org_id());

-- No authenticated DELETE on items (soft via EXCLUDE decisions).

create policy "work_area_scope_item_decisions_select_own_org"
  on public.work_area_scope_item_decisions for select
  using (org_id = public.auth_org_id());

create policy "work_area_scope_item_decisions_insert_own_org"
  on public.work_area_scope_item_decisions for insert
  with check (org_id = public.auth_org_id());

-- No authenticated UPDATE/DELETE on decisions.

-- ---------------------------------------------------------------------------
-- D. Grants (parity with 026/028 authenticated patterns)
-- ---------------------------------------------------------------------------

grant select, insert, update on public.work_area_scope_items to authenticated;
grant select, insert on public.work_area_scope_item_decisions to authenticated;

grant all on public.work_area_scope_items to service_role;
grant all on public.work_area_scope_item_decisions to service_role;

-- Deny anon explicitly (no grants to anon).

notify pgrst, 'reload schema';
