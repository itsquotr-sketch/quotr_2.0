/**
 * RETAINING-WALL-MATURITY-1B — component commercial authority verifier.
 * Run: npx tsx scripts/verify-retaining-wall-maturity-1b.ts
 *
 * TEST_ONLY rates are not Quotr benchmarks.
 */
import { existsSync, readFileSync } from "node:fs";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import type { OrganisationRate } from "../components/setup/types";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateRetainingWall } from "../lib/estimate/calculators/retaining-wall";
import { MATERIAL_RATE_KEYS } from "../lib/estimate/material-rate-keys";
import { findCompanyProductivityRate } from "../lib/estimate/productivity";
import { buildPricingItemFieldsFromEstimateLineItem } from "../lib/pricing/pricing-item-calculation";
import {
  commercializeRetainingWall,
  decideRetainingWallPhysicalMode,
  masonryPhysicalReady,
  packageXorDetailedHolds,
  retainingWallCoverageIsReady,
  sleeperPhysicalReady,
  timberPhysicalReady,
  RW_PACKAGE_LIFECYCLE,
  RW_QUICK_ESTIMATE_PACKAGE_NOTE,
  RW_REBAR_GAP,
} from "../lib/estimate/retaining-wall-commercial";
import {
  RW_DRAINAGE_AGGREGATE_PROCUREMENT_BASIS,
  RW_DRAINAGE_AGGREGATE_PROCUREMENT_FACTOR,
  RW_TIMBER_DRAINAGE_LABOUR_OWNERSHIP,
  RW_TIMBER_FIXINGS_METHOD,
} from "../lib/estimate/retaining-wall-timber-1d";
import {
  H5_SED_POLE_IDENTITY,
  RW_BACKFILL_COMPONENT,
  RW_CONCRETE_SLEEPER_KEY,
  RW_DRAINAGE_AGGREGATE_KEY,
  RW_FACE_BOARD_150_H4_KEY,
  RW_H5_SED_POLE_KEY,
  RW_MASONRY_200_KEY,
  RW_MASONRY_BLOCK_LABOUR_COMPONENT,
  RW_MASONRY_BLOCK_SUBCONTRACT_COMPONENT,
  RW_MASONRY_BLOCKS_COMPONENT,
  RW_MASONRY_CORE_COMPONENT,
  RW_MASONRY_FOOTING_COMPONENT,
  RW_MASONRY_FOOTING_LABOUR_COMPONENT,
  RW_MASONRY_REBAR_COMPONENT,
  RW_MASONRY_SUBBASE_COMPONENT,
  RW_MASONRY_SUBBASE_LABOUR_COMPONENT,
  RW_MASONRY_WATERPROOF_COMPONENT,
  RW_NOVACOIL_COMPONENT,
  RW_NOVACOIL_KEY,
  RW_REBAR_KEY,
  RW_SLEEPER_COMPONENT,
  RW_SLEEPER_CONCRETE_COMPONENT,
  RW_SLEEPER_CONCRETE_LABOUR_COMPONENT,
  RW_SLEEPER_FACE_LABOUR_COMPONENT,
  RW_SLEEPER_POST_LABOUR_COMPONENT,
  RW_SLEEPER_POSTS_EA_COMPONENT,
  RW_SLEEPER_POSTS_PROCURE_COMPONENT,
  RW_STEEL_POST_KEY,
  RW_TIMBER_FIXINGS_COMPONENT,
  RW_TIMBER_BOARDS_COMPONENT,
  RW_TIMBER_FACE_LABOUR_COMPONENT,
  RW_TIMBER_PILE_LABOUR_COMPONENT,
  RW_TIMBER_PILES_EA_COMPONENT,
  RW_TIMBER_PILES_LM_COMPONENT,
  isRwTimberPileStockComponent,
} from "../lib/estimate/retaining-wall-identities";
import { buildRetainingWallPhysicalModel } from "../lib/estimate/retaining-wall-physical";
import {
  RW_PRODUCTIVITY_KEYS,
  RW_PRODUCTIVITY_UNITS,
} from "../lib/estimate/retaining-wall-productivity";
import { FULL_RATE_CATALOGUE } from "../lib/rates/catalogue";
import {
  RETAINING_SPECIFIC_MATERIAL_CATALOGUE,
  RETAINING_WALL_PRODUCTIVITY_RATE_CATALOGUE,
} from "../lib/rates/specific-material-catalogue";
import { isMaterialRatesCatalogueEntry } from "../lib/rates/rate-section-contract";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "../lib/estimate/types";
import type {
  EstimateRequirement,
  LabourRequirement,
  MaterialRequirement,
} from "../lib/estimate/requirements";

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

function near(actual: number, expected: number, eps = 0.08): boolean {
  return Math.abs(actual - expected) <= eps;
}

function wa(id = "rw1"): EstimateWorkArea & { status: "confirmed" } {
  return {
    id,
    type: "retaining_wall",
    name: "Retaining wall",
    sort_order: 1,
    status: "confirmed",
  };
}

function fact(key: string, value: unknown, workAreaId = "rw1"): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

/** TEST_ONLY — not a Quotr benchmark. */
function testRate(
  itemKey: string,
  unit: string,
  cost: number,
  rateType: "material" | "productivity" | "labour" = "material"
): OrganisationRate {
  return {
    id: `test.${itemKey}.${unit}`,
    rate_type: rateType,
    trade: rateType === "labour" ? "carpenter" : null,
    work_area_type: "retaining_wall",
    item_key: itemKey,
    label: `TEST_ONLY ${itemKey}`,
    unit,
    cost_rate: cost,
    sell_rate: null,
    markup_percent: null,
    active: true,
  };
}

function ctx(facts: EstimateFact[], rates: OrganisationRate[] = []): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [wa(facts[0]?.work_area_id ?? "rw1")],
    facts,
    constraints: [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
    },
    materialWastageSettings: { defaultMaterialWastagePercent: 10 },
    rates,
  } as unknown as EstimateContext;
}

