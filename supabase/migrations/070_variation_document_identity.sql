-- VARIATIONS-03A-R1
-- Freeze contractor, client, project and accepted master-Quote identity at issue.
-- Does not edit migrations 063–069 and does not change Quote wording.

alter table public.variation_revisions
  add column if not exists document_identity jsonb;

comment on column public.variation_revisions.document_identity is
  'Client-facing party and accepted Quote identity frozen at issue. Later organisation, project or Quote edits do not rewrite it.';

create or replace function public.variation_capture_document_identity(p_revision uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_project_id uuid;
  v_snapshot_id uuid;
  v_quote_id uuid;
  v_snapshot_revision integer;
  v_accepted_at timestamptz;
  v_quote public.quotes%rowtype;
  v_project public.projects%rowtype;
  v_settings public.organisation_settings%rowtype;
  v_org_name text;
  v_issuer jsonb := '{}'::jsonb;
  v_from_snapshot boolean := false;
  v_quote_number text;
  v_client text;
  v_site text;
  v_available boolean := false;
  v_quote_found boolean := false;
  v_has_settings boolean := false;
begin
  select v.org_id, v.project_id, v.accepted_snapshot_id
    into v_org, v_project_id, v_snapshot_id
  from public.variation_revisions r
  join public.variations v on v.id = r.variation_id and v.org_id = r.org_id
  where r.id = p_revision;

  if v_snapshot_id is null then
    return jsonb_build_object(
      'masterQuote', jsonb_build_object('available', false),
      'client', jsonb_build_object('name', null),
      'project', jsonb_build_object('title', null, 'siteAddress', null),
      'contractor', jsonb_build_object('organisationName', '')
    );
  end if;

  select s.quote_id, s.revision_number, s.accepted_at
    into v_quote_id, v_snapshot_revision, v_accepted_at
  from public.accepted_commercial_snapshots s
  where s.id = v_snapshot_id
    and s.org_id = v_org
    and s.project_id = v_project_id;

  select * into v_project from public.projects where id = v_project_id and org_id = v_org;
  select * into v_settings from public.organisation_settings where org_id = v_org;
  v_has_settings := found;
  select name into v_org_name from public.organisations where id = v_org;

  if v_quote_id is not null then
    select * into v_quote
    from public.quotes
    where id = v_quote_id
      and org_id = v_org
      and project_id = v_project_id
      and revision_number = v_snapshot_revision;
    v_quote_found := found;
  end if;

  if v_quote_found then
    v_issuer := coalesce(v_quote.issuer_snapshot, '{}'::jsonb);
    v_from_snapshot := nullif(btrim(coalesce(v_issuer->>'organisationName', '')), '') is not null
      or nullif(btrim(coalesce(v_issuer->>'legalName', '')), '') is not null;
    v_quote_number := nullif(btrim(coalesce(v_quote.quote_number, '')), '');
    if v_quote_number is null then
      v_quote_number := nullif(
        btrim(regexp_replace(coalesce(v_quote.title, ''), '^quote\s*[—–:\-]\s*', '', 'i')),
        ''
      );
    end if;
    v_client := nullif(btrim(coalesce(v_quote.client_name, '')), '');
    v_site := nullif(btrim(coalesce(v_quote.site_address, '')), '');
    v_available := v_quote_number is not null;
  end if;

  if v_client is null then
    v_client := nullif(btrim(coalesce(v_project.client_name, '')), '');
  end if;
  if v_site is null then
    v_site := nullif(btrim(coalesce(v_project.site_address, '')), '');
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'contractor', jsonb_strip_nulls(jsonb_build_object(
      'organisationName', case when v_from_snapshot then coalesce(v_issuer->>'organisationName', '') else coalesce(v_org_name, '') end,
      'tradingName', case when v_from_snapshot then v_issuer->>'tradingName' when v_has_settings then v_settings.trading_name else null end,
      'legalName', case when v_from_snapshot then v_issuer->>'legalName' when v_has_settings then v_settings.legal_name else null end,
      'email', case when v_from_snapshot then v_issuer->>'contactEmail' when v_has_settings then v_settings.contact_email else null end,
      'phone', case when v_from_snapshot then v_issuer->>'contactPhone' when v_has_settings then v_settings.contact_phone else null end,
      'website', case when v_from_snapshot then v_issuer->>'website' when v_has_settings then v_settings.website else null end,
      'addressLine1', case when v_from_snapshot then v_issuer->>'addressLine1' when v_has_settings then v_settings.address_line_1 else null end,
      'addressLine2', case when v_from_snapshot then v_issuer->>'addressLine2' when v_has_settings then v_settings.address_line_2 else null end,
      'city', case when v_from_snapshot then v_issuer->>'city' when v_has_settings then v_settings.city else null end,
      'region', case when v_from_snapshot then v_issuer->>'region' when v_has_settings then v_settings.region else null end,
      'postcode', case when v_from_snapshot then v_issuer->>'postcode' when v_has_settings then v_settings.postcode else null end,
      'addressCountry', case when v_from_snapshot then coalesce(nullif(btrim(v_issuer->>'addressCountry'), ''), 'New Zealand') when v_has_settings then coalesce(v_settings.address_country, 'New Zealand') else 'New Zealand' end,
      'nzbn', case when v_from_snapshot then v_issuer->>'nzbn' when v_has_settings then v_settings.nzbn else null end,
      'gstNumber', case when v_from_snapshot then v_issuer->>'gstNumber' when v_has_settings then v_settings.gst_number else null end,
      'logoUrl', case when v_from_snapshot then v_issuer->>'logoUrl' when v_has_settings then v_settings.logo_url else null end,
      'timezone', case when v_from_snapshot then v_issuer->>'timezone' when v_has_settings then v_settings.timezone else null end,
      'brandPrimaryColour', case when v_from_snapshot then v_issuer->>'brandPrimaryColour' when v_has_settings then v_settings.brand_primary_colour else null end,
      'brandAccentColour', case when v_from_snapshot then v_issuer->>'brandAccentColour' when v_has_settings then v_settings.brand_accent_colour else null end
    )),
    'client', jsonb_build_object('name', v_client),
    'project', jsonb_build_object(
      'title', nullif(btrim(coalesce(v_project.title, '')), ''),
      'siteAddress', v_site
    ),
    'masterQuote', jsonb_build_object(
      'quoteNumber', v_quote_number,
      'revisionNumber', case when v_available then v_snapshot_revision else null end,
      'acceptedAt', case when v_available then v_accepted_at else null end,
      'available', v_available and v_client is not null
    ),
    'internal', jsonb_build_object(
      'sourceQuoteId', v_quote_id,
      'snapshotId', v_snapshot_id
    )
  ));
