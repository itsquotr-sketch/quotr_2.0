/**
 * CEILINGS WA-05B — Quotr V1 benchmarks, derived plasterboard COST,
 * residual fixings, hosted nested estimator, PR/incomplete semantics.
 *
 * Run: npx --yes tsx scripts/verify-ceilings-wa-05b.ts
 *
 * Preview only.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { OrganisationRate, OrganisationSettings } from "../components/setup/types";
import type { EstimateLineItem } from "../components/assistant/types";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import {
  aggregateCeilingCommercialLines,
  ceilingCommercialOwnsFinishMoney,
  commercializeCeilings,
  isGenericPlywoodSpecification,
  quotrCatalogueCost,
  quotrCeilingMaterialCost,
  resolveCeilingProductivity,
} from "../lib/estimate/ceilings-commercial";
import {
  CEILINGS_FIXINGS_QUOTR_COST,
  CEILINGS_PARTIAL_ESTIMATE_MESSAGE,
  CEILINGS_PAINTING_COMPONENT,
  CEILINGS_PAINTING_LABOUR,
  CEILINGS_PLASTERBOARD_LABOUR,
  CEILINGS_PRODUCTIVITY_KEYS,
  CEILINGS_QUOTR_PRODUCTIVITY_HOURS,
  CEILINGS_STEEL_PRIMARY_LABOUR,
  CEILINGS_STOPPING_COMPONENT,
  CEILINGS_TIMBER_FRAMING_LABOUR,
  TIMBER_FRAMING_140X45_H12_KEY,
  TIMBER_FRAMING_140X45_H12_QUOTR_COST,
} from "../lib/estimate/ceilings-identities";
import {
  CEILINGS_FIXINGS_BULKHEAD_FRAMING_STEEL_KEY,
  CEILINGS_FIXINGS_BULKHEAD_FRAMING_TIMBER_KEY,
  CEILINGS_FIXINGS_BULKHEAD_LINING_COMPONENT,
  CEILINGS_FIXINGS_PLASTERBOARD_COMPONENT,
  CEILINGS_FIXINGS_PLYWOOD_COMPONENT,
  CEILINGS_FIXINGS_STEEL_FRAMING_COMPONENT,
  CEILINGS_FIXINGS_TIMBER_FRAMING_COMPONENT,
  CEILINGS_FIXINGS_TIMBER_LINING_COMPONENT,
} from "../lib/estimate/ceilings-fixings";
import {
  CEILINGS_PLASTERBOARD_COMPONENT,
  CEILINGS_PLYWOOD_COMPONENT,
  CEILINGS_TILE_GRID_GRID_COMPONENT,
  CEILINGS_TILE_GRID_TILE_COMPONENT,
  CEILINGS_TIMBER_LINING_COMPONENT,
} from "../lib/estimate/ceilings-lining";
import { CEILINGS_TIMBER_FRAMING_COMPONENT } from "../lib/estimate/ceilings-framing";
import {
  CEILINGS_STEEL_FURRING_COMPONENT,
  CEILINGS_STEEL_PERIMETER_COMPONENT,
  CEILINGS_STEEL_PRIMARY_COMPONENT,
} from "../lib/estimate/ceilings-steel";
import {
  CANONICAL_PLASTERBOARD_SHEET_AREA_M2,
  derivedDimensionedPlasterboardCost,
} from "../lib/estimate/ceilings-plasterboard-derived-cost";
import { calculateCeilingsPhysical } from "../lib/estimate/ceilings-physical";
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
import { resolveLabourRate } from "../lib/estimate/rates";
import { getQuotrProductivityBenchmark } from "../lib/estimate/productivity";
import { getCatalogueEntry } from "../lib/rates/catalogue";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "../lib/estimate/types";
import type { LabourRequirement, MaterialRequirement } from "../lib/estimate/requirements";
import type { MaterialWastageSettings } from "../lib/settings/material-wastage";

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
    project: { id: "ceilings-wa-05b", qualityLevel: "standard" },
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
  area?: number;
  sheetLength?: number;
  product?: "standard" | "aqualine" | "fyreline";
}): CeilingPortion {
  const length = params?.length ?? 4;
  const width = params?.width ?? 3;
  const row = createEmptyCeilingPortion({
    id: params?.id ?? P1,
    label: params?.id === P2 ? "Hall" : "Lounge",
  });
  row.structure.family = "existing_framing";
  row.structure.job_scope = "reline_existing_suitable_framing";
  row.lining.family = "plasterboard";
  row.lining.plasterboard_product = params?.product ?? "standard";
  row.lining.thickness_mm = 13;
  row.lining.sheet_length_mm = params?.sheetLength ?? 3000;
  row.lining.sheet_width_mm = 1200;
  row.geometry.mode = params?.area != null ? "area_only" : "length_width";
  row.geometry.length_m = length;
  row.geometry.width_m = width;
  row.geometry.area_m2 = params?.area ?? length * width;
  row.finish.insulation_included = false;
  row.finish.painting_included = false;
  row.finish.stopping_included = false;
  row.finish.demolition_included = false;
  row.has_bulkheads = false;
  return row;
}

function timberPortion(params?: { id?: string }): CeilingPortion {
  const row = plasterPortion({ id: params?.id, sheetLength: 3000 });
  row.structure.family = "timber_direct_fix";
  row.structure.timber = {
    size: "140x45_h1.2",
    spacing_mm: 450,
    direction: "along_length",
  };
  return row;
}

function steelPortion(params?: { id?: string }): CeilingPortion {
  const row = plasterPortion({ id: params?.id, sheetLength: 3000 });
  row.structure.family = "steel_direct_fix";
  row.structure.steel = {
    primary_spacing_mm: 450,
    furring_spacing_mm: 450,
    direction: "along_length",
  };
  return row;
}

function tilePortion30(): CeilingPortion {
  const row = plasterPortion({ length: 6, width: 5, area: 30 });
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

function mapReviewLines(items: readonly EstimateLineItemInput[]): EstimateLineItem[] {
  return items.map((item, index) => ({
    id: `line-${index}`,
    workAreaName: item.workAreaName,
    label: item.label,
    category: item.category,
    costLow: item.costLow,
    costHigh: item.costHigh,
    sellLow: item.sellLow,
    sellHigh: item.sellHigh,
    recommendedCost: item.recommendedCost,
    recommendedSell: item.recommendedSell,
    grossProfit: item.grossProfit,
    marginPercent: item.marginPercent,
    markupPercent: item.markupPercent,
    rateSource: item.rateSource,
    quantity: item.quantity,
    unit: item.unit,
    labourHours: item.labourHours,
    itemKey: item.itemKey,
    componentKey: item.componentKey,
    nestedItemId: item.nestedItemId,
    contributingNestedItemIds: item.contributingNestedItemIds,
    notes: item.notes,
    includedInTotal: item.includedInTotal,
  }));
}

console.log("=== CEILINGS WA-05B Quotr V1 + hosted nested estimator ===\n");

const lockedHours = Object.entries(CEILINGS_QUOTR_PRODUCTIVITY_HOURS);
check(
  "A all locked productivity values resolve",
  lockedHours.length === 15 &&
    lockedHours.every(([key, hours]) => {
      const resolved = resolveCeilingProductivity({
        productivityKey: key,
        unit: key.endsWith("m2") ? "m2" : key.includes("sheet") ? "sheet" : key.includes("each") ? "each" : "lm",
        rates: [],
      });
      return (
        getQuotrProductivityBenchmark(key)?.hoursPerUnit === hours &&
        resolved.source === "benchmark" &&
        near(resolved.hoursPerUnit, hours)
      );
    })
);

check(
  "B company productivity overrides each Quotr fallback",
  lockedHours.every(([key, hours]) => {
    const unit = key.endsWith("m2")
      ? "m2"
      : key.includes("sheet")
        ? "sheet"
        : key.includes("each")
          ? "each"
          : "lm";
    const company = resolveCeilingProductivity({
      productivityKey: key,
      unit,
      rates: [orgRate(key, unit, hours + 0.2, { rate_type: "productivity" })],
    });
    return (
      company.source === "company" &&
      near(company.hoursPerUnit, hours + 0.2) &&
      !near(company.hoursPerUnit, hours)
    );
  })
);

const labourFallback = resolveLabourRate({
  rates: [],
  organisationSettings: SETTINGS,
});
check(
  "C global labour COST remains $60 fallback",
  near(labourFallback.costRate, 60) &&
    !read("lib/estimate/ceilings-commercial.ts").includes("CEILING_LABOUR_COST") &&
    !read("lib/estimate/ceilings-identities.ts").includes("labour_cost_per_hour")
);

check(
  "D 140x45 Quotr COST = $9.65/lm",
  near(quotrCatalogueCost(TIMBER_FRAMING_140X45_H12_KEY), TIMBER_FRAMING_140X45_H12_QUOTR_COST)
);

const timberCompany = runCommercial(
  [timberPortion()],
  [orgRate(TIMBER_FRAMING_140X45_H12_KEY, "lm", 11.2)]
);
check(
  "E company 140x45 rate overrides $9.65",
  near(
    material(timberCompany.commercial.requirements, CEILINGS_TIMBER_FRAMING_COMPONENT)?.unitCost,
    11.2
  )
);

const derived3000 = derivedDimensionedPlasterboardCost(
  "sheet.plasterboard.standard.13mm.3000x1200.each"
);
check(
  "F dimensioned plasterboard derived cost only within same family/thickness",
  derived3000 != null &&
    derived3000.family === "standard" &&
    derived3000.thicknessMm === 13 &&
    derived3000.baseKey === INTERNAL_WALLS_STANDARD_13_2400_KEY
);
check(
  "G 3000×1200 ratio = 1.25",
  derived3000 != null &&
    near(derived3000.targetAreaM2, 3.6) &&
    near(derived3000.ratio, 1.25) &&
    near(derived3000.derivedCost, 22.5) &&
    near(CANONICAL_PLASTERBOARD_SHEET_AREA_M2, 2.88)
);
check(
  "H no cross-family or cross-thickness plasterboard derivation",
  derivedDimensionedPlasterboardCost(
    "sheet.plasterboard.aqualine.13mm.3000x1200.each"
  )?.baseKey === "sheet.plasterboard.aqualine.each" &&
    derivedDimensionedPlasterboardCost(
      "sheet.plasterboard.standard.10mm.3000x1200.each"
    )?.baseKey === "sheet.plasterboard.standard.10mm.2400x1200.each" &&
    derivedDimensionedPlasterboardCost(
      "sheet.plasterboard.standard.10mm.3000x1200.each"
    )?.baseKey !== "sheet.plasterboard.standard.each" &&
    derivedDimensionedPlasterboardCost("sheet.plasterboard.noiseline.13mm.3000x1200.each") ==
      null
);

check(
  "I plasterboard fixings = $2.50/m² COST",
  near(
    quotrCatalogueCost(CEILINGS_FIXINGS_PLASTERBOARD_COMPONENT),
    CEILINGS_FIXINGS_QUOTR_COST.plasterboardM2
  )
);
check(
  "J timber fixings = $0.75/lm COST",
  near(
    quotrCatalogueCost(CEILINGS_FIXINGS_TIMBER_FRAMING_COMPONENT),
    CEILINGS_FIXINGS_QUOTR_COST.timberFramingLm
  )
);
check(
  "K steel residual fixings = $0.60/lm COST",
  near(
    quotrCatalogueCost(CEILINGS_FIXINGS_STEEL_FRAMING_COMPONENT),
    CEILINGS_FIXINGS_QUOTR_COST.steelFramingLm
  )
);
check(
  "L plywood fixings = $1.50/m² COST",
  near(quotrCatalogueCost(CEILINGS_FIXINGS_PLYWOOD_COMPONENT), CEILINGS_FIXINGS_QUOTR_COST.plywoodM2)
);
check(
  "M timber lining fixings = $0.50/lm COST",
  near(
    quotrCatalogueCost(CEILINGS_FIXINGS_TIMBER_LINING_COMPONENT),
    CEILINGS_FIXINGS_QUOTR_COST.timberLiningLm
  )
);

const withBh = plasterPortion();
const bhTimber = createEmptyCeilingBulkhead({ id: BH1, label: "Downstand" });
bhTimber.form = "conventional_two_face_downstand";
bhTimber.topology = "conventional_two_face_downstand";
bhTimber.length_m = 4;
bhTimber.depth_m = 0.4;
bhTimber.height_m = 0.3;
bhTimber.framing_type = "timber";
bhTimber.lining_type = "standard";
bhTimber.thickness_mm = 13;
withBh.has_bulkheads = true;
withBh.bulkheads = [bhTimber];
const bulkTimber = runCommercial([withBh]);
const bhSteelPortion = plasterPortion({ id: P2 });
const bhSteel = createEmptyCeilingBulkhead({ id: BH1, label: "Steel downstand" });
bhSteel.form = "conventional_two_face_downstand";
bhSteel.topology = "conventional_two_face_downstand";
bhSteel.length_m = 4;
bhSteel.depth_m = 0.4;
bhSteel.height_m = 0.3;
bhSteel.framing_type = "steel";
bhSteel.lining_type = "standard";
bhSteel.thickness_mm = 13;
bhSteelPortion.has_bulkheads = true;
bhSteelPortion.bulkheads = [bhSteel];
const bulkSteel = runCommercial([bhSteelPortion]);
check(
  "N bulkhead fixings use correct basis",
  near(
    bulkTimber.commercial.requirements.find(
      (row) =>
        row.kind === "material" &&
        (row as MaterialRequirement).materialKey ===
          CEILINGS_FIXINGS_BULKHEAD_FRAMING_TIMBER_KEY
    )?.unitCost,
    0.75
  ) &&
    near(
      bulkSteel.commercial.requirements.find(
        (row) =>
          row.kind === "material" &&
          (row as MaterialRequirement).materialKey ===
            CEILINGS_FIXINGS_BULKHEAD_FRAMING_STEEL_KEY
      )?.unitCost,
      0.6
    ) &&
    near(
      quotrCatalogueCost(CEILINGS_FIXINGS_BULKHEAD_LINING_COMPONENT),
      2.5
    )
);

const fixture1 = runCommercial([plasterPortion()]);
const f1Pb = material(fixture1.commercial.requirements, CEILINGS_PLASTERBOARD_COMPONENT)!;
const f1Fix = material(fixture1.commercial.requirements, CEILINGS_FIXINGS_PLASTERBOARD_COMPONENT)!;
const f1Lab = labour(fixture1.commercial.requirements, CEILINGS_PLASTERBOARD_LABOUR)!;
const f1PbLine = fixture1.commercial.lineItems.find(
  (item) => item.componentKey === CEILINGS_PLASTERBOARD_COMPONENT
)!;
check(
  "O margin applied once",
  f1PbLine.sellAuthority === "derived_from_gross_margin" &&
    near(f1PbLine.sellRate ?? -1, 22.5 / 0.8) &&
    near(f1PbLine.recommendedSell, 5 * (f1PbLine.sellRate ?? 0)) &&
    f1PbLine.sellDerivedFromMargin === true
);
check(
  "P no hidden sell benchmark",
  getCatalogueEntry(TIMBER_FRAMING_140X45_H12_KEY)?.defaultSellRate == null &&
    getCatalogueEntry("sheet.plasterboard.standard.13mm.3000x1200.each")
      ?.defaultCostRate == null &&
    !read("lib/estimate/ceilings-commercial.ts").includes("FITOUT_BENCHMARKS") &&
    !read("lib/estimate/ceilings-commercial.ts").includes("ceilingsPerM2")
);

check(
  "Q existing-frame Standard GIB hosted fixture complete",
    fixture1.physical.portions[0]?.geometry.area_m2 === 12 &&
    near(f1Pb.baseQuantity, 4) &&
    near(f1Pb.purchaseQuantity, 5) &&
    near(f1Pb.unitCost, 22.5) &&
    near(f1Pb.totalCost, 112.5) &&
    near(f1Fix.unitCost, 2.5) &&
    near(f1Fix.purchaseQuantity, 12) &&
    near(f1Fix.totalCost, 30) &&
    near(f1Lab.adjustedHours, 2) &&
    near(f1Lab.totalCost, 120) &&
    fixture1.commercial.completeness === "COMPLETE_COMMERCIAL" &&
    fixture1.commercial.requirements.every((row) => row.priced)
);

const hosted1 = calculateEstimate(estimateCtx(writePortions([plasterPortion()])));
check(
  "Q hosted fixture 1 has no Pricing Required",
  hosted1.lineItems.length > 0 &&
    !hosted1.missingInfo.some((row) => row.includes(CEILINGS_PARTIAL_ESTIMATE_MESSAGE)) &&
    !hosted1.lineItems.some((item) => item.rateSourceType === "missing")
);

const fixture2 = runCommercial([timberPortion()]);
const f2Timber = material(fixture2.commercial.requirements, CEILINGS_TIMBER_FRAMING_COMPONENT)!;
const f2TimberFix = material(
  fixture2.commercial.requirements,
  CEILINGS_FIXINGS_TIMBER_FRAMING_COMPONENT
)!;
const f2TimberLab = labour(fixture2.commercial.requirements, CEILINGS_TIMBER_FRAMING_LABOUR)!;
check(
  "R timber + Standard GIB hosted fixture complete",
  fixture2.commercial.completeness === "COMPLETE_COMMERCIAL" &&
    fixture2.commercial.requirements.every((row) => row.priced) &&
    calculateEstimate(estimateCtx(writePortions([timberPortion()]))).lineItems.every(
      (item) => item.rateSourceType !== "missing"
    )
);
check(
  "S timber fixture material/labour arithmetic exact",
  near(f2Timber.baseQuantity, 32) &&
    near(f2Timber.unitCost, 9.65) &&
    near(f2Timber.totalCost, 308.8) &&
    near(f2TimberFix.totalCost, 24) &&
    near(f2TimberLab.adjustedHours, 3.84) &&
    near(f2TimberLab.totalCost, 230.4) &&
    near(
      material(fixture2.commercial.requirements, CEILINGS_PLASTERBOARD_COMPONENT)?.totalCost,
      112.5
    )
);

const fixture3 = runCommercial([steelPortion()]);
const f3SteelMat = material(fixture3.commercial.requirements, CEILINGS_STEEL_PRIMARY_COMPONENT)!;
const f3SteelLab = labour(fixture3.commercial.requirements, CEILINGS_STEEL_PRIMARY_LABOUR)!;
check(
  "T steel fixture now resolves ordinary Quotr COST + labour",
  fixture3.commercial.completeness === "COMPLETE_COMMERCIAL" &&
    f3SteelMat.priced === true &&
    near(f3SteelMat.unitCost, 7.25) &&
    near(f3SteelMat.baseQuantity, 32) &&
    f3SteelLab.priced === true &&
    near(
      f3SteelLab.productivityBasis.hoursPerUnit,
      CEILINGS_QUOTR_PRODUCTIVITY_HOURS[CEILINGS_PRODUCTIVITY_KEYS.primaryLm]
    ) &&
    material(fixture3.commercial.requirements, CEILINGS_PLASTERBOARD_COMPONENT)?.priced ===
      true &&
    fixture3.commercial.requirements.every((row) => row.priced)
);

const fixture4 = runCommercial([tilePortion30()]);
const grid = material(fixture4.commercial.requirements, CEILINGS_TILE_GRID_GRID_COMPONENT)!;
const tiles = material(fixture4.commercial.requirements, CEILINGS_TILE_GRID_TILE_COMPONENT)!;
const gridLab = labour(fixture4.commercial.requirements, "ceilings.grid.install")!;
const tileLab = labour(fixture4.commercial.requirements, "ceilings.tile.install")!;
check(
  "U Tile/Grid ordinary generic system now resolves",
  near(grid.baseQuantity, 30) &&
    near(tiles.baseQuantity, 84) &&
    grid.priced === true &&
    near(grid.unitCost, 15) &&
    near(grid.totalCost, 450) &&
    tiles.priced === true &&
    near(tiles.unitCost, 16) &&
    gridLab.priced === true &&
    tileLab.priced === true &&
    near(gridLab.adjustedHours, 5.4) &&
    near(tileLab.adjustedHours, 2.1) &&
    !fixture4.commercial.requirements.some((row) =>
      row.componentKey.includes("fixings")
    ) &&
    material(fixture4.commercial.requirements, CEILINGS_PLASTERBOARD_COMPONENT) == null &&
    material(fixture4.commercial.requirements, CEILINGS_STEEL_PRIMARY_COMPONENT) == null &&
    fixture4.commercial.completeness === "COMPLETE_COMMERCIAL"
);

const liningPortion = plasterPortion({ length: 4, width: 3 });
liningPortion.lining.family = "timber_lined";
liningPortion.lining.timber_lined = {
  board_width_mm: 90,
  gap_mm: 10,
  direction: "along_length",
};
const liningPr = runCommercial([liningPortion]);
const liningMat = material(liningPr.commercial.requirements, CEILINGS_TIMBER_LINING_COMPONENT)!;
check(
  "V specialty timber lining remains PR and is not $0-resolved",
  liningMat.priced === false &&
    liningMat.totalCost == null &&
    liningPr.commercial.lineItems.some(
      (item) =>
        item.componentKey === CEILINGS_TIMBER_LINING_COMPONENT &&
        item.rateSourceType === "missing" &&
        item.recommendedSell === 0 &&
        item.sellDerivedFromMargin !== true &&
        /Pricing Required/i.test(item.notes ?? "")
    )
);

const hosted3 = calculateEstimate(estimateCtx(writePortions([steelPortion()])));
check(
  "W ordinary steel estimate is complete; specialty lining stays incomplete",
  !hosted3.missingInfo.some((row) => row.includes(CEILINGS_PARTIAL_ESTIMATE_MESSAGE)) &&
    fixture3.commercial.completeness === "COMPLETE_COMMERCIAL" &&
    liningPr.commercial.completeness === "PRICING_REQUIRED" &&
    calculateEstimate(estimateCtx(writePortions([liningPortion]))).missingInfo.some((row) =>
      row.includes(CEILINGS_PARTIAL_ESTIMATE_MESSAGE)
    )
);

const steelRates = [
  orgRate("steel.ceiling.perimeter_track.lm", "lm", 8),
  orgRate("steel.ceiling.primary_channel.lm", "lm", 9),
  orgRate("steel.ceiling.furring_channel.lm", "lm", 7),
  orgRate("steel.ceiling.crossover_clip.each", "each", 1.2),
];
const steelCleared = runCommercial([steelPortion()], steelRates);
check(
  "X company missing-material rates clear relevant PR",
  material(steelCleared.commercial.requirements, CEILINGS_STEEL_PRIMARY_COMPONENT)?.priced ===
    true &&
    material(steelCleared.commercial.requirements, CEILINGS_STEEL_PERIMETER_COMPONENT)
      ?.priced === true &&
    material(steelCleared.commercial.requirements, CEILINGS_STEEL_FURRING_COMPONENT)?.priced ===
      true &&
    steelCleared.commercial.completeness === "COMPLETE_COMMERCIAL"
);

const companyProd = runCommercial(
  [steelPortion()],
  [
    ...steelRates,
    orgRate(CEILINGS_PRODUCTIVITY_KEYS.primaryLm, "lm", 0.22, {
      rate_type: "productivity",
    }),
  ]
);
check(
  "Y company productivity overrides Quotr",
  near(
    labour(companyProd.commercial.requirements, CEILINGS_STEEL_PRIMARY_LABOUR)
      ?.productivityBasis.hoursPerUnit,
    0.22
  ) &&
    labour(companyProd.commercial.requirements, CEILINGS_STEEL_PRIMARY_LABOUR)
      ?.rateProvenance === "company" &&
    resolveCeilingProductivity({
      productivityKey: CEILINGS_PRODUCTIVITY_KEYS.primaryLm,
      unit: "lm",
      rates: steelRates,
    }).source === "benchmark"
);

const summed = aggregateCeilingCommercialLines([
  lineItem({
    label: "Lounge sheets",
    quantity: 5,
    recommendedCost: 112.5,
    recommendedSell: 140.63,
    nestedItemId: P1,
  }),
  lineItem({
    label: "Hall sheets",
    quantity: 7,
    recommendedCost: 157.5,
    recommendedSell: 196.88,
    nestedItemId: P2,
  }),
]);
check(
  "Z compatible same-product lines aggregate",
  summed.length === 1 && near(summed[0]!.quantity ?? 0, 12)
);
check(
  "AA incompatible authority lines do not aggregate",
  aggregateCeilingCommercialLines([
    lineItem({
      label: "company",
      rateSource: "Your company rate",
      rateSourceType: "user_rate",
    }),
    lineItem({
      label: "benchmark",
      rateSource: "Quotr benchmark",
      rateSourceType: "benchmark",
      quantity: 7,
    }),
  ]).length === 2 &&
    !commercialLinesAggregationCompatible(
      lineItem({
        label: "a",
        rateSourceType: "user_rate",
        rateSource: "Your company rate",
      }),
      lineItem({
        label: "b",
        rateSource: "Quotr benchmark",
        rateSourceType: "benchmark",
      })
    )
);
check(
  "AB contributing Portion provenance survives aggregation",
  summed[0]!.contributingNestedItemIds?.includes(P1) === true &&
    summed[0]!.contributingNestedItemIds?.includes(P2) === true
);

const repeatedA = runCommercial([plasterPortion({ id: P1 })]);
const repeatedB = runCommercial([plasterPortion({ id: P1 })], [], wa("c2", "Garage"));
check(
  "AC repeated Work Areas remain separate",
  aggregateCeilingCommercialLines([
    ...repeatedA.commercial.lineItems.filter(
      (item) => item.componentKey === CEILINGS_PLASTERBOARD_COMPONENT
    ),
    ...repeatedB.commercial.lineItems.filter(
      (item) => item.componentKey === CEILINGS_PLASTERBOARD_COMPONENT
    ),
  ]).length === 2
);

check(
  "AD nested Ceiling uses new engine",
  hosted1.lineItems.length > 0 &&
    read("lib/estimate/calculators/fitout.ts").includes("commercializeCeilings") &&
    read("lib/estimate/calculators/fitout.ts").includes("calculateCeilingsPhysical") &&
    !hosted1.missingInfo.some((row) =>
      row.includes(CEILINGS_NESTED_NOT_CALCULATED_MESSAGE)
    )
);
check(
  "AE nested Ceiling never uses ceilingsPerM2 legacy benchmark",
  !hosted1.lineItems.some((item) => /materials allowance/i.test(item.label)) &&
    !hosted1.lineItems.some((item) => item.itemKey === "scope.ceilings.m2") &&
    !read("lib/estimate/ceilings-commercial.ts").includes("ceilingsPerM2") &&
    !read("lib/estimate/ceilings-commercial.ts").includes("ceilingBattensPerM2")
);

const legacyFacts: EstimateFact[] = [
  { key: "ceilings.area_m2", work_area_id: "c1", value: 30 },
  { key: "ceilings.structure_type", work_area_id: "c1", value: "Existing structure" },
  { key: "ceilings.ceiling_type", work_area_id: "c1", value: "Plasterboard" },
];
const legacyEstimate = calculateEstimate(estimateCtx(legacyFacts));
check(
  "AF flat legacy Ceiling still uses old calculator unchanged",
  !hasCanonicalCeilingsPortions(legacyFacts, "c1") &&
    legacyEstimate.lineItems.some((item) => /materials allowance/i.test(item.label)) &&
    !legacyEstimate.missingInfo.some((row) =>
      row.includes(CEILINGS_NESTED_NOT_CALCULATED_MESSAGE)
    ) &&
    read("lib/estimate/calculators/fitout.ts").includes("LEGACY CEILINGS CALCULATOR")
);

const finishFlags = plasterPortion();
finishFlags.finish.painting_included = true;
finishFlags.finish.stopping_included = true;
finishFlags.finish.demolition_included = true;
const finish = runCommercial([finishFlags]);
check(
  "AG no Painting package duplicate",
  !finish.commercial.lineItems.some((item) => ceilingCommercialOwnsFinishMoney(item)) &&
    finish.commercial.requirements.some(
      (row) => row.componentKey === CEILINGS_PAINTING_COMPONENT
    ) &&
    finish.commercial.requirements.some(
      (row) => row.componentKey === CEILINGS_PAINTING_LABOUR
    ) &&
    !finish.commercial.requirements.some(
      (row) =>
        /paint/i.test(row.componentKey) &&
        row.componentKey !== CEILINGS_PAINTING_COMPONENT &&
        row.componentKey !== CEILINGS_PAINTING_LABOUR
    ) &&
    !finish.commercial.lineItems.some((item) => /^ceiling painting$/i.test(item.label))
);
check(
  "AH no Plastering package duplicate",
  finish.commercial.requirements.some(
    (row) => row.componentKey === CEILINGS_STOPPING_COMPONENT
  ) &&
    !finish.commercial.requirements.some(
      (row) =>
        /stop/i.test(row.componentKey) &&
        row.componentKey !== CEILINGS_STOPPING_COMPONENT
    )
);
check(
  "AI no Demolition duplicate",
  !finish.commercial.requirements.some((row) => /demo|removal/i.test(row.componentKey))
);

let reviewCrashed = false;
let reviewOk = false;
try {
  const review = composeBuilderReview({
    estimate: {
      recommendedCost: hosted1.recommendedCost,
      recommendedSell: hosted1.recommendedSell,
      marginPercent: hosted1.marginPercent,
      confidence: hosted1.confidence,
      assumptions: hosted1.assumptions,
      missingInfo: hosted1.missingInfo,
      lineItems: mapReviewLines(hosted1.lineItems),
    },
    workAreas: [{ id: "c1", type: "ceilings", name: "Ceilings", status: "confirmed" }],
    requirements: hosted1.requirements ?? fixture1.commercial.requirements,
  });
  reviewOk = review.workAreas.length > 0 && review.takeoffAffectsMoney === false;
} catch {
  reviewCrashed = true;
}
check("AJ generic Builder Review does not crash", !reviewCrashed && reviewOk);

const manual = runCommercial(
  [plasterPortion()],
  [
    orgRate("sheet.plasterboard.standard.13mm.3000x1200.each", "each", 40, {
      rate_type: "project_material",
    }),
  ]
);
check(
  "manual project override beats Quotr derived COST",
  near(
    material(manual.commercial.requirements, CEILINGS_PLASTERBOARD_COMPONENT)?.unitCost,
    40
  ) &&
    material(manual.commercial.requirements, CEILINGS_PLASTERBOARD_COMPONENT)
      ?.rateSource === "project_override"
);

const specificPly = plasterPortion();
specificPly.lining.family = "plywood";
specificPly.lining.plywood_spec = "18mm marine hoop pine";
specificPly.lining.sheet_length_mm = 2400;
specificPly.lining.sheet_width_mm = 1200;
const plySpecific = runCommercial([specificPly]);
check(
  "specific plywood does not reuse generic Quotr COST",
  isGenericPlywoodSpecification("generic") &&
    !isGenericPlywoodSpecification("18mm marine hoop pine") &&
    material(plySpecific.commercial.requirements, CEILINGS_PLYWOOD_COMPONENT)?.priced ===
      false
);

check(
  "steel / grid / tile catalogue COST is the approved V1 Quotr COST",
  quotrCatalogueCost("steel.ceiling.primary_channel.lm") === 7.25 &&
    quotrCatalogueCost("ceiling.grid.m2") === 15 &&
    quotrCatalogueCost("ceiling.tile.600x600.each") === 16 &&
    quotrCeilingMaterialCost("sheet.plasterboard.standard.13mm.3000x1200.each")
      ?.unitCost === 22.5
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
  "scripts/verify-ceilings-wa-05a.ts",
  "scripts/verify-est-commercial-01a.ts",
  "scripts/verify-est-commercial-01b.ts",
  "scripts/verify-commercial-p0-authority-lock.ts",
  "scripts/verify-pricing-ownership.ts",
  "scripts/verify-foundation-r2r1-material-rate-authority.ts",
  "scripts/verify-material-rates.ts",
  "scripts/verify-cost-first-rates.ts",
  "scripts/verify-work-area-internal-walls-08.ts",
  "scripts/verify-work-area-internal-walls-maturity.ts",
  "scripts/verify-work-area-bathroom-maturity.ts",
  "scripts/verify-repeated-work-area-acceptance-r1.ts",
];
for (const script of prior) {
  check(script.replace("scripts/", ""), spawnVerifier(script));
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
