import type { ScopeQuestionTemplate } from "@/lib/scopes/types";

/** DECK-2B — Assisted Quick Estimate question priority (generalizable). */
export type EstimatePriorityClass = "P0" | "P1" | "P2" | "P3";

/** Normal pre-estimate high-value question budget (product target). */
export const MAX_QUICK_ESTIMATE_P0_QUESTIONS = 3;

/** Level 1 assumption disclosure cap (initial surface). */
export const MAX_QUICK_ESTIMATE_TOP_ASSUMPTIONS = 4;

/** Project Conditions ASK batch for Quick Estimate path. */
export const QUICK_ESTIMATE_PROJECT_CONDITIONS_BATCH_SIZE = 3;

export function getEstimatePriorityClass(
  template: Pick<ScopeQuestionTemplate, "estimatePriorityClass" | "factKey">
): EstimatePriorityClass | null {
  return template.estimatePriorityClass ?? null;
}

export function isNeverAskEstimateQuestion(
  template: Pick<ScopeQuestionTemplate, "estimatePriorityClass" | "factKey">
): boolean {
  return getEstimatePriorityClass(template) === "P3";
}

export function isQuickEstimateAskQuestion(
  template: Pick<ScopeQuestionTemplate, "estimatePriorityClass" | "factKey">
): boolean {
  const cls = getEstimatePriorityClass(template);
  if (cls == null) {
    return true;
  }
  return cls === "P0";
}

export function isDeferredEstimateDetailQuestion(
  template: Pick<ScopeQuestionTemplate, "estimatePriorityClass" | "factKey">
): boolean {
  const cls = getEstimatePriorityClass(template);
  return cls === "P1" || cls === "P2";
}

export function compareEstimatePriorityClass(
  a: EstimatePriorityClass,
  b: EstimatePriorityClass
): number {
  const order: Record<EstimatePriorityClass, number> = {
    P0: 0,
    P1: 1,
    P2: 2,
    P3: 3,
  };
  return order[a] - order[b];
}
