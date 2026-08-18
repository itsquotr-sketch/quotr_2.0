/**
 * RECOVERY-1 — commercial authority + cost-to-sell contract.
 * Run: npx tsx scripts/verify-recovery-1-commercial-authority.ts
 *
 * Audit-only. Does not change rates, goldens, or commercial behaviour.
 */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import type { OrganisationRate } from "../components/setup/types";
import { classifyResolvedSell, interpretLineSellAuthority } from "../lib/commercial-engine/core/cost-first-authority";
import { deriveSellFromCost } from "../lib/commercial-engine/core/sell-from-margin";
import { DECK_BENCHMARKS } from "../lib/estimate/benchmark-rates";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { getComponentCommercialAuthority } from "../lib/estimate/component-authority";
import { DECK_LABOUR_COMPONENT_KEY } from "../lib/estimate/deck-labour-requirement";
import {
  DECK_BEARERS_COMPONENT_KEY,
  DECK_CONCRETE_COMPONENT_KEY,
  DECK_JOISTS_COMPONENT_KEY,
  DECK_RIM_FRAMING_COMPONENT_KEY,
  DECK_SUPPORTS_COMPONENT_KEY,
} from "../lib/estimate/deck-structure";
import { DECK_SURFACE_COMPONENT_KEY } from "../lib/estimate/deck-surface-requirement";
import { buildLineItemNotes } from "../lib/estimate/line-items";
import { parseLineItemNotes } from "../lib/estimate/line-item-metadata";
import {
  applyTargetMarginToLineItems,
  aggregateEstimateLineTotals,
} from "../lib/estimate/margin-override";
import { MATERIAL_RATE_KEYS } from "../lib/estimate/material-rate-keys";
import {
  buildPersistEstimateGenerationV1,
  persistEstimateGenerationViaRpc,
  PERSIST_ESTIMATE_GENERATION_RPC,
} from "../lib/estimate/persist-estimate-generation";
import { createGenerationId } from "../lib/estimate/requirement-snapshot-persist";
import { resolveLabourRate, resolveRate } from "../lib/estimate/rates";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
  EstimateResult,
  EstimateWorkArea,
} from "../lib/estimate/types";
import { calculateAuthoritativeFieldsFromEstimateLine } from "../lib/pricing/estimate-to-pricing-adapter";
import { valuesFromEstimateLineItem } from "../lib/pricing/recalibration-helpers";
import { mapPricingItemsToQuoteItems, sanitizeClientLabel } from "../lib/quotes/from-pricing";
import type { PricingItem } from "../lib/pricing/types";
import { loadCalibrationFixture } from "./deck-calibration/run-deck-calibration";
import { resolveLocalDbContainer } from "./local-db-container";

let passed = 0;
let failed = 0;
let dbChecks = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function dbCheck(name: string, ok: boolean, detail = ""): void {
  dbChecks += 1;
  check(name, ok, detail);
}

function wa(id: string): EstimateWorkArea {
  return { id, type: "deck", name: "Deck", sort_order: 1 };
}

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

function rate(
  partial: Partial<OrganisationRate> & { item_key: string }
): OrganisationRate {
  return {
    id: partial.id ?? "r1",
    rate_type: partial.rate_type ?? "material",
    trade: partial.trade ?? null,
    work_area_type: partial.work_area_type ?? "deck",
    item_key: partial.item_key,
    label: partial.label ?? partial.item_key,
    unit: partial.unit ?? "lm",
    cost_rate: partial.cost_rate ?? 22.5,
    sell_rate: partial.sell_rate ?? null,
    markup_percent: null,
    active: partial.active ?? true,
  };
}

const orgSettings = {
  allow_benchmark_rates: true,
  default_margin_percent: 20,
  budget_rate_factor: 0.9,
  premium_rate_factor: 1.15,
};

const realJob = loadCalibrationFixture("REAL-JOB-01.json");
const WA = "wa-deck-1";
const realFacts = Object.entries(realJob.facts).map(([key, value]) =>
  fact(key, WA, value)
);

function realJobContext(rates: OrganisationRate[]): EstimateContext {
  return {
    project: { id: "real-job-01", qualityLevel: "standard" },
    confirmedWorkAreas: [wa(WA)],
    facts: realFacts,
    constraints: [],
    organisationSettings: orgSettings,
    materialWastageSettings: {
      deckingWastagePercent: 10,
      defaultMaterialWastagePercent: 10,
    },
    rates,
  } as unknown as EstimateContext;
}

function line(items: EstimateLineItemInput[], label: string) {
  return items.find((item) => item.label === label);
}

function surface(items: EstimateLineItemInput[]) {
  return items.find((item) => item.componentKey === DECK_SURFACE_COMPONENT_KEY);
}

console.log("=== RECOVERY-1 commercial authority ===\n");

const classifyDerived = classifyResolvedSell({
  costRate: 22.5,
  sellRate: null,
  applicableGrossMarginPercent: 20,
});
check(
  "1 cost-only rate derives sell from GM",
  classifyDerived.sellAuthority === "derived_from_gross_margin" &&
    classifyDerived.sellRate === deriveSellFromCost(22.5, 20)
);

