/**
 * CLADDING-07 — ordinary nested Cladding V1 closure and golden freeze.
 *
 * Run: npx --yes tsx scripts/verify-cladding-07-v1-closure.ts
 */
import { readFileSync } from "node:fs";
import type { OrganisationRate } from "../components/setup/types";
import type { EstimateLineItem } from "../components/assistant/types";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { pricingNoticeForWorkAreaTypes } from "../lib/assistant/builder-review/pricing-notice";
import { deriveSellFromCost } from "../lib/commercial-engine/core/sell-from-margin";
import { workAreaMayCloseAtL5 } from "../lib/estimate/benchmark-coverage";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import {
  CLADDING_MATERIAL_BENCHMARKS,
  CLADDING_PRODUCTIVITY_BENCHMARKS,
} from "../lib/estimate/cladding-authority";
import {
  extractCladdingPortionsFromBrief,
  mergeCladdingPortionsPreferringDeterministic,
} from "../lib/estimate/cladding-brief";
import { CLADDING_APPROVED_PROFILES } from "../lib/estimate/cladding-profiles";
import { calculateCladdingPhysical } from "../lib/estimate/cladding-physical";
import {
  CLADDING_CARPENTER_LABOUR_RATE_KEY,
  CLADDING_CAVITY_INSTALL_HOURS_PER_M2,
  CLADDING_CAVITY_TIMBER_BATTEN_M2,
  CLADDING_FIBRE_CEMENT_WEATHERBOARD_180_LM,
  CLADDING_RIGID_AIR_BARRIER_INSTALL_HOURS_PER_M2,
  CLADDING_RIGID_AIR_BARRIER_M2,
  CLADDING_SPECIALIST_BRICK_VENEER,
  CLADDING_TIMBER_BEVELBACK_187X18_LM,
  CLADDING_WALL_UNDERLAY_FLEXIBLE_M2,
  CLADDING_WALL_UNDERLAY_INSTALL_HOURS_PER_M2,
} from "../lib/estimate/cladding-identities";
import {
  CLADDING_ADD_PORTION_KEY,
  CLADDING_DELETE_PORTION_KEY,
  CLADDING_DUPLICATE_PORTION_KEY,
  CLADDING_PORTIONS_FACT_KEY,
  CLADDING_SUPPORT_NOTES,
  CLADDING_V1_HUMAN_QA_FROZEN,
  applyCladdingFactWrite,
  createEmptyCladdingPortion,
  mergePersistedCladdingPortionsOnReanalyse,
  parseCladdingPortions,
  type CladdingPortion,
} from "../lib/estimate/cladding-portions";
import { buildNestedCladdingQuoteDraft } from "../lib/estimate/cladding-quote";
import { DOORS_V1_HUMAN_QA_FROZEN } from "../lib/estimate/doors-identities";
import { DOORS_QUOTE_SPECIALIST_PENDING } from "../lib/estimate/doors-quote";
import { FLOORING_V1_HUMAN_QA_FROZEN } from "../lib/estimate/flooring-identities";
import { FLOORING_QUOTE_SPECIALIST_PENDING } from "../lib/estimate/flooring-quote";
import { round2 } from "../lib/estimate/facts";
import type { EstimateFact, EstimateLineItemInput, EstimateWorkArea } from "../lib/estimate/types";
import { verifyRegisteredWorkAreaBenchmarkCoverage } from "../lib/estimate/work-area-benchmark-coverage";
import { calculateDocumentTotals } from "../lib/pricing/calculations";
import {
  computeManualPromotionMoney,
  evaluateManualPricingEligibility,
  notesWithManualPricingProvenance,
  projectEligibleUnresolvedPricingItems,
} from "../lib/pricing/manual-requirement-promotion";
import { DEFAULT_GST_RATE } from "../lib/pricing/status";
import { classifyCladdingOwnership } from "../lib/work-areas/cladding-ownership";
import {
  getWorkAreaCapabilityLabel,
  getWorkAreaSupportEntry,
  isMatureSupportedWorkAreaType,
} from "../lib/work-areas/support-contract";

const QA1 =
  "Supply and install 30 m² of 187 × 18 mm horizontal timber bevelback cladding to the North elevation. Also supply and install 20 m² of 180 mm horizontal fibre-cement weatherboard cladding to the South elevation. The areas already exclude openings. Existing wall underlay, cavity and trims are to remain. No cladding removal is required. Painting and scaffolding are excluded.";
const QA2 =
  "Supply and install timber board-and-batten cladding to the Garage elevation, 6.0 m long × 2.4 m high, using 65 × 19 mm battens. The area already excludes openings. No removal is required. Existing wall underlay and cavity are to remain. Trims, painting and scaffolding are excluded.";
