export const PROVIDER_ERROR_CODES = Object.freeze({
  PROVIDER_CONFIGURATION_MISSING: "PROVIDER_CONFIGURATION_MISSING",
  INPUT_VALIDATION_FAILED: "INPUT_VALIDATION_FAILED",
  MALFORMED_OUTPUT: "MALFORMED_OUTPUT",
  OUTPUT_VALIDATION_FAILED: "OUTPUT_VALIDATION_FAILED",
  REPAIR_FAILED: "REPAIR_FAILED",
  TRANSPORT_FAILED: "TRANSPORT_FAILED",
  COMMERCIAL_CONTENT_FORBIDDEN: "COMMERCIAL_CONTENT_FORBIDDEN",
  UNSUPPORTED_EVIDENCE_REFERENCE: "UNSUPPORTED_EVIDENCE_REFERENCE",
  DETERMINISTIC_SUPPRESSION_VIOLATION: "DETERMINISTIC_SUPPRESSION_VIOLATION",
  EXCESSIVE_OUTPUT: "EXCESSIVE_OUTPUT",
} as const);

export type ProviderErrorCode =
  (typeof PROVIDER_ERROR_CODES)[keyof typeof PROVIDER_ERROR_CODES];

export class ScopeDiscoveryProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly details: readonly string[];

  constructor(
    code: ProviderErrorCode,
    message: string,
    details: readonly string[] = []
  ) {
    super(message);
    this.name = "ScopeDiscoveryProviderError";
    this.code = code;
    this.details = details;
  }
}

/** Safe user-facing messages — never include secrets or raw provider dumps. */
export function safeProviderFailureMessage(code: ProviderErrorCode): string {
  switch (code) {
    case "PROVIDER_CONFIGURATION_MISSING":
      return "Scope discovery provider is not configured.";
    case "INPUT_VALIDATION_FAILED":
      return "Scope discovery input is invalid.";
    case "MALFORMED_OUTPUT":
      return "Scope discovery returned an unreadable response.";
    case "OUTPUT_VALIDATION_FAILED":
      return "Scope discovery returned invalid suggestions.";
    case "REPAIR_FAILED":
      return "Scope discovery could not repair its response.";
    case "TRANSPORT_FAILED":
      return "Scope discovery provider request failed.";
    case "COMMERCIAL_CONTENT_FORBIDDEN":
      return "Scope discovery returned unsupported commercial content.";
    case "UNSUPPORTED_EVIDENCE_REFERENCE":
      return "Scope discovery cited unsupported evidence.";
    case "DETERMINISTIC_SUPPRESSION_VIOLATION":
      return "Scope discovery attempted to override a suppressed scope.";
    case "EXCESSIVE_OUTPUT":
      return "Scope discovery returned too many suggestions.";
    default:
      return "Scope discovery failed.";
  }
}
