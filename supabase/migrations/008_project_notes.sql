-- Quotr 2.0 — Phase 5D-1 Site Notes raw capture layer

create table public.project_notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  content text not null,
  note_type text not null default 'general'
    check (
      note_type in (
        'general',
        'measurement',
        'access',
        'client_request',
        'existing_condition',
        'material_preference',
        'exclusion',
        'risk',
        'other'
      )
    ),
  source text not null default 'site_walk'
    check (
      source in (
        'site_walk',
        'phone_call',
        'desktop_note',
        'voice_to_text',
        'photo_caption',
        'other'
      )
    ),
  captured_by uuid references public.profiles (id),
  captured_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  analysis_status text not null default 'pending'
    check (analysis_status in ('pending', 'analysed', 'dismissed')),
  deleted_at timestamptz,
  constraint project_notes_content_not_empty check (length(trim(content)) > 0)
);

create index project_notes_org_project_idx
  on public.project_notes (org_id, project_id);

create index project_notes_project_captured_idx
  on public.project_notes (project_id, captured_at desc);

create index project_notes_project_deleted_idx
  on public.project_notes (project_id, deleted_at);

drop trigger if exists set_updated_at on public.project_notes;
create trigger set_updated_at
  before update on public.project_notes
  for each row
  execute function public.set_updated_at();

alter table public.project_notes enable row level security;

create policy "Users can select project notes in their organisation"
  on public.project_notes for select
  using (org_id = public.auth_org_id());

create policy "Users can insert project notes in their organisation"
  on public.project_notes for insert
  with check (org_id = public.auth_org_id());

create policy "Users can update project notes in their organisation"
  on public.project_notes for update
  using (org_id = public.auth_org_id())
  with check (org_id = public.auth_org_id());

create policy "Users can delete project notes in their organisation"
  on public.project_notes for delete
  using (org_id = public.auth_org_id());

notify pgrst, 'reload schema';
