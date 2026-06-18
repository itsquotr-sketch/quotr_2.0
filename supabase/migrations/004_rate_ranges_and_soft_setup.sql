-- Quotr 2.0 — Phase 2A.6 rate ranges & soft setup model
--
-- Extends rates with optional low/standard/high bounds.
-- Adds organisation-level fallback multipliers for derived ranges.
-- Setup remains soft: onboarding_status/onboarding_step track progress but
-- do not lock users out of the dashboard (enforced in app layer, not schema).

-- ---------------------------------------------------------------------------
-- 1. rates — optional range fields
-- ---------------------------------------------------------------------------

alter table public.rates
  add column cost_rate_low numeric(12, 2),
  add column cost_rate_high numeric(12, 2),
  add column sell_rate_low numeric(12, 2),
  add column sell_rate_high numeric(12, 2);

-- Non-negative checks (standard fields included for consistency)
alter table public.rates
  add constraint rates_cost_rate_low_non_negative
    check (cost_rate_low is null or cost_rate_low >= 0),
  add constraint rates_cost_rate_non_negative
    check (cost_rate is null or cost_rate >= 0),
  add constraint rates_cost_rate_high_non_negative
    check (cost_rate_high is null or cost_rate_high >= 0),
  add constraint rates_sell_rate_low_non_negative
    check (sell_rate_low is null or sell_rate_low >= 0),
  add constraint rates_sell_rate_non_negative
    check (sell_rate is null or sell_rate >= 0),
  add constraint rates_sell_rate_high_non_negative
    check (sell_rate_high is null or sell_rate_high >= 0);

-- Range order: low <= standard <= high (when adjacent values are present)
alter table public.rates
  add constraint rates_cost_rate_low_lte_standard
    check (
      cost_rate_low is null
      or cost_rate is null
      or cost_rate_low <= cost_rate
    ),
  add constraint rates_cost_rate_standard_lte_high
    check (
      cost_rate is null
      or cost_rate_high is null
      or cost_rate <= cost_rate_high
    ),
  add constraint rates_sell_rate_low_lte_standard
    check (
      sell_rate_low is null
      or sell_rate is null
      or sell_rate_low <= sell_rate
    ),
  add constraint rates_sell_rate_standard_lte_high
    check (
      sell_rate is null
      or sell_rate_high is null
      or sell_rate <= sell_rate_high
    );

comment on column public.rates.cost_rate is
  'Standard/default cost rate used when no low/high range is provided.';

comment on column public.rates.sell_rate is
  'Standard/default sell rate used when no low/high range is provided.';

comment on column public.rates.cost_rate_low is
  'Optional lower cost-rate bound for budget/range estimates.';

comment on column public.rates.cost_rate_high is
  'Optional upper cost-rate bound for premium/range estimates.';

comment on column public.rates.sell_rate_low is
  'Optional lower sell-rate bound for budget/range estimates.';

comment on column public.rates.sell_rate_high is
  'Optional upper sell-rate bound for premium/range estimates.';

-- ---------------------------------------------------------------------------
-- 2. organisation_settings — fallback range multipliers
-- ---------------------------------------------------------------------------

alter table public.organisation_settings
  add column budget_rate_factor numeric(6, 3) not null default 0.900
    check (budget_rate_factor > 0 and budget_rate_factor <= 1),
  add column premium_rate_factor numeric(6, 3) not null default 1.150
    check (premium_rate_factor >= 1 and premium_rate_factor <= 2);

comment on column public.organisation_settings.budget_rate_factor is
  'Fallback multiplier used to derive lower-rate estimates when explicit low rates are missing.';

comment on column public.organisation_settings.premium_rate_factor is
  'Fallback multiplier used to derive higher-rate estimates when explicit high rates are missing.';

-- ---------------------------------------------------------------------------
-- 3. soft setup model (documentation only — no lock fields)
-- ---------------------------------------------------------------------------

comment on column public.organisation_settings.onboarding_status is
  'Setup progress: not_started or in_progress should show soft prompts; completed means setup is done. Does not block dashboard access.';

comment on column public.organisation_settings.onboarding_step is
  'Last completed or current setup step. Used for resume/progress UI; incomplete setup shows warnings, not hard locks.';
