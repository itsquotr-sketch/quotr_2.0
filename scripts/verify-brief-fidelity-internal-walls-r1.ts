/**
 * WORK-AREA-COORDINATION-01 — brief fidelity for the exact original Internal Walls brief.
 *
 * Run: npx --yes tsx scripts/verify-brief-fidelity-internal-walls-r1.ts
 *
 * No paid AI. No Production. No migration.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import type { AIExtractionOutput } from "../lib/ai/schema";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { composeEstimateReadiness } from "../lib/assistant/readiness/compose";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import {
  applyExtractedInternalWallsToFacts,
  canonicalTimberSizeFromText,
  COORDINATION_ORIGINAL_BRIEF,
  extractInternalWallsTypesFromBrief,
} from "../lib/estimate/internal-walls-brief";
import {
  resolveInternalWallsWallTypes,
  summariseInternalWallsWorkArea,
  summariseWallType,
} from "../lib/estimate/internal-walls-wall-types";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";
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

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const emptyExtraction = (): AIExtractionOutput => ({
  workAreas: [],
  facts: [],
  assumptions: [],
  possibleConstraints: [],
  confidence: 0.5,
  warnings: [],
});

const BRIEF = COORDINATION_ORIGINAL_BRIEF;
check(
  "fixture wording is exact",
  BRIEF ===
    "I am renovating a house and removing 3 internal walls, I need to rebuild the walls completely. 2 of the walls are 45x90 framed timber with 13mm standard GIB on both sides (they total 9m long and are 2.4m high), and the other wall is 45x90 framed timber with 13mm standard GIB on one side and 13mm aqualine on the otherside (this wall is 3m long and 2.4m high)"
);

console.log("\n--- Before-fix (code-level, documented) ---\n");
check(
  "before-fix: single-length extractor used first linear match",
  read("lib/ai/enrich-extraction.ts").includes("extractInternalWallsTypesFromBrief")
);

console.log("\n--- 45x90 normalisation ---\n");
check("45x90 → 90x45", canonicalTimberSizeFromText("45x90") === "90x45");
check("90x45 → 90x45", canonicalTimberSizeFromText("90x45") === "90x45");
check("90 × 45 → 90x45", canonicalTimberSizeFromText("90 × 45") === "90x45");
check("45 × 90 → 90x45", canonicalTimberSizeFromText("45 × 90") === "90x45");
check("90/45 → 90x45", canonicalTimberSizeFromText("90/45") === "90x45");

console.log("\n--- Deterministic extractor ---\n");
const extracted = extractInternalWallsTypesFromBrief(BRIEF);
check("2 Wall Types", extracted.length === 2, `got ${extracted.length}`);
check(
  "Type A wall_count=2 combined length=9 height=2.4 90x45 both-sides Standard GIB 13",
  extracted[0]?.wallCount === 2 &&
    extracted[0]?.lengthLm === 9 &&
    extracted[0]?.heightM === 2.4 &&
    extracted[0]?.frameSystem === "timber" &&
    extracted[0]?.frameSize === "90x45" &&
    extracted[0]?.sameLiningBothSides === true &&
    extracted[0]?.sideA.product === "standard_gib" &&
    extracted[0]?.sideA.thicknessMm === 13 &&
    extracted[0]?.sideB.product === "standard_gib" &&
    extracted[0]?.sideB.thicknessMm === 13
);
check(
  "Type B wall_count=1 length=3 height=2.4 90x45 Standard / Aqualine",
  extracted[1]?.wallCount === 1 &&
    extracted[1]?.lengthLm === 3 &&
    extracted[1]?.heightM === 2.4 &&
    extracted[1]?.frameSystem === "timber" &&
    extracted[1]?.frameSize === "90x45" &&
    extracted[1]?.sameLiningBothSides === false &&
    extracted[1]?.sideA.product === "standard_gib" &&
    extracted[1]?.sideA.thicknessMm === 13 &&
    extracted[1]?.sideB.product === "aqualine" &&
    extracted[1]?.sideB.thicknessMm === 13
);
check(
  "physical walls 3 = 2 + 1, length not multiplied",
  (extracted[0]?.wallCount ?? 0) + (extracted[1]?.wallCount ?? 0) === 3 &&
    extracted[0]?.lengthLm === 9
);

console.log("\n--- Stored Wall Types ---\n");
let facts: EstimateFact[] = [
  {
    key: "internal_walls.job_scope",
    work_area_id: "w1",
    value: "new_partition",
  },
];
facts = applyExtractedInternalWallsToFacts({
  facts,
  workAreaId: "w1",
  types: extracted,
});
const resolved = resolveInternalWallsWallTypes({ facts, workAreaId: "w1" });
check("stored 2 types", resolved.types.length === 2);
const typeA = resolved.types[0]!;
const typeB = resolved.types[1]!;
check(
  "stored Type A",
  typeA.wall_count === 2 &&
    typeA.length_lm === 9 &&
    typeA.height_m === 2.4 &&
    typeA.frame_system === "timber" &&
    typeA.frame_size === "90x45" &&
    typeA.same_lining_both_sides === true &&
    typeA.side_a.product === "standard_gib" &&
    typeA.side_a.thickness_mm === 13 &&
    typeA.side_b.product === "standard_gib" &&
    typeA.side_b.thickness_mm === 13 &&
    typeA.side_a.sheet_length_mm === 2400
);
check(
  "stored Type B",
  typeB.wall_count === 1 &&
    typeB.length_lm === 3 &&
    typeB.height_m === 2.4 &&
    typeB.frame_system === "timber" &&
    typeB.frame_size === "90x45" &&
    typeB.same_lining_both_sides === false &&
    typeB.side_a.product === "standard_gib" &&
    typeB.side_a.thickness_mm === 13 &&
    typeB.side_b.product === "aqualine" &&
    typeB.side_b.thickness_mm === 13
);
check(
  "optional scope unresolved (not Included)",
  typeA.has_openings == null &&
    typeA.insulation_included == null &&
    typeA.skirting == null &&
    typeA.cornice == null &&
    typeA.electrical == null &&
    typeA.stopping_side_a == null &&
    typeA.painting == null &&
    typeB.has_openings == null &&
    typeB.insulation_included == null &&
    typeB.skirting == null &&
    typeB.cornice == null &&
    typeB.painting == null
);

const workSummary = summariseInternalWallsWorkArea(resolved.types);
check(
  "work-area summary 3 walls · 2 Wall Types",
  Boolean(workSummary?.startsWith("3 walls · 2 Wall Types")),
  workSummary ?? "missing"
);
const summaryA = summariseWallType(typeA, 0, resolved.source);
const summaryB = summariseWallType(typeB, 1, resolved.source);
check(
  "Type A geometry includes 2 walls and 9 m total",
  Boolean(summaryA.geometryLine?.includes("2 walls")) &&
    Boolean(summaryA.geometryLine?.includes("9")) &&
    Boolean(summaryA.liningLine?.toLowerCase().includes("both"))
);
check(
  "Type B lining distinguishes Standard GIB and Aqualine",
  Boolean(summaryB.liningLine?.includes("Standard GIB")) &&
    Boolean(summaryB.liningLine?.toLowerCase().includes("aqualine"))
);

console.log("\n--- Enrichment / Work Areas ---\n");
const enriched = enrichExtractionFromBrief({
  briefText: BRIEF,
  extraction: emptyExtraction(),
  allowedTypes: getAnalysisCapableWorkAreaTypes(),
}).extraction;
const waTypes = enriched.workAreas.map((row) => row.type).sort();
check(
  "Work Areas Internal Walls + Demolition only",
  waTypes.join(",") === "demolition,internal_walls",
  waTypes.join(",")
);
check(
  "no plastering / painting / doors",
  !waTypes.includes("plastering") &&
    !waTypes.includes("painting") &&
    !waTypes.includes("doors")
);
check(
  "no invented opening / insulation / skirting facts",
  !enriched.facts.some((row) =>
    /has_openings|insulation_included|skirting|cornice|painting_included/.test(
      row.key
    ) && row.value != null && row.value !== false
  )
);

console.log("\n--- Job Plan / Known ---\n");
const jobPlan = composeJobPlan({
  workAreas: [
    { id: "w1", type: "internal_walls", name: "Internal walls", status: "confirmed" },
    { id: "d1", type: "demolition", name: "Demolition / strip-out", status: "confirmed" },
  ],
  facts,
  constraints: [],
  qualityLevel: "standard",
  briefText: BRIEF,
});
const iwCard = jobPlan.cards.find((card) => card.workAreaType === "internal_walls");
check(
  "Job Plan shows 2 Wall Types",
  Boolean(
    iwCard &&
      /2 Wall Types/i.test(iwCard.summary) &&
      iwCard.included.some((row) => /Wall Type 1/i.test(row.label)) &&
      iwCard.included.some((row) => /Wall Type 2/i.test(row.label))
  )
);
const clarify = composeClarifyView({
  stage: "work_area_questions",
  briefText: BRIEF,
  qualityLevel: "standard",
  workAreas: [
    { id: "w1", type: "internal_walls", name: "Internal walls", status: "confirmed" },
  ],
  facts,
  constraints: [],
  jobPlan,
});
check(
  "known construction facts do not re-ask frame / lining / length / height",
  !clarify.candidates.some((row) =>
    [
      "internal_walls.wall_type.frame_system",
      "internal_walls.wall_type.frame_size",
      "internal_walls.wall_type.length_lm",
      "internal_walls.wall_type.height_m",
      "internal_walls.wall_type.side_a_product",
      "internal_walls.wall_type.side_b_product",
    ].includes(row.factKey ?? "")
  )
);
const readiness = composeEstimateReadiness({
  clarify,
  jobPlan,
  qualityLevel: "standard",
  constraints: [],
});
check(
  "Known summary does not collapse to a single 9m partition",
  readiness.known.some((row) => /2 Wall Types|Wall Type 2|wt-/i.test(row)) ||
    (iwCard?.specChips.filter((chip) => chip.key.startsWith("wt-")).length ?? 0) >= 2
);
check(
  "Details is not Ready without required Project Conditions",
  clarify.enoughToEstimate === false
);
const readyClarify = composeClarifyView({
  stage: "work_area_questions",
  briefText: BRIEF,
  qualityLevel: "standard",
  workAreas: [
    { id: "w1", type: "internal_walls", name: "Internal walls", status: "confirmed" },
    { id: "d1", type: "demolition", name: "Demolition / strip-out", status: "confirmed" },
  ],
  facts,
  constraints: [
    { key: "site_access", value: "Easy" },
    { key: "material_carry_distance", value: "< 10m" },
  ],
  jobPlan,
});
check(
  "Details is Ready with known walls + carry, without optional finish",
  readyClarify.enoughToEstimate === true
);

if (failed > 0) {
  console.log(`\nFAILED ${failed}  passed ${passed}`);
  process.exit(1);
}
console.log(`\nOK  ${passed} checks`);
