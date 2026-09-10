/**
 * Clarify / Details asks unresolved HARD_MINIMUM, ASK_NOW, and relevant
 * ASSUME_IF_SKIPPED facts in one grouped surface. Refine edits existing
 * answers and optional P2 / presentation detail.
 */

import type { ClarifyAskClass, ClarifyCandidate } from "@/lib/assistant/clarify/types";
import { deckFactQuestionClass } from "@/lib/estimate/deck-information-contract";
import { fenceFactQuestionClass } from "@/lib/estimate/fence-information-contract";
import { retainingWallFactQuestionClass } from "@/lib/estimate/retaining-wall-information-contract";
import { getEstimatePriorityClass } from "@/lib/scopes/estimate-priority";
import { getQuestionTemplateByKey } from "@/lib/scopes/registry";

export const BOOLEAN_INCLUDE_OPTIONS = ["Include", "Not included"] as const;
export const BOOLEAN_YES_NO_OPTIONS = ["Yes", "No"] as const;
export const BOOLEAN_YES_NO_NOT_SURE_OPTIONS = ["Yes", "No", "Not sure"] as const;

/**
 * Semantic control for Clarify / Refine. Template `inputType` is storage.
 * Do not infer MULTI_SELECT from `options` being an array.
 */
export type ClarifyControlType =
  | "SINGLE_SELECT"
  | "BOOLEAN"
  | "MULTI_SELECT"
  | "NUMBER"
  | "TEXT";

export function hasNotSureOption(options?: readonly string[]): boolean {
  return (options ?? []).some((option) => /^not sure$/i.test(option.trim()));
}

export function clarifyStoredInputType(params: {
  readonly inputType?: string | null;
  readonly options?: readonly string[];
}): ClarifyCandidate["inputType"] {
  const inputType = params.inputType;
  if (inputType === "multi_select") return "multi_select";
  if (inputType === "number") return "number";
  if (inputType === "text") return "text";
  if (inputType === "boolean") {
    if (hasNotSureOption(params.options)) return "select";
    return "boolean";
  }
  return "select";
}

export function clarifyControlType(candidate: {
  readonly inputType: ClarifyCandidate["inputType"];
  readonly options?: readonly string[];
  readonly question: string;
  readonly write?: unknown;
}): ClarifyControlType {
  if (candidate.inputType === "multi_select") return "MULTI_SELECT";
  if (candidate.inputType === "number") return "NUMBER";
  if (candidate.inputType === "text") return "TEXT";
  if (candidate.inputType === "boolean") {
    if (candidate.write) return "BOOLEAN";
    if (hasNotSureOption(candidate.options)) return "SINGLE_SELECT";
    return "BOOLEAN";
  }
  return "SINGLE_SELECT";
}

export function isIncludeQuestion(question: string): boolean {
  return /^include\b/i.test(question.trim());
}

export function isInitialCaptureAskClass(askClass: ClarifyAskClass): boolean {
  return askClass === "HARD_MINIMUM" || askClass === "ASK_NOW";
}

/**
 * Unresolved initial-capture questions block Ready. Details shows every
 * currently relevant Details-owned question; they are not assumed away.
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

/** Details owns unresolved HARD_MINIMUM, ASK_NOW, and ASSUME_IF_SKIPPED. */
export function isDetailsOwnedQuestion(candidate: ClarifyCandidate): boolean {
  if (candidate.askClass === "HARD_MINIMUM") return true;
  if (candidate.askClass === "ASK_NOW") return true;
  if (candidate.askClass === "ASSUME_IF_SKIPPED") return true;
  return false;
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
  if (isIncludeQuestion(candidate.question)) {
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
