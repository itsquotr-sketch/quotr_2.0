-- Quotr 2.0 — Phase 2C-1A project metadata

alter table public.projects
  add column client_name text,
  add column site_address text,
  add column priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  add column due_date date,
  add column notes text;

create index projects_org_id_priority_idx on public.projects (org_id, priority);
create index projects_org_id_due_date_idx on public.projects (org_id, due_date);

comment on column public.projects.client_name is
  'Optional client or customer name for this project.';

comment on column public.projects.site_address is
  'Optional project or site address.';

comment on column public.projects.priority is
  'Internal priority indicator for the project.';

comment on column public.projects.due_date is
  'Optional target due date for the project or estimate.';

comment on column public.projects.notes is
  'Optional internal notes about the project.';
