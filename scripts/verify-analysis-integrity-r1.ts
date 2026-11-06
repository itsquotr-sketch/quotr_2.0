/**
 * Deterministic proof for the analysis-integrity repair.
 * Replays briefs through enrichment. No model call.
 */
import { readFileSync } from "node:fs";
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import { coerceExtractionPayload, validateAndFilterExtraction } from "../lib/ai/schema";
import { parseJsonObject } from "../lib/ai/parse-json";
import { SCOPE_CATALOGUE } from "../lib/scopes/catalogue";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";
import { normaliseAIExtraction } from "../lib/scopes/normalise-extracted-facts";
import { stripImplicitScopeExclusions } from "../lib/scopes/strip-implicit-scope-exclusions";
import type { AIExtractionOutput } from "../lib/ai/schema";
import { briefHasIndependentFlooring, briefHasExplicitInternalWalls } from "../lib/work-areas/ownership";
import { extractDoorPortionsFromBrief } from "../lib/estimate/doors-brief";
import { deckScopeIntent } from "../lib/estimate/scope-intent";
import { reanalysisFactWrite } from "../lib/ai/mappers";

const allowed = getAnalysisCapableWorkAreaTypes();
const catalogue = SCOPE_CATALOGUE.map((item) => item.type);
let failed = 0;

function check(name: string, ok: boolean, detail?: string): void {
  if (ok) {
    console.log("ok", name);
    return;
  }
  failed += 1;
  console.log("FAIL", name, detail ?? "");
}

function emptyExtraction(): AIExtractionOutput {
  return {
    workAreas: [],
    facts: [],
    assumptions: [],
    possibleConstraints: [],
    confidence: 0.5,
    warnings: [],
  };
}

function run(brief: string) {
  const enriched = enrichExtractionFromBrief({
    briefText: brief,
    extraction: emptyExtraction(),
    allowedTypes: allowed,
  });
  const output = stripImplicitScopeExclusions(
    normaliseAIExtraction(
      validateAndFilterExtraction(enriched.extraction, allowed, catalogue)
    ),
    brief
  );
  return output;
}

function portions(output: AIExtractionOutput, key: string): Record<string, unknown>[] {
  const fact = output.facts.find((row) => row.key === key);
  return Array.isArray(fact?.value) ? (fact.value as Record<string, unknown>[]) : [];
}

const laminate =
  "Empty room 6 m by 5 m. The concrete is bare, clean, dry and ready. Supply and install 30 square metres of laminate, with underlay and 10% waste on the laminate. No skirting. No floor preparation, demolition or disposal. Ground floor, normal weekday access.";
const partition =
  "Non-loadbearing timber stud wall, 2400 mm high by 6 m long. One standard internal door opening. Both faces in standard plasterboard, with the cavity insulated. Supply the door, jamb, hinges and handle. Stop the plasterboard ready to paint. Painting, electrical and skirting are excluded. Access is on the ground floor.";
const conflict =
  "Vinyl floor. The room measures 5 metres by 4 metres, and the flooring area is also given as 32 m². Prepare the quote from both the room dimensions and the stated area. Allow 10% material waste.";
const threeRoom =
  "Hall 8000 mm by 1200 mm, vinyl planks. Bedroom two is 4.2 m by 3.5 m and gets carpet. Bedroom one is 3.6 m by 3.2 m and gets carpet. Take up and dispose of the existing carpet in each of the three rooms. Include underlay where it belongs, transition strips, and 10 percent waste on the new coverings. Do not replace the skirting. No major subfloor repairs.";
const lowDeck =
  "Platform 4.8 m by 3.6 m, finished height 450 mm. Decking boards are 90 mm wide with a 5 mm gap. Include the substructure, the fixings and 10% waste on the boards. No stairs, no balustrade, no demolition and no painting. Ask where a missing specification would change the price.";

const laminateOut = run(laminate);
const laminateAreas = laminateOut.workAreas.map((row) => row.type);
const laminatePortion = portions(laminateOut, "flooring.portions")[0];
check("laminate stays flooring", laminateAreas.includes("flooring") && laminateAreas.length === 1, laminateAreas.join(","));
check(
  "laminate waste and agreeing area",
  laminatePortion?.waste_percent === 10 &&
    laminatePortion?.area_m2 === 30 &&
    laminatePortion?.length_m === 6 &&
    laminatePortion?.width_m === 5 &&
    laminatePortion?.specialist_kind === "laminate",
  JSON.stringify(laminatePortion)
);

