-- VARIATIONS-03A
-- Delivery attempts and hashed client links for an already-issued Variation.
-- Sending does not accept the Variation or change the accepted contract.
-- Does not alter quote delivery tables or applied variation migrations.

-- ---------------------------------------------------------------------------
-- A. First-send milestone vocabulary
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
      'variation_withdrawn',
      'variation_superseded',
      'variation_sent'
    )
  );

-- ---------------------------------------------------------------------------
-- B. Opaque client access. The browser holds the raw token; the database stores the hash.
-- ---------------------------------------------------------------------------

create table if not exists public.variation_access_tokens (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  variation_id uuid not null references public.variations(id) on delete cascade,
  revision_id uuid not null references public.variation_revisions(id) on delete cascade,
  token_hash text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists variation_access_tokens_hash_uidx
  on public.variation_access_tokens (token_hash);

create index if not exists variation_access_tokens_revision_idx
  on public.variation_access_tokens (revision_id, created_at desc);

comment on table public.variation_access_tokens is
  'Hashed access to one issued Variation revision. The token carries no commercial data.';

alter table public.variation_access_tokens enable row level security;

revoke all on table public.variation_access_tokens from public, anon, authenticated;
grant select, insert, update, delete on table public.variation_access_tokens to service_role;

-- ---------------------------------------------------------------------------
-- C. Delivery attempts. Separate from Variation status.
-- ---------------------------------------------------------------------------

create table if not exists public.variation_deliveries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  variation_id uuid not null references public.variations(id) on delete cascade,
  revision_id uuid not null references public.variation_revisions(id) on delete cascade,
  access_token_id uuid references public.variation_access_tokens(id) on delete set null,
  recipient_email text not null,
  recipient_name text,
  delivery_type text not null default 'email'
    check (delivery_type in ('email')),
  provider text not null default 'resend',
  provider_message_id text,
  kind text not null
    check (kind in ('send', 'resend')),
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed')),
  attempted_at timestamptz not null default now(),
  sent_at timestamptz,
  failed_at timestamptz,
  failure_code text,
  failure_message_safe text,
  actor_user_id uuid references auth.users(id) on delete set null,
  idempotency_key text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists variation_deliveries_idempotency_uidx
  on public.variation_deliveries (idempotency_key);

create unique index if not exists variation_deliveries_one_pending_uidx
  on public.variation_deliveries (revision_id)
  where status = 'pending';

create index if not exists variation_deliveries_revision_idx
  on public.variation_deliveries (revision_id, created_at desc);

create index if not exists variation_deliveries_org_idx
  on public.variation_deliveries (org_id, created_at desc);

comment on table public.variation_deliveries is
  'Email attempts for one immutable issued Variation revision. Not Variation status.';

alter table public.variation_deliveries enable row level security;

drop policy if exists variation_deliveries_select_org on public.variation_deliveries;
create policy variation_deliveries_select_org
  on public.variation_deliveries for select
  using (org_id = public.auth_org_id());

revoke all on table public.variation_deliveries from public, anon;
revoke insert, update, delete on table public.variation_deliveries from authenticated;
grant select on table public.variation_deliveries to authenticated;
grant select, insert, update, delete on table public.variation_deliveries to service_role;

-- ---------------------------------------------------------------------------
-- D. Begin, complete, and fail a delivery
-- ---------------------------------------------------------------------------

create or replace function public.begin_variation_delivery_v1(
  p_project uuid,
  p_variation uuid,
  p_revision uuid,
  p_recipient_email text,
  p_recipient_name text,
  p_token_hash text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock jsonb;
  v_rev public.variation_revisions%rowtype;
  v_email text := lower(btrim(coalesce(p_recipient_email, '')));
  v_name text := nullif(btrim(coalesce(p_recipient_name, '')), '');
  v_hash text := nullif(btrim(coalesce(p_token_hash, '')), '');
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_existing public.variation_deliveries%rowtype;
  v_kind text;
  v_token_id uuid;
  v_delivery_id uuid;
begin
  v_lock := public.variation_lock_current(p_variation, p_revision);
  if coalesce(v_lock->>'ok', 'false') <> 'true' then
    return v_lock;
  end if;
  if (v_lock->>'projectId')::uuid is distinct from p_project then
    return jsonb_build_object('ok', false, 'error', 'CROSS_PROJECT');
  end if;
  if v_key is null or char_length(v_key) < 8 or char_length(v_key) > 200 then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  if v_hash is null or char_length(v_hash) <> 64 then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or char_length(v_email) > 200 then
    return jsonb_build_object('ok', false, 'error', 'INVALID_EMAIL');
  end if;

  select * into v_rev
  from public.variation_revisions
  where id = p_revision;

  if v_rev.status = 'draft' then
    return jsonb_build_object('ok', false, 'error', 'DRAFT');
  end if;
  if v_rev.status = 'withdrawn' then
    return jsonb_build_object('ok', false, 'error', 'WITHDRAWN');
  end if;
  if v_rev.status is distinct from 'issued'
    or v_rev.title is null
    or btrim(v_rev.title) = ''
    or v_rev.total_sell_adjustment_ex_gst is null
    or v_rev.gst_adjustment is null
    or v_rev.total_adjustment_incl_gst is null
  then
    return jsonb_build_object('ok', false, 'error', 'NOT_ELIGIBLE');
  end if;

  select * into v_existing
  from public.variation_deliveries
  where idempotency_key = v_key
    and org_id = (v_lock->>'orgId')::uuid;

  if found then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'deliveryId', v_existing.id,
      'status', v_existing.status,
      'kind', v_existing.kind,
      'revisionId', v_existing.revision_id
    );
  end if;

  if exists (
    select 1 from public.variation_deliveries
    where revision_id = p_revision and status = 'pending'
  ) then
    return jsonb_build_object('ok', false, 'error', 'IN_PROGRESS');
  end if;

  if exists (
    select 1 from public.variation_deliveries
    where revision_id = p_revision and status = 'sent'
  ) then
    v_kind := 'resend';
  else
    v_kind := 'send';
  end if;

  insert into public.variation_access_tokens (
    org_id, project_id, variation_id, revision_id, token_hash, created_by
  ) values (
    (v_lock->>'orgId')::uuid,
    p_project,
    p_variation,
    p_revision,
    v_hash,
    (v_lock->>'userId')::uuid
  )
  returning id into v_token_id;

  insert into public.variation_deliveries (
    org_id, project_id, variation_id, revision_id, access_token_id,
    recipient_email, recipient_name, delivery_type, provider, kind, status,
    actor_user_id, idempotency_key
  ) values (
    (v_lock->>'orgId')::uuid,
    p_project,
    p_variation,
    p_revision,
    v_token_id,
    v_email,
    v_name,
    'email',
    'resend',
    v_kind,
    'pending',
    (v_lock->>'userId')::uuid,
    v_key
  )
  returning id into v_delivery_id;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'deliveryId', v_delivery_id,
    'status', 'pending',
    'kind', v_kind,
    'revisionId', p_revision
  );
