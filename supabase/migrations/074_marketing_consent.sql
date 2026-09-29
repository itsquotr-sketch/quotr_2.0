-- COMMUNICATIONS-1 — per-user product/marketing consent.
-- Additive. Existing rows stay opted out (default false, no timestamp).
-- Consent is per user, not per organisation.
-- Does not change billing, quotes, variations, invitations, or Resend.

alter table public.profiles
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists marketing_consent_at timestamptz,
  add column if not exists marketing_consent_source text;

alter table public.profiles
  drop constraint if exists profiles_marketing_consent_source_chk;

alter table public.profiles
  add constraint profiles_marketing_consent_source_chk
  check (
    marketing_consent_source is null
    or marketing_consent_source in ('signup', 'settings')
  );

alter table public.profiles
  drop constraint if exists profiles_marketing_consent_at_chk;

alter table public.profiles
  add constraint profiles_marketing_consent_at_chk
  check (
    (marketing_consent = false and marketing_consent_at is null)
    or (marketing_consent = true and marketing_consent_at is not null)
  );

comment on column public.profiles.marketing_consent is
  'Explicit opt-in to Quotr product and marketing communications. Default false. Existing users are not opted in by this migration.';

comment on column public.profiles.marketing_consent_at is
  'Timestamp of the current explicit opt-in. Null when the user is not opted in, so a timestamp never indicates consent by itself.';

comment on column public.profiles.marketing_consent_source is
  'signup = choice captured from account creation. settings = later profile change. Null = never explicitly recorded (existing users).';

-- Own-row write that also works while profiles.org_id is null (invited users
-- before paid-seat activation). The existing profile UPDATE policy requires
-- org_id = auth_org_id(), which does not hold for an unbound profile.
-- The function never accepts a user id and never changes role or org_id.

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
        marketing_consent_source = p_source
  where id = v_uid;

  return found;
end;
$$;

comment on function public.set_own_marketing_consent(boolean, text) is
  'Sets marketing consent for auth.uid() only. Opt-in writes marketing_consent_at. Opt-out clears it. Does not change role or org_id.';

revoke all on function public.set_own_marketing_consent(boolean, text) from public, anon;

grant execute on function public.set_own_marketing_consent(boolean, text)
  to authenticated, service_role;

notify pgrst, 'reload schema';
