/**
 * RECOVERY-4 — Clarify orchestration + planning stepper contract.
 * Run: npx tsx scripts/verify-recovery-4-clarify.ts
 *
 * Presentation / interview orchestration only. Does not change rates,
 * goldens, or estimate money.
 */
import { existsSync, readFileSync } from "node:fs";
import { applyJobPlanScopeWrite } from "../lib/assistant/job-plan/apply-write";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { assumptionsFromSkipped } from "../lib/assistant/clarify/assumptions";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { CLARIFY_IS_PRIMARY, CLARIFY_SINGLE_WA_BUDGET } from "../lib/assistant/clarify/flags";
import {
  mapsLegacyStageToClarify,
  toPlanningDisplayStage,
  jobPlanAlreadyConfirmed,
} from "../lib/assistant/clarify/planning-stage";
import { sortClarifyCandidates, allocateClarifyBudget } from "../lib/assistant/clarify/rank";
import type { ClarifyCandidate, ClarifyView } from "../lib/assistant/clarify/types";
import { resolveActiveDisclosureStage } from "../lib/assistant/progressive-disclosure";
import { classifyResolvedSell } from "../lib/commercial-engine/core/cost-first-authority";
import { deriveSellFromCost } from "../lib/commercial-engine/core/sell-from-margin";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { getComponentCommercialAuthority } from "../lib/estimate/component-authority";
import { DECK_LABOUR_COMPONENT_KEY } from "../lib/estimate/deck-labour-requirement";
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
  name = "Deck",
  status: "confirmed" | "suggested" = "confirmed"
): EstimateWorkArea & { status: string } {
  return { id, type, name, sort_order: 1, status };
}

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

function synth(
  id: string,
  overrides: Partial<ClarifyCandidate> = {}
): ClarifyCandidate {
  return {
    id,
    source: "scope_fact",
    workAreaId: DECK,
    workAreaName: "Deck",
    workAreaType: "deck",
    factKey: id,
    constraintKey: null,
    questionKey: id,
    label: id,
    question: id,
    askClass: "ASK_NOW",
    inputType: "boolean",
    writeTarget: "FACT",
    write: null,
    blocksEstimate: false,
    assumable: true,
    rankScore: 50,
    rankReason: "test",
    assumptionStatement: null,
    ...overrides,
  };
}

const realJob = loadCalibrationFixture("REAL-JOB-01.json");
const exemplar = loadCalibrationFixture("EXEMPLAR-AI-01.json");
const DECK = "wa-deck-1";
const BATH = "wa-bath-1";
const PAINT = "wa-paint-1";
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

function composeFor(
  facts: EstimateFact[],
  brief: string,
  extra?: {
    constraints?: { key: string; value: unknown }[];
    workAreas?: ReturnType<typeof wa>[];
    qualityLevel?: string | null;
    stage?: ClarifyView extends never ? never : string;
  }
) {
  const workAreas = extra?.workAreas ?? [wa(DECK)];
  const plan = composeJobPlan({
    workAreas: workAreas.map((row) => ({
      id: row.id,
      type: row.type,
      name: row.name,
      status: (row.status as "confirmed") ?? "confirmed",
    })),
    facts,
    constraints: extra?.constraints?.map((c) => ({
      key: c.key,
      value: c.value,
    })),
    qualityLevel: extra?.qualityLevel ?? "standard",
    briefText: brief,
  });
  return composeClarifyView({
    stage: "quality",
    briefText: brief,
    qualityLevel: extra?.qualityLevel ?? "standard",
    workAreas,
    facts,
    constraints: extra?.constraints ?? [],
    jobPlan: plan,
  });
}

function keysOf(view: ClarifyView): string[] {
  return view.candidates.map(
    (c) => c.factKey ?? c.constraintKey ?? c.questionKey
  );
}

function hasKey(view: ClarifyView, key: string): boolean {
  return keysOf(view).includes(key);
}

function rankIndex(view: ClarifyView, key: string): number {
  return keysOf(view).indexOf(key);
}

