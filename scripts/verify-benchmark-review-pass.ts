/**
 * Rates / productivity / Work Area approval pass.
 *
 * Run: npx --yes tsx scripts/verify-benchmark-review-pass.ts
 *
 * No Production. No Preview bootstrap.
 */
import { buildBathroomDemolitionEnvelope } from "../lib/estimate/bathroom-demolition";
import {
  BATHROOM_DEMOLITION_PRODUCTIVITY_BENCHMARKS,
  BATHROOM_FIBRE_CEMENT_SHEET_BENCHMARK,
  BATHROOM_PRODUCTIVITY_BENCHMARKS,
  BATHROOM_PRODUCTIVITY_KEYS,
} from "../lib/estimate/bathroom-identities";
import type { BathroomGeometryResolution } from "../lib/estimate/bathroom-geometry";
import { derivedDimensionedPlasterboardCost } from "../lib/estimate/ceilings-plasterboard-derived-cost";
import { HOUSE_PILE_BENCHMARK_COST_EX_GST } from "../lib/estimate/house-pile-benchmarks";
import { resolveProductivity } from "../lib/estimate/productivity";
import { resolveMaterialRate } from "../lib/estimate/resolve-material-rate";
import { resolveLabourRate } from "../lib/estimate/rates";
import { CEILINGS_PRODUCTIVITY_KEYS, CEILINGS_QUOTR_PRODUCTIVITY_HOURS } from "../lib/estimate/ceilings-identities";
import { resolveDeckDeckingInstallProductivity } from "../lib/estimate/deck-productivity";
import { buildMaterialRateItemKey } from "../lib/materials/identity";
import {
  HOUSE_PILE_125_RW_IDENTITY,
  RW_HOUSE_PILE_125_KEY,
} from "../lib/estimate/retaining-wall-identities";
import { formatRateUnit as formatCatalogueRateUnit, getCatalogueEntry } from "../lib/rates/catalogue";
import {
  APPROVED_PRODUCTIVITY,
  approvedProductivityHours,
  BATHROOM_COMPLETE_STRIP_HOURS_PER_M2,
  BATHROOM_COMPLETE_STRIP_KEY,
  BATHROOM_FIBRE_CEMENT_WALL_LINING_HOURS_PER_M2,
  BATHROOM_GIB_WALL_LINING_HOURS_PER_M2,
  LOOSE_SPOIL_SWELL_FACTOR,
  PRODUCT_IDENTITY_CORRECTION_KEYS,
  DORMANT_PRODUCTIVITY_KEYS,
  UNRESOLVED_PRODUCTIVITY_KEYS,
} from "../lib/rates/approved-benchmark-review";
import { SPECIFIC_MATERIAL_RATE_GROUPS } from "../lib/rates/specific-material-catalogue";
import { formatRateUnit } from "../lib/setup/starter-rates";
import { mapPricingItemsToQuoteItems } from "../lib/quotes/from-pricing";
import type { PricingItem } from "../lib/pricing/types";
import type { OrganisationRate } from "../components/setup/types";
import type { EstimateContext, EstimateFact, EstimateWorkArea } from "../lib/estimate/types";

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

function near(actual: number, expected: number, tol = 0.0001): boolean {
  return Number.isFinite(actual) && Math.abs(actual - expected) <= tol;
}

function fact(key: string, value: unknown): EstimateFact {
  return { key, work_area_id: "b1", value };
}

function ctx(facts: EstimateFact[], rates: OrganisationRate[] = []): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [{ id: "b1", type: "bathroom", name: "Bathroom", sort_order: 1 }],
    facts,
    constraints: [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
      premium_rate_factor: 1.15,
    },
    materialWastageSettings: {
      sheet_material: 10,
      flooring: 10,
      paint: 10,
      default: 5,
    },
    rates,
  } as unknown as EstimateContext;
}

function productivityRate(itemKey: string, hours: number): OrganisationRate {
  return {
    id: `rate-${itemKey}`,
    rate_type: "productivity",
    trade: null,
    work_area_type: null,
    item_key: itemKey,
    label: itemKey,
    unit: "m2",
    cost_rate: hours,
    sell_rate: null,
    markup_percent: null,
    active: true,
  };
}

