import type { AssistantStage } from "@/components/assistant/types";
import { isStageAtOrBeyond } from "@/lib/assistant/stage";

export type PlanningDisplayStage =
  | "brief"
  | "job_plan"
  | "clarify"
  | "estimate";

const CLARIFY_INTERNAL_STAGES: readonly AssistantStage[] = [
  "quality",
  "work_area_questions",
  "constraints",
  "ready_to_estimate",
];

export function isClarifyInternalStage(stage: AssistantStage): boolean {
  return CLARIFY_INTERNAL_STAGES.includes(stage);
}

export function toPlanningDisplayStage(
  stage: AssistantStage
): PlanningDisplayStage {
  if (stage === "brief") return "brief";
  if (stage === "confirm_work_areas") return "job_plan";
  if (stage === "estimate_ready") return "estimate";
  return "clarify";
}

/** Legacy saved projects at quality / Scope Details / constraints resume into Clarify. */
export function mapsLegacyStageToClarify(stage: AssistantStage): boolean {
  return isClarifyInternalStage(stage);
}

export function jobPlanAlreadyConfirmed(stage: AssistantStage): boolean {
  return isStageAtOrBeyond(stage, "quality");
}
