-- Stage 3.1C.3-R2D.1 — Calibration evidence persistence (LOCAL COMPLETE; remote pending owner gate).
-- Additive only. Does not mutate rates, projects, facts, estimates, pricing, or quotes.
-- Calibration remains EVIDENCE ONLY — never live rate authority / Company DNA.

-- ---------------------------------------------------------------------------
-- A. Table
-- ---------------------------------------------------------------------------

create table public.calibration_responses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  scenario_id text not null
    check (char_length(btrim(scenario_id)) > 0 and char_length(scenario_id) <= 128),
  scenario_version text not null
    check (char_length(btrim(scenario_version)) > 0 and char_length(scenario_version) <= 32),
  work_area_type text not null
    check (
      work_area_type ~ '^[a-z][a-z0-9_]{0,63}$'
    ),

  labour_hours numeric(12, 2)
    check (labour_hours is null or labour_hours >= 0),
  labour_cost numeric(12, 2)
    check (labour_cost is null or labour_cost >= 0),
  materials_cost numeric(12, 2)
    check (materials_cost is null or materials_cost >= 0),
  subcontractors_cost numeric(12, 2)
    check (subcontractors_cost is null or subcontractors_cost >= 0),
  other_cost numeric(12, 2)
    check (other_cost is null or other_cost >= 0),
  expected_total_cost numeric(12, 2)
    check (expected_total_cost is null or expected_total_cost >= 0),
  expected_sell numeric(12, 2)
    check (expected_sell is null or expected_sell >= 0),

  confidence text
    check (confidence is null or confidence in ('low', 'medium', 'high')),
  notes text
    check (notes is null or char_length(notes) <= 4000),

  -- Bounded observational compare at save time (not estimate history)
  engine_snapshot jsonb not null default '{}'::jsonb
    check (
      jsonb_typeof(engine_snapshot) = 'object'
      and pg_column_size(engine_snapshot) <= 32768
    ),
  -- Extensible non-authoritative metadata only
  response_metadata jsonb not null default '{}'::jsonb
    check (
      jsonb_typeof(response_metadata) = 'object'
      and pg_column_size(response_metadata) <= 8192
    ),

  status text not null default 'active'
    check (status in ('active', 'superseded')),
  supersedes_id uuid references public.calibration_responses (id) on delete set null,
  superseded_at timestamptz null,

  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint calibration_responses_superseded_requires_at
    check (
      (status = 'active' and superseded_at is null)
      or (status = 'superseded' and superseded_at is not null)
    )
);

comment on table public.calibration_responses is
  'Org-scoped calibration evidence. Append/supersede history. Never live rate authority.';

comment on column public.calibration_responses.engine_snapshot is
  'Bounded Quotr compare snapshot at save (cost/sell/deltas/categories). Not commercial mutation authority.';

comment on column public.calibration_responses.response_metadata is
  'Non-authoritative extensible metadata only — never substitute for commercial columns.';

create unique index calibration_responses_one_active_per_scenario
  on public.calibration_responses (org_id, scenario_id)
  where status = 'active';

create index calibration_responses_org_created_idx
  on public.calibration_responses (org_id, created_at desc);

create index calibration_responses_org_scenario_idx
  on public.calibration_responses (org_id, scenario_id, created_at desc);

-- ---------------------------------------------------------------------------
-- B. updated_at + protect historical commercial evidence on UPDATE
-- ---------------------------------------------------------------------------

create or replace function public.set_calibration_responses_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger calibration_responses_set_updated_at
  before update on public.calibration_responses
  for each row
  execute function public.set_calibration_responses_updated_at();

-- Authenticated UPDATE is limited to supersede metadata. Commercial answers are append-only.
create or replace function public.protect_calibration_response_evidence()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if
      old.org_id is distinct from new.org_id
      or old.scenario_id is distinct from new.scenario_id
      or old.scenario_version is distinct from new.scenario_version
      or old.work_area_type is distinct from new.work_area_type
      or old.labour_hours is distinct from new.labour_hours
      or old.labour_cost is distinct from new.labour_cost
      or old.materials_cost is distinct from new.materials_cost
      or old.subcontractors_cost is distinct from new.subcontractors_cost
      or old.other_cost is distinct from new.other_cost
      or old.expected_total_cost is distinct from new.expected_total_cost
      or old.expected_sell is distinct from new.expected_sell
      or old.confidence is distinct from new.confidence
      or old.notes is distinct from new.notes
      or old.engine_snapshot is distinct from new.engine_snapshot
      or old.response_metadata is distinct from new.response_metadata
      or old.created_by is distinct from new.created_by
      or old.created_at is distinct from new.created_at
      or old.supersedes_id is distinct from new.supersedes_id
    then
      raise exception 'CALIBRATION:EVIDENCE_IMMUTABLE'
        using errcode = 'P0001';
    end if;

    if not (
      (old.status = 'active' and new.status = 'superseded' and new.superseded_at is not null)
      or (old.status = new.status and old.superseded_at is not distinct from new.superseded_at)
    ) then
      raise exception 'CALIBRATION:INVALID_STATUS_TRANSITION'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

