/**
 * COMPANY DNA-02 — calibration UX, high-impact progress, transparency.
 * Run: npx tsx scripts/verify-company-dna-02.ts
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { roleAllowsPermission } from "../lib/team/permissions";
import {
  COMPANY_DNA_TASKS,
  getCompanyDnaTask,
  listCompanyDnaTasksForWorkArea,
  orderCompanyDnaWorkAreas,
} from "../lib/company-dna/catalogue";
import {
  DNA_BACK_TO_HUB,
  DNA_CREW_HELPER,
  DNA_NEXT_TASK_CTA,
  DNA_OUTLIER_SAVE_ANYWAY,
  DNA_OUTLIER_WARNING,
  DNA_RATES_PRODUCTIVITY_HELPER,
  DNA_RESET_CONSEQUENCE,
  DNA_RESET_CTA,
  DNA_STALE_EXPLANATION,
  DNA_TIME_HELPER,
  formatDnaComparisonCopy,
  formatDnaPersonHoursLine,
  formatDnaProgressCopy,
  formatLabourProductivityDisclosure,
} from "../lib/company-dna/copy";
import {
  companyDnaWorkAreaStatus,
  companyDnaWorkAreaStatusLabel,
  deriveCompanyProductivity,
} from "../lib/company-dna/derive";
import {
  nextCompanyDnaTask,
  nextCompanyDnaTaskAcrossHub,
  orgHasHighImpactCalibration,
  workAreaHubCta,
} from "../lib/company-dna/progress";
import {
  labourProductivityDisclosureFromLines,
  labourRateProvenanceLabel,
  productivityProvenanceLabel,
} from "../lib/company-dna/provenance-display";
import { resolvePersonalisationNextStep } from "../lib/setup/personalisation-ladder";
import { toPricedLine } from "../lib/assistant/builder-review/compose";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import { RATE_SOURCE_FRIENDLY_LABELS } from "../lib/estimate/rate-source-labels";
import { planAllowsCapability, trialAllowsCapability } from "../lib/billing/entitlement-matrix";
import type { OrganisationRate } from "../components/setup/types";
import type { EstimateLineItem } from "../components/assistant/types";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "../lib/estimate/types";

let failed = 0;

function assert(label: string, condition: boolean) {
  if (condition) {
    console.log(`PASS ${label}`);
  } else {
    failed += 1;
    console.error(`FAIL ${label}`);
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
    confirmedWorkAreas: [wa(facts[0]?.work_area_id ?? "d1")],
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

function labourOrgRate(costRate: number): OrganisationRate {
  return {
    id: "labour.carpenter.hour",
    rate_type: "labour",
    item_key: "labour.carpenter.hour",
    label: "Carpenter",
    unit: "hour",
    cost_rate: costRate,
    sell_rate: null,
    markup_percent: null,
    active: true,
    trade: "carpenter",
    work_area_type: "deck",
    source: "explicit_company",
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
    work_area_type: "deck",
    source: "calibrated_productivity",
    source_calibration_id: "ev-1",
  };
}

function asReviewItem(input: EstimateLineItemInput): EstimateLineItem {
  return {
    id: input.label,
    workAreaName: input.workAreaName,
    label: input.label,
    category: input.category as EstimateLineItem["category"],
    costLow: input.costLow,
    costHigh: input.costHigh,
    sellLow: input.sellLow,
    sellHigh: input.sellHigh,
    recommendedCost: input.recommendedCost,
    recommendedSell: input.recommendedSell,
    grossProfit: input.grossProfit,
    marginPercent: input.marginPercent,
    rateSource: input.rateSource,
    quantity: input.quantity,
    unit: input.unit,
    labourHours: input.labourHours,
    notes: input.notes,
    productivitySourceType: input.productivitySourceType,
    includedInTotal: input.includedInTotal,
  };
}

console.log("=== COMPANY DNA-02 ===\n");

const migrationDir = join(process.cwd(), "supabase/migrations");
const files = readdirSync(migrationDir).filter((name) => name.endsWith(".sql"));
assert("no 053 migration", !files.some((name) => name.startsWith("053_")));

const framing = getCompanyDnaTask("deck.framing.v1")!;
const decking = getCompanyDnaTask("deck.decking.v1")!;
const posts = getCompanyDnaTask("deck.posts.v1")!;
const demo = getCompanyDnaTask("deck.demolition.v1")!;
assert("deck high-impact: framing, decking, posts", framing.isHighImpact && decking.isHighImpact && posts.isHighImpact);
assert("deck demolition is secondary", demo.isHighImpact === false);
assert(
  "deck task order framing → decking → posts → demolition",
  listCompanyDnaTasksForWorkArea("deck")
    .map((task) => task.calibrationTaskKey)
    .join("|") ===
    "deck.framing.v1|deck.decking.v1|deck.posts.v1|deck.demolition.v1"
);

const fenceKeys = listCompanyDnaTasksForWorkArea("fence").map(
  (task) => task.calibrationTaskKey
);
assert(
  "fence order posts → palings → rails",
  fenceKeys.join("|") === "fence.posts.v1|fence.boards.v1|fence.rails.v1"
);
assert(
  "fence tasks are high-impact",
  listCompanyDnaTasksForWorkArea("fence").every((task) => task.isHighImpact)
);

const rwKeys = listCompanyDnaTasksForWorkArea("retaining_wall").map(
  (task) => task.calibrationTaskKey
);
assert(
  "rw order piles → face",
  rwKeys.join("|") === "retaining_wall.piles.v1|retaining_wall.face.v1"
);

assert(
  "preferred work areas first",
  orderCompanyDnaWorkAreas(["fence", "deck"])[0] === "fence" &&
    orderCompanyDnaWorkAreas(["retaining_wall"])[0] === "retaining_wall"
);
assert("v1 areas stay deck/fence/rw", COMPANY_DNA_TASKS.every((task) =>
  ["deck", "fence", "retaining_wall"].includes(task.workAreaType)
));
assert(
  "no bathroom/kitchen calibration tasks",
  !COMPANY_DNA_TASKS.some((task) =>
    /bathroom|kitchen|fascia|steps/.test(task.calibrationTaskKey)
  )
);

assert(
  "demolition-only is partly calibrated",
  companyDnaWorkAreaStatus({
    highImpactTotal: 3,
    highImpactCalibrated: 0,
    anyCalibrated: true,
  }) === "partly"
);
assert(
  "two high-impact = using your calibration",
  companyDnaWorkAreaStatus({
    highImpactTotal: 3,
    highImpactCalibrated: 2,
    anyCalibrated: true,
  }) === "calibrated" &&
    companyDnaWorkAreaStatusLabel("calibrated") === "Using your calibration"
);
assert(
  "zero calibrated uses Quotr benchmarks",
  companyDnaWorkAreaStatusLabel("benchmarks") === "Using Quotr benchmarks"
);
assert(
  "progress copy is counts not percent",
  formatDnaProgressCopy({
    calibratedCount: 1,
    taskTotal: 4,
    highImpactCalibrated: 2,
    highImpactTotal: 3,
  }) === "2 of 3 key tasks calibrated"
);

assert(
  "org demolition-only is not high-impact complete",
  orgHasHighImpactCalibration(["deck.demolition.v1"]) === false
);
assert(
  "org framing+decking is high-impact complete",
  orgHasHighImpactCalibration(["deck.framing.v1", "deck.decking.v1"]) === true
);

assert(
  "next task prefers remaining high-impact",
  nextCompanyDnaTask({
    workAreaType: "deck",
    calibratedTaskKeys: ["deck.framing.v1"],
  })?.calibrationTaskKey === "deck.decking.v1"
);
assert(
  "after high-impact, demolition is next",
  nextCompanyDnaTask({
    workAreaType: "deck",
    calibratedTaskKeys: [
      "deck.framing.v1",
      "deck.decking.v1",
      "deck.posts.v1",
    ],
  })?.calibrationTaskKey === "deck.demolition.v1"
);
assert(
  "across hub, next stays on current area first",
  nextCompanyDnaTaskAcrossHub({
    orderedWorkAreaTypes: ["deck", "fence"],
    calibratedTaskKeys: ["deck.framing.v1"],
    currentTaskKey: "deck.framing.v1",
  })?.calibrationTaskKey === "deck.decking.v1"
);

assert("hub CTA start", workAreaHubCta("benchmarks") === "Start");
assert("hub CTA continue", workAreaHubCta("partly") === "Continue");
assert("hub CTA review", workAreaHubCta("calibrated") === "Review");

const copy = read("lib/company-dna/copy.ts");
const flow = read("components/company-dna/CompanyDnaTaskFlow.tsx");
const hub = read("components/company-dna/CompanyDnaHub.tsx");
assert("crew helper clock-time wording", DNA_CREW_HELPER.includes("How many people from your team"));
assert("time helper not person-hours", DNA_TIME_HELPER.includes("enter 8 hours, not 16"));
assert("outlier copy is calm", DNA_OUTLIER_WARNING.includes("That may be correct"));
assert("outlier save anyway", DNA_OUTLIER_SAVE_ANYWAY === "Save anyway");
assert("next-task CTA", DNA_NEXT_TASK_CTA === "Calibrate next task");
assert("back to hub secondary", DNA_BACK_TO_HUB === "Back to Company DNA");
assert("reset consequence explicit", DNA_RESET_CONSEQUENCE.includes("Existing estimates will not change until updated"));
assert("reset CTA kept", DNA_RESET_CTA === "Use Quotr benchmark");
assert("task flow uses next-task CTA", flow.includes("DNA_NEXT_TASK_CTA"));
assert("task flow uses reset consequence", flow.includes("DNA_RESET_CONSEQUENCE"));
assert("person-hours preview", formatDnaPersonHoursLine(2, 8) === "2 people × 8 hours = 16 person-hours.");

const slower = deriveCompanyProductivity({
  task: framing,
  crewSize: 2,
  durationHours: 8,
});
assert("higher h/unit is slower", slower.faster === false && slower.productivity === 0.2);
assert(
  "comparison wording not inverted when slower",
  formatDnaComparisonCopy({
    faster: slower.faster,
    percentVsBenchmark: slower.percentVsBenchmark,
  }).includes("more labour time") &&
    !formatDnaComparisonCopy({
      faster: slower.faster,
      percentVsBenchmark: slower.percentVsBenchmark,
    }).includes("faster")
);
const faster = deriveCompanyProductivity({
  task: framing,
  crewSize: 1,
  durationHours: 4,
});
assert("lower h/unit is faster", faster.faster === true && faster.productivity < framing.benchmarkProductivity);
assert(
  "comparison wording not inverted when faster",
  formatDnaComparisonCopy({
    faster: faster.faster,
    percentVsBenchmark: faster.percentVsBenchmark,
  }).includes("faster")
);

assert("no authority quantity in prompts", !framing.prompt.toLowerCase().includes("authority"));
assert("no mapping ratio in prompts", !COMPANY_DNA_TASKS.some((task) => /mapping ratio|productivity unit/i.test(task.prompt)));
assert("deck framing scenario 20 m²", framing.scenarioSummary.includes("20 m²"));
assert("fence typical 20 lm 1.8 m", getCompanyDnaTask("fence.posts.v1")!.scenarioSummary.includes("20 lm") && getCompanyDnaTask("fence.posts.v1")!.scenarioSummary.includes("1.8 m"));
assert("rw height explicit", getCompanyDnaTask("retaining_wall.piles.v1")!.scenarioSummary.includes("1.0 m"));

assert(
  "benchmark numbers unchanged",
  framing.benchmarkProductivity === 0.13 &&
    decking.benchmarkProductivity === 0.077 &&
    posts.benchmarkProductivity === 0.2 &&
    demo.benchmarkProductivity === 0.35 &&
    getCompanyDnaTask("fence.posts.v1")!.benchmarkProductivity === 0.7 &&
    getCompanyDnaTask("fence.boards.v1")!.benchmarkProductivity === 0.05 &&
    getCompanyDnaTask("fence.rails.v1")!.benchmarkProductivity === 0.08 &&
    getCompanyDnaTask("retaining_wall.piles.v1")!.benchmarkProductivity === 0.85 &&
    getCompanyDnaTask("retaining_wall.face.v1")!.benchmarkProductivity === 0.55
);

const ladderPartial = resolvePersonalisationNextStep({
  firstRunComplete: true,
  hasWorkTypePreferences: true,
  hasCalibration: true,
  hasHighImpactCalibration: false,
  companyRateCount: 1,
  hasContactEmail: true,
  hasAddress: false,
  hasLogo: false,
});
assert("partial calibration stays on calibrate", ladderPartial?.id === "calibrate");
assert("partial calibration CTA is Continue calibration", ladderPartial?.cta === "Continue calibration");
const ladderComplete = resolvePersonalisationNextStep({
  firstRunComplete: true,
  hasWorkTypePreferences: true,
  hasCalibration: true,
  hasHighImpactCalibration: true,
  companyRateCount: 1,
  hasContactEmail: true,
  hasAddress: false,
  hasLogo: false,
});
assert("high-impact complete moves to rates", ladderComplete?.id === "rates");
const ladderCompat = resolvePersonalisationNextStep({
  firstRunComplete: true,
  hasWorkTypePreferences: true,
  hasCalibration: true,
  companyRateCount: 1,
  hasContactEmail: true,
  hasAddress: false,
  hasLogo: false,
});
assert("omitted high-impact flag keeps beta-1-5 behaviour", ladderCompat?.id === "rates");

assert("hub shows preferred first copy", hub.includes("Your usual work is listed first"));
assert("hub does not hide other areas behind Show all", !hub.includes("Show all"));
assert("hub mobile bottom padding", hub.includes("pb-[calc(4.5rem+env(safe-area-inset-bottom))]"));
assert("task mobile bottom padding", flow.includes("pb-[calc(5.5rem+env(safe-area-inset-bottom))]"));
assert(
  "setup shell mobile padding",
  read("components/setup/SetupShell.tsx").includes("pb-[calc(6rem+env(safe-area-inset-bottom))]")
);
assert("crew field labelled", flow.includes('htmlFor="dna-crew"') && flow.includes('id="dna-crew"'));
assert("hours field labelled", flow.includes('htmlFor="dna-hours"') && flow.includes('id="dna-hours"'));
assert("validation associated", flow.includes("dna-validation"));
assert("viewer hides save", flow.includes("canCalibrate") && flow.includes("DNA_SAVE_PRIMARY"));

const ratesCompare = read("components/rates/CompanyDnaRatesCompare.tsx");
const ratesPage = read("components/rates/RatesPageContent.tsx");
const ratesTable = read("components/rates/RatesTableSection.tsx");
assert("rates productivity helper", DNA_RATES_PRODUCTIVITY_HELPER.includes("Lower means fewer labour hours"));
assert("rates compare uses helper", ratesCompare.includes("DNA_RATES_PRODUCTIVITY_HELPER"));
assert("rates compare Edit calibration", ratesCompare.includes("Edit calibration"));
assert("rates compare Use Quotr benchmark", ratesCompare.includes("DNA_RESET_CTA"));
assert("no raw enums in rates compare", !ratesCompare.includes("explicit_company") && !ratesCompare.includes("legacy_scope_rate"));
assert("no raw enums in hub", !hub.includes("calibrated_productivity") && !hub.includes("explicit_company"));
assert("friendly labels", RATE_SOURCE_FRIENDLY_LABELS.calibrated_productivity === "Your calibrated productivity");
assert("estimator commercial edit hidden", ratesPage.includes("readOnly={!state.canManageRates}"));
assert("rates table supports readOnly", ratesTable.includes("readOnly"));
assert("estimator can still calibrate in compare", ratesPage.includes("canCalibrate={state.canCalibrate}"));

const defaultsUi = read("components/rates/CompanyDefaultsSection.tsx");
const ratesActions = read("lib/rates/actions.ts");
const setupActions = read("lib/setup/actions.ts");
const marginActions = read("lib/assistant/margin-actions.ts");
const dnaActions = read("lib/company-dna/actions.ts");
const permissions = read("lib/team/permissions.ts");
const migrationFiles = readdirSync(join(process.cwd(), "supabase/migrations"));

assert(
  "defaults inherit canManageRates",
  /<CompanyDefaultsSection[\s\S]*readOnly=\{!state\.canManageRates\}/.test(ratesPage)
);
assert("defaults section accepts readOnly", defaultsUi.includes("readOnly = false"));
assert("defaults hide save when readOnly", defaultsUi.includes("{readOnly ? null : ("));
assert("defaults margin input disabled when readOnly", defaultsUi.includes("disabled={readOnly}"));
assert(
  "saveRateSettings requires rates write context",
  /export async function saveRateSettings[\s\S]{0,800}requireRatesWriteContext/.test(
    ratesActions
  )
);
assert(
  "rates write uses company.rates.manage",
  /permission: "company.rates.manage"/.test(ratesActions)
);
assert(
  "saveCompanyDefaults uses company.rates.manage",
  /export async function saveCompanyDefaults[\s\S]{0,1200}company\.rates\.manage/.test(
    setupActions
  )
);
assert(
  "savePricingBasics uses company.rates.manage",
  /export async function savePricingBasics[\s\S]{0,1200}company\.rates\.manage/.test(
    setupActions
  )
);
assert(
  "no raw DB error on saveRateSettings",
  /export async function saveRateSettings[\s\S]{0,1600}Could not save company defaults/.test(
    ratesActions
  )
);
assert(
  "project margin is not company.rates.manage",
  !marginActions.includes("company.rates.manage") &&
    marginActions.includes("export async function updateEstimateMargin")
);
assert("Estimator keeps pricing.edit", roleAllowsPermission("estimator", "pricing.edit"));
assert("Viewer cannot pricing.edit", !roleAllowsPermission("viewer", "pricing.edit"));
assert("Owner can manage rates", roleAllowsPermission("owner", "company.rates.manage"));
assert(
  "calibration still company.calibration.manage",
  dnaActions.includes("company.calibration.manage")
);
assert(
  "no new defaults permission invented",
  !permissions.includes("company.defaults") &&
    permissions.includes('"company.rates.manage"')
);
assert(
  "no migration 053",
  !migrationFiles.some((name) => name.startsWith("053"))
);

const historical = read("components/calibration/CalibrationHub.tsx");
assert("legacy hub not called calibration in title", historical.includes("Historical pricing notes"));
assert("legacy hub not deleted", historical.includes("Do this later"));

assert(
  "stale copy mentions company settings without claiming DNA reason",
  DNA_STALE_EXPLANATION.includes("company settings") &&
    read("lib/assistant/mode/derive.ts").includes("latest job details and company settings")
);

assert("Owner can calibrate", roleAllowsPermission("owner", "company.calibration.manage"));
assert("Admin can calibrate and manage rates", roleAllowsPermission("admin", "company.calibration.manage") && roleAllowsPermission("admin", "company.rates.manage"));
assert("Estimator can calibrate not rates", roleAllowsPermission("estimator", "company.calibration.manage") && !roleAllowsPermission("estimator", "company.rates.manage"));
assert("Viewer read-only DNA", !roleAllowsPermission("viewer", "company.calibration.manage") && !roleAllowsPermission("viewer", "company.rates.manage"));
assert("plan parity builder/business/trial", planAllowsCapability("builder", "calibration.basic") && planAllowsCapability("business", "calibration.basic") && trialAllowsCapability("calibration.basic"));

assert("no automatic learning", !read("lib/company-dna/actions.ts").includes("completed-job") && !copy.includes("AI suggestion"));

const demoFacts = [
  fact("deck.area_m2", "d1", 6),
  fact("deck.existing_deck_removal", "d1", true),
];
const labour = labourOrgRate(60);
const a = calculateDeck(ctx(demoFacts, [labour]), wa("d1"));
const b = calculateDeck(
  ctx(demoFacts, [
    labour,
    productivityOrgRate("deck.demolition_hours_per_m2", "m2", 0.7),
  ]),
  wa("d1")
);
const demoA = a.lineItems.find((item) => item.label === "Existing deck removal");
const demoB = b.lineItems.find((item) => item.label === "Existing deck removal");
assert("demolition line present", Boolean(demoA && demoB));
assert("qty unchanged", demoA?.quantity === demoB?.quantity);
assert("hours change with productivity only", (demoA?.labourHours ?? 0) !== (demoB?.labourHours ?? 0));
assert("B uses 0.7 h/m²", demoB?.productivityRate === 0.7);
assert(
  "demolition notes include calibrated label",
  (demoB?.notes ?? "").includes("Your calibrated productivity")
);

const priced = toPricedLine(asReviewItem(demoB!));
assert(
  "Builder Review labour rate is Your rate or Quotr benchmark",
  priced.labourRateLabel === "Your rate" || priced.labourRateLabel === "Quotr benchmark"
);
assert(
  "Builder Review productivity is calibrated separately",
  priced.productivityLabel === "Your calibrated productivity"
);
assert(
  "rateSource still labour $/h not overloaded",
  priced.rateLabel !== "Your calibrated productivity"
);
assert(
  "surface shows both labels",
  read("components/assistant/builder-review/BuilderReviewSurface.tsx").includes("Labour rate:") &&
    read("components/assistant/builder-review/BuilderReviewSurface.tsx").includes("Productivity:")
);

const disclosureAll = formatLabourProductivityDisclosure({
  calibratedLabourCount: 1,
  labourCount: 1,
  dominantWorkAreaLabel: "Deck",
});
assert(
  "estimate ready all-calibrated disclosure",
  disclosureAll === "Deck labour uses your calibrated productivity."
);
assert(
  "estimate ready mixed disclosure",
  formatLabourProductivityDisclosure({
    calibratedLabourCount: 1,
    labourCount: 3,
  }) === "Some labour productivity still uses Quotr benchmarks."
);
assert(
  "disclosure helper reads calibrated notes",
  labourProductivityDisclosureFromLines([asReviewItem(demoB!)]) ===
    "Deck labour uses your calibrated productivity."
);
assert(
  "labour rate helper maps company rate",
  labourRateProvenanceLabel("Your company rate") === "Your rate"
);
assert(
  "productivity helper maps notes",
  productivityProvenanceLabel({ notes: demoB?.notes }) ===
    "Your calibrated productivity"
);

const deckSrc = read("lib/estimate/calculators/deck.ts");
assert("no GST/margin formula change in DNA-02 deck calculator", deckSrc.includes("fallbackHoursPerUnit: 0.35"));
assert("no completed-job learning in DNA actions", !read("lib/company-dna/actions.ts").includes("from(\"projects\")"));

if (failed > 0) {
  console.error(`\nFAILED ${failed} checks`);
  process.exit(1);
}
console.log("\nAll COMPANY DNA-02 checks passed.");
