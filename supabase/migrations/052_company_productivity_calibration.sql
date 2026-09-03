-- COMPANY DNA-01 — company productivity calibration evidence + rate provenance.
-- Additive. Environment-neutral. Preview-first; safe later for Production chain.
-- Does not mutate 033 calibration_responses, quotes, pricing, or benchmark catalogues.
-- Does not mark estimates stale on backfill.

-- ---------------------------------------------------------------------------
-- A. Global V1 task catalogue (server-authoritative scenario definitions)
-- ---------------------------------------------------------------------------

create table public.productivity_calibration_catalogue (
  calibration_task_key text primary key
    check (
      char_length(btrim(calibration_task_key)) > 0
      and char_length(calibration_task_key) <= 128
    ),
  scenario_version text not null
    check (char_length(btrim(scenario_version)) > 0 and char_length(scenario_version) <= 32),
  work_area_type text not null
    check (work_area_type ~ '^[a-z][a-z0-9_]{0,63}$'),
  productivity_rate_key text not null
    check (char_length(btrim(productivity_rate_key)) > 0 and char_length(productivity_rate_key) <= 128),
  label text not null,
  prompt text not null,
  scenario_summary text not null,
  reference_quantity numeric(12, 4) not null check (reference_quantity > 0),
  reference_unit text not null,
  authority_quantity numeric(12, 4) not null check (authority_quantity > 0),
  authority_unit text not null,
  benchmark_productivity numeric(12, 4) not null check (benchmark_productivity > 0),
  rate_label text not null,
  is_high_impact boolean not null default true,
  sort_order integer not null default 0
);

comment on table public.productivity_calibration_catalogue is
  'Versioned V1 crew/time calibration scenarios. Global constants — not org authority.';

insert into public.productivity_calibration_catalogue (
  calibration_task_key,
  scenario_version,
  work_area_type,
  productivity_rate_key,
  label,
  prompt,
  scenario_summary,
  reference_quantity,
  reference_unit,
  authority_quantity,
  authority_unit,
  benchmark_productivity,
  rate_label,
  is_high_impact,
  sort_order
) values
  (
    'deck.framing.v1',
    '1',
    'deck',
    'deck.substructure.install.hours_per_framing_lm',
    'Deck framing',
    'Think about a fairly normal 20 m² deck with good access, ground-level / low height, and standard timber framing.',
    '20 m² timber deck · ground-level / low · normal access · standard framing',
    20,
    'm2',
    80,
    'lm',
    0.13,
    'Substructure framing (labour-h / framing lm)',
    true,
    10
  ),
  (
    'deck.decking.v1',
    '1',
    'deck',
    'deck.decking.install.hours_per_lm',
    'Decking installation',
    'Think about laying decking on a fairly normal 20 m² deck with good access and standard boards.',
    '20 m² timber deck · normal access · standard decking boards',
    20,
    'm2',
    142.8571,
    'lm',
    0.077,
    'Decking installation (labour-h / decking lm)',
    true,
    20
  ),
  (
    'deck.posts.v1',
    '1',
    'deck',
    'deck.posts.install.hours_per_ea',
    'Piles / posts',
    'Think about setting piles or posts for a fairly normal 20 m² ground-level deck with good access.',
    '20 m² timber deck · 9 supports · normal access',
    20,
    'm2',
    9,
    'ea',
    0.2,
    'Pile/post installation (hours/ea)',
    true,
    30
  ),
  (
    'deck.demolition.v1',
    '1',
    'deck',
    'deck.demolition_hours_per_m2',
    'Existing deck removal',
    'Think about taking up an existing 20 m² timber deck with good access.',
    '20 m² existing timber deck · normal access · strip and remove',
    20,
    'm2',
    20,
    'm2',
    0.35,
    'Deck demolition (hours/m²)',
    false,
    40
  ),
  (
    'fence.posts.v1',
    '1',
    'fence',
    'fence.post.install.hours_per_post',
    'Fence posts',
    'Think about setting posts for a fairly normal 20 lm timber paling fence, 1.8 m high, straight run, good access.',
    '20 lm · 1.8 m timber paling · 13 posts · normal access · straight run',
    20,
    'lm',
    13,
    'post',
    0.7,
    'Fence post installation',
    true,
    10
  ),
  (
    'fence.boards.v1',
    '1',
    'fence',
    'fence.board.vertical.hours_per_lm',
    'Fence palings',
    'Think about hanging palings on a fairly normal 20 lm × 1.8 m timber paling fence with good access.',
    '20 lm · 1.8 m timber paling · vertical boards · normal access',
    20,
    'lm',
    241.2,
    'lm',
    0.05,
    'Vertical paling installation',
    true,
    20
  ),
  (
    'fence.rails.v1',
    '1',
    'fence',
    'fence.rail.install.hours_per_lm',
    'Fence rails',
    'Think about fixing rails on a fairly normal 20 lm × 1.8 m timber paling fence with good access.',
    '20 lm · 1.8 m timber paling · 3 rails · normal access',
    20,
    'lm',
    60,
    'lm',
    0.08,
    'Fence rail installation',
    true,
    30
  ),
  (
    'retaining_wall.piles.v1',
    '1',
    'retaining_wall',
    'retaining_wall.timber.piles.install.hours_per_ea',
    'Retaining wall piles',
    'Think about setting timber piles for a fairly normal 10 lm × 1.0 m timber retaining wall with good access.',
    '10 lm · 1.0 m timber retaining · 10 piles · normal access',
    10,
    'lm',
    10,
    'ea',
    0.85,
    'Timber pile installation (hours/ea)',
    true,
    10
  ),
  (
    'retaining_wall.face.v1',
    '1',
    'retaining_wall',
    'retaining_wall.timber.face_boards.install.hours_per_m2',
    'Retaining wall face boards',
    'Think about fixing face boards on a fairly normal 10 lm × 1.0 m timber retaining wall once the piles are in.',
    '10 lm · 1.0 m timber retaining · 10 m² face · piles already in · normal access',
    10,
    'lm',
    10,
    'm2',
    0.55,
    'Timber face-board installation (hours/m²)',
    true,
    20
  );

