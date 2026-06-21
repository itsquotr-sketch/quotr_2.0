import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, getAnthropicModel } from "@/lib/ai/anthropic";
import {
  validateNoteProposalExtraction,
  type NoteProposalExtractionOutput,
} from "@/lib/ai/note-proposal-schema";
import { AIExtractionError } from "@/lib/ai/schema";

const SYSTEM_PROMPT = `You are an AI estimating assistant for a building contractor. Analyse site notes in the context of an existing project scope and propose structured updates only. Output valid JSON. Do not include prose. Do not price anything. Do not generate estimate line items.

Rules:
- Propose only work area types from the allowed list.
- Propose fact keys using canonical scope templates (deck.length_m, deck.width_m, deck.material, fence.length_m, material_carry_distance is NOT a fact — use constraints).
- Do not overwrite user-entered facts unless site notes clearly contradict them; mark those as action "update" with high confidence only when explicit.
- If notes say "maybe", "confirm", or "if budget allows", prefer lower confidence or action "no_change" for conflicting updates.
- Do not invent precise measurements where notes are vague.
- For access/carry observations, propose constraint updates using keys: site_access, site_slope, material_carry_distance, working_hours.
- material_carry_distance values should be one of: "< 10m", "10–30m", "> 30m", "Not sure".
- site_access values: "Easy", "Moderate", "Difficult".
- If a work area already exists as confirmed, use action "no_change" unless notes suggest restoring an excluded area (action "restore").
- If notes mention a new scope type not yet on the project, use action "add".
- Return a concise summary of what the notes imply.`;

export type NoteAnalysisContext = {
  briefText: string | null;
  confirmedWorkAreas: { type: string; name: string; status: string }[];
  allWorkAreas: {
    id: string;
    type: string;
    name: string;
    status: string;
  }[];
  facts: {
    key: string;
    label: string;
    value: unknown;
    source: string;
    workAreaType?: string | null;
    workAreaName?: string | null;
  }[];
  constraints: { key: string; label: string; value: unknown }[];
  notes: {
    id: string;
    noteTypeLabel: string;
    sourceLabel: string;
    content: string;
    capturedAt: string;
  }[];
  allowedTypes: string[];
};

function buildUserPrompt(context: NoteAnalysisContext): string {
  const brief = context.briefText?.trim() || "(none)";

  const workAreaLines = context.confirmedWorkAreas.length
    ? context.confirmedWorkAreas.map((wa) => `* ${wa.name}`).join("\n")
    : "* (none confirmed)";

  const factLines = context.facts.length
    ? context.facts
        .map((fact) => {
          const scope = fact.workAreaName ? `${fact.workAreaName}: ` : "";
          return `* ${scope}${fact.label}: ${JSON.stringify(fact.value)} (${fact.source})`;
        })
        .join("\n")
    : "* (none)";

  const constraintLines = context.constraints.length
    ? context.constraints
        .map((c) => `* ${c.label}: ${JSON.stringify(c.value)}`)
        .join("\n")
    : "* (none)";

  const noteLines = context.notes
    .map(
      (note) =>
        `* [${note.noteTypeLabel}] (${note.sourceLabel}, ${note.capturedAt}) ${note.content}`
    )
    .join("\n");

  return `Allowed work area types: ${JSON.stringify(context.allowedTypes)}

All work areas on project (for restore detection):
${context.allWorkAreas.map((wa) => `* ${wa.name} (${wa.type}, ${wa.status})`).join("\n") || "* (none)"}

Project brief:
${brief}

Current confirmed work areas:
${workAreaLines}

Current facts:
${factLines}

Current constraints:
${constraintLines}

Site notes to analyse:
${noteLines}

Return JSON:
{
  "summary": "string",
  "confidence": 0.0,
  "workAreas": [{ "type": "string", "confidence": 0.0, "rationale": "string", "action": "add|restore|no_change" }],
  "facts": [{ "work_area_type": "string|null", "key": "string", "label": "string", "value": "string|number|boolean", "unit": "optional", "confidence": 0.0, "rationale": "string", "action": "add|update|no_change" }],
  "constraints": [{ "key": "string", "label": "string", "value": "string|number|boolean", "confidence": 0.0, "rationale": "string", "action": "add|update|no_change" }],
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
      return JSON.parse(trimmed.slice(start, end + 1));
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

export async function extractFromSiteNotes(params: {
  context: NoteAnalysisContext;
  catalogueTypes: string[];
}): Promise<NoteProposalExtractionOutput> {
  if (params.context.notes.length === 0) {
    throw new AIExtractionError("No site notes to analyse.");
  }

  try {
    const client = getAnthropicClient();
    const model = getAnthropicModel();
    const userPrompt = buildUserPrompt(params.context);

    const message = await client.messages.create({
      model,
      max_tokens: 2000,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const rawJson = extractJsonFromText(getTextFromResponse(message.content));

    return validateNoteProposalExtraction(
      rawJson,
      params.context.allowedTypes,
      params.catalogueTypes
    );
  } catch (error) {
    if (error instanceof AIExtractionError) {
      throw error;
    }
    throw new AIExtractionError(
      error instanceof Error ? error.message : "Note analysis failed."
    );
  }
}
