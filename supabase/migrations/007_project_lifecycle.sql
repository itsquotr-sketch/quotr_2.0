-- Quotr 2.0 — Phase 5B-3 project lifecycle (archive, soft delete, duplicate)

alter table public.projects
  add column if not exists archived_at timestamptz;

alter table public.projects
  add column if not exists deleted_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'projects'
      and column_name = 'duplicated_from_project_id'
  ) then
    alter table public.projects
      add column duplicated_from_project_id uuid references public.projects (id);
  end if;
end $$;

create index if not exists projects_org_deleted_idx
  on public.projects (org_id, deleted_at);

create index if not exists projects_org_archived_idx
  on public.projects (org_id, archived_at);

-- Refresh PostgREST schema cache after adding columns
notify pgrst, 'reload schema';
