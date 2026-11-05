/**
 * Unstated kitchen area must not become 10 m² or a priced package.
 * Run: npx tsx scripts/verify-kitchen-unstated-area.ts
 *
 * Brief: "Replace the kitchen." No area, cabinetry, benchtop, splashback,
 * rangehood, flooring, or demolition.
 */
import { KITCHEN_BENCHMARKS } from "../lib/estimate/benchmark-rates";
import { calculateKitchen } from "../lib/estimate/calculators/kitchen";
import { SCOPE_CATALOGUE } from "../lib/scopes/catalogue";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";
import { buildWorkAreaQuoteDescriptionDraft } from "../lib/work-areas/quote-description";

const workArea = {
  id: "k1",
  type: "kitchen",
  name: "Kitchen",
  sort_order: 1,
  status: "confirmed",
} as EstimateWorkArea;

function context(facts: EstimateFact[]): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [workArea],
    facts,
    constraints: [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
      budget_rate_factor: 0.9,
    },
    materialWastageSettings: {
      deckingWastagePercent: 10,
      defaultMaterialWastagePercent: 10,
    },
    rates: [],
  } as unknown as EstimateContext;
}

let failed = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) failed += 1;
}

const unstated = calculateKitchen(context([]), workArea);
const unstatedQuote = buildWorkAreaQuoteDescriptionDraft({
  type: "kitchen",
  name: "Kitchen",
  facts: [],
});
const catalogue = SCOPE_CATALOGUE.find((item) => item.type === "kitchen");

check(
  "unstated brief has no priced line",
  unstated.lineItems.length === 0
);
check(
  "unstated brief does not invent 10 m²",
  !unstated.lineItems.some((item) => item.quantity === 10) &&
    !unstated.assumptions.some((row) => /10 m²/.test(row))
);
check(
  "kitchen area stays unresolved",
  unstated.missingInfo.includes("Kitchen area not confirmed")
);
check(
  "client draft does not name unstated cabinetry, benchtop, or appliances",
  !/cabinetry|benchtop|appliance/i.test(unstatedQuote)
);
check(
  "catalogue does not promise cabinetry and trade allowances",
  catalogue?.description ===
    "Kitchen renovation. A stated area and a stated component can be priced. Unstated area, cabinetry, and trade work stay unresolved."
);

const stated = calculateKitchen(
  context([{ key: "kitchen.area_m2", work_area_id: "k1", value: 12 }]),
  workArea
);
const labour = stated.lineItems.find((item) => item.label === "Kitchen labour");
const materials = stated.lineItems.find(
  (item) => item.label === "Kitchen materials/finishes allowance"
);
check(
  "stated 12 m² still prices labour at 12 m²",
  labour?.quantity === 12 && labour.recommendedCost === 11520 && labour.recommendedSell === 14400
);
check(
  "stated 12 m² still uses the existing minimum package",
  materials?.recommendedCost === KITCHEN_BENCHMARKS.minimumPackage.cost &&
    materials.recommendedSell === KITCHEN_BENCHMARKS.minimumPackage.sell
);
check(
  "benchmark dollar values are unchanged",
  KITCHEN_BENCHMARKS.materialsPerM2.cost === 1500 &&
    KITCHEN_BENCHMARKS.materialsPerM2.sell === 2300 &&
    KITCHEN_BENCHMARKS.minimumPackage.cost === 20000 &&
    KITCHEN_BENCHMARKS.minimumPackage.sell === 30000
);

const named = buildWorkAreaQuoteDescriptionDraft({
  type: "kitchen",
  name: "Kitchen",
  facts: [
    { key: "kitchen.cabinetry_included", value: "true" },
    { key: "kitchen.benchtop_included", value: "true" },
  ],
});
check(
  "stated cabinetry and benchtop stay in the client draft",
  /Cabinetry is included where applicable/.test(named) &&
    /Benchtop is included where applicable/.test(named)
);

if (failed > 0) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("kitchen unstated area passed");
