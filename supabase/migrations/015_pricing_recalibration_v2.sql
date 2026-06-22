-- Quotr 2.0 — Phase 6B-2A recalibration fields (additive)

alter table public.pricing_documents
  add column if not exists needs_recalibration boolean not null default false,
  add column if not exists recalibration_status text not null default 'current',
  add column if not exists recalibration_dismissed_at timestamptz null,
  add column if not exists recalibrated_at timestamptz null;

alter table public.pricing_documents
  drop constraint if exists pricing_documents_recalibration_status_check;

alter table public.pricing_documents
  add constraint pricing_documents_recalibration_status_check
  check (
    recalibration_status in (
      'current',
      'estimate_changed',
      'update_available',
      'manually_kept',
      'recalibrated'
    )
  );

alter table public.pricing_items
  add column if not exists manually_edited boolean not null default false,
  add column if not exists orphaned boolean not null default false,
  add column if not exists recalibration_note text null;

create index if not exists pricing_documents_project_estimate_idx
  on public.pricing_documents (project_id, estimate_id);

create index if not exists pricing_documents_project_recalibration_idx
  on public.pricing_documents (project_id, needs_recalibration);

create index if not exists pricing_items_doc_source_idx
  on public.pricing_items (pricing_document_id, source_estimate_line_item_id);

create index if not exists pricing_items_doc_manual_idx
  on public.pricing_items (pricing_document_id, manually_edited);

notify pgrst, 'reload schema';
