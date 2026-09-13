import type { OrganisationSettings } from "@/components/setup/types";
import { DEFAULT_MARGIN_PERCENT } from "@/lib/estimate/constants";

/** Shared product default when an organisation_settings row is absent. */
export const DEFAULT_ORGANISATION_SETTINGS: OrganisationSettings = {
  id: "",
  org_id: "",
  default_margin_percent: DEFAULT_MARGIN_PERCENT,
  default_contingency_percent: 10,
  default_gst_rate: 15,
  budget_rate_factor: 0.9,
  premium_rate_factor: 1.15,
  currency: "NZD",
  country: "NZ",
  region: null,
  onboarding_status: "completed",
  onboarding_step: "completed",
  onboarding_completed_at: null,
  prefer_user_rates: true,
  allow_benchmark_rates: true,
  show_profit_in_estimates: true,
};
