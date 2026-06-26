import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, getAnthropicModel } from "@/lib/ai/anthropic";
import { withAnthropicRetry } from "@/lib/ai/retry";
import {
  NOTE_ANALYSIS_NO_UPDATES_MESSAGE,
  validateNoteProposalExtraction,
  type NoteProposalExtractionOutput,
} from "@/lib/ai/note-proposal-schema";
import { normaliseNoteAnalysis } from "@/lib/ai/normalise-note-analysis";
import { parseJsonObject, previewAiResponse, stripCodeFences } from "@/lib/ai/parse-json";
import { AIExtractionError } from "@/lib/ai/schema";
import { normalizeNoteProposalFacts } from "@/lib/project-notes/proposals/normalize-facts";

export const NOTE_ANALYSIS_PARSE_USER_MESSAGE =
  "Quotr could not read the note analysis response. Please try analysing again.";
export const NOTE_ANALYSIS_RETRY_USER_MESSAGE =
  "Try shortening the note or splitting it into separate notes.";
export { NOTE_ANALYSIS_NO_UPDATES_MESSAGE };

const SYSTEM_PROMPT = `You are an AI estimating assistant for a building contractor. Analyse site notes in the context of an existing project scope and propose structured updates only.

CRITICAL OUTPUT RULES:
- Return valid JSON only.
- Do not include markdown, code fences, comments, or prose outside the JSON object.
- Do not use trailing commas in arrays or objects.
- Every string must use double quotes.
- Use numbers (not strings) for numeric measurements.
- For length/width/height facts use unit "m". For area use "m²".
- If a fact has no unit, omit the unit field entirely — do not return "unit": null.
- Keep the response concise — only include actionable proposals.

Scope rules:
- Propose only work area types from the allowed list.
- Use canonical fact keys for all outdoor scopes.
- Deck: deck.length_m, deck.width_m, deck.board_material, deck.board_width_mm, deck.height_m, deck.level, deck.access_type, deck.balustrade_required, deck.vertical_face_boards_required, deck.existing_deck_removal, deck.access.
- Fence: fence.length_m, fence.height_m, fence.material, fence.gate_included, fence.gate_count, fence.demolition_required, fence.disposal_required, fence.access, fence.slope_condition.
- Pergola: pergola.length_m, pergola.width_m, pergola.material, pergola.attached, pergola.roofing_included, pergola.roofing_type, pergola.footings_required, pergola.gutters_included, pergola.access.
- Retaining wall: retaining_wall.length_m, retaining_wall.height_m, retaining_wall.is_raking, retaining_wall.height_high_m, retaining_wall.height_low_m, retaining_wall.fixing_type, retaining_wall.material, retaining_wall.drainage_required, retaining_wall.drain_connection_required, retaining_wall.backfill_included, retaining_wall.backfill_depth_m, retaining_wall.carting_distance_m, retaining_wall.access.
- Never propose deck.area_m2 or pergola.area_m2 — area is calculated from length × width.
- When a note updates dimensions, propose separate length and width facts, not a combined dimension string.
- material_carry_distance is a constraint key, not a fact.
- Do not invent precise measurements from vague notes ("might be bigger" → no dimension facts).
- Do not price anything or generate estimate line items.

Measurement update example:
Existing: deck.length_m=10, deck.width_m=4
Note: "Deck measurements updated to 5m wide by 11m long."
Return two facts:
{ "work_area_type": "deck", "key": "deck.width_m", "label": "Width", "value": 5, "unit": "m", "action": "update", "confidence": 0.95, "rationale": "Site note says deck width updated to 5m." }
{ "work_area_type": "deck", "key": "deck.length_m", "label": "Length", "value": 11, "unit": "m", "action": "update", "confidence": 0.95, "rationale": "Site note says deck length updated to 11m." }

Constraint keys: site_access, site_slope, material_carry_distance, working_hours.
material_carry_distance values: "< 10m", "10–30m", "> 30m", "Not sure".
site_access values: "Easy", "Moderate", "Difficult".`;