const QA3 =
  "Supply and install 25 m² of brick veneer cladding to the Lower elevation. The area already excludes openings. No existing cladding removal is required. The final brick selection is still to be confirmed.";

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${passed + failed}. ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${passed + failed}. ${name}${detail ? ` — ${detail}` : ""}`);
  }
}
function close(actual: number | null | undefined, expected: number): boolean {
  return actual != null && Math.abs(actual - expected) < 0.001;
}
function portion(overrides: Partial<CladdingPortion> & { id: string }): CladdingPortion {
  return {
    ...createEmptyCladdingPortion({ id: overrides.id }),
    scope_intent: "install",
    cladding_family: "timber",
    orientation: "horizontal",
    cladding_system: "timber_bevelback",
    approved_profile_id: "timber_bevelback_187x18",
    nominal_width_mm: 187,
    nominal_thickness_mm: 18,
    effective_cover_mm: 155,
    area_method: "direct_m2",
    direct_area_m2: 30,
    openings_already_deducted: true,
    cavity_included: false,
    cavity_state: "excluded",
    wall_underlay_or_rab_included: false,
    underlay_state: "excluded",
    trims_flashings_corners_included: false,
    trims_state: "excluded",
    existing_cladding_removal_required: false,
    painting_or_coating_included: false,
    painting_state: "excluded",
    scaffold_included: false,
    scaffold_state: "excluded",
    ...overrides,
  };
}
function factsFor(rows: CladdingPortion[]): EstimateFact[] {
  return [{ key: CLADDING_PORTIONS_FACT_KEY, work_area_id: "c1", value: rows, source: "user" }];
}
function carpenter(cost: number): OrganisationRate {
  return {
    id: "carpenter",
    trade: null,
    work_area_type: null,
    label: CLADDING_CARPENTER_LABOUR_RATE_KEY,
    item_key: CLADDING_CARPENTER_LABOUR_RATE_KEY,
    rate_type: "labour",
    unit: "hour",
    cost_rate: cost,
    sell_rate: null,
    markup_percent: null,
    active: true,
  };
}
function estimateOf(rows: CladdingPortion[], rates: OrganisationRate[] = []) {
  return calculateEstimate({
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [{ id: "c1", type: "cladding", name: "Cladding", sort_order: 1 } as EstimateWorkArea],
    facts: factsFor(rows),
    constraints: [],
    organisationSettings: { allow_benchmark_rates: true, default_margin_percent: 20 },
    materialWastageSettings: { sheet_material: 10, flooring: 10, paint: 10, default: 5 },
    rates,
  });
}
function included(items: readonly EstimateLineItemInput[]) {
  return items.filter((row) => row.includedInTotal !== false && (row.recommendedCost ?? 0) > 0);
}
function sum(items: readonly EstimateLineItemInput[], match: (row: EstimateLineItemInput) => boolean): number {
  return round2(included(items).filter(match).reduce((total, row) => total + (row.recommendedCost ?? 0), 0));
}
function costOf(items: readonly EstimateLineItemInput[]): number {
  return round2(included(items).reduce((total, row) => total + (row.recommendedCost ?? 0), 0));
}
function reviewOf(rows: CladdingPortion[], estimate = estimateOf(rows)) {
  return composeBuilderReview({
    estimate: {
      recommendedCost: estimate.recommendedCost,
      recommendedSell: estimate.recommendedSell,
      marginPercent: estimate.marginPercent,
      confidence: estimate.confidence,
      assumptions: estimate.assumptions,
      missingInfo: estimate.missingInfo,
      lineItems: estimate.lineItems.map((item, index) => ({ ...item, id: `line-${index}` })) as EstimateLineItem[],
    },
    workAreas: [{ id: "c1", name: "Cladding", type: "cladding", status: "confirmed" }],
    requirements: estimate.requirements,
    facts: factsFor(rows),
  });
}
function visible(review: ReturnType<typeof reviewOf>): string {
  const bits: string[] = [review.overview.partialEstimateLabel ?? ""];
  for (const area of review.workAreas) {
    bits.push(area.partialEstimateLabel ?? "");
    for (const group of area.portionGroups ?? []) {
      bits.push(group.label, group.summary ?? "", group.areaLabel ?? "");
      for (const line of group.lineGroups) {
        bits.push(line.label, line.supporting ?? "");
        for (const child of line.children ?? []) bits.push(child.label, child.supporting ?? "", child.detail ?? "");
      }
    }
  }
  return bits.join("\n");
}
function quoteOf(rows: CladdingPortion[], items: { component_key?: string; nested_item_id?: string; total_cost: number; total_sell: number; cost_known: boolean; label?: string }[] = []) {
  return buildNestedCladdingQuoteDraft(
    [{ key: CLADDING_PORTIONS_FACT_KEY, work_area_id: "quote", value: JSON.stringify(rows), source: "user" }],
    items.map((row) => ({
      label: row.label ?? "Cladding",
      component_key: row.component_key,
      nested_item_id: row.nested_item_id,
      cost_known: row.cost_known,
      total_cost: row.total_cost,
      total_sell: row.total_sell,
      notes_internal: null,
    }))
  );
}

const support = getWorkAreaSupportEntry("cladding");
const coverage = verifyRegisteredWorkAreaBenchmarkCoverage("cladding");
check("A freeze flag is true", CLADDING_V1_HUMAN_QA_FROZEN === true);
check("A Doors and Flooring stay frozen", DOORS_V1_HUMAN_QA_FROZEN === true && FLOORING_V1_HUMAN_QA_FROZEN === true);
check("A support band is component, not Tier-1", support?.role === "component_utility" && support.band === "component" && getWorkAreaCapabilityLabel("cladding") === "Component" && isMatureSupportedWorkAreaType("cladding") === false);
check("A support notes record the hosted freeze", support?.notes === CLADDING_SUPPORT_NOTES && CLADDING_SUPPORT_NOTES.includes("human-QA frozen") && CLADDING_SUPPORT_NOTES.includes("Pricing Required"));
check("A L5 close stays allowed", workAreaMayCloseAtL5(coverage) === true && coverage.ok);
check("A ordinary coverage rows stay resolvable", coverage.resolves.some((row) => row.component === "Client Quote") && coverage.resolves.some((row) => row.component === "Pricing integration"));
check("A specialist coverage stays Pricing Required", coverage.intentionalPr.some((row) => row.component === "Brick veneer") && coverage.intentionalPr.some((row) => row.component === "Trims, corners and flashings"));

const covers = new Map(CLADDING_APPROVED_PROFILES.map((row) => [row.id, row.effective_cover_mm]));
check("B bevelback covers stay 110, 155, 183 and 198", covers.get("timber_bevelback_142x18") === 110 && covers.get("timber_bevelback_187x18") === 155 && covers.get("timber_bevelback_215x18") === 183 && covers.get("timber_bevelback_230x18") === 198);
check("B rusticated covers stay 110, 155, 190 and 205", covers.get("timber_rusticated_135x18") === 110 && covers.get("timber_rusticated_180x18") === 155 && covers.get("timber_rusticated_215x18") === 190 && covers.get("timber_rusticated_230x18") === 205);
check("B shiplap covers stay 65 and 110", covers.get("timber_vertical_shiplap_90x21") === 65 && covers.get("timber_vertical_shiplap_135x21") === 110);
check("B fibre-cement covers stay 120 and 150", covers.get("fibre_cement_horizontal_weatherboard_150") === 120 && covers.get("fibre_cement_horizontal_weatherboard_180") === 150);
const sheet = CLADDING_APPROVED_PROFILES.find((row) => row.id === "timber_sheet_board_and_batten");
check("B board-and-batten sheet is 2400 by 1200 with an 8 mm gap", sheet?.board_sheet_length_mm === 2400 && sheet?.board_sheet_width_mm === 1200 && sheet?.board_gap_mm === 8);
check("B canonical collection is cladding.portions", CLADDING_PORTIONS_FACT_KEY === "cladding.portions");

const accessoryKeys = new Set([CLADDING_CAVITY_TIMBER_BATTEN_M2, CLADDING_WALL_UNDERLAY_FLEXIBLE_M2, CLADDING_RIGID_AIR_BARRIER_M2]);
const baseMaterials = CLADDING_MATERIAL_BENCHMARKS.filter((row) => !accessoryKeys.has(row.key));
check("C ordinary base materials stay 19", baseMaterials.length === 19);
check("C accessory materials stay the three priced identities", CLADDING_MATERIAL_BENCHMARKS.filter((row) => accessoryKeys.has(row.key)).length === 3);
check("C cavity, underlay and rigid air barrier COST stay 9, 5 and 28", CLADDING_MATERIAL_BENCHMARKS.find((row) => row.key === CLADDING_CAVITY_TIMBER_BATTEN_M2)?.costExGst === 9 && CLADDING_MATERIAL_BENCHMARKS.find((row) => row.key === CLADDING_WALL_UNDERLAY_FLEXIBLE_M2)?.costExGst === 5 && CLADDING_MATERIAL_BENCHMARKS.find((row) => row.key === CLADDING_RIGID_AIR_BARRIER_M2)?.costExGst === 28);
check("C bevelback 187 stays 15 per lm", CLADDING_MATERIAL_BENCHMARKS.find((row) => row.key === CLADDING_TIMBER_BEVELBACK_187X18_LM)?.costExGst === 15);
check("C fibre-cement 180 stays 18.50 per lm", CLADDING_MATERIAL_BENCHMARKS.find((row) => row.key === CLADDING_FIBRE_CEMENT_WEATHERBOARD_180_LM)?.costExGst === 18.5);
check("C material benchmarks have no default sell", CLADDING_MATERIAL_BENCHMARKS.every((row) => !("sellExGst" in row)));

const accessoryHours = new Set([CLADDING_CAVITY_INSTALL_HOURS_PER_M2, CLADDING_WALL_UNDERLAY_INSTALL_HOURS_PER_M2, CLADDING_RIGID_AIR_BARRIER_INSTALL_HOURS_PER_M2]);
check("D ordinary operations stay 11", CLADDING_PRODUCTIVITY_BENCHMARKS.filter((row) => !accessoryHours.has(row.key)).length === 11);
check("D accessory productivity stays 0.15, 0.08 and 0.18", CLADDING_PRODUCTIVITY_BENCHMARKS.find((row) => row.key === CLADDING_CAVITY_INSTALL_HOURS_PER_M2)?.hoursPerUnit === 0.15 && CLADDING_PRODUCTIVITY_BENCHMARKS.find((row) => row.key === CLADDING_WALL_UNDERLAY_INSTALL_HOURS_PER_M2)?.hoursPerUnit === 0.08 && CLADDING_PRODUCTIVITY_BENCHMARKS.find((row) => row.key === CLADDING_RIGID_AIR_BARRIER_INSTALL_HOURS_PER_M2)?.hoursPerUnit === 0.18);
check("D carpenter identity is labour.carpenter.hour", CLADDING_CARPENTER_LABOUR_RATE_KEY === "labour.carpenter.hour");
const claddingSource = [
  "lib/estimate/cladding-commercial.ts",
  "lib/estimate/cladding-physical.ts",
  "lib/estimate/cladding-authority.ts",
  "lib/estimate/calculators/cladding.ts",
].map((path) => readFileSync(path, "utf8")).join("\n");
check("D no Cladding module hardcodes the carpenter dollar", !claddingSource.includes("$60") && !/carpenter[^;\n]{0,40}\b60\b/.test(claddingSource));

const workArea = { id: "c1", type: "cladding", name: "Cladding" } as EstimateWorkArea;
const bevelPhysical = calculateCladdingPhysical({ facts: factsFor([portion({ id: "bevel" })]), workArea });
const bevelLm = bevelPhysical.requirements.find((row) => row.kind === "material" && row.componentKey === CLADDING_TIMBER_BEVELBACK_187X18_LM);
check("E bevelback lineal metres stay 30 / 0.155", bevelLm?.kind === "material" && bevelLm.purchaseQuantity === 30 / 0.155);
const fibrePhysical = calculateCladdingPhysical({
  facts: factsFor([portion({ id: "fibre", cladding_family: "fibre_cement", orientation: null, cladding_system: "fibre_cement_horizontal_weatherboard", approved_profile_id: "fibre_cement_horizontal_weatherboard_180", nominal_width_mm: 180, nominal_thickness_mm: null, effective_cover_mm: 150, direct_area_m2: 20 })]),
  workArea,
});
const fibreLm = fibrePhysical.requirements.find((row) => row.kind === "material" && row.componentKey === CLADDING_FIBRE_CEMENT_WEATHERBOARD_180_LM);
check("E fibre-cement lineal metres stay 20 / 0.150", fibreLm?.kind === "material" && fibreLm.purchaseQuantity === 20 / 0.15);
const shipPhysical = calculateCladdingPhysical({
  facts: factsFor([portion({ id: "ship", orientation: "vertical", cladding_system: "timber_vertical_shiplap", approved_profile_id: "timber_vertical_shiplap_135x21", nominal_width_mm: 135, nominal_thickness_mm: 21, effective_cover_mm: 110, direct_area_m2: 12 })]),
  workArea,
});
const shipLm = shipPhysical.requirements.find((row) => row.kind === "material" && row.componentKey.includes("shiplap"));
check("E shiplap lineal metres stay 12 / 0.110", shipLm?.kind === "material" && shipLm.purchaseQuantity === 12 / 0.11);
const battenPhysical = calculateCladdingPhysical({
  facts: factsFor([portion({ id: "batten", orientation: "vertical", cladding_system: "timber_sheet_board_and_batten", approved_profile_id: "timber_sheet_board_and_batten", area_method: "length_height", direct_area_m2: null, length_m: 6, height_m: 2.4, batten_width_mm: 65, batten_thickness_mm: 19 })]),
  workArea,
});
check("E board-and-batten stays 14.4 m2, 5 sheets and 9.6 lm", battenPhysical.portions[0]?.netAreaM2 === 6 * 2.4 && battenPhysical.requirements.some((row) => row.kind === "material" && row.purchaseQuantity === 5 && row.purchaseUnit === "sheet") && battenPhysical.requirements.some((row) => row.kind === "material" && row.purchaseUnit === "lm" && row.purchaseQuantity === 9.6));
const deducted = calculateCladdingPhysical({
  facts: factsFor([portion({ id: "open", openings_already_deducted: true, opening_area_m2: 4 })]),
  workArea,
});
check("E openings already deducted do not apply a second deduction", deducted.portions[0]?.grossAreaM2 === 30 && deducted.portions[0]?.netAreaM2 === 30);
const retained = calculateCladdingPhysical({ facts: factsFor(extractCladdingPortionsFromBrief(QA1)), workArea });
check("E retained accessories emit no requirement", !retained.requirements.some((row) => /cavity|underlay|rab|trim/i.test(row.componentKey)));
check("E physical goldens emit no waste requirement", !bevelPhysical.requirements.some((row) => /waste/i.test(row.componentKey)));

const fixtureA = estimateOf([portion({ id: "a", label: "North elevation" })]);
check("F fixture A material is 2903.23", close(sum(fixtureA.lineItems, (row) => row.category === "materials"), 2903.23));
check("F fixture A labour is 1393.55", close(sum(fixtureA.lineItems, (row) => row.category === "labour"), 1393.55));
check("F fixture A direct COST is 4296.78", close(costOf(fixtureA.lineItems), 4296.78) && close(fixtureA.recommendedCost, 4296.78));
const fixtureB = estimateOf([portion({ id: "b", cladding_family: "fibre_cement", orientation: null, cladding_system: "fibre_cement_horizontal_weatherboard", approved_profile_id: "fibre_cement_horizontal_weatherboard_180", nominal_width_mm: 180, effective_cover_mm: 150, direct_area_m2: 20 })]);
check("F fixture B material is 2466.67", close(sum(fixtureB.lineItems, (row) => row.category === "materials"), 2466.67));
check("F fixture B labour is 1040.00", close(sum(fixtureB.lineItems, (row) => row.category === "labour"), 1040));
check("F fixture B direct COST is 3506.67", close(costOf(fixtureB.lineItems), 3506.67));
const fixtureC = estimateOf([portion({ id: "c", orientation: "vertical", cladding_system: "timber_vertical_shiplap", approved_profile_id: "timber_vertical_shiplap_135x21", nominal_width_mm: 135, nominal_thickness_mm: 21, effective_cover_mm: 110, direct_area_m2: 12 })]);
check("F fixture C material is 1527.27", close(sum(fixtureC.lineItems, (row) => row.category === "materials"), 1527.27));
check("F fixture C labour is 720.00", close(sum(fixtureC.lineItems, (row) => row.category === "labour"), 720));
check("F fixture C direct COST is 2247.27", close(costOf(fixtureC.lineItems), 2247.27));
const fixtureD = estimateOf([portion({ id: "d", orientation: "vertical", cladding_system: "timber_sheet_board_and_batten", approved_profile_id: "timber_sheet_board_and_batten", area_method: "length_height", direct_area_m2: null, length_m: 6, height_m: 2.4, batten_width_mm: 65, batten_thickness_mm: 19 })]);
check("F fixture D board material is 936.00", close(sum(fixtureD.lineItems, (row) => (row.componentKey ?? "").includes(".sheet_board.") && row.category === "materials"), 936));
check("F fixture D batten material is 45.60", close(sum(fixtureD.lineItems, (row) => (row.componentKey ?? "").includes(".batten.") && row.category === "materials"), 45.6));
check("F fixture D sheet labour is 561.60 and batten labour is 46.08", close(sum(fixtureD.lineItems, (row) => (row.componentKey ?? "").includes(".sheet_board.") && row.category === "labour"), 561.6) && close(sum(fixtureD.lineItems, (row) => (row.componentKey ?? "").includes(".batten.") && row.category === "labour"), 46.08));
check("F fixture D direct COST is 1589.28", close(costOf(fixtureD.lineItems), 1589.28));
check("F fixture D sheet equivalent adds no COST", !included(fixtureD.lineItems).some((row) => row.unit === "sheet"));
const fixtureE = estimateOf([portion({ id: "e", scope_intent: "replace", approved_profile_id: "timber_bevelback_142x18", nominal_width_mm: 142, effective_cover_mm: 110, direct_area_m2: 12, existing_cladding_removal_required: true })]);
check("F fixture E material is 1309.09", close(sum(fixtureE.lineItems, (row) => row.category === "materials"), 1309.09));
check("F fixture E installation labour is 785.45", close(sum(fixtureE.lineItems, (row) => row.category === "labour" && !(row.componentKey ?? "").includes("remove")), 785.45));
check("F fixture E removal labour is 216.00", close(sum(fixtureE.lineItems, (row) => (row.componentKey ?? "").includes("remove")), 216));
check("F fixture E direct COST is 2310.54", close(costOf(fixtureE.lineItems), 2310.54));
const fixtureF = estimateOf([portion({
  id: "f",
  cladding_family: "fibre_cement",
  orientation: null,
  cladding_system: "fibre_cement_horizontal_weatherboard",
  approved_profile_id: "fibre_cement_horizontal_weatherboard_180",
  nominal_width_mm: 180,
  effective_cover_mm: 150,
  direct_area_m2: 20,
  cavity_included: true,
  cavity_state: "new",
  wall_underlay_or_rab_included: true,
  underlay_state: "new",
  wall_preparation: "flexible_underlay",
})]);
check("F fixture F fibre-cement material and labour stay 2466.67 and 1040", close(sum(fixtureF.lineItems, (row) => row.componentKey === CLADDING_FIBRE_CEMENT_WEATHERBOARD_180_LM), 2466.67) && close(sum(fixtureF.lineItems, (row) => (row.componentKey ?? "").includes("fibre_cement") && row.category === "labour"), 1040));
check("F fixture F cavity is 180 material and 180 labour", close(sum(fixtureF.lineItems, (row) => row.componentKey === CLADDING_CAVITY_TIMBER_BATTEN_M2), 180) && close(sum(fixtureF.lineItems, (row) => row.componentKey === CLADDING_CAVITY_INSTALL_HOURS_PER_M2), 180));
check("F fixture F underlay is 100 material and 96 labour", close(sum(fixtureF.lineItems, (row) => row.componentKey === CLADDING_WALL_UNDERLAY_FLEXIBLE_M2), 100) && close(sum(fixtureF.lineItems, (row) => row.componentKey === CLADDING_WALL_UNDERLAY_INSTALL_HOURS_PER_M2), 96));
check("F fixture F direct COST is 4062.67", close(costOf(fixtureF.lineItems), 4062.67));

const qa1Rows = extractCladdingPortionsFromBrief(QA1);
const qa1 = estimateOf(qa1Rows, [carpenter(65)]);
check("G QA 1 materials are 5369.90", close(sum(qa1.lineItems, (row) => row.category === "materials"), 5369.9));
check("G QA 1 labour is 2636.35", close(sum(qa1.lineItems, (row) => row.category === "labour"), 2636.35));
check("G QA 1 direct COST is 8006.25", close(costOf(qa1.lineItems), 8006.25) && Math.round(costOf(qa1.lineItems)) === 8006);
const qa2Rows = extractCladdingPortionsFromBrief(QA2);
const qa2 = estimateOf(qa2Rows, [carpenter(65)]);
check("G QA 2 materials are 981.60", close(sum(qa2.lineItems, (row) => row.category === "materials"), 981.6));
check("G QA 2 labour is 658.32", close(sum(qa2.lineItems, (row) => row.category === "labour"), 658.32));
check("G QA 2 direct COST is 1639.92", close(costOf(qa2.lineItems), 1639.92) && Math.round(costOf(qa2.lineItems)) === 1640);
const qa4Portion = portion({
  id: "qa4",
  label: "South elevation",
  cladding_family: "fibre_cement",
  orientation: null,
  cladding_system: "fibre_cement_horizontal_weatherboard",
  approved_profile_id: "fibre_cement_horizontal_weatherboard_180",
  nominal_width_mm: 180,
  effective_cover_mm: 150,
  direct_area_m2: 20,
  cavity_included: true,
  cavity_state: "new",
  wall_underlay_or_rab_included: true,
  underlay_state: "new",
  wall_preparation: "flexible_underlay",
});
const qa4 = estimateOf([qa4Portion], [carpenter(65)]);
check("G QA 4 materials are 2746.67", close(sum(qa4.lineItems, (row) => row.category === "materials"), 2746.67));
check("G QA 4 labour is 1425.67", close(sum(qa4.lineItems, (row) => row.category === "labour"), 1425.67));
check("G QA 4 direct COST is 4172.34", close(costOf(qa4.lineItems), 4172.34) && Math.round(costOf(qa4.lineItems)) === 4172);
check("H retained QA 1 emits no accessory COST", !included(qa1.lineItems).some((row) => accessoryKeys.has(row.componentKey ?? "") || accessoryHours.has(row.componentKey ?? "")));
check("H new cavity and underlay are included on fixture F", included(fixtureF.lineItems).some((row) => row.componentKey === CLADDING_CAVITY_TIMBER_BATTEN_M2) && included(fixtureF.lineItems).some((row) => row.componentKey === CLADDING_WALL_UNDERLAY_FLEXIBLE_M2));

const brickRows = extractCladdingPortionsFromBrief(QA3);
const brickSnapshot = JSON.stringify(brickRows);
const brickEstimate = estimateOf(brickRows);
const brickLine = brickEstimate.lineItems.find((row) => row.componentKey === CLADDING_SPECIALIST_BRICK_VENEER);
const brickReview = reviewOf(brickRows, brickEstimate);
check("I brick stays 25 m2 with null direct COST", brickLine?.quantity === 25 && brickLine.unit === "m2" && brickEstimate.recommendedCost === 0 && brickLine.includedInTotal === false);
check("I brick emits no ordinary material or carpenter labour", !brickEstimate.lineItems.some((row) => row.category === "labour" || (row.componentKey ?? "").includes("bevelback") || (row.componentKey ?? "").includes("fibre_cement")));
check("I brick review is requirements-only", (brickReview.workAreas[0]?.portionGroups?.[0]?.label ?? "").includes("25 m² brick veneer") && (brickReview.workAreas[0]?.portionGroups?.[0]?.lineGroups ?? []).some((row) => row.label === "Pricing Required"));
check("I brick warning names Cladding", brickReview.overview.partialEstimateLabel === "Some Cladding items still require pricing.");
const projected = projectEligibleUnresolvedPricingItems({ items: [], estimateLines: brickEstimate.lineItems, orgId: "org", projectId: "p1", pricingDocumentId: "pd" });
check("I Pricing shows one Add price item", projected.length === 1 && projected[0]?.quantity === 25 && evaluateManualPricingEligibility(brickLine!).ok === true);
check("I refresh does not duplicate the pending item", projectEligibleUnresolvedPricingItems({ items: projected, estimateLines: brickEstimate.lineItems, orgId: "org", projectId: "p1", pricingDocumentId: "pd" }).length === 0);
const manual = computeManualPromotionMoney({ totalCost: 5000, quantity: 25, unit: "m2", itemType: "material", marginPercent: 20 });
check("I manual price uses shared margin and not a company rate", manual.ok === true && manual.fields.totalSell === deriveSellFromCost(5000, 20) && notesWithManualPricingProvenance(null, true)?.includes("user_override") === true);
const pendingQuote = quoteOf(brickRows);
const pricedQuote = quoteOf(brickRows, [{ component_key: CLADDING_SPECIALIST_BRICK_VENEER, nested_item_id: brickRows[0]?.id, total_cost: 5000, total_sell: manual.ok ? manual.fields.totalSell : 0, cost_known: true, label: "Brick veneer cladding supply and installation" }]);
const clearedQuote = quoteOf(brickRows, [{ component_key: CLADDING_SPECIALIST_BRICK_VENEER, nested_item_id: brickRows[0]?.id, total_cost: 0, total_sell: 0, cost_known: false }]);
check("I quote pends before a price and includes 25 m2 after", pendingQuote.includes("excluded pending final specification and pricing") && pricedQuote.includes("25 m²"));
check("I clearing restores the pending sentence", clearedQuote.includes("excluded pending final specification and pricing") && !clearedQuote.includes("Supply and install 25"));
check("I promotion does not mutate portions", JSON.stringify(brickRows) === brickSnapshot);

const extracted = extractCladdingPortionsFromBrief(QA1);
check("J one Work Area holds two sections", extracted.length === 2 && new Set(extracted.map((row) => row.id)).size === 2);
const added = applyCladdingFactWrite({ facts: factsFor(extracted), workAreaId: "c1", key: CLADDING_ADD_PORTION_KEY, value: true });
const addedRows = parseCladdingPortions(added.find((row) => row.key === CLADDING_PORTIONS_FACT_KEY)?.value);
check("J Add creates an empty section", addedRows.length === 3 && addedRows[2]?.cladding_family == null);
const duplicated = applyCladdingFactWrite({ facts: factsFor(extracted), workAreaId: "c1", key: CLADDING_DUPLICATE_PORTION_KEY, value: extracted[0]?.id, nestedItemId: extracted[0]?.id });
const copies = parseCladdingPortions(duplicated.find((row) => row.key === CLADDING_PORTIONS_FACT_KEY)?.value);
check("J Duplicate creates a new id", copies.length === 3 && new Set(copies.map((row) => row.id)).size === 3);
const deleted = applyCladdingFactWrite({ facts: factsFor(extracted), workAreaId: "c1", key: CLADDING_DELETE_PORTION_KEY, value: extracted[0]?.id, nestedItemId: extracted[0]?.id });
const remaining = parseCladdingPortions(deleted.find((row) => row.key === CLADDING_PORTIONS_FACT_KEY)?.value);
check("J Delete removes only the selected section", remaining.length === 1 && remaining[0]?.id === extracted[1]?.id);
const userOwned = { ...extracted[0]!, direct_area_m2: 44, direct_area_authority: "user" as const };
const userMerged = mergePersistedCladdingPortionsOnReanalyse({ extracted, persisted: [userOwned, extracted[1]!] });
check("J user area survives and machine fields may update", userMerged[0]?.direct_area_m2 === 44 && userMerged[1]?.direct_area_m2 === 20);
const aiYes = createEmptyCladdingPortion({ id: extracted[0]?.id });
aiYes.cavity_included = true;
aiYes.cavity_state = "new";
const deterministicNo = mergeCladdingPortionsPreferringDeterministic([aiYes], extracted);
check("J deterministic retained beats AI Yes", deterministicNo[0]?.cavity_included === false);
const battenExtract = extractCladdingPortionsFromBrief(QA2)[0];
check("J board-and-batten outranks generic timber", battenExtract?.cladding_system === "timber_sheet_board_and_batten" && battenExtract.approved_profile_id !== "timber_bevelback_187x18");
const identical = mergePersistedCladdingPortionsOnReanalyse({
  extracted: [createEmptyCladdingPortion({ id: "x" }), createEmptyCladdingPortion({ id: "y" })].map((row, index) => ({ ...row, label: "Same", cladding_system: "timber_bevelback" as const, clause_ordinal: index })),
  persisted: [createEmptyCladdingPortion({ id: "a" }), createEmptyCladdingPortion({ id: "b" })].map((row, index) => ({ ...row, label: "Same", cladding_system: "timber_bevelback" as const, clause_ordinal: index })),
});
check("J identical sections do not deduplicate", identical.length === 2 && identical[0]?.id === "a" && identical[1]?.id === "b");
const deletedMerge = mergePersistedCladdingPortionsOnReanalyse({
  extracted: [createEmptyCladdingPortion({ id: "e1" }), createEmptyCladdingPortion({ id: "e2" })].map((row, index) => ({ ...row, label: index === 0 ? "North" : "South", clause_ordinal: index })),
  persisted: [{ ...createEmptyCladdingPortion({ id: "e1" }), label: "North", clause_ordinal: 0 }],
});
check("J intentional deletion is not recreated", deletedMerge.length === 1 && deletedMerge[0]?.label === "North");
const repaired = mergePersistedCladdingPortionsOnReanalyse({
  extracted: [
    { ...createEmptyCladdingPortion({ id: "n1" }), label: "North", cladding_system: "timber_bevelback" as const },
    { ...createEmptyCladdingPortion({ id: "n2" }), label: "South", cladding_system: "timber_rusticated" as const },
  ],
  persisted: [{ ...createEmptyCladdingPortion({ id: "hybrid" }), label: "South", cladding_system: "timber_bevelback" as const }],
});
check("J machine-owned stale hybrid may repair", repaired.length === 2 && repaired[0]?.id === "hybrid" && repaired[0]?.label === "North");
const userHybrid = mergePersistedCladdingPortionsOnReanalyse({
  extracted: repaired.map((row) => ({ ...row })),
  persisted: [{ ...createEmptyCladdingPortion({ id: "hybrid" }), label: "South", label_authority: "user", cladding_system: "timber_bevelback", system_authority: "user" }],
});
check("J user-owned hybrid is not overwritten", userHybrid.length === 1 && userHybrid[0]?.label === "South");
const edited = applyCladdingFactWrite({ facts: [{ key: CLADDING_PORTIONS_FACT_KEY, work_area_id: "c1", value: extracted, source: "ai_extracted" }], workAreaId: "c1", key: "cladding.portion.direct_area_m2", value: 33, nestedItemId: extracted[0]?.id });
check("J one edit does not promote the collection", edited.find((row) => row.key === CLADDING_PORTIONS_FACT_KEY)?.source === "ai_extracted");

check("K explicit new cladding creates Cladding", classifyCladdingOwnership("install timber cladding").claddingPresent === true);
check("K excluded-only language does not create scope", classifyCladdingOwnership("cladding by others").claddingPresent === false);
check("K connected removal stays in Cladding", classifyCladdingOwnership("reclad the north elevation").connectedRemoval === true);
check("K wider demolition stays Demolition", classifyCladdingOwnership("strip out the house including cladding removal").widerDemolitionOwnsPackage === true);
check("K painting coexists separately", classifyCladdingOwnership("paint the house and install timber cladding").paintingCoexists === true);
check("K windows do not create Doors", classifyCladdingOwnership("replace windows while recladding").routeWindowsToDoors === false && classifyCladdingOwnership("replace windows while recladding").mutatesDoors === false);
check("K exterior openings do not mutate Internal Walls", classifyCladdingOwnership("new external opening in the cladding").mutatesInternalWalls === false);
check("K elevation words do not create Bathroom, Kitchen or Flooring", classifyCladdingOwnership("install timber cladding to the north elevation").unrelatedWorkAreas.length === 0);
check("K brick remains Cladding specialist scope", extractCladdingPortionsFromBrief(QA3)[0]?.cladding_family === "brick_veneer");

const qa1Review = visible(reviewOf(qa1Rows, qa1));
check("L review hierarchy names material and installation", qa1Review.includes("Cladding material") && qa1Review.includes("Installation labour"));
check("L review formats 193.55 lm and 23.23 h", qa1Review.includes("193.55 lm × 0.12 h/lm = 23.23 h"));
check("L review formats 133.33 lm and 17.33 h", qa1Review.includes("133.33 lm × 0.13 h/lm = 17.33 h"));
const qa2Review = visible(reviewOf(qa2Rows, qa2));
check("L review formats 14.4 m2 and 0.77 h", qa2Review.includes("14.4 m²") && qa2Review.includes("0.77 h") && !/\d+\.\d{8,}/.test(qa1Review + qa2Review));
check("L specialist section still creates a Cladding group", (brickReview.workAreas[0]?.workAreaName ?? "") === "Cladding" && (brickReview.workAreas[0]?.portionGroups?.length ?? 0) === 1);

check("M Cladding-only notice says Cladding", pricingNoticeForWorkAreaTypes(["cladding"]) === "Some Cladding items still require pricing.");
check("M Ceiling, Flooring and Doors keep their own notices", pricingNoticeForWorkAreaTypes(["ceilings"]) === "Some Ceiling items still require pricing." && pricingNoticeForWorkAreaTypes(["flooring"]) === "Some Flooring items still require pricing." && pricingNoticeForWorkAreaTypes(["doors"]) === "Some Doors items still require pricing.");
check("M multiple Work Areas use neutral copy and none uses a Ceiling default", pricingNoticeForWorkAreaTypes(["cladding", "ceilings"]) === "Some items still require pricing." && pricingNoticeForWorkAreaTypes([]) == null);
const composeSource = readFileSync("lib/assistant/builder-review/compose.ts", "utf8");
check("M compose does not fall back to the Ceiling sentence", !composeSource.includes("Some Ceiling items still require pricing."));

const sellA = deriveSellFromCost(4296.78, 20);
const gstA = calculateDocumentTotals([{ total_cost: 4296.78, total_sell: sellA }], DEFAULT_GST_RATE);
check("N fixture A sell and GST stay shared", close(sellA, 5370.98) && close(gstA.gstAmount, 805.65) && DEFAULT_GST_RATE === 15);
check("N a margin change does not change COST", close(fixtureA.recommendedCost, 4296.78) && deriveSellFromCost(4296.78, 25) !== sellA);
check("N priced lines keep section scope keys", new Set(included(fixtureA.lineItems).map((row) => row.scopeKey)).size === included(fixtureA.lineItems).length && included(fixtureA.lineItems).every((row) => (row.scopeKey ?? "").startsWith("cladding:")));

const ordinaryQuote = quoteOf(qa1Rows, included(qa1.lineItems).map((row) => ({ component_key: row.componentKey, nested_item_id: row.nestedItemId, total_cost: row.recommendedCost ?? 0, total_sell: row.recommendedSell ?? 0, cost_known: true, label: row.label })));
check("O quote names both elevations without a new cavity", ordinaryQuote.includes("North elevation") && ordinaryQuote.includes("South elevation") && !ordinaryQuote.includes("Includes a drained cavity"));
const battenQuote = quoteOf(qa2Rows, included(qa2.lineItems).map((row) => ({ component_key: row.componentKey, nested_item_id: row.nestedItemId, total_cost: row.recommendedCost ?? 0, total_sell: row.recommendedSell ?? 0, cost_known: true, label: row.label })));
check("O board-and-batten quote hides the sheet equivalent", !/sheet equivalent|5 sheets/i.test(battenQuote));
check("O quote hides COST, hours and internal keys", !/COST|h\/lm|cladding\.timber|margin/i.test(ordinaryQuote));
check("P legacy and cross-Work-Area identities stay out", !["CCS-035", "CCS-047", "scope.cladding.m2", "painting.material", "painting.labour", "deck.material", "fence.material", "sheet.plasterboard", "retaining_wall.masonry"].some((token) => claddingSource.includes(token)));
check("Q frozen Doors and Flooring sentences stay unchanged", DOORS_QUOTE_SPECIALIST_PENDING === "Specialist door system is excluded pending separate specification and pricing." && FLOORING_QUOTE_SPECIALIST_PENDING === "Specialist flooring works are excluded pending separate specification and pricing.");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
