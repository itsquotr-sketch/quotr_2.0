/**
 * DNA-V2C — Deck task-level calibration UX.
 *
 * Run: npx --yes tsx scripts/verify-dna-v2c-deck-ux.ts
 *
 * No migration 055. Fence/RW V2 UI not exposed. Production not in scope.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { COMPANY_DNA_TASKS, getCompanyDnaTask } from "../lib/company-dna/catalogue";
import {
  clockFromDurationHours,
  companyDnaWorkAreaStatusV2,
  deriveCompanyProductivity,
  deriveCompanyProductivityFromClock,
  durationHoursFromClock,
  validateCompanyDnaInputs,
} from "../lib/company-dna/derive";
import {
  COMPANY_DNA_DECK_OPTIONAL_KEYS,
  COMPANY_DNA_DECK_TIER1_KEYS,
  COMPANY_DNA_DECK_V2_UI_KEYS,
  COMPANY_DNA_V2C_EXPOSED_WORK_AREAS,
  companyDnaUiWorkAreaStatus,
  deckV2ProgressCounts,
  isCompanyDnaDeckV2TaskKey,
  listCompanyDnaDeckV2UiTasks,
  listCompanyDnaUiTasksForWorkArea,
  nextCompanyDnaDeckV2Task,
} from "../lib/company-dna/deck-v2";
import {
  deckV2ScenarioCopy,
  deckV2TaskTitle,
  formatDnaClockTimePerUnit,
  formatDnaDeckDashboardCta,
  formatDnaDeckResultComparison,
  formatDnaDeckResultPrimary,
  formatDnaOutlierPrompt,
  formatDnaPersonMinutesPerUnit,
} from "../lib/company-dna/copy";
import { resolveCompanyDnaTask } from "../lib/company-dna/resolve-task";
import {
  COMPANY_DNA_V2B_NEW_TASKS,
  getCompanyDnaFoundationTask,
  listCompanyDnaTasksVisibleInCurrentUi,
} from "../lib/company-dna/v2-foundation";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import { DECK_CONCRETE_TO_SUPPORTS_FACT_KEY } from "../lib/estimate/deck-scope-2c";
import { round2 } from "../lib/estimate/facts";
import { summarizeProductivityWorkAreas } from "../lib/rates/productivity-work-area-summary";
import { resolvePersonalisationNextStep } from "../lib/setup/personalisation-ladder";
import { roleAllowsPermission } from "../lib/team/permissions";
import { loadCalibrationFixture } from "./deck-calibration/run-deck-calibration";
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

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

function wa(id: string): EstimateWorkArea & { status: "confirmed" } {
  return { id, type: "deck", name: "Deck", sort_order: 1, status: "confirmed" };
}

function ctx(
  facts: EstimateFact[],
  rates: readonly OrganisationRate[] = []
): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [wa(facts[0]?.work_area_id ?? "kwila")],
    facts,
    constraints: [],
    materialWastageSettings: {
      deckingWastagePercent: 10,
      defaultMaterialWastagePercent: 10,
    },
    rates: [...rates],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
      budget_rate_factor: 0.9,
      premium_rate_factor: 1.15,
    },
  } as unknown as EstimateContext;
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
    work_area_type: "deck",
    source: "calibrated_productivity",
    source_calibration_id: "dna-v2c",
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
    work_area_type: "deck",
  };
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
  return round2(
    included(items)
      .filter((item) => item.label === label)
      .reduce((sum, item) => sum + item.recommendedSell, 0)
  );
}

console.log("=== DNA-V2C Deck UX ===\n");

const migrations = readdirSync(join(process.cwd(), "supabase/migrations"))
  .filter((name) => /^\d+_/.test(name) && name.endsWith(".sql"))
  .sort();
check("no migration 055", !migrations.some((name) => name.startsWith("055_")));
check("054 remains latest", migrations.at(-1)?.startsWith("054_") === true);

const deckTasks = listCompanyDnaDeckV2UiTasks();
check("Deck UI has 7 tasks", deckTasks.length === 7);
check(
  "Deck UI keys exact order",
  deckTasks.map((task) => task.calibrationTaskKey).join(",") ===
    COMPANY_DNA_DECK_V2_UI_KEYS.join(",")
);
check("no steps in Deck UI", !deckTasks.some((task) => task.calibrationTaskKey.includes("steps")));
check(
  "Fence UI remains V1",
  listCompanyDnaUiTasksForWorkArea("fence")
    .map((task) => task.calibrationTaskKey)
    .join(",") ===
    COMPANY_DNA_TASKS.filter((task) => task.workAreaType === "fence")
      .map((task) => task.calibrationTaskKey)
      .join(",")
);
check(
  "RW UI remains V1",
  listCompanyDnaUiTasksForWorkArea("retaining_wall").length === 2 &&
    !listCompanyDnaUiTasksForWorkArea("retaining_wall").some((task) =>
      task.calibrationTaskKey.includes("excavation")
    )
);
check(
  "V2B new Fence/RW keys stay hidden from exposeInCurrentUi",
  COMPANY_DNA_V2B_NEW_TASKS.filter((task) => task.workAreaType !== "deck").every(
    (task) => task.exposeInCurrentUi === false
  )
);
check(
  "listCompanyDnaTasksVisibleInCurrentUi still 9",
  listCompanyDnaTasksVisibleInCurrentUi().length === 9
);
check(
  "only Deck work area is V2C-exposed",
  COMPANY_DNA_V2C_EXPOSED_WORK_AREAS.length === 1 &&
    COMPANY_DNA_V2C_EXPOSED_WORK_AREAS[0] === "deck"
);

const actions = read("lib/company-dna/actions.ts");
const resolveSrc = read("lib/company-dna/resolve-task.ts");
check(
  "unified resolver",
  resolveSrc.includes("getCompanyDnaFoundationTask") &&
    actions.includes("resolveCompanyDnaTask")
);
check("save uses existing RPC", actions.includes("save_productivity_calibration"));
check("reset uses existing RPC", actions.includes("reset_productivity_to_benchmark"));
check("hours+minutes convert on server", actions.includes("durationHoursFromClock"));
check("fascia resolves", resolveCompanyDnaTask("deck.fascia.v1")?.workAreaType === "deck");
check("V1 framing still resolves", resolveCompanyDnaTask("deck.framing.v1")?.authorityQuantity === 80);
check("unknown task rejected", resolveCompanyDnaTask("deck.steps.v1") == null);
check("V1 catalogue lookup still rejects fascia", getCompanyDnaTask("deck.fascia.v1") == null);

const posts = getCompanyDnaFoundationTask("deck.posts.v1")!;
const concrete = getCompanyDnaFoundationTask("deck.concrete.v1")!;
const framing = getCompanyDnaFoundationTask("deck.framing.v1")!;
const decking = getCompanyDnaFoundationTask("deck.decking.v1")!;
check(
  "posts exclude concrete",
  /concrete/i.test(posts.workExcluded) && /hole/i.test(posts.workIncluded)
);
check(
  "concrete excludes hole/post setting",
  /hole excavation/i.test(concrete.workExcluded) && /mixing/i.test(concrete.workIncluded)
);
check(
  "posts scenario names exact quantity",
  deckV2ScenarioCopy(posts).includes(String(posts.authorityQuantity)) &&
    deckV2ScenarioCopy(posts).includes("Do not include mixing or placing concrete")
);
check(
  "framing scenario uses 80 lm not fake m² authority",
  deckV2ScenarioCopy(framing).includes("80 lineal metres") &&
    framing.authorityUnit === "lm" &&
    framing.authorityQuantity === 80
);
check(
  "decking scenario keeps lineal-metre authority",
  decking.authorityUnit === "lm" &&
    deckV2ScenarioCopy(decking).includes(String(decking.authorityQuantity)) &&
    deckV2ScenarioCopy(decking).includes("20 m²")
);
check(
  "concrete scenario is bags not material price",
  deckV2ScenarioCopy(concrete).includes("20 kg") &&
    deckV2ScenarioCopy(concrete).includes("labour time only")
);

check("0/3", companyDnaWorkAreaStatusV2({ tier1Total: 3, tier1Calibrated: 0 }) === "benchmarks");
check("1/3", companyDnaWorkAreaStatusV2({ tier1Total: 3, tier1Calibrated: 1 }) === "partly");
check("2/3", companyDnaWorkAreaStatusV2({ tier1Total: 3, tier1Calibrated: 2 }) === "partly");
check("3/3", companyDnaWorkAreaStatusV2({ tier1Total: 3, tier1Calibrated: 3 }) === "calibrated");
check(
  "two V1 high-impact is not Deck V2 complete",
  companyDnaUiWorkAreaStatus({
    workAreaType: "deck",
    calibratedTaskKeys: ["deck.framing.v1", "deck.decking.v1"],
  }) === "partly"
);
check(
  "posts+framing+decking is Deck V2 complete",
  companyDnaUiWorkAreaStatus({
    workAreaType: "deck",
    calibratedTaskKeys: [...COMPANY_DNA_DECK_TIER1_KEYS],
  }) === "calibrated"
);

const next = nextCompanyDnaDeckV2Task({ calibratedTaskKeys: [] });
check("first incomplete is posts", next?.calibrationTaskKey === "deck.posts.v1");
check(
  "after tier 1 next is concrete",
  nextCompanyDnaDeckV2Task({
    calibratedTaskKeys: [...COMPANY_DNA_DECK_TIER1_KEYS],
  })?.calibrationTaskKey === "deck.concrete.v1"
);
check("optional keys are 4", COMPANY_DNA_DECK_OPTIONAL_KEYS.length === 4);

const clock = durationHoursFromClock(0, 15);
check("0h 15m = 0.25", clock === 0.25);
check(
  "15 minutes is valid duration",
  validateCompanyDnaInputs({
    crewSize: 2,
    durationHours: clock,
    ratioToBenchmark: 1,
    outlierConfirmed: false,
  }).ok === true
);
const derived = deriveCompanyProductivityFromClock({
  task: posts,
  crewSize: 2,
  clockHours: 0,
  minutes: 15,
});
check(
  "crew × clock derives productivity",
  derived.durationHours === 0.25 &&
    derived.personHours === 0.5 &&
    derived.productivity === deriveCompanyProductivity({
      task: posts,
      crewSize: 2,
      durationHours: 0.25,
    }).productivity
);
check(
  "clock round-trip",
  clockFromDurationHours(1.5).hours === 1 && clockFromDurationHours(1.5).minutes === 30
);
check(
  "faster means lower hours/unit",
  deriveCompanyProductivity({
    task: posts,
    crewSize: 1,
    durationHours: 1,
  }).faster === true
);
check(
  "result copy uses person-minutes",
  formatDnaPersonMinutesPerUnit(0.2, "ea").includes("12 person-minutes per each")
);
check(
  "comparison direction",
  formatDnaDeckResultComparison({ faster: true, percentVsBenchmark: 20 }).includes("faster") &&
    formatDnaDeckResultComparison({ faster: false, percentVsBenchmark: 20 }).includes("slower")
);
check(
  "outlier copy",
  formatDnaOutlierPrompt(true).includes("faster") &&
    formatDnaOutlierPrompt(false).includes("slower")
);
check(
  "clock-time summary is secondary",
  (formatDnaClockTimePerUnit({
    crewSize: 2,
    productivityHoursPerUnit: 0.5,
    unit: "lm",
  }) ?? "").includes("clock time")
);

const flow = read("components/company-dna/CompanyDnaDeckTaskFlow.tsx");
const intro = read("components/company-dna/CompanyDnaDeckIntro.tsx");
const summary = read("components/company-dna/CompanyDnaDeckSummary.tsx");
const v1Flow = read("components/company-dna/CompanyDnaTaskFlow.tsx");
const taskPage = read("app/(protected)/app/setup/dna/[taskKey]/page.tsx");
const landing = read("app/(protected)/app/setup/dna/deck/page.tsx");
check("one task card at a time", flow.includes("data-company-dna-deck-task") && !flow.includes("map((task)"));
check("workers + hours + minutes", flow.includes('id="dna-crew"') && flow.includes('id="dna-clock-hours"') && flow.includes('id="dna-minutes"'));
check("no decimal-hours requirement in Deck V2", !flow.includes('id="dna-hours"'));
check("V1 fence flow still has decimal hours", v1Flow.includes('id="dna-hours"'));
check("intro + normal conditions", intro.includes("data-company-dna-deck-intro") && intro.includes("data-company-dna-deck-normal"));
check("tier 1 completion moment", flow.includes("data-company-dna-deck-complete"));
check("optional skip only non-tier-1", flow.includes("DNA_SKIP_FOR_NOW") && flow.includes("!currentIsTier1"));
check("reset confirmation dialog", flow.includes("DNA_RESET_CONFIRM_TITLE") && summary.includes("DNA_RESET_CONFIRM_TITLE"));
check("result language", flow.includes("formatDnaDeckResultPrimary"));
check("task page uses unified resolver", taskPage.includes("resolveCompanyDnaTask"));
check("fence V2 keys 404", taskPage.includes("!task.exposeInCurrentUi") && taskPage.includes("notFound()"));
check("Deck landing exists", existsSync(join(process.cwd(), "app/(protected)/app/setup/dna/deck/page.tsx")));
check("no /v2/ product URL", !landing.includes("/v2/") && !taskPage.includes("/dna/v2"));
check("historical evidence fields loaded", actions.includes("crew_size") && actions.includes("duration_hours"));
check("do not fabricate clock", flow.includes("Original workers and clock time"));

const hub = read("components/company-dna/CompanyDnaHub.tsx");
check("hub Deck uses V2 href", hub.includes("deckV2HubHref") && hub.includes('data-company-dna-generation'));
check("hub Fence stays nextCompanyDnaTask", hub.includes("nextCompanyDnaTask"));

const rates = summarizeProductivityWorkAreas([]);
const deckRates = rates.find((row) => row.workAreaType === "deck");
const fenceRates = rates.find((row) => row.workAreaType === "fence");
check("Rates Deck is 7 tasks / 3 key", deckRates?.taskTotal === 7 && deckRates?.keyTaskTotal === 3);
check("Rates Fence remains 3", fenceRates?.taskTotal === 3 && fenceRates?.generation === "v1");
check(
  "Rates compact key-task copy",
  read("components/rates/CompanyDnaRatesCompare.tsx").includes("key tasks calibrated")
);

const dash = formatDnaDeckDashboardCta(2);
check(
  "dashboard remaining copy",
  dash.cta.includes("2 more key Deck tasks") && dash.title.includes("Improve your Deck estimates")
);
const startDash = resolvePersonalisationNextStep({
  firstRunComplete: true,
  hasWorkTypePreferences: true,
  hasCalibration: false,
  hasHighImpactCalibration: false,
  companyRateCount: 3,
  hasContactEmail: true,
  hasAddress: true,
  hasLogo: true,
  preferredWorkAreaTypes: ["deck"],
  deckKeyTasksCalibrated: 0,
  deckKeyTasksTotal: 3,
});
check(
  "dashboard Deck start CTA",
  startDash?.cta === "Improve your Deck estimates" &&
    startDash.href === "/app/setup/dna/deck"
);
const continueExisting = resolvePersonalisationNextStep({
  firstRunComplete: true,
  hasWorkTypePreferences: true,
  hasCalibration: true,
  hasHighImpactCalibration: false,
  companyRateCount: 1,
  hasContactEmail: true,
  hasAddress: false,
  hasLogo: false,
});
check(
  "non-deck ladder copy preserved",
  continueExisting?.cta === "Continue calibration"
);

check("Owner can calibrate", roleAllowsPermission("owner", "company.calibration.manage"));
check("Admin can calibrate", roleAllowsPermission("admin", "company.calibration.manage"));
check("Estimator can calibrate", roleAllowsPermission("estimator", "company.calibration.manage"));
check("Viewer cannot calibrate", !roleAllowsPermission("viewer", "company.calibration.manage"));
check("Deck flow respects canCalibrate", flow.includes("canCalibrate") && !flow.includes("company.edit"));

const KWILA = loadCalibrationFixture("OWNER-KWILA-01.json");
const kwilaId = "kwila";
const kwilaFacts = [
  ...Object.entries(KWILA.facts).map(([key, value]) => fact(key, kwilaId, value)),
  fact(DECK_CONCRETE_TO_SUPPORTS_FACT_KEY, kwilaId, true),
];
const labour = labourOrgRate(78);
const before = calculateDeck(ctx(kwilaFacts, [labour]), wa(kwilaId));
const afterPosts = calculateDeck(
  ctx(kwilaFacts, [
    labour,
    productivityOrgRate("deck.posts.install.hours_per_ea", "ea", 0.4),
  ]),
  wa(kwilaId)
);
const afterReset = calculateDeck(ctx(kwilaFacts, [labour]), wa(kwilaId));
const postLabel = "Pile/post installation";
const concreteLabel = "Concrete placement";
const concreteMat = "Post-hole concrete";
check(
  "same job material qty unchanged after posts calibration",
  qtyByLabel(before.lineItems, concreteMat) ===
    qtyByLabel(afterPosts.lineItems, concreteMat) &&
    qtyByLabel(before.lineItems, postLabel) ===
      qtyByLabel(afterPosts.lineItems, postLabel)
);
check(
  "posts calibration changes post labour hours",
  hoursByLabel(afterPosts.lineItems, postLabel) >
    hoursByLabel(before.lineItems, postLabel)
);
check(
  "posts calibration does not change concrete labour hours",
  hoursByLabel(afterPosts.lineItems, concreteLabel) ===
    hoursByLabel(before.lineItems, concreteLabel)
);
check(
  "posts calibration changes recommended sell on posts only",
  sellByLabel(afterPosts.lineItems, postLabel) !==
    sellByLabel(before.lineItems, postLabel) &&
    sellByLabel(afterPosts.lineItems, concreteLabel) ===
      sellByLabel(before.lineItems, concreteLabel)
);
check(
  "reset restores benchmark post hours",
  hoursByLabel(afterReset.lineItems, postLabel) ===
    hoursByLabel(before.lineItems, postLabel)
);
const afterConcrete = calculateDeck(
  ctx(kwilaFacts, [
    labour,
    productivityOrgRate("deck.post_hole_concrete.place.hours_per_bag", "bag", 0.32),
  ]),
  wa(kwilaId)
);
check(
  "concrete calibration changes concrete labour not post labour",
  hoursByLabel(afterConcrete.lineItems, concreteLabel) >
    hoursByLabel(before.lineItems, concreteLabel) &&
    hoursByLabel(afterConcrete.lineItems, postLabel) ===
      hoursByLabel(before.lineItems, postLabel)
);
check(
  "estimator notes exclude cross-labour",
  read("lib/estimate/calculators/deck.ts").includes("Excludes concrete placement") &&
    read("lib/estimate/calculators/deck.ts").includes("Excludes hole excavation")
);
check("mobile max width", flow.includes("max-w-xl") && intro.includes("max-w-xl"));
check("minute increments", flow.includes("0, 15, 30, 45") || flow.includes("[0, 15, 30, 45]"));
check(
  "no productivity jargon in intro",
  !intro.toLowerCase().includes("authority quantity") &&
    !intro.toLowerCase().includes("calibration catalogue")
);
check(
  "progress counts helper",
  deckV2ProgressCounts([]).tier1Total === 3 &&
    deckV2ProgressCounts(COMPANY_DNA_DECK_TIER1_KEYS).tier1Calibrated === 3
);
check("isCompanyDnaDeckV2TaskKey", isCompanyDnaDeckV2TaskKey("deck.fascia.v1") && !isCompanyDnaDeckV2TaskKey("fence.posts.v1"));
check(
  "primary result copy",
  formatDnaDeckResultPrimary({ productivityHoursPerUnit: 0.45, unit: "lm" }).includes(
    "person-minutes"
  )
);
check("task titles stay builder-facing", deckV2TaskTitle("deck.posts.v1", "x") === "Deck posts");

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
