/**
 * Stage 3.1B.7A — Progressive disclosure helpers (presentation only).
 * Does not change completion, AI, Facts, or estimate authority.
 */

export type AssistantDisclosureStage =
  | "capture"
  | "workAreas"
  | "scopeReview"
  | "quality"
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
  if (!input.briefSubmitted) return "capture";
  if (!input.workAreasConfirmed) return "workAreas";
  if (input.scopeDiscoveryEnabled && !input.scopeReviewComplete) {
    return "scopeReview";
  }
  if (input.qualityUnlocked && !input.qualitySubmitted) return "quality";
  if (input.qualitySubmitted && !input.questionsSubmitted) return "questions";
  // After questions: site constraints are the actionable incomplete form.
  // DECK-2B: when ready to generate, Quick Estimate panel leads even if Scope Details remain open.
  if (input.questionsSubmitted && !input.constraintsSubmitted) {
    return "constraints";
  }
  // Stale estimate forces Estimate Review attention without relocking prior stages.
  if (input.estimateStale) return "estimateReview";
  // Ready to generate — no stage needs body space; Quick Estimate panel leads.
  if (input.constraintsSubmitted && !input.estimateReady) return null;
  return null;
}

export function stagePrefersExpanded(
  stage: Exclude<AssistantDisclosureStage, null>,
  active: AssistantDisclosureStage
): boolean {
  return active === stage;
}
