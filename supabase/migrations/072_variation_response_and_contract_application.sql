-- VARIATIONS-03B — client and manual acceptance/decline, and the accepted
-- contract adjustment ledger.
-- Responses and ledger rows are append-only. The ledger, not lifecycle events,
-- is the authority for revised contract value.
-- Does not edit migrations 058–071.

-- ---------------------------------------------------------------------------
-- A. Lifecycle vocabulary
-- ---------------------------------------------------------------------------

do $$
declare
  rec record;
begin
  for rec in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'project_lifecycle_events'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%event_type%'
  loop
    execute format(
      'alter table public.project_lifecycle_events drop constraint %I',
      rec.conname
    );
  end loop;
end $$;

alter table public.project_lifecycle_events
  add constraint project_lifecycle_events_event_type_check
  check (
    event_type in (
      'estimate_ready',
      'pricing_confirmed',
      'quote_created',
      'quote_sent',
      'quote_accepted',
      'project_activated',
      'project_completed',
      'project_cancelled',
      'variation_created',
      'variation_issued',
      'variation_accepted',
      'variation_rejected',
      'variation_declined',
      'variation_withdrawn',
      'variation_superseded',
      'variation_sent'
    )
  );

-- ---------------------------------------------------------------------------
-- B. Immutable response evidence and accepted adjustment ledger
-- ---------------------------------------------------------------------------

create table if not exists public.variation_responses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  variation_id uuid not null references public.variations (id) on delete cascade,
  variation_revision_id uuid not null references public.variation_revisions (id) on delete cascade,
  outcome text not null check (outcome in ('accepted', 'declined')),
  source text not null check (source in ('client', 'manual')),
  responded_at timestamptz not null default now(),
  responder_name text not null check (char_length(btrim(responder_name)) between 1 and 200),
  responder_email text,
  builder_actor_id uuid references public.profiles (id) on delete set null,
  manual_evidence_type text,
  manual_evidence_note text,
  client_decline_reason text,
  issued_total_ex_gst numeric(12, 2) not null,
  issued_gst numeric(12, 2) not null,
  issued_total_incl_gst numeric(12, 2) not null,
  currency text not null,
  gst_rate numeric(5, 2) not null,
  tax_treatment text not null,
  accepted_snapshot_id uuid not null,
  document_identity jsonb not null,
  client_attachment_manifest jsonb not null,
  confirmation_versions jsonb not null,
  request_metadata jsonb,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  schema_version text not null default 'v1',
  created_at timestamptz not null default now(),
  constraint variation_responses_email_chk check (
    responder_email is null
    or (
      char_length(btrim(responder_email)) between 3 and 200
      and position('@' in responder_email) > 1
    )
  ),
  constraint variation_responses_source_chk check (
    (
      source = 'client'
      and responder_email is not null
      and builder_actor_id is null
      and manual_evidence_type is null
      and manual_evidence_note is null
    )
    or (
      source = 'manual'
      and builder_actor_id is not null
      and manual_evidence_type in ('email_confirmation', 'signed_document', 'verbal_approval', 'other')
      and manual_evidence_note is not null
      and char_length(btrim(manual_evidence_note)) between 1 and 2000
    )
  ),
  constraint variation_responses_note_meaning_chk check (
    source is distinct from 'manual'
    or manual_evidence_type not in ('verbal_approval', 'other')
    or char_length(btrim(manual_evidence_note)) >= 8
  ),
  constraint variation_responses_decline_reason_chk check (
    client_decline_reason is null
    or (
      outcome = 'declined'
      and source = 'client'
      and char_length(client_decline_reason) <= 2000
    )
  )
);

create unique index if not exists variation_responses_variation_uidx
  on public.variation_responses (variation_id);

create unique index if not exists variation_responses_idempotency_uidx
  on public.variation_responses (org_id, idempotency_key);

create index if not exists variation_responses_project_idx
  on public.variation_responses (org_id, project_id);

comment on table public.variation_responses is
  'Immutable terminal response for one logical Variation and its exact issued revision. One row only.';

create table if not exists public.variation_accepted_adjustments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  variation_id uuid not null references public.variations (id) on delete cascade,
  variation_revision_id uuid not null references public.variation_revisions (id) on delete cascade,
  response_id uuid not null references public.variation_responses (id) on delete cascade,
  currency text not null,
  gst_rate numeric(5, 2) not null,
  tax_treatment text not null,
  net_adjustment_ex_gst numeric(12, 2) not null,
  gst_adjustment numeric(12, 2) not null,
  adjustment_incl_gst numeric(12, 2) not null,
  accepted_snapshot_id uuid not null,
  accepted_at timestamptz not null,
  schema_version text not null default 'v1',
  created_at timestamptz not null default now()
);

