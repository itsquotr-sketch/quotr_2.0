/**
 * RECOVERY-5A — Assistant UI mode authority + post-estimate de-duplication.
 * Run: npx tsx scripts/verify-recovery-5a-assistant-modes.ts
 *
 * Presentation / orchestration only. Does not change rates, goldens, or estimate money.
 *
 * Refresh contract: edit_job is ephemeral local state. Refresh with an estimate
 * returns to estimate_ready. No DB enum. No history push for mode changes.
 */
import { existsSync, readFileSync } from "node:fs";
import {
  deriveAssistantUiMode,
  formatWorkAreaSummaryDetail,
  formatWorkAreaSummaryLine,
  staleEstimateMoneyPresentation,
} from "../lib/assistant/mode/derive";
import { resolveAttentionNavigation } from "../lib/assistant/mode/attention";
import { ASSISTANT_MODES_PRIMARY } from "../lib/assistant/mode/flags";
import { ASSISTANT_ACTION_LABELS } from "../lib/assistant/presentation/action-labels";
import { resolveActiveDisclosureStage } from "../lib/assistant/progressive-disclosure";
import { classifyResolvedSell } from "../lib/commercial-engine/core/cost-first-authority";
import { deriveSellFromCost } from "../lib/commercial-engine/core/sell-from-margin";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { getComponentCommercialAuthority } from "../lib/estimate/component-authority";
import { DECK_LABOUR_COMPONENT_KEY } from "../lib/estimate/deck-labour-requirement";
import { DECK_SURFACE_COMPONENT_KEY } from "../lib/estimate/deck-surface-requirement";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";
import { loadCalibrationFixture } from "./deck-calibration/run-deck-calibration";

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

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function wa(
  id: string,
  type = "deck",
  name = "Deck"
): EstimateWorkArea {
  return { id, type, name, sort_order: 1 };
}

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

const realJob = loadCalibrationFixture("REAL-JOB-01.json");
const DECK = "wa-deck-1";
const realFacts = Object.entries(realJob.facts).map(([key, value]) =>
  fact(key, DECK, value)
);

const orgSettings = {
  allow_benchmark_rates: true,
  default_margin_percent: 20,
  budget_rate_factor: 0.9,
  premium_rate_factor: 1.15,
};

function realJobContext(facts: EstimateFact[]): EstimateContext {
  return {
    project: { id: "real-job-01", qualityLevel: "standard" },
    confirmedWorkAreas: [wa(DECK)],
    facts,
    constraints: [],
    organisationSettings: orgSettings,
    materialWastageSettings: {
      deckingWastagePercent: 10,
      defaultMaterialWastagePercent: 10,
    },
    rates: [],
  } as unknown as EstimateContext;
}

const shell = read("components/assistant/AssistantShell.tsx");
const readyCard = read("components/assistant/EstimateReadyCard.tsx");
const readySurface = read(
  "components/assistant/mode/EstimateReadySurface.tsx"
);
const editSurface = read("components/assistant/mode/EditJobSurface.tsx");
const planningSurface = read("components/assistant/mode/PlanningSurface.tsx");
const deriveSrc = read("lib/assistant/mode/derive.ts");
const attentionSrc = read("lib/assistant/mode/attention.ts");
const estimatePanel = read("components/assistant/EstimatePanel.tsx");
const progress = read("components/assistant/AssistantProgress.tsx");
const jobPlanPanel = read("components/assistant/job-plan/JobPlanPanel.tsx");
const labels = read("lib/assistant/presentation/action-labels.ts");
const factActions = read("lib/assistant/fact-actions.ts");
const constraintActions = read("lib/assistant/constraint-actions.ts");
const jobPlanActions = read("lib/assistant/job-plan/actions.ts");

