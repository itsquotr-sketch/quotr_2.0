/**
 * Variation response wording, evidence checks, and read-only analytics.
 * Money authority stays on the accepted adjustment ledger.
 */

export const VARIATION_RESPONSE_SCHEMA_VERSION = "v1";
export const VARIATION_ACCEPT_AUTHORITY_VERSION = "variation-accept-authority-v1";
export const VARIATION_ACCEPT_SCOPE_VERSION = "variation-accept-scope-v1";
export const VARIATION_ACCEPT_ATTACHMENTS_VERSION = "variation-accept-attachments-v1";
export const VARIATION_ACCEPT_MASTER_TERMS_VERSION = "variation-accept-master-terms-v1";
export const VARIATION_ACCEPT_FINAL_VERSION = "variation-accept-final-v1";
export const VARIATION_DECLINE_FINAL_VERSION = "variation-decline-final-v1";
export const VARIATION_MANUAL_RECEIVED_VERSION = "variation-manual-received-v1";

export const VARIATION_MANUAL_EVIDENCE_TYPES = [
  "email_confirmation",
  "signed_document",
  "verbal_approval",
  "other",
] as const;

export type VariationManualEvidenceType = (typeof VARIATION_MANUAL_EVIDENCE_TYPES)[number];

export type VariationResponseSource = "client" | "manual";
export type VariationResponseOutcome = "accepted" | "declined";

const MEANINGFUL_NOTE = 8;

export function variationAttachmentConfirmation(count: number): string | null {
  if (!Number.isInteger(count) || count <= 0) return null;
  const noun = count === 1 ? "supporting attachment" : "supporting attachments";
  return `I confirm that I have reviewed this Variation, including its scope, pricing and ${count} ${noun}.`;
}

export function variationAuthorityConfirmation(): string {
  return "I have authority to accept this Variation for the client.";
}

export function variationScopeConfirmation(): string {
  return "I have reviewed this Variation, including its scope and the price adjustment.";
}

export function variationMasterTermsConfirmation(): string {
  return "I confirm that the master Quote’s terms, conditions, inclusions and exclusions continue to apply, except where this Variation expressly changes them.";
}

export function variationAcceptFinalConfirmation(): string {
  return "I confirm that accepting this Variation changes the accepted contract value.";
}

export function variationDeclineExplanation(): string {
  return "Declining this Variation means it will not change the agreed scope or accepted contract value.";
}

export function variationDeclineFinalConfirmation(): string {
  return "I confirm that I decline this Variation.";
}

export function variationManualReceivedConfirmation(): string {
  return "I confirm that I am recording an outcome already received from the client.";
}

export function variationEvidenceTypeLabel(type: VariationManualEvidenceType): string {
  switch (type) {
    case "email_confirmation":
      return "Email confirmation";
    case "signed_document":
      return "Signed document";
    case "verbal_approval":
      return "Verbal approval";
    case "other":
      return "Other";
  }
}

export function variationResponseSourceLabel(source: VariationResponseSource): string {
  return source === "client" ? "Client" : "Manual";
}

export function manualEvidenceNoteProblem(
  type: VariationManualEvidenceType | null,
  note: string
): "required" | "meaningful" | null {
  const trimmed = note.trim();
  if (!type) return "required";
  if (!trimmed) return "required";
  if ((type === "verbal_approval" || type === "other") && trimmed.length < MEANINGFUL_NOTE) {
    return "meaningful";
  }
  return null;
}

export type VariationResponseAnalyticsRow = {
  outcome: VariationResponseOutcome;
  respondedAt: string | null;
  issuedAt: string | null;
  netAdjustmentExGst: number | null;
};

export type VariationResponseAnalytics = {
  acceptedCount: number;
  declinedCount: number;
  acceptanceRate: number | null;
  acceptedPositiveAdjustmentExGst: number;
  acceptedNegativeAdjustmentExGst: number;
  netAcceptedContractChangeExGst: number;
  averageResponseDurationMs: number | null;
};

function durationMs(issuedAt: string, respondedAt: string): number | null {
  const issued = Date.parse(issuedAt);
  const responded = Date.parse(respondedAt);
  if (!Number.isFinite(issued) || !Number.isFinite(responded)) return null;
  return responded - issued;
}

/** Typed read model. Empty denominators are null. Sell is not turned into margin. */
export function summariseVariationResponses(
  rows: readonly VariationResponseAnalyticsRow[]
): VariationResponseAnalytics {
  let acceptedCount = 0;
  let declinedCount = 0;
  let positive = 0;
  let negative = 0;
  let durationTotal = 0;
  let durationCount = 0;
  for (const row of rows) {
    if (row.outcome === "accepted") {
      acceptedCount += 1;
      if (typeof row.netAdjustmentExGst === "number" && Number.isFinite(row.netAdjustmentExGst)) {
        if (row.netAdjustmentExGst > 0) positive += row.netAdjustmentExGst;
        if (row.netAdjustmentExGst < 0) negative += row.netAdjustmentExGst;
      }
    } else if (row.outcome === "declined") {
      declinedCount += 1;
    }
    if (row.issuedAt && row.respondedAt) {
      const duration = durationMs(row.issuedAt, row.respondedAt);
      if (duration != null) {
        durationTotal += duration;
        durationCount += 1;
      }
    }
  }
  const decided = acceptedCount + declinedCount;
  return {
    acceptedCount,
    declinedCount,
    acceptanceRate: decided === 0 ? null : acceptedCount / decided,
    acceptedPositiveAdjustmentExGst: positive,
    acceptedNegativeAdjustmentExGst: negative,
    netAcceptedContractChangeExGst: positive + negative,
    averageResponseDurationMs: durationCount === 0 ? null : durationTotal / durationCount,
  };
}
