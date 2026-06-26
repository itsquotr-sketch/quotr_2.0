/**
 * Pricing ownership and double-count prevention verification.
 *
 * Run: npx tsx scripts/verify-pricing-ownership.ts
 */
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateBathroom } from "../lib/estimate/calculators/bathroom";
import { calculateKitchen } from "../lib/estimate/calculators/kitchen";
import { calculateFlooring, calculatePainting } from "../lib/estimate/calculators/fitout";
import {
  countOverlapGroups,
  totalLabourHours,
} from "../lib/estimate/pricing-ownership";
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
  return { key, work_area_id: workAreaId, value, source: "manual" };
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

function assertNoAbsurdBathroomLabour(
  items: ReturnType<typeof calculateBathroom>["lineItems"],
  areaM2: number
) {
  assert(
    !labels(items).includes("Bathroom labour"),
    "No broad Bathroom labour line"
  );
  for (const item of items) {
    if (
      item.productivityRate != null &&
      item.productivityRate > 6 &&
      item.label.toLowerCase().includes("bathroom")
    ) {
      throw new Error(
        `FAIL: Absurd bathroom productivity on ${item.label}: ${item.productivityRate} hrs/${item.productivityUnit}`
      );
    }
    if (item.notes?.includes("22 hrs/m²")) {
      throw new Error(`FAIL: Absurd 22 hrs/m² bathroom productivity note on ${item.label}`);
    }
  }
  const hours = totalLabourHours(items);
  const maxHours = Math.max(80, areaM2 * 8);
  assert(
    hours <= maxHours,
    `Bathroom labour hours commercially plausible (${hours} <= ${maxHours})`
  );
}

const fullBathroomFacts = withDerived(
  [{ id: "b1", type: "bathroom" }],
  [
    fact("bathroom.area_m2", "b1", 6),
    fact("bathroom.renovation_type", "b1", "Full strip-out and rebuild"),
    fact("bathroom.demolition_required", "b1", true),
    fact("bathroom.shower_type", "b1", "Tiled shower"),
    fact("bathroom.waterproofing_included", "b1", true),
    fact("bathroom.tiling_included", "b1", true),
    fact("bathroom.plumbing_changes", "b1", "Major"),
    fact("bathroom.electrical_changes", "b1", "Minor"),
    fact("bathroom.ventilation_included", "b1", true),
    fact("bathroom.fixtures_client_supplied", "b1", true),
    fact("bathroom.finish_level", "b1", "Standard"),
    fact("bathroom.tile_extent", "b1", "Floor and walls"),
  ] as ProjectFactRecord[]
);

console.log("\n--- 1. Bathroom full renovation ---");
const bathroom1 = calculateBathroom(
  { ...baseContext, facts: fullBathroomFacts } as EstimateContext,
  wa("b1", "bathroom", "Bathroom")
);
assert(labels(bathroom1.lineItems).includes("Demolition/strip-out"), "Demo once");
assert(
  countOverlapGroups(bathroom1.lineItems, "bathroom_waterproofing") === 1,
  "Waterproofing once"
);
assert(countOverlapGroups(bathroom1.lineItems, "bathroom_tiling") === 1, "Tiling once");
assert(countOverlapGroups(bathroom1.lineItems, "bathroom_plumbing") === 1, "Plumbing once");
assert(countOverlapGroups(bathroom1.lineItems, "bathroom_electrical") === 1, "Electrical once");
assert(
  !labels(bathroom1.lineItems).includes("Fixtures allowance"),
  "Client-supplied fixtures not priced as supply"
);
assert(
  labels(bathroom1.lineItems).includes("Fixture installation labour"),
  "Fixture install labour priced"
);
assertNoAbsurdBathroomLabour(bathroom1.lineItems, 6);
assertQuoteSafe(
  buildWorkAreaQuoteDescriptionDraft({
    type: "bathroom",
    name: "Bathroom",
    facts: fullBathroomFacts.map((f) => ({
      key: f.key,
      label: f.key,
      value: String(f.value),
    })),
  }),
  "Bathroom full"
);

console.log("\n--- 2. Bathroom plus flooring removal ---");
const mixedWorkAreas = [
  { id: "b1", type: "bathroom" },
  { id: "d1", type: "demolition" },
  { id: "f1", type: "flooring" },
];
const mixedFacts = withDerived(mixedWorkAreas, [
  ...fullBathroomFacts,
  fact("demolition.scope_items", "d1", ["Flooring"]),
  fact("demolition.floor_area_m2", "d1", 20),
  fact("demolition.disposal_included", "d1", true),
  fact("demolition.skip_bin_included", "d1", true),
  fact("demolition.carting_distance_m", "d1", 30),
  fact("flooring.area_m2", "f1", 20),
  fact("flooring.supply_scope", "f1", "Removal only"),
  fact("flooring.existing_flooring_removal", "f1", true),
  fact("flooring.type", "f1", "Vinyl"),
  fact("flooring.disposal_included", "f1", true),
] as ProjectFactRecord[]);

