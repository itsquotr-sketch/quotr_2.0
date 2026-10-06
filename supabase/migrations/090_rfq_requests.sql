-- RFQ phase 2. Additive. Does not change customers, estimates, pricing,
-- quotes, variations, rates, or Quote GST.
--
-- Entitlement stays in the server action: projects.edit plus projects.create.
-- Builder, Business, and an active trial allow a write when the role can edit.
-- An expired trial denies projects.create. Viewer can read and cannot write.
-- This migration does not add a capability key.
--
-- A sent request freezes its wording and the selected project-document
-- versions. Delivery rows are not the response. An email send is not delivery
-- and is not a price. Inbound mail is not captured. Nothing here awards work
-- or writes a supplier rate.

create table if not exists public.rfqs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  status text not null default 'draft',
  scope_kind text not null,
  work_area_id uuid references public.work_areas (id) on delete set null,
  work_area_type text,
  work_area_name text,
  written_scope_label text,
  requested_scope text not null default '',
  measurement_notes text not null default '',
  response_due_on date,
  include_site_address boolean not null default false,
  site_address text not null default '',
  site_details text not null default '',
  questions text not null default '',
  message text not null default '',
  builder_name text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rfqs_status_known check (status in ('draft', 'sent')),
  constraint rfqs_scope_kind_known check (scope_kind in ('work_area', 'written')),
  constraint rfqs_scope_len check (char_length(requested_scope) <= 8000),
  constraint rfqs_measurement_len check (char_length(measurement_notes) <= 4000),
  constraint rfqs_site_len check (char_length(site_address) <= 500 and char_length(site_details) <= 4000),
  constraint rfqs_questions_len check (char_length(questions) <= 4000 and char_length(message) <= 4000),
  constraint rfqs_label_len check (
    written_scope_label is null or char_length(btrim(written_scope_label)) between 1 and 160
  )
);

comment on table public.rfqs is
  'A request for price sent to subcontractors. Sent rows are frozen. They do not contain client identity, estimate cost, margin, or pricing.';

create table if not exists public.rfq_recipients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  rfq_id uuid not null references public.rfqs (id) on delete cascade,
  subcontractor_id uuid not null references public.subcontractors (id) on delete restrict,
  contact_id uuid references public.subcontractor_contacts (id) on delete set null,
  trading_name text not null,
  contact_name text not null,
  contact_email text not null,
  suggestion_reason text,
  selection_source text not null,
  response_state text not null default 'awaiting',
  created_at timestamptz not null default now(),
  constraint rfq_recipients_source_known check (selection_source in ('suggested', 'manual')),
  constraint rfq_recipients_state_known check (
    response_state in ('awaiting', 'clarification', 'responded', 'declined', 'expired')
  ),
  constraint rfq_recipients_email_len check (char_length(btrim(contact_email)) between 3 and 320),
  constraint rfq_recipients_name_len check (
    char_length(btrim(trading_name)) between 1 and 160
    and char_length(btrim(contact_name)) between 1 and 160
  ),
  constraint rfq_recipients_reason_len check (
    suggestion_reason is null or char_length(suggestion_reason) <= 240
  ),
  constraint rfq_recipients_business_uidx unique (rfq_id, subcontractor_id)
);

comment on column public.rfq_recipients.response_state is
  'Awaiting means no response. It is not a decline. Expired is separate from declined.';

create table if not exists public.rfq_access_tokens (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  recipient_id uuid not null references public.rfq_recipients (id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  constraint rfq_access_tokens_hash_len check (char_length(token_hash) = 64),
  constraint rfq_access_tokens_hash_uidx unique (token_hash)
);

comment on table public.rfq_access_tokens is
  'Stores only the hash of one recipient link. Raw tokens are not stored.';

create table if not exists public.rfq_shared_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  rfq_id uuid not null references public.rfqs (id) on delete cascade,
  project_document_id uuid not null,
  project_document_version_id uuid not null references public.project_document_versions (id) on delete restrict,
  title text not null,
  display_filename text not null,
  mime_type text not null,
  byte_size bigint not null,
  storage_object_path text not null,
  visibility text not null,
  created_at timestamptz not null default now(),
  constraint rfq_shared_documents_version_uidx unique (rfq_id, project_document_version_id),
  constraint rfq_shared_documents_bytes check (byte_size > 0 and byte_size <= 15728640),
  constraint rfq_shared_documents_path_org check (
    storage_object_path like org_id::text || '/%' and storage_object_path not like '%..%'
  )
);

comment on table public.rfq_shared_documents is
  'Document versions explicitly selected for this request. A later project file does not replace them. Unselected files are not listed.';

create table if not exists public.rfq_deliveries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  recipient_id uuid not null references public.rfq_recipients (id) on delete cascade,
  status text not null default 'pending',
  provider text not null default 'resend',
  provider_message_id text,
  failure_code text,
  idempotency_key text not null,
  sent_at timestamptz,
  failed_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  constraint rfq_deliveries_status_known check (
    status in ('pending', 'sent', 'failed', 'delivered', 'bounced', 'complained')
  ),
  constraint rfq_deliveries_key_uidx unique (idempotency_key)
);

comment on table public.rfq_deliveries is
  'Email attempt state. Sent, failed, and delivered do not mean the subcontractor responded.';

create table if not exists public.rfq_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  rfq_id uuid not null references public.rfqs (id) on delete cascade,
  recipient_id uuid references public.rfq_recipients (id) on delete cascade,
  kind text not null,
  summary text not null,
  actor text not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  constraint rfq_events_actor_known check (actor in ('member', 'recipient', 'system')),
  constraint rfq_events_summary_len check (char_length(summary) between 1 and 300)
);

create unique index if not exists rfq_events_one_view_uidx
  on public.rfq_events (recipient_id)
  where kind = 'viewed';

create table if not exists public.rfq_clarifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  recipient_id uuid not null references public.rfq_recipients (id) on delete cascade,
  body text not null,
  from_recipient boolean not null default true,
  created_at timestamptz not null default now(),
  constraint rfq_clarifications_body_len check (char_length(btrim(body)) between 1 and 2000)
);

comment on table public.rfq_clarifications is
  'Questions about the request. A question is not a price and is not applied to the job.';

create table if not exists public.rfq_responses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  recipient_id uuid not null references public.rfq_recipients (id) on delete cascade,
  version_number integer not null,
  status text not null default 'draft',
  price_ex_gst numeric(14, 2),
  gst_treatment text,
  pricing_structure text,
  included_scope text not null default '',
  excluded_scope text not null default '',
  assumptions text not null default '',
  lead_time text not null default '',
  valid_until date,
  message text not null default '',
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rfq_responses_version_positive check (version_number > 0),
  constraint rfq_responses_version_uidx unique (recipient_id, version_number),
  constraint rfq_responses_status_known check (status in ('draft', 'submitted')),
  constraint rfq_responses_gst_known check (
    gst_treatment is null or gst_treatment in ('extra', 'none', 'unknown')
  ),
  constraint rfq_responses_structure_known check (
    pricing_structure is null or pricing_structure in ('lump_sum', 'itemised')
  ),
  constraint rfq_responses_price_range check (
    price_ex_gst is null or (price_ex_gst >= 0 and price_ex_gst <= 99999999.99)
  ),
  constraint rfq_responses_text_len check (
    char_length(included_scope) <= 4000
    and char_length(excluded_scope) <= 4000
    and char_length(assumptions) <= 4000
    and char_length(lead_time) <= 200
    and char_length(message) <= 4000
  )
);

comment on table public.rfq_responses is
  'A submitted row is kept. A revision is a new version. The price is ex GST and does not change Quote GST or supplier rates.';

