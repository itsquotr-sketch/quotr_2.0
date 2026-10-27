/**
 * Stage 2E — flooring waste and purchasing quantity.
 *
 * Run: npx tsx scripts/verify-estimating-v3-stage-2e.ts
 */
import type { OrganisationRate } from "../components/setup/types";
import { BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY } from "../lib/estimate/bathroom-identities";
import { commercializeFlooring } from "../lib/estimate/flooring-commercial";
import {
  FLOORING_CARPET_SUPPLY_INSTALL_M2,
  FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2,
  FLOORING_CARPENTER_LABOUR_RATE_KEY,
  FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2,
  FLOORING_SUBSTRATE_MATERIAL_COMPONENT,
  FLOORING_VINYL_PLANK_REMOVE_HOURS_PER_M2,
  FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2,
} from "../lib/estimate/flooring-identities";
import { calculateFlooringPhysical } from "../lib/estimate/flooring-physical";
import { extractFlooringPortionsFromBrief } from "../lib/estimate/flooring-brief";
import {
  FLOORING_FINISH_INSTALL_COMPONENT,
  FLOORING_FINISH_INSTALL_HOURS_PER_M2,
  FLOORING_FINISH_SUPPLY_COMPONENT,
  FLOORING_HARDWOOD_SUPPLY_LM,
  FLOORING_TILE_SUPPLY_EACH,
  FLOORING_VINYL_SUPPLY_M2,
} from "../lib/estimate/flooring-purchasing";
import {
  FLOORING_PORTIONS_FACT_KEY,
  type FlooringPortion,
} from "../lib/estimate/flooring-portions";
import type { EstimateFact, EstimateLineItemInput, EstimateWorkArea } from "../lib/estimate/types";
import { STAGE_2A_THREE_ROOM_FLOORING_BRIEF } from "./fixtures/stage-2a-original-briefs";

const failures: string[] = [];

function near(actual: number | null | undefined, expected: number): boolean {
  return actual != null && Math.abs(actual - expected) < 0.001;
}

function check(name: string, ok: boolean, detail?: unknown): void {
  if (ok) {
    console.log(`ok ${name}`);
    return;
  }
  failures.push(name);
  console.error(`FAIL ${name}`, detail ?? "");
}

function rate(row: Partial<OrganisationRate> & Pick<OrganisationRate, "item_key" | "rate_type" | "cost_rate" | "unit">): OrganisationRate {
  return {
    id: row.item_key,
    trade: null,
    work_area_type: "flooring",
    label: row.item_key,
    sell_rate: row.sell_rate ?? null,
    markup_percent: null,
    active: true,
    ...row,
  };
}

function basePortion(overrides: Partial<FlooringPortion>): FlooringPortion {
  return {
    id: overrides.id ?? "portion-1",
    label: overrides.label ?? "Room",
    finish_type: "vinyl_plank",
    area_input_method: "direct_m2",
    length_m: null,
    width_m: null,
    area_m2: 20,
    underlay_required: null,
    floor_preparation_required: false,
    tile_width_mm: null,
    tile_length_mm: null,
    hardwood_board_width_mm: null,
    substrate_required: false,
    substrate_family: null,
    substrate_item_key: null,
    framing_required: false,
    framing_allowance_level: null,
    finish_removal_required: true,
    existing_finish_type: "vinyl",
    substrate_removal_required: false,
    waste_percent: 10,
    other_description: null,
    specialist_kind: null,
    ...overrides,
  };
}

function price(portion: FlooringPortion, rates: OrganisationRate[]) {
  const workArea = { id: "flooring", type: "flooring", name: "Flooring" } as EstimateWorkArea;
  const facts = [
    {
      id: "fact-1",
      project_id: "project",
      work_area_id: "flooring",
      key: FLOORING_PORTIONS_FACT_KEY,
      value: [portion],
      source: "user",
    },
  ] as EstimateFact[];
  const physical = calculateFlooringPhysical({ facts, workArea });
  const commercial = commercializeFlooring({
    physical,
    workArea,
    rates,
    organisationSettings: null,
    constraints: [],
  });
  return { physical, commercial };
}

function line(items: readonly EstimateLineItemInput[], componentKey: string) {
  return items.find((item) => item.componentKey === componentKey);
}