function stockPriced(
  reqs: readonly EstimateRequirement[] | undefined
): boolean {
  const rows = (reqs ?? []).filter(
    (row): row is MaterialRequirement =>
      row.kind === "material" && isRwTimberPileStockComponent(row.componentKey)
  );
  return rows.length > 0 && rows.every((row) => row.priced === true);
}

function mat(
  reqs: readonly EstimateRequirement[] | undefined,
  key: string
): MaterialRequirement | undefined {
  return reqs?.find(
    (row): row is MaterialRequirement =>
      row.kind === "material" && row.componentKey === key
  );
}

function lab(
  reqs: readonly EstimateRequirement[] | undefined,
  key: string
): LabourRequirement | undefined {
  return reqs?.find(
    (row): row is LabourRequirement =>
      row.kind === "labour" && row.componentKey === key
  );
}

function hasPackage(items: readonly EstimateLineItemInput[]): boolean {
  return items.some(
    (item) =>
      item.label === "Retaining wall labour" || item.label === "Retaining wall materials"
  );
}

function hasDetailedMoney(items: readonly EstimateLineItemInput[]): boolean {
  return items.some(
    (item) =>
      item.componentKey === RW_TIMBER_BOARDS_COMPONENT ||
      item.componentKey === RW_SLEEPER_COMPONENT ||
      item.componentKey === RW_MASONRY_BLOCKS_COMPONENT
  );
}

function sellOf(items: readonly EstimateLineItemInput[]): number {
  return items.reduce((sum, item) => sum + (item.recommendedSell ?? 0), 0);
}

function phys(facts: EstimateFact[], materialName: string) {
  return buildRetainingWallPhysicalModel({
    context: ctx(facts),
    workAreaId: facts[0]?.work_area_id ?? "rw1",
    material: materialName,
  });
}

function com(facts: EstimateFact[], materialName: string, rates: OrganisationRate[] = []) {
  return commercializeRetainingWall({
    physical: phys(facts, materialName),
    facts,
    workAreaId: facts[0]?.work_area_id ?? "rw1",
    rates,
    organisationSettings: null,
  });
}

const timberLevel = [
  fact("retaining_wall.length_m", 10),
  fact("retaining_wall.height_m", 1),
  fact("retaining_wall.material", "Timber"),
  fact("retaining_wall.face_board_section", "150×50 H4"),
  fact("retaining_wall.drainage_required", true),
  fact("retaining_wall.backfill_included", true),
];
const timberSlope = [
  fact("retaining_wall.length_m", 10),
  fact("retaining_wall.height_high_m", 1.5),
  fact("retaining_wall.height_low_m", 0.5),
  fact("retaining_wall.material", "Timber"),
  fact("retaining_wall.face_board_section", "150×50 H4"),
  fact("retaining_wall.drainage_required", true),
  fact("retaining_wall.backfill_included", true),
];
const timberNoDrainage = [
  fact("retaining_wall.length_m", 10),
  fact("retaining_wall.height_m", 1),
  fact("retaining_wall.material", "Timber"),
];
const sleeperLevel = [
  fact("retaining_wall.length_m", 10),
  fact("retaining_wall.height_m", 1),
  fact("retaining_wall.material", "Concrete sleeper"),
  fact("retaining_wall.sleeper_length_m", 2),
  fact("retaining_wall.sleeper_face_height_m", 0.2),
  fact("retaining_wall.drainage_required", true),
  fact("retaining_wall.backfill_included", true),
];
const masonryLevel = [
  fact("retaining_wall.length_m", 10),
  fact("retaining_wall.height_m", 1),
  fact("retaining_wall.material", "Masonry / block"),
  fact("retaining_wall.block_series", "200-series"),
  fact("retaining_wall.waterproofing_required", true),
  fact("retaining_wall.waterproofing_type", "Liquid membrane"),
];
const unspecified = [
  fact("retaining_wall.length_m", 10),
  fact("retaining_wall.height_m", 1),
  fact("retaining_wall.material", "Concrete"),
];

const TEST_BOARD = 12;
const TEST_PILE_LM = 25;
const TEST_NOVACOIL = 8;
const TEST_SLEEPER = 40;
const TEST_POST = 55;
const TEST_BLOCK = 4.5;
const TEST_PILE_H = 0.5;
const TEST_FACE_H = 0.4;
const TEST_BACKFILL_H = 0.3;
const TEST_LABOUR = 70;

function timberRates(): OrganisationRate[] {
  return [
    testRate(RW_FACE_BOARD_150_H4_KEY, "lm", TEST_BOARD),
    testRate(RW_H5_SED_POLE_KEY, "lm", TEST_PILE_LM),
    testRate(RW_NOVACOIL_KEY, "lm", TEST_NOVACOIL),
    testRate(MATERIAL_RATE_KEYS.drainageNovacoilLm, "lm", TEST_NOVACOIL),
    testRate(RW_DRAINAGE_AGGREGATE_KEY, "m3", 35),
    testRate(RW_TIMBER_FIXINGS_COMPONENT, "item", 45),
    testRate(RW_PRODUCTIVITY_KEYS.timberPilesEa, "ea", TEST_PILE_H, "productivity"),
    testRate(RW_PRODUCTIVITY_KEYS.timberFaceM2, "m2", TEST_FACE_H, "productivity"),
    testRate(RW_PRODUCTIVITY_KEYS.backfillM3, "m3", TEST_BACKFILL_H, "productivity"),
    testRate("labour.carpenter.hour", "hour", TEST_LABOUR, "labour"),
  ];
}

