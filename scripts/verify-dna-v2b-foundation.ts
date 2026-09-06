/**
 * DNA-V2B — catalogue + productivity foundation.
 *
 * Run: npx --yes tsx scripts/verify-dna-v2b-foundation.ts
 *
 * No UI. No migration 054. V1 catalogue semantics unchanged.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { COMPANY_DNA_TASKS, getCompanyDnaTask } from "../lib/company-dna/catalogue";
import {
  clockFromDurationHours,
  companyDnaWorkAreaStatus,
  companyDnaWorkAreaStatusV2,
  deriveCompanyProductivityFromClock,
  DNA_HARD_HOURS_MIN,
  durationHoursFromClock,
  validateCompanyDnaInputs,
} from "../lib/company-dna/derive";
import {
  COMPANY_DNA_EXCLUDED_FROM_V2,
  COMPANY_DNA_FOUNDATION_TASKS,
  COMPANY_DNA_V1_FOUNDATION_TASKS,
  COMPANY_DNA_V2B_DEFERRED_KEYS,
  COMPANY_DNA_V2B_NEW_TASKS,
  companyDnaFoundationWorkAreaStatus,
  listCompanyDnaTasksVisibleInCurrentUi,
  listCompanyDnaTier1Tasks,
} from "../lib/company-dna/v2-foundation";
import { calculateFence } from "../lib/estimate/calculators/fence";
import {
  findCompanyProductivityRate,
  productivityUnitsCompatible,
  resolveProductivity,
} from "../lib/estimate/productivity";
import { FENCE_PRODUCTIVITY_KEYS } from "../lib/estimate/fence-productivity";
import {
  RW_EXCAVATION_MACHINE_HOURS_KEY,
  RW_EXCAVATION_MANUAL_HOURS_KEY,
} from "../lib/estimate/retaining-wall-family-coverage";
import { RW_PRODUCTIVITY_KEYS } from "../lib/estimate/retaining-wall-productivity";
import { summarizeProductivityWorkAreas } from "../lib/rates/productivity-work-area-summary";
import {
  DECK_PRODUCTIVITY_RATE_CATALOGUE,
  FENCE_PRODUCTIVITY_RATE_CATALOGUE,
  RETAINING_WALL_PRODUCTIVITY_RATE_CATALOGUE,
} from "../lib/rates/specific-material-catalogue";
import type { OrganisationRate } from "../components/setup/types";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";

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

function unitsCompatible(a: string, b: string): boolean {
  return productivityUnitsCompatible(a, b) || productivityUnitsCompatible(b, a);
}

function numberedMigrations(): string[] {
  return readdirSync(join(process.cwd(), "supabase/migrations"))
    .filter((name) => /^\d+_/.test(name) && name.endsWith(".sql"))
    .sort();
}

const PACKAGE_LUMPS = new Set(COMPANY_DNA_EXCLUDED_FROM_V2.packageLumps);
const CONDITION_LIKE = new Set(COMPANY_DNA_EXCLUDED_FROM_V2.conditionLike);

function isPrimaryConsumed(itemKey: string, support: string): boolean {
  if (support !== "used_now") return false;
  if (PACKAGE_LUMPS.has(itemKey)) return false;
  if (CONDITION_LIKE.has(itemKey)) return false;
  if (itemKey.startsWith(COMPANY_DNA_EXCLUDED_FROM_V2.plantPrefix)) return false;
  return true;
}

const consumedPrimary = new Set<string>([
  ...DECK_PRODUCTIVITY_RATE_CATALOGUE.filter((row) =>
    isPrimaryConsumed(row.item_key, row.calculatorSupport)
  ).map((row) => row.item_key),
  ...FENCE_PRODUCTIVITY_RATE_CATALOGUE.filter((row) =>
    isPrimaryConsumed(row.item_key, row.calculatorSupport)
  ).map((row) => row.item_key),
  "fence.demolition_hours_per_lm",
  ...RETAINING_WALL_PRODUCTIVITY_RATE_CATALOGUE.filter((row) =>
    isPrimaryConsumed(row.item_key, row.calculatorSupport)
  ).map((row) => row.item_key),
]);

const ratesUnit = new Map<string, string>();
for (const row of [
  ...DECK_PRODUCTIVITY_RATE_CATALOGUE,
  ...FENCE_PRODUCTIVITY_RATE_CATALOGUE,
  ...RETAINING_WALL_PRODUCTIVITY_RATE_CATALOGUE,
]) {
  ratesUnit.set(row.item_key, row.unit);
}
ratesUnit.set("fence.demolition_hours_per_lm", "lm");

function productivityRate(
  itemKey: string,
  unit: string,
  hours: number
): OrganisationRate {
  return {
    id: itemKey,
    rate_type: "productivity",
    item_key: itemKey,
    label: itemKey,
    unit,
    cost_rate: hours,
    sell_rate: null,
    markup_percent: null,
    active: true,
    trade: null,
    work_area_type: "fence",
    source: "calibrated_productivity",
    source_calibration_id: "ev-v2b",
  };
}

function fact(key: string, value: unknown): EstimateFact {
  return { key, work_area_id: "f1", value };
}

function wa(): EstimateWorkArea & { status: "confirmed" } {
  return { id: "f1", type: "fence", name: "Fence", sort_order: 1, status: "confirmed" };
}

function fenceCtx(rates: OrganisationRate[] = []): EstimateContext {
  const facts: EstimateFact[] = [
    fact("fence.length_m", 18),
    fact("fence.height_m", 1.8),
    fact("fence.system", "Timber paling — vertical board"),
    fact("fence.timber_species", "Radiata Pine"),
    fact("fence.board_thickness_mm", "150 × 19mm"),
    fact("fence.post_spacing_m", 1.8),
    fact("fence.gate_included", false),
    fact("fence.top_capping", "No"),
    fact("fence.vertical_paling_gap_mm", 0),
    fact("fence.demolition_required", true),
  ];
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [wa()],
    facts,
    constraints: [
      { key: "site_access", value: "Moderate" },
      { key: "material_carry_distance", value: "10–30m" },
    ],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
    },
    materialWastageSettings: null,
    rates: [
      {
        id: "labour.carpenter.hour",
        rate_type: "labour",
        item_key: "labour.carpenter.hour",
        label: "Carpenter",
        unit: "hour",
        cost_rate: 60,
        sell_rate: null,
        markup_percent: null,
        active: true,
        trade: "carpenter",
        work_area_type: "fence",
        source: "explicit_company",
      },
      ...rates,
    ],
  } as EstimateContext;
}

function demoLine(result: ReturnType<typeof calculateFence>) {
  return result.lineItems.find((item) => item.label === "Existing fence removal");
}

console.log("=== DNA-V2B FOUNDATION ===\n");

const sql054 = read("supabase/migrations/054_company_dna_v2_catalogue_seed.sql");
const sql054Code = sql054.replace(/--[^\n]*/g, "");
check(
  "054 is data-only catalogue seed",
  numberedMigrations().some((name) => name === "054_company_dna_v2_catalogue_seed.sql") &&
    !/\balter\s+table\b/i.test(sql054Code) &&
    !/\bcreate\s+table\b/i.test(sql054Code)
);
check(
  "latest numbered migration is 054 catalogue seed",
  numberedMigrations().at(-1) === "054_company_dna_v2_catalogue_seed.sql"
);
check("V1 live catalogue still 9 tasks", COMPANY_DNA_TASKS.length === 9);
check(
  "V1 foundation overlay still 9",
  COMPANY_DNA_V1_FOUNDATION_TASKS.length === 9
);

