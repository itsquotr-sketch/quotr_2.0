-- VARIATIONS-01 — additive variation domain.
-- A variation is a signed change against one accepted commercial snapshot.
-- It does not rewrite that snapshot, quote money, estimates, pricing, or rates.
-- Negative amounts are valid only on variation adjustment columns.
-- Preview/local only until an authorised migration is applied. Never Production from the app.

-- ---------------------------------------------------------------------------
-- A. Tables
-- ---------------------------------------------------------------------------

create table if not exists public.project_variation_counters (
  project_id uuid primary key references public.projects (id) on delete cascade,
  org_id uuid not null references public.organisations (id) on delete cascade,
  last_value integer not null default 0 check (last_value >= 0)
);

comment on table public.project_variation_counters is
  'Atomic project-scoped variation numbers. Clients do not choose the number.';

create table if not exists public.variations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  accepted_snapshot_id uuid not null references public.accepted_commercial_snapshots (id) on delete cascade,
  variation_number integer not null check (variation_number >= 1),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  summary text check (summary is null or char_length(summary) <= 2000),
  status text not null check (
    status in ('draft', 'issued', 'accepted', 'rejected', 'withdrawn', 'superseded')
  ),
  current_revision_id uuid,
  created_by uuid references public.profiles (id) on delete set null,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint variations_project_number_uidx unique (project_id, variation_number),
  constraint variations_idempotency_uidx unique (org_id, idempotency_key)
);

create index if not exists variations_org_project_idx
  on public.variations (org_id, project_id, variation_number);

comment on table public.variations is
  'Logical variation. The number is stable across revisions. current_revision_id has no foreign key because the revision row points back here.';

create table if not exists public.variation_revisions (
  id uuid primary key default gen_random_uuid(),
  variation_id uuid not null references public.variations (id) on delete cascade,
  org_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  revision_number integer not null check (revision_number >= 1),
  status text not null check (
    status in ('draft', 'issued', 'accepted', 'rejected', 'withdrawn', 'superseded')
  ),
  currency text not null check (char_length(btrim(currency)) > 0),
  gst_rate numeric(5, 2) not null check (gst_rate >= 0 and gst_rate <= 100),
  tax_treatment text not null check (char_length(btrim(tax_treatment)) > 0),
  total_direct_cost_adjustment numeric(12, 2),
  total_sell_adjustment_ex_gst numeric(12, 2),
  gst_adjustment numeric(12, 2),
  total_adjustment_incl_gst numeric(12, 2),
  proposed_time_effect_days integer check (
    proposed_time_effect_days is null
    or proposed_time_effect_days between -3650 and 3650
  ),
  client_notes text check (client_notes is null or char_length(client_notes) <= 4000),
  internal_notes text check (internal_notes is null or char_length(internal_notes) <= 4000),
  issued_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  withdrawn_at timestamptz,
  superseded_at timestamptz,
  issued_by uuid references public.profiles (id) on delete set null,
  accepted_by uuid references public.profiles (id) on delete set null,
  rejected_by uuid references public.profiles (id) on delete set null,
  withdrawn_by uuid references public.profiles (id) on delete set null,
  acceptance_source text check (
    acceptance_source is null or acceptance_source = 'internal_user'
  ),
  revised_from_revision_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint variation_revisions_number_uidx unique (variation_id, revision_number)
);

create unique index if not exists variation_revisions_one_accepted_uidx
  on public.variation_revisions (variation_id)
  where status = 'accepted';

create unique index if not exists variation_revisions_one_open_uidx
  on public.variation_revisions (variation_id)
  where status <> 'superseded';

create index if not exists variation_revisions_org_project_idx
  on public.variation_revisions (org_id, project_id);

comment on column public.variation_revisions.acceptance_source is
  'internal_user is authenticated domain readiness. It is not public client consent.';

comment on table public.variation_revisions is
  'Immutable once it leaves draft, except an authorised status transition. Currency and GST are copied from the accepted snapshot.';

create table if not exists public.variation_items (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.variation_revisions (id) on delete cascade,
  variation_id uuid not null references public.variations (id) on delete cascade,
  org_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  item_type text not null check (item_type in ('addition', 'omission', 'no_cost_scope_change')),
  client_description text not null check (char_length(btrim(client_description)) between 1 and 500),
  -- Traceability only. No foreign key, so deleting a work area or snapshot line
  -- cannot rewrite an issued variation item.
  work_area_id uuid,
  work_area_type text,
  snapshot_line_id uuid,
  stable_component_key text check (
    stable_component_key is null or char_length(stable_component_key) <= 120
  ),
  quantity numeric(12, 4) not null check (quantity > 0 and quantity <= 1000000),
  unit text not null check (char_length(btrim(unit)) between 1 and 40),
  unit_cost numeric(12, 2),
  line_cost_adjustment numeric(12, 2),
  unit_sell numeric(12, 2),
  line_sell_adjustment_ex_gst numeric(12, 2),
  sort_order integer not null check (sort_order >= 0),
  client_inclusion text check (client_inclusion is null or char_length(client_inclusion) <= 500),
  client_exclusion text check (client_exclusion is null or char_length(client_exclusion) <= 500),
  internal_metadata jsonb not null default '{}'::jsonb,
  substitution_group_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint variation_items_cost_pair_chk check (
    (unit_cost is null and line_cost_adjustment is null)
    or (unit_cost is not null and line_cost_adjustment is not null)
  ),
  constraint variation_items_sell_pair_chk check (
    (unit_sell is null and line_sell_adjustment_ex_gst is null)
    or (unit_sell is not null and line_sell_adjustment_ex_gst is not null)
  ),
  constraint variation_items_addition_sell_chk check (
    item_type <> 'addition'
    or line_sell_adjustment_ex_gst is null
    or line_sell_adjustment_ex_gst > 0
  ),
  constraint variation_items_addition_cost_chk check (
    item_type <> 'addition'
    or line_cost_adjustment is null
    or line_cost_adjustment >= 0
  ),
  constraint variation_items_omission_sell_chk check (
    item_type <> 'omission'
    or line_sell_adjustment_ex_gst is null
    or line_sell_adjustment_ex_gst < 0
  ),
  constraint variation_items_omission_cost_chk check (
    item_type <> 'omission'
    or line_cost_adjustment is null
    or line_cost_adjustment <= 0
  ),
  constraint variation_items_nocost_chk check (
    item_type <> 'no_cost_scope_change'
    or (
      unit_sell = 0
      and line_sell_adjustment_ex_gst = 0
      and unit_cost is null
      and line_cost_adjustment is null
      and substitution_group_id is null
    )
  ),
  constraint variation_items_substitution_type_chk check (
    substitution_group_id is null or item_type in ('addition', 'omission')
  )
);

create index if not exists variation_items_revision_sort_idx
  on public.variation_items (revision_id, sort_order);

create index if not exists variation_items_org_project_idx
  on public.variation_items (org_id, project_id);

create index if not exists variation_items_snapshot_line_idx
  on public.variation_items (snapshot_line_id);

comment on table public.variation_items is
  'Signed adjustment lines. A substitution is one omission and one addition sharing substitution_group_id. Snapshot line ids are traceability only.';

create table if not exists public.variation_command_receipts (
  org_id uuid not null references public.organisations (id) on delete cascade,
  command text not null check (command in ('create')),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  variation_id uuid not null references public.variations (id) on delete cascade,
  revision_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (org_id, command, idempotency_key)
);