const realView = composeFor(realFacts, realJob.sourceBrief);
const exemplarView = composeFor(exemplarFacts, exemplar.sourceBrief);
const exemplarAssumedView = composeFor(
  [...exemplarFacts, fact("deck.step_width_m", DECK, "Not sure")],
  exemplar.sourceBrief
);
const shell = read("components/assistant/AssistantShell.tsx");
const stepper = read("components/assistant/StepperNav.tsx");
const progress = read("components/assistant/AssistantProgress.tsx");
const panel =
  read("components/assistant/clarify/ClarifyPanel.tsx") +
  read("components/assistant/clarify/ClarifyReadiness.tsx");
const estimatePanel = read("components/assistant/EstimatePanel.tsx");
const composeSrc = read("lib/assistant/clarify/compose.ts");
const actionsSrc = read("lib/assistant/clarify/actions.ts");
const assumptionsSrc = read("lib/assistant/clarify/assumptions.ts");

console.log("=== RECOVERY-4 Clarify ===\n");

check("0 Clarify is primary", CLARIFY_IS_PRIMARY === true);

const removalWrite = composeJobPlan({
  workAreas: [{ id: DECK, type: "deck", name: "Deck", status: "confirmed" }],
  facts: realFacts,
  briefText: realJob.sourceBrief,
}).cards[0]?.notConfirmed.find((i) => i.id === "removal")?.write;

const afterIncludeRemoval = removalWrite
  ? applyJobPlanScopeWrite({
      facts: realFacts,
      workAreaId: DECK,
      write: removalWrite,
      presentation: "INCLUDED",
    })
  : realFacts;
const suppressedRemovalView = composeFor(
  [...afterIncludeRemoval],
  realJob.sourceBrief
);

check(
  "1 Job Plan decisions suppress questions",
  Boolean(removalWrite) &&
    !hasKey(suppressedRemovalView, "deck.existing_deck_removal")
);

check(
  "2 geometry suppressed",
  !hasKey(realView, "deck.length_m") &&
    !hasKey(realView, "deck.width_m") &&
    !hasKey(realView, "deck.area_m2")
);
check("3 material suppressed", !hasKey(realView, "deck.board_material"));
check(
  "4 height suppressed",
  !hasKey(realView, "deck.height_m") && !hasKey(realView, "deck.level")
);
check("5 substructure suppressed", !hasKey(realView, "deck.substructure_included"));
check(
  "6 removal may rank",
  hasKey(realView, "deck.existing_deck_removal") &&
    rankIndex(realView, "deck.existing_deck_removal") === 0
);
check(
  "7 fascia lower rank",
  hasKey(realView, "deck.vertical_face_boards_required") &&
    rankIndex(realView, "deck.vertical_face_boards_required") >
      rankIndex(realView, "deck.existing_deck_removal")
);
check(
  "8 advanced structural not initial",
  !hasKey(realView, "deck.joist_section") &&
    !hasKey(realView, "deck.joist_centres_mm") &&
    !realView.candidates.some((c) => /joist|footing|grade|treatment/i.test(c.questionKey))
);
check("9 missing access may rank", hasKey(realView, "site_access"));

const knownAccess = composeFor(realFacts, realJob.sourceBrief, {
  constraints: [{ key: "site_access", value: "Easy" }],
});
check("10 known access suppresses", !hasKey(knownAccess, "site_access"));
check(
  "11 normal question count reasonable",
  realView.visibleCount >= 1 &&
    realView.visibleCount <= CLARIFY_SINGLE_WA_BUDGET,
  "REAL-JOB is a normal ~0–3 outcome; not a ceiling"
);
check(
  "12 Estimate now available if assumable",
  realView.canEstimateNow === true && realView.blocksEstimate === false
);

const skippedDemo = assumptionsFromSkipped(
  realView.candidates.filter((c) => c.factKey === "deck.existing_deck_removal")
);
const skippedAccess = assumptionsFromSkipped(
  realView.candidates.filter((c) => c.constraintKey === "site_access")
);
const skippedFascia = assumptionsFromSkipped(
  realView.candidates.filter(
    (c) => c.factKey === "deck.vertical_face_boards_required"
  )
);
check(
  "13 skipped demolition → structured assumption",
  skippedDemo[0]?.statement === "No demolition included" &&
    skippedDemo[0]?.persistedExclusion === false
);
check(
  "14 skipped access → structured assumption",
  skippedAccess[0]?.statement === "Standard access" &&
    skippedAccess[0]?.persistedExclusion === false
);
check(
  "15 skipped fascia → structured assumption",
  skippedFascia[0]?.statement === "No fascia included" &&
    skippedFascia[0]?.persistedExclusion === false
);
check(
  "16 no silent exclusion",
  assumptionsSrc.includes("persistedExclusion: false") &&
    !actionsSrc.includes("existing_deck_removal") &&
    realView.estimateNowAssumptions.every((a) => a.persistedExclusion === false)
);