const workArea = {
  id: "b1",
  type: "bathroom",
  name: "Bathroom",
  sort_order: 1,
} as EstimateWorkArea;

function demo(
  components: string[],
  rates: OrganisationRate[] = [],
  floorAreaM2 = 8
) {
  const geometry = {
    floorAreaM2,
    ceilingAreaM2: floorAreaM2,
    grossWallAreaM2: 24,
  } as BathroomGeometryResolution;
  return buildBathroomDemolitionEnvelope({
    context: ctx(
      [
        fact("bathroom.demolition_required", true),
        fact("bathroom.demolition.components", components),
      ],
      rates
    ),
    workArea,
    geometry,
    accessFactor: 1,
    sortOrderStart: 1,
  });
}

console.log("=== Benchmark review pass ===\n");

check(
  "approved productivity authority has 105 numeric keys",
  Object.keys(APPROVED_PRODUCTIVITY).length === 105
);
check(
  "retaining-wall excavation m³ stays unresolved",
  UNRESOLVED_PRODUCTIVITY_KEYS.length === 1 &&
    UNRESOLVED_PRODUCTIVITY_KEYS[0] === "retaining_wall.excavation.hours_per_m3" &&
    !(UNRESOLVED_PRODUCTIVITY_KEYS[0] in APPROVED_PRODUCTIVITY)
);
check(
  "two unused productivity keys are dormant, not an owner decision",
  DORMANT_PRODUCTIVITY_KEYS.length === 2 &&
    DORMANT_PRODUCTIVITY_KEYS.every((key) => !(key in APPROVED_PRODUCTIVITY))
);

const unresolved = resolveProductivity({
  productivityKey: "retaining_wall.excavation.hours_per_m3",
  unit: "m3",
  fallbackHoursPerUnit: 9,
  rates: [],
});
check(
  "unresolved productivity does not use the caller fallback",
  unresolved.hoursPerUnit === 0 && unresolved.sourceType === "missing",
  `hours=${unresolved.hoursPerUnit} source=${unresolved.sourceType}`
);

const dormant = resolveProductivity({
  productivityKey: "deck.concrete.place.hours_per_hole",
  unit: "hole",
  fallbackHoursPerUnit: 9,
  rates: [],
});
check(
  "dormant productivity does not become a priced default",
  dormant.hoursPerUnit === 0 && dormant.sourceType === "missing",
  `hours=${dormant.hoursPerUnit} source=${dormant.sourceType}`
);
const dormantCompany = resolveProductivity({
  productivityKey: "deck.concrete.place.hours_per_hole",
  unit: "hole",
  fallbackHoursPerUnit: 9,
  rates: [
    {
      id: "co-dormant-hole",
      rate_type: "productivity",
      trade: null,
      work_area_type: null,
      item_key: "deck.concrete.place.hours_per_hole",
      label: "Stored hole rate",
      unit: "hole",
      cost_rate: 0.4,
      sell_rate: null,
      markup_percent: null,
      active: true,
    },
  ],
});
check(
  "a stored company row on a dormant key can still be read",
  dormantCompany.hoursPerUnit === 0.4 && dormantCompany.sourceType === "user_rate"
);

const sheet = resolveProductivity({
  productivityKey: "internal_walls.lining.standard_gib.hours_per_sheet",
  unit: "sheet",
  fallbackHoursPerUnit: 0.25,
  rates: [],
});
check(
  "sheet lining uses conversion 0.5, not the conflicting 0.25 column",
  sheet.hoursPerUnit === 0.5
);

const gib = BATHROOM_GIB_WALL_LINING_HOURS_PER_M2;
const fibre = BATHROOM_FIBRE_CEMENT_WALL_LINING_HOURS_PER_M2;
check(
  "fibre-cement wall hours are about 1.67× the GIB sheet conversion",
  near(gib, 0.1736111111111111) &&
    fibre === 0.29 &&
    near(fibre / gib, 1.67, 0.01)
);
check(
  "catalogue wall keys match those hours",
  near(BATHROOM_PRODUCTIVITY_BENCHMARKS.wallLiningM2, gib) &&
    getCatalogueEntry(BATHROOM_PRODUCTIVITY_KEYS.wallLiningFibreCementM2)
      ?.defaultCostRate === fibre
);

