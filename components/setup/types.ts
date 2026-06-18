import type { EstimateSupport } from "@/lib/scopes/catalogue";

export type SetupStep =
  | "company"
  | "work_areas"
  | "rates"
  | "review"
  | "completed";

export type SetupStatus = "not_started" | "in_progress" | "completed";

export type OrganisationSettings = {
  id: string;
  org_id: string;
  default_margin_percent: number;
  default_contingency_percent: number;
  budget_rate_factor: number;
  premium_rate_factor: number;
  currency: string;
  country: string;
  region: string | null;
  onboarding_status: SetupStatus;
  onboarding_step: SetupStep;
  onboarding_completed_at: string | null;
  prefer_user_rates: boolean;
  allow_benchmark_rates: boolean;
  show_profit_in_estimates: boolean;
};

export type OrganisationWorkArea = {
  id: string;
  work_area_type: string;
  label: string;
  category: string | null;
  description: string | null;
  estimate_support: EstimateSupport;
  enabled: boolean;
  sort_order: number;
};

export type OrganisationRate = {
  id: string;
  rate_type: string;
  trade: string | null;
  work_area_type: string | null;
  item_key: string;
  label: string;
  unit: string;
  cost_rate: number | null;
  sell_rate: number | null;
  markup_percent: number | null;
  active: boolean;
};

export type SetupState = {
  organisationName: string;
  settings: OrganisationSettings | null;
  workAreas: OrganisationWorkArea[];
  rates: OrganisationRate[];
};

export type CompanyDefaultsInput = {
  currency: string;
  country: string;
  region?: string;
  default_margin_percent: number;
  default_contingency_percent: number;
  budget_rate_factor: number;
  premium_rate_factor: number;
  prefer_user_rates: boolean;
  allow_benchmark_rates: boolean;
  show_profit_in_estimates: boolean;
};

export type WorkAreaSelection = {
  work_area_type: string;
  enabled: boolean;
};

export type StarterRateInput = {
  item_key: string;
  rate_type: string;
  trade?: string;
  work_area_type?: string;
  label: string;
  unit: string;
  cost_rate?: number;
  sell_rate?: number;
  markup_percent?: number;
};

export type ActionResult = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
};
