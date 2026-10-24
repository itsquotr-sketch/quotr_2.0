-- Paid plan confirmation outbox.
-- One activation row per Stripe subscription and environment.
-- Does not scan existing subscriptions and does not send on renewal.
-- Preview test rows are a separate source and can only address the
-- designated preview recipient. Delivery stays outside subscription writes.

create table if not exists public.plan_confirmation_deliveries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organisations (id) on delete set null,
  billing_environment text check (billing_environment in ('test', 'live')),
  environment text not null check (environment in ('preview', 'production', 'development')),
  template_version text not null check (template_version = 'plan-confirmation-v1'),
  source text not null check (source in ('activation', 'preview_test')),
  stripe_subscription_id text,
  stripe_customer_id text,
  recipient_email text,
  company_name text,
  plan_code text check (plan_code in ('builder', 'business')),
  included_users integer,
  paid_users integer,
  currency text,
  recurring_exclusive_cents integer,
  recurring_tax_cents integer,
  tax_display_name text,
  tax_percent numeric,
  tax_inclusive boolean,
  opening_exclusive_cents integer,
  opening_tax_cents integer,
  opening_total_cents integer,
  opening_kind text check (
    opening_kind is null
    or opening_kind in ('prorated', 'discounted', 'prorated_discounted')
  ),
  next_billing_at timestamptz,
  billing_url text,
  status text not null default 'pending' check (status in ('pending', 'sending', 'accepted', 'failed')),
  idempotency_key text not null,
  provider text not null default 'resend',
  provider_message_id text,
  attempt_count integer not null default 0,
  lease_until timestamptz,
  idempotency_started_at timestamptz,
  reconcile_required boolean not null default false,
  last_error_safe text,
  accepted_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists plan_confirmation_activation_uidx
  on public.plan_confirmation_deliveries (environment, stripe_subscription_id)
  where source = 'activation';

create unique index if not exists plan_confirmation_preview_test_uidx
  on public.plan_confirmation_deliveries (environment)
  where source = 'preview_test';

create unique index if not exists plan_confirmation_idempotency_uidx
  on public.plan_confirmation_deliveries (idempotency_key);

create index if not exists plan_confirmation_retry_idx
  on public.plan_confirmation_deliveries (environment, status, created_at)
  where status in ('pending', 'failed', 'sending');

comment on table public.plan_confirmation_deliveries is
  'Service email for the first activation of a paid Stripe plan. Not marketing, not a tax invoice, and not a renewal. Existing subscriptions are not backfilled.';

alter table public.plan_confirmation_deliveries enable row level security;

revoke all on table public.plan_confirmation_deliveries from public, anon, authenticated;
grant select, insert, update, delete on table public.plan_confirmation_deliveries to service_role;

create or replace function public.enqueue_paid_plan_confirmation_v1(
  p_org_id uuid,
  p_billing_environment text,
  p_environment text,
  p_stripe_subscription_id text,
  p_stripe_customer_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_sub public.org_subscriptions%rowtype;
  v_key text;
  v_row public.plan_confirmation_deliveries%rowtype;
begin
  if p_environment is distinct from 'preview'
     and p_environment is distinct from 'production'
     and p_environment is distinct from 'development' then
    raise exception 'PLAN:ENVIRONMENT' using errcode = 'P0001';
  end if;
  if p_billing_environment is distinct from 'test'
     and p_billing_environment is distinct from 'live' then
    raise exception 'PLAN:BILLING_ENVIRONMENT' using errcode = 'P0001';
  end if;
  if p_stripe_subscription_id is null or btrim(p_stripe_subscription_id) = '' then
    raise exception 'PLAN:SUBSCRIPTION' using errcode = 'P0001';
  end if;

  select * into v_sub
  from public.org_subscriptions s
  where s.org_id = p_org_id
    and s.billing_environment = p_billing_environment;

  if v_sub.id is null
     or v_sub.source is distinct from 'stripe'
     or v_sub.status is distinct from 'active'
     or v_sub.plan_code not in ('builder', 'business')
     or v_sub.stripe_subscription_id is distinct from p_stripe_subscription_id
     or v_sub.stripe_customer_id is distinct from p_stripe_customer_id then
    raise exception 'PLAN:NOT_ACTIVE' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.org_billing_overrides o
    where o.org_id = p_org_id
      and o.billing_environment = p_billing_environment
      and o.status is distinct from 'expired'
      and o.status is distinct from 'revoked'
      and o.starts_at <= now()
      and (o.expires_at is null or o.expires_at > now())
  ) then
    raise exception 'PLAN:OVERRIDE' using errcode = 'P0001';
  end if;

  v_key := 'plan-confirmation-v1:' || p_environment || ':' || p_stripe_subscription_id;

  insert into public.plan_confirmation_deliveries (
    org_id, billing_environment, environment, template_version, source,
    stripe_subscription_id, stripe_customer_id, status, idempotency_key
  )
  values (
    p_org_id, p_billing_environment, p_environment, 'plan-confirmation-v1', 'activation',
    p_stripe_subscription_id, p_stripe_customer_id, 'pending', v_key
  )
  on conflict (environment, stripe_subscription_id) where source = 'activation' do nothing;

  select * into v_row
  from public.plan_confirmation_deliveries
  where environment = p_environment
    and stripe_subscription_id = p_stripe_subscription_id
    and source = 'activation';

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

