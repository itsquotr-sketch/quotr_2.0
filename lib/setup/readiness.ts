/**
 * Deterministic company setup readiness (Stage 3.1C.3 / R2A).
 * Presentation/readiness authority only — does not change commercial formulas.
 *
 * onboarding_status narrow meaning (R2A):
 * - not_started / null → company basics not confirmed (first-run gate)
 * - in_progress | completed → basics confirmed; completed is legacy wizard flag only
 *   and is NOT product authority for Dashboard / projects / Incomplete badge
 */

import { DEFAULT_MARGIN_PERCENT } from "@/lib/estimate/constants";
import {
  normalizeCountryCode,
  normalizeCurrencyCode,
} from "@/lib/setup/locale-catalogue";
import { getSetupRecommendationHref } from "@/lib/setup/recommendation-destinations";

export type SetupSuggestion = {
  id: string;
  title: string;
  reason: string;
  href: string;
  severity: "required" | "recommended" | "optional";
  dimension: "estimate" | "pricing" | "quote" | "basics";
};

export type CompanySetupReadiness = {
  accountReady: boolean;
  companyBasicsReady: boolean;
  estimateReady: boolean;
  pricingReady: boolean;
  quoteReady: boolean;
  missingEstimateSetup: SetupSuggestion[];
  missingPricingSetup: SetupSuggestion[];
  missingQuoteSetup: SetupSuggestion[];
  recommendedSetup: SetupSuggestion[];
  /** True when first-run company basics still need confirmation. */
  needsFirstRunBasics: boolean;
  /**
   * Legacy: advanced wizard not marked completed.
   * Must not drive Incomplete badge or Dashboard access after R2A.
   */
  advancedSetupIncomplete: boolean;
  usingDefaultMargin: boolean;
  hasLabourRate: boolean;
  hasWorkTypePreferences: boolean;
  companyRateCount: number;
  hasCalibration: boolean;
  hasLogo: boolean;
  hasAddress: boolean;
  hasContactEmail: boolean;
  hasTimezone: boolean;
  organisationName: string;
  currency: string;
  country: string;
  defaultMarginPercent: number;
  defaultGstRate: number;
};

export type CompanySetupReadinessInput = {
  accountReady: boolean;
  organisationName: string;
  onboardingStatus: "not_started" | "in_progress" | "completed" | null;
  currency: string | null;
  country: string | null;
  region: string | null;
  defaultGstRate: number | null;
  defaultMarginPercent: number | null;
  /** True when org has at least one active labour rate with a cost_rate. */
  hasLabourRate: boolean;
  /** True when org has at least one preferred (enabled) work type. */
  hasWorkTypePreferences: boolean;
  /** Count of active company rates with a cost_rate. */
  companyRateCount?: number;
  /** True when org has at least one active calibration response. */
  hasCalibration?: boolean;
  /** Distinct active calibrated scenarios (for subtle “another” tip). */
  calibratedScenarioCount?: number;
  /** MVP catalogue size used for “another” tip (default 2). */
  calibrationScenarioTotal?: number;
  tradingName: string | null;
  legalName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  addressLine1: string | null;
  city: string | null;
  logoUrl?: string | null;
  timezone?: string | null;
};

