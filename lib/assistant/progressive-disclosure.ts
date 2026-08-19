/**
 * Stage 3.1B.7A — Progressive disclosure helpers (presentation only).
 * Does not change completion, AI, Facts, or estimate authority.
 */

import { JOB_PLAN_IS_PRIMARY } from "@/lib/assistant/job-plan/flags";

export type AssistantDisclosureStage =
  | "capture"
  | "workAreas"
  | "scopeReview"
  | "quality"
  | "clarify"
  | "questions"
  | "estimateReview"
  | "constraints"
  | null;

export type DisclosureProgressInput = {
  readonly briefSubmitted: boolean;
  readonly workAreasConfirmed: boolean;
  readonly scopeDiscoveryEnabled: boolean;
  readonly scopeReviewComplete: boolean;
  readonly qualityUnlocked: boolean;
  readonly qualitySubmitted: boolean;
  readonly questionsSubmitted: boolean;
  readonly constraintsSubmitted: boolean;
  readonly estimateReady: boolean;
  readonly estimateStale?: boolean;
};

/**
 * First incomplete major stage — only this card prefers expanded by default.
 * Manual reopen of other cards is allowed and does not change this result.
 */
export function resolveActiveDisclosureStage(
  input: DisclosureProgressInput
): AssistantDisclosureStage {
  // RECOVERY-5A: once an estimate exists (current or stale), Estimate Ready
  // leads. Stale does not rewind into the planning interview.
  if (input.estimateReady) {
    return null;
  }
  if (!input.briefSubmitted) return "capture";
  if (!input.workAreasConfirmed) return "workAreas";
  if (
    input.scopeDiscoveryEnabled &&
    !input.scopeReviewComplete &&
    !JOB_PLAN_IS_PRIMARY
  ) {
    return "scopeReview";
  }
  // RECOVERY-4: quality / Scope Details / constraints compose into Clarify.
  if (!input.estimateReady) {
    if (input.constraintsSubmitted) return null;
    return "clarify";
  }
  // Stale estimate forces Estimate Review attention without relocking prior stages.
  if (input.estimateStale) return "estimateReview";
  return null;
}

export function stagePrefersExpanded(
  stage: Exclude<AssistantDisclosureStage, null>,
  active: AssistantDisclosureStage
): boolean {
  return active === stage;
}
