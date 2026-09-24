/**
 * CLADDING-06-R1 — ordinary accessory authority.
 *
 * Run: npx --yes tsx scripts/verify-cladding-04c-accessory-authority.ts
 */
import type { OrganisationRate } from "../components/setup/types";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import {
  CLADDING_MATERIAL_BENCHMARKS,
  CLADDING_PRODUCTIVITY_BENCHMARKS,
  resolveCladdingMaterialAuthority,
  resolveCladdingProductivityAuthority,
} from "../lib/estimate/cladding-authority";
import { calculateCladdingPhysical } from "../lib/estimate/cladding-physical";
import {
  CLADDING_CAVITY_INSTALL_HOURS_PER_M2,
  CLADDING_CAVITY_TIMBER_BATTEN_M2,
  CLADDING_RIGID_AIR_BARRIER_INSTALL_HOURS_PER_M2,
  CLADDING_RIGID_AIR_BARRIER_M2,
  CLADDING_TRIMS_UNRESOLVED,
  CLADDING_UNDERLAY_OR_RAB_UNRESOLVED_M2,
  CLADDING_WALL_UNDERLAY_FLEXIBLE_M2,
  CLADDING_WALL_UNDERLAY_INSTALL_HOURS_PER_M2,
} from "../lib/estimate/cladding-identities";
import {
  CLADDING_PORTIONS_FACT_KEY,
  createEmptyCladdingPortion,
  type CladdingPortion,
} from "../lib/estimate/cladding-portions";
import { buildMaterialRegistry } from "../lib/rates/material-registry";
import { buildProductivityRegistry } from "../lib/rates/productivity-registry";
import type { EstimateFact, EstimateWorkArea } from "../lib/estimate/types";

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean): void {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${passed + failed}. ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${passed + failed}. ${name}`);
  }
}
function close(actual: number | null | undefined, expected: number): boolean {
  return actual != null && Math.abs(actual - expected) < 0.02;
}
function rate(overrides: Partial<OrganisationRate> & Pick<OrganisationRate, "item_key" | "rate_type" | "unit" | "cost_rate">): OrganisationRate {
  return {
    id: overrides.id ?? "r1",
    trade: null,
    work_area_type: "cladding",
    label: overrides.item_key,
    sell_rate: null,
    markup_percent: null,
    active: true,
    ...overrides,
  };
}
function portion(overrides: Partial<CladdingPortion>): CladdingPortion {
  return {
    ...createEmptyCladdingPortion({ id: overrides.id ?? "north" }),
    label: "North elevation",
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
    opening_area_m2: 4,
    existing_cladding_removal_required: false,
    painting_or_coating_included: false,
    painting_state: "excluded",
    wall_underlay_or_rab_included: false,
    underlay_state: "excluded",
    trims_flashings_corners_included: false,
    trims_state: "excluded",
    ...overrides,
  };
}
function estimateOf(row: CladdingPortion, rates: OrganisationRate[] = []) {
  const facts: EstimateFact[] = [{ key: CLADDING_PORTIONS_FACT_KEY, work_area_id: "c1", value: [row], source: "user" }];
  return calculateEstimate({
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [{ id: "c1", type: "cladding", name: "Cladding", sort_order: 1 } as EstimateWorkArea],
    facts,
    constraints: [],
    organisationSettings: { allow_benchmark_rates: true, default_margin_percent: 20 },
    materialWastageSettings: { sheet_material: 10, flooring: 10, paint: 10, default: 5 },
    rates,
  });
}

check("cavity material benchmark is 9 per m2", resolveCladdingMaterialAuthority({ identity: CLADDING_CAVITY_TIMBER_BATTEN_M2 }).value === 9);
check("flexible underlay benchmark is 5 per m2", resolveCladdingMaterialAuthority({ identity: CLADDING_WALL_UNDERLAY_FLEXIBLE_M2 }).value === 5);
check("rigid air barrier benchmark is 28 per m2", resolveCladdingMaterialAuthority({ identity: CLADDING_RIGID_AIR_BARRIER_M2 }).value === 28);
check("cavity productivity is 0.15", resolveCladdingProductivityAuthority({ identity: CLADDING_CAVITY_INSTALL_HOURS_PER_M2 }).value === 0.15);
check("underlay productivity is 0.08", resolveCladdingProductivityAuthority({ identity: CLADDING_WALL_UNDERLAY_INSTALL_HOURS_PER_M2 }).value === 0.08);
check("rigid air barrier productivity is 0.18", resolveCladdingProductivityAuthority({ identity: CLADDING_RIGID_AIR_BARRIER_INSTALL_HOURS_PER_M2 }).value === 0.18);
check("the three accessory materials are separate identities", new Set([CLADDING_CAVITY_TIMBER_BATTEN_M2, CLADDING_WALL_UNDERLAY_FLEXIBLE_M2, CLADDING_RIGID_AIR_BARRIER_M2]).size === 3);
check("no priced identity is named wall underlay or rigid air barrier", !CLADDING_MATERIAL_BENCHMARKS.some((row) => /underlay or rigid/i.test(row.label)));
check("accessory productivity rows are registered", CLADDING_PRODUCTIVITY_BENCHMARKS.filter((row) => row.group === "accessory").length === 3);

const gross = portion({ openings_already_deducted: false, opening_area_m2: 4, direct_area_m2: 30 });
const physical = calculateCladdingPhysical({
  facts: [{ key: CLADDING_PORTIONS_FACT_KEY, work_area_id: "c1", value: [portion({ cavity_included: true, cavity_state: "new", wall_underlay_or_rab_included: true, underlay_state: "new", wall_preparation: "flexible_underlay" })], source: "user" }],
  workArea: { id: "c1", type: "cladding" },
});
const cavityQty = physical.requirements.find((row) => row.componentKey === CLADDING_CAVITY_TIMBER_BATTEN_M2);
const underlayQty = physical.requirements.find((row) => row.componentKey === CLADDING_WALL_UNDERLAY_FLEXIBLE_M2);
check("cavity quantity uses net area", cavityQty?.kind === "material" && close(cavityQty.baseQuantity, 30));
const grossPhysical = calculateCladdingPhysical({
  facts: [{ key: CLADDING_PORTIONS_FACT_KEY, work_area_id: "c1", value: [portion({ ...gross, cavity_included: true, cavity_state: "new", wall_underlay_or_rab_included: true, underlay_state: "new", wall_preparation: "flexible_underlay" })], source: "user" }],
  workArea: { id: "c1", type: "cladding" },
});
check("underlay quantity uses gross area", grossPhysical.requirements.find((row) => row.componentKey === CLADDING_WALL_UNDERLAY_FLEXIBLE_M2)?.kind === "material" && close((grossPhysical.requirements.find((row) => row.componentKey === CLADDING_WALL_UNDERLAY_FLEXIBLE_M2) as { baseQuantity?: number }).baseQuantity, 30));
check("cavity still uses net area after an opening deduction", close((grossPhysical.requirements.find((row) => row.componentKey === CLADDING_CAVITY_TIMBER_BATTEN_M2) as { baseQuantity?: number }).baseQuantity, 26));
check("flexible underlay does not emit rigid air barrier", underlayQty != null && !physical.requirements.some((row) => row.componentKey === CLADDING_RIGID_AIR_BARRIER_M2));

const rab = estimateOf(portion({ wall_underlay_or_rab_included: true, underlay_state: "new", wall_preparation: "rigid_air_barrier", cavity_included: false }));
check("rigid air barrier prices separately", close(rab.lineItems.find((row) => row.componentKey === CLADDING_RIGID_AIR_BARRIER_M2)?.recommendedCost, 840));
check("rigid air barrier labour uses carpenter hours", close(rab.lineItems.find((row) => row.componentKey === CLADDING_RIGID_AIR_BARRIER_INSTALL_HOURS_PER_M2)?.recommendedCost, 324));
check("flexible underlay is absent from a rigid-air-barrier section", !rab.lineItems.some((row) => row.componentKey === CLADDING_WALL_UNDERLAY_FLEXIBLE_M2));

const company = estimateOf(
  portion({ cavity_included: true, cavity_state: "new" }),
  [rate({ item_key: CLADDING_CAVITY_TIMBER_BATTEN_M2, rate_type: "material", unit: "m2", cost_rate: 12 })]
);
check("company cavity override wins", close(company.lineItems.find((row) => row.componentKey === CLADDING_CAVITY_TIMBER_BATTEN_M2)?.recommendedCost, 360));
const otherOrg = estimateOf(portion({ cavity_included: true, cavity_state: "new" }), []);
check("another tenant without that override uses Quotr", close(otherOrg.lineItems.find((row) => row.componentKey === CLADDING_CAVITY_TIMBER_BATTEN_M2)?.recommendedCost, 270));
const removed = resolveCladdingMaterialAuthority({
  identity: CLADDING_CAVITY_TIMBER_BATTEN_M2,
  rates: [rate({ item_key: CLADDING_CAVITY_TIMBER_BATTEN_M2, rate_type: "material", unit: "m2", cost_rate: 12, active: false })],
});
check("removing the company row restores Quotr", removed.source === "quotr" && removed.value === 9);
const wrongUnit = resolveCladdingMaterialAuthority({
  identity: CLADDING_WALL_UNDERLAY_FLEXIBLE_M2,
  rates: [rate({ item_key: CLADDING_WALL_UNDERLAY_FLEXIBLE_M2, rate_type: "material", unit: "lm", cost_rate: 50 })],
});
check("a wrong-unit company row does not win", wrongUnit.source === "quotr" && wrongUnit.value === 5);

const retained = estimateOf(portion({ cavity_included: false, cavity_state: "retained", wall_underlay_or_rab_included: false, underlay_state: "retained", trims_flashings_corners_included: false, trims_state: "excluded" }));
check("retained and excluded accessories emit no lines", !retained.lineItems.some((row) => /cavity|underlay|rigid_air|trims/.test(row.componentKey ?? "")));
const custom = estimateOf(portion({ wall_underlay_or_rab_included: true, underlay_state: "new", wall_preparation: "custom" }));
const unsure = estimateOf(portion({ wall_underlay_or_rab_included: true, underlay_state: "new", wall_preparation: "unsure" }));
check("custom wall preparation stays Pricing Required", custom.lineItems.some((row) => row.componentKey === CLADDING_UNDERLAY_OR_RAB_UNRESOLVED_M2 && row.includedInTotal === false));
check("not sure stays Pricing Required", unsure.lineItems.some((row) => row.componentKey === CLADDING_UNDERLAY_OR_RAB_UNRESOLVED_M2 && row.includedInTotal === false && (row.recommendedCost ?? 0) === 0));
const trims = estimateOf(portion({ trims_flashings_corners_included: true, trims_state: "new" }));
const trimLine = trims.lineItems.find((row) => row.componentKey === CLADDING_TRIMS_UNRESOLVED);
check("trims stay unresolved without an invented quantity", trimLine?.includedInTotal === false && (trimLine.quantity == null || trimLine.quantity === 0));
check("trims do not use a lineal allowance", !trims.lineItems.some((row) => row.componentKey === CLADDING_TRIMS_UNRESOLVED && row.unit === "lm" && (row.quantity ?? 0) > 0));

const materials = buildMaterialRegistry({ rates: [] });
const accessories = materials.categories.find((row) => row.categoryId === "cladding")?.families.find((row) => row.familyName === "Cladding accessories");
check("Rates materials show Cladding accessories", (accessories?.ordinaryItems.length ?? 0) === 3);
const productivity = buildProductivityRegistry({ rates: [] });
const ops = productivity.groups.find((row) => row.workAreaType === "cladding");
check("Rates productivity shows three accessory operations", (ops?.ordinaryItems.filter((row) => row.productivityKey.includes(".cavity.") || row.productivityKey.includes(".wall_underlay.") || row.productivityKey.includes(".rigid_air_barrier.")).length ?? 0) === 3);
check("accessory labour does not hardcode a carpenter dollar", !CLADDING_PRODUCTIVITY_BENCHMARKS.some((row) => row.group === "accessory" && /\$\d+/.test(row.description)));
check("cavity exclusions stay in the material description", CLADDING_MATERIAL_BENCHMARKS.find((row) => row.key === CLADDING_CAVITY_TIMBER_BATTEN_M2)?.description.includes("structural framing") === true);
check("company productivity override is independent", resolveCladdingProductivityAuthority({
  identity: CLADDING_CAVITY_INSTALL_HOURS_PER_M2,
  rates: [rate({ item_key: CLADDING_CAVITY_INSTALL_HOURS_PER_M2, rate_type: "productivity", unit: "m2", cost_rate: 0.2 })],
}).value === 0.2);
check("a zero company cavity rate does not win", resolveCladdingMaterialAuthority({
  identity: CLADDING_CAVITY_TIMBER_BATTEN_M2,
  rates: [rate({ item_key: CLADDING_CAVITY_TIMBER_BATTEN_M2, rate_type: "material", unit: "m2", cost_rate: 0 })],
}).value === 9);
check("a negative company cavity rate does not win", resolveCladdingMaterialAuthority({
  identity: CLADDING_CAVITY_TIMBER_BATTEN_M2,
  rates: [rate({ item_key: CLADDING_CAVITY_TIMBER_BATTEN_M2, rate_type: "material", unit: "m2", cost_rate: -1 })],
}).value === 9);
check("turning benchmarks off leaves cavity Pricing Required", resolveCladdingMaterialAuthority({
  identity: CLADDING_CAVITY_TIMBER_BATTEN_M2,
  allowBenchmarkRates: false,
}).value == null);
check("cavity and underlay labour identities stay separate", CLADDING_CAVITY_INSTALL_HOURS_PER_M2 !== CLADDING_WALL_UNDERLAY_INSTALL_HOURS_PER_M2);
check("underlay productivity stays Quotr beside a cavity override", resolveCladdingProductivityAuthority({
  identity: CLADDING_WALL_UNDERLAY_INSTALL_HOURS_PER_M2,
  rates: [rate({ item_key: CLADDING_CAVITY_INSTALL_HOURS_PER_M2, rate_type: "productivity", unit: "m2", cost_rate: 0.2 })],
}).value === 0.08);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
