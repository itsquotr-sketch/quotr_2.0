import { AIExtractionError } from "@/lib/ai/schema";

/** Bounded wall time for Analyse Job (and other user-facing Anthropic calls). */
export const ANALYSE_JOB_TIMEOUT_MS = 45_000;

export const ANALYSE_JOB_TIMEOUT_USER_MESSAGE =
  "Analysis took too long. Please try again.";

export const ANALYSE_JOB_PROVIDER = "anthropic" as const;

export const ANALYSE_JOB_TIMEOUT_CODE = "ANALYSE_JOB_TIMEOUT";

export const UNKNOWN_ANALYSIS_ERROR =
  "We couldn't analyse your job. Please try again.";
export const NO_CAPTURE_ERROR =
  "Add a brief or at least one site note before analysing.";
export const AI_SETUP_ERROR =
  "AI setup is missing. Check your organisation configuration.";
export const AI_PARSE_ERROR =
  "Quotr could not understand the analysis response. Please try again.";
export const NO_WORK_AREAS_ERROR =
  "No supported work areas were detected. Try adding more detail about the job, or add a work area manually.";

export function isTimeoutOrAbortError(error: unknown): boolean {
  if (error == null || typeof error !== "object") {
    return false;
  }
  const record = error as { name?: unknown; message?: unknown; code?: unknown };
  const name = typeof record.name === "string" ? record.name : "";
  const message =
    typeof record.message === "string" ? record.message.toLowerCase() : "";
  const code = typeof record.code === "string" ? record.code : "";

  if (name === "TimeoutError" || name === "AbortError" || name === "APIUserAbortError") {
    return true;
  }
  if (code === ANALYSE_JOB_TIMEOUT_CODE) {
    return true;
  }
  if (error instanceof AIExtractionError && error.code === ANALYSE_JOB_TIMEOUT_CODE) {
    return true;
  }
  if (
    message.includes("timed out") ||
    message.includes("timeout") ||
    message.includes("aborted")
  ) {
    return true;
  }
  return false;
}

export function userMessageForAnalysisError(error: unknown): string {
  if (isTimeoutOrAbortError(error)) {
    return ANALYSE_JOB_TIMEOUT_USER_MESSAGE;
  }

  if (error instanceof AIExtractionError) {
    if (error.code === ANALYSE_JOB_TIMEOUT_CODE) {
      return ANALYSE_JOB_TIMEOUT_USER_MESSAGE;
    }
    if (error.message.includes("No valid work areas")) {
      return NO_WORK_AREAS_ERROR;
    }
    if (
      error.message.includes("schema validation") ||
      error.message.includes("parse AI response")
    ) {
      return AI_PARSE_ERROR;
    }
    if (error.message.includes("No allowed work area types")) {
      return AI_SETUP_ERROR;
    }
    if (error.message === ANALYSE_JOB_TIMEOUT_USER_MESSAGE) {
      return ANALYSE_JOB_TIMEOUT_USER_MESSAGE;
    }
  }

  if (error instanceof Error) {
    if (error.message.includes("ANTHROPIC_API_KEY")) {
      return AI_SETUP_ERROR;
    }
  }

  return UNKNOWN_ANALYSIS_ERROR;
}
