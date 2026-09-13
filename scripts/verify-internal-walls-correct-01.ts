/**
 * INTERNAL-WALLS-CORRECT-01 — lining quantity / labour / fixings correctness.
 *
 * Run: npx --yes tsx scripts/verify-internal-walls-correct-01.ts
 *
 * No Production. No merge to main.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deriveSellFromCost } from "../lib/commercial-engine/core/sell-from-margin";
import { calculateInternalWalls } from "../lib/estimate/calculators/fitout";
import {
  applyExtractedInternalWallsToFacts,
  COORDINATION_ORIGINAL_BRIEF,
  extractInternalWallsTypesFromBrief,
} from "../lib/estimate/internal-walls-brief";
import {
  INTERNAL_WALLS_ADD_OPENING_KEY,
  INTERNAL_WALLS_HAS_OPENINGS_KEY,
  sumOpeningAreaM2,
} from "../lib/estimate/internal-walls-openings";
import {
  INTERNAL_WALLS_JOB_SCOPE_FACT_KEY,
  INTERNAL_WALLS_STRUCTURAL_FACT_KEY,
} from "../lib/estimate/internal-walls-scope";
import {
  applyInternalWallsFactWrite,
  resolveInternalWallsWallTypes,
} from "../lib/estimate/internal-walls-wall-types";
import {
  INTERNAL_WALLS_AQUALINE_13_2400_KEY,
  INTERNAL_WALLS_CARPENTER_LABOUR_KEY,
  INTERNAL_WALLS_FRAMING_FIXINGS_COMPONENT,
  INTERNAL_WALLS_FRAMING_FIXINGS_COST_PER_M2,
  INTERNAL_WALLS_FRAMING_90_MATERIAL_COMPONENT,
  INTERNAL_WALLS_LINING_HOURS_PER_SHEET,
  INTERNAL_WALLS_PLASTERBOARD_SHEET_WIDTH_MM,
  INTERNAL_WALLS_STANDARD_13_2400_KEY,
  internalWallsLiningLabourComponent,
  internalWallsLiningMaterialComponent,
} from "../lib/estimate/internal-walls-identities";
import { aggregateInternalWallsLiningPurchaseSheets } from "../lib/estimate/internal-walls-lining";
import { getCatalogueEntry } from "../lib/rates/catalogue";
import { resolveLabourRate } from "../lib/estimate/rates";
import { calculateAuthoritativeFieldsFromEstimateLine } from "../lib/pricing/estimate-to-pricing-adapter";
import { mapPricingItemsToQuoteItems } from "../lib/quotes/from-pricing";
import type { OrganisationRate } from "../components/setup/types";
import type { PricingItem } from "../lib/pricing/types";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";
import type { LabourRequirement, MaterialRequirement } from "../lib/estimate/requirements";

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

function near(actual: number | null | undefined, expected: number, tol = 0.02): boolean {
  return actual != null && Number.isFinite(actual) && Math.abs(actual - expected) <= tol;
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function wa(): EstimateWorkArea {
  return { id: "w1", type: "internal_walls", name: "Internal walls", sort_order: 1 };
}

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

function labourRate(cost: number, sell: number | null): OrganisationRate {
  return {
    id: INTERNAL_WALLS_CARPENTER_LABOUR_KEY,
    rate_type: "labour",
    trade: "carpenter",
    work_area_type: "internal_walls",
    item_key: INTERNAL_WALLS_CARPENTER_LABOUR_KEY,
    label: "Carpenter",
    unit: "hour",
    cost_rate: cost,
    sell_rate: sell,
    markup_percent: null,
    active: true,
  };
}

function ctx(params: {
  facts: EstimateFact[];
  rates?: OrganisationRate[];
  margin?: number;
}): EstimateContext {
  return {
    project: { id: "iw-correct-01", qualityLevel: "standard" },
    confirmedWorkAreas: [wa()],
    facts: params.facts,
    constraints: [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: params.margin ?? 20,
      budget_rate_factor: 0.9,
      premium_rate_factor: 1.15,
    },
    materialWastageSettings: {
      defaultMaterialWastagePercent: 10,
      timberFramingWastagePercent: 10,
      sheetMaterialWastagePercent: 10,
    },
    rates: params.rates ?? [],
  } as unknown as EstimateContext;
}

function fixtureFacts(extra: EstimateFact[] = []): EstimateFact[] {
  const types = extractInternalWallsTypesFromBrief(COORDINATION_ORIGINAL_BRIEF);
  return applyExtractedInternalWallsToFacts({
    facts: [
      fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "mixed"),
      fact(INTERNAL_WALLS_STRUCTURAL_FACT_KEY, "w1", "No"),
      ...extra,
    ],
    workAreaId: "w1",
    types,
  });
}

function mats(result: ReturnType<typeof calculateInternalWalls>): MaterialRequirement[] {
  return (result.requirements ?? []).filter(
    (row): row is MaterialRequirement => row.kind === "material"
  );
}

function labs(result: ReturnType<typeof calculateInternalWalls>): LabourRequirement[] {
  return (result.requirements ?? []).filter(
    (row): row is LabourRequirement => row.kind === "labour"
  );
}

function liningMats(
  result: ReturnType<typeof calculateInternalWalls>,
  product: "standard_gib" | "aqualine"
): MaterialRequirement[] {
  return mats(result).filter(
    (row) => row.componentKey === internalWallsLiningMaterialComponent(product)
  );
}

function liningLabs(
  result: ReturnType<typeof calculateInternalWalls>,
  product: "standard_gib" | "aqualine"
): LabourRequirement[] {
  return labs(result).filter(
    (row) => row.componentKey === internalWallsLiningLabourComponent(product)
  );
}

function byType<T extends { variantKey?: string }>(rows: readonly T[], typeId: string): T[] {
  return rows.filter((row) => (row.variantKey ?? "").startsWith(`${typeId}`));
}

function gm20(cost: number): number {
  return deriveSellFromCost(cost, 20);
}

const walls = wa();
const SHEET_WIDTH_M = INTERNAL_WALLS_PLASTERBOARD_SHEET_WIDTH_MM / 1000;
const LINEAR_TYPE1_PER_FACE = 9 / SHEET_WIDTH_M;
const CEIL_TYPE1_PER_FACE = Math.ceil(LINEAR_TYPE1_PER_FACE - 1e-12);
const TYPE1_PURCHASE_PER_FACE = Math.ceil(CEIL_TYPE1_PER_FACE * 1.1 - 1e-12);
const TYPE2_CEIL = Math.ceil(3 / SHEET_WIDTH_M - 1e-12);
const TYPE2_PURCHASE = Math.ceil(TYPE2_CEIL * 1.1 - 1e-12);

console.log("=== INTERNAL-WALLS-CORRECT-01 lining / labour / fixings ===\n");

check(
  "fixture wording is exact",
  COORDINATION_ORIGINAL_BRIEF ===
    "I am renovating a house and removing 3 internal walls, I need to rebuild the walls completely. 2 of the walls are 45x90 framed timber with 13mm standard GIB on both sides (they total 9m long and are 2.4m high), and the other wall is 45x90 framed timber with 13mm standard GIB on one side and 13mm aqualine on the otherside (this wall is 3m long and 2.4m high)"
);

const facts = fixtureFacts();
const resolved = resolveInternalWallsWallTypes({ facts, workAreaId: "w1" });
const type1 = resolved.types[0]!;
const type2 = resolved.types[1]!;
const result = calculateInternalWalls(ctx({ facts }), walls);

check("one Internal Walls instance / two wall types", resolved.types.length === 2);
check(
  "Wall Type 1 2 walls / 9m / 2.4m / 45x90 / Standard both sides",
  type1.wall_count === 2 &&
    type1.length_lm === 9 &&
    type1.height_m === 2.4 &&
    type1.frame_system === "timber" &&
    type1.frame_size === "90x45" &&
    type1.same_lining_both_sides === true &&
    type1.side_a.lined === true &&
    type1.side_b.lined === true &&
    type1.side_a.product === "standard_gib" &&
    type1.side_b.product === "standard_gib"
);
check(
  "Wall Type 2 1 wall / 3m / mixed Standard + Aqualine",
  type2.wall_count === 1 &&
    type2.length_lm === 3 &&
    type2.same_lining_both_sides === false &&
    type2.side_a.product === "standard_gib" &&
    type2.side_b.product === "aqualine"
);
check("job_scope mixed", facts.some((row) => row.key === INTERNAL_WALLS_JOB_SCOPE_FACT_KEY && row.value === "mixed"));

const t1Std = byType(liningMats(result, "standard_gib"), type1.id);
const t2Std = byType(liningMats(result, "standard_gib"), type2.id);
const t2Aq = byType(liningMats(result, "aqualine"), type2.id);
const t1Lab = byType(liningLabs(result, "standard_gib"), type1.id);
const t2StdLab = byType(liningLabs(result, "standard_gib"), type2.id);
const t2AqLab = byType(liningLabs(result, "aqualine"), type2.id);

console.log("\n--- A/B both faces ---\n");
check("A Wall Type 1 both faces counted", t1Std.length === 2);
check(
  "B Wall Type 1 9m each side → 18 face-lm",
  t1Std.length === 2 &&
    t1Std.every((row) => /9 × 2\.4 m/.test(row.specification ?? "")) &&
    near((type1.length_lm ?? 0) * 2, 18)
);
check(
  "A gross face area 21.6 m² per side / 43.2 m² total",
  t1Std.every((row) => /21\.6 m² gross/.test(row.specification ?? ""))
);

console.log("\n--- C/D sheet takeoff + waste once ---\n");
check(
  "C linear width model is 7.5 sheets per side → 15 both faces",
  near(LINEAR_TYPE1_PER_FACE, 7.5) && near(LINEAR_TYPE1_PER_FACE * 2, 15)
);
check(
  "C current ceil policy is 8 sheets per face / 16 both faces before waste",
  t1Std.every((row) => near(row.baseQuantity, CEIL_TYPE1_PER_FACE)) &&
    near(
      t1Std.reduce((sum, row) => sum + row.baseQuantity, 0),
      16
    )
);
check(
  "D waste applied once: ceil(8 × 1.1) = 9 purchase per face, not double-wasted",
  t1Std.every((row) => near(row.purchaseQuantity, TYPE1_PURCHASE_PER_FACE) && near(row.wasteFactor, 0.1)) &&
    !t1Std.some((row) => near(row.purchaseQuantity, Math.ceil(TYPE1_PURCHASE_PER_FACE * 1.1)))
);

console.log("\n--- E/F/G mixed vs same-both-sides ---\n");
check(
  "E Wall Type 2 creates separate Standard and Aqualine requirements",
  t2Std.length === 1 &&
    t2Aq.length === 1 &&
    t2Std[0]?.materialKey === INTERNAL_WALLS_STANDARD_13_2400_KEY &&
    t2Aq[0]?.materialKey === INTERNAL_WALLS_AQUALINE_13_2400_KEY
);
check(
  "F same_lining_both_sides aggregates Standard identity without dropping a face",
  t1Std.every((row) => row.materialKey === INTERNAL_WALLS_STANDARD_13_2400_KEY) &&
    near(
      t1Std.reduce((sum, row) => sum + row.baseQuantity, 0),
      CEIL_TYPE1_PER_FACE * 2
    )
);
check(
  "G mixed faces remain separate through commercial lines",
  result.lineItems.some((row) => row.itemKey === INTERNAL_WALLS_STANDARD_13_2400_KEY) &&
    result.lineItems.some((row) => row.itemKey === INTERNAL_WALLS_AQUALINE_13_2400_KEY) &&
    t2Std[0]?.materialKey !== t2Aq[0]?.materialKey
);
check(
  "Type 2 sheet qty 3 installed / 4 purchase each face",
  near(t2Std[0]?.baseQuantity, TYPE2_CEIL) &&
    near(t2Std[0]?.purchaseQuantity, TYPE2_PURCHASE) &&
    near(t2Aq[0]?.baseQuantity, TYPE2_CEIL) &&
    near(t2Aq[0]?.purchaseQuantity, TYPE2_PURCHASE)
);

console.log("\n--- H openings still deduct ---\n");
let openingFacts = facts;
openingFacts = applyInternalWallsFactWrite({
  facts: openingFacts,
  workAreaId: "w1",
  wallTypeId: type1.id,
  key: INTERNAL_WALLS_HAS_OPENINGS_KEY,
  value: "Yes",
});
openingFacts = applyInternalWallsFactWrite({
  facts: openingFacts,
  workAreaId: "w1",
  wallTypeId: type1.id,
  key: INTERNAL_WALLS_ADD_OPENING_KEY,
  value: true,
});
openingFacts = applyInternalWallsFactWrite({
  facts: openingFacts,
  workAreaId: "w1",
  wallTypeId: type1.id,
  key: "internal_walls.opening.type",
  value: "Door opening",
});
openingFacts = applyInternalWallsFactWrite({
  facts: openingFacts,
  workAreaId: "w1",
  wallTypeId: type1.id,
  key: "internal_walls.opening.width_m",
  value: 0.81,
});
openingFacts = applyInternalWallsFactWrite({
  facts: openingFacts,
  workAreaId: "w1",
  wallTypeId: type1.id,
  key: "internal_walls.opening.height_m",
  value: 1.98,
});
const opened = resolveInternalWallsWallTypes({ facts: openingFacts, workAreaId: "w1" });
const openedType1 = opened.types.find((row) => row.id === type1.id)!;
const openingArea = sumOpeningAreaM2(openedType1.openings);
const openedCalc = calculateInternalWalls(ctx({ facts: openingFacts }), walls);
const openedStd = byType(liningMats(openedCalc, "standard_gib"), type1.id);
check(
  "H opening 0.81 × 1.98 deducts from each lined face net area",
  near(openingArea, 0.81 * 1.98) &&
    openedStd.length === 2 &&
    openedStd.every((row) =>
      (row.specification ?? "").includes("opening deduction")
    )
);
check(
  "H sheet purchase stays on the full-height sheet run",
  openedStd.every(
    (row) =>
      near(row.baseQuantity, CEIL_TYPE1_PER_FACE) &&
      near(row.purchaseQuantity, TYPE1_PURCHASE_PER_FACE)
  )
);

console.log("\n--- I/J/K lining labour ---\n");
const type1LabourHours = t1Lab.reduce((sum, row) => sum + row.baseHours, 0);
const type2LabourHours =
  t2StdLab.reduce((sum, row) => sum + row.baseHours, 0) +
  t2AqLab.reduce((sum, row) => sum + row.baseHours, 0);
check(
  "I lining labour covers both Type 1 faces",
  t1Lab.length === 2 &&
    t1Lab.every((row) => row.priced === true && near(row.productivityBasis.quantity, 8)) &&
    near(type1LabourHours, 16 * INTERNAL_WALLS_LINING_HOURS_PER_SHEET)
);
check(
  "I Type 2 labour is one Standard face + one Aqualine face",
  t2StdLab.length === 1 &&
    t2AqLab.length === 1 &&
    near(type2LabourHours, (TYPE2_CEIL + TYPE2_CEIL) * INTERNAL_WALLS_LINING_HOURS_PER_SHEET)
);

const companyLabour = calculateInternalWalls(
  ctx({ facts, rates: [labourRate(72, null)] }),
  walls
);
const companyLining = liningLabs(companyLabour, "standard_gib");
check(
  "J company labour cost rate wins when present",
  companyLining.length > 0 &&
    companyLining.every(
      (row) =>
        row.priced === true &&
        near(row.hourlyCost, 72) &&
        row.rateProvenance === "company"
    )
);

const fallbackLabour = resolveLabourRate({
  rates: [],
  organisationSettings: ctx({ facts }).organisationSettings,
});
const t1LabourLine = result.lineItems.find(
  (item) =>
    /lining labour/i.test(item.label) &&
    (item.componentKey === internalWallsLiningLabourComponent("standard_gib") ||
      /Side A lining labour/.test(item.label))
);
check(
  "K Quotr fallback labour is cost-first $60, sell from 20% GM, not 60/90",
  fallbackLabour.costRate === 60 &&
    near(fallbackLabour.sellRate, gm20(60)) &&
    fallbackLabour.sellAuthority === "derived_from_gross_margin" &&
    !near(fallbackLabour.sellRate, 90) &&
    t1Lab.every((row) => near(row.hourlyCost, 60)) &&
    t1LabourLine != null &&
    t1LabourLine.sellAuthority === "derived_from_gross_margin"
);

console.log("\n--- L/M fixings allowance ---\n");
const fixingsReqs = mats(result).filter(
  (row) => row.componentKey === INTERNAL_WALLS_FRAMING_FIXINGS_COMPONENT
);
const fixingsLines = result.lineItems.filter(
  (item) => item.componentKey === INTERNAL_WALLS_FRAMING_FIXINGS_COMPONENT
);
check(
  "L fixings allowance non-zero when applicable",
  fixingsReqs.length === 2 &&
    fixingsReqs.every((row) => row.priced === true && (row.totalCost ?? 0) > 0) &&
    near(getCatalogueEntry(INTERNAL_WALLS_FRAMING_FIXINGS_COMPONENT)?.defaultCostRate, INTERNAL_WALLS_FRAMING_FIXINGS_COST_PER_M2)
);
check(
  "L Type 1 fixings 21.6 m² × $8 = $172.80",
  near(
    byType(fixingsReqs, type1.id)[0]?.totalCost,
    21.6 * INTERNAL_WALLS_FRAMING_FIXINGS_COST_PER_M2
  )
);
check(
  "M fixings sell uses applicable margin once",
  fixingsLines.length === 2 &&
    fixingsLines.every(
      (item) =>
        near(item.costRate ?? 0, INTERNAL_WALLS_FRAMING_FIXINGS_COST_PER_M2) &&
        near(item.sellRate ?? 0, gm20(INTERNAL_WALLS_FRAMING_FIXINGS_COST_PER_M2)) &&
        item.sellAuthority === "derived_from_gross_margin"
    )
);

console.log("\n--- N provenance ---\n");
check(
  "N work_area_id / wallTypeId provenance intact",
  [...t1Std, ...t2Std, ...t2Aq, ...t1Lab, ...fixingsReqs].every(
    (row) => row.workAreaId === "w1" && Boolean(row.variantKey)
  ) &&
    t1Std.some((row) => row.variantKey === `${type1.id}:side_a`) &&
    t1Std.some((row) => row.variantKey === `${type1.id}:side_b`) &&
    t2Aq[0]?.variantKey === `${type2.id}:side_b`
);

console.log("\n--- O/P Pricing / Quote copy ---\n");
const sampleFix = fixingsLines[0]!;
const pricingFromEstimate = calculateAuthoritativeFieldsFromEstimateLine({
  id: "line-fixings",
  category: "materials",
  recommended_cost: sampleFix.recommendedCost ?? 0,
  recommended_sell: sampleFix.recommendedSell ?? 0,
  notes: sampleFix.notes ?? null,
});
check(
  "O Pricing copies corrected estimate sell",
  pricingFromEstimate.ok &&
    near(pricingFromEstimate.fields.totalCost, sampleFix.recommendedCost ?? -1) &&
    near(pricingFromEstimate.fields.totalSell, sampleFix.recommendedSell ?? -1)
);

const labourSample = result.lineItems.find((item) => /lining labour/i.test(item.label));
const labourPricing =
  labourSample == null
    ? null
    : calculateAuthoritativeFieldsFromEstimateLine({
        id: "line-lining-labour",
        category: "labour",
        recommended_cost: labourSample.recommendedCost ?? 0,
        recommended_sell: labourSample.recommendedSell ?? 0,
        notes: labourSample.notes ?? null,
      });
check(
  "O lining labour Pricing copies estimate sell",
  labourSample != null &&
    labourPricing?.ok === true &&
    near(labourPricing.ok ? labourPricing.fields.totalSell : -1, labourSample.recommendedSell ?? -1)
);

const pricingItem = {
  id: "p-fixings",
  work_area_id: "w1",
  internal_label: sampleFix.label,
  client_label: sampleFix.label,
  client_description: null,
  item_type: "material",
  quantity: sampleFix.quantity,
  unit: "m2",
  unit_cost: sampleFix.costRate ?? 0,
  unit_sell: sampleFix.sellRate ?? 0,
  total_cost: sampleFix.recommendedCost ?? 0,
  total_sell: sampleFix.recommendedSell ?? 0,
  optional: false,
  visible_on_quote: true,
  sort_order: 1,
} as PricingItem;
const quoteItems = mapPricingItemsToQuoteItems(
  [pricingItem],
  new Map([["w1", "Internal walls"]])
);
check(
  "P Quote copies Pricing sell; GST not applied on the line",
  near(quoteItems[0]?.total ?? 0, sampleFix.recommendedSell ?? -1)
);

console.log("\n--- Totals / source contract ---\n");
const stdTotalPurchase = aggregateInternalWallsLiningPurchaseSheets(
  result.requirements ?? [],
  INTERNAL_WALLS_STANDARD_13_2400_KEY
);
const aqTotalPurchase = aggregateInternalWallsLiningPurchaseSheets(
  result.requirements ?? [],
  INTERNAL_WALLS_AQUALINE_13_2400_KEY
);
check(
  "total Standard GIB purchase is Type 1 both faces + Type 2 Side A",
  near(stdTotalPurchase, TYPE1_PURCHASE_PER_FACE * 2 + TYPE2_PURCHASE)
);
check("total Aqualine purchase is Type 2 Side B only", near(aqTotalPurchase, TYPE2_PURCHASE));
check(
  "framing qty present for both wall types",
  mats(result).filter((row) => row.componentKey === INTERNAL_WALLS_FRAMING_90_MATERIAL_COMPONENT)
    .length === 2
);
check(
  "no legacy 1.4 h/m² lining labour / FITOUT package",
  !result.lineItems.some((row) => row.unit === "m²" && /lining labour/i.test(row.label)) &&
    !result.lineItems.some((row) => /internal wall materials allowance/i.test(row.label)) &&
    !read("lib/estimate/internal-walls-lining-physical.ts").includes("internalWallsPerM2")
);
check(
  "lining labour does not reintroduce 60/90",
  !read("lib/estimate/internal-walls-lining-physical.ts").includes("fallbackSellRate: 90") &&
    t1LabourLine?.sellAuthority === "derived_from_gross_margin"
);

const cost = result.lineItems.reduce((sum, item) => sum + (item.recommendedCost ?? 0), 0);
const sell = result.lineItems.reduce((sum, item) => sum + (item.recommendedSell ?? 0), 0);
const marginPct = sell > 0 ? ((sell - cost) / sell) * 100 : 0;

console.log("\n=== Three-wall fixture output ===");
console.log(`Wall Type 1 id=${type1.id}`);
console.log(`  length ${type1.length_lm} m × height ${type1.height_m} m × ${type1.wall_count} walls (length is total)`);
console.log(`  gross face area ${9 * 2.4} m² per side; total lined ${9 * 2.4 * 2} m²`);
console.log(`  Standard GIB installed ${t1Std.reduce((s, r) => sum(s, r.baseQuantity), 0)} / purchase ${t1Std.reduce((s, r) => sum(s, r.purchaseQuantity), 0)}`);
console.log(`  lining labour hours ${type1LabourHours}`);
console.log(`  lining labour cost ${t1Lab.reduce((s, r) => sum(s, r.totalCost), 0)}`);
console.log(`  fixings ${byType(fixingsReqs, type1.id)[0]?.totalCost}`);
console.log(`Wall Type 2 id=${type2.id}`);
console.log(`  Standard GIB installed ${t2Std[0]?.baseQuantity} / purchase ${t2Std[0]?.purchaseQuantity}`);
console.log(`  Aqualine installed ${t2Aq[0]?.baseQuantity} / purchase ${t2Aq[0]?.purchaseQuantity}`);
console.log(`  lining labour hours ${type2LabourHours}`);
console.log(`  fixings ${byType(fixingsReqs, type2.id)[0]?.totalCost}`);
console.log("TOTAL");
console.log(`  Standard GIB purchase ${stdTotalPurchase}`);
console.log(`  Aqualine purchase ${aqTotalPurchase}`);
console.log(`  lining labour hours ${type1LabourHours + type2LabourHours}`);
console.log(`  cost ${cost.toFixed(2)}`);
console.log(`  sell ${sell.toFixed(2)}`);
console.log(`  effective margin ${marginPct.toFixed(2)}%`);

if (failed > 0) {
  console.log(`\nFAILED ${failed} / ${passed + failed}`);
  process.exit(1);
}
console.log(`\nAll ${passed} checks passed.`);

function sum(a: number, b: number | null | undefined): number {
  return a + (b ?? 0);
}
