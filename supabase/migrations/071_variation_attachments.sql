-- VARIATIONS-03A.2
-- Photos and files belong to one organisation, project, variation and revision.
-- Project Documents may later list these same rows. It must not copy the object
-- or insert a second attachment row. Issued rows stay immutable.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'variation-attachments',
  'variation-attachments',
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

-- No storage policies. Anon and authenticated clients cannot read or write this
-- private bucket. Server actions upload with the service role only after the
-- organisation is resolved from the signed-in profile, and only to a path the
-- database generated. Signed URLs are issued after that same ownership check.
-- Client downloads go through the Variation token route, which never returns
-- the bucket name or object path.

create table if not exists public.variation_attachments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  variation_id uuid not null references public.variations (id) on delete cascade,
  variation_revision_id uuid not null references public.variation_revisions (id) on delete cascade,
  visibility text not null check (visibility in ('client', 'internal')),
  storage_bucket text not null default 'variation-attachments'
    check (storage_bucket = 'variation-attachments'),
  storage_object_path text not null check (char_length(storage_object_path) between 8 and 500),
  shared_object_key text not null check (char_length(shared_object_key) between 8 and 500),
  original_filename text not null check (char_length(btrim(original_filename)) between 1 and 240),
  display_filename text not null check (char_length(btrim(display_filename)) between 1 and 140),
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0 and byte_size <= 15728640),
  caption text check (caption is null or char_length(caption) <= 500),
  internal_description text check (internal_description is null or char_length(internal_description) <= 500),
  linked_variation_item_id uuid references public.variation_items (id) on delete set null,
  sort_order integer not null default 0 check (sort_order >= 0 and sort_order < 1000),
  upload_status text not null check (upload_status in ('pending', 'ready', 'failed')),
  object_confirmed boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  frozen_at timestamptz,
  issued_manifest jsonb,
  schema_version integer not null default 1 check (schema_version = 1),
  source_attachment_id uuid references public.variation_attachments (id) on delete set null,
  constraint variation_attachments_revision_path_uidx unique (variation_revision_id, storage_object_path)
);

create index if not exists variation_attachments_revision_idx
  on public.variation_attachments (variation_revision_id, visibility, sort_order, id);

create index if not exists variation_attachments_project_idx
  on public.variation_attachments (project_id, variation_id, variation_revision_id, created_at);

create index if not exists variation_attachments_object_idx
  on public.variation_attachments (shared_object_key);

comment on table public.variation_attachments is
  'Owned by one Variation revision. Project Documents may index these rows and must not copy the storage object or create another attachment row. Issued attachments cannot be deleted from a future Documents screen.';

comment on column public.variation_attachments.visibility is
  'client files are part of the issued Variation. internal files stay inside the organisation.';

comment on column public.variation_attachments.shared_object_key is
  'Stable storage identity. A new revision copies the row and reuses this object. Deleting a draft reference must not delete the object while another revision still uses it.';

comment on column public.variation_attachments.issued_manifest is
  'Frozen client or internal file identity captured at issue. The public page reads the client manifest and does not rebuild it.';

alter table public.variation_attachments enable row level security;

revoke all on table public.variation_attachments from public, anon, authenticated;
grant select on table public.variation_attachments to authenticated;
grant select, insert, update, delete on table public.variation_attachments to service_role;

create policy "Users can select variation attachments in their organisation"
  on public.variation_attachments for select
  to authenticated
  using (org_id = public.auth_org_id());

