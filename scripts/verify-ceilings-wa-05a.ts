/**
 * CEILINGS WA-05A — commercial requirements, rate authority, productivity.
 *
 * Run: npx --yes tsx scripts/verify-ceilings-wa-05a.ts
 *
 * Preview only. Nested hosted estimator is wired in WA-05B.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { OrganisationRate, OrganisationSettings } from "../components/setup/types";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { FITOUT_BENCHMARKS } from "../lib/estimate/benchmark-rates";
import {
  aggregateCeilingCommercialLines,
  ceilingCommercialCoverageTable,
  ceilingCommercialOwnsFinishMoney,
  commercializeCeilings,
  quotrCatalogueCost,
  resolveCeilingProductivity,
} from "../lib/estimate/ceilings-commercial";
import {
  CEILINGS_DNA_COVERAGE,
  CEILINGS_PLASTERBOARD_LABOUR,
  CEILINGS_PRODUCTIVITY_KEYS,
  CEILINGS_SPECIALIST_COMPONENT,
  CEILINGS_STOPPING_COMPONENT,
  CEILINGS_PAINTING_COMPONENT,
  CEILINGS_PAINTING_LABOUR,
  CEILINGS_STEEL_DROPPER_LABOUR,
  CEILINGS_TIMBER_FRAMING_LABOUR,
  CEILINGS_WIRE_LABOUR_DECISION,
} from "../lib/estimate/ceilings-identities";
import {
  CEILINGS_FIXINGS_PLASTERBOARD_COMPONENT,
  CEILINGS_TILE_GRID_FIXINGS_DECISION,
} from "../lib/estimate/ceilings-fixings";
import {
  CEILINGS_PLASTERBOARD_COMPONENT,
  CEILINGS_PLYWOOD_COMPONENT,
  CEILINGS_TILE_GRID_GRID_COMPONENT,
  CEILINGS_TILE_GRID_TILE_COMPONENT,
  CEILINGS_TIMBER_LINING_COMPONENT,
} from "../lib/estimate/ceilings-lining";
import { CEILINGS_INSULATION_COMPONENT } from "../lib/estimate/ceilings-insulation";
import { CEILINGS_TIMBER_FRAMING_COMPONENT } from "../lib/estimate/ceilings-framing";
import {
  CEILINGS_STEEL_CLIP_COMPONENT,
  CEILINGS_STEEL_FURRING_COMPONENT,
  CEILINGS_STEEL_PERIMETER_COMPONENT,
  CEILINGS_STEEL_PRIMARY_COMPONENT,
  CEILINGS_SUSPENSION_DROPPER_COMPONENT,
  CEILINGS_SUSPENSION_WIRE_COMPONENT,
} from "../lib/estimate/ceilings-steel";
import {
  CEILINGS_BULKHEAD_FRAMING_TIMBER_COMPONENT,
  CEILINGS_BULKHEAD_LINING_COMPONENT,
} from "../lib/estimate/ceilings-bulkheads";
import {
  calculateCeilingsPhysical,
  ceilingRequirementComponentId,
} from "../lib/estimate/ceilings-physical";
import {
  applyCeilingsFactWrite,
  CEILINGS_NESTED_NOT_CALCULATED_MESSAGE,
  CEILINGS_PORTIONS_FACT_KEY,
  createEmptyCeilingBulkhead,
  createEmptyCeilingPortion,
  hasCanonicalCeilingsPortions,
  type CeilingPortion,
} from "../lib/estimate/ceilings-portions";
import { commercialLinesAggregationCompatible } from "../lib/estimate/commercial-aggregation";
import { INTERNAL_WALLS_STANDARD_13_2400_KEY } from "../lib/estimate/internal-walls-identities";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "../lib/estimate/types";
import type { LabourRequirement, MaterialRequirement } from "../lib/estimate/requirements";
import type { MaterialWastageSettings } from "../lib/settings/material-wastage";
import { listCompanyDnaTasksForWorkArea } from "../lib/company-dna/catalogue";
import { listCompanyDnaFoundationTasksForWorkArea } from "../lib/company-dna/v2-foundation";

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

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function near(actual: number | null | undefined, expected: number, tol = 0.02): boolean {
  return actual != null && Number.isFinite(actual) && Math.abs(actual - expected) <= tol;
}

const P1 = "aaaaaaaa-bbbb-4ccc-8ddd-111111111111";
const P2 = "bbbbbbbb-cccc-4ddd-8eee-222222222222";
const BH1 = "cccccccc-dddd-4eee-8fff-333333333333";

const WASTAGE: MaterialWastageSettings = {
  defaultMaterialWastagePercent: 10,
  sheetMaterialWastagePercent: 10,
  timberFramingWastagePercent: 10,
};

const SETTINGS: OrganisationSettings = {
  id: "s1",
  org_id: "o1",
  default_margin_percent: 20,
  default_contingency_percent: 0,
  budget_rate_factor: 0.9,
  premium_rate_factor: 1.15,
  currency: "NZD",
  country: "NZ",
  region: null,
  onboarding_status: "completed",
  onboarding_step: "completed",
  onboarding_completed_at: null,
  prefer_user_rates: true,
  allow_benchmark_rates: true,
  show_profit_in_estimates: true,
};

function wa(id = "c1", name = "Ceilings"): EstimateWorkArea {
  return { id, type: "ceilings", name, sort_order: 1 };
}

function writePortions(
  portions: CeilingPortion[],
  workAreaId = "c1"
): EstimateFact[] {
  return applyCeilingsFactWrite({
    facts: [],
    workAreaId,
    key: CEILINGS_PORTIONS_FACT_KEY,
    value: portions,
  });
}

function estimateCtx(
  facts: EstimateFact[],
  extraWas: EstimateWorkArea[] = [],
  rates: OrganisationRate[] = []
): EstimateContext {
  const workArea = wa();
  return {
    project: { id: "ceilings-wa-05a", qualityLevel: "standard" },
    confirmedWorkAreas: [workArea, ...extraWas],
    facts,
    constraints: [],
    organisationSettings: SETTINGS,
    materialWastageSettings: WASTAGE,
    rates,
  } as unknown as EstimateContext;
}

function orgRate(
  itemKey: string,
  unit: string,
  cost: number,
  extras?: Partial<OrganisationRate>
): OrganisationRate {
  return {
    id: `rate-${itemKey}`,
    rate_type: "material",
    trade: null,
    work_area_type: "ceilings",
    item_key: itemKey,
    label: itemKey,
    unit,
    cost_rate: cost,
    sell_rate: null,
    markup_percent: null,
    active: true,
    ...extras,
  };
}

function plasterPortion(params?: {
  id?: string;
  length?: number;
  width?: number;
  sheetLength?: number;
  product?: "standard" | "aqualine" | "fyreline";
  insulation?: boolean;
  painting?: boolean;
  stopping?: boolean;
  demolition?: boolean;
}): CeilingPortion {
  const row = createEmptyCeilingPortion({
    id: params?.id ?? P1,
    label: params?.id === P2 ? "Bedroom" : "Lounge",
  });
  row.structure.family = "existing_framing";
  row.structure.job_scope = "reline_existing_suitable_framing";
  row.lining.family = "plasterboard";
  row.lining.plasterboard_product = params?.product ?? "standard";
  row.lining.thickness_mm = 13;
  row.lining.sheet_length_mm = params?.sheetLength ?? 2400;
  row.lining.sheet_width_mm = 1200;
  row.geometry.mode = "length_width";
  row.geometry.length_m = params?.length ?? 4;
  row.geometry.width_m = params?.width ?? 3;
  row.geometry.area_m2 = (params?.length ?? 4) * (params?.width ?? 3);
  row.finish.insulation_included = params?.insulation === true;
  row.finish.painting_included = params?.painting === true;
  row.finish.stopping_included = params?.stopping === true;
  row.finish.demolition_included = params?.demolition === true;
  row.has_bulkheads = false;
  return row;
}

function timberPortion(params?: { id?: string }): CeilingPortion {
  const row = plasterPortion({ id: params?.id, sheetLength: 2400 });
  row.structure.family = "timber_direct_fix";
  row.structure.timber = {
    size: "140x45_h1.2",
    spacing_mm: 450,
    direction: "along_length",
  };
  return row;
}

function steelPortion(params?: {
  id?: string;
  suspended?: boolean;
}): CeilingPortion {
  const row = plasterPortion({ id: params?.id, sheetLength: 2400 });
  row.structure.family = params?.suspended ? "suspended_steel" : "steel_direct_fix";
  row.structure.steel = {
    primary_spacing_mm: 450,
    furring_spacing_mm: 450,
    direction: "along_length",
  };
  if (params?.suspended) {
    row.structure.suspended = {
      drop_height_m: 0.6,
      max_spacing_m: 1.2,
      edge_offset_m: 0.2,
    };
  }
  return row;
}

function plywoodPortion(): CeilingPortion {
  const row = plasterPortion();
  row.lining.family = "plywood";
  row.lining.plywood_spec = "generic";
  row.lining.sheet_length_mm = 2400;
  row.lining.sheet_width_mm = 1200;
  return row;
}

function liningPortion(): CeilingPortion {
  const row = plasterPortion({ length: 4, width: 3 });
  row.lining.family = "timber_lined";
  row.lining.timber_lined = {
    board_width_mm: 90,
    gap_mm: 10,
    direction: "along_length",
  };
  return row;
}

function tilePortion(): CeilingPortion {
  const row = plasterPortion({ length: 4, width: 3 });
  row.lining.family = "tile_and_grid";
  row.lining.tile = { size: "600x600" };
  return row;
}

function runCommercial(
  portions: CeilingPortion[],
  rates: OrganisationRate[] = [],
  workArea = wa()
) {
  const facts = writePortions(portions, workArea.id);
  const physical = calculateCeilingsPhysical({
    facts,
    workArea,
    materialWastageSettings: WASTAGE,
  });
  const commercial = commercializeCeilings({
    physical,
    workArea,
    rates,
    organisationSettings: SETTINGS,
  });
  return { facts, physical, commercial };
}

function material(
  requirements: readonly { kind: string; componentKey: string }[],
  componentKey: string
): MaterialRequirement | undefined {
  return requirements.find(
    (row) => row.kind === "material" && row.componentKey === componentKey
  ) as MaterialRequirement | undefined;
}

function labour(
  requirements: readonly { kind: string; componentKey: string }[],
  componentKey: string
): LabourRequirement | undefined {
  return requirements.find(
    (row) => row.kind === "labour" && row.componentKey === componentKey
  ) as LabourRequirement | undefined;
}

function lineItem(
  overrides: Partial<EstimateLineItemInput> & Pick<EstimateLineItemInput, "label">
): EstimateLineItemInput {
  return {
    workAreaId: "c1",
    workAreaName: "Ceilings",
    category: "materials",
    recommendedCost: 10,
    recommendedSell: 12.5,
    grossProfit: 2.5,
    marginPercent: 20,
    markupPercent: 25,
    costLow: 10,
    costHigh: 10,
    sellLow: 12.5,
    sellHigh: 12.5,
    rateSource: "Quotr benchmark",
    rateSourceType: "benchmark",
    sortOrder: 1,
    quantity: 5,
    unit: "each",
    itemKey: INTERNAL_WALLS_STANDARD_13_2400_KEY,
    includedInTotal: true,
    ...overrides,
  };
}

console.log("=== CEILINGS WA-05A commercial layer ===\n");

const pb = runCommercial([plasterPortion()]);
const pbMat = material(pb.commercial.requirements, CEILINGS_PLASTERBOARD_COMPONENT)!;
check(
  "A physical purchase quantity feeds cost resolution",
  pbMat.priced === true &&
    pbMat.purchaseQuantity > pbMat.baseQuantity &&
    near(pbMat.unitCost, FITOUT_BENCHMARKS.plasterboardSheet.cost) &&
    near(pbMat.totalCost ?? -1, pbMat.purchaseQuantity * FITOUT_BENCHMARKS.plasterboardSheet.cost)
);
check(
  "B waste is not reapplied commercially",
  pbMat.wasteFactor > 0 &&
    pbMat.purchaseQuantity > pbMat.baseQuantity &&
    near(pbMat.totalCost ?? -1, pbMat.purchaseQuantity * (pbMat.unitCost ?? 0)) &&
    !near(pbMat.totalCost ?? -1, pbMat.baseQuantity * (pbMat.unitCost ?? 0) * (1 + pbMat.wasteFactor))
);

const timber = runCommercial([timberPortion()]);
const timberLab = labour(timber.commercial.requirements, CEILINGS_TIMBER_FRAMING_LABOUR)!;
const timberMat = material(timber.commercial.requirements, CEILINGS_TIMBER_FRAMING_COMPONENT)!;
check(
  "C timber framing productivity uses installed LM",
  timberLab.productivityBasis.unit === "lm" &&
    near(timberLab.productivityBasis.quantity, timberMat.baseQuantity) &&
    timberMat.baseQuantity === timberMat.purchaseQuantity
);

const pbLab = labour(pb.commercial.requirements, CEILINGS_PLASTERBOARD_LABOUR)!;
check(
  "D plasterboard productivity uses installed sheets",
  pbLab.productivityBasis.unit === "sheet" &&
    near(pbLab.productivityBasis.quantity, pbMat.baseQuantity) &&
    pbLab.productivityBasis.quantity !== pbMat.purchaseQuantity
);

const ply = runCommercial([plywoodPortion()]);
const plyMat = material(ply.commercial.requirements, CEILINGS_PLYWOOD_COMPONENT)!;
const plyLab = labour(ply.commercial.requirements, "ceilings.plywood.install")!;
check(
  "E plywood uses installed sheets",
  plyLab.productivityBasis.unit === "sheet" &&
    near(plyLab.productivityBasis.quantity, plyMat.baseQuantity) &&
    plyMat.priced === true &&
    near(plyMat.unitCost, FITOUT_BENCHMARKS.plywoodSheet.cost)
);

const lined = runCommercial([liningPortion()]);
const liningMat = material(lined.commercial.requirements, CEILINGS_TIMBER_LINING_COMPONENT)!;
const liningLab = labour(lined.commercial.requirements, "ceilings.timber_lining.install")!;
check(
  "F timber lining uses installed LM",
  liningLab.productivityBasis.unit === "lm" &&
    near(liningLab.productivityBasis.quantity, liningMat.baseQuantity)
);

const tiles = runCommercial([tilePortion()]);
const gridMat = material(tiles.commercial.requirements, CEILINGS_TILE_GRID_GRID_COMPONENT)!;
const tileMat = material(tiles.commercial.requirements, CEILINGS_TILE_GRID_TILE_COMPONENT)!;
const gridLab = labour(tiles.commercial.requirements, "ceilings.grid.install")!;
const tileLab = labour(tiles.commercial.requirements, "ceilings.tile.install")!;
check(
  "G grid uses installed m²",
  gridLab.productivityBasis.unit === "m2" &&
    near(gridLab.productivityBasis.quantity, gridMat.baseQuantity)
);
check(
  "H tiles use installed each",
  tileLab.productivityBasis.unit === "each" &&
    near(tileLab.productivityBasis.quantity, tileMat.baseQuantity) &&
    tileMat.purchaseQuantity >= tileMat.baseQuantity
);

const steel = runCommercial([steelPortion()]);
check(
  "I steel perimeter uses installed LM",
  near(
    labour(steel.commercial.requirements, "ceilings.steel.perimeter_track.install")
      ?.productivityBasis.quantity,
    material(steel.commercial.requirements, CEILINGS_STEEL_PERIMETER_COMPONENT)?.baseQuantity
  )
);
check(
  "J primary uses installed LM",
  near(
    labour(steel.commercial.requirements, "ceilings.steel.primary_channel.install")
      ?.productivityBasis.quantity,
    material(steel.commercial.requirements, CEILINGS_STEEL_PRIMARY_COMPONENT)?.baseQuantity
  )
);
check(
  "K furring uses installed LM",
  near(
    labour(steel.commercial.requirements, "ceilings.steel.furring_channel.install")
      ?.productivityBasis.quantity,
    material(steel.commercial.requirements, CEILINGS_STEEL_FURRING_COMPONENT)?.baseQuantity
  )
);
check(
  "L clips use installed each",
  near(
    labour(steel.commercial.requirements, "ceilings.steel.crossover_clip.install")
      ?.productivityBasis.quantity,
    material(steel.commercial.requirements, CEILINGS_STEEL_CLIP_COMPONENT)?.baseQuantity
  )
);

const suspended = runCommercial([steelPortion({ suspended: true })]);
const dropperLab = labour(suspended.commercial.requirements, CEILINGS_STEEL_DROPPER_LABOUR)!;
const wireMat = material(suspended.commercial.requirements, CEILINGS_SUSPENSION_WIRE_COMPONENT)!;
const wireLab = labour(suspended.commercial.requirements, "ceilings.suspension.wire.install");
check(
  "M droppers use installed each",
  near(
    dropperLab.productivityBasis.quantity,
    material(suspended.commercial.requirements, CEILINGS_SUSPENSION_DROPPER_COMPONENT)
      ?.baseQuantity
  )
);
check(
  "N wire labour is not double-counted",
  wireLab == null &&
    wireMat != null &&
    suspended.commercial.wireLabourDecision === CEILINGS_WIRE_LABOUR_DECISION &&
    !suspended.commercial.requirements.some(
      (row) =>
        row.kind === "labour" &&
        row.componentKey.toLowerCase().includes("wire")
    )
);

const withBh = plasterPortion();
const bh = createEmptyCeilingBulkhead({ id: BH1, label: "Downstand" });
bh.form = "conventional_two_face_downstand";
bh.topology = "conventional_two_face_downstand";
bh.length_m = 4;
bh.depth_m = 0.4;
bh.height_m = 0.3;
bh.framing_type = "timber";
bh.lining_type = "standard";
bh.thickness_mm = 13;
withBh.has_bulkheads = true;
withBh.bulkheads = [bh];
const bulk = runCommercial([withBh]);
const bhFrame = material(bulk.commercial.requirements, CEILINGS_BULKHEAD_FRAMING_TIMBER_COMPONENT)!;
const bhLining = material(bulk.commercial.requirements, CEILINGS_BULKHEAD_LINING_COMPONENT)!;
check(
  "O bulkhead framing keeps componentId",
  ceilingRequirementComponentId(bhFrame) === BH1 &&
    bulk.commercial.lineItems.some(
      (item) =>
        item.componentKey === CEILINGS_BULKHEAD_FRAMING_TIMBER_COMPONENT &&
        item.componentId === BH1
    )
);
check(
  "P bulkhead lining keeps componentId",
  ceilingRequirementComponentId(bhLining) === BH1 &&
    bulk.commercial.lineItems.some(
      (item) =>
        item.componentKey === CEILINGS_BULKHEAD_LINING_COMPONENT &&
        item.componentId === BH1
    )
);

const insulated = runCommercial([plasterPortion({ insulation: true })]);
const insMat = material(insulated.commercial.requirements, CEILINGS_INSULATION_COMPONENT)!;
check(
  "Q insulation material unspecified → Pricing Required, not $0",
  insMat.priced === false &&
    insMat.unitCost == null &&
    insMat.totalCost == null &&
    insMat.materialKey == null &&
    insMat.purchaseQuantity === 12 &&
    insulated.commercial.lineItems.some(
      (item) =>
        item.componentKey === CEILINGS_INSULATION_COMPONENT &&
        item.rateSourceType === "missing" &&
        item.recommendedSell === 0 &&
        item.sellDerivedFromMargin !== true
    )
);

const specialist = plasterPortion();
specialist.specialist_kind = "coffered";
const spec = runCommercial([specialist]);
check(
  "R unsupported specialist → Pricing Required",
  spec.commercial.completeness === "UNSUPPORTED_SPECIALIST" &&
    spec.commercial.requirements.some(
      (row) =>
        row.componentKey === CEILINGS_SPECIALIST_COMPONENT &&
        row.priced === false &&
        row.totalCost == null
    ) &&
    spec.commercial.lineItems.some(
      (item) =>
        item.componentKey === CEILINGS_SPECIALIST_COMPONENT &&
        item.rateSourceType === "missing"
    )
);

const companyPb = runCommercial(
  [plasterPortion()],
  [orgRate(INTERNAL_WALLS_STANDARD_13_2400_KEY, "each", 30)]
);
const companyPbMat = material(companyPb.commercial.requirements, CEILINGS_PLASTERBOARD_COMPONENT)!;
check(
  "S company material rate overrides Quotr fallback",
  companyPbMat.priced === true &&
    near(companyPbMat.unitCost, 30) &&
    companyPbMat.rateSource === "company" &&
    near(pbMat.unitCost, 18)
);

const companyProd = runCommercial(
  [plasterPortion()],
  [
    orgRate(CEILINGS_PRODUCTIVITY_KEYS.plasterboardSheet, "sheet", 0.55, {
      rate_type: "productivity",
    }),
  ]
);
const companyPbLab = labour(companyProd.commercial.requirements, CEILINGS_PLASTERBOARD_LABOUR)!;
check(
  "T company productivity overrides Quotr productivity",
  companyPbLab.priced === true &&
    near(companyPbLab.productivityBasis.hoursPerUnit, 0.55) &&
    companyPbLab.rateProvenance === "company" &&
    pbLab.priced === true &&
    near(pbLab.productivityBasis.hoursPerUnit, 0.5) &&
    resolveCeilingProductivity({
      productivityKey: CEILINGS_PRODUCTIVITY_KEYS.plasterboardSheet,
      unit: "sheet",
      rates: [],
    }).source === "benchmark"
);

const liningPrimary = lined.commercial.lineItems.find(
  (item) => item.componentKey === CEILINGS_TIMBER_LINING_COMPONENT
)!;
const steelPrimary = material(steel.commercial.requirements, CEILINGS_STEEL_PRIMARY_COMPONENT)!;
check(
  "U no matching timber-lining rate → Pricing Required",
  liningMat.priced === false &&
    liningMat.rateSource === "missing" &&
    quotrCatalogueCost("timber.lining.profile.lm") == null
);

check(
  "V ordinary steel material now resolves independently of labour",
  steelPrimary.priced === true &&
    near(steelPrimary.unitCost, 7.25) &&
    steelPrimary.rateSource === "benchmark" &&
    labour(steel.commercial.requirements, "ceilings.steel.primary_channel.install")
      ?.priced === true
);

const timberHours = runCommercial(
  [timberPortion()],
  [
    orgRate(CEILINGS_PRODUCTIVITY_KEYS.timberFramingLm, "lm", 0.2, {
      rate_type: "productivity",
    }),
  ]
);
const timberHoursLab = labour(timberHours.commercial.requirements, CEILINGS_TIMBER_FRAMING_LABOUR)!;
check(
  "W labour cost = person-hours × cost rate",
  timberHoursLab.priced === true &&
    near(
      timberHoursLab.totalCost ?? -1,
      timberHoursLab.adjustedHours * (timberHoursLab.hourlyCost ?? 0)
    ) &&
    near(timberHoursLab.hourlyCost, 60) &&
    near(
      timberHoursLab.adjustedHours,
      timberHoursLab.productivityBasis.quantity * 0.2
    )
);

const pbSell = pb.commercial.lineItems.find(
  (item) => item.componentKey === CEILINGS_PLASTERBOARD_COMPONENT
)!;
check(
  "X sell follows existing GM authority when cost resolved",
  pbMat.priced === true &&
    pbSell.sellAuthority === "derived_from_gross_margin" &&
    near(pbSell.sellRate ?? -1, FITOUT_BENCHMARKS.plasterboardSheet.cost / 0.8)
);

check(
  "Y Pricing Required line does not invent sell",
  liningPrimary.rateSourceType === "missing" &&
    liningPrimary.sellDerivedFromMargin !== true &&
    liningPrimary.sellAuthority == null &&
    liningPrimary.recommendedSell === 0
);

const a = plasterPortion({ id: P1, length: 3, width: 3 });
const b = plasterPortion({ id: P2, length: 6, width: 4 });
const summed = runCommercial([a, b]);
const aPhysical = calculateCeilingsPhysical({
  facts: writePortions([plasterPortion({ id: P1, length: 3, width: 3 })]),
  workArea: wa(),
  materialWastageSettings: WASTAGE,
});
const bPhysical = calculateCeilingsPhysical({
  facts: writePortions([plasterPortion({ id: P2, length: 6, width: 4 })]),
  workArea: wa(),
  materialWastageSettings: WASTAGE,
});
const aQty = material(aPhysical.requirements, CEILINGS_PLASTERBOARD_COMPONENT)!.purchaseQuantity;
const bQty = material(bPhysical.requirements, CEILINGS_PLASTERBOARD_COMPONENT)!.purchaseQuantity;
const summedLine = summed.commercial.lineItems.find(
  (item) => item.componentKey === CEILINGS_PLASTERBOARD_COMPONENT
)!;
check(
  "Z same-product compatible Portion materials SUM",
  near(summedLine.quantity ?? 0, aQty + bQty) &&
    aQty > 0 &&
    bQty > 0
);

const constructedFiveSeven = aggregateCeilingCommercialLines([
  lineItem({ label: "A", quantity: 5, recommendedCost: 90, recommendedSell: 112.5, nestedItemId: P1 }),
  lineItem({ label: "B", quantity: 7, recommendedCost: 126, recommendedSell: 157.5, nestedItemId: P2 }),
]);
check(
  "Z 5+7 constructed same-product SUM to 12",
  constructedFiveSeven.length === 1 &&
    near(constructedFiveSeven[0]!.quantity ?? 0, 12)
);

const incompatibleAuthority = aggregateCeilingCommercialLines([
  lineItem({ label: "company", rateSource: "Your company rate", rateSourceType: "user_rate" }),
  lineItem({
    label: "benchmark",
    rateSource: "Quotr benchmark",
    rateSourceType: "benchmark",
    quantity: 7,
  }),
]);
check(
  "AA same material with incompatible rate authority does NOT incorrectly merge",
  incompatibleAuthority.length === 2 &&
    !commercialLinesAggregationCompatible(incompatibleAuthority[0]!, incompatibleAuthority[1]!)
);

const manualOverride = aggregateCeilingCommercialLines([
  lineItem({
    label: "manual",
    rateSource: "Your work area rate",
    rateSourceType: "work_area_rate",
    sellAuthority: "explicit_sell_override",
    quantity: 5,
  }),
  lineItem({
    label: "company",
    rateSource: "Your company rate",
    rateSourceType: "user_rate",
    quantity: 7,
  }),
]);
check(
  "AB same material with manual override does NOT incorrectly merge",
  manualOverride.length === 2
);

const wa2 = wa("c2", "Ceilings garage");
const repeatedA = runCommercial([plasterPortion({ id: P1 })], [], wa());
const repeatedB = runCommercial([plasterPortion({ id: P1 })], [], wa2);
const crossed = aggregateCeilingCommercialLines([
  ...repeatedA.commercial.lineItems.filter(
    (item) => item.componentKey === CEILINGS_PLASTERBOARD_COMPONENT
  ),
  ...repeatedB.commercial.lineItems.filter(
    (item) => item.componentKey === CEILINGS_PLASTERBOARD_COMPONENT
  ),
]);
check(
  "AC repeated Work Areas do not cross-merge incorrectly",
  crossed.length === 2 &&
    crossed[0]!.workAreaId === "c1" &&
    crossed[1]!.workAreaId === "c2"
);

const finishFlags = runCommercial([
  plasterPortion({ painting: true, stopping: true, demolition: true }),
]);
check(
  "AD Painting ownership does not duplicate package money",
  !finishFlags.commercial.lineItems.some((item) => ceilingCommercialOwnsFinishMoney(item)) &&
    finishFlags.commercial.requirements.some(
      (row) => row.componentKey === CEILINGS_PAINTING_COMPONENT
    ) &&
    finishFlags.commercial.requirements.some(
      (row) => row.componentKey === CEILINGS_PAINTING_LABOUR
    ) &&
    !finishFlags.commercial.requirements.some(
      (row) =>
        /paint/i.test(row.componentKey) &&
        row.componentKey !== CEILINGS_PAINTING_COMPONENT &&
        row.componentKey !== CEILINGS_PAINTING_LABOUR
    ) &&
    !finishFlags.commercial.lineItems.some((item) =>
      /^ceiling painting$/i.test(item.label)
    )
);
check(
  "AE Plastering ownership does not duplicate package money",
  finishFlags.commercial.requirements.some(
    (row) => row.componentKey === CEILINGS_STOPPING_COMPONENT
  ) &&
    !finishFlags.commercial.requirements.some(
      (row) =>
        /stop/i.test(row.componentKey) &&
        row.componentKey !== CEILINGS_STOPPING_COMPONENT
    ) &&
    !read("lib/estimate/ceilings-commercial.ts").includes("FITOUT_BENCHMARKS") &&
    !read("lib/estimate/ceilings-commercial.ts").includes("stoppingPerM2")
);
check(
  "AF Demolition ownership does not duplicate money",
  !finishFlags.commercial.requirements.some((row) =>
    /demo|removal/i.test(row.componentKey)
  ) &&
    !finishFlags.commercial.lineItems.some((item) =>
      /existing ceiling removal/i.test(item.label)
    )
);

const legacyFacts: EstimateFact[] = [
  { key: "ceilings.area_m2", work_area_id: "c1", value: 30 },
  { key: "ceilings.structure_type", work_area_id: "c1", value: "Existing structure" },
  { key: "ceilings.ceiling_type", work_area_id: "c1", value: "Plasterboard" },
];
const legacyEstimate = calculateEstimate(estimateCtx(legacyFacts));
check(
  "AG legacy flat Ceiling calculator unchanged",
  !hasCanonicalCeilingsPortions(legacyFacts, "c1") &&
    legacyEstimate.lineItems.length > 0 &&
    !legacyEstimate.missingInfo.some((row) =>
      row.includes(CEILINGS_NESTED_NOT_CALCULATED_MESSAGE)
    ) &&
    read("lib/estimate/calculators/fitout.ts").includes("LEGACY CEILINGS CALCULATOR") &&
    read("lib/estimate/calculators/fitout.ts").includes("FITOUT_BENCHMARKS.ceilingsPerM2")
);

const nestedHosted = calculateEstimate(estimateCtx(writePortions([plasterPortion()])));
check(
  "AH nested hosted Ceiling uses the new commercial engine",
  nestedHosted.lineItems.length > 0 &&
    !nestedHosted.missingInfo.some((row) =>
      row.includes(CEILINGS_NESTED_NOT_CALCULATED_MESSAGE)
    ) &&
    read("lib/estimate/calculators/fitout.ts").includes("commercializeCeilings") &&
    read("lib/estimate/calculators/fitout.ts").includes("calculateCeilingsPhysical")
);

const dim3000 = runCommercial([plasterPortion({ sheetLength: 3000 })]);
const dimMat = material(dim3000.commercial.requirements, CEILINGS_PLASTERBOARD_COMPONENT)!;
check(
  "dimensioned 3000×1200 Standard derives from 2400×1200 Quotr COST",
  dimMat.materialKey === "sheet.plasterboard.standard.13mm.3000x1200.each" &&
    dimMat.priced === true &&
    near(dimMat.unitCost, 22.5) &&
    dimMat.conversion?.basis === "quotr_derived_same_family_thickness_2400x1200"
);

const timber140 = material(timber.commercial.requirements, CEILINGS_TIMBER_FRAMING_COMPONENT)!;
check(
  "140×45 framing uses provisional Quotr COST without company rate",
  timber140.materialKey === "timber.framing.140x45.h1.2.lm" &&
    timber140.priced === true &&
    near(timber140.unitCost, 9.65)
);

const timberCompany = runCommercial(
  [timberPortion()],
  [orgRate("timber.framing.140x45.h1.2.lm", "lm", 9.4)]
);
check(
  "company rate prices 140×45 framing",
  material(timberCompany.commercial.requirements, CEILINGS_TIMBER_FRAMING_COMPONENT)?.unitCost ===
    9.4
);

const steelCompany = runCommercial(
  [steelPortion()],
  [orgRate("steel.ceiling.perimeter_track.lm", "lm", 12.5)]
);
check(
  "company rate prices new Ceiling-specific steel identity",
  near(
    material(steelCompany.commercial.requirements, CEILINGS_STEEL_PERIMETER_COMPONENT)?.unitCost,
    12.5
  )
);

check(
  "tile/grid has no second fixings line",
  !tiles.commercial.requirements.some((row) =>
    row.componentKey.includes("fixings") &&
    (row.componentKey.includes("tile") || row.componentKey.includes("grid"))
  ) &&
    read("lib/estimate/ceilings-fixings.ts").includes(CEILINGS_TILE_GRID_FIXINGS_DECISION)
);

check(
  "plasterboard fixings resolve at Quotr $2.50/m²",
  material(pb.commercial.requirements, CEILINGS_FIXINGS_PLASTERBOARD_COMPONENT)?.priced ===
    true &&
    near(
      material(pb.commercial.requirements, CEILINGS_FIXINGS_PLASTERBOARD_COMPONENT)
        ?.unitCost,
      2.5
    )
);

check(
  "no Ceiling DNA tasks",
  listCompanyDnaFoundationTasksForWorkArea("ceilings").length === 0 &&
    listCompanyDnaTasksForWorkArea("ceilings").length === 0 &&
    pb.commercial.dnaCoverage === CEILINGS_DNA_COVERAGE
);

check(
  "bathroom ceiling DNA is not reused",
  resolveCeilingProductivity({
    productivityKey: CEILINGS_PRODUCTIVITY_KEYS.plasterboardSheet,
    unit: "sheet",
    rates: [
      orgRate("bathroom.lining.ceiling.install.hours_per_m2", "m2", 0.4, {
        rate_type: "productivity",
      }),
    ],
  }).hoursPerUnit === 0.5
);

const coverage = ceilingCommercialCoverageTable();
console.log("\n=== Rate coverage (no company configuration) ===");
console.log(
  [
    "Component".padEnd(42),
    "Unit".padEnd(8),
    "Material key".padEnd(48),
    "Co. rate",
    "Quotr $",
    "Productivity key".padEnd(52),
    "Co. prod",
    "Quotr h",
    "Result",
  ].join(" | ")
);
for (const row of coverage) {
  console.log(
    [
      row.component.padEnd(42),
      row.physicalUnit.padEnd(8),
      row.materialKey.padEnd(48),
      row.companyRateSupport ? "yes" : "no",
      row.quotrCostBenchmark ? "yes" : "no",
      (row.productivityKey ?? "—").padEnd(52),
      row.companyProductivitySupport ? "yes" : "no",
      row.quotrProductivity ? "yes" : "no",
      row.resultIfNoCompany,
    ].join(" | ")
  );
}
check("coverage table covers V1 components", coverage.length >= 20);

check(
  "physical layer stays dollar-free",
  !read("lib/estimate/ceilings-physical.ts").includes("unitCost:") ||
    read("lib/estimate/ceilings-physical.ts").includes("unitCost: null")
);
check(
  "nested commercial is hosted through calculateCeilings",
  read("lib/estimate/calculators/fitout.ts").includes("commercializeCeilings")
);

function spawnVerifier(script: string): boolean {
  const result = spawnSync("npx", ["--yes", "tsx", script], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: true,
  });
  if (result.status !== 0) {
    console.log(result.stdout);
    console.log(result.stderr);
  }
  return result.status === 0;
}

console.log("\n=== Prior Ceiling + commercial regressions ===\n");
const prior = [
  "scripts/verify-ceilings-wa-03a.ts",
  "scripts/verify-ceilings-wa-03b.ts",
  "scripts/verify-ceilings-wa-04a.ts",
  "scripts/verify-ceilings-wa-04b.ts",
  "scripts/verify-ceilings-wa-04c.ts",
  "scripts/verify-ceilings-wa-04c-r1.ts",
  "scripts/verify-ceilings-wa-04d.ts",
];
for (const script of prior) {
  check(script.replace("scripts/", ""), spawnVerifier(script));
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
