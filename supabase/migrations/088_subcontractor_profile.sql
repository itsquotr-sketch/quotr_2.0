-- Contacts profile refinement.
-- Additive columns, a private document bucket, and a replaced save function.
-- Does not change customers, projects, quotes, estimates, rates, or Quote GST.
-- A stored file stays on the subcontractor. This migration does not create an
-- RFQ and does not copy a file onto a quote, estimate, or project.
-- gst_notes remains and is no longer written. GST registration is explicit
-- and is not inferred from an NZBN or ABN.

alter table public.subcontractors
  add column if not exists country_code text,
  add column if not exists address_line_1 text,
  add column if not exists address_line_2 text,
  add column if not exists address_city text,
  add column if not exists address_region text,
  add column if not exists address_postcode text,
  add column if not exists nzbn text,
  add column if not exists gst_registration text,
  add column if not exists service_region_other_labels text[] not null default '{}';

alter table public.subcontractors
  drop constraint if exists subcontractors_country_code_known;
alter table public.subcontractors
  add constraint subcontractors_country_code_known
  check (country_code is null or country_code in ('NZ', 'AU'));

alter table public.subcontractors
  drop constraint if exists subcontractors_address_line_1_len;
alter table public.subcontractors
  add constraint subcontractors_address_line_1_len
  check (address_line_1 is null or char_length(address_line_1) <= 200);

alter table public.subcontractors
  drop constraint if exists subcontractors_address_line_2_len;
alter table public.subcontractors
  add constraint subcontractors_address_line_2_len
  check (address_line_2 is null or char_length(address_line_2) <= 200);

alter table public.subcontractors
  drop constraint if exists subcontractors_address_city_len;
alter table public.subcontractors
  add constraint subcontractors_address_city_len
  check (address_city is null or char_length(address_city) <= 80);

alter table public.subcontractors
  drop constraint if exists subcontractors_address_region_len;
alter table public.subcontractors
  add constraint subcontractors_address_region_len
  check (address_region is null or char_length(address_region) <= 80);

alter table public.subcontractors
  drop constraint if exists subcontractors_address_postcode_len;
alter table public.subcontractors
  add constraint subcontractors_address_postcode_len
  check (address_postcode is null or char_length(address_postcode) <= 12);

alter table public.subcontractors
  drop constraint if exists subcontractors_nzbn_len;
alter table public.subcontractors
  add constraint subcontractors_nzbn_len
  check (nzbn is null or char_length(nzbn) <= 20);

alter table public.subcontractors
  drop constraint if exists subcontractors_gst_registration_known;
alter table public.subcontractors
  add constraint subcontractors_gst_registration_known
  check (gst_registration is null or gst_registration in ('yes', 'no', 'unknown'));

comment on column public.subcontractors.country_code is
  'Business country, NZ or AU. Defaults from the organisation in the app and stays editable. Not inferred from a business number.';

comment on column public.subcontractors.address_line_1 is
  'Street address of the business location. Not a service area and not a rate.';

comment on column public.subcontractors.service_region_other_labels is
  'Labels kept for the Other service area, including free text that was already saved. Not a rate.';

comment on column public.subcontractors.nzbn is
  'Optional NZBN supplied by the organisation. Not verified and not used to infer GST.';

comment on column public.subcontractors.gst_registration is
  'Explicit yes, no, or unknown. Not inferred from NZBN or ABN. Does not change Quote GST or supplier rates.';

comment on column public.subcontractors.gst_notes is
  'Retired. Left in place so existing rows are not destroyed. The app no longer reads or writes it.';

comment on column public.subcontractors.specialties is
  'Services offered. Descriptive text, including work outside calculator areas. Not a priced rate.';

-- Keep aliases aligned with lib/subcontractors/regions.ts.
create or replace function public.subcontractor_region_code(p_label text)
returns text
language plpgsql
immutable
as $$
declare
  v_key text;