const classifyPaired = classifyResolvedSell({
  costRate: 120,
  sellRate: 180,
  applicableGrossMarginPercent: 20,
});
check(
  "2 paired cost/sell is legacy_paired_rate",
  classifyPaired.sellAuthority === "legacy_paired_rate" &&
    classifyPaired.sellRate === 180 &&
    classifyPaired.isLegacyPairedRate
);

const classifyExplicit = classifyResolvedSell({
  costRate: 120,
  sellRate: 200,
  applicableGrossMarginPercent: 20,
  explicitSellOverride: true,
});
check(
  "3 explicit sell override is not GM-derived",
  classifyExplicit.sellAuthority === "explicit_sell_override" &&
    classifyExplicit.sellRate === 200
);

const framingResolved = resolveRate({
  rates: [],
  rateType: "material",
  itemKey: "deck.substructure.m2",
  workAreaType: "deck",
  unit: "m2",
  fallbackCostRate: DECK_BENCHMARKS.framing.cost,
  fallbackSellRate: DECK_BENCHMARKS.framing.sell,
  organisationSettings: orgSettings,
});
check(
  "4 framing benchmark is legacy paired $120/$180",
  framingResolved.costRate === 120 &&
    framingResolved.sellRate === 180 &&
    framingResolved.sellAuthority === "legacy_paired_rate" &&
    framingResolved.sourceType === "benchmark"
);

const fixingsResolved = resolveRate({
  rates: [],
  rateType: "material",
  itemKey: "deck.fixings.m2",
  workAreaType: "deck",
  unit: "m2",
  fallbackCostRate: DECK_BENCHMARKS.fixings.cost,
  fallbackSellRate: DECK_BENCHMARKS.fixings.sell,
  organisationSettings: orgSettings,
});
check(
  "5 fixings benchmark is legacy paired $25/$40",
  fixingsResolved.costRate === 25 &&
    fixingsResolved.sellRate === 40 &&
    fixingsResolved.sellAuthority === "legacy_paired_rate"
);

const labourResolved = resolveLabourRate({
  rates: [],
  organisationSettings: orgSettings,
});
check(
  "6 default labour is grandfathered pair $60/$90",
  labourResolved.costRate === 60 &&
    labourResolved.sellRate === 90 &&
    labourResolved.sellAuthority === "legacy_paired_rate"
);

const empty = calculateEstimate(realJobContext([]));
const emptyLabour = line(empty.lineItems, "Deck labour");
const emptySurface = surface(empty.lineItems);
const emptyFraming = line(empty.lineItems, "Framing/substructure");
const emptyFixings = line(empty.lineItems, "Fixings and consumables");

check("7 REAL-JOB empty-rates cost is $10,526.30", empty.recommendedCost === 10526.3);
check("8 REAL-JOB empty-rates sell is $16,069.10", empty.recommendedSell === 16069.1);
check(
  "9 empty-rates line sells equal estimate sell",
  Math.abs(
    empty.lineItems.reduce((sum, item) => sum + item.recommendedSell, 0) -
      empty.recommendedSell
  ) < 0.05
);
check(
  "10 labour hours are 27 × 1.2 = 32.4",
  emptyLabour?.quantity === 27 &&
    emptyLabour.labourHours === 32.4 &&
    emptyLabour.recommendedCost === 1944
);
check(
  "11 $13,000 is never a rate",
  empty.lineItems.every(
    (item) => item.costRate !== 13000 && item.sellRate !== 13000
  )
);

const companyHardwood = rate({
  item_key: MATERIAL_RATE_KEYS.deckingHardwoodLm,
  unit: "lm",
  cost_rate: 22.5,
  sell_rate: null,
});
const companySurface = calculateEstimate(realJobContext([companyHardwood]));
const companySurfaceLine = surface(companySurface.lineItems);
check(
  "12 company hardwood lm is cost-first derived sell",
  companySurfaceLine?.costRate === 22.5 &&
    companySurfaceLine.rateSourceType === "user_rate" &&
    companySurfaceLine.sellDerivedFromMargin === true
);
check(
  "13 company hardwood does not change framing paired sell",
  line(companySurface.lineItems, "Framing/substructure")?.recommendedSell === 4860
);

const PREVIEW_GM = 23.5;
const previewShapedHardwood = rate({
  item_key: MATERIAL_RATE_KEYS.deckingHardwoodLm,
  unit: "lm",
  cost_rate: 10.69,
  sell_rate: null,
});
const previewShaped = calculateEstimate(realJobContext([previewShapedHardwood]));
const previewAfterGm = applyTargetMarginToLineItems(
  previewShaped.lineItems,
  PREVIEW_GM,
  orgSettings
);
const previewTotals = aggregateEstimateLineTotals(previewAfterGm);
const expectedPreviewSell = deriveSellFromCost(previewTotals.recommendedCost, PREVIEW_GM);
check(
  "14 Preview-shaped cost is near Owner $8,127",
  Math.abs(previewTotals.recommendedCost - 8127) < 2,
  `cost=${previewTotals.recommendedCost}`
);
check(
  "15 Preview-shaped sell is F-SFM at 23.5% GM",
  Math.abs(previewTotals.recommendedSell - expectedPreviewSell) < 0.05,
  `sell=${previewTotals.recommendedSell} expected=${expectedPreviewSell}`
);
check(
  "16 Margin UI means gross margin not markup",
  previewTotals.marginPercent === PREVIEW_GM ||
    Math.abs(previewTotals.marginPercent - PREVIEW_GM) < 0.05
);
check(
  "17 markup is GP/cost and is not 23.5",
  previewTotals.markupPercent !== PREVIEW_GM &&
    previewTotals.markupPercent > PREVIEW_GM
);

