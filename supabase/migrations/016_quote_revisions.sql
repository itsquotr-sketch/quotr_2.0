-- Quotr 2.0 — Phase 6B-2B quote revision metadata

alter table public.quotes
  add column if not exists revision_number integer not null default 1,
  add column if not exists parent_quote_id uuid references public.quotes (id) on delete set null,
  add column if not exists revised_from_quote_id uuid references public.quotes (id) on delete set null,
  add column if not exists superseded_by_quote_id uuid references public.quotes (id) on delete set null,
  add column if not exists superseded_at timestamptz null,
  add column if not exists revision_note text null;

create index if not exists quotes_project_revision_idx
  on public.quotes (project_id, revision_number);

create index if not exists quotes_parent_quote_idx
  on public.quotes (parent_quote_id);

create index if not exists quotes_revised_from_idx
  on public.quotes (revised_from_quote_id);

notify pgrst, 'reload schema';
