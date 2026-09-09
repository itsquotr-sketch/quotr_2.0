/**
 * Initial-capture completeness + immediate answer-control contract.
 * Run: npx tsx scripts/verify-clarify-initial-capture-r1.ts
 *
 * Does not change rates, goldens, or estimate money.
 */
import { readFileSync } from "node:fs";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import {
  BOOLEAN_INCLUDE_OPTIONS,
  BOOLEAN_YES_NO_OPTIONS,
  booleanChoiceOptions,
  booleanChoiceToPresentation,
  booleanPresentationToChoice,
  isInitialCaptureQuestion,
} from "../lib/assistant/clarify/question-contract";
import { CLARIFY_SINGLE_WA_BUDGET } from "../lib/assistant/clarify/flags";
import { allocateClarifyBudget } from "../lib/assistant/clarify/rank";
import type { ClarifyCandidate } from "../lib/assistant/clarify/types";
import { composeRefineView } from "../lib/assistant/refine/compose";
import {
  displayedOptionSelectValue,
  nextMultiSelectValue,
  optionSelectValuesEqual,
  shouldClearOptimisticSelect,
} from "../lib/assistant/selection/optimistic-select";
import {
  mergeMultiSelectToggle,
  shouldAcceptPersistedAnswer,
} from "../lib/assistant/selection/latest-answer";
import type { EstimateFact } from "../lib/estimate/types";

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
    workAreaId: "wa-1",
    workAreaName: "Deck",
    workAreaType: "deck",
    factKey: id,
    constraintKey: null,
    questionKey: id,
    label: id,
    question: id,
    askClass: "ASK_NOW",
    inputType: "select",
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

const CONSUMED_PCS = [
  { key: "site_access", value: "Easy" },
  { key: "material_carry_distance", value: "< 10m" },
  { key: "occupied_site", value: "No" },
  { key: "working_hours", value: "No" },
] as const;

function composeBathroom(facts: EstimateFact[], constraints = CONSUMED_PCS) {
  const plan = composeJobPlan({
    workAreas: [{ id: "b1", type: "bathroom", name: "Bathroom", status: "confirmed" }],
    facts,
    constraints: constraints.map((row) => ({ key: row.key, value: row.value })),
  });
  return composeClarifyView({
    stage: "quality",
    briefText: null,
    qualityLevel: "standard",
    workAreas: [{ id: "b1", type: "bathroom", name: "Bathroom", status: "confirmed" }],
    facts,
    constraints: constraints.map((row) => ({ key: row.key, value: row.value })),
    jobPlan: plan,
  });
}

function composeDeck(facts: EstimateFact[], constraints = CONSUMED_PCS) {
  const plan = composeJobPlan({
    workAreas: [{ id: "d1", type: "deck", name: "Deck", status: "confirmed" }],
    facts,
    constraints: constraints.map((row) => ({ key: row.key, value: row.value })),
    briefText: "Build a new 5 by 4 metre pine deck.",
  });
  return composeClarifyView({
    stage: "quality",
    briefText: "Build a new 5 by 4 metre pine deck.",
    qualityLevel: "standard",
    workAreas: [{ id: "d1", type: "deck", name: "Deck", status: "confirmed" }],
    facts,
    constraints: constraints.map((row) => ({ key: row.key, value: row.value })),
    jobPlan: plan,
  });
}

function composeFence(facts: EstimateFact[], constraints = CONSUMED_PCS) {
  const plan = composeJobPlan({
    workAreas: [{ id: "f1", type: "fence", name: "Fence", status: "confirmed" }],
    facts,
    constraints: constraints.map((row) => ({ key: row.key, value: row.value })),
  });
  return composeClarifyView({
    stage: "quality",
    briefText: null,
    qualityLevel: "standard",
    workAreas: [{ id: "f1", type: "fence", name: "Fence", status: "confirmed" }],
    facts,
    constraints: constraints.map((row) => ({ key: row.key, value: row.value })),
    jobPlan: plan,
  });
}

function composeRetaining(facts: EstimateFact[], constraints = CONSUMED_PCS) {
  const plan = composeJobPlan({
    workAreas: [
      { id: "r1", type: "retaining_wall", name: "Retaining wall", status: "confirmed" },
    ],
    facts,
    constraints: constraints.map((row) => ({ key: row.key, value: row.value })),
  });
  return composeClarifyView({
    stage: "quality",
    briefText: null,
    qualityLevel: "standard",
    workAreas: [
      { id: "r1", type: "retaining_wall", name: "Retaining wall", status: "confirmed" },
    ],
    facts,
    constraints: constraints.map((row) => ({ key: row.key, value: row.value })),
    jobPlan: plan,
  });
}

function allKeys(view: ReturnType<typeof composeClarifyView>): string[] {
  return [...view.candidates, ...view.deferred]
    .map((row) => row.factKey ?? row.constraintKey ?? row.questionKey)
    .filter((key): key is string => Boolean(key));
}

console.log("=== CLARIFY INITIAL CAPTURE R1 ===\n");

