-- Apply selected submitted schedule lines to draft pricing.
-- Authority:
--   Frozen schedule quantity, unit, and row identity.
--   Submitted unit price and server amount_ex_gst. A lump sum is one amount.
--   Supplier GST treatment is stored as evidence. Document GST is unchanged.
--   Cost is the server extended amount. Sell is the explicit keep, target, or manual choice.
--   One active charged pricing item per selected schedule row.
-- This does not award work, notify the subcontractor, or change an estimate,
-- issued quote, accepted snapshot, or variation.

create table if not exists public.rfq_schedule_pricing_applications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  pricing_document_id uuid not null references public.pricing_documents (id) on delete cascade,
  work_area_id uuid not null references public.work_areas (id) on delete restrict,
  rfq_id uuid not null references public.rfqs (id) on delete cascade,
  recipient_id uuid not null references public.rfq_recipients (id) on delete cascade,
  response_id uuid not null references public.rfq_responses (id) on delete restrict,
  response_version integer not null,
  request_sent_at timestamptz not null,
  schedule_item_id uuid not null references public.rfq_schedule_items (id) on delete restrict,
  response_line_id uuid not null references public.rfq_response_lines (id) on delete restrict,
  line_role text not null,
  scope text not null,
  specification text not null default '',
  quantity numeric(14, 4),
  unit text not null,
  unit_price_ex_gst numeric(12, 2),
  cost_ex_gst numeric(12, 2) not null,
  qualification text not null default '',
  excluded_scope text not null default '',
  completeness text,
  client_label text not null,
  sell_treatment text not null,
  target_margin_percent numeric(5, 2),
  sell_ex_gst numeric(12, 2) not null,
  sell_known boolean not null,
  loss_acknowledged boolean not null default false,
  qualification_acknowledged boolean not null default false,
  alternative_acknowledged boolean not null default false,
  scope_confirmed boolean not null,
  source_choice text not null default 'schedule',
  allowance_item_id uuid not null references public.pricing_items (id) on delete restrict,
  replaced_item_ids uuid[] not null default '{}',
  before_lines jsonb not null default '[]'::jsonb,
  gst_treatment text not null default 'unknown',
  currency text not null default 'NZD',
  applied_by uuid references public.profiles (id) on delete set null,
  applied_at timestamptz not null default now(),
  superseded_at timestamptz,
  constraint rfq_schedule_pricing_role_known check (line_role in ('required', 'optional', 'alternative')),
  constraint rfq_schedule_pricing_unit_known check (unit in ('lump_sum', 'm2', 'm', 'item', 'hour')),
  constraint rfq_schedule_pricing_sell_known check (sell_treatment in ('keep', 'target_margin', 'manual')),
  constraint rfq_schedule_pricing_completeness_known check (completeness is null or completeness in ('complete', 'partial')),
  constraint rfq_schedule_pricing_gst_known check (gst_treatment in ('extra', 'none', 'unknown')),
  constraint rfq_schedule_pricing_currency_nzd check (currency = 'NZD'),
  constraint rfq_schedule_pricing_source_known check (source_choice in ('schedule', 'rate', 'allowance')),
  constraint rfq_schedule_pricing_money check (cost_ex_gst >= 0 and sell_ex_gst >= 0),
  constraint rfq_schedule_pricing_quantity check (
    (unit = 'lump_sum' and quantity is null)
    or (unit <> 'lump_sum' and quantity is not null and quantity > 0)
  )
);

create unique index if not exists rfq_schedule_pricing_one_active_item_uidx
  on public.rfq_schedule_pricing_applications (pricing_document_id, schedule_item_id)
  where superseded_at is null;

create unique index if not exists rfq_schedule_pricing_one_active_allowance_uidx
  on public.rfq_schedule_pricing_applications (allowance_item_id)
  where superseded_at is null;

create index if not exists rfq_schedule_pricing_rfq_idx
  on public.rfq_schedule_pricing_applications (rfq_id, applied_at desc);

alter table public.rfq_schedule_pricing_applications enable row level security;

drop policy if exists rfq_schedule_pricing_select on public.rfq_schedule_pricing_applications;
create policy rfq_schedule_pricing_select
  on public.rfq_schedule_pricing_applications for select
  using (org_id = public.auth_org_id());

