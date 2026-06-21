import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, getAnthropicModel } from "@/lib/ai/anthropic";
import {
  AIExtractionError,
  validateAndFilterExtraction,
  type AIExtractionOutput,
} from "@/lib/ai/schema";

const SYSTEM_PROMPT = `You are an AI estimating assistant for a building contractor. Given a project brief and optional site notes, extract structured scope information for estimating. Output only valid JSON matching the schema. Do not include prose.

Rules:
- Only suggest work area types from the allowed list provided.
- Do not invent unsupported work area types.
- If a scope is mentioned but unsupported, include it in warnings.
- Extract measurable facts only where clearly stated in the brief or site notes.
- Do not guess exact quantities if not provided.
- Do not price or estimate costs — extract scope only.
- Use null work_area_type for project-level facts and access/site constraints.
- Confidence should reflect certainty from the source text (0 to 1).
- Return raw JSON only.

Site notes handling:
- Site notes may be short, disjoint snippets — each can describe a different work area or constraint.
- Identify all distinct work areas mentioned across the brief and notes (e.g. deck, fence, pergola from separate notes).
- Access or site-condition notes (e.g. poor access, long carry distance) should appear in possibleConstraints and/or as project-level facts where appropriate.
- Material preferences and dimensions in notes should become facts on the relevant work area.
- Subcontractor requirements may be listed in assumptions, not as priced facts.
- If the project brief says "(none)" or "No separate project brief provided.", rely on site notes.

Demolition handling:
- If demolition/strip-out is part of a renovation scope (bathroom, kitchen, fence), do NOT suggest a separate demolition work area. Instead set the parent scope work area and a component fact such as bathroom.demolition_required, kitchen.demolition_required, or fence.demolition_required = true.
- Only suggest a standalone demolition work area when the brief clearly describes a standalone strip-out or demolition package (e.g. office soft strip, tenancy strip-out, demolish-only scope).
- Do not suggest both bathroom and demolition work areas for "bathroom renovation including demolition".
- Deck rebuild scenarios may include both deck and demolition work areas only when rebuilding is clearly included; demolish-only deck work should use demolition work area only.

Fact key rules:
- Use canonical fact keys matching scope templates (e.g. deck.length_m, deck.width_m, deck.material, deck.has_stairs, deck.has_balustrade, deck.pile_count, fence.length_m, fence.height_m, fence.has_gate, pergola.material, pergola.has_roof, retaining_wall.length_m, retaining_wall.height_m, retaining_wall.height_high_m, retaining_wall.height_low_m, bathroom.demolition_required).
- Do not create duplicate facts with different labels for the same information.
- If length and width are provided, include both facts; do not also guess area — area will be calculated deterministically from length × width.
- For retaining walls, use retaining_wall.length_m, retaining_wall.height_m for uniform walls; use retaining_wall.height_high_m and retaining_wall.height_low_m for raking walls.
- Keep facts concise and canonical; one fact per measurable attribute.`;

function buildUserPrompt(
  sourceText: string,
  allowedTypes: string[]
): string {
  return `Allowed work area types: ${JSON.stringify(allowedTypes)}

Project brief and site notes:
"""
${sourceText}
"""

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
      max_tokens: 2048,
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
