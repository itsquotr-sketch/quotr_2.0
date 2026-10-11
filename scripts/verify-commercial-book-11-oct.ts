/**
 * Commercial book for the 11 October approved rates.
 *
 * Benchmark rates only (no company dollar override) unless a case says otherwise.
 * Run: npx tsx scripts/verify-commercial-book-11-oct.ts
 */
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateBathroom } from "../lib/estimate/calculators/bathroom";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import { calculateFence } from "../lib/estimate/calculators/fence";
import {
  calculateCeilings,
  calculateFlooring,
  calculateInternalWalls,
} from "../lib/estimate/calculators/fitout";
import { calculateCladding } from "../lib/estimate/calculators/cladding";
import { calculateRetainingWall } from "../lib/estimate/calculators/retaining-wall";
import { buildBathroomDemolitionEnvelope } from "../lib/estimate/bathroom-demolition";
import type { BathroomGeometryResolution } from "../lib/estimate/bathroom-geometry";
import { aggregateEstimateLines } from "../lib/estimate/estimate-commercial-engine-adapter";
import { resolveProductivity } from "../lib/estimate/productivity";
import { UNRESOLVED_PRODUCTIVITY_KEYS } from "../lib/rates/approved-benchmark-review";
import { applyInternalWallsFactWrite } from "../lib/estimate/internal-walls-wall-types";
import { INTERNAL_WALLS_JOB_SCOPE_FACT_KEY } from "../lib/estimate/internal-walls-scope";
import { INTERNAL_WALLS_ADD_WALL_TYPE_KEY } from "../lib/estimate/internal-walls-wall-types";
import {
  CLADDING_PORTIONS_FACT_KEY,
  createEmptyCladdingPortion,
} from "../lib/estimate/cladding-portions";
import {
  FLOORING_PORTIONS_FACT_KEY,
  createEmptyFlooringPortion,
} from "../lib/estimate/flooring-portions";
import { BATHROOM_GIB_WALL_LINING_HOURS_PER_M2 } from "../lib/rates/approved-benchmark-review";
import type { OrganisationRate } from "../components/setup/types";
import type {
  CalculatorResult,
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "../lib/estimate/types";

let failed = 0;
function assert(name: string, ok: boolean, detail = ""): void {
  if (!ok) {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value, source: "user" };
}

function wa(id: string, type: string, name: string): EstimateWorkArea {
  return { id, type, name, sort_order: 1, status: "confirmed" };
}

function ctx(
  areas: EstimateWorkArea[],
  facts: EstimateFact[],
  rates: OrganisationRate[] = []
): EstimateContext {
  return {
    project: { id: "book", qualityLevel: "standard" },
    confirmedWorkAreas: areas,
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
      deckingWastagePercent: 10,
      defaultMaterialWastagePercent: 10,
      default: 5,
    },
    rates,
  } as unknown as EstimateContext;
}

function money(lines: readonly EstimateLineItemInput[]) {
  const included = lines.filter((row) => row.includedInTotal !== false);
  const cost = included.reduce((sum, row) => sum + (row.recommendedCost ?? 0), 0);
  const sell = included.reduce((sum, row) => sum + (row.recommendedSell ?? 0), 0);
  const unknown = lines.filter(
    (row) => row.rateSourceType === "missing" || row.includedInTotal === false
  );
  return {
    cost: Math.round(cost * 100) / 100,
    sell: Math.round(sell * 100) / 100,
    gst: Math.round(sell * 0.15 * 100) / 100,
    totalIncl: Math.round(sell * 1.15 * 100) / 100,
    unknown: unknown.length,
  };
}

function brief(row: EstimateLineItemInput) {
  return {
    label: row.label,
    qty: row.quantity,
    unit: row.unit,
    hours: row.labourHours ?? null,
    cost: row.recommendedCost ?? 0,
    sell: row.recommendedSell ?? 0,
    source: row.rateSourceType ?? row.rateSource ?? null,
    key: row.itemKey ?? row.componentKey ?? null,
    included: row.includedInTotal !== false,
  };
}

