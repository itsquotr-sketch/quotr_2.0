-- VARIATIONS-02-R3. Internal cost components under a client-facing Variation item.
-- Existing rows stay pricing_mode simple. This migration does not rewrite their money.
-- Company Rate, estimate-import and subcontract-quote provenance stay deferred.

alter table public.variation_items
  add column if not exists pricing_mode text not null default 'simple';

alter table public.variation_items
  drop constraint if exists variation_items_pricing_mode_chk;

alter table public.variation_items
  add constraint variation_items_pricing_mode_chk
  check (pricing_mode in ('simple', 'build_up'));

alter table public.variation_items
  drop constraint if exists variation_items_build_up_type_chk;

alter table public.variation_items
  add constraint variation_items_build_up_type_chk
  check (pricing_mode <> 'build_up' or item_type in ('addition', 'omission'));

alter table public.variation_items drop constraint variation_items_cost_pair_chk;
alter table public.variation_items
  add constraint variation_items_cost_pair_chk check (
    (
      pricing_mode = 'simple'
      and (
        (unit_cost is null and line_cost_adjustment is null)
        or (unit_cost is not null and line_cost_adjustment is not null)
      )
    )
    or (pricing_mode = 'build_up' and unit_cost is null)
  );

alter table public.variation_items drop constraint variation_items_sell_pair_chk;
alter table public.variation_items
  add constraint variation_items_sell_pair_chk check (
    (
      pricing_mode = 'simple'
      and (
        (unit_sell is null and line_sell_adjustment_ex_gst is null)
        or (unit_sell is not null and line_sell_adjustment_ex_gst is not null)
      )
    )
    or (pricing_mode = 'build_up' and unit_sell is null)
  );

create table if not exists public.variation_item_cost_components (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  variation_id uuid not null references public.variations (id) on delete cascade,
  revision_id uuid not null references public.variation_revisions (id) on delete cascade,
  item_id uuid not null references public.variation_items (id) on delete cascade,
  category text not null,
  description text not null,
  quantity numeric(12, 4) not null,
  unit text not null,
  unit_cost numeric(12, 2),
  line_cost numeric(12, 2),
  sort_order integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint variation_cost_components_category_chk check (
    category in ('material', 'labour', 'subcontract', 'plant', 'allowance', 'other')
  ),
  constraint variation_cost_components_description_chk check (char_length(description) between 1 and 500),
  constraint variation_cost_components_quantity_chk check (quantity > 0 and quantity <= 1000000),
  constraint variation_cost_components_unit_chk check (char_length(unit) between 1 and 40),
  constraint variation_cost_components_unit_cost_chk check (
    unit_cost is null or (unit_cost >= 0 and unit_cost <= 10000000)
  ),
  constraint variation_cost_components_line_cost_chk check (line_cost is null or (line_cost >= 0 and line_cost <= 10000000)),
  constraint variation_cost_components_cost_pair_chk check (
    (unit_cost is null and line_cost is null)
    or (unit_cost is not null and line_cost is not null)
  ),
  constraint variation_cost_components_sort_chk check (sort_order >= 0 and sort_order <= 10000)
);

create index if not exists variation_cost_components_item_sort_idx
  on public.variation_item_cost_components (item_id, sort_order, id);
create index if not exists variation_cost_components_org_project_idx
  on public.variation_item_cost_components (org_id, project_id);
create index if not exists variation_cost_components_revision_idx
  on public.variation_item_cost_components (revision_id);

drop trigger if exists variation_item_cost_components_set_updated_at on public.variation_item_cost_components;
create trigger variation_item_cost_components_set_updated_at
  before update on public.variation_item_cost_components
  for each row execute function public.set_updated_at();

comment on table public.variation_item_cost_components is
  'Internal cost lines for a build-up Variation item. They never belong on the client document. Rate provenance is deferred.';

alter table public.variation_item_cost_components enable row level security;

drop policy if exists "Users can select variation cost components in their organisation"
  on public.variation_item_cost_components;
create policy "Users can select variation cost components in their organisation"
  on public.variation_item_cost_components
  for select
  using (org_id = public.auth_org_id());

grant select on table public.variation_item_cost_components to authenticated;
grant select, insert, update, delete on table public.variation_item_cost_components to service_role;

create or replace function public.variation_cost_component_guard()
returns trigger
language plpgsql
as $$
declare
  v_mode text := nullif(current_setting('quotr.variation_write', true), '');
  v_revision uuid;
  v_status text;
  v_item_revision uuid;
  v_item_org uuid;
  v_item_project uuid;
  v_item_variation uuid;
  v_pricing text;