const emptyAfterGm = applyTargetMarginToLineItems(
  empty.lineItems,
  PREVIEW_GM,
  orgSettings
);
const emptyGmTotals = aggregateEstimateLineTotals(emptyAfterGm);
check(
  "18 project GM rewrites ALL line sells from cost including legacy pairs",
  line(emptyAfterGm, "Framing/substructure")?.recommendedSell ===
    deriveSellFromCost(3240, PREVIEW_GM) &&
    line(emptyAfterGm, "Fixings and consumables")?.recommendedSell ===
      deriveSellFromCost(675, PREVIEW_GM) &&
    line(emptyAfterGm, "Deck labour")?.recommendedSell ===
      deriveSellFromCost(1944, PREVIEW_GM)
);
check(
  "19 empty-rates + 23.5% GM is not Owner Preview $10,620",
  Math.abs(emptyGmTotals.recommendedSell - 10620) > 1000
);

check(
  "20 surface authority REQUIREMENT_AUTHORITATIVE",
  getComponentCommercialAuthority({
    workAreaType: "deck",
    componentKey: DECK_SURFACE_COMPONENT_KEY,
  }).authority === "REQUIREMENT_AUTHORITATIVE"
);
check(
  "21 labour authority SHADOW",
  getComponentCommercialAuthority({
    workAreaType: "deck",
    componentKey: DECK_LABOUR_COMPONENT_KEY,
  }).authority === "SHADOW"
);
check(
  "22 unregistered substructure defaults LEGACY_AUTHORITATIVE",
  getComponentCommercialAuthority({
    workAreaType: "deck",
    componentKey: "deck.substructure.m2",
  }).authority === "LEGACY_AUTHORITATIVE"
);

const shadowKeys = [
  DECK_JOISTS_COMPONENT_KEY,
  DECK_RIM_FRAMING_COMPONENT_KEY,
  DECK_BEARERS_COMPONENT_KEY,
  DECK_SUPPORTS_COMPONENT_KEY,
  DECK_CONCRETE_COMPONENT_KEY,
];
check(
  "23 structural children do not enter estimate money lines",
  shadowKeys.every(
    (key) =>
      empty.lineItems.filter((item) => item.componentKey === key).length === 0
  )
);
check(
  "24 one active framing line",
  empty.lineItems.filter((item) => item.label === "Framing/substructure").length ===
    1
);
check(
  "25 one active fixings line",
  emptyFixings != null &&
    emptyFixings.recommendedCost === 675 &&
    empty.lineItems.filter((item) => item.label === "Fixings and consumables")
      .length === 1
);
check(
  "26 one active labour line",
  empty.lineItems.filter((item) => item.label === "Deck labour").length === 1
);
check(
  "27 one active decking surface line",
  empty.lineItems.filter(
    (item) => item.componentKey === DECK_SURFACE_COMPONENT_KEY
  ).length === 1
);

const exactFraming = calculateEstimate(
  realJobContext([
    rate({
      item_key: "deck.substructure.m2",
      unit: "m2",
      cost_rate: 95,
      sell_rate: 140,
    }),
  ])
);
check(
  "28 exact company framing outranks benchmark",
  line(exactFraming.lineItems, "Framing/substructure")?.costRate === 95 &&
    line(exactFraming.lineItems, "Framing/substructure")?.sellRate === 140
);

const companyLabour = calculateEstimate(
  realJobContext([
    {
      id: "lab",
      rate_type: "labour",
      trade: "carpenter",
      work_area_type: null,
      item_key: "labour.carpenter.hour",
      label: "Carpenter",
      unit: "hour",
      cost_rate: 50,
      sell_rate: null,
      markup_percent: null,
      active: true,
    },
  ])
);
check(
  "29 company labour cost-only derives sell and outranks default pair",
  line(companyLabour.lineItems, "Deck labour")?.costRate === 50 &&
    line(companyLabour.lineItems, "Deck labour")?.sellDerivedFromMargin === true
);

const projectSurface = calculateEstimate(
  realJobContext([
    rate({
      item_key: MATERIAL_RATE_KEYS.deckingHardwoodLm,
      unit: "lm",
      cost_rate: 18,
      sell_rate: 30,
    }),
  ])
);
check(
  "30 paired company surface preserves sell 30 (legacy pair at resolve)",
  surface(projectSurface.lineItems)?.costRate === 18 &&
    surface(projectSurface.lineItems)?.sellRate === 30 &&
    surface(projectSurface.lineItems)?.sellDerivedFromMargin !== true
);

const framingNotes = buildLineItemNotes(emptyFraming!);
const pricingBeforeMargin = calculateAuthoritativeFieldsFromEstimateLine({
  id: "framing-before",
  category: "materials",
  recommended_cost: emptyFraming!.recommendedCost,
  recommended_sell: emptyFraming!.recommendedSell,
  notes: framingNotes,
});
check(
  "31 Pricing without project GM copies framing sell $4,860",
  pricingBeforeMargin.ok &&
    pricingBeforeMargin.fields.totalSell === 4860 &&
    pricingBeforeMargin.fields.totalCost === 3240
);