function report(name: string, result: CalculatorResult): void {
  const totals = money(result.lineItems);
  console.log(
    `\n## ${name}\ncost ${totals.cost}  sell ${totals.sell}  gst ${totals.gst}  incl ${totals.totalIncl}  unknownLines ${totals.unknown}`
  );
  for (const row of result.lineItems) {
    const line = brief(row);
    console.log(
      `  ${line.label} | ${line.qty ?? "—"} ${line.unit ?? ""} | h ${line.hours ?? "—"} | cost ${line.cost} | sell ${line.sell} | ${line.source} | ${line.key} | in ${line.included}`
    );
  }
}

const room = [
  fact("bathroom.length_m", "b1", 3),
  fact("bathroom.width_m", "b1", 2.4),
  fact("bathroom.wall_height_m", "b1", 2.4),
];
const bathArea = wa("b1", "bathroom", "Bathroom");

function bathroom(facts: EstimateFact[], rates: OrganisationRate[] = []) {
  return calculateBathroom(ctx([bathArea], facts, rates), bathArea);
}

const gibFacts = [
  fact("bathroom.job_scope", "b1", "full_renovation"),
  ...room,
  fact("bathroom.wall_lining_included", "b1", true),
  fact("bathroom.wall_lining_system", "b1", "GIB Aqualine"),
];
const fibreFacts = [
  fact("bathroom.job_scope", "b1", "full_renovation"),
  ...room,
  fact("bathroom.wall_lining_included", "b1", true),
  fact("bathroom.wall_lining_system", "b1", "Fibre cement"),
];
const unknownFacts = [
  fact("bathroom.job_scope", "b1", "full_renovation"),
  ...room,
  fact("bathroom.wall_lining_included", "b1", true),
  fact("bathroom.wall_lining_system", "b1", "Not sure"),
];

const gib = bathroom(gibFacts);
const fibre = bathroom(fibreFacts);
const unknown = bathroom(unknownFacts);
report("Bathroom GIB wall only", gib);
report("Bathroom 18 mm fibre cement wall", fibre);
report("Bathroom unknown lining", unknown);

const gibWall = gib.lineItems.find((row) => row.componentKey === "bathroom.lining.wall.install");
const gibSheet = gib.lineItems.find((row) => row.componentKey === "bathroom.lining.wall");
const fibreWall = fibre.lineItems.find((row) => row.componentKey === "bathroom.lining.wall.install");
const fibreSheet = fibre.lineItems.find((row) => row.componentKey === "bathroom.lining.wall");
assert(
  "GIB wall labour is 4.5 h at the approved 0.1736 h/m²",
  Math.abs((gibWall?.labourHours ?? 0) - 4.5) < 1e-6,
  String(gibWall?.labourHours)
);
assert(
  "fibre-cement wall labour uses 0.29 h/m²",
  Math.abs((fibreWall?.labourHours ?? 0) - 7.52) < 0.001,
  String(fibreWall?.labourHours)
);
assert(
  "18 mm fibre-cement sheet stays a missing rate with no known cost",
  fibreSheet?.rateSourceType === "missing" &&
    (fibreSheet.recommendedCost ?? 0) === 0 &&
    (fibreSheet.recommendedSell ?? 0) === 0
);
assert(
  "unknown lining does not invent an Aqualine wall sheet",
  !unknown.lineItems.some(
    (row) =>
      row.componentKey === "bathroom.lining.wall" &&
      String(row.itemKey ?? "").includes("aqualine")
  ) &&
    unknown.missingInfo.some((row) => /GIB or fibre cement/i.test(row))
);
assert(
  "GIB sheet is benchmark-priced and included",
  gibSheet?.rateSourceType === "benchmark" && (gibSheet.recommendedCost ?? 0) > 0
);

const wallArea = 2 * (3 + 2.4) * 2.4;
assert("gross wall is 25.92 m² before openings", Math.abs(wallArea - 25.92) < 1e-9);
assert(
  "GIB hours follow 0.5 h per 2.88 m² sheet",
  Math.abs(BATHROOM_GIB_WALL_LINING_HOURS_PER_M2 - 0.5 / 2.88) < 1e-12
);

function geometry(floorAreaM2: number): BathroomGeometryResolution {
  return {
    floorAreaM2,
    ceilingAreaM2: floorAreaM2,
    grossWallAreaM2: 24,
  } as BathroomGeometryResolution;
}

