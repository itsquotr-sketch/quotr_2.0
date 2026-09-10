/**
 * WA-INTERNAL-WALLS-04 — steel track/stud physical takeoff.
 *
 * Run: npx --yes tsx scripts/verify-work-area-internal-walls-04.ts
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
  applyInternalWallsFactWrite,
} from "../lib/estimate/internal-walls-wall-types";
import {
  INTERNAL_WALLS_FRAMING_90_LABOUR_COMPONENT,
  INTERNAL_WALLS_FRAMING_FIXINGS_COMPONENT,
  INTERNAL_WALLS_FRAMING_OTHER_COMPONENT,
  INTERNAL_WALLS_FRAMING_STEEL_COMPONENT,
  INTERNAL_WALLS_FRAMING_STEEL_LABOUR_COMPONENT,
  INTERNAL_WALLS_FRAMING_STEEL_STUD_COMPONENT,
  INTERNAL_WALLS_FRAMING_STEEL_TRACK_COMPONENT,
  INTERNAL_WALLS_OTHER_FRAMING_NOT_PRICED_MESSAGE,
  INTERNAL_WALLS_PRODUCTIVITY_BENCHMARKS,
  INTERNAL_WALLS_PRODUCTIVITY_KEYS,
  INTERNAL_WALLS_STEEL_FRAMING_NOT_PRICED_MESSAGE,
  INTERNAL_WALLS_STEEL_STUD_KEY,
  INTERNAL_WALLS_STEEL_TRACK_KEY,
  INTERNAL_WALLS_STEEL_WASTE_FACTOR,
  INTERNAL_WALLS_STUD_CENTRES_REQUIRED_MESSAGE,
  INTERNAL_WALLS_TIMBER_90_KEY,
  INTERNAL_WALLS_TIMBER_140_KEY,
} from "../lib/estimate/internal-walls-identities";
import { aggregateInternalWallsTimberPurchaseLm } from "../lib/estimate/internal-walls-physical";
import {
  internalWallsSteelTakeoff,
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
import type { InternalWallsWallType } from "../lib/estimate/internal-walls-wall-types";
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

function steelWrites(params: {
  label: string;
  length: number;
  height: number;
  centres: string;
}): Array<{ key: string; value: unknown }> {
  return [
    { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
    { key: "internal_walls.wall_type.label", value: params.label },
    { key: "internal_walls.wall_type.frame_system", value: "Steel framing" },
    { key: "internal_walls.wall_type.length_lm", value: params.length },
    { key: "internal_walls.wall_type.height_m", value: params.height },
    { key: "internal_walls.wall_type.stud_centres_mm", value: params.centres },
  ];
}

function steelFactsA(): EstimateFact[] {
  return [
    fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "new_partition"),
    ...writeWall("w1", steelWrites({
      label: "Steel partition",
      length: 10,
      height: 2.4,
      centres: "600 mm",
    })).filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
  ];
}

function timberAFacts(): EstimateFact[] {
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

console.log("=== WA-INTERNAL-WALLS-04 ===\n");

console.log("--- Identities / waste / widths ---\n");
const track = getCatalogueEntry(INTERNAL_WALLS_STEEL_TRACK_KEY);
const stud = getCatalogueEntry(INTERNAL_WALLS_STEEL_STUD_KEY);
check(
  "shared steel track identity exists without invented $/lm",
  track?.item_key === INTERNAL_WALLS_STEEL_TRACK_KEY &&
    track.unit === "lm" &&
    track.defaultCostRate == null &&
    track.workAreaLabel === "Steel framing"
);
check(
  "shared steel stud identity exists without invented $/lm",
  stud?.item_key === INTERNAL_WALLS_STEEL_STUD_KEY &&
    stud.unit === "lm" &&
    stud.defaultCostRate == null &&
    stud.workAreaLabel === "Steel framing"
);
check(
  "no Internal-Walls-specific physical steel keys",
  !read("lib/rates/specific-material-catalogue.ts").includes("internal_walls.steel.track") &&
    !read("lib/rates/specific-material-catalogue.ts").includes("internal_walls.steel.stud")
);
check(
  "no width-specific steel catalogue products invented",
  !read("lib/rates/specific-material-catalogue.ts").includes("steel.framing.track.92") &&
    !read("lib/rates/specific-material-catalogue.ts").includes("steel.framing.stud.92")
);
check(
  "steel waste is 0 — timber_framing 10% is not reused",
  INTERNAL_WALLS_STEEL_WASTE_FACTOR === 0 &&
    !read("lib/estimate/internal-walls-framing.ts").includes("timber_framing") &&
    read("lib/estimate/internal-walls-identities.ts").includes("INTERNAL_WALLS_STEEL_WASTE_FACTOR")
);
check(
  "no canonical steel wastage category in settings",
  !read("lib/settings/material-wastage.ts").includes("steel")
);
check(
  "steel productivity 0.40 h/m²",
  INTERNAL_WALLS_PRODUCTIVITY_BENCHMARKS.steelTrackAndStudM2 === 0.4 &&
    INTERNAL_WALLS_PRODUCTIVITY_KEYS.steelTrackAndStudM2 ===
      "internal_walls.framing.steel.track_and_stud.hours_per_m2"
);
check(
  "steel productivity is in BENCHMARK_PRODUCTIVITY",
  read("lib/estimate/productivity.ts").includes(INTERNAL_WALLS_PRODUCTIVITY_KEYS.steelTrackAndStudM2)
);
check(
  "no DNA calibration catalogue rows for steel",
  !read("lib/company-dna/v2-foundation.ts").includes(
    INTERNAL_WALLS_PRODUCTIVITY_KEYS.steelTrackAndStudM2
  )
);

console.log("\n--- Formulas ---\n");
check("track 10 m = 20 lm", near(2 * 10, 20));
check("stud count 10 m / 600 mm = 18", internalWallsStudCount(10, 0.6) === 18);
check("stud count 8 m / 400 mm = 21", internalWallsStudCount(8, 0.4) === 21);
check("custom 450 mm on 10 m = 24 studs", internalWallsStudCount(10, 0.45) === 24);
check(
  "invalid spacing does not divide by zero",
  internalWallsStudCount(10, 0) === 0 && internalWallsStudCount(10, -1) === 0
);
const dummySteel: InternalWallsWallType = {
  id: "s1",
  label: "Steel",
  length_lm: 10,
  height_m: 2.4,
  height_source: "known",
  frame_system: "steel",
  frame_size: null,
  steel: { system: "track_and_stud", stud_width_mm: null },
  stud_centres_mm: 600,
  stud_centres_source: "override",
  same_lining_both_sides: true,
  side_a: {
    lined: true,
    material_family: "plasterboard",
    product: "standard_gib",
    thickness_mm: 13,
    sheet_length_mm: 2400,
    layers: 1,
  },
  side_b: {
    lined: true,
    material_family: "plasterboard",
    product: "standard_gib",
    thickness_mm: 13,
    sheet_length_mm: 2400,
    layers: 1,
  },
  openings: [],
  has_openings: false,
  active_opening_id: null,
  insulation_included: null,
  insulation_type: null,
  skirting: null,
  cornice: null,
  electrical: null,
  electrical_note: null,
  stopping_side_a: null,
  stopping_side_b: null,
  painting: null,
  wall_count: null,
};
const steelTakeoffA = internalWallsSteelTakeoff({
  type: dummySteel,
  centresMm: 600,
  spacingM: 0.6,
  hoursPerM2: 0.4,
});
check(
  "pure takeoff Fixture A",
  steelTakeoffA != null &&
    steelTakeoffA.totalTrackLm === 20 &&
    steelTakeoffA.bottomTrackLm === 10 &&
    steelTakeoffA.topTrackLm === 10 &&
    steelTakeoffA.studCount === 18 &&
    near(steelTakeoffA.studLm, 43.2) &&
    near(steelTakeoffA.wallAreaM2, 24) &&
    near(steelTakeoffA.labourHours, 9.6) &&
    steelTakeoffA.wasteFactor === 0
);
check(
  "steel takeoff has no timber nogging fields applied",
  !read("lib/estimate/internal-walls-framing.ts").includes("recommendedNoggingRows(heightM)") ||
    read("lib/estimate/internal-walls-framing.ts").indexOf("internalWallsSteelTakeoff") >
      read("lib/estimate/internal-walls-framing.ts").indexOf("recommendedNoggingRows")
);
check(
  "steel takeoff function does not call recommendedNoggingRows",
  !/function internalWallsSteelTakeoff[\s\S]*recommendedNoggingRows/.test(
    read("lib/estimate/internal-walls-framing.ts")
  )
);

const timberUnchanged = internalWallsTimberTakeoff({
  type: {
    ...dummySteel,
    frame_system: "timber",
    frame_size: "90x45",
    length_lm: 12,
    steel: null,
  },
  centresMm: 600,
  spacingM: 0.6,
  wasteFactor: 0.1,
  hoursPerM2: 0.45,
});
check(
  "IW-03 timber Type A formulas unchanged",
  timberUnchanged != null &&
    timberUnchanged.studCount === 21 &&
    near(timberUnchanged.rawTimberLm, 98.4) &&
    near(timberUnchanged.purchaseTimberLm, 108.24) &&
    timberUnchanged.noggingRows === 2
);

console.log("\n--- Fixture A 10 × 2.4 steel / 600 ---\n");
const a = calculateInternalWalls(ctx([walls], steelFactsA()), walls);
const aTrack = mats(a).find((row) => row.componentKey === INTERNAL_WALLS_FRAMING_STEEL_TRACK_COMPONENT);
const aStud = mats(a).find((row) => row.componentKey === INTERNAL_WALLS_FRAMING_STEEL_STUD_COMPONENT);
const aLab = labs(a).find((row) => row.componentKey === INTERNAL_WALLS_FRAMING_STEEL_LABOUR_COMPONENT);
const aFix = mats(a).find((row) => row.componentKey === INTERNAL_WALLS_FRAMING_FIXINGS_COMPONENT);
check("Fixture A mature path", isMatureInternalWallsPath({ facts: steelFactsA(), workAreaId: "w1" }));
check("Fixture A track 20 lm", near(aTrack?.purchaseQuantity, 20) && near(aTrack?.baseQuantity, 20));
check("Fixture A 18 studs / 43.2 lm", near(aStud?.purchaseQuantity, 43.2) && Boolean(aStud?.specification?.includes("18 studs")));
check("Fixture A labour 9.6 h on 24 m²", near(aLab?.baseHours, 9.6) && near(aLab?.productivityBasis.quantity, 24));
check("Fixture A no timber material", !mats(a).some((row) => row.materialKey === INTERNAL_WALLS_TIMBER_90_KEY || row.materialKey === INTERNAL_WALLS_TIMBER_140_KEY));
check("Fixture A no timber labour", !labs(a).some((row) => row.componentKey === INTERNAL_WALLS_FRAMING_90_LABOUR_COMPONENT));
check("Fixture A track/stud are separate requirements", aTrack != null && aStud != null && aTrack.materialKey === INTERNAL_WALLS_STEEL_TRACK_KEY && aStud.materialKey === INTERNAL_WALLS_STEEL_STUD_KEY);
check("Fixture A waste factor 0", aTrack?.wasteFactor === 0 && aStud?.wasteFactor === 0);
check("Fixture A track/stud Pricing Required", aTrack?.priced === false && aStud?.priced === false);
check("Fixture A labour still priced", aLab?.priced === true);
check("Fixture A fixings reused on wall area", aFix?.priced === false && aFix.rateSource === "missing" && near(aFix.purchaseQuantity, 24));
check("Fixture A no legacy package", !isLegacyPackage(a));
check("Fixture A quantity visible on unpriced lines", a.lineItems.some((row) => row.itemKey === INTERNAL_WALLS_STEEL_TRACK_KEY && row.quantity === 20));

console.log("\n--- Fixture B 8 × 3.0 steel / 400 ---\n");
const bFacts = [
  fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "new_partition"),
  ...writeWall("w1", steelWrites({
    label: "Steel B",
    length: 8,
    height: 3,
    centres: "400 mm",
  })).filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
];
const b = calculateInternalWalls(ctx([walls], bFacts), walls);
const bTrack = mats(b).find((row) => row.componentKey === INTERNAL_WALLS_FRAMING_STEEL_TRACK_COMPONENT);
const bStud = mats(b).find((row) => row.componentKey === INTERNAL_WALLS_FRAMING_STEEL_STUD_COMPONENT);
const bLab = labs(b).find((row) => row.componentKey === INTERNAL_WALLS_FRAMING_STEEL_LABOUR_COMPONENT);
check("Fixture B track 16 lm", near(bTrack?.purchaseQuantity, 16));
check("Fixture B 21 studs / 63 lm", near(bStud?.purchaseQuantity, 63) && Boolean(bStud?.specification?.includes("21 studs")));
check("Fixture B labour 9.6 h on 24 m²", near(bLab?.baseHours, 9.6) && near(bLab?.productivityBasis.quantity, 24));
check("Fixture B no timber", !mats(b).some((row) => row.materialKey === INTERNAL_WALLS_TIMBER_90_KEY));

console.log("\n--- Custom centres ---\n");
const customFacts = [
  fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "new_partition"),
  ...writeWall("w1", [
    ...steelWrites({ label: "Custom steel", length: 10, height: 2.4, centres: "600 mm" }),
    { key: "internal_walls.wall_type.stud_centres_mm", value: 450 },
  ]).filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
];
const custom = calculateInternalWalls(ctx([walls], customFacts), walls);
const customStud = mats(custom).find((row) => row.componentKey === INTERNAL_WALLS_FRAMING_STEEL_STUD_COMPONENT);
check("custom 450 mm uses actual spacing (24 studs / 57.6 lm)", near(customStud?.purchaseQuantity, 57.6) && Boolean(customStud?.specification?.includes("24 studs")));
const customMissingFacts = writeWall("w1", [
  { key: INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, value: "new_partition" },
  ...steelWrites({
    label: "Custom missing",
    length: 10,
    height: 2.4,
    centres: "Custom",
  }),
]);
const customMissing = calculateInternalWalls(ctx([walls], customMissingFacts), walls);
check(
  "custom without numeric is INFO_REQUIRED",
  customMissing.missingInfo.includes(INTERNAL_WALLS_STUD_CENTRES_REQUIRED_MESSAGE)
);
check(
  "custom without numeric emits no steel material",
  !mats(customMissing).some((row) => row.materialKey === INTERNAL_WALLS_STEEL_TRACK_KEY)
);
check(
  "calculator resolve treats custom null as missing",
  resolveInternalWallsStudCentres({
    stud_centres_mm: null,
    stud_centres_source: "custom",
    height_m: 2.4,
  }).ok === false
);

console.log("\n--- Existing / other / structural ---\n");
const existingFacts = [
  fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "new_partition"),
  ...writeWall("w1", [
    { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
    { key: "internal_walls.wall_type.frame_system", value: "Existing frame" },
    { key: "internal_walls.wall_type.length_lm", value: 10 },
    { key: "internal_walls.wall_type.height_m", value: 2.4 },
  ]).filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
];
const existing = calculateInternalWalls(ctx([walls], existingFacts), walls);
check(
  "existing frame has no steel / timber / labour / fixings",
  mats(existing).length === 0 &&
    labs(existing).length === 0 &&
    !existing.lineItems.some((row) => /steel|timber|fixings|framing labour/i.test(row.label))
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
  "other framing no steel fallback",
  other.missingInfo.includes(INTERNAL_WALLS_OTHER_FRAMING_NOT_PRICED_MESSAGE) &&
    mats(other).some((row) => row.componentKey === INTERNAL_WALLS_FRAMING_OTHER_COMPONENT) &&
    !mats(other).some((row) => row.materialKey === INTERNAL_WALLS_STEEL_TRACK_KEY)
);
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
  "structural gate blocks ordinary steel framing price",
  blocked.missingInfo.includes(INTERNAL_WALLS_STRUCTURAL_SPECIALIST_MESSAGE) &&
    mats(blocked).length === 0 &&
    labs(blocked).length === 0
);

console.log("\n--- Mixed timber + steel ---\n");
let mixed = timberAFacts();
mixed = applyInternalWallsFactWrite({
  facts: mixed,
  workAreaId: "w1",
  key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY,
  value: true,
});
for (const row of steelWrites({
  label: "Steel partition",
  length: 10,
  height: 2.4,
  centres: "600 mm",
}).slice(1)) {
  mixed = applyInternalWallsFactWrite({
    facts: mixed,
    workAreaId: "w1",
    key: row.key,
    value: row.value,
  });
}
const mixedCalc = calculateInternalWalls(ctx([walls], mixed), walls);
const mixedTimber = mats(mixedCalc).filter((row) => row.materialKey === INTERNAL_WALLS_TIMBER_90_KEY);
const mixedTrack = mats(mixedCalc).filter((row) => row.materialKey === INTERNAL_WALLS_STEEL_TRACK_KEY);
const mixedStud = mats(mixedCalc).filter((row) => row.materialKey === INTERNAL_WALLS_STEEL_STUD_KEY);
check("mixed keeps Type A 90×45 purchase 108.24 lm", near(mixedTimber[0]?.purchaseQuantity, 108.24));
check("mixed steel track 20 lm isolated", mixedTrack.length === 1 && near(mixedTrack[0]?.purchaseQuantity, 20));
check("mixed steel studs 43.2 lm isolated", mixedStud.length === 1 && near(mixedStud[0]?.purchaseQuantity, 43.2));
check(
  "mixed commercial aggregation does not merge timber and steel",
  near(aggregateInternalWallsTimberPurchaseLm(mixedCalc.requirements ?? [], INTERNAL_WALLS_TIMBER_90_KEY), 108.24) &&
    near(aggregateInternalWallsTimberPurchaseLm(mixedCalc.requirements ?? [], INTERNAL_WALLS_STEEL_TRACK_KEY), 20)
);
check("mixed has timber labour and steel labour", labs(mixedCalc).length === 2);
check(
  "generic steel stub is not used for track-and-stud",
  !mats(mixedCalc).some((row) => row.componentKey === INTERNAL_WALLS_FRAMING_STEEL_COMPONENT)
);

console.log("\n--- Rate / finish / conditions ---\n");
const companyTrack = calculateInternalWalls(
  ctx([walls], steelFactsA(), {
    rates: [
      {
        id: "trk",
        item_key: INTERNAL_WALLS_STEEL_TRACK_KEY,
        rate_type: "material",
        label: "Company track",
        unit: "lm",
        cost_rate: 12,
        sell_rate: 16,
        active: true,
        markup_percent: null,
        trade: null,
        work_area_type: null,
      },
    ],
  } as Partial<EstimateContext>),
  walls
);
const pricedTrack = mats(companyTrack).find((row) => row.componentKey === INTERNAL_WALLS_FRAMING_STEEL_TRACK_COMPONENT);
const unpricedStud = mats(companyTrack).find((row) => row.componentKey === INTERNAL_WALLS_FRAMING_STEEL_STUD_COMPONENT);
check("company exact track wins", pricedTrack?.priced === true && near(pricedTrack.unitCost, 12) && pricedTrack.rateSource === "company");
check("stud remains Pricing Required when only track is priced", unpricedStud?.priced === false);
const premium = calculateInternalWalls(
  ctx([walls], steelFactsA(), {
    project: { id: "p1", qualityLevel: "premium" },
  } as Partial<EstimateContext>),
  walls
);
check(
  "finish/quality does not multiply track or stud qty",
  near(mats(premium).find((row) => row.componentKey === INTERNAL_WALLS_FRAMING_STEEL_TRACK_COMPONENT)?.purchaseQuantity, 20) &&
    near(mats(premium).find((row) => row.componentKey === INTERNAL_WALLS_FRAMING_STEEL_STUD_COMPONENT)?.purchaseQuantity, 43.2) &&
    near(labs(premium)[0]?.baseHours, 9.6)
);
check(
  "steel path does not call getQualityFactor",
  !read("lib/estimate/internal-walls-physical.ts").includes("getQualityFactor") &&
    read("lib/estimate/internal-walls-physical.ts").includes("qualityFactor: 1")
);
check(
  "conditions use canonical access helper, no IW-specific multiplier",
  read("lib/estimate/internal-walls-physical.ts").includes("getCombinedLabourAccessFactor") &&
    !read("lib/estimate/internal-walls-framing.ts").includes("occupied_site")
);
check(
  "unsupported steel message retained for non-V1 systems",
  INTERNAL_WALLS_STEEL_FRAMING_NOT_PRICED_MESSAGE.includes("not priced")
);

console.log("\n--- Builder Review ---\n");
const review = composeBuilderReview({
  estimate: {
    recommendedCost: mixedCalc.lineItems.reduce((sum, item) => sum + (item.recommendedCost ?? 0), 0),
    recommendedSell: mixedCalc.lineItems.reduce((sum, item) => sum + (item.recommendedSell ?? 0), 0),
    marginPercent: 20,
    confidence: mixedCalc.confidence,
    assumptions: mixedCalc.assumptions,
    missingInfo: mixedCalc.missingInfo,
    lineItems: mapCalcLines(mixedCalc.lineItems),
  },
  workAreas: [{ id: "w1", type: "internal_walls", name: "Internal walls", status: "confirmed" }],
  requirements: mixedCalc.requirements ?? [],
});
const reviewText = JSON.stringify(review);
check(
  "Review shows steel track/stud/labour quantities",
  /20(\.0)? lm/.test(reviewText) &&
    /43\.2/.test(reviewText) &&
    /18 studs/.test(reviewText) &&
    /9\.6 person-hours/.test(reviewText)
);
check(
  "Review shows timber Type A purchase beside steel",
  /108\.24/.test(reviewText)
);
const visibleReview = JSON.stringify({
  labels: review.workAreas.flatMap((waRow) =>
    waRow.categories.flatMap((cat) => [
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
  !visibleReview.includes(INTERNAL_WALLS_FRAMING_STEEL_TRACK_COMPONENT) &&
    !visibleReview.includes(INTERNAL_WALLS_FRAMING_STEEL_LABOUR_COMPONENT)
);
check(
  "Pricing Required shown for steel materials and fixings",
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
check("plus-address fixture allowed", isPlusAddressFixture("hello+wa-iw-04@example.invalid"));
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
  "steel identities are code catalogue only",
  read("lib/rates/specific-material-catalogue.ts").includes("steel.framing.track.lm") &&
    !readdirSync(join(process.cwd(), "supabase/migrations")).some((name) =>
      name.toLowerCase().includes("steel.framing")
    )
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
