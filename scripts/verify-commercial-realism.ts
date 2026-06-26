/**
 * Commercial realism and breakdown trust verification.
 *
 * Run: npx tsx scripts/verify-commercial-realism.ts
 */
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateBathroom } from "../lib/estimate/calculators/bathroom";
import { calculateKitchen } from "../lib/estimate/calculators/kitchen";
import { calculateFlooring, calculatePainting } from "../lib/estimate/calculators/fitout";
import { BATHROOM_BENCHMARKS } from "../lib/estimate/benchmark-rates";
import {
  assertNoDuplicateEstimateLineItems,
  lineItemRenderKey,
} from "../lib/estimate/commercial-realism";
import { countOverlapGroups } from "../lib/estimate/pricing-ownership";
import {
  deriveFactsForProject,
  mergeDerivedFactsIntoRecords,
} from "../lib/scopes/derived-facts";
import { buildWorkAreaQuoteDescriptionDraft } from "../lib/work-areas/quote-description";
import type { EstimateContext, EstimateWorkArea } from "../lib/estimate/types";
import type { ProjectFactRecord } from "../lib/scopes/fact-values";
import type { EstimateLineItemInput } from "../lib/estimate/types";

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

function findItem(
  items: EstimateLineItemInput[],
  pattern: RegExp
): EstimateLineItemInput | undefined {
  return items.find((item) => pattern.test(item.label));
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
  assert(!lower.includes("aqualine sheet"), `${scope}: quote has no sheet count`);
}

function assertNoDuplicateLineItems(
  items: EstimateLineItemInput[],
  scope: string
) {
  const { duplicateLabels, duplicateOverlapGroups } =
    assertNoDuplicateEstimateLineItems(items);
  assert(
    duplicateLabels.length === 0,
    `${scope}: no duplicate labels (${duplicateLabels.join(", ") || "none"})`
  );
  assert(
    duplicateOverlapGroups.length === 0,
    `${scope}: no duplicate overlap groups (${duplicateOverlapGroups.join(", ") || "none"})`
  );

  const renderKeys = items.map((item, index) => lineItemRenderKey(item, index));
  const uniqueKeys = new Set(renderKeys);
  assert(
    uniqueKeys.size === renderKeys.length,
    `${scope}: each line item has a unique render key`
  );
}

const fullBathroomFacts = withDerived(
  [{ id: "b1", type: "bathroom" }],
  [
    fact("bathroom.area_m2", "b1", 8),
    fact("bathroom.renovation_type", "b1", "Full strip-out and rebuild"),
    fact("bathroom.demolition_required", "b1", true),
    fact("bathroom.shower_type", "b1", "Tiled shower"),
    fact("bathroom.waterproofing_included", "b1", true),
    fact("bathroom.tiling_included", "b1", true),
    fact("bathroom.floor_tiling_area_m2", "b1", 8),
    fact("bathroom.wall_tiling_area_m2", "b1", 15),
    fact("bathroom.wall_lining_included", "b1", true),
    fact("bathroom.floor_prep_included", "b1", true),
    fact("bathroom.plumbing_changes", "b1", "Minor"),
    fact("bathroom.electrical_changes", "b1", "Minor"),
    fact("bathroom.ventilation_included", "b1", true),
    fact("bathroom.fixtures_client_supplied", "b1", true),
    fact("bathroom.finish_level", "b1", "Standard"),
    fact("bathroom.tile_extent", "b1", "Floor and walls"),
    fact("bathroom.access", "b1", "Moderate"),
  ] as ProjectFactRecord[]
);

console.log("\n--- Test 1: Full bathroom component completeness ---");
const bathroomFull = calculateBathroom(
  { ...baseContext, facts: fullBathroomFacts } as EstimateContext,
  wa("b1", "bathroom", "Bathroom")
);