alter table public.productivity_calibration_catalogue enable row level security;

create policy "Authenticated users can select productivity calibration catalogue"
  on public.productivity_calibration_catalogue
  for select
  to authenticated
  using (true);

revoke all on table public.productivity_calibration_catalogue from anon, authenticated, service_role;
grant select on table public.productivity_calibration_catalogue to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- B. Immutable org evidence
-- ---------------------------------------------------------------------------

create table public.productivity_calibration_responses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  work_area_type text not null
    check (work_area_type ~ '^[a-z][a-z0-9_]{0,63}$'),
  calibration_task_key text not null
    references public.productivity_calibration_catalogue (calibration_task_key)
    on delete restrict,
  scenario_version text not null,
  productivity_rate_key text not null,
  crew_size numeric(6, 2) not null check (crew_size > 0),
  duration_hours numeric(12, 4) not null check (duration_hours > 0),
  reference_quantity numeric(12, 4) not null check (reference_quantity > 0),
  reference_unit text not null,
  authority_quantity numeric(12, 4) not null check (authority_quantity > 0),
  authority_unit text not null,
  derived_person_hours numeric(12, 4) not null check (derived_person_hours > 0),
  derived_productivity numeric(12, 4) not null check (derived_productivity > 0),
  benchmark_productivity_snapshot numeric(12, 4) not null
    check (benchmark_productivity_snapshot > 0),
  outlier_confirmed boolean not null default false,
  notes text check (notes is null or char_length(notes) <= 2000),
  mapping_metadata jsonb not null default '{}'::jsonb
    check (
      jsonb_typeof(mapping_metadata) = 'object'
      and pg_column_size(mapping_metadata) <= 8192
    ),
  status text not null default 'active'
    check (status in ('active', 'superseded')),
  supersedes_id uuid references public.productivity_calibration_responses (id)
    on delete set null,
  superseded_at timestamptz,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pcr_superseded_requires_at check (
    (status = 'active' and superseded_at is null)
    or (status = 'superseded' and superseded_at is not null)
  )
);

comment on table public.productivity_calibration_responses is
  'Org-scoped crew×time calibration evidence. Append/supersede. Never live money authority.';

create unique index productivity_calibration_responses_one_active_per_task
  on public.productivity_calibration_responses (org_id, calibration_task_key)
  where status = 'active';

create index productivity_calibration_responses_org_created_idx
  on public.productivity_calibration_responses (org_id, created_at desc);

create index productivity_calibration_responses_org_wa_idx
  on public.productivity_calibration_responses (org_id, work_area_type, created_at desc);

create or replace function public.set_productivity_calibration_responses_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger productivity_calibration_responses_set_updated_at
  before update on public.productivity_calibration_responses
  for each row
  execute function public.set_productivity_calibration_responses_updated_at();

