/**
 * Application-layer error codes for gated scope discovery (3.1B.5C).
 */

export const APPLICATION_ERROR_CODES = Object.freeze({
  FEATURE_DISABLED: "FEATURE_DISABLED",
  NOT_AUTHENTICATED: "NOT_AUTHENTICATED",
  ORGANISATION_REQUIRED: "ORGANISATION_REQUIRED",
  PROJECT_NOT_FOUND: "PROJECT_NOT_FOUND",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  DUPLICATE_IN_FLIGHT: "DUPLICATE_IN_FLIGHT",
  RUN_FAILED: "RUN_FAILED",
  PERSISTENCE_FAILED: "PERSISTENCE_FAILED",
  NOT_FOUND: "NOT_FOUND",
  DECISION_FAILED: "DECISION_FAILED",
  PROVIDER_UNAVAILABLE: "PROVIDER_UNAVAILABLE",
} as const);

export type ApplicationErrorCode =
  (typeof APPLICATION_ERROR_CODES)[keyof typeof APPLICATION_ERROR_CODES];

const SAFE_MESSAGES: Record<ApplicationErrorCode, string> = {
  FEATURE_DISABLED: "Scope discovery is not enabled.",
  NOT_AUTHENTICATED: "Authentication is required.",
  ORGANISATION_REQUIRED: "Organisation context is required.",
  PROJECT_NOT_FOUND: "Project was not found.",
  VALIDATION_FAILED: "The discovery request is invalid.",
  DUPLICATE_IN_FLIGHT: "A matching discovery analysis is already in progress.",
  RUN_FAILED: "Scope discovery could not be completed.",
  PERSISTENCE_FAILED: "Scope discovery could not be saved.",
  NOT_FOUND: "Discovery results were not found.",
  DECISION_FAILED: "The decision could not be completed.",
  PROVIDER_UNAVAILABLE: "Scope discovery provider is not configured.",
};

export class ScopeDiscoveryApplicationError extends Error {
  readonly code: ApplicationErrorCode;

  constructor(code: ApplicationErrorCode, message?: string) {
    super(message ?? SAFE_MESSAGES[code]);
    this.name = "ScopeDiscoveryApplicationError";
    this.code = code;
  }
}

export function safeApplicationFailureMessage(
  code: ApplicationErrorCode
): string {
  return SAFE_MESSAGES[code];
}

export function applicationFailure(code: ApplicationErrorCode): {
  readonly ok: false;
  readonly success: false;
  readonly code: ApplicationErrorCode;
  readonly message: string;
} {
  return {
    ok: false,
    success: false,
    code,
    message: safeApplicationFailureMessage(code),
  };
}