const commercialSrc = readFileSync("lib/estimate/retaining-wall-commercial.ts", "utf8");
const calcSrc = readFileSync("lib/estimate/calculators/retaining-wall.ts", "utf8");
const identitiesSrc = readFileSync("lib/estimate/retaining-wall-identities.ts", "utf8");
const catalogueSrc = readFileSync("lib/rates/specific-material-catalogue.ts", "utf8");
const coverageSrc = existsSync("docs/architecture/QUOTR_WORK_AREA_ESTIMATING_COVERAGE.md")
  ? readFileSync("docs/architecture/QUOTR_WORK_AREA_ESTIMATING_COVERAGE.md", "utf8")
  : "";

const timberPhys = phys(timberLevel, "Timber");
const timberA = com(timberLevel, "Timber");
const boardsA = mat(timberA.requirements, RW_TIMBER_BOARDS_COMPONENT);
const timberCalcA = calculateRetainingWall(ctx(timberLevel), wa());
const timberFullCalc = calculateRetainingWall(ctx(timberLevel, timberRates()), wa());
const timberFull = com(timberLevel, "Timber", timberRates());
const sleeperPhys = phys(sleeperLevel, "Concrete sleeper");
const sleeperCalcA = calculateRetainingWall(ctx(sleeperLevel), wa());
const masonryPhys = phys(masonryLevel, "Masonry / block");
const masonryA = com(masonryLevel, "Masonry / block");
const masonryCalcA = calculateRetainingWall(ctx(masonryLevel), wa());
const unspecifiedCalc = calculateRetainingWall(ctx(unspecified), wa());
const estimateFull = calculateEstimate(ctx(timberLevel, timberRates()));

const timberSelective = com(timberLevel, "Timber", [
  testRate(RW_FACE_BOARD_150_H4_KEY, "lm", TEST_BOARD),
]);
const timberSelectiveCalc = calculateRetainingWall(
  ctx(timberLevel, [testRate(RW_FACE_BOARD_150_H4_KEY, "lm", TEST_BOARD)]),
  wa()
);
const timberPostPromotion = com(
  timberLevel,
  "Timber",
  timberRates().filter((row) => row.item_key !== RW_FACE_BOARD_150_H4_KEY)
);
const timberPostPromotionCalc = calculateRetainingWall(
  ctx(
    timberLevel,
    timberRates().filter((row) => row.item_key !== RW_FACE_BOARD_150_H4_KEY)
  ),
  wa()
);
const timberAssumeDrainage = phys(timberNoDrainage, "Timber");
const timberAssumeCom = com(timberNoDrainage, "Timber");
const timberExplicitNoDrainage = phys(
  [
    ...timberNoDrainage,
    fact("retaining_wall.drainage_required", false),
    fact("retaining_wall.backfill_included", false),
  ],
  "Timber"
);