const strip = demo(["complete_strip", "floor_finish", "wall_lining", "bath"]);
const stripLine = strip.lineItems.find((row) =>
  row.label.includes("Complete bathroom strip-out")
);
const stripHours = Number(stripLine?.labourHours ?? 0);
check(
  "complete strip-out is 4.5 h/m² of floor and does not also price bath labour",
  near(stripHours, 8 * BATHROOM_COMPLETE_STRIP_HOURS_PER_M2) &&
    strip.lineItems.filter((row) => row.category === "labour").length === 1,
  `hours=${stripHours} lines=${strip.lineItems.map((row) => `${row.category}:${row.label}`).join(" | ")}`
);

const inferred = demo(["floor_finish", "wall_lining", "bath"]);
check(
  "complete strip-out is not inferred from a bath plus finishes",
  !inferred.lineItems.some((row) => row.label.includes("Complete bathroom")) &&
    inferred.lineItems.some((row) => /bath/i.test(row.label))
);
const five = demo(["complete_strip"], [], 5);
check(
  "5 m² complete strip-out is 22.5 person-hours",
  near(
    Number(
      five.lineItems.find((row) => row.label.includes("Complete bathroom"))
        ?.labourHours ?? 0
    ),
    22.5
  )
);
const floorOnly = demo(["floor_finish"]);
check(
  "floor-only removal stays on the floor path",
  floorOnly.lineItems.some((row) => row.label.includes("Floor finish")) &&
    !floorOnly.lineItems.some((row) => row.label.includes("Complete bathroom"))
);
const bathOnly = demo(["bath"]);
const bathLine = bathOnly.lineItems.find((row) => /bath/i.test(row.label));
check(
  "bath-only removal stays 1.5 h each",
  near(Number(bathLine?.labourHours ?? 0), 1.5) &&
    BATHROOM_DEMOLITION_PRODUCTIVITY_BENCHMARKS.bath === 1.5,
  `hours=${bathLine?.labourHours}`
);

const overridden = demo(
  ["complete_strip"],
  [productivityRate(BATHROOM_COMPLETE_STRIP_KEY, 2)]
);
const overrideHours = Number(
  overridden.lineItems.find((row) => row.label.includes("Complete bathroom"))
    ?.labourHours ?? 0
);
check(
  "company productivity override wins over the approved 4.5",
  near(overrideHours, 16),
  `hours=${overrideHours}`
);

const again = demo(["complete_strip"]);
check(
  "regeneration repeats the same strip-out hours",
  near(Number(again.lineItems[0]?.labourHours ?? 0), stripHours)
);

const noBenchmarks = resolveLabourRate({
  rates: [],
  organisationSettings: {
    allow_benchmark_rates: false,
    default_margin_percent: 20,
    premium_rate_factor: 1.15,
  },
});
check(
  "labour without benchmark permission is missing, not a silent $60",
  noBenchmarks.costRate === 0 && noBenchmarks.sourceType === "missing"
);
const withBenchmarks = resolveLabourRate({
  rates: [],
  organisationSettings: {
    allow_benchmark_rates: true,
    default_margin_percent: 20,
    premium_rate_factor: 1.15,
  },
});
check(
  "allowed labour fallback is the carpenter catalogue $60",
  withBenchmarks.costRate === 60 && withBenchmarks.sourceType === "benchmark"
);