create or replace function public.variation_attachment_mime_allowed(p_mime text)
returns boolean
language sql
immutable
as $$
  select p_mime in (
    'image/jpeg',
    'image/png',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
$$;

create or replace function public.variation_attachment_safe_filename(p_original text, p_mime text)
returns text
language plpgsql
immutable
as $$
declare
  v_name text;
  v_ext text;
begin
  v_ext := case p_mime
    when 'image/jpeg' then 'jpg'
    when 'image/png' then 'png'
    when 'application/pdf' then 'pdf'
    when 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' then 'docx'
    when 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' then 'xlsx'
    else null
  end;
  if v_ext is null then
    return null;
  end if;
  v_name := regexp_replace(coalesce(p_original, ''), '^.*[/\\]', '');
  v_name := regexp_replace(v_name, '[^A-Za-z0-9._() -]', '_', 'g');
  v_name := regexp_replace(v_name, '^\.+', '');
  v_name := left(btrim(v_name), 100);
  if v_name is null or v_name = '' then
    v_name := 'file';
  end if;
  if right(lower(v_name), char_length(v_ext) + 1) is distinct from '.' || v_ext
    and not (p_mime = 'image/jpeg' and right(lower(v_name), 5) = '.jpeg')
  then
    v_name := left(regexp_replace(v_name, '\.[^.]+$', ''), 90) || '.' || v_ext;
  end if;
  return v_name;
end;
$$;

create or replace function public.variation_attachment_guard()
returns trigger
language plpgsql
as $$
declare
  v_mode text := nullif(current_setting('quotr.variation_write', true), '');
  v_status text;
  v_org uuid;
  v_project uuid;
  v_variation uuid;
  v_prefix text;
begin
  if current_user in ('postgres', 'supabase_admin') and auth.uid() is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if v_mode = 'delete_draft' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    select status into v_status
    from public.variation_revisions
    where id = old.variation_revision_id;
    if v_status = 'draft' and v_mode = 'draft' and old.frozen_at is null then
      return old;
    end if;
    raise exception 'VARIATION_IMMUTABLE';
  end if;

  select status, org_id, project_id, variation_id
    into v_status, v_org, v_project, v_variation
  from public.variation_revisions
  where id = new.variation_revision_id;

  if tg_op = 'INSERT' then
    if v_mode not in ('draft', 'transition') or v_status is distinct from 'draft' then
      raise exception 'VARIATION_IMMUTABLE';
    end if;
    if new.org_id is distinct from v_org
      or new.project_id is distinct from v_project
      or new.variation_id is distinct from v_variation
      or not public.variation_attachment_mime_allowed(new.mime_type)
      or new.storage_bucket is distinct from 'variation-attachments'
    then
      raise exception 'VARIATION_ATTACHMENT_OWNERSHIP';
    end if;
    if position('..' in new.storage_object_path) > 0 or new.shared_object_key is null then
      raise exception 'VARIATION_ATTACHMENT_PATH';
    end if;
    if new.source_attachment_id is null then
      v_prefix := new.org_id::text || '/' || new.project_id::text || '/' || new.variation_id::text
        || '/' || new.variation_revision_id::text || '/' || new.id::text || '/';
      if new.storage_object_path not like v_prefix || '%'
        or new.shared_object_key is distinct from new.storage_object_path
      then
        raise exception 'VARIATION_ATTACHMENT_PATH';
      end if;
    elsif not exists (
      select 1
      from public.variation_attachments src
      where src.id = new.source_attachment_id
        and src.org_id = new.org_id
        and src.project_id = new.project_id
        and src.variation_id = new.variation_id
        and src.variation_revision_id is distinct from new.variation_revision_id
        and src.storage_object_path = new.storage_object_path
        and src.shared_object_key = new.shared_object_key
        and src.storage_bucket = new.storage_bucket
    ) then
      raise exception 'VARIATION_ATTACHMENT_PATH';
    end if;
    if new.linked_variation_item_id is not null and not exists (
      select 1 from public.variation_items i
      where i.id = new.linked_variation_item_id
        and i.revision_id = new.variation_revision_id
        and i.org_id = new.org_id
    ) then
      raise exception 'VARIATION_ATTACHMENT_ITEM';
    end if;
    return new;
  end if;

  if old.frozen_at is not null or v_status is distinct from 'draft' then
    if v_mode = 'transition'
      and old.frozen_at is null
      and new.frozen_at is not null
      and new.org_id is not distinct from old.org_id
      and new.project_id is not distinct from old.project_id
      and new.variation_id is not distinct from old.variation_id
      and new.variation_revision_id is not distinct from old.variation_revision_id
      and new.visibility is not distinct from old.visibility
      and new.storage_bucket is not distinct from old.storage_bucket
      and new.storage_object_path is not distinct from old.storage_object_path
      and new.shared_object_key is not distinct from old.shared_object_key
      and new.original_filename is not distinct from old.original_filename
      and new.display_filename is not distinct from old.display_filename
      and new.mime_type is not distinct from old.mime_type
      and new.byte_size is not distinct from old.byte_size
      and new.caption is not distinct from old.caption
      and new.internal_description is not distinct from old.internal_description
      and new.linked_variation_item_id is not distinct from old.linked_variation_item_id
      and new.sort_order is not distinct from old.sort_order
      and new.upload_status is not distinct from old.upload_status
      and new.object_confirmed is not distinct from old.object_confirmed
      and new.schema_version is not distinct from old.schema_version
      and new.source_attachment_id is not distinct from old.source_attachment_id
    then
      return new;
    end if;
    raise exception 'VARIATION_IMMUTABLE';
  end if;

  if v_mode is distinct from 'draft' then
    raise exception 'VARIATION_IMMUTABLE';
  end if;

  if new.org_id is distinct from old.org_id
    or new.project_id is distinct from old.project_id
    or new.variation_id is distinct from old.variation_id
    or new.variation_revision_id is distinct from old.variation_revision_id
    or new.visibility is distinct from old.visibility
    or new.storage_bucket is distinct from old.storage_bucket
    or new.storage_object_path is distinct from old.storage_object_path
    or new.shared_object_key is distinct from old.shared_object_key
    or new.original_filename is distinct from old.original_filename
    or new.mime_type is distinct from old.mime_type
    or new.schema_version is distinct from old.schema_version
    or new.source_attachment_id is distinct from old.source_attachment_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
  then
    raise exception 'VARIATION_IMMUTABLE';
  end if;

  if new.linked_variation_item_id is not null and not exists (
    select 1 from public.variation_items i
    where i.id = new.linked_variation_item_id
      and i.revision_id = new.variation_revision_id
      and i.org_id = new.org_id
  ) then
    raise exception 'VARIATION_ATTACHMENT_ITEM';
  end if;
  return new;
end;
$$;

drop trigger if exists variation_attachments_guard on public.variation_attachments;
create trigger variation_attachments_guard
  before insert or update or delete on public.variation_attachments
  for each row execute function public.variation_attachment_guard();

create or replace function public.variation_freeze_attachment_manifest()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.status = 'draft' and new.status = 'issued' then
    update public.variation_attachments a
    set
      frozen_at = now(),
      issued_manifest = jsonb_build_object(
        'displayFilename', a.display_filename,
        'caption', a.caption,
        'mimeType', a.mime_type,
        'byteSize', a.byte_size,
        'sortOrder', a.sort_order,
        'visibility', a.visibility,
        'storageBucket', a.storage_bucket,
        'storageObjectPath', a.storage_object_path,
        'linkedVariationItemId', a.linked_variation_item_id,
        'internalDescription', a.internal_description
      )
    where a.variation_revision_id = new.id
      and a.upload_status = 'ready'
      and a.object_confirmed
      and a.frozen_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists variation_revisions_freeze_attachments on public.variation_revisions;
create trigger variation_revisions_freeze_attachments
  after update on public.variation_revisions
  for each row execute function public.variation_freeze_attachment_manifest();

create or replace function public.variation_issue_blocker(p_revision uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_unresolved integer;
  v_net numeric;
  v_abs numeric;
  v_nocost integer;
  v_bad integer;
begin
  select
    count(*),
    count(*) filter (where line_sell_adjustment_ex_gst is null),
    coalesce(sum(line_sell_adjustment_ex_gst), 0),
    coalesce(sum(abs(line_sell_adjustment_ex_gst)), 0),
    count(*) filter (where item_type = 'no_cost_scope_change')
  into v_count, v_unresolved, v_net, v_abs, v_nocost
  from public.variation_items
  where revision_id = p_revision;

  if v_count = 0 then
    return 'EMPTY_VARIATION';
  end if;
  if v_unresolved > 0 then
    return 'UNRESOLVED_PRICING';
  end if;

  select count(*) into v_bad
  from (
    select substitution_group_id
    from public.variation_items
    where revision_id = p_revision
      and substitution_group_id is not null
    group by substitution_group_id
    having count(*) filter (where item_type = 'addition') <> 1
      or count(*) filter (where item_type = 'omission') <> 1
      or count(*) <> 2
  ) bad;
  if v_bad > 0 then
    return 'INVALID_SUBSTITUTION';
  end if;

  if public.variation_round_money(v_net) = 0
    and public.variation_round_money(v_abs) = 0
    and v_nocost = 0
  then
    return 'ZERO_NET_UNDOCUMENTED';
  end if;

  if exists (
    select 1
    from public.variation_attachments a
    where a.variation_revision_id = p_revision
      and a.visibility = 'client'
      and (
        a.upload_status is distinct from 'ready'
        or a.object_confirmed is not true
        or a.byte_size <= 0
        or not public.variation_attachment_mime_allowed(a.mime_type)
        or a.storage_bucket is distinct from 'variation-attachments'
        or a.storage_object_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[^/]+$'
        or not exists (
          select 1
          from storage.objects o
          where o.bucket_id = a.storage_bucket
            and o.name = a.storage_object_path
        )
      )
  ) then
    return 'ATTACHMENT_INCOMPLETE';
  end if;

  return null;
end;
$$;

create or replace function public.prepare_variation_attachment_v1(
  p_revision uuid,
  p_visibility text,
  p_original_filename text,
  p_mime_type text,
  p_byte_size bigint,
  p_caption text,
  p_internal_description text,
  p_linked_item uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := public.auth_org_id();
  v_rev public.variation_revisions%rowtype;
  v_active integer;
  v_id uuid := gen_random_uuid();
  v_safe text;
  v_path text;
  v_sort integer;
  v_caption text := nullif(left(btrim(coalesce(p_caption, '')), 500), '');
  v_internal text := nullif(left(btrim(coalesce(p_internal_description, '')), 500), '');
begin
  if v_uid is null or v_org is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  end if;
  if p_visibility not in ('client', 'internal') or not public.variation_attachment_mime_allowed(p_mime_type) then
    return jsonb_build_object('ok', false, 'error', 'FILE_TYPE');
  end if;
  if p_byte_size is null or p_byte_size <= 0 or p_byte_size > 15728640 then
    return jsonb_build_object('ok', false, 'error', 'FILE_TOO_LARGE');
  end if;

  select * into v_rev
  from public.variation_revisions
  where id = p_revision
  for update;
  if not found or v_rev.org_id is distinct from v_org then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_rev.status is distinct from 'draft' then
    return jsonb_build_object('ok', false, 'error', 'IMMUTABLE');
  end if;
  if p_linked_item is not null and not exists (
    select 1 from public.variation_items i
    where i.id = p_linked_item
      and i.revision_id = v_rev.id
      and i.org_id = v_org
      and i.project_id = v_rev.project_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;

  select count(*) into v_active
  from public.variation_attachments
  where variation_revision_id = v_rev.id
    and upload_status <> 'failed';
  if v_active >= 20 then
    return jsonb_build_object('ok', false, 'error', 'ATTACHMENT_LIMIT');
  end if;

  v_safe := public.variation_attachment_safe_filename(p_original_filename, p_mime_type);
  if v_safe is null then
    return jsonb_build_object('ok', false, 'error', 'FILE_TYPE');
  end if;
  v_path := v_rev.org_id::text || '/' || v_rev.project_id::text || '/' || v_rev.variation_id::text
    || '/' || v_rev.id::text || '/' || v_id::text || '/' || v_safe;
  select coalesce(max(sort_order), -1) + 1 into v_sort
  from public.variation_attachments
  where variation_revision_id = v_rev.id
    and visibility = p_visibility;

  perform set_config('quotr.variation_write', 'draft', true);
  insert into public.variation_attachments (
    id, org_id, project_id, variation_id, variation_revision_id, visibility,
    storage_bucket, storage_object_path, shared_object_key, original_filename,
    display_filename, mime_type, byte_size, caption, internal_description,
    linked_variation_item_id, sort_order, upload_status, object_confirmed,
    created_by, schema_version
  ) values (
    v_id, v_rev.org_id, v_rev.project_id, v_rev.variation_id, v_rev.id, p_visibility,
    'variation-attachments', v_path, v_path, left(coalesce(nullif(btrim(p_original_filename), ''), 'file'), 240),
    v_safe, p_mime_type, p_byte_size,
    case when p_visibility = 'client' then v_caption else null end,
    case when p_visibility = 'internal' then v_internal else null end,
    p_linked_item, v_sort, 'pending', false, v_uid, 1
  );

  return jsonb_build_object(
    'ok', true,
    'attachmentId', v_id,
    'storageBucket', 'variation-attachments',
    'storageObjectPath', v_path,
    'displayFilename', v_safe
  );
exception
  when others then
    if sqlerrm in ('VARIATION_IMMUTABLE', 'VARIATION_ATTACHMENT_OWNERSHIP', 'VARIATION_ATTACHMENT_PATH', 'VARIATION_ATTACHMENT_ITEM') then
      return jsonb_build_object('ok', false, 'error', 'IMMUTABLE');
    end if;
    raise;
end;
$$;

create or replace function public.complete_variation_attachment_v1(
  p_attachment uuid,
  p_byte_size bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
  v_row public.variation_attachments%rowtype;
  v_status text;
  v_object_size bigint;
begin
  if auth.uid() is null or v_org is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  end if;
  select * into v_row
  from public.variation_attachments
  where id = p_attachment
  for update;
  if not found or v_row.org_id is distinct from v_org then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  select status into v_status from public.variation_revisions where id = v_row.variation_revision_id;
  if v_status is distinct from 'draft' or v_row.frozen_at is not null or v_row.upload_status is distinct from 'pending' then
    return jsonb_build_object('ok', false, 'error', 'IMMUTABLE');
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
  perform set_config('quotr.variation_write', 'draft', true);
  update public.variation_attachments
  set upload_status = 'ready', object_confirmed = true
  where id = v_row.id;
  return jsonb_build_object('ok', true, 'attachmentId', v_row.id, 'uploadStatus', 'ready');
exception
  when others then
    if sqlerrm = 'VARIATION_IMMUTABLE' then
      return jsonb_build_object('ok', false, 'error', 'IMMUTABLE');
    end if;
    raise;
end;
$$;

create or replace function public.fail_variation_attachment_v1(p_attachment uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
  v_row public.variation_attachments%rowtype;
  v_status text;
begin
  if auth.uid() is null or v_org is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  end if;
  select * into v_row from public.variation_attachments where id = p_attachment for update;
  if not found or v_row.org_id is distinct from v_org then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  select status into v_status from public.variation_revisions where id = v_row.variation_revision_id;
  if v_status is distinct from 'draft' or v_row.upload_status is distinct from 'pending' then
    return jsonb_build_object('ok', false, 'error', 'IMMUTABLE');
  end if;
  perform set_config('quotr.variation_write', 'draft', true);
  update public.variation_attachments
  set upload_status = 'failed', object_confirmed = false
  where id = v_row.id;
  return jsonb_build_object('ok', true, 'attachmentId', v_row.id, 'uploadStatus', 'failed');
exception
  when others then
    if sqlerrm = 'VARIATION_IMMUTABLE' then
      return jsonb_build_object('ok', false, 'error', 'IMMUTABLE');
    end if;
    raise;
end;
$$;

create or replace function public.retry_variation_attachment_v1(
  p_attachment uuid,
  p_byte_size bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
  v_row public.variation_attachments%rowtype;
  v_status text;
begin
  if auth.uid() is null or v_org is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  end if;
  if p_byte_size is null or p_byte_size <= 0 or p_byte_size > 15728640 then
    return jsonb_build_object('ok', false, 'error', 'FILE_TOO_LARGE');
  end if;
  select * into v_row from public.variation_attachments where id = p_attachment for update;
  if not found or v_row.org_id is distinct from v_org then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  select status into v_status from public.variation_revisions where id = v_row.variation_revision_id;
  if v_status is distinct from 'draft' or v_row.upload_status is distinct from 'failed' then
    return jsonb_build_object('ok', false, 'error', 'IMMUTABLE');
  end if;
  perform set_config('quotr.variation_write', 'draft', true);
  update public.variation_attachments
  set upload_status = 'pending', object_confirmed = false, byte_size = p_byte_size
  where id = v_row.id;
  return jsonb_build_object(
    'ok', true,
    'attachmentId', v_row.id,
    'storageObjectPath', v_row.storage_object_path,
    'mimeType', v_row.mime_type,
    'uploadStatus', 'pending'
  );
exception
  when others then
    if sqlerrm = 'VARIATION_IMMUTABLE' then
      return jsonb_build_object('ok', false, 'error', 'IMMUTABLE');
    end if;
    raise;
end;
$$;

create or replace function public.update_draft_variation_attachment_v1(
  p_attachment uuid,
  p_display_filename text,
  p_caption text,
  p_internal_description text,
  p_linked_item uuid,
  p_clear_link boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
  v_row public.variation_attachments%rowtype;
  v_status text;
  v_name text;
  v_link uuid;
begin
  if auth.uid() is null or v_org is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  end if;
  select * into v_row from public.variation_attachments where id = p_attachment for update;
  if not found or v_row.org_id is distinct from v_org then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  select status into v_status from public.variation_revisions where id = v_row.variation_revision_id;
  if v_status is distinct from 'draft' or v_row.frozen_at is not null then
    return jsonb_build_object('ok', false, 'error', 'IMMUTABLE');
  end if;
  v_name := public.variation_attachment_safe_filename(coalesce(nullif(btrim(p_display_filename), ''), v_row.display_filename), v_row.mime_type);
  if v_name is null then
    return jsonb_build_object('ok', false, 'error', 'FILE_TYPE');
  end if;
  v_link := case when coalesce(p_clear_link, false) then null else coalesce(p_linked_item, v_row.linked_variation_item_id) end;
  if v_link is not null and not exists (
    select 1 from public.variation_items i
    where i.id = v_link and i.revision_id = v_row.variation_revision_id and i.org_id = v_org
  ) then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  perform set_config('quotr.variation_write', 'draft', true);
  update public.variation_attachments
  set
    display_filename = v_name,
    caption = case when v_row.visibility = 'client' then nullif(left(btrim(coalesce(p_caption, '')), 500), '') else null end,
    internal_description = case when v_row.visibility = 'internal' then nullif(left(btrim(coalesce(p_internal_description, '')), 500), '') else null end,
    linked_variation_item_id = v_link
  where id = v_row.id;
  return jsonb_build_object('ok', true, 'attachmentId', v_row.id, 'displayFilename', v_name);
exception
  when others then
    if sqlerrm in ('VARIATION_IMMUTABLE', 'VARIATION_ATTACHMENT_ITEM') then
      return jsonb_build_object('ok', false, 'error', 'IMMUTABLE');
    end if;
    raise;
end;
$$;

create or replace function public.reorder_draft_variation_attachments_v1(
  p_revision uuid,
  p_visibility text,
  p_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
  v_status text;
  v_expected integer;
  v_index integer := 0;
  v_id uuid;
begin
  if auth.uid() is null or v_org is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  end if;
  if p_visibility not in ('client', 'internal') then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  select status into v_status
  from public.variation_revisions
  where id = p_revision and org_id = v_org
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_status is distinct from 'draft' then
    return jsonb_build_object('ok', false, 'error', 'IMMUTABLE');
  end if;
  select count(*) into v_expected
  from public.variation_attachments
  where variation_revision_id = p_revision
    and org_id = v_org
    and visibility = p_visibility
    and upload_status <> 'failed';
  if p_ids is null or coalesce(array_length(p_ids, 1), 0) is distinct from v_expected or (select count(distinct x) from unnest(p_ids) x) is distinct from v_expected then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  if exists (
    select 1
    from unnest(p_ids) as incoming(id)
    where not exists (
      select 1 from public.variation_attachments a
      where a.id = incoming.id
        and a.variation_revision_id = p_revision
        and a.visibility = p_visibility
        and a.upload_status <> 'failed'
        and a.org_id = v_org
    )
  ) then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  perform set_config('quotr.variation_write', 'draft', true);
  foreach v_id in array p_ids loop
    update public.variation_attachments
    set sort_order = v_index
    where id = v_id;
    v_index := v_index + 1;
  end loop;
  return jsonb_build_object('ok', true, 'revisionId', p_revision);
exception
  when others then
    if sqlerrm = 'VARIATION_IMMUTABLE' then
      return jsonb_build_object('ok', false, 'error', 'IMMUTABLE');
    end if;
    raise;
end;
$$;

create or replace function public.remove_draft_variation_attachment_v1(p_attachment uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
  v_row public.variation_attachments%rowtype;
  v_status text;
  v_others integer;
begin
  if auth.uid() is null or v_org is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  end if;
  select * into v_row from public.variation_attachments where id = p_attachment for update;
  if not found or v_row.org_id is distinct from v_org then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  select status into v_status from public.variation_revisions where id = v_row.variation_revision_id;
  if v_status is distinct from 'draft' or v_row.frozen_at is not null then
    return jsonb_build_object('ok', false, 'error', 'IMMUTABLE');
  end if;
  select count(*) into v_others
  from public.variation_attachments
  where shared_object_key = v_row.shared_object_key
    and id <> v_row.id;
  perform set_config('quotr.variation_write', 'draft', true);
  delete from public.variation_attachments where id = v_row.id;
  return jsonb_build_object(
    'ok', true,
    'attachmentId', v_row.id,
    'deleteObject', v_others = 0,
    'storageBucket', v_row.storage_bucket,
    'storageObjectPath', v_row.storage_object_path
  );
exception
  when others then
    if sqlerrm = 'VARIATION_IMMUTABLE' then
      return jsonb_build_object('ok', false, 'error', 'IMMUTABLE');
    end if;
    raise;
end;
$$;

create or replace function public.authorize_variation_attachment_v1(p_attachment uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
  v_row public.variation_attachments%rowtype;
begin
  if auth.uid() is null or v_org is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  end if;
  select * into v_row
  from public.variation_attachments
  where id = p_attachment
    and org_id = v_org
    and upload_status = 'ready'
    and object_confirmed;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  return jsonb_build_object(
    'ok', true,
    'storageBucket', v_row.storage_bucket,
    'storageObjectPath', v_row.storage_object_path,
    'mimeType', v_row.mime_type,
    'displayFilename', v_row.display_filename
  );
end;
$$;

create or replace function public.resolve_variation_client_attachment_v1(
  p_token_hash text,
  p_file_id uuid
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
  v_row public.variation_attachments%rowtype;
begin
  if v_hash is null or p_file_id is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  select * into v_token from public.variation_access_tokens where token_hash = v_hash limit 1;
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
  if v_rev.status = 'withdrawn' then
    return jsonb_build_object('ok', false, 'error', 'WITHDRAWN');
  end if;
  select * into v_variation
  from public.variations
  where id = v_token.variation_id and org_id = v_token.org_id;
  if not found
    or v_rev.status is distinct from 'issued'
    or v_variation.current_revision_id is distinct from v_rev.id
  then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  select * into v_row
  from public.variation_attachments
  where id = p_file_id
    and variation_revision_id = v_rev.id
    and org_id = v_token.org_id
    and visibility = 'client'
    and upload_status = 'ready'
    and object_confirmed
    and frozen_at is not null;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  return jsonb_build_object(
    'ok', true,
    'storageBucket', v_row.storage_bucket,
    'storageObjectPath', coalesce(v_row.issued_manifest->>'storageObjectPath', v_row.storage_object_path),
    'mimeType', coalesce(v_row.issued_manifest->>'mimeType', v_row.mime_type),
    'displayFilename', coalesce(v_row.issued_manifest->>'displayFilename', v_row.display_filename),
    'byteSize', coalesce((v_row.issued_manifest->>'byteSize')::bigint, v_row.byte_size)
  );
end;
$$;

create or replace function public.list_project_variation_attachments_v1(p_project uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
  v_rows jsonb;
begin
  if auth.uid() is null or v_org is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  end if;
  if not exists (
    select 1 from public.projects
    where id = p_project and org_id = v_org and deleted_at is null
  ) then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  select coalesce(jsonb_agg(row_to_json(src)::jsonb order by src.variation_number, src.revision_number, src.created_at), '[]'::jsonb)
    into v_rows
  from (
    select
      a.id,
      v.variation_number,
      r.revision_number,
      r.status as revision_status,
      a.visibility,
      a.mime_type,
      a.created_at,
      (a.frozen_at is not null) as frozen
    from public.variation_attachments a
    join public.variation_revisions r on r.id = a.variation_revision_id and r.org_id = a.org_id
    join public.variations v on v.id = a.variation_id and v.org_id = a.org_id
    where a.project_id = p_project
      and a.org_id = v_org
  ) src;
  return jsonb_build_object('ok', true, 'attachments', v_rows);
end;
$$;

create or replace function public.create_variation_revision_v1(
  p_variation uuid,
  p_revision uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := public.auth_org_id();
  v_row public.variations%rowtype;
  v_rev public.variation_revisions%rowtype;
  v_source public.variation_items%rowtype;
  v_file public.variation_attachments%rowtype;
  v_next uuid;
  v_next_number integer;
  v_new_item uuid;
  v_gate jsonb;
  v_old_ids uuid[] := '{}';
  v_new_ids uuid[] := '{}';
  v_linked uuid;
  v_pos integer;
begin
  if v_uid is null or v_org is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  end if;

  select * into v_row
  from public.variations
  where id = p_variation
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_row.org_id is distinct from v_org then
    return jsonb_build_object('ok', false, 'error', 'CROSS_TENANT');
  end if;

  v_gate := public.variation_project_gate(v_row.project_id);
  if coalesce(v_gate->>'ok', 'false') <> 'true' then
    return v_gate;
  end if;

  if v_row.current_revision_id is distinct from p_revision then
    select id, revision_number into v_next, v_next_number
    from public.variation_revisions
    where variation_id = p_variation
      and revised_from_revision_id = p_revision
      and id = v_row.current_revision_id
      and status = 'draft';
    if v_next is not null then
      return jsonb_build_object(
        'ok', true, 'idempotent', true, 'status', 'draft',
        'variationId', p_variation, 'revisionId', v_next, 'revisionNumber', v_next_number
      );
    end if;
    return jsonb_build_object('ok', false, 'error', 'STALE_REVISION');
  end if;

  select * into v_rev
  from public.variation_revisions
  where id = p_revision
    and variation_id = p_variation
  for update;
  if v_rev.status is distinct from 'issued' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_TRANSITION');
  end if;

  perform set_config('quotr.variation_write', 'transition', true);
  update public.variation_revisions
  set status = 'superseded', superseded_at = now()
  where id = p_revision;

  insert into public.variation_revisions (
    variation_id, org_id, project_id, revision_number, status, currency, gst_rate,
    tax_treatment, title, summary, proposed_time_effect_days, client_notes, internal_notes,
    revised_from_revision_id
  ) values (
    p_variation, v_org, v_row.project_id, v_rev.revision_number + 1, 'draft',
    v_rev.currency, v_rev.gst_rate, v_rev.tax_treatment, v_rev.title, v_rev.summary,
    v_rev.proposed_time_effect_days, v_rev.client_notes, v_rev.internal_notes, p_revision
  )
  returning id, revision_number into v_next, v_next_number;

  for v_source in
    select * from public.variation_items
    where revision_id = p_revision
    order by sort_order, id
  loop
    insert into public.variation_items (
      revision_id, variation_id, org_id, project_id, item_type, client_description,
      work_area_id, work_area_type, snapshot_line_id, stable_component_key,
      quantity, unit, unit_cost, line_cost_adjustment, unit_sell, line_sell_adjustment_ex_gst,
      sort_order, client_inclusion, client_exclusion, internal_metadata, substitution_group_id,
      pricing_mode
    ) values (
      v_next, v_source.variation_id, v_source.org_id, v_source.project_id, v_source.item_type, v_source.client_description,
      v_source.work_area_id, v_source.work_area_type, v_source.snapshot_line_id, v_source.stable_component_key,
      v_source.quantity, v_source.unit, v_source.unit_cost, v_source.line_cost_adjustment, v_source.unit_sell, v_source.line_sell_adjustment_ex_gst,
      v_source.sort_order, v_source.client_inclusion, v_source.client_exclusion, v_source.internal_metadata, v_source.substitution_group_id,
      v_source.pricing_mode
    )
    returning id into v_new_item;

    v_old_ids := array_append(v_old_ids, v_source.id);
    v_new_ids := array_append(v_new_ids, v_new_item);

    insert into public.variation_item_cost_components (
      org_id, project_id, variation_id, revision_id, item_id, category, description,
      quantity, unit, unit_cost, line_cost, sort_order, created_by, updated_by,
      cost_source, canonical_rate_key, source_label, source_unit, source_unit_cost,
      source_selected_at, source_record_id
    )
    select
      org_id, project_id, variation_id, v_next, v_new_item, category, description,
      quantity, unit, unit_cost, line_cost, sort_order, created_by, v_uid,
      cost_source, canonical_rate_key, source_label, source_unit, source_unit_cost,
      source_selected_at, source_record_id
    from public.variation_item_cost_components
    where item_id = v_source.id
    order by sort_order, id;
  end loop;

  for v_file in
    select * from public.variation_attachments
    where variation_revision_id = p_revision
      and upload_status = 'ready'
      and object_confirmed
    order by sort_order, id
  loop
    v_linked := null;
    if v_file.linked_variation_item_id is not null then
      v_pos := array_position(v_old_ids, v_file.linked_variation_item_id);
      if v_pos is not null then
        v_linked := v_new_ids[v_pos];
      end if;
    end if;
    insert into public.variation_attachments (
      org_id, project_id, variation_id, variation_revision_id, visibility,
      storage_bucket, storage_object_path, shared_object_key, original_filename,
      display_filename, mime_type, byte_size, caption, internal_description,
      linked_variation_item_id, sort_order, upload_status, object_confirmed,
      created_by, schema_version, source_attachment_id
    ) values (
      v_file.org_id, v_file.project_id, v_file.variation_id, v_next, v_file.visibility,
      v_file.storage_bucket, v_file.storage_object_path, v_file.shared_object_key, v_file.original_filename,
      v_file.display_filename, v_file.mime_type, v_file.byte_size, v_file.caption, v_file.internal_description,
      v_linked, v_file.sort_order, 'ready', true,
      v_uid, 1, v_file.id
    );
  end loop;

  perform public.variation_store_totals(v_next);

  update public.variations
  set current_revision_id = v_next, status = 'draft', title = v_rev.title, summary = v_rev.summary
  where id = p_variation;

  perform public.variation_append_event(
    v_org, v_row.project_id, v_uid, 'variation_superseded',
    p_variation, v_row.variation_number, p_revision, v_rev.revision_number,
    v_rev.total_sell_adjustment_ex_gst, v_rev.currency
  );

  return jsonb_build_object(
    'ok', true, 'idempotent', false, 'status', 'draft',
    'variationId', p_variation, 'revisionId', v_next, 'revisionNumber', v_next_number,
    'supersededRevisionId', p_revision
  );
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
  v_files jsonb;
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

  select coalesce(jsonb_agg(file order by sort_order), '[]'::jsonb) into v_files
  from (
    select (a.issued_manifest->>'sortOrder')::int as sort_order, jsonb_build_object(
      'fileId', a.id,
      'displayFilename', a.issued_manifest->>'displayFilename',
      'caption', a.issued_manifest->>'caption',
      'mimeType', a.issued_manifest->>'mimeType',
      'byteSize', (a.issued_manifest->>'byteSize')::bigint,
      'sortOrder', (a.issued_manifest->>'sortOrder')::int
    ) as file
    from public.variation_attachments a
    where a.variation_revision_id = v_rev.id
      and a.org_id = v_token.org_id
      and a.visibility = 'client'
      and a.frozen_at is not null
      and a.upload_status = 'ready'
      and a.issued_manifest is not null
  ) files;

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
    'items', v_items,
    'clientAttachments', v_files
  );
end;
$$;

revoke all on function public.variation_attachment_mime_allowed(text) from public, anon, authenticated;
revoke all on function public.variation_attachment_safe_filename(text, text) from public, anon, authenticated;
revoke all on function public.variation_attachment_guard() from public, anon, authenticated;
revoke all on function public.variation_freeze_attachment_manifest() from public, anon, authenticated;
revoke all on function public.prepare_variation_attachment_v1(uuid, text, text, text, bigint, text, text, uuid) from public, anon, authenticated;
revoke all on function public.complete_variation_attachment_v1(uuid, bigint) from public, anon, authenticated;
revoke all on function public.fail_variation_attachment_v1(uuid) from public, anon, authenticated;
revoke all on function public.retry_variation_attachment_v1(uuid, bigint) from public, anon, authenticated;
revoke all on function public.update_draft_variation_attachment_v1(uuid, text, text, text, uuid, boolean) from public, anon, authenticated;
revoke all on function public.reorder_draft_variation_attachments_v1(uuid, text, uuid[]) from public, anon, authenticated;
revoke all on function public.remove_draft_variation_attachment_v1(uuid) from public, anon, authenticated;
revoke all on function public.authorize_variation_attachment_v1(uuid) from public, anon, authenticated;
revoke all on function public.resolve_variation_client_attachment_v1(text, uuid) from public, anon, authenticated;
revoke all on function public.list_project_variation_attachments_v1(uuid) from public, anon, authenticated;

grant execute on function public.prepare_variation_attachment_v1(uuid, text, text, text, bigint, text, text, uuid) to authenticated;
grant execute on function public.complete_variation_attachment_v1(uuid, bigint) to authenticated;
grant execute on function public.fail_variation_attachment_v1(uuid) to authenticated;
grant execute on function public.retry_variation_attachment_v1(uuid, bigint) to authenticated;
grant execute on function public.update_draft_variation_attachment_v1(uuid, text, text, text, uuid, boolean) to authenticated;
grant execute on function public.reorder_draft_variation_attachments_v1(uuid, text, uuid[]) to authenticated;
grant execute on function public.remove_draft_variation_attachment_v1(uuid) to authenticated;
grant execute on function public.authorize_variation_attachment_v1(uuid) to authenticated;
grant execute on function public.list_project_variation_attachments_v1(uuid) to authenticated;
grant execute on function public.resolve_variation_client_attachment_v1(text, uuid) to service_role;

notify pgrst, 'reload schema';
