-- A shared answer stores the exact recipient set and the delivery result.
-- Viewers cannot read another recipient's private thread.

alter table public.rfq_clarifications
  add column if not exists shared_recipient_ids uuid[],
  add column if not exists delivery_state text;

alter table public.rfq_clarifications
  drop constraint if exists rfq_clarifications_delivery_state_check;

alter table public.rfq_clarifications
  add constraint rfq_clarifications_delivery_state_check
  check (delivery_state is null or delivery_state in ('sent', 'failed'));

comment on column public.rfq_clarifications.shared_recipient_ids is
  'The exact recipients who were given this answer. Private answers list one recipient.';

comment on column public.rfq_clarifications.delivery_state is
  'sent or failed for the email of this answer row. Null until delivery is attempted.';

drop policy if exists rfq_clarifications_select_active_member on public.rfq_clarifications;

create policy rfq_clarifications_select_editor on public.rfq_clarifications
  for select to authenticated
  using (
    org_id = public.auth_org_id()
    and exists (
      select 1 from public.organisation_memberships membership
      where membership.user_id = auth.uid()
        and membership.org_id = rfq_clarifications.org_id
        and membership.status = 'active'
        and membership.role in ('owner', 'admin', 'estimator')
    )
  );

create or replace function public.answer_rfq_clarification_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid;
  v_question public.rfq_clarifications;
  v_rfq public.rfqs;
  v_recipient public.rfq_recipients;
  v_audience text;
  v_body text;
  v_other public.rfq_recipients;
  v_ids uuid[] := '{}';
  v_answer_ids uuid[] := '{}';
  v_answer uuid;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;
  if coalesce(p_payload->>'scope_unchanged', '') is distinct from 'true' then
    return jsonb_build_object('ok', false, 'error', 'SCOPE_CHANGE');
  end if;
  v_audience := coalesce(p_payload->>'audience', 'private');
  if v_audience not in ('private', 'all') then
    return jsonb_build_object('ok', false, 'error', 'AUDIENCE');
  end if;
  v_body := btrim(coalesce(p_payload->>'body', ''));
  if char_length(v_body) < 1 or char_length(v_body) > 2000 then
    return jsonb_build_object('ok', false, 'error', 'BODY');
  end if;
  select * into v_question
  from public.rfq_clarifications
  where id = nullif(p_payload->>'clarification_id', '')::uuid;
  if v_question.id is null or v_question.from_recipient is not true then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  select * into v_recipient from public.rfq_recipients where id = v_question.recipient_id;
  select * into v_rfq from public.rfqs where id = v_recipient.rfq_id;
  if v_rfq.id is null or v_rfq.status <> 'sent' then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  select membership.org_id into v_org
  from public.organisation_memberships membership
  where membership.user_id = v_user
    and membership.org_id = v_rfq.org_id
    and membership.status = 'active'
    and membership.role in ('owner', 'admin', 'estimator');
  if v_org is null then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;

  if v_audience = 'all' then
    if char_length(btrim(v_recipient.trading_name)) >= 3
      and position(lower(btrim(v_recipient.trading_name)) in lower(v_body)) > 0 then
      return jsonb_build_object('ok', false, 'error', 'BROADCAST_PRIVATE');
    end if;
    if char_length(btrim(coalesce(v_recipient.contact_name, ''))) >= 3
      and position(lower(btrim(v_recipient.contact_name)) in lower(v_body)) > 0 then
      return jsonb_build_object('ok', false, 'error', 'BROADCAST_PRIVATE');
    end if;
    if position(lower(btrim(v_recipient.contact_email)) in lower(v_body)) > 0 then
      return jsonb_build_object('ok', false, 'error', 'BROADCAST_PRIVATE');
    end if;
    if exists (
      select 1
      from regexp_matches(coalesce(v_question.body, ''), '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', 'g') as found(email)
      where position(lower(email) in lower(v_body)) > 0
    ) then
      return jsonb_build_object('ok', false, 'error', 'BROADCAST_PRIVATE');
    end if;
    if exists (
      select 1
      from regexp_matches(coalesce(v_question.body, ''), '\$\s?[0-9][0-9,]*(?:\.[0-9]+)?', 'g') as found(price)
      where position(replace(price, ' ', '') in replace(v_body, ' ', '')) > 0
    ) then
      return jsonb_build_object('ok', false, 'error', 'BROADCAST_PRIVATE');
    end if;
  end if;

  insert into public.rfq_clarifications (
    org_id, recipient_id, body, from_recipient, audience, author_user_id, parent_id, request_sent_at
  ) values (
    v_rfq.org_id, v_recipient.id, v_body, false, v_audience, v_user, v_question.id, v_rfq.sent_at
  )
  returning id into v_answer;
  v_ids := array_append(v_ids, v_recipient.id);
  v_answer_ids := array_append(v_answer_ids, v_answer);

  if v_audience = 'all' then
    for v_other in
      select recipient.*
      from public.rfq_recipients recipient
      where recipient.rfq_id = v_rfq.id
        and recipient.id <> v_recipient.id
        and recipient.response_state <> 'expired'
    loop
      insert into public.rfq_clarifications (
        org_id, recipient_id, body, from_recipient, audience, author_user_id, parent_id, request_sent_at
      ) values (
        v_rfq.org_id, v_other.id, v_body, false, 'all', v_user, v_question.id, v_rfq.sent_at
      )
      returning id into v_answer;
      v_ids := array_append(v_ids, v_other.id);
      v_answer_ids := array_append(v_answer_ids, v_answer);
    end loop;
  end if;

  update public.rfq_clarifications
  set shared_recipient_ids = v_ids
  where id = any(v_answer_ids);

  perform public.rfq_event(
    v_rfq.org_id,
    v_rfq.id,
    v_recipient.id,
    'answer_recorded',
    case when v_audience = 'all'
      then 'Answer recorded for every recipient. The sent request was not changed.'
      else 'Answer recorded for one recipient. The sent request was not changed.'
    end,
    'member'
  );

  return jsonb_build_object(
    'ok', true,
    'audience', v_audience,
    'recipientIds', to_jsonb(v_ids),
    'answerIds', to_jsonb(v_answer_ids),
    'requestSentAt', v_rfq.sent_at
  );
end;
$$;