check(
  "17 stair-set decks still require step width",
  hasKey(exemplarView, "deck.step_width_m") &&
    !exemplarView.enoughToEstimate &&
    exemplarAssumedView.enoughToEstimate
);
check("18 access suppressed", !hasKey(exemplarView, "site_access"));
check("19 carry suppressed", !hasKey(exemplarView, "material_carry_distance"));
check(
  "20 demolition suppressed",
  !hasKey(exemplarView, "deck.existing_deck_removal")
);
check(
  "21 fascia suppressed",
  !hasKey(exemplarView, "deck.vertical_face_boards_required")
);
check("22 steps suppressed", !hasKey(exemplarView, "deck.access_type"));
check(
  "23 advanced details not asked",
  !hasKey(exemplarView, "deck.joist_section") &&
    !hasKey(exemplarView, "deck.joist_centres_mm")
);
check(
  "24 immediate Estimate path",
  exemplarAssumedView.enoughToEstimate &&
    exemplarAssumedView.canEstimateNow &&
    panel.includes("data-clarify-readiness") &&
    panel.includes("data-clarify-empty")
);

check(
  "25 no blank Specification stage",
  shell.includes("CLARIFY_IS_PRIMARY") &&
    shell.includes("<ClarifyPanel") &&
    shell.includes("(!CLARIFY_IS_PRIMARY || isEditingQuality)") &&
    !shell.includes("{/* 3. Specification (Quality level — UX label only) */}")
);
check(
  "26 quality not confused with material specification",
  estimatePanel.includes("Finish level") &&
    !panel.toLowerCase().includes("vitex") &&
    composeSrc.includes("Standard finish") &&
    actionsSrc.includes('quality_level !== "unknown"')
);
check(
  "27 default/answer persists",
    actionsSrc.includes("saveQuality") &&
    actionsSrc.includes("DEFAULT_ESTIMATE_QUALITY") &&
    existsSync("lib/assistant/clarify/actions.ts")
);

check("28 quality maps to Clarify", mapsLegacyStageToClarify("quality"));
check(
  "29 scope-details maps to Clarify",
  mapsLegacyStageToClarify("work_area_questions")
);
check("30 constraints maps to Clarify", mapsLegacyStageToClarify("constraints"));
check(
  "31 answered values suppress after resume",
  jobPlanAlreadyConfirmed("quality") &&
    jobPlanAlreadyConfirmed("work_area_questions") &&
    jobPlanAlreadyConfirmed("constraints") &&
    !hasKey(
      composeFor(
        [
          ...realFacts,
          fact("deck.existing_deck_removal", DECK, true),
          fact("deck.vertical_face_boards_required", DECK, false),
        ],
        realJob.sourceBrief,
        { constraints: [{ key: "site_access", value: "Easy" }] }
      ),
      "deck.existing_deck_removal"
    ) &&
    toPlanningDisplayStage("quality") === "clarify" &&
    toPlanningDisplayStage("work_area_questions") === "clarify" &&
    toPlanningDisplayStage("constraints") === "clarify"
);

