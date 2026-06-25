-- Track estimate engine calibration version for regeneration notices.
alter table public.estimates
  add column if not exists calibration_version text;

comment on column public.estimates.calibration_version is
  'Estimate engine calibration version at generation time (e.g. outdoor-1.1).';
