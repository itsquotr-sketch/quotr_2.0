import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, getAnthropicModel } from "@/lib/ai/anthropic";
import {
  AIExtractionError,
  validateAndFilterExtraction,
  type AIExtractionOutput,
} from "@/lib/ai/schema";

const SYSTEM_PROMPT = `You are an AI estimating assistant for a building contractor. Given a project brief, extract structured scope information for estimating. Output only valid JSON matching the schema. Do not include prose.

Rules:
- Only suggest work area types from the allowed list provided.
- Do not invent unsupported work area types.
- If a scope is mentioned but unsupported, include it in warnings.
- Extract measurable facts only where clearly stated in the brief.
- Do not guess exact quantities if not provided.
- Use null work_area_type for project-level facts.
- Confidence should reflect certainty from the brief (0 to 1).
- Return raw JSON only.

Demolition handling:
- If demolition/strip-out is part of a renovation scope (bathroom, kitchen, fence), do NOT suggest a separate demolition work area. Instead set the parent scope work area and a component fact such as bathroom.demolition_required, kitchen.demolition_required, or fence.demolition_required = true.
- Only suggest a standalone demolition work area when the brief clearly describes a standalone strip-out or demolition package (e.g. office soft strip, tenancy strip-out, demolish-only scope).
- Do not suggest both bathroom and demolition work areas for "bathroom renovation including demolition".
- Deck rebuild scenarios may include both deck and demolition work areas only when rebuilding is clearly included; demolish-only deck work should use demolition work area only.

Fact key rules:
- Use canonical fact keys matching scope templates (e.g. deck.length_m, deck.width_m, deck.material, deck.has_stairs, retaining_wall.length_m, retaining_wall.height_m, retaining_wall.height_high_m, retaining_wall.height_low_m, bathroom.demolition_required).
- Do not create duplicate facts with different labels for the same information.
- If length and width are provided, include both facts; do not also guess area — area will be calculated deterministically from length × width.
- For retaining walls, use retaining_wall.length_m, retaining_wall.height_m for uniform walls; use retaining_wall.height_high_m and retaining_wall.height_low_m for raking walls.
- Keep facts concise and canonical; one fact per measurable attribute.`;

function buildUserPrompt(
  briefText: string,
  allowedTypes: string[]
): string {
  return `Allowed work area types: ${JSON.stringify(allowedTypes)}

Project brief: "${briefText}"

Return only valid JSON matching this shape:
{
  "workAreas": [
    { "type": "string", "confidence": 0.0, "rationale": "string" }
  ],
  "facts": [
    {
      "work_area_type": "string or null",
      "key": "string",
      "label": "string",
      "value": "string | number | boolean",
      "unit": "string optional",
      "confidence": 0.0
    }
  ],
  "assumptions": ["string"],
  "possibleConstraints": ["string"],
  "confidence": 0.0,
  "warnings": ["string"]
}`;
}

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
    const userPrompt = buildUserPrompt(params.briefText, params.allowedTypes);

    const message = await client.messages.create({
      model,
      max_tokens: 1200,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const rawText = getTextFromResponse(message.content);
    const rawJson = extractJsonFromText(rawText);

    return validateAndFilterExtraction(
      rawJson,
      params.allowedTypes,
      params.catalogueTypes
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
