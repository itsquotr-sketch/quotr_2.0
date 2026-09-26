-- PLATFORM-02C fixture cleanup order.
-- A fixture user can own projects in a second PLATFORM-02C organisation.
-- Those projects must go before the profile, or profiles_created_by blocks
-- the delete. Only organisations named PLATFORM-02C % are eligible.

create or replace function public.preview_lifecycle_fixture_cleanup(p_org uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if coalesce(auth.role(), '') is distinct from 'service_role'
     and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select name into v_name
  from public.organisations
  where id = p_org;

  if v_name is null or v_name not like 'PLATFORM-02C %' then
    raise exception 'NOT_FOUND';
  end if;

  delete from public.projects p
  where p.created_by in (
    select id from public.profiles where org_id = p_org
  )
  and exists (
    select 1
    from public.organisations o
    where o.id = p.org_id
      and o.name like 'PLATFORM-02C %'
  );

  delete from public.projects where org_id = p_org;
  delete from public.organisation_memberships where org_id = p_org;
  delete from public.profiles where org_id = p_org;
  delete from public.organisations
  where id = p_org
    and name like 'PLATFORM-02C %';
end;
$$;

revoke all on function public.preview_lifecycle_fixture_cleanup(uuid)
  from public, anon, authenticated;
grant execute on function public.preview_lifecycle_fixture_cleanup(uuid) to service_role;

notify pgrst, 'reload schema';
