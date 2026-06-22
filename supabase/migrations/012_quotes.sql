-- Quotr 2.0 — Phase 6B client quote builder

-- ---------------------------------------------------------------------------
-- quotes
-- ---------------------------------------------------------------------------

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  pricing_document_id uuid references public.pricing_documents (id) on delete set null,
  estimate_id uuid references public.estimates (id) on delete set null,
  quote_number text,
  title text not null,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'declined', 'expired', 'revised', 'archived')),
  client_name text,
  site_address text,
  issue_date date,
  valid_until date,
  subtotal numeric(12, 2) not null default 0,
  gst_rate numeric(5, 2) not null default 15,
  gst_amount numeric(12, 2) not null default 0,
  total_incl_gst numeric(12, 2) not null default 0,
  scope_summary text,
  inclusions jsonb not null default '[]'::jsonb,
  exclusions jsonb not null default '[]'::jsonb,
  assumptions jsonb not null default '[]'::jsonb,
  terms text,
  notes_to_client text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  expired_at timestamptz
);

create index if not exists quotes_org_project_idx
  on public.quotes (org_id, project_id);

create index if not exists quotes_project_created_idx
  on public.quotes (project_id, created_at desc);

create index if not exists quotes_org_status_idx
  on public.quotes (org_id, status);

create index if not exists quotes_pricing_document_idx
  on public.quotes (pricing_document_id);

-- ---------------------------------------------------------------------------
-- quote_items
-- ---------------------------------------------------------------------------

create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  quote_id uuid not null references public.quotes (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  pricing_item_id uuid references public.pricing_items (id) on delete set null,
  work_area_id uuid references public.work_areas (id) on delete set null,
  section_title text,
  label text not null,
  description text,
  quantity numeric(12, 2),
  unit text,
  unit_price numeric(12, 2),
  total numeric(12, 2) not null default 0,
  visible boolean not null default true,
  optional boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quote_items_quote_sort_idx
  on public.quote_items (quote_id, sort_order);

create index if not exists quote_items_org_quote_idx
  on public.quote_items (org_id, quote_id);

create index if not exists quote_items_project_idx
  on public.quote_items (project_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

drop trigger if exists set_updated_at on public.quotes;
create trigger set_updated_at
  before update on public.quotes
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.quote_items;
create trigger set_updated_at
  before update on public.quote_items
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;

-- quotes
create policy "Users can select quotes in their organisation"
  on public.quotes for select
  using (org_id = public.auth_org_id());

create policy "Users can insert quotes in their organisation"
  on public.quotes for insert
  with check (org_id = public.auth_org_id());

create policy "Users can update quotes in their organisation"
  on public.quotes for update
  using (org_id = public.auth_org_id())
  with check (org_id = public.auth_org_id());

create policy "Users can delete quotes in their organisation"
  on public.quotes for delete
  using (org_id = public.auth_org_id());

-- quote_items
create policy "Users can select quote items in their organisation"
  on public.quote_items for select
  using (org_id = public.auth_org_id());

create policy "Users can insert quote items in their organisation"
  on public.quote_items for insert
  with check (org_id = public.auth_org_id());

create policy "Users can update quote items in their organisation"
  on public.quote_items for update
  using (org_id = public.auth_org_id())
  with check (org_id = public.auth_org_id());

create policy "Users can delete quote items in their organisation"
  on public.quote_items for delete
  using (org_id = public.auth_org_id());

notify pgrst, 'reload schema';