const partitionOut = run(partition);
const partitionTypes = partitionOut.workAreas.map((row) => row.type).sort();
const door = portions(partitionOut, "doors.portions")[0];
const wallHeight = partitionOut.facts.find((row) => row.key === "internal_walls.height_m")?.value;
const wallLength = partitionOut.facts.find((row) => row.key === "internal_walls.length_lm")?.value;
check(
  "partition keeps wall and door",
  partitionTypes.includes("doors") && partitionTypes.includes("internal_walls") && !partitionTypes.includes("plastering"),
  partitionTypes.join(",")
);
check("wall height stored on the wall", wallHeight === 2.4, String(wallHeight));
check("wall length stored", wallLength === 6, String(wallLength));
check(
  "door height is not the wall height",
  door?.height_mm !== 2400 && door?.height_authority !== "extracted",
  JSON.stringify({ height: door?.height_mm, authority: door?.height_authority })
);

const conflictOut = run(conflict);
const conflictPortion = portions(conflictOut, "flooring.portions")[0];
check(
  "conflict keeps both measures and no method",
  conflictOut.workAreas.length === 1 &&
    conflictPortion?.length_m === 5 &&
    conflictPortion?.width_m === 4 &&
    conflictPortion?.area_m2 === 32 &&
    conflictPortion?.area_input_method == null &&
    conflictPortion?.waste_percent === 10,
  JSON.stringify(conflictPortion)
);

const rooms = portions(run(threeRoom), "flooring.portions");
check(
  "three rooms keep identities and waste",
  rooms.length === 3 &&
    rooms.every((row) => row.waste_percent === 10) &&
    new Set(rooms.map((row) => `${row.length_m}x${row.width_m}`)).size === 3,
  JSON.stringify(rooms.map((row) => ({ label: row.label, length: row.length_m, width: row.width_m, waste: row.waste_percent })))
);

const deckIntent = deckScopeIntent(lowDeck, null);
check(
  "low deck waste stays on the deck",
  deckIntent.upserts.some((row) => row.key === "deck.board_waste_percent" && row.value === 10) &&
    !run(lowDeck).facts.some((row) => row.key === "flooring.portions"),
  JSON.stringify(deckIntent.upserts.map((row) => row.key))
);

const labelledDoor = extractDoorPortionsFromBrief(
  "Supply and install one 1980mm high by 810mm wide prehung hollow-core door."
);
check(
  "labelled door height still extracts",
  labelledDoor[0]?.height_mm === 1980 && labelledDoor[0]?.height_authority === "extracted"
);

check(
  "laminate benchtop is not flooring",
  briefHasIndependentFlooring("Replace the laminate benchtops and kitchen cabinets.") === false
);
check(
  "stud wall is an internal wall",
  briefHasExplicitInternalWalls(partition) === true
);

const mixed = run(
  "Supply and install vinyl plank flooring in the living room, 4 m by 3 m, with 10% waste on the flooring. Separately, build a deck 5 m by 2 m with no stated board waste."
);
const mixedFloor = portions(mixed, "flooring.portions")[0];
const mixedDeckWaste = mixed.facts.find((row) => row.key === "deck.board_waste_percent");
check(
  "floor waste is not copied onto the deck",
  mixed.workAreas.some((row) => row.type === "flooring") &&
    mixed.workAreas.some((row) => row.type === "deck") &&
    mixedFloor?.waste_percent === 10 &&
    mixedDeckWaste == null,
  JSON.stringify({ floor: mixedFloor?.waste_percent, deck: mixedDeckWaste?.value, areas: mixed.workAreas.map((row) => row.type) })
);

const elevated = run(
  "Replace an existing elevated timber deck approximately 5.2m x 3.1m and around 1.2m above ground. Existing hardwood decking and framing are to be removed. Existing piles may be retained if sound after inspection. Install new hardwood decking. No balustrade is requested."
);
check(
  "conditional piles stay unresolved",
  elevated.facts.some(
    (row) =>
      row.key === "deck.substructure_condition" &&
      String(row.value).includes("inspection")
  ) && !elevated.facts.some((row) => row.key === "deck.pile_or_post_replacement_required" && row.value === true)
);

