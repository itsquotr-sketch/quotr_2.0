-- Use one confirmed subcontractor rate version on draft job pricing.
-- The rate book is not a fallback for resolveRate and is not applied while an estimate is generated.
-- A later edit of the rate book does not change the copied snapshot on this job.
-- Quotes, accepted snapshots, and variations are not updated.

create table if not exists public.subcontractor_rate_applications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  pricing_document_id uuid not null references public.pricing_documents (id) on delete cascade,
  work_area_id uuid not null references public.work_areas (id) on delete restrict,
  subcontractor_id uuid not null references public.subcontractors (id) on delete restrict,
  rate_id uuid not null references public.subcontractor_rates (id) on delete restrict,
  rate_version_id uuid not null references public.subcontractor_rate_versions (id) on delete restrict,
  version_number integer not null,
  scope text not null,
  exclusions text not null default '',
  job_scope text not null default '',
  unit text not null,
  quantity numeric(12, 2),
  unit_cost_ex_gst numeric(12, 2) not null,
  minimum_charge_ex_gst numeric(12, 2),
  minimum_applied boolean not null default false,
  cost_ex_gst numeric(12, 2) not null,
  currency text not null default 'NZD',
  effective_from date not null,
  effective_until date,
  sell_treatment text not null,
  target_margin_percent numeric(5, 2),
  sell_ex_gst numeric(12, 2) not null,
  loss_acknowledged boolean not null default false,
  target_item_id uuid,
  allowance_item_id uuid not null references public.pricing_items (id) on delete restrict,
  replaced_item_ids uuid[] not null default '{}',
  before_lines jsonb not null default '[]'::jsonb,
  scope_confirmed boolean not null,
  quantity_confirmed boolean not null,
  reconciliation_status text,
  applied_by uuid not null references public.profiles (id) on delete restrict,
  applied_at timestamptz not null default now(),
  superseded_at timestamptz,
  constraint subcontractor_rate_applications_currency_nzd check (currency = 'NZD'),
  constraint subcontractor_rate_applications_unit_known check (unit in ('lump_sum', 'm2', 'm', 'item', 'hour')),
  constraint subcontractor_rate_applications_sell_known check (sell_treatment in ('keep', 'target_margin', 'manual')),
  constraint subcontractor_rate_applications_money check (unit_cost_ex_gst >= 0 and cost_ex_gst >= 0 and sell_ex_gst >= 0),
  constraint subcontractor_rate_applications_reconciliation check (
    reconciliation_status is null or reconciliation_status in ('pending', 'kept', 'dropped')
  ),
  constraint subcontractor_rate_applications_quantity check (
    (unit = 'lump_sum' and quantity is null)
    or (unit <> 'lump_sum' and quantity is not null and quantity > 0)
  )
);

create unique index if not exists subcontractor_rate_applications_one_active_rate_uidx
  on public.subcontractor_rate_applications (pricing_document_id, rate_id)
  where superseded_at is null;

create index if not exists subcontractor_rate_applications_document_idx
  on public.subcontractor_rate_applications (pricing_document_id, applied_at desc);

comment on table public.subcontractor_rate_applications is
  'Job-specific snapshot of one confirmed rate version. Not an award, and not updated when the rate book changes.';

alter table public.subcontractor_rate_applications enable row level security;

drop policy if exists subcontractor_rate_applications_select on public.subcontractor_rate_applications;
create policy subcontractor_rate_applications_select
  on public.subcontractor_rate_applications for select
  using (org_id = public.auth_org_id());

revoke all on public.subcontractor_rate_applications from public, anon;
grant select on public.subcontractor_rate_applications to authenticated;

