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
import {
  planLevel1Questions,
  remainingLevel1QuestionBudget,
} from "@/lib/assistant/level1-question-plan";
import { filterEstimateBlockingProjectConditionKeys } from "@/lib/scopes/level1-blocking";

import {
  QUICK_ESTIMATE_PROJECT_CONDITIONS_BATCH_SIZE,
} from "@/lib/scopes/estimate-priority";

export const PROJECT_CONDITIONS_BATCH_SIZE = QUICK_ESTIMATE_PROJECT_CONDITIONS_BATCH_SIZE;

/** Deck Level 1 — ask when unknown; other open PC defer to assumptions when non-blocking. */
const LEVEL1_ASK_IF_UNKNOWN_PC_KEYS = new Set([
  "site_access",
  "material_carry_distance",
]);

function deckShouldDeferPcToAssumptions(
  input: BuilderInterviewInput,
  candidates: readonly InterviewCandidate[],
  estimateBlockingKeys: readonly string[]
): boolean {
  if (!isDeckOnlyLevel1QuickEstimate(input)) {
    return false;
  }
  if (estimateBlockingKeys.length > 0) {
    return false;
  }
  const mustAskIfOpen = candidates.filter((c) =>
    LEVEL1_ASK_IF_UNKNOWN_PC_KEYS.has(c.targetKey)
  );
  if (mustAskIfOpen.length > 0) {
    return false;
  }
  return candidates.length > 0;
}

/**
 * Live 3.2.2 surface: PROJECT scope ASK candidates only (unbatched).
 * WA candidates remain for 3.2.3.
 */
export function previewProjectConditionAskCandidates(
  input: BuilderInterviewInput
): InterviewCandidate[] {
  const engine = buildBuilderInterviewCandidates(input);
  const applicable = evaluateApplicableProjectConditions(input);
  const applicableKeys = new Set<string>(applicable.map((item) => item.key));
  return filterProjectSiteAskCandidates(engine).filter((c) =>
    applicableKeys.has(c.targetKey)
  );
}

/** Deck-only Level 1 Quick Estimate — other WAs retain prior PC blocking. */
export function isDeckOnlyLevel1QuickEstimate(
  input: BuilderInterviewInput
): boolean {
  const workAreas = input.workAreas.filter(
    (wa) => wa.status === "confirmed" || wa.status === "suggested"
  );
  return workAreas.length > 0 && workAreas.every((wa) => wa.type === "deck");
}

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
  input: BuilderInterviewInput,
  options?: { readonly scopeQuestionCount?: number }
): ProjectConditionsSnapshot {
  const engine = buildBuilderInterviewCandidates(input);
  const applicable = evaluateApplicableProjectConditions(input);
  const applicableKeys = new Set<string>(applicable.map((item) => item.key));
  const candidates = filterProjectSiteAskCandidates(engine).filter((c) =>
    applicableKeys.has(c.targetKey)
  );
  const unresolvedRequiredKeys = getUnresolvedRequiredProjectConditionKeys(input);
  const estimateBlockingKeys = isDeckOnlyLevel1QuickEstimate(input)
    ? filterEstimateBlockingProjectConditionKeys(unresolvedRequiredKeys)
    : unresolvedRequiredKeys;
  const requiredSet = new Set<string>(unresolvedRequiredKeys);
  const ranked = [...candidates].sort((a, b) => {
    const aReq = requiredSet.has(a.targetKey) ? 0 : 1;
    const bReq = requiredSet.has(b.targetKey) ? 0 : 1;
    return aReq - bReq;
  });
  const readiness = deriveInterviewReadiness({
    candidates,
    assumptionClassifications: engine.diagnostics.assumptionClassifications,
    unresolvedRequiredTargetKeys: estimateBlockingKeys,
  });
  const knownConstraintCount = input.constraints.filter((c) =>
    applicableKeys.has(c.key)
  ).length;
  const budget = remainingLevel1QuestionBudget(options?.scopeQuestionCount ?? 0);
  const plan = planLevel1Questions({
    scopeQuestions: [],
    pcCandidates: ranked,
    max: budget,
  });
  const deferPcToAssumptions = deckShouldDeferPcToAssumptions(
    input,
    candidates,
    estimateBlockingKeys
  );
  const batch = deferPcToAssumptions ? [] : plan.pcCandidates;
  const complete =
    estimateBlockingKeys.length === 0 &&
    (candidates.length === 0 || deferPcToAssumptions);
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
