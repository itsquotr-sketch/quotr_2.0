-- Delete a Variation only when it has never left draft.
-- Issued, accepted, rejected, withdrawn and superseded history stays immutable.
-- Migration 063 and 064 are unchanged.

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

  -- Only delete_unissued_draft_variation_v1 sets this mode, after it has
  -- proved every revision is still an unissued draft.
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

create or replace function public.delete_unissued_draft_variation_v1(
  p_project uuid,
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
  v_bad integer;
  v_events integer;
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
  if v_row.project_id is distinct from p_project then
    return jsonb_build_object('ok', false, 'error', 'CROSS_PROJECT');
  end if;
  if not exists (
    select 1
    from public.projects
    where id = v_row.project_id
      and org_id = v_org
      and deleted_at is null
  ) then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;

  select count(*) into v_bad
  from public.variation_revisions
  where variation_id = p_variation
    and (
      status is distinct from 'draft'
      or issued_at is not null
      or accepted_at is not null
      or rejected_at is not null
      or withdrawn_at is not null
      or superseded_at is not null
      or acceptance_source is not null
    );
  if v_bad > 0 or v_row.status is distinct from 'draft' then
    return jsonb_build_object('ok', false, 'error', 'ISSUED_HISTORY');
  end if;

  select count(*) into v_events
  from public.project_lifecycle_events
  where source_entity_type = 'variation'
    and source_entity_id = p_variation
    and event_type is distinct from 'variation_created';
  if v_events > 0 then
    return jsonb_build_object('ok', false, 'error', 'ISSUED_HISTORY');
  end if;

  if v_row.current_revision_id is distinct from p_revision then
    return jsonb_build_object('ok', false, 'error', 'STALE_REVISION');
  end if;

  perform set_config('quotr.variation_write', 'delete_draft', true);
  delete from public.variation_items where variation_id = p_variation;
  delete from public.variation_command_receipts where variation_id = p_variation;
  delete from public.variation_revisions where variation_id = p_variation;
  delete from public.variations where id = p_variation;

  return jsonb_build_object('ok', true, 'variationId', p_variation);
end;
$$;

comment on function public.delete_unissued_draft_variation_v1(uuid, uuid, uuid) is
  'Deletes one never-issued draft Variation. Does not reuse its variation number and does not change the accepted contract.';

revoke all on function public.delete_unissued_draft_variation_v1(uuid, uuid, uuid) from public;
grant execute on function public.delete_unissued_draft_variation_v1(uuid, uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