comment on table public.variation_command_receipts is
  'Create idempotency. Issue and acceptance are idempotent from revision status.';

-- ---------------------------------------------------------------------------
-- B. Rounding matches the document contract: half toward positive infinity.
-- ---------------------------------------------------------------------------

create or replace function public.variation_round_money(p_value numeric)
returns numeric
language sql
immutable
as $$
  select case
    when p_value is null then null
    else floor(p_value * 100 + 0.5) / 100
  end;
$$;

-- ---------------------------------------------------------------------------
-- C. History guard. Authorised RPCs set quotr.variation_write.
-- Postgres cleanup with no JWT may delete. Ordinary writes fail.
-- ---------------------------------------------------------------------------

create or replace function public.variation_guard_mutation()
returns trigger
language plpgsql
as $$
declare
  v_mode text := nullif(current_setting('quotr.variation_write', true), '');
  v_status text;
  v_revision uuid;
  v_match_status text;
begin
  if tg_op = 'DELETE'
    and current_user in ('postgres', 'supabase_admin')
    and auth.uid() is null
  then
    return old;
  end if;

  if tg_table_name = 'variation_items' then
    v_revision := coalesce(new.revision_id, old.revision_id);
    select status into v_status
    from public.variation_revisions
    where id = v_revision;
    if v_status = 'draft' and v_mode in ('draft', 'transition') then
      if tg_op = 'DELETE' then
        return old;
      end if;
      return new;
    end if;
    raise exception 'VARIATION_IMMUTABLE';
  end if;

  if tg_table_name = 'variation_revisions' then
    if tg_op = 'INSERT' and v_mode in ('draft', 'transition') then
      if new.status <> 'draft' then
        raise exception 'VARIATION_IMMUTABLE';
      end if;
      return new;
    end if;
    if tg_op = 'UPDATE' and v_mode = 'draft' and old.status = 'draft' then
      if new.status <> 'draft'
        or new.revision_number is distinct from old.revision_number
        or new.variation_id is distinct from old.variation_id
        or new.org_id is distinct from old.org_id
        or new.project_id is distinct from old.project_id
        or new.currency is distinct from old.currency
        or new.gst_rate is distinct from old.gst_rate
        or new.tax_treatment is distinct from old.tax_treatment
      then
        raise exception 'VARIATION_IMMUTABLE';
      end if;
      return new;
    end if;
    if tg_op = 'UPDATE' and v_mode = 'transition' then
      if old.status <> 'draft' then
        if new.client_notes is distinct from old.client_notes
          or new.internal_notes is distinct from old.internal_notes
          or new.currency is distinct from old.currency
          or new.gst_rate is distinct from old.gst_rate
          or new.tax_treatment is distinct from old.tax_treatment
          or new.total_direct_cost_adjustment is distinct from old.total_direct_cost_adjustment
          or new.total_sell_adjustment_ex_gst is distinct from old.total_sell_adjustment_ex_gst
          or new.gst_adjustment is distinct from old.gst_adjustment
          or new.total_adjustment_incl_gst is distinct from old.total_adjustment_incl_gst
          or new.revision_number is distinct from old.revision_number
          or new.variation_id is distinct from old.variation_id
          or new.org_id is distinct from old.org_id
          or new.project_id is distinct from old.project_id
          or new.proposed_time_effect_days is distinct from old.proposed_time_effect_days
        then
          raise exception 'VARIATION_IMMUTABLE';
        end if;
      end if;
      return new;
    end if;
    raise exception 'VARIATION_IMMUTABLE';
  end if;

  if tg_table_name = 'variations' then
    if tg_op = 'INSERT' and v_mode in ('draft', 'transition') then
      return new;
    end if;
    if new.current_revision_id is null then
      raise exception 'VARIATION_REVISION_MISMATCH';
    end if;
    select r.status into v_match_status
    from public.variation_revisions r
    where r.id = new.current_revision_id
      and r.variation_id = new.id
      and r.org_id = new.org_id
      and r.project_id = new.project_id
      and r.status <> 'superseded';
    if v_match_status is null or v_match_status is distinct from new.status then
      raise exception 'VARIATION_REVISION_MISMATCH';
    end if;
    if new.variation_number is distinct from old.variation_number
      or new.org_id is distinct from old.org_id
      or new.project_id is distinct from old.project_id
      or new.accepted_snapshot_id is distinct from old.accepted_snapshot_id
      or new.idempotency_key is distinct from old.idempotency_key
    then
      raise exception 'VARIATION_IMMUTABLE';
    end if;
    if v_mode = 'draft' and old.status = 'draft' and new.status = 'draft' then
      return new;
    end if;
    if v_mode = 'transition' then
      return new;
    end if;
    raise exception 'VARIATION_IMMUTABLE';
  end if;

  if v_mode in ('draft', 'transition') then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;
  raise exception 'VARIATION_IMMUTABLE';
end;
$$;

drop trigger if exists project_variation_counters_guard on public.project_variation_counters;
create trigger project_variation_counters_guard
  before insert or update or delete on public.project_variation_counters
  for each row execute function public.variation_guard_mutation();

drop trigger if exists variations_guard on public.variations;
create trigger variations_guard
  before insert or update or delete on public.variations
  for each row execute function public.variation_guard_mutation();

drop trigger if exists variation_revisions_guard on public.variation_revisions;
create trigger variation_revisions_guard
  before insert or update or delete on public.variation_revisions
  for each row execute function public.variation_guard_mutation();

drop trigger if exists variation_items_guard on public.variation_items;
create trigger variation_items_guard
  before insert or update or delete on public.variation_items
  for each row execute function public.variation_guard_mutation();

drop trigger if exists variation_command_receipts_guard on public.variation_command_receipts;
create trigger variation_command_receipts_guard
  before insert or update or delete on public.variation_command_receipts
  for each row execute function public.variation_guard_mutation();

drop trigger if exists variations_updated_at on public.variations;
create trigger variations_updated_at
  before update on public.variations
  for each row execute function public.set_updated_at();

drop trigger if exists variation_revisions_updated_at on public.variation_revisions;
create trigger variation_revisions_updated_at
  before update on public.variation_revisions
  for each row execute function public.set_updated_at();

drop trigger if exists variation_items_updated_at on public.variation_items;
create trigger variation_items_updated_at
  before update on public.variation_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- D. RLS. Authenticated organisation members may read. Writes are definer RPCs.
-- ---------------------------------------------------------------------------

alter table public.project_variation_counters enable row level security;
alter table public.variations enable row level security;
alter table public.variation_revisions enable row level security;
alter table public.variation_items enable row level security;
alter table public.variation_command_receipts enable row level security;

revoke all on table public.project_variation_counters from public, anon, authenticated;
revoke all on table public.variations from public, anon, authenticated;
revoke all on table public.variation_revisions from public, anon, authenticated;
revoke all on table public.variation_items from public, anon, authenticated;
revoke all on table public.variation_command_receipts from public, anon, authenticated;

grant select on table public.variations to authenticated;
grant select on table public.variation_revisions to authenticated;
grant select on table public.variation_items to authenticated;

grant select, insert, update, delete on table public.project_variation_counters to service_role;
grant select, insert, update, delete on table public.variations to service_role;
grant select, insert, update, delete on table public.variation_revisions to service_role;
grant select, insert, update, delete on table public.variation_items to service_role;
grant select, insert, update, delete on table public.variation_command_receipts to service_role;