function strip(floorAreaM2: number, components: string[], rates: OrganisationRate[] = []) {
  return buildBathroomDemolitionEnvelope({
    context: ctx(
      [bathArea],
      [
        fact("bathroom.demolition_required", "b1", true),
        fact("bathroom.demolition.components", "b1", components),
      ],
      rates
    ),
    workArea: bathArea,
    geometry: geometry(floorAreaM2),
    accessFactor: 1,
    sortOrderStart: 1,
  });
}

const strip5 = strip(5, ["complete_strip"]);
const strip8 = strip(8, ["complete_strip", "floor_finish", "wall_lining", "bath"]);
const bathOnly = strip(8, ["bath"]);
const floorOnly = strip(8, ["floor_finish"]);
report("Bathroom complete strip 5 m²", strip5);
report("Bathroom complete strip 8 m²", strip8);
report("Bathroom bath-only removal", bathOnly);
report("Bathroom floor-only removal", floorOnly);
const stripLabour = strip5.lineItems.find((row) => row.category === "labour");
assert(
  "5 m² strip is 22.5 h × $60 = $1,350, sell $1,687.50 at 20% gross margin",
  strip5.lineItems.filter((row) => row.category === "labour").length === 1 &&
    Math.abs((stripLabour?.labourHours ?? 0) - 22.5) < 1e-6 &&
    Math.abs((stripLabour?.recommendedCost ?? 0) - 1350) < 0.02 &&
    Math.abs((stripLabour?.recommendedSell ?? 0) - 1350 / 0.8) < 0.02 &&
    Math.abs((stripLabour?.recommendedSell ?? 0) - 1350 * 1.2) > 1
);
assert(
  "8 m² strip is 36 h and suppresses the other selected demolition labour",
  strip8.lineItems.filter((row) => row.category === "labour").length === 1 &&
    Math.abs((strip8.lineItems[0]?.labourHours ?? 0) - 36) < 1e-6
);
assert(
  "bath-only stays 1.5 h",
  Math.abs((bathOnly.lineItems[0]?.labourHours ?? 0) - 1.5) < 1e-6
);
assert(
  "floor-only stays on the floor path",
  floorOnly.lineItems.filter((row) => row.category === "labour").length === 1 &&
    Math.abs((floorOnly.lineItems.find((row) => row.category === "labour")?.labourHours ?? 0) - 2) < 1e-6
);

const overrideRate: OrganisationRate = {
  id: "co-strip",
  rate_type: "productivity",
  trade: null,
  work_area_type: null,
  item_key: "bathroom.demolition.complete_strip.hours_per_m2",
  label: "Company strip",
  unit: "m2",
  cost_rate: 2,
  sell_rate: null,
  markup_percent: null,
  active: true,
};
const overridden = strip(8, ["complete_strip"], [overrideRate]);
assert(
  "company strip override wins",
  Math.abs((overridden.lineItems[0]?.labourHours ?? 0) - 16) < 1e-6
);

