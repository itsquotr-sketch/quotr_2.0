-- Quotr 2.0 — QUOTE-DELIVERY-02
-- Optional Project client email (default for Quote send only).
-- Historical quote_deliveries.recipient_email remains the delivery snapshot.
-- Additive and shared-DB compatible. Do not rewrite quote_deliveries.

alter table public.projects
  add column if not exists client_email text;

comment on column public.projects.client_email is
  'Optional client email for this project. Default for Quote send only; not delivery history authority.';
