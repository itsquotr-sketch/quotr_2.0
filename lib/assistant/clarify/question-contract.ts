/**
 * Initial-capture vs Refine-only question contract.
 *
 * Clarify / Details asks unresolved INITIAL_REQUIRED facts in progressive
 * batches until they are resolved (or a disclosed ASSUME_IF_SKIPPED default
 * is already the architecture). Refine edits existing answers and optional
 * P2 / presentation detail. It is not the second half of initial capture.
 */

import type { ClarifyAskClass, ClarifyCandidate } from "@/lib/assistant/clarify/types";
import { deckFactQuestionClass } from "@/lib/estimate/deck-information-contract";
import { fenceFactQuestionClass } from "@/lib/estimate/fence-information-contract";
import { retainingWallFactQuestionClass } from "@/lib/estimate/retaining-wall-information-contract";
import { getEstimatePriorityClass } from "@/lib/scopes/estimate-priority";
import { getQuestionTemplateByKey } from "@/lib/scopes/registry";

export const BOOLEAN_INCLUDE_OPTIONS = ["Include", "Not included"] as const;
export const BOOLEAN_YES_NO_OPTIONS = ["Yes", "No"] as const;

export function isInitialCaptureAskClass(askClass: ClarifyAskClass): boolean {
  return askClass === "HARD_MINIMUM" || askClass === "ASK_NOW";
}

/**
 * Unresolved initial-capture questions block Ready. Progressive batches may
 * hide them from the current screen, but they are not assumed away.
 */
export function isInitialCaptureQuestion(candidate: ClarifyCandidate): boolean {
  if (candidate.blocksEstimate) return true;
  if (candidate.economicClass === "REQUIRED_FOR_ECONOMIC_MODEL") return true;
  if (isInitialCaptureAskClass(candidate.askClass)) return true;
  return false;
}

export function isRefineOnlyQuestion(candidate: ClarifyCandidate): boolean {
  return (
    candidate.askClass === "REFINEMENT" ||
    candidate.askClass === "ADVANCED" ||
    candidate.askClass === "DERIVED_NEVER_ASK"
  );
}

export function isDisclosedAssumptionQuestion(candidate: ClarifyCandidate): boolean {
  return (
    candidate.askClass === "ASSUME_IF_SKIPPED" &&
    candidate.assumable &&
    !candidate.blocksEstimate
  );
}

/** P2 / P3 extras belong in Refine, not initial Details. */
export function isClarifyExtraFactKey(factKey: string): boolean {
  const template = getQuestionTemplateByKey(factKey);
  const priority = template ? getEstimatePriorityClass(template) : null;
  if (priority === "P3") return false;
  const contract =
    deckFactQuestionClass(factKey) ??
    fenceFactQuestionClass(factKey) ??
    retainingWallFactQuestionClass(factKey);
  if (
    contract === "REFINE" ||
    contract === "DERIVED" ||
    contract === "NOT_CONSUMED"
  ) {
    return false;
  }
  return true;
}

export function booleanChoiceOptions(candidate: {
  readonly options?: readonly string[];
  readonly question: string;
}): readonly string[] {
  const opts = candidate.options ?? [];
  const hasYes = opts.some((option) => /^yes\b/i.test(option));
  const hasNo = opts.some((option) => /^no\b(?!t)/i.test(option));
  if (hasYes && hasNo) return BOOLEAN_YES_NO_OPTIONS;
  if (/^include\b/i.test(candidate.question.trim())) {
    return BOOLEAN_INCLUDE_OPTIONS;
  }
  return BOOLEAN_YES_NO_OPTIONS;
}

export function booleanChoiceToPresentation(
  picked: string
): "INCLUDED" | "NOT_INCLUDED" {
  if (picked === "Include" || picked === "Yes") return "INCLUDED";
  return "NOT_INCLUDED";
}

export function booleanPresentationToChoice(
  value: string | number | boolean | string[] | null | undefined,
  options: readonly string[]
): string | null {
  if (value == null || value === "") return null;
  const raw = Array.isArray(value) ? String(value[0] ?? "") : value;
  const included =
    raw === true ||
    raw === "INCLUDED" ||
    raw === "Yes" ||
    raw === "Include" ||
    raw === "true";
  const excluded =
    raw === false ||
    raw === "NOT_INCLUDED" ||
    raw === "No" ||
    raw === "Not included" ||
    raw === "false";
  const yesNo = options.includes("Yes");
  if (included) return yesNo ? "Yes" : "Include";
  if (excluded) return yesNo ? "No" : "Not included";
  if (typeof raw === "string" && options.includes(raw)) return raw;
  return null;
}