function qty(items: readonly EstimateLineItemInput[], componentKey: string): number | null {
  const found = items.filter((item) => item.componentKey === componentKey);
  if (found.length === 0) return null;
  return found[0]?.quantity ?? null;
}

const labour = (cost: number) =>
  rate({
    item_key: FLOORING_CARPENTER_LABOUR_RATE_KEY,
    rate_type: "labour",
    unit: "hour",
    cost_rate: cost,
  });
const productivity = (hours: number) =>
  rate({
    item_key: FLOORING_VINYL_PLANK_REMOVE_HOURS_PER_M2,
    rate_type: "productivity",
    unit: "m2",
    cost_rate: hours,
  });
const material = (cost: number) =>
  rate({
    item_key: FLOORING_VINYL_SUPPLY_M2,
    rate_type: "material",
    unit: "m2",
    cost_rate: cost,
  });
const packageRate = (cost: number) =>
  rate({
    item_key: FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2,
    rate_type: "subcontractor",
    unit: "m2",
    cost_rate: cost,
  });

const low = price(basePortion({}), [labour(60), productivity(0.2), material(40), packageRate(80)]);
const highMaterial = price(basePortion({}), [labour(60), productivity(0.2), material(55), packageRate(80)]);
const highProductivity = price(basePortion({}), [labour(60), productivity(0.4), material(40), packageRate(80)]);
const highLabour = price(basePortion({}), [labour(90), productivity(0.2), material(40), packageRate(80)]);
const moreWaste = price(basePortion({ waste_percent: 15 }), [labour(60), productivity(0.2), material(40), packageRate(80)]);
const noWaste = price(basePortion({ waste_percent: null }), [labour(60), productivity(0.2), material(40), packageRate(80)]);
const missingMaterial = price(basePortion({}), [labour(60), productivity(0.2), packageRate(80)]);

const supply = (result: ReturnType<typeof price>) =>
  line(result.commercial.lineItems, FLOORING_FINISH_SUPPLY_COMPONENT);
const removal = (result: ReturnType<typeof price>) =>
  result.commercial.lineItems.find((item) => item.label.includes("finish removal"));
const installPackage = (result: ReturnType<typeof price>) =>
  line(result.commercial.lineItems, FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2);

check("vinyl supply quantity includes 10% once", supply(low)?.quantity === 22, supply(low));
check("vinyl package stays net area", installPackage(low)?.quantity === 20, installPackage(low));
check("removal stays net area", removal(low)?.quantity === 20, removal(low));
check(
  "material rate changes supply cost only",
  supply(low)?.recommendedCost === 880 &&
    supply(highMaterial)?.recommendedCost === 1210 &&
    supply(highMaterial)?.quantity === 22 &&
    installPackage(highMaterial)?.quantity === 20,
  { low: supply(low)?.recommendedCost, high: supply(highMaterial)?.recommendedCost }
);
check(
  "package rate does not change supply quantity",
  installPackage(low)?.recommendedCost === 1600 && supply(low)?.quantity === 22,
  installPackage(low)
);
check(
  "productivity changes removal hours, not supply quantity",
  removal(low)?.productivityRate === 0.2 &&
    removal(highProductivity)?.productivityRate === 0.4 &&
    supply(highProductivity)?.quantity === 22 &&
    removal(highProductivity)?.quantity === 20,
  { low: removal(low), high: removal(highProductivity) }
);
check(
  "labour rate changes removal cost, not hours",
  removal(low)?.productivityRate === removal(highLabour)?.productivityRate &&
    removal(low)?.quantity === removal(highLabour)?.quantity &&
    (removal(highLabour)?.recommendedCost ?? 0) > (removal(low)?.recommendedCost ?? 0),
  { low: removal(low)?.recommendedCost, high: removal(highLabour)?.recommendedCost }
);
check(
  "explicit waste changes supply quantity only",
  supply(moreWaste)?.quantity === 23 &&
    installPackage(moreWaste)?.quantity === 20 &&
    removal(moreWaste)?.quantity === 20,
  supply(moreWaste)
);
check("no stated waste adds no supply line", supply(noWaste) == null && installPackage(noWaste)?.quantity === 20);
check(
  "missing material rate leaves supply unresolved",
  supply(missingMaterial)?.quantity === 22 &&
    supply(missingMaterial)?.rateSourceType === "missing" &&
    (supply(missingMaterial)?.recommendedCost ?? 0) === 0,
  supply(missingMaterial)
);
check(
  "supply formula names net and waste",
  typeof supply(low)?.notes === "string" &&
    supply(low)!.notes!.includes("20.00") &&
    supply(low)!.notes!.includes("10%") &&
    supply(low)!.notes!.includes("22.00"),
  supply(low)?.notes
);

