/**
 * EST-BENCHMARK-01B — owner-approved ordinary V1 COST / productivity fill.
 *
 * Run: npx --yes tsx scripts/verify-est-benchmark-01b.ts
 *
 * Preview only. No Production.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { deriveSellFromCost } from "../lib/commercial-engine/core/sell-from-margin";
import {
  liveQuotrMaterialCost,
  liveQuotrProductivity,
  workAreaMayCloseAtL5,
} from "../lib/estimate/benchmark-coverage";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { commercializeCeilings } from "../lib/estimate/ceilings-commercial";
import {
  CEILINGS_INSULATION_LABOUR,
  CEILINGS_PRODUCTIVITY_KEYS,
  CEILINGS_QUOTR_PRODUCTIVITY_HOURS,
  CEILINGS_WIRE_LABOUR_DECISION,
} from "../lib/estimate/ceilings-identities";
import { CEILINGS_INSULATION_COMPONENT } from "../lib/estimate/ceilings-insulation";
import {
  CEILING_TILE_GRID_QUOTR_COST,
  CEILINGS_PLASTERBOARD_COMPONENT,
  CEILINGS_TILE_GRID_GRID_COMPONENT,
  CEILINGS_TILE_GRID_TILE_COMPONENT,
  CEILINGS_TIMBER_LINING_COMPONENT,
} from "../lib/estimate/ceilings-lining";
import {
  derivedDimensionedPlasterboardCost,
  PLASTERBOARD_10MM_AQUALINE_2400_COST,
  PLASTERBOARD_10MM_AQUALINE_2400_KEY,
  PLASTERBOARD_10MM_STANDARD_2400_COST,
  PLASTERBOARD_10MM_STANDARD_2400_KEY,
} from "../lib/estimate/ceilings-plasterboard-derived-cost";
import { calculateCeilingsPhysical } from "../lib/estimate/ceilings-physical";
import {
  applyCeilingsFactWrite,
  CEILINGS_PORTIONS_FACT_KEY,
  createEmptyCeilingBulkhead,
  createEmptyCeilingPortion,
  type CeilingPortion,
} from "../lib/estimate/ceilings-portions";
import {
  CEILING_STEEL_QUOTR_COST,
  CEILINGS_STEEL_CLIP_COMPONENT,
  CEILINGS_STEEL_FURRING_COMPONENT,
  CEILINGS_STEEL_PERIMETER_COMPONENT,
  CEILINGS_STEEL_PRIMARY_COMPONENT,
  CEILINGS_SUSPENSION_DROPPER_COMPONENT,
  CEILINGS_SUSPENSION_WIRE_COMPONENT,
} from "../lib/estimate/ceilings-steel";
import { calculateInternalWalls } from "../lib/estimate/calculators/fitout";
import {
  INTERNAL_WALLS_SKIRTING_SIDES_KEY,
} from "../lib/estimate/internal-walls-finish";
import {
  INTERNAL_WALLS_FRAMING_STEEL_LABOUR_COMPONENT,
  INTERNAL_WALLS_FRAMING_STEEL_STUD_COMPONENT,
  INTERNAL_WALLS_FRAMING_STEEL_TRACK_COMPONENT,
  INTERNAL_WALLS_SKIRTING_HOURS_PER_LM,
  INTERNAL_WALLS_SKIRTING_INSTALL_HOURS_PER_LM_KEY,
  INTERNAL_WALLS_SKIRTING_LABOUR_COMPONENT,
  INTERNAL_WALLS_SKIRTING_MATERIAL_COMPONENT,
  INTERNAL_WALLS_SKIRTING_MATERIAL_KEY,
  INTERNAL_WALLS_STEEL_STUD_KEY,
  INTERNAL_WALLS_STEEL_STUD_QUOTR_COST,
  INTERNAL_WALLS_STEEL_TRACK_KEY,
  INTERNAL_WALLS_STEEL_TRACK_QUOTR_COST,
} from "../lib/estimate/internal-walls-identities";
import { internalWallsLiningMaterialKey } from "../lib/estimate/internal-walls-lining";
import { INTERNAL_WALLS_JOB_SCOPE_FACT_KEY } from "../lib/estimate/internal-walls-scope";
import {
  applyInternalWallsFactWrite,
  INTERNAL_WALLS_ADD_WALL_TYPE_KEY,
  isOrdinaryInternalWallsSteel92,
} from "../lib/estimate/internal-walls-wall-types";
import { ORDINARY_THERMAL_INSULATION_COST } from "../lib/estimate/insulation-fallback";
import { resolveProductivity } from "../lib/estimate/productivity";
import { resolveLabourRate } from "../lib/estimate/rates";
import {
  listIntentionalPricingRequired,
  listOwnerApprovalGaps,
  verifyRegisteredWorkAreaBenchmarkCoverage,
} from "../lib/estimate/work-area-benchmark-coverage";
import { HIGH_LEVEL_ACCESS_KEY } from "../lib/project-conditions";
import { scaffoldQuestionWouldBeAsked } from "../lib/project-conditions/relevance";
import { getCatalogueEntry } from "../lib/rates/catalogue";
import type { OrganisationRate, OrganisationSettings } from "../components/setup/types";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";
import type { LabourRequirement, MaterialRequirement } from "../lib/estimate/requirements";
import { PREVIEW_AUTH_SITE_ORIGIN_STABLE } from "./lib/preview-auth-fixture";

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

function near(actual: number | null | undefined, expected: number, tol = 0.05): boolean {
  return actual != null && Number.isFinite(actual) && Math.abs(actual - expected) <= tol;
}

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

function spawnCmd(command: string, args: string[]): boolean {
  const result = spawnSync(command, args, {
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

const P1 = "aaaaaaaa-bbbb-4ccc-8ddd-111111111111";

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

function wa(type: string, id = "w1", name?: string): EstimateWorkArea {
  return { id, type, name: name ?? type, sort_order: 1 };
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
    work_area_type: null,
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
  sheetLength?: number;
  thicknessMm?: number;
  product?: "standard" | "aqualine" | "fyreline";
  insulation?: boolean;
  family?: CeilingPortion["structure"]["family"];
}): CeilingPortion {
  const row = createEmptyCeilingPortion({ id: P1, label: "Lounge" });
  row.structure.family = params?.family ?? "existing_framing";
  row.structure.job_scope = "reline_existing_suitable_framing";
  row.lining.family = "plasterboard";
  row.lining.plasterboard_product = params?.product ?? "standard";
  row.lining.thickness_mm = params?.thicknessMm ?? 13;
  row.lining.sheet_length_mm = params?.sheetLength ?? 3000;
  row.lining.sheet_width_mm = 1200;
  row.geometry.mode = "length_width";
  row.geometry.length_m = 4;
  row.geometry.width_m = 3;
  row.geometry.area_m2 = 12;
  row.height_m = 2.4;
  row.finish.insulation_included = params?.insulation === true;
  if (params?.insulation) row.finish.insulation_type = "thermal";
  row.has_bulkheads = false;
  return row;
}

function steelPortion(params?: { suspended?: boolean }): CeilingPortion {
  const row = plasterPortion({ sheetLength: 3000 });
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

function tilePortion(): CeilingPortion {
  const row = plasterPortion();
  row.geometry.mode = "area_only";
  row.geometry.length_m = 6;
  row.geometry.width_m = 5;
  row.geometry.area_m2 = 30;
  row.lining.family = "tile_and_grid";
  row.lining.tile = { size: "600x600" };
  return row;
}

function writePortions(portions: CeilingPortion[]): EstimateFact[] {
  return applyCeilingsFactWrite({
    facts: [],
    workAreaId: "c1",
    key: CEILINGS_PORTIONS_FACT_KEY,
    value: portions,
  });
}

function runCeiling(portion: CeilingPortion, rates: OrganisationRate[] = []) {
  const workArea = wa("ceilings", "c1", "Ceilings");
  const facts = writePortions([portion]);
  const physical = calculateCeilingsPhysical({
    facts,
    workArea,
    materialWastageSettings: {
      defaultMaterialWastagePercent: 10,
      sheetMaterialWastagePercent: 10,
      timberFramingWastagePercent: 10,
    },
  });
  const commercial = commercializeCeilings({
    physical,
    workArea,
    rates,
    organisationSettings: SETTINGS,
  });
  return { facts, physical, commercial };
}

function hostedCeiling(
  portion: CeilingPortion,
  rates: OrganisationRate[] = [],
  constraints: EstimateContext["constraints"] = []
) {
  return calculateEstimate({
    project: { id: "est-benchmark-01b-hosted", qualityLevel: "standard" },
    confirmedWorkAreas: [wa("ceilings", "c1", "Ceilings")],
    facts: writePortions([portion]),
    constraints,
    organisationSettings: SETTINGS,
    materialWastageSettings: {
      defaultMaterialWastagePercent: 10,
      sheetMaterialWastagePercent: 10,
      timberFramingWastagePercent: 10,
    },
    rates,
  } as unknown as EstimateContext);
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

function writeWall(writes: Array<{ key: string; value: unknown }>): EstimateFact[] {
  let facts: EstimateFact[] = [];
  for (const row of writes) {
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: row.key,
      value: row.value,
    });
  }
  return facts;
}

function iwCtx(facts: EstimateFact[], rates: OrganisationRate[] = []): EstimateContext {
  return {
    project: { id: "est-benchmark-01b", qualityLevel: "standard" },
    confirmedWorkAreas: [wa("internal_walls", "w1", "Internal walls")],
    facts,
    constraints: [],
    organisationSettings: SETTINGS,
    materialWastageSettings: {
      defaultMaterialWastagePercent: 10,
      timberFramingWastagePercent: 10,
      sheetMaterialWastagePercent: 10,
    },
    rates,
  } as unknown as EstimateContext;
}

function steelIwFacts(): EstimateFact[] {
  return [
    { key: INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, work_area_id: "w1", value: "new_partition" },
    ...writeWall([
      { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
      { key: "internal_walls.wall_type.label", value: "Steel partition" },
      { key: "internal_walls.wall_type.frame_system", value: "Steel framing" },
      { key: "internal_walls.wall_type.length_lm", value: 10 },
      { key: "internal_walls.wall_type.height_m", value: 2.4 },
      { key: "internal_walls.wall_type.stud_centres_mm", value: "600 mm" },
      { key: "internal_walls.wall_type.side_a_product", value: "Standard GIB" },
      { key: "internal_walls.wall_type.same_lining_both_sides", value: true },
    ]).filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
  ];
}

function timberSkirtingFacts(): EstimateFact[] {
  return [
    { key: INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, work_area_id: "w1", value: "new_partition" },
    ...writeWall([
      { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
      { key: "internal_walls.wall_type.label", value: "Type A" },
      { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
      { key: "internal_walls.wall_type.frame_size", value: "90 mm timber framing — 90×45" },
      { key: "internal_walls.wall_type.length_lm", value: 12 },
      { key: "internal_walls.wall_type.height_m", value: 2.4 },
      { key: "internal_walls.wall_type.stud_centres_mm", value: "600 mm" },
      { key: "internal_walls.wall_type.side_a_product", value: "Standard GIB" },
      { key: "internal_walls.wall_type.same_lining_both_sides", value: true },
      { key: INTERNAL_WALLS_SKIRTING_SIDES_KEY, value: "Both sides" },
    ]).filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
  ];
}

function tenMmIwFacts(): EstimateFact[] {
  return [
    { key: INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, work_area_id: "w1", value: "new_partition" },
    ...writeWall([
      { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
      { key: "internal_walls.wall_type.label", value: "10mm lining" },
      { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
      { key: "internal_walls.wall_type.frame_size", value: "90 mm timber framing — 90×45" },
      { key: "internal_walls.wall_type.length_lm", value: 12 },
      { key: "internal_walls.wall_type.height_m", value: 2.4 },
      { key: "internal_walls.wall_type.stud_centres_mm", value: "600 mm" },
      { key: "internal_walls.wall_type.side_a_product", value: "Standard GIB" },
      { key: "internal_walls.wall_type.side_a_thickness_mm", value: "10 mm" },
      { key: "internal_walls.wall_type.side_a_sheet_length_mm", value: "2400 mm" },
      { key: "internal_walls.wall_type.same_lining_both_sides", value: true },
    ]).filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
  ];
}

function composeInterior(params: {
  brief: string;
  workAreas: Array<{ id: string; type: string; name: string }>;
  facts: EstimateFact[];
  constraints?: Array<{ key: string; value: unknown }>;
}) {
  const workAreas = params.workAreas.map((row) => ({
    ...row,
    status: "confirmed" as const,
  }));
  const constraints = params.constraints ?? [];
  return composeClarifyView({
    stage: "quality",
    briefText: params.brief,
    qualityLevel: "standard",
    workAreas,
    facts: params.facts,
    constraints,
    jobPlan: composeJobPlan({
      workAreas,
      facts: params.facts,
      constraints,
      briefText: params.brief,
    }),
  });
}

function pcKeys(view: ReturnType<typeof composeClarifyView>): string[] {
  return [...view.candidates, ...view.deferred]
    .filter((row) => row.writeTarget === "CONSTRAINT" || row.source === "project_condition")
    .map((row) => row.constraintKey)
    .filter((key): key is string => Boolean(key));
}

const NEW_COST_KEYS = [
  PLASTERBOARD_10MM_STANDARD_2400_KEY,
  PLASTERBOARD_10MM_AQUALINE_2400_KEY,
  "steel.ceiling.perimeter_track.lm",
  "steel.ceiling.primary_channel.lm",
  "steel.ceiling.furring_channel.lm",
  "steel.ceiling.crossover_clip.each",
  "steel.ceiling.dropper.each",
  "steel.ceiling.suspension_wire.lm",
  "ceiling.grid.m2",
  "ceiling.tile.300x300.each",
  "ceiling.tile.600x600.each",
  "ceiling.tile.1200x600.each",
  INTERNAL_WALLS_STEEL_TRACK_KEY,
  INTERNAL_WALLS_STEEL_STUD_KEY,
] as const;

console.log("=== EST-BENCHMARK-01B ===\n");

console.log("--- A–P catalogue / productivity ---\n");
check(
  "A 10mm Standard = $18",
  liveQuotrMaterialCost(PLASTERBOARD_10MM_STANDARD_2400_KEY) === PLASTERBOARD_10MM_STANDARD_2400_COST
);
check(
  "B 10mm Aqualine = $26",
  liveQuotrMaterialCost(PLASTERBOARD_10MM_AQUALINE_2400_KEY) === PLASTERBOARD_10MM_AQUALINE_2400_COST
);
const derived10Std3000 = derivedDimensionedPlasterboardCost(
  "sheet.plasterboard.standard.10mm.3000x1200.each"
);
const derived10Aq3000 = derivedDimensionedPlasterboardCost(
  "sheet.plasterboard.aqualine.10mm.3000x1200.each"
);
const derived10Fyre3000 = derivedDimensionedPlasterboardCost(
  "sheet.plasterboard.fyreline.10mm.3000x1200.each"
);
check(
  "C dimensioned derivation same-family + same-thickness only",
  derived10Std3000 != null &&
    near(derived10Std3000.ratio, 1.25) &&
    near(derived10Std3000.derivedCost, 22.5) &&
    derived10Std3000.baseKey === PLASTERBOARD_10MM_STANDARD_2400_KEY &&
    derived10Aq3000 != null &&
    near(derived10Aq3000.derivedCost, 32.5) &&
    derived10Aq3000.baseKey === PLASTERBOARD_10MM_AQUALINE_2400_KEY &&
    derived10Fyre3000 == null
);
check("D perimeter = $5.50/lm", liveQuotrMaterialCost("steel.ceiling.perimeter_track.lm") === CEILING_STEEL_QUOTR_COST.perimeterLm);
check("E primary = $7.25/lm", liveQuotrMaterialCost("steel.ceiling.primary_channel.lm") === CEILING_STEEL_QUOTR_COST.primaryLm);
check("F furring = $4.20/lm", liveQuotrMaterialCost("steel.ceiling.furring_channel.lm") === CEILING_STEEL_QUOTR_COST.furringLm);
check("G clip = $2 each", liveQuotrMaterialCost("steel.ceiling.crossover_clip.each") === CEILING_STEEL_QUOTR_COST.clipEach);
check("H dropper = $2 each", liveQuotrMaterialCost("steel.ceiling.dropper.each") === CEILING_STEEL_QUOTR_COST.dropperEach);
check("I wire = $0.42/lm", liveQuotrMaterialCost("steel.ceiling.suspension_wire.lm") === CEILING_STEEL_QUOTR_COST.wireLm);
check("J grid = $15/m²", liveQuotrMaterialCost("ceiling.grid.m2") === CEILING_TILE_GRID_QUOTR_COST.gridM2);
check("K 300×300 = $4 each", liveQuotrMaterialCost("ceiling.tile.300x300.each") === CEILING_TILE_GRID_QUOTR_COST.tile300Each);
check("L 600×600 = $16 each", liveQuotrMaterialCost("ceiling.tile.600x600.each") === CEILING_TILE_GRID_QUOTR_COST.tile600Each);
check("M 1200×600 = $19 each", liveQuotrMaterialCost("ceiling.tile.1200x600.each") === CEILING_TILE_GRID_QUOTR_COST.tile1200x600Each);
check("N IW steel track = $5.50/lm", liveQuotrMaterialCost(INTERNAL_WALLS_STEEL_TRACK_KEY) === INTERNAL_WALLS_STEEL_TRACK_QUOTR_COST);
check("O IW steel stud = $6.50/lm", liveQuotrMaterialCost(INTERNAL_WALLS_STEEL_STUD_KEY) === INTERNAL_WALLS_STEEL_STUD_QUOTR_COST);
check(
  "P IW skirting productivity = 0.10 h/lm",
  liveQuotrProductivity(INTERNAL_WALLS_SKIRTING_INSTALL_HOURS_PER_LM_KEY) === INTERNAL_WALLS_SKIRTING_HOURS_PER_LM
);
check(
  "canonical shared plasterboard identities — no Ceiling/IW duplicates",
  !read("lib/rates/specific-material-catalogue.ts").includes("ceilings.plasterboard.10mm") &&
    !read("lib/rates/specific-material-catalogue.ts").includes("internal_walls.plasterboard.10mm") &&
    getCatalogueEntry(PLASTERBOARD_10MM_STANDARD_2400_KEY)?.item_key ===
      PLASTERBOARD_10MM_STANDARD_2400_KEY
);

console.log("\n--- Q–R company override ---\n");
const overrideRates = NEW_COST_KEYS.map((key, index) =>
  orgRate(key, key.endsWith(".each") ? "each" : key.endsWith(".m2") ? "m2" : "lm", 100 + index)
);
const companySteel = runCeiling(steelPortion(), overrideRates);
check(
  "Q company material overrides every Quotr rate",
  material(companySteel.commercial.requirements, CEILINGS_STEEL_PERIMETER_COMPONENT)?.rateSource ===
    "company" &&
    near(
      material(companySteel.commercial.requirements, CEILINGS_STEEL_PERIMETER_COMPONENT)?.unitCost,
      100 + NEW_COST_KEYS.indexOf("steel.ceiling.perimeter_track.lm")
    ) &&
    material(companySteel.commercial.requirements, CEILINGS_STEEL_PRIMARY_COMPONENT)?.rateSource ===
      "company" &&
    near(
      material(companySteel.commercial.requirements, CEILINGS_STEEL_PRIMARY_COMPONENT)?.unitCost,
      100 + NEW_COST_KEYS.indexOf("steel.ceiling.primary_channel.lm")
    ) &&
    material(
      runCeiling(plasterPortion({ thicknessMm: 10, sheetLength: 2400 }), [
        orgRate(PLASTERBOARD_10MM_STANDARD_2400_KEY, "each", 40),
      ]).commercial.requirements,
      CEILINGS_PLASTERBOARD_COMPONENT
    )?.unitCost === 40 &&
    material(
      runCeiling(tilePortion(), [orgRate("ceiling.grid.m2", "m2", 99)]).commercial.requirements,
      CEILINGS_TILE_GRID_GRID_COMPONENT
    )?.unitCost === 99 &&
    (calculateInternalWalls(
      iwCtx(steelIwFacts(), [orgRate(INTERNAL_WALLS_STEEL_TRACK_KEY, "lm", 12)]),
      wa("internal_walls", "w1", "Internal walls")
    ).requirements ?? []
    ).some(
      (row) =>
        row.kind === "material" &&
        row.componentKey === INTERNAL_WALLS_FRAMING_STEEL_TRACK_COMPONENT &&
        row.priced === true &&
        near((row as MaterialRequirement).unitCost, 12)
    )
);
const companySkirtHours = resolveProductivity({
  productivityKey: INTERNAL_WALLS_SKIRTING_INSTALL_HOURS_PER_LM_KEY,
  unit: "lm",
  fallbackHoursPerUnit: 0,
  rates: [orgRate(INTERNAL_WALLS_SKIRTING_INSTALL_HOURS_PER_LM_KEY, "lm", 0.4, { rate_type: "productivity" })],
});
const quotrSkirtHours = resolveProductivity({
  productivityKey: INTERNAL_WALLS_SKIRTING_INSTALL_HOURS_PER_LM_KEY,
  unit: "lm",
  fallbackHoursPerUnit: 0,
  rates: [],
});
check(
  "R company productivity overrides skirting fallback",
  companySkirtHours.hoursPerUnit === 0.4 &&
    companySkirtHours.sourceType === "user_rate" &&
    quotrSkirtHours.hoursPerUnit === INTERNAL_WALLS_SKIRTING_HOURS_PER_LM &&
    companySkirtHours.sourceType !== quotrSkirtHours.sourceType
);

console.log("\n--- S–W ordinary Ceilings complete ---\n");
const common = runCeiling(plasterPortion({ sheetLength: 3000 }));
const commonBoard = material(common.commercial.requirements, CEILINGS_PLASTERBOARD_COMPONENT)!;
check(
  "S common plasterboard ceiling completes",
  common.commercial.completeness === "COMPLETE_COMMERCIAL" &&
    common.commercial.requirements.every((row) => row.priced) &&
    commonBoard.priced === true &&
    near(commonBoard.unitCost, 22.5) &&
    commonBoard.rateSource === "benchmark"
);
const thermal = runCeiling(plasterPortion({ sheetLength: 3000, insulation: true }));
const thermalMat = material(thermal.commercial.requirements, CEILINGS_INSULATION_COMPONENT)!;
const thermalLab = labour(thermal.commercial.requirements, CEILINGS_INSULATION_LABOUR);
check(
  "T thermal ceiling completes",
  thermal.commercial.completeness === "COMPLETE_COMMERCIAL" &&
    thermalMat.priced === true &&
    near(thermalMat.purchaseQuantity, 12) &&
    near(thermalMat.unitCost, ORDINARY_THERMAL_INSULATION_COST) &&
    near(thermalMat.totalCost, 12 * ORDINARY_THERMAL_INSULATION_COST) &&
    thermalLab?.priced === true &&
    near(thermalLab.productivityBasis.hoursPerUnit, 0.05) &&
    near(thermalLab.baseHours, 0.6)
);
const hostedThermal = hostedCeiling(plasterPortion({ sheetLength: 3000, insulation: true }));
const hostedBoard = hostedThermal.requirements.find(
  (row) => row.kind === "material" && row.componentKey === CEILINGS_PLASTERBOARD_COMPONENT
) as MaterialRequirement | undefined;
const hostedThermalMat = hostedThermal.requirements.find(
  (row) => row.kind === "material" && row.componentKey === CEILINGS_INSULATION_COMPONENT
) as MaterialRequirement | undefined;
check(
  "T-hosted calculateEstimate thermal 4×3 resolves Quotr fallbacks",
  hostedBoard?.priced === true &&
    near(hostedBoard?.unitCost, 22.5) &&
    hostedThermalMat?.priced === true &&
    near(hostedThermalMat?.unitCost, ORDINARY_THERMAL_INSULATION_COST) &&
    hostedThermal.lineItems.every((item) => item.rateSourceType !== "missing")
);

const disclosedBh = plasterPortion({ insulation: true });
delete disclosedBh.lining.sheet_length_mm;
delete disclosedBh.lining.sheet_width_mm;
const bhRow = createEmptyCeilingBulkhead({
  id: "bbbbbbbb-bbbb-4ccc-8ddd-222222222222",
  label: "Downstand",
});
bhRow.form = "conventional_two_face_downstand";
bhRow.topology = "conventional_two_face_downstand";
bhRow.length_m = 5;
bhRow.depth_m = 0.5;
bhRow.height_m = 0.5;
bhRow.framing_type = "timber";
bhRow.lining_type = "standard";
bhRow.thickness_mm = 13;
disclosedBh.has_bulkheads = true;
disclosedBh.bulkheads = [bhRow];
const hostedDisclosedBh = hostedCeiling(disclosedBh);
const disclosedBoard = hostedDisclosedBh.requirements.find(
  (row) => row.kind === "material" && row.componentKey === CEILINGS_PLASTERBOARD_COMPONENT
) as MaterialRequirement | undefined;
check(
  "T-hosted disclosed sheets + ordinary bulkhead still prices lounge lining",
  disclosedBoard?.priced === true &&
    disclosedBoard.materialKey === "sheet.plasterboard.standard.13mm.3000x1200.each" &&
    near(disclosedBoard.unitCost, 22.5) &&
    hostedDisclosedBh.lineItems.some(
      (item) =>
        item.componentKey === CEILINGS_PLASTERBOARD_COMPONENT &&
        item.rateSourceType !== "missing" &&
        near(item.costRate, 22.5)
    )
);
const direct = runCeiling(steelPortion());
check(
  "U direct steel ceiling completes",
  direct.commercial.completeness === "COMPLETE_COMMERCIAL" &&
    near(material(direct.commercial.requirements, CEILINGS_STEEL_PERIMETER_COMPONENT)?.baseQuantity, 14) &&
    near(material(direct.commercial.requirements, CEILINGS_STEEL_PRIMARY_COMPONENT)?.baseQuantity, 32) &&
    near(material(direct.commercial.requirements, CEILINGS_STEEL_FURRING_COMPONENT)?.baseQuantity, 30) &&
    near(material(direct.commercial.requirements, CEILINGS_STEEL_CLIP_COMPONENT)?.baseQuantity, 80) &&
    near(material(direct.commercial.requirements, CEILINGS_STEEL_PERIMETER_COMPONENT)?.unitCost, 5.5) &&
    near(material(direct.commercial.requirements, CEILINGS_STEEL_PRIMARY_COMPONENT)?.unitCost, 7.25) &&
    near(material(direct.commercial.requirements, CEILINGS_STEEL_FURRING_COMPONENT)?.unitCost, 4.2) &&
    near(material(direct.commercial.requirements, CEILINGS_STEEL_CLIP_COMPONENT)?.unitCost, 2) &&
    direct.commercial.requirements.every((row) => row.priced)
);
const suspended = runCeiling(steelPortion({ suspended: true }));
check(
  "V suspended ceiling completes, no wire labour duplication",
  suspended.commercial.completeness === "COMPLETE_COMMERCIAL" &&
    near(material(suspended.commercial.requirements, CEILINGS_SUSPENSION_DROPPER_COMPONENT)?.baseQuantity, 16) &&
    near(material(suspended.commercial.requirements, CEILINGS_SUSPENSION_WIRE_COMPONENT)?.baseQuantity, 9.6) &&
    near(material(suspended.commercial.requirements, CEILINGS_SUSPENSION_DROPPER_COMPONENT)?.unitCost, 2) &&
    near(material(suspended.commercial.requirements, CEILINGS_SUSPENSION_WIRE_COMPONENT)?.unitCost, 0.42) &&
    labour(suspended.commercial.requirements, "ceilings.suspension.wire.install") == null &&
    suspended.commercial.wireLabourDecision === CEILINGS_WIRE_LABOUR_DECISION &&
    suspended.commercial.requirements.every((row) => row.priced)
);
const tiles = runCeiling(tilePortion());
const grid = material(tiles.commercial.requirements, CEILINGS_TILE_GRID_GRID_COMPONENT)!;
const tileMat = material(tiles.commercial.requirements, CEILINGS_TILE_GRID_TILE_COMPONENT)!;
check(
  "W ordinary Tile/Grid completes",
  tiles.commercial.completeness === "COMPLETE_COMMERCIAL" &&
    near(grid.baseQuantity, 30) &&
    near(grid.unitCost, 15) &&
    near(grid.totalCost, 450) &&
    near(tileMat.baseQuantity, 84) &&
    near(tileMat.unitCost, 16) &&
    near(labour(tiles.commercial.requirements, "ceilings.grid.install")?.adjustedHours, 5.4) &&
    near(labour(tiles.commercial.requirements, "ceilings.tile.install")?.adjustedHours, 2.1) &&
    tiles.commercial.requirements.every((row) => row.priced)
);

console.log("\n--- X–Y Internal Walls ---\n");
const iwSteel = calculateInternalWalls(iwCtx(steelIwFacts()), wa("internal_walls", "w1", "Internal walls"));
const track = (iwSteel.requirements ?? []).find(
  (row): row is MaterialRequirement =>
    row.kind === "material" && row.componentKey === INTERNAL_WALLS_FRAMING_STEEL_TRACK_COMPONENT
);
const stud = (iwSteel.requirements ?? []).find(
  (row): row is MaterialRequirement =>
    row.kind === "material" && row.componentKey === INTERNAL_WALLS_FRAMING_STEEL_STUD_COMPONENT
);
const steelLab = (iwSteel.requirements ?? []).find(
  (row): row is LabourRequirement =>
    row.kind === "labour" && row.componentKey === INTERNAL_WALLS_FRAMING_STEEL_LABOUR_COMPONENT
);
check(
  "X ordinary IW steel completes",
  track?.priced === true &&
    stud?.priced === true &&
    near(track.unitCost, 5.5) &&
    near(stud.unitCost, 6.5) &&
    near(track.purchaseQuantity, 20) &&
    near(stud.purchaseQuantity, 43.2) &&
    steelLab?.priced === true
);
const iwSkirt = calculateInternalWalls(
  iwCtx(timberSkirtingFacts()),
  wa("internal_walls", "w1", "Internal walls")
);
const skirtMat = (iwSkirt.requirements ?? []).find(
  (row): row is MaterialRequirement =>
    row.kind === "material" && row.componentKey === INTERNAL_WALLS_SKIRTING_MATERIAL_COMPONENT
);
const skirtLab = (iwSkirt.requirements ?? []).find(
  (row): row is LabourRequirement =>
    row.kind === "labour" && row.componentKey === INTERNAL_WALLS_SKIRTING_LABOUR_COMPONENT
);
const labourCost = resolveLabourRate({ rates: [], organisationSettings: SETTINGS });
check(
  "Y ordinary IW skirting completes",
  skirtMat?.priced === true &&
    near(skirtMat.unitCost, 28) &&
    skirtLab?.priced === true &&
    near(skirtLab.productivityBasis.hoursPerUnit, 0.1) &&
    labourCost.costRate === 60 &&
    getCatalogueEntry(INTERNAL_WALLS_SKIRTING_MATERIAL_KEY)?.defaultCostRate === 28
);

console.log("\n--- Z / AA–AC specialty, margin, quantities ---\n");
const specialist = plasterPortion();
specialist.specialist_kind = "coffered";
const specRun = runCeiling(specialist);
const lining = plasterPortion();
lining.lining.family = "timber_lined";
lining.lining.timber_lined = { board_width_mm: 90, gap_mm: 10, direction: "along_length" };
const liningRun = runCeiling(lining);
const acoustic = plasterPortion({ insulation: true });
acoustic.finish.insulation_type = "acoustic";
const acousticRun = runCeiling(acoustic);
check(
  "Z specialty systems remain PR",
  specRun.commercial.completeness !== "COMPLETE_COMMERCIAL" &&
    liningRun.commercial.completeness === "PRICING_REQUIRED" &&
    material(liningRun.commercial.requirements, CEILINGS_TIMBER_LINING_COMPONENT)?.priced === false &&
    material(acousticRun.commercial.requirements, CEILINGS_INSULATION_COMPONENT)?.priced === false &&
    isOrdinaryInternalWallsSteel92({
      frame_system: "steel",
      steel: { system: "track_and_stud", stud_width_mm: 150 },
    }) === false &&
    isOrdinaryInternalWallsSteel92({
      frame_system: "steel",
      steel: { system: "track_and_stud", stud_width_mm: null },
    }) === true &&
    listIntentionalPricingRequired("ceilings").some((row) => /timber lining|specialist/i.test(row.component)) &&
    listIntentionalPricingRequired("internal_walls").some((row) => /cornice|level 5|acoustic/i.test(row.component))
);
const boardLine = common.commercial.lineItems.find(
  (item) => item.componentKey === CEILINGS_PLASTERBOARD_COMPONENT
)!;
check(
  "AA margin applied once",
  boardLine.sellAuthority === "derived_from_gross_margin" &&
    near(boardLine.sellRate ?? -1, 22.5 / 0.8) &&
    boardLine.sellDerivedFromMargin === true
);
check(
  "AB no hidden sell",
  NEW_COST_KEYS.every((key) => getCatalogueEntry(key)?.defaultSellRate == null) &&
    !read("lib/estimate/ceilings-commercial.ts").includes("FITOUT_BENCHMARKS") &&
    near(deriveSellFromCost(18, 20), 22.5)
);
check(
  "AC quantities unchanged",
  near(material(direct.commercial.requirements, CEILINGS_STEEL_PERIMETER_COMPONENT)?.baseQuantity, 14) &&
    near(material(direct.commercial.requirements, CEILINGS_STEEL_PRIMARY_COMPONENT)?.baseQuantity, 32) &&
    near(material(direct.commercial.requirements, CEILINGS_STEEL_FURRING_COMPONENT)?.baseQuantity, 30) &&
    near(material(direct.commercial.requirements, CEILINGS_STEEL_CLIP_COMPONENT)?.baseQuantity, 80) &&
    near(grid.baseQuantity, 30) &&
    near(tileMat.baseQuantity, 84) &&
    CEILINGS_QUOTR_PRODUCTIVITY_HOURS[CEILINGS_PRODUCTIVITY_KEYS.gridM2] === 0.18 &&
    CEILINGS_QUOTR_PRODUCTIVITY_HOURS[CEILINGS_PRODUCTIVITY_KEYS.tileEach] === 0.025
);

const tenMmCeiling = runCeiling(plasterPortion({ thicknessMm: 10, sheetLength: 2400 }));
const tenMmBoard = material(tenMmCeiling.commercial.requirements, CEILINGS_PLASTERBOARD_COMPONENT);
check(
  "18 ceiling 10mm Standard resolves at $18 shared identity",
  tenMmBoard?.priced === true &&
    tenMmBoard.materialKey === PLASTERBOARD_10MM_STANDARD_2400_KEY &&
    near(tenMmBoard.unitCost, 18)
);
const iwTen = calculateInternalWalls(iwCtx(tenMmIwFacts()), wa("internal_walls", "w1", "Internal walls"));
const iwTenMat = (iwTen.requirements ?? []).find(
  (row): row is MaterialRequirement =>
    row.kind === "material" && row.materialKey === PLASTERBOARD_10MM_STANDARD_2400_KEY
);
check(
  "18 IW 10mm Standard uses the same shared $18 identity",
  internalWallsLiningMaterialKey({
    product: "standard_gib",
    thicknessMm: 10,
    lengthMm: 2400,
  }).materialKey === PLASTERBOARD_10MM_STANDARD_2400_KEY &&
    iwTenMat?.priced === true &&
    near(iwTenMat.unitCost, 18)
);

console.log("\n--- AD–AF Project Conditions ---\n");
const ordinaryFacts = writePortions([plasterPortion({ sheetLength: 3000 })]);
const highPortion = plasterPortion({ sheetLength: 3000 });
highPortion.height_m = 4.8;
const highFacts = writePortions([highPortion]);
const ordinaryView = composeInterior({
  brief: "4x3 lounge ceiling, existing framing, 13mm Standard GIB, 2.4m ceiling height, normal access",
  workAreas: [{ id: "c1", type: "ceilings", name: "Ceilings" }],
  facts: ordinaryFacts,
});
const highView = composeInterior({
  brief: "4x3 ceiling at 4.8m working height",
  workAreas: [{ id: "c1", type: "ceilings", name: "Ceilings" }],
  facts: highFacts,
});
check(
  "AD Project Conditions regressions: ordinary 2.4m does not ask high-level access",
  !pcKeys(ordinaryView).includes(HIGH_LEVEL_ACCESS_KEY) &&
    scaffoldQuestionWouldBeAsked(ordinaryFacts) === false
);
check(
  "AE high-level access relevance unchanged",
  pcKeys(highView).includes(HIGH_LEVEL_ACCESS_KEY) &&
    scaffoldQuestionWouldBeAsked(highFacts) === true
);
const multiView = composeInterior({
  brief: "interior fitout",
  workAreas: [
    { id: "c1", type: "ceilings", name: "Ceilings" },
    { id: "w1", type: "internal_walls", name: "Internal walls" },
    { id: "p1", type: "painting", name: "Painting" },
  ],
  facts: ordinaryFacts,
});
const multiKeys = pcKeys(multiView);
check(
  "AF one-question-once unchanged",
  multiKeys.every((key) => multiKeys.filter((row) => row === key).length === 1)
);

console.log("\n--- AG–AH coverage ---\n");
const ceilingCoverage = verifyRegisteredWorkAreaBenchmarkCoverage("ceilings");
const iwCoverage = verifyRegisteredWorkAreaBenchmarkCoverage("internal_walls");
check(
  "AG benchmark coverage shows no Category C for ordinary Ceilings",
  ceilingCoverage.ok &&
    ceilingCoverage.needsOwnerApproval.length === 0 &&
    workAreaMayCloseAtL5(ceilingCoverage) &&
    listOwnerApprovalGaps("ceilings").length === 0
);
check(
  "AH benchmark coverage shows no Category C for ordinary IW",
  iwCoverage.ok &&
    iwCoverage.needsOwnerApproval.length === 0 &&
    workAreaMayCloseAtL5(iwCoverage) &&
    listOwnerApprovalGaps("internal_walls").length === 0
);

const review = composeBuilderReview({
  estimate: {
    recommendedCost: common.commercial.lineItems.reduce((sum, item) => sum + (item.recommendedCost ?? 0), 0),
    recommendedSell: common.commercial.lineItems.reduce((sum, item) => sum + (item.recommendedSell ?? 0), 0),
    marginPercent: 20,
    confidence: "high",
    assumptions: common.commercial.assumptions,
    missingInfo: [],
    lineItems: common.commercial.lineItems.map((item, index) => ({
      id: `line-${index}`,
      ...item,
    })),
  },
  workAreas: [{ id: "c1", type: "ceilings", name: "Ceilings", status: "confirmed" }],
  requirements: common.commercial.requirements,
});
const reviewText = JSON.stringify(review);
check(
  "Builder Review still breaks down materials/labour/fixings with Quotr benchmark",
  /Quotr benchmark/i.test(reviewText) &&
    /plasterboard|lining|fixings|labour/i.test(reviewText) &&
    !/flattened/i.test(reviewText)
);

check(
  "rate source metadata is Quotr benchmark, not company/user/manual",
  commonBoard.rateSource === "benchmark" &&
    track?.rateSource === "benchmark" &&
    skirtMat?.rateSource === "benchmark" &&
    common.commercial.lineItems.some((item) => item.rateSource === "Quotr benchmark")
);

check(
  "preserved approved rates unchanged",
  liveQuotrMaterialCost("timber.framing.90x45.h1.2.lm") === 6.2 &&
    liveQuotrMaterialCost("timber.framing.140x45.h1.2.lm") === 9.65 &&
    liveQuotrMaterialCost("sheet.plasterboard.standard.each") === 18 &&
    liveQuotrMaterialCost("sheet.plasterboard.aqualine.each") === 26 &&
    liveQuotrMaterialCost("sheet.plasterboard.fyreline.each") === 24
);

check(
  "Preview only — hardening branch URL",
  PREVIEW_AUTH_SITE_ORIGIN_STABLE.includes("hardening-stage-2a-security")
);

console.log("\n--- Prior verifiers ---\n");
const prior = [
  "scripts/verify-est-benchmark-01a.ts",
  "scripts/verify-work-area-internal-walls-04.ts",
];
for (const script of prior) {
  check(script.replace("scripts/", ""), spawnVerifier(script));
}

console.log("\n--- TypeScript / eslint / build:safe ---\n");
check("TypeScript", spawnCmd("npx", ["tsc", "--noEmit"]));
check(
  "targeted eslint",
  spawnCmd("npx", [
    "eslint",
    "lib/estimate/work-area-benchmark-coverage.ts",
    "lib/estimate/internal-walls-finish-physical.ts",
    "lib/estimate/internal-walls-physical.ts",
    "lib/estimate/productivity.ts",
    "lib/rates/specific-material-catalogue.ts",
    "scripts/verify-est-benchmark-01b.ts",
    "scripts/verify-est-benchmark-01a.ts",
    "scripts/verify-ceilings-wa-05a.ts",
    "scripts/verify-ceilings-wa-05b.ts",
    "scripts/verify-work-area-internal-walls-04.ts",
    "scripts/verify-work-area-internal-walls-07.ts",
  ])
);
check("build:safe", spawnCmd("npm", ["run", "build:safe"]));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
