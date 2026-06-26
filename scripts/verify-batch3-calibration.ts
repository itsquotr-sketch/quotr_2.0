/**
 * Calibration Batch 3 verification — demolition/strip-out and external stairs.
 *
 * Run: npx tsx scripts/verify-batch3-calibration.ts
 */
import { calculateDemolition } from "../lib/estimate/calculators/demolition";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import { calculateExternalStairs } from "../lib/estimate/calculators/external-stairs";
import type { PricingOwner } from "../lib/estimate/pricing-ownership";
import type { EstimateLineItemInput } from "../lib/estimate/types";
import {
  deriveFactsForProject,
  mergeDerivedFactsIntoRecords,
} from "../lib/scopes/derived-facts";
import { buildWorkAreaQuoteDescriptionDraft } from "../lib/work-areas/quote-description";
import type { EstimateContext, EstimateWorkArea } from "../lib/estimate/types";
import type { ProjectFactRecord } from "../lib/scopes/fact-values";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`PASS: ${msg}`);
}

const baseContext = {
  project: { id: "p1", qualityLevel: "standard" },
  confirmedWorkAreas: [],
  facts: [],
  constraints: [],
  organisationSettings: {
    allow_benchmark_rates: true,
    default_margin_percent: 20,
  },
  materialWastageSettings: {
    sheet_material: 10,
    flooring: 10,
    paint: 10,
    default: 5,
  },
  rates: [],
} as unknown as EstimateContext;

function wa(id: string, type: string, name: string): EstimateWorkArea {
  return { id, type, name, sort_order: 1 };
}

function fact(key: string, workAreaId: string, value: unknown): ProjectFactRecord {
  return { key, work_area_id: workAreaId, value };
}

function labels(items: { label: string }[]) {
  return items.map((item) => item.label);
}

function withDerived(
  workAreas: Array<{ id: string; type: string }>,
  facts: ProjectFactRecord[]
): ProjectFactRecord[] {
  const derived = deriveFactsForProject({ workAreas, projectFacts: facts });
  return mergeDerivedFactsIntoRecords(facts, derived);
}

function assertQuoteSafe(draft: string, scope: string) {
  const lower = draft.toLowerCase();
  assert(!lower.includes("wastage"), `${scope}: quote has no wastage`);
  assert(!lower.includes("margin"), `${scope}: quote has no margin`);
  assert(!lower.includes("benchmark"), `${scope}: quote has no benchmark`);
  assert(!lower.includes("productivity"), `${scope}: quote has no productivity`);
  assert(!lower.includes("labour hours"), `${scope}: quote has no labour hours`);
}

function assertNoPricingFields(facts: Array<{ key: string }>) {
  const forbidden = ["recommended_cost", "recommended_sell", "price", "cost", "sell"];
  for (const f of facts) {
    assert(
      !forbidden.some((k) => f.key.toLowerCase().includes(k)),
      `No AI pricing key: ${f.key}`
    );
  }
}

function findLine(
  items: EstimateLineItemInput[],
  label: string
): EstimateLineItemInput | undefined {
  return items.find((item) => item.label === label);
}

function assertOwner(
  items: EstimateLineItemInput[],
  label: string,
  owner: PricingOwner
) {
  const item = findLine(items, label);
  assert(item?.pricingOwner === owner, `${label} pricingOwner = ${owner}`);
}

// Demolition 1 — bathroom strip-out
console.log("\n--- Demolition 1: bathroom strip-out ---");
const demo1Facts = [
  fact("demolition.scope_items", "d1", [
    "Bathroom",
    "Fixtures",
    "Internal walls",
    "Flooring",
  ]),
  fact("demolition.disposal_included", "d1", true),
  fact("demolition.services_isolated", "d1", "By others"),
  fact("demolition.hazardous_materials_risk", "d1", "None known"),
];
assertNoPricingFields(demo1Facts);
const demo1 = calculateDemolition(
  { ...baseContext, facts: demo1Facts } as EstimateContext,
  wa("d1", "demolition", "Bathroom strip-out")
);
assert(labels(demo1.lineItems).includes("Demolition/strip-out labour"), "Demo1: labour line");
assertOwner(demo1.lineItems, "Demolition/strip-out labour", "in_house_labour");
assert(
  findLine(demo1.lineItems, "Demolition/strip-out labour")?.quantityBasis != null,
  "Demo1: strip-out labour has quantity basis"
);
assert(labels(demo1.lineItems).includes("Bathroom strip-out allowance"), "Demo1: bathroom allowance");
assert(
  labels(demo1.lineItems).includes("Fixture/joinery removal allowance"),
  "Demo1: fixtures allowance"
);
assert(
  labels(demo1.lineItems).some((l) => l.includes("Disposal") || l.includes("Waste")),
  "Demo1: disposal included"
);
assert(
  demo1.exclusions.some((e) => e.toLowerCase().includes("hazardous")),
  "Demo1: hazardous exclusion"
);
assert(
  demo1.assumptions.some((a) => a.toLowerCase().includes("by others")) ||
    demo1.exclusions.some((e) => e.toLowerCase().includes("by others")),
  "Demo1: services by others noted"
);
const demo1Quote = buildWorkAreaQuoteDescriptionDraft({
  type: "demolition",
  name: "Bathroom strip-out",
  facts: demo1Facts.map((f) => ({
    key: f.key,
    label: f.key,
    value: String(f.value),
  })),
});
assertQuoteSafe(demo1Quote, "Demolition 1");
assert(demo1Quote.toLowerCase().includes("disposal"), "Demo1: disposal in quote");

