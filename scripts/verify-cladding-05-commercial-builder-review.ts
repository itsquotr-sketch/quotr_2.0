/**
 * CLADDING-05 — hosted commercialisation and Builder Review.
 */
import { readFileSync } from "node:fs";
import type { OrganisationRate } from "../components/setup/types";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import {
  CLADDING_MATERIAL_BENCHMARKS,
  CLADDING_PRODUCTIVITY_BENCHMARKS,
} from "../lib/estimate/cladding-authority";
import { CLADDING_REMOVAL_EXCLUSIONS } from "../lib/estimate/cladding-commercial";
import {
  CLADDING_BOARD_AND_BATTEN_SHEET_M2,
  CLADDING_SHEET_EQUIVALENT_LABEL,
  CLADDING_TIMBER_BEVELBACK_142X18_LM,
  CLADDING_TIMBER_BEVELBACK_187X18_LM,
  claddingBattenMaterialKey,
} from "../lib/estimate/cladding-identities";
import { CLADDING_V1_HUMAN_QA_FROZEN as FROZEN } from "../lib/estimate/cladding-portions";
import {
  CLADDING_PORTIONS_FACT_KEY,
  CLADDING_SUPPORT_NOTES,
  createEmptyCladdingPortion,
  type CladdingPortion,
} from "../lib/estimate/cladding-portions";
import { resolveCladdingCarpenterHourlyCost } from "../lib/estimate/cladding-rate-resolution";
import { round2 } from "../lib/estimate/facts";
import type { LabourRequirement, MaterialRequirement } from "../lib/estimate/requirements";
import { workAreaMayCloseAtL5 } from "../lib/estimate/benchmark-coverage";
import { verifyRegisteredWorkAreaBenchmarkCoverage } from "../lib/estimate/work-area-benchmark-coverage";
import { getCatalogueEntry } from "../lib/rates/catalogue";
import type { EstimateFact, EstimateLineItem, EstimateLineItemInput, EstimateWorkArea } from "../lib/estimate/types";
import { getWorkAreaSupportEntry } from "../lib/work-areas/support-contract";

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean): void {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${passed + failed}. ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${passed + failed}. ${name}`);
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
    wall_underlay_or_rab_included: false,
    trims_flashings_corners_included: false,
    existing_cladding_removal_required: false,
    painting_or_coating_included: false,
    ...overrides,
  };
}

function factsFor(rows: CladdingPortion[], workAreaId = "c1"): EstimateFact[] {
  return [{ key: CLADDING_PORTIONS_FACT_KEY, work_area_id: workAreaId, value: rows, source: "user" }];
}

function rate(overrides: Partial<OrganisationRate> & Pick<OrganisationRate, "item_key" | "rate_type" | "unit" | "cost_rate">): OrganisationRate {
  return {
    id: overrides.id ?? "r1",
    trade: null,
    work_area_type: "cladding",
    label: overrides.item_key,
    sell_rate: null,
    markup_percent: null,
    active: true,
    ...overrides,
  };
}

const baseContext = {
  project: { id: "p1", qualityLevel: "standard" as const },
  confirmedWorkAreas: [] as EstimateWorkArea[],
  facts: [] as EstimateFact[],
  constraints: [],
  organisationSettings: { allow_benchmark_rates: true, default_margin_percent: 20 },
  materialWastageSettings: { sheet_material: 10, flooring: 10, paint: 10, default: 5 },
  rates: [] as OrganisationRate[],
};

function estimateOf(rows: CladdingPortion[], extra?: Partial<typeof baseContext>) {
  return calculateEstimate({
    ...baseContext,
    ...extra,
    confirmedWorkAreas: [{ id: "c1", type: "cladding", name: "Cladding", sort_order: 1 } as EstimateWorkArea],
    facts: factsFor(rows),
    rates: extra?.rates ?? [],
    constraints: extra?.constraints ?? [],
  });
}

function included(items: readonly EstimateLineItemInput[]) {
  return items.filter((row) => row.workAreaId === "c1" && row.includedInTotal !== false);
}
function line(items: readonly EstimateLineItemInput[], key: string) {
  return items.find((row) => row.componentKey === key && row.workAreaId === "c1");
}

const EXPECTED_MATERIAL: Record<string, number> = {
  "cladding.timber.bevelback.142x18.lm": 12,
  "cladding.timber.bevelback.187x18.lm": 15,
  "cladding.timber.bevelback.215x18.lm": 18,
  "cladding.timber.bevelback.230x18.lm": 19,
  "cladding.timber.rusticated.135x18.lm": 13,
  "cladding.timber.rusticated.180x18.lm": 16,
  "cladding.timber.rusticated.215x18.lm": 19,
  "cladding.timber.rusticated.230x18.lm": 20,
  "cladding.timber.vertical_shiplap.90x21.lm": 10,
  "cladding.timber.vertical_shiplap.135x21.lm": 14,
  "cladding.fibre_cement.weatherboard.150.lm": 12,
  "cladding.fibre_cement.weatherboard.180.lm": 18.5,
  "cladding.timber.board_and_batten.sheet_board.m2": 65,
  "cladding.timber.board_and_batten.batten.45x19.lm": 3.5,
  "cladding.timber.board_and_batten.batten.45x20.lm": 3.6,
  "cladding.timber.board_and_batten.batten.65x19.lm": 4.75,
  "cladding.timber.board_and_batten.batten.65x20.lm": 4.9,
  "cladding.timber.board_and_batten.batten.90x19.lm": 6.5,
  "cladding.timber.board_and_batten.batten.90x20.lm": 6.7,
  "cladding.cavity.timber_batten.m2": 9,
  "cladding.wall_underlay.flexible.m2": 5,
  "cladding.rigid_air_barrier.m2": 28,
};
const EXPECTED_HOURS: Record<string, [number, string]> = {
  "cladding.timber.bevelback.install.hours_per_lm": [0.12, "lm"],
  "cladding.timber.rusticated.install.hours_per_lm": [0.12, "lm"],
  "cladding.timber.vertical_shiplap.install.hours_per_lm": [0.11, "lm"],
  "cladding.fibre_cement.weatherboard.install.hours_per_lm": [0.13, "lm"],
  "cladding.timber.board_and_batten.sheet_board.install.hours_per_m2": [0.65, "m2"],
  "cladding.timber.board_and_batten.batten.install.hours_per_lm": [0.08, "lm"],
  "cladding.timber.bevelback.remove.hours_per_m2": [0.3, "m2"],
  "cladding.timber.rusticated.remove.hours_per_m2": [0.3, "m2"],
  "cladding.timber.vertical_shiplap.remove.hours_per_m2": [0.35, "m2"],
  "cladding.timber.board_and_batten.remove.hours_per_m2": [0.4, "m2"],
  "cladding.fibre_cement.weatherboard.remove.hours_per_m2": [0.4, "m2"],
  "cladding.cavity.install.hours_per_m2": [0.15, "m2"],
  "cladding.wall_underlay.install.hours_per_m2": [0.08, "m2"],
  "cladding.rigid_air_barrier.install.hours_per_m2": [0.18, "m2"],
};

check("ordinary material identities stay registered", CLADDING_MATERIAL_BENCHMARKS.length === 22);
for (const row of CLADDING_MATERIAL_BENCHMARKS) {
  const entry = getCatalogueEntry(row.key);
  check(
    `material ${row.key} is ${EXPECTED_MATERIAL[row.key]} ${row.unit}`,
    EXPECTED_MATERIAL[row.key] === row.costExGst &&
      entry?.item_key === row.key &&
      entry.unit === row.unit &&
      entry.defaultCostRate === row.costExGst &&
      entry.defaultSellRate == null
  );
}
check("ordinary productivity identities stay registered", CLADDING_PRODUCTIVITY_BENCHMARKS.length === 14);
for (const row of CLADDING_PRODUCTIVITY_BENCHMARKS) {
  const entry = getCatalogueEntry(row.key);
  const expected = EXPECTED_HOURS[row.key];
  check(
    `productivity ${row.key} is ${expected?.[0]} h/${expected?.[1]}`,
    expected != null &&
      row.hoursPerUnit === expected[0] &&
      row.unit === expected[1] &&
      entry?.defaultCostRate === expected[0] &&
      entry.unit === expected[1]
  );
}
const carpenter = resolveCladdingCarpenterHourlyCost({});
check("carpenter hourly COST is the existing catalogue benchmark", carpenter.source === "quotr" && carpenter.value === 60);

const lmA = 30 / 0.155;
const hoursA = lmA * 0.12;
const fixtureA = estimateOf([portion({ id: "north", label: "North elevation" })]);
const aMaterial = line(fixtureA.lineItems, CLADDING_TIMBER_BEVELBACK_187X18_LM);
const aLabour = line(fixtureA.lineItems, "cladding.timber.bevelback.install.hours_per_lm");
check("A material quantity stays 30 / 0.155 lm", close(aMaterial?.quantity, lmA));
check("A material COST is $2,903.23", close(aMaterial?.recommendedCost, 2903.23));
check("A installation hours stay unrounded before money", close(aLabour?.labourHours, hoursA));
check("A labour COST is $1,393.55", close(aLabour?.recommendedCost, 1393.55));
check("A hosted total is the sum of rounded component costs", close(fixtureA.recommendedCost, round2(2903.23 + 1393.55)));
check("A unrounded direct cost rounds to $4,296.77", close(round2(lmA * 15 + hoursA * 60), 4296.77));
check("A has no removal or accessory line", !fixtureA.lineItems.some((row) => (row.componentKey ?? "").includes(".remove.") || (row.componentKey ?? "").includes("cavity")));

const lmB = 20 / 0.15;
const fixtureB = estimateOf([
  portion({
    id: "south",
    label: "South elevation",
    cladding_family: "fibre_cement",
    orientation: null,
    cladding_system: "fibre_cement_horizontal_weatherboard",
    approved_profile_id: "fibre_cement_horizontal_weatherboard_180",
    nominal_width_mm: 180,
    nominal_thickness_mm: null,
    effective_cover_mm: 150,
    direct_area_m2: 20,
  }),
]);
const bMaterial = line(fixtureB.lineItems, "cladding.fibre_cement.weatherboard.180.lm");
const bLabour = line(fixtureB.lineItems, "cladding.fibre_cement.weatherboard.install.hours_per_lm");
check("B material quantity is 133.333 lm", close(bMaterial?.quantity, lmB));
check("B material COST is $2,466.67", close(bMaterial?.recommendedCost, 2466.67));
check("B installation hours are 17.333", close(bLabour?.labourHours, lmB * 0.13));
check("B labour COST is $1,040.00", close(bLabour?.recommendedCost, 1040));
check("B direct COST is $3,506.67", close(fixtureB.recommendedCost, 3506.67));

const lmC = 12 / 0.11;
const fixtureC = estimateOf([
  portion({
    id: "entry",
    label: "Entry feature",
    orientation: "vertical",
    cladding_system: "timber_vertical_shiplap",
    approved_profile_id: "timber_vertical_shiplap_135x21",
    nominal_width_mm: 135,
    nominal_thickness_mm: 21,
    effective_cover_mm: 110,
    direct_area_m2: 12,
  }),
]);
const cMaterial = line(fixtureC.lineItems, "cladding.timber.vertical_shiplap.135x21.lm");
const cLabour = line(fixtureC.lineItems, "cladding.timber.vertical_shiplap.install.hours_per_lm");
check("C material quantity is 109.0909 lm", close(cMaterial?.quantity, lmC));
check("C material COST is $1,527.27", close(cMaterial?.recommendedCost, 1527.27));
check("C installation hours are 12", close(cLabour?.labourHours, 12));
check("C labour COST is $720.00", close(cLabour?.recommendedCost, 720));
check("C direct COST is $2,247.27", close(fixtureC.recommendedCost, 2247.27));

const battenKey = claddingBattenMaterialKey(65, 19) ?? "";
const fixtureD = estimateOf([
  portion({
    id: "garage",
    label: "Garage elevation",
    orientation: "vertical",
    cladding_system: "timber_sheet_board_and_batten",
    approved_profile_id: "timber_sheet_board_and_batten",
    nominal_width_mm: null,
    nominal_thickness_mm: null,
    effective_cover_mm: null,
    area_method: "length_height",
    direct_area_m2: null,
    length_m: 6,
    height_m: 2.4,
    batten_width_mm: 65,
    batten_thickness_mm: 19,
  }),
]);
const dBoard = line(fixtureD.lineItems, CLADDING_BOARD_AND_BATTEN_SHEET_M2);
const dBatten = line(fixtureD.lineItems, battenKey);
const dBoardHours = line(fixtureD.lineItems, "cladding.timber.board_and_batten.sheet_board.install.hours_per_m2");
const dBattenHours = line(fixtureD.lineItems, "cladding.timber.board_and_batten.batten.install.hours_per_lm");
check("D board quantity is 14.4 m2", close(dBoard?.quantity, 14.4));
check("D board COST is $936.00", close(dBoard?.recommendedCost, 936));
check("D batten quantity is 9.6 lm", close(dBatten?.quantity, 9.6));
check("D batten COST is $45.60", close(dBatten?.recommendedCost, 45.6));
check("D board hours are 9.36", close(dBoardHours?.labourHours, 9.36));
check("D batten hours are 0.768", close(dBattenHours?.labourHours, 0.768));
check("D labour COST is $607.68", close(round2((dBoardHours?.recommendedCost ?? 0) + (dBattenHours?.recommendedCost ?? 0)), 607.68));
check("D direct COST is $1,589.28", close(fixtureD.recommendedCost, 1589.28));
check(
  "D sheet equivalent adds no COST",
  !fixtureD.lineItems.some((row) => (row.componentKey ?? "").includes("sheet_equivalent") && (row.recommendedCost ?? 0) !== 0) &&
    !included(fixtureD.lineItems).some((row) => (row.componentKey ?? "").includes("sheet_equivalent"))
);

const lmE = 12 / 0.11;
const fixtureE = estimateOf([
  portion({
    id: "replace",
    label: "North elevation",
    scope_intent: "replace",
    approved_profile_id: "timber_bevelback_142x18",
    nominal_width_mm: 142,
    effective_cover_mm: 110,
    direct_area_m2: 12,
    existing_cladding_removal_required: true,
  }),
]);
const eMaterial = line(fixtureE.lineItems, CLADDING_TIMBER_BEVELBACK_142X18_LM);
const eInstall = line(fixtureE.lineItems, "cladding.timber.bevelback.install.hours_per_lm");
const eRemoval = line(fixtureE.lineItems, "cladding.timber.bevelback.remove.hours_per_m2");
check("E material quantity is 109.0909 lm", close(eMaterial?.quantity, lmE));
check("E material COST is $1,309.09", close(eMaterial?.recommendedCost, 1309.09));
check("E install hours are 13.0909", close(eInstall?.labourHours, lmE * 0.12));
check("E install labour COST is $785.45", close(eInstall?.recommendedCost, 785.45));
check("E removal hours are 3.60", close(eRemoval?.labourHours, 3.6));
check("E removal COST is $216.00", close(eRemoval?.recommendedCost, 216));
check("E hosted total sums the rounded components", close(fixtureE.recommendedCost, round2(1309.09 + 785.45 + 216)));
check("E unrounded direct cost rounds to $2,310.55", close(round2(lmE * 12 + lmE * 0.12 * 60 + 12 * 0.3 * 60), 2310.55));
check("E removal notes exclude disposal and scaffold", (eRemoval?.notes ?? "").includes("disposal") && (eRemoval?.notes ?? "").includes(CLADDING_REMOVAL_EXCLUSIONS.slice(0, 20)));

const removalOnly = estimateOf([
  portion({
    id: "west",
    label: "Existing west wall",
    scope_intent: "removal_only",
    direct_area_m2: 12,
    existing_cladding_removal_required: true,
    approved_profile_id: "timber_bevelback_187x18",
  }),
]);
check(
  "removal only prices removal labour and no new material",
  included(removalOnly.lineItems).length === 1 &&
    included(removalOnly.lineItems)[0]?.componentKey?.includes(".remove.") === true &&
    close(included(removalOnly.lineItems)[0]?.recommendedCost, round2(12 * 0.3 * 60))
);

const both = estimateOf([
  portion({ id: "north", label: "North elevation" }),
  portion({
    id: "south",
    label: "South elevation",
    cladding_family: "fibre_cement",
    orientation: null,
    cladding_system: "fibre_cement_horizontal_weatherboard",
    approved_profile_id: "fibre_cement_horizontal_weatherboard_180",
    nominal_width_mm: 180,
    nominal_thickness_mm: null,
    effective_cover_mm: 150,
    direct_area_m2: 20,
  }),
]);
const northLines = both.lineItems.filter((row) => row.nestedItemId === "north" && row.includedInTotal !== false);
const southLines = both.lineItems.filter((row) => row.nestedItemId === "south" && row.includedInTotal !== false);
check("two sections keep separate nested ids", northLines.length > 0 && southLines.length > 0);
check("identical-looking profiles are not required for separation", new Set(both.lineItems.map((row) => row.scopeKey)).size === both.lineItems.length);
check("multiple-section total adds the section costs", close(both.recommendedCost, round2((fixtureA.recommendedCost ?? 0) + (fixtureB.recommendedCost ?? 0))));
check("section labels survive", both.lineItems.some((row) => row.nestedItemId === "north") && both.lineItems.some((row) => row.nestedItemId === "south"));

const materialOverride = estimateOf([portion({ id: "north", label: "North elevation" })], {
  rates: [rate({ item_key: CLADDING_TIMBER_BEVELBACK_187X18_LM, rate_type: "material", unit: "lm", cost_rate: 20 })],
});
check("company material override changes only material COST", close(line(materialOverride.lineItems, CLADDING_TIMBER_BEVELBACK_187X18_LM)?.recommendedCost, round2(lmA * 20)) && close(line(materialOverride.lineItems, "cladding.timber.bevelback.install.hours_per_lm")?.recommendedCost, 1393.55));
const restored = estimateOf([portion({ id: "north", label: "North elevation" })]);
check("removing the material override restores Quotr", close(line(restored.lineItems, CLADDING_TIMBER_BEVELBACK_187X18_LM)?.recommendedCost, 2903.23));

const productivityOverride = estimateOf([portion({ id: "north", label: "North elevation" })], {
  rates: [rate({ item_key: "cladding.timber.bevelback.install.hours_per_lm", rate_type: "productivity", unit: "lm", cost_rate: 0.2 })],
});
check("company productivity override changes hours only", close(line(productivityOverride.lineItems, "cladding.timber.bevelback.install.hours_per_lm")?.labourHours, lmA * 0.2) && close(line(productivityOverride.lineItems, CLADDING_TIMBER_BEVELBACK_187X18_LM)?.recommendedCost, 2903.23));
check("removing the productivity override restores Quotr hours", close(line(restored.lineItems, "cladding.timber.bevelback.install.hours_per_lm")?.labourHours, hoursA));

const carpenterOverride = estimateOf([portion({ id: "north", label: "North elevation" })], {
  rates: [rate({ item_key: "labour.carpenter.hour", rate_type: "labour", unit: "hour", cost_rate: 75, work_area_type: null })],
});
check("company carpenter override changes labour COST only", close(line(carpenterOverride.lineItems, "cladding.timber.bevelback.install.hours_per_lm")?.recommendedCost, round2(hoursA * 75)) && close(line(carpenterOverride.lineItems, CLADDING_TIMBER_BEVELBACK_187X18_LM)?.recommendedCost, 2903.23));
check("a labourer row does not replace carpenter", close(line(estimateOf([portion({ id: "north", label: "North elevation" })], { rates: [rate({ item_key: "labour.labourer.hour", rate_type: "labour", unit: "hour", cost_rate: 40 })] }).lineItems, "cladding.timber.bevelback.install.hours_per_lm")?.recommendedCost, 1393.55));

const removalOverride = estimateOf([
  portion({
    id: "replace",
    scope_intent: "replace",
    approved_profile_id: "timber_bevelback_142x18",
    nominal_width_mm: 142,
    effective_cover_mm: 110,
    direct_area_m2: 12,
    existing_cladding_removal_required: true,
  }),
], {
  rates: [rate({ item_key: "cladding.timber.bevelback.remove.hours_per_m2", rate_type: "productivity", unit: "m2", cost_rate: 0.5 })],
});
check("removal productivity override does not change install hours", close(line(removalOverride.lineItems, "cladding.timber.bevelback.remove.hours_per_m2")?.labourHours, 6) && close(line(removalOverride.lineItems, "cladding.timber.bevelback.install.hours_per_lm")?.labourHours, lmE * 0.12));

const otherTenant = estimateOf([portion({ id: "north", label: "North elevation" })], { rates: [] });
check("another tenant without the override stays on Quotr", close(line(otherTenant.lineItems, CLADDING_TIMBER_BEVELBACK_187X18_LM)?.recommendedCost, 2903.23));
check("a zero company material row does not win", close(line(estimateOf([portion({ id: "north", label: "North elevation" })], { rates: [rate({ item_key: CLADDING_TIMBER_BEVELBACK_187X18_LM, rate_type: "material", unit: "lm", cost_rate: 0 })] }).lineItems, CLADDING_TIMBER_BEVELBACK_187X18_LM)?.recommendedCost, 2903.23));
check("a company sell without cost does not win", close(line(estimateOf([portion({ id: "north", label: "North elevation" })], { rates: [rate({ item_key: CLADDING_TIMBER_BEVELBACK_187X18_LM, rate_type: "material", unit: "lm", cost_rate: null, sell_rate: 99 })] }).lineItems, CLADDING_TIMBER_BEVELBACK_187X18_LM)?.recommendedCost, 2903.23));

const difficult = estimateOf([portion({ id: "north", label: "North elevation" })], {
  constraints: [{ id: "k1", project_id: "p1", key: "site_access", value: "difficult", source: "user" }],
});
const hardLabour = line(difficult.lineItems, "cladding.timber.bevelback.install.hours_per_lm");
const hardMaterial = line(difficult.lineItems, CLADDING_TIMBER_BEVELBACK_187X18_LM);
check("difficult access changes labour hours once", close(hardLabour?.labourHours, hoursA * 1.1) && !close(hardLabour?.labourHours, hoursA * 1.21));
check("difficult access changes labour COST only", close(hardLabour?.recommendedCost, round2(hoursA * 1.1 * 60)) && close(hardMaterial?.recommendedCost, 2903.23) && close(hardMaterial?.quantity, lmA));

const withCavity = estimateOf([
  portion({
    id: "north",
    label: "North elevation",
    cavity_included: true,
    wall_underlay_or_rab_included: true,
    trims_flashings_corners_included: true,
  }),
]);
const cavity = line(withCavity.lineItems, "cladding.cavity.timber_batten.m2");
check("new cavity prices the ordinary timber identity", cavity?.includedInTotal !== false && close(cavity?.recommendedCost, 270));
check("accessory does not suppress ordinary pricing", close(line(withCavity.lineItems, CLADDING_TIMBER_BEVELBACK_187X18_LM)?.recommendedCost, 2903.23));
check("underlay and trims stay unresolved", line(withCavity.lineItems, "cladding.underlay_or_rab.unresolved.m2")?.includedInTotal === false && line(withCavity.lineItems, "cladding.trims_flashings_corners.unresolved")?.includedInTotal === false);
check(
  "painting does not create a cladding line",
  !estimateOf([
    portion({ id: "paint", label: "North elevation", painting_or_coating_included: true }),
  ]).lineItems.some((row) => /paint/i.test(row.componentKey ?? "") || /paint/i.test(row.label))
);

const mixed = estimateOf([
  portion({ id: "ready", label: "North elevation" }),
  portion({ id: "gap", label: "South elevation", direct_area_m2: null, area_method: null }),
]);
check("incomplete sibling emits no priced line", !mixed.lineItems.some((row) => row.nestedItemId === "gap" && row.includedInTotal !== false && (row.recommendedCost ?? 0) > 0));
check("complete sibling still prices", close(line(mixed.lineItems, CLADDING_TIMBER_BEVELBACK_187X18_LM)?.recommendedCost, 2903.23));
check("incomplete copy names the missing area", mixed.missingInfo.some((row) => row.includes("South elevation")));

const brickAndBoard = estimateOf([
  portion({ id: "ready", label: "North elevation" }),
  portion({
    id: "brick",
    label: "Lower elevation",
    cladding_family: "brick_veneer",
    cladding_system: "specialist_unresolved",
    approved_profile_id: null,
    effective_cover_mm: null,
    direct_area_m2: 25,
    other_description: "Recycled brick veneer",
  }),
]);
const brickLine = brickAndBoard.lineItems.find((row) => row.nestedItemId === "brick");
check("brick stays specialist with area and description", brickLine?.includedInTotal === false && brickLine?.quantity === 25 && (brickLine?.label ?? "").toLowerCase().includes("brick"));
check("brick does not inherit bevelback productivity", !brickAndBoard.lineItems.some((row) => row.nestedItemId === "brick" && (row.componentKey ?? "").includes("bevelback.install")));
check("supported sibling still prices beside brick", close(line(brickAndBoard.lineItems, CLADDING_TIMBER_BEVELBACK_187X18_LM)?.recommendedCost, 2903.23));

const custom = estimateOf([
  portion({
    id: "feature",
    label: "Feature wall",
    cladding_family: "other",
    cladding_system: "specialist_unresolved",
    approved_profile_id: null,
    specialist_kind: "custom_profile",
    effective_cover_mm: 120,
    effective_cover_authority: "user",
    direct_area_m2: 18,
    other_description: "Proprietary vertical profile",
  }),
]);
check("custom cover does not inherit an ordinary material rate", !custom.lineItems.some((row) => (row.itemKey ?? "").includes("bevelback") || (row.recommendedCost ?? 0) > 0 && row.includedInTotal !== false && (row.componentKey ?? "").includes("bevelback")));
check("custom section stays Pricing Required", custom.lineItems.filter((row) => row.nestedItemId === "feature").every((row) => row.includedInTotal === false));

const scanned = [
  "lib/estimate/cladding-commercial.ts",
  "lib/estimate/cladding-authority.ts",
  "lib/estimate/calculators/cladding.ts",
  "lib/assistant/builder-review/cladding-review-groups.ts",
].map((path) => readFileSync(path, "utf8")).join("\n");
for (const token of ["CCS-035", "CCS-047", "painting.material", "demolition.", "deck.material", "fence.material", "scope.cladding.m2", "labour.labourer.hour", "labour.general.hour"]) {
  check(`commercial path does not reuse ${token}`, !scanned.includes(token));
}
check("commercial path does not hardcode the carpenter dollar", !/(?<![0-9.])60(?![0-9])/.test(scanned));
check("no waste line is emitted", fixtureA.lineItems.every((row) => row.category !== "waste"));
check("no resolved zero-dollar line is emitted", included(fixtureA.lineItems).every((row) => (row.recommendedCost ?? 0) > 0));

function humanReviewText(review: ReturnType<typeof composeBuilderReview>): string {
  const parts: string[] = [];
  for (const wa of review.workAreas) {
    parts.push(wa.workAreaName, wa.workAreaType ?? "");
    for (const group of wa.portionGroups ?? []) {
      parts.push(group.label, group.summary ?? "", ...(group.assumptions ?? []));
      for (const lineGroup of group.lineGroups) {
        parts.push(lineGroup.label, lineGroup.supporting ?? "", lineGroup.rateContext ?? "");
        for (const child of lineGroup.children) {
          parts.push(child.label, child.supporting ?? "", child.detail ?? "", child.rateLabel);
        }
      }
    }
  }
  return parts.join("\n");
}

function reviewOf(estimate: ReturnType<typeof calculateEstimate>, rows: CladdingPortion[]) {
  const items: EstimateLineItem[] = estimate.lineItems.map((item, index) => ({
    id: `line-${index}`,
    workAreaName: item.workAreaName,
    label: item.label,
    category: item.category,
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
    productivityRate: item.productivityRate,
    costRate: item.costRate,
    itemKey: item.itemKey,
    componentKey: item.componentKey,
    nestedItemId: item.nestedItemId,
    notes: item.notes,
    includedInTotal: item.includedInTotal,
    scopeKey: item.scopeKey,
    overlapGroup: item.overlapGroup,
  }));
  return composeBuilderReview({
    estimate: {
      recommendedCost: estimate.recommendedCost,
      recommendedSell: estimate.recommendedSell,
      marginPercent: estimate.marginPercent,
      confidence: estimate.confidence,
      assumptions: estimate.assumptions,
      missingInfo: estimate.missingInfo,
      lineItems: items,
    },
    workAreas: [{ id: "c1", name: "Cladding", type: "cladding", status: "confirmed" }],
    requirements: estimate.requirements,
    facts: factsFor(rows),
  });
}

const reviewA = reviewOf(fixtureA, [portion({ id: "north", label: "North elevation" })]);
const groupA = reviewA.workAreas[0]?.portionGroups?.[0];
check("review title names the north bevelback section", groupA?.label === "North elevation — 30 m² timber bevelback, 187 × 18 mm");
check("review groups material then installation", groupA?.lineGroups.map((row) => row.label).join("|") === "Cladding material|Installation labour");
const reviewD = reviewOf(fixtureD, [
  portion({
    id: "garage",
    label: "Garage elevation",
    orientation: "vertical",
    cladding_system: "timber_sheet_board_and_batten",
    approved_profile_id: "timber_sheet_board_and_batten",
    nominal_width_mm: null,
    nominal_thickness_mm: null,
    effective_cover_mm: null,
    area_method: "length_height",
    direct_area_m2: null,
    length_m: 6,
    height_m: 2.4,
    batten_width_mm: 65,
    batten_thickness_mm: 19,
  }),
]);
const textD = JSON.stringify(reviewD.workAreas[0]?.portionGroups ?? []);
check("board-and-batten review separates board, battens and the sheet note", reviewD.workAreas[0]?.portionGroups?.[0]?.label.includes("board-and-batten") === true && textD.includes(CLADDING_SHEET_EQUIVALENT_LABEL) && textD.includes("Installation labour"));
const reviewE = reviewOf(fixtureE, [
  portion({
    id: "replace",
    label: "North elevation",
    scope_intent: "replace",
    approved_profile_id: "timber_bevelback_142x18",
    nominal_width_mm: 142,
    effective_cover_mm: 110,
    direct_area_m2: 12,
    existing_cladding_removal_required: true,
  }),
]);
const labelsE = reviewE.workAreas[0]?.portionGroups?.[0]?.lineGroups.map((row) => row.label) ?? [];
check("replacement review shows material, installation and removal", labelsE.includes("Cladding material") && labelsE.includes("Installation labour") && labelsE.includes("Removal"));
check("removal review states the exclusions", (reviewE.workAreas[0]?.portionGroups?.[0]?.assumptions ?? []).some((row) => row.includes("disposal")));
const reviewAccessories = reviewOf(withCavity, [
  portion({
    id: "north",
    label: "North elevation",
    cavity_included: true,
    wall_underlay_or_rab_included: true,
    trims_flashings_corners_included: true,
  }),
]);
check("accessory review group is separate", (reviewAccessories.workAreas[0]?.portionGroups?.[0]?.lineGroups ?? []).some((row) => row.label === "Accessories"));
const visible = humanReviewText(reviewA);
check(
  "review copy hides internal enums and scope keys",
  !visible.includes("COMPLETE_PHYSICAL") &&
    !visible.includes("INFORMATION_REQUIRED") &&
    !visible.includes("UNSUPPORTED_SPECIALIST") &&
    !visible.includes("timber_bevelback") &&
    !visible.includes("cladding.section:") &&
    !visible.includes("hours_per_lm")
);

const coverage = verifyRegisteredWorkAreaBenchmarkCoverage("cladding");
const support = getWorkAreaSupportEntry("cladding");
check("hosted commercialisation and Builder Review resolve", coverage.ok && coverage.resolves.some((row) => row.component === "Hosted commercialisation") && coverage.resolves.some((row) => row.component === "Builder Review"));
check("Pricing and Quote resolve and human QA is frozen", coverage.needsOwnerApproval.length === 0 && workAreaMayCloseAtL5(coverage) === true && FROZEN === true);
check("support notes name Pricing and Quote and record the human-QA freeze", support?.notes === CLADDING_SUPPORT_NOTES && support.notes.includes("hosted commercialisation") && support.notes.includes("client Quote") && support.notes.includes("human-QA frozen") && support.band === "component" && support.estimatableAsWorkArea === true && FROZEN === true);

const materialReq = fixtureA.requirements?.find((row) => row.kind === "material") as MaterialRequirement | undefined;
check("priced requirement traces the physical quantity", close(materialReq?.purchaseQuantity, lmA) && materialReq?.materialKey === CLADDING_TIMBER_BEVELBACK_187X18_LM);
const labourReq = fixtureA.requirements?.find((row) => row.kind === "labour") as LabourRequirement | undefined;
check("priced labour requirement uses carpenter and the physical quantity", labourReq?.trade === "carpenter" && close(labourReq?.productivityBasis.quantity, lmA) && labourReq?.priced === true);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
