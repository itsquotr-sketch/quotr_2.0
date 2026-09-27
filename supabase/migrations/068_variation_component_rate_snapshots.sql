-- VARIATIONS-02-R4 — snapshot Company Rate and Quotr benchmark provenance
-- onto a draft cost component. The stored unit cost remains the commercial
-- authority. Live rate rows are not a foreign key and are not read when an
-- issued document is calculated.

alter table public.variation_item_cost_components
  add column cost_source text,
  add column canonical_rate_key text,
  add column source_label text,
  add column source_unit text,
  add column source_unit_cost numeric(12, 2),
  add column source_selected_at timestamptz,
  add column source_record_id uuid;

update public.variation_item_cost_components
set
  cost_source = case when unit_cost is null then 'missing' else 'manual' end,
  source_unit_cost = unit_cost
where cost_source is null;

alter table public.variation_item_cost_components
  alter column cost_source set default 'missing',
  alter column cost_source set not null;

alter table public.variation_item_cost_components
  add constraint variation_component_cost_source_chk
    check (cost_source in ('manual', 'company_rate', 'quotr_benchmark', 'missing')),
  add constraint variation_component_source_key_chk
    check (canonical_rate_key is null or char_length(canonical_rate_key) between 1 and 160),
  add constraint variation_component_source_label_chk
    check (source_label is null or char_length(source_label) between 1 and 200),
  add constraint variation_component_source_unit_chk
    check (source_unit is null or char_length(source_unit) between 1 and 40),
  add constraint variation_component_rate_snapshot_chk
    check (
      (
        cost_source = 'missing'
        and unit_cost is null
        and canonical_rate_key is null
        and source_record_id is null
      )
      or (
        cost_source = 'manual'
        and unit_cost is not null
        and canonical_rate_key is null
        and source_record_id is null
      )
      or (
        cost_source in ('company_rate', 'quotr_benchmark')
        and canonical_rate_key is not null
        and unit_cost is not null
        and source_unit_cost = unit_cost
      )
    );

create or replace function public.variation_rate_unit(p_unit text)
returns text
language sql
immutable
as $$
  select case
    when v in ('hr', 'hours', 'h', 'hour') then 'hour'
    when v in ('linearmetre', 'linearmeter', 'linm', 'lm') then 'lm'
    when v in ('m2', 'sqm') then 'm2'
    when v in ('each', 'ea') then 'each'
    else v
  end
  from (
    select replace(replace(replace(lower(trim(coalesce(p_unit, ''))), ' ', ''), 'm²', 'm2'), 'm³', 'm3') as v
  ) normalized
$$;

create or replace function public.variation_component_rate_provenance()
returns trigger
language plpgsql
as $$
declare
  v_mode text := coalesce(current_setting('quotr.variation_write', true), '');
  v_rate text := coalesce(current_setting('quotr.variation_rate_write', true), '');
begin
  if v_mode = 'transition' or v_rate = 'snapshot' then
    return new;
  end if;
  if tg_op = 'UPDATE' and v_rate is distinct from 'manual' and new.unit_cost is not distinct from old.unit_cost then
    return new;
  end if;
  if new.unit_cost is null then
    new.cost_source := 'missing';
    new.canonical_rate_key := null;
    new.source_label := null;
    new.source_unit := null;
    new.source_unit_cost := null;
    new.source_record_id := null;
    new.source_selected_at := null;
  else
    new.cost_source := 'manual';
    new.canonical_rate_key := null;
    new.source_label := null;
    new.source_unit := null;
    new.source_unit_cost := new.unit_cost;
    new.source_record_id := null;
    new.source_selected_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists variation_component_rate_provenance on public.variation_item_cost_components;
create trigger variation_component_rate_provenance
  before insert or update on public.variation_item_cost_components
  for each row
  execute function public.variation_component_rate_provenance();

