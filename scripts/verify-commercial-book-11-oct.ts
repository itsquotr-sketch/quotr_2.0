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
import { lineVisibleInEstimateReview } from "../lib/assistant/builder-review/compose";
import { unpricedLabourStatus } from "../lib/assistant/presentation/estimate-ready-layout";
import { unknownCostWithoutClientSell } from "../lib/work-areas/manual-pricing-route";
import { resolveProductivity } from "../lib/estimate/productivity";
import {
  DORMANT_PRODUCTIVITY_KEYS,
  UNRESOLVED_PRODUCTIVITY_KEYS,
} from "../lib/rates/approved-benchmark-review";
import {
  CEILINGS_PORTIONS_FACT_KEY,
  createEmptyCeilingPortion,
} from "../lib/estimate/ceilings-portions";
import {
  DECK_PRODUCTIVITY_RATE_CATALOGUE,
  RETAINING_WALL_PRODUCTIVITY_RATE_CATALOGUE,
} from "../lib/rates/specific-material-catalogue";
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
const unspecifiedCeilings = calculateCeilings(
  ctx(
    [ceilingsArea],
    [
      fact("ceilings.area_m2", "c1", 30),
      fact("ceilings.structure_type", "c1", "Existing structure"),
    ]
  ),
  ceilingsArea
);
report("Ceilings 30 m² unspecified lining", unspecifiedCeilings);
const sheetRate: OrganisationRate = {
  id: "co-sheet",
  rate_type: "material",
  trade: null,
  work_area_type: null,
  item_key: "ceilings.plasterboard.standard.13mm.sheet",
  label: "Company plasterboard sheet",
  unit: "sheet",
  cost_rate: 42,
  sell_rate: null,
  markup_percent: null,
  active: true,
};
const ceilingsWithSheetRate = calculateCeilings(
  ctx(
    [ceilingsArea],
    [
      fact("ceilings.area_m2", "c1", 30),
      fact("ceilings.structure_type", "c1", "Existing structure"),
      fact("ceilings.ceiling_type", "c1", "Plasterboard"),
    ],
    [sheetRate]
  ),
  ceilingsArea
);
report("Ceilings 30 m² plasterboard with a company sheet rate", ceilingsWithSheetRate);
const companyInstallRate: OrganisationRate = {
  id: "co-install",
  rate_type: "productivity",
  trade: null,
  work_area_type: null,
  item_key: "ceilings.labour_hours_per_m2",
  label: "Company flat ceiling install",
  unit: "m²",
  cost_rate: 0.5,
  sell_rate: null,
  markup_percent: null,
  active: true,
};
const ceilingsWithInstallRate = calculateCeilings(
  ctx(
    [ceilingsArea],
    [
      fact("ceilings.area_m2", "c1", 30),
      fact("ceilings.structure_type", "c1", "Existing structure"),
      fact("ceilings.ceiling_type", "c1", "Plasterboard"),
    ],
    [companyInstallRate]
  ),
  ceilingsArea
);
report("Ceilings 30 m² plasterboard with a company area installation rate", ceilingsWithInstallRate);
const nestedPortion = createEmptyCeilingPortion({
  id: "fa_book_ceiling_000000000000000001",
  label: "Lounge",
});
nestedPortion.structure.family = "existing_framing";
nestedPortion.structure.job_scope = "reline_existing_suitable_framing";
nestedPortion.lining.family = "plasterboard";
nestedPortion.lining.plasterboard_product = "standard";
nestedPortion.lining.thickness_mm = 13;
nestedPortion.lining.sheet_length_mm = 3000;
nestedPortion.lining.sheet_width_mm = 1200;
nestedPortion.geometry.mode = "area_only";
nestedPortion.geometry.area_m2 = 30;
nestedPortion.finish.insulation_included = false;
nestedPortion.finish.painting_included = false;
nestedPortion.finish.stopping_included = false;
nestedPortion.finish.demolition_included = false;
nestedPortion.has_bulkheads = false;
const nestedCeilings = calculateCeilings(
  ctx(
    [ceilingsArea],
    [
      {
        key: CEILINGS_PORTIONS_FACT_KEY,
        work_area_id: "c1",
        source: "user",
        value: [nestedPortion],
      },
    ]
  ),
  ceilingsArea
);
report("Ceilings nested 30 m² plasterboard portion", nestedCeilings);

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