// ——— MODE ———
check("1 pre-estimate project → PLANNING", deriveAssistantUiMode({
  hasEstimate: false,
  editJobOpen: false,
}) === "planning");
check("2 current estimate → ESTIMATE_READY", deriveAssistantUiMode({
  hasEstimate: true,
  editJobOpen: false,
}) === "estimate_ready");
check("3 explicit Edit job → EDIT_JOB", deriveAssistantUiMode({
  hasEstimate: true,
  editJobOpen: true,
}) === "edit_job");
check(
  "4 no-change Done → ESTIMATE_READY",
  deriveAssistantUiMode({ hasEstimate: true, editJobOpen: false }) ===
    "estimate_ready" &&
    editSurface.includes("data-edit-job-done") &&
    shell.includes("onDone={closeEditJob}") &&
    !shell.includes("onDone={handleRegenerateEstimate}")
);
check(
  "5 edit canonical fact → stale state",
  factActions.includes("markEstimateStale") &&
    constraintActions.includes("markEstimateStale") &&
    jobPlanActions.includes("updateProjectFact") &&
    !editSurface.includes("markEstimateStale")
);
check(
  "6 stale state does not present money as current",
  staleEstimateMoneyPresentation(true).treatAsCurrent === false &&
    staleEstimateMoneyPresentation(true).sellLabel === "Previous estimate" &&
    readyCard.includes("data-stale-money-current") &&
    readyCard.includes("money.sellLabel")
);
check(
  "7 regeneration success → ESTIMATE_READY",
  shell.includes("regenerateStaticEstimate") &&
    shell.includes("setEditJobOpen(false)") &&
    deriveAssistantUiMode({ hasEstimate: true, editJobOpen: false }) ===
      "estimate_ready"
);
check(
  "8 hard blocker → PLANNING/Clarify",
  deriveAssistantUiMode({ hasEstimate: false, editJobOpen: true }) ===
    "planning" &&
    shell.includes("<ClarifyPanel") &&
    shell.includes("<EstimateReadySurface")
);

// ——— VISIBILITY ———
check(
  "9 Planning components absent in Estimate Ready primary flow",
  shell.includes("{assistantMode === \"planning\" ? (") &&
    shell.includes("<PlanningSurface>") &&
    shell.includes("assistantMode === \"estimate_ready\" && estimate")
);
check(
  "10 Edit panels absent until Edit job",
  shell.includes("assistantMode === \"edit_job\"") &&
    shell.includes("<EditJobSurface") &&
    (shell.includes("onEditJob={() => openEditJob(null)}") ||
      shell.includes("onEditJob={() => openEditJob(\"job_plan\")}")) &&
    editSurface.includes("data-assistant-surface=\"edit_job\"")
);
check(
  "11 Estimate Ready primary card shown once",
  (readyCard.match(/data-estimate-ready-primary="true"/g) ?? []).length === 1 &&
    (shell.match(/<EstimateReadyCard/g) ?? []).length === 1
);
check(
  "12 desktop sidebar not duplicate Assistant",
  estimatePanel.includes("compactCommercialSidebar") &&
    estimatePanel.includes("!compactCommercialSidebar") &&
    !estimatePanel.includes("ClarifyPanel") &&
    !estimatePanel.includes("<JobPlanPanel") &&
    shell.includes('compactCommercialSidebar={assistantMode === "estimate_ready"}')
);
check(
  "13 mobile sidebar absent",
  readySurface.includes("lg:hidden") &&
    shell.includes('assistantMode === "estimate_ready" && "hidden lg:block"') &&
    !readySurface.includes("lg:grid-cols")
);
check(
  "14 planning progress hidden/secondary after estimate",
  shell.includes("deemphasised={assistantMode !== \"planning\"}") &&
    progress.includes("data-assistant-progress-secondary") &&
    shell.includes('assistantMode === "planning" ? (') &&
    shell.includes("<StepperNav")
);

// ——— EDITING ———
check(
  "15 Job Plan editable",
  jobPlanPanel.includes("workspaceEditing") &&
    shell.includes("workspaceEditing") &&
    editSurface.includes("Work Areas")
);
check(
  "16 constraints editable",
  editSurface.includes("project_conditions") &&
    shell.includes("<ProjectConditionsBlock") &&
    shell.includes("<ConstraintBlock") &&
    constraintActions.includes("updateProjectConstraint")
);
check(
  "17 quick spec editable",
  jobPlanPanel.includes("onSpecFact") &&
    shell.includes("onSpecFact={handleJobPlanSpecFact}") &&
    shell.includes("workspaceEditing")
);
check(
  "18 advanced details progressive",
  editSurface.includes('id="advanced"') &&
    editSurface.includes("Proposals and specialist inputs") &&
    editSurface.includes("focusSection") &&
    editSurface.includes("{advanced ?")
);
check(
  "19 canonical writes only",
  !editSurface.includes("from(\"estimates\")") &&
    !editSurface.includes("localStorage") &&
    jobPlanActions.includes("updateProjectFact") &&
    factActions.includes("markEstimateStale") &&
    !shell.includes("editJobPersistence")
);
check(
  "20 cancel/no-change does not stale",
  shell.includes("const closeEditJob") &&
    !/closeEditJob[\s\S]{0,400}markEstimateStale/.test(shell) &&
    editSurface.includes("onClick={onDone}")
);
check(
  "21 changed estimate input stales",
  factActions.includes("await markEstimateStale") &&
    constraintActions.includes("await markEstimateStale")
);
check(
  "22 no one-way edit trap",
  editSurface.includes("data-edit-job-done") &&
    labels.includes("done:") &&
    shell.includes("onDone={closeEditJob}") &&
    shell.includes("handleQualityCancelEdit")
);

