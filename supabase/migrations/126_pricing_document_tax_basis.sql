-- 126 — explicit pricing-document tax basis.
-- Version 121 stays account_deletion_requests on Preview and Production.
-- This file does not replace that migration.
-- Next unused version after Preview 125 and Production 123.
-- Additive. The same statement is safe when the column already exists
-- and when Production does not have it yet.
-- Existing drafts keep their stored gst_rate.
-- Null means that rate has not been kept as an explicit override.
-- Issued quotes and accepted snapshots are separate rows and are not updated.

alter table public.pricing_documents
  add column if not exists gst_tax_basis jsonb;

comment on column public.pricing_documents.gst_tax_basis is
  'Explicit document tax override. Null until a draft keeps a rate that differs from GST registration. Issued quotes are separate snapshots and are not updated from this column.';