const kept = reanalysisFactWrite({
  existingSource: "user",
  existingValue: "length_width",
  extractedValue: "direct_m2",
});
check("protected user answer is kept", kept.action === "keep");

const paraphrases = JSON.parse(
  readFileSync(
    "C:/Users/Admin/Desktop/quotr-v3-analysis-integrity-evidence/01-paraphrase-expectations.json",
    "utf8"
  )
) as { paraphrases: { id: string; text: string }[] };

for (const item of paraphrases.paraphrases) {
  const output = run(item.text);
  const types = output.workAreas.map((row) => row.type);
  if (item.id === "laminate-flooring") {
    const portion = portions(output, "flooring.portions")[0];
    check(
      "paraphrase laminate",
      types.includes("flooring") &&
        portion?.length_m === 6 &&
        portion?.width_m === 5 &&
        portion?.area_m2 === 30 &&
        portion?.waste_percent === 10 &&
        portion?.area_input_method === "direct_m2",
      JSON.stringify(portion)
    );
  }
  if (item.id === "internal-partition") {
    const doorPortion = portions(output, "doors.portions")[0];
    check(
      "paraphrase partition",
      types.includes("internal_walls") &&
        types.includes("doors") &&
        output.facts.find((row) => row.key === "internal_walls.height_m")?.value === 2.4 &&
        output.facts.find((row) => row.key === "internal_walls.length_lm")?.value === 6 &&
        doorPortion?.height_mm !== 2400,
      JSON.stringify({ types, door: doorPortion?.height_mm, authority: doorPortion?.height_authority })
    );
  }
  if (item.id === "conflicting-flooring-area") {
    const portion = portions(output, "flooring.portions")[0];
    check(
      "paraphrase conflict",
      portion?.length_m === 5 &&
        portion?.width_m === 4 &&
        portion?.area_m2 === 32 &&
        portion?.area_input_method == null &&
        portion?.waste_percent === 10,
      JSON.stringify(portion)
    );
  }
  if (item.id === "three-room-flooring") {
    const rows = portions(output, "flooring.portions");
    check(
      "paraphrase three rooms",
      rows.length === 3 && rows.every((row) => row.waste_percent === 10),
      JSON.stringify(rows.map((row) => [row.label, row.length_m, row.width_m, row.waste_percent]))
    );
  }
  if (item.id === "low-deck") {
    check(
      "paraphrase low deck",
      types.includes("deck") &&
        !types.includes("flooring") &&
        output.facts.find((row) => row.key === "deck.length_m")?.value === 4.8 &&
        output.facts.find((row) => row.key === "deck.board_waste_percent")?.value === 10,
      JSON.stringify(output.facts.filter((row) => row.work_area_type === "deck").map((row) => [row.key, row.value]))
    );
  }
}

const evidence = "C:/Users/Admin/Desktop/quotr-v3-quality-evidence/runs/variation-laminate-flooring-r1.json";
const saved = JSON.parse(readFileSync(evidence, "utf8")) as { rawText: string };
const parsed = parseJsonObject(saved.rawText);
check("checkpoint laminate raw still parses", parsed.success);
if (parsed.success) {
  const coerced = coerceExtractionPayload(parsed.data);
  const again = enrichExtractionFromBrief({
    briefText: laminate,
    extraction: coerced,
    allowedTypes: allowed,
  });
  check(
    "saved laminate model output is kept as flooring",
    again.extraction.workAreas.some((row) => row.type === "flooring")
  );
}

for (const [file, brief, expectType] of [
  ["variation-internal-partition-r1.json", partition, "internal_walls"],
  ["variation-conflicting-flooring-area-r1.json", conflict, "flooring"],
] as const) {
  const row = JSON.parse(
    readFileSync(`C:/Users/Admin/Desktop/quotr-v3-quality-evidence/runs/${file}`, "utf8")
  ) as { rawText: string };
  const raw = parseJsonObject(row.rawText);
  if (!raw.success) {
    check(`${file} parses`, false);
    continue;
  }
  const again = enrichExtractionFromBrief({
    briefText: brief,
    extraction: coerceExtractionPayload(raw.data),
    allowedTypes: allowed,
  });
  check(
    `${file} keeps ${expectType}`,
    again.extraction.workAreas.some((area) => area.type === expectType)
  );
}

if (failed > 0) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nall deterministic checks passed");
