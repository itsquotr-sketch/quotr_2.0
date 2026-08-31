-- QUOTE-TRANSACTION-01-R1: immutable revisions, superseded status, atomic RPCs.
-- Shared DB (Preview + Production). Does not rewrite quote money.
-- quotes row remains the revision. parent_quote_id is the thread root.
--
-- SHARED-DB COMPATIBILITY (current Production app does not have this code):
-- Production may still: create/edit draft, edit draft items, presentation_mode,
-- mark sent/accepted/declined/expired, revise by inserting a new draft then
-- setting superseded_by_quote_id on the source.
-- Freeze triggers allow those Production writes (draft mutations; lifecycle
-- columns after send). Production never writes status='revised'.
-- One-open-draft unique index is INTENTIONALLY OMITTED: Production
-- Update-from-Pricing inserts a new draft BEFORE superseding the previous
-- draft, which would violate that index. New-app concurrency uses advisory
-- locks inside RPCs instead.

-- ---------------------------------------------------------------------------
-- A. Status vocabulary: revised → superseded. Add viewed.
-- ---------------------------------------------------------------------------

update public.quotes
set status = 'superseded'
where status = 'revised';

do $$
declare
  rec record;
begin
  for rec in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.quotes'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%draft%'
      and pg_get_constraintdef(con.oid) ilike '%sent%'
      and pg_get_constraintdef(con.oid) ilike '%archived%'
  loop
    execute format('alter table public.quotes drop constraint %I', rec.conname);
  end loop;
end $$;

alter table public.quotes
  add constraint quotes_status_check
  check (
    status in (
      'draft',
      'sent',
      'viewed',
      'accepted',
      'declined',
      'expired',
      'superseded',
      'archived'
    )
  );

-- ---------------------------------------------------------------------------
-- B. Additive evidence columns
-- ---------------------------------------------------------------------------

alter table public.quotes
  add column if not exists viewed_at timestamptz,
  add column if not exists issuer_snapshot jsonb,
  add column if not exists snapshot_fingerprint text,
  add column if not exists snapshot_fingerprint_version text;

comment on column public.quotes.viewed_at is
  'First recorded view. Repeated views must not rewrite this.';
comment on column public.quotes.issuer_snapshot is
  'Company details frozen at send, or migration-derived current org copy (source field).';
comment on column public.quotes.snapshot_fingerprint is
  'SHA-256 of canonical client snapshot at send. Evidence only — not a security control.';
comment on column public.quotes.snapshot_fingerprint_version is
  'Fingerprint payload version (currently v1).';

create unique index if not exists quotes_org_number_revision_uidx
  on public.quotes (org_id, quote_number, revision_number)
  where quote_number is not null;

-- Quote number allocator (durable, not max+1 in the app).
create table if not exists public.organisation_quote_counters (
  org_id uuid primary key references public.organisations (id) on delete cascade,
  last_value integer not null default 0 check (last_value >= 0)
);

alter table public.organisation_quote_counters enable row level security;

create policy "Users can select quote counters in their organisation"
  on public.organisation_quote_counters for select
  using (org_id = public.auth_org_id());

create policy "Users can insert quote counters in their organisation"
  on public.organisation_quote_counters for insert
  with check (org_id = public.auth_org_id());

create policy "Users can update quote counters in their organisation"
  on public.organisation_quote_counters for update
  using (org_id = public.auth_org_id())
  with check (org_id = public.auth_org_id());

grant select, insert, update on public.organisation_quote_counters to authenticated;
grant select, insert, update on public.organisation_quote_counters to service_role;

insert into public.organisation_quote_counters (org_id, last_value)
select
  q.org_id,
  coalesce(
    max(
      nullif(substring(q.quote_number from '^Q-([0-9]+)$'), '')::integer
    ),
    0
  )
from public.quotes q
where q.quote_number is not null
group by q.org_id
on conflict (org_id) do nothing;

