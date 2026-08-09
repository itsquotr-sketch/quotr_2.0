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
  tradingName: string | null;
  legalName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  addressLine1: string | null;
  city: string | null;
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
      href: "/app/rates",
      severity: "recommended",
      dimension: "estimate",
    };
    missingEstimateSetup.push(labour);
    recommendedSetup.push(labour);
  }

  recommendedSetup.push({
    id: "work_types",
    title: "Choose common work types",
    reason: "Personalise suggestions for the jobs you usually price.",
    href: "/app/setup?mode=improve",
    severity: "optional",
    dimension: "estimate",
  });

  if (!nonEmpty(input.region)) {
    recommendedSetup.push({
      id: "region",
      title: "Add your region",
      reason: "Helps Quotr tailor local commercial context for estimates.",
      href: "/app/settings/company",
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
    href: "/app/rates",
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

  if (!nonEmpty(displayName)) {
    missingQuoteSetup.push({
      id: "company_name",
      title: "Add a company name for quotes",
      reason: "Clients need to see who is issuing the quote.",
      href: "/app/settings/company",
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
      href: "/app/settings/company",
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
      href: "/app/settings/company",
      severity: "recommended",
      dimension: "quote",
    });
  }

  recommendedSetup.push({
    id: "calibrate",
    title: "Calibrate Quotr",
    reason: "Coming soon — price a sample job so Quotr learns your business.",
    href: "/app/setup?mode=improve",
    severity: "optional",
    dimension: "pricing",
  });

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
    organisationName,
    currency,
    country,
    defaultMarginPercent,
    defaultGstRate,
  };
}
