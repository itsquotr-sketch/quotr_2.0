-- ONBOARDING-01-R2
-- Dedicated Australian Business Number. Does not rewrite quote or variation snapshots.

alter table public.organisation_settings
  add column if not exists abn text;

comment on column public.organisation_settings.abn is
  'Australian Business Number. Distinct from nzbn. Historical quote and variation snapshots are not rewritten.';

update public.organisation_settings
set abn = regexp_replace(nzbn, '\s', '', 'g'),
    nzbn = null
where abn is null
  and nzbn is not null
  and (
    lower(coalesce(address_country, '')) in ('australia', 'au')
    or upper(coalesce(country, '')) = 'AU'
  )
  and regexp_replace(nzbn, '\s', '', 'g') ~ '^\d{11}$';
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
        btrim(regexp_replace(coalesce(v_quote.title, ''), '^quote\s*[â€”â€“:\-]\s*', '', 'i')),
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
      'abn', case when v_from_snapshot then v_issuer->>'abn' when v_has_settings then v_settings.abn else null end,
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

