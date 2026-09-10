import type { ScopeQuestionTemplate } from "@/lib/scopes/types";
import { getQuestionTemplateByKey } from "@/lib/scopes/registry";
import {
  deckFactQuestionClass,
  mapDeckQuestionClassToLevel1,
} from "@/lib/estimate/deck-information-contract";

/** Level 1 — whether a missing fact blocks Estimate now. */
export type Level1BlockingClass = "HARD_MINIMUM" | "ASSUMABLE" | "REFINEMENT";

const RETAINING_WALL_HARD_MINIMUM_KEYS = new Set([
  "retaining_wall.length_m",
  "retaining_wall.height_m",
  "retaining_wall.material",
]);

const FENCE_HARD_MINIMUM_KEYS = new Set([
  "fence.length_m",
  "fence.height_m",
  "fence.system",
  "fence.material",
]);

const BATHROOM_HARD_MINIMUM_KEYS = new Set([
  "bathroom.job_scope",
  "bathroom.length_m",
  "bathroom.width_m",
]);

const INTERNAL_WALLS_HARD_MINIMUM_KEYS = new Set([
  "internal_walls.job_scope",
  "internal_walls.wall_type.length_lm",
  "internal_walls.wall_type.frame_system",
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
  const deckClass = deckFactQuestionClass(template.factKey);
  if (deckClass) {
    return mapDeckQuestionClassToLevel1(deckClass);
  }
  if (template.level1BlockingClass) {
    return template.level1BlockingClass;
  }
  if (RETAINING_WALL_HARD_MINIMUM_KEYS.has(template.factKey)) {
    return "HARD_MINIMUM";
  }
  if (FENCE_HARD_MINIMUM_KEYS.has(template.factKey)) {
    return "HARD_MINIMUM";
  }
  if (BATHROOM_HARD_MINIMUM_KEYS.has(template.factKey)) {
    return "HARD_MINIMUM";
  }
  if (INTERNAL_WALLS_HARD_MINIMUM_KEYS.has(template.factKey)) {
    return "HARD_MINIMUM";
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
