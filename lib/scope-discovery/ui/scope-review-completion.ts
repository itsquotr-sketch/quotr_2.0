/**
 * Scope Review completion rules (3.1B.6R2).
 * Canonical result for Assistant stage gating.
 */

import type { SafeSuggestionView } from "../application/types";
import { assignUiGroup } from "./grouping";

export type ScopeReviewCompletion = {
  readonly complete: boolean;
  readonly hasRun: boolean;
  readonly importantOpen: number;
  readonly clarificationOpen: number;
  readonly optionalOpen: number;
  readonly reasons: readonly string[];
};

const TERMINAL_STATES = new Set([
  "ACCEPTED",
  "REJECTED",
  "MODIFIED",
]);

function isImportantForCompletion(s: SafeSuggestionView): boolean {
  if (s.proposalClass === "HIGH_LEVEL_WORK_AREA") return false;
  if (s.proposalClass === "WARNING") return false;
  const group = assignUiGroup(s);
  // Important + worth checking must be decided; low/other may stay open.
  return (
    group === "important" ||
    group === "worthChecking" ||
    group === "clarifications"
  );
}

function isOptionalOpen(s: SafeSuggestionView): boolean {
  if (s.decisionState !== "PROPOSED") return false;
  const group = assignUiGroup(s);
  return group === "other";
}

/**
 * Scope Review is complete when all important / high-priority scope items and
 * required clarifications have a saved decision. Low-confidence "other"
 * possibilities may remain undecided.
 */
export function evaluateScopeReviewCompletion(
  suggestions: readonly SafeSuggestionView[],
  options: { readonly hasRun: boolean; readonly batchPending?: boolean } = {
    hasRun: false,
  }
): ScopeReviewCompletion {
  const reasons: string[] = [];
  if (!options.hasRun) {
    return {
      complete: false,
      hasRun: false,
      importantOpen: 0,
      clarificationOpen: 0,
      optionalOpen: 0,
      reasons: ["Scope analysis has not completed yet."],
    };
  }
  if (options.batchPending) {
    return {
      complete: false,
      hasRun: true,
      importantOpen: 0,
      clarificationOpen: 0,
      optionalOpen: 0,
      reasons: ["Scope confirmation is still saving."],
    };
  }

  let importantOpen = 0;
  let clarificationOpen = 0;
  let optionalOpen = 0;

  for (const s of suggestions) {
    if (
      s.decisionState === "STALE" ||
      s.decisionState === "SUPERSEDED"
    ) {
      continue;
    }
    if (s.proposalClass === "HIGH_LEVEL_WORK_AREA") {
      // Individual WA lifecycle — does not block batch scope confirmation
      continue;
    }
    if (s.decisionState === "PROPOSED" && isImportantForCompletion(s)) {
      if (s.proposalClass === "CLARIFICATION" || assignUiGroup(s) === "clarifications") {
        clarificationOpen += 1;
      } else {
        importantOpen += 1;
      }
    } else if (isOptionalOpen(s)) {
      optionalOpen += 1;
    }
  }

  if (importantOpen > 0) {
    reasons.push(
      `${importantOpen} important scope item${importantOpen === 1 ? "" : "s"} still need confirmation.`
    );
  }
  if (clarificationOpen > 0) {
    reasons.push(
      `${clarificationOpen} clarification${clarificationOpen === 1 ? "" : "s"} still need a decision.`
    );
  }

  const complete = importantOpen === 0 && clarificationOpen === 0;
  if (complete && optionalOpen > 0) {
    reasons.push(
      `${optionalOpen} optional suggestion${optionalOpen === 1 ? "" : "s"} left undecided (allowed).`
    );
  }
  if (complete && suggestions.length === 0) {
    reasons.push("No scope items to confirm.");
  }

  return {
    complete,
    hasRun: true,
    importantOpen,
    clarificationOpen,
    optionalOpen,
    reasons,
  };
}

export function isScopeItemBatchEligible(
  s: Pick<SafeSuggestionView, "proposalClass" | "decisionState" | "suggestionKind">
): boolean {
  if (s.proposalClass === "HIGH_LEVEL_WORK_AREA") return false;
  if (s.proposalClass === "WARNING") return false;
  const kind = String(s.suggestionKind ?? "").toUpperCase();
  if (kind === "CONFLICT_WARNING" || kind === "DUPLICATE_WARNING") return false;
  return (
    s.proposalClass === "SCOPE_ITEM" ||
    s.proposalClass === "EXCLUSION" ||
    s.proposalClass === "CLARIFICATION" ||
    kind === "MISSING_SCOPE" ||
    kind === "DEPENDENCY" ||
    kind === "SUB_SCOPE" ||
    kind === "POSSIBLE_EXCLUSION" ||
    kind === "CLARIFICATION_REQUIRED"
  );
}

import {
  explicitScopeDecisionFromFacts,
  type ScopeSignalFactRef,
} from "@/lib/scope-discovery/scope-impact";

export function defaultBatchSelection(
  s: SafeSuggestionView,
  facts?: readonly ScopeSignalFactRef[]
): "INCLUDED" | "NOT_REQUIRED" {
  if (s.decisionState === "REJECTED") return "NOT_REQUIRED";
  if (s.decisionState === "ACCEPTED" || s.decisionState === "MODIFIED") {
    return "INCLUDED";
  }
  // Explicit Fact polarity seeds checklist defaults (unknown ≠ false).
  if (facts && facts.length > 0) {
    const fromFact = explicitScopeDecisionFromFacts({
      proposedWorkAreaType: s.proposedWorkAreaType,
      relatedWorkAreaId: s.relatedWorkAreaId,
      facts,
    });
    if (fromFact) return fromFact;
  }
  // Unsaved defaults: recommended on, low-confidence off
  const group = assignUiGroup(s);
  if (group === "other") return "NOT_REQUIRED";
  if (s.proposalClass === "CLARIFICATION") return "INCLUDED";
  return "INCLUDED";
}

export { TERMINAL_STATES };
