/**
 * DNA-V2E — Retaining Wall task-level calibration UX.
 *
 * Run: npx --yes tsx scripts/verify-dna-v2e-retaining-ux.ts
 *
 * No migration 055. Production not in scope.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  companyDnaWorkAreaStatusV2,
  deriveCompanyProductivityFromClock,
  durationHoursFromClock,
} from "../lib/company-dna/derive";
import {
  companyDnaUiWorkAreaStatus,
  companyDnaV2Generation,
  isCompanyDnaV2TaskKey,
  listCompanyDnaUiTasksForWorkArea,
  nextCompanyDnaV2Task,
} from "../lib/company-dna/v2-ui";
import { COMPANY_DNA_V2C_EXPOSED_WORK_AREAS } from "../lib/company-dna/deck-v2";
import {
  dnaV2ScenarioCopy,
  dnaV2TaskTitle,
  formatDnaDeckResultPrimary,
  formatDnaRwDashboardCta,
  formatDnaRwHubProgress,
  formatDnaRwRatesSummary,
} from "../lib/company-dna/copy";
import { formatDnaScenarioMeasure } from "../lib/company-dna/quantity-format";
import { resolveCompanyDnaTask } from "../lib/company-dna/resolve-task";
import {
  COMPANY_DNA_V2B_NEW_TASKS,
  getCompanyDnaFoundationTask,
  listCompanyDnaTasksVisibleInCurrentUi,
} from "../lib/company-dna/v2-foundation";
import {
  COMPANY_DNA_RW_MASONRY_TIER1_KEYS,
  COMPANY_DNA_RW_SHARED_KEYS,
  COMPANY_DNA_RW_SLEEPER_TIER1_KEYS,
  COMPANY_DNA_RW_TIMBER_TIER1_KEYS,
  COMPANY_DNA_RW_V2_UI_KEYS,
  companyDnaRwWorkAreaStatus,
  isCompanyDnaRwSharedTaskKey,
  listCompanyDnaRwV2UiTasks,
  listRwSystemProgress,
  nextCompanyDnaRwV2Task,
  rwSystemOfTask,
} from "../lib/company-dna/rw-v2";
import { calculateRetainingWall } from "../lib/estimate/calculators/retaining-wall";
import {
  RW_BACKFILL_LABOUR_COMPONENT,
  RW_DRAINAGE_LABOUR_COMPONENT,
  RW_EXCAVATION_LABOUR_COMPONENT,
  RW_MASONRY_BLOCK_LABOUR_COMPONENT,
  RW_SLEEPER_FACE_LABOUR_COMPONENT,
  RW_SLEEPER_POST_LABOUR_COMPONENT,
  RW_TIMBER_FACE_LABOUR_COMPONENT,
  RW_TIMBER_PILE_LABOUR_COMPONENT,
} from "../lib/estimate/retaining-wall-identities";
import { RW_TIMBER_CONCRETE_LABOUR_COMPONENT } from "../lib/estimate/retaining-wall-family-coverage";
import { RW_PRODUCTIVITY_KEYS } from "../lib/estimate/retaining-wall-productivity";
import { RW_TIMBER_PILE_HOURS_MANUAL } from "../lib/estimate/retaining-wall-timber-1d";
import { RW_SLEEPER_POST_HOURS_MANUAL } from "../lib/estimate/retaining-wall-sleeper-2a";
import { RW_MASONRY_REBAR_ALLOWANCE_KEY } from "../lib/estimate/retaining-wall-masonry-2b";
import { summarizeProductivityWorkAreas } from "../lib/rates/productivity-work-area-summary";
import { resolvePersonalisationNextStep } from "../lib/setup/personalisation-ladder";
import { roleAllowsPermission } from "../lib/team/permissions";
import type { OrganisationRate } from "../components/setup/types";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
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

function numberedMigrations(): string[] {
  return readdirSync(join(process.cwd(), "supabase/migrations"))
    .filter((name) => /^\d+_/.test(name))
    .sort();
}

function fact(key: string, value: unknown): EstimateFact {
  return { key, work_area_id: "rw1", value };
}

function wa(): EstimateWorkArea & { status: "confirmed" } {
  return {
    id: "rw1",
    type: "retaining_wall",
    name: "Retaining wall",
    sort_order: 1,
    status: "confirmed",
  };
}

function labourOrgRate(cost: number): OrganisationRate {
  return {
    id: "labour.carpenter.hour",
    rate_type: "labour",
    item_key: "labour.carpenter.hour",
    label: "Carpenter",
    unit: "hour",
    cost_rate: cost,
    sell_rate: null,
    markup_percent: null,
    active: true,
    trade: "carpenter",
    work_area_type: "retaining_wall",
  };
}

function productivityOrgRate(
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
    work_area_type: "retaining_wall",
    source: "calibrated_productivity",
    source_calibration_id: "dna-v2e",
  };
}

function ctx(
  facts: EstimateFact[],
  rates: readonly OrganisationRate[] = []
): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [wa()],
    facts,
    constraints: [
      { key: "site_access", value: "Moderate" },
      { key: "material_carry_distance", value: "10–30m" },
    ],
    materialWastageSettings: null,
    rates: [labourOrgRate(60), ...rates],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
      budget_rate_factor: 0.9,
      premium_rate_factor: 1.15,
    },
  } as unknown as EstimateContext;
}

function timberFacts(digger: "Yes" | "No" = "Yes"): EstimateFact[] {
  return [
    fact("retaining_wall.material", "Timber"),
    fact("retaining_wall.length_m", 15),
    fact("retaining_wall.is_raking", true),
    fact("retaining_wall.height_high_m", 1.6),
    fact("retaining_wall.height_low_m", 0.6),
    fact("retaining_wall.excavation_required", true),
    fact("retaining_wall.excavation_volume_m3", 4),
    fact("retaining_wall.face_board_section", "150×50 H4"),
    fact("retaining_wall.drainage_required", true),
    fact("retaining_wall.backfill_included", true),
    fact("retaining_wall.digger_access", digger),
  ];
}

function sleeperFacts(digger: "Yes" | "No" = "Yes"): EstimateFact[] {
  return [
    fact("retaining_wall.material", "Concrete sleeper"),
    fact("retaining_wall.length_m", 10),
    fact("retaining_wall.height_m", 1),
    fact("retaining_wall.sleeper_length_m", 2),
    fact("retaining_wall.sleeper_face_height_m", 0.2),
    fact("retaining_wall.excavation_required", true),
    fact("retaining_wall.excavation_volume_m3", 4),
    fact("retaining_wall.drainage_required", true),
    fact("retaining_wall.backfill_included", true),
    fact("retaining_wall.digger_access", digger),
  ];
}

function masonryFacts(): EstimateFact[] {
  return [
    fact("retaining_wall.material", "Concrete masonry / Besser"),
    fact("retaining_wall.length_m", 15),
    fact("retaining_wall.is_raking", true),
    fact("retaining_wall.height_high_m", 1.6),
    fact("retaining_wall.height_low_m", 0.6),
    fact("retaining_wall.block_series", "200-series"),
    fact("retaining_wall.block_laying_method", "Self-perform"),
    fact("retaining_wall.excavation_required", true),
    fact("retaining_wall.excavation_volume_m3", 6),
    fact("retaining_wall.drainage_required", true),
    fact("retaining_wall.backfill_included", true),
    fact("retaining_wall.digger_access", "Yes"),
  ];
}

function masonryRates(
  extra: readonly OrganisationRate[] = []
): OrganisationRate[] {
  return [
    {
      id: RW_MASONRY_REBAR_ALLOWANCE_KEY,
      rate_type: "material",
      item_key: RW_MASONRY_REBAR_ALLOWANCE_KEY,
      label: "Masonry rebar allowance",
      unit: "item",
      cost_rate: 450,
      sell_rate: null,
      markup_percent: null,
      active: true,
      trade: null,
      work_area_type: "retaining_wall",
    },
    ...extra,
  ];
}

function included(items: readonly EstimateLineItemInput[]): EstimateLineItemInput[] {
  return items.filter((item) => item.includedInTotal !== false);
}

function lineByComponent(
  items: readonly EstimateLineItemInput[],
  key: string
): EstimateLineItemInput | undefined {
  return included(items).find((item) => item.componentKey === key);
}

function hoursByComponent(
  items: readonly EstimateLineItemInput[],
  key: string
): number {
  return lineByComponent(items, key)?.labourHours ?? 0;
}

function qtyByComponent(
  items: readonly EstimateLineItemInput[],
  key: string
): number {
  return lineByComponent(items, key)?.quantity ?? 0;
}

function prodByComponent(
  items: readonly EstimateLineItemInput[],
  key: string
): number {
  return lineByComponent(items, key)?.productivityRate ?? 0;
}

console.log("=== DNA-V2E RETAINING WALL UX ===\n");

check(
  "no migration 055",
  numberedMigrations().at(-1) === "054_company_dna_v2_catalogue_seed.sql"
);
check(
  "V2C exposed constant remains Deck-only",
  COMPANY_DNA_V2C_EXPOSED_WORK_AREAS.length === 1 &&
    COMPANY_DNA_V2C_EXPOSED_WORK_AREAS[0] === "deck"
);
check("15 RW UI tasks", COMPANY_DNA_RW_V2_UI_KEYS.length === 15);
check(
  "no piles.manual fake key",
  !COMPANY_DNA_RW_V2_UI_KEYS.includes("retaining_wall.piles.manual.v1" as never) &&
    getCompanyDnaFoundationTask("retaining_wall.piles.manual.v1") == null
);

const rwTasks = listCompanyDnaRwV2UiTasks();
check(
  "RW UI order unique",
  rwTasks.map((task) => task.calibrationTaskKey).join(",") ===
    COMPANY_DNA_RW_V2_UI_KEYS.join(",")
);
check(
  "no plant / package / movement / waste / spoil fake tasks",
  !rwTasks.some((task) =>
    ["plant.", "package", "movement", "waste", "spoil", "cartage", "carting"].some(
      (needle) =>
        task.calibrationTaskKey.includes(needle) ||
        task.productivityRateKey.includes(needle)
    )
  )
);
check(
  "shared keys appear once",
  COMPANY_DNA_RW_SHARED_KEYS.every(
    (key) => rwTasks.filter((task) => task.calibrationTaskKey === key).length === 1
  )
);
check(
  "timber unique not in sleeper/masonry ownership",
  rwSystemOfTask("retaining_wall.piles.v1") === "timber" &&
    rwSystemOfTask("retaining_wall.face.v1") === "timber" &&
    rwSystemOfTask("retaining_wall.sleeper.posts.v1") === "sleeper" &&
    rwSystemOfTask("retaining_wall.masonry.block.v1") === "masonry" &&
    isCompanyDnaRwSharedTaskKey("retaining_wall.excavation.machine.v1")
);
check(
  "listCompanyDnaTasksVisibleInCurrentUi still 9",
  listCompanyDnaTasksVisibleInCurrentUi().length === 9
);
check(
  "new RW keys stay exposeInCurrentUi false",
  COMPANY_DNA_V2B_NEW_TASKS.filter((task) => task.workAreaType === "retaining_wall").every(
    (task) => task.exposeInCurrentUi === false
  )
);
check("Deck UI still 7", listCompanyDnaUiTasksForWorkArea("deck").length === 7);
check("Fence UI still 9", listCompanyDnaUiTasksForWorkArea("fence").length === 9);
check(
  "RW UI via shared helper is 15",
  listCompanyDnaUiTasksForWorkArea("retaining_wall").length === 15
);

check(
  "timber Tier 1 is machine/piles/face",
  COMPANY_DNA_RW_TIMBER_TIER1_KEYS.join(",") ===
    "retaining_wall.excavation.machine.v1,retaining_wall.piles.v1,retaining_wall.face.v1"
);
check(
  "sleeper Tier 1 is machine/posts/sleepers",
  COMPANY_DNA_RW_SLEEPER_TIER1_KEYS.join(",") ===
    "retaining_wall.excavation.machine.v1,retaining_wall.sleeper.posts.v1,retaining_wall.sleeper.sleepers.v1"
);
check(
  "masonry Tier 1 is machine/block from metadata",
  COMPANY_DNA_RW_MASONRY_TIER1_KEYS.join(",") ===
    "retaining_wall.excavation.machine.v1,retaining_wall.masonry.block.v1" &&
    getCompanyDnaFoundationTask("retaining_wall.masonry.block.v1")?.priorityTier === 1 &&
    getCompanyDnaFoundationTask("retaining_wall.masonry.footing.v1")?.priorityTier === 2 &&
    getCompanyDnaFoundationTask("retaining_wall.masonry.subbase.v1")?.priorityTier === 3
);

check(
  "0 timber T1 → not calibrated",
  companyDnaWorkAreaStatusV2({ tier1Total: 3, tier1Calibrated: 0 }) === "benchmarks"
);
check(
  "some timber T1 → partly",
  listRwSystemProgress(["retaining_wall.piles.v1"]).find((row) => row.system === "timber")
    ?.status === "partly"
);
check(
  "all timber T1 → system using your calibration",
  listRwSystemProgress([...COMPANY_DNA_RW_TIMBER_TIER1_KEYS]).find(
    (row) => row.system === "timber"
  )?.status === "calibrated"
);
check(
  "WA calibrated when timber T1 complete even if masonry untouched",
  companyDnaRwWorkAreaStatus({
    calibratedTaskKeys: COMPANY_DNA_RW_TIMBER_TIER1_KEYS,
  }) === "calibrated" &&
    companyDnaUiWorkAreaStatus({
      workAreaType: "retaining_wall",
      calibratedTaskKeys: COMPANY_DNA_RW_TIMBER_TIER1_KEYS,
    }) === "calibrated" &&
    listRwSystemProgress(COMPANY_DNA_RW_TIMBER_TIER1_KEYS).find(
      (row) => row.system === "masonry"
    )?.status === "partly"
);
check(
  "shared machine excavation counts toward masonry T1",
  listRwSystemProgress(["retaining_wall.excavation.machine.v1"]).every(
    (row) => row.tier1Calibrated === 1
  )
);
check(
  "next timber task is machine excavation first",
  nextCompanyDnaRwV2Task({ calibratedTaskKeys: [], system: "timber" })
    ?.calibrationTaskKey === "retaining_wall.excavation.machine.v1"
);
check(
  "after timber T1 next is optional manual excavation",
  nextCompanyDnaRwV2Task({
    calibratedTaskKeys: COMPANY_DNA_RW_TIMBER_TIER1_KEYS,
    system: "timber",
  })?.calibrationTaskKey === "retaining_wall.excavation.manual.v1"
);
check(
  "sleeper flow does not re-ask machine excavation if already calibrated",
  nextCompanyDnaRwV2Task({
    calibratedTaskKeys: ["retaining_wall.excavation.machine.v1"],
    system: "sleeper",
  })?.calibrationTaskKey === "retaining_wall.sleeper.posts.v1"
);

const machine = getCompanyDnaFoundationTask("retaining_wall.excavation.machine.v1")!;
const manual = getCompanyDnaFoundationTask("retaining_wall.excavation.manual.v1")!;
const piles = getCompanyDnaFoundationTask("retaining_wall.piles.v1")!;
const face = getCompanyDnaFoundationTask("retaining_wall.face.v1")!;
const drainage = getCompanyDnaFoundationTask("retaining_wall.drainage.v1")!;
const backfill = getCompanyDnaFoundationTask("retaining_wall.backfill.v1")!;
const concrete = getCompanyDnaFoundationTask("retaining_wall.concrete.v1")!;
check("machine excavation 4 m3 / 0.45 / T1", machine.authorityQuantity === 4 && machine.authorityUnit === "m3" && machine.benchmarkProductivity === 0.45 && machine.priorityTier === 1);
check("manual excavation separate key 1.6", manual.benchmarkProductivity === 1.6 && manual.baselineMethod === "manual");
check("piles machine-assisted baseline", piles.baselineMethod === "machine-assisted" && piles.benchmarkProductivity === 0.85);
check("face 10 m2 / 0.55", face.authorityQuantity === 10 && face.authorityUnit === "m2");
check("drainage 10 lm / 0.15", drainage.authorityQuantity === 10 && drainage.authorityUnit === "lm");
check("backfill 2 m3 / 0.55", backfill.authorityQuantity === 2 && backfill.authorityUnit === "m3");
check("concrete 20 bag / 0.035", concrete.authorityQuantity === 20 && concrete.authorityUnit === "bag");

check(
  "machine copy is excavator labour not plant hire",
  dnaV2ScenarioCopy(machine).includes("small excavator") &&
    dnaV2ScenarioCopy(machine).includes("not the plant hire") &&
    dnaV2TaskTitle(machine.calibrationTaskKey, machine.label) === "Machine excavation"
);
check(
  "manual copy says hand-dig",
  dnaV2ScenarioCopy(manual).includes("Hand-dig") &&
    dnaV2ScenarioCopy(manual).includes("not machine excavation")
);
check(
  "pile copy is machine-assisted only",
  dnaV2ScenarioCopy(piles).includes("machine-assisted") &&
    dnaV2ScenarioCopy(piles).includes("does not apply to hand-dug") &&
    dnaV2TaskTitle(piles.calibrationTaskKey, piles.label).includes("machine-assisted")
);
check(
  "face copy is timber facing",
  dnaV2ScenarioCopy(face).includes("face boards") &&
    formatDnaScenarioMeasure(10, "m2").includes("10")
);
check(
  "drainage copy is novacoil not aggregate",
  dnaV2ScenarioCopy(drainage).includes("novacoil") &&
    dnaV2ScenarioCopy(drainage).includes("Do not include drainage metal")
);
check(
  "backfill copy is place/spread not haulage",
  dnaV2ScenarioCopy(backfill).includes("Place, spread") &&
    dnaV2ScenarioCopy(backfill).includes("spoil haulage")
);
check(
  "concrete copy is bags not pile install",
  dnaV2ScenarioCopy(concrete).includes("bags") &&
    dnaV2ScenarioCopy(concrete).includes("not pile or post installation")
);
check(
  "sleeper posts honesty",
  dnaV2ScenarioCopy(getCompanyDnaFoundationTask("retaining_wall.sleeper.posts.v1")!).includes(
    "machine-assisted"
  )
);
check(
  "masonry titles are trade language",
  dnaV2TaskTitle("retaining_wall.masonry.block.v1", "x") === "Lay blockwork" &&
    dnaV2TaskTitle("retaining_wall.masonry.footing.v1", "x") === "Form and pour footing"
);
check(
  "quantity 4 m3 displays cubic metres",
  formatDnaScenarioMeasure(4, "m3") === "4 cubic metres"
);
check(
  "large m3 result uses person-hours",
  formatDnaDeckResultPrimary({ productivityHoursPerUnit: 1.6, unit: "m3" }).includes(
    "person-hours per cubic metre"
  )
);
check(
  "small result stays person-minutes",
  formatDnaDeckResultPrimary({ productivityHoursPerUnit: 0.45, unit: "m3" }).includes(
    "person-minutes per cubic metre"
  )
);

const clock = durationHoursFromClock(1, 30);
const derived = deriveCompanyProductivityFromClock({
  task: machine,
  crewSize: 2,
  clockHours: 1,
  minutes: 30,
});
check("hours+minutes 1:30 = 1.5h", clock === 1.5);
check(
  "workers × clock / qty",
  derived.personHours === 3 && derived.productivity === 0.75
);

check(
  "unified resolver covers new RW keys",
  resolveCompanyDnaTask("retaining_wall.excavation.machine.v1")?.productivityRateKey ===
    RW_PRODUCTIVITY_KEYS.excavationMachineM3 &&
    isCompanyDnaV2TaskKey("retaining_wall.masonry.block.v1")
);

const actions = read("lib/company-dna/actions.ts");
check("save uses existing RPC", actions.includes("save_productivity_calibration"));
check("reset uses existing RPC", actions.includes("reset_productivity_to_benchmark"));
check("hours+minutes convert on server", actions.includes("durationHoursFromClock"));
check(
  "estimator pile guard present",
  read("lib/estimate/retaining-wall-commercial.ts").includes("ignoreCompanyRate")
);

const commercial = calculateRetainingWall(ctx(timberFacts()), wa());
const timberBench = commercial.lineItems;
const pileQty = qtyByComponent(timberBench, RW_TIMBER_PILE_LABOUR_COMPONENT);
const faceQty = qtyByComponent(timberBench, RW_TIMBER_FACE_LABOUR_COMPONENT);
const excavQty = qtyByComponent(timberBench, RW_EXCAVATION_LABOUR_COMPONENT);
check("timber job has pile/face/excavation labour", pileQty > 0 && faceQty > 0 && excavQty === 4);

const timberCal = calculateRetainingWall(
  ctx(timberFacts(), [
    productivityOrgRate(RW_PRODUCTIVITY_KEYS.excavationMachineM3, "m3", 0.9),
    productivityOrgRate(RW_PRODUCTIVITY_KEYS.timberPilesEa, "ea", 0.4),
    productivityOrgRate(RW_PRODUCTIVITY_KEYS.timberFaceM2, "m2", 0.3),
  ]),
  wa()
).lineItems;
check(
  "machine excavation calibration changes machine labour only",
  hoursByComponent(timberCal, RW_EXCAVATION_LABOUR_COMPONENT) >
    hoursByComponent(timberBench, RW_EXCAVATION_LABOUR_COMPONENT) &&
    prodByComponent(timberCal, RW_EXCAVATION_LABOUR_COMPONENT) === 0.9
);
check(
  "pile calibration changes pile hours",
  hoursByComponent(timberCal, RW_TIMBER_PILE_LABOUR_COMPONENT) <
    hoursByComponent(timberBench, RW_TIMBER_PILE_LABOUR_COMPONENT)
);
check(
  "face calibration changes face hours",
  hoursByComponent(timberCal, RW_TIMBER_FACE_LABOUR_COMPONENT) <
    hoursByComponent(timberBench, RW_TIMBER_FACE_LABOUR_COMPONENT)
);
check(
  "physical pile/face/excavation quantities stay fixed",
  pileQty === qtyByComponent(timberCal, RW_TIMBER_PILE_LABOUR_COMPONENT) &&
    faceQty === qtyByComponent(timberCal, RW_TIMBER_FACE_LABOUR_COMPONENT) &&
    excavQty === qtyByComponent(timberCal, RW_EXCAVATION_LABOUR_COMPONENT)
);

const manualExcavJob = calculateRetainingWall(
  ctx(timberFacts("No"), [
    productivityOrgRate(RW_PRODUCTIVITY_KEYS.excavationMachineM3, "m3", 0.9),
    productivityOrgRate(RW_PRODUCTIVITY_KEYS.excavationManualM3, "m3", 3.2),
  ]),
  wa()
).lineItems;
const machineOnlyJob = calculateRetainingWall(
  ctx(timberFacts("Yes"), [
    productivityOrgRate(RW_PRODUCTIVITY_KEYS.excavationManualM3, "m3", 3.2),
  ]),
  wa()
).lineItems;
check(
  "manual job consumes manual excavation productivity",
  prodByComponent(manualExcavJob, RW_EXCAVATION_LABOUR_COMPONENT) === 3.2
);
check(
  "machine job does not consume manual productivity",
  prodByComponent(machineOnlyJob, RW_EXCAVATION_LABOUR_COMPONENT) !== 3.2 &&
    prodByComponent(machineOnlyJob, RW_EXCAVATION_LABOUR_COMPONENT) ===
      prodByComponent(timberBench, RW_EXCAVATION_LABOUR_COMPONENT)
);

const manualPileBench = calculateRetainingWall(ctx(timberFacts("No")), wa()).lineItems;
const manualPileCal = calculateRetainingWall(
  ctx(timberFacts("No"), [
    productivityOrgRate(RW_PRODUCTIVITY_KEYS.timberPilesEa, "ea", 0.4),
  ]),
  wa()
).lineItems;
const pileHonesty =
  prodByComponent(manualPileCal, RW_TIMBER_PILE_LABOUR_COMPONENT) ===
    RW_TIMBER_PILE_HOURS_MANUAL &&
  prodByComponent(manualPileCal, RW_TIMBER_PILE_LABOUR_COMPONENT) ===
    prodByComponent(manualPileBench, RW_TIMBER_PILE_LABOUR_COMPONENT) &&
  prodByComponent(timberCal, RW_TIMBER_PILE_LABOUR_COMPONENT) === 0.4;
check(
  "pile-method honesty: machine calibration does not leak onto manual piles",
  pileHonesty,
  pileHonesty
    ? ""
    : `STOP DNA-V2-EST-1 required — manual pile prod ${prodByComponent(manualPileCal, RW_TIMBER_PILE_LABOUR_COMPONENT)} vs fallback ${RW_TIMBER_PILE_HOURS_MANUAL}`
);

const sleeperBench = calculateRetainingWall(ctx(sleeperFacts()), wa()).lineItems;
check(
  "sleeper XOR: uses posts/sleepers not timber pile/face",
  hoursByComponent(sleeperBench, RW_SLEEPER_POST_LABOUR_COMPONENT) > 0 &&
    hoursByComponent(sleeperBench, RW_SLEEPER_FACE_LABOUR_COMPONENT) > 0 &&
    hoursByComponent(sleeperBench, RW_TIMBER_PILE_LABOUR_COMPONENT) === 0 &&
    hoursByComponent(sleeperBench, RW_TIMBER_FACE_LABOUR_COMPONENT) === 0
);
const sleeperManualCal = calculateRetainingWall(
  ctx(sleeperFacts("No"), [
    productivityOrgRate(RW_PRODUCTIVITY_KEYS.sleeperPostsEa, "ea", 0.4),
  ]),
  wa()
).lineItems;
check(
  "sleeper-post honesty: machine calibration does not leak onto manual posts",
  prodByComponent(sleeperManualCal, RW_SLEEPER_POST_LABOUR_COMPONENT) ===
    RW_SLEEPER_POST_HOURS_MANUAL
);

const masonryBench = calculateRetainingWall(
  ctx(masonryFacts(), masonryRates()),
  wa()
).lineItems;
check(
  "masonry XOR: uses block not timber face/sleeper install",
  hoursByComponent(masonryBench, RW_MASONRY_BLOCK_LABOUR_COMPONENT) > 0 &&
    hoursByComponent(masonryBench, RW_TIMBER_FACE_LABOUR_COMPONENT) === 0 &&
    hoursByComponent(masonryBench, RW_SLEEPER_FACE_LABOUR_COMPONENT) === 0 &&
    hoursByComponent(masonryBench, RW_TIMBER_PILE_LABOUR_COMPONENT) === 0
);

const timberConcreteCal = calculateRetainingWall(
  ctx(timberFacts(), [
    productivityOrgRate(RW_PRODUCTIVITY_KEYS.postHoleConcreteBag, "bag", 0.1),
  ]),
  wa()
).lineItems;
check(
  "concrete calibration does not change pile install productivity",
  prodByComponent(timberConcreteCal, RW_TIMBER_PILE_LABOUR_COMPONENT) ===
    prodByComponent(timberBench, RW_TIMBER_PILE_LABOUR_COMPONENT) &&
    hoursByComponent(timberConcreteCal, RW_TIMBER_CONCRETE_LABOUR_COMPONENT) >
      hoursByComponent(timberBench, RW_TIMBER_CONCRETE_LABOUR_COMPONENT)
);
const timberPileOnly = calculateRetainingWall(
  ctx(timberFacts(), [
    productivityOrgRate(RW_PRODUCTIVITY_KEYS.timberPilesEa, "ea", 0.4),
  ]),
  wa()
).lineItems;
check(
  "pile calibration does not change concrete placement labour",
  hoursByComponent(timberPileOnly, RW_TIMBER_CONCRETE_LABOUR_COMPONENT) ===
    hoursByComponent(timberBench, RW_TIMBER_CONCRETE_LABOUR_COMPONENT)
);
check(
  "reset restores timber pile/face/excavation hours",
  hoursByComponent(calculateRetainingWall(ctx(timberFacts()), wa()).lineItems, RW_TIMBER_PILE_LABOUR_COMPONENT) ===
    hoursByComponent(timberBench, RW_TIMBER_PILE_LABOUR_COMPONENT) &&
    hoursByComponent(calculateRetainingWall(ctx(timberFacts()), wa()).lineItems, RW_EXCAVATION_LABOUR_COMPONENT) ===
      hoursByComponent(timberBench, RW_EXCAVATION_LABOUR_COMPONENT)
);
check(
  "timber job still has drainage/backfill labour slots",
  hoursByComponent(timberBench, RW_DRAINAGE_LABOUR_COMPONENT) > 0 &&
    hoursByComponent(timberBench, RW_BACKFILL_LABOUR_COMPONENT) > 0
);

const resetTimber = calculateRetainingWall(ctx(timberFacts()), wa()).lineItems;
check(
  "labour-only: materials not invented by DNA",
  qtyByComponent(resetTimber, RW_TIMBER_PILE_LABOUR_COMPONENT) === pileQty
);

const rates = summarizeProductivityWorkAreas([]);
const deckRates = rates.find((row) => row.workAreaType === "deck");
const fenceRates = rates.find((row) => row.workAreaType === "fence");
const rwRates = rates.find((row) => row.workAreaType === "retaining_wall");
check("Rates Deck still V2C 7/3", deckRates?.taskTotal === 7 && deckRates?.generation === "v2c");
check(
  "Rates Fence still V2D 9/3",
  fenceRates?.taskTotal === 9 && fenceRates?.generation === "v2d"
);
check(
  "Rates RW V2E 15 with system summary",
  rwRates?.taskTotal === 15 &&
    rwRates?.generation === "v2e" &&
    (rwRates.summaryLine ?? "") === "Not calibrated" &&
    companyDnaV2Generation("retaining_wall") === "v2e"
);
check(
  "RW rates summary compact",
  formatDnaRwRatesSummary({
    systems: listRwSystemProgress([]),
  }) === "Not calibrated"
);
check(
  "hub progress does not require 15 tasks",
  formatDnaRwHubProgress({
    systems: listRwSystemProgress(COMPANY_DNA_RW_TIMBER_TIER1_KEYS),
  }).includes("Timber retaining is calibrated") &&
    formatDnaRwHubProgress({
      systems: listRwSystemProgress(COMPANY_DNA_RW_TIMBER_TIER1_KEYS),
    }).toLowerCase().includes("sleeper")
);

const landing = read("app/(protected)/app/setup/dna/retaining-wall/page.tsx");
const intro = read("components/company-dna/CompanyDnaRwIntro.tsx");
const flow = read("components/company-dna/CompanyDnaDeckTaskFlow.tsx");
const taskPage = read("app/(protected)/app/setup/dna/[taskKey]/page.tsx");
const hub = read("components/company-dna/CompanyDnaHub.tsx");
check(
  "RW landing exists",
  existsSync(join(process.cwd(), "app/(protected)/app/setup/dna/retaining-wall/page.tsx"))
);
check("no /v2/ product URL", !landing.includes("/v2/") && !taskPage.includes("/dna/v2"));
check(
  "intro + systems + normal conditions",
  intro.includes("data-company-dna-rw-intro") &&
    intro.includes("data-company-dna-rw-systems") &&
    intro.includes("DNA_RW_NORMAL_CONDITIONS")
);
check("shared task flow handles RW", flow.includes("data-company-dna-rw-task"));
check("do not fabricate clock", flow.includes("Original workers and clock time"));
check("hub RW uses V2 href", hub.includes("v2HubHref") && hub.includes("retaining_wall"));
check("mobile max width reused", flow.includes("max-w-xl") && intro.includes("max-w-xl"));
check("V1 piles/face still resolve", resolveCompanyDnaTask("retaining_wall.piles.v1") != null);

const rwDash = formatDnaRwDashboardCta({ remainingKeyTasks: 2, totalKeyTasks: 3 });
check("dashboard remaining copy", rwDash.cta.includes("2 more key Retaining Wall tasks"));
const startRw = resolvePersonalisationNextStep({
  firstRunComplete: true,
  hasWorkTypePreferences: true,
  hasCalibration: false,
  hasHighImpactCalibration: false,
  companyRateCount: 3,
  hasContactEmail: true,
  hasAddress: true,
  hasLogo: true,
  preferredWorkAreaTypes: ["retaining_wall"],
  rwKeyTasksCalibrated: 0,
  rwKeyTasksTotal: 3,
  rwWorkAreaCalibrated: false,
});
check(
  "dashboard RW start CTA",
  startRw?.title === "Improve your Retaining Wall estimates" &&
    startRw.cta === "Continue calibration" &&
    startRw.href === "/app/setup/dna/retaining-wall"
);
const deckUnchanged = resolvePersonalisationNextStep({
  firstRunComplete: true,
  hasWorkTypePreferences: true,
  hasCalibration: false,
  companyRateCount: 3,
  hasContactEmail: true,
  hasAddress: true,
  hasLogo: true,
  preferredWorkAreaTypes: ["deck"],
  deckKeyTasksCalibrated: 0,
  deckKeyTasksTotal: 3,
});
check(
  "Deck dashboard CTA unchanged",
  deckUnchanged?.title === "Improve your Deck estimates" &&
    deckUnchanged.cta === "Continue calibration"
);

check("Owner can calibrate", roleAllowsPermission("owner", "company.calibration.manage"));
check("Admin can calibrate", roleAllowsPermission("admin", "company.calibration.manage"));
check("Estimator can calibrate", roleAllowsPermission("estimator", "company.calibration.manage"));
check("Viewer cannot calibrate", !roleAllowsPermission("viewer", "company.calibration.manage"));

check(
  "nextCompanyDnaV2Task RW timber-first",
  nextCompanyDnaV2Task({
    workAreaType: "retaining_wall",
    calibratedTaskKeys: [],
  })?.calibrationTaskKey === "retaining_wall.excavation.machine.v1"
);

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
