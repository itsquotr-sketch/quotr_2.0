-- Organisation subcontractor directory (Contacts phase 1).
-- Does not alter public.customers, public.projects, public.rates, estimates,
-- quotes, pricing, or the estimate rate resolver.
-- A work-area capability tag is not a priced rate and is not a quotation.
-- Document rows are private metadata only: no storage object and no upload.
-- There is no public portal, outbound email, or RFQ table in this migration.
-- Later RFQs, responses, job-specific offers, and reusable rate entries can
-- reference subcontractors.id. They must not be inferred from capability tags.
-- Archive is an update of archived_at. Authenticated has no DELETE.

create or replace function public.subcontractor_capability_tags_ok(tags text[])
returns boolean
language sql
immutable
parallel safe
set search_path = public
as $$
  select
    tags is not null
    and cardinality(tags) <= 30
    and tags <@ array[
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
      'cladding',
      'plastering'
    ]::text[]
$$;

create or replace function public.subcontractor_regions_ok(regions text[])
returns boolean
language sql
immutable
parallel safe
set search_path = public
as $$
  select
    regions is not null
    and cardinality(regions) <= 20
    and not exists (
      select 1
      from unnest(regions) as region
      where region is null
        or char_length(btrim(region)) < 1
        or char_length(region) > 80
    )
$$;

create table if not exists public.subcontractors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  trading_name text not null,
  legal_name text,
  website text,
  country text,
  service_regions text[] not null default '{}',
  work_area_types text[] not null default '{}',
  specialties text,
  internal_notes text,
  preferred_pricing_method text,
  currency text,
  abn text,
  gst_number text,
  gst_notes text,
  minimum_charge_notes text,
  travel_notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  constraint subcontractors_trading_name_len check (char_length(btrim(trading_name)) between 1 and 160),
  constraint subcontractors_legal_name_len check (legal_name is null or char_length(btrim(legal_name)) between 1 and 160),
  constraint subcontractors_website_len check (website is null or char_length(btrim(website)) between 1 and 300),
  constraint subcontractors_country_len check (country is null or char_length(btrim(country)) between 1 and 80),
  constraint subcontractors_specialties_len check (specialties is null or char_length(specialties) <= 500),
  constraint subcontractors_notes_len check (internal_notes is null or char_length(internal_notes) <= 5000),
  constraint subcontractors_pricing_method_known check (
    preferred_pricing_method is null
    or preferred_pricing_method in ('hourly', 'fixed', 'unit_rate', 'schedule_of_rates', 'quoted')
  ),
  constraint subcontractors_currency_code check (currency is null or currency ~ '^[A-Z]{3}$'),
  constraint subcontractors_abn_len check (abn is null or char_length(btrim(abn)) between 1 and 20),
  constraint subcontractors_gst_number_len check (gst_number is null or char_length(btrim(gst_number)) between 1 and 20),
  constraint subcontractors_gst_notes_len check (gst_notes is null or char_length(gst_notes) <= 2000),
  constraint subcontractors_minimum_charge_notes_len check (
    minimum_charge_notes is null or char_length(minimum_charge_notes) <= 2000
  ),
  constraint subcontractors_travel_notes_len check (travel_notes is null or char_length(travel_notes) <= 2000),
  constraint subcontractors_capability_tags_ok check (public.subcontractor_capability_tags_ok(work_area_types)),
  constraint subcontractors_regions_ok check (public.subcontractor_regions_ok(service_regions))
);

comment on table public.subcontractors is
  'Organisation-owned subcontractor businesses. Capability tags suggest relevance for a job work area. They are not rates, quotations, or verified credentials.';

comment on column public.subcontractors.work_area_types is
  'Product work-area types this business can be suggested for. Not a priced rate and not read by the estimate rate resolver.';

comment on column public.subcontractors.abn is
  'ABN as supplied by the organisation. Not verified.';

comment on column public.subcontractors.gst_number is
  'GST number as supplied by the organisation. Not verified.';

comment on column public.subcontractors.minimum_charge_notes is
  'Free-text commercial note. Not a numeric cost and not a rate-resolver fallback.';

comment on column public.subcontractors.archived_at is
  'Soft archive. Historical links stay. Authenticated users cannot hard-delete the row.';