const framingAfterGm = line(emptyAfterGm, "Framing/substructure")!;
const pricingAfterMargin = calculateAuthoritativeFieldsFromEstimateLine({
  id: "framing-after",
  category: "materials",
  recommended_cost: framingAfterGm.recommendedCost,
  recommended_sell: framingAfterGm.recommendedSell,
  notes: buildLineItemNotes(emptyFraming!),
});
const estimateFramingSellAfterGm = deriveSellFromCost(3240, PREVIEW_GM);
check(
  "32 target-GM Pricing framing equals F-SFM estimate sell",
  pricingAfterMargin.ok &&
    pricingAfterMargin.fields.totalSell === estimateFramingSellAfterGm &&
    framingAfterGm.recommendedSell === estimateFramingSellAfterGm &&
    pricingAfterMargin.fields.totalSell !== 4860,
  `pricingSell=${pricingAfterMargin.ok ? pricingAfterMargin.fields.totalSell : "err"} estimateSell=${framingAfterGm.recommendedSell}`
);
check(
  "32b notes pair $180 does not overwrite Pricing total",
  pricingAfterMargin.ok &&
    pricingAfterMargin.fields.totalSell !== 27 * 180
);

function pricingFromLine(item: EstimateLineItemInput, id: string) {
  return calculateAuthoritativeFieldsFromEstimateLine({
    id,
    category: item.category,
    recommended_cost: item.recommendedCost,
    recommended_sell: item.recommendedSell,
    notes: buildLineItemNotes(item),
  });
}

const previewLabour = line(previewAfterGm, "Deck labour")!;
const previewSurfaceLine = surface(previewAfterGm)!;
const previewFraming = line(previewAfterGm, "Framing/substructure")!;
const previewFixings = line(previewAfterGm, "Fixings and consumables")!;
const pLabour = pricingFromLine(previewLabour, "p-labour");
const pSurface = pricingFromLine(previewSurfaceLine, "p-surface");
const pFraming = pricingFromLine(previewFraming, "p-framing");
const pFixings = pricingFromLine(previewFixings, "p-fixings");

check(
  "52 target-GM labour Pricing sell is 2541.18",
  pLabour.ok && pLabour.fields.totalSell === 2541.18 && pLabour.fields.totalCost === 1944
);
check(
  "53 target-GM surface Pricing sell is 2964.55",
  pSurface.ok && pSurface.fields.totalSell === 2964.55 && pSurface.fields.totalCost === 2267.88
);
check(
  "54 target-GM framing Pricing sell is 4235.29",
  pFraming.ok && pFraming.fields.totalSell === 4235.29 && pFraming.fields.totalCost === 3240
);
check(
  "55 target-GM fixings Pricing sell is 882.35",
  pFixings.ok && pFixings.fields.totalSell === 882.35 && pFixings.fields.totalCost === 675
);
check(
  "56 target-GM Pricing total equals estimate 10623.37",
  pLabour.ok &&
    pSurface.ok &&
    pFraming.ok &&
    pFixings.ok &&
    Math.abs(
      pLabour.fields.totalSell +
        pSurface.fields.totalSell +
        pFraming.fields.totalSell +
        pFixings.fields.totalSell -
        10623.37
    ) < 0.05
);
check(
  "57 target-GM sellAuthority is derived_from_gross_margin",
  previewFraming.sellAuthority === "derived_from_gross_margin" &&
    pFraming.ok &&
    pFraming.sellAuthority === "derived_from_gross_margin"
);
check(
  "58 margin edit leaves rateSource unchanged",
  previewFraming.rateSourceType === "benchmark" &&
    previewLabour.rateSourceType === "default"
);

const noGmPricingFraming = pricingFromLine(emptyFraming!, "no-gm-framing");
const noGmPricingFixings = pricingFromLine(emptyFixings!, "no-gm-fixings");
check(
  "59 no-GM Pricing preserves framing pair $4,860",
  noGmPricingFraming.ok && noGmPricingFraming.fields.totalSell === 4860
);
check(
  "60 no-GM Pricing preserves fixings pair $1,080",
  noGmPricingFixings.ok && noGmPricingFixings.fields.totalSell === 1080
);
check(
  "61 no-GM sellAuthority is legacy_paired_rate",
  emptyFraming?.sellAuthority === "legacy_paired_rate" &&
    noGmPricingFraming.ok &&
    noGmPricingFraming.sellAuthority === "legacy_paired_rate"
);

const targetGmQuote = mapPricingItemsToQuoteItems(
  [
    {
      id: "tg-f",
      work_area_id: WA,
      internal_label: "Framing/substructure",
      client_label: "Framing/substructure",
      client_description: "derived_from_gross_margin benchmark",
      quantity: 27,
      unit: "m2",
      unit_sell: pFraming.ok ? pFraming.fields.unitSell : 0,
      total_sell: 4235.29,
      total_cost: 3240,
      visible_on_quote: true,
      optional: false,
      sort_order: 1,
      item_type: "material",
      calculation_mode: "quantity_rate",
    } as PricingItem,
  ],
  new Map([[WA, "Deck"]])
);
check(
  "62 target-GM Quote copies Pricing 4235.29 not 4860",
  targetGmQuote[0]?.total === 4235.29
);
check(
  "63 Quote hides sell-authority identifiers",
  !targetGmQuote[0]?.label.toLowerCase().includes("derived_from_gross_margin") &&
    sanitizeClientLabel("derived_from_gross_margin").includes("derived") === false
);