const multiView = composeFor(
  [
    ...realFacts,
    fact("bathroom.area_m2", BATH, 6),
    fact("painting.internal_area_m2", PAINT, 40),
  ],
  realJob.sourceBrief,
  {
    workAreas: [
      wa(BATH, "bathroom", "Bathroom"),
      wa(DECK, "deck", "Deck"),
      wa(PAINT, "painting", "Painting"),
    ],
  }
);
const multiSources = new Set(multiView.candidates.map((c) => c.workAreaName ?? "Project"));
check(
  "32 global candidate pool",
  multiView.candidates.length >= 1 &&
    composeSrc.includes("allocateClarifyBudget") &&
    !composeSrc.includes("perWorkArea")
);
check(
  "33 no per-WA question quota",
  read("lib/assistant/clarify/flags.ts").includes("CLARIFY_MULTI_WA_BUDGET") &&
    read("lib/assistant/clarify/flags.ts").includes("Not a correctness ceiling") &&
    !read("lib/assistant/clarify/rank.ts").includes("* 3")
);
check(
  "34 context clear",
  panel.includes("ContextLabel") &&
    multiView.candidates.every((c) => Boolean(c.workAreaName) || c.source === "project_condition")
);
check(
  "35 no scope collision",
  new Set(multiView.candidates.map((c) => c.id)).size === multiView.candidates.length &&
    multiSources.size >= 1
);

check(
  "36 stepper = Job details / Work / Details / Estimate",
  stepper.includes('label: "Job details"') &&
    stepper.includes('label: "Work"') &&
    stepper.includes('label: "Details"') &&
    stepper.includes('label: "Estimate"') &&
    !stepper.includes('label: "Brief"') &&
    !stepper.includes('label: "Job Plan"') &&
    !stepper.includes('label: "Clarify"') &&
    !stepper.includes('label: "Specification"') &&
    !stepper.includes('label: "Scope Details"') &&
    !stepper.includes('label: "Site Constraints"')
);
check(
  "37 no standalone Scope Details primary panel",
  shell.includes("{!CLARIFY_IS_PRIMARY && questionsIsCurrent")
);
check(
  "38 no standalone Project Conditions primary panel",
  shell.includes("{!CLARIFY_IS_PRIMARY &&") &&
    shell.includes("preferProjectConditionsAsk") &&
    shell.includes("<ClarifyPanel")
);
check(
  "39 no standalone empty Specification panel",
  shell.includes("(!CLARIFY_IS_PRIMARY || isEditingQuality)") &&
    shell.includes('title="Details"')
);
check(
  "40 Quick Estimate sidebar not duplicate Clarify",
  !estimatePanel.includes("ClarifyPanel") &&
    !estimatePanel.includes("A few things could improve this estimate") &&
    shell.includes("CLARIFY_IS_PRIMARY && !estimateReady ? false : canGenerateEstimate") &&
    read("lib/assistant/presentation/ui-states.ts").includes(
      "Work confirmed. Estimate when the important details are in, or safely assumed."
    )
);
check(
  "41 mobile compact/no overflow",
  progress.includes("lg:hidden") &&
    progress.includes("Step {Math.min(currentIdx + 1, totalSteps)}") &&
    panel.includes("overflow-x-hidden") &&
    panel.includes("min-h-11") &&
    panel.includes("safe-area-inset-bottom") &&
    !panel.includes("<table")
);
check(
  "42 one dominant CTA",
  panel.includes("data-clarify-primary-cta") &&
    panel.includes("ASSISTANT_ACTION_LABELS.estimateNowUsingAssumptions") &&
    (panel.match(/data-clarify-primary-cta/g) ?? []).length >= 1 &&
    (panel.match(/data-clarify-primary-cta/g) ?? []).length <= 2
);

const baseline = calculateEstimate(realJobContext(realFacts));
const afterClarify = calculateEstimate(realJobContext(realFacts));
check(
  "43 unchanged facts = unchanged cost",
  baseline.recommendedCost === afterClarify.recommendedCost &&
    baseline.recommendedCost === 8620.53
);
check(
  "44 unchanged facts = unchanged sell",
  baseline.recommendedSell === afterClarify.recommendedSell &&
    baseline.recommendedSell === 12878.01
);

const classify = classifyResolvedSell({
  costRate: 22.5,
  sellRate: null,
  applicableGrossMarginPercent: 23.5,
});
check(
  "45 RECOVERY-1 parity",
  baseline.recommendedCost === 8620.53 &&
    baseline.recommendedSell === 12878.01 &&
    classify.sellAuthority === "derived_from_gross_margin" &&
    classify.sellRate === deriveSellFromCost(22.5, 23.5) &&
    existsSync("scripts/verify-recovery-1-commercial-authority.ts")
);
check(
  "46 no authority changes",
    getComponentCommercialAuthority({
    workAreaType: "deck",
    componentKey: DECK_LABOUR_COMPONENT_KEY,
  }).authority === "SHADOW" &&
    baseline.lineItems.some(
      (line) => line.category === "labour" && (line.labourHours ?? 0) > 0
    ) &&
    !composeSrc.includes("calculateEstimate") &&
    !actionsSrc.includes("budget_rate_factor")
);

