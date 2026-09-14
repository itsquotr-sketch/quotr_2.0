/**
 * CEILINGS WA-08-R2 — ordinary plasterboard sheet/layer disclosed assumptions.
 *
 * Run: npx --yes tsx scripts/verify-ceilings-wa-08-r2-assumptions.ts
 *
 * Preview only. No migrations. No Production.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { applyCeilingsReviewGroups } from "../lib/assistant/builder-review/ceilings-review-groups";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { composeRefineView } from "../lib/assistant/refine/compose";
import {
  extractCeilingPortionsFromBrief,
} from "../lib/estimate/ceilings-brief";
import {
  ceilingsWorkAreaIsReady,
  listCeilingsClarifyCandidates,
  summariseCeilingPortion,
} from "../lib/estimate/ceilings-clarify";
import { disclosedAssumptionValue } from "../lib/estimate/disclosed-assumptions";
import {
  CEILINGS_INFORMATION_CONTRACT,
  CEILINGS_LINING_LAYERS_ASSUMPTION,
  CEILINGS_LINING_LAYERS_ASSUMPTION_STATEMENT,
  CEILINGS_PLASTERBOARD_SHEET_LENGTH_ASSUMPTION_MM,
  CEILINGS_PLASTERBOARD_SHEET_SIZE_ASSUMPTION_STATEMENT,
  CEILINGS_PLASTERBOARD_SHEET_WIDTH_ASSUMPTION_MM,
} from "../lib/estimate/ceilings-information-contract";
import {
  calculateCeilingLining,
} from "../lib/estimate/ceilings-lining";
import {
  applyCeilingsFactWrite,
  CEILINGS_PORTIONS_FACT_KEY,
  createEmptyCeilingPortion,
  resolveCeilingsPortions,
  type CeilingPortion,
} from "../lib/estimate/ceilings-portions";
import type { EstimateFact } from "../lib/estimate/types";
import type { MaterialWastageSettings } from "../lib/settings/material-wastage";

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

const P1 = "aaaaaaaa-bbbb-4ccc-8ddd-111111111111";
const BRIEF =
  "Lounge ceiling is 4m x 3m with existing framing and 13mm Standard GIB.";
const BEFORE_QUESTION_COUNT = 8;
const AFTER_QUESTION_COUNT = 5;
const AFTER_QUESTIONS = [
  ["ceilings.portion.height_m", "Ceiling height?"],
  ["ceilings.portion.insulation_included", "Include insulation?"],
  ["ceilings.portion.bulkheads_present", "Any bulkheads?"],
  ["ceilings.portion.stopping_included", "Include stopping?"],
  ["ceilings.portion.painting_included", "Include painting?"],
] as const;

const WA = {
  id: "c1",
  type: "ceilings",
  name: "Ceilings",
  status: "confirmed" as const,
};

const WASTAGE: MaterialWastageSettings = {
  defaultMaterialWastagePercent: 10,
  sheetMaterialWastagePercent: 10,
  timberFramingWastagePercent: 10,
};

function writePortions(portions: CeilingPortion[]): EstimateFact[] {
  return applyCeilingsFactWrite({
    facts: [],
    workAreaId: "c1",
    key: CEILINGS_PORTIONS_FACT_KEY,
    value: portions,
  });
}

function withId(portion: CeilingPortion): CeilingPortion {
  return { ...portion, id: P1 };
}

function clarify(facts: EstimateFact[], briefText = BRIEF) {
  const plan = composeJobPlan({
    workAreas: [WA],
    facts,
    qualityLevel: "standard",
    briefText,
  });
  return composeClarifyView({
    stage: "quality",
    briefText,
    qualityLevel: "standard",
    workAreas: [WA],
    facts,
    constraints: [],
    jobPlan: plan,
  });
}

function refineOf(facts: EstimateFact[], briefText = BRIEF) {
  const plan = composeJobPlan({
    workAreas: [WA],
    facts,
    qualityLevel: "standard",
    briefText,
  });
  return composeRefineView({
    briefText,
    qualityLevel: "standard",
    workAreas: [WA],
    facts,
    constraints: [],
    jobPlan: {
      cards: plan.cards.map((card) => ({
        workAreaId: card.workAreaId,
        workAreaType: card.workAreaType,
        name: card.name,
        notConfirmed: card.notConfirmed,
      })),
    },
  });
}

function spawnVerifier(script: string): boolean {
  const result = spawnSync("npx", ["--yes", "tsx", script], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: true,
  });
  if (result.status !== 0) {
    console.log(result.stdout);
    console.log(result.stderr);
  }
  return result.status === 0;
}

function ordinaryLounge(params?: Partial<CeilingPortion["lining"]>): CeilingPortion {
  const row = createEmptyCeilingPortion({ id: P1, label: "Lounge" });
  row.geometry.mode = "length_width";
  row.geometry.length_m = 4;
  row.geometry.width_m = 3;
  row.geometry.area_m2 = 12;
  row.structure.family = "existing_framing";
  row.structure.job_scope = "reline_existing_suitable_framing";
  row.lining.family = "plasterboard";
  row.lining.plasterboard_product = params?.plasterboard_product ?? "standard";
  row.lining.thickness_mm = params?.thickness_mm ?? 13;
  if (params?.sheet_length_mm != null) {
    row.lining.sheet_length_mm = params.sheet_length_mm;
  }
  if (params?.sheet_width_mm != null) {
    row.lining.sheet_width_mm = params.sheet_width_mm;
  }
  if (params?.layers != null) row.lining.layers = params.layers;
  return row;
}

console.log("=== CEILINGS WA-08-R2 disclosed lining assumptions ===\n");

const fixtureFacts = writePortions(
  extractCeilingPortionsFromBrief(BRIEF).map(withId)
);
const fixturePortion = resolveCeilingsPortions({
  facts: fixtureFacts,
  workAreaId: "c1",
}).portions[0]!;
const fixtureView = clarify(fixtureFacts);
const fixtureQs = fixtureView.candidates.filter(
  (row) =>
    row.workAreaType === "ceilings" ||
    (row.factKey ?? "").startsWith("ceilings.portion.")
);
const fixtureKeys = fixtureQs.map((row) => row.factKey);

const omittedLining = calculateCeilingLining(fixturePortion, undefined, WASTAGE);
check(
  "A omitted sheet size resolves to 3000×1200 ASSUMED_DISCLOSED",
  omittedLining.status === "ok" &&
    omittedLining.sheetLengthM ===
      CEILINGS_PLASTERBOARD_SHEET_LENGTH_ASSUMPTION_MM / 1000 &&
    omittedLining.sheetWidthM ===
      CEILINGS_PLASTERBOARD_SHEET_WIDTH_ASSUMPTION_MM / 1000 &&
    omittedLining.sheetSizeSource === "assumed_disclosed" &&
    omittedLining.sheetSizeAssumption ===
      CEILINGS_PLASTERBOARD_SHEET_SIZE_ASSUMPTION_STATEMENT &&
    fixturePortion.lining.sheet_length_mm == null &&
    fixturePortion.lining.sheet_width_mm == null &&
    disclosedAssumptionValue("ceilings.portion.sheet_length_mm") == null &&
    disclosedAssumptionValue("ceilings.portion.sheet_width_mm") == null
);

check(
  "B omitted layers resolves to 1 ASSUMED_DISCLOSED",
  omittedLining.layerCount === CEILINGS_LINING_LAYERS_ASSUMPTION &&
    omittedLining.layerCountSource === "assumed_disclosed" &&
    omittedLining.layerCountSource !== "known" &&
    omittedLining.layerAssumption === CEILINGS_LINING_LAYERS_ASSUMPTION_STATEMENT &&
    fixturePortion.lining.layers == null &&
    disclosedAssumptionValue("ceilings.portion.layers") == null
);

check(
  "C neither sheet size nor layers appears as an active Details question",
  !fixtureKeys.includes("ceilings.portion.sheet_length_mm") &&
    !fixtureKeys.includes("ceilings.portion.sheet_width_mm") &&
    !fixtureKeys.includes("ceilings.portion.layers")
);

const explicitSheetsBrief =
  "Lounge ceiling is 4m x 3m with existing framing, 13mm Standard GIB and 2400x1200 sheets.";
const explicitSheets = extractCeilingPortionsFromBrief(explicitSheetsBrief)[0]!;
const explicitSheetsLining = calculateCeilingLining(
  withId(explicitSheets),
  undefined,
  WASTAGE
);
check(
  "D explicit 2400×1200 overrides assumption",
  explicitSheets.lining.sheet_length_mm === 2400 &&
    explicitSheets.lining.sheet_width_mm === 1200 &&
    explicitSheetsLining.sheetLengthM === 2.4 &&
    explicitSheetsLining.sheetWidthM === 1.2 &&
    explicitSheetsLining.sheetSizeSource === "known" &&
    explicitSheetsLining.sheetSizeAssumption == null &&
    explicitSheetsLining.installedSheets === 5
);

const explicitLayersBrief =
  "Lounge ceiling is 4m x 3m with existing framing and two layers of 13mm Fyreline.";
const explicitLayers = extractCeilingPortionsFromBrief(explicitLayersBrief)[0]!;
explicitLayers.lining.sheet_length_mm = 3000;
explicitLayers.lining.sheet_width_mm = 1200;
const explicitLayersLining = calculateCeilingLining(
  withId(explicitLayers),
  undefined,
  WASTAGE
);
check(
  "E explicit two layers overrides assumption",
  explicitLayers.lining.layers === 2 &&
    explicitLayersLining.layerCount === 2 &&
    explicitLayersLining.layerCountSource === "known" &&
    explicitLayersLining.layerAssumption == null &&
    explicitLayersLining.installedSheets === 8
);

const review = applyCeilingsReviewGroups({
  categories: [],
  priced: [],
  facts: fixtureFacts,
  workAreaId: "c1",
  workAreaName: "Ceilings",
  requirements: [],
  missingInfo: [],
});
const loungeAssumptions = review.portionGroups[0]?.assumptions ?? [];
check(
  "F assumptions appear in Builder Review",
  loungeAssumptions.some((row) =>
    /Assumed:\s*3000\s*×\s*1200 mm plasterboard sheets/i.test(row)
  ) &&
    loungeAssumptions.some((row) =>
      /Assumed:\s*one layer of ceiling lining/i.test(row)
    ) &&
    !loungeAssumptions.some((row) => /ASSUMED_DISCLOSED|assumed_disclosed/i.test(row))
);

const refine = refineOf(fixtureFacts);
const refineRows = [...refine.highValue, ...refine.advanced];
const refineLength = refineRows.find(
  (row) => row.factKey === "ceilings.portion.sheet_length_mm"
);
const refineWidth = refineRows.find(
  (row) => row.factKey === "ceilings.portion.sheet_width_mm"
);
const refineLayers = refineRows.find(
  (row) => row.factKey === "ceilings.portion.layers"
);
check(
  "G Refine exposes editable assumed sheet size and layers",
  refineLength?.currentValue === 3000 &&
    refineLength.assumed === true &&
    refineLength.valueSource === "assumption" &&
    refineWidth?.currentValue === 1200 &&
    refineWidth.assumed === true &&
    refineLayers?.currentValue === 1 &&
    refineLayers.assumed === true &&
    !refineRows.some(
      (row) => row.factKey === "ceilings.portion.insulation_included"
    )
);

const afterSheetEdit = applyCeilingsFactWrite({
  facts: applyCeilingsFactWrite({
    facts: fixtureFacts,
    workAreaId: "c1",
    key: "ceilings.portion.sheet_length_mm",
    value: 2400,
    nestedItemId: P1,
  }),
  workAreaId: "c1",
  key: "ceilings.portion.sheet_width_mm",
  value: 1200,
  nestedItemId: P1,
});
const editedSheetPortion = resolveCeilingsPortions({
  facts: afterSheetEdit,
  workAreaId: "c1",
}).portions[0]!;
const editedSheetLining = calculateCeilingLining(
  editedSheetPortion,
  undefined,
  WASTAGE
);
check(
  "H Refine sheet-size edit recalculates sheets",
  editedSheetPortion.lining.sheet_length_mm === 2400 &&
    editedSheetLining.sheetSizeSource === "known" &&
    editedSheetLining.installedSheets === 5 &&
    editedSheetLining.purchaseSheets === 6 &&
    omittedLining.installedSheets === 4 &&
    editedSheetLining.installedSheets !== omittedLining.installedSheets
);

const afterLayerEdit = applyCeilingsFactWrite({
  facts: fixtureFacts,
  workAreaId: "c1",
  key: "ceilings.portion.layers",
  value: 2,
  nestedItemId: P1,
});
const editedLayerPortion = resolveCeilingsPortions({
  facts: afterLayerEdit,
  workAreaId: "c1",
}).portions[0]!;
const editedLayerLining = calculateCeilingLining(
  editedLayerPortion,
  undefined,
  WASTAGE
);
check(
  "I Refine layer edit recalculates quantities",
  editedLayerPortion.lining.layers === 2 &&
    editedLayerLining.layerCountSource === "known" &&
    editedLayerLining.installedSheets === 8 &&
    editedLayerLining.purchaseSheets === 10 &&
    editedLayerLining.labourBasisInstalled === 8
);

const otherProduct = ordinaryLounge({ plasterboard_product: "other" });
const otherLining = calculateCeilingLining(otherProduct, undefined, WASTAGE);
const otherQs = listCeilingsClarifyCandidates({
  facts: writePortions([otherProduct]),
  workAreaId: "c1",
  workAreaName: "Ceilings",
});
check(
  "J specialist/product-constrained system does not receive unsafe generic sheet default",
  otherLining.status === "information_required" &&
    otherLining.sheetSizeSource == null &&
    otherLining.sheetLengthM == null &&
    otherQs.some((row) => row.factKey === "ceilings.portion.sheet_length_mm") &&
    otherQs.some((row) => row.factKey === "ceilings.portion.sheet_width_mm")
);

const unknownFire = ordinaryLounge({
  plasterboard_product: "fyreline",
  thickness_mm: 13,
  sheet_length_mm: 3000,
  sheet_width_mm: 1200,
});
unknownFire.fire_acoustic_requirement = "unknown_proprietary";
unknownFire.specialist_kind = "unknown_proprietary_fire";
const unknownFireLining = calculateCeilingLining(
  unknownFire,
  undefined,
  WASTAGE
);
const unknownFireQs = listCeilingsClarifyCandidates({
  facts: writePortions([unknownFire]),
  workAreaId: "c1",
  workAreaName: "Ceilings",
});
check(
  "K unknown proprietary fire/acoustic does not silently get 1-layer ordinary semantics",
  unknownFireLining.status === "information_required" &&
    unknownFireLining.layerCountSource !== "assumed_disclosed" &&
    unknownFireLining.layerCount == null &&
    unknownFireQs.some((row) => row.factKey === "ceilings.portion.layers") &&
    !ceilingsWorkAreaIsReady({
      facts: writePortions([unknownFire]),
      workAreaId: "c1",
      workAreaName: "Ceilings",
    })
);

check(
  `L fixture question count drops from ${BEFORE_QUESTION_COUNT} to ${AFTER_QUESTION_COUNT}`,
  fixtureQs.length === AFTER_QUESTION_COUNT,
  fixtureQs.map((row) => `${row.factKey}=${row.question}`).join(" | ")
);

check(
  "M remaining 5 question copies are concise",
  AFTER_QUESTIONS.every(
    ([key, question]) =>
      fixtureQs.some((row) => row.factKey === key && row.question === question)
  ) &&
    fixtureQs.every(
      (row) =>
        !/can you confirm this estimating detail/i.test(row.question) &&
        !row.question.startsWith("Lounge:")
    )
);

let readyFacts = fixtureFacts;
for (const [key, value] of [
  ["ceilings.portion.bulkheads_present", false],
  ["ceilings.portion.insulation_included", false],
  ["ceilings.portion.stopping_included", false],
  ["ceilings.portion.painting_included", false],
] as const) {
  readyFacts = applyCeilingsFactWrite({
    facts: readyFacts,
    workAreaId: "c1",
    key,
    value,
    nestedItemId: P1,
  });
}
const readyView = clarify(readyFacts);
const stillMissingLength = createEmptyCeilingPortion({ id: P1, label: "Lounge" });
stillMissingLength.structure.family = "existing_framing";
stillMissingLength.structure.job_scope = "reline_existing_suitable_framing";
stillMissingLength.lining.family = "plasterboard";
stillMissingLength.lining.plasterboard_product = "standard";
stillMissingLength.lining.thickness_mm = 13;
stillMissingLength.has_bulkheads = false;
stillMissingLength.finish.insulation_included = false;
stillMissingLength.finish.painting_included = false;
stillMissingLength.finish.stopping_included = false;
check(
  "N Ready remains correct",
  !fixtureView.enoughToEstimate &&
    ceilingsWorkAreaIsReady({
      facts: readyFacts,
      workAreaId: "c1",
      workAreaName: "Ceilings",
    }) &&
    readyView.enoughToEstimate &&
    !listCeilingsClarifyCandidates({
      facts: readyFacts,
      workAreaId: "c1",
      workAreaName: "Ceilings",
    }).some((row) =>
      [
        "ceilings.portion.sheet_length_mm",
        "ceilings.portion.sheet_width_mm",
        "ceilings.portion.layers",
      ].includes(row.factKey ?? "")
    ) &&
    !clarify(writePortions([stillMissingLength])).enoughToEstimate
);

const summary = summariseCeilingPortion(fixturePortion, 0);
check(
  "Details card summary stays Lounge / 4m × 3m / Existing framing / Standard plasterboard",
  summary.displayName === "Lounge" &&
    summary.geometryLine === "4m × 3m" &&
    summary.structureLine === "Existing framing" &&
    summary.liningLine === "Standard plasterboard" &&
    !/3000/.test(
      [summary.geometryLine, summary.structureLine, summary.liningLine]
        .filter(Boolean)
        .join(" ")
    ) &&
    !/layer/i.test(summary.liningLine ?? "")
);

const assumeIfSkipped = CEILINGS_INFORMATION_CONTRACT.filter(
  (row) => row.askClass === "ASSUME_IF_SKIPPED"
).map((row) => row.factKey);
check(
  "ASSUME_IF_SKIPPED audit keys remain on the contract",
  assumeIfSkipped.includes("ceilings.portion.sheet_length_mm") &&
    assumeIfSkipped.includes("ceilings.portion.sheet_width_mm") &&
    assumeIfSkipped.includes("ceilings.portion.layers") &&
    assumeIfSkipped.includes("ceilings.portion.height_m") &&
    assumeIfSkipped.includes("ceilings.portion.spacing_mm") &&
    assumeIfSkipped.includes("ceilings.portion.direction") &&
    assumeIfSkipped.includes("ceilings.portion.suspension_spacing_m") &&
    assumeIfSkipped.includes("ceilings.portion.edge_offset_m") &&
    assumeIfSkipped.includes("ceilings.portion.structure_requirements") &&
    fixtureKeys.includes("ceilings.portion.height_m")
);

check(
  "no scalar fake lining facts were added to disclosedAssumptionValue",
  disclosedAssumptionValue("ceilings.portion.layers") == null &&
    disclosedAssumptionValue("ceilings.portion.sheet_length_mm") == null &&
    !read("lib/estimate/disclosed-assumptions.ts").includes(
      "ceilings.portion.layers"
    )
);

console.log("\n=== Fixture Details questions AFTER ===");
for (const row of fixtureQs) {
  console.log(`  ${row.question} (${row.factKey})`);
}

console.log("\n=== ASSUME_IF_SKIPPED audit ===");
console.log("  A auto disclosed: ceilings.portion.sheet_length_mm (ordinary plasterboard)");
console.log("  A auto disclosed: ceilings.portion.sheet_width_mm (ordinary plasterboard)");
console.log("  A auto disclosed: ceilings.portion.layers (ordinary plasterboard)");
console.log("  B still ask: ceilings.portion.height_m");
console.log("  B still ask: ceilings.portion.spacing_mm");
console.log("  B still ask: ceilings.portion.direction");
console.log("  B still ask: ceilings.portion.suspension_spacing_m");
console.log("  B still ask: ceilings.portion.edge_offset_m");
console.log("  already hidden: ceilings.portion.structure_requirements");

console.log("\n=== Prior Ceiling + Details regressions ===\n");
const prior = [
  "scripts/verify-ceilings-wa-08-r1-details.ts",
];
for (const script of prior) {
  check(script.replace("scripts/", ""), spawnVerifier(script));
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
