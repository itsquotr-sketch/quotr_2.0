-- Signup Terms acceptance. Existing profiles stay null: this does not infer
-- historical acceptance and does not send existing users through signup again.
-- Version 2026-10-15 is the Website Terms of Use effective 15 October 2026.

alter table public.profiles
  add column if not exists terms_version text,
  add column if not exists terms_accepted_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_terms_acceptance_chk;

alter table public.profiles
  add constraint profiles_terms_acceptance_chk
  check (
    (terms_version is null and terms_accepted_at is null)
    or (terms_version is not null and terms_accepted_at is not null)
  );

comment on column public.profiles.terms_version is
  'Website Terms of Use version accepted by this account. Null means this account has no recorded acceptance. Existing accounts are not backfilled.';

comment on column public.profiles.terms_accepted_at is
  'Server time recorded for the Terms version. Not inferred for accounts that signed up before this column existed.';

create or replace function public.set_own_terms_acceptance(
  p_version text,
  p_accepted_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_accepted_at timestamptz;
begin
  if v_uid is null then
    raise exception 'TERMS:NOT_AUTHENTICATED'
      using errcode = 'P0001';
  end if;

  if p_version is null or p_version !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'TERMS:INVALID_VERSION'
      using errcode = 'P0001';
  end if;

  -- Keep the first recorded acceptance. Do not rewrite an existing timestamp.
  if exists (
    select 1
    from public.profiles
    where id = v_uid
      and terms_accepted_at is not null
  ) then
    return true;
  end if;

  v_accepted_at := p_accepted_at;
  if v_accepted_at is null or v_accepted_at > now() + interval '2 minutes' then
    v_accepted_at := now();
  end if;

  update public.profiles
    set terms_version = p_version,
        terms_accepted_at = v_accepted_at
  where id = v_uid
    and terms_accepted_at is null;

  return found;
end;
$$;

comment on function public.set_own_terms_acceptance(text, timestamptz) is
  'Records Website Terms acceptance for auth.uid() once. Does not change marketing consent, role, or org_id, and does not backfill other accounts.';

revoke all on function public.set_own_terms_acceptance(text, timestamptz) from public, anon;

grant execute on function public.set_own_terms_acceptance(text, timestamptz)
  to authenticated, service_role;

notify pgrst, 'reload schema';
