/**
 * WA-INTERNAL-WALLS-08 — stopping + painting + commercial close.
 *
 * Run: npx --yes tsx scripts/verify-work-area-internal-walls-08.ts
 *
 * No paid AI. No Production. No migration 055.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import type { EstimateLineItem } from "../components/assistant/types";
import { calculateInternalWalls } from "../lib/estimate/calculators/fitout";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import {
  assertNoDuplicateActiveComponents,
  DuplicateActiveComponentError,
} from "../lib/estimate/component-commercial-selection";
import { dedupePricedItemsByScopeOwnership } from "../lib/estimate/pricing-ownership";
import {
  INTERNAL_WALLS_JOB_SCOPE_FACT_KEY,
  INTERNAL_WALLS_STRUCTURAL_FACT_KEY,
  isMatureInternalWallsPath,
} from "../lib/estimate/internal-walls-scope";
import {
  INTERNAL_WALLS_ADD_WALL_TYPE_KEY,
  INTERNAL_WALLS_STRUCTURAL_SPECIALIST_MESSAGE as STRUCTURAL_MSG,
  applyInternalWallsFactWrite,
  nextInternalWallsWallTypeField,
  resolveInternalWallsWallTypes,
} from "../lib/estimate/internal-walls-wall-types";
import { INTERNAL_WALLS_HAS_OPENINGS_KEY } from "../lib/estimate/internal-walls-openings";
import {
  INTERNAL_WALLS_CORNICE_SIDES_KEY,
  INTERNAL_WALLS_ELECTRICAL_KEY,
  INTERNAL_WALLS_INSULATION_INCLUDED_KEY,
  INTERNAL_WALLS_INSULATION_TYPE_KEY,
  INTERNAL_WALLS_PAINTING_SIDES_KEY,
  INTERNAL_WALLS_SKIRTING_SIDES_KEY,
  INTERNAL_WALLS_STOPPING_SIDE_A_KEY,
  INTERNAL_WALLS_STOPPING_SIDE_B_KEY,
  paintingTakeoff,
  stoppingTakeoff,
  visibleFaceAreaM2,
} from "../lib/estimate/internal-walls-finish";
import {
  INTERNAL_WALLS_FRAMING_90_MATERIAL_COMPONENT,
  INTERNAL_WALLS_PAINTING_COMPONENT,
  INTERNAL_WALLS_PAINTING_MATERIAL_KEY,
  INTERNAL_WALLS_SKIRTING_LABOUR_COMPONENT,
  INTERNAL_WALLS_SKIRTING_MATERIAL_COMPONENT,
  INTERNAL_WALLS_STOPPING_COMPONENT,
  internalWallsLiningMaterialComponent,
  internalWallsStoppingOverlapGroup,
  isInternalWallsLiningComponentKey,
  internalWallsStoppingItemKey,
  looksLikeDoorProductMoney,
} from "../lib/estimate/internal-walls-identities";
import { PREVIEW_SUPABASE_PROJECT_REF } from "../lib/deployment/environment";
import {
  PREVIEW_AUTH_SITE_ORIGIN_STABLE,
  PREVIEW_PASSWORD_PROTECTED_EMAILS,
  assertSafePreviewPasswordMutation,
  isPlusAddressFixture,
} from "./lib/preview-auth-fixture";
import { buildWorkAreaQuoteDescriptionDraft } from "../lib/work-areas/quote-description";
import { getCatalogueEntry } from "../lib/rates/catalogue";
import { FITOUT_BENCHMARKS } from "../lib/estimate/benchmark-rates";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "../lib/estimate/types";
import type { OrganisationRate } from "../components/setup/types";
import type {
  LabourRequirement,
  MaterialRequirement,
  SubcontractRequirement,
} from "../lib/estimate/requirements";
import { internalWallsScope } from "../lib/scopes/templates/internal-walls";

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

function near(actual: number | null | undefined, expected: number, tol = 1e-6): boolean {
  return actual != null && Number.isFinite(actual) && Math.abs(actual - expected) <= tol;
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function numberedMigrations(): string[] {
  return readdirSync(join(process.cwd(), "supabase/migrations"))
    .filter((name) => /^\d+_/.test(name) && name.endsWith(".sql"))
    .sort();
}

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

function wa(
  id: string,
  type: string,
  name: string
): EstimateWorkArea & { status: "confirmed" } {
  return { id, type, name, sort_order: 1, status: "confirmed" };
}

function ctx(
  workAreas: EstimateWorkArea[],
  facts: EstimateFact[],
  rates: OrganisationRate[] = []
): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: workAreas,
    facts,
    constraints: [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
      premium_rate_factor: 1.15,
    },
    materialWastageSettings: {
      defaultMaterialWastagePercent: 10,
      timberFramingWastagePercent: 10,
      sheetMaterialWastagePercent: 10,
    },
    rates,
  } as unknown as EstimateContext;
}

function writeWall(
  workAreaId: string,
  writes: Array<{ key: string; value: unknown; wallTypeId?: string; openingId?: string }>
): EstimateFact[] {
  let facts: EstimateFact[] = [];
  for (const row of writes) {
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId,
      key: row.key,
      value: row.value,
      wallTypeId: row.wallTypeId,
      openingId: row.openingId,
    });
  }
  return facts;
}

function mapCalcLines(items: readonly EstimateLineItemInput[]): EstimateLineItem[] {
  return items.map((item, index) => ({
    id: `line-${index}`,
    workAreaId: item.workAreaId,
    workAreaName: item.workAreaName,
    label: item.label,
    category: item.category,
    quantity: item.quantity,
    unit: item.unit,
    recommendedCost: item.recommendedCost ?? 0,
    recommendedSell: item.recommendedSell ?? 0,
    rateSource: item.rateSource,
    rateSourceType: item.rateSourceType,
    itemKey: item.itemKey,
    componentKey: item.componentKey,
    notes: item.notes,
    identitySummary: item.identitySummary,
    includedInTotal: item.includedInTotal,
    overlapGroup: item.overlapGroup,
  }));
}

function mats(calc: ReturnType<typeof calculateInternalWalls>): MaterialRequirement[] {
  return (calc.requirements ?? []).filter(
    (row): row is MaterialRequirement => row.kind === "material"
  );
}

function labs(calc: ReturnType<typeof calculateInternalWalls>): LabourRequirement[] {
  return (calc.requirements ?? []).filter(
    (row): row is LabourRequirement => row.kind === "labour"
  );
}

function subs(calc: ReturnType<typeof calculateInternalWalls>): SubcontractRequirement[] {
  return (calc.requirements ?? []).filter(
    (row): row is SubcontractRequirement => row.kind === "subcontract"
  );
}

function isLegacyPackage(calc: ReturnType<typeof calculateInternalWalls>): boolean {
  return calc.lineItems.some(
    (row) =>
      /internal walls package/i.test(row.label) ||
      row.itemKey === "scope.internal_walls.m2" ||
      (row.quantity === 20 && /internal wall/i.test(row.label)) ||
      /\$95|\$145/.test(`${row.label} ${row.notes ?? ""}`)
  );
}

function silentZero(calc: ReturnType<typeof calculateInternalWalls>): boolean {
  return calc.lineItems.some(
    (row) =>
      (row.rateSourceType === "missing" || /pricing required/i.test(row.rateSource ?? "")) &&
      row.priced === true
  );
}

const walls = wa("w1", "internal_walls", "Internal walls");

function fixtureBase(
  extra: Array<{ key: string; value: unknown }> = [],
  opts?: { length?: number; height?: number; bothSides?: boolean; openings?: boolean }
): EstimateFact[] {
  const length = opts?.length ?? 12;
  const height = opts?.height ?? 2.4;
  const both = opts?.bothSides !== false;
  const withOpenings = opts?.openings !== false;
  let facts = writeWall("w1", [
    { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
    { key: "internal_walls.wall_type.label", value: "Wall Type A" },
    { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
    { key: "internal_walls.wall_type.frame_size", value: "90 mm timber framing — 90×45" },
    { key: "internal_walls.wall_type.length_lm", value: length },
    { key: "internal_walls.wall_type.height_m", value: height },
    { key: "internal_walls.wall_type.stud_centres_mm", value: "600 mm" },
    { key: "internal_walls.wall_type.side_a_product", value: "Standard GIB" },
    { key: "internal_walls.wall_type.same_lining_both_sides", value: both },
    { key: INTERNAL_WALLS_HAS_OPENINGS_KEY, value: withOpenings ? "Yes" : "No" },
  ]);
  const type = resolveInternalWallsWallTypes({ facts, workAreaId: "w1" }).types[0]!;
  if (withOpenings) {
    const openingId = type.openings[0]!.id;
    facts = applyInternalWallsFactWrite({
      facts, workAreaId: "w1", key: "internal_walls.opening.type", value: "Door opening", wallTypeId: type.id, openingId,
    });
    facts = applyInternalWallsFactWrite({
      facts, workAreaId: "w1", key: "internal_walls.opening.width_m", value: 0.81, wallTypeId: type.id, openingId,
    });
    facts = applyInternalWallsFactWrite({
      facts, workAreaId: "w1", key: "internal_walls.opening.height_m", value: 1.98, wallTypeId: type.id, openingId,
    });
  }
  for (const row of extra) {
    facts = applyInternalWallsFactWrite({
      facts, workAreaId: "w1", key: row.key, value: row.value, wallTypeId: type.id,
    });
  }
  return [
    fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "new_partition"),
    ...facts.filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
  ];
}

function finishExtras(params?: {
  insulation?: boolean;
  skirting?: boolean;
  cornice?: boolean;
  electrical?: boolean;
  stopping?: string;
  painting?: string;
}): Array<{ key: string; value: unknown }> {
  return [
    { key: INTERNAL_WALLS_INSULATION_INCLUDED_KEY, value: params?.insulation ? "Yes" : "No" },
    ...(params?.insulation
      ? [{ key: INTERNAL_WALLS_INSULATION_TYPE_KEY, value: "Acoustic" }]
      : []),
    { key: INTERNAL_WALLS_SKIRTING_SIDES_KEY, value: params?.skirting ? "Both sides" : "No" },
    { key: INTERNAL_WALLS_CORNICE_SIDES_KEY, value: params?.cornice ? "Both sides" : "No" },
    ...(params?.cornice
      ? [
          {
            key: "internal_walls.wall_type.cornice_type",
            value: "Plaster cornice/cove",
          },
          {
            key: "internal_walls.wall_type.cornice_product",
            value: "GIB-Cove® Classic 55mm × 3.6m",
          },
        ]
      : []),
    { key: INTERNAL_WALLS_ELECTRICAL_KEY, value: params?.electrical ? "Standard" : "No" },
    { key: INTERNAL_WALLS_STOPPING_SIDE_A_KEY, value: params?.stopping ?? "Level 4" },
    { key: INTERNAL_WALLS_STOPPING_SIDE_B_KEY, value: params?.stopping ?? "Level 4" },
    { key: INTERNAL_WALLS_PAINTING_SIDES_KEY, value: params?.painting ?? "Both sides" },
  ];
}

console.log("=== WA-INTERNAL-WALLS-08 ===\n");

console.log("--- Rate audit ---\n");
check(
  "Level 4 stopping has ordinary Quotr COST (FITOUT stoppingPerM2 reused)",
  getCatalogueEntry("stopping.plasterboard.level4.m2")?.defaultCostRate ===
    FITOUT_BENCHMARKS.stoppingPerM2.cost
);
check(
  "Level 5 stopping catalogue identity stays Pricing Required (no Quotr COST)",
  getCatalogueEntry("stopping.plasterboard.level5.m2") != null &&
    getCatalogueEntry("stopping.plasterboard.level5.m2")?.defaultCostRate == null
);
check(
  "bathroom.stopping.m2 is bathroom-specific",
  getCatalogueEntry("bathroom.stopping.m2")?.work_area_type === "bathroom"
);
check(
  "painting.wall.m2 uses the approved $4.93/m² cost",
  getCatalogueEntry("painting.wall.m2") != null &&
    getCatalogueEntry("painting.wall.m2")?.defaultCostRate === 4.93
);
check(
  "do not reuse painting.material.m2 for IW nested paint",
  getCatalogueEntry("painting.material.m2")?.item_key === "painting.material.m2"
);
check(
  "paint.litre coverage is still a package, not IW authority",
  /not currently priced/i.test(getCatalogueEntry("paint.litre")?.description ?? "") ||
    getCatalogueEntry("paint.litre") != null
);
check(
  "FITOUT stoppingPerM2 remains the canonical Level 4 COST reused via catalogue identity",
  FITOUT_BENCHMARKS.stoppingPerM2.cost === 28
);

console.log("\n--- Fixture A stopping Level 4 both faces ---\n");
const aFacts = fixtureBase(finishExtras({ stopping: "Level 4", painting: "No" }));
check("Fixture A mature", isMatureInternalWallsPath({ facts: aFacts, workAreaId: "w1" }));
const aType = resolveInternalWallsWallTypes({ facts: aFacts, workAreaId: "w1" }).types[0]!;
const aArea = visibleFaceAreaM2({ type: aType, jobScope: "new_partition" });
check("Fixture A net face 27.1962", aArea.ok && near(aArea.areaM2, 27.1962));
const aStop = stoppingTakeoff({ type: aType, jobScope: "new_partition" });
check("Fixture A stopping 27.1962 per face", Boolean(aStop?.sideA && near(aStop.sideA.areaM2, 27.1962) && aStop.sideB && near(aStop.sideB.areaM2, 27.1962)));
check("Fixture A stopping total 54.3924", Boolean(aStop && near(aStop.totalM2, 54.3924)));
const aCalc = calculateInternalWalls(ctx([walls], aFacts), walls);
const aStopReq = subs(aCalc).filter((row) => row.componentKey === INTERNAL_WALLS_STOPPING_COMPONENT);
check("Fixture A two stopping requirements", aStopReq.length === 2);
check(
  "Fixture A Level 4 identity",
  aCalc.lineItems.filter((row) => row.componentKey === INTERNAL_WALLS_STOPPING_COMPONENT).every(
    (row) => row.itemKey === internalWallsStoppingItemKey("level_4")
  )
);
check(
  "Fixture A stopping uses Quotr Level 4 COST",
  aStopReq.every((row) => row.priced === true) &&
    aCalc.lineItems
      .filter((row) => row.componentKey === INTERNAL_WALLS_STOPPING_COMPONENT)
      .every(
        (row) =>
          row.rateSourceType === "benchmark" &&
          near(row.quantity, 27.1962) &&
          (row.recommendedCost ?? 0) > 0
      )
);
check("Fixture A no layers multiplier in notes", aCalc.lineItems.every((row) => !/×\s*2 layers/i.test(row.notes ?? "")));
check("Fixture A no legacy package", !isLegacyPackage(aCalc));
check("Fixture A no door money", !aCalc.lineItems.some((row) => looksLikeDoorProductMoney(row)));

console.log("\n--- 6 m × 2.4 m both-side stopping survives commercial ownership ---\n");
const partitionFaceM2 = 6 * 2.4 - 0.81 * 1.98;
const partitionFacts = fixtureBase(
  finishExtras({ insulation: false, skirting: false, stopping: "Level 4", painting: "No" }),
  { length: 6, height: 2.4, openings: true }
);
const partitionCalc = calculateInternalWalls(ctx([walls], partitionFacts), walls);
const partitionOwned = dedupePricedItemsByScopeOwnership(partitionCalc.lineItems);
const partitionStopping = partitionOwned.filter(
  (row) =>
    row.componentKey === INTERNAL_WALLS_STOPPING_COMPONENT &&
    row.includedInTotal !== false
);
const partitionStoppingQty = partitionStopping.reduce(
  (sum, row) => sum + (row.quantity ?? 0),
  0
);
check(
  "partition gross face is 14.4 m² and one opening deducts 1.6038 m² once per face",
  near(partitionFaceM2, 12.7962)
);
check(
  "partition stopping keeps both faces after ownership",
  partitionStopping.length === 2 && near(partitionStoppingQty, partitionFaceM2 * 2, 0.02)
);
const liningMaterial = (row: { componentKey?: string | null }) =>
  isInternalWallsLiningComponentKey(row.componentKey) &&
  (row.componentKey ?? "").endsWith(".material");
const partitionLiningBefore = partitionCalc.lineItems.filter(liningMaterial);
const partitionLiningAfter = partitionOwned.filter(
  (row) => liningMaterial(row) && row.includedInTotal !== false
);
check(
  "partition lining emits each face once and the commercial quantity is their sum",
  partitionLiningBefore.length === 2 &&
    partitionLiningBefore[0]?.quantity === partitionLiningBefore[1]?.quantity &&
    partitionLiningAfter.length === 1 &&
    near(
      partitionLiningAfter[0]?.quantity ?? 0,
      (partitionLiningBefore[0]?.quantity ?? 0) +
        (partitionLiningBefore[1]?.quantity ?? 0)
    )
);

console.log("\n--- stated skirting length is not replaced by both faces ---\n");
const statedSkirtFacts = [
  ...fixtureBase(
    finishExtras({ insulation: false, skirting: true, stopping: "No", painting: "No" }),
    { length: 24, height: 2.7, openings: false, bothSides: true }
  ),
  fact("internal_walls.skirting_length_lm", "w1", 45),
];
const statedSkirt = calculateInternalWalls(ctx([walls], statedSkirtFacts), walls);
const statedSkirtLines = statedSkirt.lineItems.filter(
  (row) => row.componentKey === INTERNAL_WALLS_SKIRTING_MATERIAL_COMPONENT
);
check(
  "stated 45 lm skirting stays 45 lm when both faces would derive 48 lm",
  statedSkirtLines.length === 1 &&
    statedSkirtLines[0]?.unit === "lm" &&
    statedSkirtLines[0]?.quantity === 45 &&
    statedSkirt.assumptions.some((row) => row.includes("derive 48"))
);
const derivedSkirt = calculateInternalWalls(
  ctx(
    [walls],
    fixtureBase(
      finishExtras({ insulation: false, skirting: true, stopping: "No", painting: "No" }),
      { length: 10, height: 2.4, openings: false, bothSides: true }
    )
  ),
  walls
);
const derivedSkirtLine = derivedSkirt.lineItems.find(
  (row) => row.componentKey === INTERNAL_WALLS_SKIRTING_MATERIAL_COMPONENT
);
check(
  "skirting with no stated length uses both face lengths",
  derivedSkirtLine?.quantity === 20 && derivedSkirtLine.unit === "lm"
);
const unallocatedSkirtFacts = [
  ...fixtureBase(
    finishExtras({
      insulation: false,
      skirting: false,
      stopping: "No",
      painting: "No",
    }).filter((row) => row.key !== INTERNAL_WALLS_SKIRTING_SIDES_KEY),
    { length: 24, height: 2.7, openings: false, bothSides: true }
  ),
  fact("internal_walls.skirting_length_lm", "w1", 45),
  fact("internal_walls.skirtings_included", "w1", true),
  fact("internal_walls.painting_included", "w1", true),
];
const unallocatedType = resolveInternalWallsWallTypes({
  facts: unallocatedSkirtFacts,
  workAreaId: "w1",
}).types[0];
const unallocatedSkirt = calculateInternalWalls(
  ctx([walls], unallocatedSkirtFacts),
  walls
);
const unallocatedMaterial = unallocatedSkirt.lineItems.filter(
  (row) => row.componentKey === INTERNAL_WALLS_SKIRTING_MATERIAL_COMPONENT
);
const unallocatedLabour = unallocatedSkirt.lineItems.filter(
  (row) => row.componentKey === INTERNAL_WALLS_SKIRTING_LABOUR_COMPONENT
);
const unallocatedPaint = unallocatedSkirt.lineItems.filter(
  (row) => row.label === "Skirting painting"
);
check(
  "unallocated edges keep the stated 45 lm supply and installation",
  unallocatedType?.skirting == null &&
    unallocatedMaterial.length === 1 &&
    unallocatedMaterial[0]?.quantity === 45 &&
    unallocatedLabour.length === 1 &&
    unallocatedLabour[0]?.labourHours === 4.5 &&
    unallocatedPaint.length === 1 &&
    unallocatedPaint[0]?.quantity === 45 &&
    unallocatedSkirt.lineItems.every((row) => row.quantity !== 48) &&
    unallocatedSkirt.assumptions.some((row) =>
      row.includes("Edges are not allocated")
    ) &&
    !unallocatedSkirt.assumptions.some((row) => row.includes("48"))
);
const excludedSkirtFacts = [
  ...fixtureBase(
    finishExtras({ insulation: false, skirting: false, stopping: "No", painting: "No" }),
    { length: 24, height: 2.7, openings: false, bothSides: true }
  ),
  fact("internal_walls.skirting_length_lm", "w1", 45),
  fact("internal_walls.skirtings_included", "w1", false),
];
const excludedSkirt = calculateInternalWalls(ctx([walls], excludedSkirtFacts), walls);
check(
  "an explicit skirting exclusion does not restore the stated length",
  !excludedSkirt.lineItems.some(
    (row) =>
      row.componentKey === INTERNAL_WALLS_SKIRTING_MATERIAL_COMPONENT ||
      row.componentKey === INTERNAL_WALLS_SKIRTING_LABOUR_COMPONENT ||
      row.label === "Skirting painting"
  )
);

console.log("\n--- Double-layer stopping ---\n");
let dlFacts = writeWall("w1", [
  { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
  { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
  { key: "internal_walls.wall_type.frame_size", value: "90 mm timber framing — 90×45" },
  { key: "internal_walls.wall_type.length_lm", value: 8 },
  { key: "internal_walls.wall_type.height_m", value: 3 },
  { key: "internal_walls.wall_type.stud_centres_mm", value: "400 mm" },
  { key: "internal_walls.wall_type.side_a_product", value: "Fyreline" },
  { key: "internal_walls.wall_type.side_a_layers", value: "2 layers" },
  { key: "internal_walls.wall_type.same_lining_both_sides", value: true },
  { key: INTERNAL_WALLS_HAS_OPENINGS_KEY, value: "No" },
]);
const dlId = resolveInternalWallsWallTypes({ facts: dlFacts, workAreaId: "w1" }).types[0]!.id;
dlFacts = applyInternalWallsFactWrite({ facts: dlFacts, workAreaId: "w1", key: INTERNAL_WALLS_INSULATION_INCLUDED_KEY, value: "No", wallTypeId: dlId });
dlFacts = applyInternalWallsFactWrite({ facts: dlFacts, workAreaId: "w1", key: INTERNAL_WALLS_SKIRTING_SIDES_KEY, value: "No", wallTypeId: dlId });
dlFacts = applyInternalWallsFactWrite({ facts: dlFacts, workAreaId: "w1", key: INTERNAL_WALLS_CORNICE_SIDES_KEY, value: "No", wallTypeId: dlId });
dlFacts = applyInternalWallsFactWrite({ facts: dlFacts, workAreaId: "w1", key: INTERNAL_WALLS_ELECTRICAL_KEY, value: "No", wallTypeId: dlId });
dlFacts = applyInternalWallsFactWrite({ facts: dlFacts, workAreaId: "w1", key: INTERNAL_WALLS_STOPPING_SIDE_A_KEY, value: "Level 4", wallTypeId: dlId });
dlFacts = applyInternalWallsFactWrite({ facts: dlFacts, workAreaId: "w1", key: INTERNAL_WALLS_STOPPING_SIDE_B_KEY, value: "Level 4", wallTypeId: dlId });
dlFacts = applyInternalWallsFactWrite({ facts: dlFacts, workAreaId: "w1", key: INTERNAL_WALLS_PAINTING_SIDES_KEY, value: "No", wallTypeId: dlId });
dlFacts = [fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "new_partition"), ...dlFacts.filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY)];
const dlType = resolveInternalWallsWallTypes({ facts: dlFacts, workAreaId: "w1" }).types[0]!;
const dlStop = stoppingTakeoff({ type: dlType, jobScope: "new_partition" });
check("double-layer 24 m² per face", Boolean(dlStop?.sideA && near(dlStop.sideA.areaM2, 24) && dlStop.sideB && near(dlStop.sideB.areaM2, 24)));
check("double-layer total 48 not 96", Boolean(dlStop && near(dlStop.totalM2, 48) && !near(dlStop.totalM2, 96)));
const dlCalc = calculateInternalWalls(ctx([walls], dlFacts), walls);
const dlQty = dlCalc.lineItems
  .filter((row) => row.componentKey === INTERNAL_WALLS_STOPPING_COMPONENT)
  .reduce((sum, row) => sum + (row.quantity ?? 0), 0);
check("double-layer emitted 48 m²", near(dlQty, 48));

console.log("\n--- Paint fixture ---\n");
const pFacts = fixtureBase(finishExtras({ stopping: "No", painting: "Both sides" }));
const pType = resolveInternalWallsWallTypes({ facts: pFacts, workAreaId: "w1" }).types[0]!;
const pPaint = paintingTakeoff({ type: pType, jobScope: "new_partition" });
check("paint 27.1962 each face", Boolean(pPaint && near(pPaint.sideAM2, 27.1962) && near(pPaint.sideBM2, 27.1962)));
check("paint total 54.3924", Boolean(pPaint && near(pPaint.totalM2, 54.3924)));
const pCalc = calculateInternalWalls(ctx([walls], pFacts), walls);
const pLines = pCalc.lineItems.filter((row) => row.componentKey === INTERNAL_WALLS_PAINTING_COMPONENT);
check("paint two face lines", pLines.length === 2);
check("paint uses painting.wall.m2", pLines.every((row) => row.itemKey === INTERNAL_WALLS_PAINTING_MATERIAL_KEY));
check("paint no litres", pLines.every((row) => row.unit === "m2" && !/litre/i.test(row.notes ?? "")));
check(
  "paint uses the approved $4.93/m² cost",
  pLines.every(
    (row) =>
      row.rateSourceType === "benchmark" &&
      Math.abs((row.recommendedCost ?? 0) - 134.1) < 0.02 &&
      Math.abs((row.recommendedSell ?? 0) - 167.55) < 0.02
  )
);
check("paint coats do not triple area", pLines.every((row) => near(row.quantity, 27.1962)));

console.log("\n--- One-side finish ---\n");
let osFacts = writeWall("w1", [
  { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
  { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
  { key: "internal_walls.wall_type.frame_size", value: "90 mm timber framing — 90×45" },
  { key: "internal_walls.wall_type.length_lm", value: 5 },
  { key: "internal_walls.wall_type.height_m", value: 2.7 },
  { key: "internal_walls.wall_type.stud_centres_mm", value: "400 mm" },
  { key: "internal_walls.wall_type.side_a_product", value: "Standard GIB" },
  { key: "internal_walls.wall_type.same_lining_both_sides", value: false },
  { key: "internal_walls.wall_type.side_b_lined", value: "None" },
  { key: INTERNAL_WALLS_HAS_OPENINGS_KEY, value: "No" },
]);
const osId = resolveInternalWallsWallTypes({ facts: osFacts, workAreaId: "w1" }).types[0]!.id;
for (const row of [
  { key: INTERNAL_WALLS_INSULATION_INCLUDED_KEY, value: "No" },
  { key: INTERNAL_WALLS_SKIRTING_SIDES_KEY, value: "No" },
  { key: INTERNAL_WALLS_CORNICE_SIDES_KEY, value: "No" },
  { key: INTERNAL_WALLS_ELECTRICAL_KEY, value: "No" },
  { key: INTERNAL_WALLS_STOPPING_SIDE_A_KEY, value: "Level 4" },
  { key: INTERNAL_WALLS_PAINTING_SIDES_KEY, value: "Side A" },
]) {
  osFacts = applyInternalWallsFactWrite({ facts: osFacts, workAreaId: "w1", key: row.key, value: row.value, wallTypeId: osId });
}
osFacts = [fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "new_partition"), ...osFacts.filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY)];
const osType = resolveInternalWallsWallTypes({ facts: osFacts, workAreaId: "w1" }).types[0]!;
check("one-side no Side B lining", osType.side_b.lined === false);
check(
  "one-side next is not Side B stopping",
  nextInternalWallsWallTypeField({ type: osType, jobScope: "new_partition" }) !==
    INTERNAL_WALLS_STOPPING_SIDE_B_KEY
);
const osCalc = calculateInternalWalls(ctx([walls], osFacts), walls);
check(
  "one-side no Side B stopping/paint",
  !osCalc.lineItems.some((row) => /Side B/i.test(row.identitySummary ?? row.notes ?? ""))
);
check("one-side Side A stopping present", osCalc.lineItems.some((row) => row.componentKey === INTERNAL_WALLS_STOPPING_COMPONENT));

console.log("\n--- Infill ---\n");
let infFacts = writeWall("w1", [
  { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
  { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
  { key: "internal_walls.wall_type.frame_size", value: "90 mm timber framing — 90×45" },
  { key: "internal_walls.wall_type.stud_centres_mm", value: "600 mm" },
  { key: "internal_walls.wall_type.side_a_product", value: "Standard GIB" },
  { key: "internal_walls.wall_type.same_lining_both_sides", value: true },
  { key: INTERNAL_WALLS_HAS_OPENINGS_KEY, value: "Yes" },
]);
const infType0 = resolveInternalWallsWallTypes({ facts: infFacts, workAreaId: "w1" }).types[0]!;
infFacts = applyInternalWallsFactWrite({ facts: infFacts, workAreaId: "w1", key: "internal_walls.opening.width_m", value: 0.91, wallTypeId: infType0.id, openingId: infType0.openings[0]!.id });
infFacts = applyInternalWallsFactWrite({ facts: infFacts, workAreaId: "w1", key: "internal_walls.opening.height_m", value: 2.1, wallTypeId: infType0.id, openingId: infType0.openings[0]!.id });
for (const row of finishExtras({ stopping: "Level 4", painting: "Both sides" })) {
  infFacts = applyInternalWallsFactWrite({ facts: infFacts, workAreaId: "w1", key: row.key, value: row.value, wallTypeId: infType0.id });
}
infFacts = [
  fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "infill_opening"),
  fact(INTERNAL_WALLS_STRUCTURAL_FACT_KEY, "w1", "No"),
  ...infFacts.filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
];
const infType = resolveInternalWallsWallTypes({ facts: infFacts, workAreaId: "w1" }).types[0]!;
const infArea = visibleFaceAreaM2({ type: infType, jobScope: "infill_opening" });
check("infill face 1.911", infArea.ok && near(infArea.areaM2, 0.91 * 2.1));
const infStop = stoppingTakeoff({ type: infType, jobScope: "infill_opening" });
check("infill stopping 3.822 total", Boolean(infStop && near(infStop.totalM2, 3.822)));

console.log("\n--- Reline ---\n");
let relFacts = writeWall("w1", [
  { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
  { key: "internal_walls.wall_type.frame_system", value: "Existing frame" },
  { key: "internal_walls.wall_type.length_lm", value: 3 },
  { key: "internal_walls.wall_type.height_m", value: 2.4 },
  { key: "internal_walls.wall_type.side_a_product", value: "Standard GIB" },
  { key: "internal_walls.wall_type.same_lining_both_sides", value: false },
  { key: INTERNAL_WALLS_HAS_OPENINGS_KEY, value: "No" },
]);
const relId = resolveInternalWallsWallTypes({ facts: relFacts, workAreaId: "w1" }).types[0]!.id;
for (const row of [
  { key: INTERNAL_WALLS_INSULATION_INCLUDED_KEY, value: "No" },
  { key: INTERNAL_WALLS_SKIRTING_SIDES_KEY, value: "No" },
  { key: INTERNAL_WALLS_CORNICE_SIDES_KEY, value: "No" },
  { key: INTERNAL_WALLS_ELECTRICAL_KEY, value: "No" },
  { key: INTERNAL_WALLS_STOPPING_SIDE_A_KEY, value: "Level 4" },
  { key: INTERNAL_WALLS_PAINTING_SIDES_KEY, value: "Side A" },
]) {
  relFacts = applyInternalWallsFactWrite({ facts: relFacts, workAreaId: "w1", key: row.key, value: row.value, wallTypeId: relId });
}
relFacts = [fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "reline_existing"), ...relFacts.filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY)];
const relCalc = calculateInternalWalls(ctx([walls], relFacts), walls);
check(
  "reline no framing material",
  !mats(relCalc).some((row) => row.componentKey === INTERNAL_WALLS_FRAMING_90_MATERIAL_COMPONENT)
);
check("reline has Side A stopping", relCalc.lineItems.some((row) => row.componentKey === INTERNAL_WALLS_STOPPING_COMPONENT));

console.log("\n--- Structural block ---\n");
let stFacts = writeWall("w1", [
  { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
  { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
]);
stFacts = [
  fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "form_opening"),
  fact(INTERNAL_WALLS_STRUCTURAL_FACT_KEY, "w1", "Not sure"),
  ...stFacts,
];
const stCalc = calculateInternalWalls(ctx([walls], stFacts), walls);
check("structural INFO_REQUIRED", stCalc.missingInfo.includes(STRUCTURAL_MSG));
check("structural empty commercial lines", stCalc.lineItems.length === 0);

console.log("\n--- Full Wall Type envelope ---\n");
const fullFacts = fixtureBase(
  finishExtras({
    insulation: true,
    skirting: true,
    cornice: true,
    electrical: true,
    stopping: "Level 4",
    painting: "Both sides",
  })
);
const fullCalc = calculateInternalWalls(ctx([walls], fullFacts), walls);
const groups = new Set(
  fullCalc.lineItems
    .map((row) => row.overlapGroup ?? "")
    .filter(Boolean)
    .map((row) => row.split(":")[0])
);
check("full envelope has framing", [...groups].some((row) => row === "internal_walls.framing"));
check("full envelope has lining", [...groups].some((row) => row === "internal_walls.lining"));
check("full envelope has openings", [...groups].some((row) => row === "internal_walls.opening.framing" || row.includes("opening")));
check("full envelope has insulation", [...groups].some((row) => row === "internal_walls.insulation"));
check("full envelope has skirting", [...groups].some((row) => row === "internal_walls.skirting"));
check("full envelope has cornice", [...groups].some((row) => row === "internal_walls.cornice"));
check("full envelope has electrical", [...groups].some((row) => row === "internal_walls.electrical"));
check("full envelope has stopping", [...groups].some((row) => row === "internal_walls.stopping"));
check("full envelope has painting", [...groups].some((row) => row === "internal_walls.painting"));
const stopKeys = (fullCalc.requirements ?? [])
  .filter((row) => row.componentKey === INTERNAL_WALLS_STOPPING_COMPONENT)
  .map((row) => row.variantKey ?? row.requirementId);
check("no duplicate stopping keys", new Set(stopKeys).size === stopKeys.length && stopKeys.length === 2);
check("full Wall Type no legacy package", !isLegacyPackage(fullCalc));

console.log("\n--- Level 4 vs Level 5 ---\n");
const l5Facts = fixtureBase([
  ...finishExtras({ stopping: "Level 5", painting: "No" }).filter(
    (row) => row.key !== INTERNAL_WALLS_STOPPING_SIDE_B_KEY
  ),
  { key: INTERNAL_WALLS_STOPPING_SIDE_B_KEY, value: "Level 5" },
]);
const l5Calc = calculateInternalWalls(ctx([walls], l5Facts), walls);
check(
  "Level 5 distinct item key",
  l5Calc.lineItems
    .filter((row) => row.componentKey === INTERNAL_WALLS_STOPPING_COMPONENT)
    .every((row) => row.itemKey === internalWallsStoppingItemKey("level_5"))
);
check(
  "Level 4 and Level 5 keys differ",
  internalWallsStoppingItemKey("level_4") !== internalWallsStoppingItemKey("level_5")
);
check(
  "Level 5 remaining Pricing Required",
  l5Calc.lineItems
    .filter((row) => row.componentKey === INTERNAL_WALLS_STOPPING_COMPONENT)
    .every((row) => row.rateSourceType === "missing")
);

console.log("\n--- Mixed Wall Types isolation ---\n");
let mix = writeWall("w1", [{ key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true }]);
const typeA = resolveInternalWallsWallTypes({ facts: mix, workAreaId: "w1" }).types[0]!;
mix = applyInternalWallsFactWrite({ facts: mix, workAreaId: "w1", key: "internal_walls.wall_type.label", value: "Type A", wallTypeId: typeA.id });
mix = applyInternalWallsFactWrite({ facts: mix, workAreaId: "w1", key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true });
const typesAfterB = resolveInternalWallsWallTypes({ facts: mix, workAreaId: "w1" }).types;
check("two wall types after add", typesAfterB.length === 2);
check("Type A id unchanged", typesAfterB[0]!.id === typeA.id);

console.log("\n--- Commercial completeness ---\n");
const priced = (fullCalc.requirements ?? []).filter((row) => row.priced).length;
const pricingRequired = (fullCalc.requirements ?? []).filter((row) => !row.priced).length;
console.log(`priced=${priced} pricingRequired=${pricingRequired} infoRequired=${fullCalc.missingInfo.length}`);
check("full fixture has no INFO_REQUIRED", fullCalc.missingInfo.length === 0);
check("full fixture has Pricing Required rows", pricingRequired > 0);
check("no silent priced $0", !silentZero(fullCalc));
check(
  "Level 4 stopping is not a silent $0",
  fullCalc.lineItems
    .filter((row) => row.componentKey === INTERNAL_WALLS_STOPPING_COMPONENT)
    .every((row) => row.rateSourceType === "benchmark" && (row.recommendedCost ?? 0) > 0)
);

console.log("\n--- Pricing override ---\n");
const overrideCalc = calculateInternalWalls(
  ctx([walls], aFacts, [
    {
      id: "stop-l4",
      active: true,
      rate_type: "subcontractor",
      item_key: internalWallsStoppingItemKey("level_4"),
      label: "Company Level 4 stopping",
      unit: "m2",
      cost_rate: 40,
      sell_rate: 60,
      markup_percent: null,
      trade: "plastering",
      work_area_type: null,
    },
  ]),
  walls
);
const pricedStop = overrideCalc.lineItems.filter(
  (row) => row.componentKey === INTERNAL_WALLS_STOPPING_COMPONENT
);
check(
  "company stopping rate prices quantity",
  pricedStop.length === 2 &&
    pricedStop.every(
      (row) =>
        row.rateSourceType === "user_rate" &&
        (row.recommendedCost ?? 0) > 0 &&
        near(row.recommendedCost, 1088, 0.5)
    )
);

console.log("\n--- Builder Review / Quote / Ready ---\n");
const review = composeBuilderReview({
  estimate: {
    recommendedCost: fullCalc.lineItems.reduce((sum, item) => sum + (item.recommendedCost ?? 0), 0),
    recommendedSell: fullCalc.lineItems.reduce((sum, item) => sum + (item.recommendedSell ?? 0), 0),
    marginPercent: 20,
    confidence: fullCalc.confidence,
    assumptions: fullCalc.assumptions,
    missingInfo: fullCalc.missingInfo,
    lineItems: mapCalcLines(fullCalc.lineItems),
  },
  workAreas: [{ id: "w1", type: "internal_walls", name: "Internal walls", status: "confirmed" }],
  requirements: fullCalc.requirements ?? [],
});
const reviewText = JSON.stringify(review);
check("Review groups Stopping", /Stopping/i.test(reviewText));
check("Review groups Painting", /Painting/i.test(reviewText));
check("Review shows Pricing Required or Rate required", /Pricing Required|Rate required/i.test(reviewText));
check("Review summary mentions Wall Type", /Wall Type/i.test(reviewText));

const fullType = resolveInternalWallsWallTypes({ facts: fullFacts, workAreaId: "w1" }).types[0]!;
check(
  "Ready: next field resolved",
  nextInternalWallsWallTypeField({ type: fullType, jobScope: "new_partition" }) == null
);

const quote = buildWorkAreaQuoteDescriptionDraft({
  type: "internal_walls",
  name: "Internal walls",
  facts: [
    { key: "internal_walls.job_scope", label: "Wall work", value: "New partition" },
    {
      key: "internal_walls.wall_types",
      label: "Wall types",
      value: JSON.stringify(fullFacts.find((row) => row.key === "internal_walls.wall_types")?.value),
    },
  ],
});
check("quote mentions lining", /lining/i.test(quote));
check("quote mentions stopping", /stopping/i.test(quote));
check("quote mentions painting", /painting/i.test(quote));
check("quote does not supply doors", !/supply and install doors|door leaves/i.test(quote) || /not included/i.test(quote));
check("quote does not expose requirement keys", !/internal_walls\.stopping/i.test(quote));
check("quote does not expose hours", !/person-hours|hours\/m/i.test(quote));

const stoppingQ = internalWallsScope.questions.find((row) => row.factKey === INTERNAL_WALLS_STOPPING_SIDE_A_KEY);
const paintQ = internalWallsScope.questions.find((row) => row.factKey === INTERNAL_WALLS_PAINTING_SIDES_KEY);
check("stopping is SINGLE_SELECT", stoppingQ?.inputType === "select" && stoppingQ.options?.includes("Level 4") === true);
check("painting is SINGLE_SELECT", paintQ?.inputType === "select");
check(
  "IW-03 formula unchanged",
  read("lib/estimate/internal-walls-framing.ts").includes("ceil(lengthLm / spacingM - 1e-12) + 1")
);
check(
  "no invented compound kg",
  !read("lib/estimate/internal-walls-finish.ts").includes("compound kg")
);
check(
  "mature path does not import FITOUT stoppingPerM2 directly",
  !read("lib/estimate/internal-walls-finish-physical.ts").includes("stoppingPerM2")
);

check("lining sheets unchanged vs finish", (() => {
  const lining = mats(fullCalc).find((row) =>
    row.componentKey === internalWallsLiningMaterialComponent("standard_gib")
  );
  return lining != null && lining.purchaseQuantity > 0;
})());

console.log("\n--- calculateEstimate keeps both stopping faces ---\n");
const partitionEstimate = calculateEstimate(ctx([walls], partitionFacts));
const estimateStopping = partitionEstimate.lineItems.filter(
  (row) =>
    row.componentKey === INTERNAL_WALLS_STOPPING_COMPONENT &&
    row.includedInTotal !== false
);
const estimateStoppingQty = estimateStopping.reduce(
  (sum, row) => sum + (row.quantity ?? 0),
  0
);
check(
  "calculateEstimate emits both Level 4 faces",
  estimateStopping.length === 2 &&
    estimateStopping.some((row) => (row.overlapGroup ?? "").endsWith(":side_a")) &&
    estimateStopping.some((row) => (row.overlapGroup ?? "").endsWith(":side_b"))
);
check(
  "calculateEstimate combined stopping is 25.5924 m²",
  near(estimateStoppingQty, 25.5924, 0.0001)
);
const level4Cost = FITOUT_BENCHMARKS.stoppingPerM2.cost;
check(
  "each stopping face is costed once at the Level 4 rate",
  estimateStopping.length === 2 &&
    estimateStopping.every((row) =>
      near(
        row.recommendedCost ?? 0,
        (Math.round((row.quantity ?? 0) * 100) / 100) * level4Cost,
        0.02
      )
    )
);
const estimateLining = partitionEstimate.lineItems.filter(
  (row) => liningMaterial(row) && row.includedInTotal !== false
);
const estimateLiningLabour = partitionEstimate.lineItems.filter(
  (row) =>
    isInternalWallsLiningComponentKey(row.componentKey) &&
    (row.componentKey ?? "").endsWith(".install") &&
    row.includedInTotal !== false
);
check(
  "lining purchase is the sum of the two faces, once",
  estimateLining.length === 1 && estimateLining[0]?.quantity === 12
);
check(
  "lining labour is the sum of the two faces, once",
  estimateLiningLabour.length === 1 &&
    near(estimateLiningLabour[0]?.labourHours ?? estimateLiningLabour[0]?.quantity ?? 0, 5)
);
const oneSideEstimate = calculateEstimate(ctx([walls], osFacts));
const oneSideStopping = oneSideEstimate.lineItems.filter(
  (row) =>
    row.componentKey === INTERNAL_WALLS_STOPPING_COMPONENT &&
    row.includedInTotal !== false
);
check(
  "one-sided stopping remains one face through calculateEstimate",
  oneSideStopping.length === 1 &&
    (oneSideStopping[0]?.overlapGroup ?? "").endsWith(":side_a") &&
    near(oneSideStopping[0]?.quantity ?? 0, 5 * 2.7)
);
const doubleEstimate = calculateEstimate(ctx([walls], dlFacts));
const doubleQty = doubleEstimate.lineItems
  .filter(
    (row) =>
      row.componentKey === INTERNAL_WALLS_STOPPING_COMPONENT &&
      row.includedInTotal !== false
  )
  .reduce((sum, row) => sum + (row.quantity ?? 0), 0);
check(
  "layers do not multiply stopping through calculateEstimate",
  near(doubleQty, 48) && !near(doubleQty, 96)
);
const sideALine = estimateStopping.find((row) =>
  (row.overlapGroup ?? "").endsWith(":side_a")
)!;
let duplicateRejected = false;
try {
  assertNoDuplicateActiveComponents([
    ...estimateStopping,
    { ...sideALine, scopeKey: `${sideALine.scopeKey}:duplicate` },
  ]);
} catch (error) {
  duplicateRejected = error instanceof DuplicateActiveComponentError;
}
check(
  "a second stopping line for the same face is rejected",
  duplicateRejected
);
const dedupedSameFace = dedupePricedItemsByScopeOwnership([
  ...estimateStopping,
  { ...sideALine },
]);
let sameScopeKept = true;
try {
  assertNoDuplicateActiveComponents(dedupedSameFace);
} catch {
  sameScopeKept = false;
}
check(
  "the same stopping scope key is deduplicated before the commercial guard",
  sameScopeKept &&
    dedupedSameFace.filter(
      (row) =>
        row.componentKey === INTERNAL_WALLS_STOPPING_COMPONENT &&
        row.includedInTotal !== false &&
        (row.overlapGroup ?? "").endsWith(":side_a")
    ).length === 1
);
let twoTypes = writeWall("w1", [
  { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
  { key: "internal_walls.wall_type.label", value: "Type A" },
  { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
  { key: "internal_walls.wall_type.frame_size", value: "90 mm timber framing — 90×45" },
  { key: "internal_walls.wall_type.length_lm", value: 4 },
  { key: "internal_walls.wall_type.height_m", value: 2.4 },
  { key: "internal_walls.wall_type.stud_centres_mm", value: "600 mm" },
  { key: "internal_walls.wall_type.side_a_product", value: "Standard GIB" },
  { key: "internal_walls.wall_type.same_lining_both_sides", value: true },
  { key: INTERNAL_WALLS_HAS_OPENINGS_KEY, value: "No" },
]);
const firstType = resolveInternalWallsWallTypes({ facts: twoTypes, workAreaId: "w1" }).types[0]!;
twoTypes = applyInternalWallsFactWrite({
  facts: twoTypes,
  workAreaId: "w1",
  key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY,
  value: true,
});
const secondType = resolveInternalWallsWallTypes({ facts: twoTypes, workAreaId: "w1" }).types[1]!;
twoTypes = applyInternalWallsFactWrite({
  facts: twoTypes,
  workAreaId: "w1",
  key: "internal_walls.wall_type.length_lm",
  value: 3,
  wallTypeId: secondType.id,
});
twoTypes = applyInternalWallsFactWrite({
  facts: twoTypes,
  workAreaId: "w1",
  key: "internal_walls.wall_type.height_m",
  value: 2.4,
  wallTypeId: secondType.id,
});
twoTypes = applyInternalWallsFactWrite({
  facts: twoTypes,
  workAreaId: "w1",
  key: "internal_walls.wall_type.side_a_product",
  value: "Standard GIB",
  wallTypeId: secondType.id,
});
twoTypes = applyInternalWallsFactWrite({
  facts: twoTypes,
  workAreaId: "w1",
  key: "internal_walls.wall_type.same_lining_both_sides",
  value: true,
  wallTypeId: secondType.id,
});
twoTypes = applyInternalWallsFactWrite({
  facts: twoTypes,
  workAreaId: "w1",
  key: INTERNAL_WALLS_HAS_OPENINGS_KEY,
  value: "No",
  wallTypeId: secondType.id,
});
for (const wallTypeId of [firstType.id, secondType.id]) {
  for (const row of finishExtras({
    insulation: false,
    skirting: false,
    stopping: "Level 4",
    painting: "No",
  })) {
    twoTypes = applyInternalWallsFactWrite({
      facts: twoTypes,
      workAreaId: "w1",
      key: row.key,
      value: row.value,
      wallTypeId,
    });
  }
}
twoTypes = [
  fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "new_partition"),
  ...twoTypes.filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
];
const twoTypeEstimate = calculateEstimate(ctx([walls], twoTypes));
const twoTypeStopping = twoTypeEstimate.lineItems.filter(
  (row) =>
    row.componentKey === INTERNAL_WALLS_STOPPING_COMPONENT &&
    row.includedInTotal !== false
);
const qtyForType = (wallTypeId: string) =>
  twoTypeStopping
    .filter((row) => (row.overlapGroup ?? "").includes(wallTypeId))
    .reduce((sum, row) => sum + (row.quantity ?? 0), 0);
check(
  "separate wall types keep independent stopping identities",
  twoTypeStopping.length === 4 &&
    new Set(twoTypeStopping.map((row) => row.overlapGroup)).size === 4 &&
    near(qtyForType(firstType.id), 4 * 2.4 * 2) &&
    near(qtyForType(secondType.id), 3 * 2.4 * 2) &&
    twoTypeStopping.every((row) =>
      row.overlapGroup ===
      internalWallsStoppingOverlapGroup(
        (row.overlapGroup ?? "").split(":")[1] ?? "",
        (row.overlapGroup ?? "").endsWith(":side_b") ? "side_b" : "side_a"
      )
    )
);
const statedEstimate = calculateEstimate(ctx([walls], statedSkirtFacts));
const statedLine = statedEstimate.lineItems.find(
  (row) => row.componentKey === INTERNAL_WALLS_SKIRTING_MATERIAL_COMPONENT
);
check(
  "stated skirting length still survives calculateEstimate",
  statedLine?.quantity === 45 && statedLine.unit === "lm"
);
let paintingGenerated = false;
let paintingFaces = 0;
try {
  const painted = calculateEstimate(
    ctx(
      [walls],
      fixtureBase(
        finishExtras({
          insulation: false,
          skirting: false,
          stopping: "No",
          painting: "Both sides",
        }),
        { length: 6, height: 2.4, openings: false }
      )
    )
  );
  paintingGenerated = true;
  paintingFaces = painted.lineItems.filter(
    (row) =>
      row.componentKey === INTERNAL_WALLS_PAINTING_COMPONENT &&
      row.includedInTotal !== false
  ).length;
} catch {
  paintingGenerated = false;
}
check(
  "both-side painting still generates as two faces",
  paintingGenerated && paintingFaces === 2
);
check(
  "calculateEstimate reaches the duplicate commercial guard",
  read("lib/estimate/component-commercial-selection.ts").includes(
    "assertNoDuplicateActiveComponents(lineItems)"
  ) &&
    read("lib/estimate/calculate-estimate.ts").includes(
      "applyRegisteredComponentCommercialAuthority"
    )
);

console.log("\n--- Hosted policy / migrations ---\n");
check(
  "canonical Preview host",
  PREVIEW_AUTH_SITE_ORIGIN_STABLE.includes("hardening-stage-2a-security")
);
check("Preview ref recorded", PREVIEW_SUPABASE_PROJECT_REF === "shhpjsoldmqtkdbgrbtm");
check("plus-address fixture allowed", isPlusAddressFixture("hello+wa-iw-08@example.invalid"));
let protectedBlocked = false;
try {
  assertSafePreviewPasswordMutation(PREVIEW_PASSWORD_PROTECTED_EMAILS[0]!);
} catch {
  protectedBlocked = true;
}
check("owner inbox password mutation blocked", protectedBlocked);
const migrations = numberedMigrations();
check("no migration 055", !migrations.some((name) => name.startsWith("055_")));
check("preview remains through 056", migrations.some((name) => name.startsWith("056_")));
check(
  "architecture records IW-08",
  read("docs/architecture/QUOTR_INTERNAL_WALLS_ESTIMATING_ARCHITECTURE.md").includes("WA-INTERNAL-WALLS-08")
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