const geometryOnly = composeBathroom([
  fact("bathroom.job_scope", "b1", "full_renovation"),
  fact("bathroom.length_m", "b1", 3),
  fact("bathroom.width_m", "b1", 2.4),
]);
check(
  "Bathroom Ready is false after hard-minimum geometry while ASK_NOW remain",
  geometryOnly.enoughToEstimate === false &&
    geometryOnly.remainingRequiredCount > 0
);
check(
  "Visible batch stays progressive",
  geometryOnly.visibleCount > 0 &&
    geometryOnly.visibleCount <= Math.max(CLARIFY_SINGLE_WA_BUDGET, geometryOnly.candidates.filter((c) => c.askClass === "HARD_MINIMUM").length) &&
    geometryOnly.remainingRequiredCount >= geometryOnly.visibleCount
);
check(
  "Bathroom framing is initial-capture when relevant",
  allKeys(geometryOnly).includes("bathroom.framing_level")
);
check(
  "Bathroom floor finish is initial-capture when relevant",
  allKeys(geometryOnly).includes("bathroom.floor_finish_system")
);
check(
  "P2 painting is not asked during initial Clarify",
  !allKeys(geometryOnly).includes("bathroom.painting_included") &&
    !allKeys(geometryOnly).includes("bathroom.stopping_included")
);
check(
  "Known job scope is not reasked",
  !geometryOnly.candidates.some((row) => row.factKey === "bathroom.job_scope") &&
    !geometryOnly.deferred.some((row) => row.factKey === "bathroom.job_scope")
);

const unknownPc = composeBathroom(
  [
    fact("bathroom.job_scope", "b1", "full_renovation"),
    fact("bathroom.length_m", "b1", 3),
    fact("bathroom.width_m", "b1", 2.4),
    fact("bathroom.framing_level", "b1", "standard"),
    fact("bathroom.floor_finish_system", "b1", "tile"),
    fact("bathroom.floor_substrate_system", "b1", "treated_plywood"),
    fact("bathroom.plumbing.level", "b1", "standard"),
    fact("bathroom.electrical.level", "b1", "standard"),
    fact("bathroom.fixtures_included", "b1", ["Vanity", "Toilet"]),
    fact("bathroom.demolition_required", "b1", false),
  ],
  []
);
check(
  "Unresolved consumed Project Conditions block Ready",
  unknownPc.enoughToEstimate === false &&
    allKeys(unknownPc).includes("site_access") &&
    allKeys(unknownPc).includes("occupied_site")
);

const deckCore = composeDeck([
  fact("deck.length_m", "d1", 5),
  fact("deck.width_m", "d1", 4),
]);
check(
  "Deck Ready is not hard-minimum geometry alone",
  deckCore.enoughToEstimate === false &&
    (allKeys(deckCore).includes("site_access") ||
      allKeys(deckCore).includes("deck.existing_deck_removal") ||
      allKeys(deckCore).includes("deck.vertical_face_boards_required"))
);

const fenceCore = composeFence([
  fact("fence.system", "f1", "Timber paling"),
  fact("fence.length_m", "f1", 20),
  fact("fence.height_m", "f1", 1.8),
]);
check(
  "Fence ASK_NOW extras remain before Ready",
  fenceCore.enoughToEstimate === false &&
    (allKeys(fenceCore).includes("fence.board_thickness_mm") ||
      allKeys(fenceCore).includes("fence.top_capping") ||
      allKeys(fenceCore).includes("site_access"))
);

const rwCore = composeRetaining([
  fact("retaining_wall.material", "r1", "Timber"),
  fact("retaining_wall.length_m", "r1", 8),
  fact("retaining_wall.height_m", "r1", 1.2),
]);
check(
  "Retaining Wall ASK_NOW extras remain before Ready",
  rwCore.enoughToEstimate === false &&
    (allKeys(rwCore).includes("retaining_wall.surcharge") ||
      allKeys(rwCore).includes("retaining_wall.excavation_required") ||
      allKeys(rwCore).includes("site_access"))
);

const iwPlan = composeJobPlan({
  workAreas: [
    { id: "w1", type: "internal_walls", name: "Internal walls", status: "confirmed" },
  ],
  facts: [fact("internal_walls.job_scope", "w1", "new_partition")],
});
const iwView = composeClarifyView({
  stage: "quality",
  briefText: null,
  qualityLevel: "standard",
  workAreas: [
    { id: "w1", type: "internal_walls", name: "Internal walls", status: "confirmed" },
  ],
  facts: [fact("internal_walls.job_scope", "w1", "new_partition")],
  constraints: CONSUMED_PCS.map((row) => ({ key: row.key, value: row.value })),
  jobPlan: iwPlan,
});
check(
  "Internal Walls current foundation still blocks Ready without wall-type core",
  iwView.enoughToEstimate === false &&
    allKeys(iwView).some((key) =>
      key.startsWith("internal_walls.wall_type") || key === "internal_walls.job_scope"
    ) === true
);

