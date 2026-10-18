/**
 * Material catalogue gap: approved workbook amounts, held keys, and missing cost.
 * Does not declare the rates cycle complete.
 */
import { readFileSync } from "fs";
import { getCatalogueEntry } from "../lib/rates/catalogue";
import { APPROVED_MATERIAL_COSTS } from "../lib/rates/approved-material-costs";
import { resolveMaterialRate } from "../lib/estimate/resolve-material-rate";
import { resolveProductivity } from "../lib/estimate/productivity";
import { resolveDeckDeckingInstallProductivity } from "../lib/estimate/deck-productivity";
import { derivedDimensionedPlasterboardCost } from "../lib/estimate/ceilings-plasterboard-derived-cost";
import { aggregateEstimateLines } from "../lib/estimate/estimate-commercial-engine-adapter";
import { mapPricingItemsToQuoteItems } from "../lib/quotes/from-pricing";
import { calculateAuthoritativeDocumentTotals } from "../lib/pricing/authoritative-document-totals";
import {
  pricingDocumentViewModel,
  pricingItemViewModel,
} from "../lib/pricing/financial-view-model";
import {
  MARGIN_UNAVAILABLE_LABEL,
  PROFITABILITY_UNAVAILABLE_LABEL,
} from "../lib/financial-presentation/format";
import type { PricingDocument } from "../lib/pricing/types";
import {
  unknownCostWithoutClientSell,
  unknownMaterialCostQuoteBlock,
} from "../lib/work-areas/manual-pricing-route";
import type { PricingItem } from "../lib/pricing/types";

const manifest = JSON.parse(
  readFileSync("docs/benchmark-review/decision-manifest.json", "utf8")
) as {
  materials: Array<{
    workbookRow: number;
    key: string;
    unit: string;
    approvedValue: number | null;
  }>;
};

const numeric = manifest.materials.filter(
  (row) => typeof row.approvedValue === "number"
);
const byKey = new Map<string, (typeof numeric)[number]>();
for (const row of numeric) byKey.set(row.key, row);

let matched = 0;
let differed = 0;
let absent = 0;
const holds: string[] = [];
const mismatches: string[] = [];

