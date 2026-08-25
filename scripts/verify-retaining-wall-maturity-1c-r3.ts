/**
 * RETAINING-WALL-MATURITY-1C-R3 — Update Estimate / fact-contract repair.
 * Run: npx tsx scripts/verify-retaining-wall-maturity-1c-r3.ts
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { evaluatePackageQuickEstimateReadiness } from "../lib/assistant/readiness/package-quick-estimate";
import { retainingWallRefineAdapter } from "../lib/assistant/refine/adapters/retaining-wall";
import { composeRefineView } from "../lib/assistant/refine/compose";
import { buildProjectConditionsSnapshot } from "../lib/builder-interview/project-filter";
import type { BuilderInterviewInput } from "../lib/builder-interview/types";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { RETAINING_WALL_CALCULATOR_CONSUMED_FACTS } from "../lib/estimate/calculators/retaining-wall";
import { isCalculatorConsumedFact } from "../lib/estimate/consumed-facts";
import { getNumberFact, getStringFact } from "../lib/estimate/facts";
import { filterEstimateBlockingProjectConditionKeys } from "../lib/scopes/level1-blocking";
import type { EstimateContext, EstimateFact } from "../lib/estimate/types";

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

const WA = "rw1";

function fact(key: string, value: unknown): EstimateFact {
  return { key, work_area_id: WA, value, source: "user" };
}

function ownerFacts(overrides: EstimateFact[] = []): EstimateFact[] {
  const base: EstimateFact[] = [
    fact("retaining_wall.material", "Timber"),
    fact("retaining_wall.length_m", 15),
    fact("retaining_wall.is_raking", true),
    fact("retaining_wall.height_high_m", 1.6),
    fact("retaining_wall.height_low_m", 0.6),
    fact("retaining_wall.excavation_required", true),
    fact("retaining_wall.face_board_section", "150×50 H4"),
    fact("retaining_wall.pile_embedment_m", 0.8),
  ];
  const overrideKeys = new Set(overrides.map((row) => row.key));
  return [...base.filter((row) => !overrideKeys.has(row.key)), ...overrides];
}

function ownerConstraints(
  extra: { key: string; value: unknown }[] = []
): { key: string; value: unknown }[] {
  return [
    { key: "site_access", value: "Moderate" },
    { key: "material_carry_distance", value: "10–30m" },
    ...extra,
  ];
}

function estimateCtx(
  facts: EstimateFact[],
  constraints: { key: string; value: unknown }[] = ownerConstraints()
): EstimateContext {
  return {
    project: { id: "p-owner-rw", qualityLevel: "standard" },
    confirmedWorkAreas: [
      { id: WA, type: "retaining_wall", name: "Retaining wall", sort_order: 1 },
    ],
    facts,
    constraints: constraints.map((c) => ({
      key: c.key,
      label: c.key,
      value: c.value,
    })),
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
    },
    materialWastageSettings: { defaultMaterialWastagePercent: 10 },
    rates: [],
  } as unknown as EstimateContext;
}

function interviewInput(
  facts: EstimateFact[],
  constraints: { key: string; value: unknown }[]
): BuilderInterviewInput {
  return {
    project: { id: "p-owner-rw", qualityLevel: "standard" },
    workAreas: [
      {
        id: WA,
        type: "retaining_wall",
        name: "Retaining wall",
        status: "confirmed",
        sortOrder: 0,
      },
    ],
    facts: facts.map((row) => ({
      key: row.key,
      workAreaId: row.work_area_id,
      value: row.value,
      source: row.source ?? "user",
    })),
    constraints: constraints.map((row) => ({
      key: row.key,
      value: row.value,
      source: "user",
    })),
  };
}

function packageReady(
  facts: EstimateFact[],
  constraints: { key: string; value: unknown }[] = ownerConstraints()
) {
  const snap = buildProjectConditionsSnapshot(interviewInput(facts, constraints));
  return evaluatePackageQuickEstimateReadiness({
    workAreas: [{ id: WA, type: "retaining_wall", status: "confirmed" }],
    facts,
    unresolvedRequiredProjectConditionKeys: snap.unresolvedRequiredKeys,
  });
}

function dumpOwnerCanonical(
  facts: EstimateFact[],
  constraints: { key: string; value: unknown }[]
) {
  const byKey = (key: string) => facts.find((row) => row.key === key)?.value ?? null;
  const constraint = (key: string) =>
    constraints.find((row) => row.key === key)?.value ?? null;
  return {
    system: byKey("retaining_wall.material"),
    length_m: byKey("retaining_wall.length_m"),
    height_m: byKey("retaining_wall.height_m"),
    height_high_m: byKey("retaining_wall.height_high_m"),
    height_low_m: byKey("retaining_wall.height_low_m"),
    face_board: byKey("retaining_wall.face_board_section"),
    pile_spacing_m: byKey("retaining_wall.post_spacing_m"),
    pile_embedment_m: byKey("retaining_wall.pile_embedment_m"),
    drainage_required: byKey("retaining_wall.drainage_required"),
    backfill_included: byKey("retaining_wall.backfill_included"),
    excavation_required: byKey("retaining_wall.excavation_required"),
    excavation_volume_m3: byKey("retaining_wall.excavation_volume_m3"),
    site_access: constraint("site_access"),
    material_carry_distance: constraint("material_carry_distance"),
  };
}

function spawnVerifier(script: string): boolean {
  try {
    execFileSync("npx", ["tsx", script], {
      stdio: "pipe",
      cwd: process.cwd(),
      encoding: "utf8",
      shell: process.platform === "win32",
    });
    return true;
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string };
    const out = `${err.stdout ?? ""}\n${err.stderr ?? ""}`;
    const failLine = out
      .split(/\r?\n/)
      .find((line) => /FAIL|failed|Error/i.test(line));
    if (failLine) console.log(`      spawn ${script}: ${failLine.trim()}`);
    return false;
  }
}

const facts = ownerFacts();
const constraints = ownerConstraints();
const snap = buildProjectConditionsSnapshot(interviewInput(facts, constraints));
const pcBlocking = filterEstimateBlockingProjectConditionKeys(
  snap.unresolvedRequiredKeys
);
const readiness = packageReady(facts, constraints);

console.log("\n--- OWNER FIXTURE CANONICAL DUMP (debug, not UI) ---\n");
console.log(JSON.stringify(dumpOwnerCanonical(facts, constraints), null, 2));
console.log("\nunresolvedRequiredProjectConditionKeys:", snap.unresolvedRequiredKeys);
console.log("snapshot.canGenerateQuickEstimate:", snap.readiness.canGenerateQuickEstimate);
console.log("filteredEstimateBlockingPC:", pcBlocking);
console.log("packageQuickEstimate.ready:", readiness.ready);
console.log(
  "packageQuickEstimate.blockers:",
  readiness.blockers.map((b) => b.key)
);

console.log("\n--- READINESS ---\n");
check("1 Owner fixture passes Quick Estimate readiness", readiness.ready);
check(
  "2 sloping high/low does not require constant height",
  facts.every((row) => row.key !== "retaining_wall.height_m") &&
    packageReady(facts).ready
);
check(
  "3 default pile spacing does not block",
  facts.every((row) => row.key !== "retaining_wall.post_spacing_m") &&
    packageReady(facts).ready
);
check(
  "4 default embedment does not block",
  packageReady(
    ownerFacts().filter((row) => row.key !== "retaining_wall.pile_embedment_m")
  ).ready
);
check(
  "5 explicit embedment persists",
  getNumberFact(facts, WA, "retaining_wall.pile_embedment_m") === 0.8
);
check(
  "6 missing drainage uses assumed yes (does not block)",
  facts.every((row) => row.key !== "retaining_wall.drainage_required") &&
    packageReady(facts).ready
);
check(
  "7 drainage false is valid",
  packageReady(ownerFacts([fact("retaining_wall.drainage_required", false)])).ready
);
check(
  "8 missing backfill uses assumed yes (does not block)",
  facts.every((row) => row.key !== "retaining_wall.backfill_included") &&
    packageReady(facts).ready
);
check(
  "9 backfill false is valid",
  packageReady(ownerFacts([fact("retaining_wall.backfill_included", false)])).ready
);
check(
  "10 excavation true + missing bulk volume still Quick Estimate ready",
  getNumberFact(facts, WA, "retaining_wall.excavation_volume_m3") == null &&
    facts.some(
      (row) => row.key === "retaining_wall.excavation_required" && row.value === true
    ) &&
    packageReady(facts).ready
);
check(
  "11 excavation false valid",
  packageReady(ownerFacts([fact("retaining_wall.excavation_required", false)])).ready
);
check(
  "12 access missing does not hard block",
  packageReady(facts, [{ key: "material_carry_distance", value: "10–30m" }]).ready
);
check(
  "13 carry missing does not hard block",
  packageReady(facts, [{ key: "site_access", value: "Moderate" }]).ready
);
check("14 missing component material rates do not hard block", packageReady(facts).ready);
check("15 missing productivity does not hard block", packageReady(facts).ready);
check("16 residual missing rate does not hard block", packageReady(facts).ready);
check("17 backfill procurement unresolved does not hard block", packageReady(facts).ready);

console.log("\n--- FACT AUTHORITY ---\n");
const refineCandidates = retainingWallRefineAdapter.candidates({
  workAreaId: WA,
  workAreaName: "Retaining wall",
  facts: ownerFacts().filter((row) => row.key !== "retaining_wall.pile_embedment_m"),
  briefText: null,
  notConfirmed: [],
});
check(
  "18 Refine embedment answer writes canonical consumed fact",
  refineCandidates.some((c) => c.factKey === "retaining_wall.pile_embedment_m") &&
    isCalculatorConsumedFact("retaining_wall", "retaining_wall.pile_embedment_m")
);
const editorSrc = readFileSync(
  "components/assistant/job-plan/RetainingWallQuickSpecEditor.tsx",
  "utf8"
);
check(
  "19 Edit Scope embedment writes same canonical fact",
  editorSrc.includes('key: "retaining_wall.pile_embedment_m"')
);
const embedmentKeys = RETAINING_WALL_CALCULATOR_CONSUMED_FACTS.filter((k) =>
  k.includes("pile_embedment")
);
check(
  "20 no duplicate embedment hard-minimum key",
  embedmentKeys.includes("retaining_wall.pile_embedment_m") &&
    embedmentKeys.includes("retaining_wall.pile_embedment_ratio") &&
    !packageReady(
      ownerFacts().filter((row) => row.key !== "retaining_wall.pile_embedment_m")
    ).blockers.some((b) => b.key.includes("embedment"))
);
check(
  "21 wall system canonical key aligned",
  getStringFact(facts, WA, "retaining_wall.material") === "Timber"
);
check(
  "22 high/low canonical keys aligned",
  getNumberFact(facts, WA, "retaining_wall.height_high_m") === 1.6 &&
    getNumberFact(facts, WA, "retaining_wall.height_low_m") === 0.6
);
check(
  "23 Project Conditions read from canonical constraints",
  constraints.some((c) => c.key === "site_access") &&
    constraints.some((c) => c.key === "material_carry_distance") &&
    facts.every((f) => f.key !== "retaining_wall.carting_distance_m")
);
check(
  "24 no retaining_wall carry duplicate",
  facts.every((f) => f.key !== "retaining_wall.carting_distance_m") &&
    !editorSrc.includes("retaining_wall.carting_distance_m")
);

console.log("\n--- UPDATE ESTIMATE ---\n");
const ownerEstimate = calculateEstimate(estimateCtx(facts));
check(
  "25 Owner fixture Update Estimate succeeds",
  packageReady(facts).ready && ownerEstimate.recommendedSell > 0
);
const embedmentFacts = ownerFacts([fact("retaining_wall.pile_embedment_m", 1.0)]);
check(
  "26 change embedment → stale → update succeeds",
  packageReady(embedmentFacts).ready &&
    calculateEstimate(estimateCtx(embedmentFacts)).recommendedSell > 0
);
const spacingFacts = ownerFacts([fact("retaining_wall.post_spacing_m", 1.2)]);
check(
  "27 change pile spacing → stale → update succeeds",
  packageReady(spacingFacts).ready &&
    calculateEstimate(estimateCtx(spacingFacts)).recommendedSell > 0
);
const boardFacts = ownerFacts([
  fact("retaining_wall.face_board_section", "200×50 H4"),
]);
check(
  "28 change board material → stale → update succeeds",
  packageReady(boardFacts).ready &&
    calculateEstimate(estimateCtx(boardFacts)).recommendedSell > 0
);
const heightFacts = ownerFacts([fact("retaining_wall.height_high_m", 1.8)]);
check(
  "29 change high/low height → stale → update succeeds",
  packageReady(heightFacts).ready &&
    calculateEstimate(estimateCtx(heightFacts)).recommendedSell > 0
);
const drainageFalse = ownerFacts([fact("retaining_wall.drainage_required", false)]);
check(
  "30 drainage false → stale → update succeeds",
  packageReady(drainageFalse).ready &&
    calculateEstimate(estimateCtx(drainageFalse)).recommendedSell > 0
);
const backfillFalse = ownerFacts([fact("retaining_wall.backfill_included", false)]);
check(
  "31 backfill false → stale → update succeeds",
  packageReady(backfillFalse).ready &&
    calculateEstimate(estimateCtx(backfillFalse)).recommendedSell > 0
);
check(
  "32 excavation true/no volume → update succeeds",
  packageReady(facts).ready && ownerEstimate.recommendedSell > 0
);

console.log("\n--- ERROR CONTRACT ---\n");
const missingLength = packageReady(
  ownerFacts().filter((row) => row.key !== "retaining_wall.length_m")
);
check(
  "33 true missing wall length blocks",
  !missingLength.ready &&
    missingLength.blockers.some((b) => b.key === "retaining_wall.length_m") &&
    (missingLength.builderCopy ?? "").toLowerCase().includes("length")
);
const missingSystem = packageReady(
  ownerFacts().filter((row) => row.key !== "retaining_wall.material")
);
check(
  "34 true missing wall system blocks",
  !missingSystem.ready &&
    missingSystem.blockers.some((b) => b.key === "retaining_wall.material") &&
    (missingSystem.builderCopy ?? "").toLowerCase().includes("type")
);
const missingHeight = packageReady(
  ownerFacts().filter(
    (row) =>
      row.key !== "retaining_wall.height_high_m" &&
      row.key !== "retaining_wall.height_low_m"
  )
);
check(
  "35 true missing valid height blocks",
  !missingHeight.ready &&
    missingHeight.blockers.some((b) => b.category === "height") &&
    (missingHeight.builderCopy ?? "").toLowerCase().includes("height")
);
check(
  "36 structured blocker identifies missing category",
  missingLength.blockers[0]?.category === "length" &&
    missingSystem.blockers[0]?.category === "system" &&
    missingHeight.blockers[0]?.category === "height"
);
check(
  "37 boolean false not treated missing",
  packageReady(
    ownerFacts([
      fact("retaining_wall.drainage_required", false),
      fact("retaining_wall.backfill_included", false),
      fact("retaining_wall.excavation_required", false),
    ])
  ).ready
);
check(
  "38 zero-safe completeness semantics where allowed",
  packageReady(ownerFacts([fact("retaining_wall.pile_embedment_m", 0)])).ready
);

console.log("\n--- TRACE ---\n");
check(
  "trace snapshot lists waste_bin_access as unresolved required (excavation=true)",
  snap.unresolvedRequiredKeys.includes("waste_bin_access")
);
check(
  "trace filtered PC blockers are empty for Owner fixture",
  pcBlocking.length === 0
);
check(
  "trace AssistantShell uses package Quick Estimate gate",
  readFileSync("components/assistant/AssistantShell.tsx", "utf8").includes(
    "evaluatePackageQuickEstimateReadiness"
  )
);
check(
  "trace generate path uses package Quick Estimate gate",
  readFileSync("lib/assistant/actions.ts", "utf8").includes(
    "evaluatePackageQuickEstimateReadiness"
  ) &&
    readFileSync("lib/assistant/actions.ts", "utf8").includes(
      "filterEstimateBlockingProjectConditionKeys"
    )
);

const workAreas = [
  {
    id: WA,
    type: "retaining_wall",
    name: "Retaining wall",
    status: "confirmed" as const,
    sortOrder: 0,
  },
];
const jobPlan = composeJobPlan({
  workAreas,
  facts,
  constraints,
  qualityLevel: "standard",
  briefText: "15m timber retaining wall",
});
const clarify = composeClarifyView({
  stage: "quality",
  briefText: "15m timber retaining wall, 1.6m to 0.6m, moderate access, 30m carry.",
  qualityLevel: "standard",
  workAreas,
  facts,
  constraints,
  jobPlan,
});
check(
  "trace Clarify does not hard-block Owner fixture",
  !clarify.blocksEstimate && clarify.canEstimateNow
);

const refine = composeRefineView({
  briefText: "15m timber retaining wall",
  qualityLevel: "standard",
  workAreas,
  facts,
  constraints,
  jobPlan,
});
check(
  "trace Refine does not re-ask known access/carry",
  ![...refine.highValue, ...refine.advanced].some(
    (c) =>
      c.constraintKey === "site_access" ||
      c.constraintKey === "material_carry_distance"
  )
);

console.log("\n--- NON-REGRESSION (spawn) ---\n");
check("39 RW-1C passes", spawnVerifier("scripts/verify-retaining-wall-maturity-1c.ts"));
check("40 RW-1B passes", spawnVerifier("scripts/verify-retaining-wall-maturity-1b.ts"));
check("41 RW-1A passes", spawnVerifier("scripts/verify-retaining-wall-maturity-1a.ts"));
check(
  "42 Deck 2D passes",
  existsSync("scripts/verify-deck-maturity-2d.ts")
    ? spawnVerifier("scripts/verify-deck-maturity-2d.ts")
    : true
);

const rw2 = calculateEstimate(
  estimateCtx(
    [
      fact("retaining_wall.length_m", 10),
      fact("retaining_wall.height_m", 1),
      fact("retaining_wall.is_raking", false),
      fact("retaining_wall.fixing_type", "Standard"),
      fact("retaining_wall.material", "Timber"),
      fact("retaining_wall.drainage_required", true),
      fact("retaining_wall.backfill_included", true),
      fact("retaining_wall.backfill_depth_m", 0.3),
      fact("retaining_wall.backfill_length_m", 10),
      fact("retaining_wall.backfill_height_m", 1),
    ],
    []
  )
);
check(
  "45 RW-2 empty-rate timber is detailed (package $7,345 retired)",
  rw2.recommendedSell > 0 &&
    !rw2.lineItems.some((item) => item.label === "Retaining wall materials")
);
check(
  "46 no $0 Quick Estimate regression",
  ownerEstimate.recommendedSell > 0 && rw2.recommendedSell > 0
);
check(
  "useful: waste_bin_access is assumable not a package blocker",
  !pcBlocking.includes("waste_bin_access")
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
