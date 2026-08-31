import { isTimeoutOrAbortError, getErrorStatus } from "@/lib/ai/analyse-job-contract";

const DEFAULT_MAX_ATTEMPTS = 3;
const MAX_BACKOFF_MS = 8_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { isTimeoutOrAbortError, getErrorStatus };

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Retry 429 and 5xx / selected network transients only.
 * Never retry timeout, abort, 400, 401, 403, 404, or invalid-model.
 */
export function isRetryableAnthropicError(error: unknown): boolean {
  if (isTimeoutOrAbortError(error)) {
    return false;
  }

  const status = getErrorStatus(error);
  if (status === 429) {
    return true;
  }
  if (status != null && status >= 400 && status < 500) {
    return false;
  }
  if (status != null && status >= 500 && status < 600) {
    return true;
  }

  const message = getErrorMessage(error).toLowerCase();
  if (
    message.includes("rate limit") ||
    message.includes("overloaded") ||
    message.includes("econnreset")
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
