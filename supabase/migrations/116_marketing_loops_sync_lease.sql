-- COMMUNICATIONS — one in-flight Loops sync per consent revision.
-- Additive. Existing rows stay not eligible for the scheduled retry.
-- A lease stops a second worker from sending the same revision.
-- It expires so a crashed worker does not leave the row locked.
-- Does not change consent, does not backfill, and does not send email.

alter table public.profiles
  add column if not exists marketing_loops_sync_lease_until timestamptz,
  add column if not exists marketing_loops_auto_retry boolean not null default false;

comment on column public.profiles.marketing_loops_sync_lease_until is
  'While this is in the future, another Loops sync must not send this consent revision. Cleared when that attempt finishes and the revision still matches.';

comment on column public.profiles.marketing_loops_auto_retry is
  'True only after this automation schedules a new confirmed signup or a signed-in preference save. The daily retry reads pending rows with this flag. Existing pending rows stay false.';

create or replace function public.claim_own_marketing_loops_sync(p_revision bigint)
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
    set marketing_loops_sync_lease_until = now() + interval '2 minutes'
  where id = v_uid
    and marketing_loops_sync_pending
    and marketing_consent_revision = p_revision
    and (
      marketing_loops_sync_lease_until is null
      or marketing_loops_sync_lease_until < now()
    );

  return found;
end;
$$;

comment on function public.claim_own_marketing_loops_sync(bigint) is
  'Claims the Loops lease for auth.uid() when that consent revision is still pending and no lease is active.';

revoke all on function public.claim_own_marketing_loops_sync(bigint) from public, anon;
grant execute on function public.claim_own_marketing_loops_sync(bigint) to authenticated, service_role;

create or replace function public.release_own_marketing_loops_sync(p_revision bigint)
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
    set marketing_loops_sync_lease_until = null
  where id = v_uid
    and marketing_consent_revision = p_revision;

  return found;
end;
$$;

comment on function public.release_own_marketing_loops_sync(bigint) is
  'Clears the Loops lease for auth.uid() only while the consent revision still matches. Does not change pending.';

revoke all on function public.release_own_marketing_loops_sync(bigint) from public, anon;
grant execute on function public.release_own_marketing_loops_sync(bigint) to authenticated, service_role;

create or replace function public.mark_own_marketing_loops_auto_retry()
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

  update public.profiles
    set marketing_loops_auto_retry = true
  where id = v_uid
    and marketing_loops_sync_pending;

  return found;
end;
$$;

comment on function public.mark_own_marketing_loops_auto_retry() is
  'Marks auth.uid() eligible for the daily pending retry. Does not change consent or clear pending.';

revoke all on function public.mark_own_marketing_loops_auto_retry() from public, anon;
grant execute on function public.mark_own_marketing_loops_auto_retry() to authenticated, service_role;

create or replace function public.claim_marketing_loops_sync(
  p_user_id uuid,
  p_revision bigint
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_revision is null then
    raise exception 'CONSENT:INVALID'
      using errcode = 'P0001';
  end if;

  update public.profiles
    set marketing_loops_sync_lease_until = now() + interval '2 minutes'
  where id = p_user_id
    and marketing_loops_sync_pending
    and marketing_consent_revision = p_revision
    and (
      marketing_loops_sync_lease_until is null
      or marketing_loops_sync_lease_until < now()
    );

  return found;
end;
$$;

comment on function public.claim_marketing_loops_sync(uuid, bigint) is
  'Service-role claim of one pending Loops consent revision. Authenticated clients cannot execute it.';

revoke all on function public.claim_marketing_loops_sync(uuid, bigint) from public, anon, authenticated;
grant execute on function public.claim_marketing_loops_sync(uuid, bigint) to service_role;

create or replace function public.release_marketing_loops_sync(
  p_user_id uuid,
  p_revision bigint
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_revision is null then
    raise exception 'CONSENT:INVALID'
      using errcode = 'P0001';
  end if;

  update public.profiles
    set marketing_loops_sync_lease_until = null
  where id = p_user_id
    and marketing_consent_revision = p_revision;

  return found;
end;
$$;

comment on function public.release_marketing_loops_sync(uuid, bigint) is
  'Service-role release of one Loops lease when the revision still matches. Does not change pending.';

revoke all on function public.release_marketing_loops_sync(uuid, bigint) from public, anon, authenticated;
grant execute on function public.release_marketing_loops_sync(uuid, bigint) to service_role;

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
       or new.marketing_loops_sync_lease_until is distinct from old.marketing_loops_sync_lease_until
       or new.marketing_loops_auto_retry is distinct from old.marketing_loops_auto_retry
     ) then
    raise exception 'PROFILE:FORBIDDEN'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

comment on function public.protect_profile_tenant_columns() is
  'Authenticated sessions cannot change profiles.role, profiles.org_id, marketing_loops_sync_pending, marketing_consent_revision, the Loops lease, or marketing_loops_auto_retry. Membership and consent SECURITY DEFINER functions still may.';

notify pgrst, 'reload schema';
