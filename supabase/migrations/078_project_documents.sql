-- UX-01F.2 — Project Document Centre.
-- A logical project document has immutable file versions.
-- A future subcontractor request may reference project_document_versions.id.
-- This migration does not create that request, copy Variation attachments,
-- or grant public object access.
--
-- Project deletion removes these rows through ON DELETE CASCADE from
-- public.projects. It does not delete storage objects. A row delete must not
-- remove an object that another version row, or a future request, still names.
-- Application code deletes an object only after an unready version row is gone
-- and no version row still stores that path.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-documents',
  'project-documents',
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
-- organisation and project are taken from the signed-in profile.

create table if not exists public.project_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 140),
  category text not null check (category in (
    'plans_and_drawings',
    'specifications',
    'photos',
    'reports',
    'client_documents',
    'other'
  )),
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists project_documents_project_idx
  on public.project_documents (org_id, project_id, category, created_at);

comment on table public.project_documents is
  'Logical project file. Versions hold the bytes. Archived documents stay readable and reject a new version until restored.';

comment on column public.project_documents.category is
  'Fixed launch set: plans_and_drawings, specifications, photos, reports, client_documents, other.';

create table if not exists public.project_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.project_documents (id) on delete cascade,
  org_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  version_number integer not null check (version_number >= 1 and version_number < 10000),
  original_filename text not null check (char_length(btrim(original_filename)) between 1 and 240),
  display_filename text not null check (char_length(btrim(display_filename)) between 1 and 140),
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0 and byte_size <= 15728640),
  storage_bucket text not null default 'project-documents'
    check (storage_bucket = 'project-documents'),
  storage_object_path text not null check (
    storage_object_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[^/]+$'
  ),
  visibility text not null check (visibility in ('internal', 'shareable')),
  version_note text check (version_note is null or char_length(version_note) <= 500),
  upload_status text not null check (upload_status in ('pending', 'ready', 'failed')),
  object_confirmed boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint project_document_versions_number_uidx unique (document_id, version_number),
  constraint project_document_versions_path_uidx unique (storage_object_path)
);

create index if not exists project_document_versions_project_idx
  on public.project_document_versions (org_id, project_id, upload_status, created_at);

create index if not exists project_document_versions_document_idx
  on public.project_document_versions (document_id, version_number desc);

comment on table public.project_document_versions is
  'Immutable file version. id is the identity a future subcontractor request may reference. Replacing a file inserts a new row and a new object.';

comment on column public.project_document_versions.visibility is
  'internal: organisation only. shareable: eligible for a later deliberate share. Shareable does not publish an object or create a public URL.';

comment on column public.project_document_versions.storage_object_path is
  'Server-generated private path. Authenticated clients are not granted this column.';

alter table public.project_documents enable row level security;
alter table public.project_document_versions enable row level security;

revoke all on table public.project_documents from public, anon, authenticated;
revoke all on table public.project_document_versions from public, anon, authenticated;
grant select on table public.project_documents to authenticated;
grant select (
  id,
  document_id,
  org_id,
  project_id,
  version_number,
  original_filename,
  display_filename,
  mime_type,
  byte_size,
  visibility,
  version_note,
  upload_status,
  object_confirmed,
  created_by,
  created_at
) on public.project_document_versions to authenticated;
grant select, insert, update, delete on table public.project_documents to service_role;
grant select, insert, update, delete on table public.project_document_versions to service_role;

create policy "Users can select project documents in their organisation"
  on public.project_documents for select
  to authenticated
  using (org_id = public.auth_org_id());

create policy "Users can select project document versions in their organisation"
  on public.project_document_versions for select
  to authenticated
  using (org_id = public.auth_org_id());

create or replace function public.project_document_guard()
returns trigger
language plpgsql
as $$
declare
  v_mode text := nullif(current_setting('quotr.project_document_write', true), '');
  v_org uuid;
