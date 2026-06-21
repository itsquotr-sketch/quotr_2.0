import { normaliseNoteAnalysis } from "../lib/ai/normalise-note-analysis";
import { validateNormalisedNoteAnalysis } from "../lib/ai/note-proposal-schema";

function assert(label: string, ok: boolean) {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) process.exitCode = 1;
}

const nullUnitPayload = {
  summary: "Deck dimensions updated",
  confidence: 0.9,
  workAreas: [],
  facts: [
    {
      work_area_type: "deck",
      key: "deck.width_m",
      label: "Width",
      value: 5,
      unit: null,
      confidence: 0.95,
      rationale: "Updated width",
      action: "update",
    },
    {
      work_area_type: "deck",
      key: "deck.length_m",
      label: "Length",
      value: 11,
      unit: null,
      confidence: 0.95,
      rationale: "Updated length",
      action: "update",
    },
  ],
  constraints: [],
  warnings: [],
};

const alternateFieldNames = {
  summary: "Fence added",
  proposed_work_areas: [{ type: "fence", confidence: "0.9", reason: "New scope" }],
  proposed_facts: [
    {
      workAreaType: "fence",
      key: "fence.length_m",
      proposedValue: 12,
      unit: null,
      confidence: "0.92",
    },
  ],
  proposed_constraints: [],
};

console.log("--- Null unit simulation ---");
const nullUnitResult = normaliseNoteAnalysis(nullUnitPayload);
assert("accepts null unit facts", nullUnitResult.output.facts.length === 2);
assert(
  "infers width unit m",
  nullUnitResult.output.facts[0]?.unit === "m"
);
assert(
  "infers length unit m",
  nullUnitResult.output.facts[1]?.unit === "m"
);

try {
  validateNormalisedNoteAnalysis(nullUnitResult.output);
  assert("passes internal validation", true);
} catch {
  assert("passes internal validation", false);
}

console.log("\n--- Alternate field names ---");
const altResult = normaliseNoteAnalysis(alternateFieldNames);
assert("maps proposed_work_areas", altResult.output.workAreas.length === 1);
assert("maps proposed_facts", altResult.output.facts.length === 1);
assert(
  "coerces string confidence",
  altResult.output.workAreas[0]?.confidence === 0.9
);

console.log("\n--- Skip invalid fact, keep valid ---");
const mixedPayload = {
  summary: "Mixed",
  facts: [
    { key: "deck.width_m", value: 5, work_area_type: "deck", unit: null },
    { label: "Missing key", value: 99, unit: null },
    { key: "deck.length_m", proposedValue: 11, work_area_type: "deck" },
  ],
};
const mixedResult = normaliseNoteAnalysis(mixedPayload);
assert("keeps valid facts", mixedResult.output.facts.length === 2);
assert("skips invalid fact", mixedResult.skippedCount >= 1);

console.log("\nNormalised facts:", mixedResult.output.facts);
