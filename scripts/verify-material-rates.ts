import { resolveMaterialRate } from "../lib/estimate/resolve-material-rate";
import { resolveBuildUpMaterialPricing } from "../lib/estimate/material-rate-pricing";
import { MATERIAL_RATE_KEYS } from "../lib/estimate/material-rate-keys";
import {
  DECK_BENCHMARKS,
  FITOUT_BENCHMARKS,
  RETAINING_WALL_BENCHMARKS,
} from "../lib/estimate/benchmark-rates";

const orgSettings = {
  allow_benchmark_rates: true,
  default_margin_percent: 20,
} as const;

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`PASS: ${msg}`);
}

// Test 1 — Decking lm specific rate
const kwilaLmRate = {
  item_key: MATERIAL_RATE_KEYS.deckingKwilaLm,
  rate_type: "material" as const,
  unit: "lm",
  cost_rate: 8,
  sell_rate: 12,
  active: true,
};
const deckPricing = resolveBuildUpMaterialPricing({
  context: {
    rates: [kwilaLmRate],
    organisationSettings: orgSettings,
    materialWastageSettings: null,
  } as never,
  materialKey: MATERIAL_RATE_KEYS.deckingKwilaLm,
  label: "Kwila decking boards",
  buildUpQuantity: 550,
  buildUpUnit: "lm",
  benchmarkCostRate: DECK_BENCHMARKS.kwilaLm.cost,
  benchmarkSellRate: DECK_BENCHMARKS.kwilaLm.sell,
  fallback: {
    materialKey: MATERIAL_RATE_KEYS.deckingKwilaM2,
    quantity: 70,
    unit: "m2",
    benchmarkCostRate: DECK_BENCHMARKS.kwilaDecking.cost,
    benchmarkSellRate: DECK_BENCHMARKS.kwilaDecking.sell,
  },
});
assert(
  deckPricing.quantity === 550 && deckPricing.costRate === 8,
  "Deck lm: 550 × $8 company rate"
);
assert(
  deckPricing.resolution.source === "company_specific",
  "Deck lm source is company_specific"
);
assert(
  deckPricing.quantity * deckPricing.costRate === 4400,
  "Deck material cost = 4400"
);

// Test 2 — Decking fallback (no lm rate)
const deckFallback = resolveBuildUpMaterialPricing({
  context: {
    rates: [],
    organisationSettings: orgSettings,
    materialWastageSettings: null,
  } as never,
  materialKey: MATERIAL_RATE_KEYS.deckingKwilaLm,
  label: "Kwila decking boards",
  buildUpQuantity: 550,
  buildUpUnit: "lm",
  benchmarkCostRate: DECK_BENCHMARKS.kwilaLm.cost,
  benchmarkSellRate: DECK_BENCHMARKS.kwilaLm.sell,
  fallback: {
    materialKey: MATERIAL_RATE_KEYS.deckingKwilaM2,
    quantity: 70,
    unit: "m2",
    benchmarkCostRate: DECK_BENCHMARKS.kwilaDecking.cost,
    benchmarkSellRate: DECK_BENCHMARKS.kwilaDecking.sell,
  },
});
assert(
  deckFallback.quantity === 70 && deckFallback.unit === "m2",
  "Deck fallback uses m² quantity"
);
assert(!deckFallback.usedBuildUpQuantity, "Deck fallback does not use lm quantity");

// Test 3 — Plasterboard sheet rate
const sheetPricing = resolveBuildUpMaterialPricing({
  context: {
    rates: [
      {
        item_key: MATERIAL_RATE_KEYS.plasterboardStandardSheet,
        rate_type: "material" as const,
        unit: "each",
        cost_rate: 25,
        sell_rate: 35,
        active: true,
      },
    ],
    organisationSettings: orgSettings,
    materialWastageSettings: null,
  } as never,
  materialKey: MATERIAL_RATE_KEYS.plasterboardStandardSheet,
  label: "Plasterboard sheet",
  buildUpQuantity: 31,
  buildUpUnit: "each",
  benchmarkCostRate: FITOUT_BENCHMARKS.plasterboardSheet.cost,
  benchmarkSellRate: FITOUT_BENCHMARKS.plasterboardSheet.sell,
  fallback: {
    materialKey: "internal_walls.material.m2",
    quantity: 100,
    unit: "m2",
    benchmarkCostRate: FITOUT_BENCHMARKS.internalWallsPerM2.cost,
    benchmarkSellRate: FITOUT_BENCHMARKS.internalWallsPerM2.sell,
  },
});
assert(
  sheetPricing.quantity === 31 && sheetPricing.costRate === 25,
  "Sheet: 31 × $25"
);
assert(
  sheetPricing.quantity * sheetPricing.costRate === 775,
  "Sheet material cost = 775"
);

// Test 4 — Backfill m³
const backfillPricing = resolveBuildUpMaterialPricing({
  context: {
    rates: [
      {
        item_key: MATERIAL_RATE_KEYS.backfillM3,
        rate_type: "material",
        unit: "m3",
        cost_rate: 90,
        sell_rate: 110,
        active: true,
      },
    ],
    organisationSettings: orgSettings,
    materialWastageSettings: null,
  } as never,
  materialKey: MATERIAL_RATE_KEYS.backfillM3,
  label: "Backfill",
  buildUpQuantity: 3,
  buildUpUnit: "m3",
  benchmarkCostRate: RETAINING_WALL_BENCHMARKS.backfillPerM3.cost,
  benchmarkSellRate: RETAINING_WALL_BENCHMARKS.backfillPerM3.sell,
});
assert(
  backfillPricing.quantity * backfillPricing.costRate === 270,
  "Backfill cost = 270"
);

// Test 5 — Missing rate uses benchmark
const missing = resolveMaterialRate({
  orgRates: [],
  materialKey: MATERIAL_RATE_KEYS.deckingHardwoodLm,
  unit: "lm",
  label: "Hardwood decking",
  benchmarkCostRate: DECK_BENCHMARKS.hardwoodLm.cost,
  benchmarkSellRate: DECK_BENCHMARKS.hardwoodLm.sell,
  organisationSettings: orgSettings,
});
assert(
  missing.materialRateSource === "benchmark_specific",
  "Missing org rate uses benchmark"
);
assert(
  missing.rateResolutionDisplay.includes("Benchmark"),
  "Benchmark displayed in resolution text"
);

console.log("\nAll Sprint 3 material rate checks passed.");
