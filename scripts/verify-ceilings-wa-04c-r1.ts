/**
 * CEILINGS WA-04C-R1 — plasterboard thickness + lining layer provenance.
 *
 * Run: npx --yes tsx scripts/verify-ceilings-wa-04c-r1.ts
 *
 * Quantity math stays on WA-04C. This proves identity / Ready / source.
 * Preview only.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import {
  canonicalCeilingPlasterboardThicknessFromText,
  extractCeilingPortionsFromBrief,
} from "../lib/estimate/ceilings-brief";
import {
  listCeilingsClarifyCandidates,
} from "../lib/estimate/ceilings-clarify";
import {
  CEILINGS_LINING_LAYERS_ASSUMPTION_STATEMENT,
  ceilingsFactIsRelevant,
  lookupCeilingsInformationContract,
} from "../lib/estimate/ceilings-information-contract";
import {
  calculateCeilingLining,
  CEILINGS_PLASTERBOARD_COMPONENT,
} from "../lib/estimate/ceilings-lining";
import { calculateCeilingsPhysical } from "../lib/estimate/ceilings-physical";
import {
  applyCeilingsFactWrite,
  CEILINGS_NESTED_NOT_CALCULATED_MESSAGE,
  CEILINGS_PORTIONS_FACT_KEY,
  createEmptyCeilingPortion,
  type CeilingPortion,
} from "../lib/estimate/ceilings-portions";
import { dimensionedPlasterboardKey } from "../lib/estimate/internal-walls-lining";
import { disclosedAssumptionValue } from "../lib/estimate/disclosed-assumptions";
import type { EstimateContext, EstimateFact, EstimateWorkArea } from "../lib/estimate/types";
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
const WA: EstimateWorkArea = {
  id: "c1",
  type: "ceilings",
  name: "Ceilings",
  sort_order: 1,
};
const extraWas = [
  { id: "p1", type: "painting", name: "Painting", status: "confirmed" as const },
  { id: "pl1", type: "plastering", name: "Plastering", status: "confirmed" as const },
];

const WASTAGE: MaterialWastageSettings = {
  defaultMaterialWastagePercent: 10,
  sheetMaterialWastagePercent: 10,
  timberFramingWastagePercent: 10,
};

function portion(params: {
  lining?: CeilingPortion["lining"]["family"];
  product?: CeilingPortion["lining"]["plasterboard_product"];
  thickness?: CeilingPortion["lining"]["thickness_mm"] | null;
  layers?: number | null;
  plywoodSpec?: string;
  boardWidth?: number;
  tileSize?: "600x600";
}): CeilingPortion {
  const row = createEmptyCeilingPortion({ id: P1, label: "Lounge" });
  row.geometry.mode = "length_width";
  row.geometry.length_m = 4;
  row.geometry.width_m = 3;
  row.geometry.area_m2 = 12;
  row.structure.family = "existing_framing";
  row.structure.job_scope = "reline_existing_suitable_framing";
  row.lining.family = params.lining ?? "plasterboard";
  if (params.product) row.lining.plasterboard_product = params.product;
  if (params.thickness !== undefined) {
    row.lining.thickness_mm = params.thickness ?? undefined;
  }
  row.lining.sheet_length_mm = 3000;
  row.lining.sheet_width_mm = 1200;
  if (params.layers !== undefined) row.lining.layers = params.layers;
  if (params.plywoodSpec) row.lining.plywood_spec = params.plywoodSpec;
  if (params.lining === "timber_lined") {
    row.lining.timber_lined = {
      board_width_mm: params.boardWidth ?? 90,
      gap_mm: 10,
      direction: "along_length",
    };
  }
  if (params.tileSize) row.lining.tile = { size: params.tileSize };
  row.finish.insulation_included = false;
  row.has_bulkheads = false;
  return row;
}

function writePortions(portions: CeilingPortion[]): EstimateFact[] {
  return applyCeilingsFactWrite({
    facts: [],
    workAreaId: "c1",
    key: CEILINGS_PORTIONS_FACT_KEY,
    value: portions,
  });
}

function clarify(facts: EstimateFact[]) {
  const workAreas = [WA, ...extraWas];
  const plan = composeJobPlan({
    workAreas,
    facts,
    qualityLevel: "standard",
    briefText: "",
  });
  return composeClarifyView({
    stage: "quality",
    briefText: "",
    qualityLevel: "standard",
    workAreas,
    facts,
    constraints: [],
    jobPlan: plan,
  });
}

function lining(params: Parameters<typeof portion>[0]) {
  return calculateCeilingLining(portion(params), undefined, WASTAGE);
}

function estimateCtx(facts: EstimateFact[]): EstimateContext {
  return {
    project: { id: "ceilings-wa-04c-r1", qualityLevel: "standard" },
    confirmedWorkAreas: [WA],
    facts,
    constraints: [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
      budget_rate_factor: 0.9,
      premium_rate_factor: 1.15,
    },
    materialWastageSettings: WASTAGE,
    rates: [],
  } as unknown as EstimateContext;
}

console.log("=== CEILINGS WA-04C-R1 thickness + layer provenance ===\n");

const extracted10 = extractCeilingPortionsFromBrief(
  "10mm standard GIB ceiling over existing framing, 4m x 3m."
);
check(
  "A 10mm Standard extracts thickness 10",
  extracted10[0]?.lining.thickness_mm === 10 &&
    extracted10[0]?.lining.plasterboard_product === "standard" &&
    canonicalCeilingPlasterboardThicknessFromText("10mm standard GIB ceiling") ===
      10
);

const extracted13 = extractCeilingPortionsFromBrief(
  "13mm Fyreline ceiling over existing framing, 4m x 3m."
);
check(
  "B 13mm Fyreline extracts thickness 13",
  extracted13[0]?.lining.thickness_mm === 13 &&
    extracted13[0]?.lining.plasterboard_product === "fyreline" &&
    canonicalCeilingPlasterboardThicknessFromText("13mm Fyreline") === 13
);

const extractedBare = extractCeilingPortionsFromBrief(
  "Standard GIB ceiling over existing framing, 4m x 3m."
);
check(
  "C Standard GIB ceiling does not silently become 13mm",
  extractedBare[0]?.lining.plasterboard_product === "standard" &&
    extractedBare[0]?.lining.thickness_mm == null &&
    canonicalCeilingPlasterboardThicknessFromText("Standard GIB ceiling") ==
      null
);

const readyFacts = writePortions([
  portion({ product: "standard", thickness: null }),
]);
const readyView = clarify(readyFacts);
const thicknessCandidate = readyView.candidates.find(
  (row) => row.factKey === "ceilings.portion.thickness_mm"
);
check(
  "D unresolved plasterboard thickness blocks Ready",
  !readyView.enoughToEstimate &&
    thicknessCandidate?.askClass === "ASK_NOW" &&
    thicknessCandidate.blocksEstimate === true &&
    thicknessCandidate?.question.toLowerCase().includes("plasterboard thickness")
);

const plasterboardFacts = writePortions([
  portion({ lining: "plasterboard", product: "standard", thickness: null }),
]);
const plywoodFacts = writePortions([
  portion({ lining: "plywood", plywoodSpec: "CD 12mm" }),
]);
const timberFacts = writePortions([
  portion({ lining: "timber_lined", boardWidth: 90 }),
]);
const tileFacts = writePortions([
  portion({ lining: "tile_and_grid", tileSize: "600x600" }),
]);
const pbCandidates = listCeilingsClarifyCandidates({
  facts: plasterboardFacts,
  workAreaId: "c1",
  workAreaName: "Ceilings",
});
const plywoodCandidates = listCeilingsClarifyCandidates({
  facts: plywoodFacts,
  workAreaId: "c1",
  workAreaName: "Ceilings",
});
const timberCandidates = listCeilingsClarifyCandidates({
  facts: timberFacts,
  workAreaId: "c1",
  workAreaName: "Ceilings",
});
const tileCandidates = listCeilingsClarifyCandidates({
  facts: tileFacts,
  workAreaId: "c1",
  workAreaName: "Ceilings",
});
check(
  "E thickness question only relevant for plasterboard",
  pbCandidates.some((row) => row.factKey === "ceilings.portion.thickness_mm") &&
    !plywoodCandidates.some((row) => row.factKey === "ceilings.portion.thickness_mm") &&
    !timberCandidates.some((row) => row.factKey === "ceilings.portion.thickness_mm") &&
    !tileCandidates.some((row) => row.factKey === "ceilings.portion.thickness_mm") &&
    ceilingsFactIsRelevant("ceilings.portion.thickness_mm", {
      facts: plasterboardFacts,
      workAreaId: "c1",
      portion: portion({ lining: "plasterboard", product: "standard" }),
    }) &&
    !ceilingsFactIsRelevant("ceilings.portion.thickness_mm", {
      facts: tileFacts,
      workAreaId: "c1",
      portion: portion({ lining: "tile_and_grid", tileSize: "600x600" }),
    })
);

const tenMm = lining({ product: "standard", thickness: 10 });
const expected10 = dimensionedPlasterboardKey({
  product: "standard_gib",
  thicknessMm: 10,
  lengthMm: 3000,
  widthMm: 1200,
});
check(
  "F 10mm resolves to correct shared material identity",
  tenMm.status === "ok" &&
    tenMm.product.kind === "canonical" &&
    tenMm.product.materialKey === expected10 &&
    tenMm.product.materialKey ===
      "sheet.plasterboard.standard.10mm.3000x1200.each" &&
    !tenMm.product.materialKey?.startsWith("ceilings.")
);

const thirteenMm = lining({ product: "standard", thickness: 13 });
const expected13 = dimensionedPlasterboardKey({
  product: "standard_gib",
  thicknessMm: 13,
  lengthMm: 3000,
  widthMm: 1200,
});
const fyreline13 = lining({ product: "fyreline", thickness: 13 });
const expectedFyreline13 = dimensionedPlasterboardKey({
  product: "fyreline",
  thicknessMm: 13,
  lengthMm: 3000,
  widthMm: 1200,
});
check(
  "G 13mm resolves to correct shared material identity",
  thirteenMm.status === "ok" &&
    thirteenMm.product.kind === "canonical" &&
    thirteenMm.product.materialKey === expected13 &&
    thirteenMm.installedSheets === 4 &&
    thirteenMm.purchaseSheets === 5 &&
    fyreline13.product.kind === "canonical" &&
    fyreline13.product.materialKey === expectedFyreline13 &&
    fyreline13.product.materialKey ===
      "sheet.plasterboard.fyreline.13mm.3000x1200.each"
);

const fyreline10 = lining({ product: "fyreline", thickness: 10 });
const missingThickness = lining({ product: "standard", thickness: null });
check(
  "H unsupported combination does not silently substitute another thickness",
  fyreline10.status === "ok" &&
    fyreline10.product.kind === "custom" &&
    fyreline10.product.materialKey == null &&
    fyreline10.product.materialKey !== expectedFyreline13 &&
    fyreline10.product.specification.includes("10 mm") &&
    !fyreline10.product.specification.startsWith("13 mm") &&
    missingThickness.status === "information_required" &&
    missingThickness.product.kind === "unresolved" &&
    missingThickness.product.materialKey == null
);

const explicitOne = lining({
  product: "standard",
  thickness: 13,
  layers: 1,
});
check(
  "I explicit one layer source is user/known",
  explicitOne.layerCount === 1 &&
    explicitOne.layerCountSource === "known" &&
    explicitOne.layerAssumption == null
);

const omittedLayers = lining({ product: "standard", thickness: 13 });
check(
  "J omitted layers = 1 only through ASSUMED_DISCLOSED",
  omittedLayers.layerCount === 1 &&
    omittedLayers.layerCountSource === "assumed_disclosed" &&
    omittedLayers.layerCountSource !== "known" &&
    disclosedAssumptionValue("ceilings.portion.layers") == null
);

const omittedPhysical = calculateCeilingsPhysical({
  facts: writePortions([portion({ product: "standard", thickness: 13 })]),
  workArea: WA,
  materialWastageSettings: WASTAGE,
});
const omittedReq = omittedPhysical.requirements.find(
  (row) => row.componentKey === CEILINGS_PLASTERBOARD_COMPONENT
);
const explicitPhysical = calculateCeilingsPhysical({
  facts: writePortions([
    portion({ product: "standard", thickness: 13, layers: 1 }),
  ]),
  workArea: WA,
  materialWastageSettings: WASTAGE,
});
const explicitReq = explicitPhysical.requirements.find(
  (row) => row.componentKey === CEILINGS_PLASTERBOARD_COMPONENT
);
const layersLookup = lookupCeilingsInformationContract(
  "ceilings.portion.layers",
  {
    facts: writePortions([portion({ product: "standard", thickness: 13 })]),
    workAreaId: "c1",
    portion: portion({ product: "standard", thickness: 13 }),
  }
);
check(
  "K disclosed one-layer assumption exists",
  omittedLayers.layerAssumption === CEILINGS_LINING_LAYERS_ASSUMPTION_STATEMENT &&
    omittedReq?.assumptions.some(
      (row) => row.text === CEILINGS_LINING_LAYERS_ASSUMPTION_STATEMENT
    ) === true &&
    explicitReq?.assumptions.some(
      (row) => row.text === CEILINGS_LINING_LAYERS_ASSUMPTION_STATEMENT
    ) !== true &&
    layersLookup.askClass === "ASSUME_IF_SKIPPED" &&
    listCeilingsClarifyCandidates({
      facts: writePortions([portion({ product: "standard", thickness: 13 })]),
      workAreaId: "c1",
      workAreaName: "Ceilings",
    }).some(
      (row) =>
        row.factKey === "ceilings.portion.layers" &&
        row.assumptionStatement === CEILINGS_LINING_LAYERS_ASSUMPTION_STATEMENT
    )
);

const twoLayer = lining({ product: "standard", thickness: 13, layers: 2 });
check(
  "L 2-layer quantity is 2 × installed-per-layer",
  twoLayer.installedSheetsPerLayer === 4 &&
    twoLayer.installedSheets === 8 &&
    twoLayer.labourBasisInstalled === 8 &&
    twoLayer.layerCountSource === "known"
);

check(
  "M waste applied once correctly",
  twoLayer.purchaseSheetsPerLayer === 5 &&
    twoLayer.purchaseSheets === 10 &&
    twoLayer.wasteFactor === 0.1 &&
    twoLayer.purchaseSheets !== Math.ceil(8 * 1.1) &&
    twoLayer.labourBasisInstalled !== twoLayer.purchaseSheets
);

check(
  "N 04C quantity fixtures unchanged otherwise",
  thirteenMm.installedSheets === 4 &&
    thirteenMm.purchaseSheets === 5 &&
    omittedLayers.installedSheets === 4 &&
    omittedLayers.purchaseSheets === 5 &&
    thirteenMm.product.materialKey ===
      "sheet.plasterboard.standard.13mm.3000x1200.each"
);

const nestedHosted = calculateEstimate(
  estimateCtx(writePortions([portion({ product: "standard", thickness: 13 })]))
);
check(
  "O nested Ceiling uses the new engine, never the temporary guard",
  nestedHosted.lineItems.length > 0 &&
    !nestedHosted.missingInfo.some((row) =>
      row.includes(CEILINGS_NESTED_NOT_CALCULATED_MESSAGE)
    ) &&
    read("lib/estimate/calculators/fitout.ts").includes("calculateCeilingsPhysical") &&
    read("lib/estimate/calculators/fitout.ts").includes("commercializeCeilings")
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
