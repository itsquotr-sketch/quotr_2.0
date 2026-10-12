/**
 * One readiness decision for the Details stage and the Estimate status.
 * A pending save is Saving. Ready is only the settled enough-to-estimate state.
 */

export type DetailsReadinessPhase = "saving" | "ready" | "needs_details";

export function detailsReadinessPhase(input: {
  readonly pendingWrites: number;
  readonly enoughToEstimate: boolean;
}): DetailsReadinessPhase {
  if (input.pendingWrites > 0) return "saving";
  if (input.enoughToEstimate) return "ready";
  return "needs_details";
}

export function detailsStageStatusLabel(
  phase: DetailsReadinessPhase,
  openCount: number
): string {
  if (phase === "saving") return "Saving";
  if (phase === "ready") return "Ready";
  if (openCount === 1) return "1 to clarify";
  if (openCount > 1) return `${openCount} to clarify`;
  return "Need details";
}

export function detailsStageSubtitle(phase: DetailsReadinessPhase): string {
  if (phase === "saving") return "Saving";
  if (phase === "ready") return "That's enough to build your estimate.";
  return "I need a few details to tighten the estimate.";
}

export function estimateStatusCopy(
  phase: DetailsReadinessPhase,
  blocker: string | null
): {
  readonly description: string;
  readonly emptyTitle: string;
  readonly emptyNext: string | null;
  readonly statusLabel: string;
} {
  if (phase === "saving") {
    return {
      description: "Saving",
      emptyTitle: "Saving",
      emptyNext: null,
      statusLabel: "Saving",
    };
  }
  if (phase === "ready") {
    return {
      description: "Ready to generate your draft estimate",
      emptyTitle: "Ready to generate your draft estimate",
      emptyNext: null,
      statusLabel: "Ready",
    };
  }
  const detail = blocker?.trim() || "Finish the open details before estimating.";
  return {
    description: detail,
    emptyTitle: "Finish the open details before estimating.",
    emptyNext: detail,
    statusLabel: "Need details",
  };
}