create table if not exists public.subcontractor_contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  subcontractor_id uuid not null references public.subcontractors (id) on delete cascade,
  name text not null,
  role text,
  email text,
  phone text,
  is_primary boolean not null default false,
  preferred_contact text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  constraint subcontractor_contacts_name_len check (char_length(btrim(name)) between 1 and 160),
  constraint subcontractor_contacts_role_len check (role is null or char_length(btrim(role)) between 1 and 80),
  constraint subcontractor_contacts_email_len check (email is null or char_length(btrim(email)) between 1 and 254),
  constraint subcontractor_contacts_email_format check (
    email is null or email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  constraint subcontractor_contacts_phone_len check (phone is null or char_length(btrim(phone)) between 1 and 40),
  constraint subcontractor_contacts_preferred_known check (
    preferred_contact is null or preferred_contact in ('email', 'phone', 'either')
  )
);

comment on table public.subcontractor_contacts is
  'People at a subcontractor business. Email and phone are not unique, including a shared office address.';

comment on column public.subcontractor_contacts.email is
  'Optional. Not unique. Blank emails are stored as null.';

comment on column public.subcontractor_contacts.preferred_contact is
  'Preferred way to reach this person, as supplied. Not a verified channel.';

create unique index if not exists subcontractor_contacts_one_primary_uidx
  on public.subcontractor_contacts (subcontractor_id)
  where is_primary and archived_at is null;

create table if not exists public.subcontractor_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  subcontractor_id uuid not null references public.subcontractors (id) on delete cascade,
  document_kind text not null,
  title text not null,
  reference text,
  expires_on date,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  constraint subcontractor_documents_kind_known check (
    document_kind in ('licence', 'insurance', 'capability_statement')
  ),
  constraint subcontractor_documents_title_len check (char_length(btrim(title)) between 1 and 160),
  constraint subcontractor_documents_reference_len check (
    reference is null or char_length(btrim(reference)) between 1 and 80
  ),
  constraint subcontractor_documents_notes_len check (notes is null or char_length(notes) <= 2000)
);

comment on table public.subcontractor_documents is
  'Private metadata for licences, insurance, and capability statements. No file bytes, bucket, or signed URL. Expiry is the date supplied by the organisation and is not a verification.';

create index if not exists subcontractors_org_id_idx
  on public.subcontractors (org_id);

create index if not exists subcontractors_org_active_name_idx
  on public.subcontractors (org_id, trading_name)
  where archived_at is null;

create index if not exists subcontractors_work_area_types_gin
  on public.subcontractors using gin (work_area_types);

create index if not exists subcontractor_contacts_org_id_idx
  on public.subcontractor_contacts (org_id);

create index if not exists subcontractor_contacts_business_active_idx
  on public.subcontractor_contacts (subcontractor_id)
  where archived_at is null;

create index if not exists subcontractor_documents_org_id_idx
  on public.subcontractor_documents (org_id);

create index if not exists subcontractor_documents_business_active_idx
  on public.subcontractor_documents (subcontractor_id)
  where archived_at is null;

create index if not exists subcontractor_documents_expiry_idx
  on public.subcontractor_documents (org_id, expires_on)
  where expires_on is not null and archived_at is null;

create or replace function public.normalise_subcontractor()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.trading_name := btrim(coalesce(new.trading_name, ''));
  new.legal_name := nullif(btrim(coalesce(new.legal_name, '')), '');
  new.website := nullif(btrim(coalesce(new.website, '')), '');
  new.country := nullif(btrim(coalesce(new.country, '')), '');
  new.specialties := nullif(btrim(coalesce(new.specialties, '')), '');
  new.internal_notes := nullif(btrim(coalesce(new.internal_notes, '')), '');
  new.preferred_pricing_method := nullif(btrim(coalesce(new.preferred_pricing_method, '')), '');
  new.currency := nullif(upper(btrim(coalesce(new.currency, ''))), '');
  new.abn := nullif(btrim(coalesce(new.abn, '')), '');
  new.gst_number := nullif(btrim(coalesce(new.gst_number, '')), '');
  new.gst_notes := nullif(btrim(coalesce(new.gst_notes, '')), '');
  new.minimum_charge_notes := nullif(btrim(coalesce(new.minimum_charge_notes, '')), '');
  new.travel_notes := nullif(btrim(coalesce(new.travel_notes, '')), '');
  new.work_area_types := coalesce(
    (
      select array_agg(distinct btrim(item) order by btrim(item))
      from unnest(coalesce(new.work_area_types, '{}'::text[])) as item
      where btrim(item) <> ''
    ),
    '{}'::text[]
  );
  new.service_regions := coalesce(
    (
      select array_agg(distinct btrim(item) order by btrim(item))
      from unnest(coalesce(new.service_regions, '{}'::text[])) as item
      where btrim(item) <> ''
    ),
    '{}'::text[]
  );
  return new;
end;
$$;

