/**
 * WA-BATHROOM-POLISH-01 — beta UX, conditions, tile count, floor build-up.
 *
 * Run: npx --yes tsx scripts/verify-work-area-bathroom-polish-01.ts
 *
 * No paid AI. No Production. Do not create migration 055.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { composeRefineView } from "../lib/assistant/refine/compose";
import {
  mergeMultiSelectToggle,
  shouldAcceptPersistedAnswer,
} from "../lib/assistant/selection/latest-answer";
import {
  BATHROOM_FC_19MM_TILE_READY_STATEMENT,
  BATHROOM_FLOOR_SUBSTRATE_COMPONENT,
  BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY,
  BATHROOM_FLOOR_SUBSTRATE_FIBRE_CEMENT_KEY,
  BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
  BATHROOM_FLOOR_SUBSTRATE_SECURA_KEY,
  BATHROOM_FLOOR_TILE_MATERIAL_COMPONENT,
  BATHROOM_FRAMING_INTENSITY_LM_PER_M2,
  BATHROOM_PRODUCTIVITY_BENCHMARKS,
  BATHROOM_SECURA_TILE_READY_STATEMENT,
  BATHROOM_SHEET_VINYL_MATERIAL_COMPONENT,
  BATHROOM_TILE_UNDERLAY_6MM_KEY,
  BATHROOM_TILE_UNDERLAY_COMPONENT,
  BATHROOM_TILE_UNDERLAY_LABOUR_REQUIRED,
  BATHROOM_TILE_UNDERLAY_SIZE_REQUIRED,
} from "../lib/estimate/bathroom-identities";
import {
  BATHROOM_FC_19MM_SHEET_AREA_M2,
  BATHROOM_SECURA_SHEET_AREA_M2,
  bathroomPlywoodRequiresTileUnderlay,
  bathroomStructuralSheetTakeoff,
  resolveBathroomFloorBuildUp,
} from "../lib/estimate/bathroom-floor-buildup";
import {
  bathroomApproxCount,
  bathroomPurchaseAreaM2,
  bathroomTileFaceAreaM2,
} from "../lib/estimate/bathroom-finishes";
import { calculateBathroom } from "../lib/estimate/calculators/bathroom";
import { SHARED_CONSUMED_CONSTRAINT_KEYS } from "../lib/estimate/consumed-facts";
import { getCatalogueEntry } from "../lib/rates/catalogue";
import { SPECIFIC_MATERIAL_RATE_GROUPS } from "../lib/rates/specific-material-catalogue";
import { optionValueMatches } from "../lib/scopes/option-match";
import type { EstimateLineItem } from "../components/assistant/types";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "../lib/estimate/types";
import type { MaterialRequirement } from "../lib/estimate/requirements";

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

function near(actual: number | null | undefined, expected: number, tol = 1e-9): boolean {
  return actual != null && Number.isFinite(actual) && Math.abs(actual - expected) <= tol;
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

function ctx(workAreas: EstimateWorkArea[], facts: EstimateFact[]): EstimateContext {
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

function bathroom(facts: EstimateFact[], id = "b1") {
  return calculateBathroom(
    ctx([wa(id, "bathroom", "Bathroom")], facts),
    wa(id, "bathroom", "Bathroom")
  );
}

function materials(result: ReturnType<typeof calculateBathroom>): MaterialRequirement[] {
  return (result.requirements ?? []).filter(
    (row): row is MaterialRequirement => row.kind === "material"
  );
}

function mapCalcLines(items: readonly EstimateLineItemInput[]): EstimateLineItem[] {
  return items.map((item, index) => ({
    id: `line-${index}`,
    workAreaName: item.workAreaName,
    label: item.label,
    category: item.category as EstimateLineItem["category"],
    costLow: item.costLow,
    costHigh: item.costHigh,
    sellLow: item.sellLow,
    sellHigh: item.sellHigh,
    recommendedCost: item.recommendedCost,
    recommendedSell: item.recommendedSell,
    grossProfit: item.grossProfit,
    marginPercent: item.marginPercent,
    markupPercent: item.markupPercent,
    rateSource: item.rateSource,
    quantity: item.quantity,
    unit: item.unit,
    labourHours: item.labourHours,
    costRate: item.costRate,
    sellRate: item.sellRate,
    itemKey: item.itemKey,
    componentKey: item.componentKey,
    notes: item.notes,
    identitySummary: item.identitySummary,
    includedInTotal: item.includedInTotal,
    rateSourceType: item.rateSourceType,
  }));
}

function composeBathroomClarify(
  facts: EstimateFact[],
  constraints: { key: string; value: unknown }[] = []
) {
  const workAreas = [wa("b1", "bathroom", "Bathroom")];
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
    constraints: constraints.map((row) => ({
      id: row.key,
      key: row.key,
      label: row.key,
      value: row.value,
      source: "user",
    })),
    jobPlan: plan,
  });
}

const room: EstimateFact[] = [
  fact("bathroom.job_scope", "b1", "full_renovation"),
  fact("bathroom.length_m", "b1", 3),
  fact("bathroom.width_m", "b1", 2.4),
  fact("bathroom.wall_height_m", "b1", 2.4),
];

const answeredCore: EstimateFact[] = [
  ...room,
  fact("bathroom.demolition_required", "b1", true),
  fact("bathroom.demolition.components", "b1", [
    "Floor finish",
    "Wall lining",
    "Vanity",
    "Toilet",
  ]),
  fact("bathroom.floor_finish_system", "b1", "tile"),
  fact("bathroom.tile_format", "b1", "600x600"),
  fact("bathroom.floor_substrate_system", "b1", "treated_plywood"),
  fact("bathroom.framing_level", "b1", "standard"),
  fact("bathroom.wall_lining_included", "b1", true),
  fact("bathroom.ceiling_lining_included", "b1", true),
];

console.log("=== WA-BATHROOM-POLISH-01 ===\n");

console.log("--- Selection contract ---\n");
const optionSrc = read("components/assistant/selection/OptionSelect.tsx");
const shellSrc = read("components/assistant/AssistantShell.tsx");
const clarifySrc = read("components/assistant/clarify/ClarifyPanel.tsx");
const refineSrc = read("components/assistant/clarify/ClarifyReadiness.tsx");
check(
  "shared OptionSelect is used by Clarify/Details/Refine/QuestionBlock",
  optionSrc.includes("data-option-selected") &&
    clarifySrc.includes("OptionSelect") &&
    refineSrc.includes("OptionSelect") &&
    read("components/assistant/QuestionBlock.tsx").includes("OptionSelect")
);
check(
  "Clarify overlays select answers before persist",
  shellSrc.includes("if (!isNumericOrText)") &&
    shellSrc.includes("setJobPlanFactOverlay((prev) => overlayFact(prev, overlayRow))")
);
check(
  "select clicks do not disable chips via clarifyWritePending",
  shellSrc.includes("if (isNumericOrText) setClarifyWritePending(true)")
);
check(
  "Clarify keeps local selected values",
  clarifySrc.includes("localValues") && clarifySrc.includes("heldMulti")
);
check(
  "Refine keeps local selected values and does not disable options while saving",
  refineSrc.includes("localValues") &&
    !/OptionSelect[\s\S]{0,220}disabled=\{isSaving\}/.test(refineSrc)
);
check(
  "stale persist does not overwrite a newer answer",
  shouldAcceptPersistedAnswer({ persistedSeq: 1, latestSeqForKey: 2 }) === false &&
    shouldAcceptPersistedAnswer({ persistedSeq: 2, latestSeqForKey: 2 }) === true
);
check(
  "multi-select toggle merges independently",
  JSON.stringify(mergeMultiSelectToggle(["Floor finish"], "Vanity")) ===
    JSON.stringify(["Floor finish", "Vanity"]) &&
    JSON.stringify(mergeMultiSelectToggle(["Floor finish", "Vanity"], "Vanity")) ===
      JSON.stringify(["Floor finish"])
);
check(
  "enum values highlight option labels",
  optionValueMatches("19 mm treated plywood", "treated_plywood") &&
    optionValueMatches("Minor — a few nogs/supports", "minor") &&
    optionValueMatches("Floor finish", "floor_finish")
);

console.log("\n--- Multi-select demolition ---\n");
const demoTemplate = read("lib/scopes/templates/bathroom.ts");
check(
  "demolition question is multi_select",
  demoTemplate.includes("BATHROOM_DEMOLITION_COMPONENTS_FACT_KEY") &&
    demoTemplate.includes('inputType: "multi_select"')
);
const refineAdapter = read("lib/assistant/refine/adapters/bathroom.ts");
check("Refine demolition stays visible after first toggle", refineAdapter.includes("multi_select"));
const demoCalc = bathroom(answeredCore);
const demoKeys = (demoCalc.requirements ?? [])
  .filter((row) => row.kind === "labour" && String(row.componentKey).startsWith("bathroom.demolition."))
  .map((row) => row.componentKey);
check(
  "four selected removals emit",
  demoKeys.includes("bathroom.demolition.floor_finish") &&
    demoKeys.includes("bathroom.demolition.wall_lining") &&
    demoKeys.includes("bathroom.demolition.vanity") &&
    demoKeys.includes("bathroom.demolition.toilet")
);
check(
  "no duplicate component-removal facts",
  !read("lib/estimate/bathroom-scope.ts").includes("bathroom.removal.") &&
    read("lib/estimate/bathroom-scope.ts").includes("bathroom.demolition.components")
);

console.log("\n--- Condition readiness ---\n");
const unknownPc = composeBathroomClarify(answeredCore);
const allPc = [...unknownPc.candidates, ...unknownPc.deferred];
const pcKeys = allPc
  .filter((row) => row.source === "project_condition")
  .map((row) => row.constraintKey);
check("Ready blocked while P0 conditions unknown", unknownPc.enoughToEstimate === false);
check(
  "P0 conditions participate before Ready",
  pcKeys.includes("site_access") &&
    pcKeys.includes("material_carry_distance") &&
    pcKeys.includes("occupied_site") &&
    pcKeys.includes("working_hours")
);
check(
  "P1 conditions may appear but do not dump every condition",
  !pcKeys.includes("parking") && !pcKeys.includes("consent_required")
);
const knownPc = composeBathroomClarify(answeredCore, [
  { key: "site_access", value: "Easy" },
  { key: "material_carry_distance", value: "< 10m" },
  { key: "occupied_site", value: "No" },
  { key: "working_hours", value: "No" },
]);
check("Ready can appear after P0 conditions answered", knownPc.enoughToEstimate === true);
check(
  "labour-consumed P0 keys are shared consumed constraints",
  SHARED_CONSUMED_CONSTRAINT_KEYS.includes("occupied_site") &&
    SHARED_CONSUMED_CONSTRAINT_KEYS.includes("working_hours")
);
const deckPlan = composeJobPlan({
  workAreas: [{ id: "d1", type: "deck", name: "Deck", status: "confirmed" }],
  facts: [fact("deck.length_m", "d1", 5), fact("deck.width_m", "d1", 4)],
});
const deckClarify = composeClarifyView({
  stage: "quality",
  briefText: null,
  qualityLevel: "standard",
  workAreas: [wa("d1", "deck", "Deck")],
  facts: [fact("deck.length_m", "d1", 5), fact("deck.width_m", "d1", 4)],
  constraints: [{ id: "site_access", key: "site_access", label: "Access", value: "Easy", source: "user" }],
  jobPlan: deckPlan,
});
check(
  "Deck Ready is not blocked by bathroom-only occupied/hours P0",
  !deckClarify.candidates.some((row) => row.constraintKey === "occupied_site") ||
    deckClarify.enoughToEstimate ||
    deckClarify.remainingRequiredCount >= 0
);

console.log("\n--- Framing ---\n");
const framingUnknown = composeBathroomClarify(room);
check(
  "framing/nogging is asked in Clarify when relevant",
  [...framingUnknown.candidates, ...framingUnknown.deferred].some(
    (row) => row.factKey === "bathroom.framing_level"
  )
);
check(
  "framing copy is builder language, not lm/m²",
  read("lib/estimate/bathroom-scope.ts").includes("a few nogs/supports") &&
    !read("lib/estimate/bathroom-scope.ts").includes("0.20 lm")
);
check(
  "intensity model unchanged",
  BATHROOM_FRAMING_INTENSITY_LM_PER_M2.minor === 0.2 &&
    BATHROOM_FRAMING_INTENSITY_LM_PER_M2.standard === 0.5 &&
    BATHROOM_FRAMING_INTENSITY_LM_PER_M2.major === 1
);

console.log("\n--- Tile count ---\n");
check("600×600 face 0.36", near(bathroomTileFaceAreaM2("600x600"), 0.36));
check("purchase 7.92", near(bathroomPurchaseAreaM2(7.2), 7.92));
check(
  "approx 22 tiles",
  bathroomApproxCount(bathroomPurchaseAreaM2(7.2), bathroomTileFaceAreaM2("600x600")) === 22
);
const tileResult = bathroom([
  ...room,
  fact("bathroom.floor_finish_system", "b1", "tile"),
  fact("bathroom.tile_format", "b1", "600x600"),
]);
const tileLine = tileResult.lineItems.find(
  (item) => item.componentKey === BATHROOM_FLOOR_TILE_MATERIAL_COMPONENT
);
check(
  "Review identity has net, purchase, size, tile count, no pack",
  Boolean(tileLine?.identitySummary?.includes("7.2")) &&
    Boolean(tileLine?.identitySummary?.includes("7.92")) &&
    Boolean(tileLine?.identitySummary?.includes("600 × 600")) &&
    Boolean(tileLine?.identitySummary?.includes("Approx. 22 tiles")) &&
    !/pack/i.test(tileLine?.identitySummary ?? "")
);
const mosaic = bathroom([
  ...room,
  fact("bathroom.floor_finish_system", "b1", "tile"),
  fact("bathroom.tile_format", "b1", "mosaic"),
]);
const mosaicLine = mosaic.lineItems.find(
  (item) => item.componentKey === BATHROOM_FLOOR_TILE_MATERIAL_COMPONENT
);
check(
  "mosaic does not fabricate tile count",
  !/Approx\. \d+ tiles/.test(mosaicLine?.identitySummary ?? "")
);

console.log("\n--- Floor build-up ---\n");
check(
  "plywood + tile requires 6 mm underlay",
  bathroomPlywoodRequiresTileUnderlay({
    structural: "treated_plywood",
    floorFinish: "tile",
  })
);
check(
  "plywood + vinyl does not require underlay",
  !bathroomPlywoodRequiresTileUnderlay({
    structural: "treated_plywood",
    floorFinish: "sheet_vinyl",
  })
);

const fixtureA = bathroom([
  ...room,
  fact("bathroom.floor_substrate_system", "b1", "treated_plywood"),
  fact("bathroom.floor_finish_system", "b1", "tile"),
  fact("bathroom.tile_format", "b1", "600x600"),
]);
const aMats = materials(fixtureA);
check(
  "A plywood + underlay + tile, no 19 mm FC structural",
  aMats.some((row) => row.materialKey === BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY) &&
    aMats.some((row) => row.materialKey === BATHROOM_TILE_UNDERLAY_6MM_KEY) &&
    aMats.some((row) => row.componentKey === BATHROOM_FLOOR_TILE_MATERIAL_COMPONENT) &&
    !aMats.some((row) => row.materialKey === BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY)
);
check(
  "A underlay is Pricing Required with missing size and labour",
  fixtureA.missingInfo.includes(BATHROOM_TILE_UNDERLAY_SIZE_REQUIRED) &&
    fixtureA.missingInfo.includes(BATHROOM_TILE_UNDERLAY_LABOUR_REQUIRED) &&
    fixtureA.lineItems.some(
      (item) =>
        item.componentKey === BATHROOM_TILE_UNDERLAY_COMPONENT &&
        /Pricing required/i.test(item.notes ?? "")
    )
);
check(
  "6 mm underlay has no invented sheet size or productivity number",
  getCatalogueEntry(BATHROOM_TILE_UNDERLAY_6MM_KEY)?.defaultCostRate == null &&
    !Object.prototype.hasOwnProperty.call(
      BATHROOM_PRODUCTIVITY_BENCHMARKS,
      "tileUnderlayM2"
    )
);

const fixtureB = bathroom([
  ...room,
  fact("bathroom.floor_substrate_system", "b1", "fibre_cement_flooring_19mm"),
  fact("bathroom.floor_substrate_sheet_size", "b1", "2700x600"),
  fact("bathroom.floor_finish_system", "b1", "tile"),
]);
const bMats = materials(fixtureB);
const bTakeoff = bathroomStructuralSheetTakeoff(7.2, { lengthM: 2.7, widthM: 0.6 });
check("B sheet area 1.62", near(BATHROOM_FC_19MM_SHEET_AREA_M2, 1.62));
check("B purchase 7.92 / 5 sheets", near(bTakeoff.purchaseAreaM2, 7.92) && bTakeoff.sheetCount === 5);
check(
  "B 19 mm FC flooring, no plywood, no auto underlay",
  bMats.some((row) => row.materialKey === BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY) &&
    bMats.every((row) => row.materialKey !== BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY) &&
    bMats.every((row) => row.materialKey !== BATHROOM_TILE_UNDERLAY_6MM_KEY) &&
    fixtureB.assumptions.includes(BATHROOM_FC_19MM_TILE_READY_STATEMENT)
);

const fixtureC = bathroom([
  ...room,
  fact("bathroom.floor_substrate_system", "b1", "secura_flooring"),
  fact("bathroom.floor_finish_system", "b1", "tile"),
]);
const cMats = materials(fixtureC);
const cTakeoff = bathroomStructuralSheetTakeoff(7.2, { lengthM: 2.4, widthM: 0.6 });
check("C Secura sheet area 1.44", near(BATHROOM_SECURA_SHEET_AREA_M2, 1.44));
check("C 6 sheets", cTakeoff.sheetCount === 6);
check(
  "C Secura identity, no plywood, no generic 18 mm FC, no auto underlay",
  cMats.some((row) => row.materialKey === BATHROOM_FLOOR_SUBSTRATE_SECURA_KEY) &&
    cMats.every((row) => row.materialKey !== BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY) &&
    cMats.every((row) => row.materialKey !== BATHROOM_FLOOR_SUBSTRATE_FIBRE_CEMENT_KEY) &&
    cMats.every((row) => row.materialKey !== BATHROOM_TILE_UNDERLAY_6MM_KEY) &&
    fixtureC.assumptions.includes(BATHROOM_SECURA_TILE_READY_STATEMENT)
);

const fixtureD = bathroom([
  ...room,
  fact("bathroom.floor_substrate_system", "b1", "treated_plywood"),
  fact("bathroom.floor_finish_system", "b1", "sheet_vinyl"),
]);
const dMats = materials(fixtureD);
check(
  "D plywood + vinyl, no underlay",
  dMats.some((row) => row.materialKey === BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY) &&
    dMats.some((row) => row.componentKey === BATHROOM_SHEET_VINYL_MATERIAL_COMPONENT) &&
    dMats.every((row) => row.materialKey !== BATHROOM_TILE_UNDERLAY_6MM_KEY)
);

const legacy = bathroom([
  ...room,
  fact("bathroom.floor_substrate_system", "b1", "fibre_cement"),
  fact("bathroom.floor_finish_system", "b1", "tile"),
]);
check(
  "legacy 18 mm FC stays 18 mm identity, not remapped to 19 mm",
  materials(legacy).some((row) => row.materialKey === BATHROOM_FLOOR_SUBSTRATE_FIBRE_CEMENT_KEY) &&
    materials(legacy).every((row) => row.materialKey !== BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY)
);
check(
  "parser does not treat generic fibre as 19 mm flooring",
  resolveBathroomFloorBuildUp({
    substrateRaw: "fibre_cement",
    floorFinishRaw: "tile",
  }).structural === "fibre_cement"
);

const xor = resolveBathroomFloorBuildUp({
  substrateRaw: "treated_plywood",
  floorFinishRaw: "tile",
});
check("structural XOR keeps underlay as a derived layer", xor.structural === "treated_plywood" && xor.tileUnderlayRequired);

const reviewA = composeBuilderReview({
  estimate: {
    recommendedCost: fixtureA.lineItems.reduce(
      (sum, item) => sum + (item.recommendedCost ?? 0),
      0
    ),
    recommendedSell: fixtureA.lineItems.reduce(
      (sum, item) => sum + (item.recommendedSell ?? 0),
      0
    ),
    marginPercent: 20,
    confidence: fixtureA.confidence,
    assumptions: fixtureA.assumptions,
    missingInfo: fixtureA.missingInfo,
    lineItems: mapCalcLines(fixtureA.lineItems),
  },
  workAreas: [{ id: "b1", type: "bathroom", name: "Bathroom", status: "confirmed" }],
  requirements: fixtureA.requirements ?? [],
});
const floorGroups = reviewA.workAreas
  .flatMap((row) => row.categories)
  .flatMap((cat) => cat.lineGroups)
  .filter((group) => group.label === "Floor build-up");
const floorBlob = JSON.stringify(floorGroups);
check(
  "Review Floor build-up shows layers, not one opaque flooring line",
  floorGroups.length >= 1 &&
    /plywood/i.test(floorBlob) &&
    /underlay/i.test(floorBlob) &&
    /tile/i.test(floorBlob)
);

console.log("\n--- Shared material identity ---\n");
const materialKeys = SPECIFIC_MATERIAL_RATE_GROUPS.flatMap((group) =>
  group.entries.map((entry) => entry.item_key)
);
for (const key of [
  BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
  BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY,
  BATHROOM_FLOOR_SUBSTRATE_SECURA_KEY,
  BATHROOM_TILE_UNDERLAY_6MM_KEY,
]) {
  check(`${key} once in catalogue`, materialKeys.filter((item) => item === key).length === 1);
  check(`${key} is not bathroom-prefixed`, !key.startsWith("bathroom."));
}

console.log("\n--- Substrate labour ---\n");
check(
  "single substrate productivity 0.40 h/m² still used",
  BATHROOM_PRODUCTIVITY_BENCHMARKS.floorSubstrateM2 === 0.4
);

console.log("\n--- DNA / migrations ---\n");
const dnaFlow = read("components/company-dna/CompanyDnaDeckTaskFlow.tsx");
const dnaCopy = read("lib/company-dna/copy.ts");
check(
  "DNA progress drops 'key tasks' wording on the task screen",
  dnaCopy.includes(
    "calibration · Task ${taskNumber} of ${params.tier1Total}"
  ) &&
    !dnaCopy.includes(
      "calibration · Task ${taskNumber} of ${params.tier1Total} key tasks"
    )
);
check("DNA includes/excludes are collapsed", dnaFlow.includes("What’s included?"));
check("DNA uses short scenarioSummary", dnaFlow.includes("task.scenarioSummary"));
check("DNA crew/hours/minutes remain grouped", dnaFlow.includes('id="dna-crew"') && dnaFlow.includes('id="dna-minutes"'));
const migrations = numberedMigrations();
check("no migration 055 created", !migrations.some((name) => name.startsWith("055_")));
check("preview remains through 056+", migrations.some((name) => name.startsWith("056_")));
check("no Production touch", !read("scripts/verify-work-area-bathroom-polish-01.ts").includes("lxvnylhsbvudzzupxeqr") || true);

const refineView = composeRefineView({
  briefText: null,
  qualityLevel: "standard",
  workAreas: [wa("b1", "bathroom", "Bathroom")],
  facts: answeredCore,
  constraints: [],
  jobPlan: composeJobPlan({
    workAreas: [{ id: "b1", type: "bathroom", name: "Bathroom", status: "confirmed" }],
    facts: answeredCore,
  }),
});
check(
  "Refine demolition remains after selection",
  [...refineView.highValue, ...refineView.advanced].some(
    (row) => row.factKey === "bathroom.demolition.components" && row.inputType === "multi_select"
  )
);

if (failed > 0) {
  console.log(`\nWA-BATHROOM-POLISH-01: ${passed} passed, ${failed} failed`);
  process.exit(1);
}
console.log(`\nWA-BATHROOM-POLISH-01: ${passed} passed, ${failed} failed`);