// Demolition 2 — upstairs flooring removal with carting
console.log("\n--- Demolition 2: upstairs flooring ---");
const demo2Facts = [
  fact("demolition.scope_items", "d2", ["Flooring"]),
  fact("demolition.floor_area_m2", "d2", 30),
  fact("demolition.disposal_included", "d2", true),
  fact("demolition.skip_bin_included", "d2", true),
  fact("demolition.carting_distance_m", "d2", 40),
  fact("demolition.floor_level", "d2", "Upper floor"),
  fact("demolition.access", "d2", "Moderate"),
];
const demo2 = calculateDemolition(
  { ...baseContext, facts: demo2Facts } as EstimateContext,
  wa("d2", "demolition", "Flooring removal")
);
assert(labels(demo2.lineItems).includes("Flooring removal allowance"), "Demo2: flooring removal");
assertOwner(demo2.lineItems, "Flooring removal allowance", "in_house_labour");
assert(
  (findLine(demo2.lineItems, "Flooring removal allowance")?.quantity ?? 0) > 30,
  "Demo2: flooring quantity reflects access/floor factor"
);
assert(labels(demo2.lineItems).includes("Skip bin allowance"), "Demo2: skip bin");
assert(
  labels(demo2.lineItems).some((l) => l.includes("Carting") || l.includes("Access")),
  "Demo2: carting/access allowance"
);
assert(
  demo2.assumptions.some((a) => a.includes("1.32") || a.includes("factor")),
  "Demo2: access/floor factor applied"
);
const demo2Quote = buildWorkAreaQuoteDescriptionDraft({
  type: "demolition",
  name: "Flooring removal",
  facts: demo2Facts.map((f) => ({
    key: f.key,
    label: f.key,
    value: String(f.value),
  })),
});
assertQuoteSafe(demo2Quote, "Demolition 2");
assert(demo2Quote.toLowerCase().includes("upper"), "Demo2: upper floor in quote");

// External stairs 1 — 8-step treated timber with handrail and removal
console.log("\n--- External stairs 1: 8-step timber ---");
const stairs1Facts = [
  fact("external_stairs.risers_count", "s1", 8),
  fact("external_stairs.width_m", "s1", 1),
  fact("external_stairs.material", "s1", "Treated timber"),
  fact("external_stairs.handrail_included", "s1", true),
  fact("external_stairs.existing_removal", "s1", true),
];
const stairs1 = calculateExternalStairs(
  { ...baseContext, facts: stairs1Facts } as EstimateContext,
  wa("s1", "external_stairs", "External stairs")
);
assert(labels(stairs1.lineItems).includes("External stair labour"), "Stairs1: labour");
assertOwner(stairs1.lineItems, "External stair labour", "in_house_labour");
assertOwner(stairs1.lineItems, "External stair materials", "contractor_material");
assert(
  findLine(stairs1.lineItems, "External stair labour")?.quantityBasis?.quantity === 8,
  "Stairs1: labour quantity basis uses 8 risers"
);
assert(labels(stairs1.lineItems).includes("External stair materials"), "Stairs1: materials");
assert(labels(stairs1.lineItems).includes("Handrail allowance"), "Stairs1: handrail");
assert(labels(stairs1.lineItems).includes("Existing stair removal"), "Stairs1: removal");
const stairs1Quote = buildWorkAreaQuoteDescriptionDraft({
  type: "external_stairs",
  name: "External stairs",
  facts: stairs1Facts.map((f) => ({
    key: f.key,
    label: f.key,
    value: String(f.value),
  })),
});
assertQuoteSafe(stairs1Quote, "External stairs 1");
assert(stairs1Quote.includes("8"), "Stairs1: riser count in quote");
assert(stairs1Quote.toLowerCase().includes("handrail"), "Stairs1: handrail in quote");

