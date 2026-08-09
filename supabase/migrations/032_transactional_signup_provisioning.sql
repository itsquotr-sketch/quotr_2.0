-- Stage 3.1C.1B — Transactional signup provisioning RPC.
-- Additive. Local-first; do not apply remotely without owner gate.
--
-- Problem (AUTH-001): signup used service-role org insert then profile insert
-- outside a shared transaction → orphan auth users / organisations on failure.
--
-- Solution: authenticated callers invoke provision_organisation_for_new_user
-- which creates organisation + profile atomically under SECURITY DEFINER.
--
-- SECURITY DEFINER justification:
-- organisations has no INSERT policy for authenticated (chicken-and-egg:
-- auth_org_id() requires a profile; profile requires an organisation).
-- profiles has no INSERT policy for authenticated either.
-- The function is narrowly scoped: derives subject from auth.uid() only,
-- never accepts user_id/org_id, locks on uid for concurrency, and is
-- idempotent when a valid profile already exists.

-- ---------------------------------------------------------------------------
-- A. Provisioning function
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

  -- Serialize concurrent first-time provision attempts for the same auth user.
  perform pg_advisory_xact_lock(87230132, hashtext(v_uid::text));

  select p.org_id
    into v_existing_org
  from public.profiles p
  where p.id = v_uid;

  if found then
    if v_existing_org is null then
      raise exception 'PROVISION:PROFILE_INCONSISTENT'
        using errcode = 'P0001';
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

    -- Idempotent: do not create another organisation.
    return query
    select v_existing_org, v_uid, true;
    return;
  end if;

  insert into public.organisations (name)
  values (v_org_name)
  returning id into v_org_id;

  insert into public.profiles (id, org_id, full_name, role)
  values (v_uid, v_org_id, v_full_name, 'owner');

  return query
  select v_org_id, v_uid, false;
end;
$$;

comment on function public.provision_organisation_for_new_user(text, text) is
  'Stage 3.1C.1B: atomically create organisation + owner profile for auth.uid(). Idempotent. Never accepts user_id/org_id.';

-- ---------------------------------------------------------------------------
-- B. Grants — authenticated execute only (+ service_role admin parity)
-- ---------------------------------------------------------------------------

revoke all on function public.provision_organisation_for_new_user(text, text)
  from public, anon;

grant execute on function public.provision_organisation_for_new_user(text, text)
  to authenticated, service_role;

-- anon: intentionally no EXECUTE.

notify pgrst, 'reload schema';
