/**
 * Stage 3.2.1 — Public exports for the pure Builder Interview candidate engine.
 */

export { buildBuilderInterviewCandidates } from "@/lib/builder-interview/candidate-engine";
export {
  INTERVIEW_REGISTRY_VERSION,
  type BuilderInterviewInput,
  type BuilderInterviewResult,
  type InterviewCandidate,
  type InterviewReadiness,
  type InterviewReadinessState,
  type SuppressedCandidate,
  type EvidenceState,
  type AssumptionStatus,
  type AskPolicy,
  type PriorityClass,
  type SemanticTopicId,
} from "@/lib/builder-interview/types";
export {
  INTERVIEW_QUESTION_REGISTRY,
  getRegistryQuestion,
  listRegistryByAskPolicy,
} from "@/lib/builder-interview/registry";
export {
  factSourcePrecedence,
  FACT_SOURCE_PRECEDENCE,
  evaluateProposedUserAnswer,
  resolveTargetEvidence,
} from "@/lib/builder-interview/authority";
export { classifyAssumption, classifyAssumptions } from "@/lib/builder-interview/assumptions";
export { deriveInterviewReadiness } from "@/lib/builder-interview/readiness";
