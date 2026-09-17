/**
 * IW-TRIM-01 — Respect both-sides trim quantities and clean rate copy.
 *
 * Run: npx --yes tsx scripts/verify-iw-trim-01.ts
 *
 * Hosted generate uses calculateEstimate (exclusive-winner dedupe).
 * Direct calculator alone is not sufficient.
 * No Production. No migration.
 */
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import type { EstimateLineItem } from "../components/assistant/types";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateInternalWalls } from "../lib/estimate/calculators/fitout";
import { FITOUT_BENCHMARKS } from "../lib/estimate/benchmark-rates";
import {
  INTERNAL_WALLS_CORNICE_SIDES_KEY,
  INTERNAL_WALLS_SKIRTING_SIDES_KEY,
  corniceTakeoff,
  sideSelectionCount,
  skirtingTakeoff,
  summariseFinishLine,
  trimSideScopePhrase,
} from "../lib/estimate/internal-walls-finish";
import {
  INTERNAL_WALLS_CORNICE_LABOUR_COMPONENT,
  INTERNAL_WALLS_CORNICE_MATERIAL_COMPONENT,
  INTERNAL_WALLS_FRAMING_90_MATERIAL_COMPONENT,
  INTERNAL_WALLS_SKIRTING_HOURS_DERIVATION,
  INTERNAL_WALLS_SKIRTING_HOURS_PER_LM,
  INTERNAL_WALLS_SKIRTING_LABOUR_COMPONENT,
  INTERNAL_WALLS_SKIRTING_MATERIAL_COMPONENT,
  INTERNAL_WALLS_SKIRTING_MATERIAL_KEY,
  internalWallsLiningMaterialComponent,
} from "../lib/estimate/internal-walls-identities";
import { INTERNAL_WALLS_HAS_OPENINGS_KEY } from "../lib/estimate/internal-walls-openings";
import { INTERNAL_WALLS_JOB_SCOPE_FACT_KEY } from "../lib/estimate/internal-walls-scope";
import {
  INTERNAL_WALLS_ADD_WALL_TYPE_KEY,
  applyInternalWallsFactWrite,
  resolveInternalWallsWallTypes,
  summariseWallType,
} from "../lib/estimate/internal-walls-wall-types";
import { calculateAuthoritativeFieldsFromEstimateLine } from "../lib/pricing/estimate-to-pricing-adapter";
import { mapPricingItemsToQuoteItems } from "../lib/quotes/from-pricing";
import type { PricingItem } from "../lib/pricing/types";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "../lib/estimate/types";
import type {
  LabourRequirement,
  MaterialRequirement,
} from "../lib/estimate/requirements";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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

function near(
  actual: number | null | undefined,
  expected: number,
  tol = 1e-6
): boolean {
  return (
    actual != null &&
    Number.isFinite(actual) &&
    Math.abs(actual - expected) <= tol
  );
}

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

function wa(): EstimateWorkArea {
  return {
    id: "w1",
    type: "internal_walls",
    name: "Internal walls",
    sort_order: 1,
    status: "confirmed",
  } as EstimateWorkArea;
}

function ctx(facts: EstimateFact[]): EstimateContext {
  return {
    project: { id: "iw-trim-01", qualityLevel: "standard" },
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

function writeWall(
  writes: Array<{ key: string; value: unknown; wallTypeId?: string; openingId?: string }>
): EstimateFact[] {
  let facts: EstimateFact[] = [];
  for (const row of writes) {
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: row.key,
      value: row.value,
      wallTypeId: row.wallTypeId,
      openingId: row.openingId,
    });
  }
  return facts;
}

