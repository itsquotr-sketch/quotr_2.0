const GENERIC_ERROR =
  "Something went wrong. Please try again. If the problem continues, use Report issue in the account menu.";

const SESSION_ERROR =
  "Your session may have expired. Please sign in again and retry.";

function isSessionError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("jwt") ||
    lower.includes("session") ||
    lower.includes("not authenticated")
  );
}

/**
 * Maps technical errors to user-safe messages. Logs detail in development.
 */
export function toUserError(
  error: unknown,
  context?: string,
  fallback = GENERIC_ERROR
): string {
  if (typeof error === "string" && error.trim()) {
    return error;
  }

  const message =
    error instanceof Error
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
  estimateGenerateFailed:
    "Something went wrong while generating the estimate. Please try again.",
  estimateSaveFailed:
    "Could not save the estimate. Please try again or regenerate the estimate.",
  recalibrationFailed:
    "Could not update final pricing from the latest estimate. Please try again.",
  companySettingsSaveFailed: "Could not save company settings. Please try again.",
  notFound: "The requested item could not be found.",
} as const;
