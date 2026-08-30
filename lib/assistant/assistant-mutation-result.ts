/**
 * SYSTEM-PERFORMANCE-SPEED-1B-B — canonical fact-mutation response.
 *
 * project_facts (and sibling DB rows) remain authority. This DTO is a
 * projection of state already persisted by the existing mutation pipeline.
 * The client must not independently derive Facts SoT, readiness, or stale.
 * Does not include Estimate line items / money.
 */

import type {
  AssistantMutationResult,
  AssistantState,
} from "@/lib/assistant/types";

export type AppliedAssistantMutation = {
  projectId: string;
  requestSeq: number;
};

export function buildAssistantMutationResult(input: {
  projectId: string;
  state: AssistantState;
  estimateStale: boolean;
  hasEstimate: boolean;
}): AssistantMutationResult {
  const { state } = input;
  return {
    projectId: input.projectId,
    stage: state.project.stage,
    workAreas: state.workAreas,
    interviewFacts: state.interviewFacts,
    derivedFactDisplays: state.derivedFactDisplays,
    scopeReview: state.scopeReview,
    panelScopeSummaries: state.panelScopeSummaries,
    scopeSummary: state.scopeSummary,
    questionBlock: state.questionBlock,
    additionalQuestionBlocks: state.additionalQuestionBlocks,
    constraintQuestions: state.constraintQuestions,
    submittedConstraints: state.submittedConstraints,
    estimateStale: input.estimateStale,
    hasEstimate: input.hasEstimate,
  };
}

export function shouldApplyAssistantMutation(input: {
  currentProjectId: string;
  applied: AppliedAssistantMutation | null;
  incoming: AppliedAssistantMutation;
}): boolean {
  if (input.incoming.projectId !== input.currentProjectId) {
    return false;
  }
  if (!input.applied) {
    return true;
  }
  if (input.incoming.requestSeq < input.applied.requestSeq) {
    return false;
  }
  return true;
}