-- ---------------------------------------------------------------------------
-- C. Freeze client snapshot after send. Lifecycle columns remain writable.
-- ---------------------------------------------------------------------------
-- Frozen after non-draft:
--   title, client_name, site_address, issue_date, valid_until,
--   subtotal, gst_rate, gst_amount, total_incl_gst,
--   scope_summary, inclusions, exclusions, assumptions, terms, notes_to_client,
--   presentation_mode, quote_number, revision_number, parent_quote_id,
--   revised_from_quote_id,
--   issuer_snapshot once set, snapshot_fingerprint once set,
--   snapshot_fingerprint_version once set
-- Allowed after non-draft:
--   status, sent_at, viewed_at, accepted_at, declined_at, expired_at,
--   superseded_by_quote_id, superseded_at, updated_at,
--   issuer_snapshot null→value, snapshot_fingerprint null→value,
--   snapshot_fingerprint_version null→value,
--   pricing_document_id, estimate_id, revision_note, created_by

create or replace function public.prevent_quote_snapshot_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'draft' then
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

drop trigger if exists quotes_protect_snapshot on public.quotes;
create trigger quotes_protect_snapshot
  before update on public.quotes
  for each row
  execute function public.prevent_quote_snapshot_mutation();

create or replace function public.prevent_quote_item_snapshot_mutation()
returns trigger
language plpgsql
as $$
declare
  quote_status text;
  target_quote_id uuid;
begin
  target_quote_id := coalesce(new.quote_id, old.quote_id);
  select status into quote_status
  from public.quotes
  where id = target_quote_id;

  if quote_status is null or quote_status = 'draft' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  raise exception 'Quote items are immutable once the quote is no longer a draft';
end;
$$;

drop trigger if exists quote_items_protect_snapshot on public.quote_items;
create trigger quote_items_protect_snapshot
  before insert or update or delete on public.quote_items
  for each row
  execute function public.prevent_quote_item_snapshot_mutation();

-- ---------------------------------------------------------------------------
-- D. Append-only quote_events + one-shot uniqueness
-- ---------------------------------------------------------------------------

create table if not exists public.quote_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  quote_id uuid not null references public.quotes (id) on delete cascade,
  event_type text not null
    check (
      event_type in (
        'quote_created',
        'quote_updated',
        'quote_revision_created',
        'quote_sent',
        'quote_viewed',
        'quote_accepted',
        'quote_declined',
        'quote_expired',
        'quote_superseded',
        'quote_archived'
      )
    ),
  actor_type text not null
    check (actor_type in ('user', 'client', 'system')),
  actor_user_id uuid references public.profiles (id) on delete set null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists quote_events_quote_occurred_idx
  on public.quote_events (quote_id, occurred_at desc);

create index if not exists quote_events_org_occurred_idx
  on public.quote_events (org_id, occurred_at desc);

create index if not exists quote_events_project_idx
  on public.quote_events (project_id, occurred_at desc);

create unique index if not exists quote_events_one_shot_uidx
  on public.quote_events (quote_id, event_type)
  where event_type in (
    'quote_created',
    'quote_revision_created',
    'quote_sent',
    'quote_viewed',
    'quote_accepted',
    'quote_declined',
    'quote_expired',
    'quote_superseded',
    'quote_archived'
  );

comment on table public.quote_events is
  'Append-only Quote transaction history. Canonical state stays on quotes. quote_updated may repeat.';

create or replace function public.enforce_quote_events_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'quote_events are append-only';
end;
$$;

drop trigger if exists quote_events_no_update on public.quote_events;
create trigger quote_events_no_update
  before update on public.quote_events
  for each row
  execute function public.enforce_quote_events_append_only();

drop trigger if exists quote_events_no_delete on public.quote_events;
create trigger quote_events_no_delete
  before delete on public.quote_events
  for each row
  execute function public.enforce_quote_events_append_only();

alter table public.quote_events enable row level security;

create policy "Users can select quote events in their organisation"
  on public.quote_events for select
  using (org_id = public.auth_org_id());

