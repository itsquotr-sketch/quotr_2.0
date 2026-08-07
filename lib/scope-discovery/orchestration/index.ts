/**
 * Stage 3.1B.4A — Pure scope discovery orchestration.
 *
 * Persistence-free, migration-free, unused by production Analyse Job.
 * Provider is invoked only through an injected runner (no Anthropic SDK here).
 */

export {
  SCOPE_DISCOVERY_ORCHESTRATION_VERSION,
} from "./version";

export {
  ORCHESTRATION_ERROR_CODES,
  ScopeDiscoveryOrchestrationError,
  safeOrchestrationFailureMessage,
  type OrchestrationErrorCode,
} from "./errors";

export {
  DISCOVERY_TRIGGERS,
  EXPLICIT_USER_TRIGGERS,
  IDEMPOTENCY_ACTIONS,
  RUN_STATUSES,
  STALE_RUN_COMPARISONS,
  ORCH_POL_01_PROVIDER_FAIL_RETURNS_DETERMINISTIC,
  type DiscoveryTrigger,
  type ExplicitUserTrigger,
  type IdempotencyAction,
  type ScopeDiscoveryRunStatus,
  type StaleRunComparison,
  type OrchestrationSiteNote,
  type OrchestrationWorkArea,
  type OrchestrationFact,
  type OrchestrationConstraint,
  type PriorDecisionRecord,
  type PriorRunSummary,
  type ScopeDiscoveryRequest,
  type ScopeDiscoverySourceSnapshot,
  type IdempotencyDecision,
  type DecisionApplicationExplanation,
  type StaleRunEvaluation,
  type OrchestrationProviderMetadata,
  type ScopeDiscoveryRunResult,
  type ExecutionContext,
  type InjectedProviderRunner,
} from "./types";

export {
  validateDiscoveryRequest,
} from "./validation";

export {
  normaliseFormatting,
  fingerprintDigest,
  buildSourceSnapshot,
  computeSourceFingerprint,
  toContractSourceSnapshot,
  assertValidSnapshot,
} from "./source-snapshot";

export {
  triggerFamily,
  isExplicitUserTrigger,
  isProviderAuthorised,
  buildIdempotencyKey,
  decideIdempotencyAction,
} from "./idempotency";

export {
  evaluateStaleRun,
  normaliseSnapshotForStaleCompare,
  diffMaterialSourceFields,
} from "./stale-analysis";

export {
  buildPriorDecisionInputs,
  mergeDiscoveryStreams,
  validateFinalSuggestions,
} from "./merge-results";

export { buildRunResult, failureError } from "./result";

export { executeScopeDiscovery } from "./execute";
