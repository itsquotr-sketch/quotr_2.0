/**
 * EST-CORRECT-02A — Internal Walls / Plastering commercial ownership hotfix.
 *
 * Run: npx --yes tsx scripts/verify-est-correct-02a.ts
 *
 * No paid AI. No Production. No merge to main.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import type { EstimateLineItem } from "../components/assistant/types";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import {
  calculateInternalWalls,
  calculatePainting,
  calculatePlastering,
} from "../lib/estimate/calculators/fitout";
import { INTERNAL_WALLS_JOB_SCOPE_FACT_KEY } from "../lib/estimate/internal-walls-scope";
import {
  INTERNAL_WALLS_ADD_WALL_TYPE_KEY,
  applyInternalWallsFactWrite,
  resolveInternalWallsWallTypes,
} from "../lib/estimate/internal-walls-wall-types";
import { INTERNAL_WALLS_HAS_OPENINGS_KEY } from "../lib/estimate/internal-walls-openings";
import {
  INTERNAL_WALLS_CORNICE_SIDES_KEY,
  INTERNAL_WALLS_ELECTRICAL_KEY,
  INTERNAL_WALLS_INSULATION_INCLUDED_KEY,
  INTERNAL_WALLS_PAINTING_SIDES_KEY,
  INTERNAL_WALLS_SKIRTING_SIDES_KEY,
  INTERNAL_WALLS_STOPPING_SIDE_A_KEY,
  INTERNAL_WALLS_STOPPING_SIDE_B_KEY,
  internalWallsNestedFinishOmit,
} from "../lib/estimate/internal-walls-finish";
import {
  INTERNAL_WALLS_PAINTING_COMPONENT,
  INTERNAL_WALLS_STOPPING_COMPONENT,
  internalWallsLiningMaterialComponent,
} from "../lib/estimate/internal-walls-identities";
import { mapEstimateCategoryToItemType } from "../lib/pricing/calculations";
import type { PricingItem } from "../lib/pricing/types";
import { mapPricingItemsToQuoteItems } from "../lib/quotes/from-pricing";
import { buildWorkAreaQuoteDescriptionDraft } from "../lib/work-areas/quote-description";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
  EstimateResult,
  EstimateWorkArea,
} from "../lib/estimate/types";
import type { EstimateRequirement } from "../lib/estimate/requirements";

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

function wa(
  id: string,
  type: string,
  name: string,
  sortOrder = 1
): EstimateWorkArea {
  return { id, type, name, sort_order: sortOrder };
}

function ctx(
  workAreas: EstimateWorkArea[],
  facts: EstimateFact[]
): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: workAreas,
    facts,
    constraints: [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
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
  workAreaId: string,
  writes: Array<{
    key: string;
    value: unknown;
    wallTypeId?: string;
    openingId?: string;
  }>
): EstimateFact[] {
  let facts: EstimateFact[] = [];
  for (const row of writes) {
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId,
      key: row.key,
      value: row.value,
      wallTypeId: row.wallTypeId,
      openingId: row.openingId,
    });
  }
  return facts;
}

function finishExtras(params: {
  stopping?: string;
  painting?: string;
}): Array<{ key: string; value: unknown }> {
  return [
    { key: INTERNAL_WALLS_INSULATION_INCLUDED_KEY, value: "No" },
    { key: INTERNAL_WALLS_SKIRTING_SIDES_KEY, value: "No" },
    { key: INTERNAL_WALLS_CORNICE_SIDES_KEY, value: "No" },
    { key: INTERNAL_WALLS_ELECTRICAL_KEY, value: "No" },
    { key: INTERNAL_WALLS_STOPPING_SIDE_A_KEY, value: params.stopping ?? "Level 4" },
    { key: INTERNAL_WALLS_STOPPING_SIDE_B_KEY, value: params.stopping ?? "Level 4" },
    { key: INTERNAL_WALLS_PAINTING_SIDES_KEY, value: params.painting ?? "Both sides" },
  ];
}

function fixtureFacts(
  extra: Array<{ key: string; value: unknown }> = finishExtras({})
): EstimateFact[] {
  let facts = writeWall("w1", [
    { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
    { key: "internal_walls.wall_type.label", value: "Wall Type A" },
    { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
    { key: "internal_walls.wall_type.frame_size", value: "90 mm timber framing — 90×45" },
    { key: "internal_walls.wall_type.length_lm", value: 12 },
    { key: "internal_walls.wall_type.height_m", value: 2.4 },
    { key: "internal_walls.wall_type.stud_centres_mm", value: "600 mm" },
    { key: "internal_walls.wall_type.side_a_product", value: "Standard GIB" },
    { key: "internal_walls.wall_type.same_lining_both_sides", value: true },
    { key: INTERNAL_WALLS_HAS_OPENINGS_KEY, value: "Yes" },
  ]);
  const type = resolveInternalWallsWallTypes({
    facts,
    workAreaId: "w1",
  }).types[0]!;
  const openingId = type.openings[0]!.id;
  facts = applyInternalWallsFactWrite({
    facts,
    workAreaId: "w1",
    key: "internal_walls.opening.type",
    value: "Door opening",
    wallTypeId: type.id,
    openingId,
  });
  facts = applyInternalWallsFactWrite({
    facts,
    workAreaId: "w1",
    key: "internal_walls.opening.width_m",
    value: 0.81,
    wallTypeId: type.id,
    openingId,
  });
  facts = applyInternalWallsFactWrite({
    facts,
    workAreaId: "w1",
    key: "internal_walls.opening.height_m",
    value: 1.98,
    wallTypeId: type.id,
    openingId,
  });
  for (const row of extra) {
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: row.key,
      value: row.value,
      wallTypeId: type.id,
    });
  }
  return [
    { key: INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, work_area_id: "w1", value: "new_partition" },
    ...facts.filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
  ];
}

function plasteringFacts(): EstimateFact[] {
  return [
    { key: "plastering.area_m2", work_area_id: "pl1", value: 40 },
    { key: "plastering.level", work_area_id: "pl1", value: "Level 4" },
    { key: "plastering.surface_type", work_area_id: "pl1", value: "New plasterboard" },
  ];
}

function paintingFacts(): EstimateFact[] {
  return [
    { key: "painting.location", work_area_id: "pt1", value: "Internal" },
    { key: "painting.surfaces", work_area_id: "pt1", value: ["Walls"] },
    { key: "painting.internal_area_m2", work_area_id: "pt1", value: 54 },
    { key: "painting.coats_required", work_area_id: "pt1", value: 2 },
  ];
}

const walls = wa("w1", "internal_walls", "Internal walls", 1);
const plaster = wa("pl1", "plastering", "Plastering", 2);
const paintWa = wa("pt1", "painting", "Painting", 3);

function stoppingReqs(rows: readonly EstimateRequirement[] | undefined) {
  return (rows ?? []).filter(
    (row) => row.componentKey === INTERNAL_WALLS_STOPPING_COMPONENT
  );
}

function stoppingLines(
  rows: readonly { componentKey?: string | null; label?: string }[]
) {
  return rows.filter(
    (row) =>
      row.componentKey === INTERNAL_WALLS_STOPPING_COMPONENT ||
      /stopping/i.test(row.label ?? "")
  );
}

function paintingReqs(rows: readonly EstimateRequirement[] | undefined) {
  return (rows ?? []).filter(
    (row) => row.componentKey === INTERNAL_WALLS_PAINTING_COMPONENT
  );
}

function fingerprintExcludingStopping(params: {
  requirements: readonly EstimateRequirement[];
  lineItems: readonly EstimateLineItemInput[];
}): string {
  const reqs = params.requirements
    .filter((row) => row.componentKey !== INTERNAL_WALLS_STOPPING_COMPONENT)
    .map((row) => {
      const qty =
        "purchaseQuantity" in row
          ? (row as { purchaseQuantity?: number }).purchaseQuantity
          : "baseHours" in row
            ? (row as { baseHours?: number }).baseHours
            : null;
      return [
        row.kind,
        row.workAreaId,
        row.workAreaType,
        row.componentKey,
        row.variantKey ?? "",
        qty ?? "",
        row.provenance.calculatorSource,
      ].join("|");
    })
    .sort();
  const lines = params.lineItems
    .filter((row) => row.componentKey !== INTERNAL_WALLS_STOPPING_COMPONENT)
    .map((row) =>
      [
        row.workAreaId,
        row.componentKey ?? "",
        row.itemKey ?? "",
        row.quantity ?? "",
        row.unit ?? "",
        row.recommendedCost,
        row.recommendedSell,
      ].join("|")
    )
    .sort();
  return createHash("sha256")
    .update(JSON.stringify({ reqs, lines }))
    .digest("hex");
}

function mapCalcLines(
  items: readonly EstimateLineItemInput[]
): EstimateLineItem[] {
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
    includedInTotal: item.includedInTotal,
    overlapGroup: item.overlapGroup,
  }));
}

function reviewFor(result: EstimateResult, workAreas: EstimateWorkArea[]) {
  return composeBuilderReview({
    estimate: {
      recommendedCost: result.lineItems.reduce(
        (sum, item) => sum + (item.recommendedCost ?? 0),
        0
      ),
      recommendedSell: result.lineItems.reduce(
        (sum, item) => sum + (item.recommendedSell ?? 0),
        0
      ),
      marginPercent: 20,
      confidence: result.confidence,
      assumptions: result.assumptions,
      missingInfo: result.missingInfo,
      lineItems: mapCalcLines(result.lineItems),
    },
    workAreas: workAreas.map((row) => ({
      id: row.id,
      type: row.type,
      name: row.name,
      status: "confirmed" as const,
    })),
    requirements: result.requirements ?? [],
  });
}

function finishGroups(review: ReturnType<typeof composeBuilderReview>) {
  return review.workAreas.flatMap((area) =>
    area.categories.flatMap((cat) =>
      cat.lineGroups.filter((group) =>
        /Stopping|Painting|Insulation|Skirting|Cornice|Electrical/i.test(
          `${group.label} ${group.secondary ?? ""}`
        )
      )
    )
  );
}

function toPricingItems(
  items: readonly EstimateLineItemInput[]
): PricingItem[] {
  return items.map((item, index) => ({
    id: `p-${index}`,
    org_id: "org",
    pricing_document_id: "pd",
    project_id: "p1",
    work_area_id: item.workAreaId,
    source_estimate_line_item_id: `est-${index}`,
    component_key: item.componentKey ?? null,
    item_type: mapEstimateCategoryToItemType(item.category),
    delivery_method:
      item.category === "subcontractor" ? "subcontracted" : "in_house",
    internal_label: item.label,
    client_label: item.label,
    internal_description: item.notes ?? null,
    client_description: item.identitySummary ?? null,
    quantity: item.quantity ?? null,
    unit: item.unit ?? null,
    unit_cost: item.costRate ?? null,
    unit_sell: item.sellRate ?? null,
    total_cost: item.recommendedCost ?? 0,
    total_sell: item.recommendedSell ?? 0,
    gross_profit: item.grossProfit ?? 0,
    margin_percent: item.marginPercent ?? 0,
    markup_percent: item.markupPercent ?? 0,
    visible_on_quote: true,
    optional: false,
    sort_order: item.sortOrder ?? index,
    notes_internal: null,
    notes_client: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    manually_edited: false,
    orphaned: false,
    recalibration_note: null,
    calculation_mode: null,
    productivity_rate: null,
    productivity_unit: null,
    calculated_quantity: null,
    cost_known: true,
  }));
}

function moneyOf(
  rows: readonly { recommendedCost?: number; recommendedSell?: number }[]
) {
  return {
    cost: rows.reduce((sum, row) => sum + (row.recommendedCost ?? 0), 0),
    sell: rows.reduce((sum, row) => sum + (row.recommendedSell ?? 0), 0),
  };
}

const physicalSrc = read("lib/estimate/internal-walls-finish-physical.ts");
const composeSrc = read("lib/assistant/clarify/compose.ts");
const finishSrc = read("lib/estimate/internal-walls-finish.ts");

console.log("=== EST-CORRECT-02A ownership input ===\n");
check(
  "money layer no longer hard-codes independentPlastering: true",
  !physicalSrc.includes("independentPlastering: true")
);
check(
  "money layer still consumes confirmedWorkAreas types",
  physicalSrc.includes("confirmedTypes: context.confirmedWorkAreas.map((row) => row.type)")
);
check(
  "question-flow still derives independentPlastering from brief",
  composeSrc.includes("independentPlastering: briefHasIndependentPlastering(")
);
check(
  "XOR helper still omits stopping only when plastering is present and not independent",
  finishSrc.includes("types.has(\"plastering\") && params.independentPlastering !== true") &&
    finishSrc.includes("omitPainting: types.has(\"painting\")")
);
check(
  "confirmed plastering omits IW stopping commercially",
  internalWallsNestedFinishOmit({
    confirmedTypes: ["internal_walls", "plastering"],
  }).omitStopping === true
);
check(
  "no plastering keeps IW stopping commercially",
  internalWallsNestedFinishOmit({
    confirmedTypes: ["internal_walls"],
  }).omitStopping === false
);

const iwFacts = fixtureFacts();
const iwOnlyAreas = [walls];
const iwPlasterAreas = [walls, plaster];
const iwPaintAreas = [walls, paintWa];
const allFacts = [...iwFacts, ...plasteringFacts(), ...paintingFacts()];

const iwOnlyContext = ctx(iwOnlyAreas, iwFacts);
const iwPlasterContext = ctx(iwPlasterAreas, [...iwFacts, ...plasteringFacts()]);
const iwPaintContext = ctx(iwPaintAreas, [...iwFacts, ...paintingFacts()]);
const iwPaintPlasterContext = ctx(
  [walls, plaster, paintWa],
  allFacts
);

const iwOnlyCalc = calculateInternalWalls(iwOnlyContext, walls);
const iwPlasterCalc = calculateInternalWalls(iwPlasterContext, walls);
const plasterCalc = calculatePlastering(iwPlasterContext, plaster);

const iwOnlyEstimate = calculateEstimate(iwOnlyContext);
const iwPlasterEstimate = calculateEstimate(iwPlasterContext);
const iwPaintEstimate = calculateEstimate(iwPaintContext);
const iwPaintPlasterEstimate = calculateEstimate(iwPaintPlasterContext);

console.log("\n=== A. IW only → one valid stopping owner ===\n");
const aStopReq = stoppingReqs(iwOnlyEstimate.requirements);
const aStopLines = stoppingLines(iwOnlyEstimate.lineItems);
const aOwners = [...new Set(aStopReq.map((row) => row.workAreaId))];
check("IW-only emits stopping requirements", aStopReq.length === 2);
check("IW-only stopping work_area_id is Internal Walls", aOwners.join(",") === "w1");
check(
  "IW-only stopping provenance is internal-walls-finish",
  aStopReq.every(
    (row) =>
      row.workAreaId === "w1" &&
      row.workAreaType === "internal_walls" &&
      row.provenance.calculatorSource === "internal-walls-finish"
  )
);
check("IW-only stopping lines exist once per face", aStopLines.length === 2);
check(
  "IW-only no duplicate stopping requirement ids",
  new Set(aStopReq.map((row) => row.requirementId)).size === aStopReq.length
);

console.log("\n=== B. IW + Plastering → no duplicate stopping ===\n");
const bIwStopReq = stoppingReqs(iwPlasterEstimate.requirements);
const bIwStopLines = stoppingLines(
  iwPlasterEstimate.lineItems.filter((row) => row.workAreaId === "w1")
);
const bPlasterLines = iwPlasterEstimate.lineItems.filter(
  (row) => row.workAreaId === "pl1"
);
check("IW stopping requirements omitted when Plastering confirmed", bIwStopReq.length === 0);
check("IW calculator omits stopping lines", stoppingLines(iwPlasterCalc.lineItems).length === 0);
check("Plastering retains its own commercial lines", bPlasterLines.length > 0);
check(
  "Plastering lines keep plastering work_area_id",
  bPlasterLines.every((row) => row.workAreaId === "pl1") && plasterCalc.lineItems.length > 0
);
check(
  "no Internal Walls stopping sell/cost once Plastering owns",
  moneyOf(bIwStopLines).cost === 0 && moneyOf(bIwStopLines).sell === 0
);
const bStopOwners = [
  ...new Set(
    [
      ...stoppingReqs(iwPlasterEstimate.requirements).map((row) => row.workAreaId),
      ...bPlasterLines.map((row) => row.workAreaId),
    ]
  ),
];
check(
  "stopping commercial owner is the Plastering Work Area only",
  bStopOwners.join(",") === "pl1"
);

console.log("\n=== C. stopping answered before Plastering confirm ===\n");
check(
  "pre-confirm facts still contain IW stopping answers",
  iwFacts.some(
    (row) =>
      row.key === "internal_walls.wall_types" ||
      row.key === INTERNAL_WALLS_STOPPING_SIDE_A_KEY
  ) &&
    JSON.stringify(iwFacts).includes("level_4")
);
check(
  "same facts + later Plastering confirm drops stale IW stopping",
  stoppingReqs(iwOnlyEstimate.requirements).length === 2 &&
    stoppingReqs(iwPlasterEstimate.requirements).length === 0
);
check(
  "IW lining still present after Plastering confirm",
  (iwPlasterEstimate.requirements ?? []).some(
    (row) =>
      row.workAreaId === "w1" &&
      row.componentKey === internalWallsLiningMaterialComponent("standard_gib")
  )
);

console.log("\n=== D. Painting XOR unchanged ===\n");
check(
  "IW-only still emits nested painting",
  paintingReqs(iwOnlyEstimate.requirements).length === 2
);
check(
  "Painting WA omits nested IW painting",
  paintingReqs(iwPaintEstimate.requirements).length === 0 &&
    internalWallsNestedFinishOmit({
      confirmedTypes: ["internal_walls", "painting"],
    }).omitPainting === true
);
check(
  "Painting XOR still holds with Plastering present",
  paintingReqs(iwPaintPlasterEstimate.requirements).length === 0 &&
    calculatePainting(iwPaintPlasterContext, paintWa).lineItems.length > 0
);
check(
  "Plastering confirm does not omit IW painting by itself",
  paintingReqs(iwPlasterEstimate.requirements).length === 2
);
check(
  "question-flow independent plaster still does not hide new-wall stopping questions",
  internalWallsNestedFinishOmit({
    confirmedTypes: ["internal_walls", "plastering"],
    independentPlastering: true,
  }).omitStopping === false
);

console.log("\n=== E. work_area_id / provenance ===\n");
check(
  "IW-only stopping requirementId binds to w1",
  aStopReq.every((row) => row.requirementId.startsWith("w1:"))
);
check(
  "IW-only stopping line workAreaId is w1",
  aStopLines.every((row) => (row as EstimateLineItemInput).workAreaId === "w1")
);
check(
  "IW+Plastering estimate keeps distinct Work Area identities",
  iwPlasterEstimate.lineItems.some((row) => row.workAreaId === "w1") &&
    iwPlasterEstimate.lineItems.some((row) => row.workAreaId === "pl1") &&
    iwPlasterEstimate.lineItems.every(
      (row) => row.workAreaId === "w1" || row.workAreaId === "pl1"
    )
);
check(
  "IW non-stopping requirements keep internal-walls provenance",
  (iwPlasterEstimate.requirements ?? [])
    .filter(
      (row) =>
        row.workAreaId === "w1" &&
        row.componentKey !== INTERNAL_WALLS_STOPPING_COMPONENT
    )
    .every((row) => row.workAreaType === "internal_walls")
);

console.log("\n=== F. calculator fingerprint outside stopping ===\n");
const fpOnly = fingerprintExcludingStopping({
  requirements: iwOnlyCalc.requirements ?? [],
  lineItems: iwOnlyCalc.lineItems,
});
const fpWithPlaster = fingerprintExcludingStopping({
  requirements: iwPlasterCalc.requirements ?? [],
  lineItems: iwPlasterCalc.lineItems,
});
check(
  "IW calculator fingerprint unchanged outside stopping ownership",
  fpOnly === fpWithPlaster && fpOnly.length === 64
);
const liningOnly = (iwOnlyCalc.requirements ?? []).find(
  (row) => row.componentKey === internalWallsLiningMaterialComponent("standard_gib")
);
const liningWith = (iwPlasterCalc.requirements ?? []).find(
  (row) => row.componentKey === internalWallsLiningMaterialComponent("standard_gib")
);
check(
  "lining quantity math unchanged",
  liningOnly != null &&
    liningWith != null &&
    JSON.stringify(liningOnly) === JSON.stringify(liningWith)
);

console.log("\n=== Commercial / Builder Review / Pricing / Quote ===\n");
const reviewOnly = reviewFor(iwOnlyEstimate, iwOnlyAreas);
const reviewBoth = reviewFor(iwPlasterEstimate, iwPlasterAreas);
const reviewOnlyStop = finishGroups(reviewOnly).filter(
  (row) => /Stopping/i.test(`${row.label} ${row.secondary ?? ""}`)
);
const reviewBothStop = finishGroups(reviewBoth).filter(
  (row) => /Stopping/i.test(`${row.label} ${row.secondary ?? ""}`)
);
check("Builder Review IW-only shows Stopping once", reviewOnlyStop.length === 1);
check(
  "Builder Review IW+Plastering does not show duplicate IW Stopping",
  reviewBothStop.length === 0
);

const pricingOnly = toPricingItems(iwOnlyEstimate.lineItems);
const pricingBoth = toPricingItems(iwPlasterEstimate.lineItems);
const pricingStopOnly = pricingOnly.filter(
  (row) => row.component_key === INTERNAL_WALLS_STOPPING_COMPONENT
);
const pricingStopBoth = pricingBoth.filter(
  (row) => row.component_key === INTERNAL_WALLS_STOPPING_COMPONENT
);
check("Pricing IW-only receives IW stopping lines", pricingStopOnly.length === 2);
check(
  "Pricing IW+Plastering does not receive IW stopping lines",
  pricingStopBoth.length === 0
);
check(
  "Pricing plastering lines keep plastering work_area_id",
  pricingBoth.filter((row) => row.work_area_id === "pl1").length ===
    iwPlasterEstimate.lineItems.filter((row) => row.workAreaId === "pl1").length
);

const names = new Map([
  ["w1", "Internal walls"],
  ["pl1", "Plastering"],
]);
const quoteOnly = mapPricingItemsToQuoteItems(pricingOnly, names);
const quoteBoth = mapPricingItemsToQuoteItems(pricingBoth, names);
check(
  "quote provenance IW-only stopping stays on Internal Walls",
  quoteOnly.filter((row) => /stopping/i.test(row.label)).every(
    (row) => row.work_area_id === "w1" && row.section_title === "Internal walls"
  ) && quoteOnly.filter((row) => /stopping/i.test(row.label)).length === 2
);
check(
  "quote provenance IW+Plastering has no IW stopping lines",
  quoteBoth.filter((row) => /stopping/i.test(row.label)).length === 0
);
check(
  "quote plastering section keeps plastering work_area_id",
  quoteBoth.some(
    (row) => row.work_area_id === "pl1" && row.section_title === "Plastering"
  )
);

const iwQuote = buildWorkAreaQuoteDescriptionDraft({
  type: "internal_walls",
  name: "Internal walls",
  facts: [
    {
      key: "internal_walls.job_scope",
      label: "Wall work",
      value: "New partition",
    },
    {
      key: "internal_walls.wall_types",
      label: "Wall types",
      value: JSON.stringify(
        iwFacts.find((row) => row.key === "internal_walls.wall_types")?.value
      ),
    },
  ],
});
  const plasterQuote = buildWorkAreaQuoteDescriptionDraft({
  type: "plastering",
  name: "Plastering",
  facts: plasteringFacts().map((row) => ({
    key: row.key,
    label: row.key,
    value: String(row.value ?? ""),
  })),
});
check("IW quote draft still does not expose requirement keys", !/internal_walls\.stopping/i.test(iwQuote));
check("Plastering quote draft retains plastering ownership language", /plaster/i.test(plasterQuote));

const bothStopSell =
  moneyOf(stoppingLines(iwPlasterEstimate.lineItems.filter((row) => row.workAreaId === "w1"))).sell +
  moneyOf(bPlasterLines).sell;
const plasterOnlySell = moneyOf(plasterCalc.lineItems).sell;
check(
  "IW+Plastering does not double-count plastering/stopping sell",
  Math.abs(bothStopSell - plasterOnlySell) < 1e-6
);

if (failed > 0) {
  console.log(`\nFAILED ${failed}  passed ${passed}`);
  process.exit(1);
}
console.log(`\nOK  ${passed} checks`);