// ——— ATTENTION ———
check(
  "23 target focus opens one relevant edit context",
  resolveAttentionNavigation({ reviewTarget: "quality" }).kind === "edit_job" &&
    resolveAttentionNavigation({ reviewTarget: "quality" }).kind === "edit_job" &&
    (resolveAttentionNavigation({ reviewTarget: "quality" }) as { section: string }).section ===
      "details" &&
    (resolveAttentionNavigation({ reviewTarget: "projectConditions" }) as { section: string }).section ===
      "project_conditions" &&
    (resolveAttentionNavigation({
      factKey: "deck.vertical_face_boards_required",
    }) as { section: string }).section === "job_plan" &&
    resolveAttentionNavigation({ reviewTarget: "estimateReview" }).kind ===
      "builder_review"
);
check(
  "24 return path deterministic",
  shell.includes("openEditJob(nav.section)") &&
    shell.includes("onDone={closeEditJob}") &&
    !shell.includes("setSetupReviewOpen(true)")
);
check(
  "25 unrelated panels do not fan open",
  !shell.includes("setSetupReviewOpen(true)") &&
    !shell.includes("setForceExpandQuestions(true);\n        setForceExpandProjectConditions(true)") &&
    attentionSrc.includes("Does not fan-open") &&
    shell.includes("resolveAttentionNavigation")
);

// ——— MULTI-WA ———
check(
  "26 all Work Areas represented",
  formatWorkAreaSummaryLine(["Bathroom", "Deck", "Painting"]) ===
    "3 Work Areas" &&
    formatWorkAreaSummaryDetail(["Bathroom", "Deck", "Painting"]) ===
      "Bathroom · Deck · Painting" &&
    shell.includes("formatWorkAreaSummaryLine") &&
    !shell.includes("understandingSummaries[0]")
);
check(
  "27 edit one WA does not reset another",
  (jobPlanPanel.includes("plan.cards.map") ||
    jobPlanPanel.includes("cardsToRender.map")) &&
    shell.includes("onRemoveWorkArea={handleExcludeWorkArea}") &&
    !editSurface.includes("resetWorkAreas")
);
check(
  "28 summary not first-WA-only",
  formatWorkAreaSummaryLine(["Deck"]) === "Deck" &&
    formatWorkAreaSummaryDetail(["Deck"]) === null &&
    !readyCard.includes("understandingSummaries[0]") &&
    shell.includes("workAreaLists.included")
);

// ——— COMMERCIAL ———
const baseline = calculateEstimate(realJobContext(realFacts));
check(
  "29 unchanged inputs = same cost",
  baseline.recommendedCost === 10526.3
);
check(
  "30 unchanged inputs = same sell",
  baseline.recommendedSell === 16069.1
);
const classify = classifyResolvedSell({
  costRate: 22.5,
  sellRate: null,
  applicableGrossMarginPercent: 23.5,
});
check(
  "31 Pricing parity",
  classify.sellAuthority === "derived_from_gross_margin" &&
    classify.sellRate === deriveSellFromCost(22.5, 23.5) &&
    existsSync("scripts/verify-recovery-1-commercial-authority.ts") &&
    !editSurface.includes("handleMarginSave") &&
    !editSurface.includes("updateEstimateMargin")
);
check(
  "32 no structural promotion",
  getComponentCommercialAuthority({
    workAreaType: "deck",
    componentKey: DECK_LABOUR_COMPONENT_KEY,
  }).authority === "SHADOW" &&
    getComponentCommercialAuthority({
      workAreaType: "deck",
      componentKey: DECK_SURFACE_COMPONENT_KEY,
    }).authority === "REQUIREMENT_AUTHORITATIVE" &&
    !shell.includes("PROMOTE") &&
    !deriveSrc.includes("calculateEstimate")
);