revoke all on public.rfq_schedule_pricing_applications from public, anon;
grant select on public.rfq_schedule_pricing_applications to authenticated;

comment on table public.rfq_schedule_pricing_applications is
  'One selected schedule line used on draft pricing. Not an award and not a subcontractor notification.';

create or replace function public.guard_supplier_rate_pricing_item()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('quotr.supplier_rate_write', true), '') = 'apply' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    if exists (
      select 1 from public.subcontractor_rate_applications a
      where a.allowance_item_id = old.id and a.superseded_at is null
    ) or exists (
      select 1 from public.rfq_schedule_pricing_applications a
      where a.allowance_item_id = old.id and a.superseded_at is null
    ) then
      raise exception 'SUPPLIER_PRICE_LOCKED';
    end if;
    return old;
  end if;
  if not exists (
    select 1 from public.subcontractor_rate_applications a
    where a.allowance_item_id = new.id and a.superseded_at is null
  ) and not exists (
    select 1 from public.rfq_schedule_pricing_applications a
    where a.allowance_item_id = new.id and a.superseded_at is null
  ) then
    return new;
  end if;
  if new.quantity is distinct from old.quantity
    or new.unit is distinct from old.unit
    or new.unit_cost is distinct from old.unit_cost
    or new.unit_sell is distinct from old.unit_sell
    or new.total_cost is distinct from old.total_cost
    or new.total_sell is distinct from old.total_sell
    or new.gross_profit is distinct from old.gross_profit
    or new.margin_percent is distinct from old.margin_percent
    or new.markup_percent is distinct from old.markup_percent
    or new.calculation_mode is distinct from old.calculation_mode
    or new.item_type is distinct from old.item_type
    or new.delivery_method is distinct from old.delivery_method
    or new.work_area_id is distinct from old.work_area_id
    or new.visible_on_quote is distinct from old.visible_on_quote
    or new.optional is distinct from old.optional
    or new.productivity_rate is distinct from old.productivity_rate
    or new.productivity_unit is distinct from old.productivity_unit
    or new.calculated_quantity is distinct from old.calculated_quantity
  then
    raise exception 'SUPPLIER_PRICE_LOCKED';
  end if;
  return new;
end;
$$;

create or replace function public.apply_rfq_schedule_lines_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
  v_response public.rfq_responses%rowtype;
  v_recipient public.rfq_recipients%rowtype;
  v_rfq public.rfqs%rowtype;
  v_doc public.pricing_documents%rowtype;
  v_sent timestamptz;
  v_row jsonb;
  v_item public.rfq_schedule_items%rowtype;
  v_line public.rfq_response_lines%rowtype;
  v_existing public.rfq_schedule_pricing_applications%rowtype;
  v_target public.pricing_items%rowtype;
  v_plan jsonb := '[]'::jsonb;
  v_seen uuid[] := '{}';
  v_replaced_seen uuid[] := '{}';
  v_replaced uuid[];
  v_mode text;
  v_treatment text;
  v_cost numeric(12, 2);
  v_sell numeric(12, 2);
  v_known boolean;
  v_line_sell numeric(12, 2);
  v_gross numeric(12, 2);
  v_margin numeric(12, 2);
  v_markup numeric(12, 2);
  v_label text;
  v_before jsonb;
  v_all_same boolean := true;
  v_wrote boolean := false;
  v_entry jsonb;
  v_allowance uuid;
  v_application uuid;
  v_results jsonb := '[]'::jsonb;
  v_id uuid;
  v_rate_ids uuid[] := '{}';
  v_lump_ids uuid[] := '{}';
  v_has_required boolean := false;
  v_has_existing boolean := false;
