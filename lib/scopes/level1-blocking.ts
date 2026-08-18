import type { ScopeQuestionTemplate } from "@/lib/scopes/types";
import { getQuestionTemplateByKey } from "@/lib/scopes/registry";

/** Level 1 — whether a missing fact blocks Estimate now. */
export type Level1BlockingClass = "HARD_MINIMUM" | "ASSUMABLE" | "REFINEMENT";

const DECK_HARD_MINIMUM_KEYS = new Set([
  "deck.length_m",
  "deck.width_m",
  "deck.area_m2",
]);

const DECK_ASSUMABLE_KEYS = new Set([
  "deck.height_m",
  "deck.board_material",
  "deck.existing_deck_removal",
]);

/** Project Conditions that may be asked but do not block Level 1 when unresolved. */
export const LEVEL1_ASSUMABLE_PROJECT_CONDITION_KEYS = new Set<string>([
  "site_access",
  "material_carry_distance",
  "waste_bin_access",
  "site_slope",
  "occupied_site",
  "working_hours",
  "consent_engineering",
  "parking_loading",
]);

export function getLevel1BlockingClass(
  template: Pick<
    ScopeQuestionTemplate,
    "factKey" | "level1BlockingClass" | "estimatePriorityClass"
  >
): Level1BlockingClass {
  if (template.level1BlockingClass) {
    return template.level1BlockingClass;
  }
  if (DECK_HARD_MINIMUM_KEYS.has(template.factKey)) {
    return "HARD_MINIMUM";
  }
  if (DECK_ASSUMABLE_KEYS.has(template.factKey)) {
    return "ASSUMABLE";
  }
  if (template.estimatePriorityClass === "P0") {
    return "ASSUMABLE";
  }
  if (
    template.estimatePriorityClass === "P1" ||
    template.estimatePriorityClass === "P2"
  ) {
    return "REFINEMENT";
  }
  return "REFINEMENT";
}

export function isHardMinimumScopeQuestion(
  template: Pick<
    ScopeQuestionTemplate,
    "factKey" | "level1BlockingClass" | "estimatePriorityClass" | "required"
  >
): boolean {
  return getLevel1BlockingClass(template) === "HARD_MINIMUM";
}

export function blocksLevel1Estimate(
  template: Pick<
    ScopeQuestionTemplate,
    "factKey" | "level1BlockingClass" | "estimatePriorityClass" | "required"
  >
): boolean {
  return isHardMinimumScopeQuestion(template);
}

export function isAssumableProjectConditionKey(key: string): boolean {
  return LEVEL1_ASSUMABLE_PROJECT_CONDITION_KEYS.has(key);
}

export function filterEstimateBlockingProjectConditionKeys(
  keys: readonly string[]
): string[] {
  return keys.filter((key) => !isAssumableProjectConditionKey(key));
}

/** Whether a persisted scope question key blocks Level 1 submit / estimate. */
export function scopeQuestionKeyBlocksLevel1Estimate(
  questionKey: string
): boolean {
  const template = getQuestionTemplateByKey(questionKey);
  if (!template) {
    return true;
  }
  if (template.estimatePriorityClass == null) {
    return template.required;
  }
  return blocksLevel1Estimate(template);
}
