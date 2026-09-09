/**
 * WA-INTERNAL-WALLS-03 — timber framing physical takeoff + requirement envelope.
 *
 * Run: npx --yes tsx scripts/verify-work-area-internal-walls-03.ts
 *
 * No paid AI. No Production. No migration 055.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import type { EstimateLineItem } from "../components/assistant/types";
import { calculateInternalWalls } from "../lib/estimate/calculators/fitout";
import { getCatalogueEntry } from "../lib/rates/catalogue";
import {
  INTERNAL_WALLS_JOB_SCOPE_FACT_KEY,
  isMatureInternalWallsPath,
} from "../lib/estimate/internal-walls-scope";
import {
  INTERNAL_WALLS_ADD_WALL_TYPE_KEY,
  INTERNAL_WALLS_STRUCTURAL_SPECIALIST_MESSAGE,
  INTERNAL_WALLS_TAKEOFF_NOT_PRICED_STATEMENT,
  applyInternalWallsFactWrite,
} from "../lib/estimate/internal-walls-wall-types";
import {
  INTERNAL_WALLS_CARPENTER_LABOUR_KEY,
  INTERNAL_WALLS_FRAMING_140_LABOUR_COMPONENT,
  INTERNAL_WALLS_FRAMING_140_MATERIAL_COMPONENT,
  INTERNAL_WALLS_FRAMING_90_LABOUR_COMPONENT,
  INTERNAL_WALLS_FRAMING_90_MATERIAL_COMPONENT,
  INTERNAL_WALLS_FRAMING_FIXINGS_COMPONENT,
  INTERNAL_WALLS_FRAMING_OTHER_COMPONENT,
  INTERNAL_WALLS_FRAMING_STEEL_COMPONENT,
  INTERNAL_WALLS_LINING_NOT_PRICED_STATEMENT,
  INTERNAL_WALLS_OTHER_FRAMING_NOT_PRICED_MESSAGE,
  INTERNAL_WALLS_OTHER_TIMBER_SIZE_MESSAGE,
  INTERNAL_WALLS_PRODUCTIVITY_BENCHMARKS,
  INTERNAL_WALLS_PRODUCTIVITY_KEYS,
  INTERNAL_WALLS_STEEL_FRAMING_NOT_PRICED_MESSAGE,
  INTERNAL_WALLS_STUD_CENTRES_REQUIRED_MESSAGE,
  INTERNAL_WALLS_TIMBER_140_KEY,
  INTERNAL_WALLS_TIMBER_90_KEY,
} from "../lib/estimate/internal-walls-identities";
import {
  aggregateInternalWallsTimberPurchaseLm,
} from "../lib/estimate/internal-walls-physical";
import {
  internalWallsStudCount,
  internalWallsTimberTakeoff,
  resolveInternalWallsStudCentres,
} from "../lib/estimate/internal-walls-framing";
import { PREVIEW_SUPABASE_PROJECT_REF } from "../lib/deployment/environment";
import {
  PREVIEW_AUTH_SITE_ORIGIN_STABLE,
  PREVIEW_PASSWORD_PROTECTED_EMAILS,
  assertSafePreviewPasswordMutation,
  isPlusAddressFixture,
} from "./lib/preview-auth-fixture";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "../lib/estimate/types";
import type { LabourRequirement, MaterialRequirement } from "../lib/estimate/requirements";

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
  extra?: Partial<EstimateContext>
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
    },
    rates: [],
    ...extra,
  } as unknown as EstimateContext;
}

function writeWall(
  workAreaId: string,
  writes: Array<{ key: string; value: unknown; wallTypeId?: string }>
): EstimateFact[] {
  let facts: EstimateFact[] = [];
  for (const row of writes) {
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId,
      key: row.key,
      value: row.value,
      wallTypeId: row.wallTypeId,
    });
  }
  return facts;
}

function mapCalcLines(items: readonly EstimateLineItemInput[]): EstimateLineItem[] {
  return items.map((item, index) => ({
    id: `line-${index}`,
    workAreaName: item.workAreaName,
    label: item.label,
    category: item.category as EstimateLineItem["category"],
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
    costRate: item.costRate,
    sellRate: item.sellRate,
    itemKey: item.itemKey,
    componentKey: item.componentKey,
    notes: item.notes,
    identitySummary: item.identitySummary,
    includedInTotal: item.includedInTotal,
    overlapGroup: item.overlapGroup,
  }));
}

function mats(
  result: ReturnType<typeof calculateInternalWalls>
): MaterialRequirement[] {
  return (result.requirements ?? []).filter(
    (row): row is MaterialRequirement => row.kind === "material"
  );
}

function labs(
  result: ReturnType<typeof calculateInternalWalls>
): LabourRequirement[] {
  return (result.requirements ?? []).filter(
    (row): row is LabourRequirement => row.kind === "labour"
  );
}

function isLegacyPackage(result: ReturnType<typeof calculateInternalWalls>): boolean {
  return result.lineItems.some(
    (row) =>
      /internal wall materials allowance/i.test(row.label) ||
      (/wall framing labour/i.test(row.label) && row.unit === "lm")
  );
}

const walls = wa("w1", "internal_walls", "Internal walls");

function typeAFacts(): EstimateFact[] {
  return [
    fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "new_partition"),
    ...writeWall("w1", [
      { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
      { key: "internal_walls.wall_type.label", value: "Standard office partition" },
      { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
      { key: "internal_walls.wall_type.frame_size", value: "90 mm timber framing — 90×45" },
      { key: "internal_walls.wall_type.length_lm", value: 12 },
      { key: "internal_walls.wall_type.height_m", value: 2.4 },
      { key: "internal_walls.wall_type.stud_centres_mm", value: "600 mm" },
    ]).filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
  ];
}

function typeBWrites(): Array<{ key: string; value: unknown }> {
  return [
    { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
    { key: "internal_walls.wall_type.label", value: "Type B" },
    { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
    { key: "internal_walls.wall_type.frame_size", value: "90 mm timber framing — 90×45" },
    { key: "internal_walls.wall_type.length_lm", value: 8 },
    { key: "internal_walls.wall_type.height_m", value: 3 },
    { key: "internal_walls.wall_type.stud_centres_mm", value: "400 mm" },
  ];
}

function typeCWrites(): Array<{ key: string; value: unknown }> {
  return [
    { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
    { key: "internal_walls.wall_type.label", value: "Type C" },
    { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
    { key: "internal_walls.wall_type.frame_size", value: "140 mm timber framing — 140×45" },
    { key: "internal_walls.wall_type.length_lm", value: 5 },
    { key: "internal_walls.wall_type.height_m", value: 2.7 },
    { key: "internal_walls.wall_type.stud_centres_mm", value: "400 mm" },
  ];
}

console.log("=== WA-INTERNAL-WALLS-03 ===\n");

console.log("--- Shared material identities ---\n");
const timber90 = getCatalogueEntry(INTERNAL_WALLS_TIMBER_90_KEY);
const timber140 = getCatalogueEntry(INTERNAL_WALLS_TIMBER_140_KEY);
check(
  "90×45 shared identity exists",
  timber90?.item_key === INTERNAL_WALLS_TIMBER_90_KEY && timber90.defaultCostRate === 6.2
);
check(
  "140×45 shared identity exists without invented $/lm",
  timber140?.item_key === INTERNAL_WALLS_TIMBER_140_KEY &&
    timber140.defaultCostRate == null &&
    timber140.unit === "lm"
);
check(
  "no Internal-Walls-specific physical timber keys",
  !read("lib/rates/specific-material-catalogue.ts").includes("internal_walls.90x45") &&
    !read("lib/rates/specific-material-catalogue.ts").includes("internal_walls.140x45")
);
check(
  "90×45 remains a single shared catalogue identity",
  timber90?.workAreaLabel === "Framing timber" && timber90.calculatorSupport === "used_now"
);
check(
  "canonical timber_framing waste category reused",
  read("lib/estimate/internal-walls-physical.ts").includes('INTERNAL_WALLS_FRAMING_WASTE_CATEGORY') &&
    read("lib/settings/material-wastage.ts").includes('"timber_framing"')
);

console.log("\n--- Formulas ---\n");
check("stud count 10 m / 600 mm = 18", internalWallsStudCount(10, 0.6) === 18);
check("stud count Type A 12 / 0.6 = 21", internalWallsStudCount(12, 0.6) === 21);
check("stud count Type B 8 / 0.4 = 21", internalWallsStudCount(8, 0.4) === 21);
check("stud count Type C 5 / 0.4 = 14", internalWallsStudCount(5, 0.4) === 14);
check(
  "custom 450 mm on 10 m = 24 studs",
  internalWallsStudCount(10, 0.45) === 24
);
check(
  "invalid spacing does not divide by zero",
  internalWallsStudCount(10, 0) === 0 && internalWallsStudCount(10, -1) === 0
);
check(
  "90 productivity 0.45 h/m²",
  INTERNAL_WALLS_PRODUCTIVITY_BENCHMARKS.timber90M2 === 0.45 &&
    INTERNAL_WALLS_PRODUCTIVITY_KEYS.timber90M2 ===
      "internal_walls.framing.timber.90x45.hours_per_m2"
);
check(
  "140 productivity 0.50 h/m²",
  INTERNAL_WALLS_PRODUCTIVITY_BENCHMARKS.timber140M2 === 0.5
);
check(
  "productivity is in BENCHMARK_PRODUCTIVITY",
  read("lib/estimate/productivity.ts").includes(INTERNAL_WALLS_PRODUCTIVITY_KEYS.timber90M2) &&
    read("lib/estimate/productivity.ts").includes(INTERNAL_WALLS_PRODUCTIVITY_KEYS.timber140M2)
);
check(
  "no DNA calibration catalogue rows",
  !read("lib/company-dna/v2-foundation.ts").includes(
    INTERNAL_WALLS_PRODUCTIVITY_KEYS.timber90M2
  )
);

console.log("\n--- Type A 90×45 ---\n");
const a = calculateInternalWalls(ctx([walls], typeAFacts()), walls);
const aMat = mats(a).find((row) => row.componentKey === INTERNAL_WALLS_FRAMING_90_MATERIAL_COMPONENT);
const aLab = labs(a).find((row) => row.componentKey === INTERNAL_WALLS_FRAMING_90_LABOUR_COMPONENT);
const aFix = mats(a).find((row) => row.componentKey === INTERNAL_WALLS_FRAMING_FIXINGS_COMPONENT);
check("Type A mature path", isMatureInternalWallsPath({ facts: typeAFacts(), workAreaId: "w1" }));
check("Type A 21 studs / 50.4 lm", Boolean(aMat?.specification?.includes("21 studs") && aMat.specification.includes("50.4 lm studs")));
check("Type A plates 24 lm", Boolean(aMat?.specification?.includes("24") && aMat.specification.includes("plates")));
check("Type A 2 nog rows / 24 lm nogging", Boolean(aMat?.specification?.includes("nogging") && aMat.baseQuantity != null));
check("Type A raw 98.4 lm", near(aMat?.baseQuantity, 98.4));
check("Type A purchase 108.24 lm (waste once)", near(aMat?.purchaseQuantity, 108.24) && near(aMat?.wasteFactor, 0.1));
check("Type A not double-wasted", !near(aMat?.purchaseQuantity, 98.4 * 1.1 * 1.1));
check("Type A shared 90×45 key", aMat?.materialKey === INTERNAL_WALLS_TIMBER_90_KEY);
check("Type A labour 12.96 h on 28.8 m²", near(aLab?.baseHours, 12.96) && near(aLab?.productivityBasis.quantity, 28.8));
check("Type A labour uses carpenter hour", aLab?.rateKey === INTERNAL_WALLS_CARPENTER_LABOUR_KEY || (aLab?.rateKey ?? "").includes("carpenter"));
check("Type A 90 priced from benchmark", aMat?.priced === true && aMat.rateSource === "benchmark");
check("Type A no 140 material", !mats(a).some((row) => row.materialKey === INTERNAL_WALLS_TIMBER_140_KEY));
check("Type A fixings Pricing Required on wall area", aFix?.priced === false && aFix.rateSource === "missing" && near(aFix.purchaseQuantity, 28.8));
check("Type A no legacy package", !isLegacyPackage(a));
check(
  "Type A lining not priced, not old takeoff-not-priced",
  a.assumptions.includes(INTERNAL_WALLS_LINING_NOT_PRICED_STATEMENT) &&
    !a.assumptions.includes(INTERNAL_WALLS_TAKEOFF_NOT_PRICED_STATEMENT)
);

console.log("\n--- Type B 90×45 400 centres ---\n");
const bFacts = [
  fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "new_partition"),
  ...writeWall("w1", typeBWrites()).filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
];
const b = calculateInternalWalls(ctx([walls], bFacts), walls);
const bMat = mats(b).find((row) => row.componentKey === INTERNAL_WALLS_FRAMING_90_MATERIAL_COMPONENT);
const bLab = labs(b).find((row) => row.componentKey === INTERNAL_WALLS_FRAMING_90_LABOUR_COMPONENT);
check("Type B 21 studs / 63.0 lm", Boolean(bMat?.specification?.includes("21 studs") && bMat.specification.includes("63")));
check("Type B 3 nog rows / 24 lm nogs", near(bMat?.baseQuantity, 103));
check("Type B purchase 113.3 lm", near(bMat?.purchaseQuantity, 113.3));
check("Type B labour 10.8 h on 24 m²", near(bLab?.baseHours, 10.8) && near(bLab?.productivityBasis.quantity, 24));

console.log("\n--- Type C 140×45 ---\n");
const cFacts = [
  fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "new_partition"),
  ...writeWall("w1", typeCWrites()).filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
];
const c = calculateInternalWalls(ctx([walls], cFacts), walls);
const cMat = mats(c).find((row) => row.componentKey === INTERNAL_WALLS_FRAMING_140_MATERIAL_COMPONENT);
const cLab = labs(c).find((row) => row.componentKey === INTERNAL_WALLS_FRAMING_140_LABOUR_COMPONENT);
check("Type C 14 studs / 37.8 lm", Boolean(cMat?.specification?.includes("14 studs") && cMat.specification.includes("37.8")));
check("Type C raw 62.8 / purchase 69.08", near(cMat?.baseQuantity, 62.8) && near(cMat?.purchaseQuantity, 69.08));
check("Type C labour 6.75 h on 13.5 m²", near(cLab?.baseHours, 6.75) && near(cLab?.productivityBasis.quantity, 13.5));
check("Type C uses 140 key not 90", cMat?.materialKey === INTERNAL_WALLS_TIMBER_140_KEY);
check("Type C no 90 material requirement", !mats(c).some((row) => row.materialKey === INTERNAL_WALLS_TIMBER_90_KEY));
check("Type C 140 Pricing Required", cMat?.priced === false && cMat.rateSource === "missing");
check("Type C labour still priced", cLab?.priced === true);
check(
  "Type C line keeps quantity visible",
  c.lineItems.some(
    (row) =>
      row.itemKey === INTERNAL_WALLS_TIMBER_140_KEY &&
      near(row.quantity, 69.08) &&
      row.rateSourceType === "missing"
  )
);

console.log("\n--- Custom centres ---\n");
const customOkFacts = [
  fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "new_partition"),
  ...writeWall("w1", [
    { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
    { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
    { key: "internal_walls.wall_type.frame_size", value: "90 mm timber framing — 90×45" },
    { key: "internal_walls.wall_type.length_lm", value: 10 },
    { key: "internal_walls.wall_type.height_m", value: 2.4 },
    { key: "internal_walls.wall_type.stud_centres_mm", value: 450 },
  ]).filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
];
const customOk = calculateInternalWalls(ctx([walls], customOkFacts), walls);
const customMat = mats(customOk).find(
  (row) => row.componentKey === INTERNAL_WALLS_FRAMING_90_MATERIAL_COMPONENT
);
check(
  "custom 450 mm uses actual spacing (24 studs)",
  Boolean(customMat?.specification?.includes("24 studs") && customMat.specification.includes("450 mm"))
);
const customEmptyFacts = writeWall("w1", [
  { key: INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, value: "new_partition" },
  { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
  { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
  { key: "internal_walls.wall_type.frame_size", value: "90 mm timber framing — 90×45" },
  { key: "internal_walls.wall_type.length_lm", value: 10 },
  { key: "internal_walls.wall_type.height_m", value: 2.4 },
  { key: "internal_walls.wall_type.stud_centres_mm", value: "Custom" },
]);
const customEmpty = calculateInternalWalls(ctx([walls], customEmptyFacts), walls);
check(
  "custom without numeric is INFO_REQUIRED",
  customEmpty.missingInfo.includes(INTERNAL_WALLS_STUD_CENTRES_REQUIRED_MESSAGE)
);
check(
  "custom without numeric emits no timber material",
  !mats(customEmpty).some((row) => row.materialKey === INTERNAL_WALLS_TIMBER_90_KEY)
);
check(
  "calculator resolve treats custom null as missing",
  resolveInternalWallsStudCentres({
    stud_centres_mm: null,
    stud_centres_source: "custom",
    height_m: 2.4,
  }).ok === false
);

console.log("\n--- Existing / steel / other ---\n");
const existingFacts = [
  fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "reline_existing"),
  ...writeWall("w1", [
    { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
    { key: "internal_walls.wall_type.frame_system", value: "Existing frame" },
    { key: "internal_walls.wall_type.length_lm", value: 10 },
    { key: "internal_walls.wall_type.height_m", value: 2.4 },
  ]).filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
];
const existing = calculateInternalWalls(ctx([walls], existingFacts), walls);
check(
  "existing frame has no timber / labour / fixings",
  mats(existing).length === 0 &&
    labs(existing).length === 0 &&
    !existing.lineItems.some((row) => /timber|fixings|framing labour/i.test(row.label))
);
const steelFacts = [
  fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "new_partition"),
  ...writeWall("w1", [
    { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
    { key: "internal_walls.wall_type.frame_system", value: "Steel framing" },
    { key: "internal_walls.wall_type.length_lm", value: 10 },
    { key: "internal_walls.wall_type.height_m", value: 2.4 },
  ]).filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
];
const steel = calculateInternalWalls(ctx([walls], steelFacts), walls);
check(
  "steel is Pricing Required, no timber",
  steel.missingInfo.includes(INTERNAL_WALLS_STEEL_FRAMING_NOT_PRICED_MESSAGE) &&
    mats(steel).some((row) => row.componentKey === INTERNAL_WALLS_FRAMING_STEEL_COMPONENT && !row.priced) &&
    !mats(steel).some((row) => row.materialKey === INTERNAL_WALLS_TIMBER_90_KEY) &&
    labs(steel).length === 0
);
const otherFacts = [
  fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "new_partition"),
  ...writeWall("w1", [
    { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
    { key: "internal_walls.wall_type.frame_system", value: "Other" },
    { key: "internal_walls.wall_type.length_lm", value: 10 },
    { key: "internal_walls.wall_type.height_m", value: 2.4 },
  ]).filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
];
const other = calculateInternalWalls(ctx([walls], otherFacts), walls);
check(
  "other framing no timber fallback",
  other.missingInfo.includes(INTERNAL_WALLS_OTHER_FRAMING_NOT_PRICED_MESSAGE) &&
    mats(other).some((row) => row.componentKey === INTERNAL_WALLS_FRAMING_OTHER_COMPONENT) &&
    !mats(other).some((row) => row.materialKey === INTERNAL_WALLS_TIMBER_90_KEY)
);
const otherSizeFacts = [
  fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "new_partition"),
  ...writeWall("w1", [
    { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
    { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
    { key: "internal_walls.wall_type.frame_size", value: "Other" },
    { key: "internal_walls.wall_type.length_lm", value: 10 },
    { key: "internal_walls.wall_type.height_m", value: 2.4 },
  ]).filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
];
const otherSize = calculateInternalWalls(ctx([walls], otherSizeFacts), walls);
check(
  "other timber size is Pricing Required / info, no 90 fallback",
  otherSize.missingInfo.includes(INTERNAL_WALLS_OTHER_TIMBER_SIZE_MESSAGE) &&
    !mats(otherSize).some((row) => row.materialKey === INTERNAL_WALLS_TIMBER_90_KEY)
);

console.log("\n--- Multi-Wall-Type isolation + aggregation ---\n");
let multi = typeAFacts();
multi = applyInternalWallsFactWrite({
  facts: multi,
  workAreaId: "w1",
  key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY,
  value: true,
});
for (const row of typeBWrites().slice(1)) {
  multi = applyInternalWallsFactWrite({
    facts: multi,
    workAreaId: "w1",
    key: row.key,
    value: row.value,
  });
}
const multiCalc = calculateInternalWalls(ctx([walls], multi), walls);
const multi90 = mats(multiCalc).filter((row) => row.materialKey === INTERNAL_WALLS_TIMBER_90_KEY);
check("multi emits independent 90×45 requirements", multi90.length === 2);
check(
  "Type A takeoff unchanged beside Type B",
  near(multi90[0]?.purchaseQuantity, 108.24) && near(multi90[1]?.purchaseQuantity, 113.3)
);
check(
  "commercial aggregation of same material is 221.54 lm",
  near(aggregateInternalWallsTimberPurchaseLm(multiCalc.requirements ?? [], INTERNAL_WALLS_TIMBER_90_KEY), 221.54)
);
check("no 140 on 90-only multi", !mats(multiCalc).some((row) => row.materialKey === INTERNAL_WALLS_TIMBER_140_KEY));

const abc = applyInternalWallsFactWrite({
  facts: multi,
  workAreaId: "w1",
  key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY,
  value: true,
});
let abcFacts = abc;
for (const row of typeCWrites().slice(1)) {
  abcFacts = applyInternalWallsFactWrite({
    facts: abcFacts,
    workAreaId: "w1",
    key: row.key,
    value: row.value,
  });
}
const abcCalc = calculateInternalWalls(ctx([walls], abcFacts), walls);
check(
  "Type C isolated from A/B 90×45",
  near(aggregateInternalWallsTimberPurchaseLm(abcCalc.requirements ?? [], INTERNAL_WALLS_TIMBER_90_KEY), 221.54) &&
    near(aggregateInternalWallsTimberPurchaseLm(abcCalc.requirements ?? [], INTERNAL_WALLS_TIMBER_140_KEY), 69.08)
);

console.log("\n--- Rate authority / finish / conditions ---\n");
const companyA = calculateInternalWalls(
  ctx([walls], typeAFacts(), {
    rates: [
      {
        id: "r1",
        item_key: INTERNAL_WALLS_TIMBER_90_KEY,
        rate_type: "material",
        label: "Company 90×45",
        unit: "lm",
        cost_rate: 8.5,
        sell_rate: 11,
        active: true,
        markup_percent: null,
        trade: null,
        work_area_type: null,
      },
    ],
  } as Partial<EstimateContext>),
  walls
);
const companyMat = mats(companyA).find(
  (row) => row.componentKey === INTERNAL_WALLS_FRAMING_90_MATERIAL_COMPONENT
);
check("company exact 90×45 wins", companyMat?.rateSource === "company" && near(companyMat.unitCost, 8.5));
const premium = calculateInternalWalls(
  ctx([walls], typeAFacts(), { project: { id: "p1", qualityLevel: "premium" } } as Partial<EstimateContext>),
  walls
);
check(
  "finish/quality does not multiply studs or timber qty",
  near(mats(premium)[0]?.purchaseQuantity, 108.24) &&
    near(labs(premium)[0]?.baseHours, 12.96)
);
check(
  "mature path does not call getQualityFactor on framing",
  !read("lib/estimate/internal-walls-physical.ts").includes("getQualityFactor") &&
    read("lib/estimate/internal-walls-physical.ts").includes("qualityFactor: 1")
);
check(
  "conditions use canonical access helper, no IW-specific multiplier",
  read("lib/estimate/internal-walls-physical.ts").includes("getCombinedLabourAccessFactor") &&
    !read("lib/estimate/calculators/fitout.ts").includes("getCombinedLabourAccessFactor") &&
    !read("lib/estimate/internal-walls-physical.ts").includes("occupied_site") &&
    !read("lib/estimate/internal-walls-framing.ts").includes("quality")
);
const carpenter = calculateInternalWalls(
  ctx([walls], typeAFacts(), {
    rates: [
      {
        id: "lab",
        item_key: INTERNAL_WALLS_CARPENTER_LABOUR_KEY,
        rate_type: "labour",
        label: "Carpenter",
        unit: "hour",
        cost_rate: 70,
        sell_rate: 95,
        active: true,
        markup_percent: null,
        trade: "carpenter",
        work_area_type: null,
      },
    ],
  } as Partial<EstimateContext>),
  walls
);
check(
  "company carpenter hourly overrides labour money",
  near(labs(carpenter)[0]?.hourlyCost, 70)
);

console.log("\n--- Structural gate / legacy suppression ---\n");
const blocked = calculateInternalWalls(
  ctx(
    [walls],
    [
      fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "remove_partition"),
      fact("internal_walls.structural_involvement", "w1", "Yes"),
    ]
  ),
  walls
);
check(
  "structural gate blocks ordinary framing price",
  blocked.missingInfo.includes(INTERNAL_WALLS_STRUCTURAL_SPECIALIST_MESSAGE) &&
    blocked.lineItems.length === 0 &&
    (blocked.requirements ?? []).length === 0
);
check("legacy empty still packages", isLegacyPackage(calculateInternalWalls(ctx([walls], []), walls)));
check("mature Type A suppresses legacy package", !isLegacyPackage(a) && a.lineItems.length > 0);

console.log("\n--- Builder Review ---\n");
const review = composeBuilderReview({
  estimate: {
    recommendedCost: abcCalc.lineItems.reduce((sum, item) => sum + (item.recommendedCost ?? 0), 0),
    recommendedSell: abcCalc.lineItems.reduce((sum, item) => sum + (item.recommendedSell ?? 0), 0),
    marginPercent: 20,
    confidence: abcCalc.confidence,
    assumptions: abcCalc.assumptions,
    missingInfo: abcCalc.missingInfo,
    lineItems: mapCalcLines(abcCalc.lineItems),
  },
  workAreas: [{ id: "w1", type: "internal_walls", name: "Internal walls", status: "confirmed" }],
  requirements: abcCalc.requirements ?? [],
});
const reviewText = JSON.stringify(review);
check(
  "Review shows Type A/B/C physical quantities",
  /108\.24/.test(reviewText) &&
    /113\.3/.test(reviewText) &&
    /69\.08/.test(reviewText) &&
    /21 studs/.test(reviewText) &&
    /12\.96 person-hours/.test(reviewText)
);
const visibleReview = JSON.stringify({
  labels: review.workAreas.flatMap((wa) =>
    wa.categories.flatMap((cat) => [
      ...cat.lines.map((line) => [line.label, line.supporting, line.specification]),
      ...cat.lineGroups.map((group) => [
        group.label,
        group.supporting,
        group.secondary,
        ...group.children.map((child) => [child.label, child.supporting]),
      ]),
    ])
  ),
  assumptions: review.assumptions,
});
check(
  "Review does not expose requirement keys",
  !visibleReview.includes(INTERNAL_WALLS_FRAMING_90_MATERIAL_COMPONENT) &&
    !visibleReview.includes(INTERNAL_WALLS_FRAMING_90_LABOUR_COMPONENT)
);
check(
  "Review wall-type groups exist",
  review.workAreas[0]?.categories.some((cat) =>
    cat.lineGroups.some((group) => group.id.startsWith("internal-walls-"))
  ) === true
);
check(
  "Pricing Required shown for 140 and fixings",
  /Rate required|Pricing required/i.test(reviewText) && /fixings/i.test(reviewText)
);
check(
  "Review surface wraps compact rows",
  read("components/assistant/builder-review/BuilderReviewSurface.tsx").includes("break-words") &&
    read("components/assistant/builder-review/BuilderReviewSurface.tsx").includes("overflow-x-hidden") &&
    read("components/assistant/builder-review/BuilderReviewSurface.tsx").includes("Framing details")
);

console.log("\n--- Hosted policy / migrations ---\n");
check(
  "canonical Preview host",
  PREVIEW_AUTH_SITE_ORIGIN_STABLE.includes("hardening-stage-2a-security")
);
check("Preview ref recorded", PREVIEW_SUPABASE_PROJECT_REF === "shhpjsoldmqtkdbgrbtm");
check("plus-address fixture allowed", isPlusAddressFixture("hello+wa-iw-03@example.invalid"));
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
  "no bathroom intensity on IW framing module",
  !read("lib/estimate/internal-walls-framing.ts").includes("bathroom.framing") &&
    !read("lib/estimate/internal-walls-physical.ts").includes("0.8 h") &&
    read("lib/estimate/calculators/fitout.ts").includes("isMatureInternalWallsPath")
);

const takeoffProbe = internalWallsTimberTakeoff({
  type: {
    id: "probe",
    label: null,
    length_lm: 12,
    height_m: 2.4,
    height_source: "known",
    frame_system: "timber",
    frame_size: "90x45",
    steel: null,
    stud_centres_mm: 600,
    stud_centres_source: "override",
    same_lining_both_sides: null,
    side_a: {
      lined: false,
      material_family: null,
      product: null,
      thickness_mm: null,
      sheet_length_mm: null,
      layers: null,
    },
    side_b: {
      lined: false,
      material_family: null,
      product: null,
      thickness_mm: null,
      sheet_length_mm: null,
      layers: null,
    },
    openings: [],
  },
  centresMm: 600,
  spacingM: 0.6,
  wasteFactor: 0.1,
  hoursPerM2: 0.45,
});
check(
  "pure takeoff Type A fixture",
  takeoffProbe?.studCount === 21 &&
    near(takeoffProbe.studLm, 50.4) &&
    near(takeoffProbe.plateLm, 24) &&
    takeoffProbe.noggingRows === 2 &&
    near(takeoffProbe.noggingLm, 24) &&
    near(takeoffProbe.rawTimberLm, 98.4) &&
    near(takeoffProbe.purchaseTimberLm, 108.24) &&
    near(takeoffProbe.wallAreaM2, 28.8) &&
    near(takeoffProbe.labourHours, 12.96)
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