const mixedEstimate = calculateEstimate({
  ...baseContext,
  confirmedWorkAreas: [
    wa("b1", "bathroom", "Bathroom"),
    wa("d1", "demolition", "Demolition"),
    wa("f1", "flooring", "Flooring"),
  ],
  facts: mixedFacts,
} as EstimateContext);

assert(
  !labels(mixedEstimate.lineItems).some((l) => /flooring materials allowance/i.test(l)),
  "No new flooring materials line"
);
assert(
  !labels(mixedEstimate.lineItems).some((l) => /flooring labour/i.test(l)),
  "No new flooring install labour"
);
const disposalLines = mixedEstimate.lineItems.filter(
  (item) =>
    /disposal|cartage|skip/i.test(item.label) && item.includedInTotal !== false
);
assert(disposalLines.length <= 2, "Disposal/cartage not heavily duplicated");
assertNoAbsurdBathroomLabour(
  mixedEstimate.lineItems.filter((item) => item.workAreaName === "Bathroom"),
  6
);

console.log("\n--- 3. Kitchen install-only ---");
const kitchenFacts = withDerived(
  [{ id: "k1", type: "kitchen" }],
  [
    fact("kitchen.area_m2", "k1", 12),
    fact("kitchen.demolition_required", "k1", true),
    fact("kitchen.cabinetry_included", "k1", true),
    fact("kitchen.cabinetry_client_supplied", "k1", true),
    fact("kitchen.benchtop_included", "k1", true),
    fact("kitchen.splashback_included", "k1", true),
    fact("kitchen.rangehood_included", "k1", true),
    fact("kitchen.plumbing_changes", "k1", "By others"),
    fact("kitchen.electrical_changes", "k1", "By others"),
  ] as ProjectFactRecord[]
);
const kitchen = calculateKitchen(
  { ...baseContext, facts: kitchenFacts } as EstimateContext,
  wa("k1", "kitchen", "Kitchen")
);
assert(!labels(kitchen.lineItems).includes("Cabinetry allowance"), "No cabinetry supply");
assert(
  labels(kitchen.lineItems).some((l) => l.toLowerCase().includes("cabinetry")),
  "Cabinetry install priced"
);
assert(!labels(kitchen.lineItems).includes("Plumbing allowance"), "Plumbing not priced");
assert(!labels(kitchen.lineItems).includes("Electrical allowance"), "Electrical not priced");
assert(labels(kitchen.lineItems).includes("Demolition/strip-out"), "Demolition once");

console.log("\n--- 4. Painting client-supplied paint ---");
const paintingFacts = withDerived(
  [{ id: "p1", type: "painting" }],
  [
    fact("painting.location", "p1", "Internal"),
    fact("painting.internal_area_m2", "p1", 120),
    fact("painting.coats_required", "p1", "2"),
    fact("painting.prep_level", "p1", "Minor"),
    fact("painting.paint_client_supplied", "p1", true),
    fact("painting.surfaces", "p1", ["Walls", "Ceilings", "Doors", "Trims"]),
    fact("painting.door_painting_included", "p1", true),
  ] as ProjectFactRecord[]
);
const painting = calculatePainting(
  { ...baseContext, facts: paintingFacts } as EstimateContext,
  wa("p1", "painting", "Painting")
);
assert(labels(painting.lineItems).includes("Painting labour"), "Painting labour priced");
assert(
  !labels(painting.lineItems).some((l) => /paint materials/i.test(l)),
  "No paint material row when client supplied"
);
const paintMaterialCount = labels(painting.lineItems).filter((l) =>
  /paint materials/i.test(l)
).length;
assert(paintMaterialCount === 0, "No duplicate painting material rows");

console.log("\n--- 5. Flooring removal only ---");
const removalFacts = withDerived(
  [{ id: "f2", type: "flooring" }],
  [
    fact("flooring.area_m2", "f2", 60),
    fact("flooring.supply_scope", "f2", "Removal only"),
    fact("flooring.existing_flooring_removal", "f2", true),
    fact("flooring.disposal_included", "f2", true),
  ] as ProjectFactRecord[]
);
const flooringRemoval = calculateFlooring(
  { ...baseContext, facts: removalFacts } as EstimateContext,
  wa("f2", "flooring", "Flooring")
);
assert(
  labels(flooringRemoval.lineItems).includes("Existing flooring removal"),
  "Removal priced"
);
assert(
  !labels(flooringRemoval.lineItems).some((l) => /materials allowance/i.test(l)),
  "No new flooring material"
);
assert(
  !labels(flooringRemoval.lineItems).some((l) => /flooring labour/i.test(l)),
  "No new flooring install labour"
);

console.log("\nPricing ownership checks passed.");
