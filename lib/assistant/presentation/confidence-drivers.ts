/**
 * Stage 3.1B.7C — Qualitative confidence drivers (presentation only).
 * Does not change computeConfidence or invent weighted contributions.
 */

export type ConfidenceDriverLists = {
  readonly complete: readonly string[];
  readonly outstanding: readonly string[];
};

/**
 * Build qualitative drivers from existing project/estimate signals.
 * Confidence % itself must come from the estimate record unchanged.
 */
export function buildQualitativeConfidenceDrivers(params: {
  readonly measurementsConfirmed: boolean;
  readonly scopeConfirmed: boolean;
  readonly specificationSelected: boolean;
  readonly siteConstraintsCaptured: boolean;
  readonly outstandingLabels: readonly string[];
}): ConfidenceDriverLists {
  const complete: string[] = [];
  if (params.measurementsConfirmed) complete.push("Measurements confirmed");
  if (params.scopeConfirmed) complete.push("Scope confirmed");
  if (params.specificationSelected) complete.push("Specification selected");
  if (params.siteConstraintsCaptured) complete.push("Project conditions captured");

  const outstanding = params.outstandingLabels
    .map((label) => label.trim())
    .filter(Boolean)
    .slice(0, 6);

  return { complete, outstanding };
}
