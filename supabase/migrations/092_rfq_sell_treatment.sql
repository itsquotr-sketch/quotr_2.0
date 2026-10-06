-- The builder chooses the sell. Cost still comes from the submitted response.
-- A loss is stored only after acknowledge_loss. This does not add a review or quote block.

alter table public.rfq_pricing_applications
  add column if not exists sell_treatment text,
  add column if not exists target_margin_percent numeric(5, 2);

alter table public.rfq_pricing_applications
  drop constraint if exists rfq_pricing_applications_sell_treatment_known;

alter table public.rfq_pricing_applications
  add constraint rfq_pricing_applications_sell_treatment_known
  check (sell_treatment is null or sell_treatment in ('keep', 'target_margin', 'manual'));

create or replace function public.apply_rfq_response_to_pricing_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
  v_response_id uuid;
  v_document_id uuid;
  v_work_area_id uuid;
  v_replaced uuid[];
  v_response public.rfq_responses%rowtype;
  v_recipient public.rfq_recipients%rowtype;
  v_rfq public.rfqs%rowtype;
  v_doc public.pricing_documents%rowtype;
  v_active public.rfq_pricing_applications%rowtype;
  v_price numeric(12, 2);
  v_sell numeric(12, 2);
  v_line_sell numeric(12, 2);
  v_sell_known boolean;
  v_treatment text;
  v_scope text;
  v_label text;
  v_allowance uuid;
  v_application uuid;
  v_before jsonb;
  v_item_id uuid;
  v_line jsonb;
  v_gross numeric(12, 2);
  v_margin numeric(12, 2);
  v_markup numeric(12, 2);
  v_has_active boolean := false;
