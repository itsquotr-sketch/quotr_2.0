-- COMMUNICATIONS-1b — durable Loops preference reconciliation.
-- Additive. Existing rows stay not-pending (default false).
-- An explicit consent write marks the preference as still needing Loops
-- confirmation. A later contact sync retries subscribed until Loops accepts
-- the value that is still stored. Ordinary sync does not send subscribed
-- while this flag is false.
-- Does not change billing, quotes, variations, invitations, or Resend.

alter table public.profiles
  add column if not exists marketing_loops_sync_pending boolean not null default false;

comment on column public.profiles.marketing_loops_sync_pending is
  'True when the stored marketing preference has not yet been confirmed in Loops. Routine contact sync sends subscribed only while this is true.';

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

  if p_source is distinct from 'signup' and p_source is distinct from 'settings' then
    raise exception 'CONSENT:INVALID_SOURCE'
      using errcode = 'P0001';
  end if;

  update public.profiles
    set marketing_consent = p_consent,
        marketing_consent_at = case when p_consent then now() else null end,
        marketing_consent_source = p_source,
        marketing_loops_sync_pending = true
  where id = v_uid;

  return found;
end;
$$;

comment on function public.set_own_marketing_consent(boolean, text) is
  'Sets marketing consent for auth.uid() only and marks the Loops preference sync pending. Opt-in writes marketing_consent_at. Opt-out clears it. Does not change role or org_id.';

-- Clears the pending flag only when the stored consent still matches the
-- value Loops just accepted. A newer explicit choice keeps the flag set.
create or replace function public.acknowledge_own_marketing_loops_sync(
  p_consent boolean
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

  update public.profiles
    set marketing_loops_sync_pending = false
  where id = v_uid
    and marketing_consent = p_consent
    and marketing_loops_sync_pending;

  return found;
end;
$$;

comment on function public.acknowledge_own_marketing_loops_sync(boolean) is
  'Clears marketing_loops_sync_pending for auth.uid() only when marketing_consent still equals p_consent.';

revoke all on function public.acknowledge_own_marketing_loops_sync(boolean) from public, anon;

grant execute on function public.acknowledge_own_marketing_loops_sync(boolean)
  to authenticated, service_role;

-- Authenticated sessions cannot flip the pending flag themselves.
-- The SECURITY DEFINER functions above still can. service_role updates
-- used by organisation contact sync are not current_user = authenticated.
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
     ) then
    raise exception 'PROFILE:FORBIDDEN'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

comment on function public.protect_profile_tenant_columns() is
  'Authenticated sessions cannot change profiles.role, profiles.org_id, or marketing_loops_sync_pending. Membership and consent SECURITY DEFINER functions still may.';

notify pgrst, 'reload schema';
