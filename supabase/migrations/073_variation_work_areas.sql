-- VARIATIONS V1-R1 — Variation-specific work areas.
-- Estimator work_areas, estimates, pricing documents and accepted Quote
-- snapshots are not written. A Variation work area belongs to one revision
-- so an issued revision stays immutable when a later revision is edited.
-- Duplicate names are rejected within one revision, ignoring case and
-- surrounding whitespace. Historical revisions keep their own copies.

-- ---------------------------------------------------------------------------
-- A. Revision-scoped work areas. No foreign key into estimator work_areas.
-- ---------------------------------------------------------------------------

create table if not exists public.variation_work_areas (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.variation_revisions (id) on delete cascade,
  variation_id uuid not null references public.variations (id) on delete cascade,
  org_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  description text,
  sort_order integer not null default 0 check (sort_order >= 0 and sort_order <= 10000),
  copied_from_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint variation_work_areas_name_chk check (char_length(btrim(name)) between 1 and 120),
  constraint variation_work_areas_description_chk check (
    description is null or char_length(description) <= 2000
  )
);

create unique index if not exists variation_work_areas_name_uidx
  on public.variation_work_areas (revision_id, lower(btrim(name)));

create unique index if not exists variation_work_areas_copy_uidx
  on public.variation_work_areas (revision_id, copied_from_id)
  where copied_from_id is not null;

create index if not exists variation_work_areas_variation_idx
  on public.variation_work_areas (variation_id, revision_id, sort_order);

comment on table public.variation_work_areas is
  'Client-facing scope grouping owned by one Variation revision. It does not insert estimator work areas or change accepted contract money.';

alter table public.variation_items
  add column if not exists variation_work_area_id uuid references public.variation_work_areas (id) on delete set null;

alter table public.variation_items
  drop constraint if exists variation_items_one_work_area_chk;

alter table public.variation_items
  add constraint variation_items_one_work_area_chk check (
    work_area_id is null or variation_work_area_id is null
  );

comment on column public.variation_items.variation_work_area_id is
  'Optional link to a Variation work area on the same revision. Estimator work_area_id remains traceability only.';

-- Item writers set estimator work_area_id and leave variation_work_area_id for
-- assign_draft_variation_item_scope_v1. Clear the stale link in the same
-- statement so the exclusivity check can pass, then assign writes the final pair.
create or replace function public.variation_items_resolve_scope_conflict()
returns trigger
language plpgsql
as $$
begin
  if new.work_area_id is not null and new.variation_work_area_id is not null then
    if tg_op = 'UPDATE' and new.work_area_id is distinct from old.work_area_id then
      new.variation_work_area_id := null;
    else
      new.work_area_id := null;
      new.work_area_type := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists variation_items_resolve_scope_conflict on public.variation_items;
create trigger variation_items_resolve_scope_conflict
  before insert or update on public.variation_items
  for each row
  execute function public.variation_items_resolve_scope_conflict();

-- ---------------------------------------------------------------------------
-- B. Draft-only mutation. Issued and historical rows stay frozen.
-- ---------------------------------------------------------------------------

create or replace function public.variation_guard_mutation()
returns trigger
language plpgsql
as $$
declare
  v_mode text := nullif(current_setting('quotr.variation_write', true), '');
  v_status text;
  v_revision uuid;
  v_match_status text;
