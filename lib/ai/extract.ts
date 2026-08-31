import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import {
  ANALYSE_JOB_TIMEOUT_CODE,
  ANALYSE_JOB_TIMEOUT_MS,
  ANALYSE_JOB_TIMEOUT_USER_MESSAGE,
  classifyAnalysisError,
  isTimeoutOrAbortError,
} from "@/lib/ai/analyse-job-contract";
import {
  createAnthropicMessage,
  getAnthropicInvocationMeta,
  getAnthropicModel,
} from "@/lib/ai/anthropic";
import {
  BRIEF_EXTRACTION_SYSTEM_PROMPT,
  buildBriefExtractionFromModelText,
  buildBriefExtractionUserPrompt,
} from "@/lib/ai/brief-extraction-result";
import type { BriefExtractionResult } from "@/lib/ai/brief-extraction-types";
import { AIExtractionError } from "@/lib/ai/schema";
import { emptyTokenFields, type AiProviderInvocation } from "@/lib/ai/usage-types";

export type { BriefExtractionResult };

export type ExtractFromBriefResult = BriefExtractionResult & {
  invocation: AiProviderInvocation;
};

function getTextFromResponse(content: Anthropic.Message["content"]): string {
  const textBlock = content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new AIExtractionError("AI response did not contain text.");
  }
  return textBlock.text;
}

function invocationFromMeta(
  meta: {
    attemptCount: number;
    latencyMs: number;
    usage: AiProviderInvocation["usage"];
    model: string;
  },
  success: boolean,
  errorClass: string | null
): AiProviderInvocation {
  return {
    feature: "analyse_job",
    provider: "anthropic",
    model: meta.model,
    latencyMs: meta.latencyMs,
    attemptCount: meta.attemptCount,
    success,
    errorClass,
    usage: meta.usage,
  };
}

export async function extractFromBrief(params: {
  briefText: string;
  allowedTypes: string[];
  catalogueTypes: string[];
  mark?: (name: string) => void;
}): Promise<ExtractFromBriefResult> {
  if (params.allowedTypes.length === 0) {
    throw new AIExtractionError("No allowed work area types configured.");
  }

  const model = getAnthropicModel();
  const userPrompt = buildBriefExtractionUserPrompt(
    params.briefText,
    params.allowedTypes
  );

  try {
    params.mark?.("T4");
    const provider = await createAnthropicMessage(
      {
        model,
        max_tokens: 4096,
        temperature: 0,
        system: BRIEF_EXTRACTION_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      },
      { timeoutMs: ANALYSE_JOB_TIMEOUT_MS, label: "extractFromBrief" }
    );
    params.mark?.("T5");

    const extraction = buildBriefExtractionFromModelText({
      rawText: getTextFromResponse(provider.message.content),
      briefText: params.briefText,
      allowedTypes: params.allowedTypes,
      catalogueTypes: params.catalogueTypes,
    });
    params.mark?.("T6");

    return {
      ...extraction,
      invocation: invocationFromMeta(
        {
          attemptCount: provider.attemptCount,
          latencyMs: provider.latencyMs,
          usage: provider.usage,
          model: provider.message.model || model,
        },
        true,
        null
      ),
    };
  } catch (error) {
    const meta = getAnthropicInvocationMeta(error) ?? {
      attemptCount: 1,
      latencyMs: 0,
      usage: emptyTokenFields(),
      model,
    };
    const errorClass = classifyAnalysisError(error);

    if (error instanceof AIExtractionError) {
      const wrapped = new AIExtractionError(error.message, error.code);
      (wrapped as AIExtractionError & { invocation: AiProviderInvocation }).invocation =
        invocationFromMeta(meta, false, errorClass);
      throw wrapped;
    }
    if (isTimeoutOrAbortError(error)) {
      const wrapped = new AIExtractionError(
        ANALYSE_JOB_TIMEOUT_USER_MESSAGE,
        ANALYSE_JOB_TIMEOUT_CODE
      );
      (wrapped as AIExtractionError & { invocation: AiProviderInvocation }).invocation =
        invocationFromMeta(meta, false, errorClass);
      throw wrapped;
    }
    const wrapped = new AIExtractionError(
      error instanceof Error ? error.message : "AI extraction failed."
    );
    (wrapped as AIExtractionError & { invocation: AiProviderInvocation }).invocation =
      invocationFromMeta(meta, false, errorClass);
    throw wrapped;
  }
}

export function getExtractionInvocation(
  error: unknown
): AiProviderInvocation | null {
  if (error != null && typeof error === "object" && "invocation" in error) {
    const invocation = (error as { invocation?: AiProviderInvocation }).invocation;
    return invocation ?? null;
  }
  return null;
}
