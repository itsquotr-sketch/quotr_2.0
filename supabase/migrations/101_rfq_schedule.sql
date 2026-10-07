-- Optional frozen item schedule. A lump-sum request is unchanged.
-- A schedule response is not applied to Pricing by the whole-response path.

alter table public.rfqs
  add column if not exists pricing_request text not null default 'lump_sum';

alter table public.rfqs
  drop constraint if exists rfqs_pricing_request_known;

alter table public.rfqs
  add constraint rfqs_pricing_request_known
  check (pricing_request in ('lump_sum', 'schedule'));

comment on column public.rfqs.pricing_request is
  'lump_sum asks for one price. schedule freezes an item list. Sent rows do not change when job details change.';

alter table public.rfq_responses
  add column if not exists request_sent_at timestamptz,
  add column if not exists completeness text,
  add column if not exists qualified boolean not null default false,
  add column if not exists optional_ex_gst numeric(14, 2),
  add column if not exists alternative_ex_gst numeric(14, 2);

alter table public.rfq_responses
  drop constraint if exists rfq_responses_completeness_known;

alter table public.rfq_responses
  add constraint rfq_responses_completeness_known
  check (completeness is null or completeness in ('complete', 'partial'));

create table if not exists public.rfq_schedule_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  rfq_id uuid not null references public.rfqs (id) on delete cascade,
  sort_order integer not null,
  scope text not null,
  specification text not null default '',
  quantity numeric(14, 4),
  unit text not null,
  line_role text not null,
  created_at timestamptz not null default now(),
  constraint rfq_schedule_items_order_uidx unique (rfq_id, sort_order),
  constraint rfq_schedule_items_order_nonneg check (sort_order >= 0 and sort_order < 40),
  constraint rfq_schedule_items_scope_len check (char_length(scope) <= 500),
  constraint rfq_schedule_items_spec_len check (char_length(specification) <= 1000),
  constraint rfq_schedule_items_unit_known check (unit in ('m2', 'm', 'item', 'hour', 'lump_sum')),
  constraint rfq_schedule_items_role_known check (line_role in ('required', 'optional', 'alternative')),
  constraint rfq_schedule_items_quantity_known check (
    quantity is null or (quantity > 0 and quantity <= 1000000)
  )
);

comment on table public.rfq_schedule_items is
  'Frozen at send. Alternatives are not part of the base total. A lump sum is one total and has no quantity.';

create table if not exists public.rfq_response_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  response_id uuid not null references public.rfq_responses (id) on delete cascade,
  schedule_item_id uuid not null references public.rfq_schedule_items (id) on delete restrict,
  decision text not null,
  unit_price_ex_gst numeric(14, 2),
  amount_ex_gst numeric(14, 2),
  reason text not null default '',
  qualification text not null default '',
  created_at timestamptz not null default now(),
  constraint rfq_response_lines_item_uidx unique (response_id, schedule_item_id),
  constraint rfq_response_lines_decision_known check (decision in ('priced', 'not_priced', 'excluded')),
  constraint rfq_response_lines_reason_len check (char_length(reason) <= 500),
  constraint rfq_response_lines_qualification_len check (char_length(qualification) <= 1000),
  constraint rfq_response_lines_price_range check (
    unit_price_ex_gst is null or (unit_price_ex_gst >= 0 and unit_price_ex_gst <= 99999999.99)
  )
);

comment on table public.rfq_response_lines is
  'One recipient answer for one frozen schedule row. amount_ex_gst is calculated by the server. Blank is not zero.';

alter table public.rfq_schedule_items enable row level security;
alter table public.rfq_response_lines enable row level security;
revoke all on table public.rfq_schedule_items from public, anon, authenticated;
revoke all on table public.rfq_response_lines from public, anon, authenticated;
grant select on table public.rfq_schedule_items to authenticated;
grant select on table public.rfq_response_lines to authenticated;
grant select, insert, update, delete on table public.rfq_schedule_items to service_role;
grant select, insert, update, delete on table public.rfq_response_lines to service_role;

