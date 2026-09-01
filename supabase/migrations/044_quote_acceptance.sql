-- Quotr 2.0 — QUOTE-ACCEPTANCE-01
-- Client accept/decline of an exact immutable Quote revision.
-- Additive shared-DB compatible. Does not change Quote money or snapshot.
-- Internal accept_quote_revision_v1 / decline_quote_revision_v1 signatures stay.

-- ---------------------------------------------------------------------------
-- A. Immutable evidence tables
-- ---------------------------------------------------------------------------

create table if not exists public.quote_acceptances (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  quote_id uuid not null references public.quotes (id) on delete cascade,
  quote_number text,
  revision_number integer not null,
  snapshot_fingerprint text,
  snapshot_fingerprint_version text,
  source text not null check (source in ('client', 'manual')),
  signer_name text,
  signer_email text,
  acceptance_declaration text,
  declaration_version text,
  signature_method text not null check (signature_method in ('typed', 'drawn', 'none')),
  signature_value text,
  accepted_total_incl_gst numeric not null,
  accepted_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  access_token_id uuid references public.quote_access_tokens (id) on delete set null,
  delivery_id uuid references public.quote_deliveries (id) on delete set null,
  actor_user_id uuid references public.profiles (id) on delete set null,
  evidence_version text not null default 'v1',
  created_at timestamptz not null default now(),
  constraint quote_acceptances_source_evidence_chk check (
    (
      source = 'client'
      and signer_name is not null
      and length(btrim(signer_name)) > 0
      and signer_email is not null
      and signature_method in ('typed', 'drawn')
      and acceptance_declaration is not null
      and length(btrim(acceptance_declaration)) > 0
    )
    or (
      source = 'manual'
      and signature_method = 'none'
      and signature_value is null
      and actor_user_id is not null
    )
  )
);

create unique index if not exists quote_acceptances_quote_uidx
  on public.quote_acceptances (quote_id);

create index if not exists quote_acceptances_org_idx
  on public.quote_acceptances (org_id, created_at desc);

comment on table public.quote_acceptances is
  'Immutable acceptance evidence for one Quote revision. Client rows hold signer/signature; manual rows never fabricate a client signature.';

create table if not exists public.quote_declines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  quote_id uuid not null references public.quotes (id) on delete cascade,
  quote_number text,
  revision_number integer not null,
  source text not null check (source in ('client', 'manual')),
  message text,
  declined_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  access_token_id uuid references public.quote_access_tokens (id) on delete set null,
  delivery_id uuid references public.quote_deliveries (id) on delete set null,
  actor_user_id uuid references public.profiles (id) on delete set null,
  evidence_version text not null default 'v1',
  created_at timestamptz not null default now(),
  constraint quote_declines_manual_actor_chk check (
    source = 'client' or actor_user_id is not null
  )
);

create unique index if not exists quote_declines_quote_uidx
  on public.quote_declines (quote_id);

create index if not exists quote_declines_org_idx
  on public.quote_declines (org_id, created_at desc);

comment on table public.quote_declines is
  'Immutable decline evidence for one Quote revision. Optional client message. No signature required.';

create or replace function public.enforce_quote_acceptance_evidence_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'quote acceptance evidence is append-only';
end;
$$;

drop trigger if exists quote_acceptances_no_update on public.quote_acceptances;
create trigger quote_acceptances_no_update
  before update on public.quote_acceptances
  for each row
  execute function public.enforce_quote_acceptance_evidence_append_only();

drop trigger if exists quote_acceptances_no_delete on public.quote_acceptances;
create trigger quote_acceptances_no_delete
  before delete on public.quote_acceptances
  for each row
  execute function public.enforce_quote_acceptance_evidence_append_only();

drop trigger if exists quote_declines_no_update on public.quote_declines;
create trigger quote_declines_no_update
  before update on public.quote_declines
  for each row
  execute function public.enforce_quote_acceptance_evidence_append_only();

drop trigger if exists quote_declines_no_delete on public.quote_declines;
create trigger quote_declines_no_delete
  before delete on public.quote_declines
  for each row
  execute function public.enforce_quote_acceptance_evidence_append_only();

alter table public.quote_acceptances enable row level security;
alter table public.quote_declines enable row level security;