console.log("\n--- AUTHORITY / READINESS ---\n");
check(
  "1 empty-rate Timber has detailed physical quantities",
  timberPhysicalReady(timberPhys) &&
    decideRetainingWallPhysicalMode(timberPhys) === "DETAILED_PHYSICAL_MODEL" &&
    (boardsA?.purchaseQuantity ?? 0) > 0
);
check(
  "2 empty-rate Timber uses 1D detailed money with Quotr starters",
  timberA.mode === "DETAILED_COMPONENT_AUTHORITY" &&
    timberA.physicalMode === "DETAILED_PHYSICAL_MODEL" &&
    timberA.commerciallyReady === true &&
    !hasPackage(timberCalcA.lineItems) &&
    hasDetailedMoney(timberCalcA.lineItems)
);
check(
  "3 empty-rate Timber sell not $0",
  sellOf(timberCalcA.lineItems) > 0
);
const rw2Empty = calculateEstimate(
  ctx(
    [
      fact("retaining_wall.length_m", 10, "rw2"),
      fact("retaining_wall.height_m", 1, "rw2"),
      fact("retaining_wall.is_raking", false, "rw2"),
      fact("retaining_wall.fixing_type", "Standard", "rw2"),
      fact("retaining_wall.material", "Timber", "rw2"),
      fact("retaining_wall.drainage_required", true, "rw2"),
      fact("retaining_wall.backfill_included", true, "rw2"),
      fact("retaining_wall.backfill_depth_m", 0.3, "rw2"),
      fact("retaining_wall.backfill_length_m", 10, "rw2"),
      fact("retaining_wall.backfill_height_m", 1, "rw2"),
    ],
    []
  )
);
check(
  "4 RW-2 empty-rate promotes detailed money (no longer locked to package $7,345)",
  rw2Empty.recommendedSell > 0 &&
    !rw2Empty.lineItems.some((item) => item.label === "Retaining wall materials")
);
check(
  "5 partial board rate stays inside detailed money (no package mix)",
  !hasPackage(timberSelectiveCalc.lineItems) &&
    hasDetailedMoney(timberSelectiveCalc.lineItems) &&
    timberSelective.mode === "DETAILED_COMPONENT_AUTHORITY"
);
check(
  "6 partial board override does not restore package",
  timberSelective.mode === "DETAILED_COMPONENT_AUTHORITY" &&
    timberSelective.commerciallyReady === true &&
    mat(timberSelective.requirements, RW_TIMBER_BOARDS_COMPONENT)?.priced === true
);
check(
  "7 full TEST coverage promotes detailed money",
  timberFull.mode === "DETAILED_COMPONENT_AUTHORITY" &&
    timberFull.commerciallyReady === true &&
    retainingWallCoverageIsReady(timberFull.coverage)
);
check(
  "8 promoted detail suppresses package",
  !hasPackage(timberFullCalc.lineItems) && hasDetailedMoney(timberFullCalc.lineItems)
);
check(
  "9 post-promotion missing material rate does not restore package",
  timberPostPromotion.mode === "DETAILED_COMPONENT_AUTHORITY" &&
    !hasPackage(timberPostPromotionCalc.lineItems)
);
check(
  "10 post-promotion missing company board rate falls back to Quotr starter, not package",
  mat(timberPostPromotion.requirements, RW_TIMBER_BOARDS_COMPONENT)?.priced === true &&
    stockPriced(timberPostPromotion.requirements) &&
    timberPostPromotion.mode === "DETAILED_COMPONENT_AUTHORITY"
);
check(
  "11 missing drainage assumes YES for Timber",
  mat(timberAssumeCom.requirements, RW_NOVACOIL_COMPONENT)?.purchaseQuantity === 10 &&
    timberAssumeDrainage.assumptions.some((row) =>
      row.includes("standard estimating assumption")
    )
);
check(
  "12 explicit drainage NO removes scope",
  !timberExplicitNoDrainage.requirements.some(
    (row) => row.componentKey === RW_NOVACOIL_COMPONENT
  )
);
check(
  "13 missing backfill assumption still emits in-place volume; purchase applies 1.25 factor",
  near(mat(timberAssumeCom.requirements, RW_BACKFILL_COMPONENT)?.baseQuantity ?? 0, 2.55) &&
    near(
      mat(timberAssumeCom.requirements, RW_BACKFILL_COMPONENT)?.purchaseQuantity ?? 0,
      2.55 * RW_DRAINAGE_AGGREGATE_PROCUREMENT_FACTOR
    )
);
check(
  "14 backfill procurement factor is applied for Timber 1D",
  timberA.backfillProcurement === RW_DRAINAGE_AGGREGATE_PROCUREMENT_BASIS &&
    timberA.commerciallyReady === true
);
check(
  "15 residual 8% of timber materials is an approved allowance",
  timberA.residualClass === RW_TIMBER_FIXINGS_METHOD &&
    mat(timberA.requirements, RW_TIMBER_FIXINGS_COMPONENT)?.priced === true &&
    timberA.commerciallyReady === true
);
check(
  "16 no package + detailed money double count",
  packageXorDetailedHolds({
    mode: timberA.mode,
    hasPackageFaceLine: hasPackage(timberCalcA.lineItems),
    hasDetailedMoneyLine: hasDetailedMoney(timberCalcA.lineItems),
  }) &&
    packageXorDetailedHolds({
      mode: timberFull.mode,
      hasPackageFaceLine: hasPackage(timberFullCalc.lineItems),
      hasDetailedMoneyLine: hasDetailedMoney(timberFullCalc.lineItems),
    })
);
check(
  "17 Sleeper follows same commercial readiness gate",
  sleeperPhysicalReady(sleeperPhys) &&
    sleeperCalcA.requirements.some((row) => row.componentKey === RW_SLEEPER_COMPONENT) &&
    !hasPackage(sleeperCalcA.lineItems) &&
    hasDetailedMoney(sleeperCalcA.lineItems)
);
check(
  "18 Masonry follows safe readiness gate",
  masonryPhysicalReady(masonryPhys) &&
    masonryA.gaps.includes(RW_REBAR_GAP) &&
    masonryA.commerciallyReady === false &&
    hasPackage(masonryCalcA.lineItems)
);
check(
  "19 Pricing copies authoritative mode",
  estimateFull.lineItems.every((item) => {
    const copied = buildPricingItemFieldsFromEstimateLineItem({
      category: item.category,
      recommended_cost: item.recommendedCost,
      recommended_sell: item.recommendedSell,
      notes: item.notes ?? null,
    });
    return near(copied.totalCost, item.recommendedCost);
  })
);
check(
  "20 Quote copies Pricing",
  existsSync("lib/quotes/adoption-authority.ts") &&
    !readFileSync("lib/quotes/adoption-authority.ts", "utf8").includes("calculateRetainingWall")
);
const deckSrcEarly = readFileSync("lib/estimate/calculators/deck.ts", "utf8");
check(
  "21 Deck 2D unchanged",
  deckSrcEarly.includes("adaptPricedMaterialRequirementWithoutLegacy") &&
    !deckSrcEarly.includes("commercializeRetainingWall")
);

console.log("\n--- TIMBER ---\n");
check("9 board quantity retained", (boardsA?.purchaseQuantity ?? 0) > 0 && boardsA?.purchaseUnit === "lm");
const timber200Calc = calculateRetainingWall(
  ctx([
    ...timberLevel.filter((row) => row.key !== "retaining_wall.face_board_section"),
    fact("retaining_wall.face_board_section", "200×50 H4"),
  ]),
  wa()
);
const lm150 = mat(timberCalcA.requirements, RW_TIMBER_BOARDS_COMPONENT)?.purchaseQuantity ?? 0;
const lm200 = mat(timber200Calc.requirements, RW_TIMBER_BOARDS_COMPONENT)?.purchaseQuantity ?? 0;
check("10 150→200 recalculates board lm", lm150 > lm200 && near(lm150 / lm200, 0.2 / 0.15));
check(
  "11 pile count stays through board change",
  mat(timberCalcA.requirements, RW_TIMBER_PILES_EA_COMPONENT)?.purchaseQuantity ===
    mat(timber200Calc.requirements, RW_TIMBER_PILES_EA_COMPONENT)?.purchaseQuantity &&
    mat(timberCalcA.requirements, RW_TIMBER_PILES_EA_COMPONENT)?.purchaseQuantity === 10
);
const pileLab = lab(timberFull.requirements, RW_TIMBER_PILE_LABOUR_COMPONENT);
const faceLab = lab(timberFull.requirements, RW_TIMBER_FACE_LABOUR_COMPONENT);
check(
  "12 pile labour uses EA productivity",
  pileLab?.productivityBasis.unit === "ea" &&
    pileLab.productivityBasis.quantity === 10 &&
    near(pileLab.baseHours, 10 * TEST_PILE_H)
);
check(
  "13 face labour uses m² productivity",
  faceLab?.productivityBasis.unit === "m2" &&
    near(faceLab.productivityBasis.quantity, 10) &&
    near(faceLab.baseHours, 10 * TEST_FACE_H)
);
const pileLabA = lab(timberA.requirements, RW_TIMBER_PILE_LABOUR_COMPONENT);
check(
  "14 missing company productivity uses Quotr starter, not zero hours",
  pileLabA?.priced === true &&
    (pileLabA.baseHours ?? 0) > 0 &&
    (pileLabA.totalCost ?? 0) > 0
);
check(
  "15 novacoil quantity remains length",
  mat(timberA.requirements, RW_NOVACOIL_COMPONENT)?.purchaseQuantity === 10 &&
    mat(timberA.requirements, RW_NOVACOIL_COMPONENT)?.purchaseUnit === "lm"
);
check(
  "16 backfill driver m³ is in-place; purchase applies procurement factor",
  mat(timberA.requirements, RW_BACKFILL_COMPONENT)?.purchaseUnit === "m3" &&
    near(mat(timberA.requirements, RW_BACKFILL_COMPONENT)?.baseQuantity ?? 0, 2.55) &&
    near(
      mat(timberA.requirements, RW_BACKFILL_COMPONENT)?.purchaseQuantity ?? 0,
      2.55 * RW_DRAINAGE_AGGREGATE_PROCUREMENT_FACTOR
    )
);

