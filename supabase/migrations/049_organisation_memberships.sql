-- Quotr 2.0 — BILLING-4 organisation memberships, invitations, seat ops.
-- LOCAL ONLY. Do not apply until owner review.
-- Do NOT apply to Preview in this phase. Never apply to Production.
-- Additive. Does not change estimating, Pricing, or Quote money formulas.
--
-- BILLING-4-R1: pending_billing has ZERO org access. profiles.org_id stays
-- unbound until paid-seat activation. Do not treat pending_billing as Viewer.

-- ---------------------------------------------------------------------------
-- A. Membership role compatibility on profiles
-- Viewer/Estimator are first-class. Legacy `member` remains readable.
-- org_id is nullable so invited users can exist unbound until paid activation.
-- ---------------------------------------------------------------------------

alter table public.profiles
  alter column org_id drop not null;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('owner', 'admin', 'estimator', 'viewer', 'member'));

comment on column public.profiles.org_id is
  'Tenant binding for auth_org_id(). NULL while an invited user is pending_billing (zero org access). Set only when membership becomes active after paid-seat confirmation.';

comment on column public.profiles.role is
  'Compatibility mirror of organisation_memberships.role for ACTIVE members only. Team/role authority is organisation_memberships. Legacy member maps to estimator. Unbound pending users may keep a placeholder role; it grants no org access.';

-- ---------------------------------------------------------------------------
-- B. organisation_memberships — team/role source of truth
-- One authenticated user belongs to exactly one organisation.
-- Every ordinary organisation has exactly one active Owner.
-- All roles consume one full paid seat. Viewer is not free.
-- ---------------------------------------------------------------------------

create table if not exists public.organisation_memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'estimator', 'viewer')),
  status text not null check (status in ('active', 'pending_billing', 'removed')),
  email_display text,
  email_normalized text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  joined_at timestamptz,
  removed_at timestamptz,
  removed_by uuid references public.profiles (id) on delete set null,
  role_changed_at timestamptz,
  role_changed_by uuid references public.profiles (id) on delete set null
);

create unique index if not exists organisation_memberships_one_live_user_uidx
  on public.organisation_memberships (user_id)
  where status in ('active', 'pending_billing');

create unique index if not exists organisation_memberships_one_owner_uidx
  on public.organisation_memberships (org_id)
  where status = 'active' and role = 'owner';

create unique index if not exists organisation_memberships_org_user_uidx
  on public.organisation_memberships (org_id, user_id)
  where status in ('active', 'pending_billing');

create index if not exists organisation_memberships_org_status_idx
  on public.organisation_memberships (org_id, status);

comment on table public.organisation_memberships is
  'Canonical organisation membership and role authority. profiles.org_id remains the single-org tenant binding for RLS. Do not use this table to imply multi-org switching.';

comment on column public.organisation_memberships.status is
  'active = paid full user with org access. pending_billing = durable join workflow only: reserves capacity, ZERO org access, profiles.org_id unbound. Do not treat as Viewer. removed = access revoked.';

-- ---------------------------------------------------------------------------
-- C. organisation_invitations
-- Raw token is never stored. Hash only. Pending reserves capacity 7 days.
-- ---------------------------------------------------------------------------

create table if not exists public.organisation_invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  email_display text not null,
  email_normalized text not null,
  role text not null check (role in ('admin', 'estimator', 'viewer')),
  status text not null check (
    status in ('pending', 'accepting', 'accepted', 'cancelled', 'expired')
  ),
  token_hash text not null,
  expires_at timestamptz not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_at timestamptz,
  cancelled_at timestamptz,
  invited_user_id uuid references public.profiles (id) on delete set null,
  last_sent_at timestamptz
);

create unique index if not exists organisation_invitations_pending_email_uidx
  on public.organisation_invitations (org_id, email_normalized)
  where status in ('pending', 'accepting');

create unique index if not exists organisation_invitations_token_hash_uidx
  on public.organisation_invitations (token_hash);

create index if not exists organisation_invitations_org_status_idx
  on public.organisation_invitations (org_id, status, expires_at);

comment on table public.organisation_invitations is
  'Business invitations. token_hash is SHA-256 hex of the raw URL token. Raw token is email-only and must not be logged. Resend reissues the token on the same row so capacity is not double-reserved.';

-- ---------------------------------------------------------------------------
-- D. billing_seat_operations — durable payment-safe seat mutations
-- ---------------------------------------------------------------------------

create table if not exists public.billing_seat_operations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  billing_environment text not null
    check (billing_environment in ('test', 'live')),
  kind text not null check (kind in ('add', 'remove')),
  invitation_id uuid references public.organisation_invitations (id) on delete set null,
  membership_id uuid references public.organisation_memberships (id) on delete set null,
  desired_paid_seat_quantity integer not null check (desired_paid_seat_quantity >= 1),
  status text not null check (
    status in (
      'queued',
      'pending',
      'awaiting_payment',
      'awaiting_mirror',
      'completed',
      'failed',
      'cancelled'
    )
  ),
  stripe_subscription_id text,
  stripe_invoice_id text,
  error_code text,
  error_safe text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists billing_seat_operations_org_status_idx
  on public.billing_seat_operations (org_id, status, created_at desc);

-- Durable single-flight: at most one Stripe seat mutation in progress per
-- org+environment. Advisory locks end when the HTTP transaction ends.
create unique index if not exists billing_seat_operations_one_inflight_uidx
  on public.billing_seat_operations (org_id, billing_environment)
  where status in ('pending', 'awaiting_payment', 'awaiting_mirror');

comment on table public.billing_seat_operations is
  'Durable seat add/remove workflow. queued waits. pending/awaiting_payment/awaiting_mirror = the single in-flight Stripe mutation. Membership becomes active only after org_subscriptions.paid_seat_quantity covers the resulting active count. Service/RPC writes only.';

-- ---------------------------------------------------------------------------
-- E. project_assignments — workflow metadata, not RLS isolation
-- ---------------------------------------------------------------------------

create table if not exists public.project_assignments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  membership_id uuid not null references public.organisation_memberships (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.profiles (id) on delete set null,
  unique (project_id, membership_id)
);

create index if not exists project_assignments_org_idx
  on public.project_assignments (org_id, project_id);

comment on table public.project_assignments is
  'Optional Business workflow assignment. Does not change tenant visibility: active org members still see org Projects according to role permissions.';

-- ---------------------------------------------------------------------------
-- F. updated_at triggers
-- ---------------------------------------------------------------------------

create or replace function public.set_team_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists organisation_memberships_updated_at on public.organisation_memberships;
create trigger organisation_memberships_updated_at
  before update on public.organisation_memberships
  for each row
  execute function public.set_team_updated_at();