end;
$$;

create or replace function public.variation_freeze_document_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if old.document_identity is not null
      and new.document_identity is distinct from old.document_identity then
      raise exception 'VARIATION_IMMUTABLE';
    end if;
    if old.status = 'draft'
      and new.status = 'issued'
      and new.document_identity is null then
      new.document_identity := public.variation_capture_document_identity(new.id);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists variation_revisions_document_identity on public.variation_revisions;
create trigger variation_revisions_document_identity
  before update on public.variation_revisions
  for each row execute function public.variation_freeze_document_identity();

select set_config('quotr.variation_write', 'transition', true);
update public.variation_revisions
set document_identity = public.variation_capture_document_identity(id)
where document_identity is null
  and status <> 'draft';

revoke all on function public.variation_capture_document_identity(uuid)
  from public, anon, authenticated;
revoke all on function public.variation_freeze_document_identity()
  from public, anon, authenticated;

-- Delivery requires a resolved accepted Quote and a real client name.
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
  v_quote_number text;
  v_client text;
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

  v_quote_number := nullif(btrim(coalesce(v_rev.document_identity #>> '{masterQuote,quoteNumber}', '')), '');
  v_client := nullif(btrim(coalesce(v_rev.document_identity #>> '{client,name}', '')), '');
  if coalesce(v_rev.document_identity #>> '{masterQuote,available}', 'false') <> 'true'
    or v_quote_number is null
    or v_client is null
    or v_quote_number ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then
    return jsonb_build_object('ok', false, 'error', 'IDENTITY_REQUIRED');
  end if;

  select * into v_existing
  from public.variation_deliveries
  where idempotency_key = v_key
    and org_id = (v_lock->>'orgId')::uuid;

  if found then
    return jsonb_build_object(
      'ok', true, 'idempotent', true,
      'deliveryId', v_existing.id, 'status', v_existing.status,
      'kind', v_existing.kind, 'revisionId', v_existing.revision_id
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
    (v_lock->>'orgId')::uuid, p_project, p_variation, p_revision, v_hash, (v_lock->>'userId')::uuid
  )
  returning id into v_token_id;

  insert into public.variation_deliveries (
    org_id, project_id, variation_id, revision_id, access_token_id,
    recipient_email, recipient_name, delivery_type, provider, kind, status,
    actor_user_id, idempotency_key
  ) values (
    (v_lock->>'orgId')::uuid, p_project, p_variation, p_revision, v_token_id,
    v_email, v_name, 'email', 'resend', v_kind, 'pending', (v_lock->>'userId')::uuid, v_key
  )
  returning id into v_delivery_id;

  return jsonb_build_object(
    'ok', true, 'idempotent', false,
    'deliveryId', v_delivery_id, 'status', 'pending', 'kind', v_kind, 'revisionId', p_revision
  );
exception
  when unique_violation then
    select * into v_existing
    from public.variation_deliveries
    where idempotency_key = v_key
      and org_id = (v_lock->>'orgId')::uuid;
    if found then
      return jsonb_build_object(
        'ok', true, 'idempotent', true,
        'deliveryId', v_existing.id, 'status', v_existing.status,
        'kind', v_existing.kind, 'revisionId', v_existing.revision_id
      );
    end if;
    return jsonb_build_object('ok', false, 'error', 'IN_PROGRESS');
end;
$$;

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
  v_identity jsonb;
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
  where id = v_token.variation_id and org_id = v_token.org_id;
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

  v_identity := coalesce(v_rev.document_identity, '{}'::jsonb) - 'internal';

  select s.sell_ex_gst, s.gst_amount, s.sell_incl_gst
    into v_base_ex, v_base_gst, v_base_incl
  from public.accepted_commercial_snapshots s
  where s.project_id = v_token.project_id and s.org_id = v_token.org_id;

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

  return jsonb_build_object(
    'ok', true,
    'state', 'proposed',
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
    'items', v_items
  );
end;
$$;