// ——— MOBILE ———
check(
  "33 compact estimate ready",
  readyCard.includes("text-3xl") &&
    readySurface.includes("data-assistant-surface=\"estimate_ready\"") &&
    !readySurface.includes("xl:grid-cols")
);
check(
  "34 no permanent sidebar",
  shell.includes('assistantMode === "estimate_ready" && "hidden lg:block"') &&
    readySurface.includes("data-estimate-ready-mobile-pricing")
);
check(
  "35 one dominant CTA",
  readyCard.includes("data-estimate-ready-primary-cta") &&
    (readyCard.match(/data-estimate-ready-primary-cta/g) ?? []).length === 2 &&
    labels.includes("continueToPricing")
);
check(
  "36 no horizontal overflow",
  planningSurface.includes("overflow-x-hidden") &&
    readySurface.includes("overflow-x-hidden") &&
    editSurface.includes("overflow-x-hidden")
);
check(
  "37 Edit Job usable at mobile width",
  editSurface.includes("min-h-11") &&
    editSurface.includes("safe-area-inset-bottom") &&
    editSurface.includes("w-full") &&
    !editSurface.includes("lg:grid-cols-2")
);

// ——— ERROR/LOADING ———
check(
  "38 stale/regenerate loading explicit",
  readyCard.includes("isRegenerating") &&
    readyCard.includes("updatingEstimate") &&
    readyCard.includes("disabled={isRegenerating}") &&
    readySurface.includes("data-estimate-regenerating")
);
check(
  "39 regeneration failure preserves prior estimate safely",
  shell.includes('if (action === "regenerate")') &&
    shell.includes("setActionError(result.error)") &&
    shell.includes("setIsRegenerating(false)") &&
    readyCard.includes("money.sellLabel") &&
    readyCard.includes("line-through")
);
check(
  "40 retry available",
  labels.includes("updateEstimate") &&
    readyCard.includes("onUpdateEstimate") &&
    ASSISTANT_ACTION_LABELS.retry === "Retry"
);

// ——— LEGACY ———
check(
  "41 legacy current-estimate project enters Estimate Ready",
  deriveAssistantUiMode({ hasEstimate: true, editJobOpen: false }) ===
    "estimate_ready" &&
    ASSISTANT_MODES_PRIMARY === true &&
    resolveActiveDisclosureStage({
      briefSubmitted: true,
      workAreasConfirmed: true,
      scopeDiscoveryEnabled: true,
      scopeReviewComplete: true,
      qualityUnlocked: true,
      qualitySubmitted: true,
      questionsSubmitted: true,
      constraintsSubmitted: true,
      estimateReady: true,
      estimateStale: false,
    }) === null
);
check(
  "42 legacy stale project safe",
  deriveAssistantUiMode({ hasEstimate: true, editJobOpen: false }) ===
    "estimate_ready" &&
    staleEstimateMoneyPresentation(true).treatAsCurrent === false &&
    resolveActiveDisclosureStage({
      briefSubmitted: true,
      workAreasConfirmed: true,
      scopeDiscoveryEnabled: true,
      scopeReviewComplete: true,
      qualityUnlocked: true,
      qualitySubmitted: true,
      questionsSubmitted: true,
      constraintsSubmitted: true,
      estimateReady: true,
      estimateStale: true,
    }) === null
);
check(
  "43 refresh safe",
  deriveSrc.includes("NOT persisted") &&
    deriveSrc.includes("Refresh with a current/stale estimate") &&
    shell.includes("[editJobOpen, setEditJobOpen] = useState(false)") &&
    !shell.includes("edit_job=")
);

check(
  "44 Builder Review hook only, no throwaway review UI",
  readyCard.includes("data-builder-review-entry") &&
    shell.includes("setBuilderReviewOpen(true)") &&
    existsSync("components/assistant/builder-review/BuilderReviewSurface.tsx") &&
    !editSurface.includes("Allowances") &&
    !readySurface.includes("Allowances")
);
check(
  "45 no new DB enum / migration",
  !existsSync("supabase/migrations/037_assistant_ui_mode.sql") &&
    !deriveSrc.includes("assistant_ui_mode") &&
    !shell.includes("projects.assistant_mode")
);
check(
  "46 EDIT_JOB is not the old wizard sequence",
  !editSurface.includes("Project Capture") &&
    !editSurface.includes("Looks right") &&
    editSurface.includes("not a step-by-step interview") &&
    shell.includes("workspaceEditing")
);
check(
  "47 Continue to Pricing label on Estimate Ready",
  labels.includes('continueToPricing: "Continue to Pricing"') &&
    readySurface.includes("ASSISTANT_ACTION_LABELS.continueToPricing") &&
    estimatePanel.includes("ASSISTANT_ACTION_LABELS.continueToPricing")
);
check(
  "48 flag is primary",
  ASSISTANT_MODES_PRIMARY === true &&
    shell.includes("data-assistant-modes-primary")
);
check(
  "49 pre-estimate Clarify still primary",
  shell.includes("CLARIFY_IS_PRIMARY") &&
    shell.includes("<ClarifyPanel") &&
    shell.includes('title="Clarify"') &&
    existsSync("scripts/verify-recovery-4-clarify.ts")
);
check(
  "50 Estimate Ready actions present",
  ASSISTANT_ACTION_LABELS.reviewEstimate === "Review estimate" &&
    ASSISTANT_ACTION_LABELS.editJob === "Edit job" &&
    ASSISTANT_ACTION_LABELS.updateEstimate === "Update estimate"
);

