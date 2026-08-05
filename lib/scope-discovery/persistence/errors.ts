export const PERSISTENCE_ERROR_CODES = Object.freeze({
  NOT_AUTHENTICATED: "NOT_AUTHENTICATED",
  ORGANISATION_REQUIRED: "ORGANISATION_REQUIRED",
  PROJECT_NOT_OWNED: "PROJECT_NOT_OWNED",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  DUPLICATE_ACTIVE_RUN: "DUPLICATE_ACTIVE_RUN",
  DUPLICATE_SUGGESTION_IDENTITY: "DUPLICATE_SUGGESTION_IDENTITY",
  DUPLICATE_ACCEPT: "DUPLICATE_ACCEPT",
  IMMUTABLE_RECORD: "IMMUTABLE_RECORD",
  NOT_FOUND: "NOT_FOUND",
  PERSISTENCE_FAILED: "PERSISTENCE_FAILED",
} as const);

export type PersistenceErrorCode =
  (typeof PERSISTENCE_ERROR_CODES)[keyof typeof PERSISTENCE_ERROR_CODES];

export class ScopeDiscoveryPersistenceError extends Error {
  readonly code: PersistenceErrorCode;
  readonly details: readonly string[];

  constructor(
    code: PersistenceErrorCode,
    message: string,
    details: readonly string[] = []
  ) {
    super(message);
    this.name = "ScopeDiscoveryPersistenceError";
    this.code = code;
    this.details = details;
  }
}

export function safePersistenceFailureMessage(
  code: PersistenceErrorCode
): string {
  switch (code) {
    case "NOT_AUTHENTICATED":
      return "Authentication is required.";
    case "ORGANISATION_REQUIRED":
      return "Organisation context is required.";
    case "PROJECT_NOT_OWNED":
      return "Project was not found in your organisation.";
    case "VALIDATION_FAILED":
      return "Scope discovery persistence input is invalid.";
    case "DUPLICATE_ACTIVE_RUN":
      return "A matching discovery run is already in progress.";
    case "DUPLICATE_SUGGESTION_IDENTITY":
      return "Duplicate suggestion identity in this run.";
    case "DUPLICATE_ACCEPT":
      return "This suggestion has already been accepted.";
    case "IMMUTABLE_RECORD":
      return "This discovery record cannot be modified.";
    case "NOT_FOUND":
      return "Discovery record was not found.";
    default:
      return "Scope discovery persistence failed.";
  }
}
