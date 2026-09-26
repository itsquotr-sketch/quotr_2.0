-- PLATFORM-02C — copy successful hosted quote transactions into the
-- project lifecycle ledger. Does not backfill existing quote_events.
-- Does not change quote money, business_status, or acceptance evidence.
-- quote_sent remains one milestone per quote revision. Resend deliveries
-- do not insert another quote_events.quote_sent row.

create or replace function public.project_lifecycle_adopt_quote_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
  v_revision integer;
  v_business text;
  v_stage text;
begin
  if new.event_type in ('quote_created', 'quote_revision_created') then
    v_type := 'quote_created';
  elsif new.event_type = 'quote_sent' then
    v_type := 'quote_sent';
  else
    return new;
  end if;

  select q.revision_number into v_revision
  from public.quotes q
  where q.id = new.quote_id
    and q.org_id = new.org_id
    and q.project_id = new.project_id;

  if v_revision is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.quote_items i
    where i.quote_id = new.quote_id
      and i.org_id = new.org_id
      and i.project_id = new.project_id
  ) then
    return new;
  end if;

  insert into public.project_lifecycle_events (
    org_id, project_id, actor_user_id, event_type, occurred_at,
    source_entity_type, source_entity_id, idempotency_key, metadata, schema_version
  ) values (
    new.org_id,
    new.project_id,
    new.actor_user_id,
    v_type,
    coalesce(new.occurred_at, now()),
    'quote',
    new.quote_id,
    v_type || ':' || new.quote_id::text,
    jsonb_build_object(
      'quoteId', new.quote_id,
      'revisionNumber', v_revision
    ),
    1
  )
  on conflict (org_id, idempotency_key) do nothing;

  if v_type = 'quote_created' then
    select p.business_status into v_business
    from public.projects p
    where p.id = new.project_id
      and p.org_id = new.org_id
      and p.deleted_at is null;

    select stage into v_stage
    from public.project_lifecycle_positions
    where project_id = new.project_id
      and org_id = new.org_id;

    if v_stage in ('quote_sent', 'quote_accepted', 'active_job', 'completed', 'cancelled') then
      return new;
    end if;
    if v_stage is null
      and v_business is distinct from 'estimate_ready'
      and v_business is distinct from 'quote_draft' then
      return new;
    end if;

    insert into public.project_lifecycle_positions (project_id, org_id, stage)
    values (new.project_id, new.org_id, 'quote_draft')
    on conflict (project_id) do update
    set stage = 'quote_draft', updated_at = now()
    where public.project_lifecycle_positions.org_id = excluded.org_id
      and public.project_lifecycle_positions.stage in ('draft', 'pricing', 'quote_draft');
  else
    insert into public.project_lifecycle_positions (project_id, org_id, stage)
    values (new.project_id, new.org_id, 'quote_sent')
    on conflict (project_id) do update
    set stage = 'quote_sent', updated_at = now()
    where public.project_lifecycle_positions.org_id = excluded.org_id
      and public.project_lifecycle_positions.stage in (
        'draft', 'pricing', 'quote_draft', 'quote_sent'
      );
  end if;

  return new;
end;
$$;

drop trigger if exists quote_events_adopt_project_lifecycle on public.quote_events;
create trigger quote_events_adopt_project_lifecycle
  after insert on public.quote_events
  for each row
  execute function public.project_lifecycle_adopt_quote_event();

revoke all on function public.project_lifecycle_adopt_quote_event()
  from public, anon, authenticated, service_role;

comment on function public.project_lifecycle_adopt_quote_event() is
  'After a successful quote_events insert for create, revision or first send, append one lifecycle milestone. No backfill. Resends do not insert quote_sent.';

-- Fixture cleanup for PLATFORM-02C orgs only. Skips append-only triggers so
-- the isolated organisation can be removed. Authenticated users cannot call it.
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

  perform set_config('session_replication_role', 'replica', true);
  delete from public.organisation_memberships where org_id = p_org;
  delete from public.organisations where id = p_org and name like 'PLATFORM-02C %';
  delete from public.profiles where org_id = p_org;
  perform set_config('session_replication_role', 'origin', true);
end;
$$;

revoke all on function public.preview_lifecycle_fixture_cleanup(uuid)
  from public, anon, authenticated;
grant execute on function public.preview_lifecycle_fixture_cleanup(uuid) to service_role;

notify pgrst, 'reload schema';
