import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateBathroom } from "../lib/estimate/calculators/bathroom";
import { calculateKitchen } from "../lib/estimate/calculators/kitchen";
import {
  calculateCeilings,
  calculateDoors,
  calculateFlooring,
  calculateInternalWalls,
  calculatePainting,
  calculatePlastering,
} from "../lib/estimate/calculators/fitout";
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

function fact(key: string, workAreaId: string, value: unknown) {
  return { key, work_area_id: workAreaId, value };
}

function labels(items: { label: string }[]) {
  return items.map((item) => item.label);
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

function assertQuoteSafe(draft: string, scope: string) {
  const lower = draft.toLowerCase();
  assert(!lower.includes("wastage"), `${scope}: quote has no wastage`);
  assert(!lower.includes("margin"), `${scope}: quote has no margin`);
  assert(!lower.includes("benchmark"), `${scope}: quote has no benchmark`);
}

function withDerived(
  workAreas: Array<{ id: string; type: string }>,
  facts: ProjectFactRecord[]
): ProjectFactRecord[] {
  const derived = deriveFactsForProject({ workAreas, projectFacts: facts });
  return mergeDerivedFactsIntoRecords(facts, derived);
}

// Bathroom — full reno brief
console.log("\n--- Bathroom ---");
const bathroomFacts = withDerived(
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
assertNoPricingFields(bathroomFacts);
const bathroom = calculateBathroom(
  { ...baseContext, facts: bathroomFacts } as EstimateContext,
  wa("b1", "bathroom", "Bathroom")
);
assert(labels(bathroom.lineItems).includes("Demolition/strip-out"), "Bathroom: demolition");
assert(labels(bathroom.lineItems).includes("Waterproofing allowance"), "Bathroom: waterproofing");
assert(labels(bathroom.lineItems).includes("Tiling allowance"), "Bathroom: tiling");
assert(
  labels(bathroom.lineItems).includes("Extractor fan/ventilation allowance"),
  "Bathroom: ventilation"
);
assert(
  bathroom.lineItems.find((i) => i.label === "Tiling allowance")?.materialBuildUp != null ||
    bathroom.lineItems.some((i) => i.materialBuildUp?.buildUpType === "flooring_area"),
  "Bathroom: tiling build-up metadata"
);
assert(
  !labels(bathroom.lineItems).some((l) => l.toLowerCase().includes("tile materials")),
  "Bathroom: no duplicate tile priced row"
);
const bathroomQuote = buildWorkAreaQuoteDescriptionDraft({
  type: "bathroom",
  name: "Bathroom",
  facts: bathroomFacts.map((f) => ({
    key: f.key,
    label: f.key,
    value: String(f.value),
  })),
});
assertQuoteSafe(bathroomQuote, "Bathroom");
assert(bathroomQuote.toLowerCase().includes("client supplied"), "Bathroom: client fixtures in quote");

// Kitchen — client flatpack, benchtop, splashback, trades by others
console.log("\n--- Kitchen ---");
const kitchenFacts = [
  fact("kitchen.area_m2", "k1", 12),
  fact("kitchen.renovation_type", "k1", "Full kitchen renovation"),
  fact("kitchen.demolition_required", "k1", true),
  fact("kitchen.cabinetry_included", "k1", true),
  fact("kitchen.cabinetry_client_supplied", "k1", true),
  fact("kitchen.cabinetry_type", "k1", "Flatpack"),
  fact("kitchen.benchtop_included", "k1", true),
  fact("kitchen.splashback_included", "k1", true),
  fact("kitchen.rangehood_included", "k1", true),
  fact("kitchen.plumbing_changes", "k1", "None"),
  fact("kitchen.electrical_changes", "k1", "None"),
  fact("kitchen.finish_level", "k1", "Standard"),
];
const kitchen = calculateKitchen(
  { ...baseContext, facts: kitchenFacts } as EstimateContext,
  wa("k1", "kitchen", "Kitchen")
);
assert(labels(kitchen.lineItems).includes("Demolition/strip-out"), "Kitchen: demolition");
assert(
  labels(kitchen.lineItems).includes("Cabinetry installation allowance"),
  "Kitchen: client-supplied cabinetry install"
);
assert(labels(kitchen.lineItems).includes("Benchtop allowance"), "Kitchen: benchtop");
assert(labels(kitchen.lineItems).includes("Splashback allowance"), "Kitchen: splashback");
assert(labels(kitchen.lineItems).includes("Rangehood/venting allowance"), "Kitchen: rangehood");
assert(
  !kitchen.missingInfo.some((m) => m.toLowerCase().includes("plumbing")),
  "Kitchen: no plumbing missing when excluded"
);
assert(
  !kitchen.missingInfo.some((m) => m.toLowerCase().includes("electrical")),
  "Kitchen: no electrical missing when excluded"
);

// Internal walls — 10m x 2.4m both sides GIB insulated skirting
console.log("\n--- Internal walls ---");
const wallsFacts = withDerived(
  [{ id: "w1", type: "internal_walls" }],
  [
    fact("internal_walls.length_lm", "w1", 10),
    fact("internal_walls.height_m", "w1", 2.4),
    fact("internal_walls.framing_type", "w1", "Timber"),
    fact("internal_walls.wall_lining_type", "w1", "Plasterboard"),
    fact("internal_walls.plasterboard_type", "w1", "Standard"),
    fact("internal_walls.lining_sides", "w1", "Both sides"),
    fact("internal_walls.insulation_included", "w1", true),
    fact("internal_walls.skirtings_included", "w1", true),
  ] as ProjectFactRecord[]
);
const derivedWallArea = wallsFacts.find(
  (f) => f.key === "internal_walls.area_m2" && f.work_area_id === "w1"
);
assert(derivedWallArea?.value === 48, "Internal walls: derived area 48 m²");
const walls = calculateInternalWalls(
  { ...baseContext, facts: wallsFacts } as EstimateContext,
  wa("w1", "internal_walls", "Internal walls")
);
assert(labels(walls.lineItems).includes("Wall framing labour"), "Internal walls: framing labour");
assert(
  walls.lineItems.find((i) => i.label === "Internal wall materials allowance")
    ?.materialBuildUp?.buildUpType === "sheet_material_count",
  "Internal walls: plasterboard sheet build-up"
);
assert(labels(walls.lineItems).includes("Wall insulation"), "Internal walls: insulation");
assert(labels(walls.lineItems).includes("Skirting"), "Internal walls: skirting");

// Ceilings — 40m² plasterboard battens stopping painting
console.log("\n--- Ceilings ---");
const ceilingFacts = [
  fact("ceilings.area_m2", "c1", 40),
  fact("ceilings.ceiling_type", "c1", "Plasterboard"),
  fact("ceilings.battens_included", "c1", true),
  fact("ceilings.stopping_included", "c1", true),
  fact("ceilings.painting_included", "c1", true),
];
const ceilings = calculateCeilings(
  { ...baseContext, facts: ceilingFacts } as EstimateContext,
  wa("c1", "ceilings", "Ceilings")
);
assert(labels(ceilings.lineItems).includes("Ceiling battens/framing"), "Ceilings: battens");
assert(
  labels(ceilings.lineItems).includes("Ceiling stopping/plastering allowance"),
  "Ceilings: stopping"
);
assert(
  labels(ceilings.lineItems).includes("Ceiling painting allowance"),
  "Ceilings: painting"
);
assert(
  ceilings.lineItems.find((i) => i.label.includes("materials allowance"))
    ?.materialBuildUp != null,
  "Ceilings: sheet build-up on materials"
);

// Doors — 4 solid core supply/install frames architraves hardware
console.log("\n--- Doors ---");
const doorFacts = [
  fact("doors.count", "d1", 4),
  fact("doors.door_type", "d1", "Solid core"),
  fact("doors.supply_scope", "d1", "Supply and install"),
  fact("doors.prehung", "d1", true),
  fact("doors.frames_included", "d1", true),
  fact("doors.hardware_install_included", "d1", true),
  fact("doors.architraves_included", "d1", true),
];
const doors = calculateDoors(
  { ...baseContext, facts: doorFacts } as EstimateContext,
  wa("d1", "doors", "Doors")
);
assert(
  labels(doors.lineItems).includes("Door supply/install allowance"),
  "Doors: supply/install allowance"
);
assert(labels(doors.lineItems).includes("Architraves allowance"), "Doors: architraves");

// Flooring — 60m² vinyl removal prep scotia
console.log("\n--- Flooring ---");
const flooringFacts = [
  fact("flooring.area_m2", "f1", 60),
  fact("flooring.type", "f1", "Vinyl"),
  fact("flooring.supply_scope", "f1", "Supply and install"),
  fact("flooring.existing_flooring_removal", "f1", true),
  fact("flooring.floor_prep_level", "f1", "Minor"),
  fact("flooring.scotia_included", "f1", true),
];
const flooring = calculateFlooring(
  { ...baseContext, facts: flooringFacts } as EstimateContext,
  wa("f1", "flooring", "Flooring")
);
assert(labels(flooring.lineItems).includes("Existing flooring removal"), "Flooring: removal");
assert(
  labels(flooring.lineItems).includes("Floor prep/levelling allowance"),
  "Flooring: floor prep"
);
assert(labels(flooring.lineItems).includes("Scotia/skirting allowance"), "Flooring: scotia");
assert(
  flooring.lineItems.find((i) => i.label.includes("materials allowance"))
    ?.materialBuildUp?.buildUpType === "flooring_area",
  "Flooring: area build-up on materials"
);

// Painting — 120m² internal 2 coats minor prep client paint, doors/trims
console.log("\n--- Painting ---");
const paintingFacts = [
  fact("painting.location", "p1", "Internal"),
  fact("painting.internal_area_m2", "p1", 120),
  fact("painting.surfaces", "p1", ["Walls", "Ceilings", "Doors", "Trims"]),
  fact("painting.coats_required", "p1", "2"),
  fact("painting.prep_level", "p1", "Light"),
  fact("painting.paint_client_supplied", "p1", true),
  fact("painting.door_count", "p1", 3),
];
const painting = calculatePainting(
  { ...baseContext, facts: paintingFacts } as EstimateContext,
  wa("p1", "painting", "Painting")
);
assert(labels(painting.lineItems).includes("Painting labour"), "Painting: labour");
assert(
  !labels(painting.lineItems).includes("Paint materials"),
  "Painting: no paint materials when client supplied"
);
assert(
  labels(painting.lineItems).includes("Door painting allowance"),
  "Painting: door allowance when doors in surfaces"
);
assert(
  labels(painting.lineItems).includes("Trim painting allowance"),
  "Painting: trim allowance when trims in surfaces"
);
assert(
  painting.assumptions.some((a) => a.toLowerCase().includes("client")),
  "Painting: client-supplied assumption"
);

// Plastering — Level 4 stop 80m² sand ready
console.log("\n--- Plastering ---");
const plasterFacts = [
  fact("plastering.area_m2", "pl1", 80),
  fact("plastering.level", "pl1", "Level 4"),
  fact("plastering.surface_type", "pl1", "New plasterboard"),
  fact("plastering.sanding_included", "pl1", true),
];
const plastering = calculatePlastering(
  { ...baseContext, facts: plasterFacts } as EstimateContext,
  wa("pl1", "plastering", "Plastering")
);
assert(labels(plastering.lineItems).includes("Plastering labour"), "Plastering: labour");
assert(
  labels(plastering.lineItems).includes("Plastering subcontractor allowance"),
  "Plastering: subcontractor placeholder"
);
assert(labels(plastering.lineItems).includes("Sanding/prep allowance"), "Plastering: sanding");

// Full estimate engine smoke test
console.log("\n--- Full estimate ---");
const fullEstimate = calculateEstimate({
  ...baseContext,
  confirmedWorkAreas: [wa("b1", "bathroom", "Bathroom")],
  facts: bathroomFacts,
} as EstimateContext);
assert(fullEstimate.recommendedSell > 0, "Full estimate: positive total");

console.log("\nInternal calibration batch 2 checks passed.");