create or replace function public.variation_lock_draft_component(
  p_variation uuid,
  p_revision uuid,
  p_item uuid,
  p_component uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock jsonb;
  v_comp public.variation_item_cost_components%rowtype;
begin
  v_lock := public.variation_lock_current(p_variation, p_revision);
  if coalesce(v_lock->>'ok', 'false') <> 'true' then
    return v_lock;
  end if;
  if v_lock->>'status' is distinct from 'draft' then
    return jsonb_build_object('ok', false, 'error', 'IMMUTABLE');
  end if;
  select * into v_comp
  from public.variation_item_cost_components
  where id = p_component
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_comp.org_id is distinct from (v_lock->>'orgId')::uuid then
    return jsonb_build_object('ok', false, 'error', 'CROSS_TENANT');
  end if;
  if v_comp.variation_id is distinct from p_variation
    or v_comp.revision_id is distinct from p_revision
    or v_comp.item_id is distinct from p_item
    or v_comp.project_id is distinct from (v_lock->>'projectId')::uuid
  then
    return jsonb_build_object('ok', false, 'error', 'CROSS_PROJECT');
  end if;
  return jsonb_build_object(
    'ok', true,
    'orgId', v_lock->>'orgId',
    'userId', v_lock->>'userId',
    'projectId', v_lock->>'projectId',
    'quantity', v_comp.quantity,
    'unit', v_comp.unit,
    'category', v_comp.category,
    'unitCost', v_comp.unit_cost,
    'canonicalKey', v_comp.canonical_rate_key,
    'costSource', v_comp.cost_source
  );
end;
$$;

create or replace function public.variation_find_company_rate(
  p_org uuid,
  p_key text,
  p_unit text,
  p_rate_type text
)
returns setof public.rates
language sql
stable
security definer
set search_path = public
as $$
  select r.*
  from public.rates r
  where r.org_id = p_org
    and r.item_key = p_key
    and r.active
    and r.rate_type is distinct from 'productivity'
    and r.rate_type = p_rate_type
    and r.cost_rate is not null
    and r.cost_rate > 0
    and public.variation_rate_unit(r.unit) = public.variation_rate_unit(p_unit)
  order by r.updated_at desc
  limit 1
$$;

create or replace function public.snapshot_draft_variation_component_rate_v1(
  p_variation uuid,
  p_revision uuid,
  p_item uuid,
  p_component uuid,
  p_canonical_key text,
  p_rate_type text,
  p_benchmark_cost numeric,
  p_benchmark_label text,
  p_benchmark_unit text,
  p_allow_benchmark boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock jsonb;
  v_rate public.rates%rowtype;
  v_cost numeric;
  v_source text;
  v_label text;
  v_unit text;
  v_record uuid;
  v_line numeric;
  v_type text;
begin
  if p_canonical_key is null or char_length(trim(p_canonical_key)) = 0 or p_rate_type is null then
    return jsonb_build_object('ok', false, 'error', 'INVALID_RATE');
  end if;
  if p_rate_type = 'productivity' then
    return jsonb_build_object('ok', false, 'error', 'PRODUCTIVITY_REJECTED');
  end if;
  v_lock := public.variation_lock_draft_component(p_variation, p_revision, p_item, p_component);
  if coalesce(v_lock->>'ok', 'false') <> 'true' then
    return v_lock;
  end if;
  v_type := case
    when v_lock->>'category' = 'labour' then 'labour'
    else p_rate_type
  end;
  if v_lock->>'category' = 'labour' and public.variation_rate_unit(v_lock->>'unit') is distinct from 'hour' then
    return jsonb_build_object('ok', false, 'error', 'WRONG_UNIT');
  end if;
  if v_type = 'labour' and public.variation_rate_unit(v_lock->>'unit') is distinct from 'hour' then
    return jsonb_build_object('ok', false, 'error', 'WRONG_UNIT');
  end if;
  select * into v_rate
  from public.variation_find_company_rate(
    (v_lock->>'orgId')::uuid,
    trim(p_canonical_key),
    v_lock->>'unit',
    v_type
  ) as found;
  if found then
    v_cost := public.variation_round_money(v_rate.cost_rate);
    v_source := 'company_rate';
    v_label := left(v_rate.label, 200);
    v_unit := left(v_rate.unit, 40);
    v_record := v_rate.id;
  elsif coalesce(p_allow_benchmark, false)
    and p_benchmark_cost is not null
    and p_benchmark_cost > 0
    and p_benchmark_cost <= 10000000
    and p_benchmark_label is not null
    and public.variation_rate_unit(p_benchmark_unit) = public.variation_rate_unit(v_lock->>'unit')
  then
    v_cost := public.variation_round_money(p_benchmark_cost);
    if v_cost <= 0 then
      return jsonb_build_object('ok', false, 'error', 'INVALID_RATE');
    end if;
    v_source := 'quotr_benchmark';
    v_label := left(p_benchmark_label, 200);
    v_unit := left(p_benchmark_unit, 40);
    v_record := null;
  else
    return jsonb_build_object('ok', false, 'error', 'INVALID_RATE');
  end if;
  v_line := public.variation_round_money((v_lock->>'quantity')::numeric * v_cost);
  perform set_config('quotr.variation_write', 'draft', true);
  perform set_config('quotr.variation_rate_write', 'snapshot', true);
  update public.variation_item_cost_components
  set
    unit_cost = v_cost,
    line_cost = v_line,
    cost_source = v_source,
    canonical_rate_key = trim(p_canonical_key),
    source_label = v_label,
    source_unit = v_unit,
    source_unit_cost = v_cost,
    source_record_id = v_record,
    source_selected_at = now(),
    updated_by = (v_lock->>'userId')::uuid
  where id = p_component;
  perform public.variation_reprice_build_up(p_item);
  perform public.variation_store_totals(p_revision);
  return jsonb_build_object(
    'ok', true,
    'componentId', p_component,
    'unitCost', v_cost,
    'lineCost', v_line,
    'costSource', v_source,
    'sourceLabel', v_label,
    'sourceUnit', v_unit,
    'canonicalKey', trim(p_canonical_key)
  );
end;
$$;

create or replace function public.refresh_draft_variation_component_rate_v1(
  p_variation uuid,
  p_revision uuid,
  p_item uuid,
  p_component uuid,
  p_confirm boolean,
  p_benchmark_cost numeric,
  p_benchmark_label text,
  p_benchmark_unit text,
  p_rate_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock jsonb;
  v_rate public.rates%rowtype;
  v_current numeric;
  v_cost numeric;
  v_source text;
  v_label text;
  v_unit text;
  v_record uuid;
  v_line numeric;
  v_changed boolean;
begin
  v_lock := public.variation_lock_draft_component(p_variation, p_revision, p_item, p_component);
  if coalesce(v_lock->>'ok', 'false') <> 'true' then
    return v_lock;
  end if;
  if v_lock->>'canonicalKey' is null or v_lock->>'costSource' not in ('company_rate', 'quotr_benchmark') then
    return jsonb_build_object('ok', false, 'error', 'RATE_UNAVAILABLE');
  end if;
  if p_rate_type is null or p_rate_type = 'productivity' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_RATE');
  end if;
  v_current := case when v_lock->>'unitCost' is null then null else (v_lock->>'unitCost')::numeric end;
  select * into v_rate
  from public.variation_find_company_rate(
    (v_lock->>'orgId')::uuid,
    v_lock->>'canonicalKey',
    v_lock->>'unit',
    case when v_lock->>'category' = 'labour' then 'labour' else p_rate_type end
  ) as found;
  if found then
    v_cost := public.variation_round_money(v_rate.cost_rate);
    v_source := 'company_rate';
    v_label := left(v_rate.label, 200);
    v_unit := left(v_rate.unit, 40);
    v_record := v_rate.id;
  elsif p_benchmark_cost is not null
    and p_benchmark_cost > 0
    and p_benchmark_cost <= 10000000
    and p_benchmark_label is not null
    and public.variation_rate_unit(p_benchmark_unit) = public.variation_rate_unit(v_lock->>'unit')
  then
    v_cost := public.variation_round_money(p_benchmark_cost);
    v_source := 'quotr_benchmark';
    v_label := left(p_benchmark_label, 200);
    v_unit := left(p_benchmark_unit, 40);
    v_record := null;
  else
    return jsonb_build_object('ok', false, 'error', 'RATE_UNAVAILABLE');
  end if;
  v_changed := v_current is distinct from v_cost or v_lock->>'costSource' is distinct from v_source;
  if coalesce(p_confirm, false) is not true then
    return jsonb_build_object(
      'ok', true,
      'applied', false,
      'changed', v_changed,
      'currentCost', v_current,
      'proposedCost', v_cost,
      'proposedSource', v_source,
      'sourceLabel', v_label
    );
  end if;
  if v_changed then
    v_line := public.variation_round_money((v_lock->>'quantity')::numeric * v_cost);
    perform set_config('quotr.variation_write', 'draft', true);
    perform set_config('quotr.variation_rate_write', 'snapshot', true);
    update public.variation_item_cost_components
    set
      unit_cost = v_cost,
      line_cost = v_line,
      cost_source = v_source,
      source_label = v_label,
      source_unit = v_unit,
      source_unit_cost = v_cost,
      source_record_id = v_record,
      source_selected_at = now(),
      updated_by = (v_lock->>'userId')::uuid
    where id = p_component;
    perform public.variation_reprice_build_up(p_item);
    perform public.variation_store_totals(p_revision);
  end if;
  return jsonb_build_object(
    'ok', true,
    'applied', true,
    'changed', v_changed,
    'currentCost', v_current,
    'proposedCost', v_cost,
    'proposedSource', v_source,
    'sourceLabel', v_label,
    'unitCost', v_cost
  );
end;
$$;

create or replace function public.set_draft_variation_component_manual_cost_v1(
  p_variation uuid,
  p_revision uuid,
  p_item uuid,
  p_component uuid,
  p_unit_cost numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock jsonb;
  v_cost numeric;
  v_line numeric;
begin
  v_lock := public.variation_lock_draft_component(p_variation, p_revision, p_item, p_component);
  if coalesce(v_lock->>'ok', 'false') <> 'true' then
    return v_lock;
  end if;
  if p_unit_cost is null then
    v_cost := null;
  elsif p_unit_cost < 0 or p_unit_cost > 10000000 or p_unit_cost is distinct from public.variation_round_money(p_unit_cost) then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  else
    v_cost := public.variation_round_money(p_unit_cost);
  end if;
  v_line := case
    when v_cost is null then null
    else public.variation_round_money((v_lock->>'quantity')::numeric * v_cost)
  end;
  perform set_config('quotr.variation_write', 'draft', true);
  perform set_config('quotr.variation_rate_write', 'manual', true);
  update public.variation_item_cost_components
  set
    unit_cost = v_cost,
    line_cost = v_line,
    updated_by = (v_lock->>'userId')::uuid
  where id = p_component;
  perform public.variation_reprice_build_up(p_item);
  perform public.variation_store_totals(p_revision);
  return jsonb_build_object(
    'ok', true,
    'componentId', p_component,
    'unitCost', v_cost,
    'lineCost', v_line,
    'costSource', case when v_cost is null then 'missing' else 'manual' end
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
      quantity, unit, unit_cost, line_cost, sort_order, created_by, updated_by,
      cost_source, canonical_rate_key, source_label, source_unit, source_unit_cost,
      source_selected_at, source_record_id
    )
    select
      org_id, project_id, variation_id, v_next, v_new_item, category, description,
      quantity, unit, unit_cost, line_cost, sort_order, created_by, v_uid,
      cost_source, canonical_rate_key, source_label, source_unit, source_unit_cost,
      source_selected_at, source_record_id
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

revoke all on function public.variation_rate_unit(text) from public, anon, authenticated, service_role;
revoke all on function public.variation_component_rate_provenance() from public, anon, authenticated, service_role;
revoke all on function public.variation_lock_draft_component(uuid, uuid, uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.variation_find_company_rate(uuid, text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.snapshot_draft_variation_component_rate_v1(uuid, uuid, uuid, uuid, text, text, numeric, text, text, boolean) from public, anon, authenticated, service_role;
revoke all on function public.refresh_draft_variation_component_rate_v1(uuid, uuid, uuid, uuid, boolean, numeric, text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.set_draft_variation_component_manual_cost_v1(uuid, uuid, uuid, uuid, numeric) from public, anon, authenticated, service_role;

grant execute on function public.snapshot_draft_variation_component_rate_v1(uuid, uuid, uuid, uuid, text, text, numeric, text, text, boolean) to authenticated;
grant execute on function public.refresh_draft_variation_component_rate_v1(uuid, uuid, uuid, uuid, boolean, numeric, text, text, text) to authenticated;
grant execute on function public.set_draft_variation_component_manual_cost_v1(uuid, uuid, uuid, uuid, numeric) to authenticated;

notify pgrst, 'reload schema';
