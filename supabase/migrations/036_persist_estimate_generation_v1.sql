-- REQ-TXN-01 / REQ-TXN-01-R1 — atomic estimate generation persistence (LOCAL ONLY).
-- Additive. Does not mutate estimate line money, pricing, quotes, or component authority.
-- Does not amend 035. Do not apply remote in this local batch.
-- v1 contract: every successful persist requires an immutable snapshot (empty
-- requirements[] is valid). snapshotRequired is ignored if present. Caller
-- componentAuthorities are evidence only, not a snapshot-safety switch.

-- ---------------------------------------------------------------------------
-- persist_estimate_generation_v1
--
-- SECURITY INVOKER: RLS + auth.uid() / auth_org_id() apply to the calling role.
-- Org is derived from auth, never from payload.
-- One transaction: estimate row + line replacement + snapshot insert + pointer + ready.
-- Execute: authenticated only. App invokes via the signed-in user session client.
-- ---------------------------------------------------------------------------

create or replace function public.persist_estimate_generation_v1(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := public.auth_org_id();
  v_contract text;
  v_project_id uuid;
  v_generation_id uuid;
  v_authorities jsonb;
  v_snapshot jsonb;
  v_estimate jsonb;
  v_lines jsonb;
  v_line jsonb;
  v_category text;
  v_work_area_name text;
  v_label text;
  v_component_key text;
  v_schema_version text;
  v_payload_generation text;
  v_estimate_id uuid;
  v_snapshot_id uuid;
  v_prior_generation uuid;
  v_constraint text;
begin
  if v_uid is null or v_org is null then
    raise exception 'REQ_TXN:NOT_AUTHENTICATED'
      using errcode = 'P0001';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'REQ_TXN:INVALID_PAYLOAD'
      using errcode = 'P0001';
  end if;

  v_contract := nullif(btrim(p_payload->>'contractVersion'), '');
  if v_contract is distinct from 'persist-estimate-generation-v1' then
    raise exception 'REQ_TXN:INVALID_PAYLOAD'
      using errcode = 'P0001';
  end if;

  begin
    v_project_id := (p_payload->>'projectId')::uuid;
    v_generation_id := (p_payload->>'generationId')::uuid;
  exception
    when invalid_text_representation then
      raise exception 'REQ_TXN:INVALID_PAYLOAD'
        using errcode = 'P0001';
  end;

  if v_project_id is null or v_generation_id is null then
    raise exception 'REQ_TXN:INVALID_GENERATION_ID'
      using errcode = 'P0001';
  end if;

  v_authorities := coalesce(p_payload->'componentAuthorities', '[]'::jsonb);
  if jsonb_typeof(v_authorities) <> 'array' then
    raise exception 'REQ_TXN:INVALID_PAYLOAD'
      using errcode = 'P0001';
  end if;

  v_estimate := p_payload->'estimate';
  if v_estimate is null or jsonb_typeof(v_estimate) <> 'object' then
    raise exception 'REQ_TXN:INVALID_PAYLOAD'
      using errcode = 'P0001';
  end if;

  v_lines := coalesce(p_payload->'lineItems', '[]'::jsonb);
  if jsonb_typeof(v_lines) <> 'array' then
    raise exception 'REQ_TXN:INVALID_PAYLOAD'
      using errcode = 'P0001';
  end if;

  -- snapshotRequired is ignored if present. Snapshot is mandatory for every
  -- successful v1 generation. componentAuthorities are not a safety switch.
  v_snapshot := p_payload->'snapshot';
  if v_snapshot is null or jsonb_typeof(v_snapshot) <> 'object' then
    raise exception 'REQ_TXN:SNAPSHOT_REQUIRED'
      using errcode = 'P0001';
  end if;

  v_schema_version := nullif(btrim(v_snapshot->>'schemaVersion'), '');
  if v_schema_version is distinct from 'estimate-requirement-snapshot-v1'
     or char_length(v_schema_version) > 64 then
    raise exception 'REQ_TXN:INVALID_SNAPSHOT'
      using errcode = 'P0001';
  end if;
  v_payload_generation := nullif(btrim(v_snapshot->>'generationId'), '');
  if v_payload_generation is distinct from v_generation_id::text then
    raise exception 'REQ_TXN:INVALID_SNAPSHOT'
      using errcode = 'P0001';
  end if;
  if jsonb_typeof(coalesce(v_snapshot->'requirements', 'null'::jsonb)) <> 'array' then
    raise exception 'REQ_TXN:INVALID_SNAPSHOT'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.projects p
    where p.id = v_project_id
      and p.org_id = v_org
      and p.deleted_at is null
  ) then
    raise exception 'REQ_TXN:PROJECT_NOT_FOUND'
      using errcode = 'P0001';
  end if;

  -- Serialize generations for this org+project. Same namespace family as 032/033.
  perform pg_advisory_xact_lock(
    87230136,
    hashtext(v_org::text || ':' || v_project_id::text)
  );

  select e.id, e.requirement_generation_id
    into v_estimate_id, v_prior_generation
  from public.estimates e
  where e.project_id = v_project_id
    and e.org_id = v_org
  for update;

  if exists (
    select 1
    from public.estimate_requirement_snapshots s
    where s.generation_id = v_generation_id
  ) then
    raise exception 'REQ_TXN:DUPLICATE_GENERATION'
      using errcode = 'P0001';
  end if;

  if v_estimate_id is not null
     and v_prior_generation is not null
     and v_prior_generation = v_generation_id then
    raise exception 'REQ_TXN:DUPLICATE_GENERATION'
      using errcode = 'P0001';
  end if;

  -- Validate every line before any destructive write.
  for v_line in
    select value from jsonb_array_elements(v_lines)
  loop
    if jsonb_typeof(v_line) <> 'object' then
      raise exception 'REQ_TXN:INVALID_LINE'
        using errcode = 'P0001';
    end if;

    v_work_area_name := nullif(btrim(v_line->>'workAreaName'), '');
    v_label := nullif(btrim(v_line->>'label'), '');
    v_category := nullif(btrim(v_line->>'category'), '');
    if v_work_area_name is null or v_label is null or v_category is null then
      raise exception 'REQ_TXN:INVALID_LINE'
        using errcode = 'P0001';
    end if;
    if v_category not in ('labour', 'materials', 'subcontractor', 'allowance', 'contingency') then
      raise exception 'REQ_TXN:INVALID_LINE'
        using errcode = 'P0001';
    end if;

    v_component_key := nullif(btrim(v_line->>'componentKey'), '');
    if v_component_key is not null and char_length(v_component_key) > 128 then
      raise exception 'REQ_TXN:INVALID_LINE'
        using errcode = 'P0001';
    end if;

    if coalesce(v_line->>'workAreaId', '') <> '' then
      begin
        perform (v_line->>'workAreaId')::uuid;
      exception
        when invalid_text_representation then
          raise exception 'REQ_TXN:INVALID_LINE'
            using errcode = 'P0001';
      end;
    end if;
  end loop;

  if v_estimate_id is null then
    insert into public.estimates (
      org_id,
      project_id,
      status,
      is_stale,
      cost_low,
      cost_high,
      sell_low,
      sell_high,
      recommended_cost,
      recommended_sell,
      gross_profit,
      margin_percent,
      markup_percent,
      confidence,
      rate_source_summary,
      assumptions,
      missing_info,
      exclusions,
      assumption_metadata,
      generated_at,
      calibration_version,
      requirement_generation_id,
      latest_requirement_snapshot_id
    )
    values (
      v_org,
      v_project_id,
      'draft',
      true,
      (v_estimate->>'costLow')::numeric,
      (v_estimate->>'costHigh')::numeric,
      (v_estimate->>'sellLow')::numeric,
      (v_estimate->>'sellHigh')::numeric,
      (v_estimate->>'recommendedCost')::numeric,
      (v_estimate->>'recommendedSell')::numeric,
      (v_estimate->>'grossProfit')::numeric,
      (v_estimate->>'marginPercent')::numeric,
      (v_estimate->>'markupPercent')::numeric,
      (v_estimate->>'confidence')::numeric,
      v_estimate->>'rateSourceSummary',
      coalesce(v_estimate->'assumptions', '[]'::jsonb),
      coalesce(v_estimate->'missingInfo', '[]'::jsonb),
      coalesce(v_estimate->'exclusions', '[]'::jsonb),
      coalesce(v_estimate->'assumptionMetadata', '{}'::jsonb),
      now(),
      nullif(btrim(v_estimate->>'calibrationVersion'), ''),
      v_generation_id,
      null
    )
    returning id into v_estimate_id;
  else
    -- Keep previous commercial generation visible until this transaction commits.
    -- Intra-transaction draft is not observable outside this txn.
    update public.estimates
    set
      status = 'draft',
      is_stale = true,
      cost_low = (v_estimate->>'costLow')::numeric,
      cost_high = (v_estimate->>'costHigh')::numeric,
      sell_low = (v_estimate->>'sellLow')::numeric,
      sell_high = (v_estimate->>'sellHigh')::numeric,
      recommended_cost = (v_estimate->>'recommendedCost')::numeric,
      recommended_sell = (v_estimate->>'recommendedSell')::numeric,
      gross_profit = (v_estimate->>'grossProfit')::numeric,
      margin_percent = (v_estimate->>'marginPercent')::numeric,
      markup_percent = (v_estimate->>'markupPercent')::numeric,
      confidence = (v_estimate->>'confidence')::numeric,
      rate_source_summary = v_estimate->>'rateSourceSummary',
      assumptions = coalesce(v_estimate->'assumptions', '[]'::jsonb),
      missing_info = coalesce(v_estimate->'missingInfo', '[]'::jsonb),
      exclusions = coalesce(v_estimate->'exclusions', '[]'::jsonb),
      assumption_metadata = coalesce(v_estimate->'assumptionMetadata', '{}'::jsonb),
      generated_at = now(),
      calibration_version = nullif(btrim(v_estimate->>'calibrationVersion'), ''),
      requirement_generation_id = v_generation_id,
      latest_requirement_snapshot_id = null,
      updated_at = now()
    where id = v_estimate_id
      and org_id = v_org;
  end if;

  delete from public.estimate_line_items
  where estimate_id = v_estimate_id
    and org_id = v_org;

  for v_line in
    select value from jsonb_array_elements(v_lines)
  loop
    v_component_key := nullif(btrim(v_line->>'componentKey'), '');
    insert into public.estimate_line_items (
      org_id,
      project_id,
      estimate_id,
      work_area_id,
      work_area_name,
      label,
      category,
      cost_low,
      cost_high,
      sell_low,
      sell_high,
      recommended_cost,
      recommended_sell,
      gross_profit,
      margin_percent,
      markup_percent,
      rate_source,
      notes,
      sort_order,
      component_key
    )
    values (
      v_org,
      v_project_id,
      v_estimate_id,
      nullif(v_line->>'workAreaId', '')::uuid,
      btrim(v_line->>'workAreaName'),
      btrim(v_line->>'label'),
      btrim(v_line->>'category'),
      (v_line->>'costLow')::numeric,
      (v_line->>'costHigh')::numeric,
      (v_line->>'sellLow')::numeric,
      (v_line->>'sellHigh')::numeric,
      (v_line->>'recommendedCost')::numeric,
      (v_line->>'recommendedSell')::numeric,
      (v_line->>'grossProfit')::numeric,
      (v_line->>'marginPercent')::numeric,
      (v_line->>'markupPercent')::numeric,
      v_line->>'rateSource',
      v_line->>'notes',
      coalesce((v_line->>'sortOrder')::integer, 0),
      v_component_key
    );
  end loop;

  insert into public.estimate_requirement_snapshots (
    org_id,
    project_id,
    estimate_id,
    generation_id,
    schema_version,
    payload
  )
  values (
    v_org,
    v_project_id,
    v_estimate_id,
    v_generation_id,
    v_schema_version,
    v_snapshot
  )
  returning id into v_snapshot_id;

  if v_snapshot_id is null then
    raise exception 'REQ_TXN:SNAPSHOT_REQUIRED'
      using errcode = 'P0001';
  end if;

  update public.estimates
  set
    status = 'ready',
    is_stale = false,
    requirement_generation_id = v_generation_id,
    latest_requirement_snapshot_id = v_snapshot_id,
    updated_at = now()
  where id = v_estimate_id
    and org_id = v_org;

  return jsonb_build_object(
    'estimate_id', v_estimate_id,
    'generation_id', v_generation_id,
    'snapshot_id', v_snapshot_id,
    'status', 'ready'
  );

exception
  when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint in (
      'estimate_requirement_snapshots_generation_id_key',
      'estimates_requirement_generation_id_uidx'
    ) then
      raise exception 'REQ_TXN:DUPLICATE_GENERATION'
        using errcode = 'P0001';
    end if;
    raise;
  when check_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint ilike '%snapshot%' or v_constraint ilike '%payload%' then
      raise exception 'REQ_TXN:INVALID_SNAPSHOT'
        using errcode = 'P0001';
    end if;
    raise exception 'REQ_TXN:INVALID_LINE'
      using errcode = 'P0001';
end;
$$;

comment on function public.persist_estimate_generation_v1(jsonb) is
  'REQ-TXN-01 v1: atomically persist one estimate generation (row, lines, mandatory snapshot, pointer, ready). Org from auth. Snapshot is required for every successful call; empty requirements[] is valid. snapshotRequired is ignored. Duplicate generation_id fails. Failed call rolls back; previous ready generation remains.';

revoke all on function public.persist_estimate_generation_v1(jsonb)
  from public, anon, service_role;

grant execute on function public.persist_estimate_generation_v1(jsonb)
  to authenticated;

notify pgrst, 'reload schema';