create or replace function public.apply_subcontractor_rate_to_pricing_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
  v_today date := (timezone('Pacific/Auckland', now()))::date;
  v_version public.subcontractor_rate_versions%rowtype;
  v_rate public.subcontractor_rates%rowtype;
  v_doc public.pricing_documents%rowtype;
  v_area public.work_areas%rowtype;
  v_active public.subcontractor_rate_applications%rowtype;
  v_item public.pricing_items%rowtype;
  v_rfq public.rfq_pricing_applications%rowtype;
  v_has_active boolean := false;
  v_has_rfq boolean := false;
  v_mode text;
  v_target uuid;
  v_unit text;
  v_item_unit text;
  v_quantity numeric(12, 2);
  v_extended numeric(12, 2);
  v_cost numeric(12, 2);
  v_minimum_applied boolean := false;
  v_treatment text;
  v_sell numeric(12, 2);
  v_sell_known boolean := false;
  v_gross numeric(12, 2);
  v_margin numeric(12, 2);
  v_markup numeric(12, 2);
  v_scope text;
  v_included text;
  v_label text;
  v_conflict boolean := false;
  v_before jsonb := '[]'::jsonb;
  v_replaced uuid[] := '{}';
  v_allowance uuid;
  v_application uuid;
  v_norm text;
