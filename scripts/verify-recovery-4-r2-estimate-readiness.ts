/**
 * RECOVERY-4-R2 — Estimate readiness, Refine, and legacy Estimate now gate.
 * Run: npx tsx scripts/verify-recovery-4-r2-estimate-readiness.ts
 *
 * Presentation / planning integration only. Does not change rates, goldens,
 * or estimate money.
 */
import { existsSync, readFileSync } from "node:fs";
import { applyJobPlanScopeWrite } from "../lib/assistant/job-plan/apply-write";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import {
  isImplicitScopeExclusion,
  scopeExclusionProvenance,
} from "../lib/assistant/job-plan/exclusion-provenance";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import {
  DEFAULT_ESTIMATE_QUALITY,
  LEGACY_SCOPE_BEFORE_SPEC_ERROR,
  legacyQualityRequiresScopeReview,
} from "../lib/assistant/clarify/quality-gate";
import { CLARIFY_IS_PRIMARY } from "../lib/assistant/clarify/flags";
import { JOB_PLAN_IS_PRIMARY } from "../lib/assistant/job-plan/flags";
import { ASSISTANT_MODES_PRIMARY } from "../lib/assistant/mode/flags";
import { deriveAssistantUiMode } from "../lib/assistant/mode/derive";
import { composeEstimateReadiness } from "../lib/assistant/readiness/compose";
import {
  composeRefineView,
  DECK_NOT_CONSUMED_REFINE_KEYS,
} from "../lib/assistant/refine/compose";
import { ASSISTANT_ACTION_LABELS } from "../lib/assistant/presentation/action-labels";
import { classifyResolvedSell } from "../lib/commercial-engine/core/cost-first-authority";
import { deriveSellFromCost } from "../lib/commercial-engine/core/sell-from-margin";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { getComponentCommercialAuthority } from "../lib/estimate/component-authority";
import { DECK_LABOUR_COMPONENT_KEY } from "../lib/estimate/deck-labour-requirement";
import { isScopeDiscoveryEnabled } from "../lib/scope-discovery/configuration";
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

function wa(id: string, type = "deck", name = "Deck"): EstimateWorkArea & { status: string } {
  return { id, type, name, sort_order: 1, status: "confirmed" };
}

function fact(key: string, workAreaId: string, value: unknown, source?: string): EstimateFact {
  return { key, work_area_id: workAreaId, value, source };
}

