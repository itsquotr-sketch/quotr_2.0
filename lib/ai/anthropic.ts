import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { ANALYSE_JOB_TIMEOUT_MS } from "@/lib/ai/analyse-job-contract";
import { withAnthropicRetry } from "@/lib/ai/retry";

export function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY environment variable.");
  }

  return new Anthropic({ apiKey, maxRetries: 0, timeout: ANALYSE_JOB_TIMEOUT_MS });
}

export function getAnthropicModel(): string {
  return process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
}

/**
 * One Messages API call with a shared deadline across Quotr retries.
 * SDK internal retries are disabled so 429/5xx are handled only by
 * withAnthropicRetry within the remaining budget.
 */
export async function createAnthropicMessage(
  params: Anthropic.MessageCreateParamsNonStreaming,
  options?: { timeoutMs?: number; label?: string }
): Promise<Anthropic.Message> {
  const client = getAnthropicClient();
  const timeoutMs = options?.timeoutMs ?? ANALYSE_JOB_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;

  return withAnthropicRetry(
    () => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        const error = new Error("Analysis request timed out.");
        error.name = "TimeoutError";
        throw error;
      }
      return client.messages.create(params, {
        timeout: remaining,
        maxRetries: 0,
      });
    },
    { label: options?.label }
  );
}