check(
  "47 empty Clarify fast path is not a blank stage",
  exemplarAssumedView.enoughToEstimate && panel.includes("data-clarify-readiness")
);
check(
  "48 ranking is explainable not AI-vibes",
  read("lib/assistant/clarify/rank.ts").includes("askRank") &&
    read("lib/assistant/clarify/compose.ts").includes("rankScore") &&
    !composeSrc.toLowerCase().includes("anthropic")
);
check(
  "49 writes only through canonical facts/constraints",
  actionsSrc.includes("writeJobPlanScopeDecision") &&
    actionsSrc.includes("updateProjectFact") &&
    actionsSrc.includes("saveBuilderInterviewProjectAnswers") &&
    !actionsSrc.includes("from(\"clarify\")") &&
    !existsSync("supabase/migrations/037_clarify.sql")
);
check(
  "50 disclosure after Job Plan is Clarify",
  resolveActiveDisclosureStage({
    briefSubmitted: true,
    workAreasConfirmed: true,
    scopeDiscoveryEnabled: true,
    scopeReviewComplete: true,
    qualityUnlocked: true,
    qualitySubmitted: false,
    questionsSubmitted: false,
    constraintsSubmitted: false,
    estimateReady: false,
  }) === "clarify"
);
check(
  "51 ready-to-generate does not force Clarify",
  resolveActiveDisclosureStage({
    briefSubmitted: true,
    workAreasConfirmed: true,
    scopeDiscoveryEnabled: true,
    scopeReviewComplete: true,
    qualityUnlocked: true,
    qualitySubmitted: true,
    questionsSubmitted: true,
    constraintsSubmitted: true,
    estimateReady: false,
  }) === null
);
check(
  "52 generate PC gate is assumable-aware",
  read("lib/assistant/actions.ts").includes("filterEstimateBlockingProjectConditionKeys") &&
    read("lib/assistant/actions.ts").includes("CLARIFY_IS_PRIMARY")
);

const ranked = sortClarifyCandidates([
  {
    id: "a",
    source: "job_plan_check",
    workAreaId: DECK,
    workAreaName: "Deck",
    workAreaType: "deck",
    factKey: "deck.vertical_face_boards_required",
    constraintKey: null,
    questionKey: "deck.vertical_face_boards_required",
    label: "Fascia",
    question: "Fascia?",
    askClass: "ASK_NOW",
    inputType: "boolean",
    writeTarget: "FACT",
    write: null,
    blocksEstimate: false,
    assumable: true,
    rankScore: 55,
    rankReason: "x",
    assumptionStatement: null,
  },
  {
    id: "b",
    source: "job_plan_check",
    workAreaId: DECK,
    workAreaName: "Deck",
    workAreaType: "deck",
    factKey: "deck.existing_deck_removal",
    constraintKey: null,
    questionKey: "deck.existing_deck_removal",
    label: "Removal",
    question: "Removal?",
    askClass: "ASK_NOW",
    inputType: "boolean",
    writeTarget: "FACT",
    write: null,
    blocksEstimate: false,
    assumable: true,
    rankScore: 90,
    rankReason: "x",
    assumptionStatement: null,
  },
] as ClarifyCandidate[]);
check("53 rank score orders commercially", ranked[0]?.id === "b" && ranked[1]?.id === "a");

check(
  "54 Builder Review deferred to RECOVERY-5B verifier",
  existsSync("scripts/verify-recovery-5b-builder-review.ts") &&
    existsSync("components/assistant/builder-review/BuilderReviewSurface.tsx")
);