function fixture4m(params: {
  skirting?: string;
  cornice?: string;
  opening?: boolean;
  secondPortion?: boolean;
}): EstimateFact[] {
  let facts = writeWall([
    { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
    { key: "internal_walls.wall_type.label", value: "Wall Type 1" },
    { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
    {
      key: "internal_walls.wall_type.frame_size",
      value: "90 mm timber framing — 90×45",
    },
    { key: "internal_walls.wall_type.length_lm", value: 4 },
    { key: "internal_walls.wall_type.height_m", value: 2.7 },
    { key: "internal_walls.wall_type.stud_centres_mm", value: "600 mm" },
    { key: "internal_walls.wall_type.side_a_product", value: "Standard GIB" },
    { key: "internal_walls.wall_type.same_lining_both_sides", value: true },
    {
      key: INTERNAL_WALLS_HAS_OPENINGS_KEY,
      value: params.opening ? "Yes" : "No",
    },
  ]);
  const type1 = resolveInternalWallsWallTypes({ facts, workAreaId: "w1" }).types[0]!;
  if (params.opening) {
    const openingId = type1.openings[0]!.id;
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: "internal_walls.opening.type",
      value: "Door opening",
      wallTypeId: type1.id,
      openingId,
    });
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: "internal_walls.opening.width_m",
      value: 0.81,
      wallTypeId: type1.id,
      openingId,
    });
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: "internal_walls.opening.height_m",
      value: 1.98,
      wallTypeId: type1.id,
      openingId,
    });
  }
  if (params.skirting != null) {
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: INTERNAL_WALLS_SKIRTING_SIDES_KEY,
      value: params.skirting,
      wallTypeId: type1.id,
    });
  }
  if (params.cornice != null) {
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: INTERNAL_WALLS_CORNICE_SIDES_KEY,
      value: params.cornice,
      wallTypeId: type1.id,
    });
  }
  if (params.secondPortion) {
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY,
      value: true,
    });
    const type2 = resolveInternalWallsWallTypes({ facts, workAreaId: "w1" })
      .types[1]!;
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: "internal_walls.wall_type.label",
      value: "Wall Type 2",
      wallTypeId: type2.id,
    });
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: "internal_walls.wall_type.frame_system",
      value: "Timber framing",
      wallTypeId: type2.id,
    });
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: "internal_walls.wall_type.frame_size",
      value: "90 mm timber framing — 90×45",
      wallTypeId: type2.id,
    });
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: "internal_walls.wall_type.length_lm",
      value: 3,
      wallTypeId: type2.id,
    });
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: "internal_walls.wall_type.height_m",
      value: 2.7,
      wallTypeId: type2.id,
    });
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: "internal_walls.wall_type.stud_centres_mm",
      value: "600 mm",
      wallTypeId: type2.id,
    });
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: "internal_walls.wall_type.side_a_product",
      value: "Standard GIB",
      wallTypeId: type2.id,
    });
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: "internal_walls.wall_type.same_lining_both_sides",
      value: true,
      wallTypeId: type2.id,
    });
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: INTERNAL_WALLS_HAS_OPENINGS_KEY,
      value: "No",
      wallTypeId: type2.id,
    });
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: INTERNAL_WALLS_SKIRTING_SIDES_KEY,
      value: "Side A",
      wallTypeId: type2.id,
    });
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: INTERNAL_WALLS_CORNICE_SIDES_KEY,
      value: "Both sides",
      wallTypeId: type2.id,
    });
  }
  return [
    fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "new_partition"),
    ...facts.filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
  ];
}

function mapCalcLines(items: readonly EstimateLineItemInput[]): EstimateLineItem[] {
  return items.map((item, index) => ({
    id: `line-${index}`,
    workAreaId: item.workAreaId,
    workAreaName: item.workAreaName,
    label: item.label,
    category: item.category,
    quantity: item.quantity,
    unit: item.unit,
    recommendedCost: item.recommendedCost ?? 0,
    recommendedSell: item.recommendedSell ?? 0,
    rateSource: item.rateSource,
    rateSourceType: item.rateSourceType,
    itemKey: item.itemKey,
    componentKey: item.componentKey,
    notes: item.notes,
    identitySummary: item.identitySummary,
    labourHours: item.labourHours,
    includedInTotal: item.includedInTotal,
    overlapGroup: item.overlapGroup,
    sourceLine: item,
  }));
}

function included(items: readonly EstimateLineItemInput[]) {
  return items.filter((row) => row.includedInTotal !== false);
}

function mats(req: readonly { kind: string }[]): MaterialRequirement[] {
  return req.filter((row): row is MaterialRequirement => row.kind === "material");
}

function labs(req: readonly { kind: string }[]): LabourRequirement[] {
  return req.filter((row): row is LabourRequirement => row.kind === "labour");
}

console.log("=== IW-TRIM-01 ===\n");

check("side count none → 0", sideSelectionCount("none") === 0);
check("side count side_a → 1", sideSelectionCount("side_a") === 1);
check("side count side_b → 1", sideSelectionCount("side_b") === 1);
check("side count both → 2", sideSelectionCount("both") === 2);
check(
  "scope phrase both sides",
  trimSideScopePhrase("Skirting", "both") === "Skirting to both sides"
);
check(
  "derivation has no Quotr V1",
  !/Quotr V1/i.test(INTERNAL_WALLS_SKIRTING_HOURS_DERIVATION) &&
    /Quotr benchmark · 0\.10 person-hours\/lm/.test(
      INTERNAL_WALLS_SKIRTING_HOURS_DERIVATION
    )
);