const migration = read("supabase/migrations/052_company_productivity_calibration.sql");
const v1Keys = [
  "deck.framing.v1",
  "deck.decking.v1",
  "deck.posts.v1",
  "deck.demolition.v1",
  "fence.posts.v1",
  "fence.boards.v1",
  "fence.rails.v1",
  "retaining_wall.piles.v1",
  "retaining_wall.face.v1",
] as const;

for (const key of v1Keys) {
  const live = COMPANY_DNA_TASKS.find((task) => task.calibrationTaskKey === key);
  const seeded = migration.includes(`'${key}'`);
  check(`V1 key unchanged in live catalogue ${key}`, live != null);
  check(`V1 key unchanged in 052 seed ${key}`, seeded);
}

const framing = COMPANY_DNA_TASKS.find((task) => task.calibrationTaskKey === "deck.framing.v1")!;
check("V1 framing authority qty still 80", framing.authorityQuantity === 80);
check("V1 framing benchmark still 0.13", framing.benchmarkProductivity === 0.13);
check(
  "V1 posts authority qty still 9",
  COMPANY_DNA_TASKS.find((task) => task.calibrationTaskKey === "deck.posts.v1")
    ?.authorityQuantity === 9
);

const newKeys = COMPANY_DNA_V2B_NEW_TASKS.map((task) => task.calibrationTaskKey);
check(
  "no new key collides with V1",
  newKeys.every((key) => !v1Keys.includes(key as (typeof v1Keys)[number]))
);
check(
  "new tasks hidden from current UI",
  COMPANY_DNA_V2B_NEW_TASKS.every((task) => task.exposeInCurrentUi === false)
);
check(
  "V1 getCompanyDnaTask rejects new keys",
  getCompanyDnaTask("deck.fascia.v1") == null &&
    getCompanyDnaTask("fence.demolition.v1") == null
);
check(
  "V1 tasks remain visible",
  COMPANY_DNA_V1_FOUNDATION_TASKS.every((task) => task.exposeInCurrentUi)
);
check(
  "current UI list still 9",
  listCompanyDnaTasksVisibleInCurrentUi().length === 9
);

