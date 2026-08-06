/**
 * Safe warning presentation for Scope Discovery UI.
 */

const PROVIDER_PARTIAL_PATTERNS = [
  /contextual scope discovery failed/i,
  /contextual scope discovery could not/i,
  /contextual scope discovery returned invalid/i,
  /provider is not configured/i,
  /PROVIDER_FAILED/i,
  /PROVIDER_REPAIR_FAILED/i,
  /PROVIDER_OUTPUT_INVALID/i,
  /PROVIDER_CONFIGURATION_MISSING/i,
] as const;

/**
 * True when deterministic results exist but contextual AI did not complete.
 * Does not expose provider names.
 */
export function isProviderPartialFailureWarning(
  warning: string | null | undefined
): boolean {
  if (!warning) return false;
  return PROVIDER_PARTIAL_PATTERNS.some((re) => re.test(warning));
}

export function detectProviderPartialFailure(
  warnings: readonly string[] | null | undefined,
  status: string | null | undefined
): boolean {
  if (String(status ?? "").toUpperCase() === "COMPLETED_WITH_WARNINGS") {
    if ((warnings ?? []).some(isProviderPartialFailureWarning)) return true;
  }
  return (warnings ?? []).some(isProviderPartialFailureWarning);
}

/** Strip internal codes / provider names from any accidental warning text. */
export function sanitiseUiWarning(warning: string): string {
  return warning
    .replace(/Anthropic/gi, "the provider")
    .replace(/Claude/gi, "the model")
    .replace(/API[_ ]?key/gi, "configuration")
    .replace(/\bsk-[a-zA-Z0-9_-]+/g, "[redacted]")
    .slice(0, 240);
}
