-- 110 — builder confirmation of the legacy flat ceiling provisional package.
-- Additive column on the Pricing draft only.
-- Does not rewrite quotes, accepted snapshots, variations, estimates, or rates.

alter table public.pricing_documents
  add column if not exists provisional_ceiling_confirmation jsonb;

comment on column public.pricing_documents.provisional_ceiling_confirmation is
  'Builder confirmation of the legacy flat ceiling provisional package for this Pricing draft. Null when not confirmed. Cleared when those lines change. Issued quotes are separate snapshots and are not updated from this column.';
