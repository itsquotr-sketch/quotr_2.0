import type { AssistantStage } from "@/components/assistant/types";

const STAGE_ORDER: AssistantStage[] = [
  "brief",
  "confirm_work_areas",
  "quality",
  "work_area_questions",
  "constraints",
  "ready_to_estimate",
  "estimate_ready",
];

export function stageIndex(stage: AssistantStage): number {
  return STAGE_ORDER.indexOf(stage);
}

export function isStageAtOrBeyond(
  current: AssistantStage,
  target: AssistantStage
): boolean {
  return stageIndex(current) >= stageIndex(target);
}

export function assertStage(
  current: AssistantStage,
  expected: AssistantStage | AssistantStage[]
): boolean {
  const expectedStages = Array.isArray(expected) ? expected : [expected];
  return expectedStages.includes(current);
}

export function canRunStageAction(
  current: AssistantStage,
  action:
    | "save_brief"
    | "confirm_work_areas"
    | "save_quality"
    | "save_question_answers"
    | "save_constraints"
    | "generate_estimate"
): boolean {
  switch (action) {
    case "save_brief":
      return current === "brief";
    case "confirm_work_areas":
      return current === "confirm_work_areas";
    case "save_quality":
      return current === "quality";
    case "save_question_answers":
      return current === "work_area_questions";
    case "save_constraints":
      return current === "constraints";
    case "generate_estimate":
      return current === "ready_to_estimate";
    default:
      return false;
  }
}