drop trigger if exists organisation_invitations_updated_at on public.organisation_invitations;
create trigger organisation_invitations_updated_at
  before update on public.organisation_invitations
  for each row
  execute function public.set_team_updated_at();

drop trigger if exists billing_seat_operations_updated_at on public.billing_seat_operations;
create trigger billing_seat_operations_updated_at
  before update on public.billing_seat_operations
  for each row
  execute function public.set_team_updated_at();

-- Keep profiles.role aligned with the live membership role.
create or replace function public.sync_profile_role_from_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.status = 'removed' then
    return new;
  end if;
  -- Bind compatibility role only for ACTIVE paid members. pending_billing
  -- must not write profiles.org_id or grant a Viewer-like role.
  if new.status = 'active' then
    update public.profiles
      set org_id = new.org_id,
          role = new.role
    where id = new.user_id
      and (org_id is null or org_id = new.org_id)
      and (role is distinct from new.role or org_id is distinct from new.org_id);
  end if;
  return new;
end;
$$;

drop trigger if exists organisation_memberships_sync_profile_role
  on public.organisation_memberships;
create trigger organisation_memberships_sync_profile_role
  after insert or update of role, status
  on public.organisation_memberships
  for each row
  execute function public.sync_profile_role_from_membership();

-- ---------------------------------------------------------------------------
-- G. Bootstrap existing profiles into memberships
-- owner→owner, admin→admin, member→estimator. Never infer Viewer.
-- ---------------------------------------------------------------------------

insert into public.organisation_memberships (
  org_id,
  user_id,
  role,
  status,
  created_at,
  joined_at,
  created_by
)
select
  p.org_id,
  p.id,
  case p.role
    when 'owner' then 'owner'
    when 'admin' then 'admin'
    when 'viewer' then 'viewer'
    when 'estimator' then 'estimator'
    else 'estimator'
  end,
  'active',
  p.created_at,
  p.created_at,
  p.id
from public.profiles p
where p.org_id is not null
  and not exists (
    select 1
    from public.organisation_memberships m
    where m.user_id = p.id
      and m.status in ('active', 'pending_billing')
  );

-- ---------------------------------------------------------------------------
-- H. Helpers
-- ---------------------------------------------------------------------------

create or replace function public.auth_membership_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.role
  from public.organisation_memberships m
  where m.user_id = auth.uid()
    and m.org_id = public.auth_org_id()
    and m.status = 'active'
  limit 1
$$;

create or replace function public.auth_can_mutate_work()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- After organisation_memberships exists: ACTIVE membership is the only
  -- mutation authority. Bound profile without active membership fails closed.
  -- pending_billing and Viewer are denied. service_role bypasses RLS.
  select exists (
    select 1
    from public.organisation_memberships m
    where m.user_id = auth.uid()
      and m.org_id = public.auth_org_id()
      and m.status = 'active'
      and m.role in ('owner', 'admin', 'estimator')
  )
$$;

comment on function public.auth_can_mutate_work() is
  'True only for an ACTIVE Owner/Admin/Estimator membership in the bound org. Viewer cannot mutate. pending_billing has no access. Bound profile without active membership fails closed. Restrictive policies target authenticated only; service_role bypasses RLS.';

create or replace function public.team_lock_org(p_org_id uuid)
returns void
language plpgsql
as $$
begin
  perform pg_advisory_xact_lock(87230133, hashtext(p_org_id::text));
end;
$$;

