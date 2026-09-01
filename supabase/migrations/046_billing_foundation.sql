-- Quotr 2.0 — BILLING-1 organisation subscription authority foundation.
-- Additive billing tables only. Does not change estimating, Pricing, Quote
-- money, delivery, or acceptance. Does not enforce entitlements.
--
-- organisations.subscription_tier (free|pro|team) is dead legacy schema.
-- BILLING-1 does not reuse, migrate, or drop it.

-- ---------------------------------------------------------------------------
-- A. Deprecate legacy organisations.subscription_tier (comment only)
-- ---------------------------------------------------------------------------

comment on column public.organisations.subscription_tier is
  'DEPRECATED. Dead legacy schema (free|pro|team). Not Quotr billing authority. Do not read or write for SaaS access. Canonical billing lives in org_subscriptions / org_billing_overrides.';

-- ---------------------------------------------------------------------------
-- B. Shared updated_at
-- ---------------------------------------------------------------------------

create or replace function public.set_billing_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- C. org_billing_customers
-- ---------------------------------------------------------------------------

create table if not exists public.org_billing_customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  billing_environment text not null check (billing_environment in ('test', 'live')),
  stripe_customer_id text not null,
  billing_name text,
  billing_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, billing_environment),
  unique (stripe_customer_id, billing_environment)
);

create index if not exists org_billing_customers_org_env_idx
  on public.org_billing_customers (org_id, billing_environment);

comment on table public.org_billing_customers is
  'Trusted organisation ↔ Stripe Customer mapping. Server/webhook writes only. billing_environment is defence in depth even with separate Preview/Production databases.';

-- ---------------------------------------------------------------------------
-- D. org_subscriptions
-- ---------------------------------------------------------------------------

create table if not exists public.org_subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  billing_environment text not null check (billing_environment in ('test', 'live')),
  plan_code text not null check (plan_code in ('builder', 'business', 'custom')),
  status text not null check (
    status in (
      'trialing',
      'active',
      'past_due',
      'unpaid',
      'paused',
      'cancelled',
      'incomplete',
      'scheduled_to_cancel',
      'administratively_comped',
      'custom_contract'
    )
  ),
  source text not null check (source in ('stripe', 'internal_trial', 'override')),
  stripe_subscription_id text,
  stripe_customer_id text,
  stripe_base_price_id text,
  stripe_seat_price_id text,
  paid_seat_quantity integer not null default 1 check (paid_seat_quantity >= 1),
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,
  last_stripe_event_created_at timestamptz,
  last_stripe_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, billing_environment),
  check (
    (
      source = 'stripe'
      and stripe_subscription_id is not null
      and stripe_customer_id is not null
    )
    or (
      source in ('internal_trial', 'override')
    )
  )
);

create unique index if not exists org_subscriptions_stripe_sub_env_uidx
  on public.org_subscriptions (stripe_subscription_id, billing_environment)
  where stripe_subscription_id is not null;

create index if not exists org_subscriptions_org_env_idx
  on public.org_subscriptions (org_id, billing_environment);

comment on table public.org_subscriptions is
  'Current organisation subscription mirror. One row per org per billing_environment. Stripe ids are nullable so a Quotr-managed no-card trial (source=internal_trial) can exist before Checkout. Writes: webhook / server billing service / future ops only.';

comment on column public.org_subscriptions.paid_seat_quantity is
  'Total allowed paid full users. Builder=1. Business base includes 1; Stripe additional-seat item quantity = max(0, paid_seat_quantity - 1).';

comment on column public.org_subscriptions.source is
  'Authority: stripe | internal_trial | override. Do not force no-card trials or admin comps into Stripe.';

-- ---------------------------------------------------------------------------
-- E. stripe_processed_events
-- ---------------------------------------------------------------------------

