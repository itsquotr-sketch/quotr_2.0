-- Repair save_subcontractor_v1.
-- An untyped other literal was parsed as an array literal.
-- Does not change customers, projects, quotes, estimates, rates, or Quote GST.

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

notify pgrst, 'reload schema';
