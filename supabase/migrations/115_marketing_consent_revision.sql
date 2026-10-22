-- COMMUNICATIONS — consent revision for in-flight Loops acknowledgement.
-- Additive. Existing rows stay at revision 0 and not pending.
-- set_own_marketing_consent still writes consent evidence and sets
-- marketing_loops_sync_pending. It also increments the revision.
-- Acknowledgement clears pending only when both the consent and the
-- revision still match the values sent to Loops. A newer choice keeps
-- the flag set. A stale send can re-arm the flag; it cannot clear it.
-- Does not change billing, quotes, variations, invitations, Resend, or
-- existing signup rows.

alter table public.profiles
  add column if not exists marketing_consent_revision bigint not null default 0;

comment on column public.profiles.marketing_consent_revision is
  'Increments on every set_own_marketing_consent for auth.uid(). Loops acknowledgement clears marketing_loops_sync_pending only while this still equals the revision that was sent.';

create or replace function public.set_own_marketing_consent(
  p_consent boolean,
  p_source text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'CONSENT:NOT_AUTHENTICATED'
      using errcode = 'P0001';
  end if;

  if p_consent is null then
    raise exception 'CONSENT:INVALID'
      using errcode = 'P0001';
  end if;

  if p_source is distinct from 'signup'
     and p_source is distinct from 'settings'
     and p_source is distinct from 'onboarding' then
    raise exception 'CONSENT:INVALID_SOURCE'
      using errcode = 'P0001';
  end if;

  update public.profiles
    set marketing_consent = p_consent,
        marketing_consent_at = case when p_consent then now() else null end,
        marketing_consent_source = p_source,
        marketing_loops_sync_pending = true,
        marketing_consent_revision = marketing_consent_revision + 1
  where id = v_uid;

  return found;
end;
$$;

comment on function public.set_own_marketing_consent(boolean, text) is
  'Sets marketing consent for auth.uid() only, records consent evidence, increments marketing_consent_revision, and marks the Loops preference sync pending. Source may be signup, settings, or onboarding. Opt-in writes marketing_consent_at. Opt-out clears it. Does not change role or org_id.';

drop function if exists public.acknowledge_own_marketing_loops_sync(boolean);

create or replace function public.acknowledge_own_marketing_loops_sync(
  p_consent boolean,
  p_revision bigint
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'CONSENT:NOT_AUTHENTICATED'
      using errcode = 'P0001';
  end if;

  if p_consent is null or p_revision is null then
    raise exception 'CONSENT:INVALID'
      using errcode = 'P0001';
  end if;

  update public.profiles
    set marketing_loops_sync_pending = false
  where id = v_uid
    and marketing_consent = p_consent
    and marketing_consent_revision = p_revision
    and marketing_loops_sync_pending;

  return found;
end;
$$;

comment on function public.acknowledge_own_marketing_loops_sync(boolean, bigint) is
  'Clears marketing_loops_sync_pending for auth.uid() only when marketing_consent and marketing_consent_revision still equal the values Loops accepted.';

revoke all on function public.acknowledge_own_marketing_loops_sync(boolean, bigint) from public, anon;

grant execute on function public.acknowledge_own_marketing_loops_sync(boolean, bigint)
  to authenticated, service_role;

-- A stale in-flight send must not leave the newer choice looking synced.
-- This sets the flag again only when the revision has moved.
create or replace function public.rearm_own_marketing_loops_sync(
  p_revision bigint
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'CONSENT:NOT_AUTHENTICATED'
      using errcode = 'P0001';
  end if;

  if p_revision is null then
    raise exception 'CONSENT:INVALID'
      using errcode = 'P0001';
  end if;

  update public.profiles
    set marketing_loops_sync_pending = true
  where id = v_uid
    and marketing_consent_revision is distinct from p_revision;

  return found;
end;
$$;

comment on function public.rearm_own_marketing_loops_sync(bigint) is
  'Sets marketing_loops_sync_pending for auth.uid() when the consent revision no longer matches an in-flight Loops send. Does not clear the flag.';

revoke all on function public.rearm_own_marketing_loops_sync(bigint) from public, anon;

grant execute on function public.rearm_own_marketing_loops_sync(bigint)
  to authenticated, service_role;

create or replace function public.protect_profile_tenant_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and current_user = 'authenticated'
     and (
       new.role is distinct from old.role
       or new.org_id is distinct from old.org_id
       or new.marketing_loops_sync_pending is distinct from old.marketing_loops_sync_pending
       or new.marketing_consent_revision is distinct from old.marketing_consent_revision
     ) then
    raise exception 'PROFILE:FORBIDDEN'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

comment on function public.protect_profile_tenant_columns() is
  'Authenticated sessions cannot change profiles.role, profiles.org_id, marketing_loops_sync_pending, or marketing_consent_revision. Membership and consent SECURITY DEFINER functions still may.';

notify pgrst, 'reload schema';
