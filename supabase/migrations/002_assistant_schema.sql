-- Quotr 2.0 — Phase 2A assistant & estimating schema

-- ---------------------------------------------------------------------------
-- updated_at helper (generic; 001 uses set_projects_updated_at for projects)
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. work_areas
-- ---------------------------------------------------------------------------

create table public.work_areas (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  type text not null,
  name text not null,
  status text not null default 'suggested'
    check (status in ('suggested', 'confirmed', 'excluded')),
  ai_confidence numeric(5, 4)
    check (ai_confidence is null or (ai_confidence >= 0 and ai_confidence <= 1)),
  summary text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index work_areas_org_id_idx on public.work_areas (org_id);
create index work_areas_project_id_idx on public.work_areas (project_id);
create index work_areas_project_id_status_idx on public.work_areas (project_id, status);
create index work_areas_project_id_sort_order_idx on public.work_areas (project_id, sort_order);

-- ---------------------------------------------------------------------------
-- 2. project_facts
-- ---------------------------------------------------------------------------

create table public.project_facts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  work_area_id uuid references public.work_areas (id) on delete cascade,
  key text not null,
  label text not null,
  value jsonb not null,
  unit text,
  source text not null default 'user'
    check (source in ('user', 'ai_extracted', 'derived', 'default', 'assumption', 'system')),
  confidence numeric(5, 4)
    check (confidence is null or (confidence >= 0 and confidence <= 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index project_facts_project_work_area_key_idx
  on public.project_facts (project_id, work_area_id, key)
  where work_area_id is not null;

create unique index project_facts_project_key_null_work_area_idx
  on public.project_facts (project_id, key)
  where work_area_id is null;

create index project_facts_org_id_idx on public.project_facts (org_id);
create index project_facts_project_id_idx on public.project_facts (project_id);
create index project_facts_work_area_id_idx on public.project_facts (work_area_id);
create index project_facts_project_id_key_idx on public.project_facts (project_id, key);

-- ---------------------------------------------------------------------------
-- 3. question_blocks
-- ---------------------------------------------------------------------------

create table public.question_blocks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  stage text not null
    check (stage in ('work_area_questions', 'constraints', 'quality', 'ready_to_estimate')),
  title text not null,
  description text,
  status text not null default 'active'
    check (status in ('active', 'submitted', 'superseded')),
  sort_order integer not null default 0,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index question_blocks_org_id_idx on public.question_blocks (org_id);
create index question_blocks_project_id_idx on public.question_blocks (project_id);
create index question_blocks_project_id_status_idx on public.question_blocks (project_id, status);
create index question_blocks_project_id_sort_order_idx on public.question_blocks (project_id, sort_order);

-- ---------------------------------------------------------------------------
-- 4. questions
-- ---------------------------------------------------------------------------

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  question_block_id uuid not null references public.question_blocks (id) on delete cascade,
  work_area_id uuid references public.work_areas (id) on delete cascade,
  key text not null,
  label text not null,
  question_text text not null,
  input_type text not null
    check (input_type in ('number', 'select', 'boolean', 'text')),
  options jsonb,
  required boolean not null default true,
  unit text,
  answer_value jsonb,
  answer_source text
    check (answer_source is null or answer_source in ('user', 'default', 'ai_extracted', 'system')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (question_block_id, key)
);

create index questions_org_id_idx on public.questions (org_id);
create index questions_project_id_idx on public.questions (project_id);
create index questions_question_block_id_idx on public.questions (question_block_id);
create index questions_work_area_id_idx on public.questions (work_area_id);
create index questions_project_id_key_idx on public.questions (project_id, key);

-- ---------------------------------------------------------------------------
-- 5. constraints
-- ---------------------------------------------------------------------------

create table public.constraints (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  key text not null,
  label text not null,
  value jsonb not null,
  source text not null default 'user'
    check (source in ('user', 'ai_extracted', 'derived', 'default', 'assumption', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, key)
);

create index constraints_org_id_idx on public.constraints (org_id);
create index constraints_project_id_idx on public.constraints (project_id);
create index constraints_project_id_key_idx on public.constraints (project_id, key);

-- ---------------------------------------------------------------------------
-- 6. estimates
-- ---------------------------------------------------------------------------

create table public.estimates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'stale', 'failed')),
  cost_low numeric(12, 2),
  cost_high numeric(12, 2),
  sell_low numeric(12, 2),
  sell_high numeric(12, 2),
  recommended_cost numeric(12, 2),
  recommended_sell numeric(12, 2),
  gross_profit numeric(12, 2),
  margin_percent numeric(6, 2),
  markup_percent numeric(6, 2),
  confidence numeric(5, 2)
    check (confidence is null or (confidence >= 0 and confidence <= 100)),
  rate_source_summary text,
  assumptions jsonb not null default '[]'::jsonb,
  missing_info jsonb not null default '[]'::jsonb,
  exclusions jsonb not null default '[]'::jsonb,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id)
);

