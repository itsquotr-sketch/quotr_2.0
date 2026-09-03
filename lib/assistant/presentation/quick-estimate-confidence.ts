/**
 * DECK-2B — Deterministic Quick Estimate confidence band (presentation only).
 * Uses existing estimate confidence % + assumption/missing signals — no AI guess.
 */
import { GENERAL_ESTIMATE_ASSUMPTIONS } from "@/lib/estimate/summary";

export type QuickEstimateConfidenceBand = "High" | "Medium" | "Low";

const BOUNDARY_COPY_PATTERNS = [
  /internal working estimate/i,
  /not a client quote/i,
  /review it before creating final pricing/i,
];

export function isBoundaryAssumptionCopy(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (GENERAL_ESTIMATE_ASSUMPTIONS.includes(trimmed)) return true;
  return BOUNDARY_COPY_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function estimatingAssumptionsForDisplay(
  assumptions: readonly string[]
): string[] {
  return assumptions.filter((line) => !isBoundaryAssumptionCopy(line));
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
  limit = 3
): readonly string[] {
  const ranked = estimatingAssumptionsForDisplay(assumptions)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, array) => array.indexOf(item) === index);

  const priority = (line: string): number => {
    const lower = line.toLowerCase();
    if (/demolition|removal|access|carry|balustrade|fall|pricing|missing/.test(lower)) {
      return 0;
    }
    if (/assume|standard|default|preliminary|unless/.test(lower)) {
      return 1;
    }
    return 2;
  };

  return ranked
    .sort((a, b) => priority(a) - priority(b) || a.localeCompare(b))
    .slice(0, limit);
}