create or replace function public.save_paid_plan_confirmation_snapshot_v1(
  p_id uuid,
  p_recipient_email text,
  p_company_name text,
  p_plan_code text,
  p_included_users integer,
  p_paid_users integer,
  p_currency text,
  p_recurring_exclusive_cents integer,
  p_recurring_tax_cents integer,
  p_tax_display_name text,
  p_tax_percent numeric,
  p_tax_inclusive boolean,
  p_opening_exclusive_cents integer,
  p_opening_tax_cents integer,
  p_opening_total_cents integer,
  p_opening_kind text,
  p_next_billing_at timestamptz,
  p_billing_url text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_row public.plan_confirmation_deliveries%rowtype;
  v_email text;
  v_stored text;
  v_company text;
begin
  select * into v_row
  from public.plan_confirmation_deliveries
  where id = p_id
  for update;

  if not found then
    raise exception 'PLAN:NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_row.provider_message_id is not null or v_row.status = 'accepted' then
    return jsonb_build_object('ok', true, 'id', v_row.id, 'status', v_row.status, 'unchanged', true);
  end if;
  if v_row.source is distinct from 'activation' then
    raise exception 'PLAN:SOURCE' using errcode = 'P0001';
  end if;
  if v_row.recurring_exclusive_cents is not null and v_row.recipient_email is not null then
    return jsonb_build_object(
      'ok', true,
      'id', v_row.id,
      'status', v_row.status,
      'unchanged', true,
      'recipient_email', v_row.recipient_email
    );
  end if;

  select lower(btrim(c.billing_email)) into v_stored
  from public.org_billing_customers c
  where c.org_id = v_row.org_id
    and c.billing_environment = v_row.billing_environment
    and c.stripe_customer_id = v_row.stripe_customer_id;

  v_email := lower(btrim(coalesce(p_recipient_email, '')));
  if v_email = '' or v_stored is null or v_email is distinct from v_stored then
    raise exception 'PLAN:RECIPIENT' using errcode = 'P0001';
  end if;
  if not exists (
    select 1
    from public.organisation_memberships m
    join auth.users u on u.id = m.user_id
    where m.org_id = v_row.org_id
      and m.role = 'owner'
      and m.status = 'active'
      and u.email_confirmed_at is not null
      and lower(btrim(u.email)) = v_email
  ) then
    raise exception 'PLAN:RECIPIENT' using errcode = 'P0001';
  end if;

  if p_plan_code not in ('builder', 'business')
     or p_included_users is null or p_included_users < 1
     or p_paid_users is null or p_paid_users < 1
     or p_currency is null or char_length(btrim(p_currency)) <> 3
     or p_recurring_exclusive_cents is null or p_recurring_exclusive_cents < 0
     or p_recurring_tax_cents is null or p_recurring_tax_cents < 0
     or p_billing_url is null
     or p_billing_url !~ '^https://'
     or position('quotr-2-0-git-preview-android-free-signup' in p_billing_url) > 0
     or (
       p_opening_kind is not null
       and p_opening_kind not in ('prorated', 'discounted', 'prorated_discounted')
     ) then
    raise exception 'PLAN:SNAPSHOT' using errcode = 'P0001';
  end if;

  select coalesce(nullif(btrim(settings.trading_name), ''), nullif(btrim(org.name), ''), 'Your company')
    into v_company
  from public.organisations org
  left join public.organisation_settings settings on settings.org_id = org.id
  where org.id = v_row.org_id;

  if v_company is null then
    v_company := nullif(btrim(coalesce(p_company_name, '')), '');
  end if;
  if v_company is null then
    raise exception 'PLAN:COMPANY' using errcode = 'P0001';
  end if;

  update public.plan_confirmation_deliveries
    set recipient_email = v_email,
        company_name = v_company,
        plan_code = p_plan_code,
        included_users = p_included_users,
        paid_users = p_paid_users,
        currency = lower(btrim(p_currency)),
        recurring_exclusive_cents = p_recurring_exclusive_cents,
        recurring_tax_cents = p_recurring_tax_cents,
        tax_display_name = nullif(btrim(coalesce(p_tax_display_name, '')), ''),
        tax_percent = p_tax_percent,
        tax_inclusive = coalesce(p_tax_inclusive, false),
        opening_exclusive_cents = p_opening_exclusive_cents,
        opening_tax_cents = p_opening_tax_cents,
        opening_total_cents = p_opening_total_cents,
        opening_kind = p_opening_kind,
        next_billing_at = p_next_billing_at,
        billing_url = p_billing_url
  where id = p_id
    and provider_message_id is null
  returning * into v_row;

  return jsonb_build_object('ok', true, 'id', v_row.id, 'status', v_row.status, 'recipient_email', v_row.recipient_email);
end;
$$;

create or replace function public.enqueue_paid_plan_confirmation_preview_test_v1(
  p_plan_code text,
  p_included_users integer,
  p_paid_users integer,
  p_currency text,
  p_recurring_exclusive_cents integer,
  p_recurring_tax_cents integer,
  p_tax_display_name text,
  p_tax_percent numeric,
  p_tax_inclusive boolean,
  p_opening_exclusive_cents integer,
  p_opening_tax_cents integer,
  p_opening_total_cents integer,
  p_opening_kind text,
  p_next_billing_at timestamptz,
  p_billing_url text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid;
  v_email text;
  v_confirmed timestamptz;
  v_org uuid;
  v_count integer;
  v_company text;
  v_key text;
  v_row public.plan_confirmation_deliveries%rowtype;
begin
  select count(*)::integer into v_count
  from auth.users u
  where lower(btrim(u.email)) = 'hello+test@erccontracting.co.nz';

  if v_count is distinct from 1 then
    raise exception 'PLAN:TEST_RECIPIENT' using errcode = 'P0001';
  end if;

  select u.id, lower(btrim(u.email)), u.email_confirmed_at
    into v_user, v_email, v_confirmed
  from auth.users u
  where lower(btrim(u.email)) = 'hello+test@erccontracting.co.nz';

  if v_confirmed is null or v_email is distinct from 'hello+test@erccontracting.co.nz' then
    raise exception 'PLAN:TEST_RECIPIENT' using errcode = 'P0001';
  end if;

  select p.org_id into v_org
  from public.profiles p
  where p.id = v_user;

  select coalesce(nullif(btrim(settings.trading_name), ''), nullif(btrim(org.name), ''), 'Preview test company')
    into v_company
  from public.organisations org
  left join public.organisation_settings settings on settings.org_id = org.id
  where org.id = v_org;

  if v_company is null then
    v_company := 'Preview test company';
  end if;

  if p_plan_code not in ('builder', 'business')
     or p_included_users is null or p_included_users < 1
     or p_paid_users is null or p_paid_users < 1
     or p_recurring_exclusive_cents is null or p_recurring_exclusive_cents < 0
     or p_recurring_tax_cents is null or p_recurring_tax_cents < 0
     or p_billing_url is null
     or p_billing_url !~ '^https://'
     or position('quotr-2-0-git-preview-android-free-signup' in p_billing_url) > 0 then
    raise exception 'PLAN:SNAPSHOT' using errcode = 'P0001';
  end if;

  v_key := 'plan-confirmation-v1:preview:test';

  insert into public.plan_confirmation_deliveries (
    org_id, billing_environment, environment, template_version, source,
    stripe_subscription_id, stripe_customer_id, recipient_email, company_name,
    plan_code, included_users, paid_users, currency,
    recurring_exclusive_cents, recurring_tax_cents, tax_display_name, tax_percent, tax_inclusive,
    opening_exclusive_cents, opening_tax_cents, opening_total_cents, opening_kind,
    next_billing_at, billing_url, status, idempotency_key
  )
  values (
    v_org, null, 'preview', 'plan-confirmation-v1', 'preview_test',
    'preview-test', null, v_email, v_company,
    p_plan_code, p_included_users, p_paid_users, lower(btrim(p_currency)),
    p_recurring_exclusive_cents, p_recurring_tax_cents, nullif(btrim(coalesce(p_tax_display_name, '')), ''), p_tax_percent, coalesce(p_tax_inclusive, false),
    p_opening_exclusive_cents, p_opening_tax_cents, p_opening_total_cents, p_opening_kind,
    p_next_billing_at, p_billing_url, 'pending', v_key
  )
  on conflict (environment) where source = 'preview_test' do nothing;

  select * into v_row
  from public.plan_confirmation_deliveries
  where environment = 'preview'
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

create or replace function public.claim_paid_plan_confirmation_v1(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.plan_confirmation_deliveries%rowtype;
begin
  select * into v_row
  from public.plan_confirmation_deliveries
  where id = p_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;

  if v_row.status = 'accepted' and v_row.provider_message_id is not null then
    return jsonb_build_object(
      'ok', true, 'claimed', false, 'reason', 'accepted',
      'idempotency_key', v_row.idempotency_key,
      'provider_message_id', v_row.provider_message_id
    );
  end if;

  if v_row.reconcile_required then
    return jsonb_build_object(
      'ok', true, 'claimed', false, 'reason', 'reconcile',
      'idempotency_key', v_row.idempotency_key
    );
  end if;

  if v_row.provider_message_id is null
     and v_row.idempotency_started_at is not null
     and v_row.idempotency_started_at <= now() - interval '24 hours' then
    update public.plan_confirmation_deliveries
      set reconcile_required = true,
          status = 'failed',
          lease_until = null,
          failed_at = coalesce(failed_at, now()),
          last_error_safe = 'Reconciliation required. The 24-hour idempotency window has elapsed.'
    where id = p_id
      and provider_message_id is null
    returning * into v_row;
    return jsonb_build_object(
      'ok', true, 'claimed', false, 'reason', 'reconcile',
      'idempotency_key', v_row.idempotency_key
    );
  end if;

  if v_row.status = 'sending'
     and v_row.lease_until is not null
     and v_row.lease_until > now() then
    return jsonb_build_object(
      'ok', true, 'claimed', false, 'reason', 'in_flight',
      'idempotency_key', v_row.idempotency_key
    );
  end if;

  if v_row.recipient_email is null
     or v_row.company_name is null
     or v_row.plan_code is null
     or v_row.recurring_exclusive_cents is null
     or v_row.billing_url is null then
    return jsonb_build_object('ok', true, 'claimed', false, 'reason', 'incomplete', 'idempotency_key', v_row.idempotency_key);
  end if;

  update public.plan_confirmation_deliveries
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
    'source', v_row.source,
    'environment', v_row.environment,
    'idempotency_key', v_row.idempotency_key,
    'idempotency_started_at', v_row.idempotency_started_at,
    'recipient_email', v_row.recipient_email,
    'company_name', v_row.company_name,
    'plan_code', v_row.plan_code,
    'included_users', v_row.included_users,
    'paid_users', v_row.paid_users,
    'currency', v_row.currency,
    'recurring_exclusive_cents', v_row.recurring_exclusive_cents,
    'recurring_tax_cents', v_row.recurring_tax_cents,
    'tax_display_name', v_row.tax_display_name,
    'tax_inclusive', v_row.tax_inclusive,
    'opening_exclusive_cents', v_row.opening_exclusive_cents,
    'opening_tax_cents', v_row.opening_tax_cents,
    'opening_total_cents', v_row.opening_total_cents,
    'opening_kind', v_row.opening_kind,
    'next_billing_at', v_row.next_billing_at,
    'billing_url', v_row.billing_url,
    'provider_message_id', v_row.provider_message_id,
    'lease_until', v_row.lease_until
  );
end;
$$;

create or replace function public.acknowledge_paid_plan_confirmation_v1(
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

  update public.plan_confirmation_deliveries
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

create or replace function public.fail_paid_plan_confirmation_v1(
  p_id uuid,
  p_error_safe text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.plan_confirmation_deliveries
    set status = 'failed',
        last_error_safe = left(coalesce(p_error_safe, 'The email could not be sent.'), 180),
        failed_at = now(),
        lease_until = null
  where id = p_id
    and status in ('pending', 'sending')
    and provider_message_id is null;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.enqueue_paid_plan_confirmation_v1(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.save_paid_plan_confirmation_snapshot_v1(uuid, text, text, text, integer, integer, text, integer, integer, text, numeric, boolean, integer, integer, integer, text, timestamptz, text) from public, anon, authenticated;
revoke all on function public.enqueue_paid_plan_confirmation_preview_test_v1(text, integer, integer, text, integer, integer, text, numeric, boolean, integer, integer, integer, text, timestamptz, text) from public, anon, authenticated;
revoke all on function public.claim_paid_plan_confirmation_v1(uuid) from public, anon, authenticated;
revoke all on function public.acknowledge_paid_plan_confirmation_v1(uuid, text) from public, anon, authenticated;
revoke all on function public.fail_paid_plan_confirmation_v1(uuid, text) from public, anon, authenticated;

grant execute on function public.enqueue_paid_plan_confirmation_v1(uuid, text, text, text, text) to service_role;
grant execute on function public.save_paid_plan_confirmation_snapshot_v1(uuid, text, text, text, integer, integer, text, integer, integer, text, numeric, boolean, integer, integer, integer, text, timestamptz, text) to service_role;
grant execute on function public.enqueue_paid_plan_confirmation_preview_test_v1(text, integer, integer, text, integer, integer, text, numeric, boolean, integer, integer, integer, text, timestamptz, text) to service_role;
grant execute on function public.claim_paid_plan_confirmation_v1(uuid) to service_role;
grant execute on function public.acknowledge_paid_plan_confirmation_v1(uuid, text) to service_role;
grant execute on function public.fail_paid_plan_confirmation_v1(uuid, text) to service_role;

notify pgrst, 'reload schema';
