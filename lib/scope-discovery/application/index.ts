/**
 * Stage 3.1B.5C — Gated scope discovery application layer.
 *
 * Not imported by Assistant UI or Analyse Job.
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
  evaluateScopeDiscoveryStale,
  type EvaluateStaleDeps,
} from "./stale-evaluation";
export { logDiscoveryEvent } from "./logging";