for (const row of byKey.values()) {
  const entry = getCatalogueEntry(row.key);
  if (!entry) {
    absent += 1;
    holds.push(`${row.workbookRow} ${row.key} — no catalogue identity`);
    continue;
  }
  const cost = entry.defaultCostRate;
  if (cost == null) {
    absent += 1;
    holds.push(`${row.workbookRow} ${row.key} — catalogue row has no cost`);
    continue;
  }
  if (Math.abs(cost - (row.approvedValue as number)) > 0.001) {
    differed += 1;
    mismatches.push(
      `${row.key} catalogue ${cost} approved ${row.approvedValue}`
    );
  } else {
    matched += 1;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

assert(byKey.size === 257, `unique approved keys ${byKey.size}`);
assert(numeric.length === 258, `numeric rows ${numeric.length}`);
assert(differed === 0, `remaining dollar differences ${differed}: ${mismatches.join("; ")}`);
assert(holds.length === 0, `holds: ${holds.join(" | ")}`);
assert(matched === 257, `matched catalogue dollars ${matched}`);

const examples: Array<[string, string, number]> = [
  ["paint.litre", "l", 15.72],
  ["deck.material.kwila.lm", "lm", 9.77],
  ["plant.mini_excavator.day", "day", 270],
  ["sheet.plasterboard.aqualine.10mm.2400x1200.each", "each", 45.6],
  ["cornice.wall.scotia.mdf.lm", "lm", 4.35],
  ["painting.wall.m2", "m2", 4.93],
  ["sheet.fibre_cement.flooring.19mm.2700x600.each", "each", 113.13],
];
for (const [key, unit, amount] of examples) {
  const resolved = resolveMaterialRate({
    orgRates: [],
    materialKey: key,
    unit,
    benchmarkCostRate: 1,
    organisationSettings: { allow_benchmark_rates: true } as never,
  });
  assert(resolved.costRate === amount, `${key} resolved ${resolved.costRate}`);
  assert(
    resolved.materialRateSource === "benchmark_specific",
    `${key} source ${resolved.materialRateSource}`
  );
}

const company = resolveMaterialRate({
  orgRates: [
    {
      item_key: "paint.litre",
      rate_type: "material",
      unit: "l",
      cost_rate: 22,
      sell_rate: null,
      active: true,
    } as never,
  ],
  materialKey: "paint.litre",
  unit: "l",
  benchmarkCostRate: 15.72,
  organisationSettings: { allow_benchmark_rates: true } as never,
});
assert(company.costRate === 22, "company override must win");
assert(company.materialRateSource === "company_specific", "company source");

const missing = resolveMaterialRate({
  orgRates: [],
  materialKey: "sheet.fibre_cement.18mm.2400x1200.each",
  unit: "each",
  benchmarkCostRate: 0,
  organisationSettings: { allow_benchmark_rates: true } as never,
});
assert(missing.materialRateSource === "missing", "18 mm source");
assert(missing.costRate === 0, "18 mm placeholder");
assert(getCatalogueEntry("sheet.fibre_cement.18mm.2400x1200.each")?.defaultCostRate == null, "18 mm stays unpriced");

const sized = "sheet.plasterboard.aqualine.10mm.2700x1200.each";
const derived = derivedDimensionedPlasterboardCost(sized);
const catalogue = getCatalogueEntry(sized)?.defaultCostRate;
assert(catalogue === APPROVED_MATERIAL_COSTS[sized]?.amount, "sized sheet catalogue");
assert(
  derived == null || Math.abs(derived.derivedCost - (catalogue ?? 0)) > 0.01,
  "approved sheet cost is not the area-ratio derivation"
);

const aggregate = aggregateEstimateLines([
  {
    recommendedCost: 100,
    recommendedSell: 120,
    costLow: 100,
    costHigh: 100,
    sellLow: 120,
    sellHigh: 120,
    rateSourceType: "benchmark",
  },
  {
    recommendedCost: 0,
    recommendedSell: 0,
    costLow: 0,
    costHigh: 0,
    sellLow: 0,
    sellHigh: 0,
    rateSourceType: "missing",
  },
]);
assert(aggregate.recommendedCost === 100, `aggregate cost ${aggregate.recommendedCost}`);
assert(aggregate.recommendedSell === 120, `aggregate sell ${aggregate.recommendedSell}`);

function pricingLine(
  partial: Partial<PricingItem> & Pick<PricingItem, "id" | "total_sell" | "cost_known">
): PricingItem {
  return {
    visible_on_quote: true,
    total_cost: 0,
    sort_order: 1,
    client_label: partial.id,
    internal_label: partial.id,
    unit: "each",
    quantity: 1,
    ...partial,
  } as PricingItem;
}

const ordinary = pricingLine({
  id: "priced",
  cost_known: true,
  total_cost: 100,
  total_sell: 120,
  sort_order: 1,
  client_label: "Ordinary lining",
});
const caseA = pricingLine({
  id: "missing-unsold",
  cost_known: false,
  total_cost: 0,
  total_sell: 0,
  sort_order: 2,
  client_label: "18 mm fibre cement",
});
const caseB = pricingLine({
  id: "missing-sold",
  cost_known: false,
  total_cost: 0,
  total_sell: 80,
  sort_order: 3,
  client_label: "18 mm fibre cement",
});
const caseC = pricingLine({
  id: "excluded",
  cost_known: false,
  total_cost: 0,
  total_sell: 80,
  sort_order: 4,
  visible_on_quote: false,
  client_label: "Excluded sheet",
});

assert(unknownCostWithoutClientSell(caseA), "case A blocks");
assert(!unknownCostWithoutClientSell(caseB), "case B has a client sell");
assert(!unknownCostWithoutClientSell(caseC), "case C is not visible");
const replaced = pricingLine({
  id: "replaced",
  cost_known: false,
  total_cost: 0,
  total_sell: 0,
  visible_on_quote: true,
  recalibration_note: "Replaced for draft pricing by supplier response",
  client_label: "Replaced allowance",
});
assert(!unknownCostWithoutClientSell(replaced), "replaced line does not block");
assert(
  unknownMaterialCostQuoteBlock([ordinary, replaced]) == null,
  "replaced line does not block review"
);
assert(
  unknownMaterialCostQuoteBlock([ordinary, caseA]) != null,
  "case A blocks review"
);
assert(
  unknownMaterialCostQuoteBlock([ordinary, caseB]) == null,
  "case B does not block review"
);

const quoteA = mapPricingItemsToQuoteItems([ordinary, caseA], new Map(), new Map());
assert(
  quoteA.length === 1 && quoteA[0]?.pricing_item_id === "priced",
  "case A stays off the quote"
);
const quoteB = mapPricingItemsToQuoteItems(
  [ordinary, caseB, caseC],
  new Map(),
  new Map()
);
assert(quoteB.length === 2, `case B quote lines ${quoteB.length}`);
assert(quoteB[0]?.total === 120 && quoteB[1]?.total === 80, "case B keeps both sells once");
assert(
  quoteB.every((line) => line.pricing_item_id !== "excluded"),
  "case C stays off the quote"
);
const quoteReplaced = mapPricingItemsToQuoteItems(
  [ordinary, replaced],
  new Map(),
  new Map()
);
assert(
  quoteReplaced.length === 1 && quoteReplaced[0]?.pricing_item_id === "priced",
  "replaced line stays off the quote"
);

const document = calculateAuthoritativeDocumentTotals(
  [
    { total_cost: 100, total_sell: 120, cost_known: true },
    { total_cost: 0, total_sell: 80, cost_known: false },
  ],
  15,
  "missing-cost-case-b"
);
assert(document.ok, "document totals");
if (document.ok) {
  assert(document.totals.subtotalSell === 200, `document sell ${document.totals.subtotalSell}`);
  assert(document.totals.subtotalCost === 100, `document cost ${document.totals.subtotalCost}`);
  assert(document.totals.costKnown === false, "mixed document cost stays unknown");
  assert(
    document.totals.marginPercent !== 50 && document.totals.markupPercent !== 100,
    "mixed document does not compute margin from the known-cost portion"
  );
  assert(document.totals.gstAmount === 30, `gst ${document.totals.gstAmount}`);
  const mixedView = pricingDocumentViewModel(
    {
      subtotal_cost: document.totals.subtotalCost,
      subtotal_sell: document.totals.subtotalSell,
      gross_profit: document.totals.grossProfit,
      margin_percent: document.totals.marginPercent,
      markup_percent: document.totals.markupPercent,
      gst_rate: 15,
      gst_amount: document.totals.gstAmount,
      total_incl_gst: document.totals.totalInclGst,
    } as PricingDocument,
    [ordinary, caseB]
  );
  const soldUnknown = pricingItemViewModel(caseB);
  assert(mixedView.costKnown === false, "summary cost is incomplete");
  assert(mixedView.directCostLabel.startsWith("Known cost"), mixedView.directCostLabel);
  assert(mixedView.directCostLabel.includes("100.00"), mixedView.directCostLabel);
  assert(mixedView.profitLabel === PROFITABILITY_UNAVAILABLE_LABEL, mixedView.profitLabel);
  assert(mixedView.marginLabel === MARGIN_UNAVAILABLE_LABEL, mixedView.marginLabel);
  assert(soldUnknown.totalCostFormatted === "Cost unknown", soldUnknown.totalCostFormatted);
  assert(soldUnknown.marginLabel === MARGIN_UNAVAILABLE_LABEL, soldUnknown.marginLabel);
  assert(soldUnknown.totalSellFormatted.includes("80.00"), soldUnknown.totalSellFormatted);
}

const gib = resolveProductivity({
  productivityKey: "bathroom.lining.wall.install.hours_per_m2",
  unit: "m2",
  fallbackHoursPerUnit: 0.3,
});
const fibre = resolveProductivity({
  productivityKey: "bathroom.lining.wall.fibre_cement.hours_per_m2",
  unit: "m2",
  fallbackHoursPerUnit: 0,
});
assert(Math.abs(gib.hoursPerUnit - 0.5 / 2.88) < 1e-9, `GIB wall hours ${gib.hoursPerUnit}`);
assert(fibre.hoursPerUnit === 0.29, `fibre cement wall hours ${fibre.hoursPerUnit}`);
assert(fibre.sourceType === "benchmark", "fibre cement source");

const deckLmEntry = getCatalogueEntry("deck.decking.install.hours_per_lm");
const deckM2Entry = getCatalogueEntry("deck.decking.install.hours_per_m2");
assert(deckLmEntry?.defaultCostRate == null, "held lm rate is not the catalogue default");
assert(deckM2Entry?.defaultCostRate === 35 / 60, "effective decking rate is the m² factor");
const derivedLm = resolveDeckDeckingInstallProductivity([], 140);
assert(
  Math.abs(derivedLm.hoursPerUnit - (35 / 60) * 0.14) < 1e-9,
  `width-derived lm ${derivedLm.hoursPerUnit}`
);
const companyLm = resolveDeckDeckingInstallProductivity(
  [
    {
      item_key: "deck.decking.install.hours_per_lm",
      rate_type: "productivity",
      unit: "lm",
      cost_rate: 0.2,
      active: true,
    } as never,
  ],
  140
);
assert(companyLm.hoursPerUnit === 0.2, "company lm override wins");
assert(companyLm.sourceType === "user_rate", "company lm source");

if (process.exitCode) {
  console.error("material catalogue gap checks failed");
} else {
  console.log(
    JSON.stringify(
      {
        numericRows: numeric.length,
        uniqueKeys: byKey.size,
        catalogueMatched: matched,
        remainingDifferences: differed,
        held: holds,
      },
      null,
      2
    )
  );
}