begin
  if auth.uid() is null or v_org is null or not public.auth_can_mutate_work() then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;
  if p_payload is null
    or coalesce(p_payload->>'rate_version_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or coalesce(p_payload->>'pricing_document_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or coalesce(p_payload->>'work_area_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then
    return jsonb_build_object('ok', false, 'error', 'INVALID');
  end if;

  select * into v_version
  from public.subcontractor_rate_versions
  where id = (p_payload->>'rate_version_id')::uuid and org_id = v_org;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  select * into v_rate
  from public.subcontractor_rates
  where id = v_version.rate_id and org_id = v_org;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_rate.retired_at is not null then
    return jsonb_build_object('ok', false, 'error', 'RETIRED');
  end if;
  if exists (
    select 1 from public.subcontractors
    where id = v_rate.subcontractor_id and org_id = v_org and archived_at is not null
  ) then
    return jsonb_build_object('ok', false, 'error', 'ARCHIVED');
  end if;
  if v_version.currency is distinct from 'NZD' then
    return jsonb_build_object('ok', false, 'error', 'CURRENCY');
  end if;
  if v_version.effective_until is not null and v_version.effective_until < v_today then
    return jsonb_build_object('ok', false, 'error', 'EXPIRED');
  end if;
  if v_version.effective_from > v_today then
    return jsonb_build_object('ok', false, 'error', 'NOT_CURRENT');
  end if;
  if coalesce(p_payload->>'confirm_scope', '') is distinct from 'true' then
    return jsonb_build_object('ok', false, 'error', 'CONFIRM_SCOPE');
  end if;
  if coalesce(p_payload->>'confirm_quantity', '') is distinct from 'true' then
    return jsonb_build_object('ok', false, 'error', 'CONFIRM_QUANTITY');
  end if;

  select * into v_doc
  from public.pricing_documents
  where id = (p_payload->>'pricing_document_id')::uuid and org_id = v_org
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_doc.status = 'archived' then
    return jsonb_build_object('ok', false, 'error', 'PRICING_CLOSED');
  end if;
  if v_doc.status = 'converted_to_quote'
    or exists (
      select 1 from public.quotes
      where pricing_document_id = v_doc.id
        and org_id = v_org
        and status not in ('draft', 'archived')
    )
  then
    return jsonb_build_object('ok', false, 'error', 'QUOTE_ISSUED');
  end if;
  if v_doc.status not in ('draft', 'reviewed') then
    return jsonb_build_object('ok', false, 'error', 'PRICING_CLOSED');
  end if;

  select * into v_area
  from public.work_areas
  where id = (p_payload->>'work_area_id')::uuid
    and project_id = v_doc.project_id
    and org_id = v_org
    and status = 'confirmed';
  if not found or v_area.type is distinct from v_version.work_area_type then
    return jsonb_build_object('ok', false, 'error', 'WORK_AREA');
  end if;

  v_mode := p_payload->>'target_mode';
  if v_mode is null or v_mode not in ('add', 'replace') then
    return jsonb_build_object('ok', false, 'error', 'AMBIGUOUS');
  end if;
  if v_mode = 'replace' then
    if coalesce(p_payload->>'target_item_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      return jsonb_build_object('ok', false, 'error', 'AMBIGUOUS');
    end if;
    v_target := (p_payload->>'target_item_id')::uuid;
  elsif coalesce(p_payload->>'target_item_id', '') <> '' then
    return jsonb_build_object('ok', false, 'error', 'AMBIGUOUS');
  end if;

  if v_mode = 'replace' then
    select * into v_item
    from public.pricing_items
    where id = v_target and pricing_document_id = v_doc.id and org_id = v_org and work_area_id = v_area.id;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'AMBIGUOUS');
    end if;
    v_norm := lower(replace(btrim(coalesce(v_item.unit, '')), '²', '2'));
    v_norm := regexp_replace(v_norm, '\s+', ' ', 'g');
    v_item_unit := case
      when v_norm in ('m2', 'sqm', 'sq m', 'square metre', 'square meter') then 'm2'
      when v_norm in ('m', 'lm', 'lineal metre', 'lineal meter') then 'm'
      when v_norm in ('item', 'each', 'no', 'nr') then 'item'
      when v_norm in ('hour', 'hours', 'hr', 'hrs') then 'hour'
      when v_norm in ('lump_sum', 'lump sum', 'allowance', 'ls') then 'lump_sum'
      else ''
    end;
    if v_item_unit is distinct from v_version.unit then
      return jsonb_build_object('ok', false, 'error', 'UNIT');
    end if;
  end if;

  if v_version.unit = 'lump_sum' then
    if p_payload ? 'quantity' and nullif(p_payload->>'quantity', '') is not null then
      begin
        if (p_payload->>'quantity')::numeric < 0 then
          return jsonb_build_object('ok', false, 'error', 'QUANTITY');
        end if;
      exception when others then
        return jsonb_build_object('ok', false, 'error', 'QUANTITY');
      end;
    end if;
    v_quantity := null;
    v_cost := round(v_version.cost_ex_gst, 2);
    v_minimum_applied := false;
  else
    if nullif(p_payload->>'quantity', '') is null then
      return jsonb_build_object('ok', false, 'error', 'QUANTITY');
    end if;
    begin
      v_quantity := round((p_payload->>'quantity')::numeric, 2);
    exception when others then
      return jsonb_build_object('ok', false, 'error', 'QUANTITY');
    end;
    if v_quantity is null or v_quantity <= 0 then
      return jsonb_build_object('ok', false, 'error', 'QUANTITY');
    end if;
    v_extended := round(v_version.cost_ex_gst * v_quantity, 2);
    v_cost := v_extended;
    if v_version.minimum_charge is not null and v_version.minimum_charge > v_cost then
      v_cost := round(v_version.minimum_charge, 2);
      v_minimum_applied := true;
    end if;
  end if;
  if p_payload ? 'total_cost' and abs(coalesce((p_payload->>'total_cost')::numeric, -1) - v_cost) > 0.001 then
    return jsonb_build_object('ok', false, 'error', 'COST');
  end if;

  select * into v_active
  from public.subcontractor_rate_applications
  where pricing_document_id = v_doc.id and rate_id = v_rate.id and superseded_at is null
  for update;
  v_has_active := found;

  select * into v_rfq
  from public.rfq_pricing_applications
  where pricing_document_id = v_doc.id and work_area_id = v_area.id and superseded_at is null
  for update;
  v_has_rfq := found;
  if v_has_rfq then
    v_scope := lower(regexp_replace(btrim(v_version.scope), '\s+', ' ', 'g'));
    v_included := lower(regexp_replace(btrim(coalesce(v_rfq.included_scope, '')), '\s+', ' ', 'g'));
    v_label := lower(regexp_replace(btrim(coalesce(v_rfq.scope_label, '')), '\s+', ' ', 'g'));
    v_conflict := v_scope <> '' and (
      (v_included <> '' and (
        v_scope = v_included
        or (char_length(v_scope) >= 8 and char_length(v_included) >= 8 and (position(v_scope in v_included) > 0 or position(v_included in v_scope) > 0))
      ))
      or (v_label <> '' and (
        v_scope = v_label
        or (char_length(v_scope) >= 8 and char_length(v_label) >= 8 and (position(v_scope in v_label) > 0 or position(v_label in v_scope) > 0))
      ))
    );
  end if;
  if v_conflict and coalesce(p_payload->>'source_choice', '') is distinct from 'rate' then
    return jsonb_build_object('ok', false, 'error', 'SOURCE', 'rfqApplicationId', v_rfq.id, 'rfqScope', v_rfq.scope_label);
  end if;

  v_treatment := p_payload->>'sell_treatment';
  if v_treatment is null or v_treatment not in ('keep', 'target_margin', 'manual') then
    return jsonb_build_object('ok', false, 'error', 'SELL_TREATMENT');
  end if;

  if v_has_active then
    if v_mode = 'replace' and v_target is distinct from v_active.target_item_id and v_target is distinct from v_active.allowance_item_id then
      return jsonb_build_object('ok', false, 'error', 'AMBIGUOUS');
    end if;
    if v_mode = 'add' and cardinality(v_active.replaced_item_ids) > 0 then
      return jsonb_build_object('ok', false, 'error', 'AMBIGUOUS');
    end if;
    if v_treatment = 'keep' then
      select total_sell into v_sell
      from public.pricing_items
      where id = v_active.allowance_item_id and pricing_document_id = v_doc.id;
      if v_sell is null then
        return jsonb_build_object('ok', false, 'error', 'SELL_UNKNOWN');
      end if;
      v_sell_known := true;
    end if;
  elsif v_treatment = 'keep' then
    if v_mode <> 'replace' then
      return jsonb_build_object('ok', false, 'error', 'SELL_UNKNOWN');
    end if;
    if coalesce(v_item.total_cost, 0) <= 0 and coalesce(v_item.total_sell, 0) <= 0 then
      return jsonb_build_object('ok', false, 'error', 'SELL_UNKNOWN');
    end if;
    v_sell := round(coalesce(v_item.total_sell, 0), 2);
    v_sell_known := true;
  end if;

  if v_treatment <> 'keep' then
    if not (p_payload ? 'total_sell') or (p_payload->>'total_sell') is null then
      return jsonb_build_object('ok', false, 'error', 'SELL_TREATMENT');
    end if;
    v_sell := round((p_payload->>'total_sell')::numeric, 2);
    if v_sell < 0 then
      return jsonb_build_object('ok', false, 'error', 'SELL_TREATMENT');
    end if;
    v_sell_known := true;
  end if;
  if v_sell_known and v_cost > v_sell and coalesce(p_payload->>'acknowledge_loss', '') is distinct from 'true' then
    return jsonb_build_object('ok', false, 'error', 'LOSS_ACK');
  end if;

  v_gross := round(v_sell - v_cost, 2);
  if v_sell > 0 then
    v_margin := round(((v_sell - v_cost) / v_sell) * 100, 2);
    v_markup := case when v_cost > 0 then round(((v_sell - v_cost) / v_cost) * 100, 2) else 0 end;
  else
    v_margin := 0;
    v_markup := 0;
  end if;
  if abs(v_margin) > 999.99 or abs(v_markup) > 999.99 then
    return jsonb_build_object('ok', false, 'error', 'SELL_TREATMENT');
  end if;
  if p_payload ? 'gross_profit' and abs(coalesce((p_payload->>'gross_profit')::numeric, 0) - v_gross) > 0.02 then
    return jsonb_build_object('ok', false, 'error', 'SELL_TREATMENT');
  end if;
  if p_payload ? 'margin_percent' and abs(coalesce((p_payload->>'margin_percent')::numeric, 0) - v_margin) > 0.02 then
    return jsonb_build_object('ok', false, 'error', 'SELL_TREATMENT');
  end if;

  if v_has_active
    and v_active.rate_version_id = v_version.id
    and v_active.cost_ex_gst = v_cost
    and v_active.sell_ex_gst = v_sell
    and v_active.sell_treatment = v_treatment
    and v_active.quantity is not distinct from v_quantity
  then
    return jsonb_build_object('ok', true, 'alreadyApplied', true, 'applicationId', v_active.id, 'allowanceItemId', v_active.allowance_item_id);
  end if;

  if v_conflict then
    update public.pricing_items
    set total_cost = 0,
        total_sell = 0,
        unit_cost = null,
        unit_sell = null,
        gross_profit = 0,
        margin_percent = 0,
        markup_percent = 0,
        visible_on_quote = false,
        manually_edited = true,
        recalibration_note = 'A confirmed subcontractor rate replaced this response. The response is not also charged.'
    where id = v_rfq.allowance_item_id and pricing_document_id = v_doc.id and org_id = v_org;
    update public.rfq_pricing_applications
    set superseded_at = now()
    where id = v_rfq.id;
  end if;

  v_unit := left('Subcontract — ' || v_version.scope, 180);
  if v_has_active then
    v_allowance := v_active.allowance_item_id;
    v_before := v_active.before_lines;
    v_replaced := v_active.replaced_item_ids;
    update public.pricing_items
    set internal_label = v_unit,
        client_label = v_unit,
        internal_description = left(concat_ws(E'\n',
          'Supplier scope: ' || v_version.scope,
          'Job scope: ' || coalesce(v_area.summary, ''),
          case when v_quantity is null then 'Lump sum, used once.' else 'Quantity ' || v_quantity::text || ' ' || v_version.unit || ' at ' || v_version.cost_ex_gst::text || ' ex GST.' end,
          case when v_minimum_applied then 'Minimum charge applied once.' else null end,
          case when btrim(v_version.exclusions) <> '' then 'Exclusions: ' || v_version.exclusions else null end
        ), 2000),
        item_type = 'allowance',
        delivery_method = 'subcontracted',
        quantity = coalesce(v_quantity, 1),
        unit = v_version.unit,
        unit_cost = v_version.cost_ex_gst,
        unit_sell = case when coalesce(v_quantity, 1) = 0 then v_sell else round(v_sell / coalesce(v_quantity, 1), 2) end,
        total_cost = v_cost,
        total_sell = v_sell,
        gross_profit = v_gross,
        margin_percent = v_margin,
        markup_percent = v_markup,
        calculation_mode = 'lump_sum',
        visible_on_quote = true,
        manually_edited = true,
        work_area_id = v_area.id,
        recalibration_note = 'Supplier rate confirmed for this job. Later rate-book changes do not change this line.',
        notes_internal = 'Used for draft pricing from a confirmed subcontractor rate. This is not an award of work.'
    where id = v_allowance and pricing_document_id = v_doc.id and org_id = v_org;
    update public.subcontractor_rate_applications
    set superseded_at = now()
    where id = v_active.id;
  else
    if v_mode = 'replace' then
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', id,
        'total_cost', total_cost,
        'total_sell', total_sell,
        'unit_cost', unit_cost,
        'unit_sell', unit_sell,
        'gross_profit', gross_profit,
        'margin_percent', margin_percent,
        'markup_percent', markup_percent,
        'visible_on_quote', visible_on_quote,
        'manually_edited', manually_edited,
        'recalibration_note', recalibration_note
      )), '[]'::jsonb)
        into v_before
      from public.pricing_items
      where id = v_target and pricing_document_id = v_doc.id;
      v_replaced := array[v_target];
      update public.pricing_items
      set total_cost = 0,
          total_sell = 0,
          unit_cost = null,
          unit_sell = null,
          gross_profit = 0,
          margin_percent = 0,
          markup_percent = 0,
          visible_on_quote = false,
          manually_edited = true,
          recalibration_note = 'Replaced for draft pricing by a confirmed subcontractor rate. This is not an award.'
      where id = v_target and pricing_document_id = v_doc.id and org_id = v_org;
    end if;
    insert into public.pricing_items (
      org_id, pricing_document_id, project_id, work_area_id,
      item_type, delivery_method, internal_label, client_label, internal_description,
      quantity, unit, unit_cost, unit_sell, total_cost, total_sell,
      gross_profit, margin_percent, markup_percent, calculation_mode,
      visible_on_quote, optional, sort_order, manually_edited, recalibration_note, notes_internal
    )
    values (
      v_org, v_doc.id, v_doc.project_id, v_area.id,
      'allowance', 'subcontracted', v_unit, v_unit,
      left(concat_ws(E'\n',
        'Supplier scope: ' || v_version.scope,
        'Job scope: ' || coalesce(v_area.summary, ''),
        case when v_quantity is null then 'Lump sum, used once.' else 'Quantity ' || v_quantity::text || ' ' || v_version.unit || ' at ' || v_version.cost_ex_gst::text || ' ex GST.' end,
        case when v_minimum_applied then 'Minimum charge applied once.' else null end,
        case when btrim(v_version.exclusions) <> '' then 'Exclusions: ' || v_version.exclusions else null end
      ), 2000),
      coalesce(v_quantity, 1), v_version.unit, v_version.cost_ex_gst,
      case when coalesce(v_quantity, 1) = 0 then v_sell else round(v_sell / coalesce(v_quantity, 1), 2) end,
      v_cost, v_sell, v_gross, v_margin, v_markup, 'lump_sum',
      true, false,
      coalesce((select max(sort_order) + 1 from public.pricing_items where pricing_document_id = v_doc.id), 0),
      true,
      'Supplier rate confirmed for this job. Later rate-book changes do not change this line.',
      'Used for draft pricing from a confirmed subcontractor rate. This is not an award of work.'
    )
    returning id into v_allowance;
  end if;

  insert into public.subcontractor_rate_applications (
    org_id, project_id, pricing_document_id, work_area_id, subcontractor_id, rate_id, rate_version_id,
    version_number, scope, exclusions, job_scope, unit, quantity, unit_cost_ex_gst, minimum_charge_ex_gst,
    minimum_applied, cost_ex_gst, currency, effective_from, effective_until, sell_treatment, target_margin_percent,
    sell_ex_gst, loss_acknowledged, target_item_id, allowance_item_id, replaced_item_ids, before_lines,
    scope_confirmed, quantity_confirmed, applied_by
  )
  values (
    v_org, v_doc.project_id, v_doc.id, v_area.id, v_rate.subcontractor_id, v_rate.id, v_version.id,
    v_version.version_number, v_version.scope, v_version.exclusions, coalesce(v_area.summary, ''),
    v_version.unit, v_quantity, v_version.cost_ex_gst, v_version.minimum_charge,
    v_minimum_applied, v_cost, 'NZD', v_version.effective_from, v_version.effective_until, v_treatment,
    case when v_treatment = 'target_margin' then nullif(p_payload->>'target_margin_percent', '')::numeric else null end,
    v_sell, v_cost > v_sell,
    case
      when v_has_active then v_active.target_item_id
      when v_mode = 'replace' then v_target
      else null
    end,
    v_allowance, v_replaced, v_before, true, true, auth.uid()
  )
  returning id into v_application;

  update public.pricing_documents
  set status = 'draft', reviewed_at = null
  where id = v_doc.id and org_id = v_org;

  if coalesce(p_payload->>'force_fail', '') = 'true' then
    raise exception 'RATE_USE_FORCED';
  end if;

  return jsonb_build_object(
    'ok', true,
    'alreadyApplied', false,
    'applicationId', v_application,
    'allowanceItemId', v_allowance,
    'costExGst', v_cost,
    'sellExGst', v_sell,
    'minimumApplied', v_minimum_applied
  );
