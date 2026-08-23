-- DECK-MATURITY-2D: persist company productivity hours (rate_type = productivity).
-- Labour $/hr stays rate_type = labour. Material stays rate_type = material.

alter table public.rates
  drop constraint if exists rates_rate_type_check;

alter table public.rates
  add constraint rates_rate_type_check
  check (
    rate_type in (
      'labour',
      'material',
      'subcontractor',
      'scope',
      'package',
      'allowance',
      'productivity'
    )
  );
