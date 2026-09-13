/**
 * EST-COMMERCIAL-01A — cost-first Quotr fallbacks (Deck + default labour).
 *
 * Run: npx --yes tsx scripts/verify-est-commercial-01a.ts
 *
 * No Production. No merge to main. No Fence/RW/Bathroom/Fitout package migration.
 */
import { readFileSync } from "node:fs";
import { deriveSellFromCost } from "../lib/commercial-engine/core/sell-from-margin";
import { DECK_BENCHMARKS } from "../lib/estimate/benchmark-rates";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import {
  DECK_FASCIA_LABOUR_FALLBACK_COST_PER_LM,
  DECK_FASCIA_MATERIAL_ITEM_KEY,
} from "../lib/estimate/deck-fascia";
import { DECK_FIXINGS_RESIDUAL_LABEL } from "../lib/estimate/deck-commercial-2b";
import { DECK_FASCIA_INSTALL_HOURS_PER_LM_KEY } from "../lib/estimate/deck-productivity";
import { applyTargetMarginToLineItems } from "../lib/estimate/margin-override";
import { MATERIAL_RATE_KEYS } from "../lib/estimate/material-rate-keys";
import { resolveLabourRate, resolveRate } from "../lib/estimate/rates";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "../lib/estimate/types";
import { calculateAuthoritativeFieldsFromEstimateLine } from "../lib/pricing/estimate-to-pricing-adapter";
import { mapPricingItemsToQuoteItems } from "../lib/quotes/from-pricing";
import type { OrganisationRate } from "../components/setup/types";
import type { PricingItem } from "../lib/pricing/types";
import { loadCalibrationFixture } from "./deck-calibration/run-deck-calibration";

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
  return readFileSync(rel, "utf8");
}

function wa(id: string): EstimateWorkArea {
  return { id, type: "deck", name: "Deck", sort_order: 1 };
}

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

function materialRate(
  itemKey: string,
  cost: number,
  sell: number | null,
  unit = "lm"
): OrganisationRate {
  return {
    id: itemKey,
    rate_type: "material",
    trade: null,
    work_area_type: "deck",
    item_key: itemKey,
    label: itemKey,
    unit,
    cost_rate: cost,
    sell_rate: sell,
    markup_percent: null,
    active: true,
  };
}

function labourRate(cost: number, sell: number | null): OrganisationRate {
  return {
    id: "labour.carpenter.hour",
    rate_type: "labour",
    trade: "carpenter",
    work_area_type: "deck",
    item_key: "labour.carpenter.hour",
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
  waste?: number;
}): EstimateContext {
  return {
    project: { id: "est-commercial-01a", qualityLevel: "standard" },
    confirmedWorkAreas: [wa(params.facts[0]?.work_area_id ?? "d1")],
    facts: params.facts,
    constraints: [],
    materialWastageSettings: {
      deckingWastagePercent: params.waste ?? 10,
      defaultMaterialWastagePercent: params.waste ?? 10,
    },
    rates: params.rates ?? [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: params.margin ?? 20,
      budget_rate_factor: 0.9,
      premium_rate_factor: 1.15,
    },
  } as unknown as EstimateContext;
}

function hardwoodFacts(id: string, extra: Record<string, unknown> = {}): EstimateFact[] {
  return [
    fact("deck.area_m2", id, 27),
    fact("deck.length_m", id, 3),
    fact("deck.width_m", id, 9),
    fact("deck.board_material", id, "Hardwood"),
    fact("deck.board_width_mm", id, 140),
    fact("deck.height_m", id, 0.14),
    fact("deck.substructure_included", id, true),
    ...Object.entries(extra).map(([key, value]) => fact(key, id, value)),
  ];
}

function line(
  items: readonly EstimateLineItemInput[],
  label: string
): EstimateLineItemInput | undefined {
  return items.find((item) => item.label === label);
}