const ratesSummary = summarizeProductivityWorkAreas([]);
check(
  "Rates DNA summary is Deck V2C + Fence V2D + RW V1",
  ratesSummary.every((row) => {
    if (row.workAreaType === "deck") {
      return row.taskTotal === 7 && row.keyTaskTotal === 3 && row.generation === "v2c";
    }
    if (row.workAreaType === "fence") {
      return row.taskTotal === 9 && row.keyTaskTotal === 3 && row.generation === "v2d";
    }
    const v1Count = COMPANY_DNA_TASKS.filter(
      (task) => task.workAreaType === row.workAreaType
    ).length;
    return row.taskTotal === v1Count && row.generation === "v1";
  })
);

console.log("\n--- New catalogue honesty ---\n");

const forbiddenProductivity = [
  ...PACKAGE_LUMPS,
  ...CONDITION_LIKE,
  "deck.decking.install.hours_per_m2",
  "deck.substructure.install.hours_per_m2",
  "deck.concrete.place.hours_per_hole",
  RW_PRODUCTIVITY_KEYS.excavationM3,
  RW_PRODUCTIVITY_KEYS.timberConcreteHole,
  RW_PRODUCTIVITY_KEYS.postHoleConcreteM3,
  RW_PRODUCTIVITY_KEYS.sleeperFaceM2,
  FENCE_PRODUCTIVITY_KEYS.framingLm,
  FENCE_PRODUCTIVITY_KEYS.verticalBoardsM2,
  FENCE_PRODUCTIVITY_KEYS.horizontalSlatsM2,
];