console.log("\n--- 1. Four-metre wall, both sides ---\n");
const bothFacts = fixture4m({ skirting: "Both sides", cornice: "Both sides" });
const bothType = resolveInternalWallsWallTypes({
  facts: bothFacts,
  workAreaId: "w1",
}).types[0]!;
check("persisted skirting = both", bothType.skirting === "both");
check("persisted cornice = both", bothType.cornice === "both");

const bothSkirt = skirtingTakeoff({
  type: bothType,
  jobScope: "new_partition",
});
const bothCornice = corniceTakeoff({
  type: bothType,
  jobScope: "new_partition",
});
check("physical skirting 8 lm", bothSkirt != null && near(bothSkirt.totalLm, 8));
check(
  "physical cornice 8 lm",
  bothCornice != null && near(bothCornice.totalLm, 8)
);

const bothDirect = calculateInternalWalls(ctx(bothFacts), wa());
const bothEst = calculateEstimate(ctx(bothFacts));
const bothSkirtMats = included(bothEst.lineItems).filter(
  (row) => row.componentKey === INTERNAL_WALLS_SKIRTING_MATERIAL_COMPONENT
);
const bothSkirtLabs = included(bothEst.lineItems).filter(
  (row) => row.componentKey === INTERNAL_WALLS_SKIRTING_LABOUR_COMPONENT
);
const bothCorniceMats = included(bothEst.lineItems).filter(
  (row) => row.componentKey === INTERNAL_WALLS_CORNICE_MATERIAL_COMPONENT
);
const bothCorniceLabs = included(bothEst.lineItems).filter(
  (row) => row.componentKey === INTERNAL_WALLS_CORNICE_LABOUR_COMPONENT
);

check(
  "hosted skirting material qty 8 (not collapsed to 4)",
  bothSkirtMats.length === 1 && near(bothSkirtMats[0]!.quantity, 8)
);
check(
  "hosted skirting labour hours from 8 lm × 0.10",
  bothSkirtLabs.length === 1 &&
    near(bothSkirtLabs[0]!.labourHours ?? bothSkirtLabs[0]!.quantity, 0.8)
);
check(
  "hosted cornice material qty 8",
  bothCorniceMats.length === 1 && near(bothCorniceMats[0]!.quantity, 8)
);
check(
  "hosted cornice labour qty 8 PR retains quantity",
  bothCorniceLabs.length === 1 &&
    near(bothCorniceLabs[0]!.quantity, 8) &&
    bothCorniceLabs[0]!.rateSourceType === "missing"
);
check(
  "no false $0 cornice labour quantity",
  bothCorniceLabs[0]!.quantity === 8
);
check(
  "skirting material identity unchanged",
  bothSkirtMats[0]!.itemKey === INTERNAL_WALLS_SKIRTING_MATERIAL_KEY
);
check(
  "skirting material cost = 8 × $/lm",
  near(
    bothSkirtMats[0]!.recommendedCost,
    8 * FITOUT_BENCHMARKS.skirtingLm.cost
  )
);
const skirtLabReq = labs(bothEst.requirements ?? []).find(
  (row) => row.componentKey === INTERNAL_WALLS_SKIRTING_LABOUR_COMPONENT
);
check(
  "skirting base labour 0.80 hours from 8 lm driver",
  skirtLabReq != null &&
    near(skirtLabReq.baseHours, 8 * INTERNAL_WALLS_SKIRTING_HOURS_PER_LM) &&
    near(skirtLabReq.productivityBasis.quantity, 8) &&
    near(skirtLabReq.productivityBasis.hoursPerUnit, INTERNAL_WALLS_SKIRTING_HOURS_PER_LM)
);
check(
  "direct calculator also emits one 8 lm skirting line",
  mats(bothDirect.requirements ?? []).filter(
    (row) => row.componentKey === INTERNAL_WALLS_SKIRTING_MATERIAL_COMPONENT
  ).length === 1 &&
    near(
      mats(bothDirect.requirements ?? []).find(
        (row) => row.componentKey === INTERNAL_WALLS_SKIRTING_MATERIAL_COMPONENT
      )!.baseQuantity,
      8
    )
);