function near(a: number, b: number, eps = 0.02): boolean {
  return Math.abs(a - b) < eps;
}

console.log("=== EST-COMMERCIAL-01A cost-first Quotr fallbacks ===\n");

const deckSrc = read("lib/estimate/calculators/deck.ts");
const ratesSrc = read("lib/estimate/rates.ts");
const pricingSrc = read("lib/estimate/deck-material-pricing.ts");

check(
  "source Deck calculator no longer passes Quotr fallbackSellRate",
  !deckSrc.includes("fallbackSellRate:")
);
check(
  "source Deck fascia/skirting no longer hardcode faceBoardLm.sell",
  !deckSrc.includes("faceBoardLm.sell") && !deckSrc.includes("* 55")
);
check(
  "source default labour no longer injects $90 sell",
  !ratesSrc.includes("DEFAULT_LABOUR_SELL_RATE") &&
    ratesSrc.includes("sellRate: null")
);
check(
  "source decking Quotr lm/m² fallbacks omit benchmarkSellRate",
  !pricingSrc.includes("benchmarkSellRate:")
);
check(
  "source engine F-SFM files untouched by this phase intent",
  read("lib/commercial-engine/core/sell-from-margin.ts").includes(
    "sell = round2(cost / (1 - m/100))"
  ) &&
    read("lib/commercial-engine/core/cost-first-authority.ts").includes(
      "legacy_paired_rate"
    ) &&
    read("lib/estimate/margin-override.ts").includes("applyTargetMarginToLineItems")
);

const gm20 = (cost: number) => deriveSellFromCost(cost, 20);
const gm10 = (cost: number) => deriveSellFromCost(cost, 10);
const gm15 = (cost: number) => deriveSellFromCost(cost, 15);

check("A formula hardwood 22 @20% → 27.50", gm20(22) === 27.5);
check("B formula hardwood 22 @10% → 24.44", gm10(22) === 24.44);
check("C formula hardwood 22 @15% → 25.88", gm15(22) === 25.88);

const hardwood20 = calculateDeck(ctx({ facts: hardwoodFacts("d1"), margin: 20 }), wa("d1"));
const decking20 = line(hardwood20.lineItems, "Decking");
check(
  "A hardwood Quotr fallback cost 22 sell 27.50 not 34",
  decking20?.costRate === 22 &&
    near(decking20.sellRate ?? 0, 27.5) &&
    decking20.sellAuthority === "derived_from_gross_margin" &&
    decking20.rateSourceType === "benchmark" &&
    !near(decking20.sellRate ?? 0, 34)
);

const hardwood10 = calculateDeck(ctx({ facts: hardwoodFacts("d1"), margin: 10 }), wa("d1"));
const decking10 = line(hardwood10.lineItems, "Decking");
check(
  "B hardwood Quotr fallback cost 22 sell 24.44 at 10% GM",
  decking10?.costRate === 22 &&
    near(decking10.sellRate ?? 0, 24.44) &&
    decking10.sellAuthority === "derived_from_gross_margin"
);

const afterTarget = applyTargetMarginToLineItems(
  hardwood20.lineItems,
  15,
  ctx({ facts: hardwoodFacts("d1") }).organisationSettings
);
const decking15 = line(afterTarget, "Decking");
check(
  "C project target 15% rewrites hardwood from cost 22 → 25.88",
  near(decking15?.recommendedCost ?? 0, decking20?.recommendedCost ?? -1) &&
    near(decking15?.recommendedSell ?? 0, gm15(decking20?.recommendedCost ?? 0)) &&
    decking15?.sellAuthority === "derived_from_gross_margin"
);

function speciesDecking(material: string, expectedCost: number) {
  const result = calculateDeck(
    ctx({
      facts: hardwoodFacts("d1").map((row) =>
        row.key === "deck.board_material"
          ? fact("deck.board_material", "d1", material)
          : row
      ),
    }),
    wa("d1")
  );
  const item = line(result.lineItems, "Decking");
  return (
    item?.costRate === expectedCost &&
    near(item.sellRate ?? 0, gm20(expectedCost)) &&
    item.sellAuthority === "derived_from_gross_margin"
  );
}

