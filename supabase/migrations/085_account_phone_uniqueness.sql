-- Account phone capture. Additive. No backfill.
--
-- One normalized E.164 number can belong to one auth user. The unique index
-- is taken inside the auth.users INSERT transaction by
-- claim_signup_account_phone(). Two concurrent signups of the same
-- normalized number cannot both commit: the loser raises
-- PHONE:ALREADY_LINKED and that auth user insert rolls back with it.
-- No profile or organisation is created by this claim.
--
-- Company contact_phone and customers.phone are different fields and are
-- not part of this constraint.
--
-- A pending invitation is not consumed here. Invite signup still does not
-- create an organisation. If the phone is already claimed, the new auth
-- user rolls back and the invitation stays pending.
-- Existing accounts have no row and are not given a guessed number.
-- Phone is not authentication.

create or replace function public.account_phone_is_valid(
  p_phone_e164 text,
  p_country_code text
)
returns boolean
language sql
immutable
as $$
  select case p_country_code
    when 'NZ' then p_phone_e164 ~ '^\+64[1-9][0-9]{7,11}$'
    when 'AU' then p_phone_e164 ~ '^\+61[1-9][0-9]{7,11}$'
    else false
  end;
$$;

comment on function public.account_phone_is_valid(text, text) is
  'E.164 shape check for NZ (+64) and AU (+61). Signup still validates the number before this.';

create table public.account_phone_numbers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  phone_e164 text not null,
  phone_display text,
  country_code text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_phone_numbers_country_chk
    check (country_code in ('NZ', 'AU')),
  constraint account_phone_numbers_e164_chk
    check (public.account_phone_is_valid(phone_e164, country_code)),
  constraint account_phone_numbers_display_chk
    check (phone_display is null or char_length(phone_display) between 1 and 40)
);

create unique index account_phone_numbers_phone_e164_uidx
  on public.account_phone_numbers (phone_e164);

comment on table public.account_phone_numbers is
  'One account phone per auth user. Uniqueness is phone_e164, claimed in the auth.users insert transaction. Deleting the auth user releases the number. Not used to sign in.';

comment on column public.account_phone_numbers.phone_e164 is
  'Normalized E.164 comparison value. Local and +64/+61 forms of the same number collide here.';

comment on column public.account_phone_numbers.phone_display is
  'What the person typed. Never used for uniqueness.';

alter table public.account_phone_numbers enable row level security;

create policy account_phone_numbers_select_own
  on public.account_phone_numbers
  for select
  to authenticated
  using (user_id = auth.uid());

revoke all on table public.account_phone_numbers from public, anon, authenticated;
grant select on table public.account_phone_numbers to authenticated;

-- Signup claim. AFTER INSERT so auth.users.id exists for the foreign key.
-- Raising aborts the auth user insert. Missing phone is allowed so existing
-- admin-created and legacy users are unchanged. Product signup sets
-- signup_phone_required and a normalized phone_e164.
create or replace function public.claim_signup_account_phone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_required boolean := v_meta->>'signup_phone_required' = 'true';
  v_phone text := nullif(btrim(v_meta->>'phone_e164'), '');
  v_country text := nullif(btrim(v_meta->>'phone_country'), '');
  v_display text := nullif(btrim(v_meta->>'phone_display'), '');
begin
  if v_phone is null and not v_required then
    return new;
  end if;

  if v_phone is null
     or v_country is null
     or not public.account_phone_is_valid(v_phone, v_country)
     or (v_display is not null and char_length(v_display) > 40) then
    raise exception 'PHONE:INVALID' using errcode = 'P0001';
  end if;

  begin
    insert into public.account_phone_numbers (
      user_id, phone_e164, phone_display, country_code
    ) values (
      new.id, v_phone, v_display, v_country
    );
  exception
    when unique_violation then
      raise exception 'PHONE:ALREADY_LINKED' using errcode = 'P0001';
  end;

  return new;
end;
$$;

comment on function public.claim_signup_account_phone() is
  'Claims metadata phone_e164 during auth.users insert. Unique conflicts roll the new auth user back. Does not create an organisation or reveal another account.';

drop trigger if exists claim_signup_account_phone on auth.users;

create trigger claim_signup_account_phone
  after insert on auth.users
  for each row
  execute function public.claim_signup_account_phone();

revoke all on function public.claim_signup_account_phone() from public, anon, authenticated;
grant execute on function public.claim_signup_account_phone() to supabase_auth_admin, service_role;

revoke all on function public.account_phone_is_valid(text, text) from public, anon, authenticated;
grant execute on function public.account_phone_is_valid(text, text) to service_role, supabase_auth_admin;

-- Profile edit. Same normalization gate and the same unique index.
-- auth.uid() only. A conflict names no other account.
create or replace function public.set_own_account_phone(
  p_phone_e164 text,
  p_phone_display text,
  p_country_code text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_phone text := nullif(btrim(p_phone_e164), '');
  v_display text := nullif(btrim(p_phone_display), '');
  v_country text := nullif(btrim(p_country_code), '');
begin
  if v_uid is null then
    raise exception 'PHONE:NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  if v_phone is null
     or v_country is null
     or not public.account_phone_is_valid(v_phone, v_country)
     or v_display is null
     or char_length(v_display) > 40 then
    raise exception 'PHONE:INVALID' using errcode = 'P0001';
  end if;

  begin
    insert into public.account_phone_numbers (
      user_id, phone_e164, phone_display, country_code
    ) values (
      v_uid, v_phone, v_display, v_country
    )
    on conflict (user_id) do update
      set phone_e164 = excluded.phone_e164,
          phone_display = excluded.phone_display,
          country_code = excluded.country_code,
          updated_at = now();
  exception
    when unique_violation then
      raise exception 'PHONE:ALREADY_LINKED' using errcode = 'P0001';
  end;

  return true;
end;
$$;

comment on function public.set_own_account_phone(text, text, text) is
  'Sets auth.uid() account phone. Same E.164 uniqueness as signup. Does not change role, organisation, or membership.';

revoke all on function public.set_own_account_phone(text, text, text) from public, anon;
grant execute on function public.set_own_account_phone(text, text, text) to authenticated, service_role;

-- Boolean only. No account fields. Not callable by anon or signed-in users.
create or replace function public.account_phone_is_claimed(p_phone_e164 text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.account_phone_numbers
    where phone_e164 = nullif(btrim(p_phone_e164), '')
  );
$$;

comment on function public.account_phone_is_claimed(text) is
  'Service-role boolean for a failed signup submit. Does not return who owns the number.';

revoke all on function public.account_phone_is_claimed(text) from public, anon, authenticated;
grant execute on function public.account_phone_is_claimed(text) to service_role;

notify pgrst, 'reload schema';
