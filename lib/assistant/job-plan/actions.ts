"use server";

import { updateProjectFact } from "@/lib/assistant/fact-actions";
import type { AssistantActionState } from "@/lib/assistant/types";
import type { JobPlanScopePresentation, JobPlanScopeWrite } from "@/lib/assistant/job-plan/types";

/**
 * Canonical Job Plan scope write. Delegates to Fact SoT.
 * NOT_CONFIRMED is a no-op — absence must not persist as exclusion.
 */
export async function writeJobPlanScopeDecision(input: {
  projectId: string;
  workAreaId: string;
  write: JobPlanScopeWrite;
  presentation: JobPlanScopePresentation;
}): Promise<AssistantActionState> {
  if (input.presentation === "NOT_CONFIRMED") {
    return { success: true };
  }

  const value =
    input.presentation === "INCLUDED"
      ? input.write.includeValue
      : input.write.excludeValue;

  return updateProjectFact({
    projectId: input.projectId,
    workAreaId: input.workAreaId,
    key: input.write.factKey,
    label: input.write.label,
    value,
    valueType: input.write.valueType === "boolean" ? "boolean" : "select",
  });
}