check("D pine Quotr cost-first 14 → 17.50", speciesDecking("Treated pine", 14));
check("D kwila Quotr cost-first 28 → 35.00", speciesDecking("Kwila", 28));
check("D composite Quotr cost-first 24 → 30.00", speciesDecking("Composite", 24));

const fasciaFacts = hardwoodFacts("d1", {
  "deck.vertical_face_boards_required": true,
});
const fasciaQuotr = calculateDeck(ctx({ facts: fasciaFacts }), wa("d1"));
const fasciaLine = line(fasciaQuotr.lineItems, "Fascia / edge boards");
check(
  "E fascia Quotr cost 22 + 20% GM, no hardcoded 35 sell",
  fasciaLine?.itemKey === DECK_FASCIA_MATERIAL_ITEM_KEY &&
    fasciaLine.costRate === 22 &&
    near(fasciaLine.sellRate ?? 0, 27.5) &&
    fasciaLine.sellAuthority === "derived_from_gross_margin" &&
    fasciaLine.rateSourceType === "benchmark" &&
    !near(fasciaLine.sellRate ?? 0, 35)
);

const fasciaCompany = calculateDeck(
  ctx({
    facts: fasciaFacts,
    rates: [materialRate(DECK_FASCIA_MATERIAL_ITEM_KEY, 18, null)],
  }),
  wa("d1")
);
const fasciaCompanyLine = line(fasciaCompany.lineItems, "Fascia / edge boards");
check(
  "E company fascia cost-only wins 18 → 22.50",
  fasciaCompanyLine?.rateSourceType === "user_rate" &&
    fasciaCompanyLine.costRate === 18 &&
    near(fasciaCompanyLine.sellRate ?? 0, gm20(18)) &&
    fasciaCompanyLine.sellAuthority === "derived_from_gross_margin"
);

const fasciaLabourFallback = calculateDeck(
  ctx({
    facts: fasciaFacts,
    rates: [
      {
        id: DECK_FASCIA_INSTALL_HOURS_PER_LM_KEY,
        rate_type: "productivity",
        trade: null,
        work_area_type: "deck",
        item_key: DECK_FASCIA_INSTALL_HOURS_PER_LM_KEY,
        label: "Fascia hours",
        unit: "lm",
        cost_rate: 0,
        sell_rate: null,
        markup_percent: null,
        active: true,
      },
    ],
  }),
  wa("d1")
);
const fasciaLabour = line(fasciaLabourFallback.lineItems, "Fascia labour allowance");
const fasciaBoardsForLabour = line(
  fasciaLabourFallback.lineItems,
  "Fascia / edge boards"
);
const fasciaRequiredLm =
  fasciaBoardsForLabour != null
    ? fasciaBoardsForLabour.quantity / 1.1
    : 0;
check(
  "F fascia labour fallback is net lm × $35 cost + GM, no $55 sell",
  fasciaLabour != null &&
    fasciaRequiredLm > 0 &&
    near(
      fasciaLabour.recommendedCost,
      fasciaRequiredLm * DECK_FASCIA_LABOUR_FALLBACK_COST_PER_LM
    ) &&
    near(fasciaLabour.recommendedSell, gm20(fasciaLabour.recommendedCost)) &&
    fasciaLabour.sellAuthority === "derived_from_gross_margin"
);

const fixings20 = line(hardwood20.lineItems, DECK_FIXINGS_RESIDUAL_LABEL);
check(
  "G fixings 27m² cost 675 sell 843.75 not 1080",
  fixings20?.costRate === 25 &&
    near(fixings20.recommendedCost, 675) &&
    near(fixings20.recommendedSell, 843.75) &&
    fixings20.sellAuthority === "derived_from_gross_margin" &&
    !near(fixings20.recommendedSell, 1080)
);