console.log("\n--- SLEEPER ---\n");
check(
  "17 discrete sleeper EA",
  mat(sleeperCalcA.requirements, RW_SLEEPER_COMPONENT)?.purchaseQuantity === 25 &&
    mat(sleeperCalcA.requirements, RW_SLEEPER_COMPONENT)?.purchaseUnit === "ea"
);
const sleeperShort = calculateRetainingWall(
  ctx([
    ...sleeperLevel.filter((row) => row.key !== "retaining_wall.sleeper_length_m"),
    fact("retaining_wall.sleeper_length_m", 1),
  ]),
  wa()
);
check(
  "18 sleeper dimension change recalculates system",
  (mat(sleeperShort.requirements, RW_SLEEPER_COMPONENT)?.purchaseQuantity ?? 0) > 25
);
check(
  "19 post count tied to bay geometry",
  mat(sleeperCalcA.requirements, RW_SLEEPER_POSTS_EA_COMPONENT)?.purchaseQuantity === 6
);
const sleeperPriced = com(sleeperLevel, "Concrete sleeper", [
  testRate(RW_CONCRETE_SLEEPER_KEY, "ea", TEST_SLEEPER),
  testRate(RW_STEEL_POST_KEY, "ea", TEST_POST),
]);
check(
  "20 post material rate exact",
  mat(sleeperPriced.requirements, RW_SLEEPER_POSTS_PROCURE_COMPONENT)?.priced === true &&
    mat(sleeperPriced.requirements, RW_SLEEPER_POSTS_PROCURE_COMPONENT)?.unitCost === TEST_POST &&
    mat(sleeperPriced.requirements, RW_SLEEPER_POSTS_PROCURE_COMPONENT)?.purchaseUnit === "ea"
);
const sleeperLab = com(sleeperLevel, "Concrete sleeper", [
  testRate(RW_PRODUCTIVITY_KEYS.sleeperPostsEa, "ea", 0.6, "productivity"),
  testRate(RW_PRODUCTIVITY_KEYS.sleeperConcreteHole, "hole", 0.2, "productivity"),
  testRate(RW_PRODUCTIVITY_KEYS.sleeperSleepersEa, "ea", 0.5, "productivity"),
  testRate("labour.carpenter.hour", "hour", TEST_LABOUR, "labour"),
]);
check(
  "21 post labour h/ea",
  lab(sleeperLab.requirements, RW_SLEEPER_POST_LABOUR_COMPONENT)?.productivityBasis.unit === "ea"
);
check(
  "22 concrete volume retained",
  (mat(sleeperCalcA.requirements, RW_SLEEPER_CONCRETE_COMPONENT)?.baseQuantity ?? 0) > 0
);
check(
  "23 bag count uses default 20kg yield",
  (sleeperPhys.sleeperTakeoff?.bagCount ?? 0) > 0 &&
    mat(sleeperCalcA.requirements, RW_SLEEPER_CONCRETE_COMPONENT)?.purchaseUnit === "bag"
);
check(
  "24 concrete labour h/hole",
  lab(sleeperLab.requirements, RW_SLEEPER_CONCRETE_LABOUR_COMPONENT)?.productivityBasis.unit === "hole"
);
check(
  "25 sleeper labour h/ea",
  lab(sleeperLab.requirements, RW_SLEEPER_FACE_LABOUR_COMPONENT)?.productivityBasis.unit === "ea"
);

