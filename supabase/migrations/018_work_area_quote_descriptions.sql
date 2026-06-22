-- Quotr 2.0 — Phase 6B-4 work area quote descriptions

alter table public.work_areas
  add column if not exists quote_description text,
  add column if not exists quote_description_updated_at timestamptz;

alter table public.quote_items
  add column if not exists section_description text;

comment on column public.work_areas.quote_description is
  'Client-facing scope language for this work area — copied into new quotes as a snapshot.';
comment on column public.quote_items.section_description is
  'Snapshotted work area description on the first item of a quote section.';
