/**
 * Stage 3.2.2 — Project-scope candidate filtering for live Assistant.
 * Pure helpers. Engine remains authority for eligibility.
 */

import { buildBuilderInterviewCandidates } from "@/lib/builder-interview/candidate-engine";
import type {
  BuilderInterviewInput,
  BuilderInterviewResult,
  InterviewCandidate,
  InterviewReadiness,
} from "@/lib/builder-interview/types";

export const PROJECT_CONDITIONS_BATCH_SIZE = 6;

export type ProjectConditionsSnapshot = {
  candidates: readonly InterviewCandidate[];
  remainingCount: number;
  readiness: InterviewReadiness;
  complete: boolean;
  /** Full engine result for diagnostics / tests */
  engine: BuilderInterviewResult;
};

/**
 * Live 3.2.2 surface: PROJECT scope ASK candidates only.
 * WA candidates remain for 3.2.3.
 */
export function filterProjectSiteAskCandidates(
  engine: BuilderInterviewResult
): InterviewCandidate[] {
  return engine.candidates.filter(
    (c) =>
      c.scope === "PROJECT" &&
      c.askPolicy === "ASK" &&
      c.writeTarget === "CONSTRAINT"
  );
}

export function buildProjectConditionsSnapshot(
  input: BuilderInterviewInput
): ProjectConditionsSnapshot {
  const engine = buildBuilderInterviewCandidates(input);
  const candidates = filterProjectSiteAskCandidates(engine);
  const batch = candidates.slice(0, PROJECT_CONDITIONS_BATCH_SIZE);
  return {
    candidates: batch,
    remainingCount: candidates.length,
    readiness: engine.readiness,
    complete: candidates.length === 0,
    engine,
  };
}

export function shouldPreferProjectConditionsAsk(params: {
  interviewUsable: boolean;
  remainingProjectAsks: number;
}): boolean {
  return params.interviewUsable;
}
