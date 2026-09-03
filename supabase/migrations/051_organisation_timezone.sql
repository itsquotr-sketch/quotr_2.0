-- Quotr 2.0 — Canonical organisation timezone for display of UTC timestamps.
-- Additive. Environment-neutral. Safe later for the Production chain.
--
-- Timezone is an explicit organisation preference. There is no database
-- DEFAULT: a DEFAULT of Pacific/Auckland would silently assign New Zealand
-- time to non-NZ companies.
--
-- Persistence is IANA identifiers only (Pacific/Auckland), never UTC+12,
-- GMT+12, or +12:00. The CHECK below is structural form only — it does not
-- validate the full IANA database. Application catalogue remains authority.
--
-- Backfill is NZ-only and deterministic:
--   Chatham region → Pacific/Chatham
--   other NZ → Pacific/Auckland
-- Non-NZ rows stay NULL.

alter table public.organisation_settings
  add column if not exists timezone text;

alter table public.organisation_settings
  drop constraint if exists organisation_settings_timezone_form;

alter table public.organisation_settings
  add constraint organisation_settings_timezone_form
  check (
    timezone is null
    or (
      timezone ~ '^[A-Za-z_]+/[A-Za-z0-9_+-]+(/[A-Za-z0-9_+-]+)?$'
      and timezone !~* '^(utc|gmt)'
      and timezone !~ '^[+-]?[0-9]'
    )
  );

comment on column public.organisation_settings.timezone is
  'IANA timezone identifier for displaying UTC timestamps. NULL uses the application fallback. No database default.';

update public.organisation_settings
set timezone = case
  when lower(coalesce(region, '')) like '%chatham%' then 'Pacific/Chatham'
  else 'Pacific/Auckland'
end
where timezone is null
  and (
    upper(trim(country)) in ('NZ', 'NEW ZEALAND')
  );
