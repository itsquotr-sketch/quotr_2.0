-- A submitted priced response notifies the people who can use it.
-- A draft, a failed submit, a question, and a decline do not.
-- A later version notifies again. The same response version does not.
-- The text names the business, the work, and the job. It does not carry
-- the price, the client, a token, or a file address.

alter table public.notifications
  drop constraint if exists notifications_notification_type_check;

alter table public.notifications
  add constraint notifications_notification_type_check
  check (notification_type in ('quote_accepted', 'quote_declined', 'rfq_question', 'rfq_price'));

create or replace function public.notify_rfq_priced_response()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient public.rfq_recipients;
  v_rfq public.rfqs;
  v_job text;
  v_scope text;
  v_business text;
  v_verb text;
  v_body text;
  v_member record;
begin
  if new.status is distinct from 'submitted' or new.price_ex_gst is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'submitted' then
    return new;
  end if;
  select * into v_recipient from public.rfq_recipients where id = new.recipient_id;
  if v_recipient.id is null then
    return new;
  end if;
  select * into v_rfq from public.rfqs where id = v_recipient.rfq_id;
  if v_rfq.id is null then
    return new;
  end if;
  select project.title into v_job from public.projects project where project.id = v_rfq.project_id;
  v_business := coalesce(nullif(btrim(v_recipient.trading_name), ''), 'A subcontractor');
  v_scope := coalesce(nullif(btrim(v_rfq.work_area_name), ''), nullif(btrim(v_rfq.written_scope_label), ''), 'this request');
  v_job := coalesce(nullif(btrim(v_job), ''), 'this job');
  v_verb := case when new.version_number > 1 then 'submitted a revised price' else 'submitted a price' end;
  v_body := v_business || ' ' || v_verb || ' for ' || v_scope || ' on ' || v_job || '.';
  for v_member in
    select membership.user_id
    from public.organisation_memberships membership
    where membership.org_id = v_rfq.org_id
      and membership.status = 'active'
      and membership.role in ('owner', 'admin', 'estimator')
  loop
    insert into public.notifications (
      org_id, recipient_user_id, notification_type, title, body,
      resource_type, resource_id, project_id, payload
    ) values (
      v_rfq.org_id,
      v_member.user_id,
      'rfq_price',
      case when new.version_number > 1 then 'Revised price received' else 'Price received' end,
      v_body,
      'rfq_response',
      new.id,
      v_rfq.project_id,
      jsonb_build_object(
        'actionUrl', '/app/projects/' || v_rfq.project_id::text || '/requests/' || v_rfq.id::text || '?response=' || new.id::text,
        'rfqId', v_rfq.id,
        'responseId', new.id,
        'versionNumber', new.version_number
      )
    )
    on conflict (org_id, recipient_user_id, notification_type, resource_id) do nothing;
  end loop;
  return new;
end;
$$;

drop trigger if exists rfq_responses_notify_price on public.rfq_responses;
create trigger rfq_responses_notify_price
  after insert or update on public.rfq_responses
  for each row
  execute function public.notify_rfq_priced_response();

revoke all on function public.notify_rfq_priced_response() from public, anon, authenticated;
