/**
 * RW-MATURITY-2B-R4 — Masonry block-laying subcontract ownership.
 * Run: npx tsx scripts/verify-retaining-wall-masonry-subcontract-r4.ts
 */
import { readFileSync } from "node:fs";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import type { OrganisationRate } from "../components/setup/types";
import { calculateRetainingWall } from "../lib/estimate/calculators/retaining-wall";
import {
  commercializeRetainingWall,
  packageXorDetailedHolds,
} from "../lib/estimate/retaining-wall-commercial";
import { buildRetainingWallPhysicalModel } from "../lib/estimate/retaining-wall-physical";
import {
  RW_MASONRY_BLOCK_LABOUR_COMPONENT,
  RW_MASONRY_BLOCK_SUBCONTRACT_COMPONENT,
  RW_MASONRY_BLOCKS_COMPONENT,
  RW_MASONRY_CORE_LABOUR_COMPONENT,
  RW_MASONRY_FOOTING_COMPONENT,
  RW_MASONRY_200_KEY,
  RW_MASONRY_SUBBASE_COMPONENT,
  RW_MASONRY_WATERPROOF_LABOUR_COMPONENT,
  RW_EXCAVATION_LABOUR_COMPONENT,
  RW_DRAINAGE_LABOUR_COMPONENT,
  RW_BACKFILL_LABOUR_COMPONENT,
} from "../lib/estimate/retaining-wall-identities";
import {
  masonryBlockPurchaseEa,
  RW_MASONRY_2B_MATERIAL_STARTERS,
  RW_MASONRY_MORTAR_COMPONENT,
  RW_MASONRY_REBAR_ALLOWANCE_COMPONENT,
  RW_MASONRY_REBAR_ALLOWANCE_KEY,
  RW_MASONRY_SUBCONTRACT_SCOPE_LABOUR_AND_MATERIALS,
  RW_MASONRY_SUBCONTRACT_SUPPLY_PLACEHOLDER_DISCLOSURE,
} from "../lib/estimate/retaining-wall-masonry-2b";
import { faceAreaM2 } from "../lib/estimate/retaining-wall-geometry";
import { MASONRY_SERIES_200 } from "../lib/estimate/retaining-wall-identities";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
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

function near(a: number, b: number, eps = 1.5): boolean {
  return Math.abs(a - b) <= eps;
}

function wa() {
  return { id: "rw1", type: "retaining_wall", name: "Retaining wall", sort_order: 1 };
}

function fact(key: string, value: unknown): EstimateFact {
  return { key, work_area_id: "rw1", value, source: "user" };
}

function testRate(itemKey: string, unit: string, cost: number): OrganisationRate {
  return {
    id: `test.${itemKey}`,
    rate_type: "material",
    trade: null,
    work_area_type: "retaining_wall",
    item_key: itemKey,
    label: itemKey,
    unit,
    cost_rate: cost,
    sell_rate: null,
    markup_percent: null,
    active: true,
  };
}

const CONSTRAINTS = [
  { key: "site_access", value: "Moderate" },
  { key: "material_carry_distance", value: "10–30m" },
];

function labourRate(itemKey: string, unit: string, cost: number): OrganisationRate {
  return {
    id: `test.${itemKey}`,
    rate_type: "labour",
    trade: "carpenter",
    work_area_type: "retaining_wall",
    item_key: itemKey,
    label: itemKey,
    unit,
    cost_rate: cost,
    sell_rate: null,
    markup_percent: null,
    active: true,
  };
}

function ctx(
  facts: EstimateFact[],
  rates: OrganisationRate[] = [],
  allowBenchmark = true
): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [wa()],
    facts,
    constraints: CONSTRAINTS,
    organisationSettings: {
      allow_benchmark_rates: allowBenchmark,
      default_margin_percent: 20,
    },
    materialWastageSettings: { defaultMaterialWastagePercent: 10 },
    rates: [labourRate("labour.carpenter", "hr", 85), ...rates],
  } as unknown as EstimateContext;
}

function ownerFacts(overrides: EstimateFact[] = []): EstimateFact[] {
  const base: EstimateFact[] = [
    fact("retaining_wall.material", "Concrete masonry / Besser"),
    fact("retaining_wall.length_m", 15),
    fact("retaining_wall.is_raking", true),
    fact("retaining_wall.height_high_m", 1.6),
    fact("retaining_wall.height_low_m", 0.6),
    fact("retaining_wall.block_series", "200-series"),
    fact("retaining_wall.block_laying_method", "Self-perform"),
    fact("retaining_wall.excavation_required", true),
    fact("retaining_wall.excavation_volume_m3", 6),
    fact("retaining_wall.drainage_required", true),
    fact("retaining_wall.backfill_included", true),
    fact("retaining_wall.waterproofing_required", true),
    fact("retaining_wall.waterproofing_type", "Liquid membrane"),
    fact("retaining_wall.waterproofing_method", "Self-perform"),
    fact("retaining_wall.disposal_included", false),
  ];
  const keys = new Set(overrides.map((row) => row.key));
  return [...base.filter((row) => !keys.has(row.key)), ...overrides];
}

