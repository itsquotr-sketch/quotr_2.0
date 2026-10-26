/**
 * One settled Details readiness result.
 * Required answers and optional refinements are separate counts.
 * A pending save of a complete screen is Saving, then Ready, without a refresh.
 */

import { detailsReadinessPhase, detailsStageStatusLabel } from "@/lib/assistant/readiness/details-status";
import {
  deckDetailPanelPrompt,
  deckDetailQueuePrompt,
  type DeckDetailGap,
} from "@/lib/estimate/deck-detail-completeness";

export type DetailsJourney = {
  readonly phase: "saving" | "ready" | "needs_details";
  readonly requiredRemaining: number;
  readonly optionalRemaining: number;
  readonly statusLabel: string;
  readonly remainingCopy: string | null;
  readonly actionLabel: string | null;
  readonly accessibleText: string;
  readonly showCreateEstimate: boolean;
};

export function settleDetailsJourney(input: {
  readonly workConfirmed: boolean;
  readonly pendingWrites: number;
  readonly requiredClarifyCount: number;
  readonly postHoleCount: number;
  readonly postHoleGaps?: readonly DeckDetailGap[];
  readonly optionalRefineCount: number;
}): DetailsJourney {
  const requiredClarify = Math.max(0, input.requiredClarifyCount);
  const postHoles = Math.max(0, input.postHoleCount);
  const optionalRemaining = Math.max(0, input.optionalRefineCount);
  const requiredRemaining = input.workConfirmed ? requiredClarify + postHoles : requiredClarify;
  const screenComplete = input.workConfirmed && requiredRemaining === 0;
  const phase = detailsReadinessPhase({
    pendingWrites: screenComplete ? input.pendingWrites : 0,
    enoughToEstimate: screenComplete,
  });
  const statusLabel = input.workConfirmed
    ? detailsStageStatusLabel(phase, requiredRemaining)
    : "Not set";
  const remainingCopy =
    phase === "needs_details" && requiredRemaining > 0
      ? requiredRemaining === 1
        ? "1 important detail remaining"
        : `${requiredRemaining} important details remaining`
      : null;
  const actionLabel =
    phase === "needs_details" && postHoles > 0 && requiredRemaining === postHoles
      ? input.postHoleGaps
        ? deckDetailQueuePrompt(input.postHoleGaps)
        : deckDetailPanelPrompt(postHoles)
      : phase === "needs_details" && requiredRemaining > 0
        ? requiredRemaining === 1
          ? "Finish 1 detail"
          : `Finish ${requiredRemaining} details`
        : null;
  const optionalNote =
    optionalRemaining > 0 && phase === "ready"
      ? optionalRemaining === 1
        ? "1 optional refinement can wait."
        : `${optionalRemaining} optional refinements can wait.`
      : null;
  const accessibleText = [statusLabel, remainingCopy, actionLabel, optionalNote]
    .filter(Boolean)
    .join(". ");
  return {
    phase,
    requiredRemaining,
    optionalRemaining,
    statusLabel,
    remainingCopy,
    actionLabel,
    accessibleText,
    showCreateEstimate: phase === "ready" || phase === "saving",
  };
}
