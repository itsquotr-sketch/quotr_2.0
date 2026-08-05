/**
 * Stage 3.1B.1 — Scope discovery suggestion contract.
 *
 * Pure, deterministic, unused by production paths in this batch.
 * No React, Supabase, providers, persistence, or commercial formulas.
 */

export {
  SCOPE_DISCOVERY_CONTRACT_VERSION,
} from "./version";

export {
  SCOPE_DISCOVERY_ERROR_CODES,
  type ScopeDiscoveryErrorCode,
} from "./codes";

export type {
  ClarificationNeed,
  ConfidenceBand,
  DuplicateClass,
  EvidenceItem,
  EvidenceProvenance,
  EvidenceRelevance,
  EvidenceSourceType,
  MaterialSourceKey,
  MergeConflict,
  MergeInput,
  MergeResult,
  MergeWarning,
  PriorProposalRecord,
  ProviderMetadata,
  RejectionRecord,
  ScopeDiscoveryDecision,
  ScopeDiscoveryDecisionType,
  ScopeDiscoverySuggestion,
  ScopeDiscoverySuggestionKind,
  ScopeDiscoverySuggestionStatus,
  SourceSnapshot,
  StalenessEvaluation,
  StalenessReason,
  SuggestionIdentityParts,
  TransitionAuditMetadata,
  TransitionCommand,
  TransitionCommandType,
  TransitionResult,
  ValidationIssue,
  ValidationResult,
} from "./types";

export {
  CONFIDENCE_BANDS,
  EVIDENCE_SOURCE_TYPES,
  SUGGESTION_KINDS,
  SUGGESTION_STATUSES,
  TRANSITION_COMMANDS,
} from "./types";

export { deepFreeze, assertFrozenMutationBlocked } from "./immutability";

export {
  bandForConfidence,
  isConfidenceInBand,
  CONFIDENCE_BAND_RANGES,
} from "./confidence";

export {
  evidenceIdentityKey,
  hasDuplicateEvidence,
  normalizeEvidenceList,
} from "./evidence";

export {
  validateScopeDiscoverySuggestion,
  assertNoCommercialFields,
} from "./validation";

export {
  transitionScopeSuggestion,
  isTransitionAllowed,
  ALLOWED_TRANSITIONS,
} from "./lifecycle";

export {
  buildSuggestionIdentity,
  normalizeWorkAreaType,
  classifyDuplicate,
  identityKeyForSuggestion,
  identityPartsFromSuggestion,
} from "./identity";

export { evaluateStaleness } from "./staleness";

export { dedupeByIdentity } from "./deduplication";

export { mergeScopeSuggestions } from "./merge";