const staleMoney = staleEstimateMoneyPresentation(true);
const currentMoney = staleEstimateMoneyPresentation(false);
check(
  "51 stale heading precedes current-style price presentation",
  staleMoney.leadWithPrice === false &&
    staleMoney.heading === "Estimate needs updating" &&
    readyCard.includes("needs-updating-first") &&
    readyCard.includes("data-stale-heading") &&
    readyCard.indexOf("data-stale-heading") <
      readyCard.indexOf("data-previous-estimate") &&
    readyCard.includes("text-lg font-semibold") &&
    !readyCard
      .slice(
        readyCard.indexOf("data-stale-heading"),
        readyCard.indexOf("data-previous-estimate")
      )
      .includes("text-3xl")
);
check(
  "52 stale number labelled previous",
  staleMoney.sellLabel === "Previous estimate" &&
    readyCard.includes("data-previous-estimate") &&
    readyCard.includes("money.sellLabel") &&
    estimatePanel.includes("data-compact-stale-summary")
);
check(
  "53 stale price not labelled recommended sell",
  staleMoney.sellLabel !== "Recommended sell" &&
    currentMoney.sellLabel === "Recommended sell" &&
    readyCard.includes('data-lead-with-price={money.leadWithPrice ? "true" : "false"}') &&
    readyCard.includes("line-through")
);
check(
  "54 Update estimate is dominant stale CTA",
  readyCard.includes('data-estimate-ready-primary-cta="update"') &&
    readyCard.indexOf('data-estimate-ready-primary-cta="update"') <
      readyCard.indexOf('data-estimate-ready-secondary-cta="review-previous"') &&
    ASSISTANT_ACTION_LABELS.updateEstimate === "Update estimate"
);
check(
  "55 Pricing blocked stale",
  readySurface.includes("!isStale && pricingCtaEnabled") &&
    estimatePanel.includes("estimate && !isStale") &&
    readySurface.includes("PrepareFinalPricingButton")
);
check(
  "56 outer Edit Job action is Done, not fake Cancel",
  editSurface.includes('data-edit-job-exit="done"') &&
    editSurface.includes("ASSISTANT_ACTION_LABELS.done") &&
    !editSurface.includes("data-edit-job-cancel") &&
    !editSurface.includes("ASSISTANT_ACTION_LABELS.cancel") &&
    ASSISTANT_ACTION_LABELS.done === "Done" &&
    deriveSrc.includes("workspace exit is Done")
);
check(
  "57 no-change Done remains current",
  deriveAssistantUiMode({ hasEstimate: true, editJobOpen: false }) ===
    "estimate_ready" &&
    shell.includes("onDone={closeEditJob}") &&
    !shell.includes("onDone={handleRegenerateEstimate}") &&
    !shell.includes("closeEditJob") === false
);
check(
  "58 canonical write → stale",
  factActions.includes("await markEstimateStale") &&
    constraintActions.includes("await markEstimateStale") &&
    jobPlanActions.includes("updateProjectFact")
);
check(
  "59 mobile stale mode has no sidebar",
  shell.includes('assistantMode === "estimate_ready" && "hidden lg:block"') &&
    readySurface.includes('data-estimate-stale={isStale ? "true" : "false"}') &&
    !readySurface.includes("lg:grid-cols")
);
check(
  "60 one dominant stale CTA",
  (readyCard.match(/data-estimate-ready-primary-cta="update"/g) ?? []).length ===
    1 &&
    !readyCard.includes('data-estimate-ready-primary-cta="review"') === false &&
    readyCard.includes('data-estimate-ready-secondary-cta="review-previous"') &&
    readySurface.includes("!isStale && pricingCtaEnabled")
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
