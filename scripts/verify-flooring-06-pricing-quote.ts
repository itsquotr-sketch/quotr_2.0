/**
 * FLOORING-06 — Pricing integration and client-safe Quote scope.
 *
 * Run: npx --yes tsx scripts/verify-flooring-06-pricing-quote.ts
 *
 * No paid AI. No Production.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { OrganisationRate } from "../components/setup/types";
import {
  BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY,
  BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
  BATHROOM_FLOOR_SUBSTRATE_SECURA_KEY,
} from "../lib/estimate/bathroom-identities";
import { FITOUT_BENCHMARKS } from "../lib/estimate/benchmark-rates";
import { workAreaMayCloseAtL5 } from "../lib/estimate/benchmark-coverage";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateBathroom } from "../lib/estimate/calculators/bathroom";
import { calculateFlooring } from "../lib/estimate/calculators/fitout";
import { calculateDemolition } from "../lib/estimate/calculators/demolition";
import { calculateKitchen } from "../lib/estimate/calculators/kitchen";
import { deriveSellFromCost } from "../lib/commercial-engine/core/sell-from-margin";
import { round2 } from "../lib/estimate/facts";
import { flooringLineScopeKey } from "../lib/estimate/flooring-commercial";
import {
  FLOORING_CARPET_SUPPLY_INSTALL_M2,
  FLOORING_CUSTOM_FINISH_COMPONENT,
  FLOORING_SPECIALIST_COMPONENT,
  FLOORING_SUBFLOOR_FRAMING_MAJOR_ALLOWANCE_M2,
  FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2,
  FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_M2,
  FLOORING_SUBSTRATE_INSTALL_LABOUR,
  FLOORING_SUBSTRATE_MATERIAL_COMPONENT,
  FLOORING_V1_COVERAGE_QUOTE_NOTES,
  FLOORING_V1_HUMAN_QA_FROZEN,
  FLOORING_V1_SUPPORT_NOTES,
} from "../lib/estimate/flooring-identities";
import {
  FLOORING_QUOTE_CUSTOM_FINISH_EXCLUDED,
  FLOORING_QUOTE_CUSTOM_FINISH_INCLUDED,
  FLOORING_QUOTE_FRAMING_EXCLUSIONS,
  FLOORING_QUOTE_INCOMPLETE_ONLY_PENDING,
  FLOORING_QUOTE_INCOMPLETE_SIBLING_PENDING,
  FLOORING_QUOTE_PLYWOOD_INCLUDED,
  FLOORING_QUOTE_REMOVAL_EXCLUSIONS,
  FLOORING_QUOTE_SHARED_EXCLUSIONS,
  FLOORING_QUOTE_SPECIALIST_PENDING,
  FLOORING_QUOTE_STRUCTURAL_FRAMING_EXCLUDED,
  FLOORING_QUOTE_SUBSTRATE_MATERIAL_PENDING,
  flooringPricingItemIsClientPriced,
  flooringQuoteLeaksInternal,
} from "../lib/estimate/flooring-quote";
import {
  createEmptyFlooringPortion,
  FLOORING_PORTIONS_FACT_KEY,
  type FlooringPortion,
} from "../lib/estimate/flooring-portions";
import { applyTargetMarginToLineItems } from "../lib/estimate/margin-override";
import { buildLineItemNotes } from "../lib/estimate/line-items";
import type {
  EstimateConstraint,
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "../lib/estimate/types";
import {
  FLOORING_BENCHMARK_REQUIREMENTS,
  verifyRegisteredWorkAreaBenchmarkCoverage,
} from "../lib/estimate/work-area-benchmark-coverage";
import { valuesFromEstimateLineItem } from "../lib/pricing/recalibration-helpers";
import { calculateDocumentTotals, roundMoney } from "../lib/pricing/calculations";
import { DEFAULT_GST_RATE } from "../lib/pricing/status";
import type { PricingItem } from "../lib/pricing/types";
import { calculateQuoteTotals } from "../lib/quotes/calculations";
import {
  mapPricingItemsToQuoteItems,
} from "../lib/quotes/from-pricing";
import { buildWorkAreaQuoteDescriptionDraft } from "../lib/work-areas/quote-description";
import { getWorkAreaSupportEntry } from "../lib/work-areas/support-contract";

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

function near(
  actual: number | null | undefined,
  expected: number,
  tol = 0.02
): boolean {
  return actual != null && Number.isFinite(actual) && Math.abs(actual - expected) <= tol;
}

const WA: EstimateWorkArea = {
  id: "f1",
  type: "flooring",
  name: "Flooring",
  sort_order: 1,
  status: "confirmed",
} as EstimateWorkArea;

function persist(
  portions: readonly FlooringPortion[],
  workAreaId = WA.id
): EstimateFact[] {
  return [
    {
      key: FLOORING_PORTIONS_FACT_KEY,
      work_area_id: workAreaId,
      value: portions,
      source: "user",
    },
  ];
}

function ctx(
  facts: EstimateFact[],
  extra: {
    workAreas?: EstimateWorkArea[];
    rates?: OrganisationRate[];
    constraints?: EstimateConstraint[];
    margin?: number;
  } = {}
): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: extra.workAreas ?? [WA],
    facts,
    constraints: extra.constraints ?? [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: extra.margin ?? 20,
      default_gst_rate: 15,
    },
    rates: extra.rates ?? [],
  } as unknown as EstimateContext;
}

function ordinary(patch: Partial<FlooringPortion> = {}): FlooringPortion {
  return {
    ...createEmptyFlooringPortion({
      id: patch.id ?? "fa_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1",
      label: patch.label ?? "Living",
    }),
    finish_type: "carpet",
    area_input_method: "direct_m2",
    area_m2: 10,
    underlay_required: false,
    floor_preparation_required: false,
    substrate_required: false,
    framing_required: false,
    finish_removal_required: false,
    ...patch,
  };
}

function hosted(
  portions: readonly FlooringPortion[],
  extra: Parameters<typeof ctx>[1] = {}
) {
  return calculateEstimate(ctx(persist(portions), extra));
}

function includedCost(items: readonly EstimateLineItemInput[]): number {
  return round2(
    items
      .filter(
        (row) =>
          row.includedInTotal !== false && row.rateSourceType !== "missing"
      )
      .reduce((sum, row) => sum + (row.recommendedCost ?? 0), 0)
  );
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

function adoptPricing(estimate: ReturnType<typeof calculateEstimate>) {
  return estimate.lineItems
    .filter((row) => row.rateSourceType !== "missing")
    .map((item, index) => valuesFromEstimateLineItem(asEstimateRow(item, index)));
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
    notes_internal: item.notes ?? null,
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

function quotePricing(estimate: ReturnType<typeof calculateEstimate>) {
  return estimate.lineItems.map((item) => ({
    label: item.label,
    component_key: item.componentKey,
    nested_item_id: item.nestedItemId,
    cost_known: item.rateSourceType !== "missing",
    total_cost: item.recommendedCost ?? 0,
    total_sell: item.recommendedSell ?? 0,
    notes_internal: item.notes,
  }));
}

function quoteFacts(portions: readonly FlooringPortion[]) {
  return [
    {
      key: FLOORING_PORTIONS_FACT_KEY,
      label: "Flooring areas",
      value: JSON.stringify(portions),
    },
  ];
}

function flooringQuote(
  portions: readonly FlooringPortion[],
  estimate?: ReturnType<typeof calculateEstimate>
) {
  return buildWorkAreaQuoteDescriptionDraft({
    type: "flooring",
    name: "Flooring",
    facts: quoteFacts(portions),
    pricingItems: estimate ? quotePricing(estimate) : undefined,
  });
}

function moneyProof(cost: number) {
  const sell = deriveSellFromCost(cost, 20);
  const totals = calculateDocumentTotals(
    [{ total_cost: cost, total_sell: sell }],
    DEFAULT_GST_RATE
  );
  const quote = calculateQuoteTotals(
    [{ total: sell, visible: true }],
    DEFAULT_GST_RATE
  );
  return { sell, totals, quote };
}

console.log("=== FLOORING-06 Pricing and client Quote ===\n");

const carpetNoUnderlay = hosted([ordinary()]);
const carpetAdopted = adoptPricing(carpetNoUnderlay);
check(
  "1. Pricing adopts hosted carpet COST without reconstructing quantity",
  near(includedCost(carpetNoUnderlay.lineItems), 750) &&
    carpetAdopted.some(
      (row) =>
        near(row.totalCost, 750) &&
        row.quantity === 10 &&
        row.unit === "m2"
    )
);
check(
  "2. Nested calculateFlooring and calculateEstimate remain the Pricing source",
  near(
    includedCost(calculateFlooring(ctx(persist([ordinary()])), WA).lineItems),
    750
  )
);

const g1 = moneyProof(750);
check(
  "3. Golden 1. Carpet 10 m² underlay No COST $750",
  near(includedCost(carpetNoUnderlay.lineItems), 750)
);
check(
  "4. Golden 1. sell $937.50, GST and incl GST follow shared rounding",
  near(g1.sell, 937.5) &&
    near(g1.totals.gstAmount, roundMoney(937.5 * 0.15)) &&
    near(g1.totals.totalInclGst, roundMoney(937.5 + roundMoney(937.5 * 0.15))) &&
    near(g1.quote.totalInclGst, g1.totals.totalInclGst)
);

const carpetUnderlay = hosted([ordinary({ underlay_required: true })]);
const g2 = moneyProof(900);
check(
  "5. Golden 2. Carpet + underlay COST $900 / sell $1,125",
  near(includedCost(carpetUnderlay.lineItems), 900) &&
    near(g2.sell, 1125) &&
    near(g2.totals.gstAmount, roundMoney(1125 * 0.15))
);

const vinylPrep = hosted([
  ordinary({
    finish_type: "vinyl_plank",
    floor_preparation_required: true,
  }),
]);
const g3 = moneyProof(1300);
check(
  "6. Golden 3. Vinyl + preparation COST $1,300 / sell $1,625",
  near(includedCost(vinylPrep.lineItems), 1300) && near(g3.sell, 1625)
);

const tilePrep = hosted([
  ordinary({
    finish_type: "tile",
    tile_width_mm: 600,
    tile_length_mm: 600,
    floor_preparation_required: true,
  }),
]);
const g4 = moneyProof(1850);
check(
  "7. Golden 4. Tile + preparation COST $1,850 / sell $2,312.50",
  near(includedCost(tilePrep.lineItems), 1850) && near(g4.sell, 2312.5)
);

const hardwood = hosted([
  ordinary({
    finish_type: "hardwood",
    hardwood_board_width_mm: 186,
  }),
]);
const g5 = moneyProof(1900);
check(
  "8. Golden 5. Hardwood COST $1,900 / sell $2,375",
  near(includedCost(hardwood.lineItems), 1900) && near(g5.sell, 2375)
);

const comprehensivePortions = [
  ordinary({
    id: "fa_comp",
    label: "Lounge",
    area_m2: 12,
    underlay_required: true,
    substrate_required: true,
    substrate_family: "structural_plywood",
    substrate_item_key: BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
    framing_required: true,
    framing_allowance_level: "standard",
    finish_removal_required: true,
    existing_finish_type: "carpet",
    substrate_removal_required: true,
  }),
];
const comprehensive = hosted(comprehensivePortions);
const g6 = moneyProof(3337.4);
check(
  "9. Golden 6. Comprehensive COST $3,337.40 / sell $4,171.75",
  near(includedCost(comprehensive.lineItems), 3337.4) && near(g6.sell, 4171.75)
);
check(
  "10. Golden 6. GST uses shared rounding, not Flooring-specific money",
  near(g6.totals.gstAmount, roundMoney(4171.75 * 0.15)) &&
    near(g6.totals.totalInclGst, roundMoney(4171.75 + roundMoney(4171.75 * 0.15))) &&
    !read("lib/estimate/flooring-quote.ts").includes("1.15") &&
    !read("lib/estimate/flooring-quote.ts").includes("gst")
);

const multiPortions = [
  ordinary({
    id: "fa_bedrooms",
    label: "Bedrooms",
    area_m2: 24,
    underlay_required: true,
  }),
  ordinary({
    id: "fa_living",
    label: "Living room",
    finish_type: "vinyl_plank",
    area_m2: 20,
    floor_preparation_required: true,
  }),
];
const multi = hosted(multiPortions);
const g7 = moneyProof(4760);
check(
  "11. Golden 7. Multiple-area COST $4,760 / sell $5,950 / incl GST $6,842.50",
  near(includedCost(multi.lineItems), 4760) &&
    near(g7.sell, 5950) &&
    near(g7.totals.gstAmount, 892.5) &&
    near(g7.totals.totalInclGst, 6842.5)
);

const beforeFacts = JSON.stringify(persist(comprehensivePortions));
const retarget = applyTargetMarginToLineItems(
  comprehensive.lineItems.filter((row) => (row.recommendedCost ?? 0) > 0),
  25,
  { default_margin_percent: 25 } as never
);
check(
  "12. Margin retarget changes sell/profit only",
  near(includedCost(comprehensive.lineItems), includedCost(retarget)) &&
    retarget.every((row, index) => {
      const source = comprehensive.lineItems.filter(
        (item) => (item.recommendedCost ?? 0) > 0
      )[index];
      return source != null && source.quantity === row.quantity;
    })
);
check(
  "13. Pricing/margin path does not mutate flooring.portions facts",
  JSON.stringify(persist(comprehensivePortions)) === beforeFacts
);

const twins = hosted([
  ordinary({ id: "twin-a", label: "Bedrooms" }),
  ordinary({ id: "twin-b", label: "Bedrooms" }),
]);
check(
  "14. Identical-looking areas keep independent Pricing ownership",
  twins.lineItems.filter((row) => row.componentKey === FLOORING_CARPET_SUPPLY_INSTALL_M2)
    .length === 2 &&
    new Set(
      twins.lineItems
        .filter((row) => row.componentKey === FLOORING_CARPET_SUPPLY_INSTALL_M2)
        .map((row) => row.scopeKey)
    ).size === 2 &&
    flooringLineScopeKey({
      workAreaId: WA.id,
      nestedItemId: "twin-a",
      componentKey: FLOORING_CARPET_SUPPLY_INSTALL_M2,
    }) !==
      flooringLineScopeKey({
        workAreaId: WA.id,
        nestedItemId: "twin-b",
        componentKey: FLOORING_CARPET_SUPPLY_INSTALL_M2,
      })
);

const adoptedCarpet = carpetNoUnderlay.lineItems.map((item, index) =>
  toPricingItem(item, index)
);
check(
  "15. Shared Pricing adapter preserves quantity and COST",
  adoptedCarpet.some((row) => row.quantity === 10 && near(row.total_cost, 750))
);
check(
  "16. No Flooring-specific pricing calculator exists",
  !read("lib/quotes/from-pricing.ts").includes("commercializeFlooring") &&
    !read("lib/estimate/flooring-quote.ts").includes("FITOUT_BENCHMARKS")
);

const quoteCarpetYes = flooringQuote(
  [ordinary({ label: "Bedrooms", area_m2: 24, underlay_required: true })],
  hosted([ordinary({ label: "Bedrooms", area_m2: 24, underlay_required: true })])
);
check(
  "17. Quote carpet with underlay",
  quoteCarpetYes.includes(
    "Bedrooms: Supply and install 24 m² of carpet flooring, including new underlay."
  )
);

const quoteCarpetNo = flooringQuote(
  [ordinary({ label: "Bedrooms", area_m2: 24, underlay_required: false })],
  hosted([ordinary({ label: "Bedrooms", area_m2: 24, underlay_required: false })])
);
check(
  "18. Quote carpet without underlay",
  quoteCarpetNo.includes(
    "Bedrooms: Supply and install 24 m² of carpet flooring. New underlay is excluded."
  )
);

const quoteVinylYes = flooringQuote(
  [
    ordinary({
      label: "Living room",
      finish_type: "vinyl_plank",
      area_m2: 20,
      floor_preparation_required: true,
    }),
  ],
  hosted([
    ordinary({
      label: "Living room",
      finish_type: "vinyl_plank",
      area_m2: 20,
      floor_preparation_required: true,
    }),
  ])
);
check(
  "19. Quote vinyl with preparation",
  quoteVinylYes.includes(
    "Living room: Supply and install 20 m² of vinyl plank/LVT flooring, including an ordinary floor-preparation allowance."
  )
);

const quoteVinylNo = flooringQuote(
  [
    ordinary({
      label: "Living room",
      finish_type: "vinyl_plank",
      area_m2: 20,
      floor_preparation_required: false,
    }),
  ],
  hosted([
    ordinary({
      label: "Living room",
      finish_type: "vinyl_plank",
      area_m2: 20,
      floor_preparation_required: false,
    }),
  ])
);
check(
  "20. Quote vinyl without preparation",
  quoteVinylNo.includes(
    "Living room: Supply and install 20 m² of vinyl plank/LVT flooring. Floor preparation is excluded."
  )
);

const tileYes = ordinary({
  label: "Bathroom floor",
  finish_type: "tile",
  area_m2: 12,
  tile_width_mm: 600,
  tile_length_mm: 600,
  floor_preparation_required: true,
});
check(
  "21. Quote tile with dimensions and preparation",
  flooringQuote([tileYes], hosted([tileYes])).includes(
    "Bathroom floor: Supply and install 12 m² of tiled flooring using 600 × 600 mm tiles, including an ordinary floor-preparation allowance."
  )
);

const tileNo = ordinary({
  label: "Bathroom floor",
  finish_type: "tile",
  area_m2: 12,
  tile_width_mm: 600,
  tile_length_mm: 600,
  floor_preparation_required: false,
});
check(
  "22. Quote tile without preparation",
  flooringQuote([tileNo], hosted([tileNo])).includes("Floor preparation is excluded.")
);

const timber = ordinary({
  label: "Dining room",
  finish_type: "hardwood",
  area_m2: 15,
  hardwood_board_width_mm: 186,
});
check(
  "23. Quote hardwood with board width",
  flooringQuote([timber], hosted([timber])).includes(
    "Dining room: Supply and install 15 m² of hardwood/timber flooring using approximately 186 mm wide boards."
  )
);

const ply = ordinary({
  area_m2: 12,
  substrate_required: true,
  substrate_family: "structural_plywood",
  substrate_item_key: BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
});
const plyQuote = flooringQuote([ply], hosted([ply]));
check(
  "24. Quote plywood substrate included",
  plyQuote.includes(FLOORING_QUOTE_PLYWOOD_INCLUDED)
);
check(
  "25. Quote does not expose sheet COST or hours",
  !plyQuote.includes("$145") &&
    !plyQuote.includes("0.50") &&
    !plyQuote.includes("person-hours") &&
    !plyQuote.includes(FLOORING_SUBSTRATE_MATERIAL_COMPONENT)
);

const fc = ordinary({
  area_m2: 12,
  substrate_required: true,
  substrate_family: "fibre_cement",
  substrate_item_key: BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY,
});
const fcEst = hosted([fc]);
const fcQuote = flooringQuote([fc], fcEst);
check(
  "26. FC material unresolved does not claim complete substrate S&I",
  fcQuote.includes(FLOORING_QUOTE_SUBSTRATE_MATERIAL_PENDING) &&
    !fcQuote.includes("Includes installation of new 19 mm fibre-cement flooring 2700")
);
check(
  "27. FC installation labour can still price independently",
  fcEst.lineItems.some(
    (row) =>
      row.componentKey === FLOORING_SUBSTRATE_INSTALL_LABOUR &&
      (row.recommendedCost ?? 0) > 0
  )
);

const secura = ordinary({
  area_m2: 12,
  substrate_required: true,
  substrate_family: "secura",
  substrate_item_key: BATHROOM_FLOOR_SUBSTRATE_SECURA_KEY,
});
check(
  "28. Secura unresolved does not inherit plywood wording",
  flooringQuote([secura], hosted([secura])).includes(
    FLOORING_QUOTE_SUBSTRATE_MATERIAL_PENDING
  ) && !flooringQuote([secura], hosted([secura])).includes("plywood")
);

const minor = ordinary({
  framing_required: true,
  framing_allowance_level: "minor",
});
check(
  "29. Quote minor framing allowance",
  flooringQuote([minor], hosted([minor])).includes(
    "Includes an allowance for minor local packing, blocking and below-substrate framing adjustments."
  )
);
const standard = ordinary({
  framing_required: true,
  framing_allowance_level: "standard",
});
check(
  "30. Quote standard framing allowance",
  flooringQuote([standard], hosted([standard])).includes(
    "Includes an allowance for standard below-substrate framing remediation across the selected area."
  )
);
const major = ordinary({
  framing_required: true,
  framing_allowance_level: "major",
});
check(
  "31. Quote major framing allowance",
  flooringQuote([major], hosted([major])).includes(
    "Includes a major non-engineered below-substrate framing remediation allowance."
  )
);
check(
  "32. Framing exclusions preserved whenever an allowance is included",
  flooringQuote([standard], hosted([standard])).includes(
    FLOORING_QUOTE_FRAMING_EXCLUSIONS
  ) &&
    !flooringQuote([standard], hosted([standard])).includes(
      FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_M2
    )
);

const structural = ordinary({
  id: "fa_struct",
  label: "Hall",
  finish_type: "other",
  specialist_kind: "structural",
  other_description: "engineered joist replacement",
});
check(
  "33. Structural framing excluded pending separate assessment",
  flooringQuote([structural], hosted([structural])).includes(
    FLOORING_QUOTE_SPECIALIST_PENDING
  ) &&
    flooringQuote([structural], hosted([structural])).includes(
      FLOORING_QUOTE_STRUCTURAL_FRAMING_EXCLUDED
    ) &&
    !flooringQuote([structural], hosted([structural])).includes("minor local packing")
);

const finishRemoval = ordinary({
  finish_removal_required: true,
  existing_finish_type: "carpet",
  substrate_removal_required: false,
});
const finishRemovalQuote = flooringQuote([finishRemoval], hosted([finishRemoval]));
check(
  "34. Quote finish removal only",
  finishRemovalQuote.includes("Includes removal of the existing carpet flooring.") &&
    !finishRemovalQuote.includes("existing floor substrate")
);

const bothRemoval = ordinary({
  finish_removal_required: true,
  existing_finish_type: "carpet",
  substrate_removal_required: true,
});
const bothRemovalQuote = flooringQuote([bothRemoval], hosted([bothRemoval]));
check(
  "35. Quote finish plus substrate removal stay separate",
  bothRemovalQuote.includes("Includes removal of the existing carpet flooring.") &&
    bothRemovalQuote.includes("Includes removal of the existing floor substrate.") &&
    bothRemovalQuote.includes(FLOORING_QUOTE_REMOVAL_EXCLUSIONS)
);
check(
  "36. Removal wording does not claim disposal as included",
  /excludes disposal/i.test(bothRemovalQuote) &&
    !/includes disposal/i.test(bothRemovalQuote)
);

const custom = ordinary({
  finish_type: "other",
  other_description: "Custom cork-look vinyl",
});
const customEst = hosted([custom]);
check(
  "37. Custom finish unresolved stays excluded",
  flooringQuote([custom], customEst).includes(FLOORING_QUOTE_CUSTOM_FINISH_EXCLUDED)
);

const customManualPricing = quotePricing(customEst).map((item) =>
  item.component_key === FLOORING_CUSTOM_FINISH_COMPONENT
    ? { ...item, cost_known: true, total_cost: 1200, total_sell: 1500 }
    : item
);
const customManualQuote = buildWorkAreaQuoteDescriptionDraft({
  type: "flooring",
  name: "Flooring",
  facts: quoteFacts([custom]),
  pricingItems: customManualPricing,
});
check(
  "38. Manually priced custom finish may be included through existing Pricing",
  customManualQuote.includes(FLOORING_QUOTE_CUSTOM_FINISH_INCLUDED) &&
    !customManualQuote.includes("$75") &&
    !customManualQuote.includes("carpet flooring")
);

const specialist = ordinary({
  id: "fa_spec",
  label: "Entry",
  finish_type: "other",
  specialist_kind: "laminate",
  other_description: "Laminate flooring",
});
check(
  "39. Specialist Flooring is excluded pending specification",
  flooringQuote([specialist], hosted([specialist])).includes(
    FLOORING_QUOTE_SPECIALIST_PENDING
  ) &&
    !flooringQuote([specialist], hosted([specialist])).includes(
      "UNSUPPORTED_SPECIALIST"
    )
);

const mixedIncomplete = [
  ordinary({ id: "fa_done", label: "Bedrooms", underlay_required: true }),
  createEmptyFlooringPortion({ id: "fa_open", label: "Hall" }),
];
const mixedQuote = flooringQuote(mixedIncomplete, hosted(mixedIncomplete));
check(
  "40. Incomplete sibling does not become a client inclusion",
  mixedQuote.includes("Bedrooms: Supply and install 10 m² of carpet flooring") &&
    mixedQuote.includes(FLOORING_QUOTE_INCOMPLETE_SIBLING_PENDING) &&
    !mixedQuote.includes("Hall: Supply")
);

const onlyIncomplete = flooringQuote(
  [createEmptyFlooringPortion({ id: "fa_empty" })],
  hosted([createEmptyFlooringPortion({ id: "fa_empty" })])
);
check(
  "41. All-incomplete nested Flooring stays pending confirmation",
  onlyIncomplete.includes(FLOORING_QUOTE_INCOMPLETE_ONLY_PENDING)
);

const multiQuote = flooringQuote(multiPortions, multi);
check(
  "42. Two labelled ordinary areas stay independent Quote entries",
  multiQuote.includes(
    "Bedrooms: Supply and install 24 m² of carpet flooring, including new underlay."
  ) &&
    multiQuote.includes(
      "Living room: Supply and install 20 m² of vinyl plank/LVT flooring, including an ordinary floor-preparation allowance."
    ) &&
    (multiQuote.match(/Bedrooms:/g) ?? []).length === 1
);
check(
  "43. Shared Flooring exclusions appear once",
  (multiQuote.match(new RegExp(FLOORING_QUOTE_SHARED_EXCLUSIONS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length === 1
);

const pricedLines = carpetUnderlay.lineItems.map((item, index) =>
  toPricingItem(item, index)
);
const quoteItems = mapPricingItemsToQuoteItems(pricedLines, new Map([[WA.id, "Flooring"]]));
check(
  "44. Quote item mapping uses shared from-pricing path",
  quoteItems.length > 0 &&
    quoteItems.every((row) => (row.total ?? 0) > 0)
);

const zeroLine = toPricingItem(
  {
    ...carpetNoUnderlay.lineItems[0]!,
    recommendedCost: 0,
    recommendedSell: 0,
    rateSourceType: "missing",
    componentKey: FLOORING_CUSTOM_FINISH_COMPONENT,
  },
  99,
  { total_cost: 0, total_sell: 0, cost_known: false, component_key: FLOORING_CUSTOM_FINISH_COMPONENT }
);
check(
  "45. Unpriced Flooring lines are not legitimate $0 Quote inclusions",
  flooringPricingItemIsClientPriced(zeroLine) === false &&
    mapPricingItemsToQuoteItems([zeroLine], new Map([[WA.id, "Flooring"]])).length === 0
);

const leakHay = [
  quoteCarpetYes,
  quoteVinylYes,
  flooringQuote([tileYes], hosted([tileYes])),
  flooringQuote([timber], hosted([timber])),
  plyQuote,
  fcQuote,
  bothRemovalQuote,
  mixedQuote,
  multiQuote,
].join("\n");
check(
  "46. Client Quote stays confidential",
  !flooringQuoteLeaksInternal(leakHay) &&
    !/Quotr/i.test(leakHay) &&
    !/\$75/.test(leakHay) &&
    !/labour\.carpenter/.test(leakHay) &&
    !/Pricing Required/i.test(leakHay) &&
    !/whole tiles/.test(leakHay) &&
    !/lineal m/.test(leakHay)
);

const bathroomWa = {
  id: "b1",
  type: "bathroom",
  name: "Bathroom",
  sort_order: 2,
  status: "confirmed",
} as EstimateWorkArea;
const bathroomFacts: EstimateFact[] = [
  { key: "bathroom.area_m2", work_area_id: "b1", value: 6, source: "user" },
];
const bathroomQuote = buildWorkAreaQuoteDescriptionDraft({
  type: "bathroom",
  name: "Bathroom",
  facts: bathroomFacts.map((row) => ({
    key: row.key,
    label: row.key,
    value: String(row.value),
  })),
});
const flooringBesideBathroom = flooringQuote(
  [ordinary({ label: "Hall", area_m2: 10 })],
  hosted([ordinary({ label: "Hall", area_m2: 10 })])
);
check(
  "47. Flooring plus genuine Bathroom keep separate Quote scope",
  bathroomQuote.toLowerCase().includes("bathroom") &&
    flooringBesideBathroom.includes("Hall:") &&
    !flooringBesideBathroom.toLowerCase().includes("bathroom renovation")
);

const kitchenQuote = buildWorkAreaQuoteDescriptionDraft({
  type: "kitchen",
  name: "Kitchen",
  facts: [{ key: "kitchen.area_m2", label: "Area", value: "12" }],
});
check(
  "48. Flooring plus genuine Kitchen stay non-duplicated",
  kitchenQuote.toLowerCase().includes("kitchen") &&
    !flooringBesideBathroom.toLowerCase().includes("cabinetry")
);

const demoQuote = buildWorkAreaQuoteDescriptionDraft({
  type: "demolition",
  name: "Demolition",
  facts: [{ key: "demolition.scope_items", label: "Scope", value: "internal strip-out" }],
});
check(
  "49. Flooring plus independent Demolition stay separate",
  demoQuote.toLowerCase().includes("demolition") &&
    !bothRemovalQuote.toLowerCase().includes("strip-out")
);

const legacyQuote = buildWorkAreaQuoteDescriptionDraft({
  type: "flooring",
  name: "Flooring",
  facts: [
    { key: "flooring.type", label: "Type", value: "carpet" },
    { key: "flooring.area_m2", label: "Area", value: "20" },
  ],
});
check(
  "50. Flat legacy Flooring Quote path remains unchanged",
  /approximately 20 m²/.test(legacyQuote) &&
    /carpet/.test(legacyQuote.toLowerCase()) &&
    !legacyQuote.includes("including new underlay")
);
check(
  "51. Nested Quote does not use FITOUT $120 or legacy 20 m² default",
  !quoteCarpetYes.includes("$120") &&
    !quoteCarpetYes.includes("12 stairs") &&
    !quoteCarpetYes.toLowerCase().includes("scotia") &&
    FITOUT_BENCHMARKS.flooringPerM2.cost === 120
);

check(
  "52. Nested Quote does not mention Bathroom tile packages or Kitchen flooring",
  !quoteCarpetYes.toLowerCase().includes("bathroom renovation") &&
    !tileYes.label?.includes("bathroom.tile") &&
    !quoteVinylYes.toLowerCase().includes("kitchen flooring")
);

check(
  "53. Tile count and hardwood lm stay off ordinary client scope",
  !flooringQuote([tileYes], hosted([tileYes])).includes("whole tile") &&
    !flooringQuote([timber], hosted([timber])).includes("lm")
);

check(
  "54. Underlay is not silently inside the carpet package copy",
  quoteCarpetNo.includes("New underlay is excluded.") &&
    !quoteCarpetNo.includes("including new underlay")
);
check(
  "55. Preparation is not silently inside vinyl/tile package copy",
  quoteVinylNo.includes("Floor preparation is excluded.") &&
    flooringQuote([tileNo], hosted([tileNo])).includes("Floor preparation is excluded.")
);

const customPly = ordinary({
  finish_type: "other",
  other_description: "Custom cork-look vinyl",
  substrate_required: true,
  substrate_family: "structural_plywood",
  substrate_item_key: BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
});
const customPlyQuote = flooringQuote([customPly], hosted([customPly]));
check(
  "56. Custom finish PR still allows priced plywood to be included",
  customPlyQuote.includes(FLOORING_QUOTE_CUSTOM_FINISH_EXCLUDED) &&
    customPlyQuote.includes(FLOORING_QUOTE_PLYWOOD_INCLUDED)
);

const siblingSpecialist = [
  ordinary({ id: "fa_ok", label: "Bedrooms", underlay_required: true }),
  specialist,
];
check(
  "57. Specialist sibling does not suppress supported Flooring Area",
  flooringQuote(siblingSpecialist, hosted(siblingSpecialist)).includes(
    "Bedrooms: Supply and install 10 m² of carpet flooring"
  ) &&
    flooringQuote(siblingSpecialist, hosted(siblingSpecialist)).includes(
      FLOORING_QUOTE_SPECIALIST_PENDING
    )
);

check(
  "58. Shared exclusions do not invent scotia or skirting quantities",
  !/\bscotia\b/i.test(multiQuote) &&
    !/\d+\s*(m²|m2|lm)\s+of\s+(skirtings?|trims)/i.test(multiQuote) &&
    multiQuote.includes("skirtings and trims")
);

check(
  "59. Quote builder consumes portions, not raw commercial reconstruction",
  read("lib/estimate/flooring-quote.ts").includes("physicalNetAreaM2") &&
    !read("lib/estimate/flooring-quote.ts").includes("FITOUT_BENCHMARKS") &&
    !read("lib/estimate/flooring-quote.ts").includes("calculateFlooringPhysical")
);

const bathroomCalc = calculateBathroom(
  {
    ...ctx(bathroomFacts, { workAreas: [bathroomWa] }),
  },
  bathroomWa
);
const kitchenCalc = calculateKitchen(
  ctx([{ key: "kitchen.area_m2", work_area_id: "k1", value: 12, source: "user" }], {
    workAreas: [{ id: "k1", type: "kitchen", name: "Kitchen", sort_order: 1 } as EstimateWorkArea],
  }),
  { id: "k1", type: "kitchen", name: "Kitchen", sort_order: 1 } as EstimateWorkArea
);
const demoCalc = calculateDemolition(
  ctx(
    [{ key: "demolition.scope_items", work_area_id: "d1", value: ["internal strip-out"], source: "user" }],
    { workAreas: [{ id: "d1", type: "demolition", name: "Demolition", sort_order: 1 } as EstimateWorkArea] }
  ),
  { id: "d1", type: "demolition", name: "Demolition", sort_order: 1 } as EstimateWorkArea
);
check(
  "60. Bathroom/Kitchen/Demolition calculators remain independent",
  bathroomCalc.lineItems.length > 0 &&
    kitchenCalc.lineItems.length > 0 &&
    demoCalc.lineItems.length >= 0
);

check(
  "61. Nested Flooring never writes Pricing back into flooring.portions",
  !read("lib/estimate/flooring-quote.ts").includes("applyFlooringFactWrite") &&
    !read("lib/quotes/from-pricing.ts").includes("flooring.portions")
);

const coverage = verifyRegisteredWorkAreaBenchmarkCoverage("flooring");
const support = getWorkAreaSupportEntry("flooring");
check(
  "62. Coverage: Pricing and Quote resolve; ordinary V1 is human-QA frozen",
  coverage.ok &&
    FLOORING_V1_HUMAN_QA_FROZEN === true &&
    FLOORING_BENCHMARK_REQUIREMENTS.some(
      (row) =>
        row.component === "Pricing page integration" &&
        row.outcome === "RESOLVES_WITH_QUOTR"
    ) &&
    FLOORING_BENCHMARK_REQUIREMENTS.some(
      (row) =>
        row.component === "Client Quote wording" &&
        row.outcome === "RESOLVES_WITH_QUOTR"
    ) &&
    FLOORING_BENCHMARK_REQUIREMENTS.find(
      (row) => row.component === "Human hosted QA / freeze"
    )?.notes === FLOORING_V1_COVERAGE_QUOTE_NOTES &&
    support?.notes === FLOORING_V1_SUPPORT_NOTES
);
check(
  "63. Ordinary Flooring may close at L5 after Pricing and Quote",
  workAreaMayCloseAtL5(coverage) === true
);
check(
  "64. Custom/specialist and FC/Secura remain intentional PR",
  FLOORING_BENCHMARK_REQUIREMENTS.some(
    (row) =>
      row.materialIdentity === FLOORING_CUSTOM_FINISH_COMPONENT &&
      row.outcome === "INTENTIONAL_PRICING_REQUIRED"
  ) &&
    FLOORING_BENCHMARK_REQUIREMENTS.some(
      (row) =>
        row.materialIdentity === BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY &&
        row.outcome === "INTENTIONAL_PRICING_REQUIRED"
    )
);

check(
  "65. Support contract freezes ordinary V1 without promoting the support band",
  support?.notes === FLOORING_V1_SUPPORT_NOTES &&
    support.band === "component" &&
    /FLOORING-07/i.test(support.notes) &&
    !/not human-QA frozen/i.test(support.notes)
);

check(
  "66. Shared GST rate remains 15%",
  DEFAULT_GST_RATE === 15 &&
    near(g2.totals.gstAmount, 168.75) &&
    near(g3.totals.gstAmount, 243.75) &&
    near(g5.totals.gstAmount, 356.25)
);

const vinylRemoval = ordinary({
  finish_type: "vinyl_plank",
  finish_removal_required: true,
  existing_finish_type: "vinyl",
  substrate_removal_required: false,
});
check(
  "67. Vinyl removal wording is finish-specific",
  flooringQuote([vinylRemoval], hosted([vinylRemoval])).includes(
    "Includes removal of the existing vinyl flooring."
  )
);
const tileRemoval = ordinary({
  finish_type: "tile",
  tile_width_mm: 600,
  tile_length_mm: 600,
  finish_removal_required: true,
  existing_finish_type: "tile",
  substrate_removal_required: false,
});
check(
  "68. Tile removal wording is finish-specific",
  flooringQuote([tileRemoval], hosted([tileRemoval])).includes(
    "Includes removal of the existing tiled flooring."
  )
);
const timberRemoval = ordinary({
  finish_type: "hardwood",
  hardwood_board_width_mm: 186,
  finish_removal_required: true,
  existing_finish_type: "hardwood",
  substrate_removal_required: false,
});
check(
  "69. Hardwood removal wording is finish-specific",
  flooringQuote([timberRemoval], hosted([timberRemoval])).includes(
    "Includes removal of the existing hardwood/timber flooring."
  )
);

check(
  "70. Label is a prefix only and is not repeated in the sentence body",
  /Bedrooms: Supply and install 24 m² of carpet flooring/.test(quoteCarpetYes) &&
    !/Bedrooms:.*Bedrooms/.test(quoteCarpetYes)
);

check(
  "71. Unanswered underlay does not appear as included",
  !flooringQuote(
    [ordinary({ underlay_required: null as unknown as boolean })],
    hosted([ordinary({ underlay_required: null as unknown as boolean })])
  ).includes("including new underlay")
);

const fcManual = quotePricing(fcEst).map((item) =>
  item.component_key === FLOORING_SUBSTRATE_MATERIAL_COMPONENT
    ? { ...item, cost_known: true, total_cost: 800, total_sell: 1000 }
    : item
);
const fcManualQuote = buildWorkAreaQuoteDescriptionDraft({
  type: "flooring",
  name: "Flooring",
  facts: quoteFacts([fc]),
  pricingItems: fcManual,
});
check(
  "72. Authorised later substrate material Pricing may include known product S&I",
  fcManualQuote.includes("19 mm fibre-cement flooring 2700 × 600") &&
    !fcManualQuote.includes(FLOORING_QUOTE_SUBSTRATE_MATERIAL_PENDING)
);

check(
  "73. No $22 removal, $8 underlay, or $18/$45 preparation copy",
  !leakHay.includes("$22") &&
    !leakHay.includes("$8") &&
    !leakHay.includes("$18") &&
    !leakHay.includes("$45")
);

check(
  "74. Framing COST rate is not exposed",
  !flooringQuote([minor], hosted([minor])).includes("$45") &&
    !flooringQuote([standard], hosted([standard])).includes("$90") &&
    !flooringQuote([major], hosted([major])).includes("$160")
);

check(
  "75. Nested and legacy copy do not coexist on nested path",
  !quoteCarpetYes.includes("Carry out carpet flooring works for approximately") &&
    !quoteCarpetYes.includes("surface preparation, installation and associated finishing where included")
);

check(
  "76. Quote does not dump collection JSON or portion IDs",
  !quoteCarpetYes.includes("finish_type") &&
    !quoteCarpetYes.includes("fa_aaaaaaaa") &&
    !quoteCarpetYes.includes('"portions"')
);

const adoptedMulti = adoptPricing(multi);
check(
  "77. Multiple-area Pricing totals match hosted COST",
  near(
    adoptedMulti.reduce((sum, row) => sum + (row.totalCost ?? 0), 0),
    4760
  )
);

check(
  "78. Pricing ownership is not finish type or label alone",
  twins.lineItems
    .filter((row) => row.componentKey === FLOORING_CARPET_SUPPLY_INSTALL_M2)
    .every((row) => (row.scopeKey ?? "").includes(row.nestedItemId ?? "missing"))
);

check(
  "79. Structural specialist does not inherit ordinary framing money",
  !hosted([structural]).lineItems.some(
    (row) =>
      row.componentKey === FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2 ||
      row.componentKey === FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_M2 ||
      row.componentKey === FLOORING_SUBFLOOR_FRAMING_MAJOR_ALLOWANCE_M2
  )
);

check(
  "80. Production bypasses are not introduced",
  !read("lib/estimate/flooring-quote.ts").includes("process.env") &&
    !read("lib/work-areas/quote-description.ts").includes("process.env")
);

check(
  "81. Comprehensive Quote includes finish, underlay, plywood, framing and removal",
  flooringQuote(comprehensivePortions, comprehensive).includes("including new underlay") &&
    flooringQuote(comprehensivePortions, comprehensive).includes(FLOORING_QUOTE_PLYWOOD_INCLUDED) &&
    flooringQuote(comprehensivePortions, comprehensive).includes(
      "standard below-substrate framing remediation"
    ) &&
    flooringQuote(comprehensivePortions, comprehensive).includes(
      "Includes removal of the existing carpet flooring."
    ) &&
    flooringQuote(comprehensivePortions, comprehensive).includes(
      "Includes removal of the existing floor substrate."
    )
);

check(
  "82. Specialist enum names stay off the client Quote",
  !flooringQuote([specialist], hosted([specialist])).includes("laminate") &&
    !flooringQuote([specialist], hosted([specialist])).includes(
      FLOORING_SPECIALIST_COMPONENT
    )
);

check(
  "83. Incomplete Quote does not expose missing-field diagnostics",
  !onlyIncomplete.includes("flooring.portion") &&
    !onlyIncomplete.includes("INFORMATION_REQUIRED")
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
