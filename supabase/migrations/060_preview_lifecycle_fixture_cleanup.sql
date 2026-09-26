-- PLATFORM-02C fixture cleanup.
-- service_role cannot set session_replication_role, so the 059 cleanup
-- function could not remove isolated Preview organisations.
-- DELETE of quote history is allowed only for organisations whose name
-- starts with 'PLATFORM-02C ' and only when the request role is service_role.
-- UPDATE remains forbidden. Authenticated users have no DELETE grant.
-- No backfill. No change to quote money, acceptance, or lifecycle writes.

create or replace function public.preview_fixture_org(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.role(), '') = 'service_role'
    and exists (
      select 1
      from public.organisations
      where id = p_org
        and name like 'PLATFORM-02C %'
    );
$$;

revoke all on function public.preview_fixture_org(uuid)
  from public, anon, authenticated;
grant execute on function public.preview_fixture_org(uuid) to service_role;

create or replace function public.enforce_quote_events_append_only()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' and public.preview_fixture_org(old.org_id) then
    return old;
  end if;
  raise exception 'quote_events are append-only';
end;
$$;

create or replace function public.enforce_quote_acceptance_evidence_append_only()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' and public.preview_fixture_org(old.org_id) then
    return old;
  end if;
  raise exception 'quote acceptance evidence is append-only';
end;
$$;

create or replace function public.prevent_quote_item_snapshot_mutation()
returns trigger
language plpgsql
as $$
declare
  quote_status text;
  send_lock uuid;
  target_quote_id uuid;
begin
  if tg_op = 'DELETE' and public.preview_fixture_org(old.org_id) then
    return old;
  end if;

  target_quote_id := coalesce(new.quote_id, old.quote_id);
  select status, send_lock_delivery_id into quote_status, send_lock
  from public.quotes
  where id = target_quote_id;

  if quote_status is null or quote_status = 'draft' then
    if send_lock is not null then
      raise exception 'QUOTE_TXN:SEND_IN_PROGRESS';
    end if;
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  raise exception 'Quote items are immutable once the quote is no longer a draft';
end;
$$;

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