revoke all on table public.quote_acceptances from public, anon, authenticated;
revoke all on table public.quote_declines from public, anon, authenticated;
grant select on table public.quote_acceptances to authenticated;
grant select on table public.quote_declines to authenticated;
grant select, insert, update, delete on table public.quote_acceptances to service_role;
grant select, insert, update, delete on table public.quote_declines to service_role;

create policy "Users can select quote acceptances in their organisation"
  on public.quote_acceptances for select
  using (org_id = public.auth_org_id());

create policy "Users can select quote declines in their organisation"
  on public.quote_declines for select
  using (org_id = public.auth_org_id());

-- ---------------------------------------------------------------------------
-- B. Event helper: allow unauthenticated nested client accept/decline
-- ---------------------------------------------------------------------------

create or replace function public.quote_txn_append_event(
  p_org uuid,
  p_project uuid,
  p_quote uuid,
  p_event_type text,
  p_actor_type text,
  p_actor uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
begin
  if v_org is not null then
    if p_org is distinct from v_org then
      perform public.quote_txn_fail('QUOTE_TXN:NOT_AUTHENTICATED');
    end if;
  else
    if p_event_type not in ('quote_viewed', 'quote_accepted', 'quote_declined')
      or p_actor_type is distinct from 'client' then
      perform public.quote_txn_fail('QUOTE_TXN:NOT_AUTHENTICATED');
    end if;
  end if;
  if p_event_type is null or p_actor_type is null then
    perform public.quote_txn_fail('QUOTE_TXN:INVALID_PAYLOAD');
  end if;
  if not exists (
    select 1
    from public.quotes
    where id = p_quote
      and org_id = p_org
      and project_id = p_project
  ) then
    perform public.quote_txn_fail('QUOTE_TXN:NOT_FOUND');
  end if;

  insert into public.quote_events (
    org_id, project_id, quote_id, event_type, actor_type, actor_user_id, metadata
  )
  values (
    p_org, p_project, p_quote, p_event_type, p_actor_type, p_actor,
    coalesce(p_metadata, '{}'::jsonb)
  );
exception
  when unique_violation then
    null;
end;
$$;

revoke all on function public.quote_txn_append_event(uuid, uuid, uuid, text, text, uuid, jsonb)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- C. Shared eligibility + lifecycle (not granted to clients)
-- ---------------------------------------------------------------------------

create or replace function public.quote_revision_is_calendar_expired(p_quote public.quotes)
returns boolean
language sql
stable
as $$
  select
    p_quote.status = 'expired'
    or p_quote.expired_at is not null
    or (
      p_quote.valid_until is not null
      and (timezone('Pacific/Auckland', now()))::date > p_quote.valid_until
    );
$$;

create or replace function public.quote_revision_is_superseded(p_quote public.quotes)
returns boolean
language sql
immutable
as $$
  select p_quote.status = 'superseded' or p_quote.superseded_by_quote_id is not null;
$$;

create or replace function public.quote_mark_project_won_if_active(
  p_org uuid,
  p_project uuid,
  p_now timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.projects
  set
    business_status = 'won',
    won_at = coalesce(won_at, p_now),
    lost_at = null,
    lost_reason = null,
    status_updated_at = p_now
  where id = p_project
    and org_id = p_org
    and deleted_at is null
    and coalesce(business_status, '') not in ('won', 'lost');
end;
$$;

create or replace function public.quote_mark_project_lost_if_active(
  p_org uuid,
  p_project uuid,
  p_now timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.projects
  set
    business_status = 'lost',
    lost_at = coalesce(lost_at, p_now),
    status_updated_at = p_now
  where id = p_project
    and org_id = p_org
    and deleted_at is null
    and coalesce(business_status, '') not in ('won', 'lost');
end;
$$;

revoke all on function public.quote_revision_is_calendar_expired(public.quotes)
  from public, anon, authenticated, service_role;
revoke all on function public.quote_revision_is_superseded(public.quotes)
  from public, anon, authenticated, service_role;
revoke all on function public.quote_mark_project_won_if_active(uuid, uuid, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.quote_mark_project_lost_if_active(uuid, uuid, timestamptz)
  from public, anon, authenticated, service_role;

create or replace function public.quote_apply_accepted_state_v1(
  p_quote_id uuid,
  p_org uuid,
  p_actor_type text,
  p_actor uuid,
  p_now timestamptz,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.quotes%rowtype;
begin
  select * into v_quote
  from public.quotes
  where id = p_quote_id and org_id = p_org;

  if not found then
    perform public.quote_txn_fail('QUOTE_TXN:NOT_FOUND');
  end if;

  update public.quotes
  set status = 'accepted', accepted_at = p_now
  where id = p_quote_id
    and org_id = p_org
    and status in ('sent', 'viewed');

  if not found then
    perform public.quote_txn_fail('QUOTE_TXN:INVALID_TRANSITION');
  end if;

  perform public.quote_txn_append_event(
    p_org,
    v_quote.project_id,
    v_quote.id,
    'quote_accepted',
    p_actor_type,
    p_actor,
    coalesce(p_metadata, '{}'::jsonb)
  );

  perform public.quote_mark_project_won_if_active(p_org, v_quote.project_id, p_now);
end;
$$;

create or replace function public.quote_apply_declined_state_v1(
  p_quote_id uuid,
  p_org uuid,
  p_actor_type text,
  p_actor uuid,
  p_now timestamptz,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.quotes%rowtype;
begin
  select * into v_quote
  from public.quotes
  where id = p_quote_id and org_id = p_org;

  if not found then
    perform public.quote_txn_fail('QUOTE_TXN:NOT_FOUND');
  end if;

  update public.quotes
  set status = 'declined', declined_at = p_now
  where id = p_quote_id
    and org_id = p_org
    and status in ('sent', 'viewed');

  if not found then
    perform public.quote_txn_fail('QUOTE_TXN:INVALID_TRANSITION');
  end if;

  perform public.quote_txn_append_event(
    p_org,
    v_quote.project_id,
    v_quote.id,
    'quote_declined',
    p_actor_type,
    p_actor,
    coalesce(p_metadata, '{}'::jsonb)
  );

  perform public.quote_mark_project_lost_if_active(p_org, v_quote.project_id, p_now);
end;
$$;

revoke all on function public.quote_apply_accepted_state_v1(uuid, uuid, text, uuid, timestamptz, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.quote_apply_declined_state_v1(uuid, uuid, text, uuid, timestamptz, jsonb)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- D. Internal/admin lifecycle — same signature, now records source=manual
-- ---------------------------------------------------------------------------

create or replace function public.accept_quote_revision_v1(p_quote_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := public.auth_org_id();
  v_quote public.quotes%rowtype;
  v_now timestamptz := now();
begin
  if v_uid is null or v_org is null then
    perform public.quote_txn_fail('QUOTE_TXN:NOT_AUTHENTICATED');
  end if;

  select * into v_quote
  from public.quotes
  where id = p_quote_id and org_id = v_org
  for update;

  if not found then
    perform public.quote_txn_fail('QUOTE_TXN:NOT_FOUND');
  end if;

  if v_quote.status = 'accepted' then
    return jsonb_build_object('ok', true, 'idempotent', true, 'quoteId', v_quote.id, 'status', 'accepted');
  end if;
  if v_quote.status not in ('sent', 'viewed') then
    perform public.quote_txn_fail('QUOTE_TXN:INVALID_TRANSITION');
  end if;

  insert into public.quote_acceptances (
    org_id, project_id, quote_id, quote_number, revision_number,
    snapshot_fingerprint, snapshot_fingerprint_version, source,
    signer_name, signer_email, acceptance_declaration, declaration_version,
    signature_method, signature_value, accepted_total_incl_gst,
    accepted_at, actor_user_id, evidence_version
  )
  values (
    v_org, v_quote.project_id, v_quote.id, v_quote.quote_number, v_quote.revision_number,
    v_quote.snapshot_fingerprint, v_quote.snapshot_fingerprint_version, 'manual',
    null, null, 'Manually marked accepted by the contractor.', 'manual_v1',
    'none', null, v_quote.total_incl_gst,
    v_now, v_uid, 'v1'
  );

  perform public.quote_apply_accepted_state_v1(
    v_quote.id, v_org, 'user', v_uid, v_now,
    jsonb_build_object('source', 'manual')
  );

  return jsonb_build_object('ok', true, 'idempotent', false, 'quoteId', v_quote.id, 'status', 'accepted');
end;
$$;

create or replace function public.decline_quote_revision_v1(p_quote_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := public.auth_org_id();
  v_quote public.quotes%rowtype;
  v_now timestamptz := now();
begin
  if v_uid is null or v_org is null then
    perform public.quote_txn_fail('QUOTE_TXN:NOT_AUTHENTICATED');
  end if;

  select * into v_quote
  from public.quotes
  where id = p_quote_id and org_id = v_org
  for update;

  if not found then
    perform public.quote_txn_fail('QUOTE_TXN:NOT_FOUND');
  end if;

  if v_quote.status = 'declined' then
    return jsonb_build_object('ok', true, 'idempotent', true, 'quoteId', v_quote.id, 'status', 'declined');
  end if;
  if v_quote.status not in ('sent', 'viewed') then
    perform public.quote_txn_fail('QUOTE_TXN:INVALID_TRANSITION');
  end if;

  insert into public.quote_declines (
    org_id, project_id, quote_id, quote_number, revision_number,
    source, message, declined_at, actor_user_id, evidence_version
  )
  values (
    v_org, v_quote.project_id, v_quote.id, v_quote.quote_number, v_quote.revision_number,
    'manual', null, v_now, v_uid, 'v1'
  );

  perform public.quote_apply_declined_state_v1(
    v_quote.id, v_org, 'user', v_uid, v_now,
    jsonb_build_object('source', 'manual')
  );

  return jsonb_build_object('ok', true, 'idempotent', false, 'quoteId', v_quote.id, 'status', 'declined');
end;
$$;

-- ---------------------------------------------------------------------------
-- E. Token-authorised public accept / decline
-- ---------------------------------------------------------------------------

create or replace function public.quote_acceptance_email_ok(p_value text)
returns boolean
language sql
immutable
as $$
  select
    p_value is not null
    and length(btrim(p_value)) between 3 and 254
    and p_value !~ '[\r\n,<>]'
    and p_value ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$';
$$;

create or replace function public.quote_acceptance_drawn_ok(p_value text)
returns boolean
language sql
immutable
as $$
  select
    p_value is not null
    and char_length(p_value) between 20 and 24576
    and left(p_value, 4) = '<svg'
    and position('</svg>' in p_value) > 0
    and p_value !~* '<script|javascript:|on[a-z]+\s*='
    and p_value !~* 'foreignobject|<use[\s/>]|<image[\s/>]|<iframe|<object|<embed'
    and p_value !~* 'xlink:href|href\s*=|src\s*=|data:'
    and p_value ~* '<path[\s>]';
$$;

revoke all on function public.quote_acceptance_email_ok(text)
  from public, anon, authenticated, service_role;
revoke all on function public.quote_acceptance_drawn_ok(text)
  from public, anon, authenticated, service_role;

create or replace function public.accept_quote_by_access_token_v1(
  p_token_hash text,
  p_signer_name text,
  p_signer_email text,
  p_declaration text,
  p_declaration_version text,
  p_signature_method text,
  p_signature_value text,
  p_snapshot_fingerprint text,
  p_ip_address text,
  p_user_agent text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text := nullif(btrim(coalesce(p_token_hash, '')), '');
  v_token public.quote_access_tokens%rowtype;
  v_quote public.quotes%rowtype;
  v_now timestamptz := now();
  v_name text := nullif(btrim(coalesce(p_signer_name, '')), '');
  v_email text := nullif(btrim(coalesce(p_signer_email, '')), '');
  v_declaration text := nullif(btrim(coalesce(p_declaration, '')), '');
  v_method text := nullif(btrim(coalesce(p_signature_method, '')), '');
  v_sig text := nullif(p_signature_value, '');
  v_fp text := nullif(btrim(coalesce(p_snapshot_fingerprint, '')), '');
  v_expected text;
  v_quote_number text;
  v_delivery_id uuid;
begin
  if v_hash is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;

  select * into v_token
  from public.quote_access_tokens
  where token_hash = v_hash
  limit 1;

  if not found or v_token.revoked_at is not null then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_token.expires_at is not null and v_token.expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;

  select * into v_quote
  from public.quotes
  where id = v_token.quote_id and org_id = v_token.org_id
  for update;

  if not found or v_quote.status = 'archived' then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;

  if v_quote.status = 'accepted' then
    return jsonb_build_object(
      'ok', true, 'idempotent', true, 'quoteId', v_quote.id, 'status', 'accepted'
    );
  end if;

  if public.quote_revision_is_superseded(v_quote) then
    return jsonb_build_object('ok', false, 'error', 'SUPERSEDED');
  end if;
  if public.quote_revision_is_calendar_expired(v_quote) then
    return jsonb_build_object('ok', false, 'error', 'EXPIRED');
  end if;
  if v_quote.status not in ('sent', 'viewed') then
    return jsonb_build_object('ok', false, 'error', 'INVALID_TRANSITION');
  end if;

  if v_fp is null or v_quote.snapshot_fingerprint is distinct from v_fp then
    return jsonb_build_object('ok', false, 'error', 'FINGERPRINT_MISMATCH');
  end if;

  if v_name is null or char_length(v_name) > 160 or v_name ~ '[\r\n]' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_EVIDENCE');
  end if;
  if not public.quote_acceptance_email_ok(v_email) then
    return jsonb_build_object('ok', false, 'error', 'INVALID_EVIDENCE');
  end if;
  if coalesce(p_declaration_version, '') is distinct from 'v1' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_EVIDENCE');
  end if;

  v_quote_number := coalesce(nullif(btrim(v_quote.quote_number), ''), v_quote.title);
  v_expected :=
    'I confirm that I have reviewed and accept Quote '
    || v_quote_number
    || ' Revision '
    || v_quote.revision_number::text
    || ' for '
    || '$'
    || to_char(v_quote.total_incl_gst, 'FM999,999,990.00')
    || ' incl GST, including its scope, assumptions, exclusions and terms.';

  if v_declaration is distinct from v_expected then
    return jsonb_build_object('ok', false, 'error', 'INVALID_EVIDENCE');
  end if;

  if v_method = 'typed' then
    v_sig := v_name;
  elsif v_method = 'drawn' then
    if not public.quote_acceptance_drawn_ok(v_sig) then
      return jsonb_build_object('ok', false, 'error', 'INVALID_EVIDENCE');
    end if;
  else
    return jsonb_build_object('ok', false, 'error', 'INVALID_EVIDENCE');
  end if;

  select d.id into v_delivery_id
  from public.quote_deliveries d
  where d.access_token_id = v_token.id
    and d.org_id = v_token.org_id
  order by d.created_at desc
  limit 1;

  insert into public.quote_acceptances (
    org_id, project_id, quote_id, quote_number, revision_number,
    snapshot_fingerprint, snapshot_fingerprint_version, source,
    signer_name, signer_email, acceptance_declaration, declaration_version,
    signature_method, signature_value, accepted_total_incl_gst,
    accepted_at, ip_address, user_agent, access_token_id, delivery_id,
    evidence_version
  )
  values (
    v_token.org_id, v_quote.project_id, v_quote.id, v_quote.quote_number, v_quote.revision_number,
    v_quote.snapshot_fingerprint, v_quote.snapshot_fingerprint_version, 'client',
    v_name, v_email, v_declaration, 'v1',
    v_method, v_sig, v_quote.total_incl_gst,
    v_now,
    nullif(left(btrim(coalesce(p_ip_address, '')), 64), ''),
    nullif(left(btrim(coalesce(p_user_agent, '')), 512), ''),
    v_token.id, v_delivery_id, 'v1'
  );

  perform public.quote_apply_accepted_state_v1(
    v_quote.id, v_token.org_id, 'client', null, v_now,
    jsonb_build_object('source', 'client')
  );

  return jsonb_build_object(
    'ok', true, 'idempotent', false, 'quoteId', v_quote.id, 'status', 'accepted'
  );
exception
  when unique_violation then
    return jsonb_build_object(
      'ok', true, 'idempotent', true, 'quoteId', v_quote.id, 'status', 'accepted'
    );
end;
$$;

create or replace function public.decline_quote_by_access_token_v1(
  p_token_hash text,
  p_message text,
  p_ip_address text,
  p_user_agent text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text := nullif(btrim(coalesce(p_token_hash, '')), '');
  v_token public.quote_access_tokens%rowtype;
  v_quote public.quotes%rowtype;
  v_now timestamptz := now();
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
  v_delivery_id uuid;
begin
  if v_hash is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;

  select * into v_token
  from public.quote_access_tokens
  where token_hash = v_hash
  limit 1;

  if not found or v_token.revoked_at is not null then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_token.expires_at is not null and v_token.expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;

  select * into v_quote
  from public.quotes
  where id = v_token.quote_id and org_id = v_token.org_id
  for update;

  if not found or v_quote.status = 'archived' then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;

  if v_quote.status = 'declined' then
    return jsonb_build_object(
      'ok', true, 'idempotent', true, 'quoteId', v_quote.id, 'status', 'declined'
    );
  end if;

  if public.quote_revision_is_superseded(v_quote) then
    return jsonb_build_object('ok', false, 'error', 'SUPERSEDED');
  end if;
  if public.quote_revision_is_calendar_expired(v_quote) then
    return jsonb_build_object('ok', false, 'error', 'EXPIRED');
  end if;
  if v_quote.status not in ('sent', 'viewed') then
    return jsonb_build_object('ok', false, 'error', 'INVALID_TRANSITION');
  end if;

  if v_message is not null and (char_length(v_message) > 2000 or v_message ~ '[\r]') then
    return jsonb_build_object('ok', false, 'error', 'INVALID_EVIDENCE');
  end if;

  select d.id into v_delivery_id
  from public.quote_deliveries d
  where d.access_token_id = v_token.id
    and d.org_id = v_token.org_id
  order by d.created_at desc
  limit 1;

  insert into public.quote_declines (
    org_id, project_id, quote_id, quote_number, revision_number,
    source, message, declined_at, ip_address, user_agent,
    access_token_id, delivery_id, evidence_version
  )
  values (
    v_token.org_id, v_quote.project_id, v_quote.id, v_quote.quote_number, v_quote.revision_number,
    'client', v_message, v_now,
    nullif(left(btrim(coalesce(p_ip_address, '')), 64), ''),
    nullif(left(btrim(coalesce(p_user_agent, '')), 512), ''),
    v_token.id, v_delivery_id, 'v1'
  );

  perform public.quote_apply_declined_state_v1(
    v_quote.id, v_token.org_id, 'client', null, v_now,
    jsonb_build_object('source', 'client')
  );

  return jsonb_build_object(
    'ok', true, 'idempotent', false, 'quoteId', v_quote.id, 'status', 'declined'
  );
exception
  when unique_violation then
    return jsonb_build_object(
      'ok', true, 'idempotent', true, 'quoteId', v_quote.id, 'status', 'declined'
    );
end;
$$;

-- ---------------------------------------------------------------------------
-- F. Public lookup: recipient seed + client-safe acceptance/decline summary
-- ---------------------------------------------------------------------------

create or replace function public.lookup_quote_public_by_token_hash_v1(
  p_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text := nullif(btrim(coalesce(p_token_hash, '')), '');
  v_token public.quote_access_tokens%rowtype;
  v_quote public.quotes%rowtype;
  v_items jsonb;
  v_recipient jsonb;
  v_acceptance jsonb;
  v_decline jsonb;
begin
  if v_hash is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;

  select * into v_token
  from public.quote_access_tokens
  where token_hash = v_hash
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_token.revoked_at is not null then
    return jsonb_build_object('ok', false, 'error', 'REVOKED');
  end if;
  if v_token.expires_at is not null and v_token.expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'EXPIRED');
  end if;

  select * into v_quote
  from public.quotes
  where id = v_token.quote_id and org_id = v_token.org_id;

  if not found or v_quote.status = 'archived' then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;

  if v_quote.status = 'draft' then
    if not exists (
      select 1
      from public.quote_deliveries d
      where d.access_token_id = v_token.id
        and d.org_id = v_token.org_id
        and d.status in ('accepted', 'submitted', 'delivered', 'bounced', 'complained')
    ) then
      return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
    end if;
  end if;

  select coalesce(jsonb_agg(item order by sort_order), '[]'::jsonb) into v_items
  from (
    select jsonb_build_object(
      'id', i.id,
      'label', i.label,
      'description', i.description,
      'quantity', i.quantity,
      'unit', i.unit,
      'unit_price', i.unit_price,
      'total', i.total,
      'visible', i.visible,
      'optional', i.optional,
      'sort_order', i.sort_order,
      'section_title', i.section_title,
      'section_description', i.section_description
    ) as item,
    i.sort_order
    from public.quote_items i
    where i.quote_id = v_quote.id
      and i.org_id = v_quote.org_id
  ) rows;

  select jsonb_build_object(
    'name', d.recipient_name,
    'email', d.recipient_email
  )
  into v_recipient
  from public.quote_deliveries d
  where d.access_token_id = v_token.id
    and d.org_id = v_token.org_id
  order by d.created_at desc
  limit 1;

  select jsonb_build_object(
    'source', a.source,
    'signer_name', a.signer_name,
    'accepted_at', a.accepted_at,
    'quote_number', a.quote_number,
    'revision_number', a.revision_number,
    'acceptance_declaration', a.acceptance_declaration,
    'signature_method', a.signature_method,
    'signature_value', a.signature_value,
    'accepted_total_incl_gst', a.accepted_total_incl_gst
  )
  into v_acceptance
  from public.quote_acceptances a
  where a.quote_id = v_quote.id
    and a.org_id = v_quote.org_id
    and a.source = 'client'
  limit 1;

  select jsonb_build_object(
    'source', d.source,
    'declined_at', d.declined_at
  )
  into v_decline
  from public.quote_declines d
  where d.quote_id = v_quote.id
    and d.org_id = v_quote.org_id
    and d.source = 'client'
  limit 1;

  return jsonb_build_object(
    'ok', true,
    'orgId', v_token.org_id,
    'quote', jsonb_build_object(
      'id', v_quote.id,
      'quote_number', v_quote.quote_number,
      'revision_number', v_quote.revision_number,
      'title', v_quote.title,
      'status', v_quote.status,
      'client_name', v_quote.client_name,
      'site_address', v_quote.site_address,
      'issue_date', v_quote.issue_date,
      'valid_until', v_quote.valid_until,
      'subtotal', v_quote.subtotal,
      'gst_rate', v_quote.gst_rate,
      'gst_amount', v_quote.gst_amount,
      'total_incl_gst', v_quote.total_incl_gst,
      'scope_summary', v_quote.scope_summary,
      'inclusions', v_quote.inclusions,
      'exclusions', v_quote.exclusions,
      'assumptions', v_quote.assumptions,
      'terms', v_quote.terms,
      'notes_to_client', v_quote.notes_to_client,
      'sent_at', v_quote.sent_at,
      'viewed_at', v_quote.viewed_at,
      'accepted_at', v_quote.accepted_at,
      'declined_at', v_quote.declined_at,
      'expired_at', v_quote.expired_at,
      'issuer_snapshot', v_quote.issuer_snapshot,
      'snapshot_fingerprint', v_quote.snapshot_fingerprint,
      'snapshot_fingerprint_version', v_quote.snapshot_fingerprint_version,
      'presentation_mode', v_quote.presentation_mode,
      'superseded', (v_quote.status = 'superseded' or v_quote.superseded_by_quote_id is not null)
    ),
    'items', v_items,
    'recipient', v_recipient,
    'acceptance', v_acceptance,
    'decline', v_decline
  );
end;
$$;

revoke all on function public.accept_quote_by_access_token_v1(text, text, text, text, text, text, text, text, text, text)
  from public, service_role;
revoke all on function public.decline_quote_by_access_token_v1(text, text, text, text)
  from public, service_role;
revoke all on function public.lookup_quote_public_by_token_hash_v1(text)
  from public, service_role;
revoke all on function public.accept_quote_revision_v1(uuid)
  from public, anon, service_role;
revoke all on function public.decline_quote_revision_v1(uuid)
  from public, anon, service_role;

grant execute on function public.accept_quote_by_access_token_v1(text, text, text, text, text, text, text, text, text, text)
  to anon, authenticated;
grant execute on function public.decline_quote_by_access_token_v1(text, text, text, text)
  to anon, authenticated;
grant execute on function public.lookup_quote_public_by_token_hash_v1(text)
  to anon, authenticated;
grant execute on function public.accept_quote_revision_v1(uuid) to authenticated;
grant execute on function public.decline_quote_revision_v1(uuid) to authenticated;

notify pgrst, 'reload schema';
