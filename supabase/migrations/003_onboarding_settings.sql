-- Quotr 2.0 — Phase 2A.5 onboarding & organisation settings schema

-- ---------------------------------------------------------------------------
-- 1. organisation_settings
-- ---------------------------------------------------------------------------

create table public.organisation_settings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references public.organisations (id) on delete cascade,

  default_margin_percent numeric(6, 2) not null default 25.00
    check (default_margin_percent >= 0 and default_margin_percent <= 100),
  default_markup_percent numeric(6, 2)
    check (default_markup_percent is null or default_markup_percent >= 0),
  default_contingency_percent numeric(6, 2) not null default 10.00
    check (default_contingency_percent >= 0 and default_contingency_percent <= 100),
  currency text not null default 'NZD'
    check (length(trim(currency)) > 0),
  country text not null default 'NZ'
    check (length(trim(country)) > 0),
  region text,

  onboarding_status text not null default 'not_started'
    check (onboarding_status in ('not_started', 'in_progress', 'completed')),
  onboarding_step text not null default 'company'
    check (onboarding_step in ('company', 'work_areas', 'rates', 'review', 'completed')),
  onboarding_completed_at timestamptz,

  prefer_user_rates boolean not null default true,
  allow_benchmark_rates boolean not null default true,
  show_profit_in_estimates boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index organisation_settings_org_id_idx on public.organisation_settings (org_id);
create index organisation_settings_onboarding_status_idx
  on public.organisation_settings (onboarding_status);

-- ---------------------------------------------------------------------------
-- 2. organisation_work_areas
-- ---------------------------------------------------------------------------

create table public.organisation_work_areas (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  work_area_type text not null,
  label text not null,
  category text,
  description text,
  estimate_support text not null default 'rough_allowance'
    check (estimate_support in ('calculator', 'rough_allowance', 'not_supported')),
  enabled boolean not null default true,
  sort_order integer not null default 0,
  default_margin_percent numeric(6, 2)
    check (
      default_margin_percent is null
      or (default_margin_percent >= 0 and default_margin_percent <= 100)
    ),
  default_markup_percent numeric(6, 2)
    check (default_markup_percent is null or default_markup_percent >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, work_area_type)
);

create index organisation_work_areas_org_id_idx on public.organisation_work_areas (org_id);
create index organisation_work_areas_org_id_enabled_idx
  on public.organisation_work_areas (org_id, enabled);
create index organisation_work_areas_org_id_work_area_type_idx
  on public.organisation_work_areas (org_id, work_area_type);
create index organisation_work_areas_org_id_sort_order_idx
  on public.organisation_work_areas (org_id, sort_order);

-- ---------------------------------------------------------------------------
-- updated_at triggers (reuses public.set_updated_at() from 002)
-- ---------------------------------------------------------------------------

drop trigger if exists set_updated_at on public.organisation_settings;
create trigger set_updated_at
  before update on public.organisation_settings
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.organisation_work_areas;
create trigger set_updated_at
  before update on public.organisation_work_areas
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.organisation_settings enable row level security;
alter table public.organisation_work_areas enable row level security;

-- organisation_settings
create policy "Users can select organisation settings in their organisation"
  on public.organisation_settings for select
  using (org_id = public.auth_org_id());

create policy "Users can insert organisation settings in their organisation"
  on public.organisation_settings for insert
  with check (org_id = public.auth_org_id());

create policy "Users can update organisation settings in their organisation"
  on public.organisation_settings for update
  using (org_id = public.auth_org_id())
  with check (org_id = public.auth_org_id());

create policy "Users can delete organisation settings in their organisation"
  on public.organisation_settings for delete
  using (org_id = public.auth_org_id());

-- organisation_work_areas
create policy "Users can select organisation work areas in their organisation"
  on public.organisation_work_areas for select
  using (org_id = public.auth_org_id());

create policy "Users can insert organisation work areas in their organisation"
  on public.organisation_work_areas for insert
  with check (org_id = public.auth_org_id());

create policy "Users can update organisation work areas in their organisation"
  on public.organisation_work_areas for update
  using (org_id = public.auth_org_id())
  with check (org_id = public.auth_org_id());

create policy "Users can delete organisation work areas in their organisation"
  on public.organisation_work_areas for delete
  using (org_id = public.auth_org_id());
