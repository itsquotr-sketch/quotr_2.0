/**
 * FLOORING-07 — ordinary nested Flooring V1 closure and human-QA freeze.
 *
 * Run: npx --yes tsx scripts/verify-flooring-07-v1-closure.ts
 *
 * Independent closure invariants. No paid AI. No Production.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { OrganisationRate } from "../components/setup/types";
import type { EstimateLineItem } from "../components/assistant/types";
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import type { AIExtractionOutput } from "../lib/ai/schema";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { deriveSellFromCost } from "../lib/commercial-engine/core/sell-from-margin";
import {
  BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY,
  BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
  BATHROOM_FLOOR_SUBSTRATE_SECURA_KEY,
  BATHROOM_PLYWOOD_SHEET_BENCHMARK,
  BATHROOM_SHEET_AREA_M2,
} from "../lib/estimate/bathroom-identities";
import {
  liveQuotrMaterialCost,
  liveQuotrProductivity,
  workAreaMayCloseAtL5,
} from "../lib/estimate/benchmark-coverage";
import { FITOUT_BENCHMARKS } from "../lib/estimate/benchmark-rates";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateBathroom } from "../lib/estimate/calculators/bathroom";
import { calculateFlooring } from "../lib/estimate/calculators/fitout";
import { round2 } from "../lib/estimate/facts";
import {
  extractFlooringPortionsFromBrief,
} from "../lib/estimate/flooring-brief";
import { listFlooringClarifyCandidates } from "../lib/estimate/flooring-clarify";
import {
  flooringComponentIsManualPricingEligible,
  flooringLineIsManualPricingEligible,
} from "../lib/estimate/flooring-commercial";
import {
  FLOORING_CARPENTER_LABOUR_RATE_KEY,
  FLOORING_CARPET_REMOVE_HOURS_PER_M2,
  FLOORING_CARPET_REMOVE_HOURS_PER_M2_VALUE,
  FLOORING_CARPET_REMOVE_LABOUR,
  FLOORING_CARPET_SUPPLY_INSTALL_COST_EX_GST,
  FLOORING_CARPET_SUPPLY_INSTALL_M2,
  FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_COST_EX_GST,
  FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2,
  FLOORING_CUSTOM_FINISH_COMPONENT,
  FLOORING_FLOOR_PREPARATION_ALLOWANCE_COST_EX_GST,
  FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2,
  FLOORING_HARDWOOD_REMOVE_HOURS_PER_M2,
  FLOORING_HARDWOOD_REMOVE_HOURS_PER_M2_VALUE,
  FLOORING_HARDWOOD_SUPPLY_INSTALL_COST_EX_GST,
  FLOORING_HARDWOOD_SUPPLY_INSTALL_M2,
  FLOORING_SPECIALIST_COMPONENT,
  FLOORING_SUBFLOOR_FRAMING_MAJOR_ALLOWANCE_COST_EX_GST,
  FLOORING_SUBFLOOR_FRAMING_MAJOR_ALLOWANCE_M2,
  FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_COST_EX_GST,
  FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2,
  FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_COST_EX_GST,
  FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_M2,
  FLOORING_SUBSTRATE_INSTALL_HOURS_PER_SHEET,
  FLOORING_SUBSTRATE_INSTALL_HOURS_PER_SHEET_VALUE,
  FLOORING_SUBSTRATE_INSTALL_LABOUR,
  FLOORING_SUBSTRATE_MATERIAL_COMPONENT,
  FLOORING_SUBSTRATE_REMOVE_HOURS_PER_M2,
  FLOORING_SUBSTRATE_REMOVE_HOURS_PER_M2_VALUE,
  FLOORING_SUBSTRATE_REMOVE_LABOUR,
  FLOORING_TILE_REMOVE_HOURS_PER_M2,
  FLOORING_TILE_REMOVE_HOURS_PER_M2_VALUE,
  FLOORING_TILE_SUPPLY_INSTALL_COST_EX_GST,
  FLOORING_TILE_SUPPLY_INSTALL_M2,
  FLOORING_V1_COVERAGE_QUOTE_NOTES,
  FLOORING_V1_HUMAN_QA_FROZEN,
  FLOORING_V1_SUPPORT_NOTES,
  FLOORING_VINYL_PLANK_REMOVE_HOURS_PER_M2,
  FLOORING_VINYL_PLANK_REMOVE_HOURS_PER_M2_VALUE,
  FLOORING_VINYL_PLANK_SUPPLY_INSTALL_COST_EX_GST,
  FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2,
  flooringSubstrateSheetCoverageM2,
} from "../lib/estimate/flooring-identities";
import { FLOORING_INFORMATION_CONTRACT } from "../lib/estimate/flooring-information-contract";
import {
  flooringHardwoodTakeoff,
  flooringSubstrateSheetCount,
  flooringTileTakeoff,
  physicalNetAreaM2,
} from "../lib/estimate/flooring-physical";
import {
  applyFlooringFactWrite,
  createEmptyFlooringPortion,
  FLOORING_ADD_PORTION_KEY,
  FLOORING_DELETE_PORTION_KEY,
  FLOORING_DUPLICATE_PORTION_KEY,
  FLOORING_NESTED_NOT_CALCULATED_MESSAGE,
  FLOORING_PORTIONS_FACT_KEY,
  FLOORING_SPECIALIST_PRICING_REQUIRED_MESSAGE,
  parseFlooringPortions,
  mergePersistedFlooringPortionsOnReanalyse,
  type FlooringPortion,
} from "../lib/estimate/flooring-portions";
import {
  FLOORING_QUOTE_SHARED_EXCLUSIONS,
  FLOORING_QUOTE_SPECIALIST_INCLUDED,
  FLOORING_QUOTE_SPECIALIST_PENDING,
  flooringQuoteLeaksInternal,
} from "../lib/estimate/flooring-quote";
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
import {
  computeManualPromotionMoney,
  evaluateManualPricingEligibility,
} from "../lib/pricing/manual-requirement-promotion";
import { calculateDocumentTotals } from "../lib/pricing/calculations";
import { valuesFromEstimateLineItem } from "../lib/pricing/recalibration-helpers";
import { DEFAULT_GST_RATE } from "../lib/pricing/status";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";
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

const HOSTED_NEGATIVE_BRIEF =
  "Supply and install 12 m² of 600 × 600 mm tiled flooring to the bathroom floor, including ordinary floor preparation. Also supply and install 15 m² of hardwood flooring using 186 mm wide boards to the dining room. Existing substrates and framing are to remain. No flooring or substrate removal is required.";

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

function persist(portions: readonly FlooringPortion[]): EstimateFact[] {
  return [
    {
      key: FLOORING_PORTIONS_FACT_KEY,
      work_area_id: WA.id,
      value: portions,
      source: "user",
    },
  ];
}

function carpenter(cost: number): OrganisationRate {
  return {
    id: "org-carpenter",
    item_key: FLOORING_CARPENTER_LABOUR_RATE_KEY,
    rate_type: "labour",
    label: "Carpenter",
    unit: "hour",
    cost_rate: cost,
    sell_rate: null,
    markup_percent: null,
    active: true,
    trade: "carpenter",
    work_area_type: "flooring",
    source: "explicit_company",
  };
}

function orgRate(itemKey: string, cost: number): OrganisationRate {
  return {
    id: `org-${itemKey}`,
    item_key: itemKey,
    rate_type: "subcontractor",
    label: itemKey,
    unit: "m2",
    cost_rate: cost,
    sell_rate: null,
    markup_percent: null,
    active: true,
    trade: null,
    work_area_type: "flooring",
    source: "explicit_company",
  };
}

function ctx(
  facts: EstimateFact[],
  extra: { rates?: OrganisationRate[]; constraints?: EstimateConstraint[] } = {}
): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [WA],
    facts,
    constraints: extra.constraints ?? [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
    },
    rates: extra.rates ?? [],
  } as unknown as EstimateContext;
}

function hosted(
  portions: readonly FlooringPortion[],
  extra: Parameters<typeof ctx>[1] = {}
) {
  return calculateEstimate(ctx(persist(portions), extra));
}

function includedCost(
  items: readonly {
    includedInTotal?: boolean;
    rateSourceType?: string;
    recommendedCost?: number | null;
  }[]
): number {
  return round2(
    items
      .filter(
        (row) =>
          row.includedInTotal !== false && row.rateSourceType !== "missing"
      )
      .reduce((sum, row) => sum + (row.recommendedCost ?? 0), 0)
  );
}

function near(
  actual: number | null | undefined,
  expected: number,
  tol = 0.02
): boolean {
  return (
    actual != null &&
    Number.isFinite(actual) &&
    Math.abs(actual - expected) <= tol
  );
}

function line(
  estimate: { lineItems: readonly EstimateLineItemInput[] },
  componentKey: string,
  nestedItemId?: string
): EstimateLineItemInput | undefined {
  return estimate.lineItems.find(
    (row) =>
      row.componentKey === componentKey &&
      (nestedItemId == null || row.nestedItemId === nestedItemId)
  );
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

function quoteFacts(portions: readonly FlooringPortion[]) {
  return [
    {
      key: FLOORING_PORTIONS_FACT_KEY,
      label: "Flooring areas",
      value: JSON.stringify(portions),
    },
  ];
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

function flooringQuote(
  portions: readonly FlooringPortion[],
  estimate?: ReturnType<typeof calculateEstimate>,
  extras?: ReturnType<typeof quotePricing>
) {
  return buildWorkAreaQuoteDescriptionDraft({
    type: "flooring",
    name: "Flooring",
    facts: quoteFacts(portions),
    pricingItems: extras ?? (estimate ? quotePricing(estimate) : undefined),
  });
}

function noRemovalIdentity(
  items: readonly { componentKey?: string | null; label?: string }[]
): boolean {
  return items.every(
    (row) =>
      row.componentKey !== FLOORING_CARPET_REMOVE_LABOUR &&
      row.componentKey !== FLOORING_SUBSTRATE_REMOVE_LABOUR &&
      !/\.remove$/.test(row.componentKey ?? "") &&
      !/carpet finish removal|existing carpet/i.test(row.label ?? "")
  );
}

console.log("=== FLOORING-07 V1 closure ===\n");

const coverage = verifyRegisteredWorkAreaBenchmarkCoverage("flooring");
const support = getWorkAreaSupportEntry("flooring");

check(
  "freeze flag is true and unique",
  FLOORING_V1_HUMAN_QA_FROZEN === true &&
    read("lib/estimate/flooring-identities.ts").includes(
      "FLOORING_V1_HUMAN_QA_FROZEN"
    ) &&
    !read("lib/estimate/flooring-identities.ts").includes(
      "FLOORING_V1_HUMAN_QA_FROZEN = false"
    )
);
check(
  "support contract freezes ordinary V1 without promoting the band",
  support?.notes === FLOORING_V1_SUPPORT_NOTES &&
    support.band === "component" &&
    support.role === "component_utility"
);
check(
  "ordinary nested V1 may close at L5",
  workAreaMayCloseAtL5(coverage) === true && coverage.ok
);
check(
  "coverage freeze notes are the canonical FLOORING-07 copy",
  FLOORING_BENCHMARK_REQUIREMENTS.find(
    (row) => row.component === "Human hosted QA / freeze"
  )?.notes === FLOORING_V1_COVERAGE_QUOTE_NOTES
);
check(
  "custom/specialist and exact FC remain intentional Pricing Required",
  FLOORING_BENCHMARK_REQUIREMENTS.some(
    (row) =>
      row.materialIdentity === FLOORING_CUSTOM_FINISH_COMPONENT &&
      row.outcome === "INTENTIONAL_PRICING_REQUIRED"
  ) &&
    FLOORING_BENCHMARK_REQUIREMENTS.some(
      (row) =>
        row.materialIdentity === BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY &&
        row.outcome === "INTENTIONAL_PRICING_REQUIRED"
    ) &&
    FLOORING_BENCHMARK_REQUIREMENTS.some(
      (row) =>
        row.materialIdentity === BATHROOM_FLOOR_SUBSTRATE_SECURA_KEY &&
        row.outcome === "INTENTIONAL_PRICING_REQUIRED"
    )
);

check(
  "canonical collection is flooring.portions",
  FLOORING_PORTIONS_FACT_KEY === "flooring.portions" &&
    read("lib/estimate/flooring-portions.ts").includes("compare-and-swap")
);
check(
  "ordinary finishes are carpet, vinyl plank/LVT, tile and hardwood",
  FLOORING_CARPET_SUPPLY_INSTALL_M2 === "flooring.carpet.supply_install.m2" &&
    FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2 ===
      "flooring.vinyl_plank.supply_install.m2" &&
    FLOORING_TILE_SUPPLY_INSTALL_M2 === "flooring.tile.supply_install.m2" &&
    FLOORING_HARDWOOD_SUPPLY_INSTALL_M2 === "flooring.hardwood.supply_install.m2"
);
check(
  "deferred specialist finishes are not ordinary V1 identities",
  !read("lib/estimate/flooring-identities.ts").includes(
    "flooring.laminate.supply_install.m2"
  ) &&
    flooringComponentIsManualPricingEligible(FLOORING_SPECIALIST_COMPONENT) &&
    !flooringComponentIsManualPricingEligible(FLOORING_CARPET_SUPPLY_INSTALL_M2)
);

check(
  "finish/add-on COST authorities are frozen",
  FLOORING_CARPET_SUPPLY_INSTALL_COST_EX_GST === 75 &&
    FLOORING_VINYL_PLANK_SUPPLY_INSTALL_COST_EX_GST === 95 &&
    FLOORING_TILE_SUPPLY_INSTALL_COST_EX_GST === 150 &&
    FLOORING_HARDWOOD_SUPPLY_INSTALL_COST_EX_GST === 190 &&
    FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_COST_EX_GST === 15 &&
    FLOORING_FLOOR_PREPARATION_ALLOWANCE_COST_EX_GST === 35 &&
    liveQuotrMaterialCost(FLOORING_CARPET_SUPPLY_INSTALL_M2) === 75 &&
    liveQuotrMaterialCost(FLOORING_TILE_SUPPLY_INSTALL_M2) === 150
);
check(
  "plywood sheet authority is $145 at 2.88 m² coverage",
  BATHROOM_PLYWOOD_SHEET_BENCHMARK === 145 &&
    BATHROOM_SHEET_AREA_M2 === 2.88 &&
    flooringSubstrateSheetCoverageM2(BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY) ===
      2.88 &&
    liveQuotrMaterialCost(BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY) === 145
);
check(
  "productivity authorities are frozen person-hours",
  FLOORING_SUBSTRATE_INSTALL_HOURS_PER_SHEET_VALUE === 0.5 &&
    FLOORING_CARPET_REMOVE_HOURS_PER_M2_VALUE === 0.12 &&
    FLOORING_VINYL_PLANK_REMOVE_HOURS_PER_M2_VALUE === 0.2 &&
    FLOORING_TILE_REMOVE_HOURS_PER_M2_VALUE === 0.55 &&
    FLOORING_HARDWOOD_REMOVE_HOURS_PER_M2_VALUE === 0.35 &&
    FLOORING_SUBSTRATE_REMOVE_HOURS_PER_M2_VALUE === 0.3 &&
    liveQuotrProductivity(FLOORING_SUBSTRATE_INSTALL_HOURS_PER_SHEET) === 0.5 &&
    liveQuotrProductivity(FLOORING_CARPET_REMOVE_HOURS_PER_M2) === 0.12 &&
    liveQuotrProductivity(FLOORING_VINYL_PLANK_REMOVE_HOURS_PER_M2) === 0.2 &&
    liveQuotrProductivity(FLOORING_TILE_REMOVE_HOURS_PER_M2) === 0.55 &&
    liveQuotrProductivity(FLOORING_HARDWOOD_REMOVE_HOURS_PER_M2) === 0.35 &&
    liveQuotrProductivity(FLOORING_SUBSTRATE_REMOVE_HOURS_PER_M2) === 0.3
);
check(
  "labour COST uses labour.carpenter.hour with no Flooring hourly constant",
  FLOORING_CARPENTER_LABOUR_RATE_KEY === "labour.carpenter.hour" &&
    !read("lib/estimate/flooring-commercial.ts").includes(
      "FLOORING_CARPENTER_HOURLY_COST"
    ) &&
    !read("lib/estimate/flooring-commercial.ts").includes("cost: 60")
);
check(
  "framing allowance COST authorities are frozen",
  FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_COST_EX_GST === 45 &&
    FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_COST_EX_GST === 90 &&
    FLOORING_SUBFLOOR_FRAMING_MAJOR_ALLOWANCE_COST_EX_GST === 160 &&
    liveQuotrMaterialCost(FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2) === 45 &&
    liveQuotrMaterialCost(FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_M2) ===
      90 &&
    liveQuotrMaterialCost(FLOORING_SUBFLOOR_FRAMING_MAJOR_ALLOWANCE_M2) === 160
);

const tileTakeoff = flooringTileTakeoff(10, 600, 600);
const hardwoodTakeoff = flooringHardwoodTakeoff(10, 186);
check(
  "physical: tile count is ceil(area / tile area) and informational",
  tileTakeoff != null &&
    tileTakeoff.wholeTileCount === Math.ceil(10 / 0.36) &&
    tileTakeoff.wholeTileCount === 28
);
check(
  "physical: hardwood lm is area / board width in metres",
  hardwoodTakeoff != null && near(hardwoodTakeoff.linealM, 10 / 0.186)
);
check(
  "physical: substrate sheets are ceil(area / coverage) with no bathroom waste",
  flooringSubstrateSheetCount(12, 2.88) === 5 &&
    flooringSubstrateSheetCoverageM2(BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY) ===
      2.88
);
check(
  "physical: direct m² and length × width use net area; empty has no default",
  physicalNetAreaM2(ordinary()) === 10 &&
    physicalNetAreaM2(
      ordinary({
        area_input_method: "length_width",
        length_m: 4,
        width_m: 2.5,
        area_m2: 99,
      })
    ) === 10 &&
    physicalNetAreaM2(createEmptyFlooringPortion()) == null
);

const carpetNo = hosted([ordinary()]);
check(
  "golden: 10 m² carpet, no underlay = $750",
  near(includedCost(carpetNo.lineItems), 750) &&
    line(carpetNo, FLOORING_CARPET_SUPPLY_INSTALL_M2)?.quantity === 10
);
const carpetYes = hosted([ordinary({ underlay_required: true })]);
check(
  "golden: 10 m² carpet + underlay = $900",
  near(includedCost(carpetYes.lineItems), 900) &&
    line(carpetYes, FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2)?.quantity === 10
);
const vinylPrep = hosted([
  ordinary({
    finish_type: "vinyl_plank",
    floor_preparation_required: true,
  }),
]);
check(
  "golden: 10 m² vinyl + preparation = $1,300",
  near(includedCost(vinylPrep.lineItems), 1300)
);
const tilePrep = hosted([
  ordinary({
    finish_type: "tile",
    tile_width_mm: 600,
    tile_length_mm: 600,
    floor_preparation_required: true,
  }),
]);
check(
  "golden: 10 m² tile + preparation = $1,850; commercial quantity stays m²",
  near(includedCost(tilePrep.lineItems), 1850) &&
    line(tilePrep, FLOORING_TILE_SUPPLY_INSTALL_M2)?.quantity === 10 &&
    /does not multiply/i.test(
      line(tilePrep, FLOORING_TILE_SUPPLY_INSTALL_M2)?.notes ?? ""
    )
);
const hardwood = hosted([
  ordinary({
    finish_type: "hardwood",
    hardwood_board_width_mm: 186,
  }),
]);
check(
  "golden: 10 m² hardwood = $1,900; lm does not multiply COST",
  near(includedCost(hardwood.lineItems), 1900) &&
    line(hardwood, FLOORING_HARDWOOD_SUPPLY_INSTALL_M2)?.quantity === 10 &&
    /does not multiply/i.test(
      line(hardwood, FLOORING_HARDWOOD_SUPPLY_INSTALL_M2)?.notes ?? ""
    )
);
const ply = hosted([
  ordinary({
    area_m2: 12,
    substrate_required: true,
    substrate_family: "structural_plywood",
    substrate_item_key: BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
  }),
]);
check(
  "golden: 12 m² plywood substrate = $875",
  line(ply, FLOORING_SUBSTRATE_MATERIAL_COMPONENT)?.quantity === 5 &&
    near(line(ply, FLOORING_SUBSTRATE_MATERIAL_COMPONENT)?.recommendedCost, 725) &&
    near(line(ply, FLOORING_SUBSTRATE_INSTALL_LABOUR)?.recommendedCost, 150) &&
    near(
      (line(ply, FLOORING_SUBSTRATE_MATERIAL_COMPONENT)?.recommendedCost ?? 0) +
        (line(ply, FLOORING_SUBSTRATE_INSTALL_LABOUR)?.recommendedCost ?? 0),
      875
    )
);
const framing = hosted([
  ordinary({
    area_m2: 12,
    framing_required: true,
    framing_allowance_level: "standard",
  }),
]);
check(
  "golden: 12 m² standard framing = $1,080",
  near(
    line(framing, FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_M2)
      ?.recommendedCost,
    1080
  )
);
const removal = hosted([
  ordinary({
    finish_removal_required: true,
    existing_finish_type: "carpet",
    substrate_removal_required: true,
  }),
]);
check(
  "golden: 10 m² carpet + substrate removal = $252 and stay separate",
  near(line(removal, FLOORING_CARPET_REMOVE_LABOUR)?.recommendedCost, 72) &&
    near(line(removal, FLOORING_SUBSTRATE_REMOVE_LABOUR)?.recommendedCost, 180) &&
    near(
      (line(removal, FLOORING_CARPET_REMOVE_LABOUR)?.recommendedCost ?? 0) +
        (line(removal, FLOORING_SUBSTRATE_REMOVE_LABOUR)?.recommendedCost ?? 0),
      252
    ) &&
    line(removal, FLOORING_CARPET_REMOVE_LABOUR) != null &&
    line(removal, FLOORING_SUBSTRATE_REMOVE_LABOUR) != null
);
const comprehensive = hosted([
  ordinary({
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
]);
check(
  "golden: comprehensive 12 m² carpet fixture = $3,337.40",
  near(includedCost(comprehensive.lineItems), 3337.4)
);
const bedrooms = ordinary({
  id: "fa_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa2",
  label: "Bedrooms",
  area_m2: 24,
  underlay_required: true,
});
const living = ordinary({
  id: "fa_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa3",
  label: "Living room",
  finish_type: "vinyl_plank",
  area_m2: 20,
  floor_preparation_required: true,
});
const multi = hosted([bedrooms, living]);
check(
  "golden: 24 m² carpet/underlay + 20 m² vinyl/prep = $4,760 and stay owned separately",
  near(includedCost(multi.lineItems), 4760) &&
    line(multi, FLOORING_CARPET_SUPPLY_INSTALL_M2, bedrooms.id)?.nestedItemId ===
      bedrooms.id &&
    line(
      multi,
      FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2,
      living.id
    )?.nestedItemId === living.id
);
const tileHardwood = hosted([
  ordinary({
    id: "fa_tile",
    label: "Bathroom floor",
    finish_type: "tile",
    area_m2: 12,
    tile_width_mm: 600,
    tile_length_mm: 600,
    floor_preparation_required: true,
  }),
  ordinary({
    id: "fa_hard",
    label: "Dining room",
    finish_type: "hardwood",
    area_m2: 15,
    hardwood_board_width_mm: 186,
  }),
]);
check(
  "golden: 12 m² tile/prep + 15 m² hardwood = $5,070",
  near(includedCost(tileHardwood.lineItems), 5070) &&
    noRemovalIdentity(tileHardwood.lineItems)
);

const plyCompany = hosted(
  [
    ordinary({
      area_m2: 12,
      underlay_required: true,
      substrate_required: true,
      substrate_family: "structural_plywood",
      substrate_item_key: BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
    }),
  ],
  { rates: [carpenter(65)] }
);
check(
  "hosted company carpenter $65 plywood fixture = $1,967.50",
  near(line(plyCompany, FLOORING_CARPET_SUPPLY_INSTALL_M2)?.recommendedCost, 900) &&
    near(
      line(plyCompany, FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2)?.recommendedCost,
      180
    ) &&
    near(
      line(plyCompany, FLOORING_SUBSTRATE_MATERIAL_COMPONENT)?.recommendedCost,
      725
    ) &&
    near(line(plyCompany, FLOORING_SUBSTRATE_INSTALL_LABOUR)?.labourHours, 2.5) &&
    near(line(plyCompany, FLOORING_SUBSTRATE_INSTALL_LABOUR)?.recommendedCost, 162.5) &&
    near(includedCost(plyCompany.lineItems), 1967.5)
);

const hostedNeg = extract(HOSTED_NEGATIVE_BRIEF);
const hostedNegPortions = parseFlooringPortions(
  hostedNeg.facts.find((row) => row.key === FLOORING_PORTIONS_FACT_KEY)?.value
);
const hostedNegEst = calculateEstimate(
  ctx(persist(hostedNegPortions), { rates: [carpenter(65)] })
);
check(
  "hosted negative-removal brief is Flooring only with two areas",
  hostedNeg.workAreas.map((row) => row.type).join() === "flooring" &&
    hostedNegPortions.length === 2
);
check(
  "hosted negative-removal COST is $5,070 with no carpet-removal identity",
  near(includedCost(hostedNegEst.lineItems), 5070) &&
    noRemovalIdentity(hostedNegEst.lineItems) &&
    hostedNegPortions.every(
      (row) =>
        row.finish_removal_required === false &&
        row.substrate_removal_required === false &&
        row.existing_finish_type == null
    )
);

const companyCarpet = hosted([ordinary()], {
  rates: [orgRate(FLOORING_CARPET_SUPPLY_INSTALL_M2, 80)],
});
check(
  "company exact subcontract overrides Quotr; restoring Quotr returns $750",
  near(includedCost(companyCarpet.lineItems), 800) &&
    near(includedCost(hosted([ordinary()]).lineItems), 750)
);

const familyIndex = FLOORING_INFORMATION_CONTRACT.findIndex(
  (row) => row.factKey === "flooring.portion.substrate_family"
);
const productIndex = FLOORING_INFORMATION_CONTRACT.findIndex(
  (row) => row.factKey === "flooring.portion.substrate_item_key"
);
const substrateAsk = ordinary({
  id: "fa_seq",
  substrate_required: true,
  substrate_family: null,
  substrate_item_key: null,
});
const familyAsked = listFlooringClarifyCandidates({
  facts: persist([substrateAsk]),
  workAreaId: WA.id,
  workAreaName: "Flooring",
});
const afterFamily = listFlooringClarifyCandidates({
  facts: persist([
    ordinary({
      id: "fa_seq",
      substrate_required: true,
      substrate_family: "structural_plywood",
      substrate_item_key: null,
    }),
  ]),
  workAreaId: WA.id,
  workAreaName: "Flooring",
});
check(
  "substrate questions are sequential: family then exact product",
  familyIndex >= 0 &&
    productIndex > familyIndex &&
    familyAsked.some((row) =>
      row.factKey.endsWith("substrate_family")
    ) &&
    !familyAsked.some((row) =>
      row.factKey.endsWith("substrate_item_key")
    ) &&
    afterFamily.some((row) => row.factKey.endsWith("substrate_item_key"))
);

const fcEst = hosted([
  ordinary({
    area_m2: 12,
    substrate_required: true,
    substrate_family: "fibre_cement",
    substrate_item_key: BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY,
  }),
]);
check(
  "exact FC/Secura material stays Pricing Required; plywood COST is not inherited",
  line(fcEst, FLOORING_SUBSTRATE_MATERIAL_COMPONENT)?.rateSourceType ===
    "missing" &&
    (line(fcEst, FLOORING_SUBSTRATE_MATERIAL_COMPONENT)?.recommendedCost ==
      null ||
      line(fcEst, FLOORING_SUBSTRATE_MATERIAL_COMPONENT)?.recommendedCost ===
        0) &&
    flooringLineIsManualPricingEligible(
      line(fcEst, FLOORING_SUBSTRATE_MATERIAL_COMPONENT)!
    ) &&
    line(fcEst, FLOORING_SUBSTRATE_INSTALL_LABOUR)?.rateSourceType !== "missing"
);

const reviewFacts = persist([
  ordinary({
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
]);
const review = reviewOf(comprehensive, reviewFacts);
const lineGroupLabels = (review.workAreas[0]?.portionGroups ?? []).flatMap(
  (group) => group.lineGroups.map((lg) => lg.label)
);
check(
  "Builder Review hierarchy is Flooring Area → Finish → Add-ons → Substrate → Framing → Removal",
  ["Finish", "Add-ons", "Substrate", "Framing allowance", "Removal"].every(
    (label) => lineGroupLabels.includes(label)
  )
);
check(
  "Builder Review hides architecture diagnostics",
  !JSON.stringify(review).includes(FLOORING_NESTED_NOT_CALCULATED_MESSAGE) &&
    !/canonical nested|legacy Flooring allowance path/i.test(
      JSON.stringify(review)
    )
);

const carpetLine = line(carpetNo, FLOORING_CARPET_SUPPLY_INSTALL_M2)!;
const adopted = valuesFromEstimateLineItem({
  id: "est-1",
  work_area_id: carpetLine.workAreaId ?? WA.id,
  label: carpetLine.label,
  category: carpetLine.category,
  recommended_cost: carpetLine.recommendedCost ?? 0,
  recommended_sell: carpetLine.recommendedSell ?? 0,
  notes: buildLineItemNotes(carpetLine),
  sort_order: 1,
  component_key: FLOORING_CARPET_SUPPLY_INSTALL_M2,
});
check(
  "Pricing adopts hosted estimate COST without rewriting quantity",
  near(adopted.totalCost, 750) && adopted.quantity === 10 && adopted.unit === "m2"
);

const sell1000 = deriveSellFromCost(1000, 10);
const gst1000 = calculateDocumentTotals(
  [{ total_cost: 1000, total_sell: sell1000 }],
  DEFAULT_GST_RATE
);
const promo = computeManualPromotionMoney({
  totalCost: 1000,
  quantity: 10,
  unit: "m2",
  itemType: "subcontractor",
  marginPercent: 10,
});
check(
  "manual $1,000 at 10% margin is $1,111.11 sell / $166.67 GST / $1,277.78 incl",
  promo.ok &&
    promo.costKnown === true &&
    near(sell1000, 1111.11) &&
    near(gst1000.gstAmount, 166.67) &&
    near(gst1000.totalInclGst, 1277.78) &&
    near(promo.fields.totalCost, 1000) &&
    near(promo.fields.totalSell, 1111.11)
);
const zeroPromo = computeManualPromotionMoney({
  totalCost: 0,
  quantity: 10,
  unit: "m2",
  itemType: "subcontractor",
  marginPercent: 10,
});
check(
  "zero remains unresolved and is not a legitimate priced inclusion",
  zeroPromo.ok && zeroPromo.costKnown === false
);

const laminateExtract = extract(LAMINATE_BRIEF);
const laminatePortions = parseFlooringPortions(
  laminateExtract.facts.find((row) => row.key === FLOORING_PORTIONS_FACT_KEY)
    ?.value
);
const laminateEst = hosted(laminatePortions.length > 0 ? laminatePortions : [
  ordinary({
    label: "Office",
    finish_type: "other",
    specialist_kind: "laminate",
    other_description: "laminate flooring",
    area_m2: 10,
    substrate_required: false,
    framing_required: false,
    finish_removal_required: false,
  }),
]);
const specialistLine = line(laminateEst, FLOORING_SPECIALIST_COMPONENT);
const quotePending = flooringQuote(
  laminatePortions.length > 0
    ? laminatePortions
    : [
        ordinary({
          label: "Office",
          finish_type: "other",
          specialist_kind: "laminate",
          other_description: "laminate flooring",
          area_m2: 10,
        }),
      ],
  laminateEst
);
check(
  "laminate before manual pricing is Flooring-only Pricing Required, not a $0 inclusion",
  laminateExtract.workAreas.every((row) => row.type === "flooring") &&
    laminateExtract.workAreas.length === 1 &&
    specialistLine != null &&
    specialistLine.rateSourceType === "missing" &&
    specialistLine.quantity === 10 &&
    flooringLineIsManualPricingEligible(specialistLine) &&
    evaluateManualPricingEligibility({
      ...specialistLine,
      workAreaId: specialistLine.workAreaId ?? WA.id,
    }).ok === true &&
    quotePending.includes(FLOORING_QUOTE_SPECIALIST_PENDING) &&
    !quotePending.includes(FLOORING_QUOTE_SPECIALIST_INCLUDED) &&
    includedCost(laminateEst.lineItems) === 0 &&
    near(laminateEst.recommendedCost, 0) &&
    !laminateEst.lineItems.some(
      (row) => row.itemKey === FLOORING_CARPET_SUPPLY_INSTALL_M2
    )
);
const laminatePortion =
  (laminatePortions.length > 0 ? laminatePortions : [ordinary({ label: "Office" })])[0];
const pricedQuote = flooringQuote([laminatePortion], undefined, [
  {
    label: specialistLine?.label ?? "Specialist flooring supply and installation",
    component_key: FLOORING_SPECIALIST_COMPONENT,
    nested_item_id: laminatePortion.id,
    cost_known: true,
    total_cost: 1000,
    total_sell: 1111.11,
    notes_internal: specialistLine?.notes ?? null,
  },
]);
const clearedQuote = flooringQuote([laminatePortion], laminateEst);
check(
  "manually priced laminate is included; clearing restores pending Quote copy",
  pricedQuote.includes(FLOORING_QUOTE_SPECIALIST_INCLUDED) &&
    /Office: Supply and install 10 m² of the specified laminate flooring/.test(
      pricedQuote
    ) &&
    !pricedQuote.includes(FLOORING_QUOTE_SPECIALIST_PENDING) &&
    !flooringQuoteLeaksInternal(pricedQuote) &&
    clearedQuote.includes(FLOORING_QUOTE_SPECIALIST_PENDING) &&
    !clearedQuote.includes(FLOORING_QUOTE_SPECIALIST_INCLUDED)
);

const incomplete = ordinary({
  finish_type: "other",
  specialist_kind: "laminate",
  other_description: "laminate flooring",
  area_m2: null,
  area_input_method: null,
});
const incompleteEst = hosted([incomplete]);
check(
  "incomplete area is not a manual-pricing shortcut",
  !incompleteEst.lineItems.some(
    (row) =>
      row.componentKey === FLOORING_SPECIALIST_COMPONENT &&
      row.quantity != null &&
      row.quantity > 0
  ) &&
    evaluateManualPricingEligibility(
      line(incompleteEst, FLOORING_SPECIALIST_COMPONENT) ?? null
    ).ok === false
);

const ordinaryQuote = flooringQuote(
  [ordinary({ label: "Bedrooms", underlay_required: true })],
  carpetYes
);
check(
  "client Quote is confidential and area-specific",
  ordinaryQuote.toLowerCase().includes("bedrooms") &&
    !flooringQuoteLeaksInternal(ordinaryQuote) &&
    !/Pricing Required/i.test(ordinaryQuote) &&
    !/\$75/.test(ordinaryQuote) &&
    !/0\.12/.test(ordinaryQuote) &&
    !/labour\.carpenter/.test(ordinaryQuote)
);

check(
  "tile the bathroom floor remains Flooring-only; genuine Bathroom reno owns its floor",
  extract("Supply and install tiled flooring to the bathroom floor").workAreas
    .map((row) => row.type)
    .join() === "flooring" &&
    extract("renovate the bathroom, including tiled floor")
      .workAreas.map((row) => row.type)
      .includes("bathroom") &&
    !extract("renovate the bathroom, including tiled floor")
      .workAreas.map((row) => row.type)
      .includes("flooring")
);

const bathroomFacts: EstimateFact[] = [
  { key: "bathroom.area_m2", work_area_id: "b1", value: 6 },
];
const bathroomWa = {
  id: "b1",
  type: "bathroom",
  name: "Bathroom",
  sort_order: 1,
  status: "confirmed",
} as EstimateWorkArea;
const bathroomBefore = calculateBathroom(
  {
    ...ctx(bathroomFacts),
    confirmedWorkAreas: [bathroomWa],
  } as EstimateContext,
  bathroomWa
);
const bathroomAfter = applyFlooringFactWrite({
  facts: [...bathroomFacts, ...persist([ordinary()])],
  workAreaId: WA.id,
  key: FLOORING_ADD_PORTION_KEY,
  value: true,
});
check(
  "Flooring writes do not mutate Bathroom facts or money",
  JSON.stringify(bathroomAfter.filter((row) => row.key.startsWith("bathroom."))) ===
    JSON.stringify(bathroomFacts) &&
    calculateBathroom(
      {
        ...ctx(bathroomAfter),
        confirmedWorkAreas: [bathroomWa],
      } as EstimateContext,
      bathroomWa
    ).lineItems.length === bathroomBefore.lineItems.length
);

const nestedNoFallback = hosted([ordinary()]);
const legacy = calculateFlooring(
  ctx([
    {
      key: "flooring.area_m2",
      work_area_id: WA.id,
      value: 10,
      source: "user",
    },
  ]),
  WA
);
check(
  "nested Flooring never falls through to the $120/m² package",
  !nestedNoFallback.lineItems.some(
    (row) => row.recommendedCost === FITOUT_BENCHMARKS.flooringPerM2.cost * 10
  ) &&
    !nestedNoFallback.missingInfo.includes(FLOORING_NESTED_NOT_CALCULATED_MESSAGE) &&
    nestedNoFallback.missingInfo.includes(
      FLOORING_SPECIALIST_PRICING_REQUIRED_MESSAGE
    ) === false &&
    near(includedCost(nestedNoFallback.lineItems), 750)
);
check(
  "flat Flooring without portions remains the unchanged legacy package",
  legacy.lineItems.some(
    (row) => row.recommendedCost === FITOUT_BENCHMARKS.flooringPerM2.cost * 10
  )
);
check(
  "legacy isolation: no $22 removal, $8 underlay, $18/$45 prep, 0.8 h/m² or scope.flooring.m2",
  !comprehensive.lineItems.some(
    (row) =>
      row.recommendedCost === 22 ||
      row.itemKey === "scope.flooring.m2" ||
      row.itemKey === "flooring.material.m2"
  ) &&
    line(carpetYes, FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2)?.recommendedCost !==
      8 * 10 &&
    line(vinylPrep, FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2)?.recommendedCost !==
      18 * 10 &&
    line(vinylPrep, FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2)?.recommendedCost !==
      45 * 10 &&
    !comprehensive.lineItems.some((row) => row.labourHours === 8) &&
    !read("lib/estimate/flooring-commercial.ts").includes("scope.flooring.m2")
);

check(
  "no legitimate unresolved $0 inclusion on ordinary or specialist lines",
  [...carpetNo.lineItems, ...laminateEst.lineItems, ...fcEst.lineItems].every(
    (row) => {
      if (row.rateSourceType === "missing") {
        return (row.recommendedCost ?? 0) <= 0;
      }
      return row.includedInTotal === false || (row.recommendedCost ?? 0) > 0;
    }
  ) &&
    includedCost(laminateEst.lineItems) === 0 &&
    includedCost(carpetNo.lineItems) === 750
);
check(
  "future Flooring changes must update FLOORING-07; no Production bypass",
  /FLOORING-07/.test(FLOORING_V1_SUPPORT_NOTES) &&
    /explicit FLOORING-07 regression updates/.test(FLOORING_V1_SUPPORT_NOTES) &&
    !read("lib/estimate/flooring-commercial.ts").includes("process.env") &&
    !read("lib/work-areas/support-contract.ts").includes("process.env") &&
    !read("lib/estimate/flooring-identities.ts").includes("vercel --prod")
);

const deterministic = extractFlooringPortionsFromBrief(HOSTED_NEGATIVE_BRIEF);
check(
  "deterministic extraction still owns the hosted negative-removal brief",
  deterministic.length === 2 &&
    deterministic.every((row) => row.finish_removal_required === false)
);

const added = applyFlooringFactWrite({
  facts: persist([ordinary({ id: "fa_keep" })]),
  workAreaId: WA.id,
  key: FLOORING_ADD_PORTION_KEY,
  value: true,
});
const afterAdd = parseFlooringPortions(
  added.find((row) => row.key === FLOORING_PORTIONS_FACT_KEY)?.value
);
const duplicated = applyFlooringFactWrite({
  facts: added,
  workAreaId: WA.id,
  key: FLOORING_DUPLICATE_PORTION_KEY,
  value: "fa_keep",
});
const afterDup = parseFlooringPortions(
  duplicated.find((row) => row.key === FLOORING_PORTIONS_FACT_KEY)?.value
);
const deleted = applyFlooringFactWrite({
  facts: duplicated,
  workAreaId: WA.id,
  key: FLOORING_DELETE_PORTION_KEY,
  value: afterDup.find((row) => row.id !== "fa_keep")?.id,
});
const afterDel = parseFlooringPortions(
  deleted.find((row) => row.key === FLOORING_PORTIONS_FACT_KEY)?.value
);
check(
  "Add / Duplicate / Delete keep unique nested Flooring Area IDs",
  afterAdd.length === 2 &&
    afterDup.length === 3 &&
    new Set(afterDup.map((row) => row.id)).size === 3 &&
    afterDel.length === 2 &&
    afterDel.some((row) => row.id === "fa_keep")
);
check(
  "add-on and removal quantities follow net Flooring Area m²",
  line(carpetYes, FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2)?.quantity === 10 &&
    line(vinylPrep, FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2)?.quantity === 10 &&
    line(removal, FLOORING_CARPET_REMOVE_LABOUR)?.quantity === 10 &&
    near(line(removal, FLOORING_CARPET_REMOVE_LABOUR)?.labourHours, 1.2)
);
check(
  "remaining finish/add-on catalogue COST matches the frozen table",
  liveQuotrMaterialCost(FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2) === 95 &&
    liveQuotrMaterialCost(FLOORING_HARDWOOD_SUPPLY_INSTALL_M2) === 190 &&
    liveQuotrMaterialCost(FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2) === 15 &&
    liveQuotrMaterialCost(FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2) === 35
);
check(
  "shared GST is 15% and Quote exclusions appear once",
  DEFAULT_GST_RATE === 15 &&
    (ordinaryQuote.match(new RegExp(FLOORING_QUOTE_SHARED_EXCLUSIONS, "g")) ?? [])
      .length === 1 &&
    !pricedQuote.includes("Pricing Required")
);
check(
  "coverage keeps intentional Pricing Required rows after freeze",
  coverage.intentionalPr.length >= 3 &&
    FLOORING_BENCHMARK_REQUIREMENTS.filter(
      (row) => row.outcome === "INTENTIONAL_PRICING_REQUIRED"
    ).length === coverage.intentionalPr.length
);
check(
  "hosted human-QA evidence is recorded in the freeze notes",
  /Human-QA frozen — FLOORING-07/.test(FLOORING_V1_COVERAGE_QUOTE_NOTES) &&
    /human-QA frozen/.test(FLOORING_V1_SUPPORT_NOTES) &&
    !/has not occurred/.test(FLOORING_V1_SUPPORT_NOTES)
);
check(
  "optional location does not block ordinary pricing",
  near(includedCost(hosted([ordinary({ label: null })]).lineItems), 750)
);
const userOwned = ordinary({
  finish_removal_required: false,
  finish_removal_authority: "user",
} as Partial<FlooringPortion>);
const reanalysedPortions = mergePersistedFlooringPortionsOnReanalyse({
  persisted: [userOwned],
  extracted: [
    ordinary({
      id: userOwned.id,
      finish_removal_required: true,
      existing_finish_type: "carpet",
    }),
  ],
});
check(
  "user-owned removal No survives re-analysis",
  reanalysedPortions[0]?.finish_removal_required === false
);
check(
  "minor and major framing allowances remain $45/m² and $160/m²",
  near(
    includedCost(
      hosted([
        ordinary({
          framing_required: true,
          framing_allowance_level: "minor",
        }),
      ]).lineItems
    ) - 750,
    450
  ) &&
    near(
      includedCost(
        hosted([
          ordinary({
            framing_required: true,
            framing_allowance_level: "major",
          }),
        ]).lineItems
      ) - 750,
      1600
    )
);
check(
  "two identical-looking laminate areas keep separate nested ownership",
  (() => {
    const a = ordinary({
      id: "fa_lam_a",
      label: "Office A",
      finish_type: "other",
      specialist_kind: "laminate",
      other_description: "laminate flooring",
    });
    const b = ordinary({
      id: "fa_lam_b",
      label: "Office B",
      finish_type: "other",
      specialist_kind: "laminate",
      other_description: "laminate flooring",
    });
    const est = hosted([a, b]);
    const lines = est.lineItems.filter(
      (row) => row.componentKey === FLOORING_SPECIALIST_COMPONENT
    );
    return (
      lines.length === 2 &&
      lines[0]?.nestedItemId !== lines[1]?.nestedItemId &&
      lines.every((row) => row.rateSourceType === "missing")
    );
  })()
);

if (failed > 0) {
  console.log(`\nFAILED ${failed}  passed ${passed}`);
  process.exit(1);
}
console.log(`\nOK  ${passed} checks`);
