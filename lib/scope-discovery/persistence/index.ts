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
} from "./run-repository";

export {
  insertDiscoverySuggestions,
  markSuggestionStaleOrSuperseded,
  listSuggestionsForRun,
} from "./suggestion-repository";

export {
  insertDiscoveryDecision,
  listDecisionsForSuggestion,
} from "./decision-repository";