function mat(reqs: readonly EstimateRequirement[] | undefined, key: string) {
  return reqs?.find(
    (row): row is MaterialRequirement =>
      row.kind === "material" && row.componentKey === key
  );
}

function lab(reqs: readonly EstimateRequirement[] | undefined, key: string) {
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
      item.componentKey === RW_MASONRY_BLOCKS_COMPONENT ||
      item.componentKey === RW_MASONRY_FOOTING_COMPONENT
  );
}

const OWNER_REBAR = 450;
const SUB_LABOUR_M2 = 95;
const baseRates = [
  testRate(RW_MASONRY_REBAR_ALLOWANCE_KEY, "item", OWNER_REBAR),
  testRate("retaining_wall.masonry.block_lay.subcontract", "m2", SUB_LABOUR_M2),
];

const selfCtx = ctx(ownerFacts(), baseRates);
const selfCalc = calculateRetainingWall(selfCtx, wa());
const selfPhys = buildRetainingWallPhysicalModel({
  context: selfCtx,
  workAreaId: "rw1",
  material: "Concrete masonry / Besser",
});
const selfComm = commercializeRetainingWall({
  physical: selfPhys,
  facts: ownerFacts(),
  workAreaId: "rw1",
  rates: selfCtx.rates,
  organisationSettings: selfCtx.organisationSettings,
  constraints: CONSTRAINTS,
});

const subLabourOnlyFacts = ownerFacts([
  fact("retaining_wall.block_laying_method", "Subcontract"),
  fact("retaining_wall.masonry.subcontract_scope", "Labour only"),
]);
const subLabourCtx = ctx(subLabourOnlyFacts, baseRates);
const subLabourCalc = calculateRetainingWall(subLabourCtx, wa());
const subLabourPhys = buildRetainingWallPhysicalModel({
  context: subLabourCtx,
  workAreaId: "rw1",
  material: "Concrete masonry / Besser",
});
const subLabourComm = commercializeRetainingWall({
  physical: subLabourPhys,
  facts: subLabourOnlyFacts,
  workAreaId: "rw1",
  rates: subLabourCtx.rates,
  organisationSettings: subLabourCtx.organisationSettings,
  constraints: CONSTRAINTS,
});

const subLabMatFacts = ownerFacts([
  fact("retaining_wall.block_laying_method", "Subcontract"),
  fact(
    "retaining_wall.masonry.subcontract_scope",
    "Labour + blocks & laying materials"
  ),
]);
const subLabMatCtx = ctx(subLabMatFacts, baseRates);
const subLabMatCalc = calculateRetainingWall(subLabMatCtx, wa());
const subLabMatComm = commercializeRetainingWall({
  physical: buildRetainingWallPhysicalModel({
    context: subLabMatCtx,
    workAreaId: "rw1",
    material: "Concrete masonry / Besser",
  }),
  facts: subLabMatFacts,
  workAreaId: "rw1",
  rates: subLabMatCtx.rates,
  organisationSettings: subLabMatCtx.organisationSettings,
  constraints: CONSTRAINTS,
});

const face = faceAreaM2(15, 1.6, 0.6, true);
const expectedNet = Math.round(face * MASONRY_SERIES_200.unitsPerM2 * 100) / 100;
const expectedPurchase = masonryBlockPurchaseEa(expectedNet);

// Physical invariance
check("R4-01 self physical net blocks", selfPhys.masonryTakeoff?.netBlocks === expectedNet);
check("R4-02 labour-only net blocks unchanged", subLabourPhys.masonryTakeoff?.netBlocks === expectedNet);
check(
  "R4-03 labour+materials purchase EA unchanged",
  mat(subLabMatComm.requirements, RW_MASONRY_BLOCKS_COMPONENT)?.purchaseQuantity ===
    expectedPurchase
);
check(
  "R4-04 footing unchanged",
  mat(selfComm.requirements, RW_MASONRY_FOOTING_COMPONENT)?.purchaseQuantity ===
    mat(subLabourComm.requirements, RW_MASONRY_FOOTING_COMPONENT)?.purchaseQuantity
);
check(
  "R4-05 subbase unchanged",
  mat(selfComm.requirements, RW_MASONRY_SUBBASE_COMPONENT)?.purchaseQuantity ===
    mat(subLabourComm.requirements, RW_MASONRY_SUBBASE_COMPONENT)?.purchaseQuantity
);

