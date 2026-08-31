/**
 * Anthropic transport for scope discovery.
 * Isolated from the testable core so verification never requires a live API key.
 * Uses the existing Quotr env var ANTHROPIC_API_KEY / ANTHROPIC_MODEL.
 *
 * Not imported by production Analyse Job. Not re-exported from provider/index
 * default barrel in a way that forces server-only into client bundles —
 * import this module explicitly when wiring a future batch.
 */

import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { ANALYSE_JOB_TIMEOUT_MS } from "@/lib/ai/analyse-job-contract";
import { createAnthropicMessage, getAnthropicModel } from "@/lib/ai/anthropic";
import {
  assertAnthropicApiKeyConfigured,
  hasAnthropicApiKey,
} from "./configuration";
import {
  PROVIDER_ERROR_CODES,
  ScopeDiscoveryProviderError,
} from "./errors";
import type {
  ScopeDiscoveryTransport,
  ScopeDiscoveryTransportResponse,
} from "./types";

function getTextFromResponse(content: Anthropic.Message["content"]): string {
  const textBlock = content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new ScopeDiscoveryProviderError(
      PROVIDER_ERROR_CODES.MALFORMED_OUTPUT,
      "Provider response did not contain text."
    );
  }
  return textBlock.text;
}

export function isAnthropicConfigured(): boolean {
  return hasAnthropicApiKey();
}

/**
 * Create a transport using Anthropic Messages API.
 * Throws controlled PROVIDER_CONFIGURATION_MISSING when key absent.
 */
export function createAnthropicScopeDiscoveryTransport(): ScopeDiscoveryTransport {
  assertAnthropicApiKeyConfigured();

  const defaultModel = getAnthropicModel();

  return async (request): Promise<ScopeDiscoveryTransportResponse> => {
    const started = Date.now();
    try {
      const model = request.model || defaultModel;
      const result = await createAnthropicMessage(
        {
          model,
          max_tokens: request.maxTokens,
          temperature: request.temperature,
          system: request.systemPrompt,
          messages: [{ role: "user", content: request.userPrompt }],
        },
        {
          timeoutMs: ANALYSE_JOB_TIMEOUT_MS,
          label: request.isRepair
            ? "scopeDiscoveryRepair"
            : "scopeDiscoveryPrimary",
        }
      );

      return {
        text: getTextFromResponse(result.message.content),
        model: result.message.model || model,
        requestId: result.message.id ?? null,
        tokenUsage: {
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
        },
        latencyMs: result.latencyMs || Date.now() - started,
      };
    } catch (error) {
      if (error instanceof ScopeDiscoveryProviderError) {
        throw error;
      }
      // Never include API key or full prompt in errors.
      throw new ScopeDiscoveryProviderError(
        PROVIDER_ERROR_CODES.TRANSPORT_FAILED,
        "Scope discovery provider request failed."
      );
    }
  };
}

export function getConfiguredAnthropicModelName(): string {
  return getAnthropicModel();
}