create policy rfq_schedule_items_select_member on public.rfq_schedule_items
  for select to authenticated
  using (
    org_id = public.auth_org_id()
    and exists (
      select 1 from public.organisation_memberships membership
      where membership.user_id = auth.uid()
        and membership.org_id = rfq_schedule_items.org_id
        and membership.status = 'active'
    )
  );

create policy rfq_response_lines_select_member on public.rfq_response_lines
  for select to authenticated
  using (
    org_id = public.auth_org_id()
    and exists (
      select 1 from public.organisation_memberships membership
      where membership.user_id = auth.uid()
        and membership.org_id = rfq_response_lines.org_id
        and membership.status = 'active'
    )
  );

create or replace function public.rfq_touch_frozen()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'sent' and (
    new.status is distinct from old.status
    or new.scope_kind is distinct from old.scope_kind
    or new.work_area_id is distinct from old.work_area_id
    or new.work_area_type is distinct from old.work_area_type
    or new.work_area_name is distinct from old.work_area_name
    or new.written_scope_label is distinct from old.written_scope_label
    or new.requested_scope is distinct from old.requested_scope
    or new.measurement_notes is distinct from old.measurement_notes
    or new.response_due_on is distinct from old.response_due_on
    or new.include_site_address is distinct from old.include_site_address
    or new.site_address is distinct from old.site_address
    or new.site_details is distinct from old.site_details
    or new.questions is distinct from old.questions
    or new.message is distinct from old.message
    or new.builder_name is distinct from old.builder_name
    or new.project_id is distinct from old.project_id
    or new.org_id is distinct from old.org_id
    or new.pricing_request is distinct from old.pricing_request
  ) then
    raise exception 'RFQ_FROZEN';
  end if;
  return new;
end;
$$;

create or replace function public.rfq_freeze_schedule_item()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status from public.rfqs where id = coalesce(new.rfq_id, old.rfq_id);
  if v_status = 'sent' then
    raise exception 'RFQ_FROZEN';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists rfq_schedule_items_freeze_sent on public.rfq_schedule_items;
create trigger rfq_schedule_items_freeze_sent
  before insert or update or delete on public.rfq_schedule_items
  for each row execute function public.rfq_freeze_schedule_item();

create or replace function public.rfq_freeze_response_line()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status
  from public.rfq_responses
  where id = coalesce(new.response_id, old.response_id);
  if v_status = 'submitted' then
    raise exception 'RFQ_RESPONSE_FROZEN';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists rfq_response_lines_freeze_submitted on public.rfq_response_lines;
create trigger rfq_response_lines_freeze_submitted
  before insert or update or delete on public.rfq_response_lines
  for each row execute function public.rfq_freeze_response_line();

