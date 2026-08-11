/**
 * Stage 3.2.1 — Quick Estimate readiness derivation (read-model only).
 *
 * Does not replace setup / pricing / quote readiness.
 */

import type {
  ClassifiedAssumption,
  InterviewCandidate,
  InterviewReadiness,
  InterviewReadinessState,
} from "@/lib/builder-interview/types";
import { isCurrentAssumption } from "@/lib/builder-interview/assumptions";

export function deriveInterviewReadiness(params: {
  candidates: readonly InterviewCandidate[];
  assumptionClassifications: readonly ClassifiedAssumption[];
}): InterviewReadiness {
  const askCandidates = params.candidates.filter((c) => c.askPolicy === "ASK");

  const openP0 = askCandidates.filter(
    (c) =>
      c.priority === "P0" &&
      c.evidenceState !== "ASSUMED" &&
      c.answerability !== "NOT_APPLICABLE"
  );
  // Expert-unknowable P0 still blocks soft readiness unless assumed — D5/answerability:
  // they remain NEEDS_IMPORTANT_INFORMATION but are flagged in reasons.
  const openP0Answerable = openP0.filter((c) => c.answerability === "ON_SITE" || c.answerability === "REQUIRES_MEASUREMENT");
  const openP0Expert = openP0.filter((c) => c.answerability === "REQUIRES_EXPERT");

  const openP1 = askCandidates.filter((c) => c.priority === "P1");

  const currentAssumptions = params.assumptionClassifications.filter((a) =>
    isCurrentAssumption(a.status)
  );

  const blockingCandidateKeys = openP0.map((c) => c.questionKey);
  const assumptionCandidateKeys = currentAssumptions.map((a) => a.questionKey);

  const reasons: string[] = [];
  let state: InterviewReadinessState;

  if (blockingCandidateKeys.length > 0) {
    state = "NEEDS_IMPORTANT_INFORMATION";
    reasons.push(
      `Unresolved P0 ASK candidates: ${blockingCandidateKeys.join(", ")}`
    );
    if (openP0Expert.length > 0) {
      reasons.push(
        `Includes requires-expert P0 (not treated as ordinary on-site ask): ${openP0Expert
          .map((c) => c.questionKey)
          .join(", ")}`
      );
    }
    if (openP0Answerable.length > 0) {
      reasons.push(
        `On-site/measurement P0 open: ${openP0Answerable
          .map((c) => c.questionKey)
          .join(", ")}`
      );
    }
  } else if (currentAssumptions.length > 0) {
    state = "READY_WITH_ASSUMPTIONS";
    reasons.push(
      `Active assumptions supporting estimate: ${assumptionCandidateKeys.join(", ")}`
    );
  } else {
    state = "READY";
    reasons.push("No unresolved P0 ASK candidates; no active interview assumptions");
  }

  if (openP1.length > 0 && state !== "NEEDS_IMPORTANT_INFORMATION") {
    reasons.push(
      `Open P1 (non-blocking): ${openP1.map((c) => c.questionKey).join(", ")}`
    );
  }

  const softBlockQuickEstimate = state === "NEEDS_IMPORTANT_INFORMATION";
  // Soft-block model: generate may still be allowed with warning in later UI (D3).
  // Engine exposes both flags; does not hard-lock Pricing/Quote.
  const canGenerateQuickEstimate = !softBlockQuickEstimate;

  return {
    state,
    reasons,
    blockingCandidateKeys,
    assumptionCandidateKeys,
    openP0Keys: blockingCandidateKeys,
    openP1Keys: openP1.map((c) => c.questionKey),
    canGenerateQuickEstimate,
    softBlockQuickEstimate,
  };
}
