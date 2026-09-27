-- Issued withdrawal records a reason without rewriting the issued document.
-- Draft deletion stays in 065. Migrations 063, 064 and 065 are unchanged.

create or replace function public.withdraw_variation_revision_v1(
  p_variation uuid,
  p_revision uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Reason-bearing withdrawal is withdraw_issued_variation_v1.
  -- This signature no longer withdraws a draft or an issued revision.
  return jsonb_build_object('ok', false, 'error', 'REASON_REQUIRED');
end;
$$;

create or replace function public.withdraw_issued_variation_v1(
  p_project uuid,
  p_variation uuid,
  p_revision uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock jsonb;
  v_reason text;
  v_sell numeric;
  v_org uuid;
  v_project uuid;
  v_actor uuid;
  v_number integer;
  v_revision_number integer;
  v_currency text;
begin
  v_lock := public.variation_lock_current(p_variation, p_revision);
  if coalesce(v_lock->>'ok', 'false') <> 'true' then
    return v_lock;
  end if;

  v_org := (v_lock->>'orgId')::uuid;
  v_project := (v_lock->>'projectId')::uuid;
  v_actor := (v_lock->>'userId')::uuid;
  if v_project is distinct from p_project then
    return jsonb_build_object('ok', false, 'error', 'CROSS_PROJECT');
  end if;

  if v_lock->>'status' = 'withdrawn' then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'status', 'withdrawn',
      'variationId', p_variation,
      'revisionId', p_revision
    );
  end if;

  if v_lock->>'status' is distinct from 'issued' then
    return jsonb_build_object('ok', false, 'error', 'WITHDRAW_BLOCKED');
  end if;

  v_reason := btrim(coalesce(p_reason, ''));
  if char_length(v_reason) < 1 or char_length(v_reason) > 500 then
    return jsonb_build_object('ok', false, 'error', 'REASON_REQUIRED');
  end if;

  select total_sell_adjustment_ex_gst into v_sell
  from public.variation_revisions
  where id = p_revision;

  v_number := (v_lock->>'variationNumber')::integer;
  v_revision_number := (v_lock->>'revisionNumber')::integer;
  v_currency := v_lock->>'currency';

  perform set_config('quotr.variation_write', 'transition', true);
  update public.variation_revisions
  set status = 'withdrawn',
      withdrawn_at = now(),
      withdrawn_by = v_actor
  where id = p_revision;
  update public.variations
  set status = 'withdrawn'
  where id = p_variation;

  insert into public.project_lifecycle_events (
    org_id, project_id, actor_user_id, event_type, occurred_at,
    source_entity_type, source_entity_id, idempotency_key, metadata, schema_version
  ) values (
    v_org,
    v_project,
    v_actor,
    'variation_withdrawn',
    now(),
    'variation',
    p_variation,
    'variation_withdrawn:' || p_revision::text,
    jsonb_strip_nulls(jsonb_build_object(
      'variationId', p_variation,
      'variationNumber', v_number,
      'revisionId', p_revision,
      'revisionNumber', v_revision_number,
      'priorStatus', 'issued',
      'status', 'withdrawn',
      'sellAdjustmentExGst', v_sell,
      'currency', v_currency,
      'withdrawalReason', v_reason
    )),
    1
  )
  on conflict (org_id, idempotency_key) do nothing;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'status', 'withdrawn',
    'variationId', p_variation,
    'revisionId', p_revision
  );
end;
$$;

comment on function public.withdraw_issued_variation_v1(uuid, uuid, uuid, text) is
  'Withdraws the current issued revision. The issued document, totals and accepted contract stay unchanged.';

revoke all on function public.withdraw_issued_variation_v1(uuid, uuid, uuid, text) from public;
grant execute on function public.withdraw_issued_variation_v1(uuid, uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';
