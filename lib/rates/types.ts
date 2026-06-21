import type {
  OrganisationRate,
  OrganisationSettings,
} from "@/components/setup/types";

export type RatesPageRate = OrganisationRate & {
  updated_at?: string | null;
};

export type RatesPageState = {
  settings: OrganisationSettings | null;
  rates: RatesPageRate[];
};

export type RateSettingsInput = {
  default_margin_percent: number;
  default_contingency_percent: number;
  budget_rate_factor: number;
  premium_rate_factor: number;
  prefer_user_rates: boolean;
  allow_benchmark_rates: boolean;
  show_profit_in_estimates: boolean;
};

export type RateInput = {
  id?: string;
  item_key: string;
  rate_type: string;
  trade?: string;
  work_area_type?: string;
  label: string;
  unit: string;
  cost_rate?: number | null;
  sell_rate?: number | null;
  markup_percent?: number | null;
  active?: boolean;
};

export type RateCategory =
  | "labour"
  | "scope_package"
  | "material"
  | "allowance"
  | "subcontractor";

export type CalculatorSupport = "used_now" | "planned";

export type RateCatalogueEntry = {
  item_key: string;
  label: string;
  rate_type: string;
  category: RateCategory;
  work_area_type?: string;
  workAreaLabel?: string;
  trade?: string;
  unit: string;
  description?: string;
  defaultCostRate?: number;
  defaultSellRate?: number;
  recommended: boolean;
  calculatorSupport: CalculatorSupport;
  /** @deprecated use category */
  section?: "labour" | "scope" | "material";
};

export type RatesActionResult = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
  rate?: RatesPageRate;
};

export type CalibrationStatus =
  | "good_setup"
  | "needs_rates"
  | "using_mostly_benchmarks";

export type CalibrationSummary = {
  defaultMarginPercent: number;
  activeRateCount: number;
  recommendedMissingCount: number;
  benchmarkFallbackEnabled: boolean;
  status: CalibrationStatus;
  statusLabel: string;
  lastUpdatedAt: string | null;
};

export type SetRateActiveInput = {
  rateId: string;
  active: boolean;
};
