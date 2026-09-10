/**
 * EF02-B — Harden Internal Walls extraction against realistic raw LLM output.
 *
 * The prior verify scripts (verify-brief-fidelity-internal-walls-r1.ts,
 * verify-work-area-nested-items-r1.ts, etc.) call enrichExtractionFromBrief()
 * directly with an EMPTY starting AIExtractionOutput. That proves the
 * deterministic parser is correct in isolation, but never exercises the real
 * entrypoint (buildBriefExtractionFromModelText), which first runs a raw
 * model JSON blob through coerceExtractionPayload() before enrichment.
 *
 * Root cause this covers: a raw LLM response describing two differently
 * lined wall specs is prone to proposing TWO unnamed `internal_walls` work
 * areas (one per spec) instead of one. applyDiscoveredWorkAreaInstances()
 * used to rename only the first matching row via .find(), leaving the
 * second as a fact-less phantom duplicate that bindFactToWorkAreaId's
 * first-of-type fallback could never receive facts for.
 *
 * This script feeds a realistic raw-model JSON payload through the REAL
 * entrypoint and asserts the phantom no longer survives, while genuinely
 * repeated same-type instances (two Bathrooms, two Decks) still do.
 *
 * Run: npx tsx scripts/verify-work-area-raw-llm-reconciliation-r1.ts
 *
 * No paid AI. No Production. No migration.
 */
import { buildBriefExtractionFromModelText } from "../lib/ai/brief-extraction-result";
import { aiFactsToRows, aiWorkAreasToRows } from "../lib/ai/mappers";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";
import { SCOPE_CATALOGUE } from "../lib/scopes/catalogue";
import { COORDINATION_ORIGINAL_BRIEF } from "../lib/estimate/internal-walls-brief";
import { resolveInternalWallsWallTypes } from "../lib/estimate/internal-walls-wall-types";
import type { EstimateFact } from "../lib/estimate/types";

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const allowedTypes = getAnalysisCapableWorkAreaTypes();
const catalogueTypes = SCOPE_CATALOGUE.map((item) => item.type);
const catalogueByType = new Map(SCOPE_CATALOGUE.map((item) => [item.type, item]));

type SimulatedRow = { id: string; type: string; name: string };

/** Mirrors saveBriefAndSeedWorkAreas: rows get real ids only after "insert". */
function simulateInsertAndBindFacts(output: ReturnType<
  typeof buildBriefExtractionFromModelText
>["output"]) {
  const workAreaInsertRows = aiWorkAreasToRows({
    output,
    orgId: "org-1",
    projectId: "proj-1",
    catalogueByType,
  });
  const workAreas: SimulatedRow[] = workAreaInsertRows.map((row, index) => ({
    id: `wa-${index + 1}`,
    type: row.type,
    name: row.name,
  }));
  const factRows = aiFactsToRows({
    output,
    orgId: "org-1",
    projectId: "proj-1",
    workAreaIdByType: new Map(workAreas.map((row) => [row.type, row.id])),
    workAreas,
  });
  return { workAreas, factRows };
}

console.log("=== Raw LLM proposal reconciliation — original fixture ===\n");

const BRIEF = COORDINATION_ORIGINAL_BRIEF;

// A realistic raw model response: two UNNAMED internal_walls proposals (one
// per wall spec paragraph the brief describes), plus demolition. This is
// exactly the shape that used to survive validateAndFilterExtraction's
// per-name dedup (each unnamed row gets a distinct synthetic key) and used
// to leave a fact-less phantom after enrichment.
const rawFixtureJson = JSON.stringify({
  workAreas: [
    {
      type: "demolition",
      confidence: 0.9,
      rationale: "Removing 3 internal walls requires strip-out.",
    },
    {
      type: "internal_walls",
      confidence: 0.88,
      rationale: "2 of the walls are 45x90 framed timber, GIB both sides.",
    },
    {
      type: "internal_walls",
      confidence: 0.82,
      rationale: "The other wall is 45x90 framed timber, GIB / Aqualine.",
    },
  ],
  facts: [
    {
      work_area_type: "demolition",
      key: "demolition.scope",
      label: "Demolition scope",
      value: "Remove 3 internal walls",
      confidence: 0.85,
    },
  ],
  assumptions: [],
  possibleConstraints: [],
  confidence: 0.87,
  warnings: [],
});

const built = buildBriefExtractionFromModelText({
  rawText: rawFixtureJson,
  briefText: BRIEF,
  allowedTypes,
  catalogueTypes,
});