create or replace function public.protect_productivity_calibration_evidence()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if
      old.org_id is distinct from new.org_id
      or old.work_area_type is distinct from new.work_area_type
      or old.calibration_task_key is distinct from new.calibration_task_key
      or old.scenario_version is distinct from new.scenario_version
      or old.productivity_rate_key is distinct from new.productivity_rate_key
      or old.crew_size is distinct from new.crew_size
      or old.duration_hours is distinct from new.duration_hours
      or old.reference_quantity is distinct from new.reference_quantity
      or old.reference_unit is distinct from new.reference_unit
      or old.authority_quantity is distinct from new.authority_quantity
      or old.authority_unit is distinct from new.authority_unit
      or old.derived_person_hours is distinct from new.derived_person_hours
      or old.derived_productivity is distinct from new.derived_productivity
      or old.benchmark_productivity_snapshot is distinct from new.benchmark_productivity_snapshot
      or old.outlier_confirmed is distinct from new.outlier_confirmed
      or old.notes is distinct from new.notes
      or old.mapping_metadata is distinct from new.mapping_metadata
      or old.created_by is distinct from new.created_by
      or old.created_at is distinct from new.created_at
      or old.supersedes_id is distinct from new.supersedes_id
    then
      raise exception 'DNA:EVIDENCE_IMMUTABLE'
        using errcode = 'P0001';
    end if;

    if not (
      (old.status = 'active' and new.status = 'superseded' and new.superseded_at is not null)
      or (old.status = new.status and old.superseded_at is not distinct from new.superseded_at)
    ) then
      raise exception 'DNA:INVALID_STATUS_TRANSITION'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

create trigger productivity_calibration_responses_protect_evidence
  before update on public.productivity_calibration_responses
  for each row
  execute function public.protect_productivity_calibration_evidence();

alter table public.productivity_calibration_responses enable row level security;

create policy "Users can select productivity calibration responses in their organisation"
  on public.productivity_calibration_responses
  for select
  using (org_id = public.auth_org_id());

-- Writes go through SECURITY DEFINER RPCs only.
revoke all on table public.productivity_calibration_responses from anon, authenticated, service_role;
grant select on table public.productivity_calibration_responses to authenticated;
grant select, insert, update, delete on table public.productivity_calibration_responses to service_role;

-- ---------------------------------------------------------------------------
-- C. rates provenance + 4 d.p. cost_rate (hours/unit safety)
-- ---------------------------------------------------------------------------

alter table public.rates
  add column if not exists source text,
  add column if not exists source_calibration_id uuid
    references public.productivity_calibration_responses (id)
    on delete set null,
  add column if not exists updated_by uuid
    references public.profiles (id)
    on delete set null;

update public.rates
set source = 'explicit_company'
where source is null;

alter table public.rates
  alter column source set default 'explicit_company';

alter table public.rates
  alter column source set not null;

alter table public.rates
  drop constraint if exists rates_source_check;

alter table public.rates
  add constraint rates_source_check
  check (source in ('explicit_company', 'calibrated_productivity'));

alter table public.rates
  drop constraint if exists rates_source_calibration_integrity;

alter table public.rates
  add constraint rates_source_calibration_integrity
  check (
    (
      source = 'explicit_company'
      and source_calibration_id is null
    )
    or (
      source = 'calibrated_productivity'
      and source_calibration_id is not null
      and rate_type = 'productivity'
    )
  );

alter table public.rates
  alter column cost_rate type numeric(12, 4);

alter table public.rates
  alter column cost_rate_low type numeric(12, 4);

alter table public.rates
  alter column cost_rate_high type numeric(12, 4);

comment on column public.rates.source is
  'Company rate provenance. explicit_company = typed cost; calibrated_productivity = derived from crew/time evidence.';

comment on column public.rates.source_calibration_id is
  'Evidence row that produced a calibrated productivity override. Evidence is durable; deleting a rate must not delete it.';

comment on column public.rates.updated_by is
  'Profile that last changed this company rate.';

-- ---------------------------------------------------------------------------
-- D. Helpers
-- ---------------------------------------------------------------------------

