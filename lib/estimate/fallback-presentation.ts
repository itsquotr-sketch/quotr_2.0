/**
 * POLISH-01 — builder-facing quantity vs rate fallback copy.
 *
 * Presentation only. Does not change calculator quantities or commercial money.
 * Never expose PACKAGE_FALLBACK, rule ids, or pricing-engine internals.
 */
import { isInternalEstimatorDiagnostic } from "@/lib/assistant/presentation/user-facing-estimate-assumptions";
import {
  classifyRateSource,
  type RateSourceType,
} from "@/lib/estimate/rate-source-labels";
import type { QuantityBasis } from "@/lib/estimate/line-item-metadata";
import { isInternalClientNarrative } from "@/lib/quotes/client-narrative";

export type LineFallbackKind = "physical_allowance" | "benchmark_rate";

export type LineFallbackPresentation = {
  readonly kind: LineFallbackKind;
  readonly label: string;
  readonly reason: string;
  readonly confirmHint: string | null;
};

export type FallbackPresentationInput = {
  readonly label?: string | null;
  readonly notes?: string | null;
  readonly rateSource?: string | null;
  readonly quantityBasis?: QuantityBasis | null;
  readonly category?: string | null;
  readonly itemKey?: string | null;
  readonly componentKey?: string | null;
  readonly materialBuildUps?: readonly { priced?: boolean }[] | null;
};

const INTERNAL_TEXT = [
  /\bPACKAGE_FALLBACK\b/,
  /\bDETAILED_AUTHORITATIVE\b/,
  /\bLEGACY_FALLBACK\b/,
  /\bREQUIREMENT_AUTHORITATIVE\b/,
  /package remains money/i,
  /cannot be reconstructed safely/i,
];

export function containsInternalDiagnosticText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (isInternalEstimatorDiagnostic(trimmed)) return true;
  if (isInternalClientNarrative(trimmed)) return true;
  return INTERNAL_TEXT.some((pattern) => pattern.test(trimmed));
}

function hasCalculatedQuantity(basis: QuantityBasis | null | undefined): boolean {
  if (!basis) return false;
  return basis.confidence === "confirmed" || basis.confidence === "derived";
}

function hasAssumedQuantity(basis: QuantityBasis | null | undefined): boolean {
  return basis?.confidence === "assumed";
}

function blob(item: FallbackPresentationInput): string {
  return [item.label, item.notes, item.itemKey, item.componentKey]
    .filter(Boolean)
    .join(" ");
}

function rateType(item: FallbackPresentationInput): RateSourceType {
  return classifyRateSource(item.rateSource ?? "");
}

function isBenchmarkRate(type: RateSourceType): boolean {
  return (
    type === "benchmark" ||
    type === "productivity" ||
    type === "calibrated_productivity"
  );
}

function isUserRate(type: RateSourceType): boolean {
  return type === "user_rate" || type === "work_area_rate";
}

function physicalAllowanceReason(item: FallbackPresentationInput): {
  reason: string;
  confirmHint: string | null;
} {
  const text = blob(item).toLowerCase();

  if (/board width not confirmed|board width/.test(text) && /package|allowance/.test(text)) {
    return {
      reason:
        "We've used a Quotr allowance because the decking board width hasn't been confirmed.",
      confirmHint: "Confirm board width to calculate this from the job details.",
    };
  }

  if (/substructure|framing|joist|bearer/.test(text) && /package|allowance|fallback/.test(text)) {
    return {
      reason:
        "We've used a framing allowance because the detailed layout isn't confirmed enough to calculate each member.",
      confirmHint: "Confirm deck size and height to calculate this from the job details.",
    };
  }

  if (/fence/.test(text) && /package|allowance/.test(text)) {
    return {
      reason:
        "We've used a Quotr allowance because this fence quantity couldn't be calculated from the job details yet.",
      confirmHint: "Confirm length, height, and system to calculate this more specifically.",
    };
  }

  if (/retain/.test(text) && /package|allowance/.test(text)) {
    return {
      reason:
        "We've used a Quotr allowance because this retaining-wall quantity couldn't be calculated from the job details yet.",
      confirmHint: "Confirm length, height, and wall type to calculate this more specifically.",
    };
  }

  return {
    reason:
      "We've used a Quotr allowance because this quantity couldn't be calculated from the job details yet.",
    confirmHint: "Add the missing measurements to calculate this more specifically.",
  };
}

/**
 * Distinguishes:
 * A. physical quantity could not be calculated → Allowance used
 * B. quantity is calculated, company rate missing → Quotr benchmark
 */
export function presentLineFallback(
  item: FallbackPresentationInput
): LineFallbackPresentation | null {
  const calculated = hasCalculatedQuantity(item.quantityBasis);
  const assumed = hasAssumedQuantity(item.quantityBasis);
  const type = rateType(item);
  const text = blob(item);

  const packageWithoutPhysical =
    /board width not confirmed/i.test(text) ||
    (/package allowance/i.test(text) && !calculated && !assumed) ||
    (/decking package/i.test(item.label ?? "") && !calculated && !assumed);

  const structuralPackage =
    !calculated &&
    !assumed &&
    (/package remains money/i.test(text) ||
      /substructure package/i.test(text) ||
      (/deck\.substructure/i.test(item.itemKey ?? "") &&
        /package|allowance/i.test(text)));

  const genericPhysical =
    !calculated &&
    !assumed &&
    (type === "fallback" ||
      item.category === "allowance" ||
      (/package/i.test(item.label ?? "") && type === "default"));

  if (packageWithoutPhysical || structuralPackage || genericPhysical) {
    const copy = physicalAllowanceReason(item);
    return {
      kind: "physical_allowance",
      label: "Allowance used",
      reason: copy.reason,
      confirmHint: copy.confirmHint,
    };
  }

  if (
    (calculated || assumed) &&
    isBenchmarkRate(type) &&
    !isUserRate(type) &&
    type !== "calibrated_productivity"
  ) {
    return {
      kind: "benchmark_rate",
      label: "Quotr benchmark",
      reason:
        "We don't have a company rate for this item yet, so Quotr is using its benchmark rate.",
      confirmHint: null,
    };
  }

  return null;
}

export function fallbackPresentationIsSafe(
  presentation: LineFallbackPresentation
): boolean {
  return (
    !containsInternalDiagnosticText(presentation.label) &&
    !containsInternalDiagnosticText(presentation.reason) &&
    (presentation.confirmHint == null ||
      !containsInternalDiagnosticText(presentation.confirmHint))
  );
}