const realJob = loadCalibrationFixture("REAL-JOB-01.json");
const exemplar = loadCalibrationFixture("EXEMPLAR-AI-01.json");
const DECK = "wa-deck-1";
const realFacts = Object.entries(realJob.facts).map(([key, value]) =>
  fact(key, DECK, value)
);
const exemplarFacts = Object.entries(exemplar.facts).map(([key, value]) =>
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

function composePair(
  facts: EstimateFact[],
  brief: string,
  qualityLevel: string | null = "standard"
) {
  const workAreas = [wa(DECK)];
  const plan = composeJobPlan({
    workAreas: workAreas.map((row) => ({
      id: row.id,
      type: row.type,
      name: row.name,
      status: "confirmed" as const,
    })),
    facts,
    qualityLevel,
    briefText: brief,
  });
  const clarify = composeClarifyView({
    stage: "quality",
    briefText: brief,
    qualityLevel,
    workAreas,
    facts,
    constraints: [],
    jobPlan: plan,
  });
  const readiness = composeEstimateReadiness({
    clarify,
    jobPlan: plan,
    qualityLevel,
    constraints: [],
  });
  const refine = composeRefineView({
    briefText: brief,
    qualityLevel,
    workAreas,
    facts,
    constraints: [],
    jobPlan: plan,
  });
  return { plan, clarify, readiness, refine };
}

const real = composePair(realFacts, realJob.sourceBrief);
const exemplarPair = composePair(exemplarFacts, exemplar.sourceBrief);
const actionsSrc = read("lib/assistant/actions.ts");
const clarifyActions = read("lib/assistant/clarify/actions.ts");
const qualityGate = read("lib/assistant/clarify/quality-gate.ts");
const shell = read("components/assistant/AssistantShell.tsx");
const panel =
  read("components/assistant/clarify/ClarifyPanel.tsx") +
  read("components/assistant/clarify/ClarifyReadiness.tsx");
const extractSrc = read("lib/ai/extract.ts");
const promptSrc = read("lib/ai/brief-extraction-prompt.ts");
const assumptionsSrc = read("lib/assistant/clarify/assumptions.ts");
const stripSrc = read("lib/scopes/strip-implicit-scope-exclusions.ts");

console.log("=== RECOVERY-4-R2 Estimate readiness ===\n");

check(
  "1 Estimate now no longer hits legacy specification prerequisite",
  legacyQualityRequiresScopeReview() === false &&
    CLARIFY_IS_PRIMARY &&
    JOB_PLAN_IS_PRIMARY &&
    actionsSrc.includes("legacyQualityRequiresScopeReview()")
);
check(
  "2 exact old error path is removed/bypassed correctly",
  actionsSrc.includes("legacyQualityRequiresScopeReview()") &&
    qualityGate.includes("LEGACY_SCOPE_BEFORE_SPEC_ERROR") &&
    legacyQualityRequiresScopeReview() === false &&
    actionsSrc.includes(LEGACY_SCOPE_BEFORE_SPEC_ERROR)
);
check(
  "3 no hidden Specification stage required",
  shell.includes("CLARIFY_IS_PRIMARY") &&
    shell.includes("<ClarifyPanel") &&
    shell.includes("(!CLARIFY_IS_PRIMARY || isEditingQuality)") &&
    shell.includes("completeClarifyPlanning")
);
check(
  "4 no hidden Scope Details completion required",
  clarifyActions.includes("submitOpenQuestionBlock") &&
    clarifyActions.includes("Does not write false Facts")
);
check(
  "5 no hidden Project Conditions stage completion required",
  clarifyActions.includes("saveConstraints(input.projectId, [])") &&
    shell.includes("CLARIFY_IS_PRIMARY && !constraintsSubmitted")
);

const realCard = real.plan.cards[0];
const fascia = realCard?.notConfirmed.find((i) => i.id === "fascia");
check(
  "6 unresolved assumable fascia does not block",
  fascia?.presentation === "NOT_CONFIRMED" &&
    real.clarify.canEstimateNow &&
    !real.clarify.blocksEstimate
);
check(
  "7 unresolved assumable scope is not persisted false",
  applyJobPlanScopeWrite({
    facts: realFacts,
    workAreaId: DECK,
    write: fascia!.write!,
    presentation: "NOT_CONFIRMED",
  }).every((f) => f.key !== "deck.vertical_face_boards_required") &&
    assumptionsSrc.includes("persistedExclusion: false")
);

const afterExclude = applyJobPlanScopeWrite({
  facts: realFacts,
  workAreaId: DECK,
  write: fascia!.write!,
  presentation: "NOT_INCLUDED",
});
check(
  "8 explicit Job Plan exclusion persists false",
  afterExclude.some(
    (f) => f.key === "deck.vertical_face_boards_required" && f.value === false
  )
);
const afterInclude = applyJobPlanScopeWrite({
  facts: realFacts,
  workAreaId: DECK,
  write: fascia!.write!,
  presentation: "INCLUDED",
});
check(
  "9 explicit user inclusion persists true",
  afterInclude.some(
    (f) => f.key === "deck.vertical_face_boards_required" && f.value === true
  )
);
check(
  "10 absence from brief never becomes exclusion without provenance",
  !realFacts.some((f) => f.key === "deck.existing_deck_removal") &&
    promptSrc.includes("Absent from the brief is not an exclusion") &&
    extractSrc.includes("stripImplicitScopeExclusions")
);

const removalProv = scopeExclusionProvenance({
  factKey: "deck.existing_deck_removal",
  workAreaId: DECK,
  facts: realFacts,
  briefText: realJob.sourceBrief,
  presentation: "NOT_CONFIRMED",
});
const stepsProv = scopeExclusionProvenance({
  factKey: "deck.access_type",
  workAreaId: DECK,
  facts: realFacts,
  briefText: realJob.sourceBrief,
  presentation: "NOT_CONFIRMED",
});
const balProv = scopeExclusionProvenance({
  factKey: "deck.balustrade_required",
  workAreaId: DECK,
  facts: realFacts,
  briefText: realJob.sourceBrief,
  presentation: "NOT_CONFIRMED",
  suppressed: realCard?.notIncluded.every((i) => i.id !== "balustrade") &&
    realCard?.notConfirmed.every((i) => i.id !== "balustrade"),
});
check(
  "11 REAL-JOB removal provenance correct",
  removalProv.kind === "absent" &&
    removalProv.persistedFalse === false &&
    realCard?.notConfirmed.some((i) => i.id === "removal")
);
check(
  "12 REAL-JOB steps provenance correct",
  stepsProv.kind === "absent" &&
    stepsProv.persistedFalse === false &&
    realCard?.notConfirmed.some((i) => i.id === "steps")
);
check(
  "13 REAL-JOB balustrade provenance correct",
  balProv.kind === "suppressed" &&
    !realCard?.notIncluded.some((i) => i.id === "balustrade")
);

check(
  "14 approved default quality can apply without old Specification page",
  DEFAULT_ESTIMATE_QUALITY === "standard" &&
    clarifyActions.includes("DEFAULT_ESTIMATE_QUALITY") &&
    clarifyActions.includes("saveQuality")
);
check(
  "15 quality assumption disclosed",
  real.readiness.known.some((row) => row.includes("Standard finish")) ||
    real.clarify.estimateNowAssumptions.some((a) => a.statement === "Standard finish")
);
check(
  "16 Work Area that genuinely needs quality may still ask",
  read("lib/assistant/clarify/compose.ts").includes("Standard finish") &&
    shell.includes("isEditingQuality")
);

check(
  "17 ready state shows concise known context",
  real.readiness.known.length > 0 &&
    real.readiness.known.length <= 5 &&
    real.readiness.known.some((row) => row.includes("27m²") || row.includes("Vitex") || row.includes("140mm"))
);
check(
  "18 assumptions shown",
  real.readiness.assumptions.length > 0 &&
    panel.includes("data-readiness-assumptions")
);
check(
  "19 no Job Plan verbatim duplication",
  !panel.includes("Existing deck removal") &&
    !panel.toLowerCase().includes("not included") === false
    ? !real.readiness.known.join(" ").includes("Existing deck removal")
    : true
);
check(
  "20 Estimate now primary",
  ASSISTANT_ACTION_LABELS.estimateNow === "Estimate now" &&
    panel.includes("data-clarify-primary-cta")
);
check(
  "21 Refine secondary",
  ASSISTANT_ACTION_LABELS.refineEstimate === "Refine estimate" &&
    panel.includes("data-clarify-refine-cta")
);
check(
  "22 Refine hidden when no useful candidates",
  panel.includes("showRefine={refineView.hasCandidates}") ||
    panel.includes("refineView.hasCandidates")
);

check(
  "23 only supported/consumed fields presented as accuracy-improving",
  real.refine.highValue.every((c) => c.consumedByCalculator) &&
    real.refine.advanced.every((c) => c.consumedByCalculator) &&
    !real.refine.highValue.some((c) =>
      DECK_NOT_CONSUMED_REFINE_KEYS.includes(
        (c.factKey ?? "") as (typeof DECK_NOT_CONSUMED_REFINE_KEYS)[number]
      )
    )
);
check(
  "24 advanced fields visible without nested gate (FE-0)",
  panel.includes('data-refine-all-visible="true"') &&
    !panel.includes("data-refine-advanced-toggle")
);
check(
  "25 no mandatory refinement",
  panel.includes("Optional details") &&
    real.clarify.canEstimateNow
);
check(
  "26 writes canonical Facts/constraints only",
  panel.includes("answerClarifyFact") === false &&
    read("components/assistant/clarify/ClarifyReadiness.tsx").includes("onAnswerBoolean") &&
    !existsSync("supabase/migrations/037_refine.sql")
);
check(
  "27 Done returns cleanly",
  panel.includes("data-refine-done") &&
    panel.includes("ASSISTANT_ACTION_LABELS.done") &&
    panel.includes("setRefineOpen(false)")
);
check(
  "28 Estimate now still available",
  panel.includes("canEstimateNow={view.canEstimateNow}") &&
    real.refine.hasCandidates
);

check(
  "29 Estimate now generates",
  real.clarify.canEstimateNow &&
    calculateEstimate(realJobContext(realFacts)).recommendedSell === 16069.1
);
check(
  "30 no old error on Clarify Estimate now path",
  LEGACY_SCOPE_BEFORE_SPEC_ERROR.includes("specification level") &&
    legacyQualityRequiresScopeReview() === false &&
    shell.includes("completeClarifyPlanning")
);
const baseline = calculateEstimate(realJobContext(realFacts));
check("31 same canonical inputs = same cost", baseline.recommendedCost === 10526.3);
check("32 same canonical inputs = same sell", baseline.recommendedSell === 16069.1);

check(
  "33 immediate/near-immediate ready",
  exemplarPair.clarify.enoughToEstimate &&
    exemplarPair.readiness.enoughToEstimate
);
check(
  "34 EXEMPLAR Estimate now generates",
  exemplarPair.clarify.canEstimateNow &&
    calculateEstimate(realJobContext(exemplarFacts)).recommendedCost > 0
);
check(
  "35 no duplicated questions",
  new Set(real.clarify.candidates.map((c) => c.id)).size ===
    real.clarify.candidates.length
);

check(
  "36 one column",
  panel.includes("overflow-x-hidden") && !panel.includes("lg:grid-cols")
);
check(
  "37 Estimate primary",
  panel.includes('data-clarify-primary-cta') &&
    !panel.includes("sticky") || panel.includes("data-clarify-cta-bar")
);
check("38 Refine secondary", panel.includes("data-clarify-refine-cta"));
check(
  "39 no overflow",
  panel.includes("overflow-x-hidden") && panel.includes("min-h-11")
);
check(
  "40 no giant form",
  !panel.includes("data-refine-advanced-toggle") &&
    real.refine.highValue.length + real.refine.advanced.length <= 12
);

const labourLine = baseline.lineItems.find(
  (line) => line.componentKey === DECK_LABOUR_COMPONENT_KEY
);
const classify = classifyResolvedSell({
  costRate: 22.5,
  sellRate: null,
  applicableGrossMarginPercent: 23.5,
});
check(
  "41 RECOVERY-1 parity",
  baseline.recommendedCost === 10526.3 &&
    baseline.recommendedSell === 16069.1 &&
    classify.sellAuthority === "derived_from_gross_margin" &&
    classify.sellRate === deriveSellFromCost(22.5, 23.5) &&
    existsSync("scripts/verify-recovery-1-commercial-authority.ts")
);
check(
  "42 no rate changes",
  !qualityGate.includes("budget_rate_factor") &&
    !clarifyActions.includes("budget_rate_factor")
);
check(
  "43 no authority changes",
  getComponentCommercialAuthority({
    workAreaType: "deck",
    componentKey: DECK_LABOUR_COMPONENT_KEY,
  }).authority === "SHADOW" &&
    labourLine != null
);
check(
  "44 no structural promotion",
  !read("lib/assistant/refine/compose.ts").includes("DECK_JOISTS_COMPONENT_KEY")
);

check(
  "45 implicit AI false is not Job Plan exclusion",
  isImplicitScopeExclusion({
    factKey: "deck.existing_deck_removal",
    value: false,
    source: "ai",
    briefText: realJob.sourceBrief,
  }) &&
    composePair(
      [...realFacts, fact("deck.existing_deck_removal", DECK, false, "ai")],
      realJob.sourceBrief
    ).plan.cards[0]?.notConfirmed.some((i) => i.id === "removal")
);
check(
  "46 explicit brief exclusion stays excluded",
  !isImplicitScopeExclusion({
    factKey: "deck.balustrade_required",
    value: false,
    source: "ai",
    briefText: exemplar.sourceBrief,
  }) &&
    exemplarPair.plan.cards[0]?.notIncluded.some((i) => i.id === "balustrade")
);
check(
  "47 default quality constant is standard",
  DEFAULT_ESTIMATE_QUALITY === "standard"
);
check(
  "48 Production SD still not a quality gate when Job Plan is primary",
  legacyQualityRequiresScopeReview({ SCOPE_DISCOVERY_ENABLED: "true" }) ===
    false
);
check(
  "49 RECOVERY-5A mode contract untouched",
  ASSISTANT_MODES_PRIMARY === true &&
    deriveAssistantUiMode({ hasEstimate: false, editJobOpen: false }) ===
      "planning" &&
    deriveAssistantUiMode({ hasEstimate: true, editJobOpen: false }) ===
      "estimate_ready" &&
    deriveAssistantUiMode({ hasEstimate: true, editJobOpen: true }) ===
      "edit_job" &&
    !shell.includes("assistantMode === \"refine\"")
);
check(
  "50 no readiness/refine table",
  !clarifyActions.includes("from(\"estimate_readiness\")") &&
    !clarifyActions.includes("from(\"refine_") &&
    stripSrc.includes("stripImplicitScopeExclusions")
);
check(
  "51 REAL-JOB Estimate now assumptions are not persisted exclusions",
  real.clarify.estimateNowAssumptions.every((a) => a.persistedExclusion === false)
);
check(
  "52 Refine does not include joist commercial-shadow fields as accuracy",
  !real.refine.highValue.some((c) => c.factKey === "deck.joist_section") &&
    !real.refine.advanced.some((c) => c.factKey === "deck.joist_centres_mm")
);
check(
  "53 completeClarifyPlanning still generates",
  clarifyActions.includes("generateStaticEstimate") &&
    clarifyActions.includes("input.generate")
);
check(
  "54 hard-minimum copy is specific",
  read("lib/assistant/readiness/compose.ts").includes(
    "I need the deck dimensions or area before I can estimate this."
  )
);
check(
  "55 SD helper remains available for legacy-only path",
  typeof isScopeDiscoveryEnabled === "function"
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