const hole = deck.lineItems.find((row) => row.componentKey === "deck.hole.excavate");
const spoil = deck.lineItems.find((row) => row.componentKey === "deck.spoil.destination");
const spoilStatus = unpricedLabourStatus(spoil?.quantity ?? null, spoil?.unit ?? null);
assert(
  "deck hole excavation is priced inside ordinary scope",
  hole?.rateSourceType !== "missing" &&
    hole?.includedInTotal !== false &&
    (hole?.labourHours ?? 0) > 0 &&
    (hole?.recommendedCost ?? 0) > 0 &&
    (hole?.quantity ?? 0) > 0
);
assert(
  "unknown deck spoil destination stays Pricing Required",
  spoil?.rateSourceType === "missing" &&
    spoil.includedInTotal === false &&
    (spoil.recommendedCost ?? 0) === 0 &&
    (spoil.quantity ?? 0) > 0 &&
    lineVisibleInEstimateReview(spoil) &&
    unknownCostWithoutClientSell({
      cost_known: false,
      total_sell: spoil.recommendedSell,
      visible_on_quote: true,
    }) &&
    spoilStatus.includes("Pricing Required")
);
const selectedLining = ceilings.lineItems.find((row) =>
  /plasterboard ceiling lining/i.test(row.label)
);
const selectedLabour = ceilings.lineItems.find((row) =>
  /plasterboard ceiling installation/i.test(row.label)
);
assert(
  "selected plasterboard ceiling is Pricing Required, not the $75/m² allowance",
  !ceilings.lineItems.some((row) => /materials allowance/i.test(row.label)) &&
    selectedLining?.quantity === 30 &&
    selectedLining.unit === "m²" &&
    selectedLining.includedInTotal === false &&
    selectedLining.rateSourceType === "missing" &&
    (selectedLining.recommendedCost ?? 0) === 0 &&
    (selectedLining.recommendedSell ?? 0) === 0 &&
    (selectedLining.notes ?? "").includes("not the $75/m²") &&
    (selectedLining.notes ?? "").includes("number of sheets is unknown") &&
    selectedLabour?.includedInTotal === false &&
    selectedLabour.rateSourceType === "missing" &&
    (selectedLabour.labourHours == null || selectedLabour.labourHours === 0) &&
    (selectedLabour.notes ?? "").includes("0.9 h/m²") &&
    (selectedLabour.notes ?? "").includes("not used") &&
    money(ceilings.lineItems).cost === 0 &&
    money(ceilings.lineItems).sell === 0 &&
    ceilings.missingInfo.some((row) => /sheet size/i.test(row)) &&
    lineVisibleInEstimateReview(selectedLining) &&
    unknownCostWithoutClientSell({
      cost_known: false,
      total_sell: selectedLining.recommendedSell,
      visible_on_quote: true,
    })
);
const provisional = unspecifiedCeilings.lineItems.find((row) =>
  /materials allowance/i.test(row.label)
);
assert(
  "unspecified ceiling keeps an explicit provisional $75/m² package",
  provisional?.quantity === 30 &&
    provisional.recommendedCost === 2250 &&
    provisional.unit === "m²" &&
    (provisional.notes ?? "").includes("Provisional materials package") &&
    (provisional.notes ?? "").includes("not a named lining") &&
    (unspecifiedCeilings.lineItems.find((row) => row.category === "labour")?.notes ?? "").includes(
      "Provisional installation"
    ) &&
    money(unspecifiedCeilings.lineItems).cost === 3870 &&
    money(unspecifiedCeilings.lineItems).sell === 4837.5 &&
    money(unspecifiedCeilings.lineItems).gst === 725.63
);
assert(
  "a company sheet rate is not applied to an uncounted plasterboard ceiling",
  money(ceilingsWithSheetRate.lineItems).cost === 0 &&
    money(ceilingsWithSheetRate.lineItems).sell === 0 &&
    ceilingsWithSheetRate.lineItems.every(
      (row) => row.includedInTotal === false && (row.recommendedCost ?? 0) === 0
    )
);
const companyInstallLabour = ceilingsWithInstallRate.lineItems.find((row) =>
  /installation/i.test(row.label)
);
const companyInstallSheet = ceilingsWithInstallRate.lineItems.find((row) =>
  /lining/i.test(row.label)
);
assert(
  "a company flat installation rate stays priced while the sheet stays unknown",
  companyInstallLabour?.includedInTotal !== false &&
    companyInstallLabour?.rateSourceType === "user_rate" &&
    Math.abs((companyInstallLabour?.labourHours ?? 0) - 15) < 1e-6 &&
    Math.abs((companyInstallLabour?.recommendedCost ?? 0) - 900) < 0.02 &&
    Math.abs((companyInstallLabour?.recommendedSell ?? 0) - 1125) < 0.02 &&
    companyInstallSheet?.includedInTotal === false &&
    companyInstallSheet?.rateSourceType === "missing" &&
    (companyInstallSheet?.recommendedCost ?? 0) === 0 &&
    !ceilingsWithInstallRate.lineItems.some((row) => /materials allowance/i.test(row.label)) &&
    money(ceilingsWithInstallRate.lineItems).cost === 900 &&
    money(ceilingsWithInstallRate.lineItems).sell === 1125 &&
    money(ceilingsWithInstallRate.lineItems).gst === 168.75
);
const nestedSheets = nestedCeilings.lineItems.find((row) =>
  row.itemKey === "sheet.plasterboard.standard.13mm.3000x1200.each"
);
const nestedLabour = nestedCeilings.lineItems.find((row) =>
  row.itemKey === "ceilings.plasterboard.install.hours_per_sheet"
);
assert(
  "nested plasterboard ceiling prices sheets and does not add the flat allowance",
  nestedCeilings.lineItems.length > 0 &&
    !nestedCeilings.lineItems.some((row) => /materials allowance/i.test(row.label)) &&
    nestedSheets?.quantity === 10 &&
    nestedSheets.recommendedCost === 352 &&
    nestedLabour?.quantity === 9 &&
    nestedLabour.labourHours === 3.75 &&
    nestedLabour.recommendedCost === 225 &&
    money(nestedCeilings.lineItems).cost === 652 &&
    money(nestedCeilings.lineItems).sell === 815.15 &&
    money(nestedCeilings.lineItems).gst === 122.27
);
const unmeasuredWall = calculateRetainingWall(
  ctx(
    [rwArea],
    [
      fact("retaining_wall.length_m", "r1", 10),
      fact("retaining_wall.height_m", "r1", 1.2),
      fact("retaining_wall.material", "r1", "Timber"),
      fact("retaining_wall.excavation_required", "r1", true),
    ]
  ),
  rwArea
);
report("Retaining wall 10 m × 1.2 m timber, excavation required, no depth", unmeasuredWall);
const unmeasuredExcavation = unmeasuredWall.lineItems.find(
  (row) => row.componentKey === "retaining_wall.excavation.bulk.labour"
);
const unmeasuredPlant = unmeasuredWall.lineItems.find(
  (row) => row.itemKey === "plant.mini_excavator.day"
);
assert(
  "10 m × 1.2 m wall face stays m² and Pricing Required",
  unmeasuredExcavation?.quantity === 12 &&
    unmeasuredExcavation.unit === "m2" &&
    unmeasuredExcavation.includedInTotal === false &&
    unmeasuredExcavation.rateSourceType === "missing" &&
    (unmeasuredExcavation.recommendedCost ?? 0) === 0 &&
    (unmeasuredExcavation.labourHours == null || unmeasuredExcavation.labourHours === 0) &&
    unmeasuredExcavation.itemKey !== "retaining_wall.excavation.hours_per_m3" &&
    !/m³|m3|hours_per_m3/i.test(unmeasuredExcavation.label) &&
    lineVisibleInEstimateReview(unmeasuredExcavation) &&
    unknownCostWithoutClientSell({
      cost_known: false,
      total_sell: unmeasuredExcavation.recommendedSell,
      visible_on_quote: true,
    }) &&
    Math.abs((unmeasuredPlant?.recommendedCost ?? 0) - 270) < 1e-6 &&
    unmeasuredWall.missingInfo.some((row) => /bank volume/i.test(row)) &&
    money(unmeasuredWall.lineItems).cost === 2730.35 &&
    money(unmeasuredWall.lineItems).sell === 3412.69
);
const measuredWall = calculateRetainingWall(
  ctx(
    [rwArea],
    [
      fact("retaining_wall.length_m", "r1", 10),
      fact("retaining_wall.height_m", "r1", 1.2),
      fact("retaining_wall.material", "r1", "Timber"),
      fact("retaining_wall.excavation_required", "r1", true),
      fact("retaining_wall.excavation_volume_m3", "r1", 4),
    ]
  ),
  rwArea
);
report("Retaining wall 10 m × 1.2 m timber, explicit 4 m³ bank", measuredWall);
const measuredExcavation = measuredWall.lineItems.filter(
  (row) => row.componentKey === "retaining_wall.excavation.bulk.labour"
);
assert(
  "measured bank volume does not also charge the wall-face line",
  measuredExcavation.length === 1 &&
    measuredExcavation[0]?.unit === "m3" &&
    measuredExcavation[0]?.quantity === 4 &&
    measuredExcavation[0]?.includedInTotal !== false &&
    measuredExcavation[0]?.labourHours === 1.67 &&
    measuredExcavation[0]?.recommendedCost === 100.2 &&
    !measuredExcavation.some((row) => /unmeasured bulk excavation/i.test(row.label)) &&
    money(measuredWall.lineItems).cost === 2830.55
);
assert(
  "dormant productivity keys are inactive and not review-required",
  DORMANT_PRODUCTIVITY_KEYS.every((key) => {
    const row = [
      ...DECK_PRODUCTIVITY_RATE_CATALOGUE,
      ...RETAINING_WALL_PRODUCTIVITY_RATE_CATALOGUE,
    ].find((entry) => entry.item_key === key);
    const resolved = resolveProductivity({
      productivityKey: key,
      unit: row?.unit,
      fallbackHoursPerUnit: 9,
      rates: [],
    });
    return (
      row?.calculatorSupport === "inactive" &&
      resolved.hoursPerUnit === 0 &&
      resolved.sourceType === "missing" &&
      !UNRESOLVED_PRODUCTIVITY_KEYS.includes(key as never)
    );
  }) &&
    UNRESOLVED_PRODUCTIVITY_KEYS.includes("retaining_wall.excavation.hours_per_m3")
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
