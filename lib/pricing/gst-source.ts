/**
 * Pricing-document GST source rules — Batch 2B.5.
 *
 * Creation: organisation settings → NZ application default only if unset.
 * Ongoing: stored pricing_documents.gst_rate (0% is valid — use nullish coalescing).
 * Recalculation: always the current document GST (or the validated rate being persisted).
 *
 * Pure helpers only — no Supabase, no commercial-engine adoption.
 */

import { GST_REGISTRATION_UNSET_QUOTE_BLOCK } from "@/lib/pricing/gst-presentation";
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
    | "validated_mutation"
    | "registration_unset";
  /** False only when GST registration has not been answered. */
  readonly applied?: boolean;
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
 * Quote GST follows the saved registration decision.
 * Registered uses the organisation rate when it is a positive saved rate,
 * otherwise the application default. Not registered is 0 even if a positive
 * default rate is still stored. Unknown is not registered and is not 0%:
 * no GST is applied.
 */
export function resolveQuoteGstFromRegistration(input: {
  readonly gstRegistered: boolean | null;
  readonly defaultGstRate: number | null | undefined;
}): GstSourceResolution {
  if (input.gstRegistered === true) {
    if (isValidGstRatePercent(input.defaultGstRate) && input.defaultGstRate > 0) {
      return {
        rate: input.defaultGstRate,
        source: "organisation_settings",
        applied: true,
      };
    }
    return {
      rate: DEFAULT_GST_RATE,
      source: "application_default",
      applied: true,
    };
  }
  if (input.gstRegistered === false) {
    return { rate: 0, source: "organisation_settings", applied: true };
  }
  return { rate: 0, source: "registration_unset", applied: false };
}

/**
 * Simulate createPricingFromEstimate GST wiring (pure).
 * After Batch 2B.5, insert and post-insert recalc must use the same rate.
 */
export function appliedOrganisationGstRate(settings: {
  readonly gst_registered?: boolean | null;
  readonly default_gst_rate?: number | string | null;
} | null | undefined): number {
  const registered =
    settings?.gst_registered === true || settings?.gst_registered === false
      ? settings.gst_registered
      : null;
  const raw = settings?.default_gst_rate;
  const rate = raw == null || raw === "" ? null : Number(raw);
  return resolveQuoteGstFromRegistration({
    gstRegistered: registered,
    defaultGstRate: rate != null && Number.isFinite(rate) ? rate : null,
  }).rate;
}

export function resolveNewPricingDocumentGst(input: {
  readonly gstRegistered: boolean | null | undefined;
  readonly defaultGstRate: number | null | undefined;
}): {
  readonly documentGstRate: number;
  readonly recalculationGstRate: number;
  readonly source: GstSourceResolution["source"];
} {
  if (input.gstRegistered === undefined) {
    return resolveCreatePricingFromEstimateGstRates(input.defaultGstRate);
  }
  const resolved = resolveQuoteGstFromRegistration({
    gstRegistered: input.gstRegistered,
    defaultGstRate: input.defaultGstRate,
  });
  return {
    documentGstRate: resolved.rate,
    recalculationGstRate: resolved.rate,
    source: resolved.source,
  };
}

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

/**
 * A draft keeps its stored GST rate when registration changes.
 * Finalisation stays blocked until the rate matches registration or the
 * document rate is kept as an explicit override. Issued snapshots are not
 * rewritten from this decision.
 */
export const PRICING_TAX_BASIS_MISMATCH_BLOCK =
  "This draft’s tax rate does not match GST registration. Review the tax basis before this pricing can be finalised.";

export type PricingTaxBasisMarker = {
  readonly kind: "document_override";
  readonly rate: number;
  readonly registrationRate: number;
  readonly gstRegistered: boolean;
};

export type PricingTaxBasisDecision = {
  readonly registration: "unset" | "registered" | "not_registered" | "not_loaded";
  readonly documentRate: number;
  readonly registrationRate: number;
  readonly mismatch: boolean;
  readonly override: boolean;
  readonly quoteBlock: string | null;
  readonly detail: string | null;
  readonly useDocumentRate: boolean;
  readonly actionable: boolean;
  readonly overrideMarker: PricingTaxBasisMarker | null;
};

