/**
 * Stage 2F — flooring cost ownership.
 *
 * Run: npx tsx scripts/verify-estimating-v3-stage-2f.ts
 */
import type { OrganisationRate, OrganisationSettings } from "../components/setup/types";
import { commercializeFlooring } from "../lib/estimate/flooring-commercial";
import {
  FLOORING_CARPENTER_LABOUR_RATE_KEY,
  FLOORING_VINYL_PLANK_REMOVE_HOURS_PER_M2,
  FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2,
} from "../lib/estimate/flooring-identities";
import { calculateFlooringPhysical } from "../lib/estimate/flooring-physical";
import {
  FLOORING_FINISH_INSTALL_COMPONENT,
  FLOORING_FINISH_INSTALL_HOURS_PER_M2,
  FLOORING_FINISH_SUPPLY_COMPONENT,
  FLOORING_VINYL_SUPPLY_M2,
} from "../lib/estimate/flooring-purchasing";
import {
  FLOORING_PORTIONS_FACT_KEY,
  type FlooringPortion,
} from "../lib/estimate/flooring-portions";
import type { EstimateFact, EstimateLineItemInput, EstimateWorkArea } from "../lib/estimate/types";

const failures: string[] = [];

function check(name: string, ok: boolean, detail?: unknown): void {
  if (ok) {
    console.log(`ok ${name}`);
    return;
  }
  failures.push(name);
  console.error(`FAIL ${name}`, detail ?? "");
}

function rate(
  row: Partial<OrganisationRate> & Pick<OrganisationRate, "item_key" | "rate_type" | "cost_rate" | "unit">
): OrganisationRate {
  return {
    id: row.item_key + row.rate_type,
    trade: null,
    work_area_type: "flooring",
    label: row.item_key,
    sell_rate: row.sell_rate ?? null,
    markup_percent: null,
    active: true,
    ...row,
  };
}

