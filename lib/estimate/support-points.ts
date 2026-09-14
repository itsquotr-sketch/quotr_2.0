/**
 * Support points between inset edge offsets.
 *
 * First and last lines sit `edgeOffset` in from each wall. Remaining span is
 * divided by maxSpacing. Not the same as wall-to-wall runCountFromSpacing.
 *
 * Small room (dimension <= 2 × edgeOffset): one central support line.
 * Negative span is never returned.
 */

import { RUN_COUNT_SPACING_EPSILON } from "@/lib/estimate/run-count";

export type SupportPointsGrid = {
  readonly ok: true;
  readonly supportSpan: number;
  readonly intervalCount: number;
  readonly pointCount: number;
  readonly actualSpacing: number | null;
  readonly mode: "grid" | "single_central";
};

export type SupportPointsFailure = {
  readonly ok: false;
  readonly reason: "invalid" | "information_required";
  readonly message: string;
};

export type SupportPointsResult = SupportPointsGrid | SupportPointsFailure;

export function supportPointsBetweenEdgeOffsets(
  dimension: number,
  edgeOffset: number,
  maxSpacing: number,
  epsilon: number = RUN_COUNT_SPACING_EPSILON
): SupportPointsResult {
  if (!Number.isFinite(dimension) || dimension <= 0) {
    return {
      ok: false,
      reason: "invalid",
      message: "Support-grid dimension must be a positive finite length.",
    };
  }
  if (!Number.isFinite(edgeOffset) || edgeOffset < 0) {
    return {
      ok: false,
      reason: "invalid",
      message: "Edge offset must be a finite value of zero or more.",
    };
  }
  if (!Number.isFinite(maxSpacing) || maxSpacing <= 0) {
    return {
      ok: false,
      reason: "invalid",
      message: "Maximum support spacing must be a positive finite length.",
    };
  }

  if (dimension <= 2 * edgeOffset) {
    return {
      ok: true,
      supportSpan: 0,
      intervalCount: 0,
      pointCount: 1,
      actualSpacing: null,
      mode: "single_central",
    };
  }

  const supportSpan = dimension - 2 * edgeOffset;
  const intervalCount = Math.ceil(supportSpan / maxSpacing - epsilon);
  if (intervalCount < 1) {
    return {
      ok: false,
      reason: "information_required",
      message: "Support grid could not be resolved from the given spacing.",
    };
  }
  return {
    ok: true,
    supportSpan,
    intervalCount,
    pointCount: intervalCount + 1,
    actualSpacing: supportSpan / intervalCount,
    mode: "grid",
  };
}