console.log("\n--- MASONRY ---\n");
const blocks = mat(masonryA.requirements, RW_MASONRY_BLOCKS_COMPONENT);
const masonryNetBlocks = 125;
const masonryPurchaseBlocks = Math.ceil(masonryNetBlocks * 1.05 - 1e-9);
check(
  "26 block purchase whole EA",
  blocks?.purchaseUnit === "ea" &&
    Number.isInteger(blocks.purchaseQuantity) &&
    near(blocks.baseQuantity ?? 0, masonryNetBlocks) &&
    blocks.purchaseQuantity === masonryPurchaseBlocks
);
const masonryPriced = com(masonryLevel, "Masonry / block", [
  testRate(RW_MASONRY_200_KEY, "ea", TEST_BLOCK),
]);
check(
  "27 block rate exact",
  mat(masonryPriced.requirements, RW_MASONRY_BLOCKS_COMPONENT)?.unitCost === TEST_BLOCK
);
const masonry150 = com(
  [
    ...masonryLevel.filter((row) => row.key !== "retaining_wall.block_series"),
    fact("retaining_wall.block_series", "150-series"),
  ],
  "Masonry / block"
);
check(
  "28 block series change recomputes core fill",
  (mat(masonry150.requirements, RW_MASONRY_CORE_COMPONENT)?.purchaseQuantity ?? 0) !==
    (mat(masonryA.requirements, RW_MASONRY_CORE_COMPONENT)?.purchaseQuantity ?? 0)
);
check(
  "29 footing material m³",
  mat(masonryA.requirements, RW_MASONRY_FOOTING_COMPONENT)?.purchaseUnit === "m3" &&
    near(mat(masonryA.requirements, RW_MASONRY_FOOTING_COMPONENT)?.purchaseQuantity ?? 0, 1)
);
const masonryLab = com(masonryLevel, "Masonry / block", [
  testRate(RW_PRODUCTIVITY_KEYS.masonryFootingM3, "m3", 0.8, "productivity"),
  testRate(RW_PRODUCTIVITY_KEYS.masonrySubbaseM2, "m2", 0.15, "productivity"),
  testRate(RW_PRODUCTIVITY_KEYS.masonryBlockM2, "m2", 1.2, "productivity"),
  testRate(RW_PRODUCTIVITY_KEYS.masonryCoreFillM3, "m3", 0.5, "productivity"),
  testRate("labour.carpenter.hour", "hour", TEST_LABOUR, "labour"),
]);
check(
  "30 footing labour h/m³",
  lab(masonryLab.requirements, RW_MASONRY_FOOTING_LABOUR_COMPONENT)?.productivityBasis.unit === "m3"
);
check(
  "31 sub-base material m³",
  mat(masonryA.requirements, RW_MASONRY_SUBBASE_COMPONENT)?.purchaseUnit === "m3" &&
    near(mat(masonryA.requirements, RW_MASONRY_SUBBASE_COMPONENT)?.purchaseQuantity ?? 0, 0.4)
);
check(
  "32 sub-base labour m²",
  lab(masonryLab.requirements, RW_MASONRY_SUBBASE_LABOUR_COMPONENT)?.productivityBasis.unit === "m2"
);
check(
  "33 unresolved rebar is Pricing Required, not silent $0",
  masonryA.gaps.includes(RW_REBAR_GAP) &&
    mat(masonryA.requirements, RW_MASONRY_REBAR_COMPONENT) == null &&
    (mat(masonryA.requirements, "retaining_wall.masonry.rebar.allowance")?.priced !==
      true ||
      (mat(masonryA.requirements, "retaining_wall.masonry.rebar.allowance")
        ?.totalCost ?? 0) === 0) &&
    masonryA.coverage.some(
      (row) => row.key === "reinforcement" && row.state === "PRICING_REQUIRED"
    )
);
const masonryRebar = com(
  [...masonryLevel, fact("retaining_wall.horizontal_rebar_runs", 2)],
  "Masonry / block",
  [testRate(RW_REBAR_KEY, "lm", 6)]
);
check(
  "34 rebar quantity prices when supplied",
  (mat(masonryRebar.requirements, RW_MASONRY_REBAR_COMPONENT)?.purchaseQuantity ?? 0) > 0 &&
    mat(masonryRebar.requirements, RW_MASONRY_REBAR_COMPONENT)?.priced === true
);
check(
  "35 corefill m³",
  mat(masonryA.requirements, RW_MASONRY_CORE_COMPONENT)?.purchaseUnit === "m3" &&
    near(mat(masonryA.requirements, RW_MASONRY_CORE_COMPONENT)?.purchaseQuantity ?? 0, 1)
);
const waterproof = mat(masonryA.requirements, RW_MASONRY_WATERPROOF_COMPONENT);
check(
  "36 waterproofing units safe",
  waterproof?.purchaseUnit === "L" && (waterproof.purchaseQuantity ?? 0) > 0
);
const masonrySub = com(
  [...masonryLevel, fact("retaining_wall.block_laying_method", "Subcontract")],
  "Masonry / block"
);
check(
  "37 self-perform XOR subbie",
  mat(masonrySub.requirements, RW_MASONRY_BLOCK_SUBCONTRACT_COMPONENT) != null &&
    lab(masonrySub.requirements, RW_MASONRY_BLOCK_LABOUR_COMPONENT) == null &&
    lab(masonryA.requirements, RW_MASONRY_BLOCK_LABOUR_COMPONENT) != null &&
    mat(masonryA.requirements, RW_MASONRY_BLOCK_SUBCONTRACT_COMPONENT) == null
);

