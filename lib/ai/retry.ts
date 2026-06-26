const DEFAULT_MAX_ATTEMPTS = 3;
const MAX_BACKOFF_MS = 8_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorStatus(error: unknown): number | null {
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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Retry transient Anthropic/API failures (429 rate limit, 5xx). Does not retry
 * schema or user/input validation errors.
 */
export function isRetryableAnthropicError(error: unknown): boolean {
  const status = getErrorStatus(error);
  if (status === 429) {
    return true;
  }
  if (status != null && status >= 500 && status < 600) {
    return true;
  }

  const message = getErrorMessage(error).toLowerCase();
  if (
    message.includes("rate limit") ||
    message.includes("overloaded") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("econnreset") ||
    message.includes("network")
  ) {
    return true;
  }

  return false;
}

export async function withAnthropicRetry<T>(
  fn: () => Promise<T>,
  options?: { maxAttempts?: number; label?: string }
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!isRetryableAnthropicError(error) || attempt >= maxAttempts) {
        throw error;
      }

      const delayMs = Math.min(1_000 * 2 ** (attempt - 1), MAX_BACKOFF_MS);
      if (process.env.NODE_ENV === "development") {
        console.info("[anthropic-retry]", {
          label: options?.label ?? "request",
          attempt,
          nextDelayMs: delayMs,
          message: getErrorMessage(error),
        });
      }
      await sleep(delayMs);
    }
  }

  throw lastError;
}
