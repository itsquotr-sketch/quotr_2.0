/**
 * WA-INTERNAL-WALLS-07 — insulation + skirting + cornice + electrical.
 *
 * Run: npx --yes tsx scripts/verify-work-area-internal-walls-07.ts
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
  isMatureInternalWallsPath,
  shouldHideInternalWallsQuestion,
} from "../lib/estimate/internal-walls-scope";
import {
  INTERNAL_WALLS_ADD_WALL_TYPE_KEY,
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
  INTERNAL_WALLS_SKIRTING_SIDES_KEY,
  corniceTakeoff,
  insulationAreaForWallType,
  insulationNetAreaM2,
  skirtingTakeoff,
} from "../lib/estimate/internal-walls-finish";
import {
  INTERNAL_WALLS_CORNICE_LABOUR_COMPONENT,
  INTERNAL_WALLS_ELECTRICAL_ALLOWANCE_COMPONENT,
  INTERNAL_WALLS_FRAMING_90_MATERIAL_COMPONENT,
  INTERNAL_WALLS_INSULATION_LABOUR_COMPONENT,
  INTERNAL_WALLS_INSULATION_MATERIAL_COMPONENT,
  INTERNAL_WALLS_SKIRTING_LABOUR_COMPONENT,
  INTERNAL_WALLS_SKIRTING_MATERIAL_COMPONENT,
  internalWallsLiningMaterialComponent,
} from "../lib/estimate/internal-walls-identities";
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
import type { LabourRequirement, MaterialRequirement, SubcontractRequirement } from "../lib/estimate/requirements";
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
  facts: EstimateFact[]
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
      (row.quantity === 20 && /internal wall/i.test(row.label))
  );
}

const walls = wa("w1", "internal_walls", "Internal walls");

function fixtureWall(extra: Array<{ key: string; value: unknown }>): EstimateFact[] {
  let facts = writeWall("w1", [
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
  const type = resolveInternalWallsWallTypes({ facts, workAreaId: "w1" }).types[0]!;
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

console.log("=== WA-INTERNAL-WALLS-07 ===\n");

console.log("--- Quantities ---\n");
check(
  "insulation net 12×2.4 minus 0.81×1.98 = 27.1962",
  near(
    insulationNetAreaM2({
      lengthLm: 12,
      heightM: 2.4,
      openings: [{ id: "o1", type: "door", width_m: 0.81, height_m: 1.98, label: null }],
      deductOpenings: true,
    }),
    27.1962
  )
);
check(
  "insulation is once — not × two faces",
  near(12 * 2.4 - 0.81 * 1.98, 27.1962)
);

console.log("\n--- Fixture A insulation ---\n");
const aFacts = fixtureWall([
  { key: INTERNAL_WALLS_INSULATION_INCLUDED_KEY, value: "Yes" },
  { key: INTERNAL_WALLS_INSULATION_TYPE_KEY, value: "Acoustic" },
]);
check("Fixture A mature", isMatureInternalWallsPath({ facts: aFacts, workAreaId: "w1" }));
const aType = resolveInternalWallsWallTypes({ facts: aFacts, workAreaId: "w1" }).types[0]!;
const aArea = insulationAreaForWallType({ type: aType, jobScope: "new_partition" });
check("Fixture A 27.1962 m²", aArea.ok && near(aArea.areaM2, 27.1962));
const aCalc = calculateInternalWalls(ctx([walls], aFacts), walls);
const aInsMat = mats(aCalc).find(
  (row) => row.componentKey === INTERNAL_WALLS_INSULATION_MATERIAL_COMPONENT
);
const aInsLab = labs(aCalc).find(
  (row) => row.componentKey === INTERNAL_WALLS_INSULATION_LABOUR_COMPONENT
);
check(
  "Fixture A insulation material quantity",
  aInsMat != null && near(aInsMat.baseQuantity, 27.1962) && aInsMat.priced === false
);
check(
  "Fixture A insulation labour Pricing Required",
  aInsLab != null && aInsLab.priced === false
);
check("Fixture A no legacy package", !isLegacyPackage(aCalc));
check(
  "Fixture A uses shared insulation identity",
  aInsMat?.materialKey === "insulation.wall.acoustic.m2"
);

console.log("\n--- Fixture B skirting ---\n");
const bFacts = fixtureWall([
  { key: INTERNAL_WALLS_SKIRTING_SIDES_KEY, value: "Both sides" },
]);
const bType = resolveInternalWallsWallTypes({ facts: bFacts, workAreaId: "w1" }).types[0]!;
const bSkirt = skirtingTakeoff({ type: bType, jobScope: "new_partition" });
check("Fixture B Side A 11.19 lm", bSkirt != null && near(bSkirt.sideALm, 11.19));
check("Fixture B Side B 11.19 lm", bSkirt != null && near(bSkirt.sideBLm, 11.19));
check("Fixture B total 22.38 lm", bSkirt != null && near(bSkirt.totalLm, 22.38));
const bCalc = calculateInternalWalls(ctx([walls], bFacts), walls);
const bSkirtMats = mats(bCalc).filter(
  (row) => row.componentKey === INTERNAL_WALLS_SKIRTING_MATERIAL_COMPONENT
);
check("Fixture B two face requirements", bSkirtMats.length === 2);
check(
  "Fixture B skirting labour PR",
  labs(bCalc).some(
    (row) => row.componentKey === INTERNAL_WALLS_SKIRTING_LABOUR_COMPONENT && row.priced === false
  )
);

console.log("\n--- Fixture C cornice ---\n");
const cFacts = fixtureWall([
  { key: INTERNAL_WALLS_CORNICE_SIDES_KEY, value: "Both sides" },
]);
const cType = resolveInternalWallsWallTypes({ facts: cFacts, workAreaId: "w1" }).types[0]!;
const cCornice = corniceTakeoff({ type: cType, jobScope: "new_partition" });
check("Fixture C 12 lm each side", cCornice != null && near(cCornice.sideALm, 12) && near(cCornice.sideBLm, 12));
check("Fixture C total 24 lm", cCornice != null && near(cCornice.totalLm, 24));
const cCalc = calculateInternalWalls(ctx([walls], cFacts), walls);
check(
  "Fixture C cornice labour PR",
  labs(cCalc).some(
    (row) => row.componentKey === INTERNAL_WALLS_CORNICE_LABOUR_COMPONENT && row.priced === false
  )
);

console.log("\n--- Full-height opening deducts cornice ---\n");
let tallFacts = fixtureWall([]);
const tallTypeId = resolveInternalWallsWallTypes({ facts: tallFacts, workAreaId: "w1" }).types[0]!;
tallFacts = applyInternalWallsFactWrite({
  facts: tallFacts,
  workAreaId: "w1",
  key: "internal_walls.opening.height_m",
  value: 2.4,
  wallTypeId: tallTypeId.id,
  openingId: tallTypeId.openings[0]!.id,
});
tallFacts = applyInternalWallsFactWrite({
  facts: tallFacts,
  workAreaId: "w1",
  key: INTERNAL_WALLS_CORNICE_SIDES_KEY,
  value: "Side A",
  wallTypeId: tallTypeId.id,
});
const tallResolved = resolveInternalWallsWallTypes({ facts: tallFacts, workAreaId: "w1" }).types[0]!;
const tallCornice = corniceTakeoff({ type: tallResolved, jobScope: "new_partition" });
check(
  "full-height opening deducts cornice width",
  tallCornice != null && near(tallCornice.sideALm, 11.19)
);

console.log("\n--- Fixture D electrical ---\n");
const dFacts = fixtureWall([
  { key: INTERNAL_WALLS_ELECTRICAL_KEY, value: "Standard" },
]);
const dCalc = calculateInternalWalls(ctx([walls], dFacts), walls);
const dElec = subs(dCalc).filter(
  (row) => row.componentKey === INTERNAL_WALLS_ELECTRICAL_ALLOWANCE_COMPONENT
);
check("Fixture D one Standard allowance", dElec.length === 1 && dElec[0]!.priced === false);
check(
  "Fixture D no socket/cable takeoff",
  !dCalc.lineItems.some((row) => /socket|cable|switchboard|gpo/i.test(row.label))
);
check(
  "Fixture D does not reuse bathroom electrical $",
  !dCalc.lineItems.some((row) => (row.itemKey ?? "").startsWith("bathroom.electrical")) &&
    dCalc.lineItems.some((row) =>
      (row.itemKey ?? "") === "internal_walls.electrical.standard.allowance"
    )
);

console.log("\n--- Fixture E infill ---\n");
let eFacts = writeWall("w1", [
  { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
  { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
  { key: "internal_walls.wall_type.frame_size", value: "90 mm timber framing — 90×45" },
  { key: "internal_walls.wall_type.stud_centres_mm", value: "600 mm" },
  { key: "internal_walls.wall_type.side_a_product", value: "Standard GIB" },
  { key: "internal_walls.wall_type.same_lining_both_sides", value: true },
  { key: INTERNAL_WALLS_HAS_OPENINGS_KEY, value: "Yes" },
]);
const eType = resolveInternalWallsWallTypes({ facts: eFacts, workAreaId: "w1" }).types[0]!;
eFacts = applyInternalWallsFactWrite({
  facts: eFacts, workAreaId: "w1", key: "internal_walls.opening.width_m", value: 0.91, wallTypeId: eType.id, openingId: eType.openings[0]!.id,
});
eFacts = applyInternalWallsFactWrite({
  facts: eFacts, workAreaId: "w1", key: "internal_walls.opening.height_m", value: 2.1, wallTypeId: eType.id, openingId: eType.openings[0]!.id,
});
eFacts = applyInternalWallsFactWrite({
  facts: eFacts, workAreaId: "w1", key: INTERNAL_WALLS_INSULATION_INCLUDED_KEY, value: "Yes", wallTypeId: eType.id,
});
eFacts = applyInternalWallsFactWrite({
  facts: eFacts, workAreaId: "w1", key: INTERNAL_WALLS_INSULATION_TYPE_KEY, value: "Acoustic", wallTypeId: eType.id,
});
eFacts = [
  fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "infill_opening"),
  fact("internal_walls.structural_involvement", "w1", "No"),
  ...eFacts.filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
];
const eResolved = resolveInternalWallsWallTypes({ facts: eFacts, workAreaId: "w1" }).types[0]!;
const eArea = insulationAreaForWallType({ type: eResolved, jobScope: "infill_opening" });
check("Fixture E insulation 1.911 m²", eArea.ok && near(eArea.areaM2, 1.911));
const eCalc = calculateInternalWalls(ctx([walls], eFacts), walls);
const eIns = mats(eCalc).find(
  (row) => row.componentKey === INTERNAL_WALLS_INSULATION_MATERIAL_COMPONENT
);
check("Fixture E insulation quantity", eIns != null && near(eIns.baseQuantity, 1.911));
check(
  "Fixture E no skirting unless selected",
  !mats(eCalc).some((row) => row.componentKey === INTERNAL_WALLS_SKIRTING_MATERIAL_COMPONENT)
);

console.log("\n--- Independent sides / no framing impact ---\n");
const sideFacts = fixtureWall([
  { key: INTERNAL_WALLS_SKIRTING_SIDES_KEY, value: "Side A" },
  { key: INTERNAL_WALLS_CORNICE_SIDES_KEY, value: "Side B" },
]);
const sideType = resolveInternalWallsWallTypes({ facts: sideFacts, workAreaId: "w1" }).types[0]!;
const sideSkirt = skirtingTakeoff({ type: sideType, jobScope: "new_partition" });
const sideCornice = corniceTakeoff({ type: sideType, jobScope: "new_partition" });
check("Side A skirting only", sideSkirt != null && sideSkirt.sideALm != null && sideSkirt.sideBLm == null);
check("Side B cornice only", sideCornice != null && sideCornice.sideBLm != null && sideCornice.sideALm == null);

const baseFacts = fixtureWall([]);
const baseCalc = calculateInternalWalls(ctx([walls], baseFacts), walls);
const withFinishCalc = calculateInternalWalls(ctx([walls], aFacts), walls);
const baseTimber = mats(baseCalc).find(
  (row) => row.componentKey === INTERNAL_WALLS_FRAMING_90_MATERIAL_COMPONENT
);
const finishTimber = mats(withFinishCalc).find(
  (row) => row.componentKey === INTERNAL_WALLS_FRAMING_90_MATERIAL_COMPONENT
);
const liningKey = internalWallsLiningMaterialComponent("standard_gib");
const baseLining = mats(baseCalc).find((row) => row.componentKey === liningKey);
const finishLining = mats(withFinishCalc).find((row) => row.componentKey === liningKey);
check(
  "insulation does not change timber quantity",
  baseTimber != null && finishTimber != null && near(baseTimber.baseQuantity, finishTimber.baseQuantity)
);
check(
  "insulation does not change lining purchase sheets",
  baseLining != null &&
    finishLining != null &&
    near(baseLining.purchaseQuantity, finishLining.purchaseQuantity)
);

console.log("\n--- Questions / review / waste ---\n");
const skirtingQ = internalWallsScope.questions.find(
  (row) => row.factKey === INTERNAL_WALLS_SKIRTING_SIDES_KEY
);
const corniceQ = internalWallsScope.questions.find(
  (row) => row.factKey === INTERNAL_WALLS_CORNICE_SIDES_KEY
);
const electricalQ = internalWallsScope.questions.find(
  (row) => row.factKey === INTERNAL_WALLS_ELECTRICAL_KEY
);
check("skirting is select SINGLE_SELECT", skirtingQ?.inputType === "select" && skirtingQ.options?.includes("Both sides") === true);
check("cornice is select SINGLE_SELECT", corniceQ?.inputType === "select");
check("electrical is select SINGLE_SELECT", electricalQ?.inputType === "select" && electricalQ.options?.includes("Standard") === true);
check(
  "no insulation waste invented",
  read("lib/estimate/internal-walls-finish.ts").includes("Do not invent a percent")
);
check(
  "IW-03 stud formula unchanged",
  read("lib/estimate/internal-walls-framing.ts").includes("ceil(lengthLm / spacingM - 1e-12) + 1")
);
check(
  "IW-05 sheet width unchanged",
  read("lib/estimate/internal-walls-lining.ts").includes("lengthLm / sheetWidthM")
);

const nextAfterOpenings = nextInternalWallsWallTypeField({
  type: resolveInternalWallsWallTypes({ facts: baseFacts, workAreaId: "w1" }).types[0]!,
  jobScope: "new_partition",
});
check(
  "progressive next is insulation after openings",
  nextAfterOpenings === INTERNAL_WALLS_INSULATION_INCLUDED_KEY
);
check(
  "form_opening hides insulation include",
  shouldHideInternalWallsQuestion({
    factKey: INTERNAL_WALLS_INSULATION_INCLUDED_KEY,
    jobScope: "form_opening",
    mature: true,
    nextWallTypeField: INTERNAL_WALLS_SKIRTING_SIDES_KEY,
    structuralApplies: true,
  })
);

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
  "Review groups insulation",
  /Insulation/i.test(reviewText)
);
check(
  "mobile cards wrap finish line",
  read("components/assistant/refine/InternalWallsWallTypesPanel.tsx").includes("finishLine")
);

console.log("\n--- Hosted policy / migrations ---\n");
check(
  "canonical Preview host",
  PREVIEW_AUTH_SITE_ORIGIN_STABLE.includes("hardening-stage-2a-security")
);
check("Preview ref recorded", PREVIEW_SUPABASE_PROJECT_REF === "shhpjsoldmqtkdbgrbtm");
check("plus-address fixture allowed", isPlusAddressFixture("hello+wa-iw-07@example.invalid"));
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
  "architecture records IW-07",
  read("docs/architecture/QUOTR_INTERNAL_WALLS_ESTIMATING_ARCHITECTURE.md").includes("WA-INTERNAL-WALLS-07") &&
    read("docs/architecture/QUOTR_INTERNAL_WALLS_ESTIMATING_ARCHITECTURE.md").includes("27.1962")
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