function portion(overrides: Partial<FlooringPortion> = {}): FlooringPortion {
  return {
    id: "hall",
    label: "Hallway",
    finish_type: "vinyl_plank",
    area_input_method: "direct_m2",
    length_m: null,
    width_m: null,
    area_m2: 9.6,
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

function price(
  row: FlooringPortion,
  rates: OrganisationRate[],
  settings: OrganisationSettings | null = null
) {
  const workArea = { id: "flooring", type: "flooring", name: "Flooring" } as EstimateWorkArea;
  const physical = calculateFlooringPhysical({
    facts: [
      {
        id: "fact-1",
        project_id: "project",
        work_area_id: "flooring",
        key: FLOORING_PORTIONS_FACT_KEY,
        value: [row],
        source: "user",
      },
    ] as EstimateFact[],
    workArea,
  });
  const commercial = commercializeFlooring({
    physical,
    workArea,
    rates,
    organisationSettings: settings,
    constraints: [],
  });
  return { physical, commercial };
}

function findLine(items: readonly EstimateLineItemInput[], componentKey: string) {
  return items.find((item) => item.componentKey === componentKey);
}

const labour = rate({
  item_key: FLOORING_CARPENTER_LABOUR_RATE_KEY,
  rate_type: "labour",
  unit: "hour",
  cost_rate: 60,
});
const removalHours = rate({
  item_key: FLOORING_VINYL_PLANK_REMOVE_HOURS_PER_M2,
  rate_type: "productivity",
  unit: "m2",
  cost_rate: 0.1,
});
const installHours = rate({
  item_key: FLOORING_FINISH_INSTALL_HOURS_PER_M2,
  rate_type: "productivity",
  unit: "m2",
  cost_rate: 0.25,
});

const benchmark = price(portion(), [labour, removalHours]);
const packageLine = findLine(benchmark.commercial.lineItems, FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2);
const removalLine = benchmark.commercial.lineItems.find((item) => item.label.includes("finish removal"));
const included = benchmark.commercial.lineItems.filter((item) => item.includedInTotal !== false);
const includedCost = included.reduce((sum, item) => sum + (item.recommendedCost ?? 0), 0);

check("benchmark package quantity is the net area", packageLine?.quantity === 9.6, packageLine);
check("benchmark internal cost is 9.6 x $95", packageLine?.recommendedCost === 912, packageLine);
check("benchmark client sell is the margin on that cost", packageLine?.recommendedSell === 1140, packageLine);
check(
  "benchmark note explains cost, sell and waste",
  /Quantity basis: 9\.6 m²/.test(packageLine?.notes ?? "") &&
    /Internal unit cost \$95\.00/.test(packageLine?.notes ?? "") &&
    /Direct cost \$912\.00/.test(packageLine?.notes ?? "") &&
    /Client sell \$1140\.00/.test(packageLine?.notes ?? "") &&
    /10\.56/.test(packageLine?.notes ?? "") &&
    /not split into material and labour/.test(packageLine?.notes ?? "") &&
    /supply allowance/.test(packageLine?.notes ?? ""),
  packageLine?.notes
);
check(
  "benchmark does not add a supply line",
  findLine(benchmark.commercial.lineItems, FLOORING_FINISH_SUPPLY_COMPONENT) == null
);
check("removal stays on the net area", removalLine?.quantity === 9.6, removalLine);
check(
  "included direct cost is package plus removal only",
  includedCost === (packageLine?.recommendedCost ?? 0) + (removalLine?.recommendedCost ?? 0),
  { includedCost, package: packageLine?.recommendedCost, removal: removalLine?.recommendedCost }
);

const material40 = rate({
  item_key: FLOORING_VINYL_SUPPLY_M2,
  rate_type: "material",
  unit: "m2",
  cost_rate: 40,
});
const material55 = rate({ ...material40, cost_rate: 55, id: "material-55" });
const package80 = rate({
  item_key: FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2,
  rate_type: "subcontractor",
  unit: "m2",
  cost_rate: 80,
});
const undecided = price(portion(), [labour, removalHours, material40, package80]);
const undecidedPackage = findLine(undecided.commercial.lineItems, FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2);
check(
  "a material rate does not create a second supply cost",
  findLine(undecided.commercial.lineItems, FLOORING_FINISH_SUPPLY_COMPONENT) == null &&
    undecidedPackage?.recommendedCost === 768 &&
    undecided.commercial.completeness === "INFORMATION_REQUIRED" &&
    undecided.commercial.missingInfo.some((row) => /not added on top/i.test(row)),
  { cost: undecidedPackage?.recommendedCost, completeness: undecided.commercial.completeness, missing: undecided.commercial.missingInfo }
);

const separateLow = price(portion({ finish_pricing: "separate_supply" }), [
  labour,
  removalHours,
  installHours,
  material40,
  package80,
]);
const separateHigh = price(portion({ finish_pricing: "separate_supply" }), [
  labour,
  removalHours,
  installHours,
  material55,
  package80,
]);
const separateSupply = findLine(separateLow.commercial.lineItems, FLOORING_FINISH_SUPPLY_COMPONENT);
const separateSupplyHigh = findLine(separateHigh.commercial.lineItems, FLOORING_FINISH_SUPPLY_COMPONENT);
const separateInstall = findLine(separateLow.commercial.lineItems, FLOORING_FINISH_INSTALL_COMPONENT);
const separateInstallHigh = findLine(separateHigh.commercial.lineItems, FLOORING_FINISH_INSTALL_COMPONENT);
check(
  "separate material rate changes supply cost only",
  separateSupply?.quantity === 10.56 &&
    separateSupply?.recommendedCost === 422.4 &&
    separateSupplyHigh?.quantity === 10.56 &&
    separateSupplyHigh?.recommendedCost === 580.8 &&
    findLine(separateLow.commercial.lineItems, FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2) == null,
  { low: separateSupply, high: separateSupplyHigh }
);
check(
  "separate installation hours stay on the net area",
  separateInstall?.quantity === 9.6 &&
    separateInstall?.recommendedCost === 144 &&
    separateInstallHigh?.quantity === 9.6 &&
    separateInstallHigh?.recommendedCost === 144,
  { low: separateInstall, high: separateInstallHigh }
);

const customer = price(
  portion({ finish_supplied_by: "customer" }),
  [labour, removalHours, installHours, material40, package80]
);
check(
  "customer supply removes the package purchase",
  findLine(customer.commercial.lineItems, FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2) == null &&
    findLine(customer.commercial.lineItems, FLOORING_FINISH_SUPPLY_COMPONENT)?.includedInTotal === false &&
    findLine(customer.commercial.lineItems, FLOORING_FINISH_SUPPLY_COMPONENT)?.recommendedCost === 0 &&
    !customer.commercial.lineItems.some((item) => item.recommendedCost === 768 || item.recommendedCost === 912) &&
    findLine(customer.commercial.lineItems, FLOORING_FINISH_INSTALL_COMPONENT)?.quantity === 9.6,
  customer.commercial.lineItems.map((item) => [item.label, item.recommendedCost, item.includedInTotal])
);

const project = price(portion({ finish_pricing: "separate_supply" }), [
  labour,
  installHours,
  material40,
  rate({
    item_key: FLOORING_VINYL_SUPPLY_M2,
    rate_type: "project_material",
    unit: "m2",
    cost_rate: 25,
  }),
]);
check(
  "project material override wins over the company material rate",
  findLine(project.commercial.lineItems, FLOORING_FINISH_SUPPLY_COMPONENT)?.recommendedCost === 264,
  findLine(project.commercial.lineItems, FLOORING_FINISH_SUPPLY_COMPONENT)
);

const explicitSell = price(
  portion({ finish_pricing: "combined_package" }),
  [
    labour,
    material40,
    rate({
      item_key: FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2,
      rate_type: "subcontractor",
      unit: "m2",
      cost_rate: 80,
      sell_rate: 150,
    }),
  ]
);
const explicitPackage = findLine(explicitSell.commercial.lineItems, FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2);
check(
  "saved package sell is not reinterpreted as labour",
  explicitPackage?.recommendedCost === 768 &&
    explicitPackage?.recommendedSell === 1440 &&
    explicitPackage?.category === "subcontractor" &&
    /saved sell rate/.test(explicitPackage?.notes ?? "") &&
    findLine(explicitSell.commercial.lineItems, FLOORING_FINISH_SUPPLY_COMPONENT) == null &&
    explicitSell.commercial.completeness !== "INFORMATION_REQUIRED",
  explicitPackage
);

const margin = price(portion(), [labour, removalHours], {
  default_margin_percent: 30,
} as OrganisationSettings);
const marginPackage = findLine(margin.commercial.lineItems, FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2);
check(
  "margin changes client sell and not the package cost",
  marginPackage?.recommendedCost === 912 &&
    marginPackage?.recommendedSell !== 1140 &&
    /30% gross margin/.test(marginPackage?.notes ?? ""),
  { cost: marginPackage?.recommendedCost, sell: marginPackage?.recommendedSell, notes: marginPackage?.notes }
);

if (failures.length > 0) {
  console.error(`failed ${failures.length}`);
  process.exit(1);
}
console.log("passed");
