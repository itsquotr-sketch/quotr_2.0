-- Quotr 2.0 — Phase 0 initial schema

create extension if not exists pgcrypto;

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subscription_tier text not null default 'free'
    check (subscription_tier in ('free', 'pro', 'team')),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid not null references public.organisations (id) on delete cascade,
  full_name text,
  role text not null default 'owner'
    check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete restrict,
  title text not null,
  brief_text text,
  stage text not null default 'brief'
    check (stage in (
      'brief',
      'confirm_work_areas',
      'quality',
      'work_area_questions',
      'constraints',
      'ready_to_estimate',
      'estimate_ready'
    )),
  quality_level text not null default 'unknown'
    check (quality_level in ('unknown', 'budget', 'standard', 'premium')),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_org_id_idx on public.profiles (org_id);
create index projects_org_id_idx on public.projects (org_id);
create index projects_created_by_idx on public.projects (created_by);
create index projects_org_id_created_at_idx on public.projects (org_id, created_at desc);

create or replace function public.set_projects_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_updated_at
  before update on public.projects
  for each row
  execute function public.set_projects_updated_at();

create or replace function public.auth_org_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select org_id
  from public.profiles
  where id = auth.uid()
$$;

alter table public.organisations enable row level security;
alter table public.profiles enable row level security;
alter table public.projects enable row level security;

-- organisations
create policy "Users can select their own organisation"
  on public.organisations
  for select
  using (id = public.auth_org_id());

create policy "Owners and admins can update their organisation"
  on public.organisations
  for update
  using (
    id = public.auth_org_id()
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.org_id = organisations.id
        and profiles.role in ('owner', 'admin')
    )
  )
  with check (
    id = public.auth_org_id()
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.org_id = organisations.id
        and profiles.role in ('owner', 'admin')
    )
  );

-- profiles
create policy "Users can select profiles in their organisation"
  on public.profiles
  for select
  using (org_id = public.auth_org_id());

create policy "Users can update their own profile"
  on public.profiles
  for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and org_id = public.auth_org_id()
  );

-- projects
create policy "Users can select projects in their organisation"
  on public.projects
  for select
  using (org_id = public.auth_org_id());

create policy "Users can insert projects in their organisation"
  on public.projects
  for insert
  with check (
    org_id = public.auth_org_id()
    and created_by = auth.uid()
  );

create policy "Users can update projects in their organisation"
  on public.projects
  for update
  using (org_id = public.auth_org_id())
  with check (org_id = public.auth_org_id());

create policy "Users can delete projects in their organisation"
  on public.projects
  for delete
  using (org_id = public.auth_org_id());