let wallFacts: EstimateFact[] = [
  fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "new_partition"),
];
for (const row of [
  { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
  { key: "internal_walls.wall_type.label", value: "Standard partition" },
  { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
  { key: "internal_walls.wall_type.frame_size", value: "90 mm timber framing — 90×45" },
  { key: "internal_walls.wall_type.length_lm", value: 12 },
  { key: "internal_walls.wall_type.height_m", value: 2.4 },
  { key: "internal_walls.wall_type.stud_centres_mm", value: "600 mm" },
  { key: "internal_walls.wall_type.side_a_product", value: "Standard GIB" },
  { key: "internal_walls.wall_type.same_lining_both_sides", value: true },
]) {
  wallFacts = applyInternalWallsFactWrite({
    facts: wallFacts,
    workAreaId: "w1",
    key: row.key,
    value: row.value,
  });
}
const wallsArea = wa("w1", "internal_walls", "Internal walls");
const walls = calculateInternalWalls(ctx([wallsArea], wallFacts), wallsArea);
report("Internal walls 12 m × 2.4 m GIB both sides", walls);

const ceilingsArea = wa("c1", "ceilings", "Ceilings");
const ceilings = calculateCeilings(
  ctx(
    [ceilingsArea],
    [
      fact("ceilings.area_m2", "c1", 30),
      fact("ceilings.structure_type", "c1", "Existing structure"),
      fact("ceilings.ceiling_type", "c1", "Plasterboard"),
    ]
  ),
  ceilingsArea
);
report("Ceilings 30 m² plasterboard on existing structure", ceilings);

const deckArea = wa("d1", "deck", "Deck");
const deckFacts = [
  fact("deck.length_m", "d1", 5),
  fact("deck.width_m", "d1", 4.2),
  fact("deck.area_m2", "d1", 21),
  fact("deck.height_m", "d1", 1),
  fact("deck.level", "d1", "Elevated"),
  fact("deck.board_material", "d1", "Kwila"),
  fact("deck.board_width_mm", "d1", 140),
  fact("deck.substructure_included", "d1", true),
  fact("deck.vertical_face_boards_required", "d1", false),
  fact("deck.existing_deck_removal", "d1", false),
  fact("deck.concrete_to_supports", "d1", false),
];
const deck = calculateDeck(ctx([deckArea], deckFacts), deckArea);
report("Deck 5 × 4.2 m kwila 140 mm", deck);
const kwilaLines = deck.lineItems.filter((row) => row.itemKey === "deck.material.kwila.lm");
assert("kwila boards are charged once", kwilaLines.length === 1, String(kwilaLines.length));
assert(
  "kwila uses the approved $9.77/lm benchmark",
  kwilaLines[0]?.rateSourceType === "benchmark" &&
    Math.abs((kwilaLines[0]?.costRate ?? 0) - 9.77) < 1e-9
);
const fenceArea = wa("f1", "fence", "Fence");
const fence = calculateFence(
  ctx(
    [fenceArea],
    [
      fact("fence.length_m", "f1", 18),
      fact("fence.height_m", "f1", 1.8),
      fact("fence.system", "f1", "Timber paling — vertical board"),
      fact("fence.timber_species", "f1", "Radiata Pine"),
      fact("fence.board_thickness_mm", "f1", "150 × 19mm"),
      fact("fence.post_spacing_m", "f1", 1.8),
      fact("fence.gate_included", "f1", false),
    ]
  ),
  fenceArea
);
report("Fence 18 m × 1.8 m timber paling", fence);
const concreteLines = fence.lineItems.filter((row) =>
  /concrete/i.test(`${row.label} ${row.itemKey ?? ""} ${row.componentKey ?? ""}`)
);
const concreteKeys = new Set(concreteLines.map((row) => row.componentKey ?? row.itemKey));
assert(
  "fence concrete is not charged twice",
  concreteKeys.size === concreteLines.length
);

const rwArea = wa("r1", "retaining_wall", "Retaining wall");
const retaining = calculateRetainingWall(
  ctx(
    [rwArea],
    [
      fact("retaining_wall.length_m", "r1", 10),
      fact("retaining_wall.height_m", "r1", 1.2),
      fact("retaining_wall.material", "r1", "Timber"),
    ]
  ),
  rwArea
);
report("Retaining wall 10 m × 1.2 m timber", retaining);
const excavator = retaining.lineItems.find((row) => row.itemKey === "plant.mini_excavator.day");
assert(
  "mini-excavator uses the approved $270/day, not the old $420 starter",
  Math.abs((excavator?.recommendedCost ?? 0) - 270) < 1e-6,
  String(excavator?.recommendedCost)
);
const companyPlant: OrganisationRate = {
  id: "co-plant",
  rate_type: "material",
  trade: null,
  work_area_type: null,
  item_key: "plant.mini_excavator.day",
  label: "Company excavator",
  unit: "day",
  cost_rate: 500,
  sell_rate: null,
  markup_percent: null,
  active: true,
};
const retainingOverride = calculateRetainingWall(
  ctx(
    [rwArea],
    [
      fact("retaining_wall.length_m", "r1", 10),
      fact("retaining_wall.height_m", "r1", 1.2),
      fact("retaining_wall.material", "r1", "Timber"),
    ],
    [companyPlant]
  ),
  rwArea
);
const overridePlant = retainingOverride.lineItems.find(
  (row) => row.itemKey === "plant.mini_excavator.day"
);
assert(
  "company excavator rate wins over the $270 benchmark",
  Math.abs((overridePlant?.recommendedCost ?? 0) - 500) < 1e-6,
  String(overridePlant?.recommendedCost)
);

const floorArea = wa("fl1", "flooring", "Flooring");
const flooring = calculateFlooring(
  ctx(
    [floorArea],
    [
      {
        key: FLOORING_PORTIONS_FACT_KEY,
        work_area_id: "fl1",
        source: "user",
        value: [
          {
            ...createEmptyFlooringPortion({ id: "fa_book_vinyl_000000000000000001" }),
            label: "Living",
            finish_type: "vinyl_plank",
            area_input_method: "direct_m2",
            area_m2: 16,
            underlay_required: null,
            substrate_required: false,
            framing_required: false,
            finish_removal_required: false,
            floor_preparation_required: true,
          },
        ],
      },
    ]
  ),
  floorArea
);
report("Flooring 16 m² vinyl plank", flooring);

const cladArea = wa("cl1", "cladding", "Cladding");
const cladding = calculateCladding(
  ctx(
    [cladArea],
    [
      {
        key: CLADDING_PORTIONS_FACT_KEY,
        work_area_id: "cl1",
        source: "user",
        value: [
          {
            ...createEmptyCladdingPortion({ id: "bevel-book" }),
            label: "North",
            scope_intent: "install",
            cladding_family: "timber",
            orientation: "horizontal",
            cladding_system: "timber_bevelback",
            approved_profile_id: "timber_bevelback_187x18",
            nominal_width_mm: 187,
            nominal_thickness_mm: 18,
            effective_cover_mm: 155,
            area_method: "direct_m2",
            direct_area_m2: 30,
            openings_already_deducted: true,
            cavity_included: false,
            wall_underlay_or_rab_included: false,
            trims_flashings_corners_included: false,
            existing_cladding_removal_required: false,
            painting_or_coating_included: false,
          },
        ],
      },
    ]
  ),
  cladArea
);
report("Cladding 30 m² timber bevelback", cladding);

const mixed = calculateEstimate(
  ctx(
    [bathArea, deckArea],
    [...gibFacts, ...deckFacts]
  )
);
const mixedMoney = money(mixed.lineItems);
console.log(
  `\n## Mixed Bathroom GIB + Deck\ncost ${mixedMoney.cost}  sell ${mixedMoney.sell}  gst ${mixedMoney.gst}  incl ${mixedMoney.totalIncl}`
);
const mixedKeys = mixed.lineItems.map((row) => `${row.workAreaName}:${row.componentKey ?? row.label}`);
assert(
  "mixed job does not duplicate a component inside one work area",
  mixedKeys.length === new Set(mixedKeys).size
);
const fibreAggregate = aggregateEstimateLines(fibre.lineItems);
assert(
  "missing 18 mm sheet is excluded from the estimate cost total",
  fibreAggregate.recommendedCost ===
    fibre.lineItems
      .filter((row) => row.includedInTotal !== false && row.rateSourceType !== "missing")
      .reduce((sum, row) => sum + (row.recommendedCost ?? 0), 0)
);

const hole = deck.lineItems.find((row) => row.itemKey === "deck.hole.excavate.hours_per_hole");
assert(
  "deck hole excavation stays unresolved and out of the total",
  hole?.rateSourceType === "missing" && hole.includedInTotal === false && (hole.recommendedCost ?? 0) === 0
);
for (const key of UNRESOLVED_PRODUCTIVITY_KEYS) {
  const resolved = resolveProductivity({
    productivityKey: key,
    unit: "each",
    fallbackHoursPerUnit: 9,
    rates: [],
  });
  assert(
    `${key} stays missing rather than a priced zero`,
    resolved.sourceType === "missing" && resolved.hoursPerUnit === 0
  );
}

console.log(failed === 0 ? `\ncommercial book passed` : `\ncommercial book failed ${failed}`);
process.exit(failed === 0 ? 0 : 1);