begin
  if tg_op = 'DELETE'
    and current_user in ('postgres', 'supabase_admin')
    and auth.uid() is null
  then
    return old;
  end if;
  if tg_op = 'DELETE' and v_mode = 'delete_draft' then
    return old;
  end if;

  v_revision := case when tg_op = 'DELETE' then old.revision_id else new.revision_id end;
  select status into v_status
  from public.variation_revisions
  where id = v_revision;

  if v_status is distinct from 'draft' or v_mode not in ('draft', 'transition') then
    raise exception 'VARIATION_IMMUTABLE';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  select revision_id, org_id, project_id, variation_id, pricing_mode
  into v_item_revision, v_item_org, v_item_project, v_item_variation, v_pricing
  from public.variation_items
  where id = new.item_id;

  if v_item_revision is null
    or v_item_revision is distinct from new.revision_id
    or v_item_org is distinct from new.org_id
    or v_item_project is distinct from new.project_id
    or v_item_variation is distinct from new.variation_id
    or v_pricing is distinct from 'build_up'
  then
    raise exception 'VARIATION_COMPONENT_MISMATCH';
  end if;

  if new.unit_cost is not null
    and new.line_cost is distinct from public.variation_round_money(new.quantity * new.unit_cost)
  then
    raise exception 'VARIATION_COMPONENT_MISMATCH';
  end if;

  return new;
end;
$$;

drop trigger if exists variation_cost_component_guard on public.variation_item_cost_components;
create trigger variation_cost_component_guard
  before insert or update or delete on public.variation_item_cost_components
  for each row execute function public.variation_cost_component_guard();

