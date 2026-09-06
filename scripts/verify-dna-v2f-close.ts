/**
 * DNA-V2F — Company DNA V2 integration closeout.
 *
 * Run: npx --yes tsx scripts/verify-dna-v2f-close.ts
 *
 * No migration 055. No new maths. Production not in scope.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import { calculateFence } from "../lib/estimate/calculators/fence";
import { calculateRetainingWall } from "../lib/estimate/calculators/retaining-wall";
import { DECK_CONCRETE_TO_SUPPORTS_FACT_KEY } from "../lib/estimate/deck-scope-2c";
import {
  DNA_CALIBRATE,
  DNA_HUB_CONCEPT,
  DNA_HUB_INTRO,
  DNA_RECALIBRATE,
  DNA_RESET_CTA,
  DNA_SOURCE_QUOTR_BENCHMARK,
  DNA_SOURCE_YOUR_CALIBRATION,
  formatDnaCompactHoursPerUnit,
  formatDnaOptionalRemaining,
  formatDnaRwRatesSummary,
  formatDnaRwSystemLine,
  formatDnaV2DashboardCta,
} from "../lib/company-dna/copy";
import { formatDnaScenarioMeasure } from "../lib/company-dna/quantity-format";
import { companyDnaWorkAreaStatusV2 } from "../lib/company-dna/derive";
import {
  COMPANY_DNA_DECK_TIER1_KEYS,
  COMPANY_DNA_FENCE_TIER1_KEYS,
  companyDnaUiWorkAreaStatus,
  isCompanyDnaV2WorkArea,
  listCompanyDnaUiTasksForWorkArea,
} from "../lib/company-dna/v2-ui";
import {
  COMPANY_DNA_RW_TIMBER_TIER1_KEYS,
  listRwSystemProgress,
} from "../lib/company-dna/rw-v2";
import {
  ratesProductivityCta,
  workAreaHubCta,
} from "../lib/company-dna/progress";
import { summarizeProductivityWorkAreas } from "../lib/rates/productivity-work-area-summary";
import { resolvePersonalisationNextStep } from "../lib/setup/personalisation-ladder";
import { roleAllowsPermission } from "../lib/team/permissions";
import { loadCalibrationFixture } from "./deck-calibration/run-deck-calibration";
import { RATE_SOURCE_FRIENDLY_LABELS } from "../lib/estimate/rate-source-labels";
import { mapRateLabel } from "../lib/assistant/builder-review/compose";
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
    .filter((name) => /^\d+_/.test(name) && name.endsWith(".sql"))
    .sort();
}

function fact(key: string, value: unknown, workAreaId = "wa1"): EstimateFact {
  return { key, work_area_id: workAreaId, value };
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
    work_area_type: null,
    source: "calibrated_productivity",
    source_calibration_id: "dna-v2f",
  };
}

function hoursByLabel(items: readonly EstimateLineItemInput[], label: string): number {
  return items
    .filter((item) => item.label === label)
    .reduce((sum, item) => sum + (Number(item.labourHours) || 0), 0);
}

function qtyByLabel(items: readonly EstimateLineItemInput[], label: string): number {
  return items
    .filter((item) => item.label === label)
    .reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
}

console.log("=== DNA-V2F CLOSE ===\n");

check("no migration 055", !numberedMigrations().some((name) => name.startsWith("055_")));
check("054 remains latest", numberedMigrations().at(-1)?.startsWith("054_") === true);

const hub = read("components/company-dna/CompanyDnaHub.tsx");
const rates = read("components/rates/CompanyDnaRatesCompare.tsx");
const actions = read("lib/company-dna/actions.ts");
const sql = read("supabase/migrations/052_company_productivity_calibration.sql");
const productivity = read("lib/estimate/productivity.ts");

check("hub title is Company DNA", hub.includes("DNA_HUB_TITLE") && DNA_HUB_INTRO.includes("Teach Quotr how your team normally works"));
check("hub concept sentence", DNA_HUB_CONCEPT.includes("learns how long your crew normally takes"));
check("hub intro has no V2 jargon", !/\bv2c\b|\bv2d\b|\bv2e\b|catalogue/i.test(DNA_HUB_INTRO));
check("hub cards keep generation as data attr only", hub.includes("data-company-dna-generation"));
check(
  "hub visible copy has no generation labels",
  !hub.includes("v2c") && !hub.includes("v2d") && !hub.includes("v2e")
);
check("Deck/Fence/RW are V2 work areas", isCompanyDnaV2WorkArea("deck") && isCompanyDnaV2WorkArea("fence") && isCompanyDnaV2WorkArea("retaining_wall"));
check("hub CTA start", workAreaHubCta("benchmarks") === "Start calibration");
check("hub CTA continue", workAreaHubCta("partly") === "Continue calibration");
check("hub CTA review", workAreaHubCta("calibrated") === "Review calibration");
check(
  "Deck 0 T1 not calibrated",
  companyDnaUiWorkAreaStatus({ workAreaType: "deck", calibratedTaskKeys: [] }) === "benchmarks"
);
check(
  "Deck 1 T1 partly",
  companyDnaUiWorkAreaStatus({
    workAreaType: "deck",
    calibratedTaskKeys: [COMPANY_DNA_DECK_TIER1_KEYS[0]],
  }) === "partly"
);
check(
  "Deck 3 T1 using your calibration",
  companyDnaUiWorkAreaStatus({
    workAreaType: "deck",
    calibratedTaskKeys: COMPANY_DNA_DECK_TIER1_KEYS,
  }) === "calibrated"
);
check(
  "Fence 3 T1 complete",
  companyDnaUiWorkAreaStatus({
    workAreaType: "fence",
    calibratedTaskKeys: COMPANY_DNA_FENCE_TIER1_KEYS,
  }) === "calibrated"
);
check(
  "RW timber T1 calibrates work area without masonry",
  companyDnaUiWorkAreaStatus({
    workAreaType: "retaining_wall",
    calibratedTaskKeys: COMPANY_DNA_RW_TIMBER_TIER1_KEYS,
  }) === "calibrated"
);
check(
  "RW system lines distinguish remaining benchmarks",
  formatDnaRwSystemLine({
    label: "Sleeper",
    status: "benchmarks",
    tier1Calibrated: 0,
    tier1Total: 3,
  }) === "Sleeper: Uses Quotr benchmarks"
);
check(
  "V1 two-high-impact helper is not used for V2 status",
  companyDnaWorkAreaStatusV2({ tier1Total: 3, tier1Calibrated: 2 }) === "partly"
);

const summaries = summarizeProductivityWorkAreas([]);
const deckRates = summaries.find((row) => row.workAreaType === "deck");
const fenceRates = summaries.find((row) => row.workAreaType === "fence");
const rwRates = summaries.find((row) => row.workAreaType === "retaining_wall");
check("Rates Deck 7/3", deckRates?.taskTotal === 7 && deckRates.keyTaskTotal === 3);
check("Rates Fence 9/3", fenceRates?.taskTotal === 9 && fenceRates.keyTaskTotal === 3);
check("Rates RW 15 system-aware", rwRates?.taskTotal === 15 && rwRates.generation === "v2e");
check("Rates RW empty is Not calibrated", rwRates?.summaryLine === "Not calibrated");
check("Rates compact CTAs", ratesProductivityCta("calibrated") === "View" && ratesProductivityCta("partly") === "Continue");
check(
  "Rates RW timber-only summary",
  formatDnaRwRatesSummary({
    systems: listRwSystemProgress(COMPANY_DNA_RW_TIMBER_TIER1_KEYS),
  }).includes("Timber calibrated") &&
    formatDnaRwRatesSummary({
      systems: listRwSystemProgress(COMPANY_DNA_RW_TIMBER_TIER1_KEYS),
    }).includes("Other systems using Quotr benchmarks")
);
check("Rates source Your calibration", rates.includes("DNA_SOURCE_YOUR_CALIBRATION"));
check("Rates groups RW expanded rows", rates.includes('data-company-dna-rate-group'));
check("Rates uses compact hours formatter", rates.includes("formatDnaCompactHoursPerUnit"));
check("optional language", (formatDnaOptionalRemaining({ optionalTotal: 4, optionalCalibrated: 0 }) ?? "").includes("optional"));
check(
  "quantity formatter hides ugly decimals",
  formatDnaScenarioMeasure(142.8571, "lm").includes("about 143") &&
    !formatDnaCompactHoursPerUnit(0.4444444, "lm").includes("0.4444444")
);

const startDeck = formatDnaV2DashboardCta({
  workAreaLabel: "Deck",
  remainingKeyTasks: 3,
  totalKeyTasks: 3,
});
const remainDeck = formatDnaV2DashboardCta({
  workAreaLabel: "Deck",
  remainingKeyTasks: 2,
  totalKeyTasks: 3,
});
check("dashboard start title", startDeck.title === "Improve your Deck estimates");
check("dashboard CTA is Continue calibration", startDeck.cta === "Continue calibration");
check("dashboard remaining title", remainDeck.title.includes("2 more key Deck tasks"));
const afterDeck = resolvePersonalisationNextStep({
  firstRunComplete: true,
  hasWorkTypePreferences: true,
  hasCalibration: true,
  hasHighImpactCalibration: true,
  companyRateCount: 3,
  hasContactEmail: true,
  hasAddress: false,
  hasLogo: false,
  preferredWorkAreaTypes: ["deck"],
  deckKeyTasksCalibrated: 3,
  deckKeyTasksTotal: 3,
});
check(
  "key completion does not nag optional tasks",
  afterDeck?.id === "company_profile"
);
check(
  "DNA is not a first-run blocker",
  resolvePersonalisationNextStep({
    firstRunComplete: false,
    hasWorkTypePreferences: false,
    hasCalibration: false,
    companyRateCount: 0,
    hasContactEmail: false,
    hasAddress: false,
    hasLogo: false,
  }) === null
);

check("consistent Recalibrate label", DNA_RECALIBRATE === "Recalibrate" && rates.includes("DNA_RECALIBRATE"));
check("consistent Calibrate label", DNA_CALIBRATE === "Calibrate");
check("consistent reset label", DNA_RESET_CTA === "Use Quotr benchmark");
check("source labels", DNA_SOURCE_YOUR_CALIBRATION === "Your calibration" && DNA_SOURCE_QUOTR_BENCHMARK === "Quotr benchmark");
check(
  "Builder Review distinguishes calibrated vs benchmark",
  mapRateLabel("calibrated_productivity") === "Your calibrated productivity" &&
    mapRateLabel("productivity") === "Quotr productivity benchmark"
);
check(
  "estimate friendly calibrated label unchanged",
  RATE_SOURCE_FRIENDLY_LABELS.calibrated_productivity === "Your calibrated productivity"
);

check("task counts Deck 7 Fence 9 RW 15", listCompanyDnaUiTasksForWorkArea("deck").length === 7 && listCompanyDnaUiTasksForWorkArea("fence").length === 9 && listCompanyDnaUiTasksForWorkArea("retaining_wall").length === 15);

check("Owner calibrates", roleAllowsPermission("owner", "company.calibration.manage"));
check("Admin calibrates", roleAllowsPermission("admin", "company.calibration.manage"));
check("Estimator calibrates", roleAllowsPermission("estimator", "company.calibration.manage"));
check("Viewer read-only", !roleAllowsPermission("viewer", "company.calibration.manage"));
check("Estimator cannot manage commercial rates", !roleAllowsPermission("estimator", "company.rates.manage"));
check("Owner can manage commercial rates", roleAllowsPermission("owner", "company.rates.manage"));

check("hub progress is one evidence query", actions.includes("productivity_calibration_responses") && actions.includes("Promise.all"));
check("estimate productivity is in-memory rates lookup", productivity.includes("findCompanyProductivityRate") && !productivity.includes(".from(\"rates\")"));
check("save supersedes prior active evidence", sql.includes("status = 'superseded'") && sql.includes("supersedes_id"));
check("reset deactivates calibrated rate and keeps evidence", sql.includes("active = false") && sql.includes("Evidence is retained"));

check("V1 task flow retained as fallback", read("app/(protected)/app/setup/dna/[taskKey]/page.tsx").includes("CompanyDnaTaskFlow"));
check("shared V2 work area list is not hardcoded in hub map only", read("lib/company-dna/v2-ui.ts").includes("COMPANY_DNA_V2_UI_WORK_AREAS"));

const KWILA = loadCalibrationFixture("OWNER-KWILA-01.json");
const kwilaId = "kwila";
const kwilaFacts: EstimateFact[] = [
  ...Object.entries(KWILA.facts).map(([key, value]) => fact(key, value, kwilaId)),
  fact(DECK_CONCRETE_TO_SUPPORTS_FACT_KEY, true, kwilaId),
];
function deckWa(): EstimateWorkArea & { status: "confirmed" } {
  return { id: kwilaId, type: "deck", name: "Deck", sort_order: 1, status: "confirmed" };
}
function deckCtx(rates: readonly OrganisationRate[] = []): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [deckWa()],
    facts: kwilaFacts,
    constraints: [
      { key: "site_access", value: "Moderate" },
      { key: "material_carry_distance", value: "10–30m" },
    ],
    materialWastageSettings: null,
    rates: [labourOrgRate(78), ...rates],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
      budget_rate_factor: 0.9,
      premium_rate_factor: 1.15,
    },
  } as unknown as EstimateContext;
}
const deckBefore = calculateDeck(deckCtx(), deckWa());
const deckAfter = calculateDeck(
  deckCtx([productivityOrgRate("deck.posts.install.hours_per_ea", "ea", 1.2)]),
  deckWa()
);
check(
  "Deck posts calibration changes post labour only",
  hoursByLabel(deckAfter.lineItems, "Pile/post installation") >
    hoursByLabel(deckBefore.lineItems, "Pile/post installation") &&
    hoursByLabel(deckAfter.lineItems, "Concrete placement") ===
      hoursByLabel(deckBefore.lineItems, "Concrete placement")
);
check(
  "Deck physical qty unchanged",
  qtyByLabel(deckAfter.lineItems, "Pile/post installation") ===
    qtyByLabel(deckBefore.lineItems, "Pile/post installation")
);

function fenceFacts(): EstimateFact[] {
  return [
    fact("fence.length_m", 18, "f1"),
    fact("fence.height_m", 1.8, "f1"),
    fact("fence.system", "Timber paling — vertical board", "f1"),
    fact("fence.timber_species", "Radiata Pine", "f1"),
    fact("fence.board_thickness_mm", "150 × 19mm", "f1"),
    fact("fence.post_spacing_m", 1.8, "f1"),
    fact("fence.gate_included", false, "f1"),
    fact("fence.top_capping", "No", "f1"),
    fact("fence.vertical_paling_gap_mm", 0, "f1"),
    fact("fence.demolition_required", true, "f1"),
    fact("fence.demolition_length_m", 18, "f1"),
  ];
}
function fenceWa(): EstimateWorkArea & { status: "confirmed" } {
  return { id: "f1", type: "fence", name: "Fence", sort_order: 1, status: "confirmed" };
}
function fenceCtx(rates: readonly OrganisationRate[] = []): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [fenceWa()],
    facts: fenceFacts(),
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
const fenceBefore = calculateFence(fenceCtx(), fenceWa());
const fenceAfter = calculateFence(
  fenceCtx([productivityOrgRate("fence.post.install.hours_per_post", "post", 1.4)]),
  fenceWa()
);
check(
  "Fence posts calibration changes post labour",
  hoursByLabel(fenceAfter.lineItems, "Post installation") >
    hoursByLabel(fenceBefore.lineItems, "Post installation")
);

function rwTimberFacts(): EstimateFact[] {
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
    fact("retaining_wall.digger_access", "Yes"),
  ];
}
function rwWa(): EstimateWorkArea & { status: "confirmed" } {
  return {
    id: "wa1",
    type: "retaining_wall",
    name: "Retaining",
    sort_order: 1,
    status: "confirmed",
  };
}
function rwCtx(rates: readonly OrganisationRate[] = []): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [rwWa()],
    facts: rwTimberFacts(),
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
const rwBefore = calculateRetainingWall(rwCtx(), rwWa());
const rwAfter = calculateRetainingWall(
  rwCtx([
    productivityOrgRate("retaining_wall.timber.piles.install.hours_per_ea", "ea", 1.6),
  ]),
  rwWa()
);
check(
  "RW pile calibration changes pile labour",
  hoursByLabel(rwAfter.lineItems, "Pile installation labour") >
    hoursByLabel(rwBefore.lineItems, "Pile installation labour")
);

const fenceWithDeckCal = calculateFence(
  fenceCtx([productivityOrgRate("deck.posts.install.hours_per_ea", "ea", 0.05)]),
  fenceWa()
);
check(
  "Deck calibration does not change Fence posts",
  hoursByLabel(fenceWithDeckCal.lineItems, "Post installation") ===
    hoursByLabel(fenceBefore.lineItems, "Post installation")
);
const deckWithFenceCal = calculateDeck(
  deckCtx([productivityOrgRate("fence.post.install.hours_per_post", "post", 0.05)]),
  deckWa()
);
check(
  "Fence calibration does not change Deck posts",
  hoursByLabel(deckWithFenceCal.lineItems, "Pile/post installation") ===
    hoursByLabel(deckBefore.lineItems, "Pile/post installation")
);
const rwWithDeckCal = calculateRetainingWall(
  rwCtx([productivityOrgRate("deck.posts.install.hours_per_ea", "ea", 0.05)]),
  rwWa()
);
check(
  "Deck calibration does not change RW piles",
  hoursByLabel(rwWithDeckCal.lineItems, "Pile installation labour") ===
    hoursByLabel(rwBefore.lineItems, "Pile installation labour")
);

check(
  "manual pile honesty guard present",
  read("lib/estimate/retaining-wall-commercial.ts").includes("ignoreCompanyRate")
);
check("mobile hub stacks", hub.includes("space-y-3") && hub.includes("min-h-11"));
check("mobile Rates no giant matrix", rates.includes("Show tasks") && rates.includes("rounded-lg border"));
check("stale Foundation R1 DNA freeze updated", read("scripts/verify-foundation-r1-project-conditions-support.ts").includes("Company DNA V2 now exists"));

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
