import type { ClarifyAskClass, ClarifyCandidate } from "@/lib/assistant/clarify/types";
import {
  CLARIFY_MULTI_WA_BUDGET,
  CLARIFY_SINGLE_WA_BUDGET,
} from "@/lib/assistant/clarify/flags";

function askRank(askClass: ClarifyAskClass): number {
  switch (askClass) {
    case "HARD_MINIMUM":
      return 0;
    case "ASK_NOW":
      return 1;
    case "ASSUME_IF_SKIPPED":
      return 2;
    case "REFINEMENT":
      return 3;
    case "ADVANCED":
      return 4;
    case "DERIVED_NEVER_ASK":
      return 5;
    default:
      return 9;
  }
}

export function sortClarifyCandidates(
  candidates: readonly ClarifyCandidate[]
): ClarifyCandidate[] {
  return [...candidates].sort((a, b) => {
    const cls = askRank(a.askClass) - askRank(b.askClass);
    if (cls !== 0) return cls;
    if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
    const wa = (a.workAreaName ?? "").localeCompare(b.workAreaName ?? "");
    if (wa !== 0) return wa;
    return a.questionKey.localeCompare(b.questionKey);
  });
}

/** Soft UX target. Not a hard ceiling. */
export function clarifyQuestionBudget(confirmedWorkAreaCount: number): number {
  if (confirmedWorkAreaCount <= 1) return CLARIFY_SINGLE_WA_BUDGET;
  return CLARIFY_MULTI_WA_BUDGET;
}

/**
 * Blocking / commercially necessary questions are never dropped solely
 * because the soft interaction budget is exhausted.
 */
export function isClarifyMustAsk(candidate: ClarifyCandidate): boolean {
  return (
    candidate.askClass === "HARD_MINIMUM" ||
    candidate.blocksEstimate ||
    !candidate.assumable
  );
}

function isAssumableInitialAsk(candidate: ClarifyCandidate): boolean {
  return (
    candidate.askClass === "ASK_NOW" &&
    candidate.assumable &&
    !candidate.blocksEstimate
  );
}

/**
 * Allocate the initial Clarify interview.
 *
 * Soft budget is a UX target, not a quota to fill or a correctness ceiling.
 * Stop when remaining candidates are assumable/refinement/advanced beyond
 * the useful ASK_NOW set, or when the soft target is reached for assumable
 * questions. HARD_MINIMUM and non-assumable questions always survive.
 */
export function allocateClarifyBudget(
  ranked: readonly ClarifyCandidate[],
  confirmedWorkAreaCount: number
): {
  readonly visible: readonly ClarifyCandidate[];
  readonly deferred: readonly ClarifyCandidate[];
} {
  const softBudget = clarifyQuestionBudget(confirmedWorkAreaCount);
  const mustAsk = ranked.filter(isClarifyMustAsk);
  const askNow = ranked.filter(isAssumableInitialAsk);
  const remainingSoft = Math.max(0, softBudget - mustAsk.length);
  const visibleAskNow = askNow.slice(0, remainingSoft);
  const visible = [...mustAsk, ...visibleAskNow];
  const visibleIds = new Set(visible.map((c) => c.id));
  const deferred = ranked.filter((c) => !visibleIds.has(c.id));
  return { visible, deferred };
}