create table if not exists public.stripe_processed_events (
  id uuid primary key default gen_random_uuid(),
  billing_environment text not null check (billing_environment in ('test', 'live')),
  stripe_event_id text not null,
  event_type text not null,
  status text not null check (status in ('received', 'processed', 'failed', 'ignored')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_code text,
  error_safe text,
  created_at timestamptz not null default now(),
  unique (billing_environment, stripe_event_id)
);

create index if not exists stripe_processed_events_type_idx
  on public.stripe_processed_events (event_type, received_at desc);

comment on table public.stripe_processed_events is
  'Stripe webhook idempotency receipts. Service role / webhook authority only. Never store full event bodies or card data.';

-- ---------------------------------------------------------------------------
-- F. org_billing_overrides
-- ---------------------------------------------------------------------------

create table if not exists public.org_billing_overrides (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  billing_environment text not null check (billing_environment in ('test', 'live')),
  plan_code text not null check (plan_code in ('builder', 'business', 'custom')),
  override_type text not null check (
    override_type in ('administratively_comped', 'custom_contract', 'temporary_access')
  ),
  status text not null check (
    status in ('administratively_comped', 'custom_contract', 'active', 'expired', 'revoked')
  ),
  paid_seat_quantity integer not null default 1 check (paid_seat_quantity >= 1),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  reason text not null,
  created_by uuid references public.profiles (id) on delete set null,
  operator_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists org_billing_overrides_org_env_idx
  on public.org_billing_overrides (org_id, billing_environment, expires_at);

comment on table public.org_billing_overrides is
  'Platform/ops billing overrides. Service role / future platform-admin only. created_by is nullable: Quotr has no platform-admin user authority yet; operator_ref is a server-ops string.';

comment on column public.org_billing_overrides.created_by is
  'Nullable profile reference. Do not invent platform-admin authority. Ops may set operator_ref instead.';

-- ---------------------------------------------------------------------------
-- G. Triggers
-- ---------------------------------------------------------------------------

drop trigger if exists org_billing_customers_updated_at on public.org_billing_customers;
create trigger org_billing_customers_updated_at
  before update on public.org_billing_customers
  for each row
  execute function public.set_billing_updated_at();

drop trigger if exists org_subscriptions_updated_at on public.org_subscriptions;
create trigger org_subscriptions_updated_at
  before update on public.org_subscriptions
  for each row
  execute function public.set_billing_updated_at();

drop trigger if exists org_billing_overrides_updated_at on public.org_billing_overrides;
create trigger org_billing_overrides_updated_at
  before update on public.org_billing_overrides
  for each row
  execute function public.set_billing_updated_at();

-- ---------------------------------------------------------------------------
-- H. Grants + RLS
-- Authenticated members: SELECT own org customer/subscription summary only.
-- They may NOT insert/update/delete billing rows.
-- stripe_processed_events + org_billing_overrides: service_role only.
-- No anon access. Service role used by webhooks / server billing service.
-- ---------------------------------------------------------------------------

alter table public.org_billing_customers enable row level security;
alter table public.org_subscriptions enable row level security;
alter table public.stripe_processed_events enable row level security;
alter table public.org_billing_overrides enable row level security;

revoke all on table public.org_billing_customers from public, anon, authenticated;
revoke all on table public.org_subscriptions from public, anon, authenticated;
revoke all on table public.stripe_processed_events from public, anon, authenticated;
revoke all on table public.org_billing_overrides from public, anon, authenticated;

grant select on table public.org_billing_customers to authenticated;
grant select on table public.org_subscriptions to authenticated;

grant select, insert, update, delete on table public.org_billing_customers to service_role;
grant select, insert, update, delete on table public.org_subscriptions to service_role;
grant select, insert, update, delete on table public.stripe_processed_events to service_role;
grant select, insert, update, delete on table public.org_billing_overrides to service_role;

create policy "Organisation members can select own billing customer"
  on public.org_billing_customers for select
  using (org_id = public.auth_org_id());

create policy "Organisation members can select own subscription"
  on public.org_subscriptions for select
  using (org_id = public.auth_org_id());