begin
  v_key := lower(btrim(coalesce(p_label, '')));
  v_key := replace(v_key, '''', '');
  v_key := replace(v_key, '’', '');
  v_key := replace(v_key, 'ā', 'a');
  v_key := replace(v_key, 'ē', 'e');
  v_key := replace(v_key, 'ī', 'i');
  v_key := replace(v_key, 'ō', 'o');
  v_key := replace(v_key, 'ū', 'u');
  v_key := btrim(regexp_replace(v_key, '[^a-z0-9]+', ' ', 'g'));
  return case v_key
    when 'northland' then 'northland'
    when 'auckland' then 'auckland'
    when 'waikato' then 'waikato'
    when 'bay of plenty' then 'bay_of_plenty'
    when 'gisborne' then 'gisborne'
    when 'hawkes bay' then 'hawkes_bay'
    when 'taranaki' then 'taranaki'
    when 'manawatu whanganui' then 'manawatu_whanganui'
    when 'wellington' then 'wellington'
    when 'tasman' then 'tasman'
    when 'nelson' then 'nelson'
    when 'marlborough' then 'marlborough'
    when 'west coast' then 'west_coast'
    when 'canterbury' then 'canterbury'
    when 'otago' then 'otago'
    when 'southland' then 'southland'
    when 'nsw' then 'nsw'
    when 'new south wales' then 'nsw'
    when 'vic' then 'vic'
    when 'victoria' then 'vic'
    when 'qld' then 'qld'
    when 'queensland' then 'qld'
    when 'sa' then 'sa'
    when 'south australia' then 'sa'
    when 'wa' then 'wa'
    when 'western australia' then 'wa'
    when 'tas' then 'tas'
    when 'tasmania' then 'tas'
    when 'act' then 'act'
    when 'australian capital territory' then 'act'
    when 'nt' then 'nt'
    when 'northern territory' then 'nt'
    when 'nationwide' then 'nationwide'
    when 'nation wide' then 'nationwide'
    when 'national' then 'nationwide'
    when 'nz wide' then 'nationwide'
    when 'new zealand wide' then 'nationwide'
    when 'australia wide' then 'nationwide'
    when 'all regions' then 'nationwide'
    when 'all of nz' then 'nationwide'
    when 'all of new zealand' then 'nationwide'
    when 'all of australia' then 'nationwide'
    when 'other' then 'other'
    else null
  end;
end;
$$;

create or replace function public.subcontractor_region_codes_known(p_regions text[])
returns boolean
language sql
immutable
as $$
  select coalesce(p_regions, '{}'::text[]) <@ array[
    'northland', 'auckland', 'waikato', 'bay_of_plenty', 'gisborne', 'hawkes_bay',
    'taranaki', 'manawatu_whanganui', 'wellington', 'tasman', 'nelson', 'marlborough',
    'west_coast', 'canterbury', 'otago', 'southland',
    'nsw', 'vic', 'qld', 'sa', 'wa', 'tas', 'act', 'nt',
    'nationwide', 'other'
  ]::text[]
$$;

-- Map already saved free-text service areas. Unrecognised labels are kept.
do $$
declare
  v_row record;
  v_item text;
  v_code text;
  v_codes text[] := '{}';
  v_labels text[] := '{}';
begin
  for v_row in
    select id, country, service_regions
    from public.subcontractors
  loop
    v_codes := '{}';
    v_labels := '{}';
    foreach v_item in array coalesce(v_row.service_regions, '{}'::text[])
    loop
      if btrim(coalesce(v_item, '')) = '' then
        continue;
      end if;
      v_code := public.subcontractor_region_code(v_item);
      if v_code is null then
        v_codes := array_append(v_codes, 'other');
        v_labels := v_labels || btrim(v_item);
      else
        v_codes := v_codes || v_code;
      end if;
    end loop;

    update public.subcontractors
      set country_code = coalesce(
            country_code,
            case lower(btrim(coalesce(v_row.country, '')))
              when 'nz' then 'NZ'
              when 'new zealand' then 'NZ'
              when 'au' then 'AU'
              when 'australia' then 'AU'
              else null
            end
          ),
          service_regions = coalesce(
            (
              select array_agg(distinct code order by code)
              from unnest(v_codes) as code
            ),
            '{}'::text[]
          ),
          service_region_other_labels = coalesce(
            (
              select array_agg(distinct label order by label)
              from unnest(v_labels) as label
            ),
            '{}'::text[]
          )
      where id = v_row.id;
  end loop;
end;
$$;

alter table public.subcontractors
  drop constraint if exists subcontractors_region_codes_known;
alter table public.subcontractors
  add constraint subcontractors_region_codes_known
  check (public.subcontractor_region_codes_known(service_regions));

create or replace function public.subcontractor_other_region_labels_ok(p_labels text[])
returns boolean
language sql
immutable
as $$
  select cardinality(coalesce(p_labels, '{}'::text[])) <= 20
    and not exists (
      select 1
      from unnest(coalesce(p_labels, '{}'::text[])) as label
      where char_length(btrim(label)) < 1 or char_length(label) > 80
    )
$$;

alter table public.subcontractors
  drop constraint if exists subcontractors_other_region_labels_ok;
alter table public.subcontractors
  add constraint subcontractors_other_region_labels_ok
  check (public.subcontractor_other_region_labels_ok(service_region_other_labels));

alter table public.subcontractor_documents
  drop constraint if exists subcontractor_documents_kind_known;
alter table public.subcontractor_documents
  add constraint subcontractor_documents_kind_known
  check (
    document_kind in (
      'licence',
      'insurance',
      'capability_statement',
      'rate_schedule',
      'other'
    )
  );

alter table public.subcontractor_documents
  add column if not exists original_filename text,
  add column if not exists mime_type text,
  add column if not exists byte_size bigint,
  add column if not exists storage_object_path text,
  add column if not exists upload_status text;

alter table public.subcontractor_documents
  drop constraint if exists subcontractor_documents_upload_status_known;
alter table public.subcontractor_documents
  add constraint subcontractor_documents_upload_status_known
  check (upload_status is null or upload_status in ('pending', 'ready', 'failed'));

alter table public.subcontractor_documents
  drop constraint if exists subcontractor_documents_byte_size_ok;
alter table public.subcontractor_documents
  add constraint subcontractor_documents_byte_size_ok
  check (byte_size is null or (byte_size > 0 and byte_size <= 15728640));

alter table public.subcontractor_documents
  drop constraint if exists subcontractor_documents_path_ok;
alter table public.subcontractor_documents
  add constraint subcontractor_documents_path_ok
  check (
    storage_object_path is null
    or (
      storage_object_path !~ '\.\.'
      and storage_object_path like org_id::text || '/%'
    )
  );

create unique index if not exists subcontractor_documents_path_uidx
  on public.subcontractor_documents (storage_object_path)
  where storage_object_path is not null;

comment on table public.subcontractor_documents is
  'Organisation-private licences, insurance, capability statements, rate schedules, and other files. A file is not published through an RFQ. Expiry is the date supplied by the organisation and is not a verification.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'subcontractor-documents',
  'subcontractor-documents',
  false,
  15728640,
  array[
    'image/jpeg',
    'image/png',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No storage policies. Anon and authenticated clients cannot read or write
-- this private bucket. Signed URLs are issued by the server after the
-- organisation is taken from the signed-in profile.

create or replace function public.protect_subcontractor_document_file()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(current_setting('quotr.subcontractor_file_write', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.original_filename := null;
    new.mime_type := null;
    new.byte_size := null;
    new.storage_object_path := null;
    new.upload_status := null;
    return new;
  end if;
  new.original_filename := old.original_filename;
  new.mime_type := old.mime_type;
  new.byte_size := old.byte_size;
  new.storage_object_path := old.storage_object_path;
  new.upload_status := old.upload_status;
  return new;
end;
$$;

drop trigger if exists subcontractor_documents_protect_file on public.subcontractor_documents;
create trigger subcontractor_documents_protect_file
  before insert or update on public.subcontractor_documents
  for each row execute function public.protect_subcontractor_document_file();

create or replace function public.save_subcontractor_v1(p_payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := public.auth_org_id();
  v_id uuid;
  v_updated uuid;
  v_trading text;
  v_legal text;
  v_website text;
  v_country text;
  v_country_code text;
  v_line1 text;
  v_line2 text;
  v_city text;
  v_address_region text;
  v_postcode text;
  v_nzbn text;
  v_specialties text;
  v_notes text;
  v_method text;
  v_currency text;
  v_abn text;
  v_gst text;
  v_gst_registration text;
  v_minimum text;
  v_travel text;
  v_areas text[];
  v_regions text[];
  v_other_labels text[];
  v_codes text[] := '{}';
  v_labels text[] := '{}';
  v_text text;
  v_code text;
  v_known text[] := array[
    'deck', 'retaining_wall', 'bathroom', 'kitchen', 'fence', 'pergola',
    'external_stairs', 'demolition', 'internal_walls', 'ceilings', 'doors',
    'flooring', 'painting', 'cladding', 'plastering'
  ];
  v_item record;
  v_contact_id uuid;
  v_document_id uuid;
  v_name text;
  v_role text;
  v_email text;
  v_phone text;
  v_preferred text;
  v_primary boolean;
  v_kind text;
  v_title text;
  v_reference text;
  v_doc_notes text;
  v_expires date;
  v_keep_contacts uuid[] := '{}';
  v_keep_documents uuid[] := '{}';
  v_contacts jsonb := '[]'::jsonb;
  v_documents jsonb := '[]'::jsonb;
  v_sync_documents boolean := false;
begin
  if v_uid is null or v_org is null or not public.auth_can_mutate_work() then
    raise exception 'SUBCONTRACTOR_FORBIDDEN'
      using errcode = '42501';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'SUBCONTRACTOR_PAYLOAD_INVALID'
      using errcode = '23514';
  end if;

  if p_payload ? 'org_id' then
    raise exception 'SUBCONTRACTOR_ORG_UNTRUSTED'
      using errcode = '42501';
  end if;

  if p_payload ? 'contacts' and jsonb_typeof(p_payload->'contacts') <> 'array' then
    raise exception 'SUBCONTRACTOR_CONTACTS_INVALID'
      using errcode = '23514';
  end if;
  v_sync_documents := p_payload ? 'documents';
  if v_sync_documents and jsonb_typeof(p_payload->'documents') <> 'array' then
    raise exception 'SUBCONTRACTOR_DOCUMENTS_INVALID'
      using errcode = '23514';
  end if;
  if p_payload ? 'work_area_types' and jsonb_typeof(p_payload->'work_area_types') <> 'array' then
    raise exception 'SUBCONTRACTOR_WORK_AREAS_INVALID'
      using errcode = '23514';
  end if;
  if p_payload ? 'service_regions' and jsonb_typeof(p_payload->'service_regions') <> 'array' then
    raise exception 'SUBCONTRACTOR_REGIONS_INVALID'
      using errcode = '23514';
  end if;
  if p_payload ? 'service_region_other_labels' and jsonb_typeof(p_payload->'service_region_other_labels') <> 'array' then
    raise exception 'SUBCONTRACTOR_REGIONS_INVALID'
      using errcode = '23514';
  end if;

  v_contacts := coalesce(p_payload->'contacts', '[]'::jsonb);
  v_documents := case
    when v_sync_documents then coalesce(p_payload->'documents', '[]'::jsonb)
    else '[]'::jsonb
  end;
  if jsonb_array_length(v_contacts) > 30 then
    raise exception 'SUBCONTRACTOR_CONTACTS_LIMIT'
      using errcode = '23514';
  end if;
  if v_sync_documents and jsonb_array_length(v_documents) > 30 then
    raise exception 'SUBCONTRACTOR_DOCUMENTS_LIMIT'
      using errcode = '23514';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(v_contacts) as contact
    where nullif(btrim(coalesce(contact.value->>'id', '')), '') is not null
  ) <> (
    select count(distinct nullif(btrim(coalesce(contact.value->>'id', '')), ''))
    from jsonb_array_elements(v_contacts) as contact
    where nullif(btrim(coalesce(contact.value->>'id', '')), '') is not null
  ) then
    raise exception 'SUBCONTRACTOR_CONTACT_DUPLICATE'
      using errcode = '23514';
  end if;

  if v_sync_documents and (
    select count(*)
    from jsonb_array_elements(v_documents) as document
    where nullif(btrim(coalesce(document.value->>'id', '')), '') is not null
  ) <> (
    select count(distinct nullif(btrim(coalesce(document.value->>'id', '')), ''))
    from jsonb_array_elements(v_documents) as document
    where nullif(btrim(coalesce(document.value->>'id', '')), '') is not null
  ) then
    raise exception 'SUBCONTRACTOR_DOCUMENT_DUPLICATE'
      using errcode = '23514';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(v_contacts) as contact
    where coalesce(contact.value->>'is_primary', 'false') = 'true'
  ) > 1 then
    raise exception 'SUBCONTRACTOR_PRIMARY_CONTACT'
      using errcode = '23514';
  end if;

  v_trading := btrim(coalesce(p_payload->>'trading_name', ''));
  if char_length(v_trading) < 1 or char_length(v_trading) > 160 then
    raise exception 'SUBCONTRACTOR_NAME_INVALID'
      using errcode = '23514';
  end if;

  v_legal := nullif(btrim(coalesce(p_payload->>'legal_name', '')), '');
  v_website := nullif(btrim(coalesce(p_payload->>'website', '')), '');
  v_country := nullif(btrim(coalesce(p_payload->>'country', '')), '');
  v_country_code := nullif(upper(btrim(coalesce(p_payload->>'country_code', ''))), '');
  v_line1 := nullif(btrim(coalesce(p_payload->>'address_line_1', '')), '');
  v_line2 := nullif(btrim(coalesce(p_payload->>'address_line_2', '')), '');
  v_city := nullif(btrim(coalesce(p_payload->>'address_city', '')), '');
  v_address_region := nullif(btrim(coalesce(p_payload->>'address_region', '')), '');
  v_postcode := nullif(btrim(coalesce(p_payload->>'address_postcode', '')), '');
  v_nzbn := nullif(btrim(coalesce(p_payload->>'nzbn', '')), '');
  v_specialties := nullif(btrim(coalesce(p_payload->>'specialties', '')), '');
  v_notes := nullif(btrim(coalesce(p_payload->>'internal_notes', '')), '');
  v_method := nullif(btrim(coalesce(p_payload->>'preferred_pricing_method', '')), '');
  v_currency := nullif(upper(btrim(coalesce(p_payload->>'currency', ''))), '');
  v_abn := nullif(btrim(coalesce(p_payload->>'abn', '')), '');
  v_gst := nullif(btrim(coalesce(p_payload->>'gst_number', '')), '');
  v_gst_registration := nullif(lower(btrim(coalesce(p_payload->>'gst_registration', ''))), '');
  v_minimum := nullif(btrim(coalesce(p_payload->>'minimum_charge_notes', '')), '');
  v_travel := nullif(btrim(coalesce(p_payload->>'travel_notes', '')), '');

  if v_country_code is not null and v_country_code not in ('NZ', 'AU') then
    raise exception 'SUBCONTRACTOR_COUNTRY_INVALID' using errcode = '23514';
  end if;
  if v_country_code is null and v_country is not null then
    v_country_code := case lower(v_country)
      when 'nz' then 'NZ'
      when 'new zealand' then 'NZ'
      when 'au' then 'AU'
      when 'australia' then 'AU'
      else null
    end;
  end if;
  if v_country_code = 'NZ' then
    v_country := 'New Zealand';
  elsif v_country_code = 'AU' then
    v_country := 'Australia';
  end if;

  if v_legal is not null and char_length(v_legal) > 160 then
    raise exception 'SUBCONTRACTOR_LEGAL_NAME_INVALID' using errcode = '23514';
  end if;
  if v_website is not null and char_length(v_website) > 300 then
    raise exception 'SUBCONTRACTOR_WEBSITE_INVALID' using errcode = '23514';
  end if;
  if v_country is not null and char_length(v_country) > 80 then
    raise exception 'SUBCONTRACTOR_COUNTRY_INVALID' using errcode = '23514';
  end if;
  if v_line1 is not null and char_length(v_line1) > 200 then
    raise exception 'SUBCONTRACTOR_ADDRESS_INVALID' using errcode = '23514';
  end if;
  if v_line2 is not null and char_length(v_line2) > 200 then
    raise exception 'SUBCONTRACTOR_ADDRESS_INVALID' using errcode = '23514';
  end if;
  if v_city is not null and char_length(v_city) > 80 then
    raise exception 'SUBCONTRACTOR_ADDRESS_INVALID' using errcode = '23514';
  end if;
  if v_address_region is not null and char_length(v_address_region) > 80 then
    raise exception 'SUBCONTRACTOR_ADDRESS_INVALID' using errcode = '23514';
  end if;
  if v_postcode is not null and char_length(v_postcode) > 12 then
    raise exception 'SUBCONTRACTOR_ADDRESS_INVALID' using errcode = '23514';
  end if;
  if v_nzbn is not null and char_length(v_nzbn) > 20 then
    raise exception 'SUBCONTRACTOR_NZBN_INVALID' using errcode = '23514';
  end if;
  if v_specialties is not null and char_length(v_specialties) > 500 then
    raise exception 'SUBCONTRACTOR_SPECIALTIES_INVALID' using errcode = '23514';
  end if;
  if v_notes is not null and char_length(v_notes) > 5000 then
    raise exception 'SUBCONTRACTOR_NOTES_INVALID' using errcode = '23514';
  end if;
  if v_method is not null and v_method not in ('hourly', 'fixed', 'unit_rate', 'schedule_of_rates', 'quoted') then
    raise exception 'SUBCONTRACTOR_PRICING_METHOD_INVALID' using errcode = '23514';
  end if;
  if v_currency is not null and v_currency !~ '^[A-Z]{3}$' then
    raise exception 'SUBCONTRACTOR_CURRENCY_INVALID' using errcode = '23514';
  end if;
  if v_abn is not null and char_length(v_abn) > 20 then
    raise exception 'SUBCONTRACTOR_ABN_INVALID' using errcode = '23514';
  end if;
  if v_gst is not null and char_length(v_gst) > 20 then
    raise exception 'SUBCONTRACTOR_GST_INVALID' using errcode = '23514';
  end if;
  if v_gst_registration is not null and v_gst_registration not in ('yes', 'no', 'unknown') then
    raise exception 'SUBCONTRACTOR_GST_REGISTRATION_INVALID' using errcode = '23514';
  end if;
  if v_minimum is not null and char_length(v_minimum) > 2000 then
    raise exception 'SUBCONTRACTOR_MINIMUM_INVALID' using errcode = '23514';
  end if;
  if v_travel is not null and char_length(v_travel) > 2000 then
    raise exception 'SUBCONTRACTOR_TRAVEL_INVALID' using errcode = '23514';
  end if;

  select coalesce(array_agg(distinct btrim(item) order by btrim(item)), '{}'::text[])
    into v_areas
  from jsonb_array_elements_text(coalesce(p_payload->'work_area_types', '[]'::jsonb)) as item
  where btrim(item) <> '';

  v_areas := coalesce(v_areas, '{}'::text[]);
  if cardinality(v_areas) > 30 or not v_areas <@ v_known then
    raise exception 'SUBCONTRACTOR_WORK_AREA_UNKNOWN'
      using errcode = '23514';
  end if;

  for v_text in
    select btrim(item)
    from jsonb_array_elements_text(coalesce(p_payload->'service_regions', '[]'::jsonb)) as item
    where btrim(item) <> ''
  loop
    v_code := public.subcontractor_region_code(v_text);
    if v_code is null then
      if char_length(v_text) > 80 then
        raise exception 'SUBCONTRACTOR_REGION_INVALID' using errcode = '23514';
      end if;
      v_codes := array_append(v_codes, 'other');
      v_labels := v_labels || v_text;
    else
      v_codes := v_codes || v_code;
    end if;
  end loop;

  for v_text in
    select btrim(item)
    from jsonb_array_elements_text(coalesce(p_payload->'service_region_other_labels', '[]'::jsonb)) as item
    where btrim(item) <> ''
  loop
    if char_length(v_text) > 80 then
      raise exception 'SUBCONTRACTOR_REGION_INVALID' using errcode = '23514';
    end if;
    v_codes := array_append(v_codes, 'other');
    v_labels := v_labels || v_text;
  end loop;

  select coalesce(array_agg(distinct code order by code), '{}'::text[])
    into v_regions
  from unnest(v_codes) as code;
  select coalesce(array_agg(distinct label order by label), '{}'::text[])
    into v_other_labels
  from unnest(v_labels) as label;
  v_regions := coalesce(v_regions, '{}'::text[]);
  v_other_labels := coalesce(v_other_labels, '{}'::text[]);
  if cardinality(v_regions) > 20 or cardinality(v_other_labels) > 20 then
    raise exception 'SUBCONTRACTOR_REGION_INVALID' using errcode = '23514';
  end if;

  begin
    v_id := nullif(btrim(coalesce(p_payload->>'id', '')), '')::uuid;
  exception
    when invalid_text_representation then
      raise exception 'SUBCONTRACTOR_ID_INVALID'
        using errcode = '22P02';
  end;

  if v_id is null then
    insert into public.subcontractors (
      org_id,
      created_by,
      trading_name,
      legal_name,
      website,
      country,
      country_code,
      address_line_1,
      address_line_2,
      address_city,
      address_region,
      address_postcode,
      service_regions,
      service_region_other_labels,
      work_area_types,
      specialties,
      internal_notes,
      preferred_pricing_method,
      currency,
      abn,
      nzbn,
      gst_registration,
      gst_number,
      minimum_charge_notes,
      travel_notes
    ) values (
      v_org,
      v_uid,
      v_trading,
      v_legal,
      v_website,
      v_country,
      v_country_code,
      v_line1,
      v_line2,
      v_city,
      v_address_region,
      v_postcode,
      v_regions,
      v_other_labels,
      v_areas,
      v_specialties,
      v_notes,
      v_method,
      v_currency,
      v_abn,
      v_nzbn,
      v_gst_registration,
      v_gst,
      v_minimum,
      v_travel
    )
    returning id into v_id;
  else
    update public.subcontractors
      set trading_name = v_trading,
          legal_name = v_legal,
          website = v_website,
          country = v_country,
          country_code = v_country_code,
          address_line_1 = v_line1,
          address_line_2 = v_line2,
          address_city = v_city,
          address_region = v_address_region,
          address_postcode = v_postcode,
          service_regions = v_regions,
          service_region_other_labels = v_other_labels,
          work_area_types = v_areas,
          specialties = v_specialties,
          internal_notes = v_notes,
          preferred_pricing_method = v_method,
          currency = v_currency,
          abn = v_abn,
          nzbn = v_nzbn,
          gst_registration = v_gst_registration,
          gst_number = v_gst,
          minimum_charge_notes = v_minimum,
          travel_notes = v_travel
      where id = v_id
        and org_id = v_org
        and archived_at is null
      returning id into v_updated;

    if v_updated is null then
      raise exception 'SUBCONTRACTOR_NOT_FOUND'
        using errcode = 'P0002';
    end if;
  end if;

  update public.subcontractor_contacts
    set is_primary = false
    where subcontractor_id = v_id
      and org_id = v_org
      and is_primary;

  for v_item in
    select elem
    from jsonb_array_elements(v_contacts) as contacts(elem)
  loop
    v_name := btrim(coalesce(v_item.elem->>'name', ''));
    if char_length(v_name) < 1 or char_length(v_name) > 160 then
      raise exception 'SUBCONTRACTOR_CONTACT_NAME_INVALID' using errcode = '23514';
    end if;
    v_role := nullif(btrim(coalesce(v_item.elem->>'role', '')), '');
    v_email := nullif(btrim(coalesce(v_item.elem->>'email', '')), '');
    v_phone := nullif(btrim(coalesce(v_item.elem->>'phone', '')), '');
    v_preferred := nullif(btrim(coalesce(v_item.elem->>'preferred_contact', '')), '');
    v_primary := coalesce(v_item.elem->>'is_primary', 'false') = 'true';
    if v_role is not null and char_length(v_role) > 80 then
      raise exception 'SUBCONTRACTOR_CONTACT_ROLE_INVALID' using errcode = '23514';
    end if;
    if v_email is not null and (
      char_length(v_email) > 254
      or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    ) then
      raise exception 'SUBCONTRACTOR_CONTACT_EMAIL_INVALID' using errcode = '23514';
    end if;
    if v_phone is not null and char_length(v_phone) > 40 then
      raise exception 'SUBCONTRACTOR_CONTACT_PHONE_INVALID' using errcode = '23514';
    end if;
    if v_preferred is not null and v_preferred not in ('email', 'phone', 'either') then
      raise exception 'SUBCONTRACTOR_CONTACT_PREFERRED_INVALID' using errcode = '23514';
    end if;

    begin
      v_contact_id := nullif(btrim(coalesce(v_item.elem->>'id', '')), '')::uuid;
    exception
      when invalid_text_representation then
        raise exception 'SUBCONTRACTOR_CONTACT_ID_INVALID' using errcode = '22P02';
    end;

    if v_contact_id is null then
      insert into public.subcontractor_contacts (
        org_id, subcontractor_id, created_by, name, role, email, phone, is_primary, preferred_contact
      ) values (
        v_org, v_id, v_uid, v_name, v_role, v_email, v_phone, v_primary, v_preferred
      )
      returning id into v_contact_id;
    else
      update public.subcontractor_contacts
        set name = v_name,
            role = v_role,
            email = v_email,
            phone = v_phone,
            is_primary = v_primary,
            preferred_contact = v_preferred,
            archived_at = null
        where id = v_contact_id
          and subcontractor_id = v_id
          and org_id = v_org
        returning id into v_updated;
      if v_updated is null then
        raise exception 'SUBCONTRACTOR_CONTACT_NOT_FOUND' using errcode = 'P0002';
      end if;
    end if;

    v_keep_contacts := v_keep_contacts || v_contact_id;
  end loop;

  update public.subcontractor_contacts
    set archived_at = now(),
        is_primary = false
    where subcontractor_id = v_id
      and org_id = v_org
      and archived_at is null
      and not (id = any (v_keep_contacts));

  if v_sync_documents then
    for v_item in
      select elem
      from jsonb_array_elements(v_documents) as documents(elem)
    loop
      v_kind := btrim(coalesce(v_item.elem->>'document_kind', ''));
      v_title := btrim(coalesce(v_item.elem->>'title', ''));
      v_reference := nullif(btrim(coalesce(v_item.elem->>'reference', '')), '');
      v_doc_notes := nullif(btrim(coalesce(v_item.elem->>'notes', '')), '');
      if v_kind not in ('licence', 'insurance', 'capability_statement', 'rate_schedule', 'other') then
        raise exception 'SUBCONTRACTOR_DOCUMENT_KIND_INVALID' using errcode = '23514';
      end if;
      if char_length(v_title) < 1 or char_length(v_title) > 160 then
        raise exception 'SUBCONTRACTOR_DOCUMENT_TITLE_INVALID' using errcode = '23514';
      end if;
      if v_reference is not null and char_length(v_reference) > 80 then
        raise exception 'SUBCONTRACTOR_DOCUMENT_REFERENCE_INVALID' using errcode = '23514';
      end if;
      if v_doc_notes is not null and char_length(v_doc_notes) > 2000 then
        raise exception 'SUBCONTRACTOR_DOCUMENT_NOTES_INVALID' using errcode = '23514';
      end if;
      if nullif(btrim(coalesce(v_item.elem->>'expires_on', '')), '') is null then
        v_expires := null;
      else
        begin
          v_expires := btrim(v_item.elem->>'expires_on')::date;
        exception
          when others then
            raise exception 'SUBCONTRACTOR_DOCUMENT_EXPIRY_INVALID' using errcode = '23514';
        end;
      end if;

      begin
        v_document_id := nullif(btrim(coalesce(v_item.elem->>'id', '')), '')::uuid;
      exception
        when invalid_text_representation then
          raise exception 'SUBCONTRACTOR_DOCUMENT_ID_INVALID' using errcode = '22P02';
      end;

      if v_document_id is null then
        insert into public.subcontractor_documents (
          org_id, subcontractor_id, created_by, document_kind, title, reference, expires_on, notes
        ) values (
          v_org, v_id, v_uid, v_kind, v_title, v_reference, v_expires, v_doc_notes
        )
        returning id into v_document_id;
      else
        update public.subcontractor_documents
          set document_kind = v_kind,
              title = v_title,
              reference = v_reference,
              expires_on = v_expires,
              notes = v_doc_notes,
              archived_at = null
          where id = v_document_id
            and subcontractor_id = v_id
            and org_id = v_org
          returning id into v_updated;
        if v_updated is null then
          raise exception 'SUBCONTRACTOR_DOCUMENT_NOT_FOUND' using errcode = 'P0002';
        end if;
      end if;

      v_keep_documents := v_keep_documents || v_document_id;
    end loop;

    update public.subcontractor_documents
      set archived_at = now()
      where subcontractor_id = v_id
        and org_id = v_org
        and archived_at is null
        and not (id = any (v_keep_documents));
  end if;

  return v_id;
end;
$$;

comment on function public.save_subcontractor_v1(jsonb) is
  'Creates or updates one organisation subcontractor and its people. Document rows are replaced only when the payload includes documents. Does not write gst_notes, rates, estimates, quotes, or projects. Security invoker.';

create or replace function public.prepare_subcontractor_document_upload_v1(
  p_subcontractor uuid,
  p_kind text,
  p_title text,
  p_expires text,
  p_notes text,
  p_filename text,
  p_mime text,
  p_byte_size bigint
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_id uuid;
  v_kind text := btrim(coalesce(p_kind, ''));
  v_title text := btrim(coalesce(p_title, ''));
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_file text;
  v_safe text;
  v_path text;
  v_expires date;
begin
  if v_uid is null or public.auth_org_id() is null or not public.auth_can_mutate_work() then
    raise exception 'SUBCONTRACTOR_FORBIDDEN' using errcode = '42501';
  end if;

  select org_id into v_org
  from public.subcontractors
  where id = p_subcontractor
    and archived_at is null;

  if v_org is null or v_org <> public.auth_org_id() then
    raise exception 'SUBCONTRACTOR_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_kind not in ('licence', 'insurance', 'capability_statement', 'rate_schedule', 'other') then
    raise exception 'SUBCONTRACTOR_DOCUMENT_KIND_INVALID' using errcode = '23514';
  end if;
  if char_length(v_title) < 1 or char_length(v_title) > 160 then
    raise exception 'SUBCONTRACTOR_DOCUMENT_TITLE_INVALID' using errcode = '23514';
  end if;
  if v_notes is not null and char_length(v_notes) > 2000 then
    raise exception 'SUBCONTRACTOR_DOCUMENT_NOTES_INVALID' using errcode = '23514';
  end if;
  if nullif(btrim(coalesce(p_expires, '')), '') is null then
    v_expires := null;
  else
    begin
      v_expires := btrim(p_expires)::date;
    exception
      when others then
        raise exception 'SUBCONTRACTOR_DOCUMENT_EXPIRY_INVALID' using errcode = '23514';
    end;
  end if;
  if p_mime not in (
    'image/jpeg',
    'image/png',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) then
    raise exception 'SUBCONTRACTOR_DOCUMENT_FILE_INVALID' using errcode = '23514';
  end if;
  if p_byte_size is null or p_byte_size <= 0 or p_byte_size > 15728640 then
    raise exception 'SUBCONTRACTOR_DOCUMENT_FILE_INVALID' using errcode = '23514';
  end if;

  v_file := regexp_replace(btrim(coalesce(p_filename, '')), '^.*[/\\]', '');
  if v_file = '' or char_length(v_file) > 180 or v_file like '%..%' then
    raise exception 'SUBCONTRACTOR_DOCUMENT_FILE_INVALID' using errcode = '23514';
  end if;
  if p_mime = 'application/pdf' and right(lower(v_file), 4) <> '.pdf' then
    raise exception 'SUBCONTRACTOR_DOCUMENT_FILE_INVALID' using errcode = '23514';
  end if;
  if p_mime = 'image/png' and right(lower(v_file), 4) <> '.png' then
    raise exception 'SUBCONTRACTOR_DOCUMENT_FILE_INVALID' using errcode = '23514';
  end if;
  if p_mime = 'image/jpeg' and right(lower(v_file), 4) <> '.jpg' and right(lower(v_file), 5) <> '.jpeg' then
    raise exception 'SUBCONTRACTOR_DOCUMENT_FILE_INVALID' using errcode = '23514';
  end if;
  if p_mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    and right(lower(v_file), 5) <> '.docx' then
    raise exception 'SUBCONTRACTOR_DOCUMENT_FILE_INVALID' using errcode = '23514';
  end if;
  if p_mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    and right(lower(v_file), 5) <> '.xlsx' then
    raise exception 'SUBCONTRACTOR_DOCUMENT_FILE_INVALID' using errcode = '23514';
  end if;

  v_safe := regexp_replace(v_file, '[^A-Za-z0-9._-]', '_', 'g');
  v_id := gen_random_uuid();
  v_path := v_org::text || '/' || p_subcontractor::text || '/' || v_id::text || '/' || v_safe;

  perform set_config('quotr.subcontractor_file_write', 'on', true);
  insert into public.subcontractor_documents (
    id,
    org_id,
    subcontractor_id,
    created_by,
    document_kind,
    title,
    expires_on,
    notes,
    original_filename,
    mime_type,
    byte_size,
    storage_object_path,
    upload_status
  ) values (
    v_id,
    v_org,
    p_subcontractor,
    v_uid,
    v_kind,
    v_title,
    v_expires,
    v_notes,
    v_file,
    p_mime,
    p_byte_size,
    v_path,
    'pending'
  );
  return v_id;
end;
$$;

create or replace function public.complete_subcontractor_document_upload_v1(
  p_document uuid,
  p_byte_size bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('quotr.subcontractor_file_write', 'on', true);
  update public.subcontractor_documents
    set upload_status = 'ready',
        byte_size = p_byte_size
    where id = p_document
      and upload_status = 'pending'
      and storage_object_path is not null
      and byte_size = p_byte_size
      and storage_object_path like org_id::text || '/%'
      and storage_object_path !~ '\.\.';
  if not found then
    raise exception 'SUBCONTRACTOR_DOCUMENT_NOT_READY' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.fail_subcontractor_document_upload_v1(p_document uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('quotr.subcontractor_file_write', 'on', true);
  update public.subcontractor_documents
    set upload_status = 'failed',
        storage_object_path = null,
        byte_size = null
    where id = p_document
      and upload_status = 'pending';
end;
$$;

create or replace function public.retire_subcontractor_document_file_v1(p_document uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('quotr.subcontractor_file_write', 'on', true);
  update public.subcontractor_documents
    set archived_at = coalesce(archived_at, now()),
        storage_object_path = null,
        upload_status = null,
        byte_size = null,
        mime_type = null
    where id = p_document;
  if not found then
    raise exception 'SUBCONTRACTOR_DOCUMENT_NOT_FOUND' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.subcontractor_region_code(text) from public, anon;
grant execute on function public.subcontractor_region_code(text) to authenticated, service_role;

revoke all on function public.subcontractor_region_codes_known(text[]) from public, anon;
grant execute on function public.subcontractor_region_codes_known(text[]) to authenticated, service_role;

revoke all on function public.subcontractor_other_region_labels_ok(text[]) from public, anon;
grant execute on function public.subcontractor_other_region_labels_ok(text[]) to authenticated, service_role;

revoke all on function public.protect_subcontractor_document_file() from public, anon, authenticated;

revoke all on function public.prepare_subcontractor_document_upload_v1(uuid, text, text, text, text, text, text, bigint) from public, anon;
grant execute on function public.prepare_subcontractor_document_upload_v1(uuid, text, text, text, text, text, text, bigint) to authenticated, service_role;

revoke all on function public.complete_subcontractor_document_upload_v1(uuid, bigint) from public, anon, authenticated;
grant execute on function public.complete_subcontractor_document_upload_v1(uuid, bigint) to service_role;

revoke all on function public.fail_subcontractor_document_upload_v1(uuid) from public, anon, authenticated;
grant execute on function public.fail_subcontractor_document_upload_v1(uuid) to service_role;

revoke all on function public.retire_subcontractor_document_file_v1(uuid) from public, anon, authenticated;
grant execute on function public.retire_subcontractor_document_file_v1(uuid) to service_role;

notify pgrst, 'reload schema';