const sevenHard = Array.from({ length: 7 }, (_, i) =>
  synth(`hard-${i}`, {
    askClass: "HARD_MINIMUM",
    blocksEstimate: true,
    assumable: false,
    rankScore: 1000,
    factKey: `deck.area_m2_${i}`,
    questionKey: `deck.area_m2_${i}`,
  })
);
const hardOverBudget = allocateClarifyBudget(sevenHard, 3);
check(
  "55 hard minimum survives exhausted soft budget",
  hardOverBudget.visible.length === 7 &&
    hardOverBudget.visible.every((c) => c.askClass === "HARD_MINIMUM")
);

const critical = synth("critical-non-assumable", {
  askClass: "ASK_NOW",
  assumable: false,
  blocksEstimate: true,
  rankScore: 40,
  factKey: "deck.length_m",
  questionKey: "deck.length_m",
});
const sixAssumable = Array.from({ length: 6 }, (_, i) =>
  synth(`ask-${i}`, { rankScore: 90 - i, questionKey: `ask-${i}` })
);
const criticalOverBudget = allocateClarifyBudget(
  [...sixAssumable, critical],
  1
);
check(
  "56 non-assumable critical candidate survives exhausted budget",
  criticalOverBudget.visible.some((c) => c.id === "critical-non-assumable") &&
    criticalOverBudget.visible.length === 3
);

const lowValue = synth("low-assumable", {
  rankScore: 12,
  questionKey: "low-assumable",
  assumptionStatement: "Assumed later",
});
const highThenLow = allocateClarifyBudget(
  [...sixAssumable, lowValue],
  1
);
check(
  "57 assumable low-value candidate may be deferred",
  highThenLow.visible.length === 3 &&
    !highThenLow.visible.some((c) => c.id === "low-assumable") &&
    highThenLow.deferred.some((c) => c.id === "low-assumable")
);

const oneUseful = allocateClarifyBudget(
  [synth("only-one", { rankScore: 90, questionKey: "only-one" })],
  1
);
check(
  "58 soft budget does not force question count (1 useful → 1)",
  oneUseful.visible.length === 1 && oneUseful.deferred.length === 0
);

const zeroUseful = allocateClarifyBudget(
  [
    synth("assume-later", {
      askClass: "ASSUME_IF_SKIPPED",
      rankScore: 20,
      questionKey: "assume-later",
    }),
    synth("refinement", {
      askClass: "REFINEMENT",
      rankScore: 10,
      questionKey: "refinement",
    }),
  ],
  1
);
check(
  "59 0 useful candidates → immediate Estimate",
  zeroUseful.visible.length === 0 &&
    exemplarAssumedView.enoughToEstimate
);

const threeUseful = allocateClarifyBudget(
  [
    synth("m1", { workAreaName: "Bathroom", rankScore: 90 }),
    synth("m2", { workAreaName: "Deck", rankScore: 80 }),
    synth("m3", { workAreaName: "Painting", rankScore: 70 }),
    synth("assume-a", { askClass: "ASSUME_IF_SKIPPED", rankScore: 20 }),
    synth("assume-b", { askClass: "ASSUME_IF_SKIPPED", rankScore: 15 }),
    synth("assume-c", { askClass: "ASSUME_IF_SKIPPED", rankScore: 10 }),
  ],
  3
);
check(
  "60 multi-WA 3 useful candidates → 3 questions not 6",
  threeUseful.visible.length === 3 &&
    threeUseful.visible.every((c) => c.askClass === "ASK_NOW")
);

check(
  "61 no per-WA quota in allocator",
  !read("lib/assistant/clarify/rank.ts").includes("perWorkArea") &&
    !read("lib/assistant/clarify/rank.ts").includes("/ 3") &&
    threeUseful.visible.length !== 9
);

check(
  "62 flags document soft budget not ceiling",
  read("lib/assistant/clarify/flags.ts").includes("Soft UX target") &&
    read("lib/assistant/clarify/rank.ts").includes("Not a hard ceiling") &&
    read("lib/assistant/clarify/rank.ts").includes("isClarifyMustAsk")
);

console.log(`\nREAL-JOB keys: ${keysOf(realView).join(", ") || "(none)"}`);
console.log(`EXEMPLAR keys: ${keysOf(exemplarView).join(", ") || "(none)"}`);
console.log(`MULTI-WA keys: ${keysOf(multiView).join(", ") || "(none)"}`);
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
