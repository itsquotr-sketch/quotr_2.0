-- Quotr 2.0 — Phase 5D-2 note proposals from site note analysis

create table public.note_proposals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  note_ids uuid[] not null default '{}',
  proposed_work_areas jsonb not null default '[]',
  proposed_facts jsonb not null default '[]',
  proposed_constraints jsonb not null default '[]',
  summary text,
  status text not null default 'pending_review'
    check (
      status in (
        'pending_review',
        'accepted',
        'partially_accepted',
        'dismissed'
      )
    ),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  reviewed_by uuid references public.profiles (id)
);

create index note_proposals_org_project_idx
  on public.note_proposals (org_id, project_id);

create index note_proposals_project_status_idx
  on public.note_proposals (project_id, status);

create index note_proposals_created_idx
  on public.note_proposals (project_id, created_at desc);

alter table public.note_proposals enable row level security;

create policy "Users can select note proposals in their organisation"
  on public.note_proposals for select
  using (org_id = public.auth_org_id());

create policy "Users can insert note proposals in their organisation"
  on public.note_proposals for insert
  with check (org_id = public.auth_org_id());

create policy "Users can update note proposals in their organisation"
  on public.note_proposals for update
  using (org_id = public.auth_org_id())
  with check (org_id = public.auth_org_id());

notify pgrst, 'reload schema';