create policy "Users can select variations in their organisation"
  on public.variations for select
  using (org_id = public.auth_org_id());

create policy "Users can select variation revisions in their organisation"
  on public.variation_revisions for select
  using (org_id = public.auth_org_id());

create policy "Users can select variation items in their organisation"
  on public.variation_items for select
  using (org_id = public.auth_org_id());

-- ---------------------------------------------------------------------------
-- E. Lifecycle vocabulary
-- ---------------------------------------------------------------------------

do $$
declare
  rec record;
begin
  for rec in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'project_lifecycle_events'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%event_type%'
  loop
    execute format(
      'alter table public.project_lifecycle_events drop constraint %I',
      rec.conname
    );
  end loop;
end $$;

alter table public.project_lifecycle_events
  add constraint project_lifecycle_events_event_type_check
  check (
    event_type in (
      'estimate_ready',
      'pricing_confirmed',
      'quote_created',
      'quote_sent',
      'quote_accepted',
      'project_activated',
      'project_completed',
      'project_cancelled',
      'variation_created',
      'variation_issued',
      'variation_accepted',
      'variation_rejected',
      'variation_withdrawn',
      'variation_superseded'
    )
  );

-- ---------------------------------------------------------------------------
-- F. Internal helpers
-- ---------------------------------------------------------------------------

