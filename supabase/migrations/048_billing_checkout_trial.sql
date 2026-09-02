-- Quotr 2.0 — BILLING-3 trial initialization + Preview bootstrap helpers.
-- LOCAL ONLY. Do not apply until owner review.
-- Do NOT apply to Production in this programme (Production remains on 045).
-- Environment-neutral SQL: the same 048 may later join the common chain.
-- Preview vs Production differ only by ops-set billing_runtime_config
-- (test vs live). This file does NOT seed that row and does NOT hardcode test.
-- Additive. No membership/invitation tables. No overlay columns.

-- ---------------------------------------------------------------------------
-- A. DB billing environment authority (singleton, ops/service_role only)
-- Preview ops: INSERT billing_environment = 'test'
-- Future Production ops: INSERT billing_environment = 'live'
-- Missing / invalid / extra rows: fail closed.
-- ---------------------------------------------------------------------------

create table if not exists public.billing_runtime_config (
  id boolean primary key default true check (id),
  billing_environment text not null check (billing_environment in ('test', 'live')),
  updated_at timestamptz not null default now()
);

comment on table public.billing_runtime_config is
  'Singleton billing environment for this database. Ops/service_role only. Preview=test, Production=live. Never browser, never NEXT_PUBLIC, never project-ref inference.';

alter table public.billing_runtime_config enable row level security;

revoke all on table public.billing_runtime_config from public, anon, authenticated;
grant select, insert, update, delete on table public.billing_runtime_config to service_role;

-- No authenticated policies: customers cannot read or write this table.
-- billing_runtime_environment() is SECURITY DEFINER and is the only customer-facing read.

create or replace function public.billing_runtime_environment()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_env text;
begin
  select count(*)::integer
    into v_count
  from public.billing_runtime_config;

  if v_count is distinct from 1 then
    raise exception 'BILLING:RUNTIME_ENV_UNCONFIGURED'
      using errcode = 'P0001';
  end if;

  select c.billing_environment
    into v_env
  from public.billing_runtime_config c
  where c.id = true;

  if v_env is distinct from 'test' and v_env is distinct from 'live' then
    raise exception 'BILLING:RUNTIME_ENV_INVALID'
      using errcode = 'P0001';
  end if;

  return v_env;
end;
$$;

comment on function public.billing_runtime_environment() is
  'Trusted DB billing environment (test|live) from billing_runtime_config. Fail closed if missing, duplicated, or invalid. Not browser-supplied. Not NEXT_PUBLIC. Not a hardcoded Preview/Production project ref.';

revoke all on function public.billing_runtime_environment() from public, anon;
grant execute on function public.billing_runtime_environment() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- B. Idempotent internal trial insert
-- First valid insert wins. Never updates trial_ends_at.
-- billing_environment comes from billing_runtime_environment() only.
-- Not granted to authenticated: only provision (definer) and service_role.
-- ---------------------------------------------------------------------------

create or replace function public.ensure_org_internal_trial(p_org_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_env text := public.billing_runtime_environment();
  v_row_count integer := 0;
begin
  if p_org_id is null then
    raise exception 'BILLING:TRIAL_ORG_REQUIRED'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.organisations o where o.id = p_org_id
  ) then
    raise exception 'BILLING:TRIAL_ORG_MISSING'
      using errcode = 'P0001';
  end if;

  insert into public.org_subscriptions (
    org_id,
    billing_environment,
    plan_code,
    status,
    source,
    paid_seat_quantity,
    current_period_start,
    current_period_end,
    trial_ends_at,
    stripe_subscription_id,
    stripe_customer_id,
    stripe_base_price_id,
    stripe_seat_price_id,
    cancel_at_period_end,
    cancelled_at,
    last_stripe_event_created_at,
    last_stripe_event_id
  )
  values (
    p_org_id,
    v_env,
    'business',
    'trialing',
    'internal_trial',
    1,
    now(),
    now() + interval '14 days',
    now() + interval '14 days',
    null,
    null,
    null,
    null,
    false,
    null,
    null,
    null
  )
  on conflict (org_id, billing_environment) do nothing;

  get diagnostics v_row_count = row_count;
  return coalesce(v_row_count, 0) > 0;
end;
$$;

comment on function public.ensure_org_internal_trial(uuid) is
  'BILLING-3: insert source=internal_trial for org+env if missing. Env from billing_runtime_environment(). Idempotent. Never resets trial_ends_at. Server/provision authority only.';