create index estimates_org_id_idx on public.estimates (org_id);
create index estimates_project_id_idx on public.estimates (project_id);
create index estimates_project_id_status_idx on public.estimates (project_id, status);

-- ---------------------------------------------------------------------------
-- 7. estimate_line_items
-- ---------------------------------------------------------------------------

create table public.estimate_line_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  estimate_id uuid not null references public.estimates (id) on delete cascade,
  work_area_id uuid references public.work_areas (id) on delete set null,
  work_area_name text not null,
  label text not null,
  category text not null
    check (category in ('labour', 'materials', 'subcontractor', 'allowance', 'contingency')),
  cost_low numeric(12, 2),
  cost_high numeric(12, 2),
  sell_low numeric(12, 2),
  sell_high numeric(12, 2),
  recommended_cost numeric(12, 2),
  recommended_sell numeric(12, 2),
  gross_profit numeric(12, 2),
  margin_percent numeric(6, 2),
  markup_percent numeric(6, 2),
  rate_source text,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index estimate_line_items_org_id_idx on public.estimate_line_items (org_id);
create index estimate_line_items_project_id_idx on public.estimate_line_items (project_id);
create index estimate_line_items_estimate_id_idx on public.estimate_line_items (estimate_id);
create index estimate_line_items_work_area_id_idx on public.estimate_line_items (work_area_id);
create index estimate_line_items_estimate_id_sort_order_idx
  on public.estimate_line_items (estimate_id, sort_order);

-- ---------------------------------------------------------------------------
-- 8. rates
-- ---------------------------------------------------------------------------

create table public.rates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  rate_type text not null
    check (rate_type in ('labour', 'material', 'subcontractor', 'scope', 'package', 'allowance')),
  trade text,
  work_area_type text,
  item_key text not null,
  label text not null,
  unit text not null,
  cost_rate numeric(12, 2),
  sell_rate numeric(12, 2),
  markup_percent numeric(6, 2),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, rate_type, item_key)
);

create index rates_org_id_idx on public.rates (org_id);
create index rates_org_id_rate_type_idx on public.rates (org_id, rate_type);
create index rates_org_id_work_area_type_idx on public.rates (org_id, work_area_type);
create index rates_org_id_item_key_idx on public.rates (org_id, item_key);
create index rates_org_id_active_idx on public.rates (org_id, active);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

drop trigger if exists set_updated_at on public.work_areas;
create trigger set_updated_at
  before update on public.work_areas
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.project_facts;
create trigger set_updated_at
  before update on public.project_facts
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.question_blocks;
create trigger set_updated_at
  before update on public.question_blocks
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.questions;
create trigger set_updated_at
  before update on public.questions
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.constraints;
create trigger set_updated_at
  before update on public.constraints
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.estimates;
create trigger set_updated_at
  before update on public.estimates
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.estimate_line_items;
create trigger set_updated_at
  before update on public.estimate_line_items
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.rates;
create trigger set_updated_at
  before update on public.rates
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.work_areas enable row level security;
alter table public.project_facts enable row level security;
alter table public.question_blocks enable row level security;
alter table public.questions enable row level security;
alter table public.constraints enable row level security;
alter table public.estimates enable row level security;
alter table public.estimate_line_items enable row level security;
alter table public.rates enable row level security;

-- work_areas
create policy "Users can select work areas in their organisation"
  on public.work_areas for select
  using (org_id = public.auth_org_id());

