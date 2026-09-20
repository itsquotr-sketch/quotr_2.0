import type { EstimateFact } from "@/lib/estimate/types";
import {
  getBooleanFact,
  getNumberFact,
  getStringFact,
  hasFactValue,
  isNotSureValue,
} from "@/lib/estimate/facts";
import {
  applyInternalWallsFactWrite,
  INTERNAL_WALLS_WALL_TYPES_FACT_KEY,
  isInternalWallsWallTypeWriteKey,
  storedInternalWallsWallTypes,
} from "@/lib/estimate/internal-walls-wall-types";
import {
  applyCeilingsFactWrite,
  CEILINGS_PORTIONS_FACT_KEY,
  isCeilingsPortionWriteKey,
  storedCeilingsPortions,
} from "@/lib/estimate/ceilings-portions";
import {
  applyDoorsFactWrite,
  DOORS_PORTIONS_FACT_KEY,
  isDoorsPortionWriteKey,
  storedDoorsPortions,
} from "@/lib/estimate/doors-portions";
import { overlayFactSemanticKey } from "@/lib/assistant/question-identity";
import {
  CANONICAL_PROJECT_CONDITION_KEYS,
  isLocalWorkAreaAccessFactKey,
  isProjectConditionDuplicateFactKey,
} from "@/lib/project-conditions/canonical";

export const JOB_PLAN_PROJECT_CONDITION_KEYS: readonly string[] =
  CANONICAL_PROJECT_CONDITION_KEYS;

export function isJobPlanProjectConditionKey(key: string): boolean {
  return (CANONICAL_PROJECT_CONDITION_KEYS as readonly string[]).includes(key);
}

/** Never project these as Work Area scope — they are project logistics. */
export function isForbiddenJobPlanScopeKey(key: string): boolean {
  if (isLocalWorkAreaAccessFactKey(key)) return false;
  if (isJobPlanProjectConditionKey(key)) return true;
  if (isProjectConditionDuplicateFactKey(key)) return true;
  return false;
}

export function jobPlanBoolean(
  facts: readonly EstimateFact[],
  workAreaId: string,
  key: string
): boolean | null {
  return getBooleanFact(facts as EstimateFact[], workAreaId, key);
}

export function jobPlanNumber(
  facts: readonly EstimateFact[],
  workAreaId: string,
  key: string
): number | null {
  return getNumberFact(facts as EstimateFact[], workAreaId, key);
}

export function jobPlanString(
  facts: readonly EstimateFact[],
  workAreaId: string,
  key: string
): string | null {
  return getStringFact(facts as EstimateFact[], workAreaId, key);
}

export function presentationFromBoolean(
  value: boolean | null
): "INCLUDED" | "NOT_INCLUDED" | "NOT_CONFIRMED" {
  if (value === true) return "INCLUDED";
  if (value === false) return "NOT_INCLUDED";
  return "NOT_CONFIRMED";
}

export function isUnknownFactValue(value: unknown): boolean {
  return !hasFactValue(value) || isNotSureValue(value);
}

function queueLogicalNestedOverlay(
  facts: readonly EstimateFact[],
  next: EstimateFact
): EstimateFact[] {
  const nextIdentity = overlayFactSemanticKey(next);
  return [
    ...facts.filter((row) => overlayFactSemanticKey(row) !== nextIdentity),
    next,
  ];
}

export function overlayFact(
  facts: readonly EstimateFact[],
  next: EstimateFact
): EstimateFact[] {
  if (next.work_area_id && isInternalWallsWallTypeWriteKey(next.key)) {
    // Overlay queues are not the canonical collection. Reconstructing a
    // blank Wall Type here would replace the real nested snapshot on compose.
    if (
      next.key !== INTERNAL_WALLS_WALL_TYPES_FACT_KEY &&
      storedInternalWallsWallTypes(facts, next.work_area_id).length === 0
    ) {
      return queueLogicalNestedOverlay(facts, next);
    }
    return applyInternalWallsFactWrite({
      facts: facts as EstimateFact[],
      workAreaId: next.work_area_id,
      key: next.key,
      value: next.value,
      wallTypeId: next.wallTypeId ?? next.nestedItemId,
      openingId: next.openingId ?? next.componentId,
    });
  }
  if (next.work_area_id && isCeilingsPortionWriteKey(next.key)) {
    if (
      next.key !== CEILINGS_PORTIONS_FACT_KEY &&
      storedCeilingsPortions(facts, next.work_area_id).length === 0
    ) {
      return queueLogicalNestedOverlay(facts, next);
    }
    return applyCeilingsFactWrite({
      facts: facts as EstimateFact[],
      workAreaId: next.work_area_id,
      key: next.key,
      value: next.value,
      nestedItemId: next.nestedItemId ?? next.wallTypeId,
      componentId: next.componentId ?? next.openingId,
    });
  }
  if (next.work_area_id && isDoorsPortionWriteKey(next.key)) {
    if (
      next.key !== DOORS_PORTIONS_FACT_KEY &&
      storedDoorsPortions(facts, next.work_area_id).length === 0
    ) {
      return queueLogicalNestedOverlay(facts, next);
    }
    return applyDoorsFactWrite({
      facts: facts as EstimateFact[],
      workAreaId: next.work_area_id,
      key: next.key,
      value: next.value,
      nestedItemId: next.nestedItemId ?? next.wallTypeId,
    });
  }
  const without = facts.filter(
    (row) =>
      !(row.key === next.key && row.work_area_id === next.work_area_id)
  );
  return [...without, next];
}

/**
 * Queue a Refine/Clarify overlay row.
 * Internal Walls and Ceilings store the logical write; jobPlanFacts applies
 * it onto latest base facts so a boolean save cannot replace the collection.
 */
export function appendJobPlanFactOverlay(
  overlay: readonly EstimateFact[],
  next: EstimateFact
): EstimateFact[] {
  if (
    next.work_area_id &&
    (isInternalWallsWallTypeWriteKey(next.key) ||
      isCeilingsPortionWriteKey(next.key) ||
      isDoorsPortionWriteKey(next.key))
  ) {
    const nextIdentity = overlayFactSemanticKey(next);
    return [
      ...overlay.filter(
        (row) => overlayFactSemanticKey(row) !== nextIdentity
      ),
      next,
    ];
  }
  return overlayFact(overlay, next);
}