create or replace function public.expire_stale_organisation_invitations(p_org_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  update public.organisation_invitations
    set status = 'expired'
  where org_id = p_org_id
    and status = 'pending'
    and expires_at <= now();
  get diagnostics v_count = row_count;
  return coalesce(v_count, 0);
end;
$$;

create or replace function public.organisation_reserved_seat_count(p_org_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  -- One prospective user = one unit.
  -- pending invitations reserve. accepting invitations do NOT (the
  -- pending_billing membership holds that unit after the locked transfer).
  select
    (
      select count(*)::integer
      from public.organisation_memberships m
      where m.org_id = p_org_id
        and m.status in ('active', 'pending_billing')
    )
    +
    (
      select count(*)::integer
      from public.organisation_invitations i
      where i.org_id = p_org_id
        and i.status = 'pending'
        and i.expires_at > now()
    )
$$;

comment on function public.organisation_reserved_seat_count(uuid) is
  'Capacity units: active + pending_billing + pending invites. accepting is excluded so invitation→pending_billing transfer does not double-count.';

create or replace function public.organisation_self_service_user_limit(p_org_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_source text;
begin
  select s.plan_code, s.source
    into v_plan, v_source
  from public.org_subscriptions s
  where s.org_id = p_org_id
    and s.billing_environment = public.billing_runtime_environment()
  limit 1;

  if v_source is not distinct from 'internal_trial' then
    return 1;
  end if;
  if v_plan is not distinct from 'builder' then
    return 1;
  end if;
  if v_plan is not distinct from 'business' then
    return 5;
  end if;
  if v_plan is not distinct from 'custom' then
    return null;
  end if;
  return 1;
end;
$$;

create or replace function public.organisation_allows_paid_seat_stripe(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.org_subscriptions s
    where s.org_id = p_org_id
      and s.billing_environment = public.billing_runtime_environment()
      and s.source = 'stripe'
      and s.plan_code = 'business'
      and s.status = 'active'
      and s.stripe_subscription_id is not null
  )
$$;

comment on function public.organisation_allows_paid_seat_stripe(uuid) is
  'True only for active paid Stripe Business. past_due grace does not authorize new seat charges. scheduled_to_cancel cannot add users.';

create or replace function public.current_user_verified_email()
returns text
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_confirmed timestamptz;
begin
  select u.email, u.email_confirmed_at
    into v_email, v_confirmed
  from auth.users u
  where u.id = auth.uid();

  if v_email is null or v_confirmed is null then
    return null;
  end if;
  return lower(btrim(v_email));
end;
$$;

-- ---------------------------------------------------------------------------
-- I. RLS — org scoped reads. No authenticated writes. No anon table browse.
-- ---------------------------------------------------------------------------

alter table public.organisation_memberships enable row level security;
alter table public.organisation_invitations enable row level security;
alter table public.billing_seat_operations enable row level security;
alter table public.project_assignments enable row level security;

revoke all on table public.organisation_memberships from public, anon, authenticated;
revoke all on table public.organisation_invitations from public, anon, authenticated;
revoke all on table public.billing_seat_operations from public, anon, authenticated;
revoke all on table public.project_assignments from public, anon, authenticated;

grant select on table public.organisation_memberships to authenticated;
grant select on table public.project_assignments to authenticated;

grant select, insert, update, delete on table public.organisation_memberships to service_role;
grant select, insert, update, delete on table public.organisation_invitations to service_role;
grant select, insert, update, delete on table public.billing_seat_operations to service_role;
grant select, insert, update, delete on table public.project_assignments to service_role;

create policy "Members can select memberships in their organisation"
  on public.organisation_memberships for select
  using (org_id = public.auth_org_id());

create policy "Members can select project assignments in their organisation"
  on public.project_assignments for select
  using (org_id = public.auth_org_id());

-- Unbound invited users (org_id IS NULL) can read their own profile row
-- for session/invite surfaces. This does not grant organisation data.
drop policy if exists "Users can select their own profile" on public.profiles;
create policy "Users can select their own profile"
  on public.profiles for select
  using (id = auth.uid());

-- invitations + seat ops: no authenticated/anon policies (RPC/service_role only)

-- Restrictive write policies: Viewer and pending_billing cannot mutate
-- commercial core tables. Existing permissive org policies remain; RESTRICTIVE
-- ANDs with them. Policies are TO authenticated only.
-- service_role bypasses RLS (webhooks, admin activation, Quote delivery ops).
-- Public Quote acceptance / client view tables are NOT in this list.

do $$
declare
  t text;
begin
  foreach t in array array[
    'projects',
    'quotes',
    'quote_items',
    'pricing_documents',
    'pricing_items',
    'estimates',
    'estimate_line_items',
    'rates',
    'organisation_settings'
  ]
  loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      execute format(
        'drop policy if exists %I on public.%I',
        t || '_write_requires_work_role_insert',
        t
      );
      execute format(
        'drop policy if exists %I on public.%I',
        t || '_write_requires_work_role_update',
        t
      );
      execute format(
        'drop policy if exists %I on public.%I',
        t || '_write_requires_work_role_delete',
        t
      );
      execute format(
        'create policy %I on public.%I as restrictive for insert to authenticated with check (public.auth_can_mutate_work())',
        t || '_write_requires_work_role_insert',
        t
      );
      execute format(
        'create policy %I on public.%I as restrictive for update to authenticated using (public.auth_can_mutate_work()) with check (public.auth_can_mutate_work())',
        t || '_write_requires_work_role_update',
        t
      );
      execute format(
        'create policy %I on public.%I as restrictive for delete to authenticated using (public.auth_can_mutate_work())',
        t || '_write_requires_work_role_delete',
        t
      );
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- J. Public invite lookup — narrow projection, hash only
-- ---------------------------------------------------------------------------

drop function if exists public.lookup_organisation_invitation_public(text);

create or replace function public.lookup_organisation_invitation_public(p_token_hash text)
returns table (
  organisation_name text,
  role text,
  status text,
  expires_at timestamptz,
  inviter_name text,
  email_display text,
  wait_kind text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_token_hash is null or char_length(p_token_hash) < 32 then
    return;
  end if;

  return query
  select
    o.name,
    i.role,
    case
      when i.status = 'pending' and i.expires_at <= now() then 'expired'
      else i.status
    end,
    i.expires_at,
    coalesce(p.full_name, 'A teammate'),
    i.email_display,
    case
      when i.status is distinct from 'accepting' then null
      when op.op_status in ('failed', 'awaiting_payment') then 'payment_attention'
      when s.status is distinct from 'active' then 'payment_attention'
      when op.op_status in ('queued', 'pending', 'awaiting_mirror') then 'queued'
      else 'payment_attention'
    end
  from public.organisation_invitations i
  join public.organisations o on o.id = i.org_id
  left join public.profiles p on p.id = i.created_by
  left join lateral (
    select so.status as op_status
    from public.billing_seat_operations so
    where so.invitation_id = i.id
      and so.kind = 'add'
      and so.status not in ('completed', 'cancelled')
    order by so.created_at desc, so.id desc
    limit 1
  ) op on true
  left join public.org_subscriptions s
    on s.org_id = i.org_id
   and s.billing_environment = public.billing_runtime_environment()
  where i.token_hash = p_token_hash
  limit 1;
end;
$$;

comment on function public.lookup_organisation_invitation_public(text) is
  'Narrow public invite projection by token hash. No org_id, no token, no Stripe ids.';

revoke all on function public.lookup_organisation_invitation_public(text) from public;
grant execute on function public.lookup_organisation_invitation_public(text)
  to anon, authenticated, service_role;

drop function if exists public.lookup_pending_invitation_for_current_user();

create or replace function public.lookup_pending_invitation_for_current_user()
returns table (
  organisation_name text,
  role text,
  status text,
  expires_at timestamptz,
  inviter_name text,
  email_display text,
  invite_count integer,
  wait_kind text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := public.current_user_verified_email();
  v_count integer := 0;
begin
  if auth.uid() is null or v_email is null then
    return;
  end if;

  select count(*)::integer
    into v_count
  from public.organisation_invitations i
  where i.email_normalized = v_email
    and i.status in ('pending', 'accepting')
    and (i.status = 'accepting' or i.expires_at > now());

  if v_count is distinct from 1 then
    return query
    select
      null::text,
      null::text,
      null::text,
      null::timestamptz,
      null::text,
      null::text,
      v_count,
      null::text;
    return;
  end if;

  return query
  select
    o.name,
    i.role,
    i.status,
    i.expires_at,
    coalesce(p.full_name, 'A teammate'),
    i.email_display,
    1,
    case
      when i.status is distinct from 'accepting' then null
      when op.op_status in ('failed', 'awaiting_payment') then 'payment_attention'
      when s.status is distinct from 'active' then 'payment_attention'
      when op.op_status in ('queued', 'pending', 'awaiting_mirror') then 'queued'
      else 'payment_attention'
    end
  from public.organisation_invitations i
  join public.organisations o on o.id = i.org_id
  left join public.profiles p on p.id = i.created_by
  left join lateral (
    select so.status as op_status
    from public.billing_seat_operations so
    where so.invitation_id = i.id
      and so.kind = 'add'
      and so.status not in ('completed', 'cancelled')
    order by so.created_at desc, so.id desc
    limit 1
  ) op on true
  left join public.org_subscriptions s
    on s.org_id = i.org_id
   and s.billing_environment = public.billing_runtime_environment()
  where i.email_normalized = v_email
    and i.status in ('pending', 'accepting')
    and (i.status = 'accepting' or i.expires_at > now())
  limit 1;
end;
$$;

revoke all on function public.lookup_pending_invitation_for_current_user() from public, anon;
grant execute on function public.lookup_pending_invitation_for_current_user()
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- K. Invitation create / resend / cancel (Owner-only create)
-- ---------------------------------------------------------------------------

create or replace function public.create_organisation_invitation_v1(
  p_email text,
  p_role text,
  p_token_hash text
)
returns table (
  invitation_id uuid,
  expires_at timestamptz,
  reused boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := public.auth_org_id();
  v_role text;
  v_email text;
  v_email_display text;
  v_limit integer;
  v_reserved integer;
  v_existing uuid;
  v_existing_exp timestamptz;
begin
  if v_uid is null or v_org is null then
    raise exception 'TEAM:NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  perform public.team_lock_org(v_org);
  perform public.expire_stale_organisation_invitations(v_org);

  select m.role into v_role
  from public.organisation_memberships m
  where m.org_id = v_org
    and m.user_id = v_uid
    and m.status = 'active';

  if v_role is distinct from 'owner' then
    raise exception 'TEAM:INVITE_OWNER_ONLY' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.org_subscriptions s
    where s.org_id = v_org
      and s.billing_environment = public.billing_runtime_environment()
      and s.status = 'scheduled_to_cancel'
  ) then
    raise exception 'TEAM:SUBSCRIPTION_SCHEDULED_TO_CANCEL' using errcode = 'P0001';
  end if;

  if not public.organisation_allows_paid_seat_stripe(v_org) then
    raise exception 'TEAM:BILLING_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  if p_role is distinct from 'admin'
     and p_role is distinct from 'estimator'
     and p_role is distinct from 'viewer' then
    raise exception 'TEAM:INVALID_ROLE' using errcode = 'P0001';
  end if;

  v_email_display := nullif(btrim(p_email), '');
  v_email := lower(v_email_display);
  if v_email is null or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'TEAM:INVALID_EMAIL' using errcode = 'P0001';
  end if;

  if p_token_hash is null or char_length(p_token_hash) < 32 then
    raise exception 'TEAM:INVALID_TOKEN' using errcode = 'P0001';
  end if;

  v_limit := public.organisation_self_service_user_limit(v_org);
  if v_limit = 1 then
    raise exception 'TEAM:INVITE_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  select i.id, i.expires_at
    into v_existing, v_existing_exp
  from public.organisation_invitations i
  where i.org_id = v_org
    and i.email_normalized = v_email
    and i.status = 'pending'
  limit 1;

  if v_existing is not null then
    update public.organisation_invitations
      set token_hash = p_token_hash,
          role = p_role,
          email_display = v_email_display,
          expires_at = now() + interval '7 days',
          last_sent_at = now()
    where id = v_existing;
    return query select v_existing, now() + interval '7 days', true;
    return;
  end if;

  v_reserved := public.organisation_reserved_seat_count(v_org);
  if v_limit is not null and v_reserved >= v_limit then
    raise exception 'TEAM:SEAT_LIMIT' using errcode = 'P0001';
  end if;

  insert into public.organisation_invitations (
    org_id,
    email_display,
    email_normalized,
    role,
    status,
    token_hash,
    expires_at,
    created_by,
    last_sent_at
  )
  values (
    v_org,
    v_email_display,
    v_email,
    p_role,
    'pending',
    p_token_hash,
    now() + interval '7 days',
    v_uid,
    now()
  )
  returning id, organisation_invitations.expires_at into v_existing, v_existing_exp;

  return query select v_existing, v_existing_exp, false;
end;
$$;

revoke all on function public.create_organisation_invitation_v1(text, text, text)
  from public, anon;
grant execute on function public.create_organisation_invitation_v1(text, text, text)
  to authenticated, service_role;

create or replace function public.cancel_organisation_invitation_v1(p_invitation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := public.auth_org_id();
  v_role text;
  v_inv public.organisation_invitations%rowtype;
  v_op public.billing_seat_operations%rowtype;
  v_mem uuid;
begin
  if v_uid is null or v_org is null then
    raise exception 'TEAM:NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  perform public.team_lock_org(v_org);

  select m.role into v_role
  from public.organisation_memberships m
  where m.org_id = v_org and m.user_id = v_uid and m.status = 'active';

  if v_role is distinct from 'owner' then
    raise exception 'TEAM:INVITE_OWNER_ONLY' using errcode = 'P0001';
  end if;

  select * into v_inv
  from public.organisation_invitations
  where id = p_invitation_id and org_id = v_org
  for update;

  if not found then
    return false;
  end if;

  if v_inv.status = 'pending' then
    update public.organisation_invitations
      set status = 'cancelled',
          cancelled_at = now()
    where id = v_inv.id;
    return true;
  end if;

  if v_inv.status is distinct from 'accepting' then
    return false;
  end if;

  select o.* into v_op
  from public.billing_seat_operations o
  where o.invitation_id = v_inv.id
    and o.kind = 'add'
    and o.status not in ('completed', 'cancelled')
  order by o.created_at desc
  limit 1
  for update;

  if found and v_op.status in ('pending', 'awaiting_payment', 'awaiting_mirror') then
    raise exception 'TEAM:SEAT_IN_FLIGHT' using errcode = 'P0001';
  end if;

  if found then
    update public.billing_seat_operations
      set status = 'cancelled',
          completed_at = now()
    where id = v_op.id;

    v_mem := v_op.membership_id;
  end if;

  if v_mem is not null then
    update public.organisation_memberships
      set status = 'removed',
          removed_at = now(),
          removed_by = v_uid
    where id = v_mem
      and status = 'pending_billing';
  end if;

  update public.organisation_invitations
    set status = 'cancelled',
        cancelled_at = now()
  where id = v_inv.id;

  return true;
end;
$$;

revoke all on function public.cancel_organisation_invitation_v1(uuid) from public, anon;
grant execute on function public.cancel_organisation_invitation_v1(uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- L0. Single-flight seat queue. Claim at most one Stripe mutation.
-- ---------------------------------------------------------------------------

drop function if exists public.claim_next_seat_operation_v1(uuid);

create or replace function public.claim_next_seat_operation_v1(
  p_org_id uuid,
  p_only_membership_id uuid default null
)
returns table (
  operation_id uuid,
  kind text,
  membership_id uuid,
  desired_paid_seat_quantity integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_env text := public.billing_runtime_environment();
  v_inflight uuid;
  v_op_id uuid;
  v_kind text;
  v_membership uuid;
  v_invite uuid;
  v_active integer;
  v_desired integer;
begin
  if p_org_id is null then
    return;
  end if;
  perform public.team_lock_org(p_org_id);

  select o.id into v_inflight
  from public.billing_seat_operations o
  where o.org_id = p_org_id
    and o.billing_environment = v_env
    and o.status in ('pending', 'awaiting_payment', 'awaiting_mirror')
  limit 1;

  if v_inflight is not null then
    return;
  end if;

  select o.id, o.kind, o.membership_id, o.invitation_id
    into v_op_id, v_kind, v_membership, v_invite
  from public.billing_seat_operations o
  where o.org_id = p_org_id
    and o.billing_environment = v_env
    and o.status in ('queued', 'failed')
    and (
      (
        o.kind = 'add'
        and exists (
          select 1
          from public.organisation_memberships m
          where m.id = o.membership_id
            and m.status = 'pending_billing'
        )
        and exists (
          select 1
          from public.organisation_invitations i
          where i.id = o.invitation_id
            and i.status = 'accepting'
        )
      )
      or
      (
        o.kind = 'remove'
        and exists (
          select 1
          from public.organisation_memberships m
          where m.id = o.membership_id
            and m.status = 'removed'
        )
      )
    )
  order by o.created_at asc, o.id asc
  limit 1;

  if v_op_id is null then
    return;
  end if;

  -- HTTP callers may only claim their own oldest operation. Webhook/admin
  -- pass null and may claim the oldest failed or queued row.
  if p_only_membership_id is not null
     and v_membership is distinct from p_only_membership_id then
    return;
  end if;

  if v_kind = 'add' and not public.organisation_allows_paid_seat_stripe(p_org_id) then
    return;
  end if;

  select count(*)::integer into v_active
  from public.organisation_memberships m
  where m.org_id = p_org_id
    and m.status = 'active';

  if v_kind = 'add' then
    v_desired := v_active + 1;
  else
    v_desired := greatest(v_active, 1);
  end if;

  update public.billing_seat_operations
    set status = 'pending',
        desired_paid_seat_quantity = v_desired,
        error_code = null,
        error_safe = null
  where id = v_op_id;

  return query select v_op_id, v_kind, v_membership, v_desired;
exception
  when unique_violation then
    -- Concurrent claim lost the durable inflight slot. Leave this row queued.
    return;
end;
$$;

revoke all on function public.claim_next_seat_operation_v1(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_next_seat_operation_v1(uuid, uuid)
  to service_role;

create or replace function public.get_pending_claimed_seat_operation_v1(p_org_id uuid)
returns table (
  operation_id uuid,
  kind text,
  membership_id uuid,
  desired_paid_seat_quantity integer
)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, o.kind, o.membership_id, o.desired_paid_seat_quantity
  from public.billing_seat_operations o
  where o.org_id = p_org_id
    and o.billing_environment = public.billing_runtime_environment()
    and o.status = 'pending'
  order by o.created_at asc, o.id asc
  limit 1
$$;

revoke all on function public.get_pending_claimed_seat_operation_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.get_pending_claimed_seat_operation_v1(uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- L. Invitation acceptance — pending_billing until paid seats cover
-- ---------------------------------------------------------------------------

create or replace function public.begin_invitation_acceptance_v1(p_token_hash text)
returns table (
  membership_id uuid,
  invitation_id uuid,
  org_id uuid,
  desired_paid_seat_quantity integer,
  already_member boolean,
  operation_id uuid,
  operation_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := public.current_user_verified_email();
  v_inv public.organisation_invitations%rowtype;
  v_existing_org uuid;
  v_membership uuid;
  v_operation uuid;
  v_desired integer;
  v_full_name text;
  v_limit integer;
  v_sub_status text;
  v_op_status text;
  v_claimed uuid;
begin
  if v_uid is null then
    raise exception 'TEAM:NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  if v_email is null then
    raise exception 'TEAM:EMAIL_UNVERIFIED' using errcode = 'P0001';
  end if;
  if p_token_hash is null then
    raise exception 'TEAM:INVALID_TOKEN' using errcode = 'P0001';
  end if;

  select * into v_inv
  from public.organisation_invitations i
  where i.token_hash = p_token_hash;

  if not found then
    raise exception 'TEAM:INVITE_NOT_FOUND' using errcode = 'P0001';
  end if;

  perform public.team_lock_org(v_inv.org_id);
  perform public.expire_stale_organisation_invitations(v_inv.org_id);

  select * into v_inv
  from public.organisation_invitations i
  where i.id = v_inv.id;

  if v_inv.status = 'accepted' then
    select m.id into v_membership
    from public.organisation_memberships m
    where m.org_id = v_inv.org_id
      and m.user_id = v_uid
      and m.status = 'active';
    if v_membership is not null then
      return query select v_membership, v_inv.id, v_inv.org_id, 1, true, null::uuid, null::text;
      return;
    end if;
  end if;

  if v_inv.status not in ('pending', 'accepting') then
    raise exception 'TEAM:INVITE_NOT_PENDING' using errcode = 'P0001';
  end if;
  if v_inv.expires_at <= now() and v_inv.status = 'pending' then
    update public.organisation_invitations set status = 'expired' where id = v_inv.id;
    raise exception 'TEAM:INVITE_EXPIRED' using errcode = 'P0001';
  end if;
  if v_inv.email_normalized is distinct from v_email then
    raise exception 'TEAM:EMAIL_MISMATCH' using errcode = 'P0001';
  end if;

  select s.status into v_sub_status
  from public.org_subscriptions s
  where s.org_id = v_inv.org_id
    and s.billing_environment = public.billing_runtime_environment();

  if v_sub_status = 'scheduled_to_cancel' then
    raise exception 'TEAM:SUBSCRIPTION_SCHEDULED_TO_CANCEL' using errcode = 'P0001';
  end if;
  if v_sub_status in ('cancelled', 'unpaid', 'paused', 'incomplete') then
    raise exception 'TEAM:BILLING_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  v_limit := public.organisation_self_service_user_limit(v_inv.org_id);
  if v_limit = 1 then
    raise exception 'TEAM:INVITE_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  select p.org_id into v_existing_org
  from public.profiles p
  where p.id = v_uid;

  if v_existing_org is not null and v_existing_org is distinct from v_inv.org_id then
    raise exception 'TEAM:ALREADY_IN_OTHER_ORG' using errcode = 'P0001';
  end if;

  if v_existing_org is not distinct from v_inv.org_id then
    update public.organisation_invitations
      set status = 'accepted',
          accepted_at = coalesce(accepted_at, now()),
          invited_user_id = v_uid
    where id = v_inv.id
      and status in ('pending', 'accepting');
    select m.id into v_membership
    from public.organisation_memberships m
    where m.org_id = v_inv.org_id and m.user_id = v_uid and m.status = 'active';
    return query select v_membership, v_inv.id, v_inv.org_id, 1, true, null::uuid, null::text;
    return;
  end if;

  select m.id into v_membership
  from public.organisation_memberships m
  where m.org_id = v_inv.org_id
    and m.user_id = v_uid
    and m.status = 'pending_billing';

  if v_membership is not null then
    select o.id, o.desired_paid_seat_quantity, o.status
      into v_operation, v_desired, v_op_status
    from public.billing_seat_operations o
    where o.membership_id = v_membership
      and o.kind = 'add'
      and o.status not in ('completed', 'cancelled')
    order by o.created_at desc
    limit 1;
    select c.operation_id into v_claimed
    from public.claim_next_seat_operation_v1(v_inv.org_id, v_membership) c;
    select o.id, o.desired_paid_seat_quantity, o.status
      into v_operation, v_desired, v_op_status
    from public.billing_seat_operations o
    where o.membership_id = v_membership
      and o.kind = 'add'
      and o.status not in ('completed', 'cancelled')
    order by o.created_at desc
    limit 1;
    return query select v_membership, v_inv.id, v_inv.org_id, coalesce(v_desired, 2), false, v_operation, v_op_status;
    return;
  end if;

  select count(*)::integer
    into v_desired
  from public.organisation_memberships m
  where m.org_id = v_inv.org_id
    and m.status = 'active';
  v_desired := v_desired + 1;

  select coalesce(u.raw_user_meta_data->>'full_name', split_part(v_email, '@', 1))
    into v_full_name
  from auth.users u
  where u.id = v_uid;

  if not exists (select 1 from public.profiles p where p.id = v_uid) then
    insert into public.profiles (id, org_id, full_name, role)
    values (v_uid, null, nullif(btrim(v_full_name), ''), 'member');
  else
    update public.profiles
      set full_name = coalesce(nullif(btrim(full_name), ''), nullif(btrim(v_full_name), ''))
    where id = v_uid
      and org_id is null;
  end if;

  update public.organisation_invitations
    set status = 'accepting',
        invited_user_id = v_uid
  where id = v_inv.id
    and status in ('pending', 'accepting');

  insert into public.organisation_memberships (
    org_id,
    user_id,
    role,
    status,
    email_display,
    email_normalized,
    created_by,
    joined_at
  )
  values (
    v_inv.org_id,
    v_uid,
    v_inv.role,
    'pending_billing',
    v_inv.email_display,
    v_inv.email_normalized,
    v_inv.created_by,
    null
  )
  returning id into v_membership;

  insert into public.billing_seat_operations (
    org_id,
    billing_environment,
    kind,
    invitation_id,
    membership_id,
    desired_paid_seat_quantity,
    status,
    created_by
  )
  values (
    v_inv.org_id,
    public.billing_runtime_environment(),
    'add',
    v_inv.id,
    v_membership,
    v_desired,
    'queued',
    v_uid
  )
  returning id into v_operation;

  select c.operation_id into v_claimed
  from public.claim_next_seat_operation_v1(v_inv.org_id, v_membership) c;

  select o.desired_paid_seat_quantity, o.status
    into v_desired, v_op_status
  from public.billing_seat_operations o
  where o.id = v_operation;

  return query select v_membership, v_inv.id, v_inv.org_id, v_desired, false, v_operation, v_op_status;
end;
$$;

revoke all on function public.begin_invitation_acceptance_v1(text) from public, anon;
grant execute on function public.begin_invitation_acceptance_v1(text)
  to authenticated, service_role;

create or replace function public.begin_invitation_acceptance_for_current_user()
returns table (
  membership_id uuid,
  invitation_id uuid,
  org_id uuid,
  desired_paid_seat_quantity integer,
  already_member boolean,
  operation_id uuid,
  operation_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := public.current_user_verified_email();
  v_hash text;
  v_count integer;
begin
  if auth.uid() is null or v_email is null then
    raise exception 'TEAM:NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select count(*)::integer, min(i.token_hash)
    into v_count, v_hash
  from public.organisation_invitations i
  where i.email_normalized = v_email
    and i.status in ('pending', 'accepting')
    and (i.status = 'accepting' or i.expires_at > now());

  if v_count is distinct from 1 or v_hash is null then
    raise exception 'TEAM:INVITE_NOT_UNIQUE' using errcode = 'P0001';
  end if;

  return query
  select * from public.begin_invitation_acceptance_v1(v_hash);
end;
$$;

revoke all on function public.begin_invitation_acceptance_for_current_user() from public, anon;
grant execute on function public.begin_invitation_acceptance_for_current_user()
  to authenticated, service_role;

create or replace function public.activate_membership_if_seats_paid_v1(p_membership_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mem public.organisation_memberships%rowtype;
  v_paid integer;
  v_active integer;
  v_desired integer;
begin
  select * into v_mem
  from public.organisation_memberships
  where id = p_membership_id
  for update;

  if not found then
    return false;
  end if;
  if v_mem.status = 'active' then
    return true;
  end if;
  if v_mem.status is distinct from 'pending_billing' then
    return false;
  end if;

  perform public.team_lock_org(v_mem.org_id);

  select s.paid_seat_quantity
    into v_paid
  from public.org_subscriptions s
  where s.org_id = v_mem.org_id
    and s.billing_environment = public.billing_runtime_environment();

  select count(*)::integer into v_active
  from public.organisation_memberships m
  where m.org_id = v_mem.org_id
    and m.status = 'active';

  v_desired := v_active + 1;
  if v_paid is null or v_paid < v_desired then
    return false;
  end if;

  update public.organisation_memberships
    set status = 'active',
        joined_at = coalesce(joined_at, now())
  where id = v_mem.id;

  -- Atomic org bind: only now does auth_org_id() resolve the invited org.
  update public.profiles
    set org_id = v_mem.org_id,
        role = v_mem.role
  where id = v_mem.user_id
    and (org_id is null or org_id = v_mem.org_id);

  update public.organisation_invitations
    set status = 'accepted',
        accepted_at = coalesce(accepted_at, now()),
        invited_user_id = v_mem.user_id
  where org_id = v_mem.org_id
    and invited_user_id = v_mem.user_id
    and status = 'accepting';

  update public.billing_seat_operations
    set status = 'completed',
        completed_at = now()
  where membership_id = v_mem.id
    and kind = 'add'
    and status in ('queued', 'pending', 'awaiting_payment', 'awaiting_mirror', 'failed');

  return true;
end;
$$;

revoke all on function public.activate_membership_if_seats_paid_v1(uuid) from public, anon, authenticated;
grant execute on function public.activate_membership_if_seats_paid_v1(uuid)
  to service_role;

create or replace function public.try_activate_pending_memberships_for_org(p_org_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_count integer := 0;
begin
  perform public.team_lock_org(p_org_id);
  for v_id in
    select m.id
    from public.organisation_memberships m
    left join public.billing_seat_operations o
      on o.membership_id = m.id
     and o.kind = 'add'
     and o.status not in ('cancelled', 'completed')
    where m.org_id = p_org_id
      and m.status = 'pending_billing'
    order by coalesce(o.created_at, m.created_at) asc, m.created_at asc, m.id asc
  loop
    if public.activate_membership_if_seats_paid_v1(v_id) then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.try_activate_pending_memberships_for_org(uuid)
  from public, anon, authenticated;
grant execute on function public.try_activate_pending_memberships_for_org(uuid)
  to service_role;

create or replace function public.mark_seat_operation_status_v1(
  p_operation_id uuid,
  p_status text,
  p_error_code text default null,
  p_error_safe text default null,
  p_stripe_subscription_id text default null,
  p_stripe_invoice_id text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in (
    'queued', 'pending', 'awaiting_payment', 'awaiting_mirror', 'completed', 'failed', 'cancelled'
  ) then
    raise exception 'TEAM:INVALID_STATUS' using errcode = 'P0001';
  end if;

  update public.billing_seat_operations
    set status = p_status,
        error_code = coalesce(p_error_code, error_code),
        error_safe = coalesce(p_error_safe, error_safe),
        stripe_subscription_id = coalesce(p_stripe_subscription_id, stripe_subscription_id),
        stripe_invoice_id = coalesce(p_stripe_invoice_id, stripe_invoice_id),
        completed_at = case when p_status in ('completed', 'failed', 'cancelled')
          then now() else completed_at end
  where id = p_operation_id;

  return found;
end;
$$;

revoke all on function public.mark_seat_operation_status_v1(uuid, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.mark_seat_operation_status_v1(uuid, text, text, text, text, text)
  to service_role;

create or replace function public.revert_invitation_acceptance_payment_failed_v1(
  p_membership_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mem public.organisation_memberships%rowtype;
begin
  select * into v_mem
  from public.organisation_memberships
  where id = p_membership_id
  for update;

  if not found or v_mem.status is distinct from 'pending_billing' then
    return false;
  end if;

  perform public.team_lock_org(v_mem.org_id);

  update public.billing_seat_operations
    set status = 'failed',
        error_code = 'seat_payment_failed',
        error_safe = 'Your seat couldn''t be activated because the account payment needs attention.',
        completed_at = now()
  where membership_id = v_mem.id
    and kind = 'add'
    and status in ('pending', 'awaiting_payment', 'awaiting_mirror');

  -- Keep invitation recoverable (status accepting). pending_billing still
  -- reserves capacity. profiles.org_id stays unbound. ZERO org access.
  return true;
end;
$$;

revoke all on function public.revert_invitation_acceptance_payment_failed_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.revert_invitation_acceptance_payment_failed_v1(uuid)
  to service_role;

-- Authenticated helper: member can complete own activation after webhook.
create or replace function public.complete_own_pending_membership_v1()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'TEAM:NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select m.id into v_id
  from public.organisation_memberships m
  where m.user_id = auth.uid()
    and m.status = 'pending_billing'
  limit 1;

  if v_id is null then
    return exists (
      select 1 from public.organisation_memberships m
      where m.user_id = auth.uid() and m.status = 'active'
    );
  end if;

  return public.activate_membership_if_seats_paid_v1(v_id);
end;
$$;

revoke all on function public.complete_own_pending_membership_v1() from public, anon;
grant execute on function public.complete_own_pending_membership_v1()
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- M. Remove member + change role
-- ---------------------------------------------------------------------------

create or replace function public.remove_organisation_member_v1(p_membership_id uuid)
returns table (
  remaining_active integer,
  desired_paid_seat_quantity integer,
  operation_id uuid,
  operation_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := public.auth_org_id();
  v_actor text;
  v_target public.organisation_memberships%rowtype;
  v_remaining integer;
  v_op uuid;
  v_op_status text;
  v_existing public.billing_seat_operations%rowtype;
begin
  if v_uid is null or v_org is null then
    raise exception 'TEAM:NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  perform public.team_lock_org(v_org);

  select m.role into v_actor
  from public.organisation_memberships m
  where m.org_id = v_org and m.user_id = v_uid and m.status = 'active';

  if v_actor is distinct from 'owner' then
    raise exception 'TEAM:REMOVE_OWNER_ONLY' using errcode = 'P0001';
  end if;

  select * into v_target
  from public.organisation_memberships
  where id = p_membership_id and org_id = v_org
  for update;

  if not found then
    raise exception 'TEAM:MEMBER_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_target.role = 'owner' then
    raise exception 'TEAM:OWNER_CANNOT_BE_REMOVED' using errcode = 'P0001';
  end if;
  if v_target.user_id = v_uid then
    raise exception 'TEAM:CANNOT_REMOVE_SELF' using errcode = 'P0001';
  end if;
  if v_target.status = 'removed' then
    select count(*)::integer into v_remaining
    from public.organisation_memberships
    where org_id = v_org and status = 'active';
    return query select v_remaining, greatest(v_remaining, 1), null::uuid, null::text;
    return;
  end if;

  if v_target.status = 'pending_billing' then
    select o.* into v_existing
    from public.billing_seat_operations o
    where o.membership_id = v_target.id
      and o.kind = 'add'
      and o.status not in ('completed', 'cancelled')
    order by o.created_at desc
    limit 1
    for update;
    if found and v_existing.status in ('pending', 'awaiting_payment', 'awaiting_mirror') then
      raise exception 'TEAM:SEAT_IN_FLIGHT' using errcode = 'P0001';
    end if;
    if found then
      update public.billing_seat_operations
        set status = 'cancelled', completed_at = now()
      where id = v_existing.id;
    end if;
    update public.organisation_memberships
      set status = 'removed',
          removed_at = now(),
          removed_by = v_uid
    where id = v_target.id;
    update public.organisation_invitations
      set status = 'cancelled',
          cancelled_at = now()
    where invited_user_id = v_target.user_id
      and org_id = v_org
      and status = 'accepting';
    select count(*)::integer into v_remaining
    from public.organisation_memberships
    where org_id = v_org and status = 'active';
    return query select v_remaining, greatest(v_remaining, 1), null::uuid, 'cancelled';
    return;
  end if;

  update public.organisation_memberships
    set status = 'removed',
        removed_at = now(),
        removed_by = v_uid
  where id = v_target.id;

  select count(*)::integer into v_remaining
  from public.organisation_memberships
  where org_id = v_org and status = 'active';

  insert into public.billing_seat_operations (
    org_id,
    billing_environment,
    kind,
    membership_id,
    desired_paid_seat_quantity,
    status,
    created_by
  )
  values (
    v_org,
    public.billing_runtime_environment(),
    'remove',
    v_target.id,
    greatest(v_remaining, 1),
    'queued',
    v_uid
  )
  returning id into v_op;

  perform public.claim_next_seat_operation_v1(v_org, v_target.id);

  select count(*)::integer into v_remaining
  from public.organisation_memberships
  where org_id = v_org and status = 'active';

  select o.status into v_op_status
  from public.billing_seat_operations o
  where o.id = v_op;

  return query select v_remaining, greatest(v_remaining, 1), v_op, v_op_status;
end;
$$;

revoke all on function public.remove_organisation_member_v1(uuid) from public, anon;
grant execute on function public.remove_organisation_member_v1(uuid)
  to authenticated, service_role;

create or replace function public.change_organisation_member_role_v1(
  p_membership_id uuid,
  p_next_role text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := public.auth_org_id();
  v_actor text;
  v_target public.organisation_memberships%rowtype;
begin
  if v_uid is null or v_org is null then
    raise exception 'TEAM:NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select m.role into v_actor
  from public.organisation_memberships m
  where m.org_id = v_org and m.user_id = v_uid and m.status = 'active';

  select * into v_target
  from public.organisation_memberships
  where id = p_membership_id and org_id = v_org and status = 'active';

  if not found then
    raise exception 'TEAM:MEMBER_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_target.role = 'owner' or p_next_role = 'owner' then
    raise exception 'TEAM:OWNER_ROLE_LOCKED' using errcode = 'P0001';
  end if;

  if v_actor = 'owner' then
    if p_next_role not in ('admin', 'estimator', 'viewer') then
      raise exception 'TEAM:INVALID_ROLE' using errcode = 'P0001';
    end if;
  elsif v_actor = 'admin' then
    if v_target.role = 'admin' or p_next_role = 'admin' then
      raise exception 'TEAM:ADMIN_ROLE_RESTRICTED' using errcode = 'P0001';
    end if;
    if p_next_role not in ('estimator', 'viewer') then
      raise exception 'TEAM:INVALID_ROLE' using errcode = 'P0001';
    end if;
  else
    raise exception 'TEAM:FORBIDDEN' using errcode = 'P0001';
  end if;

  update public.organisation_memberships
    set role = p_next_role,
        role_changed_at = now(),
        role_changed_by = v_uid
  where id = v_target.id;

  return true;
end;
$$;

revoke all on function public.change_organisation_member_role_v1(uuid, text) from public, anon;
grant execute on function public.change_organisation_member_role_v1(uuid, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- N. Invite-aware provision — never create a standalone org when a pending
-- invitation matches the verified email.
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
  v_email text := public.current_user_verified_email();
  v_pending integer := 0;
  v_pending_membership boolean := false;
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

  select exists (
    select 1
    from public.organisation_memberships m
    where m.user_id = v_uid
      and m.status = 'pending_billing'
  )
    into v_pending_membership;

  if v_email is not null then
    select count(*)::integer
      into v_pending
    from public.organisation_invitations i
    where i.email_normalized = v_email
      and i.status in ('pending', 'accepting')
      and (i.status = 'accepting' or i.expires_at > now());
  end if;

  if v_pending_membership or coalesce(v_pending, 0) > 0 then
    raise exception 'PROVISION:PENDING_INVITATION'
      using errcode = 'P0001';
  end if;

  select p.org_id
    into v_existing_org
  from public.profiles p
  where p.id = v_uid;

  if found then
    if v_existing_org is null then
      -- Unbound profile with no join workflow: complete standalone provision
      -- onto this profile instead of creating a second identity.
      insert into public.organisations (name)
      values (v_org_name)
      returning id into v_org_id;

      update public.profiles
        set org_id = v_org_id,
            full_name = v_full_name,
            role = 'owner'
      where id = v_uid;

      insert into public.organisation_memberships (
        org_id, user_id, role, status, created_by, joined_at
      )
      values (v_org_id, v_uid, 'owner', 'active', v_uid, now());

      perform public.ensure_org_internal_trial(v_org_id);

      return query
      select v_org_id, v_uid, false;
      return;
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

    perform public.ensure_org_internal_trial(v_existing_org);

    if not exists (
      select 1
      from public.organisation_memberships m
      where m.user_id = v_uid
        and m.status = 'active'
    ) then
      insert into public.organisation_memberships (
        org_id, user_id, role, status, created_by, joined_at
      )
      values (v_existing_org, v_uid, 'owner', 'active', v_uid, now());
    end if;

    return query
    select v_existing_org, v_uid, true;
    return;
  end if;

  insert into public.organisations (name)
  values (v_org_name)
  returning id into v_org_id;

  insert into public.profiles (id, org_id, full_name, role)
  values (v_uid, v_org_id, v_full_name, 'owner');

  insert into public.organisation_memberships (
    org_id, user_id, role, status, created_by, joined_at
  )
  values (v_org_id, v_uid, 'owner', 'active', v_uid, now());

  perform public.ensure_org_internal_trial(v_org_id);

  return query
  select v_org_id, v_uid, false;
end;
$$;

comment on function public.provision_organisation_for_new_user(text, text) is
  'Atomically create organisation + owner profile + owner membership + internal trial. Refuses when a pending/accepting invitation or pending_billing membership exists, including unbound profiles waiting for paid-seat activation. Never creates a standalone org for invited users.';

-- ---------------------------------------------------------------------------
-- O. Team list (authenticated, own org)
-- ---------------------------------------------------------------------------

create or replace function public.list_organisation_team_v1()
returns table (
  membership_id uuid,
  user_id uuid,
  role text,
  status text,
  full_name text,
  email_display text,
  joined_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_org uuid := public.auth_org_id();
begin
  if auth.uid() is null or v_org is null then
    raise exception 'TEAM:NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  return query
  select
    m.id,
    m.user_id,
    m.role,
    m.status,
    p.full_name,
    coalesce(m.email_display, u.email, p.full_name),
    m.joined_at
  from public.organisation_memberships m
  join public.profiles p on p.id = m.user_id
  left join auth.users u on u.id = m.user_id
  where m.org_id = v_org
    and m.status in ('active', 'pending_billing');
end;
$$;

revoke all on function public.list_organisation_team_v1() from public, anon;
grant execute on function public.list_organisation_team_v1()
  to authenticated, service_role;

create or replace function public.list_organisation_invitations_v1()
returns table (
  invitation_id uuid,
  email_display text,
  role text,
  status text,
  expires_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
  v_role text;
begin
  if auth.uid() is null or v_org is null then
    raise exception 'TEAM:NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  perform public.expire_stale_organisation_invitations(v_org);

  select m.role into v_role
  from public.organisation_memberships m
  where m.org_id = v_org and m.user_id = auth.uid() and m.status = 'active';

  if v_role not in ('owner', 'admin') then
    return;
  end if;

  return query
  select
    i.id,
    i.email_display,
    i.role,
    i.status,
    i.expires_at,
    i.created_at
  from public.organisation_invitations i
  where i.org_id = v_org
    and i.status in ('pending', 'accepting');
end;
$$;

revoke all on function public.list_organisation_invitations_v1() from public, anon;
grant execute on function public.list_organisation_invitations_v1()
  to authenticated, service_role;

notify pgrst, 'reload schema';
