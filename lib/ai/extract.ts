import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import {
  ANALYSE_JOB_TIMEOUT_CODE,
  ANALYSE_JOB_TIMEOUT_MS,
  ANALYSE_JOB_TIMEOUT_USER_MESSAGE,
  isTimeoutOrAbortError,
} from "@/lib/ai/analyse-job-contract";
import { createAnthropicMessage, getAnthropicModel } from "@/lib/ai/anthropic";
import {
  BRIEF_EXTRACTION_SYSTEM_PROMPT,
  buildBriefExtractionFromModelText,
  buildBriefExtractionUserPrompt,
} from "@/lib/ai/brief-extraction-result";
import type { BriefExtractionResult } from "@/lib/ai/brief-extraction-types";
import { AIExtractionError } from "@/lib/ai/schema";

export type { BriefExtractionResult };

function getTextFromResponse(content: Anthropic.Message["content"]): string {
  const textBlock = content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new AIExtractionError("AI response did not contain text.");
  }
  return textBlock.text;
}

export async function extractFromBrief(params: {
  briefText: string;
  allowedTypes: string[];
  catalogueTypes: string[];
}): Promise<BriefExtractionResult> {
  if (params.allowedTypes.length === 0) {
    throw new AIExtractionError("No allowed work area types configured.");
  }

  try {
    const model = getAnthropicModel();
    const userPrompt = buildBriefExtractionUserPrompt(
      params.briefText,
      params.allowedTypes
    );

    const message = await createAnthropicMessage(
      {
        model,
        max_tokens: 4096,
        temperature: 0,
        system: BRIEF_EXTRACTION_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      },
      { timeoutMs: ANALYSE_JOB_TIMEOUT_MS, label: "extractFromBrief" }
    );

    return buildBriefExtractionFromModelText({
      rawText: getTextFromResponse(message.content),
      briefText: params.briefText,
      allowedTypes: params.allowedTypes,
      catalogueTypes: params.catalogueTypes,
    });
  } catch (error) {
    if (error instanceof AIExtractionError) {
      throw error;
    }
    if (isTimeoutOrAbortError(error)) {
      throw new AIExtractionError(
        ANALYSE_JOB_TIMEOUT_USER_MESSAGE,
        ANALYSE_JOB_TIMEOUT_CODE
      );
    }
    throw new AIExtractionError(
      error instanceof Error ? error.message : "AI extraction failed."
    );
  }
}