create trigger calibration_responses_protect_evidence
  before update on public.calibration_responses
  for each row
  execute function public.protect_calibration_response_evidence();

-- ---------------------------------------------------------------------------
-- C. Atomic save RPC (SECURITY INVOKER — RLS + auth_org_id apply)
-- ---------------------------------------------------------------------------

create or replace function public.save_calibration_response(
  p_scenario_id text,
  p_scenario_version text,
  p_work_area_type text,
  p_labour_hours numeric default null,
  p_labour_cost numeric default null,
  p_materials_cost numeric default null,
  p_subcontractors_cost numeric default null,
  p_other_cost numeric default null,
  p_expected_total_cost numeric default null,
  p_expected_sell numeric default null,
  p_confidence text default null,
  p_notes text default null,
  p_engine_snapshot jsonb default '{}'::jsonb,
  p_response_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := public.auth_org_id();
  v_prior_id uuid;
  v_new_id uuid;
begin
  if v_uid is null or v_org is null then
    raise exception 'CALIBRATION:NOT_AUTHENTICATED'
      using errcode = 'P0001';
  end if;

  if nullif(btrim(p_scenario_id), '') is null
     or nullif(btrim(p_scenario_version), '') is null
     or nullif(btrim(p_work_area_type), '') is null then
    raise exception 'CALIBRATION:INVALID_SCENARIO'
      using errcode = 'P0001';
  end if;

  if p_engine_snapshot is null or jsonb_typeof(p_engine_snapshot) <> 'object' then
    raise exception 'CALIBRATION:INVALID_SNAPSHOT'
      using errcode = 'P0001';
  end if;

  if p_response_metadata is null or jsonb_typeof(p_response_metadata) <> 'object' then
    raise exception 'CALIBRATION:INVALID_METADATA'
      using errcode = 'P0001';
  end if;

  -- Serialize recalibrations for the same org+scenario within this transaction.
  perform pg_advisory_xact_lock(
    87230133,
    hashtext(v_org::text || ':' || btrim(p_scenario_id))
  );

  select id
    into v_prior_id
  from public.calibration_responses
  where org_id = v_org
    and scenario_id = btrim(p_scenario_id)
    and status = 'active'
  for update;

  if v_prior_id is not null then
    update public.calibration_responses
    set
      status = 'superseded',
      superseded_at = now()
    where id = v_prior_id
      and org_id = v_org
      and status = 'active';
  end if;

  insert into public.calibration_responses (
    org_id,
    scenario_id,
    scenario_version,
    work_area_type,
    labour_hours,
    labour_cost,
    materials_cost,
    subcontractors_cost,
    other_cost,
    expected_total_cost,
    expected_sell,
    confidence,
    notes,
    engine_snapshot,
    response_metadata,
    status,
    supersedes_id,
    created_by
  )
  values (
    v_org,
    btrim(p_scenario_id),
    btrim(p_scenario_version),
    btrim(p_work_area_type),
    p_labour_hours,
    p_labour_cost,
    p_materials_cost,
    p_subcontractors_cost,
    p_other_cost,
    p_expected_total_cost,
    p_expected_sell,
    nullif(btrim(p_confidence), ''),
    nullif(btrim(p_notes), ''),
    coalesce(p_engine_snapshot, '{}'::jsonb),
    coalesce(p_response_metadata, '{}'::jsonb),
    'active',
    v_prior_id,
    v_uid
  )
  returning id into v_new_id;

  return jsonb_build_object(
    'id', v_new_id,
    'scenario_id', btrim(p_scenario_id),
    'scenario_version', btrim(p_scenario_version),
    'status', 'active',
    'superseded_prior_id', v_prior_id
  );
end;
$$;

comment on function public.save_calibration_response is
  'Atomically supersede prior active calibration and insert new evidence. Org/created_by from auth. Never mutates rates.';

-- ---------------------------------------------------------------------------
-- D. RLS
-- ---------------------------------------------------------------------------

alter table public.calibration_responses enable row level security;

create policy "Users can select calibration responses in their organisation"
  on public.calibration_responses
  for select
  using (org_id = public.auth_org_id());

create policy "Users can insert calibration responses in their organisation"
  on public.calibration_responses
  for insert
  with check (
    org_id = public.auth_org_id()
    and created_by = auth.uid()
  );

-- UPDATE allowed only for supersede metadata (enforced by protect trigger).
create policy "Users can update calibration responses in their organisation"
  on public.calibration_responses
  for update
  using (org_id = public.auth_org_id())
  with check (org_id = public.auth_org_id());

-- No DELETE policy for authenticated — append/supersede only.

-- ---------------------------------------------------------------------------
-- E. Grants (narrow; override 026 SIDU for this table)
-- ---------------------------------------------------------------------------

revoke all on table public.calibration_responses from anon, authenticated, service_role;

grant select, insert, update on table public.calibration_responses to authenticated;
grant select, insert, update, delete on table public.calibration_responses to service_role;

revoke all on function public.save_calibration_response(
  text, text, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text, text, jsonb, jsonb
) from public, anon;

grant execute on function public.save_calibration_response(
  text, text, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text, text, jsonb, jsonb
) to authenticated, service_role;

notify pgrst, 'reload schema';