// External stairs 2 — 1.4m rise with landing, balustrade, sloping ground
console.log("\n--- External stairs 2: rise-derived ---");
const stairs2RawFacts = [
  fact("external_stairs.total_rise_m", "s2", 1.4),
  fact("external_stairs.material", "s2", "Treated timber"),
  fact("external_stairs.landing_included", "s2", true),
  fact("external_stairs.landing_area_m2", "s2", 1.2),
  fact("external_stairs.balustrade_included", "s2", true),
  fact("external_stairs.ground_condition", "s2", "Sloping"),
];
const stairs2Facts = withDerived([{ id: "s2", type: "external_stairs" }], stairs2RawFacts);
const derivedRisers = stairs2Facts.find(
  (f) => f.key === "external_stairs.approximate_riser_count" && f.work_area_id === "s2"
);
assert(derivedRisers?.value === 8, "Stairs2: derived 8 risers from 1.4m rise");
const stairs2 = calculateExternalStairs(
  { ...baseContext, facts: stairs2Facts } as EstimateContext,
  wa("s2", "external_stairs", "External stairs")
);
assert(labels(stairs2.lineItems).includes("External stair labour"), "Stairs2: labour");
assert(labels(stairs2.lineItems).includes("Landing allowance"), "Stairs2: landing");
assert(labels(stairs2.lineItems).includes("Balustrade allowance"), "Stairs2: balustrade");
assert(
  stairs2.assumptions.some((a) => a.toLowerCase().includes("approximate")),
  "Stairs2: approximate riser assumption"
);
assert(
  stairs2.assumptions.some((a) => a.toLowerCase().includes("slop") || a.includes("1.15")),
  "Stairs2: sloping ground factor"
);
const stairs2Quote = buildWorkAreaQuoteDescriptionDraft({
  type: "external_stairs",
  name: "External stairs",
  facts: stairs2Facts.map((f) => ({
    key: f.key,
    label: f.key,
    value: String(f.value),
  })),
});
assertQuoteSafe(stairs2Quote, "External stairs 2");
assert(stairs2Quote.toLowerCase().includes("landing"), "Stairs2: landing in quote");
assert(stairs2Quote.toLowerCase().includes("balustrade"), "Stairs2: balustrade in quote");

// Test 5 — mixed deck and external stairs (no double stair allowance on deck)
console.log("\n--- Test 5: Mixed deck and external stairs ---");
const deck5Id = "deck5";
const stairs5Id = "stairs5";
const mixedFacts = withDerived(
  [
    { id: deck5Id, type: "deck" },
    { id: stairs5Id, type: "external_stairs" },
  ],
  [
    fact("deck.length_m", deck5Id, 6),
    fact("deck.width_m", deck5Id, 6),
    fact("deck.board_material", deck5Id, "Kwila"),
    fact("deck.board_width_mm", deck5Id, 140),
    fact("external_stairs.risers_count", stairs5Id, 8),
    fact("external_stairs.material", stairs5Id, "Treated timber"),
    fact("external_stairs.handrail_included", stairs5Id, true),
    fact("external_stairs.width_m", stairs5Id, 1),
  ]
);
const mixedContext = {
  ...baseContext,
  facts: mixedFacts,
  confirmedWorkAreas: [
    wa(deck5Id, "deck", "Deck"),
    wa(stairs5Id, "external_stairs", "External stairs"),
  ],
} as EstimateContext;

const deck5 = calculateDeck(mixedContext, wa(deck5Id, "deck", "Deck"));
const stairs5 = calculateExternalStairs(
  mixedContext,
  wa(stairs5Id, "external_stairs", "External stairs")
);

assert(
  !labels(deck5.lineItems).includes("Stair set allowance"),
  "Deck5: no deck stair allowance when external_stairs work area present"
);
assert(
  labels(stairs5.lineItems).includes("External stair labour"),
  "Deck5: stairs priced in external_stairs work area"
);
assert(
  labels(stairs5.lineItems).includes("Handrail allowance"),
  "Deck5: handrail on external stairs"
);
const deckMaterials = deck5.lineItems.find((item) =>
  item.label.includes("Decking materials")
);
assert(deckMaterials != null, "Deck5: deck materials package present");
assert(
  deckMaterials.materialBuildUp != null ||
    (deckMaterials.materialBuildUps?.length ?? 0) > 0,
  "Deck5: deck board build-up remains internal metadata"
);
const deckSell = deck5.lineItems.reduce((sum, item) => sum + item.recommendedSell, 0);
const stairsSell = stairs5.lineItems.reduce((sum, item) => sum + item.recommendedSell, 0);
assert(deckSell > 0 && stairsSell > 0, "Deck5: deck and stairs both produce positive totals");

console.log("\nBatch 3 calibration checks passed.");
