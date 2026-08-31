-- QUOTE-DELIVERY-01-R1
-- Secure client access tokens, delivery attempts, public lookup, first-view
-- by token, provider webhook receipts, and provider-accepted send finalisation.
--
-- Shared DB (Production + Preview). Does not change Quote money columns.
-- Does not add a public Quote status (no "sending"). Send lock is internal.
-- Canonical SENT is applied only after the delivery provider accepts the message.
-- Old Production draft edits remain allowed when send_lock_delivery_id is null.

-- ---------------------------------------------------------------------------
-- A. Access tokens (hashed at rest)
-- ---------------------------------------------------------------------------

create table if not exists public.quote_access_tokens (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists quote_access_tokens_hash_uidx
  on public.quote_access_tokens (token_hash);

create index if not exists quote_access_tokens_quote_idx
  on public.quote_access_tokens (quote_id, created_at desc);

create index if not exists quote_access_tokens_org_idx
  on public.quote_access_tokens (org_id, created_at desc);

comment on table public.quote_access_tokens is
  'Revision-specific public Quote access. Browser holds raw token; DB stores hash only.';

alter table public.quote_access_tokens enable row level security;

revoke all on table public.quote_access_tokens from public, anon, authenticated;
grant select, insert, update, delete on table public.quote_access_tokens to service_role;

-- ---------------------------------------------------------------------------
-- B. Delivery attempts (separate from Quote lifecycle)
-- ---------------------------------------------------------------------------

create table if not exists public.quote_deliveries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  access_token_id uuid references public.quote_access_tokens(id) on delete set null,
  recipient_email text not null,
  recipient_name text,
  sender_user_id uuid references auth.users(id) on delete set null,
  message text,
  provider text not null default 'resend',
  provider_message_id text,
  kind text not null default 'send'
    check (kind in ('send', 'resend')),
  snapshot_fingerprint text,
  status text not null default 'preparing'
    check (status in (
      'preparing',
      'accepted',
      'submitted',
      'delivered',
      'failed',
      'bounced',
      'complained'
    )),
  attempt_number integer not null default 1,
  idempotency_key text not null,
  submit_lease_until timestamptz,
  provider_accepted_at timestamptz,
  submitted_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  failure_code text,
  failure_message_safe text,
  created_at timestamptz not null default now()
);

create unique index if not exists quote_deliveries_idempotency_uidx
  on public.quote_deliveries (idempotency_key);

create unique index if not exists quote_deliveries_one_active_send_uidx
  on public.quote_deliveries (quote_id)
  where kind = 'send' and status in ('preparing', 'accepted');

create index if not exists quote_deliveries_quote_idx
  on public.quote_deliveries (quote_id, created_at desc);

create index if not exists quote_deliveries_org_idx
  on public.quote_deliveries (org_id, created_at desc);

create index if not exists quote_deliveries_provider_message_idx
  on public.quote_deliveries (provider, provider_message_id)
  where provider_message_id is not null;

comment on table public.quote_deliveries is
  'Email delivery attempts for an immutable Quote revision. Not Quote lifecycle.';

alter table public.quote_deliveries enable row level security;

drop policy if exists quote_deliveries_select_org on public.quote_deliveries;
create policy quote_deliveries_select_org
  on public.quote_deliveries for select
  using (org_id = public.auth_org_id());

revoke all on table public.quote_deliveries from public, anon;
revoke insert, update, delete on table public.quote_deliveries from authenticated;
grant select on table public.quote_deliveries to authenticated;
grant select, insert, update, delete on table public.quote_deliveries to service_role;

-- Internal send lock on quotes. Not a public lifecycle status.
-- Null on every existing row so current Production draft edits are unchanged.
alter table public.quotes
  add column if not exists send_lock_delivery_id uuid,
  add column if not exists send_lock_fingerprint text;

comment on column public.quotes.send_lock_delivery_id is
  'Active first-send delivery preparation. Null = draft is editable. Not a Quote status.';

comment on column public.quotes.send_lock_fingerprint is
  'Fingerprint captured when the send lock was taken. Must match finalize.';

-- ---------------------------------------------------------------------------
-- B2. Draft mutation freeze while send lock is active (expand-compatible)
-- ---------------------------------------------------------------------------

