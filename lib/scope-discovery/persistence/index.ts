/**
 * Stage 3.1B.4B — Scope discovery persistence adapters.
 *
 * Unused by production Analyse Job. No UI. No Work Area creation.
 * Org is always derived from authenticated profile context.
 */

export {
  PERSISTENCE_ERROR_CODES,
  ScopeDiscoveryPersistenceError,
  safePersistenceFailureMessage,
  type PersistenceErrorCode,
} from "./errors";

export type {
  PersistDecisionInput,
  PersistRunInput,
  PersistSuggestionInput,
  ScopeDiscoveryDecisionRow,
  ScopeDiscoveryRunRow,
  ScopeDiscoverySuggestionRow,
  MarkSuggestionStaleInput,
  CompleteRunInput,
} from "./types";

export type { PersistenceAuthContext } from "./context";

export {
  mapRunInsert,
  mapSuggestionInsert,
  mapDecisionInsert,
} from "./mappers";

export {
  insertDiscoveryRun,
  completeDiscoveryRun,
  archiveDiscoveryRun,
  getDiscoveryRunById,
  getDiscoveryRunDetail,
  listRecentDiscoveryRuns,
  getLatestTerminalDiscoveryRun,
  type DiscoveryRunDetailRow,
} from "./run-repository";

export {
  insertDiscoverySuggestions,
  markSuggestionStaleOrSuperseded,
  listSuggestionsForRun,
  listSuggestionDetailsForRun,
  type DiscoverySuggestionDetailRow,
} from "./suggestion-repository";

export {
  insertDiscoveryDecision,
  listDecisionsForSuggestion,
  listDecisionsForProject,
  listDecisionsForRun,
  type DiscoveryDecisionDetailRow,
} from "./decision-repository";
