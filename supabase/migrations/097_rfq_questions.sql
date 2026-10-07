-- Questions on a sent request notify people who can answer.
-- An answer does not change the frozen request. A scope change is a new request.

alter table public.rfq_clarifications
  add column if not exists audience text not null default 'private',
  add column if not exists author_user_id uuid references public.profiles (id),
  add column if not exists parent_id uuid references public.rfq_clarifications (id),
  add column if not exists request_sent_at timestamptz;

alter table public.rfq_clarifications
  drop constraint if exists rfq_clarifications_audience_check;

alter table public.rfq_clarifications
  add constraint rfq_clarifications_audience_check
  check (audience in ('private', 'all'));

comment on column public.rfq_clarifications.audience is
  'private is one recipient. all is every recipient of this request, without the asking business identity.';

comment on column public.rfq_clarifications.request_sent_at is
  'The sent request this answer relates to. Answers do not create a new request version.';

alter table public.notifications
  drop constraint if exists notifications_notification_type_check;

alter table public.notifications
  add constraint notifications_notification_type_check
  check (notification_type in ('quote_accepted', 'quote_declined', 'rfq_question'));

create or replace function public.notify_rfq_question()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rfq uuid;
  v_project uuid;
  v_org uuid;
  v_member record;
begin
  if new.from_recipient is not true then
    return new;
  end if;
  select recipient.rfq_id, rfq.project_id, rfq.org_id
    into v_rfq, v_project, v_org
  from public.rfq_recipients recipient
  join public.rfqs rfq on rfq.id = recipient.rfq_id
  where recipient.id = new.recipient_id;
  if v_rfq is null then
    return new;
  end if;
  for v_member in
    select membership.user_id
    from public.organisation_memberships membership
    where membership.org_id = v_org
      and membership.status = 'active'
      and membership.role in ('owner', 'admin', 'estimator')
  loop
    insert into public.notifications (
      org_id, recipient_user_id, notification_type, title, body,
      resource_type, resource_id, project_id, payload
    ) values (
      v_org,
      v_member.user_id,
      'rfq_question',
      'Question on a request',
      'A subcontractor asked a question. It is not a price or a decline.',
      'rfq',
      new.id,
      v_project,
      jsonb_build_object(
        'actionUrl', '/app/projects/' || v_project::text || '/requests/' || v_rfq::text || '?question=' || new.id::text,
        'rfqId', v_rfq,
        'clarificationId', new.id
      )
    )
    on conflict (org_id, recipient_user_id, notification_type, resource_id) do nothing;
  end loop;
  return new;
end;
$$;

drop trigger if exists rfq_clarifications_notify_question on public.rfq_clarifications;
create trigger rfq_clarifications_notify_question
  after insert on public.rfq_clarifications
  for each row
  execute function public.notify_rfq_question();

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

  insert into public.rfq_clarifications (
    org_id, recipient_id, body, from_recipient, audience, author_user_id, parent_id, request_sent_at
  ) values (
    v_rfq.org_id, v_recipient.id, v_body, false, v_audience, v_user, v_question.id, v_rfq.sent_at
  )
  returning id into v_answer;
  v_ids := array_append(v_ids, v_recipient.id);

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
      );
      v_ids := array_append(v_ids, v_other.id);
    end loop;
  end if;

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
    'requestSentAt', v_rfq.sent_at
  );
end;
$$;

revoke all on function public.notify_rfq_question() from public, anon, authenticated;
revoke all on function public.answer_rfq_clarification_v1(jsonb) from public, anon;
grant execute on function public.answer_rfq_clarification_v1(jsonb) to authenticated;