for (const task of COMPANY_DNA_V2B_NEW_TASKS) {
  check(
    `${task.calibrationTaskKey} maps to consumed key`,
    consumedPrimary.has(task.productivityRateKey)
  );
  const expectedUnit = ratesUnit.get(task.productivityRateKey);
  check(
    `${task.calibrationTaskKey} unit ${task.authorityUnit} vs ${expectedUnit}`,
    expectedUnit != null && unitsCompatible(task.authorityUnit, expectedUnit)
  );
  check(
    `${task.calibrationTaskKey} benchmark present`,
    task.benchmarkProductivity > 0 && Number.isFinite(task.benchmarkProductivity)
  );
  check(
    `${task.calibrationTaskKey} has tier`,
    task.priorityTier === 1 || task.priorityTier === 2 || task.priorityTier === 3
  );
  check(
    `${task.calibrationTaskKey} has include/exclude`,
    task.workIncluded.length > 10 && task.workExcluded.length > 10
  );
  check(
    `${task.calibrationTaskKey} not a leftover/package key`,
    !forbiddenProductivity.includes(task.productivityRateKey)
  );
  check(
    `${task.calibrationTaskKey} not plant`,
    !task.productivityRateKey.startsWith("plant.")
  );
}

const foundationKeys = COMPANY_DNA_FOUNDATION_TASKS.map(
  (task) => task.productivityRateKey
);
const orphans = COMPANY_DNA_FOUNDATION_TASKS.filter(
  (task) => !consumedPrimary.has(task.productivityRateKey)
);
check(
  "no orphan foundation rows",
  orphans.length === 0,
  orphans.map((task) => task.calibrationTaskKey).join(", ")
);

check(
  "steps deferred not catalogued",
  COMPANY_DNA_V2B_DEFERRED_KEYS.includes("deck.steps.install.hours_per_m2") &&
    !foundationKeys.includes("deck.steps.install.hours_per_m2")
);

const pileRows = COMPANY_DNA_FOUNDATION_TASKS.filter(
  (task) => task.productivityRateKey === RW_PRODUCTIVITY_KEYS.timberPilesEa
);
check(
  "RW piles stay one catalogue row on the existing key",
  pileRows.length === 1 && pileRows[0]?.calibrationTaskKey === "retaining_wall.piles.v1"
);
check(
  "RW pile baseline is machine-assisted",
  pileRows[0]?.baselineMethod === "machine-assisted"
);
check(
  "machine vs manual excavation are distinct keys",
  COMPANY_DNA_V2B_NEW_TASKS.some(
    (task) => task.productivityRateKey === RW_EXCAVATION_MACHINE_HOURS_KEY
  ) &&
    COMPANY_DNA_V2B_NEW_TASKS.some(
      (task) => task.productivityRateKey === RW_EXCAVATION_MANUAL_HOURS_KEY
    ) &&
    RW_EXCAVATION_MACHINE_HOURS_KEY !== RW_EXCAVATION_MANUAL_HOURS_KEY
);

check(
  "material movement not catalogued",
  !COMPANY_DNA_FOUNDATION_TASKS.some((task) =>
    /material movement|barrow|unload point/i.test(task.calibrationTaskKey)
  )
);
check(
  "waste carting not catalogued",
  !COMPANY_DNA_FOUNDATION_TASKS.some((task) =>
    /waste|carting|spoil/i.test(task.productivityRateKey)
  )
);
check(
  "cleanup not catalogued",
  !COMPANY_DNA_FOUNDATION_TASKS.some((task) => /cleanup/i.test(task.calibrationTaskKey))
);

console.log("\n--- Coverage after V2B ---\n");

function coverageFor(workArea: "deck" | "fence" | "retaining_wall") {
  const consumed = [...consumedPrimary].filter((key) =>
    workArea === "deck"
      ? key.startsWith("deck.")
      : workArea === "fence"
        ? key.startsWith("fence.")
        : key.startsWith("retaining_wall.")
  );
  const calibratable = COMPANY_DNA_FOUNDATION_TASKS.filter(
    (task) =>
      task.workAreaType === workArea && consumedPrimary.has(task.productivityRateKey)
  );
  const unique = new Set(calibratable.map((task) => task.productivityRateKey));
  return { calibratable: unique.size, consumed: consumed.length };
}

