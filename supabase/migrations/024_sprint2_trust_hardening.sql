-- Sprint 2: pricing audit log, estimate assumption metadata, derived-fact conflict warnings.

-- ---------------------------------------------------------------------------
-- pricing_audit_log
-- ---------------------------------------------------------------------------

create table if not exists public.pricing_audit_log (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  pricing_document_id uuid references public.pricing_documents (id) on delete set null,
  quote_id uuid references public.quotes (id) on delete set null,
  item_id uuid,
  user_id uuid references auth.users (id) on delete set null,
  action text not null,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

create index if not exists pricing_audit_log_org_id_idx
  on public.pricing_audit_log (organisation_id);

create index if not exists pricing_audit_log_project_id_idx
  on public.pricing_audit_log (project_id);

create index if not exists pricing_audit_log_created_at_idx
  on public.pricing_audit_log (created_at desc);

alter table public.pricing_audit_log enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'pricing_audit_log'
      and policyname = 'Users can select audit log in their organisation'
  ) then
    create policy "Users can select audit log in their organisation"
      on public.pricing_audit_log for select
      using (organisation_id = public.auth_org_id());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'pricing_audit_log'
      and policyname = 'Users can insert audit log in their organisation'
  ) then
    create policy "Users can insert audit log in their organisation"
      on public.pricing_audit_log for insert
      with check (organisation_id = public.auth_org_id());
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- estimate assumption metadata (internal defaulted-dimension flags)
-- ---------------------------------------------------------------------------

alter table public.estimates
  add column if not exists assumption_metadata jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- derived-fact override warnings on project facts
-- ---------------------------------------------------------------------------

alter table public.project_facts
  add column if not exists conflict_warning text;

notify pgrst, 'reload schema';
