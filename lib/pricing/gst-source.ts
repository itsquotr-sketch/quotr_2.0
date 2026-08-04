/**
 * Pricing-document GST source rules — Batch 2B.5.
 *
 * Creation: organisation settings → NZ application default only if unset.
 * Ongoing: stored pricing_documents.gst_rate (0% is valid — use nullish coalescing).
 * Recalculation: always the current document GST (or the validated rate being persisted).
 *
 * Pure helpers only — no Supabase, no commercial-engine adoption.
 */

import { DEFAULT_GST_RATE } from "@/lib/pricing/status";

export { DEFAULT_GST_RATE };

/** Valid GST percent bounds (aligned with gstRatePercentSchema). */
export const MIN_GST_RATE_PERCENT = 0;
export const MAX_GST_RATE_PERCENT = 100;

export type GstSourceResolution = {
  readonly rate: number;
  readonly source:
    | "organisation_settings"
    | "pricing_document"
    | "application_default"
    | "validated_mutation";
};

export function isValidGstRatePercent(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= MIN_GST_RATE_PERCENT &&
    value <= MAX_GST_RATE_PERCENT
  );
}

/**
 * Coerce a persisted GST value without treating SQL null as 0%
 * (`Number(null) === 0` would incorrectly keep a missing rate as valid zero).
 */
export function coercePersistedGstRate(
  value: unknown
): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Initial GST for a new pricing document.
 * Uses organisation rate when present (including 0). Falls back to DEFAULT_GST_RATE (15)
 * only when organisation rate is null/undefined — never via truthy checks.
 */
export function resolveInitialPricingGstRate(
  organisationDefaultGstRate: number | null | undefined
): GstSourceResolution {
  if (isValidGstRatePercent(organisationDefaultGstRate)) {
    return {
      rate: organisationDefaultGstRate,
      source: "organisation_settings",
    };
  }
  return {
    rate: DEFAULT_GST_RATE,
    source: "application_default",
  };
}

/**
 * GST for recalculation / ongoing totals.
 * Prefer stored document rate (including 0). Fall back to application default
 * only when the document rate is missing/invalid.
 */
export function resolveStoredPricingDocumentGstRate(
  documentGstRate: number | null | undefined
): GstSourceResolution {
  if (isValidGstRatePercent(documentGstRate)) {
    return {
      rate: documentGstRate,
      source: "pricing_document",
    };
  }
  return {
    rate: DEFAULT_GST_RATE,
    source: "application_default",
  };
}

/**
 * GST when the document is being updated with a validated mutation value
 * in the same operation. Prefer mutation when provided (including 0).
 */
export function resolvePricingGstForUpdate(params: {
  mutationGstRate: number | null | undefined;
  storedDocumentGstRate: number | null | undefined;
}): GstSourceResolution {
  if (params.mutationGstRate !== undefined && params.mutationGstRate !== null) {
    if (!isValidGstRatePercent(params.mutationGstRate)) {
      throw new Error("Invalid GST rate for pricing document update.");
    }
    return {
      rate: params.mutationGstRate,
      source: "validated_mutation",
    };
  }
  return resolveStoredPricingDocumentGstRate(params.storedDocumentGstRate);
}

/**
 * Simulate createPricingFromEstimate GST wiring (pure).
 * After Batch 2B.5, insert and post-insert recalc must use the same rate.
 */
export function resolveCreatePricingFromEstimateGstRates(
  organisationDefaultGstRate: number | null | undefined
): {
  readonly documentGstRate: number;
  readonly recalculationGstRate: number;
  readonly source: GstSourceResolution["source"];
} {
  const initial = resolveInitialPricingGstRate(organisationDefaultGstRate);
  return {
    documentGstRate: initial.rate,
    recalculationGstRate: initial.rate,
    source: initial.source,
  };
}