create or replace function public.variation_project_gate(p_project uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := public.auth_org_id();
  v_project_org uuid;
  v_deleted timestamptz;
  v_archived timestamptz;
  v_business text;
  v_stage text;
  v_snapshot uuid;
  v_snap_org uuid;
  v_snap_project uuid;
  v_currency text;
  v_rate numeric;
  v_tax text;
begin
  if v_uid is null or v_org is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  end if;

  select org_id, deleted_at, archived_at, business_status
  into v_project_org, v_deleted, v_archived, v_business
  from public.projects
  where id = p_project;

  if v_project_org is null or v_deleted is not null then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_project_org is distinct from v_org then
    return jsonb_build_object('ok', false, 'error', 'CROSS_TENANT');
  end if;

  select stage into v_stage
  from public.project_lifecycle_positions
  where project_id = p_project
    and org_id = v_org;

  if v_archived is not null
    or v_business = 'archived'
    or v_stage in ('cancelled', 'completed')
  then
    return jsonb_build_object('ok', false, 'error', 'PROJECT_CLOSED');
  end if;

  select id, org_id, project_id, currency, gst_rate, tax_treatment
  into v_snapshot, v_snap_org, v_snap_project, v_currency, v_rate, v_tax
  from public.accepted_commercial_snapshots
  where project_id = p_project;

  if v_snapshot is null then
    return jsonb_build_object('ok', false, 'error', 'NO_ACCEPTED_BASELINE');
  end if;
  if v_snap_org is distinct from v_org or v_snap_project is distinct from p_project then
    return jsonb_build_object('ok', false, 'error', 'CROSS_PROJECT');
  end if;

  return jsonb_build_object(
    'ok', true,
    'orgId', v_org,
    'userId', v_uid,
    'snapshotId', v_snapshot,
    'currency', v_currency,
    'gstRate', v_rate,
    'taxTreatment', v_tax
  );
end;
$$;

create or replace function public.variation_append_event(
  p_org uuid,
  p_project uuid,
  p_actor uuid,
  p_type text,
  p_variation uuid,
  p_number integer,
  p_revision uuid,
  p_revision_number integer,
  p_sell numeric,
  p_currency text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
begin
  if p_type = 'variation_created' then
    v_key := p_type || ':' || p_variation::text;
  else
    v_key := p_type || ':' || p_revision::text;
  end if;

  insert into public.project_lifecycle_events (
    org_id, project_id, actor_user_id, event_type, occurred_at,
    source_entity_type, source_entity_id, idempotency_key, metadata, schema_version
  ) values (
    p_org,
    p_project,
    p_actor,
    p_type,
    now(),
    'variation',
    p_variation,
    v_key,
    jsonb_strip_nulls(jsonb_build_object(
      'variationId', p_variation,
      'variationNumber', p_number,
      'revisionId', p_revision,
      'revisionNumber', p_revision_number,
      'sellAdjustmentExGst', p_sell,
      'currency', p_currency
    )),
    1
  )
  on conflict (org_id, idempotency_key) do nothing;
end;
$$;

create or replace function public.variation_prepare_item(
  p_org uuid,
  p_project uuid,
  p_snapshot uuid,
  p_item jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
  v_desc text;
  v_unit text;
  v_qty numeric;
  v_unit_sell numeric;
  v_unit_cost numeric;
  v_line_sell numeric;
  v_line_cost numeric;
  v_work uuid;
  v_line uuid;
  v_group uuid;
  v_wa_org uuid;
  v_wa_project uuid;
  v_wa_type text;
  v_line_org uuid;
  v_line_project uuid;
  v_line_snapshot uuid;
  v_key text;
  v_sort integer;
  v_meta jsonb;
begin
  if jsonb_typeof(p_item) is distinct from 'object' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;

  v_type := p_item->>'itemType';
  if v_type not in ('addition', 'omission', 'no_cost_scope_change') then
    return jsonb_build_object('ok', false, 'error', 'INVALID_ITEM');
  end if;

  v_desc := btrim(coalesce(p_item->>'clientDescription', ''));
  if char_length(v_desc) < 1 or char_length(v_desc) > 500 then
    return jsonb_build_object('ok', false, 'error', 'INVALID_ITEM');
  end if;

  v_unit := btrim(coalesce(p_item->>'unit', ''));
  if char_length(v_unit) < 1 or char_length(v_unit) > 40 then
    return jsonb_build_object('ok', false, 'error', 'INVALID_UNIT');
  end if;

  if jsonb_typeof(p_item->'quantity') is distinct from 'number' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_QUANTITY');
  end if;
  begin
    v_qty := (p_item->>'quantity')::numeric;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'INVALID_QUANTITY');
  end;
  if v_qty is null or v_qty <= 0 or v_qty > 1000000 or v_qty <> round(v_qty, 4) then
    return jsonb_build_object('ok', false, 'error', 'INVALID_QUANTITY');
  end if;

  if p_item ? 'unitSell' and jsonb_typeof(p_item->'unitSell') = 'number' then
    begin
      v_unit_sell := (p_item->>'unitSell')::numeric;
    exception when others then
      return jsonb_build_object('ok', false, 'error', 'INVALID_ITEM');
    end;
    if v_unit_sell is distinct from public.variation_round_money(v_unit_sell) then
      return jsonb_build_object('ok', false, 'error', 'INVALID_ITEM');
    end if;
  elsif not (p_item ? 'unitSell') or jsonb_typeof(p_item->'unitSell') = 'null' then
    v_unit_sell := null;
  else
    return jsonb_build_object('ok', false, 'error', 'INVALID_ITEM');
  end if;

  if p_item ? 'unitCost' and jsonb_typeof(p_item->'unitCost') = 'number' then
    begin
      v_unit_cost := (p_item->>'unitCost')::numeric;
    exception when others then
      return jsonb_build_object('ok', false, 'error', 'INVALID_ITEM');
    end;
    if v_unit_cost is distinct from public.variation_round_money(v_unit_cost) then
      return jsonb_build_object('ok', false, 'error', 'INVALID_ITEM');
    end if;
  elsif not (p_item ? 'unitCost') or jsonb_typeof(p_item->'unitCost') = 'null' then
    v_unit_cost := null;
  else
    return jsonb_build_object('ok', false, 'error', 'INVALID_ITEM');
  end if;

  if v_unit_sell is null then
    v_line_sell := null;
  else
    v_line_sell := public.variation_round_money(v_qty * v_unit_sell);
  end if;
  if v_unit_cost is null then
    v_line_cost := null;
  else
    v_line_cost := public.variation_round_money(v_qty * v_unit_cost);
  end if;

  if v_type = 'addition' then
    if v_unit_sell is not null and (v_unit_sell <= 0 or v_line_sell is null or v_line_sell <= 0) then
      return jsonb_build_object('ok', false, 'error', 'INVALID_ITEM');
    end if;
    if v_unit_cost is not null and (v_unit_cost < 0 or v_line_cost is null or v_line_cost < 0) then
      return jsonb_build_object('ok', false, 'error', 'INVALID_ITEM');
    end if;
  elsif v_type = 'omission' then
    if v_unit_sell is not null and (v_unit_sell >= 0 or v_line_sell is null or v_line_sell >= 0) then
      return jsonb_build_object('ok', false, 'error', 'INVALID_ITEM');
    end if;
    if v_unit_cost is not null and (v_unit_cost > 0 or v_line_cost is null or v_line_cost > 0) then
      return jsonb_build_object('ok', false, 'error', 'INVALID_ITEM');
    end if;
  else
    if v_unit_sell is distinct from 0 or v_line_sell is distinct from 0 or v_unit_cost is not null then
      return jsonb_build_object('ok', false, 'error', 'INVALID_ITEM');
    end if;
    v_line_cost := null;
  end if;

  if p_item ? 'workAreaId' and jsonb_typeof(p_item->'workAreaId') = 'string' then
    begin
      v_work := (p_item->>'workAreaId')::uuid;
    exception when others then
      return jsonb_build_object('ok', false, 'error', 'INVALID_ITEM');
    end;
    select org_id, project_id, type
    into v_wa_org, v_wa_project, v_wa_type
    from public.work_areas
    where id = v_work;
    if v_wa_org is null then
      return jsonb_build_object('ok', false, 'error', 'INVALID_ITEM');
    end if;
    if v_wa_org is distinct from p_org then
      return jsonb_build_object('ok', false, 'error', 'CROSS_TENANT');
    end if;
    if v_wa_project is distinct from p_project then
      return jsonb_build_object('ok', false, 'error', 'CROSS_PROJECT');
    end if;
  elsif p_item ? 'workAreaId' and jsonb_typeof(p_item->'workAreaId') not in ('null') then
    return jsonb_build_object('ok', false, 'error', 'INVALID_ITEM');
  end if;

  if p_item ? 'snapshotLineId' and jsonb_typeof(p_item->'snapshotLineId') = 'string' then
    begin
      v_line := (p_item->>'snapshotLineId')::uuid;
    exception when others then
      return jsonb_build_object('ok', false, 'error', 'INVALID_ITEM');
    end;
    select org_id, project_id, snapshot_id
    into v_line_org, v_line_project, v_line_snapshot
    from public.accepted_commercial_snapshot_lines
    where id = v_line;
    if v_line_org is null then
      return jsonb_build_object('ok', false, 'error', 'INVALID_ITEM');
    end if;
    if v_line_org is distinct from p_org then
      return jsonb_build_object('ok', false, 'error', 'CROSS_TENANT');
    end if;
    if v_line_project is distinct from p_project or v_line_snapshot is distinct from p_snapshot then
      return jsonb_build_object('ok', false, 'error', 'CROSS_PROJECT');
    end if;
  elsif p_item ? 'snapshotLineId' and jsonb_typeof(p_item->'snapshotLineId') not in ('null') then
    return jsonb_build_object('ok', false, 'error', 'INVALID_ITEM');
  end if;

  if p_item ? 'substitutionGroupId' and jsonb_typeof(p_item->'substitutionGroupId') = 'string' then
    begin
      v_group := (p_item->>'substitutionGroupId')::uuid;
    exception when others then
      return jsonb_build_object('ok', false, 'error', 'INVALID_SUBSTITUTION');
    end;
  elsif p_item ? 'substitutionGroupId' and jsonb_typeof(p_item->'substitutionGroupId') not in ('null') then
    return jsonb_build_object('ok', false, 'error', 'INVALID_SUBSTITUTION');
  end if;
  if v_type = 'no_cost_scope_change' and v_group is not null then
    return jsonb_build_object('ok', false, 'error', 'INVALID_SUBSTITUTION');
  end if;

  v_key := nullif(btrim(coalesce(p_item->>'stableComponentKey', '')), '');
  if v_key is not null and (char_length(v_key) > 120 or v_key ~ '[[:cntrl:]]') then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  if char_length(btrim(coalesce(p_item->>'clientInclusion', ''))) > 500
    or char_length(btrim(coalesce(p_item->>'clientExclusion', ''))) > 500
  then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;

  if not (p_item ? 'sortOrder') or jsonb_typeof(p_item->'sortOrder') = 'null' then
    v_sort := 0;
  elsif jsonb_typeof(p_item->'sortOrder') = 'number' then
    begin
      v_sort := (p_item->>'sortOrder')::integer;
    exception when others then
      return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
    end;
    if v_sort < 0 or v_sort > 10000 or (p_item->>'sortOrder')::numeric <> v_sort then
      return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
    end if;
  else
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;

  if not (p_item ? 'internalMetadata') or jsonb_typeof(p_item->'internalMetadata') = 'null' then
    v_meta := '{}'::jsonb;
  elsif jsonb_typeof(p_item->'internalMetadata') = 'object'
    and octet_length(p_item->>'internalMetadata') <= 4000
  then
    v_meta := p_item->'internalMetadata';
  else
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;

  return jsonb_build_object(
    'ok', true,
    'itemType', v_type,
    'clientDescription', v_desc,
    'workAreaId', v_work,
    'workAreaType', v_wa_type,
    'snapshotLineId', v_line,
    'stableComponentKey', v_key,
    'quantity', v_qty,
    'unit', v_unit,
    'unitCost', v_unit_cost,
    'lineCost', v_line_cost,
    'unitSell', v_unit_sell,
    'lineSell', v_line_sell,
    'sortOrder', v_sort,
    'clientInclusion', nullif(btrim(coalesce(p_item->>'clientInclusion', '')), ''),
    'clientExclusion', nullif(btrim(coalesce(p_item->>'clientExclusion', '')), ''),
    'substitutionGroupId', v_group,
    'internalMetadata', v_meta
  );
end;
$$;

create or replace function public.variation_issue_blocker(p_revision uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_unresolved integer;
  v_net numeric;
  v_abs numeric;
  v_nocost integer;
  v_bad integer;
begin
  select
    count(*),
    count(*) filter (where line_sell_adjustment_ex_gst is null),
    coalesce(sum(line_sell_adjustment_ex_gst), 0),
    coalesce(sum(abs(line_sell_adjustment_ex_gst)), 0),
    count(*) filter (where item_type = 'no_cost_scope_change')
  into v_count, v_unresolved, v_net, v_abs, v_nocost
  from public.variation_items
  where revision_id = p_revision;

  if v_count = 0 then
    return 'EMPTY_VARIATION';
  end if;
  if v_unresolved > 0 then
    return 'UNRESOLVED_PRICING';
  end if;

  select count(*) into v_bad
  from (
    select substitution_group_id
    from public.variation_items
    where revision_id = p_revision
      and substitution_group_id is not null
    group by substitution_group_id
    having count(*) filter (where item_type = 'addition') <> 1
      or count(*) filter (where item_type = 'omission') <> 1
      or count(*) <> 2
  ) bad;
  if v_bad > 0 then
    return 'INVALID_SUBSTITUTION';
  end if;

  if public.variation_round_money(v_net) = 0
    and public.variation_round_money(v_abs) = 0
    and v_nocost = 0
  then
    return 'ZERO_NET_UNDOCUMENTED';
  end if;
  return null;
end;
$$;

create or replace function public.variation_store_totals(p_revision uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rate numeric;
  v_count integer;
  v_unresolved integer;
  v_sell numeric;
  v_cost numeric;
  v_cost_count integer;
  v_gst numeric;
  v_incl numeric;
begin
  select gst_rate into v_rate
  from public.variation_revisions
  where id = p_revision;

  select
    count(*),
    count(*) filter (where line_sell_adjustment_ex_gst is null),
    sum(line_sell_adjustment_ex_gst),
    count(*) filter (where line_cost_adjustment is not null),
    sum(line_cost_adjustment) filter (where line_cost_adjustment is not null)
  into v_count, v_unresolved, v_sell, v_cost_count, v_cost
  from public.variation_items
  where revision_id = p_revision;

  if v_cost_count = 0 then
    v_cost := null;
  else
    v_cost := public.variation_round_money(v_cost);
  end if;

  if v_count = 0 or v_unresolved > 0 then
    v_sell := null;
    v_gst := null;
    v_incl := null;
  else
    v_sell := public.variation_round_money(coalesce(v_sell, 0));
    v_gst := public.variation_round_money(v_sell * v_rate / 100);
    v_incl := public.variation_round_money(v_sell + v_gst);
  end if;

  update public.variation_revisions
  set
    total_direct_cost_adjustment = v_cost,
    total_sell_adjustment_ex_gst = v_sell,
    gst_adjustment = v_gst,
    total_adjustment_incl_gst = v_incl
  where id = p_revision;
end;
$$;

create or replace function public.variation_lock_current(
  p_variation uuid,
  p_revision uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := public.auth_org_id();
  v_row public.variations%rowtype;
  v_rev public.variation_revisions%rowtype;
  v_gate jsonb;
begin
  if v_uid is null or v_org is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  end if;

  select * into v_row
  from public.variations
  where id = p_variation
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_row.org_id is distinct from v_org then
    return jsonb_build_object('ok', false, 'error', 'CROSS_TENANT');
  end if;

  v_gate := public.variation_project_gate(v_row.project_id);
  if coalesce(v_gate->>'ok', 'false') <> 'true' then
    return v_gate;
  end if;

  if v_row.current_revision_id is distinct from p_revision then
    return jsonb_build_object('ok', false, 'error', 'STALE_REVISION');
  end if;

  select * into v_rev
  from public.variation_revisions
  where id = p_revision
    and variation_id = v_row.id
    and org_id = v_org
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'STALE_REVISION');
  end if;

  return jsonb_build_object(
    'ok', true,
    'orgId', v_org,
    'userId', v_uid,
    'projectId', v_row.project_id,
    'snapshotId', v_row.accepted_snapshot_id,
    'variationNumber', v_row.variation_number,
    'status', v_rev.status,
    'currency', v_rev.currency,
    'gstRate', v_rev.gst_rate,
    'revisionNumber', v_rev.revision_number
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- G. Commands. Organisation, totals, status and numbers come from the server.
-- ---------------------------------------------------------------------------

create or replace function public.create_draft_variation_v1(
  p_project uuid,
  p_title text,
  p_summary text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gate jsonb;
  v_org uuid;
  v_uid uuid;
  v_existing uuid;
  v_existing_revision uuid;
  v_existing_project uuid;
  v_existing_number integer;
  v_number integer;
  v_variation uuid;
  v_revision uuid;
  v_title text;
  v_summary text;
begin
  v_gate := public.variation_project_gate(p_project);
  if coalesce(v_gate->>'ok', 'false') <> 'true' then
    return v_gate;
  end if;
  v_org := (v_gate->>'orgId')::uuid;
  v_uid := (v_gate->>'userId')::uuid;
  v_title := btrim(coalesce(p_title, ''));
  v_summary := nullif(btrim(coalesce(p_summary, '')), '');
  if char_length(v_title) < 1 or char_length(v_title) > 160
    or (v_summary is not null and char_length(v_summary) > 2000)
    or p_idempotency_key is null
    or char_length(btrim(p_idempotency_key)) < 8
    or char_length(btrim(p_idempotency_key)) > 200
  then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;

  perform pg_advisory_xact_lock(87240156, hashtext(v_org::text || ':' || btrim(p_idempotency_key)));

  select id, project_id, current_revision_id, variation_number
  into v_existing, v_existing_project, v_existing_revision, v_existing_number
  from public.variations
  where org_id = v_org
    and idempotency_key = btrim(p_idempotency_key);

  if v_existing is not null then
    if v_existing_project is distinct from p_project then
      return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
    end if;
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'variationId', v_existing,
      'revisionId', v_existing_revision,
      'variationNumber', v_existing_number
    );
  end if;

  perform set_config('quotr.variation_write', 'draft', true);
  perform pg_advisory_xact_lock(87240155, hashtext(p_project::text));

  insert into public.project_variation_counters (project_id, org_id, last_value)
  values (p_project, v_org, 0)
  on conflict (project_id) do nothing;

  update public.project_variation_counters
  set last_value = last_value + 1
  where project_id = p_project
    and org_id = v_org
  returning last_value into v_number;

  insert into public.variations (
    org_id, project_id, accepted_snapshot_id, variation_number, title, summary,
    status, created_by, idempotency_key
  ) values (
    v_org, p_project, (v_gate->>'snapshotId')::uuid, v_number, v_title, v_summary,
    'draft', v_uid, btrim(p_idempotency_key)
  )
  returning id into v_variation;

  insert into public.variation_revisions (
    variation_id, org_id, project_id, revision_number, status, currency, gst_rate, tax_treatment
  ) values (
    v_variation, v_org, p_project, 1, 'draft',
    v_gate->>'currency', (v_gate->>'gstRate')::numeric, v_gate->>'taxTreatment'
  )
  returning id into v_revision;

  update public.variations
  set current_revision_id = v_revision
  where id = v_variation;

  insert into public.variation_command_receipts (
    org_id, command, idempotency_key, variation_id, revision_id
  ) values (
    v_org, 'create', btrim(p_idempotency_key), v_variation, v_revision
  );

  perform public.variation_append_event(
    v_org, p_project, v_uid, 'variation_created',
    v_variation, v_number, v_revision, 1, null, v_gate->>'currency'
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'variationId', v_variation,
    'revisionId', v_revision,
    'variationNumber', v_number
  );
end;
$$;

create or replace function public.update_draft_variation_v1(
  p_variation uuid,
  p_revision uuid,
  p_title text,
  p_summary text,
  p_client_notes text,
  p_internal_notes text,
  p_time_effect_days integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock jsonb;
  v_title text;
  v_summary text;
  v_client text;
  v_internal text;
begin
  v_lock := public.variation_lock_current(p_variation, p_revision);
  if coalesce(v_lock->>'ok', 'false') <> 'true' then
    return v_lock;
  end if;
  if v_lock->>'status' is distinct from 'draft' then
    return jsonb_build_object('ok', false, 'error', 'IMMUTABLE');
  end if;
  v_title := btrim(coalesce(p_title, ''));
  v_summary := nullif(btrim(coalesce(p_summary, '')), '');
  v_client := nullif(btrim(coalesce(p_client_notes, '')), '');
  v_internal := nullif(btrim(coalesce(p_internal_notes, '')), '');
  if char_length(v_title) < 1 or char_length(v_title) > 160
    or (v_summary is not null and char_length(v_summary) > 2000)
    or (v_client is not null and char_length(v_client) > 4000)
    or (v_internal is not null and char_length(v_internal) > 4000)
    or (p_time_effect_days is not null and p_time_effect_days not between -3650 and 3650)
  then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;

  perform set_config('quotr.variation_write', 'draft', true);
  update public.variations
  set title = v_title, summary = v_summary
  where id = p_variation;
  update public.variation_revisions
  set
    client_notes = v_client,
    internal_notes = v_internal,
    proposed_time_effect_days = p_time_effect_days
  where id = p_revision;

  return jsonb_build_object('ok', true, 'idempotent', false, 'variationId', p_variation, 'revisionId', p_revision);
end;
$$;

create or replace function public.add_draft_variation_item_v1(
  p_variation uuid,
  p_revision uuid,
  p_item jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock jsonb;
  v_item jsonb;
  v_id uuid;
begin
  v_lock := public.variation_lock_current(p_variation, p_revision);
  if coalesce(v_lock->>'ok', 'false') <> 'true' then
    return v_lock;
  end if;
  if v_lock->>'status' is distinct from 'draft' then
    return jsonb_build_object('ok', false, 'error', 'IMMUTABLE');
  end if;

  v_item := public.variation_prepare_item(
    (v_lock->>'orgId')::uuid,
    (v_lock->>'projectId')::uuid,
    (v_lock->>'snapshotId')::uuid,
    p_item
  );
  if coalesce(v_item->>'ok', 'false') <> 'true' then
    return v_item;
  end if;

  perform set_config('quotr.variation_write', 'draft', true);
  insert into public.variation_items (
    revision_id, variation_id, org_id, project_id, item_type, client_description,
    work_area_id, work_area_type, snapshot_line_id, stable_component_key,
    quantity, unit, unit_cost, line_cost_adjustment, unit_sell, line_sell_adjustment_ex_gst,
    sort_order, client_inclusion, client_exclusion, internal_metadata, substitution_group_id
  ) values (
    p_revision,
    p_variation,
    (v_lock->>'orgId')::uuid,
    (v_lock->>'projectId')::uuid,
    v_item->>'itemType',
    v_item->>'clientDescription',
    nullif(v_item->>'workAreaId', '')::uuid,
    v_item->>'workAreaType',
    nullif(v_item->>'snapshotLineId', '')::uuid,
    v_item->>'stableComponentKey',
    (v_item->>'quantity')::numeric,
    v_item->>'unit',
    case when v_item->'unitCost' = 'null'::jsonb then null else (v_item->>'unitCost')::numeric end,
    case when v_item->'lineCost' = 'null'::jsonb then null else (v_item->>'lineCost')::numeric end,
    case when v_item->'unitSell' = 'null'::jsonb then null else (v_item->>'unitSell')::numeric end,
    case when v_item->'lineSell' = 'null'::jsonb then null else (v_item->>'lineSell')::numeric end,
    (v_item->>'sortOrder')::integer,
    v_item->>'clientInclusion',
    v_item->>'clientExclusion',
    coalesce(v_item->'internalMetadata', '{}'::jsonb),
    nullif(v_item->>'substitutionGroupId', '')::uuid
  )
  returning id into v_id;

  perform public.variation_store_totals(p_revision);
  return jsonb_build_object(
    'ok', true,
    'itemId', v_id,
    'lineSellAdjustmentExGst', v_item->'lineSell',
    'lineCostAdjustment', v_item->'lineCost'
  );
end;
$$;

create or replace function public.update_draft_variation_item_v1(
  p_variation uuid,
  p_revision uuid,
  p_item_id uuid,
  p_item jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock jsonb;
  v_item jsonb;
  v_found uuid;
begin
  v_lock := public.variation_lock_current(p_variation, p_revision);
  if coalesce(v_lock->>'ok', 'false') <> 'true' then
    return v_lock;
  end if;
  if v_lock->>'status' is distinct from 'draft' then
    return jsonb_build_object('ok', false, 'error', 'IMMUTABLE');
  end if;

  select id into v_found
  from public.variation_items
  where id = p_item_id
    and revision_id = p_revision
    and variation_id = p_variation
    and org_id = (v_lock->>'orgId')::uuid;
  if v_found is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;

  v_item := public.variation_prepare_item(
    (v_lock->>'orgId')::uuid,
    (v_lock->>'projectId')::uuid,
    (v_lock->>'snapshotId')::uuid,
    p_item
  );
  if coalesce(v_item->>'ok', 'false') <> 'true' then
    return v_item;
  end if;

  perform set_config('quotr.variation_write', 'draft', true);
  update public.variation_items
  set
    item_type = v_item->>'itemType',
    client_description = v_item->>'clientDescription',
    work_area_id = nullif(v_item->>'workAreaId', '')::uuid,
    work_area_type = v_item->>'workAreaType',
    snapshot_line_id = nullif(v_item->>'snapshotLineId', '')::uuid,
    stable_component_key = v_item->>'stableComponentKey',
    quantity = (v_item->>'quantity')::numeric,
    unit = v_item->>'unit',
    unit_cost = case when v_item->'unitCost' = 'null'::jsonb then null else (v_item->>'unitCost')::numeric end,
    line_cost_adjustment = case when v_item->'lineCost' = 'null'::jsonb then null else (v_item->>'lineCost')::numeric end,
    unit_sell = case when v_item->'unitSell' = 'null'::jsonb then null else (v_item->>'unitSell')::numeric end,
    line_sell_adjustment_ex_gst = case when v_item->'lineSell' = 'null'::jsonb then null else (v_item->>'lineSell')::numeric end,
    sort_order = (v_item->>'sortOrder')::integer,
    client_inclusion = v_item->>'clientInclusion',
    client_exclusion = v_item->>'clientExclusion',
    internal_metadata = coalesce(v_item->'internalMetadata', '{}'::jsonb),
    substitution_group_id = nullif(v_item->>'substitutionGroupId', '')::uuid
  where id = p_item_id;

  perform public.variation_store_totals(p_revision);
  return jsonb_build_object('ok', true, 'itemId', p_item_id, 'lineSellAdjustmentExGst', v_item->'lineSell');
end;
$$;

create or replace function public.delete_draft_variation_item_v1(
  p_variation uuid,
  p_revision uuid,
  p_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock jsonb;
  v_found uuid;
begin
  v_lock := public.variation_lock_current(p_variation, p_revision);
  if coalesce(v_lock->>'ok', 'false') <> 'true' then
    return v_lock;
  end if;
  if v_lock->>'status' is distinct from 'draft' then
    return jsonb_build_object('ok', false, 'error', 'IMMUTABLE');
  end if;

  perform set_config('quotr.variation_write', 'draft', true);
  delete from public.variation_items
  where id = p_item_id
    and revision_id = p_revision
    and variation_id = p_variation
    and org_id = (v_lock->>'orgId')::uuid
  returning id into v_found;

  if v_found is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  perform public.variation_store_totals(p_revision);
  return jsonb_build_object('ok', true, 'itemId', p_item_id);
end;
$$;

create or replace function public.issue_variation_revision_v1(
  p_variation uuid,
  p_revision uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock jsonb;
  v_blocker text;
  v_sell numeric;
  v_gst numeric;
  v_incl numeric;
  v_cost numeric;
  v_cost_count integer;
  v_unresolved integer;
begin
  v_lock := public.variation_lock_current(p_variation, p_revision);
  if coalesce(v_lock->>'ok', 'false') <> 'true' then
    return v_lock;
  end if;
  if v_lock->>'status' = 'issued' then
    return jsonb_build_object(
      'ok', true, 'idempotent', true, 'status', 'issued',
      'variationId', p_variation, 'revisionId', p_revision
    );
  end if;
  if v_lock->>'status' is distinct from 'draft' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_TRANSITION');
  end if;

  v_blocker := public.variation_issue_blocker(p_revision);
  if v_blocker is not null then
    return jsonb_build_object('ok', false, 'error', v_blocker);
  end if;

  select
    count(*) filter (where line_sell_adjustment_ex_gst is null),
    sum(line_sell_adjustment_ex_gst),
    count(*) filter (where line_cost_adjustment is not null),
    sum(line_cost_adjustment) filter (where line_cost_adjustment is not null)
  into v_unresolved, v_sell, v_cost_count, v_cost
  from public.variation_items
  where revision_id = p_revision;

  if v_unresolved > 0 then
    return jsonb_build_object('ok', false, 'error', 'UNRESOLVED_PRICING');
  end if;
  v_sell := public.variation_round_money(v_sell);
  v_gst := public.variation_round_money(v_sell * (v_lock->>'gstRate')::numeric / 100);
  v_incl := public.variation_round_money(v_sell + v_gst);
  if v_cost_count = 0 then
    v_cost := null;
  else
    v_cost := public.variation_round_money(v_cost);
  end if;

  perform set_config('quotr.variation_write', 'transition', true);
  update public.variation_revisions
  set
    status = 'issued',
    total_direct_cost_adjustment = v_cost,
    total_sell_adjustment_ex_gst = v_sell,
    gst_adjustment = v_gst,
    total_adjustment_incl_gst = v_incl,
    issued_at = now(),
    issued_by = (v_lock->>'userId')::uuid
  where id = p_revision;

  update public.variations
  set status = 'issued'
  where id = p_variation;

  perform public.variation_append_event(
    (v_lock->>'orgId')::uuid,
    (v_lock->>'projectId')::uuid,
    (v_lock->>'userId')::uuid,
    'variation_issued',
    p_variation,
    (v_lock->>'variationNumber')::integer,
    p_revision,
    (v_lock->>'revisionNumber')::integer,
    v_sell,
    v_lock->>'currency'
  );

  return jsonb_build_object(
    'ok', true, 'idempotent', false, 'status', 'issued',
    'variationId', p_variation, 'revisionId', p_revision,
    'sellAdjustmentExGst', v_sell, 'gstAdjustment', v_gst, 'inclGstAdjustment', v_incl
  );
end;
$$;

create or replace function public.create_variation_revision_v1(
  p_variation uuid,
  p_revision uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := public.auth_org_id();
  v_row public.variations%rowtype;
  v_rev public.variation_revisions%rowtype;
  v_next uuid;
  v_next_number integer;
  v_gate jsonb;
begin
  if v_uid is null or v_org is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  end if;

  select * into v_row
  from public.variations
  where id = p_variation
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_row.org_id is distinct from v_org then
    return jsonb_build_object('ok', false, 'error', 'CROSS_TENANT');
  end if;

  v_gate := public.variation_project_gate(v_row.project_id);
  if coalesce(v_gate->>'ok', 'false') <> 'true' then
    return v_gate;
  end if;

  if v_row.current_revision_id is distinct from p_revision then
    select id, revision_number into v_next, v_next_number
    from public.variation_revisions
    where variation_id = p_variation
      and revised_from_revision_id = p_revision
      and id = v_row.current_revision_id
      and status = 'draft';
    if v_next is not null then
      return jsonb_build_object(
        'ok', true, 'idempotent', true, 'status', 'draft',
        'variationId', p_variation, 'revisionId', v_next, 'revisionNumber', v_next_number
      );
    end if;
    return jsonb_build_object('ok', false, 'error', 'STALE_REVISION');
  end if;

  select * into v_rev
  from public.variation_revisions
  where id = p_revision
    and variation_id = p_variation
  for update;
  if v_rev.status is distinct from 'issued' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_TRANSITION');
  end if;

  perform set_config('quotr.variation_write', 'transition', true);
  update public.variation_revisions
  set status = 'superseded', superseded_at = now()
  where id = p_revision;

  insert into public.variation_revisions (
    variation_id, org_id, project_id, revision_number, status, currency, gst_rate,
    tax_treatment, proposed_time_effect_days, client_notes, internal_notes, revised_from_revision_id
  ) values (
    p_variation, v_org, v_row.project_id, v_rev.revision_number + 1, 'draft',
    v_rev.currency, v_rev.gst_rate, v_rev.tax_treatment, v_rev.proposed_time_effect_days,
    v_rev.client_notes, v_rev.internal_notes, p_revision
  )
  returning id, revision_number into v_next, v_next_number;

  insert into public.variation_items (
    revision_id, variation_id, org_id, project_id, item_type, client_description,
    work_area_id, work_area_type, snapshot_line_id, stable_component_key,
    quantity, unit, unit_cost, line_cost_adjustment, unit_sell, line_sell_adjustment_ex_gst,
    sort_order, client_inclusion, client_exclusion, internal_metadata, substitution_group_id
  )
  select
    v_next, variation_id, org_id, project_id, item_type, client_description,
    work_area_id, work_area_type, snapshot_line_id, stable_component_key,
    quantity, unit, unit_cost, line_cost_adjustment, unit_sell, line_sell_adjustment_ex_gst,
    sort_order, client_inclusion, client_exclusion, internal_metadata, substitution_group_id
  from public.variation_items
  where revision_id = p_revision;

  perform public.variation_store_totals(v_next);

  update public.variations
  set current_revision_id = v_next, status = 'draft'
  where id = p_variation;

  perform public.variation_append_event(
    v_org, v_row.project_id, v_uid, 'variation_superseded',
    p_variation, v_row.variation_number, p_revision, v_rev.revision_number,
    v_rev.total_sell_adjustment_ex_gst, v_rev.currency
  );

  return jsonb_build_object(
    'ok', true, 'idempotent', false, 'status', 'draft',
    'variationId', p_variation, 'revisionId', v_next, 'revisionNumber', v_next_number,
    'supersededRevisionId', p_revision
  );
end;
$$;

create or replace function public.accept_variation_revision_v1(
  p_variation uuid,
  p_revision uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock jsonb;
  v_sell numeric;
begin
  v_lock := public.variation_lock_current(p_variation, p_revision);
  if coalesce(v_lock->>'ok', 'false') <> 'true' then
    return v_lock;
  end if;
  if v_lock->>'status' = 'accepted' then
    return jsonb_build_object(
      'ok', true, 'idempotent', true, 'status', 'accepted',
      'variationId', p_variation, 'revisionId', p_revision
    );
  end if;
  if v_lock->>'status' is distinct from 'issued' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_TRANSITION');
  end if;

  select total_sell_adjustment_ex_gst into v_sell
  from public.variation_revisions
  where id = p_revision;

  perform set_config('quotr.variation_write', 'transition', true);
  update public.variation_revisions
  set
    status = 'accepted',
    accepted_at = now(),
    accepted_by = (v_lock->>'userId')::uuid,
    acceptance_source = 'internal_user'
  where id = p_revision
    and status = 'issued';

  update public.variations
  set status = 'accepted'
  where id = p_variation;

  perform public.variation_append_event(
    (v_lock->>'orgId')::uuid,
    (v_lock->>'projectId')::uuid,
    (v_lock->>'userId')::uuid,
    'variation_accepted',
    p_variation,
    (v_lock->>'variationNumber')::integer,
    p_revision,
    (v_lock->>'revisionNumber')::integer,
    v_sell,
    v_lock->>'currency'
  );

  return jsonb_build_object(
    'ok', true, 'idempotent', false, 'status', 'accepted',
    'variationId', p_variation, 'revisionId', p_revision
  );
exception
  when unique_violation then
    if exists (
      select 1
      from public.variation_revisions
      where id = p_revision
        and variation_id = p_variation
        and status = 'accepted'
    ) then
      return jsonb_build_object(
        'ok', true, 'idempotent', true, 'status', 'accepted',
        'variationId', p_variation, 'revisionId', p_revision
      );
    end if;
    return jsonb_build_object('ok', false, 'error', 'INVALID_TRANSITION');
end;
$$;

create or replace function public.reject_variation_revision_v1(
  p_variation uuid,
  p_revision uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock jsonb;
  v_sell numeric;
begin
  v_lock := public.variation_lock_current(p_variation, p_revision);
  if coalesce(v_lock->>'ok', 'false') <> 'true' then
    return v_lock;
  end if;
  if v_lock->>'status' = 'rejected' then
    return jsonb_build_object(
      'ok', true, 'idempotent', true, 'status', 'rejected',
      'variationId', p_variation, 'revisionId', p_revision
    );
  end if;
  if v_lock->>'status' is distinct from 'issued' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_TRANSITION');
  end if;

  select total_sell_adjustment_ex_gst into v_sell
  from public.variation_revisions
  where id = p_revision;

  perform set_config('quotr.variation_write', 'transition', true);
  update public.variation_revisions
  set status = 'rejected', rejected_at = now(), rejected_by = (v_lock->>'userId')::uuid
  where id = p_revision;
  update public.variations set status = 'rejected' where id = p_variation;

  perform public.variation_append_event(
    (v_lock->>'orgId')::uuid, (v_lock->>'projectId')::uuid, (v_lock->>'userId')::uuid,
    'variation_rejected', p_variation, (v_lock->>'variationNumber')::integer,
    p_revision, (v_lock->>'revisionNumber')::integer, v_sell, v_lock->>'currency'
  );
  return jsonb_build_object(
    'ok', true, 'idempotent', false, 'status', 'rejected',
    'variationId', p_variation, 'revisionId', p_revision
  );
end;
$$;

create or replace function public.withdraw_variation_revision_v1(
  p_variation uuid,
  p_revision uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock jsonb;
  v_sell numeric;
begin
  v_lock := public.variation_lock_current(p_variation, p_revision);
  if coalesce(v_lock->>'ok', 'false') <> 'true' then
    return v_lock;
  end if;
  if v_lock->>'status' = 'withdrawn' then
    return jsonb_build_object(
      'ok', true, 'idempotent', true, 'status', 'withdrawn',
      'variationId', p_variation, 'revisionId', p_revision
    );
  end if;
  if v_lock->>'status' not in ('draft', 'issued') then
    return jsonb_build_object('ok', false, 'error', 'INVALID_TRANSITION');
  end if;

  select total_sell_adjustment_ex_gst into v_sell
  from public.variation_revisions
  where id = p_revision;

  perform set_config('quotr.variation_write', 'transition', true);
  update public.variation_revisions
  set status = 'withdrawn', withdrawn_at = now(), withdrawn_by = (v_lock->>'userId')::uuid
  where id = p_revision;
  update public.variations set status = 'withdrawn' where id = p_variation;

  perform public.variation_append_event(
    (v_lock->>'orgId')::uuid, (v_lock->>'projectId')::uuid, (v_lock->>'userId')::uuid,
    'variation_withdrawn', p_variation, (v_lock->>'variationNumber')::integer,
    p_revision, (v_lock->>'revisionNumber')::integer, v_sell, v_lock->>'currency'
  );
  return jsonb_build_object(
    'ok', true, 'idempotent', false, 'status', 'withdrawn',
    'variationId', p_variation, 'revisionId', p_revision
  );
end;
$$;

comment on function public.accept_variation_revision_v1(uuid, uuid) is
  'Internal authenticated acceptance for domain readiness. Not public client consent.';

-- ---------------------------------------------------------------------------
-- H. Grants. Helpers stay owner-only. Commands are authenticated-only.
-- ---------------------------------------------------------------------------

do $$
declare
  rec record;
begin
  for rec in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'variation\_%' escape '\'
  loop
    execute format(
      'revoke all on function %s from public, anon, authenticated, service_role',
      rec.signature
    );
  end loop;
end $$;

revoke all on function public.create_draft_variation_v1(uuid, text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.update_draft_variation_v1(uuid, uuid, text, text, text, text, integer) from public, anon, authenticated, service_role;
revoke all on function public.add_draft_variation_item_v1(uuid, uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.update_draft_variation_item_v1(uuid, uuid, uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.delete_draft_variation_item_v1(uuid, uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.issue_variation_revision_v1(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.create_variation_revision_v1(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.accept_variation_revision_v1(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.reject_variation_revision_v1(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.withdraw_variation_revision_v1(uuid, uuid) from public, anon, authenticated, service_role;

grant execute on function public.create_draft_variation_v1(uuid, text, text, text) to authenticated;
grant execute on function public.update_draft_variation_v1(uuid, uuid, text, text, text, text, integer) to authenticated;
grant execute on function public.add_draft_variation_item_v1(uuid, uuid, jsonb) to authenticated;
grant execute on function public.update_draft_variation_item_v1(uuid, uuid, uuid, jsonb) to authenticated;
grant execute on function public.delete_draft_variation_item_v1(uuid, uuid, uuid) to authenticated;
grant execute on function public.issue_variation_revision_v1(uuid, uuid) to authenticated;
grant execute on function public.create_variation_revision_v1(uuid, uuid) to authenticated;
grant execute on function public.accept_variation_revision_v1(uuid, uuid) to authenticated;
grant execute on function public.reject_variation_revision_v1(uuid, uuid) to authenticated;
grant execute on function public.withdraw_variation_revision_v1(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