begin
  perform set_config('quotr.supplier_rate_write', 'apply', true);
  if auth.uid() is null or v_org is null or not public.auth_can_mutate_work() then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;
  if p_payload is null
    or coalesce(p_payload->>'response_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or coalesce(p_payload->>'pricing_document_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or coalesce(p_payload->>'work_area_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or jsonb_typeof(p_payload->'rows') <> 'array'
    or jsonb_array_length(p_payload->'rows') = 0
  then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;

  begin
    v_sent := (p_payload->>'request_sent_at')::timestamptz;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'STALE');
  end;

  select * into v_response
  from public.rfq_responses
  where id = (p_payload->>'response_id')::uuid and org_id = v_org;
  if not found or v_response.status <> 'submitted' then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_response.valid_until is not null and v_response.valid_until < current_date then
    return jsonb_build_object('ok', false, 'error', 'EXPIRED');
  end if;
  if v_response.request_sent_at is distinct from v_sent then
    return jsonb_build_object('ok', false, 'error', 'STALE');
  end if;

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
  if not found or v_rfq.pricing_request <> 'schedule' or v_rfq.sent_at is distinct from v_sent then
    return jsonb_build_object('ok', false, 'error', 'STALE');
  end if;
  if v_rfq.scope_kind = 'work_area' and v_rfq.work_area_id is distinct from (p_payload->>'work_area_id')::uuid then
    return jsonb_build_object('ok', false, 'error', 'WORK_AREA');
  end if;
  if not exists (
    select 1 from public.work_areas
    where id = (p_payload->>'work_area_id')::uuid
      and project_id = v_rfq.project_id and org_id = v_org and status <> 'excluded'
  ) then
    return jsonb_build_object('ok', false, 'error', 'WORK_AREA');
  end if;

  select * into v_doc
  from public.pricing_documents
  where id = (p_payload->>'pricing_document_id')::uuid
    and org_id = v_org and project_id = v_rfq.project_id
  for update;
  if not found or v_doc.status = 'archived' then
    return jsonb_build_object('ok', false, 'error', 'PRICING_CLOSED');
  end if;
  if v_doc.status = 'converted_to_quote'
    or exists (
      select 1 from public.quotes
      where pricing_document_id = v_doc.id and org_id = v_org and status not in ('draft', 'archived')
    )
  then
    return jsonb_build_object('ok', false, 'error', 'QUOTE_ISSUED');
  end if;
  if v_doc.status not in ('draft', 'reviewed') then
    return jsonb_build_object('ok', false, 'error', 'PRICING_CLOSED');
  end if;

  select exists (
    select 1
    from public.rfq_schedule_pricing_applications a
    join public.rfq_schedule_items s on s.id = a.schedule_item_id
    where a.pricing_document_id = v_doc.id and a.superseded_at is null and s.line_role = 'required'
  ) into v_has_required;

  for v_row in select value from jsonb_array_elements(p_payload->'rows')
  loop
    if coalesce(v_row->>'schedule_item_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
    end if;
    if (v_row->>'schedule_item_id')::uuid = any(v_seen) then
      return jsonb_build_object('ok', false, 'error', 'DUPLICATE_ROW');
    end if;
    v_seen := v_seen || (v_row->>'schedule_item_id')::uuid;

    select * into v_item
    from public.rfq_schedule_items
    where id = (v_row->>'schedule_item_id')::uuid and rfq_id = v_rfq.id and org_id = v_org;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
    end if;
    select * into v_line
    from public.rfq_response_lines
    where response_id = v_response.id and schedule_item_id = v_item.id;
    if not found or v_line.decision <> 'priced' or v_line.amount_ex_gst is null then
      return jsonb_build_object('ok', false, 'error', 'NOT_PRICED');
    end if;
    v_cost := round(v_line.amount_ex_gst, 2);
    if v_row ? 'total_cost' and abs(coalesce((v_row->>'total_cost')::numeric, -1) - v_cost) > 0.001 then
      raise exception 'RFQ_COST_MISMATCH';
    end if;
    if coalesce(v_row->>'scope_confirmed', '') is distinct from 'true' then
      return jsonb_build_object('ok', false, 'error', 'CONFIRM_SCOPE');
    end if;
    if btrim(coalesce(v_line.qualification, '')) <> '' and coalesce(v_row->>'qualification_acknowledged', '') is distinct from 'true' then
      return jsonb_build_object('ok', false, 'error', 'QUALIFICATION');
    end if;
    if v_item.line_role = 'alternative'
      and (
        v_has_required
        or exists (
          select 1 from jsonb_array_elements(p_payload->'rows') other
          join public.rfq_schedule_items other_item on other_item.id = (other->>'schedule_item_id')::uuid
          where other_item.line_role = 'required'
        )
      )
      and coalesce(v_row->>'acknowledge_alternative', '') is distinct from 'true'
    then
      return jsonb_build_object('ok', false, 'error', 'ALTERNATIVE');
    end if;

    v_mode := v_row->>'mode';
    if v_mode is null or v_mode not in ('replace', 'add') then
      return jsonb_build_object('ok', false, 'error', 'AMBIGUOUS');
    end if;
    if v_mode = 'add' then
      v_replaced := '{}';
    else
      if jsonb_typeof(v_row->'replaced_item_ids') <> 'array' or jsonb_array_length(v_row->'replaced_item_ids') = 0 then
        return jsonb_build_object('ok', false, 'error', 'AMBIGUOUS');
      end if;
      select coalesce(array_agg(distinct value::uuid), '{}')
        into v_replaced
      from jsonb_array_elements_text(v_row->'replaced_item_ids') as value
      where value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
      if cardinality(v_replaced) <> jsonb_array_length(v_row->'replaced_item_ids') then
        return jsonb_build_object('ok', false, 'error', 'AMBIGUOUS');
      end if;
    end if;
    if exists (select 1 from unnest(v_replaced) id where id = any(v_replaced_seen)) then
      return jsonb_build_object('ok', false, 'error', 'AMBIGUOUS');
    end if;
    v_replaced_seen := v_replaced_seen || v_replaced;

    if cardinality(v_replaced) > 0 and (
      select count(*) from public.pricing_items
      where id = any(v_replaced)
        and pricing_document_id = v_doc.id
        and org_id = v_org
        and work_area_id = (p_payload->>'work_area_id')::uuid
    ) <> cardinality(v_replaced) then
      return jsonb_build_object('ok', false, 'error', 'WORK_AREA');
    end if;
    if exists (
      select 1 from public.pricing_items
      where id = any(v_replaced)
        and unit is not null
        and unit not in ('allowance', v_item.unit)
    ) then
      return jsonb_build_object('ok', false, 'error', 'UNIT');
    end if;

    select * into v_existing
    from public.rfq_schedule_pricing_applications
    where pricing_document_id = v_doc.id
      and schedule_item_id = v_item.id
      and superseded_at is null
    for update;
    v_has_existing := found;
    v_label := left(coalesce(nullif(btrim(v_row->>'client_label'), ''), v_item.scope), 180);
    if v_has_existing and v_existing.response_id = v_response.id
      and v_existing.response_line_id = v_line.id
      and v_existing.cost_ex_gst = v_cost
      and v_existing.sell_treatment = coalesce(v_row->>'sell_treatment', '')
      and v_existing.client_label = v_label
      and v_existing.replaced_item_ids @> v_replaced
      and v_replaced @> v_existing.replaced_item_ids
      and (
        not (v_row ? 'total_sell')
        or abs(coalesce((v_row->>'total_sell')::numeric, -1) - v_existing.sell_ex_gst) <= 0.001
      )
    then
      v_plan := v_plan || jsonb_build_array(jsonb_build_object('idempotent', true, 'allowance_item_id', v_existing.allowance_item_id, 'application_id', v_existing.id));
      continue;
    end if;
    v_all_same := false;

    if exists (
      select 1 from public.subcontractor_rate_applications
      where pricing_document_id = v_doc.id and superseded_at is null and allowance_item_id = any(v_replaced)
    ) or exists (
      select 1 from public.rfq_pricing_applications
      where pricing_document_id = v_doc.id and superseded_at is null
        and (allowance_item_id = any(v_replaced) or replaced_item_ids && v_replaced)
    ) or (
      v_mode = 'add' and (
        exists (
          select 1 from public.subcontractor_rate_applications
          where pricing_document_id = v_doc.id and work_area_id = (p_payload->>'work_area_id')::uuid and superseded_at is null
        ) or exists (
          select 1 from public.rfq_pricing_applications
          where pricing_document_id = v_doc.id and work_area_id = (p_payload->>'work_area_id')::uuid and superseded_at is null
        )
      )
    ) then
      if coalesce(v_row->>'acknowledge_source', '') is distinct from 'true' then
        return jsonb_build_object('ok', false, 'error', 'SOURCE');
      end if;
    end if;

    v_treatment := v_row->>'sell_treatment';
    if v_treatment is null or v_treatment not in ('keep', 'target_margin', 'manual') then
      return jsonb_build_object('ok', false, 'error', 'SELL_TREATMENT');
    end if;
    if v_mode = 'add' or cardinality(v_replaced) = 0 then
      v_known := false;
      v_line_sell := 0;
    else
      select coalesce(bool_and(not (coalesce(total_cost, 0) <= 0 and coalesce(total_sell, 0) <= 0)), false),
             coalesce(round(sum(total_sell), 2), 0)
        into v_known, v_line_sell
      from public.pricing_items
      where id = any(v_replaced) and pricing_document_id = v_doc.id;
    end if;
    if v_treatment = 'keep' then
      if not v_known then
        return jsonb_build_object('ok', false, 'error', 'SELL_UNKNOWN');
      end if;
      v_sell := v_line_sell;
    else
      if not (v_row ? 'total_sell') or (v_row->>'total_sell') is null then
        return jsonb_build_object('ok', false, 'error', 'SELL_TREATMENT');
      end if;
      v_sell := round((v_row->>'total_sell')::numeric, 2);
      if v_sell < 0 then
        return jsonb_build_object('ok', false, 'error', 'SELL_TREATMENT');
      end if;
      v_known := true;
    end if;
    if v_known and v_cost > v_sell and coalesce(v_row->>'acknowledge_loss', '') is distinct from 'true' then
      return jsonb_build_object('ok', false, 'error', 'LOSS_ACK');
    end if;
    if v_row ? 'total_sell' and abs(coalesce((v_row->>'total_sell')::numeric, -1) - v_sell) > 0.001 then
      raise exception 'RFQ_SELL_MISMATCH';
    end if;
    v_gross := round(v_sell - v_cost, 2);
    if v_sell > 0 then
      v_margin := round(((v_sell - v_cost) / v_sell) * 100, 2);
      v_markup := case when v_cost > 0 then round(((v_sell - v_cost) / v_cost) * 100, 2) else 0 end;
    else
      v_margin := 0;
      v_markup := 0;
    end if;
    if v_row ? 'gross_profit' and abs(coalesce((v_row->>'gross_profit')::numeric, 0) - v_gross) > 0.02 then
      raise exception 'RFQ_SELL_MISMATCH';
    end if;
    if abs(v_margin) > 999.99 or abs(v_markup) > 999.99 then
      raise exception 'RFQ_SELL_MISMATCH';
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'total_cost', total_cost, 'total_sell', total_sell,
      'unit_cost', unit_cost, 'unit_sell', unit_sell,
      'gross_profit', gross_profit, 'margin_percent', margin_percent, 'markup_percent', markup_percent,
      'visible_on_quote', visible_on_quote
    )), '[]'::jsonb)
      into v_before
    from public.pricing_items
    where id = any(v_replaced) and pricing_document_id = v_doc.id;

    select coalesce(array_agg(id), '{}') into v_rate_ids
      from public.subcontractor_rate_applications
      where pricing_document_id = v_doc.id and superseded_at is null and allowance_item_id = any(v_replaced);
      select coalesce(array_agg(id), '{}') into v_lump_ids
      from public.rfq_pricing_applications
      where pricing_document_id = v_doc.id and superseded_at is null
        and (allowance_item_id = any(v_replaced) or replaced_item_ids && v_replaced);
      v_plan := v_plan || jsonb_build_array(jsonb_build_object(
        'idempotent', false,
        'schedule_item_id', v_item.id,
        'response_line_id', v_line.id,
        'role', v_item.line_role,
        'scope', v_item.scope,
        'specification', coalesce(v_item.specification, ''),
        'quantity', v_item.quantity,
        'unit', v_item.unit,
        'unit_price', v_line.unit_price_ex_gst,
        'cost', v_cost,
        'qualification', coalesce(v_line.qualification, ''),
        'label', v_label,
        'treatment', v_treatment,
        'sell', v_sell,
        'sell_known', v_known,
        'gross', v_gross,
        'margin', v_margin,
        'markup', v_markup,
        'target_margin', case when v_treatment = 'target_margin' then nullif(v_row->>'target_margin_percent', '')::numeric else null end,
        'loss', v_known and v_cost > v_sell,
        'qualification_ack', coalesce(v_row->>'qualification_acknowledged', '') = 'true',
        'alternative_ack', coalesce(v_row->>'acknowledge_alternative', '') = 'true',
        'replaced', to_jsonb(v_replaced),
        'before', v_before,
        'existing_application_id', v_existing.id,
        'existing_allowance_id', v_existing.allowance_item_id,
        'rate_ids', to_jsonb(v_rate_ids),
        'lump_ids', to_jsonb(v_lump_ids)
      ));
  end loop;

  if v_all_same then
    return jsonb_build_object('ok', true, 'alreadyApplied', true, 'rows', v_plan);
  end if;

  for v_entry in select value from jsonb_array_elements(v_plan)
  loop
    if coalesce((v_entry->>'idempotent')::boolean, false) then
      v_results := v_results || jsonb_build_array(v_entry);
      continue;
    end if;
    if jsonb_typeof(v_entry->'rate_ids') = 'array' and jsonb_array_length(v_entry->'rate_ids') > 0 then
      update public.subcontractor_rate_applications
      set superseded_at = now()
      where id in (select value::uuid from jsonb_array_elements_text(v_entry->'rate_ids'));
    end if;
    if jsonb_typeof(v_entry->'lump_ids') = 'array' and jsonb_array_length(v_entry->'lump_ids') > 0 then
      update public.rfq_pricing_applications
      set superseded_at = now()
      where id in (select value::uuid from jsonb_array_elements_text(v_entry->'lump_ids'));
    end if;

    v_allowance := nullif(v_entry->>'existing_allowance_id', '')::uuid;
    update public.pricing_items
    set total_cost = 0, total_sell = 0, unit_cost = null, unit_sell = null,
        gross_profit = 0, margin_percent = 0, markup_percent = 0,
        visible_on_quote = false, manually_edited = true,
        recalibration_note = 'Replaced for draft pricing by a selected schedule price. This is not an award.'
    where pricing_document_id = v_doc.id
      and org_id = v_org
      and id in (select value::uuid from jsonb_array_elements_text(v_entry->'replaced'))
      and id is distinct from v_allowance;

    if v_allowance is null then
      insert into public.pricing_items (
        org_id, pricing_document_id, project_id, work_area_id,
        item_type, delivery_method, internal_label, client_label, client_description,
        quantity, unit, unit_cost, unit_sell, total_cost, total_sell,
        gross_profit, margin_percent, markup_percent, calculation_mode,
        visible_on_quote, optional, sort_order, manually_edited, notes_internal
      )
      values (
        v_org, v_doc.id, v_rfq.project_id, (p_payload->>'work_area_id')::uuid,
        'allowance', 'subcontracted', v_entry->>'label', v_entry->>'label',
        left(concat_ws(E'\n', nullif(v_entry->>'scope', ''), nullif(v_entry->>'specification', '')), 2000),
        1, 'allowance', (v_entry->>'cost')::numeric, (v_entry->>'sell')::numeric,
        (v_entry->>'cost')::numeric, (v_entry->>'sell')::numeric,
        (v_entry->>'gross')::numeric, (v_entry->>'margin')::numeric, (v_entry->>'markup')::numeric,
        'lump_sum', true, false,
        coalesce((select max(sort_order) + 1 from public.pricing_items where pricing_document_id = v_doc.id), 0),
        true,
        'Used for draft pricing from a selected schedule price. This is not an award of work.'
          || E'\n__quotr_meta__:'
          || jsonb_build_object(
            'rfqId', v_rfq.id,
            'rfqResponseId', v_response.id,
            'scheduleItemId', v_entry->>'schedule_item_id',
            'pricingSource', 'user_override',
            'sellKnown', (v_entry->>'sell_known')::boolean
          )::text
      )
      returning id into v_allowance;
    else
      update public.pricing_items
      set internal_label = v_entry->>'label',
          client_label = v_entry->>'label',
          client_description = left(concat_ws(E'\n', nullif(v_entry->>'scope', ''), nullif(v_entry->>'specification', '')), 2000),
          item_type = 'allowance',
          delivery_method = 'subcontracted',
          quantity = 1,
          unit = 'allowance',
          unit_cost = (v_entry->>'cost')::numeric,
          unit_sell = (v_entry->>'sell')::numeric,
          total_cost = (v_entry->>'cost')::numeric,
          total_sell = (v_entry->>'sell')::numeric,
          gross_profit = (v_entry->>'gross')::numeric,
          margin_percent = (v_entry->>'margin')::numeric,
          markup_percent = (v_entry->>'markup')::numeric,
          calculation_mode = 'lump_sum',
          visible_on_quote = true,
          manually_edited = true,
          work_area_id = (p_payload->>'work_area_id')::uuid,
          notes_internal = 'Used for draft pricing from a selected schedule price. This is not an award of work.'
            || E'\n__quotr_meta__:'
            || jsonb_build_object(
              'rfqId', v_rfq.id,
              'rfqResponseId', v_response.id,
              'scheduleItemId', v_entry->>'schedule_item_id',
              'pricingSource', 'user_override',
              'sellKnown', (v_entry->>'sell_known')::boolean
            )::text
      where id = v_allowance and pricing_document_id = v_doc.id and org_id = v_org;
      update public.rfq_schedule_pricing_applications
      set superseded_at = now()
      where id = (v_entry->>'existing_application_id')::uuid;
    end if;

    insert into public.rfq_schedule_pricing_applications (
      org_id, project_id, pricing_document_id, work_area_id, rfq_id, recipient_id,
      response_id, response_version, request_sent_at, schedule_item_id, response_line_id,
      line_role, scope, specification, quantity, unit, unit_price_ex_gst, cost_ex_gst,
      qualification, excluded_scope, completeness, client_label, sell_treatment, target_margin_percent,
      sell_ex_gst, sell_known, loss_acknowledged, qualification_acknowledged, alternative_acknowledged,
      scope_confirmed, source_choice, allowance_item_id, replaced_item_ids, before_lines,
      gst_treatment, applied_by
    )
    values (
      v_org, v_rfq.project_id, v_doc.id, (p_payload->>'work_area_id')::uuid, v_rfq.id, v_recipient.id,
      v_response.id, v_response.version_number, v_sent, (v_entry->>'schedule_item_id')::uuid, (v_entry->>'response_line_id')::uuid,
      v_entry->>'role', v_entry->>'scope', v_entry->>'specification',
      nullif(v_entry->>'quantity', '')::numeric, v_entry->>'unit', nullif(v_entry->>'unit_price', '')::numeric, (v_entry->>'cost')::numeric,
      v_entry->>'qualification', coalesce(v_response.excluded_scope, ''), v_response.completeness, v_entry->>'label',
      v_entry->>'treatment', nullif(v_entry->>'target_margin', '')::numeric,
      (v_entry->>'sell')::numeric, (v_entry->>'sell_known')::boolean, coalesce((v_entry->>'loss')::boolean, false),
      coalesce((v_entry->>'qualification_ack')::boolean, false), coalesce((v_entry->>'alternative_ack')::boolean, false),
      true, 'schedule', v_allowance,
      coalesce((select array_agg(value::uuid) from jsonb_array_elements_text(v_entry->'replaced') as value), '{}'),
      coalesce(v_entry->'before', '[]'::jsonb),
      coalesce(v_response.gst_treatment, 'unknown'), auth.uid()
    )
    returning id into v_application;

    v_wrote := true;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'applicationId', v_application,
      'allowanceItemId', v_allowance,
      'scheduleItemId', v_entry->>'schedule_item_id',
      'costExGst', (v_entry->>'cost')::numeric,
      'sellExGst', (v_entry->>'sell')::numeric
    ));
  end loop;

  if v_wrote then
    update public.pricing_documents
    set status = 'draft', reviewed_at = null
    where id = v_doc.id and org_id = v_org;
    insert into public.rfq_events (org_id, rfq_id, recipient_id, kind, summary, actor, created_by)
    values (
      v_org, v_rfq.id, v_recipient.id, 'pricing_applied',
      'Selected item prices used for draft pricing. The subcontractor was not notified.',
      'member', auth.uid()
    );
  end if;

  if coalesce(p_payload->>'force_fail', '') = 'true' then
    raise exception 'RFQ_APPLY_FORCED';
  end if;

  return jsonb_build_object('ok', true, 'alreadyApplied', false, 'rows', v_results);
end;
$$;

revoke all on function public.apply_rfq_schedule_lines_v1(jsonb) from public, anon;
grant execute on function public.apply_rfq_schedule_lines_v1(jsonb) to authenticated;
