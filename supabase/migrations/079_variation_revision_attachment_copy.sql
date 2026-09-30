-- VARIATIONS-R2.2
-- Migration 073 replaced create_variation_revision_v1 and kept Work Area
-- copying plus item remapping, but dropped the attachment-copy loop from
-- migration 071. This restores that loop on the 073 function.
-- Copied rows reuse the private object. They do not upload a second file.
-- The issued revision and its issued manifest are not updated.

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
  v_file public.variation_attachments%rowtype;
  v_next uuid;
  v_next_number integer;
  v_new_item uuid;
  v_gate jsonb;
  v_old_ids uuid[] := '{}';
  v_new_ids uuid[] := '{}';
  v_linked uuid;
  v_pos integer;
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

    v_old_ids := array_append(v_old_ids, v_source.id);
    v_new_ids := array_append(v_new_ids, v_new_item);

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

  for v_file in
    select * from public.variation_attachments
    where variation_revision_id = p_revision
      and upload_status = 'ready'
      and object_confirmed
    order by sort_order, id
  loop
    v_linked := null;
    if v_file.linked_variation_item_id is not null then
      v_pos := array_position(v_old_ids, v_file.linked_variation_item_id);
      if v_pos is not null then
        v_linked := v_new_ids[v_pos];
      end if;
    end if;
    insert into public.variation_attachments (
      org_id, project_id, variation_id, variation_revision_id, visibility,
      storage_bucket, storage_object_path, shared_object_key, original_filename,
      display_filename, mime_type, byte_size, caption, internal_description,
      linked_variation_item_id, sort_order, upload_status, object_confirmed,
      created_by, schema_version, source_attachment_id
    ) values (
      v_file.org_id, v_file.project_id, v_file.variation_id, v_next, v_file.visibility,
      v_file.storage_bucket, v_file.storage_object_path, v_file.shared_object_key, v_file.original_filename,
      v_file.display_filename, v_file.mime_type, v_file.byte_size, v_file.caption, v_file.internal_description,
      v_linked, v_file.sort_order, 'ready', true,
      v_uid, 1, v_file.id
    );
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

notify pgrst, 'reload schema';