create or replace function public.protect_subcontractor_organisation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.org_id is distinct from old.org_id then
    raise exception 'SUBCONTRACTOR_ORG_IMMUTABLE'
      using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.created_by is distinct from old.created_by then
    raise exception 'SUBCONTRACTOR_CREATED_BY_IMMUTABLE'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.normalise_subcontractor_contact()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.name := btrim(coalesce(new.name, ''));
  new.role := nullif(btrim(coalesce(new.role, '')), '');
  new.email := nullif(btrim(coalesce(new.email, '')), '');
  new.phone := nullif(btrim(coalesce(new.phone, '')), '');
  new.preferred_contact := nullif(btrim(coalesce(new.preferred_contact, '')), '');
  return new;
end;
$$;

create or replace function public.normalise_subcontractor_document()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.title := btrim(coalesce(new.title, ''));
  new.reference := nullif(btrim(coalesce(new.reference, '')), '');
  new.notes := nullif(btrim(coalesce(new.notes, '')), '');
  new.document_kind := btrim(coalesce(new.document_kind, ''));
  return new;
end;
$$;

create or replace function public.enforce_subcontractor_child_same_org()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_org uuid;
begin
  if tg_op = 'UPDATE' and new.org_id is distinct from old.org_id then
    raise exception 'SUBCONTRACTOR_CHILD_ORG_IMMUTABLE'
      using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.subcontractor_id is distinct from old.subcontractor_id then
    raise exception 'SUBCONTRACTOR_CHILD_PARENT_IMMUTABLE'
      using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.created_by is distinct from old.created_by then
    raise exception 'SUBCONTRACTOR_CHILD_CREATED_BY_IMMUTABLE'
      using errcode = '42501';
  end if;

  select s.org_id
    into v_org
  from public.subcontractors s
  where s.id = new.subcontractor_id;

  if v_org is null or v_org is distinct from new.org_id then
    raise exception 'SUBCONTRACTOR_CHILD_ORG_MISMATCH'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists subcontractors_normalise on public.subcontractors;
create trigger subcontractors_normalise
  before insert or update on public.subcontractors
  for each row
  execute function public.normalise_subcontractor();

drop trigger if exists subcontractors_protect_organisation on public.subcontractors;
create trigger subcontractors_protect_organisation
  before update on public.subcontractors
  for each row
  execute function public.protect_subcontractor_organisation();

drop trigger if exists set_updated_at on public.subcontractors;
create trigger set_updated_at
  before update on public.subcontractors
  for each row
  execute function public.set_updated_at();

drop trigger if exists subcontractor_contacts_normalise on public.subcontractor_contacts;
create trigger subcontractor_contacts_normalise
  before insert or update on public.subcontractor_contacts
  for each row
  execute function public.normalise_subcontractor_contact();

drop trigger if exists subcontractor_contacts_same_org on public.subcontractor_contacts;
create trigger subcontractor_contacts_same_org
  before insert or update on public.subcontractor_contacts
  for each row
  execute function public.enforce_subcontractor_child_same_org();

drop trigger if exists set_updated_at on public.subcontractor_contacts;
create trigger set_updated_at
  before update on public.subcontractor_contacts
  for each row
  execute function public.set_updated_at();

drop trigger if exists subcontractor_documents_normalise on public.subcontractor_documents;
create trigger subcontractor_documents_normalise
  before insert or update on public.subcontractor_documents
  for each row
  execute function public.normalise_subcontractor_document();

drop trigger if exists subcontractor_documents_same_org on public.subcontractor_documents;
create trigger subcontractor_documents_same_org
  before insert or update on public.subcontractor_documents
  for each row
  execute function public.enforce_subcontractor_child_same_org();

drop trigger if exists set_updated_at on public.subcontractor_documents;
create trigger set_updated_at
  before update on public.subcontractor_documents
  for each row
  execute function public.set_updated_at();

alter table public.subcontractors enable row level security;
alter table public.subcontractor_contacts enable row level security;
alter table public.subcontractor_documents enable row level security;

revoke all on table public.subcontractors from public, anon, authenticated;
revoke all on table public.subcontractor_contacts from public, anon, authenticated;
revoke all on table public.subcontractor_documents from public, anon, authenticated;
grant select, insert, update on table public.subcontractors to authenticated;
grant select, insert, update on table public.subcontractor_contacts to authenticated;
grant select, insert, update on table public.subcontractor_documents to authenticated;
grant select, insert, update, delete on table public.subcontractors to service_role;
grant select, insert, update, delete on table public.subcontractor_contacts to service_role;
grant select, insert, update, delete on table public.subcontractor_documents to service_role;

