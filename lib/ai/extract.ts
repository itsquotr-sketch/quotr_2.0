import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import {
  BRIEF_EXTRACTION_SYSTEM_PROMPT,
  buildBriefExtractionUserPrompt,
} from "@/lib/ai/brief-extraction-prompt";
import { getAnthropicClient, getAnthropicModel } from "@/lib/ai/anthropic";
import { withAnthropicRetry } from "@/lib/ai/retry";
import { enrichExtractionFromBrief } from "@/lib/ai/enrich-extraction";
import { parseJsonObject, previewAiResponse } from "@/lib/ai/parse-json";
import {
  AIExtractionError,
  coerceExtractionPayload,
  validateAndFilterExtraction,
  type AIExtractionOutput,
} from "@/lib/ai/schema";
import { normaliseAIExtraction } from "@/lib/scopes/normalise-extracted-facts";

export type BriefExtractionResult = {
  output: AIExtractionOutput;
  qualityLevel: ReturnType<typeof enrichExtractionFromBrief>["qualityLevel"];
  constraints: ReturnType<typeof enrichExtractionFromBrief>["constraints"];
};

function extractJsonFromText(text: string): unknown {
  const parsed = parseJsonObject(text);
  if (!parsed.success) {
    throw new AIExtractionError(
      `Failed to parse AI response as JSON. Preview: ${previewAiResponse(text, 120)}`
    );
  }
  return parsed.data;
}

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
    const client = getAnthropicClient();
    const model = getAnthropicModel();
    const userPrompt = buildBriefExtractionUserPrompt(
      params.briefText,
      params.allowedTypes
    );

    const message = await withAnthropicRetry(
      () =>
        client.messages.create({
          model,
          max_tokens: 4096,
          temperature: 0,
          system: BRIEF_EXTRACTION_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
        }),
      { label: "extractFromBrief" }
    );

    const rawText = getTextFromResponse(message.content);
    const rawJson = extractJsonFromText(rawText);
    const coerced = coerceExtractionPayload(rawJson);
    const enriched = enrichExtractionFromBrief({
      briefText: params.briefText,
      extraction: coerced,
      allowedTypes: params.allowedTypes,
    });

    const output = normaliseAIExtraction(
      validateAndFilterExtraction(
        enriched.extraction,
        params.allowedTypes,
        params.catalogueTypes
      )
    );

    return {
      output,
      qualityLevel: enriched.qualityLevel,
      constraints: enriched.constraints,
    };
  } catch (error) {
    if (error instanceof AIExtractionError) {
      throw error;
    }
    throw new AIExtractionError(
      error instanceof Error ? error.message : "AI extraction failed."
    );
  }
}
