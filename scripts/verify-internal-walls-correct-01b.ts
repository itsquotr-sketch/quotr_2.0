/**
 * INTERNAL-WALLS-CORRECT-01B — hosted same-lining-both-sides commercial collapse.
 *
 * Run: npx --yes tsx scripts/verify-internal-walls-correct-01b.ts
 *
 * Hosted generate uses calculateEstimate, not calculateInternalWalls.
 * No Production. No merge to main.
 */
import { deriveSellFromCost } from "../lib/commercial-engine/core/sell-from-margin";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateInternalWalls } from "../lib/estimate/calculators/fitout";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import {
  applyExtractedInternalWallsToFacts,
  COORDINATION_ORIGINAL_BRIEF,
  extractInternalWallsTypesFromBrief,
} from "../lib/estimate/internal-walls-brief";
import {
  INTERNAL_WALLS_AQUALINE_13_2400_KEY,
  INTERNAL_WALLS_LINING_HOURS_PER_SHEET,
  INTERNAL_WALLS_STANDARD_13_2400_KEY,
  internalWallsLiningLabourComponent,
  internalWallsLiningMaterialComponent,
  internalWallsLiningOverlapGroup,
} from "../lib/estimate/internal-walls-identities";
import {
  exclusiveOverlapWinnerItems,
} from "../lib/estimate/internal-walls-lining-commercial";
import {
  INTERNAL_WALLS_JOB_SCOPE_FACT_KEY,
  INTERNAL_WALLS_STRUCTURAL_FACT_KEY,
} from "../lib/estimate/internal-walls-scope";
import { resolveInternalWallsWallTypes } from "../lib/estimate/internal-walls-wall-types";
import { getCatalogueEntry } from "../lib/rates/catalogue";
import { calculateAuthoritativeFieldsFromEstimateLine } from "../lib/pricing/estimate-to-pricing-adapter";
import { mapPricingItemsToQuoteItems } from "../lib/quotes/from-pricing";
import type { PricingItem } from "../lib/pricing/types";
import type { EstimateLineItem } from "../components/assistant/types";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
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

function wa(): EstimateWorkArea {
  return { id: "w1", type: "internal_walls", name: "Internal walls", sort_order: 1 };
}

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

function ctx(facts: EstimateFact[]): EstimateContext {
  return {
    project: { id: "iw-correct-01b", qualityLevel: "standard" },
    confirmedWorkAreas: [wa()],
    facts,
    constraints: [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
      budget_rate_factor: 0.9,
      premium_rate_factor: 1.15,
    },
    materialWastageSettings: {
      defaultMaterialWastagePercent: 10,
      timberFramingWastagePercent: 10,
      sheetMaterialWastagePercent: 10,
    },
    rates: [],
  } as unknown as EstimateContext;
}

function fixtureFacts(): EstimateFact[] {
  const types = extractInternalWallsTypesFromBrief(COORDINATION_ORIGINAL_BRIEF);
  return applyExtractedInternalWallsToFacts({
    facts: [
      fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "mixed"),
      fact(INTERNAL_WALLS_STRUCTURAL_FACT_KEY, "w1", "No"),
    ],
    workAreaId: "w1",
    types,
  });
}

function liningMats(
  requirements: readonly { kind: string }[],
  product: "standard_gib" | "aqualine"
): MaterialRequirement[] {
  return requirements.filter(
    (row): row is MaterialRequirement =>
      row.kind === "material" &&
      (row as MaterialRequirement).componentKey ===
        internalWallsLiningMaterialComponent(product)
  );
}

function liningLabs(
  requirements: readonly { kind: string }[],
  product: "standard_gib" | "aqualine"
): LabourRequirement[] {
  return requirements.filter(
    (row): row is LabourRequirement =>
      row.kind === "labour" &&
      (row as LabourRequirement).componentKey ===
        internalWallsLiningLabourComponent(product)
  );
}

function byType<T extends { variantKey?: string }>(rows: readonly T[], typeId: string): T[] {
  return rows.filter((row) => (row.variantKey ?? "").startsWith(`${typeId}`));
}

