-- Account welcome activation boundary and idempotency window.
-- Replaces the two-hour account-age cutoff. A confirmed self-signup is
-- eligible when confirmation is at or after activated_at, including a
-- confirmation that arrives days later. Confirmations before activation,
-- invitations, and any other existing account are refused. Nothing here
-- scans or backfills.
-- The idempotency key may be retried for 24 hours from the first claim.
-- After that, an unaccepted row is marked for operator reconciliation
-- and is not sent again.

alter table public.account_welcome_deliveries
  add column if not exists idempotency_started_at timestamptz,
  add column if not exists reconcile_required boolean not null default false;

create table if not exists public.account_welcome_runtime (
  id boolean primary key default true check (id),
  activated_at timestamptz not null
);

insert into public.account_welcome_runtime (id, activated_at)
values (true, clock_timestamp())
on conflict (id) do nothing;

comment on table public.account_welcome_runtime is
  'Singleton activation time for the account welcome. Confirmations before activated_at are not welcome recipients.';

alter table public.account_welcome_runtime enable row level security;
revoke all on table public.account_welcome_runtime from public, anon, authenticated;
grant select on table public.account_welcome_runtime to service_role;

create or replace function public.enqueue_account_welcome_signup_v1(
  p_user_id uuid,
  p_org_id uuid,
  p_environment text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_confirmed timestamptz;
  v_org uuid;
  v_name text;
  v_activated timestamptz;
  v_key text;
  v_row public.account_welcome_deliveries%rowtype;
begin
  if p_environment is distinct from 'preview'
     and p_environment is distinct from 'production'
     and p_environment is distinct from 'development' then
    raise exception 'WELCOME:ENVIRONMENT' using errcode = 'P0001';
  end if;

  select activated_at into v_activated
  from public.account_welcome_runtime
  where id = true;

  if v_activated is null then
    raise exception 'WELCOME:NOT_ACTIVATED' using errcode = 'P0001';
  end if;

  select u.email, u.email_confirmed_at
    into v_email, v_confirmed
  from auth.users u
  where u.id = p_user_id;

  if v_email is null or v_confirmed is null then
    raise exception 'WELCOME:NOT_CONFIRMED' using errcode = 'P0001';
  end if;

  if v_confirmed < v_activated then
    raise exception 'WELCOME:BEFORE_ACTIVATION' using errcode = 'P0001';
  end if;

  v_email := lower(btrim(v_email));

  select p.org_id, p.full_name
    into v_org, v_name
  from public.profiles p
  where p.id = p_user_id
    and p.org_id is not null
    and p.role = 'owner';

  if v_org is null or v_org is distinct from p_org_id then
    raise exception 'WELCOME:NO_PROFILE' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.organisation_invitations i
    where i.email_normalized = v_email
      and i.status in ('pending', 'accepting')
  ) then
    raise exception 'WELCOME:INVITE' using errcode = 'P0001';
  end if;

  v_key := 'account-welcome-v1:' || p_environment || ':' || p_user_id::text;

  insert into public.account_welcome_deliveries (
    user_id, org_id, environment, template_version, source,
    recipient_email, full_name, status, idempotency_key
  )
  values (
    p_user_id, v_org, p_environment, 'account-welcome-v1', 'signup',
    v_email, nullif(btrim(v_name), ''), 'pending', v_key
  )
  on conflict (user_id, template_version, environment, source) do nothing;

  select * into v_row
  from public.account_welcome_deliveries
  where user_id = p_user_id
    and template_version = 'account-welcome-v1'
    and environment = p_environment
    and source = 'signup';

  return jsonb_build_object(
    'ok', true,
    'id', v_row.id,
    'status', v_row.status,
    'idempotency_key', v_row.idempotency_key,
    'provider_message_id', v_row.provider_message_id
  );
end;
$$;

create or replace function public.claim_account_welcome_delivery_v1(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.account_welcome_deliveries%rowtype;
begin
  select * into v_row
  from public.account_welcome_deliveries
  where id = p_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;

  if v_row.status = 'accepted' and v_row.provider_message_id is not null then
    return jsonb_build_object(
      'ok', true,
      'claimed', false,
      'reason', 'accepted',
      'idempotency_key', v_row.idempotency_key,
      'provider_message_id', v_row.provider_message_id
    );
  end if;

  if v_row.reconcile_required then
    return jsonb_build_object(
      'ok', true,
      'claimed', false,
      'reason', 'reconcile',
      'idempotency_key', v_row.idempotency_key
    );
  end if;

  if v_row.provider_message_id is null
     and v_row.idempotency_started_at is not null
     and v_row.idempotency_started_at <= now() - interval '24 hours' then
    update public.account_welcome_deliveries
      set reconcile_required = true,
          status = 'failed',
          lease_until = null,
          failed_at = coalesce(failed_at, now()),
          last_error_safe = 'Reconciliation required. The 24-hour idempotency window has elapsed.'
    where id = p_id
      and provider_message_id is null
    returning * into v_row;

    return jsonb_build_object(
      'ok', true,
      'claimed', false,
      'reason', 'reconcile',
      'idempotency_key', v_row.idempotency_key
    );
  end if;

  if v_row.status = 'sending'
     and v_row.lease_until is not null
     and v_row.lease_until > now() then
    return jsonb_build_object(
      'ok', true,
      'claimed', false,
      'reason', 'in_flight',
      'idempotency_key', v_row.idempotency_key
    );
  end if;

  update public.account_welcome_deliveries
    set status = 'sending',
        lease_until = now() + interval '90 seconds',
        attempt_count = attempt_count + 1,
        idempotency_started_at = coalesce(idempotency_started_at, now())
  where id = p_id
  returning * into v_row;

  return jsonb_build_object(
    'ok', true,
    'claimed', true,
    'id', v_row.id,
    'status', v_row.status,
    'idempotency_key', v_row.idempotency_key,
    'recipient_email', v_row.recipient_email,
    'full_name', v_row.full_name,
    'provider_message_id', v_row.provider_message_id,
    'lease_until', v_row.lease_until,
    'source', v_row.source,
    'environment', v_row.environment,
    'idempotency_started_at', v_row.idempotency_started_at
  );
end;
$$;

revoke all on function public.enqueue_account_welcome_signup_v1(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.claim_account_welcome_delivery_v1(uuid)
  from public, anon, authenticated;

grant execute on function public.enqueue_account_welcome_signup_v1(uuid, uuid, text) to service_role;
grant execute on function public.claim_account_welcome_delivery_v1(uuid) to service_role;

notify pgrst, 'reload schema';
