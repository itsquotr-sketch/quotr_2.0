/**
 * DECK-2B — Deterministic Quick Estimate confidence band (presentation only).
 * Uses existing estimate confidence % + assumption/missing signals — no AI guess.
 */
import type { AssumptionMetadata } from "@/lib/estimate/assumption-metadata";
import {
  getUserFacingEstimateAssumptions,
  isBoundaryAssumptionCopy,
} from "@/lib/assistant/presentation/user-facing-estimate-assumptions";

export type QuickEstimateConfidenceBand = "High" | "Medium" | "Low";

export { isBoundaryAssumptionCopy };

export function estimatingAssumptionsForDisplay(
  assumptions: readonly string[]
): string[] {
  return getUserFacingEstimateAssumptions({ assumptions, limit: null });
}

export type QuickEstimateConfidencePresentation = {
  readonly band: QuickEstimateConfidenceBand;
  readonly reasons: readonly string[];
  readonly blocksEstimate: false;
};

export function deriveQuickEstimateConfidencePresentation(params: {
  readonly confidencePercent: number;
  readonly assumptionSeverity?: "critical" | "warning" | "info" | null;
  readonly missingInfoCount: number;
  readonly attentionCount: number;
  readonly pricingGapCount?: number;
}): QuickEstimateConfidencePresentation {
  const reasons: string[] = [];

  if (params.missingInfoCount > 0) {
    reasons.push(
      `${params.missingInfoCount} scope gap${params.missingInfoCount === 1 ? "" : "s"} noted`
    );
  }
  if (params.attentionCount > 0) {
    reasons.push(
      `${params.attentionCount} attention item${params.attentionCount === 1 ? "" : "s"}`
    );
  }
  if ((params.pricingGapCount ?? 0) > 0) {
    reasons.push(
      `${params.pricingGapCount} pricing-required item${params.pricingGapCount === 1 ? "" : "s"}`
    );
  }
  if (params.assumptionSeverity === "critical") {
    reasons.push("Critical estimating assumption in effect");
  } else if (params.assumptionSeverity === "warning") {
    reasons.push("Some disclosed assumptions affect confidence");
  }

  let band: QuickEstimateConfidenceBand;
  if (
    params.confidencePercent >= 75 &&
    params.missingInfoCount === 0 &&
    params.attentionCount <= 1 &&
    params.assumptionSeverity !== "critical"
  ) {
    band = "High";
    if (reasons.length === 0) {
      reasons.push("Major scope facts known; main cost buckets covered");
    }
  } else if (
    params.confidencePercent >= 50 ||
    (params.missingInfoCount <= 2 && params.assumptionSeverity !== "critical")
  ) {
    band = "Medium";
    if (reasons.length === 0) {
      reasons.push("Reasonable estimate with disclosed assumptions");
    }
  } else {
    band = "Low";
    if (reasons.length === 0) {
      reasons.push("Material scope or pricing uncertainty remains");
    }
  }

  return {
    band,
    reasons,
    blocksEstimate: false,
  };
}

export function rankQuickEstimateAssumptions(
  assumptions: readonly string[],
  limit = 3,
  assumptionMetadata?: AssumptionMetadata | null
): readonly string[] {
  return getUserFacingEstimateAssumptions({
    assumptions,
    assumptionMetadata,
    limit,
  });
}
