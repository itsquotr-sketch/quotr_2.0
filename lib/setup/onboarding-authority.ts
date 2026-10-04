/**
 * Unified onboarding authority (phase 1).
 *
 * Completion is canonical only: onboarding_status completed, or
 * onboarding_step completed. `rates` and `review` are not completion.
 * Existing completed organisations stay in the app even when a required
 * answer is still missing. That missing answer is the later notice.
 *
 * Quote and Variation GST math is not decided here. This module only
 * records the company registration choice and the labour answers.
 */

import { normalizeCountryCode } from "@/lib/setup/locale-catalogue";
import { validateMarginPercent } from "@/lib/security/margin-validation";

export const LABOUR_ONBOARDING_CHOICES = ["company", "quotr_benchmark"] as const;

export type LabourOnboardingChoice = (typeof LABOUR_ONBOARDING_CHOICES)[number];

export type OnboardingFieldId =
  | "basics"
  | "address"
  | "gst"
  | "work"
  | "carpenter"
  | "labourer"
  | "margin";

export type OnboardingFieldClassification = "satisfied" | "missing" | "stale";

export type OnboardingResumeStage =
  | "basics"
  | "address"
  | "tax"
  | "work"
  | "labour"
  | "ready";

export type OnboardingAuthoritySnapshot = {
  tradingName: string | null;
  country: string | null;
  addressLine1: string | null;
  city: string | null;
  postcode: string | null;
  gstRegistered: boolean | null;
  gstNumber: string | null;
  abn: string | null;
  /** Preserved. Never evidence of GST registration and never cleared here. */
  nzbn: string | null;
  defaultGstRate: number | null;
  hasPrimaryWorkAreas: boolean;
  carpenterChoice: LabourOnboardingChoice | null;
  carpenterHasPositiveCost: boolean;
  labourerChoice: LabourOnboardingChoice | null;
  labourerHasPositiveCost: boolean;
  marginPercent: number | null;
};

export type OnboardingAssessment = {
  stage: OnboardingResumeStage;
  fields: Record<OnboardingFieldId, OnboardingFieldClassification>;
  incomplete: boolean;
  readyToComplete: boolean;
  /** Product updates stay optional. Completion never requires consent. */
  marketingConsentRequired: false;
};

const RESUME_ORDER: Array<{
  id: OnboardingFieldId;
  stage: OnboardingResumeStage;
}> = [
  { id: "basics", stage: "basics" },
  { id: "address", stage: "address" },
  { id: "gst", stage: "tax" },
  { id: "work", stage: "work" },
  { id: "carpenter", stage: "labour" },
  { id: "labourer", stage: "labour" },
  { id: "margin", stage: "labour" },
];

