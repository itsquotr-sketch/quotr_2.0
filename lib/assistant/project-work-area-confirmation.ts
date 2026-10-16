import type { WorkArea } from "@/components/assistant/types";
import type {
  AssistantMutationResult,
  AssistantState,
  WorkAreaSelection,
} from "@/lib/assistant/types";

/**
 * Client projection after Work Area confirmation has been committed.
 * Copies the current assistant read and only advances stage plus the
 * statuses just saved. It does not invent estimate or pricing figures.
 */
export function projectWorkAreaConfirmation(
  state: AssistantState,
  selections: readonly WorkAreaSelection[]
): AssistantMutationResult {
  const statusById = new Map(selections.map((selection) => [selection.work_area_id, selection.status]));
  const workAreas: WorkArea[] = state.workAreas.map((area) => {
    const status = statusById.get(area.id);
    return status ? { ...area, status } : area;
  });

  return {
    projectId: state.project.id,
    stage: "quality",
    workAreas,
    interviewFacts: state.interviewFacts,
    derivedFactDisplays: state.derivedFactDisplays,
    scopeReview: state.scopeReview,
    panelScopeSummaries: state.panelScopeSummaries,
    scopeSummary: state.scopeSummary,
    questionBlock: state.questionBlock,
    additionalQuestionBlocks: state.additionalQuestionBlocks,
    constraintQuestions: state.constraintQuestions,
    submittedConstraints: state.submittedConstraints,
    estimateStale: Boolean(state.estimate),
    hasEstimate: Boolean(state.estimate),
  };
}