function mapCalcLines(items: readonly EstimateLineItemInput[]): EstimateLineItem[] {
  return items.map((item, index) => ({
    id: `line-${index}`,
    workAreaId: item.workAreaId,
    workAreaName: item.workAreaName,
    label: item.label,
    category: item.category,
    costLow: item.costLow,
    costHigh: item.costHigh,
    sellLow: item.sellLow,
    sellHigh: item.sellHigh,
    recommendedCost: item.recommendedCost ?? 0,
    recommendedSell: item.recommendedSell ?? 0,
    grossProfit: item.grossProfit ?? 0,
    marginPercent: item.marginPercent ?? 0,
    quantity: item.quantity,
    unit: item.unit,
    labourHours: item.labourHours,
    rateSource: item.rateSource,
    rateSourceType: item.rateSourceType,
    itemKey: item.itemKey,
    componentKey: item.componentKey,
    notes: item.notes,
    identitySummary: item.identitySummary,
    includedInTotal: item.includedInTotal,
    overlapGroup: item.overlapGroup,
    scopeKey: item.scopeKey,
  }));
}

const walls = wa();
const STANDARD_COST =
  getCatalogueEntry(INTERNAL_WALLS_STANDARD_13_2400_KEY)?.defaultCostRate ?? 18;
const TYPE1_INSTALLED = 16;
const TYPE1_PURCHASE = 18;
const TYPE1_LABOUR_H = TYPE1_INSTALLED * INTERNAL_WALLS_LINING_HOURS_PER_SHEET;
const TYPE2_INSTALLED = 3;
const TYPE2_PURCHASE = 4;

console.log("=== INTERNAL-WALLS-CORRECT-01B hosted same-lining-both-sides ===\n");

check(
  "fixture wording is exact",
  COORDINATION_ORIGINAL_BRIEF ===
    "I am renovating a house and removing 3 internal walls, I need to rebuild the walls completely. 2 of the walls are 45x90 framed timber with 13mm standard GIB on both sides (they total 9m long and are 2.4m high), and the other wall is 45x90 framed timber with 13mm standard GIB on one side and 13mm aqualine on the otherside (this wall is 3m long and 2.4m high)"
);

const facts = fixtureFacts();
const resolved = resolveInternalWallsWallTypes({ facts, workAreaId: "w1" });
const type1 = resolved.types[0]!;
const type2 = resolved.types[1]!;
const calc = calculateInternalWalls(ctx(facts), walls);
const estimate = calculateEstimate(ctx(facts));

const calcType1Std = calc.lineItems.filter(
  (item) =>
    item.componentKey === internalWallsLiningMaterialComponent("standard_gib") &&
    item.overlapGroup === internalWallsLiningOverlapGroup(type1.id) &&
    item.includedInTotal !== false
);
const exclusive = exclusiveOverlapWinnerItems(calcType1Std);
const exclusiveQty = exclusive.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);

console.log("\n--- A hosted-equivalent old failure class ---\n");
check(
  "A persisted fixture is one Internal Walls instance / two Wall Types / same_lining_both_sides",
  resolved.types.length === 2 &&
    type1.same_lining_both_sides === true &&
    type1.side_a.product === "standard_gib" &&
    type1.side_b.product === "standard_gib" &&
    type2.same_lining_both_sides === false
);
check(
  "A calculator still emits two same-scope Type 1 Standard lining faces",
  calcType1Std.length === 2 &&
    calcType1Std.every((row) => near(row.quantity, 9))
);
check(
  "A exclusive overlap winner keeps 9 purchase (the hosted Preview collapse)",
  exclusive.length === 1 && near(exclusiveQty, 9),
  `exclusiveQty=${exclusiveQty}`
);

console.log("\n--- B/C physical faces survive ---\n");
const reqType1Std = byType(liningMats(estimate.requirements ?? [], "standard_gib"), type1.id);
const reqType1Lab = byType(liningLabs(estimate.requirements ?? [], "standard_gib"), type1.id);
check(
  "B both physical Type 1 Standard faces survive requirement generation",
  reqType1Std.length === 2 &&
    reqType1Std.some((row) => row.variantKey === `${type1.id}:side_a`) &&
    reqType1Std.some((row) => row.variantKey === `${type1.id}:side_b`)
);
check(
  "C Type 1 physical 16 installed / 18 purchased",
  near(
    reqType1Std.reduce((sum, row) => sum + row.baseQuantity, 0),
    TYPE1_INSTALLED
  ) &&
    near(
      reqType1Std.reduce((sum, row) => sum + row.purchaseQuantity, 0),
      TYPE1_PURCHASE
    )
);

