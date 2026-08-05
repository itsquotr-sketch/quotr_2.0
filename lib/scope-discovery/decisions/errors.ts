/**
 * Stage 3.1B.5A — Decision lifecycle error codes.
 * Stable codes only — never leak raw SQL.
 */

export const DECISION_ERROR_CODES = {
  SUGGESTION_NOT_FOUND: "SUGGESTION_NOT_FOUND",
  SUGGESTION_NOT_ELIGIBLE: "SUGGESTION_NOT_ELIGIBLE",
  ALREADY_ACCEPTED: "ALREADY_ACCEPTED",
  ALREADY_SCOPE_CREATED: "ALREADY_SCOPE_CREATED",
  STALE_SUGGESTION: "STALE_SUGGESTION",
  SUPERSEDED_SUGGESTION: "SUPERSEDED_SUGGESTION",
  FOREIGN_OR_MISSING: "FOREIGN_OR_MISSING",
  INVALID_MODIFICATION: "INVALID_MODIFICATION",
  DUPLICATE_WORK_AREA: "DUPLICATE_WORK_AREA",
  DECISION_CONFLICT: "DECISION_CONFLICT",
  TRANSACTION_FAILED: "TRANSACTION_FAILED",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  VALIDATION_FAILED: "VALIDATION_FAILED",
} as const;

export type DecisionErrorCode =
  (typeof DECISION_ERROR_CODES)[keyof typeof DECISION_ERROR_CODES];

const SAFE_MESSAGES: Record<DecisionErrorCode, string> = {
  SUGGESTION_NOT_FOUND: "Suggestion was not found.",
  SUGGESTION_NOT_ELIGIBLE: "This suggestion cannot be decided.",
  ALREADY_ACCEPTED: "This suggestion has already been accepted.",
  ALREADY_SCOPE_CREATED: "A Work Area has already been created from this suggestion.",
  STALE_SUGGESTION: "This suggestion is stale and cannot be decided.",
  SUPERSEDED_SUGGESTION: "This suggestion has been superseded.",
  FOREIGN_OR_MISSING: "Suggestion was not found.",
  INVALID_MODIFICATION: "The modification is invalid.",
  DUPLICATE_WORK_AREA: "An equivalent Work Area already exists on this project.",
  DECISION_CONFLICT: "This suggestion already has a conflicting decision.",
  TRANSACTION_FAILED: "The decision could not be completed.",
  UNAUTHENTICATED: "Not authenticated.",
  VALIDATION_FAILED: "Invalid decision request.",
};

export class ScopeDiscoveryDecisionError extends Error {
  readonly code: DecisionErrorCode;

  constructor(code: DecisionErrorCode, message?: string) {
    super(message ?? SAFE_MESSAGES[code]);
    this.name = "ScopeDiscoveryDecisionError";
    this.code = code;
  }
}

export function safeDecisionFailureMessage(code: DecisionErrorCode): string {
  return SAFE_MESSAGES[code];
}

const KNOWN_CODES = new Set<string>(Object.values(DECISION_ERROR_CODES));

/** Parse RPC / PostgREST errors into stable decision codes. */
export function mapDecisionRpcError(
  error: { message?: string; code?: string } | null | undefined
): ScopeDiscoveryDecisionError {
  const raw = error?.message ?? "";
  const match = raw.match(/SCOPE_DISCOVERY_DECISION:([A-Z_]+)/);
  if (match && KNOWN_CODES.has(match[1])) {
    return new ScopeDiscoveryDecisionError(match[1] as DecisionErrorCode);
  }
  const upper = raw.toUpperCase();
  for (const code of Object.values(DECISION_ERROR_CODES)) {
    if (upper.includes(code)) {
      return new ScopeDiscoveryDecisionError(code);
    }
  }
  if ((error?.code ?? "") === "23505" || /duplicate key/i.test(raw)) {
    return new ScopeDiscoveryDecisionError(
      DECISION_ERROR_CODES.ALREADY_SCOPE_CREATED
    );
  }
  return new ScopeDiscoveryDecisionError(DECISION_ERROR_CODES.TRANSACTION_FAILED);
}
