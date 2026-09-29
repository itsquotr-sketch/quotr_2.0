-- ONBOARDING-01 — required first-run steps and optional personalisation dismissal.
-- Additive. Does not rewrite historical quotes, snapshots, or variation rows.
-- Existing onboarding_step values (company, work_areas, rates, review, completed)
-- stay valid so finished organisations are not sent back through setup.

alter table public.organisation_settings
  drop constraint if exists organisation_settings_onboarding_step_check;

alter table public.organisation_settings
  add constraint organisation_settings_onboarding_step_check
  check (
    onboarding_step in (
      'company',
      'work_areas',
      'labour',
      'ready',
      'rates',
      'review',
      'completed'
    )
  );

alter table public.organisation_settings
  add column if not exists optional_personalisation_dismissed_at timestamptz;

comment on column public.organisation_settings.optional_personalisation_dismissed_at is
  'When set, the dashboard hides the optional calibration prompt. Does not reset required onboarding.';
