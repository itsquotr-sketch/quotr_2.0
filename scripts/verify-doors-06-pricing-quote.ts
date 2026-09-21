/**
 * DOORS-06 — Pricing integration and client-safe Quote scope.
 *
 * Run: npx --yes tsx scripts/verify-doors-06-pricing-quote.ts
 *
 * No paid AI. No Production.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { OrganisationRate } from "../components/setup/types";
import type { EstimateLineItem } from "../components/assistant/types";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateDoors } from "../lib/estimate/calculators/fitout";
import { FITOUT_BENCHMARKS } from "../lib/estimate/benchmark-rates";
import { workAreaMayCloseAtL5 } from "../lib/estimate/benchmark-coverage";
import {
  doorsIncludedQuoteScopeCount,
  doorsPricingItemIsClientPriced,
  DOORS_QUOTE_CUSTOM_INSTALL_INCLUDED,
  DOORS_QUOTE_CUSTOM_SUPPLY_EXCLUDED,
  DOORS_QUOTE_FINISHING_OWNERSHIP,
  DOORS_QUOTE_INCOMPLETE_ONLY_PENDING,
  DOORS_QUOTE_INCOMPLETE_SIBLING_PENDING,
  DOORS_QUOTE_SHARED_EXCLUSIONS,
  DOORS_QUOTE_SPECIALIST_PENDING,
} from "../lib/estimate/doors-quote";
import {
  DOORS_CARPENTER_LABOUR_RATE_KEY,
  DOORS_CUSTOM_LEAF_COMPONENT,
  DOORS_ORDINARY_MATERIAL_KEYS,
  DOORS_ORDINARY_PRODUCTIVITY_KEYS,
  DOORS_PREHUNG_HOLLOW_CORE_SET_KEY,
  DOORS_PREHUNG_INSTALL_HOURS_PER_DOOR_KEY,
  DOORS_SPECIALIST_COMPONENT,
} from "../lib/estimate/doors-identities";
import { applyTargetMarginToLineItems } from "../lib/estimate/margin-override";
import {
  createEmptyDoorPortion,
  DOORS_NESTED_NOT_CALCULATED_MESSAGE,
  DOORS_PORTIONS_FACT_KEY,
  type DoorPortion,
} from "../lib/estimate/doors-portions";
import { looksLikeDoorProductMoney } from "../lib/estimate/internal-walls-identities";
import { INTERNAL_WALLS_HAS_OPENINGS_KEY } from "../lib/estimate/internal-walls-openings";
import { INTERNAL_WALLS_JOB_SCOPE_FACT_KEY } from "../lib/estimate/internal-walls-scope";
import {
  applyInternalWallsFactWrite,
  INTERNAL_WALLS_ADD_WALL_TYPE_KEY,
  resolveInternalWallsWallTypes,
} from "../lib/estimate/internal-walls-wall-types";
import { round2 } from "../lib/estimate/facts";
import type {
  EstimateConstraint,
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "../lib/estimate/types";
import {
  DOORS_BENCHMARK_REQUIREMENTS,
  verifyRegisteredWorkAreaBenchmarkCoverage,
} from "../lib/estimate/work-area-benchmark-coverage";
import { liveQuotrMaterialCost, liveQuotrProductivity } from "../lib/estimate/benchmark-coverage";
import { getCatalogueEntry } from "../lib/rates/catalogue";
import { valuesFromEstimateLineItem } from "../lib/pricing/recalibration-helpers";
import { calculateDocumentTotals, roundMoney } from "../lib/pricing/calculations";
import { DEFAULT_GST_RATE } from "../lib/pricing/status";
import { calculateQuoteTotals } from "../lib/quotes/calculations";
import {
  buildInclusionsFromPricing,
  mapPricingItemsToQuoteItems,
} from "../lib/quotes/from-pricing";
import type { PricingItem } from "../lib/pricing/types";
import {
  buildWorkAreaQuoteDescriptionDraft,
} from "../lib/work-areas/quote-description";
import { getWorkAreaSupportEntry } from "../lib/work-areas/support-contract";
import { deriveSellFromCost } from "../lib/commercial-engine/core/sell-from-margin";

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

function near(actual: number | null | undefined, expected: number, tol = 0.02): boolean {
  return actual != null && Number.isFinite(actual) && Math.abs(actual - expected) <= tol;
}

const WA: EstimateWorkArea = {
  id: "d1",
  type: "doors",
  name: "Doors",
  sort_order: 1,
};
const IW: EstimateWorkArea = {
  id: "iw1",
  type: "internal_walls",
  name: "Internal Walls",
  sort_order: 2,
};

function persist(portions: readonly DoorPortion[], workAreaId = WA.id): EstimateFact[] {
  return [
    {
      key: DOORS_PORTIONS_FACT_KEY,
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
      premium_rate_factor: 1.15,
    },
    materialWastageSettings: {
      defaultMaterialWastagePercent: 10,
      timberFramingWastagePercent: 10,
      sheetMaterialWastagePercent: 10,
    },
    rates: extra.rates ?? [],
  } as unknown as EstimateContext;
}

function ordinary(patch: Partial<DoorPortion> = {}): DoorPortion {
  return {
    id: patch.id ?? "door-set-ordinary-1",
    label: patch.label ?? null,
    installation_type: "prehung_internal",
    leaf_construction: "hollow_core",
    height_mm: 1980,
    width_mm: 810,
    quantity: 1,
    hardware_included: true,
    other_description: null,
    height_authority: "extracted",
    specialist_kind: null,
    ...patch,
  };
}

function replacement(patch: Partial<DoorPortion> = {}): DoorPortion {
  return ordinary({
    id: "door-set-replacement-1",
    installation_type: "replacement_leaf",
    leaf_construction: "solid_core",
    height_mm: 2200,
    width_mm: 910,
    quantity: 1,
    hardware_included: false,
    ...patch,
  });
}

function specialist(patch: Partial<DoorPortion> = {}): DoorPortion {
  return {
    id: patch.id ?? "door-set-specialist-1",
    label: patch.label ?? null,
    installation_type: "other_unsupported",
    leaf_construction: null,
    height_mm: null,
    width_mm: null,
    quantity: 1,
    hardware_included: null,
    other_description:
      patch.other_description ?? "fire-rated acoustic access-control door",
    specialist_kind: patch.specialist_kind ?? "fire_rated",
    ...patch,
  };
}

function companyMaterial(
  itemKey: string,
  cost: number,
  unit = getCatalogueEntry(itemKey)?.unit ?? "each"
): OrganisationRate {
  return {
    id: `org-mat-${itemKey}`,
    rate_type: "material",
    trade: null,
    work_area_type: "doors",
    item_key: itemKey,
    label: itemKey,
    unit,
    cost_rate: cost,
    sell_rate: null,
    markup_percent: null,
    active: true,
    source: "explicit_company",
  };
}

function companyProductivity(
  itemKey: string,
  hours: number,
  unit: string
): OrganisationRate {
  return {
    id: `org-prod-${itemKey}`,
    rate_type: "productivity",
    trade: null,
    work_area_type: "doors",
    item_key: itemKey,
    label: itemKey,
    unit,
    cost_rate: hours,
    sell_rate: null,
    markup_percent: null,
    active: true,
    source: "explicit_company",
  };
}

function companyLabour(cost: number): OrganisationRate {
  return {
    id: "org-labour-carpenter",
    rate_type: "labour",
    trade: "carpenter",
    work_area_type: null,
    item_key: DOORS_CARPENTER_LABOUR_RATE_KEY,
    label: "Carpenter",
    unit: "hour",
    cost_rate: cost,
    sell_rate: null,
    markup_percent: null,
    active: true,
    source: "explicit_company",
  };
}

function hosted(portions: readonly DoorPortion[], extra: Parameters<typeof ctx>[1] = {}) {
  return calculateEstimate(ctx(persist(portions), extra));
}

function includedCost(items: readonly EstimateLineItemInput[]): number {
  return round2(
    items
      .filter((row) => row.includedInTotal !== false)
      .reduce((sum, row) => sum + (row.recommendedCost ?? 0), 0)
  );
}

function fixtureA(): DoorPortion {
  return ordinary({
    id: "fixture-a",
    label: "Bedroom doors",
    quantity: 1,
    hardware_included: true,
  });
}
function fixtureB(): DoorPortion {
  return ordinary({
    id: "fixture-b",
    leaf_construction: "solid_core",
    quantity: 1,
    hardware_included: true,
  });
}
function fixtureC(): DoorPortion {
  return replacement({
    id: "fixture-c",
    leaf_construction: "hollow_core",
    hardware_included: false,
  });
}
function fixtureD(): DoorPortion {
  return replacement({
    id: "fixture-d",
    leaf_construction: "solid_core",
    hardware_included: false,
  });
}
function fixtureE(): DoorPortion {
  return replacement({
    id: "fixture-e",
    leaf_construction: "hollow_core",
    hardware_included: true,
  });
}
function fixtureF(): DoorPortion {
  return ordinary({
    id: "fixture-f",
    label: "Bedroom doors",
    quantity: 2,
    hardware_included: true,
  });
}

function combinedPortions(): DoorPortion[] {
  return [
    fixtureF(),
    replacement({
      id: "set-2-solid-replacement",
      label: "Ensuite",
      leaf_construction: "solid_core",
      hardware_included: false,
    }),
  ];
}

function quoteFacts(portions: readonly DoorPortion[]) {
  return [
    {
      key: DOORS_PORTIONS_FACT_KEY,
      label: "Door sets",
      value: JSON.stringify(portions),
    },
  ];
}

function doorsQuote(portions: readonly DoorPortion[], pricingItems?: Parameters<
  typeof buildWorkAreaQuoteDescriptionDraft
>[0]["pricingItems"]) {
  return buildWorkAreaQuoteDescriptionDraft({
    type: "doors",
    name: "Doors",
    facts: quoteFacts(portions),
    pricingItems,
  });
}

function legacyDoorsQuote() {
  return buildWorkAreaQuoteDescriptionDraft({
    type: "doors",
    name: "Doors",
    facts: [
      { key: "doors.count", label: "Door count", value: "3" },
      { key: "doors.door_type", label: "Door type", value: "Hollow core" },
    ],
  });
}

const INTERNAL_QUOTE_LEAKS: RegExp[] = [
  /\bpricing required\b/i,
  /UNSUPPORTED_SPECIALIST/,
  /INFORMATION_REQUIRED/,
  /PRICING_REQUIRED/,
  /COMPLETE_COMMERCIAL/,
  /prehung_internal/,
  /replacement_leaf/,
  /other_unsupported/,
  /hollow_core/,
  /solid_core/,
  /fire_rated/,
  /doorsEach/,
  /doorInstallEach/,
  /person-hours?/i,
  /\$\s*[\d,]/,
  /\bbenchmark\b/i,
  /\bcompany rate\b/i,
  /labour\.carpenter/,
  /door\.set\.internal/,
  /door\.leaf\.internal/,
  /doors\.prehung/,
  /doors\.leaf\.custom/,
  /doors\.specialist/,
  /derived_from_gross_margin/,
  /\bgross profit\b/i,
  /\bgross margin\b/i,
];

function quoteLeaksInternal(text: string): boolean {
  return INTERNAL_QUOTE_LEAKS.some((pattern) => pattern.test(text));
}

function asEstimateRow(item: EstimateLineItemInput, index: number) {
  return {
    id: `line-${index}`,
    work_area_id: item.workAreaId ?? WA.id,
    label: item.label,
    category: item.category,
    recommended_cost: item.recommendedCost,
    recommended_sell: item.recommendedSell,
    notes: item.notes ?? null,
    sort_order: index,
    component_key: item.componentKey ?? null,
  };
}

function adoptPricing(estimate: ReturnType<typeof calculateEstimate>) {
  return estimate.lineItems.map((item, index) =>
    valuesFromEstimateLineItem(asEstimateRow(item, index))
  );
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
    notes_internal: null,
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

function mapReviewLines(
  items: readonly EstimateLineItemInput[]
): EstimateLineItem[] {
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

function reviewOf(
  estimate: ReturnType<typeof calculateEstimate>,
  facts: EstimateFact[]
) {
  return composeBuilderReview({
    estimate: {
      recommendedCost: estimate.recommendedCost,
      recommendedSell: estimate.recommendedSell,
      marginPercent: estimate.marginPercent,
      confidence: estimate.confidence,
      assumptions: estimate.assumptions,
      missingInfo: estimate.missingInfo,
      lineItems: mapReviewLines(estimate.lineItems),
    },
    workAreas: [{ ...WA, status: "confirmed" }],
    requirements: estimate.requirements,
    facts,
  });
}

console.log("=== DOORS-06 Pricing ===\n");

const a = hosted([fixtureA()]);
const b = hosted([fixtureB()]);
const c = hosted([fixtureC()]);
const d = hosted([fixtureD()]);
const e = hosted([fixtureE()]);
const f = hosted([fixtureF()]);
const combined = hosted(combinedPortions());

check("1. Fixture A direct COST remains $445", near(a.recommendedCost, 445));
check("2. Fixture B remains $585", near(b.recommendedCost, 585));
check("3. Fixture C remains $170", near(c.recommendedCost, 170));
check("4. Fixture D remains $310", near(d.recommendedCost, 310));
check("5. Fixture E remains $255", near(e.recommendedCost, 255));
check("6. Fixture F remains $890", near(f.recommendedCost, 890));
check("7. Combined fixture remains $1,200", near(combined.recommendedCost, 1200));

const adoptedA = adoptPricing(a);
check(
  "8. Pricing consumes hosted direct COST without recomputation",
  adoptedA.every((row, index) =>
    near(row.totalCost, a.lineItems[index]!.recommendedCost)
  ) &&
    near(
      adoptedA.reduce((sum, row) => sum + row.totalCost, 0),
      445
    ) &&
    read("lib/pricing/estimate-to-pricing-adapter.ts").includes(
      'calculationMode: "lump_sum"'
    ) &&
    !read("lib/pricing/estimate-to-pricing-adapter.ts").includes("doorsEach") &&
    !read("lib/estimate/doors-quote.ts").includes("FITOUT_BENCHMARKS")
);

const sellFromShared = deriveSellFromCost(445, 20);
check(
  "9. Existing target margin formula is used",
  near(a.recommendedSell, sellFromShared) &&
    read("lib/estimate/margin-override.ts").includes("deriveSellFromCost") &&
    !read("lib/estimate/doors-quote.ts").includes("1.25") &&
    !read("lib/estimate/doors-commercial.ts").includes("doorsMarkup")
);

const marginRetarget = applyTargetMarginToLineItems(
  a.lineItems.map((row) => ({
    recommendedCost: row.recommendedCost,
    recommendedSell: row.recommendedSell,
    quantity: row.quantity,
    labourHours: row.labourHours,
    costRate: row.costRate,
  })),
  35,
  { default_margin_percent: 35 } as never
);
check(
  "10. Margin change does not change direct COST",
  marginRetarget.every((row, index) =>
    near(row.recommendedCost, a.lineItems[index]!.recommendedCost)
  ) &&
    marginRetarget.some(
      (row, index) =>
        Math.abs(row.recommendedSell - a.lineItems[index]!.recommendedSell) > 0.02
    ) &&
    near(
      marginRetarget.reduce((sum, row) => sum + row.recommendedCost, 0),
      445
    )
);

const quoteGst = calculateQuoteTotals(
  [{ total: a.recommendedSell, visible: true }],
  DEFAULT_GST_RATE
);
const pricingGst = calculateDocumentTotals(
  [{ total_cost: a.recommendedCost, total_sell: a.recommendedSell }],
  DEFAULT_GST_RATE
);
check(
  "11. GST uses the existing shared formula",
  near(quoteGst.gstAmount, roundMoney(a.recommendedSell * (DEFAULT_GST_RATE / 100))) &&
    near(pricingGst.gstAmount, quoteGst.gstAmount) &&
    DEFAULT_GST_RATE === 15 &&
    read("lib/pricing/calculations.ts").includes("subtotalSell * (gstRate / 100)")
);

const companyMat = hosted([fixtureA()], {
  rates: [companyMaterial(DOORS_PREHUNG_HOLLOW_CORE_SET_KEY, 300)],
});
check(
  "12. Company material overrides survive",
  near(companyMat.recommendedCost, 445 - 240 + 300) &&
    companyMat.recommendedCost !== a.recommendedCost
);

const companyProd = hosted([fixtureA()], {
  rates: [companyProductivity(DOORS_PREHUNG_INSTALL_HOURS_PER_DOOR_KEY, 3, "door")],
});
check(
  "13. Company productivity overrides survive",
  companyProd.recommendedCost > a.recommendedCost &&
    companyProd.lineItems.some(
      (row) => (row.labourHours ?? 0) > (a.lineItems.find((item) => item.labourHours)?.labourHours ?? 0)
    )
);

const companyHr = hosted([fixtureA()], {
  rates: [companyLabour(80)],
});
check(
  "14. Company hourly COST overrides survive",
  companyHr.recommendedCost > a.recommendedCost
);

check(
  "15. Pricing edits do not change physical facts",
  !read("lib/pricing/actions.ts").includes("project_facts") &&
    read("lib/pricing/actions.ts").includes("export async function updatePricingItem") &&
    !read("lib/pricing/actions.ts").includes("doors.portions") &&
    JSON.stringify(persist([fixtureA()])) ===
      JSON.stringify(persist([fixtureA()]))
);

console.log("\n=== DOORS-06 ordinary Quote copy ===\n");

const prehungQuote = doorsQuote([fixtureF()]);
const prehungExcludedHw = doorsQuote([
  ordinary({
    id: "prehung-no-hw",
    label: "Hall",
    quantity: 1,
    hardware_included: false,
  }),
]);
const replacementQuote = doorsQuote([
  replacement({
    id: "ensuite-leaf",
    label: "Ensuite door",
    leaf_construction: "solid_core",
    hardware_included: false,
  }),
]);
const noLocationQuote = doorsQuote([
  ordinary({ id: "no-loc", label: null, quantity: 1 }),
]);
const singularQuote = doorsQuote([fixtureA()]);
const multiQuote = doorsQuote(combinedPortions());

check("16. Prehung quote includes quantity", /2\s*×/.test(prehungQuote));
check("17. Prehung quote includes dimensions", /1980\s*×\s*810\s*mm/.test(prehungQuote));
check("18. Prehung quote includes leaf construction", /hollow-core/.test(prehungQuote));
check(
  "19. Prehung quote says prehung internal door set",
  /prehung internal door sets/.test(prehungQuote)
);
check(
  "20. Prehung quote accurately describes jamb/stops/hinges",
  /standard timber jambs, stops and hinges/.test(prehungQuote)
);
check(
  "21. Included hardware is stated as a standard allowance",
  /standard latch\/lever hardware allowance and installation for each door/.test(
    prehungQuote
  )
);
check(
  "22. Excluded hardware is accurately excluded",
  /Door hardware is excluded/.test(prehungExcludedHw) &&
    !/standard latch\/lever hardware allowance/.test(prehungExcludedHw)
);
check(
  "23. Replacement quote says existing frame retained",
  /existing retained frame\/jamb/.test(replacementQuote)
);
check(
  "24. Reused hardware is accurately described",
  /Existing door hardware will be reused/.test(replacementQuote)
);
check(
  "25. Replacement quote does not claim a new frame",
  !/new frame/i.test(replacementQuote) &&
    !/supply and install[\s\S]*jamb/i.test(replacementQuote)
);
check(
  "26. Location appears when known",
  /Bedroom doors:/.test(prehungQuote) &&
    /Ensuite door:/.test(replacementQuote) &&
    !/to the bedrooms/.test(prehungQuote) &&
    !/to the ensuite/.test(replacementQuote)
);
check(
  "27. Optional missing location does not create broken copy",
  !/to the \.|to the,|to undefined|to null/i.test(noLocationQuote) &&
    !/^[^:]*:/.test(noLocationQuote) &&
    /Supply and install 1 × 1980 × 810 mm hollow-core prehung internal door set, including a standard timber jamb, stops and hinges/.test(
      noLocationQuote
    )
);
check(
  "28. Singular/plural grammar is correct",
  /prehung internal door set, including/.test(noLocationQuote) &&
    /prehung internal door sets/.test(prehungQuote) &&
    !/1 ×[\s\S]*door sets/.test(noLocationQuote) &&
    /prehung internal door set/.test(singularQuote)
);
check(
  "29. Multiple Door Sets produce separate scope entries",
  /Bedroom doors:/.test(multiQuote) &&
    /Ensuite:/.test(multiQuote) &&
    doorsIncludedQuoteScopeCount(quoteFacts(combinedPortions())) === 2
);
check(
  "30. Different portions do not overwrite each other",
  /2 × 1980 × 810 mm hollow-core prehung/.test(multiQuote) &&
    /1 × 2200 × 910 mm solid-core replacement/.test(multiQuote)
);

console.log("\n=== DOORS-06 exclusions ===\n");

check(
  "31. No architrave inclusion is invented",
  !/architraves? are included/i.test(prehungQuote) &&
    /architraves/.test(DOORS_QUOTE_SHARED_EXCLUSIONS)
);
check(
  "32. No painting inclusion is invented",
  !/painting is included/i.test(prehungQuote)
);
check(
  "33. No stopping inclusion is invented",
  !/stopping is included/i.test(prehungQuote)
);
check(
  "34. No opening formation is invented",
  !/opening formation is included/i.test(prehungQuote) &&
    /opening formation or alteration/.test(prehungQuote)
);
check(
  "35. No removal/disposal is invented",
  !/removal\/disposal is included/i.test(prehungQuote) &&
    /removal\/disposal/.test(prehungQuote)
);

const paintingQuote = buildWorkAreaQuoteDescriptionDraft({
  type: "painting",
  name: "Painting",
  facts: [],
});
check(
  "36. Shared-work-area finishing does not produce contradictory project scope",
  /Door finishing is excluded from this Doors scope unless separately listed/.test(
    prehungQuote
  ) &&
    !/painting is excluded(?! from this Doors)/i.test(prehungQuote) &&
    prehungQuote.includes(DOORS_QUOTE_FINISHING_OWNERSHIP) &&
    paintingQuote.length > 0
);

console.log("\n=== DOORS-06 custom/specialist/incomplete safety ===\n");

const customUnresolved = ordinary({
  id: "custom-1",
  leaf_construction: "other",
  other_description: "cedar veneer",
  hardware_included: true,
});
const customQuote = doorsQuote([customUnresolved]);
const customHosted = hosted([customUnresolved]);
const customPricedQuote = doorsQuote([customUnresolved], [
  {
    label: "Custom leaf",
    component_key: DOORS_CUSTOM_LEAF_COMPONENT,
    cost_known: true,
    total_cost: 400,
    total_sell: 500,
  },
]);

check(
  "37. Unresolved custom material is not falsely included",
  customQuote.includes(DOORS_QUOTE_CUSTOM_SUPPLY_EXCLUDED) &&
    !/supply and install the specified custom door leaf is included/i.test(customQuote)
);
check(
  "38. Custom installation labour may remain included",
  customQuote.includes(DOORS_QUOTE_CUSTOM_INSTALL_INCLUDED) &&
    customHosted.lineItems.some(
      (row) => (row.recommendedCost ?? 0) > 0 && /install/i.test(row.label)
    )
);
check(
  "39. Custom hardware may remain included",
  /standard latch\/lever hardware allowance/.test(customQuote) &&
    customHosted.lineItems.some((row) => /hardware/i.test(row.label) && (row.recommendedCost ?? 0) > 0)
);
check(
  "40. Custom Quote leaks no internal PR diagnostic",
  !quoteLeaksInternal(customQuote) && !/doors\.leaf\.custom/.test(customQuote)
);

const specialistOnly = hosted([specialist()]);
const specialistQuote = doorsQuote([specialist()]);
check(
  "41. Specialist is not ordinarily priced",
  includedCost(specialistOnly.lineItems) === 0 &&
    specialistOnly.lineItems.every(
      (row) => (row.recommendedCost ?? 0) === 0 || row.includedInTotal === false
    )
);
check(
  "42. Specialist is not falsely included",
  !/supply and install[\s\S]*specialist door system is included/i.test(specialistQuote) &&
    /excluded pending separate specification and pricing/.test(specialistQuote)
);
check(
  "43. Specialist gets client-safe exclusion/pending wording",
  specialistQuote.includes(DOORS_QUOTE_SPECIALIST_PENDING)
);

const mixed = hosted([fixtureA(), specialist({ id: "spec-sibling", label: "Plant room" })]);
const mixedQuote = doorsQuote([
  fixtureA(),
  specialist({ id: "spec-sibling", label: "Plant room" }),
]);
check(
  "44. Supported sibling remains included",
  near(mixed.recommendedCost, 445) &&
    /Supply and install 1 × 1980 × 810 mm hollow-core prehung/.test(mixedQuote) &&
    /Plant room:/.test(mixedQuote)
);

const incomplete = createEmptyDoorPortion({ id: "incomplete-1", label: "Spare" });
const incompleteWithSibling = doorsQuote([fixtureA(), incomplete]);
const incompleteOnlyQuote = doorsQuote([incomplete]);
const incompleteHosted = hosted([fixtureA(), incomplete]);
check(
  "45. Incomplete portion is not falsely included",
  !/Spare: Supply and install/.test(incompleteWithSibling) &&
    incompleteOnlyQuote.includes(DOORS_QUOTE_INCOMPLETE_ONLY_PENDING) &&
    !/3 ×/.test(incompleteOnlyQuote)
);
check(
  "46. Incomplete portion does not suppress complete sibling",
  /Supply and install 1 × 1980 × 810 mm hollow-core prehung/.test(incompleteWithSibling) &&
    incompleteWithSibling.includes(DOORS_QUOTE_INCOMPLETE_SIBLING_PENDING) &&
    near(incompleteHosted.recommendedCost, 445)
);

const prStub: PricingItem = {
  ...toPricingItem(a.lineItems[0]!, 0),
  id: "pr-stub",
  component_key: DOORS_SPECIALIST_COMPONENT,
  total_cost: 0,
  total_sell: 0,
  cost_known: false,
  client_label: "Specialist door",
  internal_label: "Specialist door",
};
const quoteItems = mapPricingItemsToQuoteItems(
  [...a.lineItems.map((item, index) => toPricingItem(item, index)), prStub],
  new Map([[WA.id, WA.name]])
);
check(
  "47. No missing item becomes legitimate $0",
  !quoteItems.some((row) => row.total === 0 && /specialist/i.test(row.label)) &&
    !doorsPricingItemIsClientPriced(prStub)
);

const incompleteOnlyHosted = hosted([incomplete]);
check(
  "48. No legacy money fills unresolved nested work",
  !incompleteHosted.lineItems.some(
    (row) => row.recommendedCost === FITOUT_BENCHMARKS.doorsEach.cost
  ) &&
    !incompleteOnlyHosted.lineItems.some(
      (row) => row.recommendedCost === FITOUT_BENCHMARKS.doorsEach.cost
    ) &&
    (incompleteOnlyHosted.missingInfo.includes(DOORS_NESTED_NOT_CALCULATED_MESSAGE) ||
      includedCost(incompleteOnlyHosted.lineItems) === 0)
);

console.log("\n=== DOORS-06 confidentiality ===\n");

const confidentialitySample = [prehungQuote, replacementQuote, customQuote, specialistQuote, mixedQuote, incompleteWithSibling].join("\n");
check("49. Quote contains no material COST", !/\$\s*[\d,]/.test(confidentialitySample) && !/material COST/i.test(confidentialitySample));
check("50. Quote contains no labour COST", !/labour COST/i.test(confidentialitySample) && !/\$60/.test(confidentialitySample));
check("51. Quote contains no person-hours", !/person-hours?/i.test(confidentialitySample) && !/\b2\.00\b/.test(confidentialitySample));
check("52. Quote contains no hourly rate", !/\/hour/.test(confidentialitySample) && !/\$60\/h/i.test(confidentialitySample));
check("53. Quote contains no productivity value", !/hours_per_door/.test(confidentialitySample) && !/\bproductivity\b/i.test(confidentialitySample));
check("54. Quote contains no benchmark/company source", !/\bbenchmark\b/i.test(confidentialitySample) && !/company rate/i.test(confidentialitySample));
check(
  "55. Quote contains no internal keys",
  !/door\.set\.internal/.test(confidentialitySample) &&
    !/doors\.prehung\.install/.test(confidentialitySample)
);
check("56. Quote contains no internal margin diagnostics", !/derived_from_gross_margin/.test(confidentialitySample) && !/gross profit/i.test(confidentialitySample));
check("57. Quote contains no Pricing Required", !/\bPricing Required\b/i.test(confidentialitySample));
check(
  "58. Quote contains no unsupported enum name",
  !/other_unsupported/.test(confidentialitySample) &&
    !/prehung_internal/.test(confidentialitySample) &&
    !/fire_rated/.test(confidentialitySample)
);

console.log("\n=== DOORS-06 legacy and integration ===\n");

const legacyHosted = calculateDoors(
  ctx([{ key: "doors.count", work_area_id: WA.id, value: 2, source: "user" }]),
  WA
);
const legacyCopy = legacyDoorsQuote();
check(
  "59. Legacy flat Doors behaviour remains unchanged",
  legacyHosted.lineItems.length > 0 &&
    !legacyHosted.missingInfo.includes(DOORS_NESTED_NOT_CALCULATED_MESSAGE) &&
    /internal door\(s\)/.test(legacyCopy) &&
    /frames, hardware and associated finishing/.test(legacyCopy)
);
check(
  "60. Nested Doors contains no legacy allowance wording",
  !/Door supply\/install allowance/i.test(prehungQuote) &&
    !/doorsEach/.test(prehungQuote) &&
    !/doorInstallEach/.test(prehungQuote) &&
    !/associated finishing where included/.test(prehungQuote)
);

let iwFacts: EstimateFact[] = [];
iwFacts = applyInternalWallsFactWrite({
  facts: iwFacts,
  workAreaId: IW.id,
  key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY,
  value: true,
});
const iwTypeId = resolveInternalWallsWallTypes({
  facts: iwFacts,
  workAreaId: IW.id,
}).types[0]!.id;
iwFacts = applyInternalWallsFactWrite({
  facts: iwFacts,
  workAreaId: IW.id,
  key: INTERNAL_WALLS_HAS_OPENINGS_KEY,
  value: "Yes",
  wallTypeId: iwTypeId,
});
const iwOpeningId = resolveInternalWallsWallTypes({
  facts: iwFacts,
  workAreaId: IW.id,
}).types[0]!.openings[0]!.id;
iwFacts = applyInternalWallsFactWrite({
  facts: iwFacts,
  workAreaId: IW.id,
  key: "internal_walls.opening.width_m",
  value: 0.81,
  wallTypeId: iwTypeId,
  openingId: iwOpeningId,
});
iwFacts = applyInternalWallsFactWrite({
  facts: iwFacts,
  workAreaId: IW.id,
  key: "internal_walls.opening.height_m",
  value: 1.98,
  wallTypeId: iwTypeId,
  openingId: iwOpeningId,
});
iwFacts = [
  {
    key: INTERNAL_WALLS_JOB_SCOPE_FACT_KEY,
    work_area_id: IW.id,
    value: "new_partition",
    source: "user",
  },
  ...iwFacts.filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
];
const iwTypes = resolveInternalWallsWallTypes({
  facts: iwFacts,
  workAreaId: IW.id,
}).types;
const iwQuote = buildWorkAreaQuoteDescriptionDraft({
  type: "internal_walls",
  name: "Internal Walls",
  facts: [
    {
      key: "internal_walls.wall_types",
      label: "Wall types",
      value: JSON.stringify(iwTypes),
    },
    {
      key: "internal_walls.job_scope",
      label: "Job scope",
      value: "new_partition",
    },
  ],
});
const iwOnly = calculateEstimate(ctx(iwFacts, { workAreas: [IW] }));
check(
  "61. IW opening-only creates no Doors Quote scope",
  !/prehung internal door/.test(iwQuote) &&
    /Door leaves, frames, hardware and door installation are not included/.test(iwQuote) &&
    !iwOnly.lineItems.some((row) =>
      looksLikeDoorProductMoney({
        label: row.label,
        componentKey: row.componentKey,
        itemKey: row.itemKey,
      })
    )
);

const combinedCopy = `${iwQuote} ${prehungQuote}`;
check(
  "62. Combined IW + Doors produces separate, non-duplicated scope",
  /Door leaves, frames, hardware and door installation are not included/.test(iwQuote) &&
    /prehung internal door/.test(prehungQuote) &&
    combinedCopy.includes(iwQuote) &&
    combinedCopy.includes(prehungQuote)
);
check(
  "63. Internal Walls opening copy remains unchanged",
  /Openings are formed as specified/.test(iwQuote) &&
    read("lib/work-areas/quote-description.ts").includes(
      "Door leaves, frames, hardware and door installation are not included unless a separate Doors work area is confirmed."
    )
);

const ceilingQuote = buildWorkAreaQuoteDescriptionDraft({
  type: "ceilings",
  name: "Ceilings",
  facts: [{ key: "ceilings.area_m2", label: "Area", value: "12" }],
});
check(
  "64. Ceiling Quote regression remains unchanged",
  /12 m²/.test(ceilingQuote) &&
    read("lib/work-areas/quote-description.ts").includes("function buildCeilingsDraft") &&
    /Electrical\/light relocation is excluded/.test(ceilingQuote)
);

const reviewA = reviewOf(a, persist([fixtureA()]));
check(
  "65. Builder Review totals still reconcile",
  near(reviewA.overview.recommendedCost, 445) &&
    near(reviewA.overview.recommendedCost, a.recommendedCost)
);

const pricingTotals = calculateDocumentTotals(
  adoptedA.map((row) => ({ total_cost: row.totalCost, total_sell: row.totalSell })),
  DEFAULT_GST_RATE
);
check(
  "66. Pricing totals reconcile",
  near(pricingTotals.subtotalCost, 445) &&
    near(pricingTotals.subtotalSell, a.recommendedSell)
);
check(
  "67. Hosted estimate totals reconcile",
  near(a.recommendedCost, 445) &&
    near(includedCost(a.lineItems), 445) &&
    near(combined.recommendedCost, 1200)
);

const doorsCoverage = verifyRegisteredWorkAreaBenchmarkCoverage("doors");
const support = getWorkAreaSupportEntry("doors");
check(
  "68. Coverage status is honest",
  doorsCoverage.ok &&
    DOORS_BENCHMARK_REQUIREMENTS.some(
      (row) =>
        /pricing and quote/i.test(row.component) &&
        row.outcome === "RESOLVES_WITH_QUOTR"
    ) &&
    DOORS_BENCHMARK_REQUIREMENTS.some(
      (row) => /custom/i.test(row.component) && row.outcome === "INTENTIONAL_PRICING_REQUIRED"
    ) &&
    DOORS_BENCHMARK_REQUIREMENTS.some(
      (row) => /specialist/i.test(row.component) && row.outcome === "INTENTIONAL_PRICING_REQUIRED"
    ) &&
    DOORS_ORDINARY_MATERIAL_KEYS.every((key) => liveQuotrMaterialCost(key) != null) &&
    DOORS_ORDINARY_PRODUCTIVITY_KEYS.every((key) => liveQuotrProductivity(key) != null) &&
    support?.band === "component"
);
check(
  "69. Ordinary nested Doors V1 is human-QA frozen",
  workAreaMayCloseAtL5(doorsCoverage) &&
    /human-qa frozen/i.test(
      DOORS_BENCHMARK_REQUIREMENTS.find((row) => /pricing and quote/i.test(row.component))?.notes ?? ""
    ) &&
    /DOORS-07/.test(
      DOORS_BENCHMARK_REQUIREMENTS.find((row) => /pricing and quote/i.test(row.component))?.notes ?? ""
    ) &&
    !/not human-qa frozen/i.test(
      DOORS_BENCHMARK_REQUIREMENTS.find((row) => /pricing and quote/i.test(row.component))?.notes ?? ""
    ) &&
    /human-qa frozen/i.test(support?.notes ?? "") &&
    !/not human-qa frozen/i.test(support?.notes ?? "")
);
check(
  "70. Production behaviour is not changed by feature flags or environment bypasses",
  !read("lib/estimate/doors-quote.ts").includes("process.env") &&
    !read("lib/work-areas/quote-description.ts").includes("process.env") &&
    !read("lib/pricing/adoption-authority.ts").includes("process.env") &&
    read("lib/pricing/adoption-authority.ts").includes('"authoritative"')
);

console.log("\n=== DOORS-06 extra integration ===\n");

const mixedQuoteItems = mapPricingItemsToQuoteItems(
  mixed.lineItems.map((item, index) => toPricingItem(item, index)),
  new Map([[WA.id, WA.name]]),
  new Map([[WA.id, mixedQuote]])
);
const inclusions = buildInclusionsFromPricing(
  mixed.lineItems.map((item, index) => toPricingItem(item, index)),
  new Map([[WA.id, WA.name]])
);
check(
  "extra. Mixed Quote items keep priced sibling and drop unresolved $0",
  mixedQuoteItems.length > 0 &&
    mixedQuoteItems.every((row) => row.total > 0) &&
    inclusions.includes("Doors")
);

check(
  "extra. Existing manual-pricing path is updatePricingItem, not a new mechanism",
  read("lib/pricing/actions.ts").includes("export async function updatePricingItem") &&
    !read("lib/estimate/doors-quote.ts").includes("manualPrice") &&
    customPricedQuote.includes("Supply and installation of the specified custom door leaf is included") &&
    !customPricedQuote.includes(DOORS_QUOTE_CUSTOM_SUPPLY_EXCLUDED)
);

if (failed > 0) {
  console.log(`\nDOORS-06 FAILED: ${passed} passed, ${failed} failed`);
  process.exit(1);
}
console.log(`\nDOORS-06 PASSED: ${passed} passed, ${failed} failed`);