const labour20 = resolveLabourRate({
  rates: [],
  organisationSettings: { default_margin_percent: 20 } as never,
});
const labour10 = resolveLabourRate({
  rates: [],
  organisationSettings: { default_margin_percent: 10 } as never,
});
check(
  "H default labour 60 @20% → 75 not 90",
  labour20.costRate === 60 &&
    labour20.sellRate === 75 &&
    labour20.sellAuthority === "derived_from_gross_margin"
);
check(
  "H default labour 60 @10% → 66.67",
  labour10.costRate === 60 && near(labour10.sellRate, 66.67)
);

const companyPair = calculateDeck(
  ctx({
    facts: hardwoodFacts("d1"),
    rates: [materialRate(MATERIAL_RATE_KEYS.deckingHardwoodLm, 22, 40)],
  }),
  wa("d1")
);
const companyPairLine = line(companyPair.lineItems, "Decking");
check(
  "I company explicit pair 22/40 is preserved",
  companyPairLine?.rateSourceType === "user_rate" &&
    companyPairLine.costRate === 22 &&
    companyPairLine.sellRate === 40 &&
    companyPairLine.sellAuthority === "legacy_paired_rate"
);

const companyLabourPair = resolveLabourRate({
  rates: [labourRate(60, 90)],
  organisationSettings: { default_margin_percent: 20 } as never,
});
check(
  "I company labour pair 60/90 is preserved",
  companyLabourPair.costRate === 60 &&
    companyLabourPair.sellRate === 90 &&
    companyLabourPair.sellAuthority === "legacy_paired_rate"
);

const rewrittenPair = applyTargetMarginToLineItems(
  companyPair.lineItems,
  15,
  ctx({ facts: hardwoodFacts("d1") }).organisationSettings
);
const rewrittenDecking = line(rewrittenPair, "Decking");
check(
  "J project target rewrites company pair from cost (replace, not stack)",
  near(rewrittenDecking?.recommendedCost ?? 0, companyPairLine?.recommendedCost ?? -1) &&
    near(
      rewrittenDecking?.recommendedSell ?? 0,
      gm15(companyPairLine?.recommendedCost ?? 0)
    ) &&
    rewrittenDecking?.sellAuthority === "derived_from_gross_margin"
);

const waste0 = calculateDeck(
  ctx({ facts: hardwoodFacts("d1"), waste: 0 }),
  wa("d1")
);
const decking0 = line(waste0.lineItems, "Decking");
check(
  "K waste increases qty/cost only; GM stays 20%",
  (decking0?.quantity ?? 0) < (decking20?.quantity ?? 0) &&
    (decking0?.recommendedCost ?? 0) < (decking20?.recommendedCost ?? 0) &&
    near(decking0?.marginPercent ?? 0, 20, 0.15) &&
    near(decking20?.marginPercent ?? 0, 20, 0.15) &&
    decking0?.costRate === decking20?.costRate
);

const pricingFromEstimate = calculateAuthoritativeFieldsFromEstimateLine({
  id: "line-decking",
  category: "materials",
  recommended_cost: decking20?.recommendedCost ?? 0,
  recommended_sell: decking20?.recommendedSell ?? 0,
  notes: null,
});
check(
  "L Pricing copies estimate sell (no second margin)",
  pricingFromEstimate.ok &&
    near(pricingFromEstimate.fields.totalCost, decking20?.recommendedCost ?? -1) &&
    near(pricingFromEstimate.fields.totalSell, decking20?.recommendedSell ?? -1)
);