function nonEmpty(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Pure readiness composer — single source for Dashboard / Estimate / Pricing / Quote.
 */
export function computeCompanySetupReadiness(
  input: CompanySetupReadinessInput
): CompanySetupReadiness {
  const organisationName = input.organisationName.trim() || "Your company";

  const normalizedCountry = normalizeCountryCode(input.country);
  const normalizedCurrency = normalizeCurrencyCode(input.currency);

  // Display codes: prefer normalised; fall back to trimmed persisted for legacy orgs.
  const country =
    normalizedCountry ??
    (input.country?.trim().toUpperCase() || "NZ");
  const currency =
    normalizedCurrency ??
    (input.currency?.trim().toUpperCase() || "NZD");

  const defaultGstRate =
    input.defaultGstRate != null && Number.isFinite(input.defaultGstRate)
      ? Number(input.defaultGstRate)
      : 15;
  const defaultMarginPercent =
    input.defaultMarginPercent != null &&
    Number.isFinite(input.defaultMarginPercent)
      ? Number(input.defaultMarginPercent)
      : DEFAULT_MARGIN_PERCENT;

  const needsFirstRunBasics =
    !input.accountReady ||
    input.onboardingStatus == null ||
    input.onboardingStatus === "not_started";

  // Basics confirmed once user left not_started. Do not re-gate established
  // orgs whose legacy country/currency strings are outside the MVP catalogue.
  const companyBasicsReady =
    input.accountReady &&
    nonEmpty(organisationName) &&
    !needsFirstRunBasics;

  const usingDefaultMargin =
    Math.abs(defaultMarginPercent - DEFAULT_MARGIN_PERCENT) < 0.0001;

  const missingEstimateSetup: SetupSuggestion[] = [];
  const missingPricingSetup: SetupSuggestion[] = [];
  const missingQuoteSetup: SetupSuggestion[] = [];
  const recommendedSetup: SetupSuggestion[] = [];

  if (!input.hasLabourRate) {
    const labour: SetupSuggestion = {
      id: "labour_rate",
      title: "Add your labour rate",
      reason:
        "Quotr will use it when estimating your own labour. Until then, benchmark or project-specific rates may apply.",
      href: getSetupRecommendationHref("labour_rate"),
      severity: "recommended",
      dimension: "estimate",
    };
    missingEstimateSetup.push(labour);
    recommendedSetup.push(labour);
  }

  if (!input.hasWorkTypePreferences) {
    recommendedSetup.push({
      id: "work_types",
      title: "Choose common work types",
      reason:
        "Personalise rates and recommendations for the jobs you usually price. Quotr can still estimate other work.",
      href: getSetupRecommendationHref("work_types"),
      severity: "optional",
      dimension: "estimate",
    });
  } else {
    recommendedSetup.push({
      id: "work_types",
      title: "Change work types",
      reason: "Update which work types Quotr prioritises for your business.",
      href: getSetupRecommendationHref("work_types"),
      severity: "optional",
      dimension: "estimate",
    });
  }

  if (!nonEmpty(input.region)) {
    recommendedSetup.push({
      id: "region",
      title: "Add your region",
      reason: "Helps Quotr tailor local commercial context for estimates.",
      href: getSetupRecommendationHref("region"),
      severity: "optional",
      dimension: "estimate",
    });
  }

  const marginSuggestion: SetupSuggestion = {
    id: "default_margin",
    title: usingDefaultMargin
      ? "Confirm your default margin"
      : "Review pricing defaults",
    reason: usingDefaultMargin
      ? `Quotr is using the standard ${DEFAULT_MARGIN_PERCENT}% gross margin. Adjust it if your business runs differently.`
      : "Keep margin and contingency aligned with how you price work.",
    href: getSetupRecommendationHref("default_margin"),
    severity: "recommended",
    dimension: "pricing",
  };
  if (usingDefaultMargin || !input.hasLabourRate) {
    missingPricingSetup.push(marginSuggestion);
    if (!recommendedSetup.some((item) => item.id === marginSuggestion.id)) {
      recommendedSetup.push(marginSuggestion);
    }
  }

  const displayName =
    input.tradingName?.trim() ||
    input.legalName?.trim() ||
    organisationName;
  const hasContact =
    nonEmpty(input.contactEmail) || nonEmpty(input.contactPhone);
  const hasAddress = nonEmpty(input.addressLine1) || nonEmpty(input.city);
  const hasContactEmail = nonEmpty(input.contactEmail);
  const hasLogo = nonEmpty(input.logoUrl);
  const hasTimezone = nonEmpty(input.timezone);
  const companyRateCount =
    input.companyRateCount != null && Number.isFinite(input.companyRateCount)
      ? Math.max(0, Math.floor(input.companyRateCount))
      : input.hasLabourRate
        ? 1
        : 0;

  if (!nonEmpty(displayName)) {
    missingQuoteSetup.push({
      id: "company_name",
      title: "Add a company name for quotes",
      reason: "Clients need to see who is issuing the quote.",
      href: getSetupRecommendationHref("company_name"),
      severity: "required",
      dimension: "quote",
    });
  }

  if (!hasContact) {
    const contact: SetupSuggestion = {
      id: "company_contact",
      title: "Complete quote details",
      reason:
        "Add a company email or phone before sending a quote to a client.",
      href: getSetupRecommendationHref("company_contact"),
      severity: "required",
      dimension: "quote",
    };
    missingQuoteSetup.push(contact);
    recommendedSetup.push(contact);
  }

  if (!hasAddress) {
    recommendedSetup.push({
      id: "company_address",
      title: "Complete company address",
      reason: "Professional quotes usually include your business address.",
      href: getSetupRecommendationHref("company_address"),
      severity: "recommended",
      dimension: "quote",
    });
  }

  // After first calibration, drop the "first work type" tip (no nag).
  if (companyBasicsReady && !input.hasCalibration) {
    recommendedSetup.push({
      id: "calibrate",
      title: "Calibrate your first work type",
      reason:
        "~3 min. Tell Quotr how your crew normally completes a few common tasks.",
      href: getSetupRecommendationHref("calibrate"),
      severity: "optional",
      dimension: "pricing",
    });
  } else if (
    companyBasicsReady &&
    input.hasCalibration &&
    (input.calibratedScenarioCount ?? 0) > 0 &&
    (input.calibratedScenarioCount ?? 0) < (input.calibrationScenarioTotal ?? 2)
  ) {
    recommendedSetup.push({
      id: "calibrate_another",
      title: "Calibrate another work type",
      reason: "Optional — only if useful for the work you price most.",
      href: getSetupRecommendationHref("calibrate_another"),
      severity: "optional",
      dimension: "pricing",
    });
  }

  const estimateReady = companyBasicsReady;
  const pricingReady = companyBasicsReady && input.hasLabourRate;
  const quoteReady =
    companyBasicsReady && nonEmpty(displayName) && hasContact;

  const advancedSetupIncomplete =
    input.onboardingStatus !== "completed" && input.onboardingStatus != null;

  return {
    accountReady: input.accountReady,
    companyBasicsReady,
    estimateReady,
    pricingReady,
    quoteReady,
    missingEstimateSetup,
    missingPricingSetup,
    missingQuoteSetup,
    recommendedSetup,
    needsFirstRunBasics,
    advancedSetupIncomplete,
    usingDefaultMargin,
    hasLabourRate: input.hasLabourRate,
    hasWorkTypePreferences: input.hasWorkTypePreferences,
    companyRateCount,
    hasCalibration: Boolean(input.hasCalibration),
    hasLogo,
    hasAddress,
    hasContactEmail,
    hasTimezone,
    organisationName,
    currency,
    country,
    defaultMarginPercent,
    defaultGstRate,
  };
}
