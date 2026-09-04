-- SECURITY-053 — role-aware RLS hardening.
-- Additive. Environment-neutral. Preview-first; later Production after 046–052.
-- Does not change estimating, Pricing, Quote money, Stripe, or public token RPCs.
--
-- Closes:
--   * Estimator direct UPDATE on organisation_settings / commercial rates
--   * Viewer direct DML on project work, facts, and organisation_work_areas
--   * Any-member branding storage writes
--
-- RLS enforces broad role capability. Server actions remain more granular
-- (Owner-only paid seats). SECURITY DEFINER DNA RPCs keep writing
-- productivity rates for Owner/Admin/Estimator.

-- ---------------------------------------------------------------------------
-- A. Company-admin helper (Owner/Admin ACTIVE only)
-- ---------------------------------------------------------------------------

create or replace function public.auth_can_manage_company()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organisation_memberships m
    where m.user_id = auth.uid()
      and m.org_id = public.auth_org_id()
      and m.status = 'active'
      and m.role in ('owner', 'admin')
  )
$$;

comment on function public.auth_can_manage_company() is
  'True only for an ACTIVE Owner/Admin membership in the bound org. Used for organisation_settings, commercial rates, organisation_work_areas, and branding storage. Estimator and Viewer are denied. service_role bypasses RLS.';

revoke all on function public.auth_can_manage_company() from public, anon;
grant execute on function public.auth_can_manage_company() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- B. Prevent authenticated clients from changing profiles.role / org_id
-- Membership sync trigger (SECURITY DEFINER) still updates those columns.
-- ---------------------------------------------------------------------------

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
     ) then
    raise exception 'PROFILE:FORBIDDEN'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

comment on function public.protect_profile_tenant_columns() is
  'Authenticated sessions cannot change profiles.role or profiles.org_id. Membership SECURITY DEFINER sync still may.';

revoke all on function public.protect_profile_tenant_columns() from public, anon, authenticated;

drop trigger if exists profiles_protect_tenant_columns on public.profiles;
create trigger profiles_protect_tenant_columns
  before update on public.profiles
  for each row
  execute function public.protect_profile_tenant_columns();

-- ---------------------------------------------------------------------------
-- C. Move organisation_settings + rates off work-role onto company-role
-- Keep 003/002 permissive org_id policies; RESTRICTIVE ANDs with them.
-- ---------------------------------------------------------------------------

drop policy if exists organisation_settings_write_requires_work_role_insert
  on public.organisation_settings;
drop policy if exists organisation_settings_write_requires_work_role_update
  on public.organisation_settings;
drop policy if exists organisation_settings_write_requires_work_role_delete
  on public.organisation_settings;

drop policy if exists rates_write_requires_work_role_insert on public.rates;
drop policy if exists rates_write_requires_work_role_update on public.rates;
drop policy if exists rates_write_requires_work_role_delete on public.rates;

do $$
declare
  t text;
  op text;
begin
  foreach t in array array[
    'organisation_settings',
    'rates',
    'organisation_work_areas'
  ]
  loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      foreach op in array array['insert', 'update', 'delete']
      loop
        execute format(
          'drop policy if exists %I on public.%I',
          t || '_write_requires_company_role_' || op,
          t
        );
      end loop;
      execute format(
        'create policy %I on public.%I as restrictive for insert to authenticated with check (public.auth_can_manage_company())',
        t || '_write_requires_company_role_insert',
        t
      );
      execute format(
        'create policy %I on public.%I as restrictive for update to authenticated using (public.auth_can_manage_company()) with check (public.auth_can_manage_company())',
        t || '_write_requires_company_role_update',
        t
      );
      execute format(
        'create policy %I on public.%I as restrictive for delete to authenticated using (public.auth_can_manage_company())',
        t || '_write_requires_company_role_delete',
        t
      );
    end if;
  end loop;
end;
$$;

-- organisations UPDATE already checks profiles.role; require membership Owner/Admin too.
drop policy if exists organisations_write_requires_company_role_update
  on public.organisations;
create policy organisations_write_requires_company_role_update
  on public.organisations
  as restrictive
  for update
  to authenticated
  using (public.auth_can_manage_company())
  with check (public.auth_can_manage_company());

-- ---------------------------------------------------------------------------
-- D. Viewer cannot mutate project work / ISD / notes / quote counters
-- Estimator remains allowed via auth_can_mutate_work().
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'work_areas',
    'project_facts',
    'question_blocks',
    'questions',
    'constraints',
    'project_notes',
    'note_proposals',
    'work_area_scope_items',
    'work_area_scope_item_decisions',
    'scope_discovery_runs',
    'scope_discovery_suggestions',
    'scope_discovery_decisions',
    'calibration_responses',
    'estimate_requirement_snapshots',
    'ai_usage_events',
    'pricing_audit_log',
    'organisation_quote_counters'
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
-- E. Branding storage — Owner/Admin only (logo is company administration)
-- ---------------------------------------------------------------------------

drop policy if exists "organisation_branding_insert_org_member" on storage.objects;
create policy "organisation_branding_insert_org_member"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'organisation-branding'
    and public.auth_can_manage_company()
    and (storage.foldername(name))[1] = (
      select p.org_id::text
      from public.profiles p
      where p.id = auth.uid()
    )
    and (storage.foldername(name))[2] = 'branding'
  );

drop policy if exists "organisation_branding_update_org_member" on storage.objects;
create policy "organisation_branding_update_org_member"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'organisation-branding'
    and public.auth_can_manage_company()
    and (storage.foldername(name))[1] = (
      select p.org_id::text
      from public.profiles p
      where p.id = auth.uid()
    )
  )
  with check (
    bucket_id = 'organisation-branding'
    and public.auth_can_manage_company()
    and (storage.foldername(name))[1] = (
      select p.org_id::text
      from public.profiles p
      where p.id = auth.uid()
    )
  );

drop policy if exists "organisation_branding_delete_org_member" on storage.objects;
create policy "organisation_branding_delete_org_member"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'organisation-branding'
    and public.auth_can_manage_company()
    and (storage.foldername(name))[1] = (
      select p.org_id::text
      from public.profiles p
      where p.id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- F. Grants — keep authenticated SELECT; do not revoke Owner/Admin table DML.
-- Team/billing/token tables already SELECT-only or service_role-only.
-- DNA evidence remains SELECT-only for authenticated (052).
-- ---------------------------------------------------------------------------

notify pgrst, 'reload schema';
