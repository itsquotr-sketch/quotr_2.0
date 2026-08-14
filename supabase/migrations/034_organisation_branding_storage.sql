-- BRANDING-P0 — Organisation company logo storage
-- Public read for quote/print rendering; write scoped to caller's organisation.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organisation-branding',
  'organisation-branding',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path convention: {org_id}/branding/logo.<ext>

drop policy if exists "organisation_branding_select_public" on storage.objects;
create policy "organisation_branding_select_public"
  on storage.objects
  for select
  to public
  using (bucket_id = 'organisation-branding');

drop policy if exists "organisation_branding_insert_org_member" on storage.objects;
create policy "organisation_branding_insert_org_member"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'organisation-branding'
    and (storage.foldername(name))[1] = (
      select p.org_id::text
      from public.profiles p
      where p.id = auth.uid()
    )
    and (storage.foldername(name))[2] = 'branding'
  );

drop policy if exists "organisation_branding_update_org_member" on storage.objects;
create policy "organisation_branding_update_org_member"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'organisation-branding'
    and (storage.foldername(name))[1] = (
      select p.org_id::text
      from public.profiles p
      where p.id = auth.uid()
    )
  )
  with check (
    bucket_id = 'organisation-branding'
    and (storage.foldername(name))[1] = (
      select p.org_id::text
      from public.profiles p
      where p.id = auth.uid()
    )
  );

drop policy if exists "organisation_branding_delete_org_member" on storage.objects;
create policy "organisation_branding_delete_org_member"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'organisation-branding'
    and (storage.foldername(name))[1] = (
      select p.org_id::text
      from public.profiles p
      where p.id = auth.uid()
    )
  );

comment on column public.organisation_settings.logo_url is
  'Company logo display URL. Prefer uploaded organisation-branding storage public URL; may hold legacy external image URL until migrated.';
