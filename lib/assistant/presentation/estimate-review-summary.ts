/**
 * Stage 3.1B.7C — Estimate Review work-area summary rows (presentation only).
 */

import type { ScopeReviewWorkArea } from "@/lib/assistant/types";

export type EstimateReviewWorkAreaSummaryRow = {
  readonly workAreaId: string;
  readonly workAreaName: string;
  readonly descriptionReady: boolean;
  readonly descriptionLabel: string;
  readonly measurementsLabel: string;
  readonly scopeLabel: string;
  readonly assumptionsLabel: string;
  readonly constraintsLabel: string;
  readonly outstandingLabel: string;
  readonly estimateReadinessLabel: string;
  readonly hasOutstanding: boolean;
};

function measurementFactLabels(
  workArea: ScopeReviewWorkArea
): string {
  const measurementFacts = workArea.facts.filter((f) =>
    /length|width|height|area|m2|dimension|size/i.test(`${f.key} ${f.label}`)
  );
  if (measurementFacts.length === 0) {
    return workArea.facts.length > 0 ? "Captured" : "Not yet";
  }
  return measurementFacts
    .slice(0, 3)
    .map((f) => f.value)
    .filter(Boolean)
    .join(" · ") || "Captured";
}

function conciseDescriptionPreview(
  description: string | null | undefined,
  max = 80
): string {
  const text = description?.trim() ?? "";
  if (!text) return "Not added";
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}…`;
}

export function buildEstimateReviewWorkAreaSummary(
  workArea: ScopeReviewWorkArea,
  opts?: {
    readonly constraintChipCount?: number;
    readonly constraintPreview?: string;
  }
): EstimateReviewWorkAreaSummaryRow {
  const descriptionReady = Boolean(workArea.quoteDescription?.trim());
  const missing = workArea.missingItems;
  const assumptionCount = workArea.assumptions.length;
  const factCount = workArea.facts.length;

  const outstandingLabel =
    missing.length === 0
      ? "None"
      : missing.slice(0, 2).join(" · ") +
        (missing.length > 2 ? ` +${missing.length - 2}` : "");

  return {
    workAreaId: workArea.workAreaId,
    workAreaName: workArea.workAreaName,
    descriptionReady,
    descriptionLabel: descriptionReady
      ? conciseDescriptionPreview(workArea.quoteDescription)
      : "Not added",
    measurementsLabel: measurementFactLabels(workArea),
    scopeLabel:
      factCount === 0
        ? "No confirmed details yet"
        : `${factCount} detail${factCount === 1 ? "" : "s"} confirmed`,
    assumptionsLabel:
      assumptionCount === 0 ? "None" : String(assumptionCount),
    constraintsLabel:
      opts?.constraintPreview?.trim() ||
      (opts?.constraintChipCount
        ? `${opts.constraintChipCount} applied`
        : "See Project Conditions"),
    outstandingLabel,
    estimateReadinessLabel:
      missing.length === 0 ? "Ready" : `${missing.length} outstanding`,
    hasOutstanding: missing.length > 0,
  };
}