const RETRY_SUFFIX = `

Your previous response was invalid JSON. Return valid JSON only matching the schema below. No markdown. No commentary. No trailing commas.`;

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

function buildUserPrompt(context: NoteAnalysisContext, retry = false): string {
  const brief = context.briefText?.trim() || "(none)";

  const workAreaLines = context.confirmedWorkAreas.length
    ? context.confirmedWorkAreas.map((wa) => `* ${wa.name}`).join("\n")
    : "* (none confirmed)";

  const factLines = context.facts.length
    ? context.facts
        .map((fact) => {
          const scope = fact.workAreaName ? `${fact.workAreaName}: ` : "";
          return `* ${scope}${fact.key} (${fact.label}): ${JSON.stringify(fact.value)} (${fact.source})`;
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
      (note, index) =>
        `${index + 1}. [${note.noteTypeLabel}] ${note.content}`
    )
    .join("\n");

  return `Allowed work area types: ${JSON.stringify(context.allowedTypes)}

All work areas on project (for restore detection):
${context.allWorkAreas.map((wa) => `* ${wa.name} (${wa.type}, ${wa.status})`).join("\n") || "* (none)"}

Project brief:
${brief}

Current confirmed work areas:
${workAreaLines}

Current facts (use matching keys for updates):
${factLines}

Current constraints:
${constraintLines}

Site notes to analyse:
${noteLines}

Return JSON only:
{
  "summary": "string",
  "confidence": 0.0,
  "workAreas": [{ "type": "string", "confidence": 0.0, "rationale": "string", "action": "add|restore|no_change" }],
  "facts": [{ "work_area_type": "string|null", "key": "string", "label": "string", "value": "number|string|boolean", "unit": "m", "confidence": 0.0, "rationale": "string", "action": "add|update|no_change" }],
  "constraints": [{ "key": "string", "label": "string", "value": "string", "confidence": 0.0, "rationale": "string", "action": "add|update|no_change" }],
  "warnings": ["string"]
}${retry ? RETRY_SUFFIX : ""}`;
}

function getTextFromResponse(content: Anthropic.Message["content"]): string {
  const textBlock = content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new AIExtractionError(
      "AI response did not contain text.",
      "NOTE_ANALYSIS_EMPTY"
    );
  }
  return textBlock.text;
}

function logNoteAnalysisFailure(
  projectId: string | undefined,
  context: {
    noteCount: number;
    responseLength: number;
    responsePreview: string;
    reason: string;
    stage?: string;
  }
) {
  console.error("[extractFromSiteNotes]", {
    projectId,
    noteCount: context.noteCount,
    responseLength: context.responseLength,
    responsePreview: context.responsePreview,
    model: getAnthropicModel(),
    stage: context.stage,
    reason: context.reason,
  });
}

async function requestNoteAnalysis(
  userPrompt: string
): Promise<
  | {
      ok: true;
      rawText: string;
      parsed: NoteProposalExtractionOutput;
      skippedCount: number;
      normalisationWarnings: string[];
    }
  | { ok: false; rawText: string; error: string; code: string }
