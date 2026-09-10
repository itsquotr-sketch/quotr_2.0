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
  isInternalWallsWallTypeWriteKey,
} from "@/lib/estimate/internal-walls-wall-types";
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

export function overlayFact(
  facts: readonly EstimateFact[],
  next: EstimateFact
): EstimateFact[] {
  if (next.work_area_id && isInternalWallsWallTypeWriteKey(next.key)) {
    return applyInternalWallsFactWrite({
      facts: facts as EstimateFact[],
      workAreaId: next.work_area_id,
      key: next.key,
      value: next.value,
      wallTypeId: next.wallTypeId,
      openingId: next.openingId,
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
 * Internal Walls stores the logical write; jobPlanFacts applies it onto
 * latest base facts so a lining save cannot replace the whole collection.
 */
export function appendJobPlanFactOverlay(
  overlay: readonly EstimateFact[],
  next: EstimateFact
): EstimateFact[] {
  if (next.work_area_id && isInternalWallsWallTypeWriteKey(next.key)) {
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