console.log("\n--- D/E/I commercial aggregation sums ---\n");
const estType1Std = estimate.lineItems.filter(
  (item) =>
    item.componentKey === internalWallsLiningMaterialComponent("standard_gib") &&
    item.overlapGroup === internalWallsLiningOverlapGroup(type1.id) &&
    item.includedInTotal !== false
);
const type1MaterialQty = estType1Std.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
const type1MaterialCost = estType1Std.reduce(
  (sum, item) => sum + Number(item.recommendedCost ?? 0),
  0
);
check(
  "D Type 1 commercial material qty = 18",
  estType1Std.length === 1 && near(type1MaterialQty, TYPE1_PURCHASE),
  `lines=${estType1Std.length} qty=${type1MaterialQty}`
);
check(
  "E Type 1 material cost uses all 18 sheets",
  near(type1MaterialCost, TYPE1_PURCHASE * STANDARD_COST) &&
    !near(type1MaterialCost, 9 * STANDARD_COST),
  `cost=${type1MaterialCost}`
);
check(
  "I same material may aggregate but quantities SUM (not first-face keep)",
  near(type1MaterialQty, 9 + 9) &&
    !/Side A lining$/.test(estType1Std[0]?.label ?? "") &&
    /lining$/.test(estType1Std[0]?.label ?? "")
);

console.log("\n--- F lining labour ---\n");
const estType1Lab = estimate.lineItems.filter(
  (item) =>
    item.componentKey === internalWallsLiningLabourComponent("standard_gib") &&
    item.overlapGroup === internalWallsLiningOverlapGroup(type1.id) &&
    item.includedInTotal !== false
);
const type1LabourH = estType1Lab.reduce(
  (sum, item) => sum + Number(item.labourHours ?? item.quantity ?? 0),
  0
);
check(
  "F Type 1 lining labour = 6.4h from 16 installed × 0.40",
  reqType1Lab.length === 2 &&
    near(
      reqType1Lab.reduce((sum, row) => sum + row.baseHours, 0),
      TYPE1_LABOUR_H
    ) &&
    estType1Lab.length === 1 &&
    near(type1LabourH, TYPE1_LABOUR_H),
  `hours=${type1LabourH}`
);

console.log("\n--- G/H Wall Type 2 control ---\n");
const reqType2Std = byType(liningMats(estimate.requirements ?? [], "standard_gib"), type2.id);
const reqType2Aq = byType(liningMats(estimate.requirements ?? [], "aqualine"), type2.id);
const estType2Std = estimate.lineItems.filter(
  (item) =>
    item.componentKey === internalWallsLiningMaterialComponent("standard_gib") &&
    item.overlapGroup === internalWallsLiningOverlapGroup(type2.id) &&
    item.includedInTotal !== false
);
const estType2Aq = estimate.lineItems.filter(
  (item) =>
    item.componentKey === internalWallsLiningMaterialComponent("aqualine") &&
    item.overlapGroup === internalWallsLiningOverlapGroup(type2.id) &&
    item.includedInTotal !== false
);
check(
  "G Wall Type 2 remains 3+3 installed / 4+4 purchase",
  near(reqType2Std[0]?.baseQuantity, TYPE2_INSTALLED) &&
    near(reqType2Std[0]?.purchaseQuantity, TYPE2_PURCHASE) &&
    near(reqType2Aq[0]?.baseQuantity, TYPE2_INSTALLED) &&
    near(reqType2Aq[0]?.purchaseQuantity, TYPE2_PURCHASE) &&
    near(estType2Std[0]?.quantity, TYPE2_PURCHASE) &&
    near(estType2Aq[0]?.quantity, TYPE2_PURCHASE)
);
check(
  "H mixed material identities remain separate",
  reqType2Std[0]?.materialKey === INTERNAL_WALLS_STANDARD_13_2400_KEY &&
    reqType2Aq[0]?.materialKey === INTERNAL_WALLS_AQUALINE_13_2400_KEY &&
    estType2Std[0]?.itemKey !== estType2Aq[0]?.itemKey &&
    estType2Std.length === 1 &&
    estType2Aq.length === 1
);