end;
$$;

revoke all on function public.apply_subcontractor_rate_to_pricing_v1(jsonb) from public, anon;
grant execute on function public.apply_subcontractor_rate_to_pricing_v1(jsonb) to authenticated;

create or replace function public.reconcile_subcontractor_rate_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
  v_app public.subcontractor_rate_applications%rowtype;
  v_line jsonb;
  v_decision text;
begin
  if auth.uid() is null or v_org is null or not public.auth_can_mutate_work() then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;
  if p_payload is null
    or coalesce(p_payload->>'application_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then
    return jsonb_build_object('ok', false, 'error', 'INVALID');
  end if;
  v_decision := p_payload->>'decision';
  if v_decision is null or v_decision not in ('keep', 'drop') then
    return jsonb_build_object('ok', false, 'error', 'INVALID');
  end if;
  select * into v_app
  from public.subcontractor_rate_applications
  where id = (p_payload->>'application_id')::uuid and org_id = v_org and superseded_at is null
  for update;
  if not found or v_app.reconciliation_status is distinct from 'pending' then
    return jsonb_build_object('ok', false, 'error', 'NOT_PENDING');
  end if;
  if exists (
    select 1 from public.quotes
    where pricing_document_id = v_app.pricing_document_id
      and org_id = v_org
      and status not in ('draft', 'archived')
  ) then
    return jsonb_build_object('ok', false, 'error', 'QUOTE_ISSUED');
  end if;

  if v_decision = 'keep' then
    update public.subcontractor_rate_applications
    set reconciliation_status = 'kept'
    where id = v_app.id;
    return jsonb_build_object('ok', true, 'decision', 'keep', 'allowanceItemId', v_app.allowance_item_id);
  end if;

  for v_line in select value from jsonb_array_elements(v_app.before_lines)
  loop
    update public.pricing_items
    set total_cost = (v_line->>'total_cost')::numeric,
        total_sell = (v_line->>'total_sell')::numeric,
        unit_cost = nullif(v_line->>'unit_cost', '')::numeric,
        unit_sell = nullif(v_line->>'unit_sell', '')::numeric,
        gross_profit = coalesce((v_line->>'gross_profit')::numeric, 0),
        margin_percent = coalesce((v_line->>'margin_percent')::numeric, 0),
        markup_percent = coalesce((v_line->>'markup_percent')::numeric, 0),
        visible_on_quote = coalesce((v_line->>'visible_on_quote')::boolean, true),
        manually_edited = false,
        recalibration_note = null
    where id = (v_line->>'id')::uuid
      and pricing_document_id = v_app.pricing_document_id
      and org_id = v_org;
  end loop;
  update public.pricing_items
  set total_cost = 0,
      total_sell = 0,
      visible_on_quote = false,
      manually_edited = true,
      recalibration_note = 'Supplier rate removed after the estimate was regenerated.'
  where id = v_app.allowance_item_id and pricing_document_id = v_app.pricing_document_id and org_id = v_org;
  update public.subcontractor_rate_applications
  set superseded_at = now(), reconciliation_status = 'dropped'
  where id = v_app.id;
  update public.pricing_documents
  set status = 'draft', reviewed_at = null
  where id = v_app.pricing_document_id and org_id = v_org;

  return jsonb_build_object('ok', true, 'decision', 'drop', 'allowanceItemId', v_app.allowance_item_id);
end;
$$;

revoke all on function public.reconcile_subcontractor_rate_v1(jsonb) from public, anon;
grant execute on function public.reconcile_subcontractor_rate_v1(jsonb) to authenticated;

notify pgrst, 'reload schema';