const assumeOnly = allocateClarifyBudget(
  [
    synth("assume-later", {
      askClass: "ASSUME_IF_SKIPPED",
      assumable: true,
      questionKey: "assume-later",
    }),
    synth("refinement", {
      askClass: "REFINEMENT",
      assumable: true,
      questionKey: "refinement",
    }),
  ],
  1
);
check(
  "ASSUME_IF_SKIPPED / REFINEMENT do not fill the initial batch",
  assumeOnly.visible.length === 0
);

const askNowOverBudget = allocateClarifyBudget(
  Array.from({ length: 8 }, (_, i) =>
    synth(`ask-${i}`, { rankScore: 90 - i, questionKey: `ask-${i}` })
  ),
  1
);
check(
  "ASK_NOW batches to the soft UX target",
  askNowOverBudget.visible.length === CLARIFY_SINGLE_WA_BUDGET &&
    askNowOverBudget.deferred.length === 5
);
check(
  "Deferred ASK_NOW still count as initial-capture",
  askNowOverBudget.deferred.every(isInitialCaptureQuestion)
);

const refine = composeRefineView({
  briefText: null,
  qualityLevel: "standard",
  workAreas: [{ id: "d1", type: "deck", name: "Deck", status: "confirmed" }],
  facts: [
    fact("deck.length_m", "d1", 5),
    fact("deck.width_m", "d1", 4),
    fact("deck.existing_deck_removal", "d1", false),
  ],
  constraints: CONSUMED_PCS.map((row) => ({ key: row.key, value: row.value })),
  jobPlan: {
    cards: [
      {
        workAreaId: "d1",
        workAreaType: "deck",
        name: "Deck",
        notConfirmed: [],
      },
    ],
  },
});
const refineSite = [...refine.highValue, ...refine.advanced].find(
  (row) => row.constraintKey === "site_access"
);
check(
  "Refine keeps answered site access editable and selected",
  refineSite != null && refineSite.currentValue === "Easy"
);
check(
  "Refine keeps answered Deck length editable",
  [...refine.highValue, ...refine.advanced].some(
    (row) => row.factKey === "deck.length_m" && row.currentValue === 5
  )
);

check(
  "Yes/No is used for semantic boolean questions",
  booleanChoiceOptions({
    question: "Is the site occupied during works?",
    options: ["Yes", "No", "Not sure"],
  }).join() === BOOLEAN_YES_NO_OPTIONS.join()
);
check(
  "Include labels remain for Include-questions",
  booleanChoiceOptions({
    question: "Include existing deck removal?",
  }).join() === BOOLEAN_INCLUDE_OPTIONS.join()
);
check(
  "boolean presentation maps Yes to included",
  booleanChoiceToPresentation("Yes") === "INCLUDED" &&
    booleanPresentationToChoice(true, BOOLEAN_YES_NO_OPTIONS) === "Yes"
);

check(
  "single-select optimistic display is immediate",
  displayedOptionSelectValue({
    optimistic: "Moderate",
    committed: "Easy",
  }) === "Moderate"
);
check(
  "single-select replacement keeps the latest optimistic value",
  displayedOptionSelectValue({
    optimistic: "Difficult",
    committed: "Easy",
  }) === "Difficult"
);
check(
  "stale committed value does not clear a newer optimistic selection",
  shouldClearOptimisticSelect({
    optimistic: "Difficult",
    committed: "Easy",
  }) === false
);
check(
  "caught-up committed value clears optimistic selection",
  shouldClearOptimisticSelect({
    optimistic: "Difficult",
    committed: "Difficult",
  }) === true
);
check(
  "persist failure reverts to committed value",
  displayedOptionSelectValue({
    optimistic: "Difficult",
    committed: "Easy",
    persistFailed: true,
  }) === "Easy"
);
check(
  "latest persist seq wins",
  shouldAcceptPersistedAnswer({ persistedSeq: 1, latestSeqForKey: 2 }) === false &&
    shouldAcceptPersistedAnswer({ persistedSeq: 2, latestSeqForKey: 2 }) === true
);
check(
  "multi-select toggles independently",
  optionSelectValuesEqual(
    nextMultiSelectValue(["A", "B", "C"], "B", true),
    ["A", "C"]
  ) &&
    JSON.stringify(mergeMultiSelectToggle(["A", "C"], "B")) ===
      JSON.stringify(["A", "C", "B"])
);

const optionSrc = read("components/assistant/selection/OptionSelect.tsx");
const clarifySrc = read("components/assistant/clarify/ClarifyPanel.tsx");
const refineSrc = read("components/assistant/clarify/ClarifyReadiness.tsx");
check(
  "Clarify and Refine share OptionSelect optimistic selection",
  optionSrc.includes("setOptimistic") &&
    clarifySrc.includes("OptionSelect") &&
    refineSrc.includes("OptionSelect") &&
    !/OptionSelect[\s\S]{0,260}disabled=\{isSaving\}/.test(refineSrc)
);
check(
  "Ready card requires remainingRequiredCount === 0",
  clarifySrc.includes("view.remainingRequiredCount === 0")
);
check(
  "no calculator / quote formula edits in this contract",
  !read("lib/assistant/clarify/question-contract.ts").includes("recommendedCost") &&
    !read("lib/assistant/clarify/compose.ts").includes("CREATE TABLE")
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