const deck = coverageFor("deck");
const fence = coverageFor("fence");
const rw = coverageFor("retaining_wall");
console.log(`COVERAGE  Deck: ${deck.calibratable} / ${deck.consumed}`);
console.log(`COVERAGE  Fence: ${fence.calibratable} / ${fence.consumed}`);
console.log(`COVERAGE  Retaining Wall: ${rw.calibratable} / ${rw.consumed}`);

check("Deck coverage 7/8 (steps deferred)", deck.calibratable === 7 && deck.consumed === 8);
check("Fence coverage 9/9", fence.calibratable === 9 && fence.consumed === 9);
check("RW coverage 15/15", rw.calibratable === 15 && rw.consumed === 15);
check("Deck substantially above 50%", deck.calibratable / deck.consumed > 0.5);
check("Fence substantially above 33%", fence.calibratable / fence.consumed > 0.33);
check("RW substantially above 13%", rw.calibratable / rw.consumed > 0.13);

check("Deck Tier 1 still posts/framing/decking", listCompanyDnaTier1Tasks("deck").length === 3);
check(
  "Fence Tier 1 still posts/rails/palings",
  listCompanyDnaTier1Tasks("fence").length === 3
);
check(
  "RW timber/sleeper/masonry Tier 1 includes excavation + piles + face + sleeper + block",
  listCompanyDnaTier1Tasks("retaining_wall").some(
    (task) => task.productivityRateKey === RW_EXCAVATION_MACHINE_HOURS_KEY
  ) && listCompanyDnaTier1Tasks("retaining_wall").length >= 5
);

console.log("\n--- Clock time + V2 status helpers ---\n");

const fifteen = durationHoursFromClock(0, 15);
check("0h 15m = 0.25h minimum", fifteen === DNA_HARD_HOURS_MIN);
check("2h 30m = 2.5h", durationHoursFromClock(2, 30) === 2.5);
check("minutes 60 rejected as NaN", Number.isNaN(durationHoursFromClock(1, 60)));
const tooShort = durationHoursFromClock(0, 10);
check("0h 10m is below hard minimum", tooShort < DNA_HARD_HOURS_MIN);
check(
  "0h 10m fails existing duration validation",
  validateCompanyDnaInputs({
    crewSize: 2,
    durationHours: tooShort,
    ratioToBenchmark: 1,
    outlierConfirmed: false,
  }).code === "INVALID_DURATION"
);
const clockBack = clockFromDurationHours(1.25);
check("1.25h splits to 1h 15m", clockBack.hours === 1 && clockBack.minutes === 15);

const fromClock = deriveCompanyProductivityFromClock({
  task: framing,
  crewSize: 2,
  clockHours: 2,
  minutes: 0,
});
check("clock derivation uses duration hours", fromClock.durationHours === 2);
check("2 workers × 2h / 80 lm = 0.05", fromClock.productivity === 0.05);

check(
  "V2 status 0 Tier 1 = not calibrated",
  companyDnaWorkAreaStatusV2({ tier1Total: 3, tier1Calibrated: 0 }) === "benchmarks"
);
check(
  "V2 status 1 of 3 = partly",
  companyDnaWorkAreaStatusV2({ tier1Total: 3, tier1Calibrated: 1 }) === "partly"
);
check(
  "V2 status 3 of 3 = using your calibration",
  companyDnaWorkAreaStatusV2({ tier1Total: 3, tier1Calibrated: 3 }) === "calibrated"
);
check(
  "V1 status helper unchanged (2 of 3 still calibrated)",
  companyDnaWorkAreaStatus({
    highImpactTotal: 3,
    highImpactCalibrated: 2,
    anyCalibrated: true,
  }) === "calibrated"
);
check(
  "V2 Deck helper not wired as live replacement",
  companyDnaFoundationWorkAreaStatus({
    workAreaType: "deck",
    calibratedTaskKeys: ["deck.framing.v1", "deck.decking.v1"],
  }) === "partly"
);

