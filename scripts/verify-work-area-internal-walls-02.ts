/**
 * WA-INTERNAL-WALLS-02 — wall type collection + job scope + geometry foundation.
 *
 * Run: npx --yes tsx scripts/verify-work-area-internal-walls-02.ts
 *
 * No paid AI. No Production. No migration 055.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { composeRefineView } from "../lib/assistant/refine/compose";
import { getRefineAdapter } from "../lib/assistant/refine/adapters/registry";
import { getJobPlanAdapter } from "../lib/assistant/job-plan/adapters/registry";
import { buildMinimalExtractionFromBrief } from "../lib/ai/enrich-extraction";
import { calculateBathroom } from "../lib/estimate/calculators/bathroom";
import { calculateInternalWalls } from "../lib/estimate/calculators/fitout";
import { isCalculatorConsumedFact } from "../lib/estimate/consumed-facts";
import {
  INTERNAL_WALLS_JOB_SCOPE_FACT_KEY,
  INTERNAL_WALLS_JOB_SCOPE_VALUES,
  INTERNAL_WALLS_STRUCTURAL_FACT_KEY,
  isMatureInternalWallsPath,
  parseInternalWallsJobScope,
  shouldHideInternalWallsQuestion,
  structuralGateApplies,
} from "../lib/estimate/internal-walls-scope";
import {
  INTERNAL_WALLS_HEIGHT_ASSUMPTION_STATEMENT,
  INTERNAL_WALLS_LENGTH_REQUIRED_MESSAGE,
  INTERNAL_WALLS_STRUCTURAL_SPECIALIST_MESSAGE,
  INTERNAL_WALLS_TAKEOFF_NOT_PRICED_STATEMENT,
  INTERNAL_WALLS_WALL_TYPES_FACT_KEY,
  applyInternalWallsFactWrite,
  duplicateWallType,
  grossFaceAreaM2,
  linedFaceCount,
  parseInternalWallsWallTypes,
  recommendedNoggingRows,
  recommendedStudCentresMm,
  resolveInternalWallsWallTypes,
  summariseWallType,
} from "../lib/estimate/internal-walls-wall-types";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";
import { SCOPE_CATALOGUE } from "../lib/scopes/catalogue";
import { shouldHideConditionalQuestion } from "../lib/scopes/conditional-rules";
import { getScopeQuestions } from "../lib/scopes/registry";
import { buildFactLookup, type ProjectFactRecord } from "../lib/scopes/fact-values";
import { PREVIEW_SUPABASE_PROJECT_REF } from "../lib/deployment/environment";
import {
  PREVIEW_AUTH_SITE_ORIGIN_STABLE,
  PREVIEW_PASSWORD_PROTECTED_EMAILS,
  assertSafePreviewPasswordMutation,
  isPlusAddressFixture,
} from "./lib/preview-auth-fixture";

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

function numberedMigrations(): string[] {
  return readdirSync(join(process.cwd(), "supabase/migrations"))
    .filter((name) => /^\d+_/.test(name) && name.endsWith(".sql"))
    .sort();
}

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

function wa(
  id: string,
  type: string,
  name: string
): EstimateWorkArea & { status: "confirmed" } {
  return { id, type, name, sort_order: 1, status: "confirmed" };
}

function ctx(
  workAreas: EstimateWorkArea[],
  facts: EstimateFact[]
): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: workAreas,
    facts,
    constraints: [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
    },
    materialWastageSettings: {
      sheet_material: 10,
      flooring: 10,
      paint: 10,
      default: 5,
    },
    rates: [],
  } as unknown as EstimateContext;
}

function writeWall(
  workAreaId: string,
  writes: Array<{ key: string; value: unknown }>
): EstimateFact[] {
  let facts: EstimateFact[] = [];
  for (const row of writes) {
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId,
      key: row.key,
      value: row.value,
    });
  }
  return facts;
}

function composeIwClarify(facts: EstimateFact[], workAreaId = "w1") {
  const workAreas = [wa(workAreaId, "internal_walls", "Internal walls")];
  const plan = composeJobPlan({
    workAreas: workAreas.map((row) => ({
      id: row.id,
      type: row.type,
      name: row.name,
      status: "confirmed" as const,
    })),
    facts,
  });
  return composeClarifyView({
    stage: "quality",
    briefText: null,
    qualityLevel: "standard",
    workAreas,
    facts,
    constraints: [],
    jobPlan: plan,
  });
}

function lookupFacts(workAreaId: string, facts: EstimateFact[]) {
  const records: ProjectFactRecord[] = facts.map((row) => ({
    key: row.key,
    work_area_id: row.work_area_id,
    value: row.value,
    source: "user",
  }));
  return buildFactLookup(records);
}

const walls = wa("w1", "internal_walls", "Internal walls");

console.log("=== WA-INTERNAL-WALLS-02 ===\n");

console.log("--- Storage / identity ---\n");
check(
  "job_scope enum has 8 values",
  INTERNAL_WALLS_JOB_SCOPE_VALUES.length === 8 &&
    INTERNAL_WALLS_JOB_SCOPE_VALUES.includes("new_partition") &&
    INTERNAL_WALLS_JOB_SCOPE_VALUES.includes("mixed")
);
check(
  "display New partition maps",
  parseInternalWallsJobScope("New partition") === "new_partition"
);

const twoTypes = writeWall("w1", [
  { key: "internal_walls.add_wall_type", value: true },
  { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
  { key: "internal_walls.wall_type.length_lm", value: 12 },
  { key: "internal_walls.add_wall_type", value: true },
  { key: "internal_walls.wall_type.frame_system", value: "Steel framing" },
]);
const parsedTwo = parseInternalWallsWallTypes(
  twoTypes.find((row) => row.key === INTERNAL_WALLS_WALL_TYPES_FACT_KEY)?.value
);
check("two wall types stored in one JSON fact", parsedTwo.length === 2);
check(
  "stable UUIDs are independent",
  parsedTwo[0]!.id !== parsedTwo[1]!.id &&
    parsedTwo[0]!.id.length >= 8 &&
    parsedTwo[1]!.id.length >= 8
);
check(
  "no fact collision across types",
  parsedTwo[0]!.frame_system === "timber" &&
    parsedTwo[1]!.frame_system === "steel"
);

const deleted = applyInternalWallsFactWrite({
  facts: twoTypes,
  workAreaId: "w1",
  key: "internal_walls.delete_wall_type",
  value: parsedTwo[0]!.id,
});
const afterDelete = parseInternalWallsWallTypes(
  deleted.find((row) => row.key === INTERNAL_WALLS_WALL_TYPES_FACT_KEY)?.value
);
check(
  "delete does not corrupt remaining type",
  afterDelete.length === 1 && afterDelete[0]!.id === parsedTwo[1]!.id
);

const copy = duplicateWallType(parsedTwo[1]!);
check("duplicate receives a new id", copy.id !== parsedTwo[1]!.id);
check("duplicate copies steel foundation", copy.frame_system === "steel");

console.log("\n--- Geometry / centres / nogging ---\n");
check("12 × 2.4 = 28.8", grossFaceAreaM2(12, 2.4) === 28.8);
check("recommended centres <=2.4 is 600", recommendedStudCentresMm(2.4) === 600);
check("recommended centres >2.4 is 400", recommendedStudCentresMm(2.7) === 400);
check("nogging <=2.4 is 2 rows", recommendedNoggingRows(2.4) === 2);
check("nogging 3.0 is 3 rows", recommendedNoggingRows(3) === 3);
check("nogging 3.3 is 4 rows", recommendedNoggingRows(3.3) === 4);

console.log("\n--- Fixture A ---\n");
const fixtureAWrites = writeWall("w1", [
  { key: INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, value: "new_partition" },
  { key: "internal_walls.add_wall_type", value: true },
  { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
  { key: "internal_walls.wall_type.frame_size", value: "90 mm timber framing — 90×45" },
  { key: "internal_walls.wall_type.length_lm", value: 12 },
  { key: "internal_walls.wall_type.height_m", value: 2.4 },
  { key: "internal_walls.wall_type.side_a_product", value: "Standard GIB" },
  { key: "internal_walls.wall_type.same_lining_both_sides", value: true },
]);
const fixtureAFacts = [
  fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "new_partition"),
  ...fixtureAWrites.filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
];
const fixtureA = resolveInternalWallsWallTypes({
  facts: fixtureAFacts,
  workAreaId: "w1",
});
const aType = fixtureA.types[0]!;
check("Fixture A one wall type", fixtureA.types.length === 1);
check("Fixture A timber 90×45", aType.frame_system === "timber" && aType.frame_size === "90x45");
check("Fixture A 12 × 2.4", aType.length_lm === 12 && aType.height_m === 2.4);
check("Fixture A recommended 600 centres", aType.stud_centres_mm === 600);
check("Fixture A Standard GIB both sides", aType.side_a.product === "standard_gib" && aType.same_lining_both_sides === true && aType.side_b.product === "standard_gib");
check("Fixture A 13 mm / 2400 / 1 layer", aType.side_a.thickness_mm === 13 && aType.side_a.sheet_length_mm === 2400 && aType.side_a.layers === 1);
check("Fixture A gross 28.8", grossFaceAreaM2(aType.length_lm, aType.height_m) === 28.8);
check("Fixture A two lined faces", linedFaceCount(aType) === 2);
const fixtureACalc = calculateInternalWalls(ctx([walls], fixtureAFacts), walls);
check(
  "Fixture A no silent 20 m²",
  !fixtureACalc.assumptions.some((row) => /20\s*m/.test(row)) &&
    !fixtureACalc.lineItems.some((row) => Number(row.quantity) === 20)
);
check(
  "Fixture A no package money",
  fixtureACalc.lineItems.length === 0 &&
    fixtureACalc.assumptions.some((row) =>
      row.includes(INTERNAL_WALLS_TAKEOFF_NOT_PRICED_STATEMENT)
    )
);

console.log("\n--- Fixture B ---\n");
let fixtureB = writeWall("w1", [
  { key: INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, value: "new_partition" },
  { key: "internal_walls.add_wall_type", value: true },
  { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
  { key: "internal_walls.wall_type.frame_size", value: "90 mm timber framing — 90×45" },
  { key: "internal_walls.wall_type.length_lm", value: 12 },
  { key: "internal_walls.wall_type.height_m", value: 2.4 },
  { key: "internal_walls.wall_type.side_a_product", value: "Standard GIB" },
  { key: "internal_walls.wall_type.same_lining_both_sides", value: true },
  { key: "internal_walls.add_wall_type", value: true },
  { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
  { key: "internal_walls.wall_type.frame_size", value: "90 mm timber framing — 90×45" },
  { key: "internal_walls.wall_type.length_lm", value: 8 },
  { key: "internal_walls.wall_type.height_m", value: 3 },
  { key: "internal_walls.wall_type.side_a_product", value: "Fyreline" },
  { key: "internal_walls.wall_type.side_a_layers", value: "2 layers" },
  { key: "internal_walls.wall_type.same_lining_both_sides", value: true },
]);
fixtureB = [
  fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "new_partition"),
  ...fixtureB.filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
];
const bResolved = resolveInternalWallsWallTypes({ facts: fixtureB, workAreaId: "w1" });
check("Fixture B two types", bResolved.types.length === 2);
check("Fixture B independent ids", bResolved.types[0]!.id !== bResolved.types[1]!.id);
check(
  "Fixture B type B is 8 × 3.0 double Fyreline",
  bResolved.types[1]!.length_lm === 8 &&
    bResolved.types[1]!.height_m === 3 &&
    bResolved.types[1]!.side_a.product === "fyreline" &&
    bResolved.types[1]!.side_a.layers === 2 &&
    bResolved.types[1]!.side_b.layers === 2
);
check(
  "Fixture B type A unchanged",
  bResolved.types[0]!.length_lm === 12 &&
    bResolved.types[0]!.side_a.product === "standard_gib" &&
    bResolved.types[0]!.side_a.layers === 1
);

console.log("\n--- Fixture C ---\n");
const fixtureC = writeWall("w1", [
  { key: "internal_walls.add_wall_type", value: true },
  { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
  { key: "internal_walls.wall_type.frame_size", value: "140 mm timber framing — 140×45" },
  { key: "internal_walls.wall_type.length_lm", value: 5 },
  { key: "internal_walls.wall_type.height_m", value: 2.7 },
]);
const cType = parseInternalWallsWallTypes(
  fixtureC.find((row) => row.key === INTERNAL_WALLS_WALL_TYPES_FACT_KEY)?.value
)[0]!;
check("Fixture C 140×45 not 90×45", cType.frame_size === "140x45");
check("Fixture C centres 400", cType.stud_centres_mm === 400);

console.log("\n--- Fixture D ---\n");
const fixtureD = writeWall("w1", [
  { key: "internal_walls.add_wall_type", value: true },
  { key: "internal_walls.wall_type.frame_system", value: "Steel framing" },
  { key: "internal_walls.wall_type.length_lm", value: 10 },
  { key: "internal_walls.wall_type.height_m", value: 2.4 },
]);
const dType = parseInternalWallsWallTypes(
  fixtureD.find((row) => row.key === INTERNAL_WALLS_WALL_TYPES_FACT_KEY)?.value
)[0]!;
check("Fixture D steel not timber", dType.frame_system === "steel" && dType.frame_size == null);
check("Fixture D track/stud foundation", dType.steel?.system === "track_and_stud");
check("Fixture D centres 600", dType.stud_centres_mm === 600);

console.log("\n--- Fixture E ---\n");
const fixtureEFacts = [
  fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "reline_existing"),
  ...writeWall("w1", [
    { key: "internal_walls.add_wall_type", value: true },
    { key: "internal_walls.wall_type.frame_system", value: "Existing frame" },
    { key: "internal_walls.wall_type.length_lm", value: 3 },
    { key: "internal_walls.wall_type.height_m", value: 2.4 },
    { key: "internal_walls.wall_type.side_a_product", value: "Standard GIB" },
    { key: "internal_walls.wall_type.same_lining_both_sides", value: false },
  ]).filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
];
const eType = resolveInternalWallsWallTypes({
  facts: fixtureEFacts,
  workAreaId: "w1",
}).types[0]!;
check("Fixture E existing frame", eType.frame_system === "existing_frame");
check("Fixture E one lined face", linedFaceCount(eType) === 1 && eType.side_a.product === "standard_gib");
const eCalc = calculateInternalWalls(ctx([walls], fixtureEFacts), walls);
check(
  "Fixture E no framing package money",
  eCalc.lineItems.length === 0 &&
    !eCalc.lineItems.some((row) => /framing labour/i.test(row.label))
);

console.log("\n--- Fixture F / structural ---\n");
check("structural gate applies to remove", structuralGateApplies("remove_partition"));
check("structural gate does not apply to new partition", !structuralGateApplies("new_partition"));
const fixtureF = calculateInternalWalls(
  ctx(
    [walls],
    [
      fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "remove_partition"),
      fact(INTERNAL_WALLS_STRUCTURAL_FACT_KEY, "w1", "Not sure"),
    ]
  ),
  walls
);
check(
  "Fixture F INFO_REQUIRED specialist",
  fixtureF.missingInfo.includes(INTERNAL_WALLS_STRUCTURAL_SPECIALIST_MESSAGE)
);
check("Fixture F no package price", fixtureF.lineItems.length === 0);

console.log("\n--- Silent 20 / legacy boundary ---\n");
const legacyEmpty = calculateInternalWalls(ctx([walls], []), walls);
check(
  "legacy empty still uses 20 m²",
  legacyEmpty.assumptions.some((row) => /20\s*m/.test(row)) &&
    legacyEmpty.lineItems.some((row) => Number(row.quantity) === 20)
);
const matureMissing = calculateInternalWalls(
  ctx([walls], [fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "new_partition")]),
  walls
);
check("mature path is detected from job_scope", isMatureInternalWallsPath({
  facts: [fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "new_partition")],
  workAreaId: "w1",
}));
check(
  "mature missing length is INFO_REQUIRED not 20 m²",
  matureMissing.missingInfo.includes(INTERNAL_WALLS_LENGTH_REQUIRED_MESSAGE) ||
    matureMissing.missingInfo.some((row) => /wall type/i.test(row))
);
check(
  "mature missing has no 20 m²",
  !matureMissing.assumptions.some((row) => /20\s*m/.test(row)) &&
    !matureMissing.lineItems.some((row) => Number(row.quantity) === 20)
);
const heightNotSure = writeWall("w1", [
  { key: "internal_walls.add_wall_type", value: true },
  { key: "internal_walls.wall_type.height_m", value: "Not sure" },
]);
const assumed = parseInternalWallsWallTypes(
  heightNotSure.find((row) => row.key === INTERNAL_WALLS_WALL_TYPES_FACT_KEY)?.value
)[0]!;
check(
  "Not sure height → disclosed 2.4",
  assumed.height_m === 2.4 && assumed.height_source === "assumed_disclosed"
);
check(
  "2.4 assumption statement exists",
  INTERNAL_WALLS_HEIGHT_ASSUMPTION_STATEMENT === "Wall height assumed at 2.4 m."
);

const legacyDual = resolveInternalWallsWallTypes({
  facts: [
    fact("internal_walls.length_lm", "w1", 4),
    fact("internal_walls.height_m", "w1", 2.4),
    fact("internal_walls.framing_type", "w1", "Timber"),
    fact("internal_walls.lining_sides", "w1", "Both sides"),
  ],
  workAreaId: "w1",
});
check(
  "legacy dual-read as one wall type",
  legacyDual.source === "legacy_dual_read" && legacyDual.types.length === 1
);
check(
  "legacy dual-read does not persist canonical JSON",
  !legacyDual.types[0]!.id.match(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  )
);

console.log("\n--- Consumed facts / Refine / Job Plan / Clarify ---\n");
check(
  "consumed-fact contract includes job_scope and wall_types",
  isCalculatorConsumedFact("internal_walls", INTERNAL_WALLS_JOB_SCOPE_FACT_KEY) &&
    isCalculatorConsumedFact("internal_walls", INTERNAL_WALLS_WALL_TYPES_FACT_KEY) &&
    isCalculatorConsumedFact("internal_walls", "internal_walls.wall_type.length_lm")
);
check("Refine adapter registered", getRefineAdapter("internal_walls") != null);
check(
  "Job Plan adapter is dedicated",
  getJobPlanAdapter("internal_walls").workAreaType === "internal_walls" &&
    read("lib/assistant/job-plan/adapters/registry.ts").includes(
      "internalWallsJobPlanAdapter"
    )
);

const plan = composeJobPlan({
  workAreas: [{ id: "w1", type: "internal_walls", name: "Internal walls", status: "confirmed" }],
  facts: fixtureAFacts,
});
check(
  "Job Plan shows wall type count without JSON dump",
  plan.cards[0]!.specChips.some((chip) => chip.label === "Wall types" && chip.value === "1") &&
    !JSON.stringify(plan.cards[0]).includes('"side_a"')
);

const refine = composeRefineView({
  briefText: null,
  qualityLevel: "standard",
  workAreas: [{ id: "w1", type: "internal_walls", name: "Internal walls", status: "confirmed" }],
  facts: fixtureAFacts,
  constraints: [],
  jobPlan: plan,
});
check("Refine has wall type panel", (refine.wallTypePanels?.length ?? 0) === 1);
check(
  "Refine can edit selected wall type",
  refine.highValue.some((row) => row.factKey === "internal_walls.wall_type.length_lm")
);

const clarifyUnknown = composeIwClarify([]);
check(
  "Clarify asks job scope first",
  clarifyUnknown.candidates.some((row) => row.factKey === INTERNAL_WALLS_JOB_SCOPE_FACT_KEY)
);

const afterTimberOnly = composeIwClarify([
  {
    key: INTERNAL_WALLS_JOB_SCOPE_FACT_KEY,
    work_area_id: "w1",
    value: "new_partition",
    source: "user",
  },
  ...writeWall("w1", [
    { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
  ]),
]);
check(
  "timber-only still blocks on frame size",
  afterTimberOnly.candidates.some(
    (row) =>
      row.factKey === "internal_walls.wall_type.frame_size" && row.blocksEstimate
  ) && afterTimberOnly.enoughToEstimate === false
);
const afterSize = composeIwClarify([
  {
    key: INTERNAL_WALLS_JOB_SCOPE_FACT_KEY,
    work_area_id: "w1",
    value: "new_partition",
    source: "user",
  },
  ...writeWall("w1", [
    { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
    { key: "internal_walls.wall_type.frame_size", value: "90 mm timber framing — 90×45" },
  ]),
]);
check(
  "size-only still blocks on length",
  afterSize.candidates.some(
    (row) =>
      row.factKey === "internal_walls.wall_type.length_lm" && row.blocksEstimate
  ) && afterSize.enoughToEstimate === false
);

const questions = getScopeQuestions("internal_walls");
const hideLookup = lookupFacts("w1", fixtureAFacts);
check(
  "mature path hides legacy length question",
  shouldHideConditionalQuestion(
    questions.find((row) => row.factKey === "internal_walls.length_lm")!,
    "w1",
    hideLookup,
    new Set(["internal_walls"])
  )
);
check(
  "new partition hides structural question",
  shouldHideInternalWallsQuestion({
    factKey: INTERNAL_WALLS_STRUCTURAL_FACT_KEY,
    jobScope: "new_partition",
    mature: true,
    nextWallTypeField: null,
    structuralApplies: false,
  })
);

console.log("\n--- Analyse / isolation ---\n");
const extracted = buildMinimalExtractionFromBrief(
  "12m of 90x45 internal wall, 2.4 high, gib both sides",
  SCOPE_CATALOGUE.map((row) => row.type)
);
const extractedFacts = extracted.facts.filter(
  (row) => row.work_area_type === "internal_walls"
);
check(
  "Analyse extracts length and height",
  extractedFacts.some((row) => row.key === "internal_walls.length_lm" && row.value === 12) &&
    extractedFacts.some((row) => row.key === "internal_walls.height_m" && Number(row.value) === 2.4)
);
check(
  "Analyse proposes timber / both sides",
  extractedFacts.some((row) => row.key === "internal_walls.framing_type") &&
    extractedFacts.some((row) => row.key === "internal_walls.lining_sides")
);
const extractedTypes = extractedFacts.find((row) => row.key === INTERNAL_WALLS_WALL_TYPES_FACT_KEY);
check(
  "Analyse may propose a wall type collection",
  extractedTypes != null && parseInternalWallsWallTypes(extractedTypes.value).length === 1
);

const bathroomCalc = calculateBathroom(
  ctx(
    [wa("b1", "bathroom", "Bathroom")],
    [fact("bathroom.job_scope", "b1", "full_renovation"), fact("bathroom.length_m", "b1", 3), fact("bathroom.width_m", "b1", 2)]
  ),
  wa("b1", "bathroom", "Bathroom")
);
check(
  "Bathroom isolation: bathroom calc does not read IW wall types",
  !read("lib/estimate/calculators/bathroom.ts").includes("internal_walls.wall_types")
);
check(
  "Bathroom still produces a result",
  bathroomCalc != null
);

const summary = summariseWallType(aType, 0);
check(
  "summary card uses builder language",
  summary.displayName === "Wall Type 1" &&
    (summary.frameLine ?? "").includes("90×45") &&
    (summary.liningLine ?? "").toLowerCase().includes("both sides")
);

console.log("\n--- Hosted policy / mobile / migrations ---\n");
check(
  "canonical Preview host",
  PREVIEW_AUTH_SITE_ORIGIN_STABLE.includes("hardening-stage-2a-security")
);
check("Preview ref recorded", PREVIEW_SUPABASE_PROJECT_REF === "shhpjsoldmqtkdbgrbtm");
check("plus-address fixture allowed", isPlusAddressFixture("hello+wa-iw-02@example.invalid"));
let protectedBlocked = false;
try {
  assertSafePreviewPasswordMutation("jeanluc@erccontracting.co.nz");
} catch {
  protectedBlocked = true;
}
check("protected human inbox cannot rotate password", protectedBlocked);
check(
  "protected emails listed",
  PREVIEW_PASSWORD_PROTECTED_EMAILS.includes("jeanluc@erccontracting.co.nz")
);
const panelUi = read("components/assistant/refine/InternalWallsWallTypesPanel.tsx");
check(
  "wall type cards stack, no table",
  panelUi.includes("space-y-2") && !panelUi.includes("<table")
);
const migrations = numberedMigrations();
check("no migration 055", !migrations.some((name) => name.startsWith("055_")));
check(
  "latest numbered migration is 056+",
  migrations[migrations.length - 1]?.startsWith("056_") === true
);
check(
  "no new numbered migration in 02",
  !read("docs/architecture/QUOTR_INTERNAL_WALLS_ESTIMATING_ARCHITECTURE.md").includes("create 055") ||
    read("docs/architecture/QUOTR_INTERNAL_WALLS_ESTIMATING_ARCHITECTURE.md").includes("Do not create")
);

console.log(`\nWA-INTERNAL-WALLS-02: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
