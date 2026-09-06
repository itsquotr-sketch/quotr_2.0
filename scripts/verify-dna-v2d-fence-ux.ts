/**
 * DNA-V2D — Fence task-level calibration UX + quantity presentation.
 *
 * Run: npx --yes tsx scripts/verify-dna-v2d-fence-ux.ts
 *
 * No migration 055. RW V2 UI not exposed. Production not in scope.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getCompanyDnaTask } from "../lib/company-dna/catalogue";
import {
  companyDnaWorkAreaStatusV2,
  deriveCompanyProductivityFromClock,
  durationHoursFromClock,
} from "../lib/company-dna/derive";
import {
  COMPANY_DNA_FENCE_OPTIONAL_KEYS,
  COMPANY_DNA_FENCE_TIER1_KEYS,
  COMPANY_DNA_FENCE_V2_UI_KEYS,
  companyDnaUiWorkAreaStatus,
  isCompanyDnaFenceV2TaskKey,
  listCompanyDnaFenceV2UiTasks,
  listCompanyDnaUiTasksForWorkArea,
  nextCompanyDnaV2Task,
} from "../lib/company-dna/v2-ui";
import { COMPANY_DNA_V2C_EXPOSED_WORK_AREAS } from "../lib/company-dna/deck-v2";
import {
  dnaV2ScenarioCopy,
  dnaV2TaskTitle,
  formatDnaFenceDashboardCta,
} from "../lib/company-dna/copy";
import {
  formatDnaProductivityHours,
  formatDnaScenarioMeasure,
  formatDnaScenarioQuantity,
} from "../lib/company-dna/quantity-format";
import { resolveCompanyDnaTask } from "../lib/company-dna/resolve-task";
import {
  COMPANY_DNA_V2B_NEW_TASKS,
  getCompanyDnaFoundationTask,
  listCompanyDnaTasksVisibleInCurrentUi,
} from "../lib/company-dna/v2-foundation";
import { calculateFence } from "../lib/estimate/calculators/fence";
import { FENCE_PRODUCTIVITY_KEYS } from "../lib/estimate/fence-productivity";
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
  return { key, work_area_id: "f1", value };
}

function wa(): EstimateWorkArea & { status: "confirmed" } {
  return { id: "f1", type: "fence", name: "Fence", sort_order: 1, status: "confirmed" };
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
    work_area_type: "fence",
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
    work_area_type: "fence",
    source: "calibrated_productivity",
    source_calibration_id: "dna-v2d",
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

function timberVertical(): EstimateFact[] {
  return [
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
}

function timberHorizontal(): EstimateFact[] {
  return [
    fact("fence.length_m", 18),
    fact("fence.height_m", 1.8),
    fact("fence.system", "Horizontal timber slats"),
    fact("fence.timber_species", "Macrocarpa"),
    fact("fence.board_thickness_mm", "150 × 25mm"),
    fact("fence.post_spacing_m", 1.8),
    fact("fence.gate_included", false),
    fact("fence.top_capping", "No"),
    fact("fence.slat_gap_mm", 10),
  ];
}

function aluminiumModular(): EstimateFact[] {
  return [
    fact("fence.length_m", 18),
    fact("fence.height_m", 1.8),
    fact("fence.system", "Aluminium / steel slat fence"),
    fact("fence.metal_material", "Aluminium"),
    fact("fence.section_width_m", 1.8),
    fact("fence.gate_included", false),
  ];
}

function included(items: readonly EstimateLineItemInput[]): EstimateLineItemInput[] {
  return items.filter((item) => item.includedInTotal !== false);
}

function hoursByLabel(items: readonly EstimateLineItemInput[], label: string): number {
  return included(items).find((item) => item.label === label)?.labourHours ?? 0;
}

function qtyByLabel(items: readonly EstimateLineItemInput[], label: string): number {
  return included(items).find((item) => item.label === label)?.quantity ?? 0;
}

function sellByLabel(items: readonly EstimateLineItemInput[], label: string): number {
  return included(items).find((item) => item.label === label)?.recommendedSell ?? 0;
}

console.log("=== DNA-V2D FENCE UX ===\n");

check(
  "no migration 055",
  numberedMigrations().at(-1) === "054_company_dna_v2_catalogue_seed.sql"
);
check(
  "V2C exposed constant remains Deck-only",
  COMPANY_DNA_V2C_EXPOSED_WORK_AREAS.length === 1 &&
    COMPANY_DNA_V2C_EXPOSED_WORK_AREAS[0] === "deck"
);
check("nine Fence UI tasks", COMPANY_DNA_FENCE_V2_UI_KEYS.length === 9);
check(
  "Fence Tier 1 is posts/rails/palings",
  COMPANY_DNA_FENCE_TIER1_KEYS.join(",") === "fence.posts.v1,fence.rails.v1,fence.boards.v1"
);
check("six optional Fence tasks", COMPANY_DNA_FENCE_OPTIONAL_KEYS.length === 6);

const fenceTasks = listCompanyDnaFenceV2UiTasks();
check(
  "Fence UI order",
  fenceTasks.map((task) => task.calibrationTaskKey).join(",") ===
    COMPANY_DNA_FENCE_V2_UI_KEYS.join(",")
);
check(
  "no package / movement / waste / cleanup keys",
  !fenceTasks.some((task) =>
    [
      "fence.labour_hours_per_lm",
      "fence.gate_hours_allowance",
      "waste",
      "carting",
      "cleanup",
      "package",
    ].some(
      (needle) =>
        task.calibrationTaskKey.includes(needle) || task.productivityRateKey.includes(needle)
    )
  )
);
check(
  "gate uses detailed install key",
  getCompanyDnaFoundationTask("fence.gate.v1")?.productivityRateKey ===
    FENCE_PRODUCTIVITY_KEYS.gateInstall &&
    getCompanyDnaFoundationTask("fence.gate.v1")?.productivityRateKey !==
      FENCE_PRODUCTIVITY_KEYS.gateAllowance
);
check("no steps in Fence UI", !fenceTasks.some((task) => task.calibrationTaskKey.includes("steps")));
check(
  "RW UI remains V1",
  listCompanyDnaUiTasksForWorkArea("retaining_wall").length === 2 &&
    !listCompanyDnaUiTasksForWorkArea("retaining_wall").some((task) =>
      task.calibrationTaskKey.includes("excavation")
    )
);
check("Deck UI still 7", listCompanyDnaUiTasksForWorkArea("deck").length === 7);
check(
  "listCompanyDnaTasksVisibleInCurrentUi still 9",
  listCompanyDnaTasksVisibleInCurrentUi().length === 9
);
check(
  "new RW keys stay hidden",
  COMPANY_DNA_V2B_NEW_TASKS.filter((task) => task.workAreaType === "retaining_wall").every(
    (task) => task.exposeInCurrentUi === false
  )
);

const posts = getCompanyDnaFoundationTask("fence.posts.v1")!;
const rails = getCompanyDnaFoundationTask("fence.rails.v1")!;
const palings = getCompanyDnaFoundationTask("fence.boards.v1")!;
const concrete = getCompanyDnaFoundationTask("fence.concrete.v1")!;
const horizontal = getCompanyDnaFoundationTask("fence.boards.horizontal.v1")!;
const sections = getCompanyDnaFoundationTask("fence.section.v1")!;
check("posts authority is 13", posts.authorityQuantity === 13 && posts.priorityTier === 1);
check("rails authority is 60 lm", rails.authorityQuantity === 60 && rails.authorityUnit === "lm");
check("palings authority stays 241.2 lm", palings.authorityQuantity === 241.2);
check("horizontal authority stays 198 lm", horizontal.authorityQuantity === 198);
check("sections authority is 8", sections.authorityQuantity === 8 && sections.authorityUnit === "section");
check(
  "posts copy excludes concrete",
  dnaV2ScenarioCopy(posts).includes("13 fence posts") &&
    dnaV2ScenarioCopy(posts).includes("Do not include mixing or placing concrete")
);
check(
  "concrete copy excludes digging",
  dnaV2ScenarioCopy(concrete).includes("20 bags") &&
    dnaV2ScenarioCopy(concrete).includes("Do not include digging holes")
);
check("rails scenario uses 60 lm", dnaV2ScenarioCopy(rails).includes("60 lineal metres"));
check(
  "palings distinguish vertical",
  dnaV2ScenarioCopy(palings).includes("vertical palings") &&
    dnaV2ScenarioCopy(palings).includes("not horizontal slats")
);
check(
  "horizontal distinguishes slats",
  dnaV2ScenarioCopy(horizontal).includes("horizontal slats") &&
    dnaV2ScenarioCopy(horizontal).includes("not vertical palings") &&
    dnaV2ScenarioCopy(horizontal).includes("18 m")
);
check(
  "modular uses section count",
  dnaV2ScenarioCopy(sections).includes("8 prefabricated fence sections")
);
check("titles are trade language", dnaV2TaskTitle("fence.boards.v1", "x") === "Palings");

check("0/3", companyDnaWorkAreaStatusV2({ tier1Total: 3, tier1Calibrated: 0 }) === "benchmarks");
check("1/3", companyDnaWorkAreaStatusV2({ tier1Total: 3, tier1Calibrated: 1 }) === "partly");
check("2/3", companyDnaWorkAreaStatusV2({ tier1Total: 3, tier1Calibrated: 2 }) === "partly");
check("3/3", companyDnaWorkAreaStatusV2({ tier1Total: 3, tier1Calibrated: 3 }) === "calibrated");
check(
  "posts+rails only is partly",
  companyDnaUiWorkAreaStatus({
    workAreaType: "fence",
    calibratedTaskKeys: ["fence.posts.v1", "fence.rails.v1"],
  }) === "partly"
);
check(
  "three Tier 1 is Fence complete",
  companyDnaUiWorkAreaStatus({
    workAreaType: "fence",
    calibratedTaskKeys: [...COMPANY_DNA_FENCE_TIER1_KEYS],
  }) === "calibrated"
);

check(
  "first incomplete is posts",
  nextCompanyDnaV2Task({ workAreaType: "fence", calibratedTaskKeys: [] })?.calibrationTaskKey ===
    "fence.posts.v1"
);
check(
  "after posts next is rails",
  nextCompanyDnaV2Task({
    workAreaType: "fence",
    calibratedTaskKeys: ["fence.posts.v1"],
  })?.calibrationTaskKey === "fence.rails.v1"
);

check("0h 15m is 0.25 clock hours", durationHoursFromClock(0, 15) === 0.25);
const derived = deriveCompanyProductivityFromClock({
  task: posts,
  crewSize: 2,
  clockHours: 4,
  minutes: 30,
});
check(
  "crew × duration productivity",
  Math.abs(derived.personHours - 9) < 1e-9 && Math.abs(derived.productivity - 9 / 13) < 0.0002
);

check(
  "quantity formatter 142.8571",
  formatDnaScenarioMeasure(142.8571, "lm") === "about 143 lineal metres"
);
check("quantity formatter 18", formatDnaScenarioMeasure(18, "lm") === "18 lineal metres");
check("quantity formatter 3 bags", formatDnaScenarioMeasure(3, "bag") === "3 bags");
check("productivity hours 0.444444", formatDnaProductivityHours(0.444444) === "0.44");
check(
  "decking copy cleaned",
  dnaV2ScenarioCopy(getCompanyDnaFoundationTask("deck.decking.v1")!).includes(
    "about 143 lineal metres"
  ) && getCompanyDnaFoundationTask("deck.decking.v1")!.authorityQuantity === 142.8571
);
check(
  "ugly decimals not shown for 142.8571",
  formatDnaScenarioQuantity(142.8571).about === true &&
    formatDnaScenarioQuantity(142.8571).display === "143"
);

check("unified resolver still foundation", resolveCompanyDnaTask("fence.capping.v1") != null);
check("V1 lookup still rejects capping", getCompanyDnaTask("fence.capping.v1") == null);
check(
  "isCompanyDnaFenceV2TaskKey",
  isCompanyDnaFenceV2TaskKey("fence.section.v1") && !isCompanyDnaFenceV2TaskKey("deck.posts.v1")
);

const actions = read("lib/company-dna/actions.ts");
check("save uses existing RPC", actions.includes("save_productivity_calibration"));
check("reset uses existing RPC", actions.includes("reset_productivity_to_benchmark"));
check("hours+minutes convert on server", actions.includes("durationHoursFromClock"));

const flow = read("components/company-dna/CompanyDnaDeckTaskFlow.tsx");
const intro = read("components/company-dna/CompanyDnaFenceIntro.tsx");
const copySrc = read("lib/company-dna/copy.ts");
const taskPage = read("app/(protected)/app/setup/dna/[taskKey]/page.tsx");
const landing = read("app/(protected)/app/setup/dna/fence/page.tsx");
check(
  "Fence landing exists",
  existsSync(join(process.cwd(), "app/(protected)/app/setup/dna/fence/page.tsx"))
);
check("no /v2/ product URL", !landing.includes("/v2/") && !taskPage.includes("/dna/v2"));
check("workers + hours + minutes reused", flow.includes('id="dna-crew"') && flow.includes('id="dna-minutes"'));
check(
  "fence intro + normal conditions",
  intro.includes("data-company-dna-fence-intro") &&
    intro.includes("DNA_FENCE_NORMAL_CONDITIONS") &&
    copySrc.includes("normal ground conditions")
);
check("shared task flow handles fence", flow.includes("v2LandingPath") && flow.includes("fence"));
check("do not fabricate clock", flow.includes("Original workers and clock time"));

const rates = summarizeProductivityWorkAreas([]);
const deckRates = rates.find((row) => row.workAreaType === "deck");
const fenceRates = rates.find((row) => row.workAreaType === "fence");
const rwRates = rates.find((row) => row.workAreaType === "retaining_wall");
check("Rates Deck still V2C 7/3", deckRates?.taskTotal === 7 && deckRates?.generation === "v2c");
check(
  "Rates Fence V2D 9/3",
  fenceRates?.taskTotal === 9 && fenceRates?.keyTaskTotal === 3 && fenceRates?.generation === "v2d"
);
check("Rates RW remains V1 2", rwRates?.taskTotal === 2 && rwRates?.generation === "v1");

const fenceDash = formatDnaFenceDashboardCta(2);
check("dashboard Fence remaining copy", fenceDash.cta.includes("2 more key Fence tasks"));
const startFence = resolvePersonalisationNextStep({
  firstRunComplete: true,
  hasWorkTypePreferences: true,
  hasCalibration: false,
  hasHighImpactCalibration: false,
  companyRateCount: 3,
  hasContactEmail: true,
  hasAddress: true,
  hasLogo: true,
  preferredWorkAreaTypes: ["fence"],
  fenceKeyTasksCalibrated: 0,
  fenceKeyTasksTotal: 3,
});
check(
  "dashboard Fence start CTA",
  startFence?.cta === "Improve your Fence estimates" && startFence.href === "/app/setup/dna/fence"
);
const bothPreferred = resolvePersonalisationNextStep({
  firstRunComplete: true,
  hasWorkTypePreferences: true,
  hasCalibration: false,
  companyRateCount: 3,
  hasContactEmail: true,
  hasAddress: true,
  hasLogo: true,
  preferredWorkAreaTypes: ["deck", "fence"],
  deckKeyTasksCalibrated: 3,
  deckKeyTasksTotal: 3,
  fenceKeyTasksCalibrated: 0,
  fenceKeyTasksTotal: 3,
});
check(
  "Deck complete then Fence prompt is deterministic",
  bothPreferred?.cta === "Improve your Fence estimates"
);
const deckFirst = resolvePersonalisationNextStep({
  firstRunComplete: true,
  hasWorkTypePreferences: true,
  hasCalibration: false,
  companyRateCount: 3,
  hasContactEmail: true,
  hasAddress: true,
  hasLogo: true,
  preferredWorkAreaTypes: ["deck", "fence"],
  deckKeyTasksCalibrated: 0,
  deckKeyTasksTotal: 3,
  fenceKeyTasksCalibrated: 0,
  fenceKeyTasksTotal: 3,
});
check("Deck stays first when both incomplete", deckFirst?.href === "/app/setup/dna/deck");
const continueExisting = resolvePersonalisationNextStep({
  firstRunComplete: true,
  hasWorkTypePreferences: true,
  hasCalibration: true,
  hasHighImpactCalibration: false,
  companyRateCount: 1,
  hasContactEmail: true,
  hasAddress: false,
  hasLogo: false,
  preferredWorkAreaTypes: ["retaining_wall"],
});
check("RW-only ladder copy preserved", continueExisting?.cta === "Continue calibration");

check("Owner can calibrate", roleAllowsPermission("owner", "company.calibration.manage"));
check("Estimator can calibrate", roleAllowsPermission("estimator", "company.calibration.manage"));
check("Viewer cannot calibrate", !roleAllowsPermission("viewer", "company.calibration.manage"));

const vertical = calculateFence(ctx(timberVertical()), wa());
const verticalPosts = calculateFence(
  ctx(timberVertical(), [productivityOrgRate(FENCE_PRODUCTIVITY_KEYS.postInstall, "post", 1.4)]),
  wa()
);
const verticalConcrete = calculateFence(
  ctx(timberVertical(), [
    productivityOrgRate(FENCE_PRODUCTIVITY_KEYS.postHoleConcreteBag, "bag", 0.2),
  ]),
  wa()
);
const postLabel = "Post installation";
const concreteLabel = "Post-hole concrete placement";
const railLabel = "Rail/framing installation";
const palingLabel = "Vertical paling installation";
const slatLabel = "Horizontal slat installation";
const demoLabel = "Existing fence removal";
const sectionLabel = "Section installation";

check(
  "posts calibration changes post labour only",
  hoursByLabel(verticalPosts.lineItems, postLabel) > hoursByLabel(vertical.lineItems, postLabel) &&
    hoursByLabel(verticalPosts.lineItems, concreteLabel) ===
      hoursByLabel(vertical.lineItems, concreteLabel)
);
check(
  "concrete calibration changes concrete labour only",
  hoursByLabel(verticalConcrete.lineItems, concreteLabel) >
    hoursByLabel(vertical.lineItems, concreteLabel) &&
    hoursByLabel(verticalConcrete.lineItems, postLabel) ===
      hoursByLabel(vertical.lineItems, postLabel)
);
check(
  "posts calibration does not change material qty",
  qtyByLabel(vertical.lineItems, postLabel) === qtyByLabel(verticalPosts.lineItems, postLabel)
);

const railsCal = calculateFence(
  ctx(timberVertical(), [productivityOrgRate(FENCE_PRODUCTIVITY_KEYS.railLm, "lm", 0.2)]),
  wa()
);
const palingsCal = calculateFence(
  ctx(timberVertical(), [productivityOrgRate(FENCE_PRODUCTIVITY_KEYS.verticalBoardsLm, "lm", 0.12)]),
  wa()
);
const demoCal = calculateFence(
  ctx(timberVertical(), [productivityOrgRate(FENCE_PRODUCTIVITY_KEYS.demolitionLm, "lm", 0.5)]),
  wa()
);
check(
  "rails calibration changes rail hours",
  hoursByLabel(railsCal.lineItems, railLabel) > hoursByLabel(vertical.lineItems, railLabel)
);
check(
  "palings calibration changes paling hours",
  hoursByLabel(palingsCal.lineItems, palingLabel) > hoursByLabel(vertical.lineItems, palingLabel)
);
check(
  "demolition hours change, length does not",
  hoursByLabel(demoCal.lineItems, demoLabel) > hoursByLabel(vertical.lineItems, demoLabel) &&
    qtyByLabel(demoCal.lineItems, demoLabel) === qtyByLabel(vertical.lineItems, demoLabel) &&
    qtyByLabel(demoCal.lineItems, demoLabel) === 18
);
check(
  "demolition sell changes",
  sellByLabel(demoCal.lineItems, demoLabel) !== sellByLabel(vertical.lineItems, demoLabel)
);
check(
  "reset restores post hours",
  hoursByLabel(calculateFence(ctx(timberVertical()), wa()).lineItems, postLabel) ===
    hoursByLabel(vertical.lineItems, postLabel)
);

const horizontalJob = calculateFence(ctx(timberHorizontal()), wa());
check(
  "vertical job does not consume horizontal slats",
  hoursByLabel(vertical.lineItems, slatLabel) === 0 &&
    hoursByLabel(vertical.lineItems, palingLabel) > 0
);
check(
  "horizontal job does not consume vertical palings",
  hoursByLabel(horizontalJob.lineItems, palingLabel) === 0 &&
    hoursByLabel(horizontalJob.lineItems, slatLabel) > 0
);

const modular = calculateFence(ctx(aluminiumModular()), wa());
check(
  "modular uses section labour not palings/rails",
  hoursByLabel(modular.lineItems, sectionLabel) > 0 &&
    hoursByLabel(modular.lineItems, palingLabel) === 0 &&
    hoursByLabel(modular.lineItems, railLabel) === 0 &&
    hoursByLabel(modular.lineItems, slatLabel) === 0
);

check(
  "estimator posts exclude concrete in ownership notes",
  read("lib/estimate/fence-productivity.ts").includes("ordinary post-hole digging") &&
    read("lib/estimate/fence-productivity.ts").includes("mixing, and placing")
);
check(
  "demolition copy excludes disposal",
  dnaV2ScenarioCopy(getCompanyDnaFoundationTask("fence.demolition.v1")!).includes(
    "Does not include skip-bin cartage"
  )
);

const hub = read("components/company-dna/CompanyDnaHub.tsx");
check("hub Fence uses V2 href", hub.includes("v2HubHref") && hub.includes("isCompanyDnaV2WorkArea"));
check("mobile max width reused", flow.includes("max-w-xl") && intro.includes("max-w-xl"));

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