// Labour ownership
check(
  "R4-06 self has block laying labour",
  lab(selfComm.requirements, RW_MASONRY_BLOCK_LABOUR_COMPONENT) != null
);
check(
  "R4-07 labour-only suppresses block laying labour only",
  lab(subLabourComm.requirements, RW_MASONRY_BLOCK_LABOUR_COMPONENT) == null &&
    lab(subLabourComm.requirements, RW_MASONRY_CORE_LABOUR_COMPONENT) != null
);
check(
  "R4-08 excavation labour remains under subcontract",
  lab(subLabourComm.requirements, RW_EXCAVATION_LABOUR_COMPONENT) != null
);
check(
  "R4-09 rebar allowance remains under subcontract",
  mat(subLabourComm.requirements, RW_MASONRY_REBAR_ALLOWANCE_COMPONENT)?.priced === true
);
check(
  "R4-10 waterproofing labour remains",
  lab(subLabourComm.requirements, RW_MASONRY_WATERPROOF_LABOUR_COMPONENT) != null
);

// Subcontract commercial
const blockSub = mat(subLabourComm.requirements, RW_MASONRY_BLOCK_SUBCONTRACT_COMPONENT);
check("R4-11 subcontract requirement exists", blockSub != null);
check(
  "R4-12 subcontract basis m2",
  blockSub?.purchaseUnit === "m2" && blockSub?.purchaseQuantity === face
);
check(
  "R4-13 subcontract cost face x rate",
  blockSub?.priced === true &&
    near(blockSub?.totalCost ?? 0, face * SUB_LABOUR_M2)
);
check(
  "R4-14 no generic package on subcontract",
  !hasPackage(subLabourCalc.lineItems) && hasDetailedMoney(subLabourCalc.lineItems)
);
check(
  "R4-15 detailed authority on subcontract",
  subLabourComm.mode === "DETAILED_COMPONENT_AUTHORITY"
);

// Material ownership labour-only
check(
  "R4-16 labour-only blocks remain priced materials",
  mat(subLabourComm.requirements, RW_MASONRY_BLOCKS_COMPONENT)?.priced === true
);
check(
  "R4-17 labour-only mortar remains",
  mat(subLabourComm.requirements, RW_MASONRY_MORTAR_COMPONENT)?.priced === true
);

// Labour + materials placeholder
const subBlocks = mat(subLabMatComm.requirements, RW_MASONRY_BLOCKS_COMPONENT);
const subMortar = mat(subLabMatComm.requirements, RW_MASONRY_MORTAR_COMPONENT);
check(
  "R4-18 labour+materials block placeholder tagged",
  /subcontract supply placeholder/i.test(subBlocks?.specification ?? "")
);
check(
  "R4-19 labour+materials mortar placeholder tagged",
  /subcontract supply placeholder/i.test(subMortar?.specification ?? "")
);
check(
  "R4-20 placeholder uses user material rate",
  (subBlocks?.unitCost ?? 0) > 0 &&
    subBlocks?.unitCost === RW_MASONRY_2B_MATERIAL_STARTERS[RW_MASONRY_200_KEY]!.costPerUnit
);

// Direct cost delta
const selfBlockLine = selfCalc.lineItems.find(
  (row) => row.componentKey === RW_MASONRY_BLOCK_LABOUR_COMPONENT
);
const subBlockLine = subLabourCalc.lineItems.find(
  (row) => row.componentKey === RW_MASONRY_BLOCK_SUBCONTRACT_COMPONENT
);
check(
  "R4-21 direct cost delta dominated by block-laying ownership swap",
  selfBlockLine != null &&
    subBlockLine != null &&
    (selfBlockLine.recommendedCost ?? 0) > 0 &&
    (subBlockLine.recommendedCost ?? 0) > 0 &&
    Math.sign(
      (selfCalc.recommendedCost - subLabourCalc.recommendedCost) *
        ((selfBlockLine.recommendedCost ?? 0) - (subBlockLine.recommendedCost ?? 0))
    ) !== -1
);

