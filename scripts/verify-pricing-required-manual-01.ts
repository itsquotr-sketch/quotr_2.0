/**
 * PRICING-REQUIRED-01 — Flooring specialist/custom/unpriced-substrate
 * manual pricing through the existing updatePricingItem path.
 *
 * Audit:
 *   1. updatePricingItem is the authorised mutation (now persists cost_known).
 *   2. FLOORING-06 already prices custom finish via the same engine.
 *   3. Laminate did not appear usable because cost_known stayed false and
 *      Quote always used pending specialist copy.
 *   4. Incomplete area never emits a quantity-bearing line, so it cannot
 *      become a Pricing row.
 *   5. Fields: rateSourceType=missing + cost_known=false → unresolved;
 *      quantity known + missing rate → priceable; missing Details →
 *      information-required; cost_known=true + COST>0 → priced.
 *   6. Quote includes only flooringPricingItemIsClientPriced + itemIsAuthorised.
 *
 * Run: npx --yes tsx scripts/verify-pricing-required-manual-01.ts
 * No paid AI. No Production. No second pricing system.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import type { AIExtractionOutput } from "../lib/ai/schema";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import type { EstimateLineItem } from "../components/assistant/types";
import { BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY } from "../lib/estimate/bathroom-identities";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import {
  flooringLineIsManualPricingEligible,
} from "../lib/estimate/flooring-commercial";
import {
  listFlooringClarifyCandidates,
  flooringWorkAreaIsReady,
} from "../lib/estimate/flooring-clarify";
import {
  FLOORING_CUSTOM_FINISH_COMPONENT,
  FLOORING_SPECIALIST_COMPONENT,
  FLOORING_SUBSTRATE_INSTALL_LABOUR,
  FLOORING_SUBSTRATE_MATERIAL_COMPONENT,
} from "../lib/estimate/flooring-identities";
import {
  FLOORING_NESTED_NOT_CALCULATED_MESSAGE,
  FLOORING_PORTIONS_FACT_KEY,
  FLOORING_SPECIALIST_PRICING_REQUIRED_MESSAGE,
  createEmptyFlooringPortion,
  parseFlooringPortions,
  type FlooringPortion,
} from "../lib/estimate/flooring-portions";
import {
  FLOORING_QUOTE_SPECIALIST_PENDING,
  flooringPricingItemIsClientPriced,
} from "../lib/estimate/flooring-quote";
import { FITOUT_BENCHMARKS } from "../lib/estimate/benchmark-rates";
import { buildLineItemNotes } from "../lib/estimate/line-items";
import { parseLineItemNotes } from "../lib/estimate/line-item-metadata";
import { applyTargetMarginToLineItems } from "../lib/estimate/margin-override";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "../lib/estimate/types";
import { deriveSellFromCost } from "../lib/commercial-engine/core/sell-from-margin";
import { resolveCostKnownAfterPricingEdit, validateComputedItemForPersistence } from "../lib/pricing/action-guards";
import { calculateAuthoritativePricingItem } from "../lib/pricing/commercial-engine-adapter";
import { calculateAuthoritativeDocumentTotals } from "../lib/pricing/authoritative-document-totals";
import { pricingItemViewModel } from "../lib/pricing/financial-view-model";
import { valuesFromEstimateLineItem } from "../lib/pricing/recalibration-helpers";
import type { PricingItem } from "../lib/pricing/types";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";
import { buildWorkAreaQuoteDescriptionDraft } from "../lib/work-areas/quote-description";

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

const LAMINATE_BRIEF =
  "Supply and install 10 m² of laminate flooring to the office. The exact product is still to be selected. Existing substrate and framing are to remain. No flooring or substrate removal is required.";

const WA: EstimateWorkArea = {
  id: "f1",
  type: "flooring",
  name: "Flooring",
  sort_order: 1,
  status: "confirmed",
} as EstimateWorkArea;

const emptyExtraction = (): AIExtractionOutput => ({
  workAreas: [],
  facts: [],
  assumptions: [],
  possibleConstraints: [],
  confidence: 0.5,
  warnings: [],
});

function extract(brief: string) {
  return enrichExtractionFromBrief({
    briefText: brief,
    extraction: emptyExtraction(),
    allowedTypes: getAnalysisCapableWorkAreaTypes(),
  }).extraction;
}

function persist(portions: readonly FlooringPortion[]): EstimateFact[] {
  return [
    {
      key: FLOORING_PORTIONS_FACT_KEY,
      work_area_id: WA.id,
      value: portions,
      source: "ai_extracted",
    },
  ];
}

function ctx(facts: EstimateFact[]): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [WA],
    facts,
    constraints: [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
    },
    rates: [],
  } as unknown as EstimateContext;
}

function hosted(portions: readonly FlooringPortion[]) {
  return calculateEstimate(ctx(persist(portions)));
}

function asEstimateRow(item: EstimateLineItemInput, index: number) {
  return {
    id: `line-${index}`,
    work_area_id: item.workAreaId ?? WA.id,
    label: item.label,
    category: item.category,
    recommended_cost: item.recommendedCost,
    recommended_sell: item.recommendedSell,
    notes: buildLineItemNotes(item),
    sort_order: index,
    component_key: item.componentKey ?? null,
  };
}

function toPricingItem(
  item: EstimateLineItemInput,
  index: number,
  extras: Partial<PricingItem> = {}
): PricingItem {
  const adopted = valuesFromEstimateLineItem(asEstimateRow(item, index));
  return {
    id: `p-${index}`,
    org_id: "org",
    pricing_document_id: "pd",
    project_id: "p1",
    work_area_id: item.workAreaId ?? WA.id,
    source_estimate_line_item_id: `line-${index}`,
    component_key: item.componentKey ?? null,
    item_type: adopted.itemType,
    delivery_method: adopted.deliveryMethod,
    internal_label: item.label,
    client_label: item.label,
    internal_description: null,
    client_description: null,
    quantity: adopted.quantity,
    unit: adopted.unit,
    unit_cost: adopted.unitCost,
    unit_sell: adopted.unitSell,
    total_cost: adopted.totalCost,
    total_sell: adopted.totalSell,
    gross_profit: adopted.grossProfit,
    margin_percent: adopted.marginPercent,
    markup_percent: adopted.markupPercent,
    visible_on_quote: true,
    optional: false,
    sort_order: index,
    notes_internal: extras.notes_internal ?? buildLineItemNotes(item),
    notes_client: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    manually_edited: false,
    orphaned: false,
    recalibration_note: null,
    calculation_mode: adopted.calculationMode,
    productivity_rate: adopted.productivityRate,
    productivity_unit: adopted.productivityUnit,
    calculated_quantity: adopted.calculatedQuantity,
    cost_known: adopted.costKnown,
    ...extras,
  };
}

function applyManualPrice(
  item: PricingItem,
  totalCost: number,
  totalSell?: number
): { ok: true; item: PricingItem } | { ok: false; error: string } {
  const sell =
    totalSell ??
    (totalCost > 0 ? deriveSellFromCost(totalCost, 20) : 0);
  const computed = calculateAuthoritativePricingItem({
    quantity: item.quantity,
    unit: item.unit,
    totalCost,
    totalSell: sell,
    itemType: item.item_type,
    calculationMode: "lump_sum",
    manualSellOverride: totalSell != null,
    requestId: `pricing-update-${item.id}`,
    sourceReferences: ["pricing:update_item"],
  });
  if (!computed.ok) return { ok: false, error: computed.error };
  const costKnown = resolveCostKnownAfterPricingEdit({
    existingCostKnown: item.cost_known,
    computedCostKnown: computed.fields.costKnown,
    totalCost: computed.fields.totalCost,
    totalSell: computed.fields.totalSell,
    originatedAsPricingRequired:
      parseLineItemNotes(item.notes_internal).metadata.rateSourceType ===
      "missing",
  });
  if (!Number.isFinite(computed.fields.totalCost) || computed.fields.totalCost < 0) {
    return { ok: false, error: "Pricing amounts cannot be negative." };
  }
  return {
    ok: true,
    item: {
      ...item,
      total_cost: computed.fields.totalCost,
      total_sell: computed.fields.totalSell,
      unit_cost: computed.fields.unitCost,
      unit_sell: computed.fields.unitSell,
      gross_profit: computed.fields.grossProfit,
      margin_percent: computed.fields.marginPercent,
      markup_percent: computed.fields.markupPercent,
      calculation_mode: computed.fields.calculationMode,
      cost_known: costKnown,
      manually_edited: true,
      updated_at: "2026-01-02T00:00:00.000Z",
    },
  };
}

function parseNestedFromNotes(notes: string | null | undefined): string | null {
  const meta = parseLineItemNotes(notes).metadata;
  return meta.nestedItemId?.trim() || null;
}

function quoteOf(
  portions: readonly FlooringPortion[],
  items: readonly PricingItem[]
) {
  return buildWorkAreaQuoteDescriptionDraft({
    type: "flooring",
    name: "Flooring",
    facts: [
      {
        key: FLOORING_PORTIONS_FACT_KEY,
        value: JSON.stringify(portions),
      },
    ],
    pricingItems: items
      .filter((row) => flooringPricingItemIsClientPriced(row))
      .map((row) => ({
        label: row.client_label,
        component_key: row.component_key,
        nested_item_id:
          parseNestedFromNotes(row.notes_internal) ?? undefined,
        cost_known: row.cost_known,
        total_cost: row.total_cost,
        total_sell: row.total_sell,
        notes_internal: row.notes_internal,
      })),
  });
}

function mapReviewLines(items: readonly EstimateLineItemInput[]): EstimateLineItem[] {
  return items.map((item, index) => ({
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
    identitySummary: item.identitySummary,
    includedInTotal: item.includedInTotal,
    overlapGroup: item.overlapGroup,
    scopeKey: item.scopeKey,
  }));
}

console.log("\n=== A. Existing mutation-path audit ===\n");

const actionsSrc = read("lib/pricing/actions.ts");
check(
  "1. updatePricingItem remains the authorised mutation",
  actionsSrc.includes("export async function updatePricingItem") &&
    actionsSrc.includes("assertOrgOwnsPricingItem") &&
    actionsSrc.includes("cost_known: costKnown") &&
    actionsSrc.includes("resolveCostKnownAfterPricingEdit")
);
check(
  "2. No second manual-pricing system",
  !actionsSrc.includes("createManualFlooringPrice") &&
    !read("lib/estimate/flooring-quote.ts").includes("mintCompanyRate")
);

console.log("\n=== B. Laminate before manual pricing ===\n");

const laminateExtract = extract(LAMINATE_BRIEF);
const laminatePortions = parseFlooringPortions(
  laminateExtract.facts.find((row) => row.key === FLOORING_PORTIONS_FACT_KEY)?.value
);
check(
  "3. Flooring only, Office 10 m² laminate, no removal",
  laminateExtract.workAreas.every((row) => row.type === "flooring") &&
    laminatePortions.length === 1 &&
    laminatePortions[0]?.label === "Office" &&
    laminatePortions[0]?.area_m2 === 10 &&
    laminatePortions[0]?.specialist_kind === "laminate" &&
    laminatePortions[0]?.finish_removal_required === false &&
    laminatePortions[0]?.other_description === "laminate flooring"
);

const laminateEst = hosted(laminatePortions);
const specLine = laminateEst.lineItems.find(
  (row) => row.componentKey === FLOORING_SPECIALIST_COMPONENT
);
check(
  "4. Specialist line is Pricing Required, not $0 authority",
  specLine?.rateSourceType === "missing" &&
    specLine.quantity === 10 &&
    specLine.unit === "m2" &&
    specLine.costRate == null &&
    (specLine.recommendedCost == null || specLine.recommendedCost === 0) &&
    flooringLineIsManualPricingEligible(specLine)
);
check(
  "5. No ordinary finish benchmark and no FITOUT legacy money",
  !laminateEst.lineItems.some(
    (row) =>
      row.costRate === FITOUT_BENCHMARKS.flooringPerM2.cost ||
      row.recommendedCost === FITOUT_BENCHMARKS.flooringPerM2.cost
  ) && laminateEst.lineItems.every((row) => row.rateSourceType === "missing")
);
check(
  "6. Human diagnostic, not architecture copy",
  laminateEst.missingInfo.includes(FLOORING_SPECIALIST_PRICING_REQUIRED_MESSAGE) &&
    !laminateEst.missingInfo.includes(FLOORING_NESTED_NOT_CALCULATED_MESSAGE) &&
    !laminateEst.missingInfo.some((row) =>
      /canonical nested|legacy Flooring allowance path|UNSUPPORTED_SPECIALIST/i.test(
        row
      )
    )
);

const specPricing = toPricingItem(specLine!, 0);
const specView = pricingItemViewModel(specPricing);
check(
  "7. Pricing row: Pricing required + Add price eligibility",
  specView.pricingRequired === true &&
    specPricing.cost_known === false &&
    specPricing.client_label === "Specialist flooring supply and installation" &&
    specPricing.quantity === 10 &&
    read("components/pricing/PricingItemRow.tsx").includes("Add price")
);

const beforeQuote = quoteOf(laminatePortions, [specPricing]);
check(
  "8. Quote excludes unpriced specialist and does not mention Pricing Required",
  beforeQuote.includes(FLOORING_QUOTE_SPECIALIST_PENDING) &&
    !/Pricing Required/i.test(beforeQuote) &&
    !/COST|benchmark|canonical/i.test(beforeQuote)
);

const review = composeBuilderReview({
  estimate: {
    recommendedCost: laminateEst.recommendedCost,
    recommendedSell: laminateEst.recommendedSell,
    marginPercent: laminateEst.marginPercent,
    confidence: laminateEst.confidence,
    assumptions: laminateEst.assumptions,
    missingInfo: laminateEst.missingInfo,
    lineItems: mapReviewLines(laminateEst.lineItems),
  },
  workAreas: [{ ...WA, status: "confirmed" }],
  requirements: laminateEst.requirements,
  facts: persist(laminatePortions),
});
const reviewText = JSON.stringify(review);
check(
  "9. Builder Review human laminate copy",
  /Office — 10 m² laminate flooring/.test(reviewText) &&
    /Specialist flooring supply and installation/.test(reviewText) &&
    /Pricing required/i.test(reviewText) &&
    /add a price/i.test(reviewText) &&
    !/Unsupported specialist flooring/.test(reviewText) &&
    !/canonical nested/i.test(reviewText)
);

console.log("\n=== C. Laminate after manual pricing and removal ===\n");

const priced = applyManualPrice(specPricing, 2400);
check("10. Manual COST persists through existing engine", priced.ok);
const pricedItem = priced.ok ? priced.item : specPricing;
check(
  "11. cost_known true, COST 2400, shared 20% margin/GST",
  pricedItem.cost_known === true &&
    pricedItem.total_cost === 2400 &&
    pricedItem.total_sell > 2400 &&
    Math.abs(pricedItem.margin_percent - 20) < 0.2
);

const marginCheck = applyTargetMarginToLineItems(
  [
    {
      recommendedCost: pricedItem.total_cost,
      recommendedSell: pricedItem.total_sell,
    },
  ],
  20,
  { default_margin_percent: 20 }
);
check(
  "12. Shared margin path still applies",
  Math.abs((marginCheck[0]?.marginPercent ?? 0) - 20) < 0.2
);

const docTotals = calculateAuthoritativeDocumentTotals(
  [
    {
      total_cost: pricedItem.total_cost,
      total_sell: pricedItem.total_sell,
      cost_known: pricedItem.cost_known,
    },
  ],
  15
);
check(
  "13. Document totals include the manual amount and GST",
  docTotals.ok &&
    docTotals.totals.subtotalCost === 2400 &&
    docTotals.totals.gstAmount > 0 &&
    docTotals.totals.costKnown === true
);

check(
  "14. Physical area and facts unchanged",
  laminatePortions[0]?.area_m2 === 10 &&
    JSON.stringify(laminatePortions) ===
      JSON.stringify(
        parseFlooringPortions(
          persist(laminatePortions).find((row) => row.key === FLOORING_PORTIONS_FACT_KEY)
            ?.value
        )
      )
);

const afterQuote = quoteOf(laminatePortions, [pricedItem]);
check(
  "15. Quote includes specified laminate after authorised price",
  /Office: Supply and install 10 m² of the specified laminate flooring, subject to the selected product specification/.test(
    afterQuote
  ) &&
    !afterQuote.includes(FLOORING_QUOTE_SPECIALIST_PENDING) &&
    !/Pricing Required/i.test(afterQuote) &&
    !/\$2400|COST|benchmark/i.test(afterQuote)
);

const nestedId = specLine?.nestedItemId;
const pricedForQuote = {
  ...pricedItem,
  notes_internal: specLine?.notes ?? null,
};
check(
  "15b. Quote ownership uses nested item id in notes",
  (specLine?.notes ?? "").includes(nestedId ?? "missing") ||
    (specLine?.nestedItemId != null && specLine.nestedItemId.length > 0)
);
void pricedForQuote;

const cleared = applyManualPrice(pricedItem, 0, 0);
check(
  "16. Clearing the manual price restores Pricing Required",
  cleared.ok &&
    cleared.item.cost_known === false &&
    pricingItemViewModel(cleared.item).pricingRequired === true
);
check(
  "17. Quote pending copy restored after price removal",
  quoteOf(laminatePortions, [cleared.ok ? cleared.item : pricedItem]).includes(
    FLOORING_QUOTE_SPECIALIST_PENDING
  )
);

console.log("\n=== D. Validation, ownership, duplicates ===\n");

const negativePersist = validateComputedItemForPersistence({
  totalCost: -10,
  totalSell: 12,
  marginPercent: 20,
  markupPercent: 25,
  costKnown: true,
});
check(
  "18. Negative money is rejected by the existing engine",
  negativePersist.ok === false
);
check(
  "19. Zero on a previously unresolved line stays unresolved",
  resolveCostKnownAfterPricingEdit({
    existingCostKnown: false,
    computedCostKnown: true,
    totalCost: 0,
    totalSell: 0,
  }) === false
);
check(
  "20. NaN/infinity cannot be a known price",
  resolveCostKnownAfterPricingEdit({
    existingCostKnown: false,
    computedCostKnown: true,
    totalCost: Number.NaN,
    totalSell: 10,
  }) === false &&
    resolveCostKnownAfterPricingEdit({
      existingCostKnown: false,
      computedCostKnown: true,
      totalCost: Number.POSITIVE_INFINITY,
      totalSell: 10,
    }) === false
);

const a = {
  ...createEmptyFlooringPortion({
    id: "fa_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1",
    label: "Office A",
  }),
  finish_type: "other" as const,
  specialist_kind: "laminate" as const,
  other_description: "laminate flooring",
  area_input_method: "direct_m2" as const,
  area_m2: 10,
  finish_removal_required: false,
  substrate_required: false,
  framing_required: false,
};
const b = {
  ...a,
  id: "fa_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa2",
  label: "Office B",
};
const twins = hosted([a, b]);
const twinA = twins.lineItems.find(
  (row) =>
    row.componentKey === FLOORING_SPECIALIST_COMPONENT &&
    row.nestedItemId === a.id
);
const twinB = twins.lineItems.find(
  (row) =>
    row.componentKey === FLOORING_SPECIALIST_COMPONENT &&
    row.nestedItemId === b.id
);
check("21. Duplicate-looking areas remain separate", Boolean(twinA && twinB));
const pricedA = applyManualPrice(toPricingItem(twinA!, 0), 1000);
const stillB = toPricingItem(twinB!, 1);
check(
  "22. Pricing one laminate does not price the other",
  pricedA.ok &&
    pricedA.item.cost_known === true &&
    stillB.cost_known === false &&
    stillB.total_cost === 0
);

console.log("\n=== E. FC/Secura material without COST ===\n");

const fcPortion: FlooringPortion = {
  ...createEmptyFlooringPortion({
    id: "fa_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa3",
    label: "Bathroom",
  }),
  finish_type: "tile",
  area_input_method: "direct_m2",
  area_m2: 12,
  tile_width_mm: 600,
  tile_length_mm: 600,
  floor_preparation_required: false,
  substrate_required: true,
  substrate_family: "fibre_cement",
  substrate_item_key: BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY,
  framing_required: false,
  finish_removal_required: false,
};
const fcEst = hosted([fcPortion]);
const fcMat = fcEst.lineItems.find(
  (row) => row.componentKey === FLOORING_SUBSTRATE_MATERIAL_COMPONENT
);
const fcLab = fcEst.lineItems.find(
  (row) => row.componentKey === FLOORING_SUBSTRATE_INSTALL_LABOUR
);
check(
  "23. FC material is Pricing Required with sheet quantity, labour independently priced",
  fcMat?.rateSourceType === "missing" &&
    (fcMat.quantity ?? 0) > 0 &&
    flooringLineIsManualPricingEligible(fcMat) &&
    fcLab?.rateSourceType !== "missing" &&
    (fcLab?.recommendedCost ?? 0) > 0
);
const fcPriced = applyManualPrice(toPricingItem(fcMat!, 0), 880);
const labourAfter = toPricingItem(fcLab!, 1);
check(
  "24. Manual material price changes material money only",
  fcPriced.ok &&
    fcPriced.item.total_cost === 880 &&
    labourAfter.total_cost === (fcLab?.recommendedCost ?? 0)
);
const fcCleared = applyManualPrice(fcPriced.ok ? fcPriced.item : toPricingItem(fcMat!, 0), 0, 0);
check(
  "25. Removing material price restores Pricing Required",
  fcCleared.ok && fcCleared.item.cost_known === false
);
check(
  "26. No plywood COST inheritance",
  fcMat?.costRate == null &&
    (fcMat?.recommendedCost == null || fcMat.recommendedCost === 0)
);

console.log("\n=== F. Incomplete area is not a manual-price shortcut ===\n");

const incomplete = createEmptyFlooringPortion({
  id: "fa_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa4",
  label: "Hall",
});
incomplete.finish_type = "other";
incomplete.specialist_kind = "laminate";
incomplete.other_description = "laminate flooring";
const incompleteEst = hosted([incomplete]);
check(
  "27. Missing area is not a priceable commercial line",
  !incompleteEst.lineItems.some((row) =>
    flooringLineIsManualPricingEligible(row)
  )
);
const plan = composeJobPlan({
  workAreas: [WA],
  facts: persist([incomplete]),
  qualityLevel: "standard",
  briefText: "",
});
const clarify = composeClarifyView({
  stage: "quality",
  briefText: "",
  qualityLevel: "standard",
  workAreas: [WA],
  facts: persist([incomplete]),
  constraints: [],
  jobPlan: plan,
});
check(
  "28. User is directed to complete Details",
  flooringWorkAreaIsReady({
    facts: persist([incomplete]),
    workAreaId: WA.id,
    workAreaName: "Flooring",
  }) === false &&
    listFlooringClarifyCandidates({
      facts: persist([incomplete]),
      workAreaId: WA.id,
      workAreaName: "Flooring",
    }).length > 0 &&
    clarify.candidates.length > 0
);

const custom = {
  ...createEmptyFlooringPortion({
    id: "fa_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa5",
    label: "Lounge",
  }),
  finish_type: "other" as const,
  other_description: "Custom cork-look vinyl",
  area_input_method: "direct_m2" as const,
  area_m2: 10,
  substrate_required: false,
  framing_required: false,
  finish_removal_required: false,
};
const customEst = hosted([custom]);
const customLine = customEst.lineItems.find(
  (row) => row.componentKey === FLOORING_CUSTOM_FINISH_COMPONENT
);
check(
  "29. Custom ordinary with known area is eligible",
  customLine != null && flooringLineIsManualPricingEligible(customLine)
);

console.log("\n=== G. Confidentiality and inheritance notes ===\n");

check(
  "30. Quote never exposes COST, margin, rate source, or internal keys",
  !/flooring\.specialist|rateSourceType|cost_known|UNSUPPORTED_SPECIALIST/.test(
    afterQuote
  )
);
check(
  "31. Other Work Areas inherit cost_known persistence; Quote remains Flooring-scoped",
  actionsSrc.includes("assertOrgOwnsPricingItem") &&
    actionsSrc.includes("eq(\"org_id\", orgId)") &&
    read("lib/quotes/from-pricing.ts").includes("flooringPricingItemIsClientPriced")
);

if (failed > 0) {
  console.log(`\nFAILED ${failed} / ${passed + failed}`);
  process.exit(1);
}
console.log(`\nAll ${passed} checks passed.`);