const customer = price(
  basePortion({ finish_supplied_by: "customer", waste_percent: 10 }),
  [
    labour(50),
    material(40),
    packageRate(80),
    rate({
      item_key: FLOORING_FINISH_INSTALL_HOURS_PER_M2,
      rate_type: "productivity",
      unit: "m2",
      cost_rate: 0.25,
    }),
  ]
);
const customerSupply = supply(customer);
const customerInstall = line(customer.commercial.lineItems, FLOORING_FINISH_INSTALL_COMPONENT);
check(
  "customer-supplied finish has no contractor purchasing cost",
  customerSupply?.includedInTotal === false &&
    customerSupply?.recommendedCost === 0 &&
    customerSupply?.quantity === 22 &&
    installPackage(customer) == null,
  customerSupply
);
check(
  "customer-supplied installation remains on the net area",
  customerInstall?.quantity === 20 && (customerInstall?.recommendedCost ?? 0) > 0,
  customerInstall
);

const prep = price(
  basePortion({
    floor_preparation_required: true,
    substrate_required: true,
    substrate_family: "structural_plywood",
    substrate_item_key: BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
    area_m2: 8,
    waste_percent: 10,
  }),
  [labour(60), material(10)]
);
check(
  "preparation and substrate stay on the net area",
  qty(prep.commercial.lineItems, FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2) === 8 &&
    qty(prep.commercial.lineItems, FLOORING_SUBSTRATE_MATERIAL_COMPONENT) === 3 &&
    supply(prep)?.quantity === 8.8,
  prep.commercial.lineItems.map((item) => [item.componentKey, item.quantity, item.label])
);

const tile = price(
  basePortion({
    finish_type: "tile",
    area_m2: 10,
    tile_width_mm: 600,
    tile_length_mm: 600,
    floor_preparation_required: false,
    waste_percent: 10,
    finish_removal_required: false,
    existing_finish_type: null,
    substrate_removal_required: null,
  }),
  []
);
const tileSupply = line(tile.commercial.lineItems, FLOORING_FINISH_SUPPLY_COMPONENT);
check(
  "tile waste rounds whole tiles and leaves the package on net area",
  tileSupply?.quantity === 31 &&
    tileSupply?.unit === "each" &&
    qty(tile.commercial.lineItems, "flooring.tile.supply_install.m2") === 10,
  tileSupply
);

const timber = price(
  basePortion({
    finish_type: "hardwood",
    area_m2: 12,
    hardwood_board_width_mm: 145,
    floor_preparation_required: null,
    waste_percent: 10,
    finish_removal_required: false,
    existing_finish_type: null,
    substrate_removal_required: null,
  }),
  []
);
const timberSupply = line(timber.commercial.lineItems, FLOORING_FINISH_SUPPLY_COMPONENT);
check(
  "hardwood waste is lineal and does not invent a box count",
  timberSupply?.componentKey === FLOORING_FINISH_SUPPLY_COMPONENT &&
    timberSupply?.itemKey === FLOORING_HARDWOOD_SUPPLY_LM &&
    timberSupply?.quantity === 91.03 &&
    timberSupply?.unit === "lm" &&
    /no pack count is invented/i.test(timberSupply?.notes ?? "") &&
    qty(timber.commercial.lineItems, "flooring.hardwood.supply_install.m2") === 12,
  timberSupply
);