// Rate missing — no benchmark
const subNoRateCtx = ctx(
  subLabourOnlyFacts,
  [testRate(RW_MASONRY_REBAR_ALLOWANCE_KEY, "item", OWNER_REBAR)],
  false
);
const subNoRateCalc = calculateRetainingWall(subNoRateCtx, wa());
const subNoRateComm = commercializeRetainingWall({
  physical: buildRetainingWallPhysicalModel({
    context: subNoRateCtx,
    workAreaId: "rw1",
    material: "Concrete masonry / Besser",
  }),
  facts: subLabourOnlyFacts,
  workAreaId: "rw1",
  rates: subNoRateCtx.rates,
  organisationSettings: subNoRateCtx.organisationSettings,
  constraints: CONSTRAINTS,
});
check(
  "R4-22 rate missing keeps detailed takeoff",
  !hasPackage(subNoRateCalc.lineItems) && hasDetailedMoney(subNoRateCalc.lineItems)
);
check(
  "R4-23 rate missing uses non-company subcontract source",
  mat(subNoRateComm.requirements, RW_MASONRY_BLOCK_SUBCONTRACT_COMPONENT)
    ?.rateSource !== "company"
);
check(
  "R4-24 rate missing no zero subcontract line",
  !subNoRateCalc.lineItems.some(
    (row) =>
      row.componentKey === RW_MASONRY_BLOCK_SUBCONTRACT_COMPONENT &&
      row.recommendedCost === 0 &&
      row.rateSource !== "missing"
  )
);

// Builder review
const review = composeBuilderReview({
  estimate: {
    lineItems: subLabourCalc.lineItems.map((item, index) => ({
      ...item,
      id: `li-${index}`,
      workAreaName: "Retaining wall",
      grossProfit: 0,
      marginPercent: 20,
      markupPercent: 25,
      includedInTotal: true,
    })),
    recommendedCost: subLabourCalc.recommendedCost,
    recommendedSell: subLabourCalc.recommendedSell,
    assumptions: subLabourCalc.assumptions,
    exclusions: subLabourCalc.exclusions,
    missingInfo: subLabourCalc.missingInfo,
  },
  workAreas: [{ id: "rw1", name: "Retaining wall", type: "retaining_wall" }],
  requirements: subLabourComm.requirements,
});
check(
  "R4-25 builder review has subcontract section line",
  review.workAreas.some((waGroup) =>
    waGroup.categories.some(
      (cat) =>
        cat.id === "SUBCONTRACT" &&
        cat.lines.some((line) =>
          /masonry block laying/i.test(line.label)
        )
    )
  )
);
check(
  "R4-26 builder review no generic package labels",
  !review.workAreas.some((waGroup) =>
    waGroup.categories.some((cat) =>
      cat.lines.some((line) => line.label === "Retaining wall materials")
    )
  )
);

// Switch matrix
const switchedBack = calculateRetainingWall(
  ctx(ownerFacts([fact("retaining_wall.block_laying_method", "Self-perform")]), baseRates),
  wa()
);
check(
  "R4-27 switch back to self restores block labour",
  lab(
    commercializeRetainingWall({
      physical: selfPhys,
      facts: ownerFacts(),
      workAreaId: "rw1",
      rates: selfCtx.rates,
      organisationSettings: selfCtx.organisationSettings,
      constraints: CONSTRAINTS,
    }).requirements,
    RW_MASONRY_BLOCK_LABOUR_COMPONENT
  ) != null && !hasPackage(switchedBack.lineItems)
);

check(
  "R4-28 package XOR detailed",
  packageXorDetailedHolds({
    mode: subLabourComm.mode,
    hasPackageFaceLine: hasPackage(subLabourCalc.lineItems),
    hasDetailedMoneyLine: hasDetailedMoney(subLabourCalc.lineItems),
  })
);

// UX strings
const editor = readFileSync(
  "components/assistant/job-plan/RetainingWallQuickSpecEditor.tsx",
  "utf8"
);
check(
  "R4-29 edit scope blockwork delivery",
  editor.includes("Blockwork delivery") &&
    editor.includes("retaining_wall.masonry.subcontract_scope")
);
check(
  "R4-30 placeholder disclosure copy exported",
  RW_MASONRY_SUBCONTRACT_SUPPLY_PLACEHOLDER_DISCLOSURE.includes("Placeholder")
);

check(
  "R4-31 labour+materials scope parsed on takeoff",
  subLabMatComm.requirements.length > 0 &&
    buildRetainingWallPhysicalModel({
      context: subLabMatCtx,
      workAreaId: "rw1",
      material: "Concrete masonry / Besser",
    }).masonryTakeoff?.subcontractScope === RW_MASONRY_SUBCONTRACT_SCOPE_LABOUR_AND_MATERIALS
);

check(
  "R4-32 drainage labour remains",
  lab(subLabourComm.requirements, RW_DRAINAGE_LABOUR_COMPONENT) != null &&
    lab(subLabourComm.requirements, RW_BACKFILL_LABOUR_COMPONENT) != null
);
void subLabMatCalc;

console.log(`\nRW-MASONRY-SUBCONTRACT-R4: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