create unique index if not exists rfq_responses_one_draft_uidx
  on public.rfq_responses (recipient_id)
  where status = 'draft';

create table if not exists public.rfq_response_files (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  response_id uuid not null references public.rfq_responses (id) on delete cascade,
  original_filename text not null,
  mime_type text,
  byte_size bigint,
  storage_object_path text,
  upload_status text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint rfq_response_files_response_uidx unique (response_id),
  constraint rfq_response_files_status_known check (upload_status in ('pending', 'ready', 'failed')),
  constraint rfq_response_files_bytes check (byte_size is null or (byte_size > 0 and byte_size <= 15728640)),
  constraint rfq_response_files_path_org check (
    storage_object_path is null
    or (storage_object_path like org_id::text || '/%' and storage_object_path not like '%..%')
  )
);

create table if not exists public.rfq_public_attempts (
  id bigint generated always as identity primary key,
  token_hash text not null,
  action text not null,
  created_at timestamptz not null default now()
);

create index if not exists rfq_public_attempts_window_idx
  on public.rfq_public_attempts (token_hash, action, created_at desc);

create index if not exists rfqs_project_idx on public.rfqs (project_id, created_at desc);
create index if not exists rfq_recipients_rfq_idx on public.rfq_recipients (rfq_id);
create index if not exists rfq_deliveries_message_idx on public.rfq_deliveries (provider_message_id);
create index if not exists rfq_events_rfq_idx on public.rfq_events (rfq_id, created_at);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'rfq-response-files',
  'rfq-response-files',
  false,
  15728640,
  array['application/pdf']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.rfqs enable row level security;
alter table public.rfq_recipients enable row level security;
alter table public.rfq_access_tokens enable row level security;
alter table public.rfq_shared_documents enable row level security;
alter table public.rfq_deliveries enable row level security;
alter table public.rfq_events enable row level security;
alter table public.rfq_clarifications enable row level security;
alter table public.rfq_responses enable row level security;
alter table public.rfq_response_files enable row level security;
alter table public.rfq_public_attempts enable row level security;

revoke all on table public.rfqs from public, anon, authenticated;
revoke all on table public.rfq_recipients from public, anon, authenticated;
revoke all on table public.rfq_access_tokens from public, anon, authenticated;
revoke all on table public.rfq_shared_documents from public, anon, authenticated;
revoke all on table public.rfq_deliveries from public, anon, authenticated;
revoke all on table public.rfq_events from public, anon, authenticated;
revoke all on table public.rfq_clarifications from public, anon, authenticated;
revoke all on table public.rfq_responses from public, anon, authenticated;
revoke all on table public.rfq_response_files from public, anon, authenticated;
revoke all on table public.rfq_public_attempts from public, anon, authenticated;

grant select on table public.rfqs to authenticated;
grant select on table public.rfq_recipients to authenticated;
grant select (
  id, org_id, rfq_id, project_document_id, project_document_version_id,
  title, display_filename, mime_type, byte_size, visibility, created_at
) on table public.rfq_shared_documents to authenticated;
grant select on table public.rfq_deliveries to authenticated;
grant select on table public.rfq_events to authenticated;
grant select on table public.rfq_clarifications to authenticated;
grant select on table public.rfq_responses to authenticated;
grant select (
  id, org_id, response_id, original_filename, mime_type, byte_size, upload_status, created_at
) on table public.rfq_response_files to authenticated;

grant select, insert, update, delete on table public.rfqs to service_role;
grant select, insert, update, delete on table public.rfq_recipients to service_role;
grant select, insert, update, delete on table public.rfq_access_tokens to service_role;
grant select, insert, update, delete on table public.rfq_shared_documents to service_role;
grant select, insert, update, delete on table public.rfq_deliveries to service_role;
grant select, insert, update, delete on table public.rfq_events to service_role;
grant select, insert, update, delete on table public.rfq_clarifications to service_role;
grant select, insert, update, delete on table public.rfq_responses to service_role;
grant select, insert, update, delete on table public.rfq_response_files to service_role;
grant select, insert, update, delete on table public.rfq_public_attempts to service_role;

create policy rfqs_select_active_member on public.rfqs
  for select to authenticated
  using (
    org_id = public.auth_org_id()
    and exists (
      select 1 from public.organisation_memberships m
      where m.user_id = auth.uid() and m.org_id = rfqs.org_id and m.status = 'active'
    )
  );

create policy rfq_recipients_select_active_member on public.rfq_recipients
  for select to authenticated
  using (
    org_id = public.auth_org_id()
    and exists (
      select 1 from public.organisation_memberships m
      where m.user_id = auth.uid() and m.org_id = rfq_recipients.org_id and m.status = 'active'
    )
  );

create policy rfq_tokens_select_active_member on public.rfq_access_tokens
  for select to authenticated
  using (
    org_id = public.auth_org_id()
    and exists (
      select 1 from public.organisation_memberships m
      where m.user_id = auth.uid() and m.org_id = rfq_access_tokens.org_id and m.status = 'active'
    )
  );

create policy rfq_shared_select_active_member on public.rfq_shared_documents
  for select to authenticated
  using (
    org_id = public.auth_org_id()
    and exists (
      select 1 from public.organisation_memberships m
      where m.user_id = auth.uid() and m.org_id = rfq_shared_documents.org_id and m.status = 'active'
    )
  );

create policy rfq_deliveries_select_active_member on public.rfq_deliveries
  for select to authenticated
  using (
    org_id = public.auth_org_id()
    and exists (
      select 1 from public.organisation_memberships m
      where m.user_id = auth.uid() and m.org_id = rfq_deliveries.org_id and m.status = 'active'
    )
  );

create policy rfq_events_select_active_member on public.rfq_events
  for select to authenticated
  using (
    org_id = public.auth_org_id()
    and exists (
      select 1 from public.organisation_memberships m
      where m.user_id = auth.uid() and m.org_id = rfq_events.org_id and m.status = 'active'
    )
  );

create policy rfq_clarifications_select_active_member on public.rfq_clarifications
  for select to authenticated
  using (
    org_id = public.auth_org_id()
    and exists (
      select 1 from public.organisation_memberships m
      where m.user_id = auth.uid() and m.org_id = rfq_clarifications.org_id and m.status = 'active'
    )
  );

create policy rfq_responses_select_active_member on public.rfq_responses
  for select to authenticated
  using (
    org_id = public.auth_org_id()
    and exists (
      select 1 from public.organisation_memberships m
      where m.user_id = auth.uid() and m.org_id = rfq_responses.org_id and m.status = 'active'
    )
  );

create policy rfq_response_files_select_active_member on public.rfq_response_files
  for select to authenticated
  using (
    org_id = public.auth_org_id()
    and exists (
      select 1 from public.organisation_memberships m
      where m.user_id = auth.uid() and m.org_id = rfq_response_files.org_id and m.status = 'active'
    )
  );

create or replace function public.rfq_touch_frozen()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'sent' and (
    new.status is distinct from old.status
    or new.scope_kind is distinct from old.scope_kind
    or new.work_area_id is distinct from old.work_area_id
    or new.work_area_type is distinct from old.work_area_type
    or new.work_area_name is distinct from old.work_area_name
    or new.written_scope_label is distinct from old.written_scope_label
    or new.requested_scope is distinct from old.requested_scope
    or new.measurement_notes is distinct from old.measurement_notes
    or new.response_due_on is distinct from old.response_due_on
    or new.include_site_address is distinct from old.include_site_address
    or new.site_address is distinct from old.site_address
    or new.site_details is distinct from old.site_details
    or new.questions is distinct from old.questions
    or new.message is distinct from old.message
    or new.builder_name is distinct from old.builder_name
    or new.project_id is distinct from old.project_id
    or new.org_id is distinct from old.org_id
  ) then
    raise exception 'RFQ_FROZEN';
  end if;
  return new;
