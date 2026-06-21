-- Quotr 2.0 — Phase 6A final pricing workspace

-- ---------------------------------------------------------------------------
-- pricing_documents
-- ---------------------------------------------------------------------------

create table if not exists public.pricing_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  estimate_id uuid references public.estimates (id) on delete set null,
  title text not null,
  status text not null default 'draft'
    check (status in ('draft', 'reviewed', 'converted_to_quote', 'archived')),
  client_name text,
  site_address text,
  pricing_date date,
  valid_until date,
  subtotal_cost numeric(12, 2) not null default 0,
  subtotal_sell numeric(12, 2) not null default 0,
  gross_profit numeric(12, 2) not null default 0,
  margin_percent numeric(5, 2) not null default 0,
  markup_percent numeric(5, 2) not null default 0,
  gst_rate numeric(5, 2) not null default 15,
  gst_amount numeric(12, 2) not null default 0,
  total_incl_gst numeric(12, 2) not null default 0,
  scope_summary text,
  assumptions jsonb not null default '[]'::jsonb,
  exclusions jsonb not null default '[]'::jsonb,
  terms text,
  internal_notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  converted_to_quote_at timestamptz
);

create index if not exists pricing_documents_org_project_idx
  on public.pricing_documents (org_id, project_id);

create index if not exists pricing_documents_project_created_idx
  on public.pricing_documents (project_id, created_at desc);

create index if not exists pricing_documents_org_status_idx
  on public.pricing_documents (org_id, status);

-- ---------------------------------------------------------------------------
-- pricing_items
-- ---------------------------------------------------------------------------

create table if not exists public.pricing_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  pricing_document_id uuid not null references public.pricing_documents (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  work_area_id uuid references public.work_areas (id) on delete set null,
  source_estimate_line_item_id uuid references public.estimate_line_items (id) on delete set null,
  item_type text not null default 'other'
    check (item_type in ('labour', 'material', 'subcontractor', 'allowance', 'contingency', 'equipment', 'other')),
  delivery_method text not null default 'in_house'
    check (delivery_method in ('in_house', 'subcontracted', 'allowance', 'not_sure')),
  internal_label text not null,
  client_label text not null,
  internal_description text,
  client_description text,
  quantity numeric(12, 2),
  unit text,
  unit_cost numeric(12, 2),
  unit_sell numeric(12, 2),
  total_cost numeric(12, 2) not null default 0,
  total_sell numeric(12, 2) not null default 0,
  gross_profit numeric(12, 2) not null default 0,
  margin_percent numeric(5, 2) not null default 0,
  markup_percent numeric(5, 2) not null default 0,
  visible_on_quote boolean not null default true,
  optional boolean not null default false,
  sort_order integer not null default 0,
  notes_internal text,
  notes_client text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pricing_items_doc_sort_idx
  on public.pricing_items (pricing_document_id, sort_order);

create index if not exists pricing_items_org_doc_idx
  on public.pricing_items (org_id, pricing_document_id);

create index if not exists pricing_items_project_idx
  on public.pricing_items (project_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

drop trigger if exists set_updated_at on public.pricing_documents;
create trigger set_updated_at
  before update on public.pricing_documents
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.pricing_items;
create trigger set_updated_at
  before update on public.pricing_items
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.pricing_documents enable row level security;
alter table public.pricing_items enable row level security;

-- pricing_documents
create policy "Users can select pricing documents in their organisation"
  on public.pricing_documents for select
  using (org_id = public.auth_org_id());

create policy "Users can insert pricing documents in their organisation"
  on public.pricing_documents for insert
  with check (org_id = public.auth_org_id());

create policy "Users can update pricing documents in their organisation"
  on public.pricing_documents for update
  using (org_id = public.auth_org_id())
  with check (org_id = public.auth_org_id());

create policy "Users can delete pricing documents in their organisation"
  on public.pricing_documents for delete
  using (org_id = public.auth_org_id());

-- pricing_items
create policy "Users can select pricing items in their organisation"
  on public.pricing_items for select
  using (org_id = public.auth_org_id());

create policy "Users can insert pricing items in their organisation"
  on public.pricing_items for insert
  with check (org_id = public.auth_org_id());

create policy "Users can update pricing items in their organisation"
  on public.pricing_items for update
  using (org_id = public.auth_org_id())
  with check (org_id = public.auth_org_id());

create policy "Users can delete pricing items in their organisation"
  on public.pricing_items for delete
  using (org_id = public.auth_org_id());

notify pgrst, 'reload schema';