const bothReview = composeBuilderReview({
  estimate: {
    recommendedCost: bothEst.lineItems.reduce(
      (sum, item) => sum + (item.recommendedCost ?? 0),
      0
    ),
    recommendedSell: bothEst.lineItems.reduce(
      (sum, item) => sum + (item.recommendedSell ?? 0),
      0
    ),
    marginPercent: 20,
    confidence: bothEst.confidence,
    assumptions: bothEst.assumptions,
    missingInfo: bothEst.missingInfo,
    lineItems: mapCalcLines(bothEst.lineItems),
  },
  workAreas: [
    { id: "w1", type: "internal_walls", name: "Internal walls", status: "confirmed" },
  ],
  requirements: bothEst.requirements ?? [],
});
const reviewText = JSON.stringify(bothReview);
check("Builder Review Both sides · 8lm skirting", /Both sides · 8 ?lm/i.test(reviewText));
check("Builder Review no Quotr V1", !/Quotr V1/i.test(reviewText));
check(
  "Builder Review Quotr benchmark wording",
  /Quotr benchmark · 0\.10 person-hours\/lm/i.test(reviewText)
);
check(
  "no duplicate skirting material lines",
  bothSkirtMats.length === 1
);
check(
  "finish summary says both sides",
  /Skirting to both sides/i.test(summariseFinishLine(bothType) ?? "") &&
    /Cornice to both sides/i.test(summariseFinishLine(bothType) ?? "")
);

console.log("\n--- 2. Single-side selections ---\n");
for (const side of ["Side A", "Side B"] as const) {
  const facts = fixture4m({ skirting: side, cornice: side });
  const type = resolveInternalWallsWallTypes({ facts, workAreaId: "w1" }).types[0]!;
  const skirt = skirtingTakeoff({ type, jobScope: "new_partition" });
  const est = calculateEstimate(ctx(facts));
  const mat = included(est.lineItems).find(
    (row) => row.componentKey === INTERNAL_WALLS_SKIRTING_MATERIAL_COMPONENT
  );
  check(`${side} skirting physical 4 lm`, skirt != null && near(skirt.totalLm, 4));
  check(
    `${side} hosted skirting qty 4 (no doubling)`,
    mat != null && near(mat.quantity, 4)
  );
  check(
    `${side} label in identity`,
    /Side [AB] · 4 ?lm/i.test(mat?.identitySummary ?? "")
  );
}

console.log("\n--- 3. Excluded ---\n");
const exclFacts = fixture4m({ skirting: "No", cornice: "No" });
const exclEst = calculateEstimate(ctx(exclFacts));
check(
  "excluded skirting — no requirement",
  !included(exclEst.lineItems).some(
    (row) =>
      row.componentKey === INTERNAL_WALLS_SKIRTING_MATERIAL_COMPONENT ||
      row.componentKey === INTERNAL_WALLS_SKIRTING_LABOUR_COMPONENT
  )
);
check(
  "excluded cornice — no requirement",
  !included(exclEst.lineItems).some(
    (row) =>
      row.componentKey === INTERNAL_WALLS_CORNICE_MATERIAL_COMPONENT ||
      row.componentKey === INTERNAL_WALLS_CORNICE_LABOUR_COMPONENT
  )
);

