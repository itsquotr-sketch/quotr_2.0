import { bathroomJobPlanAdapter } from "@/lib/assistant/job-plan/adapters/bathroom";
import { deckJobPlanAdapter } from "@/lib/assistant/job-plan/adapters/deck";
import { genericJobPlanAdapter } from "@/lib/assistant/job-plan/adapters/generic";
import { paintingJobPlanAdapter } from "@/lib/assistant/job-plan/adapters/painting";
import type { JobPlanWorkAreaAdapter } from "@/lib/assistant/job-plan/types";

const BY_TYPE = new Map<string, JobPlanWorkAreaAdapter>([
  [deckJobPlanAdapter.workAreaType, deckJobPlanAdapter],
  [bathroomJobPlanAdapter.workAreaType, bathroomJobPlanAdapter],
  [paintingJobPlanAdapter.workAreaType, paintingJobPlanAdapter],
]);

export function getJobPlanAdapter(workAreaType: string): JobPlanWorkAreaAdapter {
  return BY_TYPE.get(workAreaType) ?? genericJobPlanAdapter(workAreaType);
}
