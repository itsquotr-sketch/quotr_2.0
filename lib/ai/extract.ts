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
- Recognise demolition, strip-out, removal, rip out, internal wall removal, flooring removal, ceiling removal, kitchen/bathroom strip-out, house internal demolition.
- If demolition/strip-out is part of a renovation scope (bathroom, kitchen, fence), do NOT suggest a separate demolition work area unless the brief clearly describes additional standalone demolition beyond the parent scope.
- For standalone demolition (e.g. "demolition of house internal walls and flooring"), suggest demolition work area and facts: demolition.scope_items (array), demolition.area_m2 where stated.
- Set parent scope demolition facts (bathroom.demolition_required, etc.) when demolition is embedded in a reno package.

Fact key rules:
- Use canonical fact keys matching scope templates.
- Deck: deck.length_m, deck.width_m, deck.height_m, deck.board_material, deck.board_width_mm, deck.access_type, deck.vertical_face_boards_required, deck.balustrade_required, deck.existing_deck_removal, deck.has_gate (fence: fence.length_m, fence.height_m, fence.material, fence.has_gate).
- Retaining wall: retaining_wall.length_m, retaining_wall.height_m, retaining_wall.is_raking, retaining_wall.height_high_m, retaining_wall.height_low_m, retaining_wall.fixing_type, retaining_wall.drainage_required, retaining_wall.drain_connection_required, retaining_wall.backfill_included.
- Bathroom: bathroom.area_m2, bathroom.fixtures_client_supplied, bathroom.fixtures_included (array), bathroom.underfloor_heating_included, bathroom.waterproofing_included, bathroom.tiling_included.
- Kitchen: kitchen.flooring_included, kitchen.fixtures_client_supplied, kitchen.plumbing_changes, kitchen.electrical_changes.
- Demolition: demolition work area for standalone strip-out; demolition.scope_items (array: internal_walls, flooring, ceilings, etc.).
- Recognise phrases: "demolition of house internal walls and flooring", "strip out", "rip out", "internal wall removal", "flooring removal".
- Internal fitout: internal_walls.*, ceilings.*, doors.*, flooring.*, painting.*, plastering.*.
- External stairs: external_stairs.risers_count, external_stairs.handrail_included.
- Legacy keys still accepted: deck.material, deck.has_stairs, deck.has_balustrade, deck.demolition_required, bathroom.waterproofing_required, demolition.waste_removal_required.
- Do not create duplicate facts with different labels for the same information.
- If length and width are provided, include both facts; do not also guess area — area will be calculated deterministically from length × width.
- For retaining walls, use retaining_wall.length_m, retaining_wall.height_m for uniform walls; use retaining_wall.is_raking=true with retaining_wall.height_high_m and retaining_wall.height_low_m for raking walls.
- "2m timber fence with a gate" → fence.height_m=2, fence.material=timber, fence.has_gate=true.
- "raking wall from 1m down to 400mm" → retaining_wall.is_raking=true, retaining_wall.height_high_m=1, retaining_wall.height_low_m=0.4.
- "deck needs vertical boards down the face" → deck.vertical_face_boards_required=true.
- "bathroom fixtures supplied by client" → bathroom.fixtures_client_supplied=true.
- "Demolition of house internal walls and flooring" → demolition work area + demolition.scope_items including internal_walls and flooring.
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