console.log("\n--- 4. Mixed independent selections ---\n");
const mixes: Array<{
  name: string;
  skirting: string;
  cornice: string;
  skirtLm: number;
  corniceLm: number;
}> = [
  {
    name: "skirt both / cornice both",
    skirting: "Both sides",
    cornice: "Both sides",
    skirtLm: 8,
    corniceLm: 8,
  },
  {
    name: "skirt Side A / cornice both",
    skirting: "Side A",
    cornice: "Both sides",
    skirtLm: 4,
    corniceLm: 8,
  },
  {
    name: "skirt both / cornice Side B",
    skirting: "Both sides",
    cornice: "Side B",
    skirtLm: 8,
    corniceLm: 4,
  },
  {
    name: "skirt excluded / cornice both",
    skirting: "No",
    cornice: "Both sides",
    skirtLm: 0,
    corniceLm: 8,
  },
  {
    name: "skirt both / cornice excluded",
    skirting: "Both sides",
    cornice: "No",
    skirtLm: 8,
    corniceLm: 0,
  },
];
for (const mix of mixes) {
  const facts = fixture4m({ skirting: mix.skirting, cornice: mix.cornice });
  const type = resolveInternalWallsWallTypes({ facts, workAreaId: "w1" }).types[0]!;
  const skirt = skirtingTakeoff({ type, jobScope: "new_partition" });
  const cornice = corniceTakeoff({ type, jobScope: "new_partition" });
  const est = calculateEstimate(ctx(facts));
  const skirtQty = included(est.lineItems)
    .filter((row) => row.componentKey === INTERNAL_WALLS_SKIRTING_MATERIAL_COMPONENT)
    .reduce((sum, row) => sum + row.quantity, 0);
  const corniceQty = included(est.lineItems)
    .filter((row) => row.componentKey === INTERNAL_WALLS_CORNICE_MATERIAL_COMPONENT)
    .reduce((sum, row) => sum + row.quantity, 0);
  check(
    `${mix.name} skirting`,
    mix.skirtLm === 0
      ? skirt == null && skirtQty === 0
      : skirt != null && near(skirt.totalLm, mix.skirtLm) && near(skirtQty, mix.skirtLm)
  );
  check(
    `${mix.name} cornice`,
    mix.corniceLm === 0
      ? cornice == null && corniceQty === 0
      : cornice != null &&
          near(cornice.totalLm, mix.corniceLm) &&
          near(corniceQty, mix.corniceLm)
  );
}

console.log("\n--- 5. Opening deduction then side count ---\n");
const openFacts = fixture4m({
  skirting: "Both sides",
  cornice: "Both sides",
  opening: true,
});
const openType = resolveInternalWallsWallTypes({
  facts: openFacts,
  workAreaId: "w1",
}).types[0]!;
const openSkirt = skirtingTakeoff({ type: openType, jobScope: "new_partition" });
// Door 0.81 wide deducts once per face → net 3.19 per face → both = 6.38
check(
  "opening net then ×2 = 6.38 skirting",
  openSkirt != null &&
    near(openSkirt.sideALm, 3.19) &&
    near(openSkirt.sideBLm, 3.19) &&
    near(openSkirt.totalLm, 6.38)
);
const openEst = calculateEstimate(ctx(openFacts));
const openSkirtMat = included(openEst.lineItems).find(
  (row) => row.componentKey === INTERNAL_WALLS_SKIRTING_MATERIAL_COMPONENT
);
check(
  "hosted opening skirting uses 6.38 once",
  openSkirtMat != null && near(openSkirtMat.quantity, 6.38)
);
const openCornice = corniceTakeoff({
  type: openType,
  jobScope: "new_partition",
});
// Ordinary door below wall height does not deduct cornice
check(
  "ordinary door does not deduct cornice; both = 8",
  openCornice != null && near(openCornice.totalLm, 8)
);

console.log("\n--- 6. Multiple portions ---\n");
const multiFacts = fixture4m({
  skirting: "Both sides",
  cornice: "Side A",
  secondPortion: true,
});
const multiTypes = resolveInternalWallsWallTypes({
  facts: multiFacts,
  workAreaId: "w1",
}).types;
check("two portions resolved", multiTypes.length === 2);
check(
  "portion A skirting both",
  multiTypes[0]!.skirting === "both" && multiTypes[0]!.cornice === "side_a"
);
check(
  "portion B independent selections",
  multiTypes[1]!.skirting === "side_a" && multiTypes[1]!.cornice === "both"
);
const multiEst = calculateEstimate(ctx(multiFacts));
const multiSkirtQty = included(multiEst.lineItems)
  .filter((row) => row.componentKey === INTERNAL_WALLS_SKIRTING_MATERIAL_COMPONENT)
  .reduce((sum, row) => sum + row.quantity, 0);
const multiCorniceQty = included(multiEst.lineItems)
  .filter((row) => row.componentKey === INTERNAL_WALLS_CORNICE_MATERIAL_COMPONENT)
  .reduce((sum, row) => sum + row.quantity, 0);
// A: skirt 8 + cornice 4; B: skirt 3 + cornice 6
check("multi skirting aggregate 8+3=11", near(multiSkirtQty, 11));
check("multi cornice aggregate 4+6=10", near(multiCorniceQty, 10));
check(
  "two skirting material lines (one per portion)",
  included(multiEst.lineItems).filter(
    (row) => row.componentKey === INTERNAL_WALLS_SKIRTING_MATERIAL_COMPONENT
  ).length === 2
);

