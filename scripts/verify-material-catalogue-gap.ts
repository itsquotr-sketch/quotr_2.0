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

const quote = mapPricingItemsToQuoteItems(
  [
    {
      id: "priced",
      visible_on_quote: true,
      cost_known: true,
      total_cost: 100,
      total_sell: 120,
      sort_order: 1,
      client_label: "Priced",
      internal_label: "Priced",
      unit: "each",
      quantity: 1,
    } as PricingItem,
    {
      id: "missing",
      visible_on_quote: true,
      cost_known: false,
      total_cost: 0,
      total_sell: 0,
      sort_order: 2,
      client_label: "Unpriced",
      internal_label: "Unpriced",
      unit: "each",
      quantity: 1,
    } as PricingItem,
  ],
  new Map(),
  new Map()
);
assert(quote.length === 1 && quote[0]?.pricing_item_id === "priced", "quote omits unknown cost");

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