create or replace function public.mark_estimates_stale_for_work_area_type(
  p_org_id uuid,
  p_work_area_type text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_org_id is null or nullif(btrim(p_work_area_type), '') is null then
    return 0;
  end if;

  update public.estimates e
  set is_stale = true
  where e.org_id = p_org_id
    and e.is_stale is distinct from true
    and exists (
      select 1
      from public.work_areas wa
      where wa.project_id = e.project_id
        and wa.org_id = p_org_id
        and wa.type = btrim(p_work_area_type)
        and wa.status is distinct from 'excluded'
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_estimates_stale_for_work_area_type(uuid, text)
  from public, anon, authenticated;

grant execute on function public.mark_estimates_stale_for_work_area_type(uuid, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- E. save_productivity_calibration — server-authoritative
-- ---------------------------------------------------------------------------

create or replace function public.save_productivity_calibration(
  p_calibration_task_key text,
  p_crew_size numeric,
  p_duration_hours numeric,
  p_outlier_confirmed boolean default false,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := public.auth_org_id();
  v_role text;
  v_task public.productivity_calibration_catalogue%rowtype;
  v_person_hours numeric(12, 4);
  v_productivity numeric(12, 4);
  v_ratio numeric;
  v_warn boolean := false;
  v_prior_id uuid;
  v_new_id uuid;
  v_stale integer := 0;
begin
  if v_uid is null or v_org is null then
    raise exception 'DNA:NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select m.role
    into v_role
  from public.organisation_memberships m
  where m.org_id = v_org
    and m.user_id = v_uid
    and m.status = 'active'
  limit 1;

  if v_role is null or v_role not in ('owner', 'admin', 'estimator') then
    raise exception 'DNA:FORBIDDEN' using errcode = 'P0001';
  end if;

  if nullif(btrim(p_calibration_task_key), '') is null then
    raise exception 'DNA:UNKNOWN_TASK' using errcode = 'P0001';
  end if;

  select *
    into v_task
  from public.productivity_calibration_catalogue
  where calibration_task_key = btrim(p_calibration_task_key);

  if not found then
    raise exception 'DNA:UNKNOWN_TASK' using errcode = 'P0001';
  end if;

  if p_crew_size is null or p_crew_size < 1 or p_crew_size > 20 then
    raise exception 'DNA:INVALID_CREW' using errcode = 'P0001';
  end if;

  if p_duration_hours is null or p_duration_hours < 0.25 or p_duration_hours > 200 then
    raise exception 'DNA:INVALID_DURATION' using errcode = 'P0001';
  end if;

  v_person_hours := round(p_crew_size * p_duration_hours, 4);
  if v_person_hours <= 0 then
    raise exception 'DNA:INVALID_DURATION' using errcode = 'P0001';
  end if;

  v_productivity := round(v_person_hours / v_task.authority_quantity, 4);
  if v_productivity <= 0 then
    raise exception 'DNA:INVALID_DURATION' using errcode = 'P0001';
  end if;

  v_ratio := v_productivity / v_task.benchmark_productivity;

  if v_ratio < 0.05 or v_ratio > 20 then
    raise exception 'DNA:OUTLIER_HARD' using errcode = 'P0001';
  end if;

  if p_crew_size > 8 or p_duration_hours > 40 or v_ratio < 0.5 or v_ratio > 2 then
    v_warn := true;
  end if;

  if v_warn and coalesce(p_outlier_confirmed, false) is not true then
    raise exception 'DNA:OUTLIER_CONFIRM_REQUIRED' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(
    87230152,
    hashtext(v_org::text || ':' || v_task.calibration_task_key)
  );

  select id
    into v_prior_id
  from public.productivity_calibration_responses
  where org_id = v_org
    and calibration_task_key = v_task.calibration_task_key
    and status = 'active'
  for update;

  if v_prior_id is not null then
    update public.productivity_calibration_responses
    set
      status = 'superseded',
      superseded_at = now()
    where id = v_prior_id
      and org_id = v_org
      and status = 'active';
  end if;

  insert into public.productivity_calibration_responses (
    org_id,
    work_area_type,
    calibration_task_key,
    scenario_version,
    productivity_rate_key,
    crew_size,
    duration_hours,
    reference_quantity,
    reference_unit,
    authority_quantity,
    authority_unit,
    derived_person_hours,
    derived_productivity,
    benchmark_productivity_snapshot,
    outlier_confirmed,
    notes,
    mapping_metadata,
    status,
    supersedes_id,
    created_by
  )
  values (
    v_org,
    v_task.work_area_type,
    v_task.calibration_task_key,
    v_task.scenario_version,
    v_task.productivity_rate_key,
    p_crew_size,
    p_duration_hours,
    v_task.reference_quantity,
    v_task.reference_unit,
    v_task.authority_quantity,
    v_task.authority_unit,
    v_person_hours,
    v_productivity,
    v_task.benchmark_productivity,
    coalesce(p_outlier_confirmed, false) and v_warn,
    nullif(btrim(coalesce(p_notes, '')), ''),
    jsonb_build_object(
      'reference_to_authority',
      'Canonical V1 scenario conversion; not a client-supplied factor.'
    ),
    'active',
    v_prior_id,
    v_uid
  )
  returning id into v_new_id;

  insert into public.rates (
    org_id,
    rate_type,
    work_area_type,
    item_key,
    label,
    unit,
    cost_rate,
    sell_rate,
    markup_percent,
    active,
    source,
    source_calibration_id,
    updated_by
  )
  values (
    v_org,
    'productivity',
    v_task.work_area_type,
    v_task.productivity_rate_key,
    v_task.rate_label,
    v_task.authority_unit,
    v_productivity,
    null,
    null,
    true,
    'calibrated_productivity',
    v_new_id,
    v_uid
  )
  on conflict (org_id, rate_type, item_key)
  do update set
    cost_rate = excluded.cost_rate,
    unit = excluded.unit,
    label = excluded.label,
    work_area_type = excluded.work_area_type,
    sell_rate = null,
    markup_percent = null,
    active = true,
    source = 'calibrated_productivity',
    source_calibration_id = excluded.source_calibration_id,
    updated_by = excluded.updated_by,
    updated_at = now();

  v_stale := public.mark_estimates_stale_for_work_area_type(
    v_org,
    v_task.work_area_type
  );

  return jsonb_build_object(
    'id', v_new_id,
    'calibration_task_key', v_task.calibration_task_key,
    'scenario_version', v_task.scenario_version,
    'work_area_type', v_task.work_area_type,
    'productivity_rate_key', v_task.productivity_rate_key,
    'derived_person_hours', v_person_hours,
    'derived_productivity', v_productivity,
    'benchmark_productivity', v_task.benchmark_productivity,
    'status', 'active',
    'superseded_prior_id', v_prior_id,
    'stale_estimates', v_stale
  );
end;
$$;

comment on function public.save_productivity_calibration is
  'Derive company productivity from crew×time against the canonical catalogue. Writes evidence + productivity rate. Never writes labour $/h, materials, or margin.';

-- ---------------------------------------------------------------------------
-- F. reset_productivity_to_benchmark
-- ---------------------------------------------------------------------------

create or replace function public.reset_productivity_to_benchmark(
  p_calibration_task_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := public.auth_org_id();
  v_role text;
  v_task public.productivity_calibration_catalogue%rowtype;
  v_updated integer := 0;
  v_stale integer := 0;
begin
  if v_uid is null or v_org is null then
    raise exception 'DNA:NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select m.role
    into v_role
  from public.organisation_memberships m
  where m.org_id = v_org
    and m.user_id = v_uid
    and m.status = 'active'
  limit 1;

  if v_role is null or v_role not in ('owner', 'admin', 'estimator') then
    raise exception 'DNA:FORBIDDEN' using errcode = 'P0001';
  end if;

  select *
    into v_task
  from public.productivity_calibration_catalogue
  where calibration_task_key = btrim(p_calibration_task_key);

  if not found then
    raise exception 'DNA:UNKNOWN_TASK' using errcode = 'P0001';
  end if;

  update public.rates
  set
    active = false,
    updated_by = v_uid,
    updated_at = now()
  where org_id = v_org
    and rate_type = 'productivity'
    and item_key = v_task.productivity_rate_key
    and source = 'calibrated_productivity'
    and active = true;

  get diagnostics v_updated = row_count;

  if v_updated > 0 then
    v_stale := public.mark_estimates_stale_for_work_area_type(
      v_org,
      v_task.work_area_type
    );
  end if;

  return jsonb_build_object(
    'calibration_task_key', v_task.calibration_task_key,
    'productivity_rate_key', v_task.productivity_rate_key,
    'deactivated', v_updated > 0,
    'fallback_source', 'Quotr benchmark',
    'stale_estimates', v_stale
  );
end;
$$;

comment on function public.reset_productivity_to_benchmark is
  'Deactivate calibrated company productivity so the resolver falls through to the Quotr benchmark. Evidence is retained.';

revoke all on function public.save_productivity_calibration(text, numeric, numeric, boolean, text)
  from public, anon;
revoke all on function public.reset_productivity_to_benchmark(text)
  from public, anon;

grant execute on function public.save_productivity_calibration(text, numeric, numeric, boolean, text)
  to authenticated, service_role;
grant execute on function public.reset_productivity_to_benchmark(text)
  to authenticated, service_role;

notify pgrst, 'reload schema';