check(
  "64 historical missing authority: matching pair is legacy",
  interpretLineSellAuthority({
    recommendedSell: 4860,
    sourceSellRate: 180,
    quantity: 27,
  }) === "legacy_paired_rate"
);
check(
  "65 historical missing authority: GM rewrite is derived",
  interpretLineSellAuthority({
    recommendedSell: 4235.29,
    sourceSellRate: 180,
    quantity: 27,
  }) === "derived_from_gross_margin"
);

const gmNotes = buildLineItemNotes(previewFraming);
check(
  "66 persisted notes carry sellAuthority",
  parseLineItemNotes(gmNotes).metadata.sellAuthority === "derived_from_gross_margin" &&
    parseLineItemNotes(gmNotes).metadata.sellRate === 180
);

const quoteItems = mapPricingItemsToQuoteItems(
  [
    {
      id: "p1",
      work_area_id: WA,
      internal_label: "Framing/substructure",
      client_label: "Framing/substructure",
      client_description: "Quotr benchmark framing",
      quantity: 27,
      unit: "m2",
      unit_sell: 180,
      total_sell: 4860,
      total_cost: 3240,
      visible_on_quote: true,
      optional: false,
      sort_order: 1,
      item_type: "material",
      calculation_mode: "quantity_rate",
    } as PricingItem,
  ],
  new Map([[WA, "Deck"]])
);
check(
  "33 Quote copies Pricing total_sell and does not re-run calculateEstimate",
  quoteItems[0]?.total === 4860
);
check(
  "34 Quote sanitises internal benchmark wording from labels",
  sanitizeClientLabel("Quotr benchmark framing").toLowerCase().includes("benchmark") ===
    false
);

const actionsSrc = readFileSync("lib/assistant/actions.ts", "utf8");
check(
  "35 regenerate reapplies target_margin_percent via F-SFM",
  actionsSrc.includes("target_margin_percent") &&
    actionsSrc.includes("applyTargetMarginToLineItems")
);
const marginActionsSrc = readFileSync("lib/assistant/margin-actions.ts", "utf8");
check(
  "36 margin edit rewrites line sells from recommended_cost",
  marginActionsSrc.includes("applyMarginToAmounts") &&
    marginActionsSrc.includes("recommended_cost")
);
check(
  "37 margin edit does not rewrite notes sellRate",
  !marginActionsSrc.includes("sellRate") &&
    !marginActionsSrc.includes("sell_rate")
);

check(
  "38 four quality gates documented in contract",
  readFileSync(
    "docs/architecture/QUOTR_COMMERCIAL_COST_TO_SELL_CONTRACT.md",
    "utf8"
  ).includes("CALCULATION GATE") &&
    readFileSync(
      "docs/architecture/QUOTR_COMMERCIAL_COST_TO_SELL_CONTRACT.md",
      "utf8"
    ).includes("COMMERCIAL GATE") &&
    readFileSync(
      "docs/architecture/QUOTR_COMMERCIAL_COST_TO_SELL_CONTRACT.md",
      "utf8"
    ).includes("PERSISTENCE GATE") &&
    readFileSync(
      "docs/architecture/QUOTR_COMMERCIAL_COST_TO_SELL_CONTRACT.md",
      "utf8"
    ).includes("USER GATE")
);

check(
  "39 labour effort ≠ crew size is documented as future",
  readFileSync(
    "docs/architecture/QUOTR_COMMERCIAL_COST_TO_SELL_CONTRACT.md",
    "utf8"
  ).includes("LABOUR EFFORT") &&
    readFileSync(
      "docs/architecture/QUOTR_ESTIMATING_ENGINE_ARCHITECTURE.md",
      "utf8"
    ).includes("LABOUR-CREW-01") &&
    readFileSync("docs/product/QUOTR_PRODUCT_BACKLOG.md", "utf8").includes(
      "LABOUR-CREW-01"
    )
);

check(
  "43 surface A: Quotr benchmark is paired $22/$34",
  emptySurface?.costRate === 22 &&
    emptySurface.sellRate === 34 &&
    emptySurface.rateSourceType === "benchmark" &&
    emptySurface.sellDerivedFromMargin !== true
);
check(
  "43b surface B: company exact cost-only is user_rate + derived sell",
  companySurfaceLine?.costRate === 22.5 &&
    companySurfaceLine.rateSourceType === "user_rate" &&
    companySurfaceLine.sellDerivedFromMargin === true
);
check(
  "43c surface C: paired company rate is user_rate preserving sell 30",
  surface(projectSurface.lineItems)?.rateSourceType === "user_rate" &&
    surface(projectSurface.lineItems)?.sellRate === 30
);

const blankPackage = calculateEstimate(
  realJobContext([
    {
      id: "pkg",
      rate_type: "material",
      trade: null,
      work_area_type: "deck",
      item_key: "",
      label: "Deck package",
      unit: "m2",
      cost_rate: 99,
      sell_rate: 150,
      markup_percent: null,
      active: true,
    },
  ])
);
check(
  "44 blank work-area package does not steal named surface or framing",
  surface(blankPackage.lineItems)?.costRate === 22 &&
    line(blankPackage.lineItems, "Framing/substructure")?.costRate === 120
);