assert(countOverlapGroups(bathroomFull.lineItems, "bathroom_demolition") === 1, "Demolition once");
assert(
  labels(bathroomFull.lineItems).some((l) => /carpentry|prep/i.test(l)),
  "Bathroom carpentry/prep present"
);
assert(countOverlapGroups(bathroomFull.lineItems, "bathroom_waterproofing") === 1, "Waterproofing once");
assert(countOverlapGroups(bathroomFull.lineItems, "bathroom_tiling") === 1, "Tiling once");
assert(findItem(bathroomFull.lineItems, /plumbing/i) != null, "Plumbing allowance present");
assert(findItem(bathroomFull.lineItems, /electrical/i) != null, "Electrical allowance present");
assert(
  findItem(bathroomFull.lineItems, /ventilation|extractor/i) != null,
  "Ventilation/extractor allowance present"
);
assert(
  !labels(bathroomFull.lineItems).includes("Fixtures allowance"),
  "Client-supplied vanity/tapware supply not priced"
);
assert(
  labels(bathroomFull.lineItems).includes("Fixture installation labour"),
  "Fixture installation labour priced"
);
assert(
  findItem(bathroomFull.lineItems, /floor prep|levelling|substrate/i) != null,
  "Floor prep allowance present"
);

const coordinationLine = findItem(
  bathroomFull.lineItems,
  /coordination|site allowance/i
);
const coordinationAssumption = bathroomFull.assumptions.some((a) =>
  /coordination/i.test(a)
);
assert(coordinationLine != null, "Coordination/site allowance priced");
assert(coordinationAssumption, "Coordination assumption present");
assert(
  coordinationLine!.recommendedSell > 0,
  "Coordination allowance affects total"
);

const tilingLine = findItem(bathroomFull.lineItems, /tiling allowance/i);
assert(tilingLine != null, "Tiling allowance line exists");
assert(tilingLine!.quantity === 23, `Tiling quantity is 23 m² (got ${tilingLine!.quantity})`);
assert(
  tilingLine!.quantityBasis?.sourceFact === "bathroom.total_tiling_area_m2",
  "Tiling quantity basis references total_tiling_area_m2"
);

for (const item of bathroomFull.lineItems) {
  assert(item.pricingOwner != null, `${item.label} has pricing owner`);
}

assertNoDuplicateLineItems(bathroomFull.lineItems, "Full bathroom");

console.log("\n--- Test 2: Bathroom wall lining / Aqualine ---");
const wallLiningMaterial = findItem(
  bathroomFull.lineItems,
  /wall lining.*allowance/i
);
const wallLiningLabour = findItem(
  bathroomFull.lineItems,
  /wall lining install/i
);
assert(wallLiningMaterial != null, "Wall lining material allowance present");
assert(wallLiningLabour != null, "Wall lining install labour present");
assert(
  (wallLiningMaterial!.quantityBasis?.quantity ?? 0) >= 15,
  "Wall lining basis uses wall area (not floor-only 8 m²)"
);

const buildUpNotes = JSON.stringify(
  bathroomFull.lineItems.flatMap((item) => item.materialBuildUps ?? [])
);
assert(
  /aqualine|sheet/i.test(buildUpNotes),
  "Aqualine sheet build-up present internally"
);

console.log("\n--- Test 3: No duplicate line items / overlap groups ---");
const mixedEstimate = calculateEstimate({
  ...baseContext,
  confirmedWorkAreas: [
    wa("b1", "bathroom", "Bathroom"),
    wa("f1", "flooring", "Flooring"),
  ],
  facts: withDerived(
    [
      { id: "b1", type: "bathroom" },
      { id: "f1", type: "flooring" },
    ],
    [
      ...fullBathroomFacts,
      fact("flooring.area_m2", "f1", 20),
      fact("flooring.supply_scope", "f1", "Removal only"),
      fact("flooring.existing_flooring_removal", "f1", true),
      fact("flooring.type", "f1", "Vinyl"),
      fact("flooring.carting_distance_m", "f1", 30),
      fact("flooring.disposal_included", "f1", true),
    ] as ProjectFactRecord[]
  ),
} as EstimateContext);

assertNoDuplicateLineItems(mixedEstimate.lineItems, "Bathroom + flooring removal");
assert(
  !labels(mixedEstimate.lineItems).some((l) => /flooring materials/i.test(l)),
  "Flooring work area excluded from new supply (manual brief)"
);