create or replace function public.set_rfq_pricing_request_v1(p_rfq uuid, p_mode text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
  v_rfq public.rfqs%rowtype;
begin
  if auth.uid() is null or v_org is null or not public.auth_can_mutate_work() then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;
  if p_mode not in ('lump_sum', 'schedule') then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  select * into v_rfq from public.rfqs where id = p_rfq and org_id = v_org;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_rfq.status = 'sent' then
    return jsonb_build_object('ok', false, 'error', 'FROZEN');
  end if;
  update public.rfqs set pricing_request = p_mode, updated_at = now() where id = v_rfq.id;
  if p_mode = 'lump_sum' then
    delete from public.rfq_schedule_items where rfq_id = v_rfq.id;
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.save_rfq_schedule_v1(p_rfq uuid, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
  v_rfq public.rfqs%rowtype;
  v_item jsonb;
  v_index integer := 0;
  v_scope text;
  v_spec text;
  v_unit text;
  v_role text;
  v_quantity numeric;
  v_seen text[] := '{}';
begin
  if auth.uid() is null or v_org is null or not public.auth_can_mutate_work() then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;
  select * into v_rfq from public.rfqs where id = p_rfq and org_id = v_org for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_rfq.status = 'sent' then
    return jsonb_build_object('ok', false, 'error', 'FROZEN');
  end if;
  if v_rfq.pricing_request is distinct from 'schedule' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 40 then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  delete from public.rfq_schedule_items where rfq_id = v_rfq.id;
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_scope := btrim(coalesce(v_item->>'scope', ''));
    v_spec := btrim(coalesce(v_item->>'specification', ''));
    v_unit := coalesce(v_item->>'unit', '');
    v_role := coalesce(v_item->>'role', '');
    if v_unit = 'lump_sum' then
      v_quantity := null;
    else
      v_quantity := nullif(v_item->>'quantity', '')::numeric;
    end if;
    if v_scope = '' and v_unit = '' then
      continue;
    end if;
    if v_scope <> '' and lower(v_scope) = any(v_seen) then
      raise exception 'DUPLICATE_ROW';
    end if;
    v_seen := array_append(v_seen, lower(v_scope));
    insert into public.rfq_schedule_items (
      id, org_id, rfq_id, sort_order, scope, specification, quantity, unit, line_role
    ) values (
      coalesce(nullif(v_item->>'id', '')::uuid, gen_random_uuid()),
      v_org, v_rfq.id, v_index, v_scope, v_spec, v_quantity, v_unit, v_role
    );
    v_index := v_index + 1;
  end loop;
  return jsonb_build_object('ok', true, 'count', v_index);
exception
  when unique_violation or check_violation or invalid_text_representation then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  when others then
    if sqlerrm = 'DUPLICATE_ROW' then
      return jsonb_build_object('ok', false, 'error', 'DUPLICATE_ROW');
    end if;
    raise;
end;
$$;

alter function public.send_rfq_v1(uuid, jsonb) rename to send_rfq_core_v1;

create or replace function public.send_rfq_v1(p_rfq uuid, p_tokens jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rfq public.rfqs%rowtype;
  v_required integer;
begin
  select * into v_rfq from public.rfqs where id = p_rfq and org_id = public.auth_org_id();
  if not found then
    return public.send_rfq_core_v1(p_rfq, p_tokens);
  end if;
  if v_rfq.pricing_request = 'schedule' then
    select count(*) into v_required
    from public.rfq_schedule_items
    where rfq_id = v_rfq.id and line_role = 'required';
    if v_required < 1 or exists (
      select 1 from public.rfq_schedule_items item
      where item.rfq_id = v_rfq.id
        and (
          char_length(btrim(item.scope)) < 3
          or (item.unit = 'lump_sum' and item.quantity is not null)
          or (item.unit <> 'lump_sum' and (item.quantity is null or item.quantity <= 0))
        )
    ) then
      return jsonb_build_object('ok', false, 'error', 'SCHEDULE');
    end if;
  end if;
  return public.send_rfq_core_v1(p_rfq, p_tokens);
end;
$$;

alter function public.apply_rfq_response_to_pricing_v1(jsonb) rename to apply_rfq_response_to_pricing_core_v1;

create or replace function public.apply_rfq_response_to_pricing_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode text;
begin
  select rfq.pricing_request into v_mode
  from public.rfq_responses response
  join public.rfq_recipients recipient on recipient.id = response.recipient_id
  join public.rfqs rfq on rfq.id = recipient.rfq_id
  where response.id = nullif(p_payload->>'response_id', '')::uuid;
  if v_mode = 'schedule' then
    return jsonb_build_object('ok', false, 'error', 'SCHEDULE_NOT_APPLIED');
  end if;
  return public.apply_rfq_response_to_pricing_core_v1(p_payload);
end;
$$;

create or replace function public.public_rfq_save_schedule_response_v1(
  p_token_hash text,
  p_payload jsonb,
  p_confirm boolean,
  p_revise boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token public.rfq_access_tokens%rowtype;
  v_recipient public.rfq_recipients%rowtype;
  v_rfq public.rfqs%rowtype;
  v_draft public.rfq_responses%rowtype;
  v_next integer;
  v_id uuid;
  v_line jsonb;
  v_item public.rfq_schedule_items%rowtype;
  v_decision text;
  v_unit_price numeric(14, 2);
  v_amount numeric(14, 2);
  v_reason text;
  v_qualification text;
  v_base numeric(14, 2) := 0;
  v_optional numeric(14, 2) := 0;
  v_alternative numeric(14, 2) := 0;
  v_required integer := 0;
  v_priced_required integer := 0;
  v_answered_required integer := 0;
  v_qualified boolean := false;
  v_gst text;
  v_seen uuid[] := '{}';
begin
  if not public.rfq_public_rate_ok(coalesce(p_token_hash, ''), 'write', 20) then
    return jsonb_build_object('ok', false, 'error', 'RATE_LIMITED');
  end if;
  select * into v_token from public.rfq_access_tokens where token_hash = p_token_hash and revoked_at is null and expires_at > now();
  if not found then
    return jsonb_build_object('ok', false, 'error', 'UNAVAILABLE');
  end if;
  select * into v_recipient from public.rfq_recipients where id = v_token.recipient_id for update;
  select * into v_rfq from public.rfqs where id = v_recipient.rfq_id and status = 'sent';
  if not found or v_rfq.pricing_request is distinct from 'schedule' then
    return jsonb_build_object('ok', false, 'error', 'UNAVAILABLE');
  end if;
  if v_recipient.response_state in ('declined', 'expired') then
    return jsonb_build_object('ok', false, 'error', 'EXPIRED');
  end if;
  if v_rfq.response_due_on is not null and v_rfq.response_due_on < (timezone('UTC', now()))::date
    and not exists (
      select 1 from public.rfq_responses where recipient_id = v_recipient.id and status = 'submitted'
    )
  then
    update public.rfq_recipients set response_state = 'expired' where id = v_recipient.id;
    return jsonb_build_object('ok', false, 'error', 'EXPIRED');
  end if;
  if nullif(p_payload->>'request_sent_at', '')::timestamptz is distinct from v_rfq.sent_at then
    return jsonb_build_object('ok', false, 'error', 'STALE_SCHEDULE');
  end if;
  v_gst := nullif(p_payload->>'gst_treatment', '');
  if v_gst is not null and v_gst not in ('extra', 'none', 'unknown') then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  if btrim(coalesce(p_payload->>'assumptions', '')) <> '' then
    v_qualified := true;
  end if;
  select * into v_draft from public.rfq_responses where recipient_id = v_recipient.id and status = 'draft' for update;
  if p_confirm is true and exists (
    select 1 from public.rfq_responses where recipient_id = v_recipient.id and status = 'submitted'
  ) and v_draft.id is null and p_revise is distinct from true then
    return jsonb_build_object('ok', false, 'error', 'DUPLICATE');
  end if;
  if v_draft.id is null then
    select coalesce(max(version_number), 0) + 1 into v_next from public.rfq_responses where recipient_id = v_recipient.id;
    insert into public.rfq_responses (
      org_id, recipient_id, version_number, status, gst_treatment, pricing_structure,
      included_scope, excluded_scope, assumptions, lead_time, valid_until, message, request_sent_at
    ) values (
      v_rfq.org_id, v_recipient.id, v_next, 'draft', v_gst, 'itemised',
      coalesce(p_payload->>'included_scope', ''),
      coalesce(p_payload->>'excluded_scope', ''),
      coalesce(p_payload->>'assumptions', ''),
      coalesce(p_payload->>'lead_time', ''),
      nullif(p_payload->>'valid_until', '')::date,
      coalesce(p_payload->>'message', ''),
      v_rfq.sent_at
    ) returning id into v_id;
  else
    v_id := v_draft.id;
    delete from public.rfq_response_lines where response_id = v_id;
    update public.rfq_responses set
      gst_treatment = v_gst,
      pricing_structure = 'itemised',
      included_scope = coalesce(p_payload->>'included_scope', ''),
      excluded_scope = coalesce(p_payload->>'excluded_scope', ''),
      assumptions = coalesce(p_payload->>'assumptions', ''),
      lead_time = coalesce(p_payload->>'lead_time', ''),
      valid_until = nullif(p_payload->>'valid_until', '')::date,
      message = coalesce(p_payload->>'message', ''),
      request_sent_at = v_rfq.sent_at,
      updated_at = now()
    where id = v_id;
  end if;

  if jsonb_typeof(p_payload->'lines') = 'array' then
    for v_line in select value from jsonb_array_elements(p_payload->'lines')
    loop
      select * into v_item
      from public.rfq_schedule_items
      where id = nullif(v_line->>'schedule_item_id', '')::uuid
        and rfq_id = v_rfq.id;
      if not found then
        return jsonb_build_object('ok', false, 'error', 'STALE_SCHEDULE');
      end if;
      if v_item.id = any(v_seen) then
        return jsonb_build_object('ok', false, 'error', 'DUPLICATE_ROW');
      end if;
      v_seen := array_append(v_seen, v_item.id);
      v_decision := coalesce(v_line->>'decision', '');
      v_reason := btrim(coalesce(v_line->>'reason', ''));
      v_qualification := btrim(coalesce(v_line->>'qualification', ''));
      if v_qualification <> '' then
        v_qualified := true;
      end if;
      if v_item.line_role = 'required' and v_decision not in ('priced', 'not_priced') then
        return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
      end if;
      if v_item.line_role <> 'required' and v_decision not in ('priced', 'excluded') then
        return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
      end if;
      v_unit_price := null;
      v_amount := null;
      if v_decision = 'priced' then
        v_unit_price := nullif(v_line->>'unit_price', '')::numeric;
        if v_unit_price is null or v_unit_price < 0 then
          return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
        end if;
        if v_item.unit = 'lump_sum' then
          v_amount := round(v_unit_price, 2);
        else
          v_amount := round(v_item.quantity * v_unit_price, 2);
        end if;
        if v_item.line_role = 'required' then
          v_base := v_base + v_amount;
        elsif v_item.line_role = 'optional' then
          v_optional := v_optional + v_amount;
        else
          v_alternative := v_alternative + v_amount;
        end if;
      elsif v_decision = 'not_priced' then
        if char_length(v_reason) < 3 then
          return jsonb_build_object('ok', false, 'error', 'NOT_PRICED_REASON');
        end if;
      end if;
      insert into public.rfq_response_lines (
        org_id, response_id, schedule_item_id, decision, unit_price_ex_gst, amount_ex_gst, reason, qualification
      ) values (
        v_rfq.org_id, v_id, v_item.id, v_decision, v_unit_price, v_amount, v_reason, v_qualification
      );
    end loop;
  end if;

  select count(*) into v_required from public.rfq_schedule_items where rfq_id = v_rfq.id and line_role = 'required';
  select count(*) into v_answered_required
  from public.rfq_response_lines line
  join public.rfq_schedule_items item on item.id = line.schedule_item_id
  where line.response_id = v_id and item.line_role = 'required' and line.decision in ('priced', 'not_priced');
  select count(*) into v_priced_required
  from public.rfq_response_lines line
  join public.rfq_schedule_items item on item.id = line.schedule_item_id
  where line.response_id = v_id and item.line_role = 'required' and line.decision = 'priced';

  if p_confirm is true then
    if v_gst is null or v_answered_required <> v_required then
      return jsonb_build_object('ok', false, 'error', 'INCOMPLETE');
    end if;
    update public.rfq_responses set
      status = 'submitted',
      price_ex_gst = v_base,
      optional_ex_gst = v_optional,
      alternative_ex_gst = v_alternative,
      completeness = case when v_priced_required = v_required then 'complete' else 'partial' end,
      qualified = v_qualified,
      submitted_at = now(),
      updated_at = now()
    where id = v_id;
    update public.rfq_recipients set response_state = 'responded' where id = v_recipient.id;
    perform public.rfq_event(
      v_rfq.org_id, v_rfq.id, v_recipient.id,
      case when p_revise then 'response_revised' else 'response_submitted' end,
      case when p_revise then 'Recipient submitted a revised schedule response' else 'Recipient submitted a schedule response' end,
      'recipient'
    );
  else
    update public.rfq_responses set
      price_ex_gst = v_base,
      optional_ex_gst = v_optional,
      alternative_ex_gst = v_alternative,
      completeness = null,
      qualified = v_qualified,
      updated_at = now()
    where id = v_id;
  end if;
  return jsonb_build_object(
    'ok', true,
    'responseId', v_id,
    'submitted', p_confirm is true,
    'baseExGst', v_base,
    'optionalExGst', v_optional,
    'alternativeExGst', v_alternative,
    'completeness', case when p_confirm and v_priced_required = v_required then 'complete' when p_confirm then 'partial' else null end
  );
exception
  when invalid_text_representation then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
end;
$$;

create or replace function public.lookup_rfq_by_token_hash_v1(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token public.rfq_access_tokens%rowtype;
  v_recipient public.rfq_recipients%rowtype;
  v_rfq public.rfqs%rowtype;
  v_files jsonb;
  v_clarifications jsonb;
  v_responses jsonb;
  v_schedule jsonb;
  v_lines jsonb;
begin
  if p_token_hash is null or char_length(p_token_hash) <> 64 then
    return jsonb_build_object('ok', false, 'error', 'UNAVAILABLE');
  end if;
  if not public.rfq_public_rate_ok(p_token_hash, 'lookup', 120) then
    return jsonb_build_object('ok', false, 'error', 'RATE_LIMITED');
  end if;
  select * into v_token from public.rfq_access_tokens where token_hash = p_token_hash;
  if not found or v_token.revoked_at is not null then
    return jsonb_build_object('ok', false, 'error', 'UNAVAILABLE');
  end if;
  if v_token.expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'EXPIRED');
  end if;
  select * into v_recipient from public.rfq_recipients where id = v_token.recipient_id;
  select * into v_rfq from public.rfqs where id = v_recipient.rfq_id and status = 'sent';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'UNAVAILABLE');
  end if;
  if v_rfq.response_due_on is not null
    and v_rfq.response_due_on < (timezone('UTC', now()))::date
    and v_recipient.response_state in ('awaiting', 'clarification')
    and not exists (
      select 1 from public.rfq_responses response
      where response.recipient_id = v_recipient.id and response.status = 'submitted'
    )
  then
    update public.rfq_recipients set response_state = 'expired' where id = v_recipient.id;
    v_recipient.response_state := 'expired';
    perform public.rfq_event(v_rfq.org_id, v_rfq.id, v_recipient.id, 'expired', 'Request expired with no response', 'system');
  end if;
  if not exists (
    select 1 from public.rfq_events where recipient_id = v_recipient.id and kind = 'viewed'
  ) then
    perform public.rfq_event(v_rfq.org_id, v_rfq.id, v_recipient.id, 'viewed', 'Recipient opened the request', 'recipient');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', file.id, 'title', file.title, 'filename', file.display_filename, 'mimeType', file.mime_type, 'byteSize', file.byte_size
  ) order by file.created_at), '[]'::jsonb) into v_files
  from public.rfq_shared_documents file where file.rfq_id = v_rfq.id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', note.id, 'body', note.body, 'createdAt', note.created_at, 'fromRecipient', note.from_recipient
  ) order by note.created_at), '[]'::jsonb) into v_clarifications
  from public.rfq_clarifications note where note.recipient_id = v_recipient.id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', item.id, 'sortOrder', item.sort_order, 'scope', item.scope, 'specification', item.specification,
    'quantity', item.quantity, 'unit', item.unit, 'role', item.line_role
  ) order by item.sort_order), '[]'::jsonb) into v_schedule
  from public.rfq_schedule_items item where item.rfq_id = v_rfq.id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', response.id, 'versionNumber', response.version_number, 'status', response.status,
    'priceExGst', response.price_ex_gst, 'gstTreatment', response.gst_treatment, 'structure', response.pricing_structure,
    'includedScope', response.included_scope, 'excludedScope', response.excluded_scope, 'assumptions', response.assumptions,
    'leadTime', response.lead_time, 'validUntil', response.valid_until, 'message', response.message,
    'submittedAt', response.submitted_at, 'fileId', file.id, 'fileName', file.original_filename,
    'fileReady', file.upload_status = 'ready', 'completeness', response.completeness, 'qualified', response.qualified,
    'optionalExGst', response.optional_ex_gst, 'alternativeExGst', response.alternative_ex_gst,
    'requestSentAt', response.request_sent_at
  ) order by response.version_number), '[]'::jsonb) into v_responses
  from public.rfq_responses response
  left join public.rfq_response_files file on file.response_id = response.id
  where response.recipient_id = v_recipient.id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'responseId', line.response_id, 'scheduleItemId', line.schedule_item_id, 'decision', line.decision,
    'unitPriceExGst', line.unit_price_ex_gst, 'amountExGst', line.amount_ex_gst,
    'reason', line.reason, 'qualification', line.qualification
  )), '[]'::jsonb) into v_lines
  from public.rfq_response_lines line
  join public.rfq_responses response on response.id = line.response_id
  where response.recipient_id = v_recipient.id;
  return jsonb_build_object(
    'ok', true,
    'builderName', v_rfq.builder_name,
    'scopeLabel', case when v_rfq.scope_kind = 'work_area' then v_rfq.work_area_name else v_rfq.written_scope_label end,
    'requestedScope', v_rfq.requested_scope,
    'measurementNotes', v_rfq.measurement_notes,
    'responseDueOn', v_rfq.response_due_on,
    'siteAddress', case when v_rfq.include_site_address then v_rfq.site_address else '' end,
    'siteDetails', v_rfq.site_details,
    'questions', v_rfq.questions,
    'message', v_rfq.message,
    'files', v_files,
    'responseState', v_recipient.response_state,
    'clarifications', v_clarifications,
    'responses', v_responses,
    'pricingRequest', v_rfq.pricing_request,
    'requestSentAt', v_rfq.sent_at,
    'schedule', v_schedule,
    'lines', v_lines
  );
