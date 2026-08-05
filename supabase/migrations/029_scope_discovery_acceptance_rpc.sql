-- Stage 3.1B.5A — Scope discovery accept / reject / modify-accept RPCs (LOCAL ONLY).
-- Additive. Depends on 028. Does not alter Facts, commercial tables, Analyse Job, or UI.
-- SECURITY INVOKER: RLS + auth.uid() / auth_org_id() apply to the calling role.

-- ---------------------------------------------------------------------------
-- A. Uniqueness: at most one scope-creating decision per suggestion
-- ---------------------------------------------------------------------------
-- Migration 028 already blocks duplicate ACCEPT. This also blocks MODIFY that
-- created a Work Area, and ACCEPT/MODIFY races that would create two WAs.

create unique index if not exists scope_discovery_decisions_one_scope_create_uidx
  on public.scope_discovery_decisions (suggestion_id)
  where decision_type in ('ACCEPT', 'MODIFY')
    and created_work_area_id is not null;

comment on index public.scope_discovery_decisions_one_scope_create_uidx is
  'At most one Work Area may be created from a single scope-discovery suggestion (ACCEPT or MODIFY).';

-- ---------------------------------------------------------------------------
-- B. Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.scope_discovery_supported_work_area_type(p_type text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_type in (
    'deck',
    'retaining_wall',
    'bathroom',
    'kitchen',
    'fence',
    'pergola',
    'external_stairs',
    'demolition',
    'internal_walls',
    'ceilings',
    'doors',
    'flooring',
    'painting',
    'plastering'
  );
$$;

create or replace function public.scope_discovery_decision_fail(p_code text)
returns void
language plpgsql
immutable
set search_path = public
as $$
begin
  raise exception 'SCOPE_DISCOVERY_DECISION:%', p_code
    using errcode = 'P0001';
end;
$$;

create or replace function public.scope_discovery_require_auth_org()
returns uuid
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
begin
  if v_uid is null then
    perform public.scope_discovery_decision_fail('FOREIGN_OR_MISSING');
  end if;

  select org_id into v_org
  from public.profiles
  where id = v_uid;

  if v_org is null then
    perform public.scope_discovery_decision_fail('FOREIGN_OR_MISSING');
  end if;

  return v_org;
end;
$$;

-- ---------------------------------------------------------------------------
-- C. ACCEPT
-- ---------------------------------------------------------------------------

create or replace function public.accept_scope_discovery_suggestion(
  p_suggestion_id uuid,
  p_project_id uuid,
  p_source_revision text,
  p_reason_code text default null,
  p_user_note text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_sug public.scope_discovery_suggestions%rowtype;
  v_run public.scope_discovery_runs%rowtype;
  v_wa_id uuid;
  v_decision_id uuid := gen_random_uuid();
  v_sort integer;
  v_type text;
  v_title text;
  v_summary text;
  v_existing_wa uuid;
  v_scope_decision uuid;
  v_reject_decision uuid;
begin
  v_org := public.scope_discovery_require_auth_org();

  if p_suggestion_id is null or p_project_id is null then
    perform public.scope_discovery_decision_fail('FOREIGN_OR_MISSING');
  end if;

  if p_source_revision is null or length(btrim(p_source_revision)) = 0 then
    perform public.scope_discovery_decision_fail('INVALID_MODIFICATION');
  end if;

  -- Project must belong to caller org (and exist).
  if not exists (
    select 1 from public.projects p
    where p.id = p_project_id
      and p.org_id = v_org
  ) then
    perform public.scope_discovery_decision_fail('FOREIGN_OR_MISSING');
  end if;

  select * into v_sug
  from public.scope_discovery_suggestions
  where id = p_suggestion_id
  for update;

  if not found then
    perform public.scope_discovery_decision_fail('SUGGESTION_NOT_FOUND');
  end if;

  -- Cross-org: hide as not found.
  if v_sug.org_id is distinct from v_org
     or v_sug.project_id is distinct from p_project_id then
    perform public.scope_discovery_decision_fail('SUGGESTION_NOT_FOUND');
  end if;

  select * into v_run
  from public.scope_discovery_runs
  where id = v_sug.run_id;

  if not found
     or v_run.org_id is distinct from v_org
     or v_run.project_id is distinct from p_project_id then
    perform public.scope_discovery_decision_fail('FOREIGN_OR_MISSING');
  end if;

  if v_sug.stale_reason is not null then
    perform public.scope_discovery_decision_fail('STALE_SUGGESTION');
  end if;

  if v_sug.superseded_by_suggestion_id is not null then
    perform public.scope_discovery_decision_fail('SUPERSEDED_SUGGESTION');
  end if;

  if v_sug.suggestion_kind not in ('WORK_AREA', 'SUB_SCOPE', 'MISSING_SCOPE') then
    perform public.scope_discovery_decision_fail('SUGGESTION_NOT_ELIGIBLE');
  end if;

  select d.id into v_scope_decision
  from public.scope_discovery_decisions d
  where d.suggestion_id = p_suggestion_id
    and d.decision_type in ('ACCEPT', 'MODIFY')
    and d.created_work_area_id is not null
  limit 1;

  if v_scope_decision is not null then
    perform public.scope_discovery_decision_fail('ALREADY_SCOPE_CREATED');
  end if;

  if exists (
    select 1 from public.scope_discovery_decisions d
    where d.suggestion_id = p_suggestion_id
      and d.decision_type = 'ACCEPT'
  ) then
    perform public.scope_discovery_decision_fail('ALREADY_ACCEPTED');
  end if;

  select d.id into v_reject_decision
  from public.scope_discovery_decisions d
  where d.suggestion_id = p_suggestion_id
    and d.decision_type = 'REJECT'
  limit 1;

  if v_reject_decision is not null then
    perform public.scope_discovery_decision_fail('DECISION_CONFLICT');
  end if;

  v_type := v_sug.proposed_work_area_type;
  v_title := nullif(btrim(v_sug.proposed_title), '');
  v_summary := v_sug.proposed_description;

  if v_type is null
     or not public.scope_discovery_supported_work_area_type(v_type)
     or v_title is null then
    perform public.scope_discovery_decision_fail('SUGGESTION_NOT_ELIGIBLE');
  end if;

  select w.id into v_existing_wa
  from public.work_areas w
  where w.project_id = p_project_id
    and w.org_id = v_org
    and w.type = v_type
    and w.status = 'confirmed'
  limit 1;

  if v_existing_wa is not null then
    perform public.scope_discovery_decision_fail('DUPLICATE_WORK_AREA');
  end if;

  select coalesce(max(w.sort_order), 0) + 1 into v_sort
  from public.work_areas w
  where w.project_id = p_project_id;

  insert into public.work_areas (
    org_id,
    project_id,
    type,
    name,
    status,
    ai_confidence,
    summary,
    sort_order
  ) values (
    v_org,
    p_project_id,
    v_type,
    v_title,
    'confirmed',
    null,
    v_summary,
    v_sort
  )
  returning id into v_wa_id;

  begin
    insert into public.scope_discovery_decisions (
      id,
      org_id,
      project_id,
      run_id,
      suggestion_id,
      decision_type,
      decided_by,
      decided_at,
      reason_code,
      user_note,
      modified_title,
      modified_description,
      modified_work_area_type,
      source_revision,
      created_work_area_id
    ) values (
      v_decision_id,
      v_org,
      p_project_id,
      v_sug.run_id,
      p_suggestion_id,
      'ACCEPT',
      v_uid,
      now(),
      p_reason_code,
      p_user_note,
      null,
      null,
      null,
      btrim(p_source_revision),
      v_wa_id
    );
  exception
    when unique_violation then
      perform public.scope_discovery_decision_fail('ALREADY_SCOPE_CREATED');
  end;

  return jsonb_build_object(
    'ok', true,
    'decision_id', v_decision_id,
    'work_area_id', v_wa_id,
    'decision_type', 'ACCEPT',
    'suggestion_id', p_suggestion_id,
    'project_id', p_project_id
  );
exception
  when others then
    if SQLERRM like 'SCOPE_DISCOVERY_DECISION:%' then
      raise;
    end if;
    raise exception 'SCOPE_DISCOVERY_DECISION:TRANSACTION_FAILED'
      using errcode = 'P0001';
end;
$$;

comment on function public.accept_scope_discovery_suggestion(uuid, uuid, text, text, text) is
  'Transactional ACCEPT: create confirmed Work Area + append decision. No Facts. Local 3.1B.5A.';

-- ---------------------------------------------------------------------------
-- D. MODIFY + ACCEPT
-- ---------------------------------------------------------------------------

create or replace function public.modify_accept_scope_discovery_suggestion(
  p_suggestion_id uuid,
  p_project_id uuid,
  p_modified_title text,
  p_modified_description text,
  p_modified_work_area_type text,
  p_source_revision text,
  p_reason_code text default null,
  p_user_note text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_sug public.scope_discovery_suggestions%rowtype;
  v_run public.scope_discovery_runs%rowtype;
  v_wa_id uuid;
  v_decision_id uuid := gen_random_uuid();
  v_sort integer;
  v_type text;
  v_title text;
  v_summary text;
  v_existing_wa uuid;
  v_scope_decision uuid;
begin
  v_org := public.scope_discovery_require_auth_org();

  if p_suggestion_id is null or p_project_id is null then
    perform public.scope_discovery_decision_fail('FOREIGN_OR_MISSING');
  end if;

  v_title := nullif(btrim(coalesce(p_modified_title, '')), '');
  v_type := nullif(btrim(coalesce(p_modified_work_area_type, '')), '');
  v_summary := nullif(btrim(coalesce(p_modified_description, '')), '');

  if v_title is null
     or v_type is null
     or not public.scope_discovery_supported_work_area_type(v_type)
     or p_source_revision is null
     or length(btrim(p_source_revision)) = 0 then
    perform public.scope_discovery_decision_fail('INVALID_MODIFICATION');
  end if;

  if not exists (
    select 1 from public.projects p
    where p.id = p_project_id
      and p.org_id = v_org
  ) then
    perform public.scope_discovery_decision_fail('FOREIGN_OR_MISSING');
  end if;

  select * into v_sug
  from public.scope_discovery_suggestions
  where id = p_suggestion_id
  for update;

  if not found then
    perform public.scope_discovery_decision_fail('SUGGESTION_NOT_FOUND');
  end if;

  if v_sug.org_id is distinct from v_org
     or v_sug.project_id is distinct from p_project_id then
    perform public.scope_discovery_decision_fail('SUGGESTION_NOT_FOUND');
  end if;

  select * into v_run
  from public.scope_discovery_runs
  where id = v_sug.run_id;

  if not found
     or v_run.org_id is distinct from v_org
     or v_run.project_id is distinct from p_project_id then
    perform public.scope_discovery_decision_fail('FOREIGN_OR_MISSING');
  end if;

  if v_sug.stale_reason is not null then
    perform public.scope_discovery_decision_fail('STALE_SUGGESTION');
  end if;

  if v_sug.superseded_by_suggestion_id is not null then
    perform public.scope_discovery_decision_fail('SUPERSEDED_SUGGESTION');
  end if;

  if v_sug.suggestion_kind not in ('WORK_AREA', 'SUB_SCOPE', 'MISSING_SCOPE') then
    perform public.scope_discovery_decision_fail('SUGGESTION_NOT_ELIGIBLE');
  end if;

  select d.id into v_scope_decision
  from public.scope_discovery_decisions d
  where d.suggestion_id = p_suggestion_id
    and d.decision_type in ('ACCEPT', 'MODIFY')
    and d.created_work_area_id is not null
  limit 1;

  if v_scope_decision is not null then
    perform public.scope_discovery_decision_fail('ALREADY_SCOPE_CREATED');
  end if;

  if exists (
    select 1 from public.scope_discovery_decisions d
    where d.suggestion_id = p_suggestion_id
      and d.decision_type = 'REJECT'
  ) then
    perform public.scope_discovery_decision_fail('DECISION_CONFLICT');
  end if;

  select w.id into v_existing_wa
  from public.work_areas w
  where w.project_id = p_project_id
    and w.org_id = v_org
    and w.type = v_type
    and w.status = 'confirmed'
  limit 1;

  if v_existing_wa is not null then
    perform public.scope_discovery_decision_fail('DUPLICATE_WORK_AREA');
  end if;

  select coalesce(max(w.sort_order), 0) + 1 into v_sort
  from public.work_areas w
  where w.project_id = p_project_id;

  insert into public.work_areas (
    org_id,
    project_id,
    type,
    name,
    status,
    ai_confidence,
    summary,
    sort_order
  ) values (
    v_org,
    p_project_id,
    v_type,
    v_title,
    'confirmed',
    null,
    v_summary,
    v_sort
  )
  returning id into v_wa_id;

  begin
    insert into public.scope_discovery_decisions (
      id,
      org_id,
      project_id,
      run_id,
      suggestion_id,
      decision_type,
      decided_by,
      decided_at,
      reason_code,
      user_note,
      modified_title,
      modified_description,
      modified_work_area_type,
      source_revision,
      created_work_area_id
    ) values (
      v_decision_id,
      v_org,
      p_project_id,
      v_sug.run_id,
      p_suggestion_id,
      'MODIFY',
      v_uid,
      now(),
      p_reason_code,
      p_user_note,
      v_title,
      v_summary,
      v_type,
      btrim(p_source_revision),
      v_wa_id
    );
  exception
    when unique_violation then
      perform public.scope_discovery_decision_fail('ALREADY_SCOPE_CREATED');
  end;

  return jsonb_build_object(
    'ok', true,
    'decision_id', v_decision_id,
    'work_area_id', v_wa_id,
    'decision_type', 'MODIFY',
    'suggestion_id', p_suggestion_id,
    'project_id', p_project_id
  );
exception
  when others then
    if SQLERRM like 'SCOPE_DISCOVERY_DECISION:%' then
      raise;
    end if;
    raise exception 'SCOPE_DISCOVERY_DECISION:TRANSACTION_FAILED'
      using errcode = 'P0001';
end;
$$;

comment on function public.modify_accept_scope_discovery_suggestion(uuid, uuid, text, text, text, text, text, text) is
  'Transactional MODIFY+ACCEPT: create corrected Work Area + append MODIFY decision. Original suggestion immutable. No Facts.';

-- ---------------------------------------------------------------------------
-- E. REJECT
-- ---------------------------------------------------------------------------

create or replace function public.reject_scope_discovery_suggestion(
  p_suggestion_id uuid,
  p_project_id uuid,
  p_source_revision text,
  p_reason_code text default null,
  p_user_note text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_sug public.scope_discovery_suggestions%rowtype;
  v_run public.scope_discovery_runs%rowtype;
  v_decision_id uuid;
  v_existing_reject public.scope_discovery_decisions%rowtype;
begin
  v_org := public.scope_discovery_require_auth_org();

  if p_suggestion_id is null or p_project_id is null then
    perform public.scope_discovery_decision_fail('FOREIGN_OR_MISSING');
  end if;

  if p_source_revision is null or length(btrim(p_source_revision)) = 0 then
    perform public.scope_discovery_decision_fail('INVALID_MODIFICATION');
  end if;

  if not exists (
    select 1 from public.projects p
    where p.id = p_project_id
      and p.org_id = v_org
  ) then
    perform public.scope_discovery_decision_fail('FOREIGN_OR_MISSING');
  end if;

  select * into v_sug
  from public.scope_discovery_suggestions
  where id = p_suggestion_id
  for update;

  if not found then
    perform public.scope_discovery_decision_fail('SUGGESTION_NOT_FOUND');
  end if;

  if v_sug.org_id is distinct from v_org
     or v_sug.project_id is distinct from p_project_id then
    perform public.scope_discovery_decision_fail('SUGGESTION_NOT_FOUND');
  end if;

  select * into v_run
  from public.scope_discovery_runs
  where id = v_sug.run_id;

  if not found
     or v_run.org_id is distinct from v_org
     or v_run.project_id is distinct from p_project_id then
    perform public.scope_discovery_decision_fail('FOREIGN_OR_MISSING');
  end if;

  if v_sug.stale_reason is not null then
    perform public.scope_discovery_decision_fail('STALE_SUGGESTION');
  end if;

  if v_sug.superseded_by_suggestion_id is not null then
    perform public.scope_discovery_decision_fail('SUPERSEDED_SUGGESTION');
  end if;

  if exists (
    select 1 from public.scope_discovery_decisions d
    where d.suggestion_id = p_suggestion_id
      and d.decision_type in ('ACCEPT', 'MODIFY')
      and d.created_work_area_id is not null
  ) then
    perform public.scope_discovery_decision_fail('ALREADY_SCOPE_CREATED');
  end if;

  -- Idempotent reject retry: return existing REJECT.
  select * into v_existing_reject
  from public.scope_discovery_decisions d
  where d.suggestion_id = p_suggestion_id
    and d.decision_type = 'REJECT'
  order by d.decided_at asc
  limit 1;

  if found then
    return jsonb_build_object(
      'ok', true,
      'decision_id', v_existing_reject.id,
      'work_area_id', null,
      'decision_type', 'REJECT',
      'suggestion_id', p_suggestion_id,
      'project_id', p_project_id,
      'idempotent_reuse', true
    );
  end if;

  v_decision_id := gen_random_uuid();

  insert into public.scope_discovery_decisions (
    id,
    org_id,
    project_id,
    run_id,
    suggestion_id,
    decision_type,
    decided_by,
    decided_at,
    reason_code,
    user_note,
    modified_title,
    modified_description,
    modified_work_area_type,
    source_revision,
    created_work_area_id
  ) values (
    v_decision_id,
    v_org,
    p_project_id,
    v_sug.run_id,
    p_suggestion_id,
    'REJECT',
    v_uid,
    now(),
    p_reason_code,
    p_user_note,
    null,
    null,
    null,
    btrim(p_source_revision),
    null
  );

  return jsonb_build_object(
    'ok', true,
    'decision_id', v_decision_id,
    'work_area_id', null,
    'decision_type', 'REJECT',
    'suggestion_id', p_suggestion_id,
    'project_id', p_project_id,
    'idempotent_reuse', false
  );
exception
  when others then
    if SQLERRM like 'SCOPE_DISCOVERY_DECISION:%' then
      raise;
    end if;
    raise exception 'SCOPE_DISCOVERY_DECISION:TRANSACTION_FAILED'
      using errcode = 'P0001';
end;
$$;

comment on function public.reject_scope_discovery_suggestion(uuid, uuid, text, text, text) is
  'Append-only REJECT decision. No Work Area. No Company DNA. Idempotent on retry.';

-- ---------------------------------------------------------------------------
-- F. Grants (least privilege — no anon EXECUTE)
-- ---------------------------------------------------------------------------

revoke all on function public.scope_discovery_supported_work_area_type(text) from public, anon;
revoke all on function public.scope_discovery_decision_fail(text) from public, anon;
revoke all on function public.scope_discovery_require_auth_org() from public, anon;
revoke all on function public.accept_scope_discovery_suggestion(uuid, uuid, text, text, text) from public, anon;
revoke all on function public.modify_accept_scope_discovery_suggestion(uuid, uuid, text, text, text, text, text, text) from public, anon;
revoke all on function public.reject_scope_discovery_suggestion(uuid, uuid, text, text, text) from public, anon;

-- Helpers must be executable by authenticated because RPCs are SECURITY INVOKER.
grant execute on function public.scope_discovery_supported_work_area_type(text)
  to authenticated, service_role;
grant execute on function public.scope_discovery_decision_fail(text)
  to authenticated, service_role;
grant execute on function public.scope_discovery_require_auth_org()
  to authenticated, service_role;
grant execute on function public.accept_scope_discovery_suggestion(uuid, uuid, text, text, text)
  to authenticated, service_role;
grant execute on function public.modify_accept_scope_discovery_suggestion(uuid, uuid, text, text, text, text, text, text)
  to authenticated, service_role;
grant execute on function public.reject_scope_discovery_suggestion(uuid, uuid, text, text, text)
  to authenticated, service_role;

notify pgrst, 'reload schema';