console.log("\n--- Test 4: Quote safety ---");
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
  "Bathroom quote"
);

console.log("\n--- Test 5: Bathroom labour minimums ---");
const demoLine = findItem(bathroomFull.lineItems, /demolition/i);
assert(
  (demoLine?.labourHours ?? 0) >= 8,
  `Strip-out hours meet minimum crew visit (got ${demoLine?.labourHours})`
);
assert(demoLine?.labourMinimum != null, "Strip-out labour minimum metadata recorded");
assert(
  !labels(bathroomFull.lineItems).includes("Bathroom labour"),
  "No broad all-in bathroom labour line"
);

console.log("\n--- Test 6: Small bathroom minimum subtrade allowances ---");
const smallBathroomFacts = withDerived(
  [{ id: "b2", type: "bathroom" }],
  [
    fact("bathroom.area_m2", "b2", 4),
    fact("bathroom.renovation_type", "b2", "Minor refresh"),
    fact("bathroom.waterproofing_included", "b2", true),
    fact("bathroom.tiling_included", "b2", true),
    fact("bathroom.floor_tiling_area_m2", "b2", 4),
    fact("bathroom.plumbing_changes", "b2", "Minor"),
    fact("bathroom.fixtures_client_supplied", "b2", true),
    fact("bathroom.tile_extent", "b2", "Floor only"),
  ] as ProjectFactRecord[]
);

const smallBathroom = calculateBathroom(
  { ...baseContext, facts: smallBathroomFacts } as EstimateContext,
  wa("b2", "bathroom", "Small Bathroom")
);

const smallTiling = findItem(smallBathroom.lineItems, /tiling allowance/i);
assert(
  (smallTiling?.recommendedSell ?? 0) >= BATHROOM_BENCHMARKS.tilingMinimum.sell,
  "Small bathroom tiling at or above minimum allowance"
);

console.log("\n--- Test 7: Kitchen by others ---");
const kitchenFacts = withDerived(
  [{ id: "k1", type: "kitchen" }],
  [
    fact("kitchen.area_m2", "k1", 10),
    fact("kitchen.renovation_type", "k1", "Standard renovation"),
    fact("kitchen.cabinetry_included", "k1", true),
    fact("kitchen.cabinetry_client_supplied", "k1", true),
    fact("kitchen.benchtop_included", "k1", false),
    fact("kitchen.plumbing_changes", "k1", "By others"),
    fact("kitchen.electrical_changes", "k1", "By others"),
  ] as ProjectFactRecord[]
);

const kitchen = calculateKitchen(
  { ...baseContext, facts: kitchenFacts } as EstimateContext,
  wa("k1", "kitchen", "Kitchen")
);

assert(
  labels(kitchen.lineItems).some((l) => /cabinetry/i.test(l)),
  "Cabinetry install priced"
);
assert(!labels(kitchen.lineItems).includes("Plumbing allowance"), "Plumbing not priced");
assert(!labels(kitchen.lineItems).includes("Electrical allowance"), "Electrical not priced");

console.log("\n--- Test 8: Flooring removal only ---");
const removalFacts = withDerived(
  [{ id: "f2", type: "flooring" }],
  [
    fact("flooring.area_m2", "f2", 20),
    fact("flooring.supply_scope", "f2", "Removal only"),
    fact("flooring.existing_flooring_removal", "f2", true),
    fact("flooring.type", "f2", "Vinyl"),
    fact("flooring.carting_distance_m", "f2", 30),
    fact("flooring.disposal_included", "f2", true),
  ] as ProjectFactRecord[]
);

const flooringRemoval = calculateFlooring(
  { ...baseContext, facts: removalFacts } as EstimateContext,
  wa("f2", "flooring", "Flooring")
);

assert(
  labels(flooringRemoval.lineItems).some((l) => /removal/i.test(l)),
  "Removal priced once"
);

console.log("\n--- Test 9: Painting client-supplied paint ---");
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
  "Paint material not priced when client supplied"
);

console.log("\nAll commercial realism checks passed.\n");