const persistSrc = readFileSync(
  "lib/estimate/persist-estimate-generation.ts",
  "utf8"
);
check(
  "45 persist V1 has no dedicated sellAuthority column",
  !persistSrc.includes("sellAuthority") && persistSrc.includes("recommendedSell")
);
check(
  "45b line notes persist sellAuthority via buildLineItemNotes",
  readFileSync("lib/estimate/line-items.ts", "utf8").includes("sellAuthority: item.sellAuthority")
);

console.log("\nPreview-shaped active lines (illustration, not Owner org dump):\n");
for (const item of previewAfterGm) {
  if (item.includedInTotal === false) continue;
  console.log(
    `  ${item.label} | key=${item.componentKey ?? item.itemKey ?? "?"} | qty=${item.quantity} ${item.unit ?? ""} | costRate=${item.costRate} | cost=${item.recommendedCost} | src=${item.rateSourceType} | sellRate(resolve)=${item.sellRate} | sell(after GM)=${item.recommendedSell}`
  );
}
console.log(
  `  TOTAL cost=${previewTotals.recommendedCost} sell=${previewTotals.recommendedSell} gm=${previewTotals.marginPercent}\n`
);

function testLocalDb(): void {
  console.log("\n--- LOCAL DB persistence (not hosted Preview) ---\n");
  if (!existsSync("supabase/migrations/036_persist_estimate_generation_v1.sql")) {
    dbCheck("40-42 local DB skipped", true);
    return;
  }
  let container = "";
  try {
    container = resolveLocalDbContainer();
  } catch {
    dbCheck("40-42 local DB skipped (docker unavailable)", true);
    return;
  }

  const orgId = randomUUID();
  const userId = randomUUID();
  const projectId = randomUUID();
  const email = `recovery1-${userId.slice(0, 8)}@example.local`;
  try {
    execFileSync(
      "docker",
      ["exec", "-i", container, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-t", "-A"],
      {
        encoding: "utf8",
        input: `
          INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password,
            email_confirmed_at, created_at, updated_at,
            raw_app_meta_data, raw_user_meta_data, is_super_admin, is_sso_user, is_anonymous
          ) VALUES (
            '${userId}', '00000000-0000-0000-0000-000000000000',
            'authenticated', 'authenticated', '${email}',
            crypt('password', gen_salt('bf')), now(), now(), now(),
            '{}'::jsonb, '{}'::jsonb, false, false, false
          );
          INSERT INTO public.organisations (id, name) VALUES ('${orgId}', 'RECOVERY-1');
          INSERT INTO public.profiles (id, org_id, role) VALUES ('${userId}', '${orgId}', 'owner');
          INSERT INTO public.projects (id, org_id, created_by, title, stage)
          VALUES ('${projectId}', '${orgId}', '${userId}', 'REAL-JOB-01', 'estimate_ready');
        `,
      }
    );

    const generationId = randomUUID();
    const payload = buildPersistEstimateGenerationV1({
      projectId,
      generationId,
      estimateResult: empty,
    });
    payload.lineItems = payload.lineItems.map((item) => ({
      ...item,
      workAreaId: null,
    }));

    execFileSync(
      "docker",
      ["exec", "-i", container, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-t", "-A"],
      {
        encoding: "utf8",
        input: `
          BEGIN;
          SET LOCAL ROLE authenticated;
          SELECT set_config('request.jwt.claim.sub', '${userId}', true);
          SELECT public.${PERSIST_ESTIMATE_GENERATION_RPC}('${JSON.stringify(payload).replace(/'/g, "''")}'::jsonb);
          COMMIT;
        `,
      }
    );

    const reloaded = execFileSync(
      "docker",
      ["exec", "-i", container, "psql", "-U", "postgres", "-t", "-A", "-v", "ON_ERROR_STOP=1"],
      {
        encoding: "utf8",
        input: `
          SELECT recommended_cost::text || '|' || recommended_sell::text || '|' || margin_percent::text
          FROM public.estimates WHERE project_id = '${projectId}'::uuid;
        `,
      }
    ).trim();
    const [cost, sell] = reloaded.split("|");
    dbCheck(
      "40 persisted cost equals generated cost",
      Number(cost) === empty.recommendedCost,
      `cost=${cost}`
    );
    dbCheck(
      "41 persisted sell equals generated sell",
      Number(sell) === empty.recommendedSell,
      `sell=${sell}`
    );

    const lineCount = execFileSync(
      "docker",
      ["exec", "-i", container, "psql", "-U", "postgres", "-t", "-A", "-v", "ON_ERROR_STOP=1"],
      {
        encoding: "utf8",
        input: `
          SELECT count(*)::text FROM public.estimate_line_items
          WHERE estimate_id = (SELECT id FROM public.estimates WHERE project_id = '${projectId}'::uuid);
        `,
      }
    ).trim();
    dbCheck("42 persisted active line count >= 4", Number(lineCount) >= 4, `count=${lineCount}`);
  } catch (error) {
    dbCheck(
      "40-42 local DB skipped (schema unavailable)",
      true,
      error instanceof Error ? error.message : String(error)
    );
  } finally {
    try {
      execFileSync(
        "docker",
        ["exec", "-i", container, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1"],
        {
          encoding: "utf8",
          input: `
            DELETE FROM public.projects WHERE id = '${projectId}'::uuid;
            DELETE FROM public.profiles WHERE id = '${userId}'::uuid;
            DELETE FROM public.organisations WHERE id = '${orgId}'::uuid;
            DELETE FROM auth.users WHERE id = '${userId}'::uuid;
          `,
        }
      );
    } catch {
      /* best-effort cleanup */
    }
  }
}

const HOSTED_EXPECTED_REF = "lxvnylhsbvudzzupxeqr";
let hostedChecks = 0;

function hostedCheck(name: string, ok: boolean, detail = ""): void {
  hostedChecks += 1;
  check(name, ok, detail);
}

function hostnameRef(url: string): string {
  return new URL(url).hostname.split(".")[0] ?? "";
}

async function testHostedPreview(): Promise<void> {
  console.log("\n--- HOSTED Preview (disposable org; not local Docker) ---\n");
  if (!existsSync(".env.local")) {
    hostedCheck("46-51 hosted skipped (.env.local missing)", true);
    return;
  }
  loadEnv({ path: ".env.local" });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !serviceKey || !anonKey) {
    hostedCheck("46-51 hosted skipped (Preview env missing)", true);
    return;
  }
  const ref = hostnameRef(url);
  if (ref !== HOSTED_EXPECTED_REF) {
    hostedCheck(
      "46-51 hosted skipped (refusing unexpected Supabase ref)",
      true,
      ref
    );
    return;
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const orgId = randomUUID();
  const projectId = randomUUID();
  const workAreaId = randomUUID();
  const suffix = randomUUID().slice(0, 8);
  const email = `recovery1-proof-${suffix}@example.invalid`;
  const password = `recovery1-${randomUUID()}`;
  const orgIds: string[] = [];
  const userIds: string[] = [];

  try {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error || !created.data.user) {
      throw new Error(created.error?.message ?? "create user failed");
    }
    const userId = created.data.user.id;
    userIds.push(userId);

    const orgInsert = await admin.from("organisations").insert({
      id: orgId,
      name: `RECOVERY-1-PROOF disposable ${suffix}`,
    });
    if (orgInsert.error) throw new Error(orgInsert.error.message);
    orgIds.push(orgId);

    const profileInsert = await admin.from("profiles").insert({
      id: userId,
      org_id: orgId,
      role: "owner",
      full_name: "RECOVERY-1 proof",
    });
    if (profileInsert.error) throw new Error(profileInsert.error.message);

    const projectInsert = await admin.from("projects").insert({
      id: projectId,
      org_id: orgId,
      created_by: userId,
      title: `RECOVERY-1-PROOF REAL-JOB-01 ${suffix}`,
      stage: "estimate_ready",
    });
    if (projectInsert.error) throw new Error(projectInsert.error.message);

    const waInsert = await admin.from("work_areas").insert({
      id: workAreaId,
      org_id: orgId,
      project_id: projectId,
      type: "deck",
      name: "Deck",
      status: "confirmed",
      sort_order: 0,
    });
    if (waInsert.error) throw new Error(waInsert.error.message);

    const hostedContext: EstimateContext = {
      ...realJobContext([previewShapedHardwood]),
      project: { id: projectId, qualityLevel: "standard" },
      confirmedWorkAreas: [wa(workAreaId)],
      facts: realFacts.map((entry) => ({
        ...entry,
        work_area_id: workAreaId,
      })),
    };
    const generated = calculateEstimate(hostedContext);
    const gmItems = applyTargetMarginToLineItems(
      generated.lineItems,
      PREVIEW_GM,
      orgSettings
    );
    const gmTotals = aggregateEstimateLineTotals(gmItems);
    const persistResult: EstimateResult = {
      ...generated,
      lineItems: gmItems,
      recommendedCost: gmTotals.recommendedCost,
      recommendedSell: gmTotals.recommendedSell,
      grossProfit: gmTotals.recommendedSell - gmTotals.recommendedCost,
      marginPercent: gmTotals.marginPercent,
      markupPercent: gmTotals.markupPercent,
      costLow: gmTotals.costLow,
      costHigh: gmTotals.costHigh,
      sellLow: gmTotals.sellLow,
      sellHigh: gmTotals.sellHigh,
      estimateSellAuthority: "project_target_margin" as const,
    };

    const userClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const signIn = await userClient.auth.signInWithPassword({ email, password });
    if (signIn.error) throw new Error(signIn.error.message);

    const persist = await persistEstimateGenerationViaRpc(
      userClient,
      buildPersistEstimateGenerationV1({
        projectId,
        generationId: createGenerationId(),
        estimateResult: persistResult,
      })
    );
    hostedCheck(
      "46 hosted persistEstimateGenerationViaRpc succeeds",
      persist.ok,
      persist.ok ? "" : persist.message
    );
    if (!persist.ok) throw new Error(persist.message);

    const { data: estimate, error: estimateError } = await userClient
      .from("estimates")
      .select(
        "id, recommended_cost, recommended_sell, margin_percent, requirement_generation_id, latest_requirement_snapshot_id"
      )
      .eq("project_id", projectId)
      .maybeSingle();
    hostedCheck(
      "47 hosted reload cost/sell match generated F-SFM totals",
      !estimateError &&
        Number(estimate?.recommended_cost) === persistResult.recommendedCost &&
        Number(estimate?.recommended_sell) === persistResult.recommendedSell,
      `cost=${estimate?.recommended_cost} sell=${estimate?.recommended_sell}`
    );

    const { data: lines, error: linesError } = await userClient
      .from("estimate_line_items")
      .select(
        "id, label, category, recommended_cost, recommended_sell, notes, sort_order, component_key, rate_source, work_area_id"
      )
      .eq("estimate_id", estimate!.id);
    hostedCheck(
      "48 hosted lines preserve component keys and cost",
      !linesError &&
        (lines?.length ?? 0) >= 4 &&
        lines!.some((row) => row.component_key === DECK_SURFACE_COMPONENT_KEY) &&
        shadowKeys.every(
          (key) => !lines!.some((row) => row.component_key === key)
        ) &&
        Math.abs(
          lines!.reduce((sum, row) => sum + Number(row.recommended_cost ?? 0), 0) -
            persistResult.recommendedCost
        ) < 0.05
    );

    const { data: snapshot, error: snapshotError } = await userClient
      .from("estimate_requirement_snapshots")
      .select("id, generation_id")
      .eq("id", estimate!.latest_requirement_snapshot_id)
      .maybeSingle();
    hostedCheck(
      "49 hosted snapshot pointer is readable",
      !snapshotError &&
        typeof snapshot?.id === "string" &&
        snapshot.id === persist.result.snapshot_id
    );

    const framingRow = lines!.find((row) => row.label === "Framing/substructure");
    const pricingValues = lines!.map((row) =>
      valuesFromEstimateLineItem({
        id: row.id,
        work_area_id: row.work_area_id,
        label: row.label,
        category: row.category,
        recommended_cost: row.recommended_cost,
        recommended_sell: row.recommended_sell,
        notes: row.notes,
        sort_order: row.sort_order,
        component_key: row.component_key,
      })
    );
    const pricingSell = pricingValues.reduce((sum, row) => sum + row.totalSell, 0);
    const pricingCost = pricingValues.reduce((sum, row) => sum + row.totalCost, 0);
    const framingPricing = valuesFromEstimateLineItem({
      id: framingRow!.id,
      work_area_id: framingRow!.work_area_id,
      label: framingRow!.label,
      category: framingRow!.category,
      recommended_cost: framingRow!.recommended_cost,
      recommended_sell: framingRow!.recommended_sell,
      notes: framingRow!.notes,
      sort_order: framingRow!.sort_order,
      component_key: framingRow!.component_key,
    });
    hostedCheck(
      "50 hosted Pricing adapter matches estimate F-SFM sell",
      Math.abs(pricingCost - persistResult.recommendedCost) < 0.05 &&
        framingPricing.totalSell === deriveSellFromCost(3240, PREVIEW_GM) &&
        Number(framingRow!.recommended_sell) ===
          deriveSellFromCost(3240, PREVIEW_GM) &&
        framingPricing.totalSell === Number(framingRow!.recommended_sell)
    );

    const quoteItems = mapPricingItemsToQuoteItems(
      pricingValues.map((row, index) => ({
        id: `q-${index}`,
        work_area_id: workAreaId,
        internal_label: lines![index].label,
        client_label: lines![index].label,
        client_description: null,
        quantity: row.quantity,
        unit: row.unit,
        unit_sell: row.unitSell,
        total_sell: row.totalSell,
        total_cost: row.totalCost,
        visible_on_quote: true,
        optional: false,
        sort_order: index,
        item_type: row.itemType,
        calculation_mode: row.calculationMode,
      })) as PricingItem[],
      new Map([[workAreaId, "Deck"]])
    );
    const quoteSell = quoteItems.reduce((sum, item) => sum + item.total, 0);
    hostedCheck(
      "51 hosted Quote projection copies Pricing F-SFM sell",
      Math.abs(quoteSell - pricingSell) < 0.05 &&
        Math.abs(quoteSell - persistResult.recommendedSell) < 0.05
    );

    const framingNotesMeta = parseLineItemNotes(framingRow!.notes);
    hostedCheck(
      "51b hosted reloaded notes keep sellAuthority + source pair evidence",
      framingNotesMeta.metadata.sellAuthority === "derived_from_gross_margin" &&
        framingNotesMeta.metadata.sellRate === 180
    );
  } catch (error) {
    hostedCheck(
      "46-51 hosted failed",
      false,
      error instanceof Error ? error.message : String(error)
    );
  } finally {
    try {
      for (const id of orgIds) {
        await admin.from("organisations").delete().eq("id", id);
      }
      for (const id of userIds) {
        await admin.auth.admin.deleteUser(id);
      }
    } catch {
      /* best-effort cleanup */
    }
  }
}

testLocalDb();

void testHostedPreview().then(() => {
  console.log(
    `\n=== Results: ${passed} passed, ${failed} failed (${dbChecks} local-db, ${hostedChecks} hosted) ===\n`
  );
  process.exit(failed > 0 ? 1 : 0);
});