end;
$$;

drop trigger if exists rfqs_freeze_sent on public.rfqs;
create trigger rfqs_freeze_sent
  before update on public.rfqs
  for each row execute function public.rfq_touch_frozen();

create or replace function public.rfq_freeze_recipient()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status from public.rfqs where id = coalesce(new.rfq_id, old.rfq_id);
  if v_status = 'sent' and tg_op = 'DELETE' then
    raise exception 'RFQ_FROZEN';
  end if;
  if v_status = 'sent' and tg_op = 'INSERT' then
    raise exception 'RFQ_FROZEN';
  end if;
  if v_status = 'sent' and tg_op = 'UPDATE' and (
    new.subcontractor_id is distinct from old.subcontractor_id
    or new.trading_name is distinct from old.trading_name
    or new.contact_name is distinct from old.contact_name
    or new.contact_email is distinct from old.contact_email
    or new.suggestion_reason is distinct from old.suggestion_reason
    or new.selection_source is distinct from old.selection_source
    or new.org_id is distinct from old.org_id
    or new.rfq_id is distinct from old.rfq_id
  ) then
    raise exception 'RFQ_FROZEN';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists rfq_recipients_freeze_sent on public.rfq_recipients;
create trigger rfq_recipients_freeze_sent
  before insert or update or delete on public.rfq_recipients
  for each row execute function public.rfq_freeze_recipient();

create or replace function public.rfq_freeze_shared_document()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status from public.rfqs where id = coalesce(new.rfq_id, old.rfq_id);
  if v_status = 'sent' then
    raise exception 'RFQ_FROZEN';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists rfq_shared_documents_freeze_sent on public.rfq_shared_documents;
create trigger rfq_shared_documents_freeze_sent
  before insert or update or delete on public.rfq_shared_documents
  for each row execute function public.rfq_freeze_shared_document();

create or replace function public.rfq_freeze_submitted_response()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.status = 'submitted' then
    raise exception 'RFQ_RESPONSE_FROZEN';
  end if;
  if tg_op = 'DELETE' and old.status = 'submitted' then
    raise exception 'RFQ_RESPONSE_FROZEN';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists rfq_responses_freeze_submitted on public.rfq_responses;
create trigger rfq_responses_freeze_submitted
  before update or delete on public.rfq_responses
  for each row execute function public.rfq_freeze_submitted_response();

create or replace function public.protect_rfq_response_file()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('quotr.rfq_file_write', true) is distinct from 'on' then
    if tg_op = 'UPDATE' and (
      new.storage_object_path is distinct from old.storage_object_path
      or new.upload_status is distinct from old.upload_status
      or new.mime_type is distinct from old.mime_type
      or new.byte_size is distinct from old.byte_size
    ) then
      raise exception 'RFQ_FILE_WRITE';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists rfq_response_files_protect on public.rfq_response_files;
create trigger rfq_response_files_protect
  before update on public.rfq_response_files
  for each row execute function public.protect_rfq_response_file();

