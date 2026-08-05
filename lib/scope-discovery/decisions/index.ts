/**
 * Stage 3.1B.5A — Scope suggestion decision / acceptance lifecycle.
 *
 * Local service layer only. Not wired to Assistant UI or Analyse Job.
 */

export {
  DECISION_ERROR_CODES,
  ScopeDiscoveryDecisionError,
  mapDecisionRpcError,
  safeDecisionFailureMessage,
  type DecisionErrorCode,
} from "./errors";

export type {
  AcceptSuggestionInput,
  RejectSuggestionInput,
  ModifyAcceptSuggestionInput,
  DecisionLifecycleResult,
  DecisionLifecycleSuccess,
  DecisionLifecycleFailure,
  DecisionLifecycleType,
  AcceptedWorkAreaMapping,
} from "./types";

export { ACCEPTED_WORK_AREA_MAPPING } from "./types";

export {
  acceptSuggestionSchema,
  rejectSuggestionSchema,
  modifyAcceptSuggestionSchema,
  isSupportedWorkAreaType,
} from "./schemas";

export {
  evaluateAcceptEligibility,
  evaluateRejectEligibility,
  evaluateModifyEligibility,
  type SuggestionEligibilitySnapshot,
  type EligibilityBlockReason,
} from "./eligibility";

export { mapRpcSuccess } from "./mappers";

export {
  acceptScopeSuggestion,
  rejectScopeSuggestion,
  modifyAcceptScopeSuggestion,
} from "./service";