> {
  const client = getAnthropicClient();
  const model = getAnthropicModel();

  const message = await withAnthropicRetry(
    () =>
      client.messages.create({
        model,
        max_tokens: 4096,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    { label: "extractFromSiteNotes" }
  );

  const rawText = getTextFromResponse(message.content);
  const jsonResult = parseJsonObject(rawText);

  if (!jsonResult.success) {
    return {
      ok: false,
      rawText,
      error: jsonResult.error,
      code: "NOTE_ANALYSIS_PARSE",
    };
  }

  const normalised = normaliseNoteAnalysis(jsonResult.data);

  if (
    normalised.output.workAreas.length === 0 &&
    normalised.output.facts.length === 0 &&
    normalised.output.constraints.length === 0
  ) {
    return {
      ok: false,
      rawText,
      error:
        normalised.skippedCount > 0
          ? `No valid proposal items after skipping ${normalised.skippedCount} invalid item(s).`
          : "No proposal items in AI response.",
      code: "NOTE_ANALYSIS_NO_UPDATES",
    };
  }

  try {
    const cleaned = normalizeNoteProposalFacts(normalised.output);
    return {
      ok: true,
      rawText,
      parsed: cleaned,
      skippedCount: normalised.skippedCount,
      normalisationWarnings: normalised.warnings,
    };
  } catch (error) {
    return {
      ok: false,
      rawText,
      error: error instanceof Error ? error.message : "Normalisation failed.",
      code: "NOTE_ANALYSIS_INTERNAL",
    };
  }
}

export async function extractFromSiteNotes(params: {
  context: NoteAnalysisContext;
  catalogueTypes: string[];
  projectId?: string;
}): Promise<NoteProposalExtractionOutput> {
  if (params.context.notes.length === 0) {
    throw new AIExtractionError("No site notes to analyse.", "NOTE_ANALYSIS_EMPTY");
  }

  const noteCount = params.context.notes.length;

  try {
    let result = await requestNoteAnalysis(buildUserPrompt(params.context));

    if (!result.ok) {
      logNoteAnalysisFailure(params.projectId, {
        noteCount,
        responseLength: stripCodeFences(result.rawText).length,
        responsePreview: previewAiResponse(result.rawText),
        reason: `first attempt failed: ${result.error}`,
        stage: result.code,
      });

      if (result.code === "NOTE_ANALYSIS_NO_UPDATES") {
        throw new AIExtractionError(
          NOTE_ANALYSIS_NO_UPDATES_MESSAGE,
          "NOTE_ANALYSIS_NO_UPDATES"
        );
      }

      const retryResult = await requestNoteAnalysis(
        buildUserPrompt(params.context, true)
      );

      if (!retryResult.ok) {
        logNoteAnalysisFailure(params.projectId, {
          noteCount,
          responseLength: stripCodeFences(retryResult.rawText).length,
          responsePreview: previewAiResponse(retryResult.rawText),
          reason: `retry failed: ${retryResult.error}`,
          stage: retryResult.code,
        });

        if (retryResult.code === "NOTE_ANALYSIS_NO_UPDATES") {
          throw new AIExtractionError(
            NOTE_ANALYSIS_NO_UPDATES_MESSAGE,
            "NOTE_ANALYSIS_NO_UPDATES"
          );
        }

        throw new AIExtractionError(
          NOTE_ANALYSIS_RETRY_USER_MESSAGE,
          "NOTE_ANALYSIS_PARSE_RETRY"
        );
      }

      result = retryResult;
    }

    if (!result.ok) {
      throw new AIExtractionError(
        NOTE_ANALYSIS_PARSE_USER_MESSAGE,
        "NOTE_ANALYSIS_PARSE"
      );
    }

    if (process.env.NODE_ENV === "development") {
      console.info("[extractFromSiteNotes]", {
        projectId: params.projectId,
        noteCount,
        responseLength: stripCodeFences(result.rawText).length,
        responsePreview: previewAiResponse(result.rawText),
        skippedCount: result.skippedCount,
        normalisationWarnings: result.normalisationWarnings.slice(0, 5),
      });
    }

    return validateNoteProposalExtraction(
      result.parsed,
      params.context.allowedTypes,
      params.catalogueTypes
    );
  } catch (error) {
    if (error instanceof AIExtractionError) {
      if (
        error.code === "NOTE_ANALYSIS_PARSE" ||
        error.code === "NOTE_ANALYSIS_SCHEMA" ||
        error.code === "NOTE_ANALYSIS_INTERNAL"
      ) {
        throw new AIExtractionError(
          NOTE_ANALYSIS_PARSE_USER_MESSAGE,
          error.code
        );
      }
      throw error;
    }

    const message = error instanceof Error ? error.message : "Note analysis failed.";
    if (message.includes("ANTHROPIC_API_KEY")) {
      throw new AIExtractionError(
        "AI setup is missing. Check your Anthropic API key.",
        "NOTE_ANALYSIS_SETUP"
      );
    }

    throw new AIExtractionError(message, "NOTE_ANALYSIS_UNKNOWN");
  }
}
