/**
 * Deterministic recommendation → surface mapping (Stage 3.1C.3-R2E-R1).
 * Presentation routing only — does not affect readiness truth.
 */

export type SetupRecommendationId =
  | "labour_rate"
  | "work_types"
  | "default_margin"
  | "region"
  | "company_name"
  | "company_contact"
  | "company_address"
  | "calibrate"
  | "calibrate_another";

export type SetupRecommendationDestination = {
  id: SetupRecommendationId;
  href: string;
  /** Human label for audits / verify scripts. */
  surface: string;
  section?: string;
};

export const SETUP_RECOMMENDATION_DESTINATIONS: Record<
  SetupRecommendationId,
  SetupRecommendationDestination
> = {
  labour_rate: {
    id: "labour_rate",
    href: "/app/rates?section=core",
    surface: "Rates / Core labour",
    section: "core",
  },
  work_types: {
    id: "work_types",
    href: "/app/settings/company?section=work",
    surface: "Company / Work types",
    section: "work",
  },
  default_margin: {
    id: "default_margin",
    href: "/app/rates?section=defaults",
    surface: "Rates / Defaults",
    section: "defaults",
  },
  region: {
    id: "region",
    href: "/app/settings/company?section=address",
    surface: "Company / Address",
    section: "address",
  },
  company_name: {
    id: "company_name",
    href: "/app/settings/company?section=business",
    surface: "Company / Business details",
    section: "business",
  },
  company_contact: {
    id: "company_contact",
    href: "/app/settings/company?section=business",
    surface: "Company / Business details",
    section: "business",
  },
  company_address: {
    id: "company_address",
    href: "/app/settings/company?section=address",
    surface: "Company / Address",
    section: "address",
  },
  calibrate: {
    id: "calibrate",
    href: "/app/rates?section=calibration",
    surface: "Rates / Calibration",
    section: "calibration",
  },
  calibrate_another: {
    id: "calibrate_another",
    href: "/app/rates?section=calibration",
    surface: "Rates / Calibration",
    section: "calibration",
  },
};

export function getSetupRecommendationHref(
  id: SetupRecommendationId
): string {
  return SETUP_RECOMMENDATION_DESTINATIONS[id].href;
}

export const RATES_SECTION_IDS = [
  "overview",
  "defaults",
  "materials",
  "labour",
  "core",
  "productivity",
  "work_types",
  "plant",
  "subcontract",
  "waste",
  "legacy",
  "benchmarks",
  "calibration",
] as const;

export type RatesSectionId = (typeof RATES_SECTION_IDS)[number];

export function parseRatesSection(
  value: string | null | undefined
): RatesSectionId | null {
  if (!value) return null;
  const trimmed = value.trim();
  // Backward-compatible alias. Generated links stay section=calibration.
  if (trimmed === "calibrate") return "calibration";
  return (RATES_SECTION_IDS as readonly string[]).includes(trimmed)
    ? (trimmed as RatesSectionId)
    : null;
}

export const COMPANY_SECTION_IDS = [
  "overview",
  "business",
  "address",
  "tax",
  "work",
  "branding",
  "documents",
] as const;

export type CompanySettingsSectionId = (typeof COMPANY_SECTION_IDS)[number];

/** Older Company links. Canonical generated links use the ids above. */
const COMPANY_SECTION_ALIASES: Record<string, CompanySettingsSectionId> = {
  "general": "business",
  "pricing": "tax",
  "quotes": "documents",
  "work_areas": "work",
  "work_types": "work",
};

export function parseCompanySettingsSection(
  value: string | null | undefined
): CompanySettingsSectionId | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed === "advanced") {
    return null;
  }
  const alias = COMPANY_SECTION_ALIASES[trimmed];
  if (alias) return alias;
  return (COMPANY_SECTION_IDS as readonly string[]).includes(trimmed)
    ? (trimmed as CompanySettingsSectionId)
    : null;
}

export function isMovedCompanyAdvancedSection(
  value: string | null | undefined
): boolean {
  return value?.trim() === "advanced";
}