create or replace function public.prevent_quote_snapshot_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'draft' then
    if old.send_lock_delivery_id is not null
      and new.status is distinct from 'sent' then
      if new.title is distinct from old.title
        or new.client_name is distinct from old.client_name
        or new.site_address is distinct from old.site_address
        or new.issue_date is distinct from old.issue_date
        or new.valid_until is distinct from old.valid_until
        or new.subtotal is distinct from old.subtotal
        or new.gst_rate is distinct from old.gst_rate
        or new.gst_amount is distinct from old.gst_amount
        or new.total_incl_gst is distinct from old.total_incl_gst
        or new.scope_summary is distinct from old.scope_summary
        or new.inclusions is distinct from old.inclusions
        or new.exclusions is distinct from old.exclusions
        or new.assumptions is distinct from old.assumptions
        or new.terms is distinct from old.terms
        or new.notes_to_client is distinct from old.notes_to_client
        or new.presentation_mode is distinct from old.presentation_mode
        or new.quote_number is distinct from old.quote_number
        or new.revision_number is distinct from old.revision_number
        or new.parent_quote_id is distinct from old.parent_quote_id
        or new.revised_from_quote_id is distinct from old.revised_from_quote_id
        or new.issuer_snapshot is distinct from old.issuer_snapshot
        or new.snapshot_fingerprint is distinct from old.snapshot_fingerprint
        or new.snapshot_fingerprint_version is distinct from old.snapshot_fingerprint_version
      then
        raise exception 'QUOTE_TXN:SEND_IN_PROGRESS';
      end if;
    end if;
    return new;
  end if;

  if new.title is distinct from old.title
    or new.client_name is distinct from old.client_name
    or new.site_address is distinct from old.site_address
    or new.issue_date is distinct from old.issue_date
    or new.valid_until is distinct from old.valid_until
    or new.subtotal is distinct from old.subtotal
    or new.gst_rate is distinct from old.gst_rate
    or new.gst_amount is distinct from old.gst_amount
    or new.total_incl_gst is distinct from old.total_incl_gst
    or new.scope_summary is distinct from old.scope_summary
    or new.inclusions is distinct from old.inclusions
    or new.exclusions is distinct from old.exclusions
    or new.assumptions is distinct from old.assumptions
    or new.terms is distinct from old.terms
    or new.notes_to_client is distinct from old.notes_to_client
    or new.presentation_mode is distinct from old.presentation_mode
    or new.quote_number is distinct from old.quote_number
    or new.revision_number is distinct from old.revision_number
    or new.parent_quote_id is distinct from old.parent_quote_id
    or new.revised_from_quote_id is distinct from old.revised_from_quote_id
  then
    raise exception 'Quote snapshot is immutable once it is no longer a draft';
  end if;

  if old.issuer_snapshot is not null
    and new.issuer_snapshot is distinct from old.issuer_snapshot then
    raise exception 'Quote issuer snapshot is immutable once recorded';
  end if;

  if old.snapshot_fingerprint is not null
    and new.snapshot_fingerprint is distinct from old.snapshot_fingerprint then
    raise exception 'Quote snapshot fingerprint is immutable once recorded';
  end if;

  if old.snapshot_fingerprint_version is not null
    and new.snapshot_fingerprint_version is distinct from old.snapshot_fingerprint_version then
    raise exception 'Quote snapshot fingerprint version is immutable once recorded';
  end if;

  return new;
end;
$$;

create or replace function public.prevent_quote_item_snapshot_mutation()
returns trigger
language plpgsql
as $$
declare
  quote_status text;
  send_lock uuid;
  target_quote_id uuid;
begin
  target_quote_id := coalesce(new.quote_id, old.quote_id);
  select status, send_lock_delivery_id into quote_status, send_lock
  from public.quotes
  where id = target_quote_id;

  if quote_status is null or quote_status = 'draft' then
    if send_lock is not null then
      raise exception 'QUOTE_TXN:SEND_IN_PROGRESS';
    end if;
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  raise exception 'Quote items are immutable once the quote is no longer a draft';
end;
$$;

-- ---------------------------------------------------------------------------
-- C. Provider webhook receipts (idempotent)
-- ---------------------------------------------------------------------------

create table if not exists public.quote_delivery_webhook_receipts (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  provider_message_id text,
  delivery_id uuid references public.quote_deliveries(id) on delete set null,
  event_type text not null,
  payload_digest text,
  received_at timestamptz not null default now()
);

