/**
 * WA-INTERNAL-WALLS-06 — openings + structural gate + lining deductions.
 *
 * Run: npx --yes tsx scripts/verify-work-area-internal-walls-06.ts
 *
 * No paid AI. No Production. No migration 055.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import type { EstimateLineItem } from "../components/assistant/types";
import { calculateInternalWalls } from "../lib/estimate/calculators/fitout";
import {
  INTERNAL_WALLS_JOB_SCOPE_FACT_KEY,
  INTERNAL_WALLS_STRUCTURAL_FACT_KEY,
  isMatureInternalWallsPath,
} from "../lib/estimate/internal-walls-scope";
import {
  INTERNAL_WALLS_ADD_WALL_TYPE_KEY,
  INTERNAL_WALLS_STRUCTURAL_SPECIALIST_MESSAGE as STRUCTURAL_MSG,
  applyInternalWallsFactWrite,
  resolveInternalWallsWallTypes,
} from "../lib/estimate/internal-walls-wall-types";
import {
  INTERNAL_WALLS_ADD_OPENING_KEY,
  INTERNAL_WALLS_DELETE_OPENING_KEY,
  INTERNAL_WALLS_HAS_OPENINGS_KEY,
  INTERNAL_WALLS_OPENING_EXCEEDS_WALL_MESSAGE,
  openingAreaM2,
  validateInternalWallsOpening,
  internalWallsTimberOpeningTakeoff,
} from "../lib/estimate/internal-walls-openings";
import {
  INTERNAL_WALLS_FRAMING_90_MATERIAL_COMPONENT,
  INTERNAL_WALLS_OPENING_FORM_LABOUR_COMPONENT,
  INTERNAL_WALLS_OPENING_FRAMING_90_MATERIAL_COMPONENT,
  INTERNAL_WALLS_TIMBER_90_KEY,
  looksLikeDoorProductMoney,
} from "../lib/estimate/internal-walls-identities";
import { internalWallsLiningFaceTakeoff } from "../lib/estimate/internal-walls-lining";
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
  writes: Array<{
    key: string;
    value: unknown;
    wallTypeId?: string;
    openingId?: string;
  }>
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
      /internal wall lining labour/i.test(row.label) ||
      row.itemKey === "scope.internal_walls.m2"
  );
}

function hasDoorMoney(result: ReturnType<typeof calculateInternalWalls>): boolean {
  return (
    result.lineItems.some((row) =>
      looksLikeDoorProductMoney({
        label: row.label,
        componentKey: row.componentKey,
        itemKey: row.itemKey,
      })
    ) ||
    (result.requirements ?? []).some((row) =>
      looksLikeDoorProductMoney({
        label: row.description,
        componentKey: row.componentKey,
        itemKey: row.kind === "material" ? row.materialKey : null,
      })
    )
  );
}

function face(
  partial: Partial<InternalWallsFace> & { product: InternalWallsFace["product"] }
): InternalWallsFace {
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

console.log("=== WA-INTERNAL-WALLS-06 ===\n");

console.log("--- Collection / identity ---\n");
const emptyIdFacts = writeWall("w1", [
  { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
  { key: INTERNAL_WALLS_HAS_OPENINGS_KEY, value: "Yes" },
]);
const emptyResolved = resolveInternalWallsWallTypes({ facts: emptyIdFacts, workAreaId: "w1" });
const firstOpening = emptyResolved.types[0]?.openings[0];
check("Yes openings creates a stable opening id", Boolean(firstOpening?.id && firstOpening.id.length > 8));
const addSecond = applyInternalWallsFactWrite({
  facts: emptyIdFacts,
  workAreaId: "w1",
  key: INTERNAL_WALLS_ADD_OPENING_KEY,
  value: true,
  wallTypeId: emptyResolved.types[0]?.id,
});
const two = resolveInternalWallsWallTypes({ facts: addSecond, workAreaId: "w1" });
check("multiple openings on one wall type", two.types[0]?.openings.length === 2);
check(
  "opening ids are unique",
  two.types[0]!.openings[0]!.id !== two.types[0]!.openings[1]!.id
);

console.log("\n--- Validation ---\n");
check(
  "missing dims incomplete",
  validateInternalWallsOpening({
    opening: { id: "o1", type: "door", width_m: null, height_m: null, label: null },
    wallLengthLm: 12,
    wallHeightM: 2.4,
    compareToWall: true,
  }).ok === false
);
check(
  "opening wider than wall is invalid",
  validateInternalWallsOpening({
    opening: { id: "o1", type: "door", width_m: 12, height_m: 2.1, label: null },
    wallLengthLm: 12,
    wallHeightM: 2.4,
    compareToWall: true,
  }).kind === "exceeds_wall"
);
check(
  "does not invent 810×1980",
  openingAreaM2({ width_m: null, height_m: null }) == null &&
    !read("lib/estimate/internal-walls-openings.ts").includes("0.81") &&
    !read("lib/estimate/internal-walls-opening-physical.ts").includes("810")
);
check(
  "area 0.81 × 1.98 = 1.6038",
  near(openingAreaM2({ width_m: 0.81, height_m: 1.98 }), 1.6038)
);

console.log("\n--- Fixture A new wall + door opening ---\n");
let aFacts = writeWall("w1", [
  { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
  { key: "internal_walls.wall_type.label", value: "Wall Type A" },
  { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
  { key: "internal_walls.wall_type.frame_size", value: "90 mm timber framing — 90×45" },
  { key: "internal_walls.wall_type.length_lm", value: 12 },
  { key: "internal_walls.wall_type.height_m", value: 2.4 },
  { key: "internal_walls.wall_type.stud_centres_mm", value: "600 mm" },
  { key: "internal_walls.wall_type.side_a_product", value: "Standard GIB" },
  { key: "internal_walls.wall_type.same_lining_both_sides", value: true },
  { key: INTERNAL_WALLS_HAS_OPENINGS_KEY, value: "Yes" },
]);
const aType = resolveInternalWallsWallTypes({ facts: aFacts, workAreaId: "w1" }).types[0]!;
const aOpeningId = aType.openings[0]!.id;
aFacts = applyInternalWallsFactWrite({
  facts: aFacts, workAreaId: "w1", key: "internal_walls.opening.type", value: "Door opening", wallTypeId: aType.id, openingId: aOpeningId,
});
aFacts = applyInternalWallsFactWrite({
  facts: aFacts, workAreaId: "w1", key: "internal_walls.opening.width_m", value: 0.81, wallTypeId: aType.id, openingId: aOpeningId,
});
aFacts = applyInternalWallsFactWrite({
  facts: aFacts, workAreaId: "w1", key: "internal_walls.opening.height_m", value: 1.98, wallTypeId: aType.id, openingId: aOpeningId,
});
aFacts = [fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "new_partition"), ...aFacts.filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY)];
check("Fixture A mature", isMatureInternalWallsPath({ facts: aFacts, workAreaId: "w1" }));
const aCalc = calculateInternalWalls(ctx([walls], aFacts), walls);
const aLining = internalWallsLiningFaceTakeoff({
  type: { length_lm: 12, height_m: 2.4 },
  face: face({ product: "standard_gib" }),
  side: "side_a",
  wasteFactor: 0.1,
  hoursPerSheet: null,
  openingDeductionM2: 1.6038,
});
check(
  "Fixture A lining net 27.1962",
  aLining.ok && near(aLining.netFaceAreaM2, 27.1962)
);
check(
  "Fixture A sheet run still 10/11",
  aLining.ok && aLining.installedSheets === 10 && aLining.purchaseSheets === 11
);
const aOpeningMat = mats(aCalc).find(
  (row) => row.componentKey === INTERNAL_WALLS_OPENING_FRAMING_90_MATERIAL_COMPONENT
);
const aBaseMat = mats(aCalc).find(
  (row) => row.componentKey === INTERNAL_WALLS_FRAMING_90_MATERIAL_COMPONENT
);
check("Fixture A base timber still present", aBaseMat != null && near(aBaseMat.baseQuantity, 98.4));
check(
  "Fixture A opening timber 2 trimmers + 0.81 header",
  aOpeningMat != null && near(aOpeningMat.baseQuantity, 5.61)
);
check(
  "Fixture A waste once on opening raw",
  aOpeningMat != null && near(aOpeningMat.purchaseQuantity, 6.17, 0.011)
);
check(
  "Fixture A combined 90×45 is base+opening wasted once",
  aBaseMat != null &&
    aOpeningMat != null &&
    near(aBaseMat.purchaseQuantity + aOpeningMat.purchaseQuantity, (98.4 + 5.61) * 1.1, 0.02)
);
check(
  "Fixture A opening labour Pricing Required",
  labs(aCalc).some(
    (row) =>
      row.componentKey === INTERNAL_WALLS_OPENING_FORM_LABOUR_COMPONENT &&
      row.priced === false
  )
);
check("Fixture A no door money", !hasDoorMoney(aCalc));
check("Fixture A no legacy package", !isLegacyPackage(aCalc));
check(
  "Fixture A door leaf disclosure",
  aCalc.assumptions.some((row) => /door leaf/i.test(row))
);
check(
  "Fixture A does not reduce lining labour sheets",
  aLining.ok && aLining.installedSheets === 10
);

console.log("\n--- Fixture B multiple openings ---\n");
let bFacts = writeWall("w1", [
  { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
  { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
  { key: "internal_walls.wall_type.frame_size", value: "90 mm timber framing — 90×45" },
  { key: "internal_walls.wall_type.length_lm", value: 8 },
  { key: "internal_walls.wall_type.height_m", value: 3 },
  { key: "internal_walls.wall_type.stud_centres_mm", value: "400 mm" },
  { key: "internal_walls.wall_type.side_a_product", value: "Standard GIB" },
  { key: "internal_walls.wall_type.same_lining_both_sides", value: true },
  { key: INTERNAL_WALLS_HAS_OPENINGS_KEY, value: "Yes" },
]);
const bTypeId = resolveInternalWallsWallTypes({ facts: bFacts, workAreaId: "w1" }).types[0]!.id;
const bOp1 = resolveInternalWallsWallTypes({ facts: bFacts, workAreaId: "w1" }).types[0]!.openings[0]!.id;
bFacts = applyInternalWallsFactWrite({
  facts: bFacts,
  workAreaId: "w1",
  key: INTERNAL_WALLS_ADD_OPENING_KEY,
  value: true,
  wallTypeId: bTypeId,
});
const bOps = resolveInternalWallsWallTypes({ facts: bFacts, workAreaId: "w1" }).types[0]!.openings;
const bOp2 = bOps.find((row) => row.id !== bOp1)!.id;
bFacts = applyInternalWallsFactWrite({
  facts: bFacts, workAreaId: "w1", key: "internal_walls.opening.type", value: "Door opening", wallTypeId: bTypeId, openingId: bOp1,
});
bFacts = applyInternalWallsFactWrite({
  facts: bFacts, workAreaId: "w1", key: "internal_walls.opening.width_m", value: 0.81, wallTypeId: bTypeId, openingId: bOp1,
});
bFacts = applyInternalWallsFactWrite({
  facts: bFacts, workAreaId: "w1", key: "internal_walls.opening.height_m", value: 2.1, wallTypeId: bTypeId, openingId: bOp1,
});
bFacts = applyInternalWallsFactWrite({
  facts: bFacts, workAreaId: "w1", key: "internal_walls.opening.type", value: "Door opening", wallTypeId: bTypeId, openingId: bOp2,
});
bFacts = applyInternalWallsFactWrite({
  facts: bFacts, workAreaId: "w1", key: "internal_walls.opening.width_m", value: 0.91, wallTypeId: bTypeId, openingId: bOp2,
});
bFacts = applyInternalWallsFactWrite({
  facts: bFacts, workAreaId: "w1", key: "internal_walls.opening.height_m", value: 2.1, wallTypeId: bTypeId, openingId: bOp2,
});
bFacts = [fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "new_partition"), ...bFacts.filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY)];
const bSum = 0.81 * 2.1 + 0.91 * 2.1;
check("Fixture B opening sum 3.612", near(bSum, 3.612));
const bCalc = calculateInternalWalls(ctx([walls], bFacts), walls);
const bOpeningMats = mats(bCalc).filter(
  (row) => row.componentKey === INTERNAL_WALLS_OPENING_FRAMING_90_MATERIAL_COMPONENT
);
check("Fixture B independent opening framing", bOpeningMats.length === 2);
check(
  "Fixture B each opening has own variant",
  bOpeningMats[0]!.variantKey !== bOpeningMats[1]!.variantKey
);
check("Fixture B no door money", !hasDoorMoney(bCalc));

console.log("\n--- Fixture C one-side lining ---\n");
let cFacts = writeWall("w1", [
  { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
  { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
  { key: "internal_walls.wall_type.frame_size", value: "90 mm timber framing — 90×45" },
  { key: "internal_walls.wall_type.length_lm", value: 5 },
  { key: "internal_walls.wall_type.height_m", value: 2.7 },
  { key: "internal_walls.wall_type.stud_centres_mm", value: "400 mm" },
  { key: "internal_walls.wall_type.side_a_product", value: "Standard GIB" },
  { key: "internal_walls.wall_type.same_lining_both_sides", value: "No" },
  { key: INTERNAL_WALLS_HAS_OPENINGS_KEY, value: "Yes" },
]);
const cType = resolveInternalWallsWallTypes({ facts: cFacts, workAreaId: "w1" }).types[0]!;
cFacts = applyInternalWallsFactWrite({
  facts: cFacts, workAreaId: "w1", key: "internal_walls.opening.width_m", value: 1, wallTypeId: cType.id, openingId: cType.openings[0]!.id,
});
cFacts = applyInternalWallsFactWrite({
  facts: cFacts, workAreaId: "w1", key: "internal_walls.opening.height_m", value: 2.1, wallTypeId: cType.id, openingId: cType.openings[0]!.id,
});
cFacts = [fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "new_partition"), ...cFacts.filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY)];
const cCalc = calculateInternalWalls(ctx([walls], cFacts), walls);
const cLiningMats = mats(cCalc).filter((row) =>
  (row.componentKey ?? "").includes(".lining.") && row.componentKey?.endsWith(".material")
);
check(
  "Fixture C only Side A lining",
  cLiningMats.length === 1 && (cLiningMats[0]!.variantKey ?? "").endsWith("side_a")
);
const cTakeoff = internalWallsLiningFaceTakeoff({
  type: { length_lm: 5, height_m: 2.7 },
  face: face({ product: "standard_gib", sheet_length_mm: 2700 }),
  side: "side_a",
  wasteFactor: 0.1,
  hoursPerSheet: null,
  openingDeductionM2: 2.1,
});
check("Fixture C net 11.4", cTakeoff.ok && near(cTakeoff.netFaceAreaM2, 11.4));

console.log("\n--- Fixture D form opening ---\n");
let dFacts = writeWall("w1", [
  { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
  { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
  { key: "internal_walls.wall_type.frame_size", value: "90 mm timber framing — 90×45" },
  { key: "internal_walls.wall_type.height_m", value: 2.4 },
  { key: "internal_walls.wall_type.side_a_product", value: "Standard GIB" },
  { key: "internal_walls.wall_type.same_lining_both_sides", value: true },
  { key: INTERNAL_WALLS_HAS_OPENINGS_KEY, value: "Yes" },
]);
const dType = resolveInternalWallsWallTypes({ facts: dFacts, workAreaId: "w1" }).types[0]!;
dFacts = applyInternalWallsFactWrite({
  facts: dFacts, workAreaId: "w1", key: "internal_walls.opening.type", value: "Door opening", wallTypeId: dType.id, openingId: dType.openings[0]!.id,
});
dFacts = applyInternalWallsFactWrite({
  facts: dFacts, workAreaId: "w1", key: "internal_walls.opening.width_m", value: 0.91, wallTypeId: dType.id, openingId: dType.openings[0]!.id,
});
dFacts = applyInternalWallsFactWrite({
  facts: dFacts, workAreaId: "w1", key: "internal_walls.opening.height_m", value: 2.1, wallTypeId: dType.id, openingId: dType.openings[0]!.id,
});
dFacts = [
  fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "form_opening"),
  fact(INTERNAL_WALLS_STRUCTURAL_FACT_KEY, "w1", "No"),
  ...dFacts.filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
];
const dCalc = calculateInternalWalls(ctx([walls], dFacts), walls);
check(
  "Fixture D no full-wall timber package",
  !mats(dCalc).some((row) => row.componentKey === INTERNAL_WALLS_FRAMING_90_MATERIAL_COMPONENT)
);
check(
  "Fixture D local opening framing",
  mats(dCalc).some((row) => row.componentKey === INTERNAL_WALLS_OPENING_FRAMING_90_MATERIAL_COMPONENT)
);
check("Fixture D no door money", !hasDoorMoney(dCalc));

console.log("\n--- Fixture E structural Not sure ---\n");
const eFacts = [
  fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "form_opening"),
  fact(INTERNAL_WALLS_STRUCTURAL_FACT_KEY, "w1", "Not sure"),
  ...dFacts.filter(
    (row) =>
      row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY &&
      row.key !== INTERNAL_WALLS_STRUCTURAL_FACT_KEY
  ),
];
const eCalc = calculateInternalWalls(ctx([walls], eFacts), walls);
check(
  "Fixture E INFO_REQUIRED specialist",
  eCalc.missingInfo.includes(STRUCTURAL_MSG) && eCalc.lineItems.length === 0
);

console.log("\n--- Fixture F infill ---\n");
let fFacts = writeWall("w1", [
  { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
  { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
  { key: "internal_walls.wall_type.frame_size", value: "90 mm timber framing — 90×45" },
  { key: "internal_walls.wall_type.stud_centres_mm", value: "600 mm" },
  { key: "internal_walls.wall_type.side_a_product", value: "Standard GIB" },
  { key: "internal_walls.wall_type.same_lining_both_sides", value: true },
  { key: INTERNAL_WALLS_HAS_OPENINGS_KEY, value: "Yes" },
]);
const fType = resolveInternalWallsWallTypes({ facts: fFacts, workAreaId: "w1" }).types[0]!;
fFacts = applyInternalWallsFactWrite({
  facts: fFacts, workAreaId: "w1", key: "internal_walls.opening.width_m", value: 0.91, wallTypeId: fType.id, openingId: fType.openings[0]!.id,
});
fFacts = applyInternalWallsFactWrite({
  facts: fFacts, workAreaId: "w1", key: "internal_walls.opening.height_m", value: 2.1, wallTypeId: fType.id, openingId: fType.openings[0]!.id,
});
fFacts = [
  fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "infill_opening"),
  fact(INTERNAL_WALLS_STRUCTURAL_FACT_KEY, "w1", "No"),
  ...fFacts.filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
];
const fCalc = calculateInternalWalls(ctx([walls], fFacts), walls);
const fBase = mats(fCalc).find(
  (row) => row.componentKey === INTERNAL_WALLS_FRAMING_90_MATERIAL_COMPONENT
);
check("Fixture F local infill framing exists", fBase != null);
check(
  "Fixture F is not a 12 m wall",
  fBase != null && (fBase.baseQuantity ?? 0) < 40
);
const fLining = internalWallsLiningFaceTakeoff({
  type: { length_lm: 0.91, height_m: 2.1 },
  face: face({ product: "standard_gib" }),
  side: "side_a",
  wasteFactor: 0.1,
  hoursPerSheet: null,
  openingDeductionM2: 0,
});
check(
  "Fixture F no opening deduction on infill",
  fLining.ok && near(fLining.netFaceAreaM2, 0.91 * 2.1) && fLining.openingDeductionM2 === 0
);
check("Fixture F no door money", !hasDoorMoney(fCalc));

console.log("\n--- Nested persist ---\n");
let nFacts = writeWall("w1", [
  { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
  { key: "internal_walls.wall_type.length_lm", value: 12 },
  { key: INTERNAL_WALLS_HAS_OPENINGS_KEY, value: "Yes" },
]);
const nType = resolveInternalWallsWallTypes({ facts: nFacts, workAreaId: "w1" }).types[0]!;
const nOpA = nType.openings[0]!.id;
nFacts = applyInternalWallsFactWrite({
  facts: nFacts, workAreaId: "w1", key: INTERNAL_WALLS_ADD_OPENING_KEY, value: true, wallTypeId: nType.id,
});
const nOpB = resolveInternalWallsWallTypes({ facts: nFacts, workAreaId: "w1" }).types[0]!.openings.find((row) => row.id !== nOpA)!.id;
nFacts = applyInternalWallsFactWrite({
  facts: nFacts, workAreaId: "w1", key: "internal_walls.opening.width_m", value: 0.81, wallTypeId: nType.id, openingId: nOpA,
});
nFacts = applyInternalWallsFactWrite({
  facts: nFacts, workAreaId: "w1", key: "internal_walls.opening.width_m", value: 0.91, wallTypeId: nType.id, openingId: nOpB,
});
nFacts = applyInternalWallsFactWrite({
  facts: nFacts, workAreaId: "w1", key: "internal_walls.wall_type.length_lm", value: 10, wallTypeId: nType.id,
});
const nNext = resolveInternalWallsWallTypes({ facts: nFacts, workAreaId: "w1" }).types[0]!;
check(
  "editing B does not overwrite A",
  nNext.openings.find((row) => row.id === nOpA)?.width_m === 0.81 &&
    nNext.openings.find((row) => row.id === nOpB)?.width_m === 0.91
);
check("opening write does not drop wall length", nNext.length_lm === 10);
nFacts = applyInternalWallsFactWrite({
  facts: nFacts, workAreaId: "w1", key: INTERNAL_WALLS_DELETE_OPENING_KEY, value: nOpA, wallTypeId: nType.id,
});
const nAfterDelete = resolveInternalWallsWallTypes({ facts: nFacts, workAreaId: "w1" }).types[0]!;
check(
  "delete A keeps B",
  nAfterDelete.openings.length === 1 && nAfterDelete.openings[0]!.id === nOpB
);

console.log("\n--- Steel opening / labour / formulas ---\n");
const timberFormula = internalWallsTimberOpeningTakeoff({
  opening: { id: "x", type: "door", width_m: 0.81, height_m: 1.98, label: null },
  trimmerHeightM: 2.4,
  wasteFactor: 0.1,
});
check("trimmer rule is 2 full-height studs", timberFormula?.trimmerStudCount === 2 && near(timberFormula.trimmerLm, 4.8));
check("header is opening width", timberFormula != null && near(timberFormula.headerLm, 0.81));
check("cripples deferred", timberFormula?.crippleLm === 0);
check(
  "steel opening decision is additive track/stud",
  read("lib/estimate/internal-walls-openings.ts").includes("2 extra full-height jamb studs")
);
check(
  "exceeds wall copy exists",
  INTERNAL_WALLS_OPENING_EXCEEDS_WALL_MESSAGE.includes("larger than the wall")
);

let sFacts = writeWall("w1", [
  { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
  { key: "internal_walls.wall_type.frame_system", value: "Steel framing" },
  { key: "internal_walls.wall_type.length_lm", value: 12 },
  { key: "internal_walls.wall_type.height_m", value: 2.4 },
  { key: "internal_walls.wall_type.stud_centres_mm", value: "600 mm" },
  { key: INTERNAL_WALLS_HAS_OPENINGS_KEY, value: "Yes" },
]);
const sType = resolveInternalWallsWallTypes({ facts: sFacts, workAreaId: "w1" }).types[0]!;
sFacts = applyInternalWallsFactWrite({
  facts: sFacts, workAreaId: "w1", key: "internal_walls.opening.width_m", value: 0.81, wallTypeId: sType.id, openingId: sType.openings[0]!.id,
});
sFacts = applyInternalWallsFactWrite({
  facts: sFacts, workAreaId: "w1", key: "internal_walls.opening.height_m", value: 1.98, wallTypeId: sType.id, openingId: sType.openings[0]!.id,
});
sFacts = [fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "new_partition"), ...sFacts.filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY)];
const sCalc = calculateInternalWalls(ctx([walls], sFacts), walls);
check(
  "steel opening does not emit timber",
  !mats(sCalc).some((row) => row.materialKey === INTERNAL_WALLS_TIMBER_90_KEY && (row.variantKey ?? "").includes(sType.openings[0]!.id))
);
check(
  "steel opening emits jambs/head track",
  mats(sCalc).some((row) => (row.componentKey ?? "").includes("opening.framing.steel"))
);

console.log("\n--- Review / mobile / Doors boundary ---\n");
const review = composeBuilderReview({
  estimate: {
    recommendedCost: aCalc.lineItems.reduce((sum, item) => sum + (item.recommendedCost ?? 0), 0),
    recommendedSell: aCalc.lineItems.reduce((sum, item) => sum + (item.recommendedSell ?? 0), 0),
    marginPercent: 20,
    confidence: aCalc.confidence,
    assumptions: aCalc.assumptions,
    missingInfo: aCalc.missingInfo,
    lineItems: mapCalcLines(aCalc.lineItems),
  },
  workAreas: [{ id: "w1", type: "internal_walls", name: "Internal walls", status: "confirmed" }],
  requirements: aCalc.requirements ?? [],
});
const reviewText = JSON.stringify(review);
check(
  "Review shows gross / deduction / net",
  /gross/.test(reviewText) && /opening deduction/.test(reviewText) && /net/.test(reviewText)
);
check(
  "Review opening labour Pricing Required",
  /Opening labour/.test(reviewText) || /opening labour/.test(reviewText.toLowerCase())
);
check(
  "Doors calculator still defaults to 3 internally and is not invoked by IW",
  read("lib/estimate/calculators/fitout.ts").includes("effectiveCount = count ?? 3") &&
    read("lib/estimate/calculators/fitout.ts").includes("must not inherit this default-3 lump")
);
check(
  "mobile opening cards exist",
  read("components/assistant/refine/InternalWallsWallTypesPanel.tsx").includes("data-add-opening") &&
    read("components/assistant/refine/InternalWallsWallTypesPanel.tsx").includes("data-opening-card")
);
check(
  "review surface wraps opening details",
  read("components/assistant/builder-review/BuilderReviewSurface.tsx").includes("Opening details") &&
    read("components/assistant/builder-review/BuilderReviewSurface.tsx").includes("overflow-x-hidden")
);

console.log("\n--- Hosted policy / migrations ---\n");
check(
  "canonical Preview host",
  PREVIEW_AUTH_SITE_ORIGIN_STABLE.includes("hardening-stage-2a-security")
);
check("Preview ref recorded", PREVIEW_SUPABASE_PROJECT_REF === "shhpjsoldmqtkdbgrbtm");
check("plus-address fixture allowed", isPlusAddressFixture("hello+wa-iw-06@example.invalid"));
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
  "architecture records openings",
  read("docs/architecture/QUOTR_INTERNAL_WALLS_ESTIMATING_ARCHITECTURE.md").includes("WA-INTERNAL-WALLS-06") &&
    read("docs/architecture/QUOTR_INTERNAL_WALLS_ESTIMATING_ARCHITECTURE.md").includes("trimmer_stud_count = 2")
);
check("IW-03 stud formula unchanged", read("lib/estimate/internal-walls-framing.ts").includes("ceil(lengthLm / spacingM - 1e-12) + 1"));
check(
  "IW-05 sheet width unchanged",
  read("lib/estimate/internal-walls-lining.ts").includes("lengthLm / sheetWidthM")
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