-- No INSERT/UPDATE/DELETE policies for authenticated.
-- Canonical lifecycle events are written only by SECURITY DEFINER RPCs.
-- Future delivery/public acceptance must append through dedicated RPCs too.

grant select on public.quote_events to authenticated;
grant select, insert, update, delete on public.quote_events to service_role;

-- ---------------------------------------------------------------------------
-- E. Transaction helpers + RPCs
-- Helpers are SECURITY DEFINER and NOT granted to authenticated.
-- Domain RPCs are SECURITY DEFINER so they can append events without a
-- user INSERT privilege. Tenant scope is still auth.uid() / auth_org_id().
-- Future: quotes.send and quotes.acceptance are Builder+Business capabilities.
-- Do not encode plan names here.
-- ---------------------------------------------------------------------------

create or replace function public.quote_txn_fail(p_code text)
returns void
language plpgsql
as $$
begin
  raise exception '%', p_code using errcode = 'P0001';
end;
$$;

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
  if v_org is null or p_org is distinct from v_org then
    perform public.quote_txn_fail('QUOTE_TXN:NOT_AUTHENTICATED');
  end if;
  if p_event_type is null or p_actor_type is null then
    perform public.quote_txn_fail('QUOTE_TXN:INVALID_PAYLOAD');
  end if;
  if not exists (
    select 1
    from public.quotes
    where id = p_quote
      and org_id = v_org
      and project_id = p_project
  ) then
    perform public.quote_txn_fail('QUOTE_TXN:NOT_FOUND');
  end if;

  insert into public.quote_events (
    org_id, project_id, quote_id, event_type, actor_type, actor_user_id, metadata
  )
  values (
    v_org, p_project, p_quote, p_event_type, p_actor_type, p_actor,
    coalesce(p_metadata, '{}'::jsonb)
  );
exception
  when unique_violation then
    null;
end;
$$;

create or replace function public.allocate_org_quote_number_v1()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := public.auth_org_id();
  v_next integer;
  v_max integer;
begin
  if v_uid is null or v_org is null then
    perform public.quote_txn_fail('QUOTE_TXN:NOT_AUTHENTICATED');
  end if;

  insert into public.organisation_quote_counters (org_id, last_value)
  values (v_org, 0)
  on conflict (org_id) do nothing;

  perform pg_advisory_xact_lock(87240142, hashtext(v_org::text));

  select coalesce(
    max(nullif(substring(quote_number from '^Q-([0-9]+)$'), '')::integer),
    0
  )
  into v_max
  from public.quotes
  where org_id = v_org
    and quote_number is not null;

  update public.organisation_quote_counters
  set last_value = greatest(last_value, v_max) + 1
  where org_id = v_org
  returning last_value into v_next;

  if v_next is null then
    perform public.quote_txn_fail('QUOTE_TXN:NOT_AUTHENTICATED');
  end if;

  return 'Q-' || lpad(v_next::text, 4, '0');
end;
$$;