console.log("\n--- J provenance ---\n");
check(
  "J work_area_id / wallTypeId provenance intact",
  [...reqType1Std, ...reqType2Std, ...reqType2Aq].every(
    (row) => row.workAreaId === "w1" && Boolean(row.variantKey)
  ) &&
    estType1Std[0]?.workAreaId === "w1" &&
    (estType1Std[0]?.overlapGroup ?? "").includes(type1.id)
);

console.log("\n--- K Builder Review ---\n");
const review = composeBuilderReview({
  estimate: {
    recommendedCost: estimate.recommendedCost,
    recommendedSell: estimate.recommendedSell,
    marginPercent: estimate.marginPercent,
    confidence: estimate.confidence,
    assumptions: estimate.assumptions,
    missingInfo: estimate.missingInfo,
    lineItems: mapCalcLines(estimate.lineItems),
  },
  workAreas: [{ id: "w1", type: "internal_walls", name: "Internal walls", status: "confirmed" }],
  requirements: estimate.requirements ?? [],
});
const liningGroups = review.workAreas.flatMap((area) =>
  area.categories.flatMap((cat) =>
    cat.lineGroups.filter((group) => /lining/i.test(group.label))
  )
);
const type1Review = liningGroups.find((group) =>
  (group.children[0]?.sourceLine.overlapGroup ?? "").includes(type1.id)
);
const type1Support = `${type1Review?.supporting ?? ""} ${type1Review?.children
  .map((row) => `${row.label} ${row.supporting ?? ""} ${row.quantity ?? ""}`)
  .join(" ")}`;
check(
  "K Builder Review Type 1 shows 16 installed / 18 incl waste",
  /16 sheets installed/.test(type1Support) &&
    /18 sheets incl\. waste/.test(type1Support) &&
    /Both sides/i.test(type1Support),
  type1Support
);
check(
  "K expanded details do not imply only Side A exists",
  !/Side A lining/.test(type1Support) &&
    !near(estType1Std[0]?.quantity, 9) &&
    near(estType1Std[0]?.quantity, TYPE1_PURCHASE)
);

console.log("\n--- L/M Pricing / Quote ---\n");
const type1Line = estType1Std[0]!;
const pricingFromEstimate = calculateAuthoritativeFieldsFromEstimateLine({
  id: "line-type1-lining",
  category: "materials",
  recommended_cost: type1Line.recommendedCost ?? 0,
  recommended_sell: type1Line.recommendedSell ?? 0,
  notes: type1Line.notes ?? null,
});
check(
  "L Pricing receives corrected Type 1 quantity/cost",
  near(type1Line.quantity, TYPE1_PURCHASE) &&
    near(type1Line.recommendedCost, TYPE1_PURCHASE * STANDARD_COST) &&
    pricingFromEstimate.ok &&
    near(pricingFromEstimate.fields.totalCost, type1Line.recommendedCost ?? -1) &&
    near(pricingFromEstimate.fields.totalSell, type1Line.recommendedSell ?? -1)
);

const pricingItem = {
  id: "p-type1-lining",
  work_area_id: "w1",
  internal_label: type1Line.label,
  client_label: type1Line.label,
  client_description: type1Line.identitySummary ?? null,
  item_type: "material",
  quantity: type1Line.quantity,
  unit: "each",
  unit_cost: type1Line.costRate ?? 0,
  unit_sell: type1Line.sellRate ?? 0,
  total_cost: type1Line.recommendedCost ?? 0,
  total_sell: type1Line.recommendedSell ?? 0,
  optional: false,
  visible_on_quote: true,
  sort_order: 1,
} as PricingItem;
const quoteItems = mapPricingItemsToQuoteItems(
  [pricingItem],
  new Map([["w1", "Internal walls"]])
);
check(
  "M Quote provenance remains valid and copies Pricing sell",
  near(quoteItems[0]?.total ?? 0, type1Line.recommendedSell ?? -1) &&
    near(quoteItems[0]?.total ?? 0, deriveSellFromCost(TYPE1_PURCHASE * STANDARD_COST, 20))
);

check(
  "productivity remains 0.40 h/sheet",
  INTERNAL_WALLS_LINING_HOURS_PER_SHEET === 0.4
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