drop policy if exists subcontractors_select_active_member on public.subcontractors;
create policy subcontractors_select_active_member
  on public.subcontractors
  for select
  to authenticated
  using (
    org_id = public.auth_org_id()
    and exists (
      select 1
      from public.organisation_memberships m
      where m.user_id = auth.uid()
        and m.org_id = subcontractors.org_id
        and m.status = 'active'
    )
  );

drop policy if exists subcontractors_insert_active_work_role on public.subcontractors;
create policy subcontractors_insert_active_work_role
  on public.subcontractors
  for insert
  to authenticated
  with check (
    org_id = public.auth_org_id()
    and created_by = auth.uid()
    and public.auth_can_mutate_work()
  );

drop policy if exists subcontractors_update_active_work_role on public.subcontractors;
create policy subcontractors_update_active_work_role
  on public.subcontractors
  for update
  to authenticated
  using (
    org_id = public.auth_org_id()
    and public.auth_can_mutate_work()
  )
  with check (
    org_id = public.auth_org_id()
    and public.auth_can_mutate_work()
  );

drop policy if exists subcontractor_contacts_select_active_member on public.subcontractor_contacts;
create policy subcontractor_contacts_select_active_member
  on public.subcontractor_contacts
  for select
  to authenticated
  using (
    org_id = public.auth_org_id()
    and exists (
      select 1
      from public.organisation_memberships m
      where m.user_id = auth.uid()
        and m.org_id = subcontractor_contacts.org_id
        and m.status = 'active'
    )
  );

drop policy if exists subcontractor_contacts_insert_active_work_role on public.subcontractor_contacts;
create policy subcontractor_contacts_insert_active_work_role
  on public.subcontractor_contacts
  for insert
  to authenticated
  with check (
    org_id = public.auth_org_id()
    and created_by = auth.uid()
    and public.auth_can_mutate_work()
    and exists (
      select 1
      from public.subcontractors s
      where s.id = subcontractor_id
        and s.org_id = subcontractor_contacts.org_id
    )
  );

drop policy if exists subcontractor_contacts_update_active_work_role on public.subcontractor_contacts;
create policy subcontractor_contacts_update_active_work_role
  on public.subcontractor_contacts
  for update
  to authenticated
  using (
    org_id = public.auth_org_id()
    and public.auth_can_mutate_work()
  )
  with check (
    org_id = public.auth_org_id()
    and public.auth_can_mutate_work()
  );

drop policy if exists subcontractor_documents_select_active_member on public.subcontractor_documents;
create policy subcontractor_documents_select_active_member
  on public.subcontractor_documents
  for select
  to authenticated
  using (
    org_id = public.auth_org_id()
    and exists (
      select 1
      from public.organisation_memberships m
      where m.user_id = auth.uid()
        and m.org_id = subcontractor_documents.org_id
        and m.status = 'active'
    )
  );

drop policy if exists subcontractor_documents_insert_active_work_role on public.subcontractor_documents;
create policy subcontractor_documents_insert_active_work_role
  on public.subcontractor_documents
  for insert
  to authenticated
  with check (
    org_id = public.auth_org_id()
    and created_by = auth.uid()
    and public.auth_can_mutate_work()
    and exists (
      select 1
      from public.subcontractors s
      where s.id = subcontractor_id
        and s.org_id = subcontractor_documents.org_id
    )
  );

drop policy if exists subcontractor_documents_update_active_work_role on public.subcontractor_documents;
create policy subcontractor_documents_update_active_work_role
  on public.subcontractor_documents
  for update
  to authenticated
  using (
    org_id = public.auth_org_id()
    and public.auth_can_mutate_work()
  )
  with check (
    org_id = public.auth_org_id()
    and public.auth_can_mutate_work()
  );