create unique index if not exists quote_delivery_webhook_receipts_uidx
  on public.quote_delivery_webhook_receipts (provider, provider_event_id);

comment on table public.quote_delivery_webhook_receipts is
  'Idempotent provider webhook receipts. Do not mutate Quote lifecycle.';

alter table public.quote_delivery_webhook_receipts enable row level security;

revoke all on table public.quote_delivery_webhook_receipts from public, anon, authenticated;
grant select, insert, update, delete on table public.quote_delivery_webhook_receipts to service_role;

-- ---------------------------------------------------------------------------
-- D. Event helper: unauthenticated nested calls may append quote_viewed only
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
  elsif p_event_type is distinct from 'quote_viewed' then
    perform public.quote_txn_fail('QUOTE_TXN:NOT_AUTHENTICATED');
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
-- E. Prepare (draft lock, not sent) → provider accept → finalize sent
-- ---------------------------------------------------------------------------

create or replace function public.quote_delivery_clear_send_lock(p_quote uuid, p_org uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.quotes
  set send_lock_delivery_id = null, send_lock_fingerprint = null
  where id = p_quote and org_id = p_org;
end;
$$;

revoke all on function public.quote_delivery_clear_send_lock(uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.prepare_quote_delivery_v1(
  p_quote_id uuid,
  p_recipient_email text,
  p_recipient_name text,
  p_message text,
  p_token_hash text,
  p_idempotency_key text,
  p_snapshot_fingerprint text,
  p_kind text default 'send'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := public.auth_org_id();
  v_quote public.quotes%rowtype;
  v_email text;
  v_name text;
  v_message text;
  v_hash text;
  v_key text;
  v_fp text;
  v_kind text;
  v_existing public.quote_deliveries%rowtype;
  v_active public.quote_deliveries%rowtype;
  v_token_id uuid;
  v_attempt integer;
  v_now timestamptz := now();
  v_lease timestamptz := now() + interval '2 minutes';
begin
  if v_uid is null or v_org is null then
    perform public.quote_txn_fail('QUOTE_TXN:NOT_AUTHENTICATED');
  end if;

  v_email := lower(btrim(coalesce(p_recipient_email, '')));
  v_name := nullif(btrim(coalesce(p_recipient_name, '')), '');
  v_message := nullif(btrim(coalesce(p_message, '')), '');
  v_hash := nullif(btrim(coalesce(p_token_hash, '')), '');
  v_key := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_fp := nullif(btrim(coalesce(p_snapshot_fingerprint, '')), '');
  v_kind := coalesce(nullif(btrim(p_kind), ''), 'send');

  if p_quote_id is null
    or v_email is null
    or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    or v_hash is null
    or v_key is null
    or v_fp is null
    or v_kind not in ('send', 'resend') then
    perform public.quote_txn_fail('QUOTE_TXN:INVALID_PAYLOAD');
  end if;

  select * into v_quote
  from public.quotes
  where id = p_quote_id and org_id = v_org
  for update;

  if not found then
    perform public.quote_txn_fail('QUOTE_TXN:NOT_FOUND');
  end if;

  if v_kind = 'send' then
    if v_quote.status is distinct from 'draft' then
      perform public.quote_txn_fail('QUOTE_TXN:INVALID_TRANSITION');
    end if;
  else
    if v_quote.status not in ('sent', 'viewed', 'accepted', 'declined', 'expired') then
      perform public.quote_txn_fail('QUOTE_TXN:INVALID_TRANSITION');
    end if;
  end if;
  if v_quote.status in ('superseded', 'archived') then
    perform public.quote_txn_fail('QUOTE_TXN:INVALID_TRANSITION');
  end if;

  if v_kind = 'send'
    and v_quote.send_lock_delivery_id is not null then
    select * into v_active
    from public.quote_deliveries
    where id = v_quote.send_lock_delivery_id and org_id = v_org
    for update;
    if found and v_active.idempotency_key is distinct from v_key then
      perform public.quote_txn_fail('QUOTE_TXN:SEND_IN_PROGRESS');
    end if;
  end if;

  select * into v_existing
  from public.quote_deliveries
  where idempotency_key = v_key
  for update;

  if found then
    if v_existing.org_id is distinct from v_org
      or v_existing.quote_id is distinct from v_quote.id then
      perform public.quote_txn_fail('QUOTE_TXN:NOT_FOUND');
    end if;

    if v_existing.status = 'accepted' then
      if v_existing.snapshot_fingerprint is distinct from v_fp then
        perform public.quote_txn_fail('QUOTE_TXN:FINGERPRINT_REQUIRED');
      end if;
      return jsonb_build_object(
        'ok', true,
        'reuse', true,
        'needsFinalize', true,
        'skipProvider', true,
        'deliveryId', v_existing.id,
        'status', v_existing.status,
        'quoteId', v_quote.id,
        'quoteStatus', v_quote.status,
        'attemptNumber', v_existing.attempt_number,
        'idempotencyKey', v_existing.idempotency_key,
        'providerMessageId', v_existing.provider_message_id
      );
    end if;

    if v_existing.status in ('submitted', 'delivered', 'bounced', 'complained') then
      return jsonb_build_object(
        'ok', true,
        'reuse', true,
        'skipProvider', true,
        'skipSubmit', true,
        'deliveryId', v_existing.id,
        'status', v_existing.status,
        'quoteId', v_quote.id,
        'quoteStatus', v_quote.status,
        'attemptNumber', v_existing.attempt_number,
        'idempotencyKey', v_existing.idempotency_key
      );
    end if;

    if v_existing.status = 'preparing'
      and v_existing.submit_lease_until is not null
      and v_existing.submit_lease_until > v_now then
      return jsonb_build_object(
        'ok', true,
        'reuse', true,
        'inProgress', true,
        'skipProvider', true,
        'deliveryId', v_existing.id,
        'status', v_existing.status,
        'quoteId', v_quote.id,
        'quoteStatus', v_quote.status,
        'attemptNumber', v_existing.attempt_number,
        'idempotencyKey', v_existing.idempotency_key
      );
    end if;

    if v_existing.status = 'preparing' then
      update public.quote_deliveries
      set
        recipient_email = v_email,
        recipient_name = v_name,
        message = v_message,
        snapshot_fingerprint = v_fp,
        submit_lease_until = v_lease
      where id = v_existing.id and org_id = v_org;

      if v_kind = 'send' then
        update public.quotes
        set send_lock_delivery_id = v_existing.id, send_lock_fingerprint = v_fp
        where id = v_quote.id and org_id = v_org and status = 'draft';
      end if;

      return jsonb_build_object(
        'ok', true,
        'reuse', true,
        'skipProvider', false,
        'deliveryId', v_existing.id,
        'status', 'preparing',
        'quoteId', v_quote.id,
        'quoteStatus', v_quote.status,
        'attemptNumber', v_existing.attempt_number,
        'idempotencyKey', v_existing.idempotency_key
      );
    end if;

    if v_existing.status = 'failed' then
      insert into public.quote_access_tokens (
        org_id, project_id, quote_id, token_hash, created_by
      )
      values (v_org, v_quote.project_id, v_quote.id, v_hash, v_uid)
      returning id into v_token_id;

      update public.quote_deliveries
      set
        access_token_id = v_token_id,
        recipient_email = v_email,
        recipient_name = v_name,
        message = v_message,
        snapshot_fingerprint = v_fp,
        kind = v_kind,
        status = 'preparing',
        submit_lease_until = v_lease,
        failed_at = null,
        failure_code = null,
        failure_message_safe = null,
        provider_message_id = null,
        provider_accepted_at = null
      where id = v_existing.id and org_id = v_org;

      if v_kind = 'send' then
        update public.quotes
        set send_lock_delivery_id = v_existing.id, send_lock_fingerprint = v_fp
        where id = v_quote.id and org_id = v_org and status = 'draft';
      end if;

      return jsonb_build_object(
        'ok', true,
        'reuse', true,
        'skipProvider', false,
        'deliveryId', v_existing.id,
        'status', 'preparing',
        'quoteId', v_quote.id,
        'quoteStatus', v_quote.status,
        'attemptNumber', v_existing.attempt_number,
        'idempotencyKey', v_existing.idempotency_key
      );
    end if;
  end if;

  select coalesce(max(attempt_number), 0) + 1 into v_attempt
  from public.quote_deliveries
  where quote_id = v_quote.id and org_id = v_org;

  insert into public.quote_access_tokens (
    org_id, project_id, quote_id, token_hash, created_by
  )
  values (v_org, v_quote.project_id, v_quote.id, v_hash, v_uid)
  returning id into v_token_id;

  begin
    insert into public.quote_deliveries (
      org_id, project_id, quote_id, access_token_id,
      recipient_email, recipient_name, sender_user_id, message,
      provider, kind, snapshot_fingerprint, status, attempt_number,
      idempotency_key, submit_lease_until
    )
    values (
      v_org, v_quote.project_id, v_quote.id, v_token_id,
      v_email, v_name, v_uid, v_message,
      'resend', v_kind, v_fp, 'preparing', v_attempt, v_key, v_lease
    )
    returning * into v_existing;
  exception
    when unique_violation then
      select * into v_existing
      from public.quote_deliveries
      where org_id = v_org
        and (
          idempotency_key = v_key
          or (
            v_kind = 'send'
            and quote_id = v_quote.id
            and kind = 'send'
            and status in ('preparing', 'accepted')
          )
        )
      order by created_at desc
      limit 1
      for update;
      if not found then
        perform public.quote_txn_fail('QUOTE_TXN:SEND_IN_PROGRESS');
      end if;
      if v_existing.idempotency_key is distinct from v_key then
        perform public.quote_txn_fail('QUOTE_TXN:SEND_IN_PROGRESS');
      end if;
      return jsonb_build_object(
        'ok', true,
        'reuse', true,
        'inProgress', v_existing.status = 'preparing'
          and v_existing.submit_lease_until is not null
          and v_existing.submit_lease_until > v_now,
        'needsFinalize', v_existing.status = 'accepted',
        'skipProvider', v_existing.status in ('accepted', 'submitted', 'delivered')
          or (
            v_existing.status = 'preparing'
            and v_existing.submit_lease_until is not null
            and v_existing.submit_lease_until > v_now
          ),
        'deliveryId', v_existing.id,
        'status', v_existing.status,
        'quoteId', v_quote.id,
        'quoteStatus', v_quote.status,
        'attemptNumber', v_existing.attempt_number,
        'idempotencyKey', v_existing.idempotency_key,
        'providerMessageId', v_existing.provider_message_id
      );
  end;

  if v_kind = 'send' then
    update public.quotes
    set send_lock_delivery_id = v_existing.id, send_lock_fingerprint = v_fp
    where id = v_quote.id and org_id = v_org and status = 'draft';
  end if;

  return jsonb_build_object(
    'ok', true,
    'reuse', false,
    'skipProvider', false,
    'deliveryId', v_existing.id,
    'status', 'preparing',
    'quoteId', v_quote.id,
    'quoteStatus', v_quote.status,
    'attemptNumber', v_existing.attempt_number,
    'idempotencyKey', v_existing.idempotency_key
  );
end;
$$;

create or replace function public.record_quote_delivery_accepted_v1(
  p_delivery_id uuid,
  p_provider_message_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := public.auth_org_id();
  v_row public.quote_deliveries%rowtype;
  v_mid text;
begin
  if v_uid is null or v_org is null then
    perform public.quote_txn_fail('QUOTE_TXN:NOT_AUTHENTICATED');
  end if;
  v_mid := nullif(btrim(coalesce(p_provider_message_id, '')), '');
  if p_delivery_id is null or v_mid is null then
    perform public.quote_txn_fail('QUOTE_TXN:INVALID_PAYLOAD');
  end if;

  select * into v_row
  from public.quote_deliveries
  where id = p_delivery_id and org_id = v_org
  for update;

  if not found then
    perform public.quote_txn_fail('QUOTE_TXN:NOT_FOUND');
  end if;

  if v_row.status in ('accepted', 'submitted', 'delivered') then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'needsFinalize', v_row.status = 'accepted',
      'deliveryId', v_row.id,
      'status', v_row.status,
      'providerMessageId', v_row.provider_message_id
    );
  end if;
  if v_row.status is distinct from 'preparing' then
    perform public.quote_txn_fail('QUOTE_TXN:INVALID_TRANSITION');
  end if;

  update public.quote_deliveries
  set
    status = 'accepted',
    provider_message_id = v_mid,
    provider_accepted_at = coalesce(provider_accepted_at, now()),
    submit_lease_until = null
  where id = v_row.id and org_id = v_org;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'needsFinalize', true,
    'deliveryId', v_row.id,
    'status', 'accepted',
    'providerMessageId', v_mid
  );
end;
$$;

create or replace function public.finalize_quote_delivery_v1(
  p_delivery_id uuid,
  p_issuer_snapshot jsonb,
  p_snapshot_fingerprint text,
  p_fingerprint_version text default 'v1'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := public.auth_org_id();
  v_row public.quote_deliveries%rowtype;
  v_quote public.quotes%rowtype;
  v_fp text;
  v_sent jsonb;
begin
  if v_uid is null or v_org is null then
    perform public.quote_txn_fail('QUOTE_TXN:NOT_AUTHENTICATED');
  end if;
  v_fp := nullif(btrim(coalesce(p_snapshot_fingerprint, '')), '');
  if p_delivery_id is null or v_fp is null then
    perform public.quote_txn_fail('QUOTE_TXN:INVALID_PAYLOAD');
  end if;

  select * into v_row
  from public.quote_deliveries
  where id = p_delivery_id and org_id = v_org
  for update;

  if not found then
    perform public.quote_txn_fail('QUOTE_TXN:NOT_FOUND');
  end if;
  if v_row.provider_message_id is null then
    perform public.quote_txn_fail('QUOTE_TXN:INVALID_PAYLOAD');
  end if;
  if v_row.snapshot_fingerprint is distinct from v_fp then
    perform public.quote_txn_fail('QUOTE_TXN:FINGERPRINT_REQUIRED');
  end if;

  select * into v_quote
  from public.quotes
  where id = v_row.quote_id and org_id = v_org
  for update;

  if not found then
    perform public.quote_txn_fail('QUOTE_TXN:NOT_FOUND');
  end if;

  if v_row.status in ('submitted', 'delivered', 'bounced', 'complained') then
    if v_quote.status = 'draft' then
      if v_row.kind is distinct from 'send' then
        perform public.quote_txn_fail('QUOTE_TXN:INVALID_TRANSITION');
      end if;
      v_sent := public.send_quote_revision_v1(
        v_quote.id,
        p_issuer_snapshot,
        v_fp,
        coalesce(nullif(btrim(p_fingerprint_version), ''), 'v1')
      );
    end if;
    perform public.quote_delivery_clear_send_lock(v_quote.id, v_org);
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'deliveryId', v_row.id,
      'status', v_row.status,
      'quoteId', v_quote.id,
      'quoteStatus', case
        when v_quote.status = 'draft' then 'sent'
        else v_quote.status
      end
    );
  end if;

  if v_row.status is distinct from 'accepted' then
    perform public.quote_txn_fail('QUOTE_TXN:INVALID_TRANSITION');
  end if;

  if v_quote.status = 'draft' then
    if v_row.kind is distinct from 'send' then
      perform public.quote_txn_fail('QUOTE_TXN:INVALID_TRANSITION');
    end if;
    if v_quote.send_lock_fingerprint is distinct from v_fp then
      perform public.quote_txn_fail('QUOTE_TXN:FINGERPRINT_REQUIRED');
    end if;
    v_sent := public.send_quote_revision_v1(
      v_quote.id,
      p_issuer_snapshot,
      v_fp,
      coalesce(nullif(btrim(p_fingerprint_version), ''), 'v1')
    );
  end if;

  update public.quote_deliveries
  set
    status = 'submitted',
    submitted_at = coalesce(submitted_at, now()),
    submit_lease_until = null
  where id = v_row.id and org_id = v_org;

  perform public.quote_delivery_clear_send_lock(v_quote.id, v_org);

  return jsonb_build_object(
    'ok', true,
    'idempotent', coalesce((v_sent->>'idempotent')::boolean, v_quote.status is distinct from 'draft'),
    'deliveryId', v_row.id,
    'status', 'submitted',
    'quoteId', v_quote.id,
    'quoteStatus', case
      when v_quote.status = 'draft' then 'sent'
      else v_quote.status
    end
  );
end;
$$;

create or replace function public.fail_quote_delivery_v1(
  p_delivery_id uuid,
  p_failure_code text,
  p_failure_message_safe text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := public.auth_org_id();
  v_row public.quote_deliveries%rowtype;
begin
  if v_uid is null or v_org is null then
    perform public.quote_txn_fail('QUOTE_TXN:NOT_AUTHENTICATED');
  end if;
  if p_delivery_id is null then
    perform public.quote_txn_fail('QUOTE_TXN:INVALID_PAYLOAD');
  end if;

  select * into v_row
  from public.quote_deliveries
  where id = p_delivery_id and org_id = v_org
  for update;

  if not found then
    perform public.quote_txn_fail('QUOTE_TXN:NOT_FOUND');
  end if;

  if v_row.status in ('submitted', 'delivered') then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'deliveryId', v_row.id,
      'status', v_row.status
    );
  end if;

  -- Provider already accepted: do not fail/release. Retry finalisation only.
  if v_row.status = 'accepted' then
    return jsonb_build_object(
      'ok', true,
      'needsFinalize', true,
      'deliveryId', v_row.id,
      'status', v_row.status,
      'providerMessageId', v_row.provider_message_id
    );
  end if;

  update public.quote_deliveries
  set
    status = 'failed',
    failed_at = now(),
    submit_lease_until = null,
    failure_code = left(coalesce(nullif(btrim(p_failure_code), ''), 'provider_error'), 80),
    failure_message_safe = left(
      coalesce(nullif(btrim(p_failure_message_safe), ''), 'Quote email could not be sent. Please try again.'),
      240
    )
  where id = v_row.id and org_id = v_org;

  if v_row.kind = 'send' then
    perform public.quote_delivery_clear_send_lock(v_row.quote_id, v_org);
  end if;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'deliveryId', v_row.id,
    'status', 'failed'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- F. Public token lookup + first client-page view
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

  -- Email can arrive before canonical SENT. Allow the prepared snapshot only
  -- after the provider has accepted this token's delivery.
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

  return jsonb_build_object(
    'ok', true,
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
    'items', v_items
  );
end;
$$;

create or replace function public.mark_quote_viewed_by_access_token_v1(
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
  v_now timestamptz := now();
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
    return jsonb_build_object('ok', false, 'error', 'EXPIRED');
  end if;

  select * into v_quote
  from public.quotes
  where id = v_token.quote_id and org_id = v_token.org_id
  for update;

  if not found or v_quote.status in ('draft', 'archived') then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;

  if v_quote.status = 'viewed' or v_quote.viewed_at is not null then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'quoteId', v_quote.id,
      'status', v_quote.status
    );
  end if;

  if v_quote.status is distinct from 'sent' then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'quoteId', v_quote.id,
      'status', v_quote.status
    );
  end if;

  update public.quotes
  set status = 'viewed', viewed_at = v_now
  where id = v_quote.id and org_id = v_token.org_id and status = 'sent';

  perform public.quote_txn_append_event(
    v_token.org_id,
    v_quote.project_id,
    v_quote.id,
    'quote_viewed',
    'client',
    null,
    jsonb_build_object('first_view', true, 'kind', 'client_page_view')
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'quoteId', v_quote.id,
    'status', 'viewed'
  );
end;
$$;

drop function if exists public.complete_quote_delivery_submit_v1(uuid, text);

revoke all on function public.prepare_quote_delivery_v1(uuid, text, text, text, text, text, text, text)
  from public, anon, service_role;
revoke all on function public.record_quote_delivery_accepted_v1(uuid, text)
  from public, anon, service_role;
revoke all on function public.finalize_quote_delivery_v1(uuid, jsonb, text, text)
  from public, anon, service_role;
revoke all on function public.fail_quote_delivery_v1(uuid, text, text)
  from public, anon, service_role;
revoke all on function public.lookup_quote_public_by_token_hash_v1(text)
  from public, service_role;
revoke all on function public.mark_quote_viewed_by_access_token_v1(text)
  from public, service_role;

grant execute on function public.prepare_quote_delivery_v1(uuid, text, text, text, text, text, text, text)
  to authenticated;
grant execute on function public.record_quote_delivery_accepted_v1(uuid, text)
  to authenticated;
grant execute on function public.finalize_quote_delivery_v1(uuid, jsonb, text, text)
  to authenticated;
grant execute on function public.fail_quote_delivery_v1(uuid, text, text)
  to authenticated;
grant execute on function public.lookup_quote_public_by_token_hash_v1(text)
  to anon, authenticated;
grant execute on function public.mark_quote_viewed_by_access_token_v1(text)
  to anon, authenticated;
