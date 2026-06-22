-- Quotr 2.0 — Phase 6B-3 company profile & quote defaults

alter table public.organisation_settings
  add column if not exists trading_name text,
  add column if not exists legal_name text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists website text,
  add column if not exists address_line_1 text,
  add column if not exists address_line_2 text,
  add column if not exists city text,
  add column if not exists postcode text,
  add column if not exists address_country text not null default 'New Zealand',
  add column if not exists nzbn text,
  add column if not exists gst_number text,
  add column if not exists default_gst_rate numeric(5, 2) not null default 15.00
    check (default_gst_rate >= 0 and default_gst_rate <= 100),
  add column if not exists default_quote_validity_days integer not null default 30
    check (default_quote_validity_days >= 1 and default_quote_validity_days <= 365),
  add column if not exists default_payment_terms text,
  add column if not exists default_quote_terms text,
  add column if not exists default_quote_exclusions text,
  add column if not exists default_quote_assumptions text,
  add column if not exists logo_url text,
  add column if not exists brand_primary_colour text,
  add column if not exists brand_accent_colour text;

comment on column public.organisation_settings.country is
  'ISO-style country code for rates/setup (e.g. NZ).';
comment on column public.organisation_settings.address_country is
  'Full country name for company address on quotes/documents.';
comment on column public.organisation_settings.region is
  'Business region (e.g. Auckland) — used in address and rate context.';