create or replace function public.rfq_public_rate_ok(
  p_token_hash text,
  p_action text,
  p_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.rfq_public_attempts (token_hash, action)
  values (p_token_hash, p_action);
  select count(*) into v_count
  from public.rfq_public_attempts
  where token_hash = p_token_hash
    and action = p_action
    and created_at > now() - interval '15 minutes';
  return v_count <= p_limit;
end;
$$;

create or replace function public.rfq_event(
  p_org uuid,
  p_rfq uuid,
  p_recipient uuid,
  p_kind text,
  p_summary text,
  p_actor text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.rfq_events (org_id, rfq_id, recipient_id, kind, summary, actor, created_by)
  values (p_org, p_rfq, p_recipient, p_kind, left(p_summary, 300), p_actor, auth.uid());
exception
  when unique_violation then
    null;
end;
$$;

create or replace function public.rfq_token_row(p_token_hash text)
returns public.rfq_access_tokens
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.rfq_access_tokens
  where token_hash = p_token_hash
  limit 1;
$$;

create or replace function public.save_rfq_draft_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
  v_id uuid;
  v_project uuid;
  v_existing public.rfqs%rowtype;
  v_scope text;
  v_area_id uuid;
  v_area public.work_areas%rowtype;
  v_label text;
  v_due date;
  v_include boolean;
  v_site text := '';
  v_builder text;
  v_recipient jsonb;
  v_sub public.subcontractors%rowtype;
  v_contact public.subcontractor_contacts%rowtype;
  v_source text;
  v_reason text;
  v_version uuid;
  v_doc public.project_documents%rowtype;
  v_ver public.project_document_versions%rowtype;
  v_count integer := 0;
begin
  if auth.uid() is null or v_org is null or not public.auth_can_mutate_work() then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;
  if p_payload ? 'org_id' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  v_project := nullif(p_payload->>'project_id', '')::uuid;
  if v_project is null or not exists (
    select 1 from public.projects
    where id = v_project and org_id = v_org and deleted_at is null
  ) then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  v_scope := p_payload->>'scope_kind';
  if v_scope not in ('work_area', 'written') then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  if char_length(coalesce(p_payload->>'requested_scope', '')) > 8000
    or char_length(coalesce(p_payload->>'measurement_notes', '')) > 4000
    or char_length(coalesce(p_payload->>'site_details', '')) > 4000
    or char_length(coalesce(p_payload->>'questions', '')) > 4000
    or char_length(coalesce(p_payload->>'message', '')) > 4000
  then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  v_area_id := nullif(p_payload->>'work_area_id', '')::uuid;
  v_label := nullif(btrim(coalesce(p_payload->>'written_scope_label', '')), '');
  if v_scope = 'work_area' then
    if v_area_id is null then
      return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
    end if;
    select * into v_area
    from public.work_areas
    where id = v_area_id and project_id = v_project and org_id = v_org;
    if not found or v_area.status = 'excluded' then
      return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
    end if;
    v_label := null;
  else
    v_area_id := null;
    if v_label is not null and char_length(v_label) > 160 then
      return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
    end if;
  end if;
  begin
    v_due := nullif(p_payload->>'response_due_on', '')::date;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end;
  v_include := coalesce((p_payload->>'include_site_address')::boolean, false);
  if v_include then
    select coalesce(site_address, '') into v_site
    from public.projects where id = v_project;
    v_site := left(v_site, 500);
  end if;
  select coalesce(nullif(btrim(s.trading_name), ''), o.name, '')
    into v_builder
  from public.organisations o
  left join public.organisation_settings s on s.org_id = o.id
  where o.id = v_org;

  v_id := nullif(p_payload->>'id', '')::uuid;
  if v_id is not null then
    select * into v_existing from public.rfqs where id = v_id and org_id = v_org and project_id = v_project;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
    end if;
    if v_existing.status is distinct from 'draft' then
      return jsonb_build_object('ok', false, 'error', 'FROZEN');
    end if;
    update public.rfqs set
      scope_kind = v_scope,
      work_area_id = v_area_id,
      work_area_type = case when v_scope = 'work_area' then v_area.type else null end,
      work_area_name = case when v_scope = 'work_area' then v_area.name else null end,
      written_scope_label = v_label,
      requested_scope = coalesce(p_payload->>'requested_scope', ''),
      measurement_notes = coalesce(p_payload->>'measurement_notes', ''),
      response_due_on = v_due,
      include_site_address = v_include,
      site_address = v_site,
      site_details = coalesce(p_payload->>'site_details', ''),
      questions = coalesce(p_payload->>'questions', ''),
      message = coalesce(p_payload->>'message', ''),
      builder_name = coalesce(v_builder, ''),
      updated_at = now()
    where id = v_id;
    delete from public.rfq_shared_documents where rfq_id = v_id;
    delete from public.rfq_recipients where rfq_id = v_id;
  else
    insert into public.rfqs (
      org_id, project_id, status, scope_kind, work_area_id, work_area_type, work_area_name,
      written_scope_label, requested_scope, measurement_notes, response_due_on,
      include_site_address, site_address, site_details, questions, message, builder_name, created_by
    ) values (
      v_org, v_project, 'draft', v_scope, v_area_id,
      case when v_scope = 'work_area' then v_area.type else null end,
      case when v_scope = 'work_area' then v_area.name else null end,
      v_label,
      coalesce(p_payload->>'requested_scope', ''),
      coalesce(p_payload->>'measurement_notes', ''),
      v_due, v_include, v_site,
      coalesce(p_payload->>'site_details', ''),
      coalesce(p_payload->>'questions', ''),
      coalesce(p_payload->>'message', ''),
      coalesce(v_builder, ''),
      auth.uid()
    ) returning id into v_id;
  end if;

  if jsonb_typeof(p_payload->'recipients') = 'array' then
    if jsonb_array_length(p_payload->'recipients') > 20 then
      return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
    end if;
    for v_recipient in select value from jsonb_array_elements(p_payload->'recipients')
    loop
      select * into v_sub
      from public.subcontractors
      where id = nullif(v_recipient->>'subcontractor_id', '')::uuid
        and org_id = v_org;
      if not found then
        return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
      end if;
      if v_sub.archived_at is not null then
        return jsonb_build_object('ok', false, 'error', 'ARCHIVED_SUBCONTRACTOR');
      end if;
      select * into v_contact
      from public.subcontractor_contacts
      where id = nullif(v_recipient->>'contact_id', '')::uuid
        and subcontractor_id = v_sub.id
        and org_id = v_org
        and archived_at is null;
      if not found or nullif(btrim(coalesce(v_contact.email, '')), '') is null then
        return jsonb_build_object('ok', false, 'error', 'MISSING_EMAIL');
      end if;
      v_source := case when v_recipient->>'selection_source' = 'suggested' then 'suggested' else 'manual' end;
      v_reason := null;
      if v_source = 'suggested' and v_scope = 'work_area' and v_area.type = any(v_sub.work_area_types) then
        v_reason := left('Suggested because this business lists ' || v_area.name, 240);
      else
        v_source := 'manual';
      end if;
      insert into public.rfq_recipients (
        org_id, rfq_id, subcontractor_id, contact_id, trading_name, contact_name,
        contact_email, suggestion_reason, selection_source
      ) values (
        v_org, v_id, v_sub.id, v_contact.id, v_sub.trading_name, v_contact.name,
        lower(btrim(v_contact.email)), v_reason, v_source
      );
      v_count := v_count + 1;
    end loop;
  end if;

  if jsonb_typeof(p_payload->'document_version_ids') = 'array' then
    if jsonb_array_length(p_payload->'document_version_ids') > 20 then
      return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
    end if;
    for v_version in
      select distinct value::uuid
      from jsonb_array_elements_text(p_payload->'document_version_ids') as value
    loop
      select * into v_ver
      from public.project_document_versions
      where id = v_version and project_id = v_project and org_id = v_org;
      if not found or v_ver.upload_status is distinct from 'ready' or not v_ver.object_confirmed then
        return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
      end if;
      select * into v_doc from public.project_documents where id = v_ver.document_id and org_id = v_org;
      if not found then
        return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
      end if;
      insert into public.rfq_shared_documents (
        org_id, rfq_id, project_document_id, project_document_version_id,
        title, display_filename, mime_type, byte_size, storage_object_path, visibility
      ) values (
        v_org, v_id, v_doc.id, v_ver.id, v_doc.title, v_ver.display_filename,
        v_ver.mime_type, v_ver.byte_size, v_ver.storage_object_path, v_ver.visibility
      );
    end loop;
  end if;

  perform public.rfq_event(v_org, v_id, null, 'draft_saved', 'Draft saved', 'member');
  return jsonb_build_object('ok', true, 'id', v_id, 'recipientCount', v_count);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  when invalid_text_representation then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
end;
$$;

create or replace function public.send_rfq_v1(p_rfq uuid, p_tokens jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
  v_rfq public.rfqs%rowtype;
  v_recipient public.rfq_recipients%rowtype;
  v_sub public.subcontractors%rowtype;
  v_count integer := 0;
  v_expires timestamptz;
  v_token jsonb;
  v_hash text;
  v_matched integer := 0;
begin
  if auth.uid() is null or v_org is null or not public.auth_can_mutate_work() then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;
  select * into v_rfq from public.rfqs where id = p_rfq and org_id = v_org for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_rfq.status = 'sent' then
    return jsonb_build_object('ok', false, 'error', 'ALREADY_SENT');
  end if;
  if btrim(v_rfq.requested_scope) = '' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  if v_rfq.scope_kind = 'work_area' and (v_rfq.work_area_id is null or coalesce(v_rfq.work_area_name, '') = '') then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  if v_rfq.scope_kind = 'written' and coalesce(btrim(v_rfq.written_scope_label), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  if v_rfq.response_due_on is not null and v_rfq.response_due_on < (timezone('UTC', now()))::date then
    return jsonb_build_object('ok', false, 'error', 'DUE_DATE_PAST');
  end if;
  select count(*) into v_count from public.rfq_recipients where rfq_id = v_rfq.id;
  if v_count < 1 or jsonb_typeof(p_tokens) is distinct from 'array' or jsonb_array_length(p_tokens) is distinct from v_count then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  for v_recipient in select * from public.rfq_recipients where rfq_id = v_rfq.id
  loop
    select * into v_sub from public.subcontractors where id = v_recipient.subcontractor_id;
    if v_sub.archived_at is not null then
      return jsonb_build_object('ok', false, 'error', 'ARCHIVED_SUBCONTRACTOR');
    end if;
  end loop;
  if v_rfq.response_due_on is not null then
    v_expires := ((v_rfq.response_due_on + 14)::timestamp + time '23:59') at time zone 'UTC';
  else
    v_expires := now() + interval '30 days';
  end if;
  for v_token in select value from jsonb_array_elements(p_tokens)
  loop
    v_hash := v_token->>'token_hash';
    if v_hash is null or char_length(v_hash) <> 64 then
      return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
    end if;
    if not exists (
      select 1 from public.rfq_recipients
      where id = nullif(v_token->>'recipient_id', '')::uuid and rfq_id = v_rfq.id
    ) then
      return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
    end if;
    insert into public.rfq_access_tokens (org_id, recipient_id, token_hash, expires_at, created_by)
    values (v_org, (v_token->>'recipient_id')::uuid, v_hash, v_expires, auth.uid());
    v_matched := v_matched + 1;
  end loop;
  update public.rfqs set status = 'sent', sent_at = now(), updated_at = now() where id = v_rfq.id;
  perform public.rfq_event(v_org, v_rfq.id, null, 'sent', 'Request sent', 'member');
  return jsonb_build_object('ok', true, 'id', v_rfq.id, 'expiresAt', v_expires, 'recipientCount', v_matched);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  when invalid_text_representation then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
end;
$$;

create or replace function public.resend_rfq_recipient_v1(
  p_recipient uuid,
  p_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
  v_recipient public.rfq_recipients%rowtype;
  v_rfq public.rfqs%rowtype;
  v_expires timestamptz;
begin
  if auth.uid() is null or v_org is null or not public.auth_can_mutate_work() then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;
  if p_token_hash is null or char_length(p_token_hash) <> 64 then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  select * into v_recipient
  from public.rfq_recipients where id = p_recipient and org_id = v_org for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  select * into v_rfq from public.rfqs where id = v_recipient.rfq_id and status = 'sent';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if exists (
    select 1 from public.subcontractors
    where id = v_recipient.subcontractor_id and archived_at is not null
  ) then
    return jsonb_build_object('ok', false, 'error', 'ARCHIVED_SUBCONTRACTOR');
  end if;
  update public.rfq_access_tokens
  set revoked_at = now()
  where recipient_id = v_recipient.id and revoked_at is null;
  if v_rfq.response_due_on is not null then
    v_expires := ((v_rfq.response_due_on + 14)::timestamp + time '23:59') at time zone 'UTC';
  else
    v_expires := now() + interval '30 days';
  end if;
  if v_expires <= now() then
    return jsonb_build_object('ok', false, 'error', 'EXPIRED');
  end if;
  insert into public.rfq_access_tokens (org_id, recipient_id, token_hash, expires_at, created_by)
  values (v_org, v_recipient.id, p_token_hash, v_expires, auth.uid());
  perform public.rfq_event(v_org, v_rfq.id, v_recipient.id, 'resent', 'Link replaced and resent', 'member');
  return jsonb_build_object('ok', true, 'recipientId', v_recipient.id, 'expiresAt', v_expires);
end;
$$;

create or replace function public.revoke_rfq_recipient_v1(p_recipient uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
  v_recipient public.rfq_recipients%rowtype;
begin
  if auth.uid() is null or v_org is null or not public.auth_can_mutate_work() then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;
  select * into v_recipient from public.rfq_recipients where id = p_recipient and org_id = v_org;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  update public.rfq_access_tokens set revoked_at = now()
  where recipient_id = v_recipient.id and revoked_at is null;
  perform public.rfq_event(v_org, v_recipient.rfq_id, v_recipient.id, 'token_revoked', 'Link revoked', 'member');
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.begin_rfq_delivery_v1(
  p_recipient uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
  v_recipient public.rfq_recipients%rowtype;
  v_existing public.rfq_deliveries%rowtype;
  v_id uuid;
begin
  if auth.uid() is null or v_org is null or not public.auth_can_mutate_work() then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;
  if p_idempotency_key is null or char_length(btrim(p_idempotency_key)) < 8 then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  select * into v_existing from public.rfq_deliveries where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.org_id is distinct from v_org then
      return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
    end if;
    return jsonb_build_object('ok', true, 'deliveryId', v_existing.id, 'status', v_existing.status, 'idempotent', true);
  end if;
  select * into v_recipient
  from public.rfq_recipients r
  where r.id = p_recipient and r.org_id = v_org
    and exists (select 1 from public.rfqs q where q.id = r.rfq_id and q.status = 'sent');
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  insert into public.rfq_deliveries (org_id, recipient_id, status, idempotency_key)
  values (v_org, v_recipient.id, 'pending', p_idempotency_key)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'deliveryId', v_id, 'status', 'pending', 'idempotent', false);
end;
$$;

create or replace function public.complete_rfq_delivery_v1(
  p_delivery uuid,
  p_provider_message_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
  v_row public.rfq_deliveries%rowtype;
  v_recipient public.rfq_recipients%rowtype;
begin
  if auth.uid() is null or v_org is null or not public.auth_can_mutate_work() then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;
  if nullif(btrim(coalesce(p_provider_message_id, '')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  select * into v_row from public.rfq_deliveries where id = p_delivery and org_id = v_org for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_row.status = 'sent' then
    return jsonb_build_object('ok', true, 'status', 'sent');
  end if;
  if v_row.status is distinct from 'pending' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  update public.rfq_deliveries
  set status = 'sent', provider_message_id = p_provider_message_id, sent_at = now()
  where id = v_row.id;
  select * into v_recipient from public.rfq_recipients where id = v_row.recipient_id;
  perform public.rfq_event(v_org, v_recipient.rfq_id, v_recipient.id, 'delivery_sent', 'Email accepted by the mail service', 'system');
  return jsonb_build_object('ok', true, 'status', 'sent');
end;
$$;

create or replace function public.fail_rfq_delivery_v1(
  p_delivery uuid,
  p_failure_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
  v_row public.rfq_deliveries%rowtype;
  v_recipient public.rfq_recipients%rowtype;
begin
  if auth.uid() is null or v_org is null or not public.auth_can_mutate_work() then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;
  select * into v_row from public.rfq_deliveries where id = p_delivery and org_id = v_org for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_row.status is distinct from 'pending' then
    return jsonb_build_object('ok', true, 'status', v_row.status);
  end if;
  update public.rfq_deliveries
  set status = 'failed', failure_code = left(coalesce(p_failure_code, 'failed'), 80), failed_at = now()
  where id = v_row.id;
  select * into v_recipient from public.rfq_recipients where id = v_row.recipient_id;
  perform public.rfq_event(v_org, v_recipient.rfq_id, v_recipient.id, 'delivery_failed', 'Email was not accepted', 'system');
  return jsonb_build_object('ok', true, 'status', 'failed');
end;
$$;

create or replace function public.apply_rfq_delivery_event_v1(
  p_provider_message_id text,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.rfq_deliveries%rowtype;
  v_recipient public.rfq_recipients%rowtype;
  v_next text;
begin
  if auth.role() is distinct from 'service_role' then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;
  if p_status not in ('delivered', 'failed', 'bounced', 'complained') then
    return jsonb_build_object('ok', true, 'ignored', true);
  end if;
  select * into v_row
  from public.rfq_deliveries
  where provider = 'resend' and provider_message_id = p_provider_message_id
  for update;
  if not found then
    return jsonb_build_object('ok', true, 'ignored', true);
  end if;
  v_next := v_row.status;
  if v_row.status = 'complained' then
    v_next := 'complained';
  elsif p_status in ('bounced', 'complained') then
    v_next := p_status;
  elsif v_row.status = 'bounced' then
    v_next := 'bounced';
  elsif p_status = 'delivered' and v_row.status in ('sent', 'pending') then
    v_next := 'delivered';
  elsif p_status = 'failed' and v_row.status in ('sent', 'pending') then
    v_next := 'failed';
  end if;
  if v_next is distinct from v_row.status then
    update public.rfq_deliveries
    set status = v_next,
        delivered_at = case when v_next = 'delivered' then now() else delivered_at end,
        failed_at = case when v_next in ('failed', 'bounced', 'complained') then now() else failed_at end,
        failure_code = case when v_next in ('failed', 'bounced', 'complained') then p_status else failure_code end
    where id = v_row.id;
    select * into v_recipient from public.rfq_recipients where id = v_row.recipient_id;
    perform public.rfq_event(
      v_row.org_id, v_recipient.rfq_id, v_recipient.id,
      case when v_next = 'delivered' then 'delivery_delivered' else 'delivery_failed' end,
      case when v_next = 'delivered' then 'Email delivered' else 'Email delivery failed' end,
      'system'
    );
  end if;
  return jsonb_build_object('ok', true, 'status', v_next);
end;
$$;

create or replace function public.expire_project_rfqs_v1(p_project uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
  v_row public.rfq_recipients%rowtype;
  v_count integer := 0;
begin
  if auth.uid() is null or v_org is null then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;
  if not exists (
    select 1 from public.organisation_memberships m
    where m.user_id = auth.uid() and m.org_id = v_org and m.status = 'active'
  ) then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;
  for v_row in
    select r.*
    from public.rfq_recipients r
    join public.rfqs q on q.id = r.rfq_id
    where q.project_id = p_project
      and q.org_id = v_org
      and q.status = 'sent'
      and q.response_due_on is not null
      and q.response_due_on < (timezone('UTC', now()))::date
      and r.response_state in ('awaiting', 'clarification')
      and not exists (
        select 1 from public.rfq_responses response
        where response.recipient_id = r.id and response.status = 'submitted'
      )
    for update
  loop
    update public.rfq_recipients set response_state = 'expired' where id = v_row.id;
    perform public.rfq_event(v_org, v_row.rfq_id, v_row.id, 'expired', 'Request expired with no response', 'system');
    v_count := v_count + 1;
  end loop;
  return jsonb_build_object('ok', true, 'expired', v_count);
end;
$$;

create or replace function public.lookup_rfq_by_token_hash_v1(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token public.rfq_access_tokens%rowtype;
  v_recipient public.rfq_recipients%rowtype;
  v_rfq public.rfqs%rowtype;
  v_files jsonb;
  v_clarifications jsonb;
  v_responses jsonb;
begin
  if p_token_hash is null or char_length(p_token_hash) <> 64 then
    return jsonb_build_object('ok', false, 'error', 'UNAVAILABLE');
  end if;
  if not public.rfq_public_rate_ok(p_token_hash, 'lookup', 120) then
    return jsonb_build_object('ok', false, 'error', 'RATE_LIMITED');
  end if;
  select * into v_token from public.rfq_access_tokens where token_hash = p_token_hash;
  if not found or v_token.revoked_at is not null then
    return jsonb_build_object('ok', false, 'error', 'UNAVAILABLE');
  end if;
  if v_token.expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'EXPIRED');
  end if;
  select * into v_recipient from public.rfq_recipients where id = v_token.recipient_id;
  select * into v_rfq from public.rfqs where id = v_recipient.rfq_id and status = 'sent';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'UNAVAILABLE');
  end if;
  if v_rfq.response_due_on is not null
    and v_rfq.response_due_on < (timezone('UTC', now()))::date
    and v_recipient.response_state in ('awaiting', 'clarification')
    and not exists (
      select 1 from public.rfq_responses response
      where response.recipient_id = v_recipient.id and response.status = 'submitted'
    )
  then
    update public.rfq_recipients set response_state = 'expired' where id = v_recipient.id;
    v_recipient.response_state := 'expired';
    perform public.rfq_event(v_rfq.org_id, v_rfq.id, v_recipient.id, 'expired', 'Request expired with no response', 'system');
  end if;
  if not exists (
    select 1 from public.rfq_events where recipient_id = v_recipient.id and kind = 'viewed'
  ) then
    perform public.rfq_event(v_rfq.org_id, v_rfq.id, v_recipient.id, 'viewed', 'Recipient opened the request', 'recipient');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', file.id,
    'title', file.title,
    'filename', file.display_filename,
    'mimeType', file.mime_type,
    'byteSize', file.byte_size
  ) order by file.created_at), '[]'::jsonb)
  into v_files
  from public.rfq_shared_documents file
  where file.rfq_id = v_rfq.id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', note.id, 'body', note.body, 'createdAt', note.created_at, 'fromRecipient', note.from_recipient
  ) order by note.created_at), '[]'::jsonb)
  into v_clarifications
  from public.rfq_clarifications note
  where note.recipient_id = v_recipient.id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', response.id,
    'versionNumber', response.version_number,
    'status', response.status,
    'priceExGst', response.price_ex_gst,
    'gstTreatment', response.gst_treatment,
    'structure', response.pricing_structure,
    'includedScope', response.included_scope,
    'excludedScope', response.excluded_scope,
    'assumptions', response.assumptions,
    'leadTime', response.lead_time,
    'validUntil', response.valid_until,
    'message', response.message,
    'submittedAt', response.submitted_at,
    'fileId', file.id,
    'fileName', file.original_filename,
    'fileReady', file.upload_status = 'ready'
  ) order by response.version_number), '[]'::jsonb)
  into v_responses
  from public.rfq_responses response
  left join public.rfq_response_files file on file.response_id = response.id
  where response.recipient_id = v_recipient.id;
  return jsonb_build_object(
    'ok', true,
    'builderName', v_rfq.builder_name,
    'scopeLabel', case when v_rfq.scope_kind = 'work_area' then v_rfq.work_area_name else v_rfq.written_scope_label end,
    'requestedScope', v_rfq.requested_scope,
    'measurementNotes', v_rfq.measurement_notes,
    'responseDueOn', v_rfq.response_due_on,
    'siteAddress', case when v_rfq.include_site_address then v_rfq.site_address else '' end,
    'siteDetails', v_rfq.site_details,
    'questions', v_rfq.questions,
    'message', v_rfq.message,
    'files', v_files,
    'responseState', v_recipient.response_state,
    'clarifications', v_clarifications,
    'responses', v_responses
  );
end;
$$;

create or replace function public.public_rfq_clarify_v1(p_token_hash text, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token public.rfq_access_tokens%rowtype;
  v_recipient public.rfq_recipients%rowtype;
  v_rfq public.rfqs%rowtype;
  v_body text := btrim(coalesce(p_body, ''));
begin
  if not public.rfq_public_rate_ok(coalesce(p_token_hash, ''), 'write', 20) then
    return jsonb_build_object('ok', false, 'error', 'RATE_LIMITED');
  end if;
  select * into v_token from public.rfq_access_tokens where token_hash = p_token_hash and revoked_at is null and expires_at > now();
  if not found then
    return jsonb_build_object('ok', false, 'error', 'UNAVAILABLE');
  end if;
  select * into v_recipient from public.rfq_recipients where id = v_token.recipient_id;
  select * into v_rfq from public.rfqs where id = v_recipient.rfq_id and status = 'sent';
  if not found or char_length(v_body) < 1 or char_length(v_body) > 2000 then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  if v_recipient.response_state = 'expired' then
    return jsonb_build_object('ok', false, 'error', 'EXPIRED');
  end if;
  insert into public.rfq_clarifications (org_id, recipient_id, body, from_recipient)
  values (v_rfq.org_id, v_recipient.id, v_body, true);
  if v_recipient.response_state = 'awaiting' then
    update public.rfq_recipients set response_state = 'clarification' where id = v_recipient.id;
  end if;
  perform public.rfq_event(v_rfq.org_id, v_rfq.id, v_recipient.id, 'clarification', 'Recipient asked a question', 'recipient');
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.public_rfq_decline_v1(p_token_hash text, p_message text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token public.rfq_access_tokens%rowtype;
  v_recipient public.rfq_recipients%rowtype;
  v_rfq public.rfqs%rowtype;
  v_message text := left(btrim(coalesce(p_message, '')), 2000);
begin
  if not public.rfq_public_rate_ok(coalesce(p_token_hash, ''), 'write', 20) then
    return jsonb_build_object('ok', false, 'error', 'RATE_LIMITED');
  end if;
  select * into v_token from public.rfq_access_tokens where token_hash = p_token_hash and revoked_at is null and expires_at > now();
  if not found then
    return jsonb_build_object('ok', false, 'error', 'UNAVAILABLE');
  end if;
  select * into v_recipient from public.rfq_recipients where id = v_token.recipient_id for update;
  select * into v_rfq from public.rfqs where id = v_recipient.rfq_id and status = 'sent';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'UNAVAILABLE');
  end if;
  if v_recipient.response_state in ('responded', 'declined', 'expired') then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  if exists (
    select 1 from public.rfq_responses where recipient_id = v_recipient.id and status = 'submitted'
  ) then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  update public.rfq_recipients set response_state = 'declined' where id = v_recipient.id;
  if v_message <> '' then
    insert into public.rfq_clarifications (org_id, recipient_id, body, from_recipient)
    values (v_rfq.org_id, v_recipient.id, v_message, true);
  end if;
  perform public.rfq_event(v_rfq.org_id, v_rfq.id, v_recipient.id, 'declined', 'Recipient declined to quote', 'recipient');
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.public_rfq_save_response_v1(
  p_token_hash text,
  p_payload jsonb,
  p_confirm boolean,
  p_revise boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token public.rfq_access_tokens%rowtype;
  v_recipient public.rfq_recipients%rowtype;
  v_rfq public.rfqs%rowtype;
  v_draft public.rfq_responses%rowtype;
  v_next integer;
  v_price numeric(14, 2);
  v_gst text;
  v_structure text;
  v_id uuid;
begin
  if not public.rfq_public_rate_ok(coalesce(p_token_hash, ''), 'write', 20) then
    return jsonb_build_object('ok', false, 'error', 'RATE_LIMITED');
  end if;
  select * into v_token from public.rfq_access_tokens where token_hash = p_token_hash and revoked_at is null and expires_at > now();
  if not found then
    return jsonb_build_object('ok', false, 'error', 'UNAVAILABLE');
  end if;
  select * into v_recipient from public.rfq_recipients where id = v_token.recipient_id for update;
  select * into v_rfq from public.rfqs where id = v_recipient.rfq_id and status = 'sent';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'UNAVAILABLE');
  end if;
  if v_recipient.response_state in ('declined', 'expired') then
    return jsonb_build_object('ok', false, 'error', 'EXPIRED');
  end if;
  if v_rfq.response_due_on is not null and v_rfq.response_due_on < (timezone('UTC', now()))::date
    and not exists (
      select 1 from public.rfq_responses where recipient_id = v_recipient.id and status = 'submitted'
    )
  then
    update public.rfq_recipients set response_state = 'expired' where id = v_recipient.id;
    return jsonb_build_object('ok', false, 'error', 'EXPIRED');
  end if;
  begin
    v_price := nullif(p_payload->>'price_ex_gst', '')::numeric;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end;
  v_gst := nullif(p_payload->>'gst_treatment', '');
  v_structure := nullif(p_payload->>'pricing_structure', '');
  if v_gst is not null and v_gst not in ('extra', 'none', 'unknown') then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  if v_structure is not null and v_structure not in ('lump_sum', 'itemised') then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  if char_length(coalesce(p_payload->>'included_scope', '')) > 4000
    or char_length(coalesce(p_payload->>'excluded_scope', '')) > 4000
    or char_length(coalesce(p_payload->>'assumptions', '')) > 4000
    or char_length(coalesce(p_payload->>'lead_time', '')) > 200
    or char_length(coalesce(p_payload->>'message', '')) > 4000
  then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  select * into v_draft
  from public.rfq_responses
  where recipient_id = v_recipient.id and status = 'draft'
  for update;
  if p_confirm is true and exists (
    select 1 from public.rfq_responses where recipient_id = v_recipient.id and status = 'submitted'
  ) and v_draft.id is null and p_revise is distinct from true then
    return jsonb_build_object('ok', false, 'error', 'DUPLICATE');
  end if;
  if p_confirm is true and (v_price is null or v_price < 0 or v_gst is null or v_structure is null) then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  if v_draft.id is null then
    select coalesce(max(version_number), 0) + 1 into v_next
    from public.rfq_responses where recipient_id = v_recipient.id;
    insert into public.rfq_responses (
      org_id, recipient_id, version_number, status, price_ex_gst, gst_treatment, pricing_structure,
      included_scope, excluded_scope, assumptions, lead_time, valid_until, message, submitted_at
    ) values (
      v_rfq.org_id, v_recipient.id, v_next,
      case when p_confirm then 'submitted' else 'draft' end,
      v_price, v_gst, v_structure,
      coalesce(p_payload->>'included_scope', ''),
      coalesce(p_payload->>'excluded_scope', ''),
      coalesce(p_payload->>'assumptions', ''),
      coalesce(p_payload->>'lead_time', ''),
      nullif(p_payload->>'valid_until', '')::date,
      coalesce(p_payload->>'message', ''),
      case when p_confirm then now() else null end
    ) returning id into v_id;
  else
    update public.rfq_responses set
      status = case when p_confirm then 'submitted' else 'draft' end,
      price_ex_gst = v_price,
      gst_treatment = v_gst,
      pricing_structure = v_structure,
      included_scope = coalesce(p_payload->>'included_scope', ''),
      excluded_scope = coalesce(p_payload->>'excluded_scope', ''),
      assumptions = coalesce(p_payload->>'assumptions', ''),
      lead_time = coalesce(p_payload->>'lead_time', ''),
      valid_until = nullif(p_payload->>'valid_until', '')::date,
      message = coalesce(p_payload->>'message', ''),
      submitted_at = case when p_confirm then now() else null end,
      updated_at = now()
    where id = v_draft.id
    returning id into v_id;
  end if;
  if p_confirm then
    update public.rfq_recipients set response_state = 'responded' where id = v_recipient.id;
    perform public.rfq_event(
      v_rfq.org_id, v_rfq.id, v_recipient.id,
      case when p_revise then 'response_revised' else 'response_submitted' end,
      case when p_revise then 'Recipient submitted a revised response' else 'Recipient submitted a response' end,
      'recipient'
    );
  end if;
  return jsonb_build_object('ok', true, 'responseId', v_id, 'submitted', p_confirm is true);
exception
  when invalid_text_representation then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
end;
$$;

create or replace function public.prepare_rfq_response_upload_v1(
  p_token_hash text,
  p_response uuid,
  p_filename text,
  p_byte_size bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token public.rfq_access_tokens%rowtype;
  v_response public.rfq_responses%rowtype;
  v_recipient public.rfq_recipients%rowtype;
  v_id uuid := gen_random_uuid();
  v_path text;
begin
  if not public.rfq_public_rate_ok(coalesce(p_token_hash, ''), 'upload', 10) then
    return jsonb_build_object('ok', false, 'error', 'RATE_LIMITED');
  end if;
  if p_byte_size is null or p_byte_size < 1 or p_byte_size > 15728640 then
    return jsonb_build_object('ok', false, 'error', 'FILE_TYPE');
  end if;
  if right(lower(coalesce(p_filename, '')), 4) is distinct from '.pdf' then
    return jsonb_build_object('ok', false, 'error', 'FILE_TYPE');
  end if;
  select * into v_token from public.rfq_access_tokens where token_hash = p_token_hash and revoked_at is null and expires_at > now();
  if not found then
    return jsonb_build_object('ok', false, 'error', 'UNAVAILABLE');
  end if;
  select * into v_recipient from public.rfq_recipients where id = v_token.recipient_id;
  select * into v_response
  from public.rfq_responses
  where id = p_response and recipient_id = v_recipient.id and status = 'draft';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  select id into v_id from public.rfq_response_files where response_id = v_response.id;
  if found then
    v_path := v_response.org_id::text || '/' || v_recipient.rfq_id::text || '/' || v_recipient.id::text || '/' || v_id::text || '/quotation.pdf';
    perform set_config('quotr.rfq_file_write', 'on', true);
    update public.rfq_response_files
    set original_filename = left(btrim(p_filename), 160),
        byte_size = p_byte_size,
        storage_object_path = v_path,
        upload_status = 'pending',
        mime_type = null
    where id = v_id;
  else
    v_id := gen_random_uuid();
    v_path := v_response.org_id::text || '/' || v_recipient.rfq_id::text || '/' || v_recipient.id::text || '/' || v_id::text || '/quotation.pdf';
    insert into public.rfq_response_files (
      id, org_id, response_id, original_filename, byte_size, storage_object_path, upload_status
    ) values (
      v_id, v_response.org_id, v_response.id, left(btrim(p_filename), 160), p_byte_size, v_path, 'pending'
    );
  end if;
  return jsonb_build_object('ok', true, 'fileId', v_id);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
end;
$$;

create or replace function public.rfq_response_upload_path_v1(p_token_hash text, p_file uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token public.rfq_access_tokens%rowtype;
  v_file public.rfq_response_files%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;
  select * into v_token from public.rfq_access_tokens where token_hash = p_token_hash and revoked_at is null and expires_at > now();
  if not found then
    return jsonb_build_object('ok', false, 'error', 'UNAVAILABLE');
  end if;
  select file.* into v_file
  from public.rfq_response_files file
  join public.rfq_responses response on response.id = file.response_id
  where file.id = p_file
    and response.recipient_id = v_token.recipient_id
    and response.status = 'draft'
    and file.upload_status = 'pending';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  return jsonb_build_object('ok', true, 'path', v_file.storage_object_path, 'byteSize', v_file.byte_size);
end;
$$;

create or replace function public.complete_rfq_response_upload_v1(p_file uuid, p_byte_size bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_file public.rfq_response_files%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;
  select * into v_file from public.rfq_response_files where id = p_file and upload_status = 'pending' for update;
  if not found or p_byte_size is distinct from v_file.byte_size then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  perform set_config('quotr.rfq_file_write', 'on', true);
  update public.rfq_response_files
  set upload_status = 'ready', mime_type = 'application/pdf'
  where id = v_file.id;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.fail_rfq_response_upload_v1(p_file uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;
  perform set_config('quotr.rfq_file_write', 'on', true);
  update public.rfq_response_files
  set upload_status = 'failed', storage_object_path = null
  where id = p_file and upload_status = 'pending';
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.resolve_rfq_shared_file_v1(p_token_hash text, p_file uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token public.rfq_access_tokens%rowtype;
  v_file public.rfq_shared_documents%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;
  if not public.rfq_public_rate_ok(coalesce(p_token_hash, ''), 'download', 60) then
    return jsonb_build_object('ok', false, 'error', 'RATE_LIMITED');
  end if;
  select * into v_token from public.rfq_access_tokens where token_hash = p_token_hash and revoked_at is null and expires_at > now();
  if not found then
    return jsonb_build_object('ok', false, 'error', 'UNAVAILABLE');
  end if;
  select file.* into v_file
  from public.rfq_shared_documents file
  join public.rfq_recipients recipient on recipient.rfq_id = file.rfq_id
  where file.id = p_file and recipient.id = v_token.recipient_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  return jsonb_build_object(
    'ok', true,
    'path', v_file.storage_object_path,
    'filename', v_file.display_filename,
    'mimeType', v_file.mime_type
  );
end;
$$;

create or replace function public.resolve_rfq_response_file_v1(p_token_hash text, p_response uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token public.rfq_access_tokens%rowtype;
  v_file public.rfq_response_files%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;
  select * into v_token from public.rfq_access_tokens where token_hash = p_token_hash and revoked_at is null and expires_at > now();
  if not found then
    return jsonb_build_object('ok', false, 'error', 'UNAVAILABLE');
  end if;
  select file.* into v_file
  from public.rfq_response_files file
  join public.rfq_responses response on response.id = file.response_id
  where response.id = p_response
    and response.recipient_id = v_token.recipient_id
    and file.upload_status = 'ready';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  return jsonb_build_object(
    'ok', true,
    'path', v_file.storage_object_path,
    'filename', v_file.original_filename,
    'mimeType', 'application/pdf'
  );
end;
$$;

revoke all on function public.rfq_public_rate_ok(text, text, integer) from public, anon, authenticated;
revoke all on function public.rfq_event(uuid, uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.rfq_token_row(text) from public, anon, authenticated;
revoke all on function public.save_rfq_draft_v1(jsonb) from public, anon;
revoke all on function public.send_rfq_v1(uuid, jsonb) from public, anon;
revoke all on function public.resend_rfq_recipient_v1(uuid, text) from public, anon;
revoke all on function public.revoke_rfq_recipient_v1(uuid) from public, anon;
revoke all on function public.begin_rfq_delivery_v1(uuid, text) from public, anon;
revoke all on function public.complete_rfq_delivery_v1(uuid, text) from public, anon;
revoke all on function public.fail_rfq_delivery_v1(uuid, text) from public, anon;
revoke all on function public.apply_rfq_delivery_event_v1(text, text) from public, anon, authenticated;
revoke all on function public.expire_project_rfqs_v1(uuid) from public, anon;
revoke all on function public.lookup_rfq_by_token_hash_v1(text) from public;
revoke all on function public.public_rfq_clarify_v1(text, text) from public;
revoke all on function public.public_rfq_decline_v1(text, text) from public;
revoke all on function public.public_rfq_save_response_v1(text, jsonb, boolean, boolean) from public;
revoke all on function public.prepare_rfq_response_upload_v1(text, uuid, text, bigint) from public;
revoke all on function public.rfq_response_upload_path_v1(text, uuid) from public, anon, authenticated;
revoke all on function public.complete_rfq_response_upload_v1(uuid, bigint) from public, anon, authenticated;
revoke all on function public.fail_rfq_response_upload_v1(uuid) from public, anon, authenticated;
revoke all on function public.resolve_rfq_shared_file_v1(text, uuid) from public, anon, authenticated;
revoke all on function public.resolve_rfq_response_file_v1(text, uuid) from public, anon, authenticated;

grant execute on function public.save_rfq_draft_v1(jsonb) to authenticated;
grant execute on function public.send_rfq_v1(uuid, jsonb) to authenticated;
grant execute on function public.resend_rfq_recipient_v1(uuid, text) to authenticated;
grant execute on function public.revoke_rfq_recipient_v1(uuid) to authenticated;
grant execute on function public.begin_rfq_delivery_v1(uuid, text) to authenticated;
grant execute on function public.complete_rfq_delivery_v1(uuid, text) to authenticated;
grant execute on function public.fail_rfq_delivery_v1(uuid, text) to authenticated;
grant execute on function public.expire_project_rfqs_v1(uuid) to authenticated;
grant execute on function public.lookup_rfq_by_token_hash_v1(text) to anon, authenticated;
grant execute on function public.public_rfq_clarify_v1(text, text) to anon, authenticated;
grant execute on function public.public_rfq_decline_v1(text, text) to anon, authenticated;
grant execute on function public.public_rfq_save_response_v1(text, jsonb, boolean, boolean) to anon, authenticated;
grant execute on function public.prepare_rfq_response_upload_v1(text, uuid, text, bigint) to anon, authenticated;
grant execute on function public.apply_rfq_delivery_event_v1(text, text) to service_role;
grant execute on function public.rfq_response_upload_path_v1(text, uuid) to service_role;
grant execute on function public.complete_rfq_response_upload_v1(uuid, bigint) to service_role;
grant execute on function public.fail_rfq_response_upload_v1(uuid) to service_role;
grant execute on function public.resolve_rfq_shared_file_v1(text, uuid) to service_role;
grant execute on function public.resolve_rfq_response_file_v1(text, uuid) to service_role;

comment on function public.lookup_rfq_by_token_hash_v1(text) is
  'One recipient sees only that request, its selected files, and their own response. No client identity, estimate, margin, pricing, or other recipients.';

notify pgrst, 'reload schema';
