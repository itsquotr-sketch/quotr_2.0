/**
 * WA-INTERNAL-WALLS-02C — nested Wall Type persist + sheet length UX.
 *
 * Run: npx --yes tsx scripts/verify-work-area-internal-walls-02c.ts
 *
 * No paid AI. No Production. No migration 055.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { composeRefineView } from "../lib/assistant/refine/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import {
  appendJobPlanFactOverlay,
  overlayFact,
} from "../lib/assistant/job-plan/facts";
import { INTERNAL_WALLS_COLLECTION_WRITE_MAX_ATTEMPTS } from "../lib/assistant/scope-persistence";
import { calculateInternalWalls } from "../lib/estimate/calculators/fitout";
import {
  INTERNAL_WALLS_ACTIVE_WALL_TYPE_ID_FACT_KEY,
  INTERNAL_WALLS_ADD_WALL_TYPE_KEY,
  INTERNAL_WALLS_DELETE_WALL_TYPE_KEY,
  INTERNAL_WALLS_DUPLICATE_WALL_TYPE_KEY,
  INTERNAL_WALLS_SHEET_LENGTH_OPTIONS,
  INTERNAL_WALLS_TAKEOFF_NOT_PRICED_STATEMENT,
  INTERNAL_WALLS_WALL_TYPES_FACT_KEY,
  applyInternalWallsFactWrite,
  createEmptyWallType,
  duplicateWallType,
  parseInternalWallsCollectionEnvelope,
  parseInternalWallsWallTypes,
  recommendedSheetLengthMm,
  updateWallType,
} from "../lib/estimate/internal-walls-wall-types";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";
import { PREVIEW_SUPABASE_PROJECT_REF } from "../lib/deployment/environment";
import {
  PREVIEW_AUTH_SITE_ORIGIN_STABLE,
  PREVIEW_PASSWORD_PROTECTED_EMAILS,
  assertSafePreviewPasswordMutation,
  isPlusAddressFixture,
} from "./lib/preview-auth-fixture";

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

function numberedMigrations(): string[] {
  return readdirSync(join(process.cwd(), "supabase/migrations"))
    .filter((name) => /^\d+_/.test(name) && name.endsWith(".sql"))
    .sort();
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
    },
    materialWastageSettings: {
      sheet_material: 10,
      flooring: 10,
      paint: 10,
      default: 5,
    },
    rates: [],
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

function typesOf(facts: EstimateFact[], workAreaId = "w1") {
  return parseInternalWallsWallTypes(
    facts.find(
      (row) =>
        row.key === INTERNAL_WALLS_WALL_TYPES_FACT_KEY &&
        row.work_area_id === workAreaId
    )?.value
  );
}

function activeIdOf(facts: EstimateFact[], workAreaId = "w1") {
  const row = facts.find(
    (item) =>
      item.key === INTERNAL_WALLS_ACTIVE_WALL_TYPE_ID_FACT_KEY &&
      item.work_area_id === workAreaId
  );
  return typeof row?.value === "string" ? row.value : null;
}

console.log("=== WA-INTERNAL-WALLS-02C ===\n");

console.log("--- Sheet length recommendation ---\n");
check("2.4 m → 2400", recommendedSheetLengthMm(2.4) === 2400);
check("2.7 m → 2700", recommendedSheetLengthMm(2.7) === 2700);
check("3.0 m → 3000", recommendedSheetLengthMm(3) === 3000);
check("3.2 m → 3600", recommendedSheetLengthMm(3.2) === 3600);
check(
  "generic lengths include 3000",
  INTERNAL_WALLS_SHEET_LENGTH_OPTIONS.includes("3000 mm")
);

console.log("\n--- Canonical patch preserves siblings ---\n");
const two = writeWall("w1", [
  { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
  { key: "internal_walls.wall_type.label", value: "Type A" },
  { key: "internal_walls.wall_type.length_lm", value: 12 },
  { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
  { key: "internal_walls.wall_type.label", value: "Type B" },
  { key: "internal_walls.wall_type.length_lm", value: 8 },
]);
const [typeA, typeB] = typesOf(two);
check("two stable ids", Boolean(typeA?.id && typeB?.id && typeA.id !== typeB.id));
const patchedB = updateWallType(typesOf(two), typeB!.id, (row) => {
  row.length_lm = 9;
});
check(
  "updateWallType patches only the target",
  patchedB[0]!.length_lm === 12 && patchedB[1]!.length_lm === 9
);
check(
  "updateWallType unknown id is a no-op",
  updateWallType(typesOf(two), "missing", (row) => {
    row.length_lm = 1;
  })[0]!.length_lm === 12
);

console.log("\n--- Stale snapshot vs latest-state-wins ---\n");
const beforeLength = two;
const afterLength = applyInternalWallsFactWrite({
  facts: beforeLength,
  workAreaId: "w1",
  key: "internal_walls.wall_type.length_lm",
  value: 9,
  wallTypeId: typeB!.id,
});
const liningOnStale = applyInternalWallsFactWrite({
  facts: beforeLength,
  workAreaId: "w1",
  key: "internal_walls.wall_type.side_a_product",
  value: "Fyreline",
  wallTypeId: typeB!.id,
});
const liningOnLatest = applyInternalWallsFactWrite({
  facts: afterLength,
  workAreaId: "w1",
  key: "internal_walls.wall_type.side_a_product",
  value: "Fyreline",
  wallTypeId: typeB!.id,
});
const staleB = typesOf(liningOnStale)[1]!;
const latestB = typesOf(liningOnLatest)[1]!;
check(
  "stale lining write would restore length 8",
  staleB.length_lm === 8 && staleB.side_a.product === "fyreline"
);
check(
  "latest-state-wins keeps length 9 and Fyreline",
  latestB.length_lm === 9 && latestB.side_a.product === "fyreline"
);
const layeredThenStaleProduct = applyInternalWallsFactWrite({
  facts: liningOnLatest,
  workAreaId: "w1",
  key: "internal_walls.wall_type.side_a_layers",
  value: "2 layers",
  wallTypeId: typeB!.id,
});
const staleProductRetry = applyInternalWallsFactWrite({
  facts: layeredThenStaleProduct,
  workAreaId: "w1",
  key: "internal_walls.wall_type.side_a_product",
  value: "Fyreline",
  wallTypeId: typeB!.id,
});
check(
  "later product write does not reset layers on latest type",
  typesOf(staleProductRetry)[1]!.side_a.layers === 2 &&
    typesOf(staleProductRetry)[1]!.side_a.product === "fyreline" &&
    typesOf(staleProductRetry)[1]!.length_lm === 9
);
const envelope = parseInternalWallsCollectionEnvelope({
  v: 4,
  types: typesOf(staleProductRetry),
});
check(
  "collection envelope unwraps types and revision",
  envelope.v === 4 &&
    envelope.types.length === 2 &&
    envelope.types[1]!.side_a.layers === 2
);
const clientId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const addedWithId = applyInternalWallsFactWrite({
  facts: two,
  workAreaId: "w1",
  key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY,
  value: clientId,
});
check(
  "Add uses client UUID when provided",
  typesOf(addedWithId).some((row) => row.id === clientId) &&
    typesOf(addedWithId).length === 3
);
const copyId = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";
const duplicatedWithId = applyInternalWallsFactWrite({
  facts: two,
  workAreaId: "w1",
  key: INTERNAL_WALLS_DUPLICATE_WALL_TYPE_KEY,
  value: typeA!.id,
  wallTypeId: copyId,
});
check(
  "Duplicate uses client UUID when provided",
  typesOf(duplicatedWithId).some((row) => row.id === copyId) &&
    typesOf(duplicatedWithId).length === 3
);
const overlayA = appendJobPlanFactOverlay([], {
  key: "internal_walls.wall_type.length_lm",
  work_area_id: "w1",
  value: 11,
  wallTypeId: typeA!.id,
});
const overlayBoth = appendJobPlanFactOverlay(overlayA, {
  key: "internal_walls.wall_type.length_lm",
  work_area_id: "w1",
  value: 7,
  wallTypeId: typeB!.id,
});
check(
  "overlay keeps sibling Wall Type writes of the same key",
  overlayBoth.length === 2
);
check(
  "Type A unchanged by Type B lining",
  typesOf(liningOnLatest)[0]!.length_lm === 12 &&
    typesOf(liningOnLatest)[0]!.side_a.product == null
);

console.log("\n--- Type B lining / sheet / layers / follow ---\n");
const fire = applyInternalWallsFactWrite({
  facts: liningOnLatest,
  workAreaId: "w1",
  key: "internal_walls.wall_type.height_m",
  value: 3,
  wallTypeId: typeB!.id,
});
const fireLayers = applyInternalWallsFactWrite({
  facts: fire,
  workAreaId: "w1",
  key: "internal_walls.wall_type.side_a_layers",
  value: "2 layers",
  wallTypeId: typeB!.id,
});
const fireBoth = applyInternalWallsFactWrite({
  facts: fireLayers,
  workAreaId: "w1",
  key: "internal_walls.wall_type.same_lining_both_sides",
  value: "Yes",
  wallTypeId: typeB!.id,
});
const fireType = typesOf(fireBoth)[1]!;
check(
  "3.0 m Fyreline recommends 3000 not 2400",
  fireType.side_a.product === "fyreline" &&
    fireType.side_a.sheet_length_mm === 3000 &&
    fireType.side_a.thickness_mm === 13 &&
    fireType.side_a.layers === 2
);
check(
  "Yes clones Side A onto Side B",
  fireType.same_lining_both_sides === true &&
    fireType.side_b.product === "fyreline" &&
    fireType.side_b.layers === 2 &&
    fireType.side_b.sheet_length_mm === 3000
);
const followA = applyInternalWallsFactWrite({
  facts: fireBoth,
  workAreaId: "w1",
  key: "internal_walls.wall_type.side_a_layers",
  value: "1 layer",
  wallTypeId: typeB!.id,
});
check(
  "while Yes, Side B follows later Side A edits",
  typesOf(followA)[1]!.side_a.layers === 1 &&
    typesOf(followA)[1]!.side_b.layers === 1
);
const independent = applyInternalWallsFactWrite({
  facts: followA,
  workAreaId: "w1",
  key: "internal_walls.wall_type.same_lining_both_sides",
  value: "No",
  wallTypeId: typeB!.id,
});
const afterNo = applyInternalWallsFactWrite({
  facts: independent,
  workAreaId: "w1",
  key: "internal_walls.wall_type.side_a_product",
  value: "Standard GIB",
  wallTypeId: typeB!.id,
});
check(
  "No retains copied Side B then allows independent Side A",
  typesOf(afterNo)[1]!.same_lining_both_sides === false &&
    typesOf(afterNo)[1]!.side_b.product === "fyreline" &&
    typesOf(afterNo)[1]!.side_a.product === "standard_gib"
);

console.log("\n--- Geometry / frame / thickness persist model ---\n");
const heightEdit = applyInternalWallsFactWrite({
  facts: fireBoth,
  workAreaId: "w1",
  key: "internal_walls.wall_type.height_m",
  value: 2.7,
  wallTypeId: typeB!.id,
});
check(
  "height 3.0 → 2.7 keeps lining and recommends 400 centres",
  typesOf(heightEdit)[1]!.height_m === 2.7 &&
    typesOf(heightEdit)[1]!.stud_centres_mm === 400 &&
    typesOf(heightEdit)[1]!.side_a.product === "fyreline" &&
    typesOf(heightEdit)[0]!.length_lm === 12
);
const timbered = applyInternalWallsFactWrite({
  facts: heightEdit,
  workAreaId: "w1",
  key: "internal_walls.wall_type.frame_system",
  value: "Timber framing",
  wallTypeId: typeB!.id,
});
const sized90 = applyInternalWallsFactWrite({
  facts: timbered,
  workAreaId: "w1",
  key: "internal_walls.wall_type.frame_size",
  value: "90 mm timber framing — 90×45",
  wallTypeId: typeB!.id,
});
const frameEdit = applyInternalWallsFactWrite({
  facts: sized90,
  workAreaId: "w1",
  key: "internal_walls.wall_type.frame_size",
  value: "140x45",
  wallTypeId: typeB!.id,
});
check(
  "frame 90 → 140 keeps id, geometry, lining",
  typesOf(frameEdit)[1]!.id === typeB!.id &&
    typesOf(frameEdit)[1]!.frame_size === "140x45" &&
    typesOf(frameEdit)[1]!.length_lm === 9 &&
    typesOf(frameEdit)[1]!.side_a.product === "fyreline"
);
const thicknessEdit = applyInternalWallsFactWrite({
  facts: frameEdit,
  workAreaId: "w1",
  key: "internal_walls.wall_type.side_a_thickness_mm",
  value: "16 mm",
  wallTypeId: typeB!.id,
});
check(
  "thickness edit persists",
  typesOf(thicknessEdit)[1]!.side_a.thickness_mm === 16
);

console.log("\n--- Duplicate / delete / active id ---\n");
const duplicated = applyInternalWallsFactWrite({
  facts: two,
  workAreaId: "w1",
  key: INTERNAL_WALLS_DUPLICATE_WALL_TYPE_KEY,
  value: typeA!.id,
});
const dupTypes = typesOf(duplicated);
check("duplicate creates a third UUID", dupTypes.length === 3);
check(
  "duplicate is a deep copy",
  dupTypes[1]!.id !== typeA!.id &&
    dupTypes[1]!.length_lm === 12 &&
    dupTypes[1]!.side_a !== dupTypes[0]!.side_a
);
const sourceMutated = updateWallType(dupTypes, dupTypes[1]!.id, (row) => {
  row.length_lm = 6;
  row.side_a.product = "fyreline";
});
check(
  "duplicate independence",
  sourceMutated[0]!.length_lm === 12 &&
    sourceMutated[0]!.side_a.product == null &&
    sourceMutated[1]!.length_lm === 6
);
const emptyVsCopy = createEmptyWallType();
const copied = duplicateWallType(typeA!);
check(
  "Add vs Duplicate are distinct",
  emptyVsCopy.length_lm == null && copied.length_lm === 12 && copied.id !== typeA!.id
);
const deletedDup = applyInternalWallsFactWrite({
  facts: duplicated,
  workAreaId: "w1",
  key: INTERNAL_WALLS_DELETE_WALL_TYPE_KEY,
  value: dupTypes[1]!.id,
});
const afterDelete = typesOf(deletedDup);
check(
  "delete removes duplicate only",
  afterDelete.length === 2 &&
    afterDelete[0]!.id === typeA!.id &&
    afterDelete[1]!.id === typeB!.id
);
check(
  "active id after delete is remaining",
  activeIdOf(deletedDup) === typeA!.id || activeIdOf(deletedDup) === typeB!.id
);
const deleteActive = applyInternalWallsFactWrite({
  facts: deletedDup,
  workAreaId: "w1",
  key: INTERNAL_WALLS_DELETE_WALL_TYPE_KEY,
  value: activeIdOf(deletedDup),
});
check(
  "active id never points at deleted UUID",
  Boolean(activeIdOf(deleteActive)) &&
    typesOf(deleteActive).some((row) => row.id === activeIdOf(deleteActive))
);
const deleteLast = applyInternalWallsFactWrite({
  facts: deleteActive,
  workAreaId: "w1",
  key: INTERNAL_WALLS_DELETE_WALL_TYPE_KEY,
  value: typesOf(deleteActive)[0]!.id,
});
check(
  "deleting last type clears active id",
  typesOf(deleteLast).length === 0 && activeIdOf(deleteLast) == null
);

console.log("\n--- Overlay logical rows ---\n");
const baseFacts = afterLength;
const overlay = appendJobPlanFactOverlay([], {
  key: "internal_walls.wall_type.side_a_product",
  work_area_id: "w1",
  value: "Fyreline",
  wallTypeId: typeB!.id,
});
check(
  "IW overlay stores the logical write, not a synthetic collection",
  overlay.length === 1 && overlay[0]!.key === "internal_walls.wall_type.side_a_product"
);
let applied = baseFacts;
for (const row of overlay) {
  applied = overlayFact(applied, row);
}
check(
  "logical overlay applied onto latest base keeps length 9",
  typesOf(applied)[1]!.length_lm === 9 &&
    typesOf(applied)[1]!.side_a.product === "fyreline"
);

console.log("\n--- Refine UX ---\n");
const adapterSrc = read("lib/assistant/refine/adapters/internal-walls.ts");
const templateSrc = read("lib/scopes/templates/internal-walls.ts");
const refineSrc = read("components/assistant/clarify/ClarifyReadiness.tsx");
const persistSrc = read("lib/assistant/scope-persistence.ts");
const shellSrc = read("components/assistant/AssistantShell.tsx");
check(
  "same both sides is Yes/No select, not Include/Not included",
  templateSrc.includes("INTERNAL_WALLS_SAME_BOTH_SIDES_OPTIONS") &&
    adapterSrc.includes("INTERNAL_WALLS_SAME_BOTH_SIDES_OPTIONS")
);
check(
  "same-both template is select",
  /same_lining_both_sides[\s\S]{0,220}inputType: "select"/.test(templateSrc)
);
check(
  "sheet length is a Refine high-value select",
  adapterSrc.includes("internal_walls.wall_type.side_a_sheet_length_mm") &&
    adapterSrc.includes("INTERNAL_WALLS_SHEET_LENGTH_OPTIONS")
);
check(
  "CAS persist retries on collection revision",
  persistSrc.includes("value->>v") &&
    persistSrc.includes("v: envelope.v + 1") &&
    persistSrc.includes("INTERNAL_WALLS_COLLECTION_WRITE_MAX_ATTEMPTS") &&
    INTERNAL_WALLS_COLLECTION_WRITE_MAX_ATTEMPTS >= 8
);
check(
  "active id is deleted when cleared",
  persistSrc.includes(".delete()") && persistSrc.includes("activeRow")
);
check(
  "Refine overlays IW writes immediately as logical rows",
  shellSrc.includes("appendJobPlanFactOverlay") &&
    shellSrc.includes("iwWrite")
);
check(
  "boolean Include/Not included still exists for other WAs",
  refineSrc.includes("Include") && refineSrc.includes("Not included")
);

const plan = composeJobPlan({
  workAreas: [
    { id: "w1", type: "internal_walls", name: "Internal walls", status: "confirmed" },
  ],
  facts: fireBoth,
});
const refine = composeRefineView({
  briefText: null,
  qualityLevel: "standard",
  workAreas: [
    { id: "w1", type: "internal_walls", name: "Internal walls", status: "confirmed" },
  ],
  facts: fireBoth,
  constraints: [],
  jobPlan: plan,
});
check(
  "Refine exposes 3000 mm sheet length",
  refine.highValue.some(
    (row) =>
      row.factKey === "internal_walls.wall_type.side_a_sheet_length_mm" &&
      row.options?.includes("3000 mm")
  )
);
check(
  "Refine same both sides is Yes/No",
  refine.highValue.some(
    (row) =>
      row.factKey === "internal_walls.wall_type.same_lining_both_sides" &&
      row.inputType === "select" &&
      row.options?.includes("Yes") &&
      row.options?.includes("No") &&
      !row.options?.includes("Include")
  )
);
check(
  "Refine fields carry wallTypeId",
  refine.highValue.some(
    (row) =>
      row.factKey === "internal_walls.wall_type.length_lm" &&
      row.wallTypeId === typeB!.id
  )
);

console.log("\n--- Multi-type / no package ---\n");
const walls = wa("w1", "internal_walls", "Internal walls");
const calc = calculateInternalWalls(ctx([walls], fireBoth), walls);
check(
  "no silent 20 m² and no package money",
  calc.lineItems.length === 0 &&
    !calc.assumptions.some((row) => /20\s*m/.test(row)) &&
    calc.assumptions.some((row) =>
      row.includes(INTERNAL_WALLS_TAKEOFF_NOT_PRICED_STATEMENT)
    )
);

console.log("\n--- Hosted policy / migrations ---\n");
check(
  "canonical Preview host",
  PREVIEW_AUTH_SITE_ORIGIN_STABLE.includes("hardening-stage-2a-security")
);
check("Preview ref recorded", PREVIEW_SUPABASE_PROJECT_REF === "shhpjsoldmqtkdbgrbtm");
check("plus-address fixture allowed", isPlusAddressFixture("hello+wa-iw-02c@example.invalid"));
let protectedBlocked = false;
try {
  assertSafePreviewPasswordMutation(PREVIEW_PASSWORD_PROTECTED_EMAILS[0]!);
} catch {
  protectedBlocked = true;
}
check("owner inbox password mutation blocked", protectedBlocked);
const migrations = numberedMigrations();
check(
  "no migration 055",
  !migrations.some((name) => name.startsWith("055_"))
);
check(
  "preview remains through 056",
  migrations.some((name) => name.startsWith("056_"))
);
check(
  "no timber takeoff formulas added in 02C persist path",
  !read("lib/assistant/scope-persistence.ts").includes("stud_count") &&
    !read("lib/estimate/internal-walls-wall-types.ts").includes("lineItems.push")
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
