-- COMMERCIAL-UX-01-R1: durable client Quote presentation mode on the snapshot.
-- Copied on revision / Update from Pricing. Default grouped for existing rows.
-- QUOTE-TRANSACTION-01 should copy this column; it is not a temporary field.

alter table public.quotes
  add column if not exists presentation_mode text not null default 'grouped'
    check (presentation_mode in ('grouped', 'detailed', 'lump_sum'));

comment on column public.quotes.presentation_mode is
  'Client document layout only. Does not change stored sell/GST totals. grouped=work-area rollup (default); detailed=visible line items; lump_sum=scope plus document total.';

notify pgrst, 'reload schema';