function gstRatesEqual(left: number, right: number): boolean {
  return Math.round(left * 100) === Math.round(right * 100);
}

function formatGstPercent(rate: number): string {
  const rounded = Math.round(rate * 100) / 100;
  return `${rounded}%`;
}

export function parsePricingTaxBasis(value: unknown): PricingTaxBasisMarker | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (row.kind !== "document_override") return null;
  const rate = coercePersistedGstRate(row.rate);
  const registrationRate = coercePersistedGstRate(row.registrationRate);
  if (!isValidGstRatePercent(rate) || !isValidGstRatePercent(registrationRate)) {
    return null;
  }
  if (row.gstRegistered !== true && row.gstRegistered !== false) return null;
  return {
    kind: "document_override",
    rate,
    registrationRate,
    gstRegistered: row.gstRegistered,
  };
}

function registrationSentence(input: {
  readonly gstRegistered: boolean;
  readonly registrationRate: number;
}): string {
  if (input.gstRegistered) {
    return `The business is GST registered at ${formatGstPercent(input.registrationRate)}.`;
  }
  return "The business is not GST registered, so the registration rate is 0%.";
}

export function pricingTaxBasisDecision(input: {
  readonly gstRegistered: boolean | null | undefined;
  readonly defaultGstRate: number | null | undefined;
  readonly documentGstRate: number | null | undefined;
  readonly taxBasis?: unknown;
  readonly status?: string | null;
}): PricingTaxBasisDecision {
  const documentRate = isValidGstRatePercent(input.documentGstRate)
    ? input.documentGstRate
    : 0;
  const idle: PricingTaxBasisDecision = {
    registration: "not_loaded",
    documentRate,
    registrationRate: documentRate,
    mismatch: false,
    override: false,
    quoteBlock: null,
    detail: null,
    useDocumentRate: false,
    actionable: false,
    overrideMarker: null,
  };
  if (input.gstRegistered === undefined) return idle;

  const resolved = resolveQuoteGstFromRegistration({
    gstRegistered: input.gstRegistered,
    defaultGstRate: input.defaultGstRate,
  });
  if (input.gstRegistered == null) {
    return {
      ...idle,
      registration: "unset",
      registrationRate: resolved.rate,
      quoteBlock: GST_REGISTRATION_UNSET_QUOTE_BLOCK,
    };
  }

  const registrationRate = resolved.rate;
  const marker = parsePricingTaxBasis(input.taxBasis);
  const override =
    marker != null &&
    gstRatesEqual(marker.rate, documentRate) &&
    gstRatesEqual(marker.registrationRate, registrationRate) &&
    marker.gstRegistered === input.gstRegistered;
  const mismatch = !gstRatesEqual(documentRate, registrationRate) && !override;
  const open = input.status === "draft" || input.status === "reviewed";
  const sentence = registrationSentence({
    gstRegistered: input.gstRegistered,
    registrationRate,
  });
  const overrideMarker: PricingTaxBasisMarker = {
    kind: "document_override",
    rate: documentRate,
    registrationRate,
    gstRegistered: input.gstRegistered,
  };

  return {
    registration: input.gstRegistered ? "registered" : "not_registered",
    documentRate,
    registrationRate,
    mismatch,
    override,
    quoteBlock: mismatch ? PRICING_TAX_BASIS_MISMATCH_BLOCK : null,
    detail: mismatch
      ? `This draft stores ${formatGstPercent(documentRate)} GST. ${sentence} Apply the registration rate, or keep this document rate as an explicit override.`
      : override
        ? `Document tax override: ${formatGstPercent(documentRate)} GST. ${sentence} This rate was kept for this draft.`
        : null,
    useDocumentRate: override,
    actionable: open && mismatch,
    overrideMarker: mismatch ? overrideMarker : null,
  };
}

/** Basis written when a supported document-rate change differs from registration. */
export function pricingDocumentTaxBasisForRate(input: {
  readonly gstRegistered: boolean | null | undefined;
  readonly defaultGstRate: number | null | undefined;
  readonly documentGstRate: number | null | undefined;
}): PricingTaxBasisMarker | null {
  const decision = pricingTaxBasisDecision({
    ...input,
    taxBasis: null,
    status: "draft",
  });
  return decision.overrideMarker;
}
