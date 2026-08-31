import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import {
  ANALYSE_JOB_PROVIDER_TIMEOUT_MS,
  ANALYSE_JOB_RETRY_MIN_REMAINING_MS,
} from "@/lib/ai/analyse-job-contract";
import { withAnthropicRetry } from "@/lib/ai/retry";
import {
  emptyTokenFields,
  sumTokenFields,
  tokensFromAnthropicUsage,
  type AiUsageTokenFields,
} from "@/lib/ai/usage-types";

const INVOCATION_META = "__anthropicInvocation";

export type AnthropicInvocationMeta = {
  attemptCount: number;
  latencyMs: number;
  usage: AiUsageTokenFields;
  model: string;
};

export type AnthropicMessageResult = {
  message: Anthropic.Message;
  attemptCount: number;
  latencyMs: number;
  usage: AiUsageTokenFields;
};

export function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY environment variable.");
  }

  return new Anthropic({
    apiKey,
    maxRetries: 0,
    timeout: ANALYSE_JOB_PROVIDER_TIMEOUT_MS,
  });
}

export function getAnthropicModel(): string {
  return process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
}

export function getAnthropicInvocationMeta(
  error: unknown
): AnthropicInvocationMeta | null {
  if (error == null || typeof error !== "object") return null;
  const meta = (error as Record<string, unknown>)[INVOCATION_META];
  if (meta == null || typeof meta !== "object") return null;
  const record = meta as AnthropicInvocationMeta;
  if (typeof record.attemptCount !== "number") return null;
  return record;
}

function usageFromThrown(error: unknown): AiUsageTokenFields {
  if (error == null || typeof error !== "object") {
    return emptyTokenFields();
  }
  const record = error as Record<string, unknown>;
  if ("usage" in record) {
    return tokensFromAnthropicUsage(record.usage);
  }
  const nested = record.error;
  if (nested != null && typeof nested === "object" && "usage" in nested) {
    return tokensFromAnthropicUsage((nested as { usage: unknown }).usage);
  }
  return emptyTokenFields();
}

function attachInvocationMeta(
  error: unknown,
  meta: AnthropicInvocationMeta
): never {
  if (error != null && typeof error === "object") {
    (error as Record<string, unknown>)[INVOCATION_META] = meta;
  }
  throw error;
}

/**
 * One Messages API call. Timeout applies to the provider request only.
 * SDK retries disabled. Quotr retries 429/5xx only while remaining budget
 * is above ANALYSE_JOB_RETRY_MIN_REMAINING_MS.
 */
export async function createAnthropicMessage(
  params: Anthropic.MessageCreateParamsNonStreaming,
  options?: { timeoutMs?: number; label?: string }
): Promise<AnthropicMessageResult> {
  const client = getAnthropicClient();
  const timeoutMs = options?.timeoutMs ?? ANALYSE_JOB_PROVIDER_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;
  const started = Date.now();
  let attemptCount = 0;
  let billedUsage = emptyTokenFields();
  const model = params.model;

  try {
    const message = await withAnthropicRetry(
      async () => {
        attemptCount += 1;
        const remaining = deadline - Date.now();
        if (
          attemptCount > 1 &&
          remaining < ANALYSE_JOB_RETRY_MIN_REMAINING_MS
        ) {
          const error = new Error("Analysis request timed out.");
          error.name = "TimeoutError";
          throw error;
        }
        try {
          const created = await client.messages.create(params, {
            timeout: Math.max(1, remaining),
            maxRetries: 0,
          });
          billedUsage = sumTokenFields(
            billedUsage,
            tokensFromAnthropicUsage(created.usage)
          );
          return created;
        } catch (error) {
          billedUsage = sumTokenFields(billedUsage, usageFromThrown(error));
          throw error;
        }
      },
      { label: options?.label }
    );

    return {
      message,
      attemptCount,
      latencyMs: Date.now() - started,
      usage: billedUsage,
    };
  } catch (error) {
    attachInvocationMeta(error, {
      attemptCount: Math.max(1, attemptCount),
      latencyMs: Date.now() - started,
      usage: billedUsage,
      model,
    });
  }
}