begin
  if auth.uid() is null or v_org is null or not public.auth_can_mutate_work() then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;
  if p_payload is null
    or coalesce(p_payload->>'response_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or coalesce(p_payload->>'pricing_document_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or coalesce(p_payload->>'work_area_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or jsonb_typeof(p_payload->'replaced_item_ids') <> 'array'
  then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  v_response_id := (p_payload->>'response_id')::uuid;
  v_document_id := (p_payload->>'pricing_document_id')::uuid;
  v_work_area_id := (p_payload->>'work_area_id')::uuid;
  select coalesce(array_agg(distinct value::uuid), '{}')
    into v_replaced
  from jsonb_array_elements_text(p_payload->'replaced_item_ids') as value
  where value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  if v_replaced is null or cardinality(v_replaced) = 0
    or cardinality(v_replaced) <> jsonb_array_length(p_payload->'replaced_item_ids')
  then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;

  select * into v_response from public.rfq_responses where id = v_response_id and org_id = v_org;
  if not found or v_response.status <> 'submitted' or v_response.price_ex_gst is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_response.valid_until is not null and v_response.valid_until < current_date then
    return jsonb_build_object('ok', false, 'error', 'EXPIRED');
  end if;
  if v_response.price_ex_gst > 9999999999.99 then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  v_price := round(v_response.price_ex_gst, 2);

  select * into v_recipient from public.rfq_recipients where id = v_response.recipient_id and org_id = v_org;
  if not found or v_recipient.response_state in ('declined', 'expired') then
    return jsonb_build_object('ok', false, 'error', 'NOT_APPLICABLE');
  end if;
  if not exists (
    select 1 from public.rfq_access_tokens
    where recipient_id = v_recipient.id and revoked_at is null
  ) then
    return jsonb_build_object('ok', false, 'error', 'REVOKED');
  end if;

  select * into v_rfq from public.rfqs where id = v_recipient.rfq_id and org_id = v_org and status = 'sent';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_rfq.scope_kind = 'work_area' and v_rfq.work_area_id is distinct from v_work_area_id then
    return jsonb_build_object('ok', false, 'error', 'WORK_AREA');
  end if;
  if not exists (
    select 1 from public.work_areas
    where id = v_work_area_id and project_id = v_rfq.project_id and org_id = v_org and status <> 'excluded'
  ) then
    return jsonb_build_object('ok', false, 'error', 'WORK_AREA');
  end if;

  select * into v_doc
  from public.pricing_documents
  where id = v_document_id and org_id = v_org and project_id = v_rfq.project_id
  for update;
  if not found or v_doc.status not in ('draft', 'reviewed', 'converted_to_quote') then
    return jsonb_build_object('ok', false, 'error', 'PRICING_CLOSED');
  end if;
  if (
    select count(*) from public.pricing_items
    where id = any(v_replaced)
      and pricing_document_id = v_doc.id
      and org_id = v_org
      and work_area_id = v_work_area_id
  ) <> cardinality(v_replaced) then
    return jsonb_build_object('ok', false, 'error', 'LINES');
  end if;

  select * into v_active
  from public.rfq_pricing_applications
  where pricing_document_id = v_doc.id
    and work_area_id = v_work_area_id
    and superseded_at is null
  for update;
  v_has_active := found;
  if v_has_active and v_active.response_id = v_response.id then
    return jsonb_build_object(
      'ok', true,
      'alreadyApplied', true,
      'applicationId', v_active.id,
      'allowanceItemId', v_active.allowance_item_id
    );
  end if;
  if exists (
    select 1 from public.rfq_pricing_applications
    where allowance_item_id = any(v_replaced) and superseded_at is null
  ) then
    return jsonb_build_object('ok', false, 'error', 'LINES');
  end if;

  v_treatment := p_payload->>'sell_treatment';
  if v_treatment is null or v_treatment not in ('keep', 'target_margin', 'manual') then
    return jsonb_build_object('ok', false, 'error', 'SELL_TREATMENT');
  end if;
  if v_has_active then
    select coalesce(bool_and(not (coalesce((value->>'total_cost')::numeric, 0) <= 0 and coalesce((value->>'total_sell')::numeric, 0) <= 0)), false),
           coalesce(round(sum((value->>'total_sell')::numeric), 2), 0)
      into v_sell_known, v_line_sell
    from jsonb_array_elements(v_active.before_lines) as value
    where (value->>'id')::uuid = any(v_replaced);
  else
    select coalesce(bool_and(not (coalesce(total_cost, 0) <= 0 and coalesce(total_sell, 0) <= 0)), false),
           coalesce(round(sum(total_sell), 2), 0)
      into v_sell_known, v_line_sell
    from public.pricing_items
    where id = any(v_replaced) and pricing_document_id = v_doc.id;
  end if;
  if v_treatment = 'keep' then
    if not v_sell_known then
      return jsonb_build_object('ok', false, 'error', 'SELL_UNKNOWN');
    end if;
    v_sell := v_line_sell;
  else
    if not (p_payload ? 'total_sell') or (p_payload->>'total_sell') is null then
      return jsonb_build_object('ok', false, 'error', 'SELL_TREATMENT');
    end if;
    v_sell := round((p_payload->>'total_sell')::numeric, 2);
    if v_sell < 0 then
      return jsonb_build_object('ok', false, 'error', 'SELL_TREATMENT');
    end if;
    v_sell_known := true;
  end if;
  if v_sell_known and v_price > v_sell and coalesce(p_payload->>'acknowledge_loss', '') is distinct from 'true' then
    return jsonb_build_object('ok', false, 'error', 'LOSS_ACK');
  end if;
  if p_payload ? 'total_cost' and abs(coalesce((p_payload->>'total_cost')::numeric, -1) - v_price) > 0.001 then
    raise exception 'RFQ_COST_MISMATCH';
  end if;
  if p_payload ? 'total_sell' and abs(coalesce((p_payload->>'total_sell')::numeric, -1) - v_sell) > 0.001 then
    raise exception 'RFQ_SELL_MISMATCH';
  end if;

  if v_has_active then
    for v_line in select value from jsonb_array_elements(v_active.before_lines)
    loop
      v_item_id := (v_line->>'id')::uuid;
      update public.pricing_items
      set total_cost = (v_line->>'total_cost')::numeric,
          total_sell = (v_line->>'total_sell')::numeric,
          unit_cost = nullif(v_line->>'unit_cost', '')::numeric,
          unit_sell = nullif(v_line->>'unit_sell', '')::numeric,
          gross_profit = coalesce((v_line->>'gross_profit')::numeric, 0),
          margin_percent = coalesce((v_line->>'margin_percent')::numeric, 0),
          markup_percent = coalesce((v_line->>'markup_percent')::numeric, 0),
          visible_on_quote = coalesce((v_line->>'visible_on_quote')::boolean, true),
          manually_edited = coalesce((v_line->>'manually_edited')::boolean, false),
          recalibration_note = nullif(v_line->>'recalibration_note', '')
      where id = v_item_id and pricing_document_id = v_doc.id and org_id = v_org;
    end loop;
  end if;

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
  where id = any(v_replaced) and pricing_document_id = v_doc.id;

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
      recalibration_note = 'Replaced for draft pricing by a subcontract response. This is not an award.'
  where id = any(v_replaced) and pricing_document_id = v_doc.id and org_id = v_org;

  v_scope := case when v_rfq.scope_kind = 'work_area' then coalesce(nullif(v_rfq.work_area_name, ''), 'Requested work')
                  else coalesce(nullif(v_rfq.written_scope_label, ''), 'Requested work') end;
  v_label := left(
    case when v_response.pricing_structure = 'itemised'
      then 'Subcontract — ' || v_scope
      else 'Subcontract allowance — ' || v_scope
    end,
    180
  );
  v_gross := round(v_sell - v_price, 2);
  if v_sell > 0 then
    v_margin := round(((v_sell - v_price) / v_sell) * 100, 2);
    v_markup := case when v_price > 0 then round(((v_sell - v_price) / v_price) * 100, 2) else 0 end;
  else
    v_margin := 0;
    v_markup := 0;
  end if;
  if p_payload ? 'gross_profit' then
    if abs(coalesce((p_payload->>'gross_profit')::numeric, 0) - v_gross) > 0.02 then
      raise exception 'RFQ_SELL_MISMATCH';
    end if;
    v_gross := round(coalesce((p_payload->>'gross_profit')::numeric, v_gross), 2);
    v_margin := round(coalesce((p_payload->>'margin_percent')::numeric, v_margin), 2);
    v_markup := round(coalesce((p_payload->>'markup_percent')::numeric, v_markup), 2);
  end if;
  if abs(v_margin) > 999.99 or abs(v_markup) > 999.99 then
    raise exception 'RFQ_SELL_MISMATCH';
  end if;

  if v_has_active then
    v_allowance := v_active.allowance_item_id;
    update public.pricing_items
    set internal_label = v_label,
        client_label = v_label,
        internal_description = left(concat_ws(E'\n', nullif(v_response.included_scope, ''), nullif(v_response.excluded_scope, '')), 2000),
        item_type = 'allowance',
        delivery_method = 'subcontracted',
        quantity = 1,
        unit = 'allowance',
        unit_cost = v_price,
        unit_sell = v_sell,
        total_cost = v_price,
        total_sell = v_sell,
        gross_profit = v_gross,
        margin_percent = v_margin,
        markup_percent = v_markup,
        calculation_mode = 'lump_sum',
        visible_on_quote = true,
        manually_edited = true,
        work_area_id = v_work_area_id,
        notes_internal = 'Used for draft pricing from a subcontractor response. This is not an award of work.'
          || E'\n__quotr_meta__:'
          || jsonb_build_object('rfqId', v_rfq.id, 'rfqResponseId', v_response.id, 'pricingSource', 'user_override', 'sellKnown', v_sell_known)::text
    where id = v_allowance and pricing_document_id = v_doc.id and org_id = v_org;
    update public.rfq_pricing_applications
    set superseded_at = now()
    where id = v_active.id;
  else
    insert into public.pricing_items (
      org_id, pricing_document_id, project_id, work_area_id,
      item_type, delivery_method, internal_label, client_label, internal_description,
      quantity, unit, unit_cost, unit_sell, total_cost, total_sell,
      gross_profit, margin_percent, markup_percent, calculation_mode,
      visible_on_quote, optional, sort_order, manually_edited, notes_internal
    )
    values (
      v_org, v_doc.id, v_rfq.project_id, v_work_area_id,
      'allowance', 'subcontracted', v_label, v_label,
      left(concat_ws(E'\n', nullif(v_response.included_scope, ''), nullif(v_response.excluded_scope, '')), 2000),
      1, 'allowance', v_price, v_sell, v_price, v_sell,
      v_gross, v_margin, v_markup, 'lump_sum',
      true, false,
      coalesce((select max(sort_order) + 1 from public.pricing_items where pricing_document_id = v_doc.id), 0),
      true,
      'Used for draft pricing from a subcontractor response. This is not an award of work.'
        || E'\n__quotr_meta__:'
        || jsonb_build_object('rfqId', v_rfq.id, 'rfqResponseId', v_response.id, 'pricingSource', 'user_override', 'sellKnown', v_sell_known)::text
    )
    returning id into v_allowance;
  end if;

  insert into public.rfq_pricing_applications (
    org_id, project_id, pricing_document_id, rfq_id, recipient_id, response_id,
    subcontractor_id, work_area_id, allowance_item_id, replaced_item_ids, before_lines,
    cost_ex_gst, sell_ex_gst, sell_known, sell_treatment, target_margin_percent, currency, gst_treatment, pricing_structure,
    scope_label, included_scope, excluded_scope, assumptions, applied_by
  )
  values (
    v_org, v_rfq.project_id, v_doc.id, v_rfq.id, v_recipient.id, v_response.id,
    v_recipient.subcontractor_id, v_work_area_id, v_allowance, v_replaced, v_before,
    v_price, v_sell, v_sell_known, v_treatment,
    case when v_treatment = 'target_margin' then nullif(p_payload->>'target_margin_percent', '')::numeric else null end,
    'NZD', coalesce(v_response.gst_treatment, 'unknown'),
    coalesce(v_response.pricing_structure, 'lump_sum'), v_scope,
    v_response.included_scope, v_response.excluded_scope, v_response.assumptions, auth.uid()
  )
  returning id into v_application;

  update public.pricing_documents
  set status = 'draft', reviewed_at = null
  where id = v_doc.id and org_id = v_org;

  insert into public.rfq_events (org_id, rfq_id, recipient_id, kind, summary, actor, created_by)
  values (
    v_org, v_rfq.id, v_recipient.id, 'pricing_applied',
    'Response used for draft pricing. The subcontractor was not notified.',
    'member', auth.uid()
  );

  if coalesce(p_payload->>'force_fail', '') = 'true' then
    raise exception 'RFQ_APPLY_FORCED';
  end if;

  return jsonb_build_object(
    'ok', true,
    'alreadyApplied', false,
    'applicationId', v_application,
    'allowanceItemId', v_allowance,
    'costExGst', v_price,
    'sellExGst', v_sell,
    'sellKnown', v_sell_known,
    'currency', 'NZD',
    'gstTreatment', coalesce(v_response.gst_treatment, 'unknown')
  );
end;
$$;

revoke all on function public.apply_rfq_response_to_pricing_v1(jsonb) from public, anon;
grant execute on function public.apply_rfq_response_to_pricing_v1(jsonb) to authenticated;

notify pgrst, 'reload schema';