console.log("\n--- 7. Persistence round-trip ---\n");
const persistType = resolveInternalWallsWallTypes({
  facts: bothFacts,
  workAreaId: "w1",
}).types[0]!;
check("refresh resolves both skirting", persistType.skirting === "both");
check("refresh resolves both cornice", persistType.cornice === "both");
const summary = summariseWallType(persistType, 0);
check(
  "wall summary includes both-sides trim",
  /Skirting to both sides/i.test(summary.finishLine ?? "") &&
    /Cornice to both sides/i.test(summary.finishLine ?? "")
);

console.log("\n--- 9. Pricing + Quote ---\n");
const skirtMatLine = bothSkirtMats[0]!;
const pricingFromEstimate = calculateAuthoritativeFieldsFromEstimateLine({
  id: "line-skirting",
  category: "materials",
  recommended_cost: skirtMatLine.recommendedCost ?? 0,
  recommended_sell: skirtMatLine.recommendedSell ?? 0,
  notes: skirtMatLine.notes ?? null,
});
check(
  "Pricing receives corrected 8 lm skirting cost",
  near(skirtMatLine.quantity, 8) &&
    pricingFromEstimate.ok &&
    near(pricingFromEstimate.fields.totalCost, skirtMatLine.recommendedCost ?? -1)
);
const pricingItem = {
  id: "p-skirting",
  work_area_id: "w1",
  internal_label: skirtMatLine.label,
  client_label: skirtMatLine.label,
  client_description:
    "Supply and install ordinary wall skirting to both sides.",
  item_type: "material",
  quantity: skirtMatLine.quantity,
  unit: "lm",
  unit_cost: skirtMatLine.costRate ?? FITOUT_BENCHMARKS.skirtingLm.cost,
  unit_charge_out:
    (skirtMatLine.recommendedSell ?? 0) / Math.max(skirtMatLine.quantity, 1e-9),
  total_cost: skirtMatLine.recommendedCost ?? 0,
  total_sell: skirtMatLine.recommendedSell ?? 0,
  visible_on_quote: true,
  sort_order: 1,
} as PricingItem;
const quoteItems = mapPricingItemsToQuoteItems(
  [pricingItem],
  new Map([["w1", "Internal walls"]])
);
const quoteBlob = JSON.stringify(quoteItems);
check(
  "Quote has no productivity / Quotr V1 / benchmark wording",
  !/productivity|Quotr V1|person-hours|benchmark/i.test(quoteBlob)
);
check(
  "Quote scope from wall summary mentions both sides",
  /Skirting to both sides/.test(summary.finishLine ?? "") &&
    /Cornice to both sides/.test(summary.finishLine ?? "")
);

console.log("\n--- 10. Non-regression framing / lining ---\n");
const baseFacts = fixture4m({ skirting: "No", cornice: "No" });
const withTrimFacts = fixture4m({
  skirting: "Both sides",
  cornice: "Both sides",
});
const baseEst = calculateEstimate(ctx(baseFacts));
const withTrimEst = calculateEstimate(ctx(withTrimFacts));
const framingKey = INTERNAL_WALLS_FRAMING_90_MATERIAL_COMPONENT;
const liningKey = internalWallsLiningMaterialComponent("standard_gib");
const baseFrame = included(baseEst.lineItems).find(
  (row) => row.componentKey === framingKey
);
const trimFrame = included(withTrimEst.lineItems).find(
  (row) => row.componentKey === framingKey
);
const baseLining = included(baseEst.lineItems).find(
  (row) => row.componentKey === liningKey
);
const trimLining = included(withTrimEst.lineItems).find(
  (row) => row.componentKey === liningKey
);
check(
  "framing qty unchanged by trim",
  baseFrame != null &&
    trimFrame != null &&
    near(baseFrame.quantity, trimFrame.quantity)
);
check(
  "lining qty unchanged by trim",
  baseLining != null &&
    trimLining != null &&
    near(baseLining.quantity, trimLining.quantity)
);

const finishSrc = readFileSync(
  join(process.cwd(), "lib/estimate/internal-walls-finish-physical.ts"),
  "utf8"
);
check(
  "finish physical emits totalLm once (no per-face skirting loop)",
  finishSrc.includes("skirting.totalLm") &&
    !finishSrc.includes("faces.push({ side: \"side_a\", lm: skirting.sideALm")
);

console.log(
  `\nIW-TRIM-01 result: ${passed} passed, ${failed} failed\n`
);
if (failed > 0) process.exit(1);
