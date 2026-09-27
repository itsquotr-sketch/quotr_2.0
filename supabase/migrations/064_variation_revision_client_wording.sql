-- VARIATIONS-02-R1 — revision-owned client wording.
-- Issued documents read title, summary and client notes from the revision.
-- variations.title and variations.summary stay a current-list copy only.
-- Does not edit migration 063. Preview/local only. Never Production from the app.

alter table public.variation_revisions
  add column if not exists title text,
  add column if not exists summary text;

-- Existing rows only have the logical variation's current wording.
-- Preview has no customer-owned issued variations to reconstruct.
update public.variation_revisions as revision
set
  title = variation.title,
  summary = variation.summary
from public.variations as variation
where revision.variation_id = variation.id
  and revision.title is null;

alter table public.variation_revisions
  alter column title set not null;

alter table public.variation_revisions
  drop constraint if exists variation_revisions_title_chk;

alter table public.variation_revisions
  add constraint variation_revisions_title_chk
  check (char_length(btrim(title)) between 1 and 160);

alter table public.variation_revisions
  drop constraint if exists variation_revisions_summary_chk;

alter table public.variation_revisions
  add constraint variation_revisions_summary_chk
  check (summary is null or char_length(summary) <= 2000);

comment on column public.variation_revisions.title is
  'Client-facing title for this revision. Authoritative for an issued document.';

comment on column public.variation_revisions.summary is
  'Client-facing summary for this revision. A later revision does not overwrite it.';

comment on column public.variations.title is
  'Denormalised title of the current revision for the Variations list. Not the authority for an issued historical document.';

comment on column public.variations.summary is
  'Denormalised summary of the current revision for list convenience. Not the authority for an issued historical document.';

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

create or replace function public.create_draft_variation_v1(
  p_project uuid,
  p_title text,
  p_summary text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gate jsonb;
  v_org uuid;
  v_uid uuid;
  v_existing uuid;
  v_existing_revision uuid;
  v_existing_project uuid;
  v_existing_number integer;
  v_number integer;
  v_variation uuid;
  v_revision uuid;
  v_title text;
  v_summary text;
begin
  v_gate := public.variation_project_gate(p_project);
  if coalesce(v_gate->>'ok', 'false') <> 'true' then
    return v_gate;
  end if;
  v_org := (v_gate->>'orgId')::uuid;
  v_uid := (v_gate->>'userId')::uuid;
  v_title := btrim(coalesce(p_title, ''));
  v_summary := nullif(btrim(coalesce(p_summary, '')), '');
  if char_length(v_title) < 1 or char_length(v_title) > 160
    or (v_summary is not null and char_length(v_summary) > 2000)
    or p_idempotency_key is null
    or char_length(btrim(p_idempotency_key)) < 8
    or char_length(btrim(p_idempotency_key)) > 200
  then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;

  perform pg_advisory_xact_lock(87240156, hashtext(v_org::text || ':' || btrim(p_idempotency_key)));

  select id, project_id, current_revision_id, variation_number
  into v_existing, v_existing_project, v_existing_revision, v_existing_number
  from public.variations
  where org_id = v_org
    and idempotency_key = btrim(p_idempotency_key);

  if v_existing is not null then
    if v_existing_project is distinct from p_project then
      return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
    end if;
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'variationId', v_existing,
      'revisionId', v_existing_revision,
      'variationNumber', v_existing_number
    );
  end if;

  perform set_config('quotr.variation_write', 'draft', true);
  perform pg_advisory_xact_lock(87240155, hashtext(p_project::text));

  insert into public.project_variation_counters (project_id, org_id, last_value)
  values (p_project, v_org, 0)
  on conflict (project_id) do nothing;

  update public.project_variation_counters
  set last_value = last_value + 1
  where project_id = p_project
    and org_id = v_org
  returning last_value into v_number;

  insert into public.variations (
    org_id, project_id, accepted_snapshot_id, variation_number, title, summary,
    status, created_by, idempotency_key
  ) values (
    v_org, p_project, (v_gate->>'snapshotId')::uuid, v_number, v_title, v_summary,
    'draft', v_uid, btrim(p_idempotency_key)
  )
  returning id into v_variation;

  insert into public.variation_revisions (
    variation_id, org_id, project_id, revision_number, status, currency, gst_rate,
    tax_treatment, title, summary
  ) values (
    v_variation, v_org, p_project, 1, 'draft',
    v_gate->>'currency', (v_gate->>'gstRate')::numeric, v_gate->>'taxTreatment',
    v_title, v_summary
  )
  returning id into v_revision;

  update public.variations
  set current_revision_id = v_revision
  where id = v_variation;

  insert into public.variation_command_receipts (
    org_id, command, idempotency_key, variation_id, revision_id
  ) values (
    v_org, 'create', btrim(p_idempotency_key), v_variation, v_revision
  );

  perform public.variation_append_event(
    v_org, p_project, v_uid, 'variation_created',
    v_variation, v_number, v_revision, 1, null, v_gate->>'currency'
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'variationId', v_variation,
    'revisionId', v_revision,
    'variationNumber', v_number
  );
