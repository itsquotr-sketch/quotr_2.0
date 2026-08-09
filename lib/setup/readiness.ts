/**
 * Deterministic company setup readiness (Stage 3.1C.3).
 * Presentation/readiness authority only — does not change commercial formulas.
 */

import { DEFAULT_MARGIN_PERCENT } from "@/lib/estimate/constants";

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
  /** Soft onboarding wizard not fully completed (work areas/rates/review). */
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
  const currency = (input.currency ?? "NZD").trim() || "NZD";
  const country = (input.country ?? "NZ").trim() || "NZ";
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

  const companyBasicsReady =
    input.accountReady &&
    nonEmpty(organisationName) &&
    !needsFirstRunBasics &&
    nonEmpty(currency) &&
    nonEmpty(country);

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
      title: "Add company contact details",
      reason:
        "Complete an email or phone number before sending this quote to a client.",
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
