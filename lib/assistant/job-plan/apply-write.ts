import type { EstimateFact } from "@/lib/estimate/types";
import type { JobPlanScopePresentation, JobPlanScopeWrite } from "@/lib/assistant/job-plan/types";
import { overlayFact } from "@/lib/assistant/job-plan/facts";

/**
 * Pure stand-in for the canonical Fact write Job Plan uses.
 * NOT_CONFIRMED must not fabricate an exclusion.
 */
export function applyJobPlanScopeWrite(params: {
  readonly facts: readonly EstimateFact[];
  readonly workAreaId: string;
  readonly write: JobPlanScopeWrite;
  readonly presentation: JobPlanScopePresentation;
}): readonly EstimateFact[] {
  if (params.presentation === "NOT_CONFIRMED") {
    return params.facts;
  }
  const value =
    params.presentation === "INCLUDED"
      ? params.write.includeValue
      : params.write.excludeValue;
  return overlayFact(params.facts, {
    key: params.write.factKey,
    work_area_id: params.workAreaId,
    value,
    source: "user",
  });
}