begin
  if current_user in ('postgres', 'supabase_admin') and auth.uid() is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
      or new.org_id is distinct from old.org_id
      or new.project_id is distinct from old.project_id
      or new.category is distinct from old.category
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at
    then
      raise exception 'PROJECT_DOCUMENT_REASSIGNMENT';
    end if;
  end if;

  if v_mode is distinct from 'managed' then
    raise exception 'PROJECT_DOCUMENT_WRITE';
  end if;

  if tg_op = 'INSERT' then
    select org_id into v_org
    from public.projects
    where id = new.project_id
      and deleted_at is null;
    if v_org is distinct from new.org_id or v_org is distinct from public.auth_org_id() then
      raise exception 'PROJECT_DOCUMENT_OWNERSHIP';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.project_document_version_guard()
returns trigger
language plpgsql
as $$
declare
  v_mode text := nullif(current_setting('quotr.project_document_write', true), '');
  v_doc public.project_documents%rowtype;
  v_prefix text;
begin
  if current_user in ('postgres', 'supabase_admin') and auth.uid() is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
      or new.document_id is distinct from old.document_id
      or new.org_id is distinct from old.org_id
      or new.project_id is distinct from old.project_id
      or new.version_number is distinct from old.version_number
      or new.original_filename is distinct from old.original_filename
      or new.display_filename is distinct from old.display_filename
      or new.mime_type is distinct from old.mime_type
      or new.storage_bucket is distinct from old.storage_bucket
      or new.storage_object_path is distinct from old.storage_object_path
      or new.visibility is distinct from old.visibility
      or new.version_note is distinct from old.version_note
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at
    then
      raise exception 'PROJECT_DOCUMENT_REASSIGNMENT';
    end if;
    if new.byte_size is distinct from old.byte_size
      and not (
        old.upload_status in ('pending', 'failed')
        and new.upload_status = 'pending'
        and old.object_confirmed is false
      )
    then
      raise exception 'PROJECT_DOCUMENT_REASSIGNMENT';
    end if;
    if v_mode is distinct from 'managed' then
      raise exception 'PROJECT_DOCUMENT_WRITE';
    end if;
    return new;
  end if;

  if v_mode is distinct from 'managed' then
    raise exception 'PROJECT_DOCUMENT_WRITE';
  end if;

  select * into v_doc
  from public.project_documents
  where id = new.document_id;
  if not found
    or v_doc.org_id is distinct from new.org_id
    or v_doc.project_id is distinct from new.project_id
    or new.org_id is distinct from public.auth_org_id()
    or not public.variation_attachment_mime_allowed(new.mime_type)
    or new.storage_bucket is distinct from 'project-documents'
    or new.visibility not in ('internal', 'shareable')
  then
    raise exception 'PROJECT_DOCUMENT_OWNERSHIP';
  end if;

  v_prefix := new.org_id::text || '/' || new.project_id::text || '/' || new.document_id::text || '/' || new.id::text || '/';
  if position('..' in new.storage_object_path) > 0
    or new.storage_object_path not like v_prefix || '%'
    or new.storage_object_path is distinct from v_prefix || new.display_filename
  then
    raise exception 'PROJECT_DOCUMENT_PATH';
  end if;

  return new;
end;
$$;

drop trigger if exists project_documents_guard on public.project_documents;
create trigger project_documents_guard
  before insert or update or delete on public.project_documents
  for each row execute function public.project_document_guard();

drop trigger if exists project_document_versions_guard on public.project_document_versions;
create trigger project_document_versions_guard
  before insert or update or delete on public.project_document_versions
  for each row execute function public.project_document_version_guard();

