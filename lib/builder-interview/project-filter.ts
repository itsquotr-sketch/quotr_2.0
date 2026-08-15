/**
 * Stage 3.2.2 — Project-scope candidate filtering for live Assistant.
 * Pure helpers. Engine remains authority for eligibility.
 * FOUNDATION-R1-R1: applicability filter + required-key readiness.
 */

import { buildBuilderInterviewCandidates } from "@/lib/builder-interview/candidate-engine";
import { deriveInterviewReadiness } from "@/lib/builder-interview/readiness";
import type {
  BuilderInterviewInput,
  BuilderInterviewResult,
  InterviewCandidate,
  InterviewReadiness,
} from "@/lib/builder-interview/types";
import {
  evaluateApplicableProjectConditions,
  getUnresolvedRequiredProjectConditionKeys,
} from "@/lib/project-conditions/applicability";

export const PROJECT_CONDITIONS_BATCH_SIZE = 6;

export type ProjectConditionsSnapshot = {
  candidates: readonly InterviewCandidate[];
  remainingCount: number;
  readiness: InterviewReadiness;
  complete: boolean;
  /** True when the Project Conditions stage should render. */
  shouldShowStage: boolean;
  unresolvedRequiredKeys: readonly string[];
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
  const applicable = evaluateApplicableProjectConditions(input);
  const applicableKeys = new Set<string>(applicable.map((item) => item.key));
  const candidates = filterProjectSiteAskCandidates(engine).filter((c) =>
    applicableKeys.has(c.targetKey)
  );
  const unresolvedRequiredKeys = getUnresolvedRequiredProjectConditionKeys(input);
  const requiredSet = new Set<string>(unresolvedRequiredKeys);
  const ranked = [...candidates].sort((a, b) => {
    const aReq = requiredSet.has(a.targetKey) ? 0 : 1;
    const bReq = requiredSet.has(b.targetKey) ? 0 : 1;
    return aReq - bReq;
  });
  const readiness = deriveInterviewReadiness({
    candidates,
    assumptionClassifications: engine.diagnostics.assumptionClassifications,
    unresolvedRequiredTargetKeys: unresolvedRequiredKeys,
  });
  const knownConstraintCount = input.constraints.filter((c) =>
    applicableKeys.has(c.key)
  ).length;
  const batch = ranked.slice(0, PROJECT_CONDITIONS_BATCH_SIZE);
  const complete =
    candidates.length === 0 && unresolvedRequiredKeys.length === 0;
  return {
    candidates: batch,
    remainingCount: candidates.length,
    readiness,
    complete,
    shouldShowStage:
      candidates.length > 0 ||
      knownConstraintCount > 0 ||
      applicable.length > 0,
    unresolvedRequiredKeys,
    engine,
  };
}

export function shouldPreferProjectConditionsAsk(params: {
  interviewUsable: boolean;
  remainingProjectAsks: number;
}): boolean {
  return params.interviewUsable;
}