create or replace function public.variation_reprice_build_up(p_item uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
  v_meta jsonb;
  v_count integer;
  v_missing boolean;
  v_sum numeric;
  v_cost numeric;
  v_sell numeric;
  v_margin numeric;
  v_manual numeric;
  v_provenance text;
  v_sign numeric;
  v_effective numeric;
begin
  select item_type, internal_metadata
  into v_type, v_meta
  from public.variation_items
  where id = p_item
  for update;

  select
    count(*),
    coalesce(bool_or(unit_cost is null), true),
    coalesce(sum(line_cost), 0)
  into v_count, v_missing, v_sum
  from public.variation_item_cost_components
  where item_id = p_item;

  if v_count = 0 or v_missing then
    v_cost := null;
  else
    v_cost := public.variation_round_money(v_sum);
  end if;

  v_provenance := coalesce(v_meta->>'sellProvenance', 'pricing_required');
  if v_meta ? 'targetMarginPercent' and jsonb_typeof(v_meta->'targetMarginPercent') = 'number' then
    v_margin := (v_meta->>'targetMarginPercent')::numeric;
  else
    v_margin := null;
  end if;
  if v_meta ? 'manualSellTotal' and jsonb_typeof(v_meta->'manualSellTotal') = 'number' then
    v_manual := (v_meta->>'manualSellTotal')::numeric;
  else
    v_manual := null;
  end if;

  if v_provenance = 'manual' and v_manual is not null then
    v_sell := v_manual;
  elsif v_provenance = 'calculated'
    and v_cost is not null
    and v_margin is not null
    and v_margin > 0
    and v_margin < 100
  then
    v_sell := public.variation_round_money(v_cost / (1 - (v_margin / 100)));
  else
    v_sell := null;
  end if;

  if v_cost is not null and v_sell is not null and v_sell <> 0 then
    v_effective := public.variation_round_money(((v_sell - v_cost) / v_sell) * 100);
  else
    v_effective := null;
  end if;

  v_meta := jsonb_set(coalesce(v_meta, '{}'::jsonb), '{effectiveMarginPercent}', coalesce(to_jsonb(v_effective), 'null'::jsonb), true);
  v_sign := case when v_type = 'omission' then -1 else 1 end;

  update public.variation_items
  set
    pricing_mode = 'build_up',
    unit_cost = null,
    unit_sell = null,
    line_cost_adjustment = case when v_cost is null then null else v_sign * v_cost end,
    line_sell_adjustment_ex_gst = case when v_sell is null then null else v_sign * v_sell end,
    internal_metadata = v_meta
  where id = p_item;
end;
$$;

create or replace function public.variation_read_component(p_component jsonb, p_sort integer)
returns jsonb
language plpgsql
as $$
declare
  v_qty numeric;
  v_cost numeric;
  v_line numeric;
  v_desc text;
  v_unit text;
  v_category text;
  v_id uuid;
begin
  if jsonb_typeof(p_component) is distinct from 'object' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  v_category := p_component->>'category';
  if v_category not in ('material', 'labour', 'subcontract', 'plant', 'allowance', 'other') then
    return jsonb_build_object('ok', false, 'error', 'INVALID_ITEM');
  end if;
  v_desc := btrim(coalesce(p_component->>'description', ''));
  v_unit := btrim(coalesce(p_component->>'unit', ''));
  if char_length(v_desc) < 1 or char_length(v_desc) > 500 or char_length(v_unit) < 1 or char_length(v_unit) > 40 then
    return jsonb_build_object('ok', false, 'error', 'INVALID_ITEM');
  end if;
  if jsonb_typeof(p_component->'quantity') is distinct from 'number' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_QUANTITY');
  end if;
  v_qty := (p_component->>'quantity')::numeric;
  if v_qty is null or v_qty <= 0 or v_qty > 1000000 or v_qty <> round(v_qty, 4) then
    return jsonb_build_object('ok', false, 'error', 'INVALID_QUANTITY');
  end if;
  if p_component ? 'unitCost' and jsonb_typeof(p_component->'unitCost') = 'number' then
    v_cost := (p_component->>'unitCost')::numeric;
    if v_cost < 0 or v_cost > 10000000 or v_cost is distinct from public.variation_round_money(v_cost) then
      return jsonb_build_object('ok', false, 'error', 'INVALID_ITEM');
    end if;
    v_line := public.variation_round_money(v_qty * v_cost);
  elsif not (p_component ? 'unitCost') or jsonb_typeof(p_component->'unitCost') = 'null' then
    v_cost := null;
    v_line := null;
  else
    return jsonb_build_object('ok', false, 'error', 'INVALID_ITEM');
  end if;
  if p_component ? 'id' and jsonb_typeof(p_component->'id') = 'string' then
    v_id := (p_component->>'id')::uuid;
  else
    v_id := null;
  end if;
  return jsonb_build_object(
    'ok', true,
    'id', v_id,
    'category', v_category,
    'description', v_desc,
    'quantity', v_qty,
    'unit', v_unit,
    'unitCost', v_cost,
    'lineCost', v_line,
    'sortOrder', p_sort
  );
exception when others then
  return jsonb_build_object('ok', false, 'error', 'INVALID_ITEM');
end;
$$;

create or replace function public.apply_draft_variation_build_up_v1(
  p_variation uuid,
  p_revision uuid,
  p_item_id uuid,
  p_item jsonb,
  p_components jsonb,
  p_confirm boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock jsonb;
  v_scope jsonb;
  v_meta jsonb;
  v_id uuid;
  v_mode text;
  v_row public.variation_items%rowtype;
  v_comp jsonb;
  v_read jsonb;
  v_sort integer := 0;
  v_kept uuid[] := '{}';
  v_owner uuid;
  v_margin numeric;
  v_manual numeric;
  v_provenance text;
begin
  v_lock := public.variation_lock_current(p_variation, p_revision);
  if coalesce(v_lock->>'ok', 'false') <> 'true' then
    return v_lock;
  end if;
  if v_lock->>'status' is distinct from 'draft' then
    return jsonb_build_object('ok', false, 'error', 'IMMUTABLE');
  end if;
  if jsonb_typeof(p_item) is distinct from 'object' or jsonb_typeof(p_components) is distinct from 'array' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  if jsonb_array_length(p_components) > 40 then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  if coalesce(p_item->>'itemType', '') not in ('addition', 'omission') then
    return jsonb_build_object('ok', false, 'error', 'INVALID_ITEM');
  end if;

  v_provenance := coalesce(p_item->>'sellProvenance', 'pricing_required');
  if v_provenance not in ('calculated', 'manual', 'pricing_required') then
    return jsonb_build_object('ok', false, 'error', 'INVALID_ITEM');
  end if;
  if p_item ? 'targetMarginPercent' and jsonb_typeof(p_item->'targetMarginPercent') = 'number' then
    v_margin := (p_item->>'targetMarginPercent')::numeric;
    if v_margin <= 0 or v_margin >= 100 or v_margin <> round(v_margin, 2) then
      return jsonb_build_object('ok', false, 'error', 'INVALID_ITEM');
    end if;
  else
    v_margin := null;
  end if;
  if v_provenance = 'manual' then
    if jsonb_typeof(p_item->'manualSellTotal') is distinct from 'number' then
      return jsonb_build_object('ok', false, 'error', 'INVALID_ITEM');
    end if;
    v_manual := (p_item->>'manualSellTotal')::numeric;
    if v_manual <= 0 or v_manual > 10000000 or v_manual is distinct from public.variation_round_money(v_manual) then
      return jsonb_build_object('ok', false, 'error', 'INVALID_ITEM');
    end if;
  else
    v_manual := null;
  end if;

  if p_item_id is not null then
    select * into v_row
    from public.variation_items
    where id = p_item_id
    for update;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
    end if;
    if v_row.org_id is distinct from (v_lock->>'orgId')::uuid then
      return jsonb_build_object('ok', false, 'error', 'CROSS_TENANT');
    end if;
    if v_row.variation_id is distinct from p_variation
      or v_row.revision_id is distinct from p_revision
      or v_row.project_id is distinct from (v_lock->>'projectId')::uuid
    then
      return jsonb_build_object('ok', false, 'error', 'CROSS_PROJECT');
    end if;
    if v_row.pricing_mode = 'simple' and coalesce(p_confirm, false) is not true then
      return jsonb_build_object('ok', false, 'error', 'MODE_CONFIRM_REQUIRED');
    end if;
  end if;

  for v_comp in select value from jsonb_array_elements(p_components) loop
    v_read := public.variation_read_component(v_comp, v_sort);
    if coalesce(v_read->>'ok', 'false') <> 'true' then
      return v_read;
    end if;
    if v_read->>'id' is not null then
      select item_id into v_owner
      from public.variation_item_cost_components
      where id = (v_read->>'id')::uuid;
      if v_owner is null then
        return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
      end if;
      if p_item_id is null or v_owner is distinct from p_item_id then
        return jsonb_build_object('ok', false, 'error', 'INVALID_ITEM');
      end if;
    end if;
    if v_comp ? 'itemId' and nullif(v_comp->>'itemId', '') is not null and nullif(v_comp->>'itemId', '') is distinct from p_item_id::text then
      return jsonb_build_object('ok', false, 'error', 'INVALID_ITEM');
    end if;
    v_sort := v_sort + 1;
  end loop;

  v_scope := public.variation_prepare_item(
    (v_lock->>'orgId')::uuid,
    (v_lock->>'projectId')::uuid,
    (v_lock->>'snapshotId')::uuid,
    jsonb_build_object(
      'itemType', p_item->>'itemType',
      'clientDescription', p_item->>'clientDescription',
      'quantity', p_item->'quantity',
      'unit', p_item->>'unit',
      'unitSell', null,
      'unitCost', null,
      'workAreaId', p_item->'workAreaId',
      'snapshotLineId', p_item->'snapshotLineId',
      'substitutionGroupId', p_item->'substitutionGroupId',
      'sortOrder', coalesce(p_item->'sortOrder', '0'::jsonb),
      'internalMetadata', '{}'::jsonb
    )
  );
  if coalesce(v_scope->>'ok', 'false') <> 'true' then
    return v_scope;
  end if;

  v_meta := jsonb_strip_nulls(jsonb_build_object(
    'sellProvenance', v_provenance,
    'targetMarginPercent', v_margin,
    'manualSellTotal', v_manual
  ));

  perform set_config('quotr.variation_write', 'draft', true);
  if p_item_id is null then
    insert into public.variation_items (
      revision_id, variation_id, org_id, project_id, item_type, client_description,
      work_area_id, work_area_type, snapshot_line_id, stable_component_key,
      quantity, unit, unit_cost, line_cost_adjustment, unit_sell, line_sell_adjustment_ex_gst,
      sort_order, client_inclusion, client_exclusion, internal_metadata, substitution_group_id,
      pricing_mode
    ) values (
      p_revision,
      p_variation,
      (v_lock->>'orgId')::uuid,
      (v_lock->>'projectId')::uuid,
      v_scope->>'itemType',
      v_scope->>'clientDescription',
      nullif(v_scope->>'workAreaId', '')::uuid,
      v_scope->>'workAreaType',
      nullif(v_scope->>'snapshotLineId', '')::uuid,
      null,
      (v_scope->>'quantity')::numeric,
      v_scope->>'unit',
      null,
      null,
      null,
      null,
      (v_scope->>'sortOrder')::integer,
      null,
      null,
      v_meta,
      nullif(v_scope->>'substitutionGroupId', '')::uuid,
      'build_up'
    )
    returning id into v_id;
  else
    update public.variation_items
    set
      pricing_mode = 'build_up',
      item_type = v_scope->>'itemType',
      client_description = v_scope->>'clientDescription',
      work_area_id = nullif(v_scope->>'workAreaId', '')::uuid,
      work_area_type = v_scope->>'workAreaType',
      snapshot_line_id = nullif(v_scope->>'snapshotLineId', '')::uuid,
      quantity = (v_scope->>'quantity')::numeric,
      unit = v_scope->>'unit',
      unit_cost = null,
      unit_sell = null,
      line_cost_adjustment = null,
      line_sell_adjustment_ex_gst = null,
      sort_order = (v_scope->>'sortOrder')::integer,
      substitution_group_id = nullif(v_scope->>'substitutionGroupId', '')::uuid,
      internal_metadata = v_meta
    where id = p_item_id
    returning id into v_id;
  end if;

  v_sort := 0;
  for v_comp in select value from jsonb_array_elements(p_components) loop
    v_read := public.variation_read_component(v_comp, v_sort);
    if nullif(v_read->>'id', '') is not null then
      v_kept := v_kept || (v_read->>'id')::uuid;
    end if;
    v_sort := v_sort + 1;
  end loop;

  delete from public.variation_item_cost_components
  where item_id = v_id
    and not (id = any(v_kept));

  v_sort := 0;
  for v_comp in select value from jsonb_array_elements(p_components) loop
    v_read := public.variation_read_component(v_comp, v_sort);
    if nullif(v_read->>'id', '') is not null then
      update public.variation_item_cost_components
      set
        category = v_read->>'category',
        description = v_read->>'description',
        quantity = (v_read->>'quantity')::numeric,
        unit = v_read->>'unit',
        unit_cost = case when v_read->'unitCost' = 'null'::jsonb then null else (v_read->>'unitCost')::numeric end,
        line_cost = case when v_read->'lineCost' = 'null'::jsonb then null else (v_read->>'lineCost')::numeric end,
        sort_order = v_sort,
        updated_by = (v_lock->>'userId')::uuid
      where id = (v_read->>'id')::uuid
        and item_id = v_id;
    else
      insert into public.variation_item_cost_components (
        org_id, project_id, variation_id, revision_id, item_id, category, description,
        quantity, unit, unit_cost, line_cost, sort_order, created_by, updated_by
      ) values (
        (v_lock->>'orgId')::uuid,
        (v_lock->>'projectId')::uuid,
        p_variation,
        p_revision,
        v_id,
        v_read->>'category',
        v_read->>'description',
        (v_read->>'quantity')::numeric,
        v_read->>'unit',
        case when v_read->'unitCost' = 'null'::jsonb then null else (v_read->>'unitCost')::numeric end,
        case when v_read->'lineCost' = 'null'::jsonb then null else (v_read->>'lineCost')::numeric end,
        v_sort,
        (v_lock->>'userId')::uuid,
        (v_lock->>'userId')::uuid
      );
    end if;
    v_sort := v_sort + 1;
  end loop;

  perform public.variation_reprice_build_up(v_id);
  perform public.variation_store_totals(p_revision);
  return jsonb_build_object(
    'ok', true,
    'itemId', v_id,
    'componentIds', coalesce((
      select jsonb_agg(id order by sort_order, id)
      from public.variation_item_cost_components
      where item_id = v_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.convert_draft_variation_item_to_simple_v1(
  p_variation uuid,
  p_revision uuid,
  p_item_id uuid,
  p_item jsonb,
  p_confirm boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock jsonb;
  v_row public.variation_items%rowtype;
  v_item jsonb;
begin
  v_lock := public.variation_lock_current(p_variation, p_revision);
  if coalesce(v_lock->>'ok', 'false') <> 'true' then
    return v_lock;
  end if;
  if v_lock->>'status' is distinct from 'draft' then
    return jsonb_build_object('ok', false, 'error', 'IMMUTABLE');
  end if;

  select * into v_row
  from public.variation_items
  where id = p_item_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_row.org_id is distinct from (v_lock->>'orgId')::uuid then
    return jsonb_build_object('ok', false, 'error', 'CROSS_TENANT');
  end if;
  if v_row.variation_id is distinct from p_variation
    or v_row.revision_id is distinct from p_revision
    or v_row.project_id is distinct from (v_lock->>'projectId')::uuid
  then
    return jsonb_build_object('ok', false, 'error', 'CROSS_PROJECT');
  end if;
  if v_row.pricing_mode = 'build_up' and coalesce(p_confirm, false) is not true then
    return jsonb_build_object('ok', false, 'error', 'MODE_CONFIRM_REQUIRED');
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
  set pricing_mode = 'simple', unit_cost = null, line_cost_adjustment = null, unit_sell = null, line_sell_adjustment_ex_gst = null
  where id = p_item_id;
  delete from public.variation_item_cost_components where item_id = p_item_id;
  update public.variation_items
  set
    pricing_mode = 'simple',
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
  return jsonb_build_object('ok', true, 'itemId', p_item_id);
end;
$$;

create or replace function public.add_draft_variation_cost_component_v1(
  p_variation uuid,
  p_revision uuid,
  p_item_id uuid,
  p_component jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock jsonb;
  v_row public.variation_items%rowtype;
  v_read jsonb;
  v_id uuid;
begin
  v_lock := public.variation_lock_current(p_variation, p_revision);
  if coalesce(v_lock->>'ok', 'false') <> 'true' then
    return v_lock;
  end if;
  if v_lock->>'status' is distinct from 'draft' then
    return jsonb_build_object('ok', false, 'error', 'IMMUTABLE');
  end if;
  if p_component ? 'itemId' and nullif(p_component->>'itemId', '') is not null and nullif(p_component->>'itemId', '') is distinct from p_item_id::text then
    return jsonb_build_object('ok', false, 'error', 'INVALID_ITEM');
  end if;

  select * into v_row from public.variation_items where id = p_item_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_row.org_id is distinct from (v_lock->>'orgId')::uuid then
    return jsonb_build_object('ok', false, 'error', 'CROSS_TENANT');
  end if;
  if v_row.variation_id is distinct from p_variation
    or v_row.revision_id is distinct from p_revision
    or v_row.project_id is distinct from (v_lock->>'projectId')::uuid
  then
    return jsonb_build_object('ok', false, 'error', 'CROSS_PROJECT');
  end if;
  if v_row.pricing_mode is distinct from 'build_up' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_ITEM');
  end if;

  v_read := public.variation_read_component(p_component, coalesce((p_component->>'sortOrder')::integer, 0));
  if coalesce(v_read->>'ok', 'false') <> 'true' then
    return v_read;
  end if;

  perform set_config('quotr.variation_write', 'draft', true);
  insert into public.variation_item_cost_components (
    org_id, project_id, variation_id, revision_id, item_id, category, description,
    quantity, unit, unit_cost, line_cost, sort_order, created_by, updated_by
  ) values (
    v_row.org_id, v_row.project_id, v_row.variation_id, v_row.revision_id, v_row.id,
    v_read->>'category', v_read->>'description', (v_read->>'quantity')::numeric, v_read->>'unit',
    case when v_read->'unitCost' = 'null'::jsonb then null else (v_read->>'unitCost')::numeric end,
    case when v_read->'lineCost' = 'null'::jsonb then null else (v_read->>'lineCost')::numeric end,
    coalesce((v_read->>'sortOrder')::integer, 0),
    (v_lock->>'userId')::uuid,
    (v_lock->>'userId')::uuid
  )
  returning id into v_id;

  perform public.variation_reprice_build_up(v_row.id);
  perform public.variation_store_totals(p_revision);
  return jsonb_build_object('ok', true, 'itemId', v_row.id, 'componentId', v_id);
end;
$$;

create or replace function public.update_draft_variation_cost_component_v1(
  p_variation uuid,
  p_revision uuid,
  p_item_id uuid,
  p_component_id uuid,
  p_component jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock jsonb;
  v_row public.variation_items%rowtype;
  v_owner uuid;
  v_read jsonb;
begin
  v_lock := public.variation_lock_current(p_variation, p_revision);
  if coalesce(v_lock->>'ok', 'false') <> 'true' then
    return v_lock;
  end if;
  if v_lock->>'status' is distinct from 'draft' then
    return jsonb_build_object('ok', false, 'error', 'IMMUTABLE');
  end if;
  select * into v_row from public.variation_items where id = p_item_id for update;
  if not found or v_row.variation_id is distinct from p_variation or v_row.revision_id is distinct from p_revision then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_row.org_id is distinct from (v_lock->>'orgId')::uuid then
    return jsonb_build_object('ok', false, 'error', 'CROSS_TENANT');
  end if;
  select item_id into v_owner from public.variation_item_cost_components where id = p_component_id;
  if v_owner is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_owner is distinct from p_item_id then
    return jsonb_build_object('ok', false, 'error', 'INVALID_ITEM');
  end if;
  v_read := public.variation_read_component(p_component, coalesce((p_component->>'sortOrder')::integer, 0));
  if coalesce(v_read->>'ok', 'false') <> 'true' then
    return v_read;
  end if;
  perform set_config('quotr.variation_write', 'draft', true);
  update public.variation_item_cost_components
  set
    category = v_read->>'category',
    description = v_read->>'description',
    quantity = (v_read->>'quantity')::numeric,
    unit = v_read->>'unit',
    unit_cost = case when v_read->'unitCost' = 'null'::jsonb then null else (v_read->>'unitCost')::numeric end,
    line_cost = case when v_read->'lineCost' = 'null'::jsonb then null else (v_read->>'lineCost')::numeric end,
    sort_order = coalesce((v_read->>'sortOrder')::integer, sort_order),
    updated_by = (v_lock->>'userId')::uuid
  where id = p_component_id
    and item_id = p_item_id;
  perform public.variation_reprice_build_up(p_item_id);
  perform public.variation_store_totals(p_revision);
  return jsonb_build_object('ok', true, 'itemId', p_item_id, 'componentId', p_component_id);
end;
$$;

create or replace function public.delete_draft_variation_cost_component_v1(
  p_variation uuid,
  p_revision uuid,
  p_item_id uuid,
  p_component_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock jsonb;
  v_row public.variation_items%rowtype;
  v_owner uuid;
begin
  v_lock := public.variation_lock_current(p_variation, p_revision);
  if coalesce(v_lock->>'ok', 'false') <> 'true' then
    return v_lock;
  end if;
  if v_lock->>'status' is distinct from 'draft' then
    return jsonb_build_object('ok', false, 'error', 'IMMUTABLE');
  end if;
  select * into v_row from public.variation_items where id = p_item_id for update;
  if not found or v_row.revision_id is distinct from p_revision or v_row.variation_id is distinct from p_variation then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_row.org_id is distinct from (v_lock->>'orgId')::uuid then
    return jsonb_build_object('ok', false, 'error', 'CROSS_TENANT');
  end if;
  select item_id into v_owner from public.variation_item_cost_components where id = p_component_id;
  if v_owner is distinct from p_item_id then
    return jsonb_build_object('ok', false, 'error', 'INVALID_ITEM');
  end if;
  perform set_config('quotr.variation_write', 'draft', true);
  delete from public.variation_item_cost_components where id = p_component_id and item_id = p_item_id;
  perform public.variation_reprice_build_up(p_item_id);
  perform public.variation_store_totals(p_revision);
  return jsonb_build_object('ok', true, 'itemId', p_item_id);
end;
$$;

create or replace function public.reorder_draft_variation_cost_components_v1(
  p_variation uuid,
  p_revision uuid,
  p_item_id uuid,
  p_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock jsonb;
  v_row public.variation_items%rowtype;
  v_existing uuid[];
  v_index integer;
begin
  v_lock := public.variation_lock_current(p_variation, p_revision);
  if coalesce(v_lock->>'ok', 'false') <> 'true' then
    return v_lock;
  end if;
  if v_lock->>'status' is distinct from 'draft' then
    return jsonb_build_object('ok', false, 'error', 'IMMUTABLE');
  end if;
  select * into v_row from public.variation_items where id = p_item_id for update;
  if not found or v_row.revision_id is distinct from p_revision or v_row.variation_id is distinct from p_variation then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_row.org_id is distinct from (v_lock->>'orgId')::uuid then
    return jsonb_build_object('ok', false, 'error', 'CROSS_TENANT');
  end if;
  select coalesce(array_agg(id order by sort_order, id), '{}')
  into v_existing
  from public.variation_item_cost_components
  where item_id = p_item_id;
  if v_existing is distinct from p_ids and not (v_existing <@ p_ids and p_ids <@ v_existing and cardinality(v_existing) = cardinality(p_ids)) then
    return jsonb_build_object('ok', false, 'error', 'INVALID_ITEM');
  end if;
  perform set_config('quotr.variation_write', 'draft', true);
  for v_index in 1..cardinality(p_ids) loop
    update public.variation_item_cost_components
    set sort_order = v_index - 1, updated_by = (v_lock->>'userId')::uuid
    where id = p_ids[v_index]
      and item_id = p_item_id;
  end loop;
  return jsonb_build_object('ok', true, 'itemId', p_item_id);
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
  v_group uuid;
  v_count integer;
begin
  v_lock := public.variation_lock_current(p_variation, p_revision);
  if coalesce(v_lock->>'ok', 'false') <> 'true' then
    return v_lock;
  end if;
  if v_lock->>'status' is distinct from 'draft' then
    return jsonb_build_object('ok', false, 'error', 'IMMUTABLE');
  end if;

  select substitution_group_id into v_group
  from public.variation_items
  where id = p_item_id
    and revision_id = p_revision
    and variation_id = p_variation
    and org_id = (v_lock->>'orgId')::uuid;

  perform set_config('quotr.variation_write', 'draft', true);
  delete from public.variation_items
  where revision_id = p_revision
    and variation_id = p_variation
    and org_id = (v_lock->>'orgId')::uuid
    and (
      id = p_item_id
      or (v_group is not null and substitution_group_id = v_group)
    );
  get diagnostics v_count = row_count;
  if v_count = 0 then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  perform public.variation_store_totals(p_revision);
  return jsonb_build_object('ok', true, 'itemId', p_item_id);
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
  v_source public.variation_items%rowtype;
  v_next uuid;
  v_next_number integer;
  v_new_item uuid;
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
    tax_treatment, title, summary, proposed_time_effect_days, client_notes, internal_notes,
    revised_from_revision_id
  ) values (
    p_variation, v_org, v_row.project_id, v_rev.revision_number + 1, 'draft',
    v_rev.currency, v_rev.gst_rate, v_rev.tax_treatment, v_rev.title, v_rev.summary,
    v_rev.proposed_time_effect_days, v_rev.client_notes, v_rev.internal_notes, p_revision
  )
  returning id, revision_number into v_next, v_next_number;

  for v_source in
    select * from public.variation_items
    where revision_id = p_revision
    order by sort_order, id
  loop
    insert into public.variation_items (
      revision_id, variation_id, org_id, project_id, item_type, client_description,
      work_area_id, work_area_type, snapshot_line_id, stable_component_key,
      quantity, unit, unit_cost, line_cost_adjustment, unit_sell, line_sell_adjustment_ex_gst,
      sort_order, client_inclusion, client_exclusion, internal_metadata, substitution_group_id,
      pricing_mode
    ) values (
      v_next, v_source.variation_id, v_source.org_id, v_source.project_id, v_source.item_type, v_source.client_description,
      v_source.work_area_id, v_source.work_area_type, v_source.snapshot_line_id, v_source.stable_component_key,
      v_source.quantity, v_source.unit, v_source.unit_cost, v_source.line_cost_adjustment, v_source.unit_sell, v_source.line_sell_adjustment_ex_gst,
      v_source.sort_order, v_source.client_inclusion, v_source.client_exclusion, v_source.internal_metadata, v_source.substitution_group_id,
      v_source.pricing_mode
    )
    returning id into v_new_item;

    insert into public.variation_item_cost_components (
      org_id, project_id, variation_id, revision_id, item_id, category, description,
      quantity, unit, unit_cost, line_cost, sort_order, created_by, updated_by
    )
    select
      org_id, project_id, variation_id, v_next, v_new_item, category, description,
      quantity, unit, unit_cost, line_cost, sort_order, created_by, v_uid
    from public.variation_item_cost_components
    where item_id = v_source.id
    order by sort_order, id;
  end loop;

  perform public.variation_store_totals(v_next);

  update public.variations
  set current_revision_id = v_next, status = 'draft', title = v_rev.title, summary = v_rev.summary
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

revoke all on function public.variation_cost_component_guard() from public, anon, authenticated, service_role;
revoke all on function public.variation_reprice_build_up(uuid) from public, anon, authenticated, service_role;
revoke all on function public.variation_read_component(jsonb, integer) from public, anon, authenticated, service_role;
revoke all on function public.apply_draft_variation_build_up_v1(uuid, uuid, uuid, jsonb, jsonb, boolean) from public, anon, authenticated, service_role;
revoke all on function public.convert_draft_variation_item_to_simple_v1(uuid, uuid, uuid, jsonb, boolean) from public, anon, authenticated, service_role;
revoke all on function public.add_draft_variation_cost_component_v1(uuid, uuid, uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.update_draft_variation_cost_component_v1(uuid, uuid, uuid, uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.delete_draft_variation_cost_component_v1(uuid, uuid, uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.reorder_draft_variation_cost_components_v1(uuid, uuid, uuid, uuid[]) from public, anon, authenticated, service_role;

grant execute on function public.apply_draft_variation_build_up_v1(uuid, uuid, uuid, jsonb, jsonb, boolean) to authenticated;
grant execute on function public.convert_draft_variation_item_to_simple_v1(uuid, uuid, uuid, jsonb, boolean) to authenticated;
grant execute on function public.add_draft_variation_cost_component_v1(uuid, uuid, uuid, jsonb) to authenticated;
grant execute on function public.update_draft_variation_cost_component_v1(uuid, uuid, uuid, uuid, jsonb) to authenticated;
grant execute on function public.delete_draft_variation_cost_component_v1(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.reorder_draft_variation_cost_components_v1(uuid, uuid, uuid, uuid[]) to authenticated;

notify pgrst, 'reload schema';