begin
  if tg_op = 'DELETE'
    and current_user in ('postgres', 'supabase_admin')
    and auth.uid() is null
  then
    return old;
  end if;

  if tg_op = 'DELETE' and v_mode = 'delete_draft' then
    return old;
  end if;

  if tg_table_name = 'variation_items' then
    v_revision := coalesce(new.revision_id, old.revision_id);
    select status into v_status
    from public.variation_revisions
    where id = v_revision;
    if v_status = 'draft' and v_mode in ('draft', 'transition') then
      if tg_op = 'DELETE' then
        return old;
      end if;
      return new;
    end if;
    raise exception 'VARIATION_IMMUTABLE';
  end if;

  if tg_table_name = 'variation_work_areas' then
    v_revision := coalesce(new.revision_id, old.revision_id);
    select status into v_status
    from public.variation_revisions
    where id = v_revision;
    if v_status = 'draft' and v_mode in ('draft', 'transition') then
      if tg_op = 'UPDATE' then
        if new.revision_id is distinct from old.revision_id
          or new.variation_id is distinct from old.variation_id
          or new.org_id is distinct from old.org_id
          or new.project_id is distinct from old.project_id
          or new.copied_from_id is distinct from old.copied_from_id
        then
          raise exception 'VARIATION_IMMUTABLE';
        end if;
      end if;
      if tg_op = 'INSERT' then
        if new.org_id is null or new.project_id is null or new.variation_id is null then
          raise exception 'VARIATION_IMMUTABLE';
        end if;
      end if;
      if tg_op = 'DELETE' then
        return old;
      end if;
      return new;
    end if;
    raise exception 'VARIATION_IMMUTABLE';
  end if;

  if tg_table_name = 'variation_revisions' then
    if tg_op = 'INSERT' and v_mode in ('draft', 'transition') then
      if new.status <> 'draft' then
        raise exception 'VARIATION_IMMUTABLE';
      end if;
      return new;
    end if;
    if tg_op = 'UPDATE' and v_mode = 'draft' and old.status = 'draft' then
      if new.status <> 'draft'
        or new.revision_number is distinct from old.revision_number
        or new.variation_id is distinct from old.variation_id
        or new.org_id is distinct from old.org_id
        or new.project_id is distinct from old.project_id
        or new.currency is distinct from old.currency
        or new.gst_rate is distinct from old.gst_rate
        or new.tax_treatment is distinct from old.tax_treatment
      then
        raise exception 'VARIATION_IMMUTABLE';
      end if;
      return new;
    end if;
    if tg_op = 'UPDATE' and v_mode = 'transition' then
      if old.status <> 'draft' then
        if new.client_notes is distinct from old.client_notes
          or new.internal_notes is distinct from old.internal_notes
          or new.title is distinct from old.title
          or new.summary is distinct from old.summary
          or new.currency is distinct from old.currency
          or new.gst_rate is distinct from old.gst_rate
          or new.tax_treatment is distinct from old.tax_treatment
          or new.total_direct_cost_adjustment is distinct from old.total_direct_cost_adjustment
          or new.total_sell_adjustment_ex_gst is distinct from old.total_sell_adjustment_ex_gst
          or new.gst_adjustment is distinct from old.gst_adjustment
          or new.total_adjustment_incl_gst is distinct from old.total_adjustment_incl_gst
          or new.revision_number is distinct from old.revision_number
          or new.variation_id is distinct from old.variation_id
          or new.org_id is distinct from old.org_id
          or new.project_id is distinct from old.project_id
          or new.proposed_time_effect_days is distinct from old.proposed_time_effect_days
        then
          raise exception 'VARIATION_IMMUTABLE';
        end if;
      end if;
      return new;
    end if;
    raise exception 'VARIATION_IMMUTABLE';
  end if;

  if tg_table_name = 'variations' then
    if tg_op = 'INSERT' and v_mode in ('draft', 'transition') then
      return new;
    end if;
    if new.current_revision_id is null then
      raise exception 'VARIATION_REVISION_MISMATCH';
    end if;
    select r.status into v_match_status
    from public.variation_revisions r
    where r.id = new.current_revision_id
      and r.variation_id = new.id
      and r.org_id = new.org_id
      and r.project_id = new.project_id
      and r.status <> 'superseded';
    if v_match_status is null or v_match_status is distinct from new.status then
      raise exception 'VARIATION_REVISION_MISMATCH';
    end if;
    if new.variation_number is distinct from old.variation_number
      or new.org_id is distinct from old.org_id
      or new.project_id is distinct from old.project_id
      or new.accepted_snapshot_id is distinct from old.accepted_snapshot_id
      or new.idempotency_key is distinct from old.idempotency_key
    then
      raise exception 'VARIATION_IMMUTABLE';
    end if;
    if v_mode = 'draft' and old.status = 'draft' and new.status = 'draft' then
      return new;
    end if;
    if v_mode = 'transition' then
      return new;
    end if;
    raise exception 'VARIATION_IMMUTABLE';
  end if;

  if v_mode in ('draft', 'transition') then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;
  raise exception 'VARIATION_IMMUTABLE';
end;
$$;

drop trigger if exists variation_work_areas_guard on public.variation_work_areas;
create trigger variation_work_areas_guard
  before insert or update or delete on public.variation_work_areas
  for each row execute function public.variation_guard_mutation();

drop trigger if exists variation_work_areas_updated_at on public.variation_work_areas;
create trigger variation_work_areas_updated_at
  before update on public.variation_work_areas
  for each row execute function public.set_updated_at();

alter table public.variation_work_areas enable row level security;

revoke all on table public.variation_work_areas from public, anon, authenticated;
grant select on table public.variation_work_areas to authenticated;
grant select, insert, update, delete on table public.variation_work_areas to service_role;

drop policy if exists "Users can select variation work areas in their organisation" on public.variation_work_areas;
create policy "Users can select variation work areas in their organisation"
  on public.variation_work_areas for select
  using (org_id = public.auth_org_id());

-- ---------------------------------------------------------------------------
-- C. Draft commands. Organisation and project come from the locked Variation.
-- ---------------------------------------------------------------------------