end;
$$;

revoke all on function public.set_rfq_pricing_request_v1(uuid, text) from public, anon;
revoke all on function public.save_rfq_schedule_v1(uuid, jsonb) from public, anon;
revoke all on function public.send_rfq_v1(uuid, jsonb) from public, anon;
revoke all on function public.apply_rfq_response_to_pricing_v1(jsonb) from public, anon;
revoke all on function public.public_rfq_save_schedule_response_v1(text, jsonb, boolean, boolean) from public;

alter function public.public_rfq_save_response_v1(text, jsonb, boolean, boolean) rename to public_rfq_save_response_core_v1;

create or replace function public.public_rfq_save_response_v1(
  p_token_hash text,
  p_payload jsonb,
  p_confirm boolean,
  p_revise boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode text;
begin
  select rfq.pricing_request into v_mode
  from public.rfq_access_tokens token
  join public.rfq_recipients recipient on recipient.id = token.recipient_id
  join public.rfqs rfq on rfq.id = recipient.rfq_id
  where token.token_hash = p_token_hash;
  if v_mode = 'schedule' then
    return jsonb_build_object('ok', false, 'error', 'UNAVAILABLE');
  end if;
  return public.public_rfq_save_response_core_v1(p_token_hash, p_payload, p_confirm, p_revise);
end;
$$;

revoke all on function public.public_rfq_save_response_v1(text, jsonb, boolean, boolean) from public;
grant execute on function public.public_rfq_save_response_v1(text, jsonb, boolean, boolean) to anon, authenticated;

revoke all on function public.send_rfq_core_v1(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.apply_rfq_response_to_pricing_core_v1(jsonb) from public, anon, authenticated;
revoke all on function public.public_rfq_save_response_core_v1(text, jsonb, boolean, boolean) from public, anon, authenticated;

grant execute on function public.set_rfq_pricing_request_v1(uuid, text) to authenticated;
grant execute on function public.save_rfq_schedule_v1(uuid, jsonb) to authenticated;
grant execute on function public.send_rfq_v1(uuid, jsonb) to authenticated;
grant execute on function public.apply_rfq_response_to_pricing_v1(jsonb) to authenticated;
grant execute on function public.public_rfq_save_schedule_response_v1(text, jsonb, boolean, boolean) to anon, authenticated;