exception
  when unique_violation then
    select * into v_existing
    from public.variation_deliveries
    where idempotency_key = v_key
      and org_id = (v_lock->>'orgId')::uuid;
    if found then
      return jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'deliveryId', v_existing.id,
        'status', v_existing.status,
        'kind', v_existing.kind,
        'revisionId', v_existing.revision_id
      );
    end if;
    return jsonb_build_object('ok', false, 'error', 'IN_PROGRESS');
end;
$$;

create or replace function public.complete_variation_delivery_v1(
  p_delivery uuid,
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
  v_row public.variation_deliveries%rowtype;
  v_lock jsonb;
  v_message text := nullif(btrim(coalesce(p_provider_message_id, '')), '');
  v_sell numeric;
  v_number integer;
  v_revision_number integer;
  v_currency text;
begin
  if v_uid is null or v_org is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  end if;
  if v_message is null then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;

  select * into v_row
  from public.variation_deliveries
  where id = p_delivery and org_id = v_org
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;

  if v_row.status = 'sent' then
    return jsonb_build_object(
      'ok', true, 'idempotent', true, 'deliveryId', v_row.id, 'status', 'sent', 'kind', v_row.kind
    );
  end if;
  if v_row.status is distinct from 'pending' then
    return jsonb_build_object('ok', false, 'error', 'NOT_PENDING');
  end if;

  v_lock := public.variation_lock_current(v_row.variation_id, v_row.revision_id);
  if coalesce(v_lock->>'ok', 'false') <> 'true'
    or v_lock->>'status' is distinct from 'issued'
  then
    update public.variation_deliveries
    set status = 'failed',
        failed_at = now(),
        failure_code = 'withdrawn_or_ineligible',
        failure_message_safe = 'This Variation can no longer be sent.'
    where id = v_row.id;
    return jsonb_build_object('ok', false, 'error', 'NOT_ELIGIBLE', 'status', 'failed');
  end if;

  update public.variation_deliveries
  set status = 'sent',
      sent_at = now(),
      provider_message_id = v_message,
      provider = 'resend'
  where id = v_row.id;

  if v_row.kind = 'send' then
    select r.total_sell_adjustment_ex_gst, v.variation_number, r.revision_number, r.currency
      into v_sell, v_number, v_revision_number, v_currency
    from public.variation_revisions r
    join public.variations v on v.id = r.variation_id
    where r.id = v_row.revision_id;

    perform public.variation_append_event(
      v_org,
      v_row.project_id,
      v_uid,
      'variation_sent',
      v_row.variation_id,
      v_number,
      v_row.revision_id,
      v_revision_number,
      v_sell,
      v_currency
    );
  end if;

  return jsonb_build_object(
    'ok', true, 'idempotent', false, 'deliveryId', v_row.id, 'status', 'sent', 'kind', v_row.kind
  );
end;
$$;

create or replace function public.fail_variation_delivery_v1(
  p_delivery uuid,
  p_code text,
  p_message text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := public.auth_org_id();
  v_row public.variation_deliveries%rowtype;
  v_code text := left(nullif(btrim(coalesce(p_code, '')), ''), 80);
  v_message text := left(nullif(btrim(coalesce(p_message, '')), ''), 240);
begin
  if v_uid is null or v_org is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  end if;

  select * into v_row
  from public.variation_deliveries
  where id = p_delivery and org_id = v_org
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;

  if v_row.status = 'sent' then
    return jsonb_build_object('ok', true, 'idempotent', true, 'status', 'sent');
  end if;
  if v_row.status = 'failed' then
    return jsonb_build_object('ok', true, 'idempotent', true, 'status', 'failed');
  end if;

  update public.variation_deliveries
  set status = 'failed',
      failed_at = now(),
      failure_code = coalesce(v_code, 'provider_rejected'),
      failure_message_safe = coalesce(v_message, 'The email could not be sent.')
  where id = v_row.id;

  return jsonb_build_object('ok', true, 'idempotent', false, 'status', 'failed', 'deliveryId', v_row.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- E. Public document. The token hash is the only authority.
-- ---------------------------------------------------------------------------

create or replace function public.lookup_variation_client_by_token_hash_v1(
  p_token_hash text
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
  v_project public.projects%rowtype;
  v_company text;
  v_contact_email text;
  v_contact_phone text;
  v_base_ex numeric;
  v_base_gst numeric;
  v_base_incl numeric;
  v_accepted_ex numeric;
  v_accepted_gst numeric;
  v_accepted_incl numeric;
  v_items jsonb;
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
  where id = v_token.variation_id
    and org_id = v_token.org_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;

  if v_rev.status = 'withdrawn' then
    return jsonb_build_object('ok', true, 'state', 'withdrawn');
  end if;

  if v_rev.status is distinct from 'issued'
    or v_variation.current_revision_id is distinct from v_rev.id
  then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;

  select * into v_project from public.projects where id = v_token.project_id;
  select o.name, s.contact_email, s.contact_phone
    into v_company, v_contact_email, v_contact_phone
  from public.organisations o
  left join public.organisation_settings s on s.org_id = o.id
  where o.id = v_token.org_id;

  select s.sell_ex_gst, s.gst_amount, s.sell_incl_gst
    into v_base_ex, v_base_gst, v_base_incl
  from public.accepted_commercial_snapshots s
  where s.project_id = v_token.project_id
    and s.org_id = v_token.org_id;

  select
    coalesce(sum(r.total_sell_adjustment_ex_gst), 0),
    coalesce(sum(r.gst_adjustment), 0),
    coalesce(sum(r.total_adjustment_incl_gst), 0)
    into v_accepted_ex, v_accepted_gst, v_accepted_incl
  from public.variations v
  join public.variation_revisions r on r.id = v.current_revision_id
  where v.project_id = v_token.project_id
    and v.org_id = v_token.org_id
    and r.status = 'accepted';

  select coalesce(jsonb_agg(item order by sort_order), '[]'::jsonb) into v_items
  from (
    select
      i.sort_order,
      jsonb_build_object(
        'itemType', i.item_type,
        'clientDescription', i.client_description,
        'quantity', i.quantity,
        'unit', i.unit,
        'lineSellAdjustmentExGst', i.line_sell_adjustment_ex_gst,
        'substitutionGroupId', i.substitution_group_id,
        'sortOrder', i.sort_order
      ) as item
    from public.variation_items i
    where i.revision_id = v_rev.id
      and i.org_id = v_token.org_id
  ) rows;

  return jsonb_build_object(
    'ok', true,
    'state', 'proposed',
    'companyName', coalesce(v_company, ''),
    'clientName', coalesce(nullif(btrim(v_project.client_name), ''), ''),
    'projectTitle', coalesce(v_project.title, ''),
    'siteAddress', v_project.site_address,
    'contactEmail', v_contact_email,
    'contactPhone', v_contact_phone,
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
    'items', v_items
  );
end;
$$;

revoke all on function public.begin_variation_delivery_v1(uuid, uuid, uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.begin_variation_delivery_v1(uuid, uuid, uuid, text, text, text, text)
  to authenticated;

revoke all on function public.complete_variation_delivery_v1(uuid, text)
  from public, anon, authenticated;
grant execute on function public.complete_variation_delivery_v1(uuid, text)
  to authenticated;

revoke all on function public.fail_variation_delivery_v1(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.fail_variation_delivery_v1(uuid, text, text)
  to authenticated;

revoke all on function public.lookup_variation_client_by_token_hash_v1(text)
  from public;
grant execute on function public.lookup_variation_client_by_token_hash_v1(text)
  to anon, authenticated;