create unique index if not exists variation_accepted_adjustments_variation_uidx
  on public.variation_accepted_adjustments (variation_id);

create unique index if not exists variation_accepted_adjustments_response_uidx
  on public.variation_accepted_adjustments (response_id);

create index if not exists variation_accepted_adjustments_project_idx
  on public.variation_accepted_adjustments (org_id, project_id);

comment on table public.variation_accepted_adjustments is
  'One immutable signed adjustment per accepted Variation. This ledger is the revised contract authority. It does not rewrite the accepted Quote snapshot.';

create or replace function public.enforce_variation_response_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'variation response evidence is append-only';
end;
$$;

drop trigger if exists variation_responses_no_update on public.variation_responses;
create trigger variation_responses_no_update
  before update on public.variation_responses
  for each row execute function public.enforce_variation_response_append_only();

drop trigger if exists variation_responses_no_delete on public.variation_responses;
create trigger variation_responses_no_delete
  before delete on public.variation_responses
  for each row execute function public.enforce_variation_response_append_only();

drop trigger if exists variation_accepted_adjustments_no_update on public.variation_accepted_adjustments;
create trigger variation_accepted_adjustments_no_update
  before update on public.variation_accepted_adjustments
  for each row execute function public.enforce_variation_response_append_only();

drop trigger if exists variation_accepted_adjustments_no_delete on public.variation_accepted_adjustments;
create trigger variation_accepted_adjustments_no_delete
  before delete on public.variation_accepted_adjustments
  for each row execute function public.enforce_variation_response_append_only();

alter table public.variation_responses enable row level security;
alter table public.variation_accepted_adjustments enable row level security;

revoke all on table public.variation_responses from public, anon, authenticated;
revoke all on table public.variation_accepted_adjustments from public, anon, authenticated;
grant select on table public.variation_responses to authenticated;
grant select on table public.variation_accepted_adjustments to authenticated;
grant select, insert, update, delete on table public.variation_responses to service_role;
grant select, insert, update, delete on table public.variation_accepted_adjustments to service_role;

create policy "Users can select variation responses in their organisation"
  on public.variation_responses for select
  using (org_id = public.auth_org_id());

create policy "Users can select variation accepted adjustments in their organisation"
  on public.variation_accepted_adjustments for select
  using (org_id = public.auth_org_id());

-- ---------------------------------------------------------------------------
-- C. Frozen client-attachment manifest. Internal files are excluded.
-- ---------------------------------------------------------------------------