function text(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export function taxIdentifierDigits(value: string | null | undefined): string {
  return text(value).replace(/\D/g, "");
}

/** NZ GST number (8–9 digits) or Australian ABN (11 digits). NZBN is ignored. */
export function hasRelevantTaxIdentifier(
  gstNumber: string | null | undefined,
  abn: string | null | undefined
): boolean {
  const gst = taxIdentifierDigits(gstNumber);
  const abnDigits = taxIdentifierDigits(abn);
  return /^\d{8,9}$/.test(gst) || /^\d{11}$/.test(abnDigits);
}

export function hasStoredTaxIdentifier(
  gstNumber: string | null | undefined,
  abn: string | null | undefined
): boolean {
  return text(gstNumber).length > 0 || text(abn).length > 0;
}

export function isCanonicalOnboardingComplete(
  onboardingStatus: string | null | undefined,
  onboardingStep: string | null | undefined
): boolean {
  return onboardingStatus === "completed" || onboardingStep === "completed";
}

/**
 * Migration step 1. `rates` and `review` become the canonical completed pair.
 * Later writes of those steps are not completion.
 */
export function canonicalCompletionBackfill(
  onboardingStatus: string | null | undefined,
  onboardingStep: string | null | undefined
): {
  onboardingStatus: string;
  onboardingStep: string;
  changed: boolean;
} {
  const status = onboardingStatus ?? "not_started";
  const step = onboardingStep ?? "company";
  const grandfathered =
    step === "rates" ||
    step === "review" ||
    step === "completed" ||
    status === "completed";
  if (!grandfathered) {
    return { onboardingStatus: status, onboardingStep: step, changed: false };
  }
  const changed = status !== "completed" || step !== "completed";
  return {
    onboardingStatus: "completed",
    onboardingStep: "completed",
    changed,
  };
}

/**
 * Migration step 2, after canonical completion.
 * True only from a relevant GST number or ABN.
 * False only for a completed organisation at rate 0 with no stored identifier.
 * Otherwise null. A zero rate alone is unknown, not "not registered".
 */
export function backfillGstRegistered(input: {
  onboardingStatus: string | null | undefined;
  onboardingStep: string | null | undefined;
  gstNumber: string | null | undefined;
  abn: string | null | undefined;
  defaultGstRate: number | null | undefined;
}): boolean | null {
  if (hasRelevantTaxIdentifier(input.gstNumber, input.abn)) return true;
  const completed = isCanonicalOnboardingComplete(
    input.onboardingStatus,
    input.onboardingStep
  );
  const rate = input.defaultGstRate;
  if (
    completed &&
    rate === 0 &&
    !hasStoredTaxIdentifier(input.gstNumber, input.abn)
  ) {
    return false;
  }
  return null;
}

/** Migration step 3. A real positive cost is a company answer. Never invent a benchmark or a rate. */
export function backfillLabourChoice(input: {
  existingChoice: string | null | undefined;
  hasPositiveCompanyCost: boolean;
}): LabourOnboardingChoice | null {
  if (
    input.existingChoice === "company" ||
    input.existingChoice === "quotr_benchmark"
  ) {
    return input.existingChoice;
  }
  if (input.hasPositiveCompanyCost) return "company";
  return null;
}

function basicsSatisfied(snapshot: OnboardingAuthoritySnapshot): boolean {
  const country = normalizeCountryCode(snapshot.country);
  return text(snapshot.tradingName).length > 0 && (country === "NZ" || country === "AU");
}

function addressSatisfied(snapshot: OnboardingAuthoritySnapshot): boolean {
  return (
    text(snapshot.addressLine1).length > 0 &&
    text(snapshot.city).length > 0 &&
    /^\d{4}$/.test(text(snapshot.postcode))
  );
}

function gstClassification(
  snapshot: OnboardingAuthoritySnapshot
): OnboardingFieldClassification {
  const relevant = hasRelevantTaxIdentifier(snapshot.gstNumber, snapshot.abn);
  const stored = hasStoredTaxIdentifier(snapshot.gstNumber, snapshot.abn);
  const rate = snapshot.defaultGstRate;
  if (snapshot.gstRegistered == null) return "missing";
  if (snapshot.gstRegistered === true) {
    return relevant && rate != null && rate > 0 ? "satisfied" : "stale";
  }
  return !stored && rate === 0 ? "satisfied" : "stale";
}

function labourClassification(
  choice: LabourOnboardingChoice | null,
  hasPositiveCost: boolean
): OnboardingFieldClassification {
  if (choice == null) return "missing";
  if (choice === "quotr_benchmark") return "satisfied";
  return hasPositiveCost ? "satisfied" : "stale";
}

function marginClassification(
  snapshot: OnboardingAuthoritySnapshot
): OnboardingFieldClassification {
  if (snapshot.marginPercent == null || !Number.isFinite(snapshot.marginPercent)) {
    return "missing";
  }
  return validateMarginPercent(snapshot.marginPercent).ok ? "satisfied" : "missing";
}

export function classifyOnboardingFields(
  snapshot: OnboardingAuthoritySnapshot
): Record<OnboardingFieldId, OnboardingFieldClassification> {
  return {
    basics: basicsSatisfied(snapshot) ? "satisfied" : "missing",
    address: addressSatisfied(snapshot) ? "satisfied" : "missing",
    gst: gstClassification(snapshot),
    work: snapshot.hasPrimaryWorkAreas ? "satisfied" : "missing",
    carpenter: labourClassification(
      snapshot.carpenterChoice,
      snapshot.carpenterHasPositiveCost
    ),
    labourer: labourClassification(
      snapshot.labourerChoice,
      snapshot.labourerHasPositiveCost
    ),
    margin: marginClassification(snapshot),
  };
}

export function deriveIncompleteSetup(
  snapshot: OnboardingAuthoritySnapshot
): boolean {
  return Object.values(classifyOnboardingFields(snapshot)).some(
    (state) => state !== "satisfied"
  );
}

export function assessRequiredOnboarding(
  snapshot: OnboardingAuthoritySnapshot
): OnboardingAssessment {
  const fields = classifyOnboardingFields(snapshot);
  const first = RESUME_ORDER.find((item) => fields[item.id] !== "satisfied");
  const stage = first?.stage ?? "ready";
  const incomplete = first != null;
  return {
    stage,
    fields,
    incomplete,
    readyToComplete: !incomplete,
    marketingConsentRequired: false,
  };
}

export type GstRegistrationWrite = {
  gst_registered: boolean;
  default_gst_rate: number;
  gst_number: string | null;
  abn: string | null;
};

/**
 * Not registered stores rate 0 and clears the GST number and ABN.
 * NZBN is not part of this write.
 */
export function gstRegistrationPersistence(input: {
  registered: boolean;
  countryCode: "NZ" | "AU";
  gstNumber: string | null;
  abn: string | null;
  suggestedRate: number;
}): GstRegistrationWrite {
  if (!input.registered) {
    return {
      gst_registered: false,
      default_gst_rate: 0,
      gst_number: null,
      abn: null,
    };
  }
  const suggested =
    Number.isFinite(input.suggestedRate) && input.suggestedRate > 0
      ? input.suggestedRate
      : input.countryCode === "AU"
        ? 10
        : 15;
  return {
    gst_registered: true,
    default_gst_rate: suggested,
    gst_number: input.countryCode === "NZ" ? input.gstNumber : null,
    abn: input.countryCode === "AU" ? input.abn : null,
  };
}

export type LabourOnboardingWrite =
  | {
      ok: true;
      choice: "company";
      costRate: number;
      writeRate: true;
    }
  | {
      ok: true;
      choice: "quotr_benchmark";
      writeRate: false;
    }
  | { ok: false; error: string };

/**
 * Benchmark records the answer and does not write a cost.
 * A cost without an explicit choice is the current company-cost form.
 */
export function resolveLabourOnboardingWrite(input: {
  choice?: string | null;
  cost?: string | number | null;
  label: string;
}): LabourOnboardingWrite {
  const choice = text(input.choice ?? undefined);
  if (choice === "quotr_benchmark") {
    return { ok: true, choice: "quotr_benchmark", writeRate: false };
  }
  if (choice !== "" && choice !== "company") {
    return {
      ok: false,
      error: `Choose a company cost or Quotr benchmarks for the ${input.label}.`,
    };
  }

  const raw = input.cost == null ? "" : String(input.cost).trim();
  if (!raw) {
    return {
      ok: false,
      error: `Enter the ${input.label} internal cost per hour, or choose Quotr benchmarks.`,
    };
  }
  const costRate = Number(raw);
  if (!Number.isFinite(costRate) || costRate <= 0) {
    return { ok: false, error: `${input.label} cost must be greater than 0.` };
  }
  if (costRate > 10000) {
    return {
      ok: false,
      error: `${input.label} cost looks too high. Check the hourly amount.`,
    };
  }
  return { ok: true, choice: "company", costRate, writeRate: true };
}
