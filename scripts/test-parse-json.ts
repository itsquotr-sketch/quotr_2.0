import {
  extractJsonObject,
  parseJsonObject,
  safeParseAiJson,
  stripCodeFences,
} from "../lib/ai/parse-json";
import { noteProposalExtractionSchema } from "../lib/ai/note-proposal-schema";

const malformedWithFence = `\`\`\`json
{
  "summary": "Deck dimensions updated",
  "confidence": 0.9,
  "workAreas": [],
  "facts": [
    {
      "work_area_type": "deck",
      "key": "deck.width_m",
      "label": "Width",
      "value": 5,
      "unit": "m",
      "confidence": 0.95,
      "rationale": "Updated width",
      "action": "update"
    },
    {
      "work_area_type": "deck",
      "key": "deck.length_m",
      "label": "Length",
      "value": 11,
      "unit": "m",
      "confidence": 0.95,
      "rationale": "Updated length",
      "action": "update"
    }
  ],
  "constraints": [],
  "warnings": []
}
\`\`\``;

const trailingComma = `{
  "summary": "Test",
  "confidence": 0.9,
  "workAreas": [],
  "facts": [{"work_area_type": "deck", "key": "deck.width_m", "label": "Width", "value": 5, "confidence": 0.9, "action": "update"}],
  "constraints": [],
  "warnings": [],
}`;

const truncated = `{
  "summary": "Test",
  "facts": [
    {"work_area_type": "deck", "key": "deck.width_m", "label": "Width", "value": 5, "confidence": 0.9}
`;

function assert(label: string, ok: boolean) {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) process.exitCode = 1;
}

const fenced = parseJsonObject(malformedWithFence);
assert("parses fenced JSON", fenced.success === true);

const repaired = parseJsonObject(trailingComma);
assert("repairs trailing comma", repaired.success === true);

const truncatedResult = parseJsonObject(truncated);
assert("rejects truncated JSON", truncatedResult.success === false);

const extracted = extractJsonObject(
  'Here is the result:\n```json\n{"summary":"ok","confidence":1,"workAreas":[],"facts":[],"constraints":[],"warnings":[]}\n```\nThanks'
);
assert("extracts JSON from commentary", extracted !== null);

const validated = safeParseAiJson(
  malformedWithFence,
  noteProposalExtractionSchema
);
assert("validates deck measurement schema", validated.success === true);

if (validated.success) {
  assert(
    "includes width and length facts",
    validated.data.facts.length === 2
  );
}

console.log("\nstripCodeFences preview:", stripCodeFences(malformedWithFence).slice(0, 80));
