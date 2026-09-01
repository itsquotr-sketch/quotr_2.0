-- Quotr 2.0 — COMMERCIAL-CLOSE-01
-- Additive: new-quote presentation default + durable response notifications.
-- Does not rewrite Quote money, Pricing, Estimate, snapshots, or acceptance evidence.
-- Does not mutate existing quote.presentation_mode values.

-- ---------------------------------------------------------------------------
-- A. New Quotes default to detailed (historical rows unchanged)
-- ---------------------------------------------------------------------------

alter table public.quotes
  alter column presentation_mode set default 'detailed';

comment on column public.quotes.presentation_mode is
  'Client presentation only. New Quotes default to detailed. Stored revision values are preserved.';

-- ---------------------------------------------------------------------------
-- B. In-app notifications + email outbox
-- ---------------------------------------------------------------------------

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  recipient_user_id uuid not null references public.profiles (id) on delete cascade,
  notification_type text not null check (
    notification_type in ('quote_accepted', 'quote_declined')
  ),
  title text not null,
  body text not null,
  resource_type text not null default 'quote',
  resource_id uuid,
  project_id uuid references public.projects (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists notifications_event_uidx
  on public.notifications (org_id, recipient_user_id, notification_type, resource_id);

create index if not exists notifications_recipient_idx
  on public.notifications (recipient_user_id, created_at desc);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  notification_id uuid references public.notifications (id) on delete cascade,
  channel text not null check (channel in ('email')),
  email_kind text not null check (
    email_kind in (
      'quote_accepted_builder',
      'quote_accepted_client',
      'quote_declined_builder'
    )
  ),
  recipient_email text not null,
  status text not null default 'pending' check (
    status in ('pending', 'submitted', 'delivered', 'failed')
  ),
  idempotency_key text not null,
  provider text not null default 'resend',
  provider_message_id text,
  attempt_count integer not null default 0,
  last_error_safe text,
  action_url text,
  submitted_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists notification_deliveries_idempotency_uidx
  on public.notification_deliveries (idempotency_key);

create index if not exists notification_deliveries_pending_idx
  on public.notification_deliveries (status, created_at)
  where status in ('pending', 'failed');

comment on table public.notifications is
  'Org-scoped in-app notifications. Recipient scoped. Not commercial evidence.';
-- Client decline confirmation email is intentionally omitted in v1:
-- quote_declines has no signer_email. Acceptance confirmation is mandatory.

alter table public.notifications enable row level security;
alter table public.notification_deliveries enable row level security;

revoke all on table public.notifications from public, anon, authenticated;
revoke all on table public.notification_deliveries from public, anon, authenticated;
grant select on table public.notifications to authenticated;
grant select, insert, update, delete on table public.notifications to service_role;
grant select, insert, update, delete on table public.notification_deliveries to service_role;

create policy "Users can select their own notifications"
  on public.notifications for select
  using (
    org_id = public.auth_org_id()
    and recipient_user_id = auth.uid()
  );

create or replace function public.mark_notifications_read_v1(p_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := public.auth_org_id();
begin
  if v_uid is null or v_org is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  end if;
  update public.notifications
  set read_at = coalesce(read_at, now())
  where org_id = v_org
    and recipient_user_id = v_uid
    and id = any(p_ids);
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.mark_notifications_read_v1(uuid[])
  from public, anon, service_role;
grant execute on function public.mark_notifications_read_v1(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- C. Enqueue after client evidence insert (same DB transaction, no Resend)
-- ---------------------------------------------------------------------------

create or replace function public.quote_notification_builder_recipient(p_quote public.quotes)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  if p_quote.created_by is not null then
    select id into v_user
    from public.profiles
    where id = p_quote.created_by
      and org_id = p_quote.org_id
    limit 1;
    if v_user is not null then
      return v_user;
    end if;
  end if;

  select id into v_user
  from public.profiles
  where org_id = p_quote.org_id
    and role = 'owner'
  order by created_at asc
  limit 1;
  return v_user;
end;
$$;

create or replace function public.quote_notification_user_email(p_user uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_email text;
begin
  select email into v_email
  from auth.users
  where id = p_user;
  if v_email is not null and length(btrim(v_email)) > 0 then
    return btrim(v_email);
  end if;
  return null;
end;
$$;

revoke all on function public.quote_notification_builder_recipient(public.quotes)
  from public, anon, authenticated, service_role;
revoke all on function public.quote_notification_user_email(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.quote_enqueue_client_acceptance_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.quotes%rowtype;
  v_project_title text;
  v_recipient uuid;
  v_builder_email text;
  v_notification_id uuid;
  v_ref text;
  v_body text;
  v_action_url text;
begin
  if new.source is distinct from 'client' then
    return new;
  end if;

  select * into v_quote from public.quotes where id = new.quote_id;
  if not found then
    return new;
  end if;

  select title into v_project_title
  from public.projects
  where id = new.project_id;

  v_recipient := public.quote_notification_builder_recipient(v_quote);
  if v_recipient is null then
    return new;
  end if;

  v_builder_email := public.quote_notification_user_email(v_recipient);
  v_ref := coalesce(nullif(btrim(new.quote_number), ''), v_quote.title);
  v_body :=
    coalesce(new.signer_name, 'A client')
    || ' accepted '
    || v_ref
    || ' · Revision '
    || new.revision_number::text
    || case when v_project_title is not null then E'\n' || v_project_title else '' end
    || E'\n$'
    || to_char(new.accepted_total_incl_gst, 'FM999,999,990.00')
    || ' incl GST';
  v_action_url := '/app/projects/' || new.project_id::text || '/quotes/' || new.quote_id::text;

  insert into public.notifications (
    org_id, recipient_user_id, notification_type, title, body,
    resource_type, resource_id, project_id, payload
  )
  values (
    new.org_id, v_recipient, 'quote_accepted', 'Quote accepted', v_body,
    'quote', new.quote_id, new.project_id,
    jsonb_build_object(
      'source', 'client',
      'signerName', new.signer_name,
      'quoteNumber', new.quote_number,
      'revisionNumber', new.revision_number,
      'projectTitle', v_project_title,
      'totalInclGst', new.accepted_total_incl_gst,
      'acceptedAt', new.accepted_at,
      'actionUrl', v_action_url,
      'acceptanceId', new.id
    )
  )
  on conflict (org_id, recipient_user_id, notification_type, resource_id)
  do nothing
  returning id into v_notification_id;

  if v_notification_id is null then
    select id into v_notification_id
    from public.notifications
    where org_id = new.org_id
      and recipient_user_id = v_recipient
      and notification_type = 'quote_accepted'
      and resource_id = new.quote_id;
  end if;

  if v_builder_email is not null then
    insert into public.notification_deliveries (
      org_id, notification_id, channel, email_kind, recipient_email,
      status, idempotency_key, action_url
    )
    values (
      new.org_id, v_notification_id, 'email', 'quote_accepted_builder', v_builder_email,
      'pending',
      'quote-accepted-builder:v1:' || new.id::text || ':' || v_recipient::text,
      v_action_url
    )
    on conflict (idempotency_key) do nothing;
  end if;

  if new.signer_email is not null and length(btrim(new.signer_email)) > 0 then
    insert into public.notification_deliveries (
      org_id, notification_id, channel, email_kind, recipient_email,
      status, idempotency_key, action_url
    )
    values (
      new.org_id, v_notification_id, 'email', 'quote_accepted_client', btrim(new.signer_email),
      'pending',
      'quote-accepted-client:v1:' || new.id::text || ':' || lower(btrim(new.signer_email)),
      null
    )
    on conflict (idempotency_key) do nothing;
  end if;

  return new;
end;
$$;

create or replace function public.quote_enqueue_client_decline_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.quotes%rowtype;
  v_project_title text;
  v_recipient uuid;
  v_builder_email text;
  v_notification_id uuid;
  v_ref text;
  v_note text;
  v_body text;
  v_action_url text;
begin
  if new.source is distinct from 'client' then
    return new;
  end if;

  select * into v_quote from public.quotes where id = new.quote_id;
  if not found then
    return new;
  end if;

  select title into v_project_title
  from public.projects
  where id = new.project_id;

  v_recipient := public.quote_notification_builder_recipient(v_quote);
  if v_recipient is null then
    return new;
  end if;

  v_builder_email := public.quote_notification_user_email(v_recipient);
  v_ref := coalesce(nullif(btrim(new.quote_number), ''), v_quote.title);
  v_note := nullif(btrim(coalesce(new.message, '')), '');
  v_body :=
    coalesce(nullif(btrim(coalesce(v_quote.client_name, '')), ''), 'A client')
    || ' declined '
    || v_ref
    || ' · Revision '
    || new.revision_number::text
    || case when v_project_title is not null then E'\n' || v_project_title else '' end
    || case when v_note is not null then E'\n' || left(v_note, 240) else '' end;
  v_action_url := '/app/projects/' || new.project_id::text || '/quotes/' || new.quote_id::text;

  insert into public.notifications (
    org_id, recipient_user_id, notification_type, title, body,
    resource_type, resource_id, project_id, payload
  )
  values (
    new.org_id, v_recipient, 'quote_declined', 'Quote declined', v_body,
    'quote', new.quote_id, new.project_id,
    jsonb_build_object(
      'source', 'client',
      'signerName', nullif(btrim(coalesce(v_quote.client_name, '')), ''),
      'quoteNumber', new.quote_number,
      'revisionNumber', new.revision_number,
      'projectTitle', v_project_title,
      'declinedAt', new.declined_at,
      'messagePreview', v_note,
      'actionUrl', v_action_url,
      'declineId', new.id
    )
  )
  on conflict (org_id, recipient_user_id, notification_type, resource_id)
  do nothing
  returning id into v_notification_id;

  if v_notification_id is null then
    select id into v_notification_id
    from public.notifications
    where org_id = new.org_id
      and recipient_user_id = v_recipient
      and notification_type = 'quote_declined'
      and resource_id = new.quote_id;
  end if;

  if v_builder_email is not null then
    insert into public.notification_deliveries (
      org_id, notification_id, channel, email_kind, recipient_email,
      status, idempotency_key, action_url
    )
    values (
      new.org_id, v_notification_id, 'email', 'quote_declined_builder', v_builder_email,
      'pending',
      'quote-declined-builder:v1:' || new.id::text || ':' || v_recipient::text,
      v_action_url
    )
    on conflict (idempotency_key) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists quote_acceptances_enqueue_notifications on public.quote_acceptances;
create trigger quote_acceptances_enqueue_notifications
  after insert on public.quote_acceptances
  for each row
  execute function public.quote_enqueue_client_acceptance_notifications();

drop trigger if exists quote_declines_enqueue_notifications on public.quote_declines;
create trigger quote_declines_enqueue_notifications
  after insert on public.quote_declines
  for each row
  execute function public.quote_enqueue_client_decline_notifications();
