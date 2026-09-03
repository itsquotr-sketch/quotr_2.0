import { AIExtractionError } from "@/lib/ai/schema";

/**
 * Bounds the Anthropic Messages request only — not auth/DB/canonical read.
 * Measured simple Deck fixture: ~16s provider. Preview needs headroom for
 * cold start / region variance without returning to unbounded 10-minute waits.
 */
export const ANALYSE_JOB_PROVIDER_TIMEOUT_MS = 75_000;

/** Do not start another provider attempt below this remaining budget. */
export const ANALYSE_JOB_RETRY_MIN_REMAINING_MS = 8_000;

/**
 * Next.js / Vercel maxDuration for the project page that hosts Analyse Job.
 * Must exceed provider timeout + DB/canonical read.
 */
export const ANALYSE_JOB_ACTION_MAX_DURATION_SECONDS = 120;

/** @deprecated Use ANALYSE_JOB_PROVIDER_TIMEOUT_MS — kept as alias for call sites. */
export const ANALYSE_JOB_TIMEOUT_MS = ANALYSE_JOB_PROVIDER_TIMEOUT_MS;

export const ANALYSE_JOB_TIMEOUT_USER_MESSAGE =
  "Analysis took too long. Please try again.";

export const ANALYSE_JOB_PROVIDER = "anthropic" as const;

export const ANALYSE_JOB_TIMEOUT_CODE = "ANALYSE_JOB_TIMEOUT";

export const UNKNOWN_ANALYSIS_ERROR =
  "Quotr hit a temporary problem analysing this job. Please try again.";
export const NO_CAPTURE_ERROR =
  "Add a brief or at least one site note before analysing.";
export const AI_SETUP_ERROR =
  "Quotr couldn't analyse this job right now. Please try again.";
export const AI_PARSE_ERROR =
  "Quotr couldn't understand enough about this job. Try adding more detail, then try again.";
export const NO_WORK_AREAS_ERROR =
  "No supported work areas were detected. Try adding more detail about the job, or add a work area manually.";

export type AnalysisErrorClass =
  | "timeout"
  | "abort"
  | "provider_auth"
  | "provider_invalid"
  | "provider_rate_limit"
  | "provider_server"
  | "parse"
  | "schema"
  | "setup"
  | "no_work_areas"
  | "unknown";

export function getErrorStatus(error: unknown): number | null {
  if (error == null || typeof error !== "object") {
    return null;
  }
  const record = error as Record<string, unknown>;
  if (typeof record.status === "number") {
    return record.status;
  }
  const nested = record.error;
  if (nested != null && typeof nested === "object") {
    const nestedRecord = nested as Record<string, unknown>;
    if (typeof nestedRecord.status === "number") {
      return nestedRecord.status;
    }
  }
  return null;
}

function errorName(error: unknown): string {
  if (error != null && typeof error === "object" && "name" in error) {
    const name = (error as { name?: unknown }).name;
    return typeof name === "string" ? name : "";
  }
  return "";
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error != null && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : "";
  }
  return String(error ?? "");
}

export function isTimeoutOrAbortError(error: unknown): boolean {
  const name = errorName(error);
  const code =
    error != null && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";

  if (
    name === "TimeoutError" ||
    name === "AbortError" ||
    name === "APIUserAbortError" ||
    name === "APIConnectionTimeoutError"
  ) {
    return true;
  }
  if (code === ANALYSE_JOB_TIMEOUT_CODE) {
    return true;
  }
  if (error instanceof AIExtractionError && error.code === ANALYSE_JOB_TIMEOUT_CODE) {
    return true;
  }
  const message = errorMessage(error);
  if (
    message === ANALYSE_JOB_TIMEOUT_USER_MESSAGE ||
    message === "Analysis request timed out."
  ) {
    return true;
  }
  return false;
}

export function classifyAnalysisError(error: unknown): AnalysisErrorClass {
  const status = getErrorStatus(error);
  if (status === 401 || status === 403) return "provider_auth";
  if (status === 429) return "provider_rate_limit";
  if (status === 400 || status === 404 || status === 422) return "provider_invalid";
  if (status != null && status >= 500 && status < 600) return "provider_server";

  if (isTimeoutOrAbortError(error)) {
    return errorName(error) === "AbortError" ? "abort" : "timeout";
  }

  if (error instanceof AIExtractionError) {
    if (error.code === ANALYSE_JOB_TIMEOUT_CODE) return "timeout";
    if (error.message.includes("No valid work areas")) return "no_work_areas";
    if (error.message.includes("No allowed work area types")) return "setup";
    if (error.message.includes("schema validation")) return "schema";
    if (error.message.includes("parse AI response")) return "parse";
    if (error.message.includes("ANTHROPIC_API_KEY")) return "setup";
  }

  const message = errorMessage(error).toLowerCase();
  if (message.includes("anthropic_api_key")) return "setup";
  if (message.includes("invalid") && message.includes("model")) {
    return "provider_invalid";
  }
  if (
    /pgrst\d+/.test(message) ||
    message.includes("relation") ||
    message.includes("postgrest") ||
    message.includes("could not find the table") ||
    message.includes("schema cache")
  ) {
    return "unknown";
  }

  return "unknown";
}

export function userMessageForAnalysisError(error: unknown): string {
  const cls = classifyAnalysisError(error);
  switch (cls) {
    case "timeout":
    case "abort":
      return ANALYSE_JOB_TIMEOUT_USER_MESSAGE;
    case "no_work_areas":
      return NO_WORK_AREAS_ERROR;
    case "parse":
    case "schema":
      return AI_PARSE_ERROR;
    case "setup":
    case "provider_auth":
    case "provider_invalid":
      return AI_SETUP_ERROR;
    default:
      return UNKNOWN_ANALYSIS_ERROR;
  }
}

export function userMessageForErrorClass(cls: AnalysisErrorClass): string {
  switch (cls) {
    case "timeout":
    case "abort":
      return ANALYSE_JOB_TIMEOUT_USER_MESSAGE;
    case "no_work_areas":
      return NO_WORK_AREAS_ERROR;
    case "parse":
    case "schema":
      return AI_PARSE_ERROR;
    case "setup":
    case "provider_auth":
    case "provider_invalid":
      return AI_SETUP_ERROR;
    default:
      return UNKNOWN_ANALYSIS_ERROR;
  }
}

export function shouldLogAnalyseJobTiming(
  env: Readonly<Record<string, string | undefined>> = process.env
): boolean {
  return (
    env.NODE_ENV === "development" ||
    env.VERCEL_ENV === "preview" ||
    env.ANALYSE_JOB_TIMING === "1"
  );
}
