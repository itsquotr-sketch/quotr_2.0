import {
  BRIEF_EXTRACTION_SYSTEM_PROMPT,
  buildBriefExtractionUserPrompt,
} from "@/lib/ai/brief-extraction-prompt";
import { enrichExtractionFromBrief } from "@/lib/ai/enrich-extraction";
import { parseJsonObject, previewAiResponse } from "@/lib/ai/parse-json";
import {
  AIExtractionError,
  coerceExtractionPayload,
  validateAndFilterExtraction,
  type AIExtractionOutput,
} from "@/lib/ai/schema";
import type { BriefExtractionResult } from "@/lib/ai/brief-extraction-types";
import { normaliseAIExtraction } from "@/lib/scopes/normalise-extracted-facts";
import { stripImplicitScopeExclusions } from "@/lib/scopes/strip-implicit-scope-exclusions";

export { BRIEF_EXTRACTION_SYSTEM_PROMPT, buildBriefExtractionUserPrompt };

function extractJsonFromText(text: string): unknown {
  const parsed = parseJsonObject(text);
  if (!parsed.success) {
    throw new AIExtractionError(
      `Failed to parse AI response as JSON. Preview: ${previewAiResponse(text, 120)}`
    );
  }
  return parsed.data;
}

/**
 * Deterministic post-model pipeline for Analyse Job.
 * No network. Used by extractFromBrief and fixture verifiers.
 */
export function buildBriefExtractionFromModelText(params: {
  rawText: string;
  briefText: string;
  allowedTypes: string[];
  catalogueTypes: string[];
}): BriefExtractionResult {
  const rawJson = extractJsonFromText(params.rawText);
  const coerced = coerceExtractionPayload(rawJson);
  const enriched = enrichExtractionFromBrief({
    briefText: params.briefText,
    extraction: coerced,
    allowedTypes: params.allowedTypes,
  });

  const output = stripImplicitScopeExclusions(
    normaliseAIExtraction(
      validateAndFilterExtraction(
        enriched.extraction,
        params.allowedTypes,
        params.catalogueTypes
      )
    ),
    params.briefText
  );

  return {
    output,
    qualityLevel: enriched.qualityLevel,
    constraints: enriched.constraints,
  };
}

export type { AIExtractionOutput };