create or replace function public.quote_txn_insert_items(
  p_org uuid,
  p_project uuid,
  p_quote uuid,
  p_items jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_org uuid := public.auth_org_id();
begin
  if v_org is null or p_org is distinct from v_org then
    perform public.quote_txn_fail('QUOTE_TXN:NOT_AUTHENTICATED');
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    perform public.quote_txn_fail('QUOTE_TXN:INVALID_PAYLOAD');
  end if;
  if not exists (
    select 1
    from public.quotes
    where id = p_quote
      and org_id = v_org
      and project_id = p_project
  ) then
    perform public.quote_txn_fail('QUOTE_TXN:NOT_FOUND');
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    insert into public.quote_items (
      org_id, quote_id, project_id, pricing_item_id, work_area_id,
      section_title, section_description, label, description, quantity, unit,
      unit_price, total, visible, optional, sort_order
    )
    values (
      v_org,
      p_quote,
      p_project,
      nullif(v_item->>'pricing_item_id', '')::uuid,
      nullif(v_item->>'work_area_id', '')::uuid,
      v_item->>'section_title',
      v_item->>'section_description',
      coalesce(v_item->>'label', ''),
      v_item->>'description',
      nullif(v_item->>'quantity', '')::numeric,
      v_item->>'unit',
      nullif(v_item->>'unit_price', '')::numeric,
      coalesce(nullif(v_item->>'total', '')::numeric, 0),
      coalesce((v_item->>'visible')::boolean, true),
      coalesce((v_item->>'optional')::boolean, false),
      coalesce(nullif(v_item->>'sort_order', '')::integer, 0)
    );
  end loop;
end;
$$;

create or replace function public.send_quote_revision_v1(
  p_quote_id uuid,
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
  v_quote public.quotes%rowtype;
  v_root uuid;
  v_number text;
  v_now timestamptz := now();
  v_prior record;
  v_superseded uuid[] := '{}';
  v_idempotent boolean := false;
begin
  if v_uid is null or v_org is null then
    perform public.quote_txn_fail('QUOTE_TXN:NOT_AUTHENTICATED');
  end if;
  if p_quote_id is null then
    perform public.quote_txn_fail('QUOTE_TXN:INVALID_PAYLOAD');
  end if;
  if p_issuer_snapshot is null or jsonb_typeof(p_issuer_snapshot) <> 'object' then
    perform public.quote_txn_fail('QUOTE_TXN:ISSUER_REQUIRED');
  end if;
  if nullif(btrim(p_snapshot_fingerprint), '') is null then
    perform public.quote_txn_fail('QUOTE_TXN:FINGERPRINT_REQUIRED');
  end if;

  select * into v_quote
  from public.quotes
  where id = p_quote_id
    and org_id = v_org
  for update;

  if not found then
    perform public.quote_txn_fail('QUOTE_TXN:NOT_FOUND');
  end if;

  if v_quote.status = 'sent' then
    v_idempotent := true;
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'quoteId', v_quote.id,
      'status', v_quote.status,
      'quoteNumber', v_quote.quote_number
    );
  end if;

  if v_quote.status is distinct from 'draft' then
    perform public.quote_txn_fail('QUOTE_TXN:INVALID_TRANSITION');
  end if;

  v_root := coalesce(v_quote.parent_quote_id, v_quote.id);
  perform pg_advisory_xact_lock(
    87240141,
    hashtext(v_org::text || ':' || v_root::text)
  );

  v_number := coalesce(v_quote.quote_number, public.allocate_org_quote_number_v1());

  update public.quotes
  set
    status = 'sent',
    sent_at = v_now,
    quote_number = v_number,
    issuer_snapshot = p_issuer_snapshot,
    snapshot_fingerprint = p_snapshot_fingerprint,
    snapshot_fingerprint_version = coalesce(nullif(btrim(p_fingerprint_version), ''), 'v1')
  where id = v_quote.id
    and org_id = v_org
    and status = 'draft';

  if not found then
    perform public.quote_txn_fail('QUOTE_TXN:INVALID_TRANSITION');
  end if;

  for v_prior in
    select id
    from public.quotes
    where org_id = v_org
      and project_id = v_quote.project_id
      and id <> v_quote.id
      and (id = v_root or parent_quote_id = v_root)
      and status in ('sent', 'viewed')
    for update
  loop
    update public.quotes
    set
      status = 'superseded',
      superseded_by_quote_id = v_quote.id,
      superseded_at = v_now
    where id = v_prior.id
      and org_id = v_org
      and status in ('sent', 'viewed');

    perform public.quote_txn_append_event(
      v_org, v_quote.project_id, v_prior.id, 'quote_superseded', 'user', v_uid,
      jsonb_build_object('superseded_by_quote_id', v_quote.id)
    );
    v_superseded := array_append(v_superseded, v_prior.id);
  end loop;

  perform public.quote_txn_append_event(
    v_org, v_quote.project_id, v_quote.id, 'quote_sent', 'user', v_uid, '{}'::jsonb
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', v_idempotent,
    'quoteId', v_quote.id,
    'status', 'sent',
    'quoteNumber', v_number,
    'supersededQuoteIds', to_jsonb(v_superseded)
  );
end;
$$;

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

  update public.quotes
  set status = 'accepted', accepted_at = v_now
  where id = v_quote.id and org_id = v_org and status in ('sent', 'viewed');

  perform public.quote_txn_append_event(
    v_org, v_quote.project_id, v_quote.id, 'quote_accepted', 'user', v_uid, '{}'::jsonb
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

  update public.quotes
  set status = 'declined', declined_at = v_now
  where id = v_quote.id and org_id = v_org and status in ('sent', 'viewed');

  perform public.quote_txn_append_event(
    v_org, v_quote.project_id, v_quote.id, 'quote_declined', 'user', v_uid, '{}'::jsonb
  );

  return jsonb_build_object('ok', true, 'idempotent', false, 'quoteId', v_quote.id, 'status', 'declined');
end;
$$;

create or replace function public.expire_quote_revision_v1(p_quote_id uuid)
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

  if v_quote.status = 'expired' then
    return jsonb_build_object('ok', true, 'idempotent', true, 'quoteId', v_quote.id, 'status', 'expired');
  end if;
  if v_quote.status not in ('sent', 'viewed') then
    perform public.quote_txn_fail('QUOTE_TXN:INVALID_TRANSITION');
  end if;

  update public.quotes
  set status = 'expired', expired_at = v_now
  where id = v_quote.id and org_id = v_org and status in ('sent', 'viewed');

  perform public.quote_txn_append_event(
    v_org, v_quote.project_id, v_quote.id, 'quote_expired', 'user', v_uid, '{}'::jsonb
  );

  return jsonb_build_object('ok', true, 'idempotent', false, 'quoteId', v_quote.id, 'status', 'expired');
end;
$$;

create or replace function public.mark_quote_viewed_v1(
  p_quote_id uuid,
  p_actor_type text default 'user'
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
  v_now timestamptz := now();
  v_actor text := coalesce(nullif(btrim(p_actor_type), ''), 'user');
begin
  if v_uid is null or v_org is null then
    perform public.quote_txn_fail('QUOTE_TXN:NOT_AUTHENTICATED');
  end if;
  if v_actor not in ('user', 'client', 'system') then
    perform public.quote_txn_fail('QUOTE_TXN:INVALID_PAYLOAD');
  end if;

  select * into v_quote
  from public.quotes
  where id = p_quote_id and org_id = v_org
  for update;

  if not found then
    perform public.quote_txn_fail('QUOTE_TXN:NOT_FOUND');
  end if;

  if v_quote.status = 'viewed' or v_quote.viewed_at is not null then
    return jsonb_build_object('ok', true, 'idempotent', true, 'quoteId', v_quote.id, 'status', v_quote.status);
  end if;
  if v_quote.status is distinct from 'sent' then
    perform public.quote_txn_fail('QUOTE_TXN:INVALID_TRANSITION');
  end if;

  update public.quotes
  set status = 'viewed', viewed_at = v_now
  where id = v_quote.id and org_id = v_org and status = 'sent';

  perform public.quote_txn_append_event(
    v_org, v_quote.project_id, v_quote.id, 'quote_viewed', v_actor, v_uid,
    jsonb_build_object('first_view', true)
  );

  return jsonb_build_object('ok', true, 'idempotent', false, 'quoteId', v_quote.id, 'status', 'viewed');
end;
$$;

create or replace function public.create_quote_revision_v1(
  p_source_quote_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := public.auth_org_id();
  v_source public.quotes%rowtype;
  v_root uuid;
  v_open uuid;
  v_next integer;
  v_new uuid;
  v_fields jsonb;
  v_items jsonb;
begin
  if v_uid is null or v_org is null then
    perform public.quote_txn_fail('QUOTE_TXN:NOT_AUTHENTICATED');
  end if;
  if p_source_quote_id is null or p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    perform public.quote_txn_fail('QUOTE_TXN:INVALID_PAYLOAD');
  end if;

  v_fields := p_payload->'quote';
  v_items := coalesce(p_payload->'items', '[]'::jsonb);
  if v_fields is null or jsonb_typeof(v_fields) <> 'object' then
    perform public.quote_txn_fail('QUOTE_TXN:INVALID_PAYLOAD');
  end if;

  select * into v_source
  from public.quotes
  where id = p_source_quote_id and org_id = v_org
  for update;

  if not found then
    perform public.quote_txn_fail('QUOTE_TXN:NOT_FOUND');
  end if;
  if v_source.status = 'draft' then
    perform public.quote_txn_fail('QUOTE_TXN:INVALID_TRANSITION');
  end if;
  if v_source.status in ('archived', 'superseded')
    or v_source.superseded_by_quote_id is not null then
    perform public.quote_txn_fail('QUOTE_TXN:INVALID_TRANSITION');
  end if;

  v_root := coalesce(v_source.parent_quote_id, v_source.id);
  perform pg_advisory_xact_lock(
    87240141,
    hashtext(v_org::text || ':' || v_root::text)
  );

  select id into v_open
  from public.quotes
  where org_id = v_org
    and project_id = v_source.project_id
    and status = 'draft'
    and superseded_by_quote_id is null
    and (id = v_root or parent_quote_id = v_root)
  for update
  limit 1;

  if v_open is not null then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'quoteId', v_open,
      'status', 'draft'
    );
  end if;

  select coalesce(max(revision_number), v_source.revision_number) + 1
    into v_next
  from public.quotes
  where org_id = v_org
    and project_id = v_source.project_id
    and (id = v_root or parent_quote_id = v_root);

  insert into public.quotes (
    org_id, project_id, pricing_document_id, estimate_id, quote_number, title,
    status, client_name, site_address, issue_date, valid_until, subtotal,
    gst_rate, gst_amount, total_incl_gst, scope_summary, inclusions, exclusions,
    assumptions, terms, notes_to_client, created_by, revision_number,
    parent_quote_id, revised_from_quote_id, revision_note, presentation_mode
  )
  values (
    v_org,
    v_source.project_id,
    coalesce(nullif(v_fields->>'pricing_document_id', '')::uuid, v_source.pricing_document_id),
    coalesce(nullif(v_fields->>'estimate_id', '')::uuid, v_source.estimate_id),
    v_source.quote_number,
    coalesce(v_fields->>'title', v_source.title),
    'draft',
    coalesce(v_fields->>'client_name', v_source.client_name),
    coalesce(v_fields->>'site_address', v_source.site_address),
    coalesce(nullif(v_fields->>'issue_date', '')::date, v_source.issue_date),
    coalesce(nullif(v_fields->>'valid_until', '')::date, v_source.valid_until),
    coalesce(nullif(v_fields->>'subtotal', '')::numeric, v_source.subtotal),
    coalesce(nullif(v_fields->>'gst_rate', '')::numeric, v_source.gst_rate),
    coalesce(nullif(v_fields->>'gst_amount', '')::numeric, v_source.gst_amount),
    coalesce(nullif(v_fields->>'total_incl_gst', '')::numeric, v_source.total_incl_gst),
    coalesce(v_fields->>'scope_summary', v_source.scope_summary),
    coalesce(v_fields->'inclusions', to_jsonb(v_source.inclusions)),
    coalesce(v_fields->'exclusions', to_jsonb(v_source.exclusions)),
    coalesce(v_fields->'assumptions', to_jsonb(v_source.assumptions)),
    coalesce(v_fields->>'terms', v_source.terms),
    coalesce(v_fields->>'notes_to_client', v_source.notes_to_client),
    v_uid,
    v_next,
    v_root,
    v_source.id,
    coalesce(p_payload->>'revisionNote', v_fields->>'revision_note'),
    coalesce(v_fields->>'presentation_mode', v_source.presentation_mode, 'grouped')
  )
  returning id into v_new;

  perform public.quote_txn_insert_items(v_org, v_source.project_id, v_new, v_items);
  perform public.quote_txn_append_event(
    v_org, v_source.project_id, v_new, 'quote_revision_created', 'user', v_uid,
    jsonb_build_object(
      'revised_from_quote_id', v_source.id,
      'revision_number', v_next
    )
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'quoteId', v_new,
    'status', 'draft',
    'revisionNumber', v_next
  );
end;
$$;

create or replace function public.insert_draft_quote_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := public.auth_org_id();
  v_project uuid;
  v_fields jsonb;
  v_items jsonb;
  v_new uuid;
  v_number text;
begin
  if v_uid is null or v_org is null then
    perform public.quote_txn_fail('QUOTE_TXN:NOT_AUTHENTICATED');
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    perform public.quote_txn_fail('QUOTE_TXN:INVALID_PAYLOAD');
  end if;

  begin
    v_project := (p_payload->>'projectId')::uuid;
  exception
    when invalid_text_representation then
      perform public.quote_txn_fail('QUOTE_TXN:INVALID_PAYLOAD');
  end;

  v_fields := p_payload->'quote';
  v_items := coalesce(p_payload->'items', '[]'::jsonb);
  if v_project is null or v_fields is null or jsonb_typeof(v_fields) <> 'object' then
    perform public.quote_txn_fail('QUOTE_TXN:INVALID_PAYLOAD');
  end if;

  if not exists (
    select 1 from public.projects
    where id = v_project and org_id = v_org and deleted_at is null
  ) then
    perform public.quote_txn_fail('QUOTE_TXN:NOT_FOUND');
  end if;

  v_number := public.allocate_org_quote_number_v1();

  insert into public.quotes (
    org_id, project_id, pricing_document_id, estimate_id, quote_number, title,
    status, client_name, site_address, issue_date, valid_until, subtotal,
    gst_rate, gst_amount, total_incl_gst, scope_summary, inclusions, exclusions,
    assumptions, terms, notes_to_client, created_by, presentation_mode
  )
  values (
    v_org,
    v_project,
    nullif(v_fields->>'pricing_document_id', '')::uuid,
    nullif(v_fields->>'estimate_id', '')::uuid,
    v_number,
    coalesce(v_fields->>'title', 'Quote'),
    'draft',
    v_fields->>'client_name',
    v_fields->>'site_address',
    nullif(v_fields->>'issue_date', '')::date,
    nullif(v_fields->>'valid_until', '')::date,
    coalesce(nullif(v_fields->>'subtotal', '')::numeric, 0),
    coalesce(nullif(v_fields->>'gst_rate', '')::numeric, 15),
    coalesce(nullif(v_fields->>'gst_amount', '')::numeric, 0),
    coalesce(nullif(v_fields->>'total_incl_gst', '')::numeric, 0),
    v_fields->>'scope_summary',
    coalesce(v_fields->'inclusions', '[]'::jsonb),
    coalesce(v_fields->'exclusions', '[]'::jsonb),
    coalesce(v_fields->'assumptions', '[]'::jsonb),
    v_fields->>'terms',
    v_fields->>'notes_to_client',
    v_uid,
    coalesce(v_fields->>'presentation_mode', 'grouped')
  )
  returning id into v_new;

  perform public.quote_txn_insert_items(v_org, v_project, v_new, v_items);
  perform public.quote_txn_append_event(
    v_org, v_project, v_new, 'quote_created', 'user', v_uid, '{}'::jsonb
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'quoteId', v_new,
    'status', 'draft',
    'quoteNumber', v_number
  );
end;
$$;

create or replace function public.append_quote_updated_v1(
  p_quote_id uuid,
  p_metadata jsonb default '{}'::jsonb
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
begin
  if v_uid is null or v_org is null then
    perform public.quote_txn_fail('QUOTE_TXN:NOT_AUTHENTICATED');
  end if;
  if p_quote_id is null then
    perform public.quote_txn_fail('QUOTE_TXN:INVALID_PAYLOAD');
  end if;

  select * into v_quote
  from public.quotes
  where id = p_quote_id and org_id = v_org
  for update;

  if not found then
    perform public.quote_txn_fail('QUOTE_TXN:NOT_FOUND');
  end if;
  if v_quote.status is distinct from 'draft' then
    perform public.quote_txn_fail('QUOTE_TXN:INVALID_TRANSITION');
  end if;

  perform public.quote_txn_append_event(
    v_org, v_quote.project_id, v_quote.id, 'quote_updated', 'user', v_uid,
    coalesce(p_metadata, '{}'::jsonb)
  );

  return jsonb_build_object('ok', true, 'idempotent', false, 'quoteId', v_quote.id, 'status', 'draft');
end;
$$;

revoke all on function public.quote_txn_fail(text) from public, anon, authenticated, service_role;
revoke all on function public.quote_txn_append_event(uuid, uuid, uuid, text, text, uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.quote_txn_insert_items(uuid, uuid, uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.allocate_org_quote_number_v1() from public, anon, service_role;
revoke all on function public.send_quote_revision_v1(uuid, jsonb, text, text) from public, anon, service_role;
revoke all on function public.accept_quote_revision_v1(uuid) from public, anon, service_role;
revoke all on function public.decline_quote_revision_v1(uuid) from public, anon, service_role;
revoke all on function public.expire_quote_revision_v1(uuid) from public, anon, service_role;
revoke all on function public.mark_quote_viewed_v1(uuid, text) from public, anon, service_role;
revoke all on function public.create_quote_revision_v1(uuid, jsonb) from public, anon, service_role;
revoke all on function public.insert_draft_quote_v1(jsonb) from public, anon, service_role;
revoke all on function public.append_quote_updated_v1(uuid, jsonb) from public, anon, service_role;

grant execute on function public.allocate_org_quote_number_v1() to authenticated;
grant execute on function public.send_quote_revision_v1(uuid, jsonb, text, text) to authenticated;
grant execute on function public.accept_quote_revision_v1(uuid) to authenticated;
grant execute on function public.decline_quote_revision_v1(uuid) to authenticated;
grant execute on function public.expire_quote_revision_v1(uuid) to authenticated;
grant execute on function public.mark_quote_viewed_v1(uuid, text) to authenticated;
grant execute on function public.create_quote_revision_v1(uuid, jsonb) to authenticated;
grant execute on function public.insert_draft_quote_v1(jsonb) to authenticated;
grant execute on function public.append_quote_updated_v1(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- F. Historical issuer freeze (apply-time org copy, not send-time fact)
-- ---------------------------------------------------------------------------

update public.quotes q
set issuer_snapshot = jsonb_strip_nulls(
  jsonb_build_object(
    'organisationName', coalesce(o.name, ''),
    'tradingName', s.trading_name,
    'legalName', s.legal_name,
    'contactEmail', s.contact_email,
    'contactPhone', s.contact_phone,
    'website', s.website,
    'addressLine1', s.address_line_1,
    'addressLine2', s.address_line_2,
    'city', s.city,
    'region', s.region,
    'postcode', s.postcode,
    'addressCountry', coalesce(s.address_country, 'New Zealand'),
    'nzbn', s.nzbn,
    'gstNumber', s.gst_number,
    'logoUrl', s.logo_url,
    'brandPrimaryColour', s.brand_primary_colour,
    'brandAccentColour', s.brand_accent_colour,
    'defaultPaymentTerms', s.default_payment_terms,
    'source', 'migration_041_current_org'
  )
)
from public.organisations o
left join public.organisation_settings s on s.org_id = o.id
where q.org_id = o.id
  and q.issuer_snapshot is null
  and q.status in ('sent', 'viewed', 'accepted', 'declined', 'expired', 'superseded');

notify pgrst, 'reload schema';