const carpet = price(
  basePortion({
    id: "bed-1",
    label: "Bedroom 1",
    finish_type: "carpet",
    area_input_method: "length_width",
    length_m: 3.6,
    width_m: 3.2,
    area_m2: null,
    underlay_required: true,
    floor_preparation_required: null,
    waste_percent: 10,
  }),
  []
);
const carpetSupply = supply(carpet);
check(
  "carpet percentage does not become a priced supply quantity",
    near(carpetSupply?.quantity, 11.52) &&
    carpetSupply?.rateSourceType === "missing" &&
    /cannot be calculated/i.test(carpetSupply?.notes ?? "") &&
    near(qty(carpet.commercial.lineItems, FLOORING_CARPET_SUPPLY_INSTALL_M2), 11.52) &&
    near(qty(carpet.commercial.lineItems, FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2), 11.52) &&
    !carpet.commercial.lineItems.some((item) => item.quantity === 12.67),
  carpet.commercial.lineItems.map((item) => [item.label, item.quantity, item.notes])
);

function answerOpenGates(portion: FlooringPortion): FlooringPortion {
  const next = { ...portion };
  if (next.substrate_required == null) next.substrate_required = false;
  if (next.finish_removal_required === true && next.substrate_removal_required == null) {
    next.substrate_removal_required = false;
  }
  if (next.finish_removal_required === true && next.existing_finish_type == null) {
    next.existing_finish_type = "carpet";
  }
  if (next.finish_type === "vinyl_plank" && next.floor_preparation_required == null) {
    next.floor_preparation_required = false;
  }
  if (next.framing_required == null) next.framing_required = false;
  return next;
}

const extracted = extractFlooringPortionsFromBrief(STAGE_2A_THREE_ROOM_FLOORING_BRIEF).map(
  answerOpenGates
);
const three = price(extracted[0]!, []);
void three;
const threeWorkArea = { id: "flooring", type: "flooring", name: "Flooring" } as EstimateWorkArea;
const threePhysical = calculateFlooringPhysical({
  facts: [
    {
      id: "fact-rooms",
      project_id: "project",
      work_area_id: "flooring",
      key: FLOORING_PORTIONS_FACT_KEY,
      value: extracted,
      source: "user",
    },
  ] as EstimateFact[],
  workArea: threeWorkArea,
});
const threeCommercial = commercializeFlooring({
  physical: threePhysical,
  workArea: threeWorkArea,
  rates: [labour(60), material(40)],
  organisationSettings: null,
  constraints: [],
});

check(
  "three-room identities survive",
  extracted.map((row) => [row.label, row.finish_type, row.waste_percent, row.skirting_replacement_excluded, row.framing_required]).join("|") ===
    "Bedroom 1,carpet,10,true,false|Bedroom 2,carpet,10,true,false|Hallway,vinyl_plank,10,true,false",
  extracted.map((row) => row.label)
);
const hallwaySupply = threeCommercial.lineItems.find(
  (item) => item.componentKey === FLOORING_FINISH_SUPPLY_COMPONENT && item.unit === "m2" && item.quantity === 10.56
);
check(
  "hallway supply is 10.56 m² once",
  hallwaySupply != null &&
    threeCommercial.lineItems.filter((item) => item.quantity === 10.56).length === 1 &&
    /10%/.test(hallwaySupply?.notes ?? "") &&
    /9\.6/.test(hallwaySupply?.notes ?? ""),
  hallwaySupply
);
check(
  "carpet rooms do not price a waste-adjusted area",
  !threeCommercial.lineItems.some((item) => item.quantity === 12.67 || item.quantity === 16.17) &&
    threeCommercial.lineItems.filter((item) => item.componentKey === FLOORING_CARPET_SUPPLY_INSTALL_M2).every((item) => near(item.quantity, 11.52) || near(item.quantity, 14.7)) &&
    threeCommercial.missingInfo.some((row) => /Carpet roll purchasing cannot be calculated/i.test(row)),
  threeCommercial.lineItems.map((item) => [item.label, item.quantity])
);
check(
  "transitions stay unpriced and skirting is not a line",
  threeCommercial.missingInfo.some((row) => /Transition strips/i.test(row)) &&
    !threeCommercial.lineItems.some((item) => /skirting/i.test(item.label)),
  threeCommercial.missingInfo
);

if (failures.length > 0) {
  console.error(`failed ${failures.length}`);
  process.exit(1);
}
console.log("passed");
