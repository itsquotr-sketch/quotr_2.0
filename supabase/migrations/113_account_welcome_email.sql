-- Account welcome email outbox.
-- One row per user, template version, environment, and source.
-- Does not scan or email existing accounts. Signup rows are refused unless
-- the profile and organisation were created in the last two hours.
-- Does not change marketing consent or Loops. Preview and Production are
-- separate databases; the environment column and idempotency key keep a
-- shared Resend account from treating them as the same send.

create table if not exists public.account_welcome_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  org_id uuid references public.organisations (id) on delete set null,
  environment text not null check (environment in ('preview', 'production', 'development')),
  template_version text not null check (template_version = 'account-welcome-v1'),
  source text not null check (source in ('signup', 'preview_test')),
  recipient_email text not null,
  full_name text,
  status text not null default 'pending' check (status in ('pending', 'sending', 'accepted', 'failed')),
  idempotency_key text not null,
  provider text not null default 'resend',
  provider_message_id text,
  attempt_count integer not null default 0,
  lease_until timestamptz,
  last_error_safe text,
  accepted_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists account_welcome_deliveries_identity_uidx
  on public.account_welcome_deliveries (user_id, template_version, environment, source);

create unique index if not exists account_welcome_deliveries_idempotency_uidx
  on public.account_welcome_deliveries (idempotency_key);

create index if not exists account_welcome_deliveries_retry_idx
  on public.account_welcome_deliveries (environment, status, created_at)
  where status in ('pending', 'failed', 'sending');

comment on table public.account_welcome_deliveries is
  'Service welcome email for a newly confirmed self-signup. Not marketing. Not a backfill. Idempotency key is stable for the user, version, and environment.';

alter table public.account_welcome_deliveries enable row level security;

revoke all on table public.account_welcome_deliveries from public, anon, authenticated;
grant select, insert, update, delete on table public.account_welcome_deliveries to service_role;

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
  v_profile_created timestamptz;
  v_org_created timestamptz;
  v_key text;
  v_row public.account_welcome_deliveries%rowtype;
begin
  if p_environment is distinct from 'preview'
     and p_environment is distinct from 'production'
     and p_environment is distinct from 'development' then
    raise exception 'WELCOME:ENVIRONMENT' using errcode = 'P0001';
  end if;

  select u.email, u.email_confirmed_at
    into v_email, v_confirmed
  from auth.users u
  where u.id = p_user_id;

  if v_email is null or v_confirmed is null then
    raise exception 'WELCOME:NOT_CONFIRMED' using errcode = 'P0001';
  end if;

  v_email := lower(btrim(v_email));

  select p.org_id, p.full_name, p.created_at
    into v_org, v_name, v_profile_created
  from public.profiles p
  where p.id = p_user_id
    and p.org_id is not null
    and p.role = 'owner';

  if v_org is null or v_org is distinct from p_org_id then
    raise exception 'WELCOME:NO_PROFILE' using errcode = 'P0001';
  end if;

  select o.created_at into v_org_created
  from public.organisations o
  where o.id = v_org;

  if v_profile_created < now() - interval '2 hours'
     and (v_org_created is null or v_org_created < now() - interval '2 hours') then
    raise exception 'WELCOME:NOT_NEW' using errcode = 'P0001';
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

create or replace function public.enqueue_account_welcome_preview_test_v1()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid;
  v_email text;
  v_confirmed timestamptz;
  v_name text;
  v_org uuid;
  v_count integer;
  v_key text;
  v_row public.account_welcome_deliveries%rowtype;
begin
  select count(*)::integer into v_count
  from auth.users u
  where lower(btrim(u.email)) = 'hello+test@erccontracting.co.nz';

  if v_count is distinct from 1 then
    raise exception 'WELCOME:TEST_RECIPIENT' using errcode = 'P0001';
  end if;

  select u.id, lower(btrim(u.email)), u.email_confirmed_at
    into v_user, v_email, v_confirmed
  from auth.users u
  where lower(btrim(u.email)) = 'hello+test@erccontracting.co.nz';

  if v_confirmed is null or v_email is distinct from 'hello+test@erccontracting.co.nz' then
    raise exception 'WELCOME:NOT_CONFIRMED' using errcode = 'P0001';
  end if;

  select p.full_name, p.org_id into v_name, v_org
  from public.profiles p
  where p.id = v_user;

  v_key := 'account-welcome-v1:preview:test:' || v_user::text;

  insert into public.account_welcome_deliveries (
    user_id, org_id, environment, template_version, source,
    recipient_email, full_name, status, idempotency_key
  )
  values (
    v_user, v_org, 'preview', 'account-welcome-v1', 'preview_test',
    v_email, nullif(btrim(v_name), ''), 'pending', v_key
  )
  on conflict (user_id, template_version, environment, source) do nothing;

  select * into v_row
  from public.account_welcome_deliveries
  where user_id = v_user
    and template_version = 'account-welcome-v1'
    and environment = 'preview'
    and source = 'preview_test';

  return jsonb_build_object(
    'ok', true,
    'id', v_row.id,
    'status', v_row.status,
    'idempotency_key', v_row.idempotency_key,
    'provider_message_id', v_row.provider_message_id,
    'recipient_email', v_row.recipient_email
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
        attempt_count = attempt_count + 1
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
    'source', v_row.source
  );
end;
$$;

create or replace function public.acknowledge_account_welcome_delivery_v1(
  p_id uuid,
  p_provider_message_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_provider_message_id is null or char_length(btrim(p_provider_message_id)) < 4 then
    return jsonb_build_object('ok', false, 'error', 'MESSAGE');
  end if;

  update public.account_welcome_deliveries
    set status = 'accepted',
        provider_message_id = btrim(p_provider_message_id),
        accepted_at = coalesce(accepted_at, now()),
        lease_until = null,
        last_error_safe = null
  where id = p_id
    and (
      status in ('sending', 'pending', 'failed')
      or (status = 'accepted' and provider_message_id = btrim(p_provider_message_id))
    )
    and (
      provider_message_id is null
      or provider_message_id = btrim(p_provider_message_id)
    )
  returning id into v_id;

  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'ACK');
  end if;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

create or replace function public.fail_account_welcome_delivery_v1(
  p_id uuid,
  p_error_safe text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.account_welcome_deliveries
    set status = 'failed',
        last_error_safe = left(coalesce(p_error_safe, 'The email could not be sent.'), 180),
        failed_at = now(),
        lease_until = null
  where id = p_id
    and status = 'sending'
    and provider_message_id is null;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.enqueue_account_welcome_signup_v1(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.enqueue_account_welcome_preview_test_v1()
  from public, anon, authenticated;
revoke all on function public.claim_account_welcome_delivery_v1(uuid)
  from public, anon, authenticated;
revoke all on function public.acknowledge_account_welcome_delivery_v1(uuid, text)
  from public, anon, authenticated;
revoke all on function public.fail_account_welcome_delivery_v1(uuid, text)
  from public, anon, authenticated;

grant execute on function public.enqueue_account_welcome_signup_v1(uuid, uuid, text) to service_role;
grant execute on function public.enqueue_account_welcome_preview_test_v1() to service_role;
grant execute on function public.claim_account_welcome_delivery_v1(uuid) to service_role;
grant execute on function public.acknowledge_account_welcome_delivery_v1(uuid, text) to service_role;
grant execute on function public.fail_account_welcome_delivery_v1(uuid, text) to service_role;

notify pgrst, 'reload schema';