const iwRows = built.output.workAreas.filter((row) => row.type === "internal_walls");
check("exactly 2 top-level Work Areas total", built.output.workAreas.length === 2, `got ${built.output.workAreas.length}`);
check("exactly 1 Internal Walls instance", iwRows.length === 1, `got ${iwRows.length}`);
check(
  "exactly 1 Demolition instance",
  built.output.workAreas.filter((row) => row.type === "demolition").length === 1
);
check(
  "no Plastering / Painting / Doors",
  !built.output.workAreas.some((row) =>
    ["plastering", "painting", "doors"].includes(row.type)
  ),
  built.output.workAreas.map((row) => row.type).join(",")
);

const { workAreas: simulatedWorkAreas, factRows } = simulateInsertAndBindFacts(built.output);
const iwSimulated = simulatedWorkAreas.filter((row) => row.type === "internal_walls");
check(
  "exactly 1 Internal Walls DB row after insert simulation",
  iwSimulated.length === 1,
  simulatedWorkAreas.map((row) => `${row.type}:${row.id}`).join(",")
);

const iwWorkAreaId = iwSimulated[0]?.id ?? "";
const iwFacts: EstimateFact[] = factRows
  .filter((row) => row.work_area_id === iwWorkAreaId)
  .map((row) => ({ key: row.key, work_area_id: row.work_area_id, value: row.value }));
const resolved = resolveInternalWallsWallTypes({ facts: iwFacts, workAreaId: iwWorkAreaId });

check("exactly 2 nested wall_types", resolved.types.length === 2, `got ${resolved.types.length}`);
const typeA = resolved.types[0];
const typeB = resolved.types[1];
check(
  "3 physical walls total (2 + 1, not multiplied)",
  (typeA?.wall_count ?? 0) + (typeB?.wall_count ?? 0) === 3
);
check(
  "9m Standard/Standard Wall Type",
  typeA?.wall_count === 2 &&
    typeA?.length_lm === 9 &&
    typeA?.height_m === 2.4 &&
    typeA?.same_lining_both_sides === true &&
    typeA?.side_a.product === "standard_gib" &&
    typeA?.side_b.product === "standard_gib"
);
check(
  "3m Standard/Aqualine Wall Type",
  typeB?.wall_count === 1 &&
    typeB?.length_lm === 3 &&
    typeB?.height_m === 2.4 &&
    typeB?.same_lining_both_sides === false &&
    typeB?.side_a.product === "standard_gib" &&
    typeB?.side_b.product === "aqualine"
);

const otherIwRowIds = simulatedWorkAreas
  .filter((row) => row.type === "internal_walls" && row.id !== iwWorkAreaId)
  .map((row) => row.id);
check(
  "no empty phantom Internal Walls row anywhere in the fact rows",
  otherIwRowIds.length === 0 &&
    !factRows.some((row) => row.work_area_id && otherIwRowIds.includes(row.work_area_id))
);

console.log("\n=== Regression: genuinely repeated instances still survive ===\n");

function runBrief(briefText: string, workAreaType: string) {
  const fixture = JSON.stringify({
    workAreas: [{ type: workAreaType, confidence: 0.9, rationale: "Brief mention." }],
    facts: [],
    assumptions: [],
    possibleConstraints: [],
    confidence: 0.9,
    warnings: [],
  });
  return buildBriefExtractionFromModelText({
    rawText: fixture,
    briefText,
    allowedTypes,
    catalogueTypes,
  });
}

const bathroomBrief = "Renovate the master ensuite and the family bathroom.";
const bathroomBuilt = runBrief(bathroomBrief, "bathroom");
const bathroomRows = bathroomBuilt.output.workAreas.filter((row) => row.type === "bathroom");
check(
  "A. 'master ensuite and family bathroom' → 2 Bathroom instances",
  bathroomRows.length === 2,
  bathroomRows.map((row) => row.name).join(" | ")
);
check(
  "A. instances are named Master Ensuite / Family Bathroom, not identical",
  new Set(bathroomRows.map((row) => (row.name ?? "").toLowerCase())).size === 2,
  bathroomRows.map((row) => row.name).join(" | ")
);

const deckBrief = "Replace the rear deck and build a new front entry deck.";
const deckBuilt = runBrief(deckBrief, "deck");
const deckRows = deckBuilt.output.workAreas.filter((row) => row.type === "deck");
check(
  "B. 'rear deck and front entry deck' → 2 Deck instances",
  deckRows.length === 2,
  deckRows.map((row) => row.name).join(" | ")
);
check(
  "B. instances are distinctly named, not identical",
  new Set(deckRows.map((row) => (row.name ?? "").toLowerCase())).size === 2,
  deckRows.map((row) => row.name).join(" | ")
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
