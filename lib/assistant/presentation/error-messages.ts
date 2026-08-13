/**
 * Stage 3.1B.7D — Safe user-facing error presentation.
 * Never exposes provider names, API keys, SQL, stack traces, or internal IDs.
 */

export type AssistantErrorClass =
  | "analyse_job"
  | "scope_discovery_provider"
  | "scope_review"
  | "save"
  | "decision"
  | "estimate_generate"
  | "stale"
  | "feature_unavailable"
  | "missing_configuration"
  | "generic";

const SAFE_MESSAGES: Readonly<Record<AssistantErrorClass, string>> = Object.freeze({
  analyse_job:
    "Quotr could not finish analysing this job. Check your project information and try again.",
  scope_discovery_provider:
    "Scope suggestions are based on the information currently available. Review the items below before continuing.",
  scope_review:
    "Scope review could not be updated. Try again, or continue with the current checklist.",
  save: "Could not save. Please try again.",
  decision: "Could not update this scope decision. Please try again.",
  estimate_generate:
    "Quotr could not generate the estimate. Confirm required details are complete, then try again.",
  stale: "This estimate is outdated. Recalculate to reflect the latest scope.",
  feature_unavailable: "This feature is unavailable for this project.",
  missing_configuration:
    "This project is missing required setup. Contact your organisation admin if this continues.",
  generic: "Something went wrong. Please try again.",
});

const UNSAFE_PATTERNS = [
  /anthropic/i,
  /api[_ -]?key/i,
  /sk-[a-z0-9]/i,
  /stack trace/i,
  /at\s+\S+\s+\(/i,
  /sql(state|exception)?/i,
  /postgres/i,
  /supabase/i,
  /ECONNREFUSED/i,
  /process\.env/i,
  /Bearer\s+/i,
  /uuid[:\s]/i,
];

/**
 * Map an error class (and optional raw message) to safe UI copy.
 * Raw messages are discarded when they look like technical/internal text.
 */
export function presentAssistantError(
  errorClass: AssistantErrorClass,
  rawMessage?: string | null
): string {
  const fallback = SAFE_MESSAGES[errorClass];
  if (!rawMessage) return fallback;

  const trimmed = rawMessage.trim();
  if (!trimmed) return fallback;
  if (trimmed.length > 180) return fallback;
  if (UNSAFE_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return fallback;
  }
  // Prefer class message for known technical classes even if copy looks soft.
  if (
    errorClass === "scope_discovery_provider" ||
    errorClass === "missing_configuration" ||
    errorClass === "feature_unavailable"
  ) {
    return fallback;
  }
  return trimmed;
}

export function isUnsafeErrorText(text: string): boolean {
  return UNSAFE_PATTERNS.some((pattern) => pattern.test(text));
}

export function saveFailureMessage(rawMessage?: string | null): string {
  return presentAssistantError("save", rawMessage);
}
