-- 121 — explicit pricing-document tax basis.
-- Additive column. Existing drafts keep their stored gst_rate.
-- Null means that rate has not been reconciled with a later registration change.
-- Issued quotes are separate snapshots and are not updated from this column.

alter table public.pricing_documents
  add column if not exists gst_tax_basis jsonb;

comment on column public.pricing_documents.gst_tax_basis is
  'Explicit document tax override. Null until a draft keeps a rate that differs from GST registration. Issued quotes are separate snapshots and are not updated from this column.';