create or replace function public.variation_client_manifest_v1(
  p_org uuid,
  p_revision uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_files jsonb;
begin
  if exists (
    select 1
    from public.variation_attachments a
    where a.org_id = p_org
      and a.variation_revision_id = p_revision
      and a.visibility = 'client'
      and (
        a.upload_status is distinct from 'ready'
        or a.object_confirmed is distinct from true
        or a.frozen_at is null
        or a.issued_manifest is null
        or coalesce(a.issued_manifest->>'visibility', 'client') is distinct from 'client'
        or coalesce(a.issued_manifest->>'displayFilename', '') = ''
        or coalesce(a.issued_manifest->>'mimeType', '') = ''
        or coalesce(a.issued_manifest->>'byteSize', '') !~ '^[0-9]+$'
      )
  ) then
    return jsonb_build_object('ok', false, 'error', 'MANIFEST_UNRESOLVED');
  end if;

  select coalesce(jsonb_agg(file order by sort_order, file_id), '[]'::jsonb), count(*)
    into v_files, v_count
  from (
    select
      a.id as file_id,
      coalesce((a.issued_manifest->>'sortOrder')::int, a.sort_order) as sort_order,
      jsonb_build_object(
        'fileId', a.id,
        'displayFilename', a.issued_manifest->>'displayFilename',
        'caption', a.issued_manifest->>'caption',
        'mimeType', a.issued_manifest->>'mimeType',
        'byteSize', (a.issued_manifest->>'byteSize')::bigint,
        'sortOrder', coalesce((a.issued_manifest->>'sortOrder')::int, a.sort_order)
      ) as file
    from public.variation_attachments a
    where a.org_id = p_org
      and a.variation_revision_id = p_revision
      and a.visibility = 'client'
      and a.frozen_at is not null
      and a.issued_manifest is not null
  ) files;

  return jsonb_build_object('ok', true, 'count', coalesce(v_count, 0), 'files', coalesce(v_files, '[]'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------
-- D. Shared terminal transition. Callers supply identity; money comes from the revision.
-- ---------------------------------------------------------------------------

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
    v_reason := null;
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
      case when p_outcome = 'declined' and p_source = 'client' then v_reason else null end,
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

create or replace function public.respond_to_variation_by_token_v1(
  p_token_hash text,
  p_outcome text,
  p_responder_name text,
  p_responder_email text,
  p_decline_reason text,
  p_confirm_authority boolean,
  p_confirm_scope boolean,
  p_confirm_attachments boolean,
  p_confirm_master_terms boolean,
  p_confirm_final boolean,
  p_idempotency_key text,
  p_ip text,
  p_user_agent text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text := nullif(btrim(coalesce(p_token_hash, '')), '');
  v_token public.variation_access_tokens%rowtype;
  v_result jsonb;
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

  v_result := public.variation_apply_terminal_response_v1(
    v_token.org_id, v_token.project_id, v_token.variation_id, v_token.revision_id,
    p_outcome, 'client', p_responder_name, p_responder_email, null,
    null, null, p_decline_reason, p_idempotency_key,
    p_confirm_authority, p_confirm_scope, p_confirm_attachments, p_confirm_master_terms,
    p_confirm_final, false, p_ip, p_user_agent
  );

  return v_result;
end;
$$;

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
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := public.auth_org_id();
begin
  if v_uid is null or v_org is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  end if;
  return public.variation_apply_terminal_response_v1(
    v_org, p_project, p_variation, p_revision, p_outcome, 'manual',
    p_responder_name, p_responder_email, v_uid, p_evidence_type, p_evidence_note,
    null, p_idempotency_key,
    false, false, false, false, false, p_confirm_received, null, null
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- E. Public read: ledger-backed contract, terminal states, client files only
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
      'sortOrder', i.sort_order
    ) as item
    from public.variation_items i
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

create or replace function public.resolve_variation_client_attachment_v1(
  p_token_hash text,
  p_file_id uuid
)
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
  v_row public.variation_attachments%rowtype;
begin
  if v_hash is null or p_file_id is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  select * into v_token from public.variation_access_tokens where token_hash = v_hash limit 1;
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
  if v_rev.status = 'withdrawn' then
    return jsonb_build_object('ok', false, 'error', 'WITHDRAWN');
  end if;
  select * into v_variation
  from public.variations
  where id = v_token.variation_id and org_id = v_token.org_id and project_id = v_token.project_id;
  if not found
    or v_rev.status not in ('issued', 'accepted', 'rejected')
    or v_variation.current_revision_id is distinct from v_rev.id
  then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  select * into v_row
  from public.variation_attachments
  where id = p_file_id
    and variation_revision_id = v_rev.id
    and org_id = v_token.org_id
    and project_id = v_token.project_id
    and visibility = 'client'
    and upload_status = 'ready'
    and object_confirmed
    and frozen_at is not null;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  return jsonb_build_object(
    'ok', true,
    'storageBucket', v_row.storage_bucket,
    'storageObjectPath', coalesce(v_row.issued_manifest->>'storageObjectPath', v_row.storage_object_path),
    'mimeType', coalesce(v_row.issued_manifest->>'mimeType', v_row.mime_type),
    'displayFilename', coalesce(v_row.issued_manifest->>'displayFilename', v_row.display_filename),
    'byteSize', coalesce((v_row.issued_manifest->>'byteSize')::bigint, v_row.byte_size)
  );
end;
$$;

revoke all on function public.variation_client_manifest_v1(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.variation_apply_terminal_response_v1(uuid, uuid, uuid, uuid, text, text, text, text, uuid, text, text, text, text, boolean, boolean, boolean, boolean, boolean, boolean, text, text) from public, anon, authenticated, service_role;
revoke all on function public.respond_to_variation_by_token_v1(text, text, text, text, text, boolean, boolean, boolean, boolean, boolean, text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.record_variation_response_v1(uuid, uuid, uuid, text, text, text, text, text, boolean, text) from public, anon, authenticated, service_role;
revoke all on function public.enforce_variation_response_append_only() from public, anon, authenticated, service_role;

grant execute on function public.respond_to_variation_by_token_v1(text, text, text, text, text, boolean, boolean, boolean, boolean, boolean, text, text, text) to anon, authenticated;
grant execute on function public.record_variation_response_v1(uuid, uuid, uuid, text, text, text, text, text, boolean, text) to authenticated;

notify pgrst, 'reload schema';