console.log("\n--- PRODUCTIVITY ---\n");
check(
  "38 RW productivity rows absent Materials",
  RETAINING_WALL_PRODUCTIVITY_RATE_CATALOGUE.every((row) => !isMaterialRatesCatalogueEntry(row)) &&
    RETAINING_WALL_PRODUCTIVITY_RATE_CATALOGUE.every(
      (row) => !RETAINING_SPECIFIC_MATERIAL_CATALOGUE.some((item) => item.item_key === row.item_key)
    )
);
for (const [label, key, unit] of [
  ["39 h/m³ persists", RW_PRODUCTIVITY_KEYS.excavationM3, "m3"],
  ["40 h/m² persists", RW_PRODUCTIVITY_KEYS.timberFaceM2, "m2"],
  ["41 h/ea persists", RW_PRODUCTIVITY_KEYS.timberPilesEa, "ea"],
  ["42 h/lm persists", RW_PRODUCTIVITY_KEYS.masonryRebarLm, "lm"],
  ["43 h/hole persists", RW_PRODUCTIVITY_KEYS.sleeperConcreteHole, "hole"],
] as const) {
  const saved = findCompanyProductivityRate([testRate(key, unit, 0.25, "productivity")], key, unit);
  check(
    label,
    RW_PRODUCTIVITY_UNITS[key] === unit &&
      saved?.cost_rate === 0.25 &&
      FULL_RATE_CATALOGUE.some((row) => row.item_key === key)
  );
}
const pileHours1 = pileLab?.baseHours ?? 0;
const faceHours1 = faceLab?.baseHours ?? 0;
const timberPileOnly = com(timberLevel, "Timber", [
  ...timberRates().filter((row) => row.item_key !== RW_PRODUCTIVITY_KEYS.timberPilesEa),
  testRate(RW_PRODUCTIVITY_KEYS.timberPilesEa, "ea", 0.9, "productivity"),
]);
check(
  "44 productivity change only matching hours",
  near(lab(timberPileOnly.requirements, RW_TIMBER_PILE_LABOUR_COMPONENT)?.baseHours ?? 0, 9) &&
    near(lab(timberPileOnly.requirements, RW_TIMBER_FACE_LABOUR_COMPONENT)?.baseHours ?? 0, faceHours1) &&
    pileHours1 !== 9
);
const timberLabour90 = com(timberLevel, "Timber", [
  ...timberRates().filter((row) => row.item_key !== "labour.carpenter.hour"),
  testRate("labour.carpenter.hour", "hour", 90, "labour"),
]);
check(
  "45 labour $/hr changes dollars not hours",
  near(lab(timberLabour90.requirements, RW_TIMBER_PILE_LABOUR_COMPONENT)?.baseHours ?? 0, pileHours1) &&
    (lab(timberLabour90.requirements, RW_TIMBER_PILE_LABOUR_COMPONENT)?.totalCost ?? 0) >
      (pileLab?.totalCost ?? 0)
);

console.log("\n--- COMMERCIAL ---\n");
check(
  "46 no economic hole",
  mat(timberA.requirements, RW_TIMBER_FIXINGS_COMPONENT) != null &&
    timberA.residualClass === RW_TIMBER_FIXINGS_METHOD &&
    timberA.backfillProcurement === RW_DRAINAGE_AGGREGATE_PROCUREMENT_BASIS &&
    mat(timberA.requirements, RW_TIMBER_FIXINGS_COMPONENT)?.priced === true
);
check(
  "47 no duplicate package",
  !hasPackage(timberFullCalc.lineItems) &&
    !timberFullCalc.lineItems.some((item) => item.label === "Backfill allowance") &&
    !timberFullCalc.lineItems.some((item) => item.label === "Drainage labour") &&
    timberFull.novacoilLabourOwnership === RW_TIMBER_DRAINAGE_LABOUR_OWNERSHIP
);
check(
  "48 Pricing parity copies estimate",
  estimateFull.lineItems.every((item) => {
    const copied = buildPricingItemFieldsFromEstimateLineItem({
      category: item.category,
      recommended_cost: item.recommendedCost,
      recommended_sell: item.recommendedSell,
      notes: item.notes ?? null,
    });
    return near(copied.totalCost, item.recommendedCost);
  }) &&
    !readFileSync("lib/pricing/estimate-to-pricing-adapter.ts", "utf8").includes("calculateRetainingWall")
);
check(
  "49 Quote parity copies Pricing",
  existsSync("lib/quotes/adoption-authority.ts") &&
    !readFileSync("lib/quotes/adoption-authority.ts", "utf8").includes("calculateRetainingWall")
);
const deckSrc = readFileSync("lib/estimate/calculators/deck.ts", "utf8");
check(
  "50 current Deck unchanged",
  deckSrc.includes("adaptPricedMaterialRequirementWithoutLegacy") &&
    !deckSrc.includes("commercializeRetainingWall")
);

console.log("\n--- FIXTURES ---\n");
check(
  "51 RW-TIMBER-01 no-rate uses Timber 1D starters",
  timberPhysicalReady(timberPhys) &&
    timberA.mode === "DETAILED_COMPONENT_AUTHORITY" &&
    timberA.physicalMode === "DETAILED_PHYSICAL_MODEL" &&
    mat(timberA.requirements, RW_TIMBER_PILES_EA_COMPONENT)?.purchaseQuantity === 10 &&
    near(mat(timberA.requirements, RW_TIMBER_PILES_LM_COMPONENT)?.purchaseQuantity ?? 0, 15) &&
    mat(timberA.requirements, RW_NOVACOIL_COMPONENT)?.purchaseQuantity === 10 &&
    near(mat(timberA.requirements, RW_BACKFILL_COMPONENT)?.baseQuantity ?? 0, 2.55) &&
    stockPriced(timberA.requirements)
);
check(
  "52 RW-TIMBER-01 selective-rate stays detailed",
  mat(timberSelective.requirements, RW_TIMBER_BOARDS_COMPONENT)?.priced === true &&
    stockPriced(timberSelective.requirements) &&
    timberSelective.mode === "DETAILED_COMPONENT_AUTHORITY" &&
    hasDetailedMoney(timberSelectiveCalc.lineItems)
);
const boardsFull = mat(timberFull.requirements, RW_TIMBER_BOARDS_COMPONENT);
check(
  "53 RW-TIMBER-01 full TEST rate",
  boardsFull?.priced === true &&
    near(boardsFull.totalCost ?? 0, (boardsFull.purchaseQuantity ?? 0) * TEST_BOARD) &&
    pileLab?.priced === true &&
    near(pileLab.totalCost ?? 0, 10 * TEST_PILE_H * TEST_LABOUR)
);
const slopePhys = phys(timberSlope, "Timber");
const slopeCom = com(timberSlope, "Timber", timberRates());
check(
  "54 RW-TIMBER-SLOPE",
  slopePhys.geometry?.faceAreaM2 === 10 &&
    (slopePhys.timberPiles?.lengthsM[0] ?? 0) !==
      (slopePhys.timberPiles?.lengthsM.at(-1) ?? 0) &&
    mat(slopeCom.requirements, RW_TIMBER_PILES_LM_COMPONENT)?.purchaseQuantity ===
      slopePhys.timberPiles?.totalLengthM &&
    mat(slopeCom.requirements, RW_TIMBER_BOARDS_COMPONENT)?.purchaseQuantity ===
      mat(timberA.requirements, RW_TIMBER_BOARDS_COMPONENT)?.purchaseQuantity
);
check(
  "55 RW-SLEEPER",
  mat(sleeperCalcA.requirements, RW_SLEEPER_COMPONENT)?.purchaseQuantity === 25 &&
    mat(sleeperCalcA.requirements, RW_SLEEPER_POSTS_EA_COMPONENT)?.purchaseQuantity === 6 &&
    (sleeperPhys.sleeperTakeoff?.holeVolumeM3 ?? 0) > 0
);
check(
  "56 RW-MASONRY unresolved rebar Pricing Required",
  near(mat(masonryA.requirements, RW_MASONRY_BLOCKS_COMPONENT)?.baseQuantity ?? 0, 125) &&
    mat(masonryA.requirements, RW_MASONRY_BLOCKS_COMPONENT)?.purchaseQuantity ===
      masonryPurchaseBlocks &&
    near(mat(masonryA.requirements, RW_MASONRY_FOOTING_COMPONENT)?.purchaseQuantity ?? 0, 1) &&
    near(mat(masonryA.requirements, RW_MASONRY_SUBBASE_COMPONENT)?.purchaseQuantity ?? 0, 0.4) &&
    near(mat(masonryA.requirements, RW_MASONRY_CORE_COMPONENT)?.purchaseQuantity ?? 0, 1) &&
    masonryA.gaps.includes(RW_REBAR_GAP)
);