end;
$$;

create or replace function public.update_draft_variation_v1(
  p_variation uuid,
  p_revision uuid,
  p_title text,
  p_summary text,
  p_client_notes text,
  p_internal_notes text,
  p_time_effect_days integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock jsonb;
  v_title text;
  v_summary text;
  v_client text;
  v_internal text;
begin
  v_lock := public.variation_lock_current(p_variation, p_revision);
  if coalesce(v_lock->>'ok', 'false') <> 'true' then
    return v_lock;
  end if;
  if v_lock->>'status' is distinct from 'draft' then
    return jsonb_build_object('ok', false, 'error', 'IMMUTABLE');
  end if;
  v_title := btrim(coalesce(p_title, ''));
  v_summary := nullif(btrim(coalesce(p_summary, '')), '');
  v_client := nullif(btrim(coalesce(p_client_notes, '')), '');
  v_internal := nullif(btrim(coalesce(p_internal_notes, '')), '');
  if char_length(v_title) < 1 or char_length(v_title) > 160
    or (v_summary is not null and char_length(v_summary) > 2000)
    or (v_client is not null and char_length(v_client) > 4000)
    or (v_internal is not null and char_length(v_internal) > 4000)
    or (p_time_effect_days is not null and p_time_effect_days not between -3650 and 3650)
  then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;

  perform set_config('quotr.variation_write', 'draft', true);
  update public.variation_revisions
  set
    title = v_title,
    summary = v_summary,
    client_notes = v_client,
    internal_notes = v_internal,
    proposed_time_effect_days = p_time_effect_days
  where id = p_revision;
  -- Current-list copy only. Historical revisions keep their own title and summary.
  update public.variations
  set title = v_title, summary = v_summary
  where id = p_variation
    and current_revision_id = p_revision;

  return jsonb_build_object('ok', true, 'idempotent', false, 'variationId', p_variation, 'revisionId', p_revision);
end;
$$;

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
  v_next uuid;
  v_next_number integer;
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

  insert into public.variation_items (
    revision_id, variation_id, org_id, project_id, item_type, client_description,
    work_area_id, work_area_type, snapshot_line_id, stable_component_key,
    quantity, unit, unit_cost, line_cost_adjustment, unit_sell, line_sell_adjustment_ex_gst,
    sort_order, client_inclusion, client_exclusion, internal_metadata, substitution_group_id
  )
  select
    v_next, variation_id, org_id, project_id, item_type, client_description,
    work_area_id, work_area_type, snapshot_line_id, stable_component_key,
    quantity, unit, unit_cost, line_cost_adjustment, unit_sell, line_sell_adjustment_ex_gst,
    sort_order, client_inclusion, client_exclusion, internal_metadata, substitution_group_id
  from public.variation_items
  where revision_id = p_revision;

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

notify pgrst, 'reload schema';