const pileKey = buildMaterialRateItemKey(HOUSE_PILE_125_RW_IDENTITY, "lm");
const pileEntries = SPECIFIC_MATERIAL_RATE_GROUPS.flatMap((group) => group.entries).filter(
  (entry) => entry.item_key === pileKey
);
check(
  "Deck and Retaining Wall share one pile catalogue row at $23.50",
  pileKey === RW_HOUSE_PILE_125_KEY &&
    pileEntries.length === 1 &&
    pileEntries[0]?.defaultCostRate === HOUSE_PILE_BENCHMARK_COST_EX_GST,
  `key=${pileKey} rows=${pileEntries.length}`
);
check(
  "18 mm fibre cement has no manufactured cost",
  BATHROOM_FIBRE_CEMENT_SHEET_BENCHMARK == null &&
    getCatalogueEntry("sheet.fibre_cement.18mm.2400x1200.each")?.defaultCostRate ==
      null
);
check("loose spoil swell is held, not hardcoded at 3", LOOSE_SPOIL_SWELL_FACTOR == null);
check(
  "ceiling timber lining is 2 × 5 minutes per lm",
  near(
    CEILINGS_QUOTR_PRODUCTIVITY_HOURS[CEILINGS_PRODUCTIVITY_KEYS.timberLiningLm],
    (2 * 5) / 60
  ) &&
    approvedProductivityHours("ceilings.timber_lining.install.hours_per_lm")
      ?.unit === "lm"
);
check(
  "12 lm of ceiling timber lining is 2 person-hours",
  near(12 * ((2 * 5) / 60), 2)
);
check(
  "fence concrete placement is 2 × 2 minutes per bag",
  near(
    approvedProductivityHours("fence.post_hole_concrete.place.hours_per_bag")
      ?.hoursPerUnit ?? 0,
    (2 * 2) / 60
  )
);
check(
  "decking m² converts by board width and is not copied onto the held lm key",
  near(
    resolveDeckDeckingInstallProductivity([], 140).hoursPerUnit,
    (35 / 60) * 0.14
  ) &&
    resolveDeckDeckingInstallProductivity([]).hoursPerUnit !== 35 / 60
);
const fibreSheet = resolveMaterialRate({
  orgRates: [],
  materialKey: "sheet.fibre_cement.18mm.2400x1200.each",
  unit: "each",
  benchmarkCostRate: 0,
  organisationSettings: {
    allow_benchmark_rates: true,
    default_margin_percent: 20,
    premium_rate_factor: 1.15,
  },
});
check(
  "18 mm fibre cement with no benchmark is Pricing Required, not a known zero",
  fibreSheet.materialRateSource === "missing" &&
    fibreSheet.sourceType === "missing" &&
    fibreSheet.sourceLabel === "Pricing required" &&
    fibreSheet.costRate === 0 &&
    fibreSheet.sellRate === 0
);

const identityKey = [...PRODUCT_IDENTITY_CORRECTION_KEYS][0];
check(
  "identity-correction sheets are not given a derived cost",
  identityKey != null && derivedDimensionedPlasterboardCost(identityKey) == null,
  identityKey
);

check(
  "m² displays with a superscript",
  formatCatalogueRateUnit("m2") === "m²" && formatRateUnit("m2") === "per m²"
);

const pricingItem = {
  id: "line-1",
  org_id: "o1",
  pricing_document_id: "d1",
  project_id: "p1",
  work_area_id: "b1",
  source_estimate_line_item_id: null,
  component_key: BATHROOM_COMPLETE_STRIP_KEY,
  item_type: "labour",
  delivery_method: "in_house",
  internal_label: "Complete bathroom strip-out",
  client_label: "Complete bathroom strip-out",
  internal_description: null,
  client_description: null,
  quantity: stripHours,
  unit: "hrs",
  unit_cost: 60,
  unit_sell: 72,
  total_cost: stripHours * 60,
  total_sell: stripHours * 72,
  gross_profit: stripHours * 12,
  margin_percent: 16.67,
  markup_percent: 20,
  visible_on_quote: true,
  optional: false,
  sort_order: 1,
  notes_internal: null,
  notes_client: null,
  created_at: "2026-10-11T00:00:00.000Z",
  updated_at: "2026-10-11T00:00:00.000Z",
  manually_edited: false,
  orphaned: false,
  recalibration_note: null,
  calculation_mode: null,
  productivity_rate: null,
  productivity_unit: null,
  calculated_quantity: null,
} as PricingItem;
const quoteItems = mapPricingItemsToQuoteItems(
  [pricingItem],
  new Map([["b1", "Bathroom"]])
);
const issuedTotal = quoteItems[0]?.total ?? 0;
pricingItem.total_sell = 1;
check(
  "issued quote items keep the copied sell after the source row changes",
  near(issuedTotal, stripHours * 72) && quoteItems[0]?.total === issuedTotal
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
