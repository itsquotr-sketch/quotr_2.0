/**
 * ESTIMATING-FOUNDATION-02 — nested items vs Work Area instances.
 *
 * Run: npx --yes tsx scripts/verify-work-area-nested-items-r1.ts
 */
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import type { AIExtractionOutput } from "../lib/ai/schema";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { calculateInternalWalls } from "../lib/estimate/calculators/fitout";
import {
  applyExtractedInternalWallsToFacts,
  COORDINATION_ORIGINAL_BRIEF,
  extractInternalWallsTypesFromBrief,
} from "../lib/estimate/internal-walls-brief";
import {
  resolveInternalWallsWallTypes,
  summariseWallType,
} from "../lib/estimate/internal-walls-wall-types";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";
import { discoverWorkAreaInstances } from "../lib/work-areas/discovery-instances";
import type { EstimateContext, EstimateFact } from "../lib/estimate/types";

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

const emptyExtraction = (): AIExtractionOutput => ({
  workAreas: [],
  facts: [],
  assumptions: [],
  possibleConstraints: [],
  confidence: 0.5,
  warnings: [],
});

const types = extractInternalWallsTypesFromBrief(COORDINATION_ORIGINAL_BRIEF);
check("extractor returns 2 Wall Types", types.length === 2, `got ${types.length}`);
check(
  "Type A 2 walls 9.0m Standard both sides",
  types[0]?.wallCount === 2 &&
    types[0]?.lengthLm === 9 &&
    types[0]?.heightM === 2.4 &&
    types[0]?.frameSize === "90x45" &&
    types[0]?.sameLiningBothSides === true &&
    types[0]?.sideA.product === "standard_gib" &&
    types[0]?.sideB.product === "standard_gib"
);
check(
  "Type B 1 wall 3.0m Standard / Aqualine",
  types[1]?.wallCount === 1 &&
    types[1]?.lengthLm === 3 &&
    types[1]?.heightM === 2.4 &&
    types[1]?.sameLiningBothSides === false &&
    types[1]?.sideA.product === "standard_gib" &&
    types[1]?.sideB.product === "aqualine"
);

const originalGroups = discoverWorkAreaInstances(COORDINATION_ORIGINAL_BRIEF).filter(
  (row) => row.type === "internal_walls"
);
check("original brief is ONE Internal Walls instance", originalGroups.length === 1);

const split = discoverWorkAreaInstances(
  "Build new partitions in the ground-floor office and separately fit out the upstairs tenancy with new partitions."
).filter((row) => row.type === "internal_walls");
check(
  "distinct locations become two Internal Walls instances",
  split.length === 2 &&
    split.some((row) => row.name === "Ground Floor Office") &&
    split.some((row) => row.name === "Upstairs Tenancy"),
  split.map((row) => row.name).join(", ")
);

let facts: EstimateFact[] = applyExtractedInternalWallsToFacts({
  facts: [
    {
      key: "internal_walls.job_scope",
      work_area_id: "w1",
      value: "new_partition",
    },
  ],
  workAreaId: "w1",
  types,
});
const resolved = resolveInternalWallsWallTypes({ facts, workAreaId: "w1" });
check("canonical store has 2 types", resolved.types.length === 2);
check(
  "physical walls total 3",
  resolved.types.reduce((sum, row) => sum + (row.wall_count ?? 0), 0) === 3
);
check(
  "Wall Type ids are distinct",
  resolved.types[0]!.id !== resolved.types[1]!.id
);

const typeA = resolved.types[0]!;
const typeB = resolved.types[1]!;
check("Type A lining recognised", typeA.side_a.product === "standard_gib" && typeA.side_a.lined);
check(
  "Type B mixed lining recognised",
  typeB.side_a.product === "standard_gib" && typeB.side_b.product === "aqualine"
);
check(
  "no invented openings / insulation",
  typeA.has_openings == null &&
    typeA.insulation_included == null &&
    typeA.skirting == null &&
    typeA.painting == null
);

const summaries = resolved.types.map((row, index) => summariseWallType(row, index));
check(
  "summary is not No lining",
  summaries.every((row) => row.liningLine != null && !/no lining/i.test(row.liningLine)),
  summaries.map((row) => row.liningLine).join(" | ")
);

const plan = composeJobPlan({
  workAreas: [
    { id: "w1", type: "internal_walls", name: "Internal walls", status: "confirmed", sortOrder: 1 },
  ],
  facts,
});
const card = plan.cards[0];
check("one Internal Walls Job Plan card", plan.cards.length === 1);
check(
  "Work card shows construction not only Internal walls",
  Boolean(
    card &&
      card.included.length >= 2 &&
      card.included.some((row) => /90|timber/i.test(row.label)) &&
      card.included.some((row) => /plasterboard|GIB|Aqualine/i.test(row.label))
  ),
  card?.included.map((row) => row.label).join(" | ")
);
check(
  "unanswered optionals are not Not Included",
  (card?.notIncluded.length ?? 0) === 0
);

const ctx = {
  project: { id: "p1", qualityLevel: "standard" },
  confirmedWorkAreas: [
    { id: "w1", type: "internal_walls", name: "Internal walls", sort_order: 1 },
  ],
  facts,
  constraints: [],
  organisationSettings: {
    allow_benchmark_rates: true,
    default_margin_percent: 20,
    premium_rate_factor: 1.15,
  },
  materialWastageSettings: {
    defaultMaterialWastagePercent: 10,
    timberFramingWastagePercent: 10,
    sheetMaterialWastagePercent: 10,
  },
  rates: [],
} as unknown as EstimateContext;

const estimate = calculateInternalWalls(ctx, {
  id: "w1",
  type: "internal_walls",
  name: "Internal walls",
  sort_order: 1,
});
const variants = new Set(
  (estimate.requirements ?? [])
    .map((row) => row.variantKey)
    .filter((row): row is string => Boolean(row))
);
check(
  "requirements carry Wall Type variantKey",
  variants.has(typeA.id) && variants.has(typeB.id),
  [...variants].join(",")
);
check(
  "requirements stay on the same workAreaId",
  (estimate.requirements ?? []).every((row) => row.workAreaId === "w1")
);

const twoGroups = enrichExtractionFromBrief({
  briefText:
    "Build new partitions in the ground-floor office and separately fit out the upstairs tenancy with new partitions.",
  extraction: emptyExtraction(),
  allowedTypes: getAnalysisCapableWorkAreaTypes(),
}).extraction.workAreas.filter((row) => row.type === "internal_walls");
check(
  "enrich two labelled Internal Walls groups",
  twoGroups.length === 2,
  twoGroups.map((row) => row.name).join(", ")
);

if (failed > 0) {
  console.error(`\nFAILED ${failed}  passed ${passed}`);
  process.exit(1);
}
console.log(`\nOK  ${passed} checks`);
