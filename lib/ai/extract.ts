import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import {
  BRIEF_EXTRACTION_SYSTEM_PROMPT,
  buildBriefExtractionUserPrompt,
} from "@/lib/ai/brief-extraction-prompt";
import { getAnthropicClient, getAnthropicModel } from "@/lib/ai/anthropic";
import { withAnthropicRetry } from "@/lib/ai/retry";
import {
  AIExtractionError,
  validateAndFilterExtraction,
  type AIExtractionOutput,
} from "@/lib/ai/schema";
import { normaliseAIExtraction } from "@/lib/scopes/normalise-extracted-facts";

function extractJsonFromText(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        throw new AIExtractionError("Failed to parse AI response as JSON.");
      }
    }
    throw new AIExtractionError("Failed to parse AI response as JSON.");
  }
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
}): Promise<AIExtractionOutput> {
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
          max_tokens: 2048,
          temperature: 0,
          system: BRIEF_EXTRACTION_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
        }),
      { label: "extractFromBrief" }
    );

    const rawText = getTextFromResponse(message.content);
    const rawJson = extractJsonFromText(rawText);

    return normaliseAIExtraction(
      validateAndFilterExtraction(
        rawJson,
        params.allowedTypes,
        params.catalogueTypes
      )
    );
  } catch (error) {
    if (error instanceof AIExtractionError) {
      throw error;
    }
    throw new AIExtractionError(
      error instanceof Error ? error.message : "AI extraction failed."
    );
  }
}
