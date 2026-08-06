/**
 * Stage 3.1B.5C / 3.1B.6 — Gated scope discovery application layer.
 *
 * Used by server actions and Assistant UI behind the feature flag.
 * Does not alter Analyse Job.
 */

export {
  APPLICATION_ERROR_CODES,
  ScopeDiscoveryApplicationError,
  safeApplicationFailureMessage,
  applicationFailure,
  type ApplicationErrorCode,
} from "./errors";

export type {
  SafeRunResult,
  SafeDecisionResult,
  SafeResultsRead,
  SafeSuggestionView,
  RunDiscoveryOutcome,
  DecisionOutcome,
  ResultsReadOutcome,
  StaleOutcome,
  RunDiscoveryInput,
  GetResultsInput,
  AcceptDecisionAppInput,
  RejectDecisionAppInput,
  ModifyDecisionAppInput,
  ComposedDecisionState,
  ApplicationFailure,
} from "./types";

export { SOURCE_BOUNDS, DEFAULT_ANALYSIS_OBJECTIVE } from "./types";

export { collectProjectSources, type CollectedProjectSources } from "./source-collector";
export { runScopeDiscovery, type RunScopeDiscoveryDeps } from "./run-scope-discovery";
export { getScopeDiscoveryResults, type GetResultsDeps } from "./get-results";
export {
  acceptScopeSuggestionApp,
  rejectScopeSuggestionApp,
  modifyScopeSuggestionApp,
  type DecisionServiceDeps,
} from "./decision-services";
export {
  batchConfirmScopeItemsApp,
  deriveBatchStateFromDecisions,
  type BatchConfirmScopeInput,
  type BatchConfirmScopeOutcome,
  type BatchScopeItemState,
  type BatchScopeItemInput,
} from "./batch-confirm-scope";
export {
  applyScopeImpactRecommendationApp,
  keepScopeImpactRecommendationApp,
  type ScopeImpactRecommendationActionInput,
  type ScopeImpactRecommendationActionOutcome,
} from "./scope-impact-recommendation-actions";
export {
  evaluateScopeDiscoveryStale,
  type EvaluateStaleDeps,
} from "./stale-evaluation";
export { logDiscoveryEvent } from "./logging";