const pricingItem = {
  id: "p1",
  work_area_id: "d1",
  internal_label: "Decking",
  client_label: "Decking",
  client_description: null,
  item_type: "material",
  quantity: decking20?.quantity ?? 1,
  unit: "lm",
  unit_cost: decking20?.costRate ?? 0,
  unit_sell: decking20?.sellRate ?? 0,
  total_cost: decking20?.recommendedCost ?? 0,
  total_sell: decking20?.recommendedSell ?? 0,
  optional: false,
  visible_on_quote: true,
  sort_order: 1,
} as PricingItem;
const quoteItems = mapPricingItemsToQuoteItems(
  [pricingItem],
  new Map([["d1", "Deck"]])
);
check(
  "L Quote copies Pricing sell; GST not applied on the line",
  near(quoteItems[0]?.total ?? 0, decking20?.recommendedSell ?? -1)
);

const joists = line(hardwood20.lineItems, "Joists");
check(
  "M structural joists remain cost-first derived_from_gross_margin",
  joists != null &&
    joists.sellAuthority === "derived_from_gross_margin" &&
    (joists.recommendedCost ?? 0) > 0
);

const realJob = loadCalibrationFixture("REAL-JOB-01.json");
const realFacts = Object.entries(realJob.facts).map(([key, value]) =>
  fact(key, "wa-deck-1", value)
);
const realJobEstimate = calculateEstimate({
  project: { id: "real-job-01", qualityLevel: "standard" },
  confirmedWorkAreas: [wa("wa-deck-1")],
  facts: realFacts,
  constraints: [],
  materialWastageSettings: {
    deckingWastagePercent: 10,
    defaultMaterialWastagePercent: 10,
  },
  rates: [],
  organisationSettings: {
    allow_benchmark_rates: true,
    default_margin_percent: 20,
    budget_rate_factor: 0.9,
    premium_rate_factor: 1.15,
  },
} as unknown as EstimateContext);

check(
  "N REAL-JOB-01 cost fingerprint stays $8,620.53",
  near(realJobEstimate.recommendedCost, 8620.53)
);
check(
  "N REAL-JOB-01 sell is ~20% GM ($10,775.44), not paired $12,878.01",
  near(realJobEstimate.recommendedSell, 10775.44) &&
    near(realJobEstimate.marginPercent, 20, 0.05) &&
    !near(realJobEstimate.recommendedSell, 12878.01)
);

const framingResolved = resolveRate({
  rates: [],
  rateType: "material",
  itemKey: "deck.substructure.m2",
  workAreaType: "deck",
  unit: "m2",
  fallbackCostRate: DECK_BENCHMARKS.framing.cost,
  organisationSettings: { default_margin_percent: 20 } as never,
});
check(
  "other Deck package framing Quotr cost 120 sell 150 not 180",
  framingResolved.costRate === 120 &&
    framingResolved.sellRate === 150 &&
    framingResolved.sellAuthority === "derived_from_gross_margin"
);

const resolverStillPairsWhenTold = resolveRate({
  rates: [],
  rateType: "material",
  itemKey: "deck.fixings.m2",
  workAreaType: "deck",
  unit: "m2",
  fallbackCostRate: DECK_BENCHMARKS.fixings.cost,
  fallbackSellRate: DECK_BENCHMARKS.fixings.sell,
  organisationSettings: { default_margin_percent: 20 } as never,
});
check(
  "resolver still preserves an explicit fallback pair (01B Fence/RW API)",
  resolverStillPairsWhenTold.sellAuthority === "legacy_paired_rate" &&
    resolverStillPairsWhenTold.sellRate === 40
);

check(
  "fascia identity key is company-overridable",
  DECK_FASCIA_MATERIAL_ITEM_KEY === "deck.fascia.lm" &&
    read("lib/rates/specific-material-catalogue.ts").includes(
      "DECK_FASCIA_MATERIAL_ITEM_KEY"
    )
);

if (failed > 0) {
  console.log(`\nEST-COMMERCIAL-01A FAILED ${failed}/${passed + failed}`);
  process.exit(1);
}

console.log(`\nEST-COMMERCIAL-01A PASSED ${passed}/${passed}`);
