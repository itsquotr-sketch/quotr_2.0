-- Quotr 2.0 — Phase 5E project business pipeline status

alter table public.projects
  add column if not exists business_status text not null default 'lead';

alter table public.projects
  add column if not exists status_updated_at timestamptz;

alter table public.projects
  add column if not exists lost_reason text;

alter table public.projects
  add column if not exists won_at timestamptz;

alter table public.projects
  add column if not exists lost_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'projects_business_status_check'
  ) then
    alter table public.projects
      add constraint projects_business_status_check
      check (
        business_status in (
          'lead',
          'site_visit',
          'scoping',
          'estimating',
          'estimate_ready',
          'quote_draft',
          'quote_sent',
          'won',
          'lost',
          'archived'
        )
      );
  end if;
end $$;

create index if not exists projects_org_business_status_idx
  on public.projects (org_id, business_status);

create index if not exists projects_org_status_due_idx
  on public.projects (org_id, business_status, due_date);

notify pgrst, 'reload schema';
