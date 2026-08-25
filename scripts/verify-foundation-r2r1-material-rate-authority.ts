/**
 * FOUNDATION-R2-R1 — Material pricing unit + rate authority.
 *
 * Run: npx tsx scripts/verify-foundation-r2r1-material-rate-authority.ts
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import { calculateDemolition } from "../lib/estimate/calculators/demolition";
import { calculateExternalStairs } from "../lib/estimate/calculators/external-stairs";
import { calculateDeckingBoardLm } from "../lib/estimate/material-buildups";
import { resolveBuildUpMaterialPricing } from "../lib/estimate/material-rate-pricing";
import {
  getDeckBoardLmMaterialKey,
  MATERIAL_RATE_KEYS,
} from "../lib/estimate/material-rate-keys";
import { DECK_BENCHMARKS } from "../lib/estimate/benchmark-rates";
import { materialRateUnitsMatch } from "../lib/estimate/resolve-material-rate";
import { SPECIFIC_MATERIAL_RATE_CATALOGUE } from "../lib/rates/specific-material-catalogue";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`PASS  ${name}`);
    passed += 1;
  } else {
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
    failed += 1;
  }
}

function wa(id: string, type: string, name: string): EstimateWorkArea {
  return { id, type, name, sort_order: 1 };
}

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

const orgSettings = {
  allow_benchmark_rates: true,
  default_margin_percent: 20,
};

const baseContext = {
  project: { id: "p1", qualityLevel: "standard" },
  confirmedWorkAreas: [],
  facts: [],
  constraints: [],
  organisationSettings: orgSettings,
  materialWastageSettings: { decking: 10, default: 5 },
  rates: [],
} as unknown as EstimateContext;

const ownerArea = 16.12;
const ownerWidthMm = 140;
const ownerWaste = 10;
const physical = calculateDeckingBoardLm({
  areaM2: ownerArea,
  boardWidthMm: ownerWidthMm,
  wastagePercent: ownerWaste,
});

check(
  "1. physical decking lm is 126.65 for 16.12 m² × 140 mm × 10%",
  physical != null && physical.totalLm === 126.65,
  physical ? `got ${physical.totalLm}` : "null"
);
check(
  "1b. formula is round2(area/width) then waste, not a single 1.10 multiply",
  physical != null && physical.baseLm === 115.14 && physical.wastageLm === 11.51
);

const ownerDeck = calculateDeck(
  {
    ...baseContext,
    facts: [
      fact("deck.area_m2", "d1", ownerArea),
      fact("deck.board_material", "d1", "Hardwood"),
      fact("deck.board_width_mm", "d1", ownerWidthMm),
      fact("deck.height_m", "d1", 0.4),
    ],
  } as EstimateContext,
  wa("d1", "deck", "Deck")
);

const deckingLine = ownerDeck.lineItems.find((item) =>
  item.label.startsWith("Decking")
);

check("2. one decking materials line", deckingLine != null);
check("2b. priced unit is lm", deckingLine?.unit === "lm");
check(
  "2c. priced quantity is physical lm",
  deckingLine?.quantity === 126.65
);
check(
  "2d. rate unit matches priced unit",
  deckingLine != null &&
    materialRateUnitsMatch(deckingLine.unit ?? "", "lm")
);
check(
  "3. specific hardwood lm key",
  getDeckBoardLmMaterialKey("Hardwood") === MATERIAL_RATE_KEYS.deckingHardwoodLm
);
check(
  "3b. item key is hardwood lm",
  deckingLine?.itemKey === MATERIAL_RATE_KEYS.deckingHardwoodLm
);
check(
  "4. benchmark $/lm used with empty company rates",
  deckingLine?.costRate === DECK_BENCHMARKS.hardwoodLm.cost
);
check(
  "5. no second decking package line",
  ownerDeck.lineItems.filter((item) =>
    item.label.toLowerCase().includes("decking")
  ).length === 1
);
check(
  "5b. build-up marked priced when lm is the money quantity",
  deckingLine?.materialBuildUp?.priced === true
);

const expectedCost = Math.round(126.65 * DECK_BENCHMARKS.hardwoodLm.cost * 100) / 100;
check(
  "6. cost-first quantity × unit cost",
  deckingLine != null &&
    Math.abs((deckingLine.recommendedCost ?? 0) - expectedCost) < 0.02,
  deckingLine ? `cost ${deckingLine.recommendedCost}` : "missing line"
);

const companyDeck = calculateDeck(
  {
    ...baseContext,
    facts: [
      fact("deck.area_m2", "d1", ownerArea),
      fact("deck.board_material", "d1", "Hardwood"),
      fact("deck.board_width_mm", "d1", ownerWidthMm),
      fact("deck.height_m", "d1", 0.4),
    ],
    rates: [
      {
        item_key: MATERIAL_RATE_KEYS.deckingHardwoodLm,
        rate_type: "material",
        unit: "lm",
        cost_rate: 18.5,
        sell_rate: null,
        active: true,
      },
    ],
  } as never,
  wa("d1", "deck", "Deck")
);
const companyLine = companyDeck.lineItems.find((item) =>
  item.label.startsWith("Decking")
);
check(
  "3c. company exact $/lm wins",
  companyLine?.costRate === 18.5 && companyLine.quantity === 126.65
);
check(
  "7. no lm × m² mismatch on corrected path",
  companyLine?.unit === "lm" &&
    materialRateUnitsMatch(companyLine.unit, "lm")
);

check(
  "8. line metadata truthful (quantity-priced label)",
  deckingLine?.label === "Decking"
);
check(
  "9. rate provenance visible",
  (deckingLine?.materialRateResolution?.display ??
    deckingLine?.rateSource ??
    "")
    .toLowerCase()
    .includes("benchmark")
);

const noWidth = calculateDeck(
  {
    ...baseContext,
    facts: [
      fact("deck.area_m2", "d2", ownerArea),
      fact("deck.board_material", "d2", "Hardwood"),
      fact("deck.height_m", "d2", 0.4),
    ],
  } as EstimateContext,
  wa("d2", "deck", "Deck")
);
const packageLine = noWidth.lineItems.find(
  (item) => item.label === "Decking package"
);
check(
  "5c. m² package only when board width unknown",
  packageLine?.unit === "m²" && packageLine.quantity === ownerArea
);
check(
  "8b. unknown width does not fake lm takeoff",
  packageLine?.materialBuildUp == null
);

const fallback = resolveBuildUpMaterialPricing({
  context: {
    rates: [],
    organisationSettings: {
      allow_benchmark_rates: false,
      default_margin_percent: 20,
    },
    materialWastageSettings: null,
  } as never,
  materialKey: MATERIAL_RATE_KEYS.deckingHardwoodLm,
  label: "Hardwood decking",
  buildUpQuantity: 126.65,
  buildUpUnit: "lm",
  benchmarkCostRate: DECK_BENCHMARKS.hardwoodLm.cost,
  benchmarkSellRate: DECK_BENCHMARKS.hardwoodLm.sell,
  fallback: {
    materialKey: MATERIAL_RATE_KEYS.deckingHardwoodM2,
    quantity: ownerArea,
    unit: "m2",
    benchmarkCostRate: DECK_BENCHMARKS.hardwoodDecking.cost,
    benchmarkSellRate: DECK_BENCHMARKS.hardwoodDecking.sell,
  },
});
check(
  "5d. package fallback cannot double-count (either lm or m², not both)",
  fallback.usedBuildUpQuantity === false && fallback.unit === "m2"
);

const usedNow = SPECIFIC_MATERIAL_RATE_CATALOGUE.filter(
  (entry) => entry.calculatorSupport === "used_now"
).map((entry) => entry.item_key);
const planned = SPECIFIC_MATERIAL_RATE_CATALOGUE.filter(
  (entry) => entry.calculatorSupport === "planned"
).map((entry) => entry.item_key);

check(
  "10. decking lm rates marked used_now",
  [
    MATERIAL_RATE_KEYS.deckingHardwoodLm,
    MATERIAL_RATE_KEYS.deckingTreatedPineLm,
    MATERIAL_RATE_KEYS.deckingKwilaLm,
    MATERIAL_RATE_KEYS.deckingCompositeLm,
  ].every((key) => usedNow.includes(key))
);
check(
  "10b. unused sheet/paint-litre rates marked planned; timber backfill m³ is used_now",
  planned.includes("sheet.plasterboard.standard.each") &&
    planned.includes("paint.litre") &&
    usedNow.includes("retaining_wall.backfill.m3")
);

const deckSource = readFileSync("lib/estimate/calculators/deck.ts", "utf8");
const bathSource = readFileSync("lib/estimate/calculators/bathroom.ts", "utf8");
check(
  "11. requirement emission is Deck surface + labour shadow",
  deckSource.includes("maybeBuildDeckSurfaceRequirement") &&
    deckSource.includes("buildDeckLabourRequirement") &&
    !bathSource.includes("requirements:")
);

check(
  "12. no Project Condition regression in deck calculator",
  !deckSource.includes("deck.access") ||
    deckSource.includes("resolveLegacyWorkAreaAccess")
);

const demo = calculateDemolition(
  {
    ...baseContext,
    facts: [
      fact("demolition.area_m2", "demo1", 25),
      fact("demolition.scope_items", "demo1", ["General strip-out"]),
      fact("demolition.carting_distance_m", "demo1", 30),
    ],
    constraints: [{ key: "site_access", value: "Difficult" }],
  } as EstimateContext,
  wa("demo1", "demolition", "Demo")
);
const demoLabour = demo.lineItems.find(
  (item) => item.label === "Demolition/strip-out labour"
);
check(
  "13. DC-01 preserved (Difficult labour 9.63h once)",
  Math.abs((demoLabour?.labourHours ?? 0) - 9.63) < 0.02,
  `hours=${demoLabour?.labourHours}`
);

const stairs = calculateExternalStairs(
  {
    ...baseContext,
    facts: [
      fact("external_stairs.risers_count", "st1", 8),
      fact("external_stairs.width_m", "st1", 0.9),
      fact("external_stairs.material", "st1", "Treated timber"),
      fact("external_stairs.ground_condition", "st1", "Sloping"),
    ],
    constraints: [{ key: "site_access", value: "Difficult" }],
  } as EstimateContext,
  wa("st1", "external_stairs", "Stairs")
);
const stairLabour = stairs.lineItems.find((item) =>
  item.label.toLowerCase().includes("labour")
);
check(
  "13b. DC-02 preserved (15.18h, not × WA 1.1)",
  Math.abs((stairLabour?.labourHours ?? 0) - 15.18) < 0.05,
  `hours=${stairLabour?.labourHours}`
);

const migrations = existsSync("supabase/migrations")
  ? readdirSync("supabase/migrations")
  : [];
check(
  "14. no new migration in this batch",
  !migrations.some((name) => name.includes("r2r1") || name.includes("material_requirement"))
);

check(
  "15. commercial authority: no stacked package+lm for same boards",
  ownerDeck.lineItems.filter((item) => item.category === "materials").filter((item) =>
    item.label.toLowerCase().includes("decking")
  ).length === 1
);

const labourLine = ownerDeck.lineItems.find((item) => item.category === "labour");
check(
  "labour money uses hours × $/hr",
  labourLine != null &&
    labourLine.labourHours != null &&
    labourLine.costRate != null &&
    Math.abs(
      (labourLine.recommendedCost ?? 0) -
        labourLine.labourHours * labourLine.costRate
    ) < 0.05
);

console.log("");
console.log(`FOUNDATION-R2-R1: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
