export const ORCHESTRATION_ERROR_CODES = Object.freeze({
  INVALID_REQUEST: "INVALID_REQUEST",
  INVALID_SOURCE_SNAPSHOT: "INVALID_SOURCE_SNAPSHOT",
  DUPLICATE_IN_FLIGHT: "DUPLICATE_IN_FLIGHT",
  DETERMINISTIC_EVALUATION_FAILED: "DETERMINISTIC_EVALUATION_FAILED",
  PROVIDER_CONFIGURATION_MISSING: "PROVIDER_CONFIGURATION_MISSING",
  PROVIDER_FAILED: "PROVIDER_FAILED",
  PROVIDER_REPAIR_FAILED: "PROVIDER_REPAIR_FAILED",
  PROVIDER_OUTPUT_INVALID: "PROVIDER_OUTPUT_INVALID",
  MERGE_FAILED: "MERGE_FAILED",
  FINAL_CONTRACT_INVALID: "FINAL_CONTRACT_INVALID",
  CANCELLED: "CANCELLED",
} as const);

export type OrchestrationErrorCode =
  (typeof ORCHESTRATION_ERROR_CODES)[keyof typeof ORCHESTRATION_ERROR_CODES];

export class ScopeDiscoveryOrchestrationError extends Error {
  readonly code: OrchestrationErrorCode;
  readonly details: readonly string[];

  constructor(
    code: OrchestrationErrorCode,
    message: string,
    details: readonly string[] = []
  ) {
    super(message);
    this.name = "ScopeDiscoveryOrchestrationError";
    this.code = code;
    this.details = details;
  }
}

/** Safe user-facing messages — never include secrets or raw provider dumps. */
export function safeOrchestrationFailureMessage(
  code: OrchestrationErrorCode
): string {
  switch (code) {
    case "INVALID_REQUEST":
      return "Scope discovery request is invalid.";
    case "INVALID_SOURCE_SNAPSHOT":
      return "Scope discovery source snapshot is invalid.";
    case "DUPLICATE_IN_FLIGHT":
      return "A matching scope discovery run is already in progress.";
    case "DETERMINISTIC_EVALUATION_FAILED":
      return "Deterministic scope evaluation failed.";
    case "PROVIDER_CONFIGURATION_MISSING":
      return "Scope discovery provider is not configured.";
    case "PROVIDER_FAILED":
      return "Contextual scope discovery failed.";
    case "PROVIDER_REPAIR_FAILED":
      return "Contextual scope discovery could not repair its response.";
    case "PROVIDER_OUTPUT_INVALID":
      return "Contextual scope discovery returned invalid suggestions.";
    case "MERGE_FAILED":
      return "Scope discovery merge failed.";
    case "FINAL_CONTRACT_INVALID":
      return "Scope discovery produced invalid suggestions.";
    case "CANCELLED":
      return "Scope discovery was cancelled.";
    default:
      return "Scope discovery failed.";
  }
}
