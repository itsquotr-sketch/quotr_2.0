/**
 * ESTIMATING-FOUNDATION-02 — original Internal Walls live fixture.
 *
 * Run: npx --yes tsx scripts/verify-work-area-internal-walls-live-fixture-r1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import type { AIExtractionOutput } from "../lib/ai/schema";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { composeEstimateReadiness } from "../lib/assistant/readiness/compose";
import {
  composeClarifyInputFromEstimateContext,
  evaluateClarifyEstimateReadiness,
  evaluateGenerateEstimatePermission,
} from "../lib/assistant/readiness/clarify-estimate";
import { calculateInternalWalls } from "../lib/estimate/calculators/fitout";
import {
  applyExtractedInternalWallsToFacts,
  COORDINATION_ORIGINAL_BRIEF,
  extractInternalWallsTypesFromBrief,
} from "../lib/estimate/internal-walls-brief";
import {
  INTERNAL_WALLS_HAS_OPENINGS_KEY,
} from "../lib/estimate/internal-walls-openings";
import {
  resolveInternalWallsWallTypes,
  summariseWallType,
} from "../lib/estimate/internal-walls-wall-types";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";
import { classifyProposedWorkAreas } from "../lib/work-areas/ownership";
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

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const BRIEF = COORDINATION_ORIGINAL_BRIEF;
check(
  "fixture wording is exact",
  BRIEF ===
    "I am renovating a house and removing 3 internal walls, I need to rebuild the walls completely. 2 of the walls are 45x90 framed timber with 13mm standard GIB on both sides (they total 9m long and are 2.4m high), and the other wall is 45x90 framed timber with 13mm standard GIB on one side and 13mm aqualine on the otherside (this wall is 3m long and 2.4m high)"
);

const extraction = enrichExtractionFromBrief({
  briefText: BRIEF,
  extraction: {
    workAreas: [],
    facts: [],
    assumptions: [],
    possibleConstraints: [],
    confidence: 0.5,
    warnings: [],
  } satisfies AIExtractionOutput,
  allowedTypes: getAnalysisCapableWorkAreaTypes(),
}).extraction;

const types = extraction.workAreas.map((row) => row.type).sort();
check(
  "Work Areas are demolition + internal_walls",
  types.join("|") === "demolition|internal_walls",
  types.join("|")
);
check(
  "no plastering / painting / doors",
  !types.includes("plastering") &&
    !types.includes("painting") &&
    !types.includes("doors")
);
check(
  "one Internal Walls instance",
  extraction.workAreas.filter((row) => row.type === "internal_walls").length === 1
);

const records = classifyProposedWorkAreas({
  briefText: BRIEF,
  types: extraction.workAreas.map((row) => row.type),
});
check(
  "ownership keeps demolition + internal walls only",
  records.filter((row) => row.topLevel).map((row) => row.type).sort().join("|") ===
    "demolition|internal_walls"
);

const extracted = extractInternalWallsTypesFromBrief(BRIEF);
let facts: EstimateFact[] = [
  {
    key: "internal_walls.job_scope",
    work_area_id: "w1",
    value: "new_partition",
    source: "ai_extracted",
  },
];
facts = applyExtractedInternalWallsToFacts({
  facts,
  workAreaId: "w1",
  types: extracted,
});
const resolved = resolveInternalWallsWallTypes({ facts, workAreaId: "w1" });
check("2 Wall Types persisted", resolved.types.length === 2);
check(
  "3 physical walls",
  resolved.types.reduce((sum, row) => sum + (row.wall_count ?? 0), 0) === 3
);

const workAreas = [
  { id: "w1", type: "internal_walls", name: "Internal walls", status: "confirmed" as const },
  { id: "d1", type: "demolition", name: "Demolition / strip-out", status: "confirmed" as const },
];
const jobPlan = composeJobPlan({ workAreas, facts });
const iwCard = jobPlan.cards.find((card) => card.workAreaType === "internal_walls");
const summaries = resolved.types.map((row, index) => summariseWallType(row, index));
check(
  "Work card shows 3 walls · 2 Wall Types",
  Boolean(iwCard?.summary.includes("3 walls") && iwCard.summary.includes("2 Wall Type")),
  iwCard?.summary
);
check(
  "Wall Type 1 Standard both sides",
  Boolean(
    summaries[0]?.liningLine &&
      /standard gib/i.test(summaries[0].liningLine) &&
      /both sides/i.test(summaries[0].liningLine)
  ),
  summaries[0]?.liningLine ?? ""
);
check(
  "Wall Type 2 Standard / Aqualine",
  Boolean(
    summaries[1]?.liningLine &&
      /standard gib/i.test(summaries[1].liningLine) &&
      /aqualine/i.test(summaries[1].liningLine)
  ),
  summaries[1]?.liningLine ?? ""
);

const withoutCarry = composeClarifyInputFromEstimateContext({
  stage: "work_area_questions",
  briefText: BRIEF,
  qualityLevel: "standard",
  workAreas,
  facts,
  constraints: [{ key: "site_access", value: "Easy" }],
});
const notReady = evaluateClarifyEstimateReadiness(withoutCarry);
check("Ready is false without carry", notReady.ready === false);
check(
  "carry is asked before Ready",
  Boolean(notReady.builderCopy && /drop-off|carting|carry/i.test(notReady.builderCopy)),
  notReady.builderCopy ?? ""
);
check(
  "optional openings are not the Ready blocker",
  !(notReady.builderCopy ?? "").includes("opening")
);

const withCarry = composeClarifyInputFromEstimateContext({
  stage: "work_area_questions",
  briefText: BRIEF,
  qualityLevel: "standard",
  workAreas,
  facts,
  constraints: [
    { key: "site_access", value: "Easy" },
    { key: "material_carry_distance", value: "< 10m" },
  ],
});
const ready = evaluateClarifyEstimateReadiness(withCarry);
const generate = evaluateGenerateEstimatePermission({
  compose: withCarry,
  workAreas,
  facts,
  unresolvedRequiredProjectConditionKeys: [],
});
const details = composeEstimateReadiness({
  clarify: composeClarifyView(withCarry),
  jobPlan: withCarry.jobPlan,
  qualityLevel: "standard",
  constraints: withCarry.constraints,
});
check("Details Ready after carry", ready.ready === true, ready.builderCopy ?? "");
check("generate permission matches Ready", generate.ready === ready.ready);
check("panel enoughToEstimate matches", details.enoughToEstimate === ready.ready);
check(
  "has_openings is not forced Include",
  facts.every((row) => {
    if (row.key !== "internal_walls.wall_types" || !Array.isArray(row.value)) return true;
    return (row.value as Array<{ has_openings?: unknown }>).every(
      (type) => type.has_openings == null
    );
  })
);
check(
  "extractor does not write openings key as yes",
  !facts.some(
    (row) => row.key === INTERNAL_WALLS_HAS_OPENINGS_KEY && row.value === true
  )
);

const estimate = calculateInternalWalls(
  {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [
      { id: "w1", type: "internal_walls", name: "Internal walls", sort_order: 1 },
    ],
    facts,
    constraints: [{ key: "material_carry_distance", value: "< 10m" }],
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
  } as unknown as EstimateContext,
  { id: "w1", type: "internal_walls", name: "Internal walls", sort_order: 1 }
);
check(
  "estimate succeeds with requirements",
  (estimate.requirements?.length ?? 0) > 0 || estimate.lineItems.length > 0
);

check(
  "deterministic extractor overwrites AI wall_types",
  read("lib/ai/enrich-extraction.ts").includes("internal_walls.wall_types") &&
    read("lib/ai/enrich-extraction.ts").includes("if (specs.length >= 2) return")
);

if (failed > 0) {
  console.error(`\nFAILED ${failed}  passed ${passed}`);
  process.exit(1);
}
console.log(`\nOK  ${passed} checks`);
