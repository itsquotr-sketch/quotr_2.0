const GENERIC_ERROR =
  "Something went wrong. Please try again. If the problem continues, use Report issue in the account menu.";

const SESSION_ERROR =
  "Your session may have expired. Please sign in again and retry.";

const TECHNICAL_ERROR_PATTERNS = [
  /PGRST\d+/i,
  /\b42P01\b/,
  /\b22P02\b/,
  /relation ["'`].+["'`] (does not exist|already exists)/i,
  /could not find the ['`].+['`] column/i,
  /could not find the table/i,
  /schema cache/i,
  /\bRPC\b/,
  /postgrest/i,
  /postgres(ql)?/i,
  /supabase/i,
  /permission denied for (table|relation|schema|function)/i,
  /duplicate key value/i,
  /violates .+ constraint/i,
  /column .+ (does not exist|of relation)/i,
  /function .+ does not exist/i,
  /syntax error at or near/i,
  /ECONNREFUSED/i,
  /ENOTFOUND/i,
  /stack trace/i,
  /anthropic/i,
  /sk_(live|test)_/i,
  /whsec_/i,
  /stripe (api|secret|webhook|dashboard)/i,
  /resend\.com/i,
  /RESEND_[A-Z_]+/,
  /api[_ -]?key/i,
  /Bearer\s+/i,
  /process\.env/i,
];

function isSessionError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("jwt") ||
    lower.includes("session") ||
    lower.includes("not authenticated")
  );
}

export function isTechnicalErrorText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return TECHNICAL_ERROR_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Maps technical errors to user-safe messages. Logs detail in development.
 * Never returns PostgREST, SQL, RPC, or provider internals.
 */
export function toUserError(
  error: unknown,
  context?: string,
  fallback = GENERIC_ERROR
): string {
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : error != null
          ? String(error)
          : "";

  if (!message.trim()) {
    return fallback;
  }

  if (isSessionError(message)) {
    return SESSION_ERROR;
  }

  if (isTechnicalErrorText(message)) {
    if (process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "preview") {
      console.error(context ? `[${context}]` : "[user-error]", message);
    }
    return fallback;
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  if (process.env.NODE_ENV === "development") {
    console.error(context ? `[${context}]` : "[user-error]", message);
  }

  return fallback;
}

export const USER_ERRORS = {
  generic: GENERIC_ERROR,
  session: SESSION_ERROR,
  quoteCreateFailed: "Could not create the quote. Check final pricing is reviewed and try again.",
  quoteRevisionFailed:
    "Could not create the quote revision. Please try again.",
  quoteUpdateFailed: "Could not save quote changes. Please try again.",
  quoteStatusFailed: "Could not update quote status. Please try again.",
  quoteDeliveryFailed: "Quote email could not be sent. Please try again.",
  estimateGenerateFailed:
    "Something went wrong while generating the estimate. Please try again.",
  projectConditionsIncomplete:
    "Complete the remaining project information before generating the estimate.",
  estimateSaveFailed:
    "Could not save the estimate. Please try again or regenerate the estimate.",
  recalibrationFailed:
    "Could not update final pricing from the latest estimate. Please try again.",
  companySettingsSaveFailed: "Could not save company settings. Please try again.",
  workAreaSaveFailed: "Could not update Work Areas. Please try again.",
  projectSaveFailed: "Could not save the project. Please try again.",
  notFound: "The requested item could not be found.",
} as const;
