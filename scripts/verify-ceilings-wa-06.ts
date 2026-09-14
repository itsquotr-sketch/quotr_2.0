/**
 * CEILINGS WA-06 — nested Ceiling product experience:
 * Builder Review, Refine, Pricing, Quote, ownership, mobile.
 *
 * Run: npx --yes tsx scripts/verify-ceilings-wa-06.ts
 *
 * Preview only. Does not change physical formulas or invent benchmarks.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { OrganisationRate, OrganisationSettings } from "../components/setup/types";
import type { EstimateLineItem } from "../components/assistant/types";
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import type { AIExtractionOutput } from "../lib/ai/schema";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { isDetailsOwnedWhenUnresolved } from "../lib/assistant/question-ownership";
import { isUserFacingEstimateAssumption } from "../lib/assistant/presentation/user-facing-estimate-assumptions";
import { getRefineAdapter } from "../lib/assistant/refine/adapters/registry";
import { ceilingsRefineAdapter } from "../lib/assistant/refine/adapters/ceilings";
import { composeRefineView } from "../lib/assistant/refine/compose";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import {
  aggregateCeilingCommercialLines,
  ceilingCommercialOwnsFinishMoney,
  commercializeCeilings,
} from "../lib/estimate/ceilings-commercial";
import {
  CEILINGS_DNA_COVERAGE,
  CEILINGS_PARTIAL_ESTIMATE_MESSAGE,
  CEILINGS_PLASTERBOARD_LABOUR,
  CEILINGS_STEEL_PRIMARY_LABOUR,
  CEILINGS_TIMBER_FRAMING_LABOUR,
  CEILINGS_WIRE_LABOUR_DECISION,
} from "../lib/estimate/ceilings-identities";
import {
  CEILINGS_FIXINGS_PLASTERBOARD_COMPONENT,
  CEILINGS_FIXINGS_TIMBER_FRAMING_COMPONENT,
} from "../lib/estimate/ceilings-fixings";
import {
  CEILINGS_PLASTERBOARD_COMPONENT,
  CEILINGS_TILE_GRID_GRID_COMPONENT,
  CEILINGS_TILE_GRID_TILE_COMPONENT,
} from "../lib/estimate/ceilings-lining";
import { CEILINGS_TIMBER_FRAMING_COMPONENT } from "../lib/estimate/ceilings-framing";
import {
  CEILINGS_STEEL_PRIMARY_COMPONENT,
} from "../lib/estimate/ceilings-steel";
import {
  calculateCeilingBulkhead,
  CEILINGS_BULKHEAD_FRAMING_TIMBER_COMPONENT,
  CEILINGS_BULKHEAD_LINING_COMPONENT,
} from "../lib/estimate/ceilings-bulkheads";
import { calculateCeilingsPhysical } from "../lib/estimate/ceilings-physical";
import {
  applyCeilingsFactWrite,
  CEILINGS_BULKHEAD_TOPOLOGY_V1,
  CEILINGS_NESTED_NOT_CALCULATED_MESSAGE,
  CEILINGS_PORTIONS_FACT_KEY,
  createEmptyCeilingBulkhead,
  createEmptyCeilingPortion,
  hasCanonicalCeilingsPortions,
  type CeilingPortion,
} from "../lib/estimate/ceilings-portions";
import {
  CEILINGS_QUOTE_PR_BLOCK_MESSAGE,
  nestedCeilingsQuoteIsBlocked,
} from "../lib/estimate/ceilings-quote-readiness";
import { serializeLineItemMetadata } from "../lib/estimate/line-item-metadata";
import { calculateAuthoritativeFieldsFromEstimateLine } from "../lib/pricing/estimate-to-pricing-adapter";
import { mapPricingItem } from "../lib/pricing/mappers";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";
import { WORK_AREA_SCOPE_OWNERS } from "../lib/work-areas/ownership";
import { buildWorkAreaDescriptionsMap } from "../lib/work-areas/quote-description";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "../lib/estimate/types";
import type { LabourRequirement, MaterialRequirement } from "../lib/estimate/requirements";
import type { MaterialWastageSettings } from "../lib/settings/material-wastage";

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

function near(actual: number | null | undefined, expected: number, tol = 0.05): boolean {
  return actual != null && Number.isFinite(actual) && Math.abs(actual - expected) <= tol;
}

const P1 = "aaaaaaaa-bbbb-4ccc-8ddd-111111111111";
const P2 = "bbbbbbbb-cccc-4ddd-8eee-222222222222";
const P3 = "dddddddd-eeee-4fff-8aaa-444444444444";
const BH1 = "cccccccc-dddd-4eee-8fff-333333333333";

const WASTAGE: MaterialWastageSettings = {
  defaultMaterialWastagePercent: 10,
  sheetMaterialWastagePercent: 10,
  timberFramingWastagePercent: 10,
};

const SETTINGS: OrganisationSettings = {
  id: "s1",
  org_id: "o1",
  default_margin_percent: 20,
  default_contingency_percent: 0,
  budget_rate_factor: 0.9,
  premium_rate_factor: 1.15,
  currency: "NZD",
  country: "NZ",
  region: null,
  onboarding_status: "completed",
  onboarding_step: "completed",
  onboarding_completed_at: null,
  prefer_user_rates: true,
  allow_benchmark_rates: true,
  show_profit_in_estimates: true,
};

function wa(id = "c1", name = "Ceilings"): EstimateWorkArea {
  return { id, type: "ceilings", name, sort_order: 1 };
}

function writePortions(
  portions: CeilingPortion[],
  workAreaId = "c1"
): EstimateFact[] {
  return applyCeilingsFactWrite({
    facts: [],
    workAreaId,
    key: CEILINGS_PORTIONS_FACT_KEY,
    value: portions,
  });
}

function estimateCtx(
  facts: EstimateFact[],
  extraWas: EstimateWorkArea[] = [],
  rates: OrganisationRate[] = [],
  settings: OrganisationSettings = SETTINGS
): EstimateContext {
  return {
    project: { id: "ceilings-wa-06", qualityLevel: "standard" },
    confirmedWorkAreas: [wa(), ...extraWas],
    facts,
    constraints: [],
    organisationSettings: settings,
    materialWastageSettings: WASTAGE,
    rates,
  } as unknown as EstimateContext;
}

function orgRate(
  itemKey: string,
  unit: string,
  cost: number,
  extras?: Partial<OrganisationRate>
): OrganisationRate {
  return {
    id: `rate-${itemKey}`,
    rate_type: "material",
    trade: null,
    work_area_type: "ceilings",
    item_key: itemKey,
    label: itemKey,
    unit,
    cost_rate: cost,
    sell_rate: null,
    markup_percent: null,
    active: true,
    ...extras,
  };
}

function plasterPortion(params?: {
  id?: string;
  label?: string;
  length?: number;
  width?: number;
  area?: number;
  product?: "standard" | "aqualine" | "fyreline";
}): CeilingPortion {
  const length = params?.length ?? 4;
  const width = params?.width ?? 3;
  const row = createEmptyCeilingPortion({
    id: params?.id ?? P1,
    label: params?.label ?? (params?.id === P2 ? "Hall" : "Lounge"),
  });
  row.structure.family = "existing_framing";
  row.structure.job_scope = "reline_existing_suitable_framing";
  row.lining.family = "plasterboard";
  row.lining.plasterboard_product = params?.product ?? "standard";
  row.lining.thickness_mm = 13;
  row.lining.sheet_length_mm = 3000;
  row.lining.sheet_width_mm = 1200;
  row.lining.layers = 1;
  row.geometry.mode = params?.area != null ? "area_only" : "length_width";
  row.geometry.length_m = length;
  row.geometry.width_m = width;
  row.geometry.area_m2 = params?.area ?? length * width;
  row.finish.insulation_included = false;
  row.finish.painting_included = false;
  row.finish.stopping_included = false;
  row.finish.demolition_included = false;
  row.has_bulkheads = false;
  return row;
}

function timberPortion(params?: { id?: string; spacing?: number }): CeilingPortion {
  const row = plasterPortion({ id: params?.id });
  row.structure.family = "timber_direct_fix";
  row.structure.timber = {
    size: "140x45_h1.2",
    spacing_mm: params?.spacing ?? 450,
    direction: "along_length",
  };
  return row;
}

function steelPortion(params?: { id?: string }): CeilingPortion {
  const row = plasterPortion({ id: params?.id });
  row.structure.family = "steel_direct_fix";
  row.structure.steel = {
    primary_spacing_mm: 450,
    furring_spacing_mm: 450,
    direction: "along_length",
  };
  return row;
}

function tilePortion30(): CeilingPortion {
  const row = plasterPortion({ id: P3, label: "Office", length: 6, width: 5, area: 30 });
  row.structure.family = "tile_and_grid";
  row.lining.family = "tile_and_grid";
  row.lining.tile = { size: "600x600" };
  return row;
}

function bulkheadPortion(): CeilingPortion {
  const row = plasterPortion();
  const bh = createEmptyCeilingBulkhead({ id: BH1, label: "Bulkhead 1" });
  bh.form = "conventional_two_face_downstand";
  bh.topology = CEILINGS_BULKHEAD_TOPOLOGY_V1;
  bh.length_m = 4;
  bh.depth_m = 0.4;
  bh.height_m = 0.5;
  bh.framing_type = "timber";
  bh.lining_type = "standard";
  bh.thickness_mm = 13;
  row.has_bulkheads = true;
  row.bulkheads = [bh];
  return row;
}

function runCommercial(
  portions: CeilingPortion[],
  rates: OrganisationRate[] = [],
  workArea = wa(),
  settings: OrganisationSettings = SETTINGS
) {
  const facts = writePortions(portions, workArea.id);
  const physical = calculateCeilingsPhysical({
    facts,
    workArea,
    materialWastageSettings: WASTAGE,
  });
  const commercial = commercializeCeilings({
    physical,
    workArea,
    rates,
    organisationSettings: settings,
  });
  return { facts, physical, commercial, workArea };
}

function material(
  requirements: readonly { kind: string; componentKey: string }[],
  componentKey: string
): MaterialRequirement | undefined {
  return requirements.find(
    (row) => row.kind === "material" && row.componentKey === componentKey
  ) as MaterialRequirement | undefined;
}

function labour(
  requirements: readonly { kind: string; componentKey: string }[],
  componentKey: string
): LabourRequirement | undefined {
  return requirements.find(
    (row) => row.kind === "labour" && row.componentKey === componentKey
  ) as LabourRequirement | undefined;
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
    itemKey: item.itemKey,
    componentKey: item.componentKey,
    componentId: item.componentId,
    nestedItemId: item.nestedItemId,
    contributingNestedItemIds: item.contributingNestedItemIds,
    notes: item.notes,
    includedInTotal: item.includedInTotal,
  }));
}

function reviewOf(
  commercial: {
    lineItems: readonly EstimateLineItemInput[];
    assumptions: readonly string[];
    missingInfo: readonly string[];
    requirements: readonly import("../lib/estimate/requirements").EstimateRequirement[];
  },
  facts: EstimateFact[],
  workAreas: Array<{ id: string; type: string; name: string; status: string }> = [
    { id: "c1", type: "ceilings", name: "Ceilings", status: "confirmed" },
  ]
) {
  const cost = commercial.lineItems.reduce((sum, row) => sum + (row.recommendedCost ?? 0), 0);
  const sell = commercial.lineItems.reduce((sum, row) => sum + (row.recommendedSell ?? 0), 0);
  return composeBuilderReview({
    estimate: {
      recommendedCost: cost,
      recommendedSell: sell,
      marginPercent: 20,
      confidence: 0.8,
      assumptions: commercial.assumptions,
      missingInfo: commercial.missingInfo,
      lineItems: mapReviewLines(commercial.lineItems),
    },
    workAreas,
    requirements: commercial.requirements,
    facts,
  });
}

function refineOf(facts: EstimateFact[], workAreas = [{ id: "c1", type: "ceilings", name: "Ceilings", status: "confirmed" }]) {
  const plan = composeJobPlan({
    workAreas,
    facts,
    qualityLevel: "standard",
  });
  return composeRefineView({
    briefText: null,
    qualityLevel: "standard",
    workAreas,
    facts,
    constraints: [],
    jobPlan: {
      cards: plan.cards.map((card) => ({
        workAreaId: card.workAreaId,
        workAreaType: card.workAreaType,
        name: card.name,
        notConfirmed: card.notConfirmed,
      })),
    },
  });
}

function clarifyOf(facts: EstimateFact[]) {
  const workAreas = [{ id: "c1", type: "ceilings", name: "Ceilings", status: "confirmed" as const }];
  const plan = composeJobPlan({
    workAreas,
    facts,
    qualityLevel: "standard",
  });
  return composeClarifyView({
    stage: "quality",
    briefText: "",
    qualityLevel: "standard",
    workAreas,
    facts,
    constraints: [],
    jobPlan: plan,
  });
}

function quoteDraft(portions: CeilingPortion[], workAreaId = "c1"): string {
  const facts = writePortions(portions, workAreaId);
  const raw = facts.find((row) => row.key === CEILINGS_PORTIONS_FACT_KEY)?.value;
  const value = typeof raw === "string" ? raw : JSON.stringify(raw);
  return (
    buildWorkAreaDescriptionsMap(
      [{ id: workAreaId, type: "ceilings", name: "Ceilings" }],
      new Map([
        [
          workAreaId,
          [{ key: CEILINGS_PORTIONS_FACT_KEY, label: "Portions", value }],
        ],
      ])
    ).get(workAreaId) ?? ""
  );
}

function prPricingItem(overrides?: Record<string, unknown>) {
  return mapPricingItem({
    id: "pi-1",
    org_id: "o1",
    pricing_document_id: "pd-1",
    project_id: "p1",
    work_area_id: "c1",
    component_key: CEILINGS_STEEL_PRIMARY_COMPONENT,
    client_label: "Primary ceiling channel",
    internal_label: "Primary ceiling channel",
    item_type: "material",
    quantity: 32,
    unit: "lm",
    unit_cost: 0,
    unit_sell: 0,
    total_cost: 0,
    total_sell: 0,
    gross_profit: 0,
    margin_percent: 0,
    markup_percent: 0,
    sort_order: 1,
    visible_on_quote: true,
    notes_internal: serializeLineItemMetadata({ rateSourceType: "missing" }),
    ...overrides,
  });
}

const steelRates = [
  orgRate("steel.ceiling.perimeter_track.lm", "lm", 8),
  orgRate("steel.ceiling.primary_channel.lm", "lm", 9),
  orgRate("steel.ceiling.furring_channel.lm", "lm", 7),
  orgRate("steel.ceiling.crossover_clip.each", "each", 1.2),
];

console.log("=== CEILINGS WA-06 product experience ===\n");

const plaster = runCommercial([plasterPortion()]);
const plasterReview = reviewOf(plaster.commercial, plaster.facts);
const plasterWa = plasterReview.workAreas[0];
const lounge = plasterWa?.portionGroups?.find((row) => row.id === P1);

check(
  "A Builder Review groups by Portion",
  (plasterWa?.portionGroups?.length ?? 0) === 1 &&
    lounge?.label === "Lounge" &&
    (plasterWa?.categories.every((cat) => cat.lines.length === 0) ?? false)
);

check(
  "B framing group correct (existing frame has no timber/steel frame group)",
  (lounge?.lineGroups.some((row) => row.secondary === "Framing") ?? false) === false
);

const liningGroup = lounge?.lineGroups.find((row) => row.secondary === "Lining");
check(
  "C lining group correct",
  Boolean(liningGroup) &&
    /4/.test(liningGroup?.supporting ?? "") &&
    /5/.test(liningGroup?.supporting ?? "") &&
    liningGroup?.pricingRequired !== true
);

check(
  "D labour group correct",
  lounge?.lineGroups.some((row) => row.secondary === "Labour") === true &&
    labour(plaster.commercial.requirements, CEILINGS_PLASTERBOARD_LABOUR)?.priced === true
);

check(
  "E fixings group correct",
  lounge?.lineGroups.some((row) => row.secondary === "Fixings") === true &&
    material(plaster.commercial.requirements, CEILINGS_FIXINGS_PLASTERBOARD_COMPONENT)?.priced ===
      true
);

const bulk = runCommercial([bulkheadPortion()]);
const bulkReview = reviewOf(bulk.commercial, bulk.facts);
const bulkPortion = bulkReview.workAreas[0]?.portionGroups?.[0];
check(
  "F bulkhead nested grouping correct",
  bulkPortion?.lineGroups.some((row) => row.secondary === "Bulkhead") === true &&
    /4m long/.test(bulkPortion?.lineGroups.find((row) => row.secondary === "Bulkhead")?.supporting ?? "") &&
    near(
      bulk.physical.portions[0]?.bulkheads[0]?.framingLm ??
        (bulk.physical.requirements.find((row) =>
          row.componentKey.includes("bulkhead.framing")
        ) as MaterialRequirement | undefined)?.baseQuantity ??
        0,
      21
    )
);

const omittedLining = plasterPortion();
omittedLining.lining.sheet_length_mm = undefined;
omittedLining.lining.sheet_width_mm = undefined;
omittedLining.lining.layers = null;
const omittedCommercial = runCommercial([omittedLining]);
const omittedReview = reviewOf(omittedCommercial.commercial, omittedCommercial.facts);
const omittedLounge = omittedReview.workAreas[0]?.portionGroups?.find(
  (row) => row.id === P1
);
check(
  "G assumptions surfaced",
  (omittedLounge?.assumptions.some((row) => /3000\s*×\s*1200/i.test(row)) ?? false) &&
    (omittedLounge?.assumptions.some((row) => /one layer/i.test(row)) ?? false) &&
    !(lounge?.assumptions.some((row) => /ASSUMED_DISCLOSED|assumed_disclosed/i.test(row)) ?? false) &&
    !plasterReview.assumptions.some((row) => row.label === CEILINGS_DNA_COVERAGE) &&
    !plasterReview.assumptions.some((row) => row.label === CEILINGS_WIRE_LABOUR_DECISION) &&
    !isUserFacingEstimateAssumption(CEILINGS_DNA_COVERAGE)
);

const steel = runCommercial([steelPortion()]);
const steelReview = reviewOf(steel.commercial, steel.facts);
const steelGroups = steelReview.workAreas[0]?.portionGroups?.[0]?.lineGroups ?? [];
check(
  "H PR items visibly PR",
  steel.commercial.completeness === "PRICING_REQUIRED" &&
    steelGroups.some((row) => row.pricingRequired === true && /Pricing Required/i.test(row.supporting ?? row.rateContext ?? "")) &&
    steelGroups.some(
      (row) =>
        row.secondary === "Labour" &&
        labour(steel.commercial.requirements, CEILINGS_STEEL_PRIMARY_LABOUR)?.priced === true
    )
);

check(
  "I partial estimate status visible",
  steelReview.overview.partialEstimateLabel === "Some Ceiling items still require pricing." &&
    steelReview.overview.recommendedSellIsPartial === true &&
    steelReview.workAreas[0]?.partialEstimateLabel ===
      "Some Ceiling items still require pricing." &&
    steelReview.workAreas[0]?.resolvedSubtotalLabel === "Current priced total"
);

check(
  "J Refine adapter registered",
  getRefineAdapter("ceilings") === ceilingsRefineAdapter &&
    read("lib/assistant/refine/adapters/registry.ts").includes("ceilingsRefineAdapter")
);

const timberFacts = writePortions([timberPortion()]);
const timberRefine = refineOf(timberFacts);
const timberKeys = [...timberRefine.highValue, ...timberRefine.advanced].map(
  (row) => row.factKey
);
check(
  "K Refine only shows relevant resolved/editable facts",
  timberKeys.includes("ceilings.portion.spacing_mm") &&
    timberKeys.includes("ceilings.portion.plasterboard_product") &&
    !timberKeys.includes("ceilings.portion.tile_size") &&
    timberRefine.ceilingPortionPanels?.[0]?.portions.some((row) => row.id === P1) === true
);

const unresolved = writePortions([createEmptyCeilingPortion({ id: P1 })]);
const unresolvedRefine = refineOf(unresolved);
const unresolvedDetails = clarifyOf(unresolved);
check(
  "L unresolved required fact remains Details-owned",
  isDetailsOwnedWhenUnresolved("ceilings", "ceilings.portion.job_scope") &&
    unresolvedDetails.candidates.some((row) => row.factKey === "ceilings.portion.job_scope") &&
    ![...unresolvedRefine.highValue, ...unresolvedRefine.advanced].some(
      (row) => row.factKey === "ceilings.portion.job_scope"
    )
);

const timber450 = runCommercial([timberPortion()]);
const timber600Facts = applyCeilingsFactWrite({
  facts: writePortions([timberPortion()]),
  workAreaId: "c1",
  key: "ceilings.portion.spacing_mm",
  value: 600,
  nestedItemId: P1,
});
const timber600 = calculateCeilingsPhysical({
  facts: timber600Facts,
  workArea: wa(),
  materialWastageSettings: WASTAGE,
});
const timber600Commercial = commercializeCeilings({
  physical: timber600,
  workArea: wa(),
  rates: [],
  organisationSettings: SETTINGS,
});
check(
  "M spacing edit 450→600 recomputes 32→24lm",
  near(material(timber450.commercial.requirements, CEILINGS_TIMBER_FRAMING_COMPONENT)?.baseQuantity, 32) &&
    near(material(timber600Commercial.requirements, CEILINGS_TIMBER_FRAMING_COMPONENT)?.baseQuantity, 24) &&
    !timber600Commercial.lineItems.some((item) => item.quantity === 32 && item.componentKey === CEILINGS_TIMBER_FRAMING_COMPONENT)
);

const fyreFacts = applyCeilingsFactWrite({
  facts: writePortions([plasterPortion()]),
  workAreaId: "c1",
  key: "ceilings.portion.plasterboard_product",
  value: "fyreline",
  nestedItemId: P1,
});
const fyreHosted = calculateEstimate(estimateCtx(fyreFacts));
const fyreQuote = quoteDraft([plasterPortion({ product: "fyreline" })]);
const standardQuote = quoteDraft([plasterPortion()]);
check(
  "N Standard→Fyreline removes stale Standard line",
  fyreHosted.lineItems.every((item) => !/standard/i.test(item.label) || /fyreline/i.test(item.label)) &&
    fyreHosted.lineItems.some((item) => /fyreline/i.test(item.label) || /fyreline/i.test(item.itemKey ?? "")) &&
    /Fyreline/i.test(fyreQuote) &&
    /Standard/i.test(standardQuote) &&
    !/Standard/i.test(fyreQuote)
);

const overlay = calculateAuthoritativeFieldsFromEstimateLine({
  category: "materials",
  recommended_cost: 0,
  recommended_sell: 0,
  notes: serializeLineItemMetadata({ rateSourceType: "missing" }),
});
const resolvedItem = prPricingItem({
  unit_cost: 9,
  total_cost: 288,
  total_sell: 360,
});
check(
  "O Pricing can resolve missing material rate",
  overlay.ok && overlay.fields.costKnown === false &&
    prPricingItem().cost_known === false &&
    resolvedItem.cost_known === true
);

const steelCleared = runCommercial([steelPortion()], steelRates);
check(
  "P PR→Complete transition works",
  steel.commercial.completeness === "PRICING_REQUIRED" &&
    steelCleared.commercial.completeness === "COMPLETE_COMMERCIAL" &&
    near(
      material(steel.commercial.requirements, CEILINGS_STEEL_PRIMARY_COMPONENT)?.baseQuantity ?? -1,
      material(steelCleared.commercial.requirements, CEILINGS_STEEL_PRIMARY_COMPONENT)?.baseQuantity ?? -2
    ) &&
    material(steelCleared.commercial.requirements, CEILINGS_STEEL_PRIMARY_COMPONENT)?.priced === true
);

const gm30 = runCommercial(
  [timberPortion()],
  [],
  wa(),
  { ...SETTINGS, default_margin_percent: 30 }
);
check(
  "Q GM change affects sell not physical qty",
  near(
    material(timber450.commercial.requirements, CEILINGS_TIMBER_FRAMING_COMPONENT)?.baseQuantity,
    material(gm30.commercial.requirements, CEILINGS_TIMBER_FRAMING_COMPONENT)?.baseQuantity
  ) &&
    (timber450.commercial.lineItems.find((row) => row.componentKey === CEILINGS_TIMBER_FRAMING_COMPONENT)
      ?.recommendedSell ?? 0) !==
      (gm30.commercial.lineItems.find((row) => row.componentKey === CEILINGS_TIMBER_FRAMING_COMPONENT)
        ?.recommendedSell ?? 0)
);

const loungeHall = runCommercial([
  plasterPortion({ id: P1, label: "Lounge" }),
  plasterPortion({ id: P2, label: "Hall", length: 5, width: 3, area: 15 }),
]);
const aggregated = aggregateCeilingCommercialLines(
  loungeHall.commercial.lineItems.filter(
    (row) => row.componentKey === CEILINGS_PLASTERBOARD_COMPONENT
  )
);
check(
  "R same-product aggregation retains Portion contributors",
  aggregated.length === 1 &&
    aggregated[0]!.contributingNestedItemIds?.includes(P1) === true &&
    aggregated[0]!.contributingNestedItemIds?.includes(P2) === true &&
    read("components/pricing/PricingItemRow.tsx").includes("data-pricing-portion-contributors")
);

const mixedQuote = quoteDraft([
  plasterPortion({ id: P1, label: "Lounge" }),
  timberPortion({ id: P2 }),
]);
check(
  "S Quote description uses nested Portions",
  /Lounge/.test(mixedQuote) &&
    /existing framing/i.test(mixedQuote) &&
    /Hall/.test(mixedQuote) &&
    /timber ceiling framing/i.test(mixedQuote)
);

const bhQuote = quoteDraft([bulkheadPortion()]);
check(
  "T Quote bulkhead scope correct",
  /wall-adjacent downstand bulkhead/i.test(bhQuote) &&
    /4\.0m long/.test(bhQuote) &&
    /400mm deep/.test(bhQuote) &&
    /500mm high/.test(bhQuote) &&
    !/componentId|formula|rate source/i.test(bhQuote)
);

check(
  "U unresolved PR blocks normal final Quote send",
  nestedCeilingsQuoteIsBlocked({ items: [prPricingItem()] }) === true &&
    read("lib/quotes/build-from-pricing.ts").includes("nestedCeilingsQuoteIsBlocked") &&
    read("lib/quotes/actions.ts").includes("CEILINGS_QUOTE_PR_BLOCK_MESSAGE") &&
    read("lib/estimate/ceilings-quote-readiness.ts").includes(CEILINGS_QUOTE_PR_BLOCK_MESSAGE) &&
    !read("lib/quotes/actions.ts")
      .slice(
        read("lib/quotes/actions.ts").indexOf(
          "export async function markQuoteAccepted"
        )
      )
      .includes("CEILINGS_QUOTE_PR_BLOCK_MESSAGE")
);

check(
  "V resolved PR allows normal Quote readiness",
  nestedCeilingsQuoteIsBlocked({ items: [resolvedItem] }) === false &&
    nestedCeilingsQuoteIsBlocked({
      items: [prPricingItem({ total_cost: 288, unit_cost: 9 })],
    }) === false
);

const finishFlags = plasterPortion();
finishFlags.finish.painting_included = true;
finishFlags.finish.stopping_included = true;
finishFlags.finish.demolition_included = true;
const finish = runCommercial([finishFlags]);
check(
  "W Painting no duplicate",
  !finish.commercial.lineItems.some((item) => ceilingCommercialOwnsFinishMoney(item))
);
check(
  "X Plastering no duplicate",
  !finish.commercial.requirements.some((row) => /stop/i.test(row.componentKey))
);
check(
  "Y Demolition no duplicate",
  !finish.commercial.requirements.some((row) => /demo|removal/i.test(row.componentKey))
);

const allowed = getAnalysisCapableWorkAreaTypes();
const emptyExtraction = (): AIExtractionOutput => ({
  workAreas: [],
  facts: [],
  assumptions: [],
  possibleConstraints: [],
  confidence: 0.5,
  warnings: [],
});
const bathroomOnly = enrichExtractionFromBrief({
  briefText: "Renovate the bathroom including the ceiling lining.",
  extraction: emptyExtraction(),
  allowedTypes: allowed,
});
check(
  "Z Bathroom-local ceiling no duplicate",
  WORK_AREA_SCOPE_OWNERS.bathroom.includes("bathroom_ceiling_lining") &&
    bathroomOnly.extraction.workAreas.some((row) => row.type === "bathroom") &&
    !bathroomOnly.extraction.workAreas.some((row) => row.type === "ceilings") &&
    plaster.commercial.lineItems.every(
      (item) => !(item.componentKey ?? "").startsWith("bathroom.lining.ceiling")
    )
);

const both = enrichExtractionFromBrief({
  briefText:
    "Renovate bathroom, plus replace ceilings through lounge, hallway and bedrooms.",
  extraction: emptyExtraction(),
  allowedTypes: allowed,
});
check(
  "AA Bathroom + independent Ceilings coexist",
  both.extraction.workAreas.some((row) => row.type === "bathroom") &&
    both.extraction.workAreas.some((row) => row.type === "ceilings")
);

const ground = runCommercial([plasterPortion()], [], wa("c1", "Ground Floor Ceilings"));
const garage = runCommercial(
  [plasterPortion({ id: P2, label: "Garage" })],
  [],
  wa("c2", "Detached Garage Ceilings")
);
const repeatedFacts = [...ground.facts, ...garage.facts];
const repeatedReview = reviewOf(
  {
    lineItems: [...ground.commercial.lineItems, ...garage.commercial.lineItems],
    assumptions: [...ground.commercial.assumptions, ...garage.commercial.assumptions],
    missingInfo: [...ground.commercial.missingInfo, ...garage.commercial.missingInfo],
    requirements: [...ground.commercial.requirements, ...garage.commercial.requirements],
  },
  repeatedFacts,
  [
    { id: "c1", type: "ceilings", name: "Ground Floor Ceilings", status: "confirmed" },
    { id: "c2", type: "ceilings", name: "Detached Garage Ceilings", status: "confirmed" },
  ]
);
const repeatedRefine = refineOf(repeatedFacts, [
  { id: "c1", type: "ceilings", name: "Ground Floor Ceilings", status: "confirmed" },
  { id: "c2", type: "ceilings", name: "Detached Garage Ceilings", status: "confirmed" },
]);
const crossWaAgg = aggregateCeilingCommercialLines([
  ...ground.commercial.lineItems,
  ...garage.commercial.lineItems,
]);
check(
  "AB repeated Ceiling WAs remain separate in Review/Refine/Pricing",
  repeatedReview.workAreas.length === 2 &&
    repeatedReview.workAreas[0]?.portionGroups?.[0]?.id === P1 &&
    repeatedReview.workAreas[1]?.portionGroups?.[0]?.id === P2 &&
    (repeatedRefine.ceilingPortionPanels?.length ?? 0) === 2 &&
    crossWaAgg.filter((row) => row.componentKey === CEILINGS_PLASTERBOARD_COMPONENT).length === 2
);

const hostedPlaster = calculateEstimate(estimateCtx(writePortions([plasterPortion()])));
check(
  "AC existing-frame hosted path end-to-end",
  near(plaster.physical.portions[0]?.geometry.area_m2, 12) &&
    near(material(plaster.commercial.requirements, CEILINGS_PLASTERBOARD_COMPONENT)?.baseQuantity, 4) &&
    near(material(plaster.commercial.requirements, CEILINGS_PLASTERBOARD_COMPONENT)?.purchaseQuantity, 5) &&
    plaster.commercial.completeness === "COMPLETE_COMMERCIAL" &&
    hostedPlaster.lineItems.length > 0 &&
    !hostedPlaster.missingInfo.some((row) => row.includes(CEILINGS_PARTIAL_ESTIMATE_MESSAGE)) &&
    /existing framing/i.test(quoteDraft([plasterPortion()]))
);

check(
  "AD timber hosted path end-to-end",
  near(material(timber450.commercial.requirements, CEILINGS_TIMBER_FRAMING_COMPONENT)?.baseQuantity, 32) &&
    near(
      material(timber450.commercial.requirements, CEILINGS_FIXINGS_TIMBER_FRAMING_COMPONENT)?.purchaseQuantity ??
        material(timber450.commercial.requirements, CEILINGS_FIXINGS_TIMBER_FRAMING_COMPONENT)?.baseQuantity ??
        0,
      32,
      4
    ) &&
    labour(timber450.commercial.requirements, CEILINGS_TIMBER_FRAMING_LABOUR)?.priced === true &&
    timber450.commercial.completeness === "COMPLETE_COMMERCIAL" &&
    /timber ceiling framing/i.test(quoteDraft([timberPortion()]))
);

check(
  "AE steel partial/PR path end-to-end",
  steel.commercial.completeness === "PRICING_REQUIRED" &&
    material(steel.commercial.requirements, CEILINGS_STEEL_PRIMARY_COMPONENT)?.priced === false &&
    labour(steel.commercial.requirements, CEILINGS_STEEL_PRIMARY_LABOUR)?.priced === true &&
    material(steel.commercial.requirements, CEILINGS_PLASTERBOARD_COMPONENT)?.priced === true &&
    nestedCeilingsQuoteIsBlocked({
      missingInfo: steel.commercial.missingInfo,
      items: [prPricingItem()],
    }) &&
    steelCleared.commercial.completeness === "COMPLETE_COMMERCIAL" &&
    nestedCeilingsQuoteIsBlocked({ items: [resolvedItem] }) === false
);

const tile = runCommercial([tilePortion30()]);
const tileReview = reviewOf(tile.commercial, tile.facts);
const tileGroups = tileReview.workAreas[0]?.portionGroups?.[0]?.lineGroups ?? [];
check(
  "AF Tile/Grid path end-to-end",
  near(material(tile.commercial.requirements, CEILINGS_TILE_GRID_GRID_COMPONENT)?.baseQuantity, 30) &&
    near(material(tile.commercial.requirements, CEILINGS_TILE_GRID_TILE_COMPONENT)?.baseQuantity, 84) &&
    material(tile.commercial.requirements, CEILINGS_PLASTERBOARD_COMPONENT) == null &&
    material(tile.commercial.requirements, CEILINGS_STEEL_PRIMARY_COMPONENT) == null &&
    !tile.commercial.requirements.some((row) => row.componentKey.includes("fixings")) &&
    tileGroups.some((row) => /grid/i.test(row.label)) &&
    !tileGroups.some((row) => row.secondary === "Framing") &&
    /tile and grid/i.test(quoteDraft([tilePortion30()]))
);

const bhTakeoff = calculateCeilingBulkhead({
  portion: bulkheadPortion(),
  bulkhead: bulkheadPortion().bulkheads[0]!,
  materialWastageSettings: WASTAGE,
});
check(
  "AG bulkhead path end-to-end",
  near(bhTakeoff.framingLm, 21) &&
    near(bhTakeoff.liningAreaM2, 3.6) &&
    near(
      material(bulk.commercial.requirements, CEILINGS_BULKHEAD_FRAMING_TIMBER_COMPONENT)
        ?.baseQuantity,
      21
    ) &&
    near(
      material(bulk.commercial.requirements, CEILINGS_BULKHEAD_LINING_COMPONENT)?.baseQuantity,
      1
    ) &&
    (bulkPortion?.assumptions.some((row) => /wall-adjacent|downstand/i.test(row)) ?? false)
);

const jobPlan = composeJobPlan({
  workAreas: [{ id: "c1", type: "ceilings", name: "Ceilings", status: "confirmed" }],
  facts: writePortions([plasterPortion()]),
  qualityLevel: "standard",
});
check(
  "AH Job Plan semantics unchanged",
  jobPlan.cards[0]?.included.some((row) => /Lounge/i.test(row.label)) === true &&
    JSON.stringify(jobPlan).includes("recommendedCost") === false &&
    JSON.stringify(jobPlan).includes("recommendedSell") === false &&
    read("lib/assistant/job-plan/adapters/ceilings.ts").includes("summariseCeilingPortion")
);

const readyDetails = clarifyOf(writePortions([plasterPortion()]));
check(
  "AI Details/Ready semantics unchanged",
  readyDetails.blocksEstimate === false &&
    readyDetails.remainingRequiredCount === 0 &&
    read("lib/assistant/refine/adapters/ceilings.ts").includes("pushIfResolved")
);

const legacyFacts: EstimateFact[] = [
  { key: "ceilings.area_m2", work_area_id: "c1", value: 30 },
  { key: "ceilings.structure_type", work_area_id: "c1", value: "Existing structure" },
  { key: "ceilings.ceiling_type", work_area_id: "c1", value: "Plasterboard" },
];
const legacyEstimate = calculateEstimate(estimateCtx(legacyFacts));
check(
  "AJ legacy flat Ceilings unchanged",
  !hasCanonicalCeilingsPortions(legacyFacts, "c1") &&
    legacyEstimate.lineItems.some((item) => /materials allowance/i.test(item.label)) &&
    !legacyEstimate.missingInfo.some((row) =>
      row.includes(CEILINGS_NESTED_NOT_CALCULATED_MESSAGE)
    )
);

const mixedReview = reviewOf(
  runCommercial([
    plasterPortion({ id: P1, label: "Lounge" }),
    timberPortion({ id: P2 }),
    tilePortion30(),
  ]).commercial,
  writePortions([
    plasterPortion({ id: P1, label: "Lounge" }),
    timberPortion({ id: P2 }),
    tilePortion30(),
  ])
);
check(
  "grouping mixed Portions stay portion-first",
  (mixedReview.workAreas[0]?.portionGroups?.length ?? 0) === 3 &&
    mixedReview.workAreas[0]?.portionGroups?.map((row) => row.label).join("|").includes("Lounge") ===
      true
);

const timberAssumed = timberPortion();
timberAssumed.lining.layers = null;
const timberAssumptionReview = reviewOf(
  runCommercial([timberAssumed]).commercial,
  writePortions([timberAssumed])
);
const timberAssumptions =
  timberAssumptionReview.workAreas[0]?.portionGroups?.[0]?.assumptions ?? [];
check(
  "assumption test surfaces spacing + one layer",
  timberAssumptions.some((row) => /450/i.test(row)) &&
    timberAssumptions.some((row) => /one layer/i.test(row))
);

check(
  "mobile Builder Review / Refine presentation",
  read("components/assistant/builder-review/BuilderReviewSurface.tsx").includes(
    "overflow-x-hidden"
  ) &&
    read("components/assistant/builder-review/BuilderReviewSurface.tsx").includes(
      "data-builder-review-portion"
    ) &&
    read("components/assistant/refine/CeilingsPortionsPanel.tsx").includes("min-h-11") &&
    read("components/assistant/clarify/ClarifyReadiness.tsx").includes("CeilingsPortionsPanel")
);

check(
  "quote create UI blocks on Ceiling PR",
  read("components/quotes/CreateQuoteButton.tsx").includes("quoteBlockedReason") &&
    read("components/pricing/PricingSummaryPanel.tsx").includes("nestedCeilingsQuoteIsBlocked")
);

check(
  "no new Ceiling COST constants in WA-06 modules",
  !read("lib/assistant/builder-review/ceilings-review-groups.ts").includes("cost_rate:") &&
    !read("lib/assistant/refine/adapters/ceilings.ts").includes("cost_rate:") &&
    !read("lib/estimate/ceilings-quote-readiness.ts").includes("cost_rate:")
);

function spawnVerifier(script: string): boolean {
  const result = spawnSync("npx", ["--yes", "tsx", script], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: true,
  });
  if (result.status !== 0) {
    console.log(result.stdout);
    console.log(result.stderr);
  }
  return result.status === 0;
}

console.log("\n=== Prior Ceiling + product regressions ===\n");
const prior = [
  "scripts/verify-ceilings-wa-05b.ts",
  "scripts/verify-quote-safety.ts",
  "scripts/verify-refine-structured-editor-r1.ts",
  "scripts/verify-recovery-5b-builder-review.ts",
];
for (const script of prior) {
  check(script.replace("scripts/", ""), spawnVerifier(script));
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
