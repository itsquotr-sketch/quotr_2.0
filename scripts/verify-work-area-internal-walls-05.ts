/**
 * WA-INTERNAL-WALLS-05 — lining product / face / layer + sheet takeoff.
 *
 * Run: npx --yes tsx scripts/verify-work-area-internal-walls-05.ts
 *
 * No paid AI. No Production. No migration 055.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import type { EstimateLineItem } from "../components/assistant/types";
import { calculateInternalWalls } from "../lib/estimate/calculators/fitout";
import { getCatalogueEntry } from "../lib/rates/catalogue";
import { BATHROOM_AQUALINE_SHEET_KEY } from "../lib/estimate/bathroom-identities";
import {
  INTERNAL_WALLS_JOB_SCOPE_FACT_KEY,
  isMatureInternalWallsPath,
} from "../lib/estimate/internal-walls-scope";
import {
  INTERNAL_WALLS_ADD_WALL_TYPE_KEY,
  applyInternalWallsFactWrite,
  liningThicknessesMmForProduct,
  recommendedSheetLengthMmForProduct,
} from "../lib/estimate/internal-walls-wall-types";
import {
  INTERNAL_WALLS_AQUALINE_13_2400_KEY,
  INTERNAL_WALLS_BRACELINE_13_2400_KEY,
  INTERNAL_WALLS_FYRELINE_13_2400_KEY,
  INTERNAL_WALLS_FRAMING_90_MATERIAL_COMPONENT,
  INTERNAL_WALLS_LINING_LABOUR_OWNER_REQUIRED_MESSAGE,
  INTERNAL_WALLS_LINING_NOT_PRICED_STATEMENT,
  INTERNAL_WALLS_LINING_PRODUCTIVITY_KEYS,
  INTERNAL_WALLS_PLASTERBOARD_SHEET_WIDTH_MM,
  INTERNAL_WALLS_SHEET_TOO_SHORT_MESSAGE,
  INTERNAL_WALLS_STANDARD_13_2400_KEY,
  internalWallsLiningLabourComponent,
  internalWallsLiningMaterialComponent,
} from "../lib/estimate/internal-walls-identities";
import {
  aggregateInternalWallsLiningPurchaseSheets,
  internalWallsLiningFaceTakeoff,
  internalWallsLiningMaterialKey,
} from "../lib/estimate/internal-walls-lining";
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
import type { InternalWallsFace } from "../lib/estimate/internal-walls-wall-types";
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
      sheetMaterialWastagePercent: 10,
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
      (/wall framing labour/i.test(row.label) && row.unit === "lm") ||
      /internal wall lining labour/i.test(row.label)
  );
}

function face(partial: Partial<InternalWallsFace> & { product: InternalWallsFace["product"] }): InternalWallsFace {
  return {
    lined: true,
    material_family: "plasterboard",
    product: partial.product,
    thickness_mm: partial.thickness_mm ?? 13,
    sheet_length_mm: partial.sheet_length_mm ?? 2400,
    sheet_length_source: "override",
    layers: partial.layers ?? 1,
  };
}

const walls = wa("w1", "internal_walls", "Internal walls");

function fixtureAFacts(): EstimateFact[] {
  return [
    fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "new_partition"),
    ...writeWall("w1", [
      { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
      { key: "internal_walls.wall_type.label", value: "Standard partition" },
      { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
      { key: "internal_walls.wall_type.frame_size", value: "90 mm timber framing — 90×45" },
      { key: "internal_walls.wall_type.length_lm", value: 12 },
      { key: "internal_walls.wall_type.height_m", value: 2.4 },
      { key: "internal_walls.wall_type.stud_centres_mm", value: "600 mm" },
      { key: "internal_walls.wall_type.side_a_product", value: "Standard GIB" },
      { key: "internal_walls.wall_type.same_lining_both_sides", value: true },
    ]).filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
  ];
}

console.log("=== WA-INTERNAL-WALLS-05 ===\n");

console.log("--- Product matrix / identities ---\n");
check(
  "plasterboard width is 1200 mm",
  INTERNAL_WALLS_PLASTERBOARD_SHEET_WIDTH_MM === 1200
);
check(
  "Standard / Aqualine / Braceline thicknesses 10 and 13",
  liningThicknessesMmForProduct("standard_gib").join() === "10,13" &&
    liningThicknessesMmForProduct("aqualine").join() === "10,13" &&
    liningThicknessesMmForProduct("braceline").join() === "10,13"
);
check(
  "Fyreline / Barrierline thicknesses 13 and 16",
  liningThicknessesMmForProduct("fyreline").join() === "13,16" &&
    liningThicknessesMmForProduct("barrierline").join() === "13,16"
);
check("25 mm is not a V1 plasterboard thickness", !liningThicknessesMmForProduct("standard_gib").includes(25));
check(
  "plywood / fibre cement have no V1 wall-lining thicknesses",
  liningThicknessesMmForProduct("plywood").length === 0 &&
    liningThicknessesMmForProduct("fibre_cement").length === 0
);
check(
  "legacy 13/2400 Standard aliases generic shared key",
  internalWallsLiningMaterialKey({
    product: "standard_gib",
    thicknessMm: 13,
    lengthMm: 2400,
  }).materialKey === INTERNAL_WALLS_STANDARD_13_2400_KEY
);
check(
  "legacy 13/2400 Aqualine is Bathroom shared key",
  internalWallsLiningMaterialKey({
    product: "aqualine",
    thicknessMm: 13,
    lengthMm: 2400,
  }).materialKey === BATHROOM_AQUALINE_SHEET_KEY &&
    BATHROOM_AQUALINE_SHEET_KEY === INTERNAL_WALLS_AQUALINE_13_2400_KEY
);
check(
  "3000 Fyreline is a distinct dimensioned key, not 2400 Fyreline",
  internalWallsLiningMaterialKey({
    product: "fyreline",
    thicknessMm: 13,
    lengthMm: 3000,
  }).materialKey === "sheet.plasterboard.fyreline.13mm.3000x1200.each" &&
    getCatalogueEntry("sheet.plasterboard.fyreline.13mm.3000x1200.each")?.defaultCostRate == null
);
check(
  "2700 Standard does not inherit 2400 benchmark",
  getCatalogueEntry("sheet.plasterboard.standard.13mm.2700x1200.each")?.defaultCostRate == null &&
    getCatalogueEntry(INTERNAL_WALLS_STANDARD_13_2400_KEY)?.defaultCostRate === 18
);
check(
  "no Internal-Walls-specific physical GIB keys",
  !read("lib/rates/specific-material-catalogue.ts").includes("internal_walls.gib")
);
check(
  "Bathroom floor plywood is not reused as wall lining",
  read("lib/estimate/internal-walls-lining.ts").includes("INTERNAL_WALLS_PLYWOOD_LINING_GAP_MESSAGE") &&
    !read("lib/estimate/internal-walls-lining.ts").includes("sheet.plywood.19mm.h3.2.each")
);
check(
  "Bathroom FC flooring is not reused as wall lining",
  !read("lib/estimate/internal-walls-lining.ts").includes("sheet.fibre_cement.18mm")
);
check(
  "Noiseline / Weatherline / Barrierline have dimensioned keys without invented rates",
  getCatalogueEntry("sheet.plasterboard.noiseline.13mm.2400x1200.each")?.defaultCostRate == null &&
    getCatalogueEntry("sheet.plasterboard.weatherline.13mm.2400x1200.each")?.defaultCostRate == null &&
    getCatalogueEntry("sheet.plasterboard.barrierline.13mm.2400x1200.each")?.defaultCostRate == null
);
check(
  "productivity keys exist without invented hours/sheet",
  INTERNAL_WALLS_LINING_PRODUCTIVITY_KEYS.standard_gib ===
    "internal_walls.lining.standard_gib.hours_per_sheet" &&
    !read("lib/estimate/productivity.ts").includes("internal_walls.lining.standard_gib.hours_per_sheet")
);
check(
  "recommended product length spans height",
  recommendedSheetLengthMmForProduct("standard_gib", 2.4) === 2400 &&
    recommendedSheetLengthMmForProduct("fyreline", 3) === 3000 &&
    recommendedSheetLengthMmForProduct("aqualine", 2.7) === 2700
);

console.log("\n--- Sheet-count formulas ---\n");
const formulaA = internalWallsLiningFaceTakeoff({
  type: { length_lm: 12, height_m: 2.4 },
  face: face({ product: "standard_gib", sheet_length_mm: 2400 }),
  side: "side_a",
  wasteFactor: 0.1,
  hoursPerSheet: null,
});
check(
  "12 m / 1200 mm → 10 base, 11 purchase",
  formulaA.ok &&
    formulaA.baseSheetsPerLayer === 10 &&
    formulaA.purchaseSheetsPerLayer === 11 &&
    formulaA.installedSheets === 10 &&
    formulaA.purchaseSheets === 11
);
const formulaB = internalWallsLiningFaceTakeoff({
  type: { length_lm: 8, height_m: 3 },
  face: face({ product: "fyreline", sheet_length_mm: 3000, layers: 2 }),
  side: "side_a",
  wasteFactor: 0.1,
  hoursPerSheet: null,
});
check(
  "8 m double layer → 7 base, 8 purchase/layer, 14/16 face",
  formulaB.ok &&
    formulaB.baseSheetsPerLayer === 7 &&
    formulaB.purchaseSheetsPerLayer === 8 &&
    formulaB.installedSheets === 14 &&
    formulaB.purchaseSheets === 16
);
const tooShort = internalWallsLiningFaceTakeoff({
  type: { length_lm: 3, height_m: 3 },
  face: face({ product: "standard_gib", sheet_length_mm: 2400 }),
  side: "side_a",
  wasteFactor: 0.1,
  hoursPerSheet: null,
});
check(
  "too-short sheet is Info Required, not area math",
  !tooShort.ok &&
    tooShort.kind === "too_short" &&
    tooShort.message === INTERNAL_WALLS_SHEET_TOO_SHORT_MESSAGE
);
const longer = internalWallsLiningFaceTakeoff({
  type: { length_lm: 12, height_m: 2.4 },
  face: face({ product: "standard_gib", sheet_length_mm: 2700 }),
  side: "side_a",
  wasteFactor: 0.1,
  hoursPerSheet: null,
});
check(
  "longer-than-wall sheet still uses one sheet per bay",
  longer.ok && longer.baseSheetsPerLayer === 10 && longer.purchaseSheets === 11
);

console.log("\n--- Fixture A Standard both sides ---\n");
const a = calculateInternalWalls(ctx([walls], fixtureAFacts()), walls);
const aLining = mats(a).filter(
  (row) => row.componentKey === internalWallsLiningMaterialComponent("standard_gib")
);
const aLabour = labs(a).filter(
  (row) => row.componentKey === internalWallsLiningLabourComponent("standard_gib")
);
check("Fixture A mature path", isMatureInternalWallsPath({ facts: fixtureAFacts(), workAreaId: "w1" }));
check("Fixture A two face authorities", aLining.length === 2);
check(
  "Fixture A 10 installed / 11 purchase each face",
  aLining.every((row) => near(row.baseQuantity, 10) && near(row.purchaseQuantity, 11))
);
check(
  "Fixture A 20 installed / 22 purchase total",
  near(aLining.reduce((sum, row) => sum + row.baseQuantity, 0), 20) &&
    near(aggregateInternalWallsLiningPurchaseSheets(a.requirements ?? [], INTERNAL_WALLS_STANDARD_13_2400_KEY), 22)
);
check(
  "Fixture A labour uses installed sheets not waste sheets",
  aLabour.length === 2 && aLabour.every((row) => near(row.productivityBasis.quantity, 10))
);
check(
  "Fixture A lining labour Pricing Required — no invented hours/sheet",
  aLabour.every((row) => row.priced === false && row.rateProvenance === "missing")
);
check(
  "Fixture A Standard uses legacy 13/2400 shared key",
  aLining.every((row) => row.materialKey === INTERNAL_WALLS_STANDARD_13_2400_KEY)
);
check("Fixture A Standard material priced from benchmark", aLining.every((row) => row.priced === true));
check("Fixture A timber unchanged 108.24 lm", near(
  mats(a).find((row) => row.componentKey === INTERNAL_WALLS_FRAMING_90_MATERIAL_COMPONENT)?.purchaseQuantity,
  108.24
));
check("Fixture A no lining-not-priced statement", !a.assumptions.includes(INTERNAL_WALLS_LINING_NOT_PRICED_STATEMENT));
check("Fixture A no legacy package / 1.4 h/m²", !isLegacyPackage(a) && !a.lineItems.some((row) => row.unit === "m²" && /lining labour/i.test(row.label)));
check(
  "Fixture A no silent quantity 20 on a single line",
  !a.lineItems.some((row) => Number(row.quantity) === 20)
);

console.log("\n--- Fixture B double Fyreline ---\n");
const bFacts = [
  fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "new_partition"),
  ...writeWall("w1", [
    { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
    { key: "internal_walls.wall_type.label", value: "Double Fyreline" },
    { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
    { key: "internal_walls.wall_type.frame_size", value: "90 mm timber framing — 90×45" },
    { key: "internal_walls.wall_type.length_lm", value: 8 },
    { key: "internal_walls.wall_type.height_m", value: 3 },
    { key: "internal_walls.wall_type.stud_centres_mm", value: "400 mm" },
    { key: "internal_walls.wall_type.side_a_product", value: "Fyreline" },
    { key: "internal_walls.wall_type.side_a_layers", value: "2 layers" },
    { key: "internal_walls.wall_type.same_lining_both_sides", value: true },
  ]).filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
];
const b = calculateInternalWalls(ctx([walls], bFacts), walls);
const bLining = mats(b).filter(
  (row) => row.componentKey === internalWallsLiningMaterialComponent("fyreline")
);
check("Fixture B two faces", bLining.length === 2);
check(
  "Fixture B 14 installed / 16 purchase each face",
  bLining.every((row) => near(row.baseQuantity, 14) && near(row.purchaseQuantity, 16))
);
check(
  "Fixture B 28 installed / 32 purchase total",
  near(bLining.reduce((sum, row) => sum + row.baseQuantity, 0), 28) &&
    near(bLining.reduce((sum, row) => sum + row.purchaseQuantity, 0), 32)
);
check(
  "Fixture B uses 3000×1200 identity not 2400 Fyreline",
  bLining.every((row) => row.materialKey === "sheet.plasterboard.fyreline.13mm.3000x1200.each") &&
    !bLining.some((row) => row.materialKey === INTERNAL_WALLS_FYRELINE_13_2400_KEY)
);
check("Fixture B Fyreline 3000 Pricing Required", bLining.every((row) => row.priced === false));
check(
  "Fixture B review copy keeps 2 layers",
  bLining.every((row) => (row.specification ?? "").includes("2 layers"))
);

console.log("\n--- Fixture C different faces ---\n");
const cFacts = [
  fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "new_partition"),
  ...writeWall("w1", [
    { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
    { key: "internal_walls.wall_type.label", value: "Wet / dry" },
    { key: "internal_walls.wall_type.frame_system", value: "Steel framing" },
    { key: "internal_walls.wall_type.length_lm", value: 5 },
    { key: "internal_walls.wall_type.height_m", value: 2.7 },
    { key: "internal_walls.wall_type.stud_centres_mm", value: "400 mm" },
    { key: "internal_walls.wall_type.side_a_product", value: "Aqualine" },
    { key: "internal_walls.wall_type.same_lining_both_sides", value: false },
    { key: "internal_walls.wall_type.side_b_product", value: "Standard GIB" },
  ]).filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
];
const c = calculateInternalWalls(ctx([walls], cFacts), walls);
const cAq = mats(c).filter((row) => row.materialKey === "sheet.plasterboard.aqualine.13mm.2700x1200.each");
const cStd = mats(c).filter((row) => row.materialKey === "sheet.plasterboard.standard.13mm.2700x1200.each");
check("Fixture C separate Aqualine and Standard identities", cAq.length === 1 && cStd.length === 1);
check(
  "Fixture C 5 installed / 6 purchase each",
  near(cAq[0]?.baseQuantity, 5) &&
    near(cAq[0]?.purchaseQuantity, 6) &&
    near(cStd[0]?.baseQuantity, 5) &&
    near(cStd[0]?.purchaseQuantity, 6)
);
check("Fixture C does not collapse unlike products", cAq[0]?.materialKey !== cStd[0]?.materialKey);
check("Fixture C 2700 keys are Pricing Required", cAq[0]?.priced === false && cStd[0]?.priced === false);
check(
  "Fixture C steel framing still present",
  mats(c).some((row) => row.componentKey.includes("steel"))
);

console.log("\n--- Fixture D reline one side ---\n");
const dFacts = [
  fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "reline_existing"),
  ...writeWall("w1", [
    { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
    { key: "internal_walls.wall_type.label", value: "Reline" },
    { key: "internal_walls.wall_type.frame_system", value: "Existing frame" },
    { key: "internal_walls.wall_type.length_lm", value: 3 },
    { key: "internal_walls.wall_type.height_m", value: 2.4 },
    { key: "internal_walls.wall_type.side_a_product", value: "Standard GIB" },
    { key: "internal_walls.wall_type.same_lining_both_sides", value: false },
  ]).filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
];
const d = calculateInternalWalls(ctx([walls], dFacts), walls);
const dLining = mats(d).filter(
  (row) => row.componentKey === internalWallsLiningMaterialComponent("standard_gib")
);
check("Fixture D one lining face", dLining.length === 1);
check(
  "Fixture D 3 installed / 4 purchase",
  near(dLining[0]?.baseQuantity, 3) && near(dLining[0]?.purchaseQuantity, 4)
);
check(
  "Fixture D no framing",
  !mats(d).some((row) => row.componentKey.includes("framing")) &&
    !labs(d).some((row) => row.componentKey.includes("framing"))
);

console.log("\n--- Too-short sheet ---\n");
const shortFacts = [
  fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "new_partition"),
  ...writeWall("w1", [
    { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
    { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
    { key: "internal_walls.wall_type.frame_size", value: "90 mm timber framing — 90×45" },
    { key: "internal_walls.wall_type.length_lm", value: 3 },
    { key: "internal_walls.wall_type.height_m", value: 3 },
    { key: "internal_walls.wall_type.side_a_product", value: "Standard GIB" },
    { key: "internal_walls.wall_type.side_a_sheet_length_mm", value: "2400 mm" },
    { key: "internal_walls.wall_type.same_lining_both_sides", value: true },
  ]).filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
];
const short = calculateInternalWalls(ctx([walls], shortFacts), walls);
check(
  "too-short copy is builder-facing",
  short.missingInfo.includes(INTERNAL_WALLS_SHEET_TOO_SHORT_MESSAGE)
);
check(
  "too-short does not emit lining sheets",
  !mats(short).some((row) => row.componentKey.startsWith("internal_walls.lining."))
);

console.log("\n--- Multi wall-type / aggregation / finish ---\n");
let multi = fixtureAFacts();
multi = applyInternalWallsFactWrite({
  facts: multi,
  workAreaId: "w1",
  key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY,
  value: true,
});
for (const row of [
  { key: "internal_walls.wall_type.label", value: "Double Fyreline" },
  { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
  { key: "internal_walls.wall_type.frame_size", value: "90 mm timber framing — 90×45" },
  { key: "internal_walls.wall_type.length_lm", value: 8 },
  { key: "internal_walls.wall_type.height_m", value: 3 },
  { key: "internal_walls.wall_type.stud_centres_mm", value: "400 mm" },
  { key: "internal_walls.wall_type.side_a_product", value: "Fyreline" },
  { key: "internal_walls.wall_type.side_a_layers", value: "2 layers" },
  { key: "internal_walls.wall_type.same_lining_both_sides", value: true },
]) {
  multi = applyInternalWallsFactWrite({
    facts: multi,
    workAreaId: "w1",
    key: row.key,
    value: row.value,
  });
}
const mixed = calculateInternalWalls(ctx([walls], multi), walls);
check(
  "Standard 2400 and Fyreline 3000 do not aggregate",
  aggregateInternalWallsLiningPurchaseSheets(mixed.requirements ?? [], INTERNAL_WALLS_STANDARD_13_2400_KEY) === 22 &&
    aggregateInternalWallsLiningPurchaseSheets(
      mixed.requirements ?? [],
      "sheet.plasterboard.fyreline.13mm.3000x1200.each"
    ) === 32
);
const premium = calculateInternalWalls(
  ctx([walls], fixtureAFacts(), {
    project: { id: "p1", qualityLevel: "premium" },
  } as Partial<EstimateContext>),
  walls
);
check(
  "finish level does not scale sheet quantity",
  near(
    mats(premium)
      .filter((row) => row.componentKey === internalWallsLiningMaterialComponent("standard_gib"))
      .reduce((sum, row) => sum + row.purchaseQuantity, 0),
    22
  )
);
const withHours = calculateInternalWalls(
  ctx([walls], fixtureAFacts(), {
    rates: [
      {
        id: "h",
        item_key: INTERNAL_WALLS_LINING_PRODUCTIVITY_KEYS.standard_gib,
        rate_type: "productivity",
        label: "Standard GIB lining",
        unit: "sheet",
        cost_rate: 0.4,
        sell_rate: null,
        active: true,
        markup_percent: null,
        trade: null,
        work_area_type: null,
      },
    ],
  } as Partial<EstimateContext>),
  walls
);
const pricedLabour = labs(withHours).filter(
  (row) => row.componentKey === internalWallsLiningLabourComponent("standard_gib")
);
check(
  "company hours/sheet prices labour on installed sheets only",
  pricedLabour.length === 2 &&
    pricedLabour.every((row) => row.priced === true && near(row.baseHours, 4))
);
check(
  "labour money uses carpenter hourly",
  pricedLabour.every((row) => (row.rateKey ?? "").includes("carpenter"))
);
check(
  "no $/m² lining package on mature path",
  !withHours.lineItems.some((row) => row.itemKey === "scope.internal_walls.m2") &&
    !read("lib/estimate/internal-walls-lining-physical.ts").includes("internalWallsPerM2")
);
check(
  "Braceline 13/2400 still has a benchmark; Noiseline does not",
  getCatalogueEntry(INTERNAL_WALLS_BRACELINE_13_2400_KEY)?.defaultCostRate === 22 &&
    getCatalogueEntry("sheet.plasterboard.noiseline.13mm.2400x1200.each")?.defaultCostRate == null
);

console.log("\n--- Builder Review ---\n");
const review = composeBuilderReview({
  estimate: {
    recommendedCost: a.lineItems.reduce((sum, item) => sum + (item.recommendedCost ?? 0), 0),
    recommendedSell: a.lineItems.reduce((sum, item) => sum + (item.recommendedSell ?? 0), 0),
    marginPercent: 20,
    confidence: a.confidence,
    assumptions: a.assumptions,
    missingInfo: a.missingInfo,
    lineItems: mapCalcLines(a.lineItems),
  },
  workAreas: [{ id: "w1", type: "internal_walls", name: "Internal walls", status: "confirmed" }],
  requirements: a.requirements ?? [],
});
const reviewText = JSON.stringify(review);
check(
  "Review shows installed and purchase sheet counts",
  /10 sheets installed/.test(reviewText) && /11 sheets incl\. waste/.test(reviewText)
);
check("Review can summarise both sides", /Both sides/.test(reviewText));
check(
  "Review does not expose lining requirement keys",
  !JSON.stringify({
    labels: review.workAreas.flatMap((waRow) =>
      waRow.categories.flatMap((cat) => [
        ...cat.lines.map((line) => [line.label, line.supporting]),
        ...cat.lineGroups.map((group) => [group.label, group.supporting, group.secondary]),
      ])
    ),
  }).includes("internal_walls.lining.standard_gib.material")
);
check(
  "Review surface has lining details + wrap",
  read("components/assistant/builder-review/BuilderReviewSurface.tsx").includes("Lining details") &&
    read("components/assistant/builder-review/BuilderReviewSurface.tsx").includes("overflow-x-hidden") &&
    read("components/assistant/builder-review/BuilderReviewSurface.tsx").includes("break-words")
);
check(
  "labour Pricing Required copy exists",
  INTERNAL_WALLS_LINING_LABOUR_OWNER_REQUIRED_MESSAGE.includes("hours/sheet")
);

console.log("\n--- Hosted policy / migrations ---\n");
check(
  "canonical Preview host",
  PREVIEW_AUTH_SITE_ORIGIN_STABLE.includes("hardening-stage-2a-security")
);
check("Preview ref recorded", PREVIEW_SUPABASE_PROJECT_REF === "shhpjsoldmqtkdbgrbtm");
check("plus-address fixture allowed", isPlusAddressFixture("hello+wa-iw-05@example.invalid"));
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
  "IW-05 lining identities are code catalogue only",
  read("lib/rates/specific-material-catalogue.ts").includes("dimensionedPlasterboardSheetCatalogue") &&
    getCatalogueEntry("sheet.plasterboard.fyreline.13mm.3000x1200.each")?.item_key ===
      "sheet.plasterboard.fyreline.13mm.3000x1200.each" &&
    !readdirSync(join(process.cwd(), "supabase/migrations")).some((name) =>
      /plasterboard\.fyreline\.13mm/.test(name)
    )
);
check(
  "IW-03 timber formulas unchanged",
  read("lib/estimate/internal-walls-framing.ts").includes("ceil(lengthLm / spacingM - 1e-12) + 1")
);
check(
  "IW-04 steel formulas unchanged",
  read("lib/estimate/internal-walls-framing.ts").includes("INTERNAL_WALLS_STEEL_WASTE_FACTOR")
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