console.log("\n--- USEFUL ---\n");
check(
  "useful: H5 SED is not a house pile",
  H5_SED_POLE_IDENTITY.productFamily === "sed_pole" && identitiesSrc.includes("not a deck house pile")
);
check("useful: package lifecycle constant", RW_PACKAGE_LIFECYCLE.includes("INSUFFICIENT_PHYSICAL_MODEL"));
check(
  "useful: unspecified concrete stays package",
  hasPackage(unspecifiedCalc.lineItems)
);
check(
  "useful: timber without drainage fact assumes drainage and stays detailed",
  !hasPackage(calculateRetainingWall(ctx(timberNoDrainage), wa()).lineItems) &&
    hasDetailedMoney(calculateRetainingWall(ctx(timberNoDrainage), wa()).lineItems)
);
check(
  "useful: empty-rate Quick Estimate is not blocked by detailed pricing gaps",
  sellOf(timberCalcA.lineItems) > 0
);
check(
  "useful: 1D detailed assumptions stay builder-facing",
  timberCalcA.assumptions.some((row) => row.includes("Timber residual method")) &&
    !timberCalcA.assumptions.some((row) => row.includes("SHADOW"))
);
check(
  "useful: Quick Estimate package note is builder-facing",
  RW_QUICK_ESTIMATE_PACKAGE_NOTE.includes("Quick Estimate") &&
    !RW_QUICK_ESTIMATE_PACKAGE_NOTE.includes("SHADOW")
);
check(
  "useful: no invented catalogue NZD",
  !catalogueSrc.includes("cost_rate: 12") &&
    RETAINING_WALL_PRODUCTIVITY_RATE_CATALOGUE.every((row) => row.rate_type === "productivity")
);
check("useful: calculator does not embed PRICING_REQUIRED token", !calcSrc.includes("PRICING_REQUIRED"));
check(
  "useful: no second commercial engine",
  commercialSrc.includes("resolveStructuralMaterialRequirementRate") &&
    commercialSrc.includes("findCompanyProductivityRate") &&
    commercialSrc.includes("resolveLabourRate")
);
const review = composeBuilderReview({
  estimate: {
    recommendedCost: estimateFull.recommendedCost,
    recommendedSell: estimateFull.recommendedSell,
    marginPercent: estimateFull.marginPercent,
    confidence: estimateFull.confidence,
    assumptions: estimateFull.assumptions,
    missingInfo: estimateFull.missingInfo,
    lineItems: estimateFull.lineItems as never,
  },
  workAreas: [wa()],
  requirements: estimateFull.requirements,
});
check(
  "useful: Builder Review renders",
  review.workAreas.length > 0 && review.takeoffAffectsMoney === false
);
check(
  "useful: coverage strings preserved",
  coverageSrc.includes("SAFETY HARDENED") &&
    coverageSrc.includes("RATE AUTHORITY FIXED") &&
    coverageSrc.includes("FOUNDATION COMPLETE") &&
    coverageSrc.includes("still MINIMAL") &&
    coverageSrc.includes("UNSUPPORTED_EXPLICIT") &&
    coverageSrc.includes("RW-UNSUPPORTED-MATERIAL-PRICING-01")
);
const rw2 = calculateEstimate({
  ...ctx(
    [
      fact("retaining_wall.length_m", 10, "rw2"),
      fact("retaining_wall.height_m", 1, "rw2"),
      fact("retaining_wall.is_raking", false, "rw2"),
      fact("retaining_wall.fixing_type", "Standard", "rw2"),
      fact("retaining_wall.material", "Timber", "rw2"),
      fact("retaining_wall.drainage_required", true, "rw2"),
      fact("retaining_wall.backfill_included", true, "rw2"),
      fact("retaining_wall.backfill_depth_m", 0.3, "rw2"),
      fact("retaining_wall.backfill_length_m", 10, "rw2"),
      fact("retaining_wall.backfill_height_m", 1, "rw2"),
    ],
    []
  ),
  confirmedWorkAreas: [wa("rw2")],
} as never);
check(
  "useful: RW-2 empty-rate is detailed (package $7,345 retired for covered Timber)",
  rw2.recommendedSell > 0 &&
    !rw2.lineItems.some((item) => item.label === "Retaining wall materials")
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