console.log("\n--- Company productivity precedence ---\n");

for (const task of COMPANY_DNA_V2B_NEW_TASKS) {
  const benchmark = resolveProductivity({
    productivityKey: task.productivityRateKey,
    unit: task.authorityUnit,
    fallbackHoursPerUnit: task.benchmarkProductivity,
  });
  const companyHours = round4ForTest(task.benchmarkProductivity * 1.4);
  const calibrated = resolveProductivity({
    productivityKey: task.productivityRateKey,
    unit: task.authorityUnit,
    fallbackHoursPerUnit: task.benchmarkProductivity,
    rates: [productivityRate(task.productivityRateKey, task.authorityUnit, companyHours)],
  });
  check(
    `${task.calibrationTaskKey} company hours win`,
    calibrated.hoursPerUnit === companyHours &&
      calibrated.hoursPerUnit !== benchmark.hoursPerUnit
  );
  const found = findCompanyProductivityRate(
    [productivityRate(task.productivityRateKey, task.authorityUnit, companyHours)],
    task.productivityRateKey,
    task.authorityUnit
  );
  check(
    `${task.calibrationTaskKey} findCompanyProductivityRate hits`,
    found?.cost_rate === companyHours
  );
}

function round4ForTest(value: number): number {
  return Math.round(value * 10000) / 10000;
}

const fenceWorkArea = wa();
const baselineFence = calculateFence(fenceCtx(), fenceWorkArea);
const calibratedFence = calculateFence(
  fenceCtx([
    productivityRate("fence.demolition_hours_per_lm", "lm", 0.5),
  ]),
  fenceWorkArea
);
const resetFence = calculateFence(fenceCtx(), fenceWorkArea);
const demoA = demoLine(baselineFence);
const demoB = demoLine(calibratedFence);
const demoC = demoLine(resetFence);

check("fence demolition line present", demoA != null && demoB != null);
check(
  "fence demolition quantity unchanged",
  demoA?.quantity === demoB?.quantity && demoA?.quantity === 18
);
check(
  "fence demolition hours change with company productivity",
  (demoA?.labourHours ?? 0) !== (demoB?.labourHours ?? 0) &&
    (demoB?.labourHours ?? 0) > (demoA?.labourHours ?? 0)
);
check(
  "fence demolition reset matches benchmark hours",
  demoC?.labourHours === demoA?.labourHours
);

const fenceCalc = read("lib/estimate/calculators/fence.ts");
check(
  "package lump still has no DNA catalogue row",
  !COMPANY_DNA_FOUNDATION_TASKS.some(
    (task) => task.productivityRateKey === "fence.labour_hours_per_lm"
  )
);
check(
  "package leftover path still exists (XOR preserved)",
  fenceCalc.includes('productivityKey: "fence.labour_hours_per_lm"')
);

const liveActions = read("lib/company-dna/actions.ts");
check(
  "live save uses unified foundation resolver",
  liveActions.includes("resolveCompanyDnaTask") &&
    read("lib/company-dna/resolve-task.ts").includes("getCompanyDnaFoundationTask")
);
check(
  "V1 live lookup helper still exists",
  read("lib/company-dna/catalogue.ts").includes("export function getCompanyDnaTask")
);
check(
  "live hub uses V2 overlay for Deck/Fence and V1 list for RW",
  read("lib/company-dna/v2-ui.ts").includes(
    "listCompanyDnaTasksVisibleInCurrentUi(workAreaType)"
  ) &&
    read("lib/company-dna/v2-ui.ts").includes('if (workAreaType === "fence")') &&
    read("components/company-dna/CompanyDnaHub.tsx").includes("isCompanyDnaV2WorkArea")
);

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