revoke all on function public.ensure_org_internal_trial(uuid) from public, anon, authenticated;
grant execute on function public.ensure_org_internal_trial(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- C. Provision: trial starts when the organisation is provisioned
-- ---------------------------------------------------------------------------

create or replace function public.provision_organisation_for_new_user(
  p_organisation_name text,
  p_full_name text
)
returns table (
  org_id uuid,
  profile_id uuid,
  already_provisioned boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_existing_org uuid;
  v_org_exists boolean;
  v_org_id uuid;
  v_org_name text;
  v_full_name text;
begin
  if v_uid is null then
    raise exception 'PROVISION:NOT_AUTHENTICATED'
      using errcode = 'P0001';
  end if;

  v_org_name := nullif(btrim(p_organisation_name), '');
  v_full_name := nullif(btrim(p_full_name), '');

  if v_org_name is null then
    raise exception 'PROVISION:INVALID_ORGANISATION_NAME'
      using errcode = 'P0001';
  end if;

  if char_length(v_org_name) > 200 then
    raise exception 'PROVISION:INVALID_ORGANISATION_NAME'
      using errcode = 'P0001';
  end if;

  if v_full_name is null then
    raise exception 'PROVISION:INVALID_FULL_NAME'
      using errcode = 'P0001';
  end if;

  if char_length(v_full_name) > 200 then
    raise exception 'PROVISION:INVALID_FULL_NAME'
      using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(87230132, hashtext(v_uid::text));

  select p.org_id
    into v_existing_org
  from public.profiles p
  where p.id = v_uid;

  if found then
    if v_existing_org is null then
      raise exception 'PROVISION:PROFILE_INCONSISTENT'
        using errcode = 'P0001';
    end if;

    select exists (
      select 1
      from public.organisations o
      where o.id = v_existing_org
    )
      into v_org_exists;

    if not coalesce(v_org_exists, false) then
      raise exception 'PROVISION:PROFILE_INCONSISTENT'
        using errcode = 'P0001';
    end if;

    -- Idempotent: do not create another organisation.
    -- Fill a missing trial row without extending an existing trial_ends_at.
    perform public.ensure_org_internal_trial(v_existing_org);

    return query
    select v_existing_org, v_uid, true;
    return;
  end if;

  insert into public.organisations (name)
  values (v_org_name)
  returning id into v_org_id;

  insert into public.profiles (id, org_id, full_name, role)
  values (v_uid, v_org_id, v_full_name, 'owner');

  perform public.ensure_org_internal_trial(v_org_id);

  return query
  select v_org_id, v_uid, false;
end;
$$;

comment on function public.provision_organisation_for_new_user(text, text) is
  'Atomically create organisation + owner profile + internal 14-day trial for auth.uid(). Idempotent. Never accepts user_id/org_id/billing_environment. Trial insert cannot reset trial_ends_at.';

-- ---------------------------------------------------------------------------
-- D. Preview bootstrap: existing orgs with no billing row get a FRESH trial
-- Do not derive trial_ends_at from organisations.created_at.
-- Existing Stripe / trial / override rows are left untouched.
-- service_role only. Refuses unless billing_runtime_environment() = test.
-- live → hard failure, zero trial rows.
-- ---------------------------------------------------------------------------

create or replace function public.bootstrap_missing_preview_internal_trials()
returns table (
  orgs_total bigint,
  already_initialized bigint,
  inserted bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_env text := public.billing_runtime_environment();
  v_orgs bigint;
  v_existing bigint;
  v_inserted bigint;
begin
  if v_env is distinct from 'test' then
    raise exception 'BILLING:BOOTSTRAP_PREVIEW_TEST_ONLY'
      using errcode = 'P0001';
  end if;

  if coalesce(auth.role(), '') is distinct from 'service_role'
     and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'BILLING:BOOTSTRAP_SERVICE_ROLE_ONLY'
      using errcode = 'P0001';
  end if;

  select count(*)::bigint into v_orgs from public.organisations;

  select count(*)::bigint
    into v_existing
  from public.org_subscriptions s
  where s.billing_environment = v_env;

  insert into public.org_subscriptions (
    org_id,
    billing_environment,
    plan_code,
    status,
    source,
    paid_seat_quantity,
    current_period_start,
    current_period_end,
    trial_ends_at
  )
  select
    o.id,
    v_env,
    'business',
    'trialing',
    'internal_trial',
    1,
    now(),
    now() + interval '14 days',
    now() + interval '14 days'
  from public.organisations o
  where not exists (
    select 1
    from public.org_subscriptions s
    where s.org_id = o.id
      and s.billing_environment = v_env
  );

  get diagnostics v_inserted = row_count;

  return query
  select v_orgs, v_existing, coalesce(v_inserted, 0)::bigint;
end;
$$;

comment on function public.bootstrap_missing_preview_internal_trials() is
  'Preview bootstrap only when billing_runtime_environment()=test. live fails closed with zero inserts. Fresh 14-day trial from now(). Does not use organisations.created_at. service_role/postgres only.';

revoke all on function public.bootstrap_missing_preview_internal_trials() from public, anon, authenticated;
grant execute on function public.bootstrap_missing_preview_internal_trials() to service_role;

notify pgrst, 'reload schema';
