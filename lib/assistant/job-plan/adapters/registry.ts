import { bathroomJobPlanAdapter } from "@/lib/assistant/job-plan/adapters/bathroom";
import { ceilingsJobPlanAdapter } from "@/lib/assistant/job-plan/adapters/ceilings";
import { doorsJobPlanAdapter } from "@/lib/assistant/job-plan/adapters/doors";
import { deckJobPlanAdapter } from "@/lib/assistant/job-plan/adapters/deck";
import { fenceJobPlanAdapter } from "@/lib/assistant/job-plan/adapters/fence";
import { genericJobPlanAdapter } from "@/lib/assistant/job-plan/adapters/generic";
import { internalWallsJobPlanAdapter } from "@/lib/assistant/job-plan/adapters/internal-walls";
import { paintingJobPlanAdapter } from "@/lib/assistant/job-plan/adapters/painting";
import { retainingWallJobPlanAdapter } from "@/lib/assistant/job-plan/adapters/retaining-wall";
import type { JobPlanWorkAreaAdapter } from "@/lib/assistant/job-plan/types";

const BY_TYPE = new Map<string, JobPlanWorkAreaAdapter>([
  [deckJobPlanAdapter.workAreaType, deckJobPlanAdapter],
  [bathroomJobPlanAdapter.workAreaType, bathroomJobPlanAdapter],
  [paintingJobPlanAdapter.workAreaType, paintingJobPlanAdapter],
  [retainingWallJobPlanAdapter.workAreaType, retainingWallJobPlanAdapter],
  [fenceJobPlanAdapter.workAreaType, fenceJobPlanAdapter],
  [internalWallsJobPlanAdapter.workAreaType, internalWallsJobPlanAdapter],
  [ceilingsJobPlanAdapter.workAreaType, ceilingsJobPlanAdapter],
  [doorsJobPlanAdapter.workAreaType, doorsJobPlanAdapter],
]);

export function getJobPlanAdapter(workAreaType: string): JobPlanWorkAreaAdapter {
  return BY_TYPE.get(workAreaType) ?? genericJobPlanAdapter(workAreaType);
}
