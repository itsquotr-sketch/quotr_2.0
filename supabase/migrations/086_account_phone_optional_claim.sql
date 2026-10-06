-- Fix signup phone claim for accounts that do not send a phone.
-- A missing metadata key made `signup_phone_required = 'true'` NULL, and
-- NULL is not false, so legacy and admin-created users were rejected.
-- Product signup still sets the flag and a normalized number.
-- No backfill. Does not change the unique index or existing claims.

create or replace function public.claim_signup_account_phone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_phone text := nullif(btrim(v_meta->>'phone_e164'), '');
  v_country text := nullif(btrim(v_meta->>'phone_country'), '');
  v_display text := nullif(btrim(v_meta->>'phone_display'), '');
begin
  if v_phone is null and v_meta->>'signup_phone_required' is distinct from 'true' then
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
  'Claims metadata phone_e164 during auth.users insert. Missing phone is allowed unless signup_phone_required is true. Unique conflicts roll the new auth user back.';
