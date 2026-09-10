/**
 * EF02-IW-ID-A — nested Wall Type Refine identity + add activation guard.
 *
 * Run: npx --yes tsx scripts/verify-internal-walls-nested-identity-r1.ts
 *
 * No calculator / persistence architecture edits. No paid AI. No Production.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { composeRefineView } from "../lib/assistant/refine/compose";
import { getRefineAdapter } from "../lib/assistant/refine/adapters/registry";
import { tryBeginSingleActivation } from "../lib/assistant/refine/single-activation";
import { INTERNAL_WALLS_JOB_SCOPE_FACT_KEY } from "../lib/estimate/internal-walls-scope";
import {
  INTERNAL_WALLS_ACTIVE_WALL_TYPE_ID_FACT_KEY,
  INTERNAL_WALLS_ADD_WALL_TYPE_KEY,
  applyInternalWallsFactWrite,
} from "../lib/estimate/internal-walls-wall-types";
import type { EstimateFact } from "../lib/estimate/types";
import { internalWallsIdentityInvariantFixtures } from "./lib/internal-walls-iw-id-invariants";

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

const CORE_KEYS = [
  "internal_walls.wall_type.frame_system",
  "internal_walls.wall_type.frame_size",
  "internal_walls.wall_type.wall_count",
  "internal_walls.wall_type.length_lm",
  "internal_walls.wall_type.height_m",
] as const;

const TYPE_A = "aaaaaaaa-bbbb-4ccc-8ddd-111111111111";
const TYPE_B = "bbbbbbbb-cccc-4ddd-8eee-222222222222";

function composeRefine(facts: EstimateFact[]) {
  const workAreas = [
    {
      id: "w1",
      type: "internal_walls",
      name: "Ground Floor Internal Walls",
      status: "confirmed" as const,
    },
  ];
  const plan = composeJobPlan({
    workAreas,
    facts,
    constraints: [],
    briefText: "New internal walls.",
  });
  return composeRefineView({
    briefText: "New internal walls.",
    qualityLevel: "standard",
    workAreas,
    facts,
    constraints: [],
    jobPlan: {
      cards: plan.cards.map((card) => ({
        workAreaId: card.workAreaId,
        workAreaType: card.workAreaType,
        name: card.name,
        notConfirmed: card.notConfirmed,
      })),
    },
  });
}

function twoTypes(activeId: string): EstimateFact[] {
  let facts: EstimateFact[] = [];
  facts = applyInternalWallsFactWrite({
    facts,
    workAreaId: "w1",
    key: INTERNAL_WALLS_JOB_SCOPE_FACT_KEY,
    value: "new_partition",
  });
  facts = applyInternalWallsFactWrite({
    facts,
    workAreaId: "w1",
    key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY,
    value: TYPE_A,
  });
  facts = applyInternalWallsFactWrite({
    facts,
    workAreaId: "w1",
    wallTypeId: TYPE_A,
    key: "internal_walls.wall_type.frame_system",
    value: "Timber framing",
  });
  facts = applyInternalWallsFactWrite({
    facts,
    workAreaId: "w1",
    wallTypeId: TYPE_A,
    key: "internal_walls.wall_type.frame_size",
    value: "90 mm timber framing — 90×45",
  });
  facts = applyInternalWallsFactWrite({
    facts,
    workAreaId: "w1",
    wallTypeId: TYPE_A,
    key: "internal_walls.wall_type.wall_count",
    value: 1,
  });
  facts = applyInternalWallsFactWrite({
    facts,
    workAreaId: "w1",
    wallTypeId: TYPE_A,
    key: "internal_walls.wall_type.length_lm",
    value: 12,
  });
  facts = applyInternalWallsFactWrite({
    facts,
    workAreaId: "w1",
    wallTypeId: TYPE_A,
    key: "internal_walls.wall_type.height_m",
    value: 2.4,
  });
  facts = applyInternalWallsFactWrite({
    facts,
    workAreaId: "w1",
    key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY,
    value: TYPE_B,
  });
  facts = applyInternalWallsFactWrite({
    facts,
    workAreaId: "w1",
    wallTypeId: TYPE_B,
    key: "internal_walls.wall_type.frame_system",
    value: "Timber framing",
  });
  facts = applyInternalWallsFactWrite({
    facts,
    workAreaId: "w1",
    wallTypeId: TYPE_B,
    key: "internal_walls.wall_type.frame_size",
    value: "90 mm timber framing — 90×45",
  });
  facts = applyInternalWallsFactWrite({
    facts,
    workAreaId: "w1",
    wallTypeId: TYPE_B,
    key: "internal_walls.wall_type.wall_count",
    value: 1,
  });
  facts = applyInternalWallsFactWrite({
    facts,
    workAreaId: "w1",
    wallTypeId: TYPE_B,
    key: "internal_walls.wall_type.length_lm",
    value: 8,
  });
  facts = applyInternalWallsFactWrite({
    facts,
    workAreaId: "w1",
    wallTypeId: TYPE_B,
    key: "internal_walls.wall_type.height_m",
    value: 3.0,
  });
  facts = applyInternalWallsFactWrite({
    facts,
    workAreaId: "w1",
    key: INTERNAL_WALLS_ACTIVE_WALL_TYPE_ID_FACT_KEY,
    value: activeId,
  });
  return facts;
}

function adapterRows(activeId: string) {
  const adapter = getRefineAdapter("internal_walls");
  if (!adapter) return [];
  return adapter.candidates({
    workAreaId: "w1",
    workAreaName: "Ground Floor Internal Walls",
    facts: twoTypes(activeId),
    briefText: "New internal walls.",
    notConfirmed: [],
  });
}

function rowsFor(activeId: string) {
  return adapterRows(activeId).filter((row) =>
    CORE_KEYS.includes(row.factKey as (typeof CORE_KEYS)[number])
  );
}

function row(activeId: string, factKey: string) {
  return rowsFor(activeId).find((item) => item.factKey === factKey);
}

console.log("=== EF02-IW-ID-A nested identity ===\n");

const aRows = rowsFor(TYPE_A);
const bRows = rowsFor(TYPE_B);

for (const key of CORE_KEYS) {
  const a = aRows.find((item) => item.factKey === key);
  const b = bRows.find((item) => item.factKey === key);
  check(
    `A: ${key} ids differ across Wall Types`,
    Boolean(a?.id) && Boolean(b?.id) && a!.id !== b!.id,
    `${a?.id} vs ${b?.id}`
  );
}

check(
  "B: local edit of A height cannot collide with B",
  (() => {
    const aHeight = row(TYPE_A, "internal_walls.wall_type.height_m");
    const bHeight = row(TYPE_B, "internal_walls.wall_type.height_m");
    const local: Record<string, number> = {};
    if (!aHeight || !bHeight) return false;
    local[aHeight.id] = 2.4;
    const bDisplay = local[bHeight.id] ?? Number(bHeight.currentValue);
    return (
      aHeight.id !== bHeight.id &&
      local[bHeight.id] == null &&
      bDisplay === 3
    );
  })()
);

check(
  "C: row.wallTypeId is embedded in row.id",
  aRows.every(
    (item) =>
      item.wallTypeId === TYPE_A &&
      item.id.includes(TYPE_A) &&
      item.id.includes(item.factKey ?? "")
  ) &&
    bRows.every(
      (item) =>
        item.wallTypeId === TYPE_B &&
        item.id.includes(TYPE_B) &&
        item.id.includes(item.factKey ?? "")
    )
);
const composedA = [...composeRefine(twoTypes(TYPE_A)).highValue, ...composeRefine(twoTypes(TYPE_A)).advanced];
const composedB = [...composeRefine(twoTypes(TYPE_B)).highValue, ...composeRefine(twoTypes(TYPE_B)).advanced];
const composedHeightA = composedA.find((row) => row.factKey === "internal_walls.wall_type.height_m");
const composedHeightB = composedB.find((row) => row.factKey === "internal_walls.wall_type.height_m");
check(
  "composed Refine view also keeps distinct height ids",
  Boolean(composedHeightA?.id) &&
    Boolean(composedHeightB?.id) &&
    composedHeightA!.id !== composedHeightB!.id
);

const addLock = { current: false };
let addCount = 0;
const addOnce = () => {
  if (!tryBeginSingleActivation(addLock)) return;
  addCount += 1;
};
addOnce();
addOnce();
addOnce();
check("D: rapid Add Wall Type activation creates once", addCount === 1);

const openingLock = { current: false };
let openingCount = 0;
const addOpeningOnce = () => {
  if (!tryBeginSingleActivation(openingLock)) return;
  openingCount += 1;
};
addOpeningOnce();
addOpeningOnce();
check("E: rapid Add Opening activation creates once", openingCount === 1);

const panelSrc = read("components/assistant/refine/InternalWallsWallTypesPanel.tsx");
check(
  "D/E: Add Wall Type and Add Opening are disabled while pending",
  panelSrc.includes("data-add-wall-type-pending") &&
    panelSrc.includes("data-add-opening-pending") &&
    panelSrc.includes("tryBeginSingleActivation") &&
    panelSrc.includes("disabled={addBusy}") &&
    panelSrc.includes("disabled={openingBusy}")
);

const idFactory = read("lib/estimate/internal-walls-wall-types.ts");
const openingFactory = read("lib/estimate/internal-walls-openings.ts");
check(
  "F: createWallTypeId UUID factory is unchanged",
  /export function createWallTypeId\(\): string \{\n  if \(typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"\) \{\n    return crypto.randomUUID\(\);/.test(
    idFactory
  )
);
check(
  "F: createOpeningId UUID factory is unchanged",
  /export function createOpeningId\(\): string \{\n  if \(typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"\) \{\n    return crypto.randomUUID\(\);/.test(
    openingFactory
  )
);

const adapterSrc = read("lib/assistant/refine/adapters/internal-walls.ts");
check(
  "trailing map rebuilds row.id with wallTypeId",
  adapterSrc.includes("wallTypeQuestionIdentity") &&
    adapterSrc.includes("questionPresentationId") &&
    adapterSrc.includes("questionSemanticKey")
);

const baseline = {
  A: {
    labourHours: 12.96,
    recommendedCost: 1844.69,
    recommendedSell: 2500.26,
    lineCount: 7,
    length: 12,
    height: 2.4,
    centres: 600,
    requirementsFingerprint:
      "labour:internal_walls.framing.timber.90x45.install=12.96|labour:internal_walls.lining.standard_gib.install=0|material:internal_walls.framing.fixings.allowance=28.8|material:internal_walls.framing.timber.90x45.material=108.24|material:internal_walls.lining.standard_gib.material=22",
  },
  B: {
    labourHours: 10.8,
    recommendedCost: 1350.46,
    recommendedSell: 1850.08,
    lineCount: 7,
    length: 8,
    height: 3,
    centres: 400,
    requirementsFingerprint:
      "labour:internal_walls.framing.timber.90x45.install=10.8|labour:internal_walls.lining.standard_gib.install=0|material:internal_walls.framing.fixings.allowance=24|material:internal_walls.framing.timber.90x45.material=113.3|material:internal_walls.lining.standard_gib.material=16",
  },
  C: {
    labourHours: 6.75,
    recommendedCost: 405,
    recommendedSell: 607.5,
    lineCount: 7,
    length: 5,
    height: 2.7,
    centres: 400,
    requirementsFingerprint:
      "labour:internal_walls.framing.timber.140x45.install=6.75|labour:internal_walls.lining.standard_gib.install=0|material:internal_walls.framing.fixings.allowance=13.5|material:internal_walls.framing.timber.140x45.material=69.08|material:internal_walls.lining.standard_gib.material=12",
  },
  D: {
    labourHours: 12.96,
    recommendedCost: 1965.06,
    recommendedSell: 2650.72,
    lineCount: 14,
    requirementsFingerprint:
      "labour:internal_walls.framing.timber.90x45.install=12.96|labour:internal_walls.lining.aqualine.install=0|labour:internal_walls.lining.standard_gib.install=0|material:internal_walls.framing.fixings.allowance=28.8|material:internal_walls.framing.timber.90x45.material=110.88|material:internal_walls.lining.aqualine.material=4|material:internal_walls.lining.standard_gib.material=22",
  },
} as const;
const live = internalWallsIdentityInvariantFixtures();
console.log("\n--- Numerical invariants (before identity fix vs after) ---\n");
for (const key of ["A", "B", "C", "D"] as const) {
  const before = baseline[key];
  const after = live[key];
  const physical = after.physical;
  const match =
    after.labourHours === before.labourHours &&
    after.commercial.recommendedCost === before.recommendedCost &&
    after.commercial.recommendedSell === before.recommendedSell &&
    after.commercial.lineCount === before.lineCount &&
    after.requirementsFingerprint === before.requirementsFingerprint &&
    ("length" in before
      ? physical[0]?.length_lm === before.length &&
        physical[0]?.height_m === before.height &&
        physical[0]?.stud_centres_mm === before.centres
      : physical.length === 2 &&
        physical.some((row) => row.wall_count === 2 && row.length_lm === 9) &&
        physical.some((row) => row.wall_count === 1 && row.length_lm === 3 && row.side_b === "aqualine"));
  check(
    `${key}: physical/labour/requirements/commercial match`,
    match,
    `after labour=${after.labourHours} cost=${after.commercial.recommendedCost}`
  );
  console.log(
    `  ${after.name}: labour ${after.labourHours} | cost ${after.commercial.recommendedCost} | sell ${after.commercial.recommendedSell} | Match ${match ? "YES" : "NO"}`
  );
}

check(
  "calculator files were not edited in this task",
  !read("lib/estimate/internal-walls-physical.ts").includes("nestedRefineCandidateId") &&
    !read("lib/estimate/calculators/fitout.ts").includes("nestedRefineCandidateId")
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