create or replace function public.prepare_project_document_upload_v1(
  p_project uuid,
  p_document uuid,
  p_category text,
  p_title text,
  p_visibility text,
  p_original_filename text,
  p_mime_type text,
  p_byte_size bigint,
  p_version_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := public.auth_org_id();
  v_doc public.project_documents%rowtype;
  v_version integer;
  v_id uuid := gen_random_uuid();
  v_safe text;
  v_title text;
  v_note text := nullif(left(btrim(coalesce(p_version_note, '')), 500), '');
  v_document uuid;
begin
  if v_uid is null or v_org is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  end if;
  if p_visibility is distinct from 'internal' and p_visibility is distinct from 'shareable' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  if p_category not in (
    'plans_and_drawings', 'specifications', 'photos', 'reports', 'client_documents', 'other'
  ) or not public.variation_attachment_mime_allowed(p_mime_type) then
    return jsonb_build_object('ok', false, 'error', 'FILE_TYPE');
  end if;
  if p_byte_size is null or p_byte_size <= 0 or p_byte_size > 15728640 then
    return jsonb_build_object('ok', false, 'error', 'FILE_TOO_LARGE');
  end if;
  if not exists (
    select 1 from public.projects
    where id = p_project and org_id = v_org and deleted_at is null
  ) then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;

  v_safe := public.variation_attachment_safe_filename(p_original_filename, p_mime_type);
  if v_safe is null then
    return jsonb_build_object('ok', false, 'error', 'FILE_TYPE');
  end if;
  v_title := nullif(left(btrim(coalesce(p_title, '')), 140), '');
  if v_title is null then
    v_title := nullif(left(regexp_replace(v_safe, '\.[^.]+$', ''), 140), '');
  end if;
  if v_title is null then
    v_title := 'Project file';
  end if;

  perform set_config('quotr.project_document_write', 'managed', true);

  if p_document is null then
    insert into public.project_documents (
      org_id, project_id, title, category, created_by
    ) values (
      v_org, p_project, v_title, p_category, v_uid
    )
    returning * into v_doc;
    v_version := 1;
  else
    select * into v_doc
    from public.project_documents
    where id = p_document
      and org_id = v_org
      and project_id = p_project
    for update;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
    end if;
    if v_doc.archived_at is not null then
      return jsonb_build_object('ok', false, 'error', 'ARCHIVED');
    end if;
    if v_doc.category is distinct from p_category then
      return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
    end if;
    if nullif(left(btrim(coalesce(p_title, '')), 140), '') is not null
      and v_doc.title is distinct from v_title
    then
      update public.project_documents
      set title = v_title
      where id = v_doc.id;
      v_doc.title := v_title;
    end if;
    select coalesce(max(version_number), 0) + 1 into v_version
    from public.project_document_versions
    where document_id = v_doc.id;
  end if;

  v_document := v_doc.id;
  insert into public.project_document_versions (
    id, document_id, org_id, project_id, version_number, original_filename,
    display_filename, mime_type, byte_size, storage_bucket, storage_object_path,
    visibility, version_note, upload_status, object_confirmed, created_by
  ) values (
    v_id, v_document, v_org, p_project, v_version,
    left(coalesce(nullif(btrim(p_original_filename), ''), 'file'), 240),
    v_safe, p_mime_type, p_byte_size, 'project-documents',
    v_org::text || '/' || p_project::text || '/' || v_document::text || '/' || v_id::text || '/' || v_safe,
    p_visibility, v_note, 'pending', false, v_uid
  );

  return jsonb_build_object(
    'ok', true,
    'documentId', v_document,
    'versionId', v_id,
    'versionNumber', v_version,
    'displayFilename', v_safe,
    'mimeType', p_mime_type,
    'title', v_doc.title,
    'category', v_doc.category,
    'visibility', p_visibility
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'VERSION_CONFLICT');
  when others then
    if sqlerrm in (
      'PROJECT_DOCUMENT_REASSIGNMENT',
      'PROJECT_DOCUMENT_WRITE',
      'PROJECT_DOCUMENT_OWNERSHIP',
      'PROJECT_DOCUMENT_PATH'
    ) then
      return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
    end if;
    raise;
end;
$$;

create or replace function public.complete_project_document_version_v1(
  p_version uuid,
  p_byte_size bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
  v_row public.project_document_versions%rowtype;
  v_object_size bigint;
begin
  if auth.uid() is null or v_org is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  end if;
  select * into v_row
  from public.project_document_versions
  where id = p_version
  for update;
  if not found or v_row.org_id is distinct from v_org then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_row.upload_status is distinct from 'pending' or v_row.object_confirmed then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if p_byte_size is distinct from v_row.byte_size then
    return jsonb_build_object('ok', false, 'error', 'FILE_TOO_LARGE');
  end if;
  select nullif(o.metadata->>'size', '')::bigint into v_object_size
  from storage.objects o
  where o.bucket_id = v_row.storage_bucket
    and o.name = v_row.storage_object_path;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'MISSING_OBJECT');
  end if;
  if v_object_size is not null and v_object_size is distinct from v_row.byte_size then
    return jsonb_build_object('ok', false, 'error', 'FILE_TOO_LARGE');
  end if;
  perform set_config('quotr.project_document_write', 'managed', true);
  update public.project_document_versions
  set upload_status = 'ready', object_confirmed = true
  where id = v_row.id;
  return jsonb_build_object('ok', true, 'versionId', v_row.id, 'uploadStatus', 'ready');
exception
  when others then
    if sqlerrm in ('PROJECT_DOCUMENT_REASSIGNMENT', 'PROJECT_DOCUMENT_WRITE') then
      return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
    end if;
    raise;
end;
$$;

create or replace function public.fail_project_document_version_v1(p_version uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
  v_row public.project_document_versions%rowtype;
begin
  if auth.uid() is null or v_org is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  end if;
  select * into v_row
  from public.project_document_versions
  where id = p_version
  for update;
  if not found or v_row.org_id is distinct from v_org or v_row.upload_status is distinct from 'pending' then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  perform set_config('quotr.project_document_write', 'managed', true);
  update public.project_document_versions
  set upload_status = 'failed', object_confirmed = false
  where id = v_row.id;
  return jsonb_build_object('ok', true, 'versionId', v_row.id, 'uploadStatus', 'failed');
exception
  when others then
    if sqlerrm in ('PROJECT_DOCUMENT_REASSIGNMENT', 'PROJECT_DOCUMENT_WRITE') then
      return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
    end if;
    raise;
end;
$$;

create or replace function public.retry_project_document_version_v1(
  p_version uuid,
  p_byte_size bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
  v_row public.project_document_versions%rowtype;
  v_archived timestamptz;
begin
  if auth.uid() is null or v_org is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  end if;
  if p_byte_size is null or p_byte_size <= 0 or p_byte_size > 15728640 then
    return jsonb_build_object('ok', false, 'error', 'FILE_TOO_LARGE');
  end if;
  select * into v_row
  from public.project_document_versions
  where id = p_version
  for update;
  if not found or v_row.org_id is distinct from v_org then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_row.object_confirmed or v_row.upload_status not in ('pending', 'failed') then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  select archived_at into v_archived
  from public.project_documents
  where id = v_row.document_id
    and org_id = v_org
    and project_id = v_row.project_id;
  if v_archived is not null then
    return jsonb_build_object('ok', false, 'error', 'ARCHIVED');
  end if;
  perform set_config('quotr.project_document_write', 'managed', true);
  update public.project_document_versions
  set upload_status = 'pending', object_confirmed = false, byte_size = p_byte_size
  where id = v_row.id;
  return jsonb_build_object(
    'ok', true,
    'documentId', v_row.document_id,
    'versionId', v_row.id,
    'versionNumber', v_row.version_number,
    'displayFilename', v_row.display_filename,
    'mimeType', v_row.mime_type,
    'visibility', v_row.visibility
  );
exception
  when others then
    if sqlerrm in ('PROJECT_DOCUMENT_REASSIGNMENT', 'PROJECT_DOCUMENT_WRITE') then
      return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
    end if;
    raise;
end;
$$;

create or replace function public.remove_unready_project_document_version_v1(p_version uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
  v_row public.project_document_versions%rowtype;
  v_remaining integer;
begin
  if auth.uid() is null or v_org is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  end if;
  select * into v_row
  from public.project_document_versions
  where id = p_version
  for update;
  if not found or v_row.org_id is distinct from v_org then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_row.object_confirmed or v_row.upload_status not in ('pending', 'failed') then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  perform set_config('quotr.project_document_write', 'managed', true);
  delete from public.project_document_versions where id = v_row.id;
  select count(*) into v_remaining
  from public.project_document_versions
  where document_id = v_row.document_id;
  if v_remaining = 0 then
    delete from public.project_documents
    where id = v_row.document_id
      and org_id = v_org
      and not exists (
        select 1 from public.project_document_versions existing
        where existing.document_id = v_row.document_id
      );
  end if;
  return jsonb_build_object('ok', true, 'versionId', v_row.id);
exception
  when others then
    if sqlerrm in ('PROJECT_DOCUMENT_REASSIGNMENT', 'PROJECT_DOCUMENT_WRITE') then
      return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
    end if;
    raise;
end;
$$;

create or replace function public.rename_project_document_v1(
  p_document uuid,
  p_title text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
  v_title text := nullif(left(btrim(coalesce(p_title, '')), 140), '');
  v_doc public.project_documents%rowtype;
begin
  if auth.uid() is null or v_org is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  end if;
  if v_title is null then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  select * into v_doc
  from public.project_documents
  where id = p_document and org_id = v_org
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  perform set_config('quotr.project_document_write', 'managed', true);
  update public.project_documents
  set title = v_title
  where id = v_doc.id;
  return jsonb_build_object('ok', true, 'documentId', v_doc.id, 'title', v_title);
exception
  when others then
    if sqlerrm in ('PROJECT_DOCUMENT_REASSIGNMENT', 'PROJECT_DOCUMENT_WRITE') then
      return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
    end if;
    raise;
end;
$$;

create or replace function public.set_project_document_archived_v1(
  p_document uuid,
  p_archived boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
  v_doc public.project_documents%rowtype;
begin
  if auth.uid() is null or v_org is null or p_archived is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  end if;
  select * into v_doc
  from public.project_documents
  where id = p_document and org_id = v_org
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  perform set_config('quotr.project_document_write', 'managed', true);
  update public.project_documents
  set archived_at = case when p_archived then coalesce(v_doc.archived_at, now()) else null end
  where id = v_doc.id;
  return jsonb_build_object('ok', true, 'documentId', v_doc.id, 'archived', p_archived);
exception
  when others then
    if sqlerrm in ('PROJECT_DOCUMENT_REASSIGNMENT', 'PROJECT_DOCUMENT_WRITE') then
      return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
    end if;
    raise;
end;
$$;

create or replace function public.authorize_project_document_version_v1(p_version uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
  v_row public.project_document_versions%rowtype;
begin
  if auth.uid() is null or v_org is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  end if;
  select * into v_row
  from public.project_document_versions
  where id = p_version
    and org_id = v_org
    and upload_status = 'ready'
    and object_confirmed;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if not exists (
    select 1 from public.projects
    where id = v_row.project_id and org_id = v_org and deleted_at is null
  ) then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  return jsonb_build_object(
    'ok', true,
    'versionId', v_row.id,
    'documentId', v_row.document_id,
    'displayFilename', v_row.display_filename,
    'mimeType', v_row.mime_type
  );
end;
$$;

revoke all on function public.project_document_guard() from public, anon, authenticated;
revoke all on function public.project_document_version_guard() from public, anon, authenticated;
revoke all on function public.prepare_project_document_upload_v1(uuid, uuid, text, text, text, text, text, bigint, text) from public, anon, authenticated;
revoke all on function public.complete_project_document_version_v1(uuid, bigint) from public, anon, authenticated;
revoke all on function public.fail_project_document_version_v1(uuid) from public, anon, authenticated;
revoke all on function public.retry_project_document_version_v1(uuid, bigint) from public, anon, authenticated;
revoke all on function public.remove_unready_project_document_version_v1(uuid) from public, anon, authenticated;
revoke all on function public.rename_project_document_v1(uuid, text) from public, anon, authenticated;
revoke all on function public.set_project_document_archived_v1(uuid, boolean) from public, anon, authenticated;
revoke all on function public.authorize_project_document_version_v1(uuid) from public, anon, authenticated;

grant execute on function public.prepare_project_document_upload_v1(uuid, uuid, text, text, text, text, text, bigint, text) to authenticated;
grant execute on function public.complete_project_document_version_v1(uuid, bigint) to authenticated;
grant execute on function public.fail_project_document_version_v1(uuid) to authenticated;
grant execute on function public.retry_project_document_version_v1(uuid, bigint) to authenticated;
grant execute on function public.remove_unready_project_document_version_v1(uuid) to authenticated;
grant execute on function public.rename_project_document_v1(uuid, text) to authenticated;
grant execute on function public.set_project_document_archived_v1(uuid, boolean) to authenticated;
grant execute on function public.authorize_project_document_version_v1(uuid) to authenticated;

notify pgrst, 'reload schema';