create or replace function public.create_draft_variation_work_area_v1(
  p_variation uuid,
  p_revision uuid,
  p_name text,
  p_description text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock jsonb;
  v_name text := btrim(coalesce(p_name, ''));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_id uuid;
  v_sort integer;
begin
  v_lock := public.variation_lock_current(p_variation, p_revision);
  if coalesce(v_lock->>'ok', 'false') <> 'true' then
    return v_lock;
  end if;
  if v_lock->>'status' is distinct from 'draft' then
    return jsonb_build_object('ok', false, 'error', 'IMMUTABLE');
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 120 or v_name ~ '[[:cntrl:]]' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  if v_description is not null and (char_length(v_description) > 2000 or v_description ~ '[[:cntrl:]]') then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  if exists (
    select 1
    from public.variation_work_areas
    where revision_id = p_revision
      and lower(btrim(name)) = lower(v_name)
  ) then
    return jsonb_build_object('ok', false, 'error', 'DUPLICATE_NAME');
  end if;

  select coalesce(max(sort_order), -1) + 1 into v_sort
  from public.variation_work_areas
  where revision_id = p_revision;

  perform set_config('quotr.variation_write', 'draft', true);
  insert into public.variation_work_areas (
    revision_id, variation_id, org_id, project_id, name, description, sort_order
  ) values (
    p_revision,
    p_variation,
    (v_lock->>'orgId')::uuid,
    (v_lock->>'projectId')::uuid,
    v_name,
    v_description,
    v_sort
  )
  returning id into v_id;

  return jsonb_build_object(
    'ok', true,
    'workAreaId', v_id,
    'name', v_name,
    'description', v_description,
    'revisionId', p_revision,
    'variationId', p_variation,
    'projectId', v_lock->>'projectId'
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'DUPLICATE_NAME');
end;
$$;

create or replace function public.update_draft_variation_work_area_v1(
  p_variation uuid,
  p_revision uuid,
  p_work_area uuid,
  p_name text,
  p_description text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock jsonb;
  v_name text := btrim(coalesce(p_name, ''));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_row public.variation_work_areas%rowtype;
begin
  v_lock := public.variation_lock_current(p_variation, p_revision);
  if coalesce(v_lock->>'ok', 'false') <> 'true' then
    return v_lock;
  end if;
  if v_lock->>'status' is distinct from 'draft' then
    return jsonb_build_object('ok', false, 'error', 'IMMUTABLE');
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 120 or v_name ~ '[[:cntrl:]]' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  if v_description is not null and (char_length(v_description) > 2000 or v_description ~ '[[:cntrl:]]') then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;

  select * into v_row
  from public.variation_work_areas
  where id = p_work_area
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_row.org_id is distinct from (v_lock->>'orgId')::uuid then
    return jsonb_build_object('ok', false, 'error', 'CROSS_TENANT');
  end if;
  if v_row.project_id is distinct from (v_lock->>'projectId')::uuid
    or v_row.variation_id is distinct from p_variation
    or v_row.revision_id is distinct from p_revision
  then
    return jsonb_build_object('ok', false, 'error', 'CROSS_PROJECT');
  end if;
  if exists (
    select 1
    from public.variation_work_areas
    where revision_id = p_revision
      and id is distinct from p_work_area
      and lower(btrim(name)) = lower(v_name)
  ) then
    return jsonb_build_object('ok', false, 'error', 'DUPLICATE_NAME');
  end if;

  perform set_config('quotr.variation_write', 'draft', true);
  update public.variation_work_areas
  set name = v_name, description = v_description
  where id = p_work_area;

  return jsonb_build_object('ok', true, 'workAreaId', p_work_area, 'name', v_name, 'description', v_description);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'DUPLICATE_NAME');
end;
$$;

create or replace function public.delete_draft_variation_work_area_v1(
  p_variation uuid,
  p_revision uuid,
  p_work_area uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock jsonb;
  v_row public.variation_work_areas%rowtype;
begin
  v_lock := public.variation_lock_current(p_variation, p_revision);
  if coalesce(v_lock->>'ok', 'false') <> 'true' then
    return v_lock;
  end if;
  if v_lock->>'status' is distinct from 'draft' then
    return jsonb_build_object('ok', false, 'error', 'IMMUTABLE');
  end if;

  select * into v_row
  from public.variation_work_areas
  where id = p_work_area
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_row.org_id is distinct from (v_lock->>'orgId')::uuid then
    return jsonb_build_object('ok', false, 'error', 'CROSS_TENANT');
  end if;
  if v_row.project_id is distinct from (v_lock->>'projectId')::uuid
    or v_row.variation_id is distinct from p_variation
    or v_row.revision_id is distinct from p_revision
  then
    return jsonb_build_object('ok', false, 'error', 'CROSS_PROJECT');
  end if;

  perform set_config('quotr.variation_write', 'draft', true);
  update public.variation_items
  set variation_work_area_id = null
  where variation_work_area_id = p_work_area
    and revision_id = p_revision
    and variation_id = p_variation
    and org_id = (v_lock->>'orgId')::uuid;
  delete from public.variation_work_areas
  where id = p_work_area
    and revision_id = p_revision
    and org_id = (v_lock->>'orgId')::uuid;

  return jsonb_build_object('ok', true, 'workAreaId', p_work_area);
end;
$$;

create or replace function public.assign_draft_variation_item_scope_v1(
  p_variation uuid,
  p_revision uuid,
  p_item uuid,
  p_work_area uuid,
  p_variation_work_area uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock jsonb;
  v_item public.variation_items%rowtype;
  v_org uuid;
  v_project uuid;
  v_type text;
  v_area public.variation_work_areas%rowtype;
begin
  v_lock := public.variation_lock_current(p_variation, p_revision);
  if coalesce(v_lock->>'ok', 'false') <> 'true' then
    return v_lock;
  end if;
  if v_lock->>'status' is distinct from 'draft' then
    return jsonb_build_object('ok', false, 'error', 'IMMUTABLE');
  end if;
  if p_work_area is not null and p_variation_work_area is not null then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;

  select * into v_item
  from public.variation_items
  where id = p_item
    and revision_id = p_revision
    and variation_id = p_variation
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_item.org_id is distinct from (v_lock->>'orgId')::uuid then
    return jsonb_build_object('ok', false, 'error', 'CROSS_TENANT');
  end if;
  if v_item.project_id is distinct from (v_lock->>'projectId')::uuid then
    return jsonb_build_object('ok', false, 'error', 'CROSS_PROJECT');
  end if;

  if p_variation_work_area is not null then
    select * into v_area
    from public.variation_work_areas
    where id = p_variation_work_area;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
    end if;
    if v_area.org_id is distinct from (v_lock->>'orgId')::uuid then
      return jsonb_build_object('ok', false, 'error', 'CROSS_TENANT');
    end if;
    if v_area.project_id is distinct from (v_lock->>'projectId')::uuid
      or v_area.variation_id is distinct from p_variation
      or v_area.revision_id is distinct from p_revision
    then
      return jsonb_build_object('ok', false, 'error', 'CROSS_PROJECT');
    end if;
    perform set_config('quotr.variation_write', 'draft', true);
    update public.variation_items
    set work_area_id = null, work_area_type = null, variation_work_area_id = p_variation_work_area
    where id = p_item;
    return jsonb_build_object('ok', true, 'itemId', p_item, 'variationWorkAreaId', p_variation_work_area);
  end if;

  if p_work_area is not null then
    select org_id, project_id, type
    into v_org, v_project, v_type
    from public.work_areas
    where id = p_work_area;
    if v_org is null then
      return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
    end if;
    if v_org is distinct from (v_lock->>'orgId')::uuid then
      return jsonb_build_object('ok', false, 'error', 'CROSS_TENANT');
    end if;
    if v_project is distinct from (v_lock->>'projectId')::uuid then
      return jsonb_build_object('ok', false, 'error', 'CROSS_PROJECT');
    end if;
    perform set_config('quotr.variation_write', 'draft', true);
    update public.variation_items
    set work_area_id = p_work_area, work_area_type = v_type, variation_work_area_id = null
    where id = p_item;
    return jsonb_build_object('ok', true, 'itemId', p_item, 'workAreaId', p_work_area);
  end if;

  perform set_config('quotr.variation_write', 'draft', true);
  update public.variation_items
  set work_area_id = null, work_area_type = null, variation_work_area_id = null
  where id = p_item;
  return jsonb_build_object('ok', true, 'itemId', p_item);
end;
$$;

revoke all on function public.create_draft_variation_work_area_v1(uuid, uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.update_draft_variation_work_area_v1(uuid, uuid, uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.delete_draft_variation_work_area_v1(uuid, uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.assign_draft_variation_item_scope_v1(uuid, uuid, uuid, uuid, uuid) from public, anon, authenticated, service_role;

grant execute on function public.create_draft_variation_work_area_v1(uuid, uuid, text, text) to authenticated;
grant execute on function public.update_draft_variation_work_area_v1(uuid, uuid, uuid, text, text) to authenticated;
grant execute on function public.delete_draft_variation_work_area_v1(uuid, uuid, uuid) to authenticated;
grant execute on function public.assign_draft_variation_item_scope_v1(uuid, uuid, uuid, uuid, uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- D. Copy work areas onto a new revision. Old revision rows are not updated.
-- ---------------------------------------------------------------------------

create or replace function public.create_variation_revision_v1(
  p_variation uuid,
  p_revision uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := public.auth_org_id();
  v_row public.variations%rowtype;
  v_rev public.variation_revisions%rowtype;
  v_source public.variation_items%rowtype;
  v_next uuid;
  v_next_number integer;
  v_new_item uuid;
  v_gate jsonb;
begin
  if v_uid is null or v_org is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  end if;

  select * into v_row
  from public.variations
  where id = p_variation
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_row.org_id is distinct from v_org then
    return jsonb_build_object('ok', false, 'error', 'CROSS_TENANT');
  end if;

  v_gate := public.variation_project_gate(v_row.project_id);
  if coalesce(v_gate->>'ok', 'false') <> 'true' then
    return v_gate;
  end if;

  if v_row.current_revision_id is distinct from p_revision then
    select id, revision_number into v_next, v_next_number
    from public.variation_revisions
    where variation_id = p_variation
      and revised_from_revision_id = p_revision
      and id = v_row.current_revision_id
      and status = 'draft';
    if v_next is not null then
      return jsonb_build_object(
        'ok', true, 'idempotent', true, 'status', 'draft',
        'variationId', p_variation, 'revisionId', v_next, 'revisionNumber', v_next_number
      );
    end if;
    return jsonb_build_object('ok', false, 'error', 'STALE_REVISION');
  end if;

  select * into v_rev
  from public.variation_revisions
  where id = p_revision
    and variation_id = p_variation
  for update;
  if v_rev.status is distinct from 'issued' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_TRANSITION');
  end if;

  perform set_config('quotr.variation_write', 'transition', true);
  update public.variation_revisions
  set status = 'superseded', superseded_at = now()
  where id = p_revision;

  insert into public.variation_revisions (
    variation_id, org_id, project_id, revision_number, status, currency, gst_rate,
    tax_treatment, title, summary, proposed_time_effect_days, client_notes, internal_notes,
    revised_from_revision_id
  ) values (
    p_variation, v_org, v_row.project_id, v_rev.revision_number + 1, 'draft',
    v_rev.currency, v_rev.gst_rate, v_rev.tax_treatment, v_rev.title, v_rev.summary,
    v_rev.proposed_time_effect_days, v_rev.client_notes, v_rev.internal_notes, p_revision
  )
  returning id, revision_number into v_next, v_next_number;

  insert into public.variation_work_areas (
    revision_id, variation_id, org_id, project_id, name, description, sort_order, copied_from_id
  )
  select
    v_next, variation_id, org_id, project_id, name, description, sort_order, id
  from public.variation_work_areas
  where revision_id = p_revision
  order by sort_order, id;


  for v_source in
    select * from public.variation_items
    where revision_id = p_revision
    order by sort_order, id
  loop
    insert into public.variation_items (
      revision_id, variation_id, org_id, project_id, item_type, client_description,
      work_area_id, work_area_type, snapshot_line_id, stable_component_key,
      quantity, unit, unit_cost, line_cost_adjustment, unit_sell, line_sell_adjustment_ex_gst,
      sort_order, client_inclusion, client_exclusion, internal_metadata, substitution_group_id,
      pricing_mode, variation_work_area_id
    ) values (
      v_next, v_source.variation_id, v_source.org_id, v_source.project_id, v_source.item_type, v_source.client_description,
      v_source.work_area_id, v_source.work_area_type, v_source.snapshot_line_id, v_source.stable_component_key,
      v_source.quantity, v_source.unit, v_source.unit_cost, v_source.line_cost_adjustment, v_source.unit_sell, v_source.line_sell_adjustment_ex_gst,
      v_source.sort_order, v_source.client_inclusion, v_source.client_exclusion, v_source.internal_metadata, v_source.substitution_group_id,
      v_source.pricing_mode,
      case
        when v_source.variation_work_area_id is null then null
        else (
          select area.id
          from public.variation_work_areas area
          where area.revision_id = v_next
            and area.copied_from_id = v_source.variation_work_area_id
        )
      end
    )
    returning id into v_new_item;

    insert into public.variation_item_cost_components (
      org_id, project_id, variation_id, revision_id, item_id, category, description,
      quantity, unit, unit_cost, line_cost, sort_order, created_by, updated_by,
      cost_source, canonical_rate_key, source_label, source_unit, source_unit_cost,
      source_selected_at, source_record_id
    )
    select
      org_id, project_id, variation_id, v_next, v_new_item, category, description,
      quantity, unit, unit_cost, line_cost, sort_order, created_by, v_uid,
      cost_source, canonical_rate_key, source_label, source_unit, source_unit_cost,
      source_selected_at, source_record_id
    from public.variation_item_cost_components
    where item_id = v_source.id
    order by sort_order, id;
  end loop;

  perform public.variation_store_totals(v_next);

  update public.variations
  set current_revision_id = v_next, status = 'draft', title = v_rev.title, summary = v_rev.summary
  where id = p_variation;

  perform public.variation_append_event(
    v_org, v_row.project_id, v_uid, 'variation_superseded',
    p_variation, v_row.variation_number, p_revision, v_rev.revision_number,
    v_rev.total_sell_adjustment_ex_gst, v_rev.currency
  );

  return jsonb_build_object(
    'ok', true, 'idempotent', false, 'status', 'draft',
    'variationId', p_variation, 'revisionId', v_next, 'revisionNumber', v_next_number,
    'supersededRevisionId', p_revision
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- E. Client documents receive scope names only. No internal evidence.
-- ---------------------------------------------------------------------------

create or replace function public.lookup_variation_client_by_token_hash_v1(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text := nullif(btrim(coalesce(p_token_hash, '')), '');
  v_token public.variation_access_tokens%rowtype;
  v_rev public.variation_revisions%rowtype;
  v_variation public.variations%rowtype;
  v_response public.variation_responses%rowtype;
  v_identity jsonb;
  v_base_ex numeric;
  v_base_gst numeric;
  v_base_incl numeric;
  v_accepted_ex numeric;
  v_accepted_gst numeric;
  v_accepted_incl numeric;
  v_items jsonb;
  v_files jsonb;
  v_state text;
begin
  if v_hash is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;

  select * into v_token
  from public.variation_access_tokens
  where token_hash = v_hash
  limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;

  select * into v_rev
  from public.variation_revisions
  where id = v_token.revision_id
    and variation_id = v_token.variation_id
    and org_id = v_token.org_id
    and project_id = v_token.project_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;

  select * into v_variation
  from public.variations
  where id = v_token.variation_id and org_id = v_token.org_id and project_id = v_token.project_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;

  if v_rev.status = 'withdrawn' then
    return jsonb_build_object('ok', true, 'state', 'withdrawn');
  end if;
  if v_variation.current_revision_id is distinct from v_rev.id or v_rev.status = 'draft' then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  v_state := case v_rev.status
    when 'issued' then 'proposed'
    when 'accepted' then 'accepted'
    when 'rejected' then 'declined'
    else null
  end;
  if v_state is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;

  v_identity := coalesce(v_rev.document_identity, '{}'::jsonb) - 'internal';

  select s.sell_ex_gst, s.gst_amount, s.sell_incl_gst
    into v_base_ex, v_base_gst, v_base_incl
  from public.accepted_commercial_snapshots s
  where s.project_id = v_token.project_id and s.org_id = v_token.org_id;

  select
    coalesce(sum(a.net_adjustment_ex_gst), 0),
    coalesce(sum(a.gst_adjustment), 0),
    coalesce(sum(a.adjustment_incl_gst), 0)
    into v_accepted_ex, v_accepted_gst, v_accepted_incl
  from public.variation_accepted_adjustments a
  where a.project_id = v_token.project_id
    and a.org_id = v_token.org_id;

  select * into v_response
  from public.variation_responses
  where variation_id = v_variation.id
    and org_id = v_token.org_id
    and project_id = v_token.project_id
    and variation_revision_id = v_rev.id;

  select coalesce(jsonb_agg(item order by sort_order), '[]'::jsonb) into v_items
  from (
    select i.sort_order, jsonb_build_object(
      'itemType', i.item_type,
      'clientDescription', i.client_description,
      'quantity', i.quantity,
      'unit', i.unit,
      'lineSellAdjustmentExGst', i.line_sell_adjustment_ex_gst,
      'substitutionGroupId', i.substitution_group_id,
      'sortOrder', i.sort_order,
      'workAreaName', coalesce(vwa.name, wa.name),
      'workAreaDescription', vwa.description
    ) as item
    from public.variation_items i
    left join public.variation_work_areas vwa
      on vwa.id = i.variation_work_area_id
      and vwa.revision_id = i.revision_id
      and vwa.org_id = i.org_id
      and vwa.project_id = i.project_id
      and vwa.variation_id = i.variation_id
    left join public.work_areas wa
      on wa.id = i.work_area_id
      and wa.org_id = i.org_id
      and wa.project_id = i.project_id
    where i.revision_id = v_rev.id and i.org_id = v_token.org_id
  ) rows;

  select coalesce(jsonb_agg(file order by sort_order), '[]'::jsonb) into v_files
  from (
    select (a.issued_manifest->>'sortOrder')::int as sort_order, jsonb_build_object(
      'fileId', a.id,
      'displayFilename', a.issued_manifest->>'displayFilename',
      'caption', a.issued_manifest->>'caption',
      'mimeType', a.issued_manifest->>'mimeType',
      'byteSize', (a.issued_manifest->>'byteSize')::bigint,
      'sortOrder', (a.issued_manifest->>'sortOrder')::int
    ) as file
    from public.variation_attachments a
    where a.variation_revision_id = v_rev.id
      and a.org_id = v_token.org_id
      and a.project_id = v_token.project_id
      and a.visibility = 'client'
      and a.frozen_at is not null
      and a.upload_status = 'ready'
      and a.issued_manifest is not null
  ) files;

  return jsonb_build_object(
    'ok', true,
    'state', v_state,
    'identity', v_identity,
    'companyName', coalesce(v_identity #>> '{contractor,tradingName}', v_identity #>> '{contractor,legalName}', v_identity #>> '{contractor,organisationName}', ''),
    'clientName', coalesce(v_identity #>> '{client,name}', ''),
    'projectTitle', coalesce(v_identity #>> '{project,title}', ''),
    'siteAddress', v_identity #>> '{project,siteAddress}',
    'contactEmail', v_identity #>> '{contractor,email}',
    'contactPhone', v_identity #>> '{contractor,phone}',
    'variationNumber', v_variation.variation_number,
    'revisionNumber', v_rev.revision_number,
    'issuedAt', v_rev.issued_at,
    'title', v_rev.title,
    'summary', v_rev.summary,
    'clientNotes', v_rev.client_notes,
    'currency', v_rev.currency,
    'gstRate', v_rev.gst_rate,
    'totalSellAdjustmentExGst', v_rev.total_sell_adjustment_ex_gst,
    'gstAdjustment', v_rev.gst_adjustment,
    'totalAdjustmentInclGst', v_rev.total_adjustment_incl_gst,
    'baselineExGst', v_base_ex,
    'baselineGst', v_base_gst,
    'baselineInclGst', v_base_incl,
    'acceptedAdjustmentExGst', v_accepted_ex,
    'acceptedAdjustmentGst', v_accepted_gst,
    'acceptedAdjustmentInclGst', v_accepted_incl,
    'responderName', v_response.responder_name,
    'respondedAt', v_response.responded_at,
    'declineReason', case when v_response.source = 'client' then v_response.client_decline_reason else null end,
    'items', v_items,
    'clientAttachments', v_files
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- F. Manual decline reason uses the existing response column.
-- Terminal transitions, the ledger insert and confirmation rules are unchanged.
-- ---------------------------------------------------------------------------


alter table public.variation_responses drop constraint if exists variation_responses_decline_reason_chk;
alter table public.variation_responses
  add constraint variation_responses_decline_reason_chk check (
    client_decline_reason is null
    or (
      outcome = 'declined'
      and char_length(client_decline_reason) <= 2000
    )
  );


create or replace function public.variation_apply_terminal_response_v1(
  p_org uuid,
  p_project uuid,
  p_variation uuid,
  p_revision uuid,
  p_outcome text,
  p_source text,
  p_responder_name text,
  p_responder_email text,
  p_actor uuid,
  p_evidence_type text,
  p_evidence_note text,
  p_decline_reason text,
  p_idempotency_key text,
  p_confirm_authority boolean,
  p_confirm_scope boolean,
  p_confirm_attachments boolean,
  p_confirm_master_terms boolean,
  p_confirm_final boolean,
  p_confirm_received boolean,
  p_ip text,
  p_user_agent text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_variation public.variations%rowtype;
  v_rev public.variation_revisions%rowtype;
  v_existing public.variation_responses%rowtype;
  v_manifest jsonb;
  v_count integer;
  v_doc jsonb;
  v_response uuid;
  v_name text := nullif(btrim(coalesce(p_responder_name, '')), '');
  v_email text := nullif(lower(btrim(coalesce(p_responder_email, ''))), '');
  v_note text := nullif(btrim(coalesce(p_evidence_note, '')), '');
  v_reason text := nullif(btrim(coalesce(p_decline_reason, '')), '');
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_confirm jsonb;
  v_event text;
  v_status text;
  v_updated integer;
begin
  if p_outcome not in ('accepted', 'declined') or p_source not in ('client', 'manual') then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  if v_key is null or char_length(v_key) < 8 or char_length(v_key) > 200 then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  if v_name is null or char_length(v_name) > 200 then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;

  select * into v_variation
  from public.variations
  where id = p_variation
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_variation.org_id is distinct from p_org then
    return jsonb_build_object('ok', false, 'error', 'CROSS_TENANT');
  end if;
  if v_variation.project_id is distinct from p_project then
    return jsonb_build_object('ok', false, 'error', 'CROSS_PROJECT');
  end if;

  select * into v_existing
  from public.variation_responses
  where variation_id = p_variation
    and org_id = p_org
    and project_id = p_project;
  if found then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'outcome', v_existing.outcome,
      'responseId', v_existing.id,
      'respondedAt', v_existing.responded_at,
      'responderName', v_existing.responder_name,
      'variationId', v_existing.variation_id,
      'revisionId', v_existing.variation_revision_id,
      'projectId', v_existing.project_id,
      'adjustmentInclGst', v_existing.issued_total_incl_gst,
      'currency', v_existing.currency
    );
  end if;

  if v_variation.current_revision_id is distinct from p_revision then
    return jsonb_build_object('ok', false, 'error', 'STALE_REVISION');
  end if;

  select * into v_rev
  from public.variation_revisions
  where id = p_revision
    and variation_id = p_variation
    and org_id = p_org
    and project_id = p_project
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'STALE_REVISION');
  end if;
  if v_rev.status = 'draft' then
    return jsonb_build_object('ok', false, 'error', 'DRAFT');
  end if;
  if v_rev.status = 'withdrawn' or v_variation.status = 'withdrawn' then
    return jsonb_build_object('ok', false, 'error', 'WITHDRAWN');
  end if;
  if v_rev.status in ('accepted', 'rejected') or v_variation.status in ('accepted', 'rejected') then
    return jsonb_build_object('ok', false, 'error', 'INVALID_TRANSITION');
  end if;
  if v_rev.status is distinct from 'issued' or v_variation.status is distinct from 'issued' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_TRANSITION');
  end if;
  if v_rev.total_sell_adjustment_ex_gst is null
    or v_rev.gst_adjustment is null
    or v_rev.total_adjustment_incl_gst is null
    or v_rev.document_identity is null
  then
    return jsonb_build_object('ok', false, 'error', 'UNRESOLVED_PRICING');
  end if;

  v_manifest := public.variation_client_manifest_v1(p_org, p_revision);
  if coalesce(v_manifest->>'ok', 'false') <> 'true' then
    return jsonb_build_object('ok', false, 'error', 'MANIFEST_UNRESOLVED');
  end if;
  v_count := coalesce((v_manifest->>'count')::integer, 0);
  v_doc := v_rev.document_identity - 'internal';

  if p_source = 'client' then
    if v_email is null or position('@' in v_email) < 2 then
      return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
    end if;
    if p_confirm_final is distinct from true then
      return jsonb_build_object('ok', false, 'error', 'CONFIRMATION_REQUIRED');
    end if;
    if p_outcome = 'accepted' then
      if p_confirm_authority is distinct from true
        or p_confirm_scope is distinct from true
        or p_confirm_master_terms is distinct from true
        or (v_count > 0 and p_confirm_attachments is distinct from true)
      then
        return jsonb_build_object('ok', false, 'error', 'CONFIRMATION_REQUIRED');
      end if;
      v_reason := null;
      v_confirm := jsonb_build_object(
        'authority', 'variation-accept-authority-v1',
        'scopeAndPrice', 'variation-accept-scope-v1',
        'masterQuoteTerms', 'variation-accept-master-terms-v1',
        'final', 'variation-accept-final-v1',
        'attachments', case when v_count > 0 then 'variation-accept-attachments-v1' else null end
      );
    else
      v_confirm := jsonb_build_object('final', 'variation-decline-final-v1');
    end if;
    if p_actor is not null or p_evidence_type is not null or v_note is not null then
      return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
    end if;
  else
    if p_actor is null or p_confirm_received is distinct from true then
      return jsonb_build_object('ok', false, 'error', 'CONFIRMATION_REQUIRED');
    end if;
    if p_evidence_type not in ('email_confirmation', 'signed_document', 'verbal_approval', 'other') then
      return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
    end if;
    if v_note is null
      or (p_evidence_type in ('verbal_approval', 'other') and char_length(v_note) < 8)
    then
      return jsonb_build_object('ok', false, 'error', 'EVIDENCE_NOTE_REQUIRED');
    end if;
    if v_email is not null and position('@' in v_email) < 2 then
      return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
    end if;
    if v_reason is not null and char_length(v_reason) > 2000 then
      return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
    end if;
    v_confirm := jsonb_build_object('received', 'variation-manual-received-v1');
  end if;

  v_event := case when p_outcome = 'accepted' then 'variation_accepted' else 'variation_declined' end;
  v_status := case when p_outcome = 'accepted' then 'accepted' else 'rejected' end;

  begin
    insert into public.variation_responses (
      org_id, project_id, variation_id, variation_revision_id, outcome, source,
      responder_name, responder_email, builder_actor_id, manual_evidence_type,
      manual_evidence_note, client_decline_reason, issued_total_ex_gst, issued_gst,
      issued_total_incl_gst, currency, gst_rate, tax_treatment, accepted_snapshot_id,
      document_identity, client_attachment_manifest, confirmation_versions,
      request_metadata, idempotency_key, schema_version
    ) values (
      p_org, p_project, p_variation, p_revision, p_outcome, p_source,
      v_name, v_email, case when p_source = 'manual' then p_actor else null end,
      case when p_source = 'manual' then p_evidence_type else null end,
      case when p_source = 'manual' then v_note else null end,
      case when p_outcome = 'declined' then v_reason else null end,
      v_rev.total_sell_adjustment_ex_gst, v_rev.gst_adjustment, v_rev.total_adjustment_incl_gst,
      v_rev.currency, v_rev.gst_rate, v_rev.tax_treatment, v_variation.accepted_snapshot_id,
      v_doc,
      jsonb_build_object('count', v_count, 'files', v_manifest->'files'),
      v_confirm,
      jsonb_strip_nulls(jsonb_build_object(
        'ip', nullif(left(coalesce(p_ip, ''), 80), ''),
        'userAgent', nullif(left(coalesce(p_user_agent, ''), 300), '')
      )),
      v_key,
      'v1'
    )
    returning id into v_response;

    if p_outcome = 'accepted' then
      insert into public.variation_accepted_adjustments (
        org_id, project_id, variation_id, variation_revision_id, response_id,
        currency, gst_rate, tax_treatment, net_adjustment_ex_gst, gst_adjustment,
        adjustment_incl_gst, accepted_snapshot_id, accepted_at, schema_version
      ) values (
        p_org, p_project, p_variation, p_revision, v_response,
        v_rev.currency, v_rev.gst_rate, v_rev.tax_treatment,
        v_rev.total_sell_adjustment_ex_gst, v_rev.gst_adjustment, v_rev.total_adjustment_incl_gst,
        v_variation.accepted_snapshot_id, now(), 'v1'
      );
    end if;

    perform set_config('quotr.variation_write', 'transition', true);
    update public.variation_revisions
    set
      status = v_status,
      accepted_at = case when p_outcome = 'accepted' then now() else accepted_at end,
      accepted_by = case when p_outcome = 'accepted' then p_actor else accepted_by end,
      rejected_at = case when p_outcome = 'declined' then now() else rejected_at end,
      rejected_by = case when p_outcome = 'declined' then p_actor else rejected_by end
    where id = p_revision
      and status = 'issued';
    get diagnostics v_updated = row_count;
    if v_updated <> 1 then
      raise exception 'VARIATION_RESPONSE_LOST';
    end if;

    update public.variations
    set status = v_status
    where id = p_variation
      and status = 'issued';

    perform public.variation_append_event(
      p_org, p_project, p_actor, v_event, p_variation, v_variation.variation_number,
      p_revision, v_rev.revision_number, v_rev.total_sell_adjustment_ex_gst, v_rev.currency
    );
  exception
    when unique_violation then
      select * into v_existing
      from public.variation_responses
      where variation_id = p_variation
        and org_id = p_org;
      if found then
        return jsonb_build_object(
          'ok', true, 'idempotent', true, 'outcome', v_existing.outcome,
          'responseId', v_existing.id, 'respondedAt', v_existing.responded_at,
          'responderName', v_existing.responder_name, 'variationId', v_existing.variation_id,
          'revisionId', v_existing.variation_revision_id, 'projectId', v_existing.project_id,
          'adjustmentInclGst', v_existing.issued_total_incl_gst, 'currency', v_existing.currency
        );
      end if;
      return jsonb_build_object('ok', false, 'error', 'INVALID_TRANSITION');
    when others then
      if sqlerrm = 'VARIATION_RESPONSE_LOST' then
        return jsonb_build_object('ok', false, 'error', 'INVALID_TRANSITION');
      end if;
      raise;
  end;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'outcome', p_outcome,
    'responseId', v_response,
    'respondedAt', now(),
    'responderName', v_name,
    'variationId', p_variation,
    'revisionId', p_revision,
    'projectId', p_project,
    'variationNumber', v_variation.variation_number,
    'revisionNumber', v_rev.revision_number,
    'adjustmentInclGst', v_rev.total_adjustment_incl_gst,
    'currency', v_rev.currency,
    'projectTitle', coalesce(v_doc #>> '{project,title}', ''),
    'quoteNumber', v_doc #>> '{masterQuote,quoteNumber}',
    'attachmentCount', v_count,
    'notifyEmail', nullif(btrim(coalesce(v_doc #>> '{contractor,email}', '')), '')
  );
end;
$$;


drop function if exists public.record_variation_response_v1(uuid, uuid, uuid, text, text, text, text, text, boolean, text);

create or replace function public.record_variation_response_v1(
  p_project uuid,
  p_variation uuid,
  p_revision uuid,
  p_outcome text,
  p_responder_name text,
  p_responder_email text,
  p_evidence_type text,
  p_evidence_note text,
  p_confirm_received boolean,
  p_idempotency_key text,
  p_decline_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := public.auth_org_id();
  v_reason text := nullif(btrim(coalesce(p_decline_reason, '')), '');
begin
  if v_uid is null or v_org is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  end if;
  if p_outcome is distinct from 'declined' then
    v_reason := null;
  end if;
  if v_reason is not null and char_length(v_reason) > 2000 then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  return public.variation_apply_terminal_response_v1(
    v_org, p_project, p_variation, p_revision, p_outcome, 'manual',
    p_responder_name, p_responder_email, v_uid, p_evidence_type, p_evidence_note,
    v_reason, p_idempotency_key,
    false, false, false, false, false, p_confirm_received, null, null
  );
end;
$$;

revoke all on function public.record_variation_response_v1(uuid, uuid, uuid, text, text, text, text, text, boolean, text, text) from public, anon, authenticated, service_role;
grant execute on function public.record_variation_response_v1(uuid, uuid, uuid, text, text, text, text, text, boolean, text, text) to authenticated;


notify pgrst, 'reload schema';