create policy "Users can insert work areas in their organisation"
  on public.work_areas for insert
  with check (org_id = public.auth_org_id());

create policy "Users can update work areas in their organisation"
  on public.work_areas for update
  using (org_id = public.auth_org_id())
  with check (org_id = public.auth_org_id());

create policy "Users can delete work areas in their organisation"
  on public.work_areas for delete
  using (org_id = public.auth_org_id());

-- project_facts
create policy "Users can select project facts in their organisation"
  on public.project_facts for select
  using (org_id = public.auth_org_id());

create policy "Users can insert project facts in their organisation"
  on public.project_facts for insert
  with check (org_id = public.auth_org_id());

create policy "Users can update project facts in their organisation"
  on public.project_facts for update
  using (org_id = public.auth_org_id())
  with check (org_id = public.auth_org_id());

create policy "Users can delete project facts in their organisation"
  on public.project_facts for delete
  using (org_id = public.auth_org_id());

-- question_blocks
create policy "Users can select question blocks in their organisation"
  on public.question_blocks for select
  using (org_id = public.auth_org_id());

create policy "Users can insert question blocks in their organisation"
  on public.question_blocks for insert
  with check (org_id = public.auth_org_id());

create policy "Users can update question blocks in their organisation"
  on public.question_blocks for update
  using (org_id = public.auth_org_id())
  with check (org_id = public.auth_org_id());

create policy "Users can delete question blocks in their organisation"
  on public.question_blocks for delete
  using (org_id = public.auth_org_id());

-- questions
create policy "Users can select questions in their organisation"
  on public.questions for select
  using (org_id = public.auth_org_id());

create policy "Users can insert questions in their organisation"
  on public.questions for insert
  with check (org_id = public.auth_org_id());

create policy "Users can update questions in their organisation"
  on public.questions for update
  using (org_id = public.auth_org_id())
  with check (org_id = public.auth_org_id());

create policy "Users can delete questions in their organisation"
  on public.questions for delete
  using (org_id = public.auth_org_id());

-- constraints
create policy "Users can select constraints in their organisation"
  on public.constraints for select
  using (org_id = public.auth_org_id());

create policy "Users can insert constraints in their organisation"
  on public.constraints for insert
  with check (org_id = public.auth_org_id());

create policy "Users can update constraints in their organisation"
  on public.constraints for update
  using (org_id = public.auth_org_id())
  with check (org_id = public.auth_org_id());

create policy "Users can delete constraints in their organisation"
  on public.constraints for delete
  using (org_id = public.auth_org_id());

-- estimates
create policy "Users can select estimates in their organisation"
  on public.estimates for select
  using (org_id = public.auth_org_id());

create policy "Users can insert estimates in their organisation"
  on public.estimates for insert
  with check (org_id = public.auth_org_id());

create policy "Users can update estimates in their organisation"
  on public.estimates for update
  using (org_id = public.auth_org_id())
  with check (org_id = public.auth_org_id());

create policy "Users can delete estimates in their organisation"
  on public.estimates for delete
  using (org_id = public.auth_org_id());

-- estimate_line_items
create policy "Users can select estimate line items in their organisation"
  on public.estimate_line_items for select
  using (org_id = public.auth_org_id());

create policy "Users can insert estimate line items in their organisation"
  on public.estimate_line_items for insert
  with check (org_id = public.auth_org_id());

create policy "Users can update estimate line items in their organisation"
  on public.estimate_line_items for update
  using (org_id = public.auth_org_id())
  with check (org_id = public.auth_org_id());

create policy "Users can delete estimate line items in their organisation"
  on public.estimate_line_items for delete
  using (org_id = public.auth_org_id());

-- rates
create policy "Users can select rates in their organisation"
  on public.rates for select
  using (org_id = public.auth_org_id());

create policy "Users can insert rates in their organisation"
  on public.rates for insert
  with check (org_id = public.auth_org_id());

create policy "Users can update rates in their organisation"
  on public.rates for update
  using (org_id = public.auth_org_id())
  with check (org_id = public.auth_org_id());

create policy "Users can delete rates in their organisation"
  on public.rates for delete
  using (org_id = public.auth_org_id());