-- No DELETE policy and no DELETE grant for authenticated.

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
  v_specialties text;
  v_notes text;
  v_method text;
  v_currency text;
  v_abn text;
  v_gst text;
  v_gst_notes text;
  v_minimum text;
  v_travel text;
  v_areas text[];
  v_regions text[];
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
  if p_payload ? 'documents' and jsonb_typeof(p_payload->'documents') <> 'array' then
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

  v_contacts := coalesce(p_payload->'contacts', '[]'::jsonb);
  v_documents := coalesce(p_payload->'documents', '[]'::jsonb);
  if jsonb_array_length(v_contacts) > 30 then
    raise exception 'SUBCONTRACTOR_CONTACTS_LIMIT'
      using errcode = '23514';
  end if;
  if jsonb_array_length(v_documents) > 30 then
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

  if (
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
  v_specialties := nullif(btrim(coalesce(p_payload->>'specialties', '')), '');
  v_notes := nullif(btrim(coalesce(p_payload->>'internal_notes', '')), '');
  v_method := nullif(btrim(coalesce(p_payload->>'preferred_pricing_method', '')), '');
  v_currency := nullif(upper(btrim(coalesce(p_payload->>'currency', ''))), '');
  v_abn := nullif(btrim(coalesce(p_payload->>'abn', '')), '');
  v_gst := nullif(btrim(coalesce(p_payload->>'gst_number', '')), '');
  v_gst_notes := nullif(btrim(coalesce(p_payload->>'gst_notes', '')), '');
  v_minimum := nullif(btrim(coalesce(p_payload->>'minimum_charge_notes', '')), '');
  v_travel := nullif(btrim(coalesce(p_payload->>'travel_notes', '')), '');

  if v_legal is not null and char_length(v_legal) > 160 then
    raise exception 'SUBCONTRACTOR_LEGAL_NAME_INVALID' using errcode = '23514';
  end if;
  if v_website is not null and char_length(v_website) > 300 then
    raise exception 'SUBCONTRACTOR_WEBSITE_INVALID' using errcode = '23514';
  end if;
  if v_country is not null and char_length(v_country) > 80 then
    raise exception 'SUBCONTRACTOR_COUNTRY_INVALID' using errcode = '23514';
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
  if v_gst_notes is not null and char_length(v_gst_notes) > 2000 then
    raise exception 'SUBCONTRACTOR_GST_NOTES_INVALID' using errcode = '23514';
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

  select coalesce(array_agg(distinct btrim(item) order by btrim(item)), '{}'::text[])
    into v_regions
  from jsonb_array_elements_text(coalesce(p_payload->'service_regions', '[]'::jsonb)) as item
  where btrim(item) <> '';

  v_regions := coalesce(v_regions, '{}'::text[]);
  if cardinality(v_regions) > 20 or exists (
    select 1 from unnest(v_regions) as region where char_length(region) > 80
  ) then
    raise exception 'SUBCONTRACTOR_REGION_INVALID'
      using errcode = '23514';
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
      service_regions,
      work_area_types,
      specialties,
      internal_notes,
      preferred_pricing_method,
      currency,
      abn,
      gst_number,
      gst_notes,
      minimum_charge_notes,
      travel_notes
    ) values (
      v_org,
      v_uid,
      v_trading,
      v_legal,
      v_website,
      v_country,
      v_regions,
      v_areas,
      v_specialties,
      v_notes,
      v_method,
      v_currency,
      v_abn,
      v_gst,
      v_gst_notes,
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
          service_regions = v_regions,
          work_area_types = v_areas,
          specialties = v_specialties,
          internal_notes = v_notes,
          preferred_pricing_method = v_method,
          currency = v_currency,
          abn = v_abn,
          gst_number = v_gst,
          gst_notes = v_gst_notes,
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

  for v_item in
    select elem
    from jsonb_array_elements(v_documents) as documents(elem)
  loop
    v_kind := btrim(coalesce(v_item.elem->>'document_kind', ''));
    v_title := btrim(coalesce(v_item.elem->>'title', ''));
    v_reference := nullif(btrim(coalesce(v_item.elem->>'reference', '')), '');
    v_doc_notes := nullif(btrim(coalesce(v_item.elem->>'notes', '')), '');
    if v_kind not in ('licence', 'insurance', 'capability_statement') then
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

  return v_id;
end;
$$;

comment on function public.save_subcontractor_v1(jsonb) is
  'Creates or updates one organisation subcontractor, its people, and document metadata. Ignores no client org id. Does not write rates, estimates, quotes, or projects. Security invoker: RLS and auth_can_mutate_work still apply.';

revoke all on function public.save_subcontractor_v1(jsonb) from public, anon;
grant execute on function public.save_subcontractor_v1(jsonb) to authenticated, service_role;

revoke all on function public.normalise_subcontractor() from public, anon, authenticated;
revoke all on function public.protect_subcontractor_organisation() from public, anon, authenticated;
revoke all on function public.normalise_subcontractor_contact() from public, anon, authenticated;
revoke all on function public.normalise_subcontractor_document() from public, anon, authenticated;
revoke all on function public.enforce_subcontractor_child_same_org() from public, anon, authenticated;
revoke all on function public.subcontractor_capability_tags_ok(text[]) from public, anon;
revoke all on function public.subcontractor_regions_ok(text[]) from public, anon;
grant execute on function public.subcontractor_capability_tags_ok(text[]) to authenticated, service_role;
grant execute on function public.subcontractor_regions_ok(text[]) to authenticated, service_role;

notify pgrst, 'reload schema';
