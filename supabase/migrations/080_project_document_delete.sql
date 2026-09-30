-- UX-01F.2a
-- Permanent deletion of a project-owned document. Authenticated clients
-- cannot delete these rows directly. The signed-in organisation and project
-- are checked again here. Storage objects are removed by the server only
-- after this authorisation, and only when no other document or Variation
-- still uses the object.

create or replace function public.project_document_version_is_referenced(p_version uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hit boolean;
  v_ref record;
begin
  for v_ref in
    select n.nspname as schema_name, rel.relname as table_name, att.attname as column_name
    from pg_constraint c
    join pg_class rel on rel.oid = c.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    join pg_attribute att on att.attrelid = rel.oid and att.attnum = any(c.conkey)
    where c.contype = 'f'
      and c.confrelid = 'public.project_document_versions'::regclass
      and n.nspname = 'public'
      and rel.relname not in ('project_document_versions', 'project_documents')
  loop
    execute format(
      'select exists (select 1 from %I.%I where %I = $1)',
      v_ref.schema_name,
      v_ref.table_name,
      v_ref.column_name
    ) into v_hit using p_version;
    if v_hit then
      return true;
    end if;
  end loop;
  return false;
end;
$$;

create or replace function public.authorize_project_document_delete_v1(
  p_project uuid,
  p_document uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
  v_doc public.project_documents%rowtype;
  v_count integer;
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
  select * into v_doc
  from public.project_documents
  where id = p_document
    and org_id = v_org
    and project_id = p_project
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if exists (
    select 1
    from public.project_document_versions version
    where version.document_id = v_doc.id
      and public.project_document_version_is_referenced(version.id)
  ) then
    return jsonb_build_object('ok', false, 'error', 'REFERENCED');
  end if;
  select count(*) into v_count
  from public.project_document_versions
  where document_id = v_doc.id;
  return jsonb_build_object(
    'ok', true,
    'documentId', v_doc.id,
    'title', v_doc.title,
    'versionCount', v_count
  );
end;
$$;

create or replace function public.commit_project_document_delete_v1(
  p_project uuid,
  p_document uuid
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
  if auth.uid() is null or v_org is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  end if;
  if not exists (
    select 1 from public.projects
    where id = p_project and org_id = v_org and deleted_at is null
  ) then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  select * into v_doc
  from public.project_documents
  where id = p_document
    and org_id = v_org
    and project_id = p_project
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if exists (
    select 1
    from public.project_document_versions version
    where version.document_id = v_doc.id
      and public.project_document_version_is_referenced(version.id)
  ) then
    return jsonb_build_object('ok', false, 'error', 'REFERENCED');
  end if;
  perform set_config('quotr.project_document_write', 'managed', true);
  delete from public.project_documents where id = v_doc.id;
  return jsonb_build_object('ok', true, 'documentId', v_doc.id);
exception
  when others then
    if sqlerrm in ('PROJECT_DOCUMENT_REASSIGNMENT', 'PROJECT_DOCUMENT_WRITE') then
      return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
    end if;
    raise;
end;
$$;

revoke all on function public.project_document_version_is_referenced(uuid) from public, anon, authenticated;
revoke all on function public.authorize_project_document_delete_v1(uuid, uuid) from public, anon, authenticated;
revoke all on function public.commit_project_document_delete_v1(uuid, uuid) from public, anon, authenticated;
grant execute on function public.authorize_project_document_delete_v1(uuid, uuid) to authenticated;
grant execute on function public.commit_project_document_delete_v1(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
