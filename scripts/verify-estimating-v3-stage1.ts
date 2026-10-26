/**
 * Estimating V3 Stage 1 — completion-blocker regressions.
 *
 * Run: npx --yes tsx scripts/verify-estimating-v3-stage1.ts
 *
 * No network, no model, no database, no customer records.
 * Exercises parsing, the fact-write rejection, portion persistence,
 * deck completion, and project-condition order.
 */
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { sortClarifyCandidates } from "../lib/assistant/clarify/rank";
import type { ClarifyCandidate } from "../lib/assistant/clarify/types";
import { groupDetailsCandidates } from "../lib/assistant/clarify/details-groups";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { settleDetailsJourney } from "../lib/assistant/readiness/details-journey";
import { deckHoleCountError } from "../lib/estimate/deck-hole-excavation";
import {
  deckCountWriteKey,
  deckDetailGaps,
  deckDetailGapsForAreas,
  deckDetailQueuePrompt,
} from "../lib/estimate/deck-detail-completeness";
import {
  flooringPortionFieldCurrentValue,
} from "../lib/estimate/flooring-clarify";
import {
  applyFlooringFactWrite,
  createEmptyFlooringPortion,
  FLOORING_PORTIONS_FACT_KEY,
  parseFlooringPortions,
} from "../lib/estimate/flooring-portions";
import type { EstimateFact } from "../lib/estimate/types";
import { shouldHideConditionalQuestion } from "../lib/scopes/conditional-rules";
import {
  factUpdateError,
  normalizeAnswerForStorage,
  type ProjectFactRecord,
} from "../lib/scopes/fact-values";
import { getScopeQuestions } from "../lib/scopes/registry";

const BOARD = "flooring.portion.hardwood_board_width_mm";
const TILE_WIDTH = "flooring.portion.tile_width_mm";
const TILE_LENGTH = "flooring.portion.tile_length_mm";
const WA = "11111111-1111-4111-8111-111111111111";
const WA_B = "33333333-3333-4333-8333-333333333333";
const BATH = "22222222-2222-4222-8222-222222222222";

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

function fact(
  key: string,
  value: string | number | boolean,
  workAreaId: string = WA
): EstimateFact {
  return { key, work_area_id: workAreaId, value, source: "user" };
}

check(
  "supported board-width forms store one millimetre number",
  (["145 mm", "145mm", "145", 145] as const).every(
    (value) =>
      normalizeAnswerForStorage(value, "number", BOARD) === 145 &&
      factUpdateError({ key: BOARD, value, valueType: "number" }) == null
  )
);
check(
  "an existing saved board width stays 145",
  normalizeAnswerForStorage(145, "number", BOARD) === 145 &&
    factUpdateError({ key: BOARD, value: 145, valueType: "number" }) == null
);
check(
  "zero and text board widths return a field error",
  factUpdateError({ key: BOARD, value: 0, valueType: "number" }) ===
    "Enter a board width in millimetres, such as 145." &&
    factUpdateError({ key: BOARD, value: "wide", valueType: "number" }) ===
      "Enter a board width in millimetres, such as 145." &&
    factUpdateError({ key: TILE_WIDTH, value: "600 mm extra", valueType: "number" }) ===
      "Enter a tile width in millimetres, such as 600." &&
    factUpdateError({ key: TILE_LENGTH, value: "", valueType: "number" }) ===
      "Enter a tile length in millimetres, such as 600."
);
check(
  "a millimetre label on an unrelated number stays invalid",
  factUpdateError({
    key: "deck.hole_depth_mm",
    value: "600 mm",
    valueType: "number",
  }) === "Invalid fact update."
);

const roomA = createEmptyFlooringPortion({ id: "floor-a", label: "Living" });
roomA.finish_type = "hardwood";
roomA.area_m2 = 12;
const roomB = createEmptyFlooringPortion({ id: "floor-b", label: "Hall" });
roomB.finish_type = "hardwood";
roomB.area_m2 = 4;
roomB.hardwood_board_width_mm = 186;
let flooringFacts: EstimateFact[] = [
  {
    key: FLOORING_PORTIONS_FACT_KEY,
    work_area_id: WA,
    value: [roomA, roomB],
    source: "user",
  },
];
flooringFacts = applyFlooringFactWrite({
  facts: flooringFacts,
  workAreaId: WA,
  key: BOARD,
  value: "145 mm",
  nestedItemId: "floor-a",
});
const storedPortions = parseFlooringPortions(
  flooringFacts.find((row) => row.key === FLOORING_PORTIONS_FACT_KEY)?.value
);
const living = storedPortions.find((row) => row.id === "floor-a");
const hall = storedPortions.find((row) => row.id === "floor-b");
check(
  "board width persists on one flooring area and reloads as its option",
  living?.hardwood_board_width_mm === 145 &&
    hall?.hardwood_board_width_mm === 186 &&
    flooringPortionFieldCurrentValue(living ?? null, BOARD) === "145 mm"
);
const invalidWidth = factUpdateError({
  key: BOARD,
  value: "wide",
  valueType: "number",
});
const afterInvalid = invalidWidth
  ? flooringFacts
  : applyFlooringFactWrite({
      facts: flooringFacts,
      workAreaId: WA,
      key: BOARD,
      value: "wide",
      nestedItemId: "floor-a",
    });
check(
  "an invalid width is rejected before it can clear a saved width",
  invalidWidth === "Enter a board width in millimetres, such as 145." &&
    parseFlooringPortions(
      afterInvalid.find((row) => row.key === FLOORING_PORTIONS_FACT_KEY)?.value
    ).find((row) => row.id === "floor-a")?.hardwood_board_width_mm === 145 &&
    hall?.area_m2 === 4
);

const otherArea = applyFlooringFactWrite({
  facts: flooringFacts,
  workAreaId: WA_B,
  key: BOARD,
  value: 190,
  nestedItemId: "floor-c",
});
check(
  "a flooring write on another work area leaves the first area unchanged",
  parseFlooringPortions(
    flooringFacts.find((row) => row.key === FLOORING_PORTIONS_FACT_KEY)?.value
  ).find((row) => row.id === "floor-a")?.hardwood_board_width_mm === 145 &&
    otherArea.some((row) => row.work_area_id === WA_B)
);

check(
  "zero posts are rejected and a saved post count clears readiness",
  deckHoleCountError(0, "posts") === "Enter a whole number of posts." &&
    deckHoleCountError(16, "posts") == null
);
const postsOnly = [
  fact("deck.substructure_included", true),
  fact("deck.pile_or_post_count", 16),
];
check(
  "reloading a post count leaves the posts gap clear",
  deckCountWriteKey(postsOnly, WA) === "deck.hole_count" &&
    !deckDetailGaps(postsOnly, WA).some((gap) => gap.id === "posts")
);
const holeOnly = [
  fact("deck.substructure_included", true),
  fact("deck.hole_count", 16),
];
check(
  "a legacy hole count remains a hole count",
  deckDetailGaps(holeOnly, WA).some((gap) => gap.id === "posts") &&
    deckCountWriteKey(holeOnly, WA) === "deck.pile_or_post_count"
);
const isolated = deckDetailGapsForAreas(
  [...postsOnly, fact("deck.substructure_included", true, WA_B)],
  [
    { id: WA, type: "deck" },
    { id: WA_B, type: "deck" },
  ]
);
check(
  "post-count readiness is isolated to each deck",
  deckDetailGaps(postsOnly, WA).every((gap) => gap.id !== "posts") &&
    deckDetailGaps(
      [fact("deck.substructure_included", true, WA_B)],
      WA_B
    ).some((gap) => gap.id === "posts") &&
    isolated.filter((gap) => gap.id === "posts").length === 1
);

const excavated = [
  ...postsOnly,
  fact("deck.hole_shape", "circular"),
  fact("deck.hole_diameter_mm", 350),
  fact("deck.hole_depth_mm", 600),
  fact("deck.hole_ground", "ordinary"),
  fact("deck.hole_method", "hand"),
  fact("deck.spoil_destination", "on_site"),
  fact("deck.concrete_to_supports", true),
];
const openConcrete = deckDetailGaps(excavated, WA);
check(
  "excavation and concrete completion are counted separately",
  openConcrete.map((gap) => gap.id).join(",") === "fill,post,embedment" &&
    deckDetailQueuePrompt(openConcrete) === "Finish 3 concrete answers"
);
const concreteAnswered = [
  ...excavated,
  fact("deck.concrete_fill", "full"),
  fact("deck.support_section", "125x125"),
  fact("deck.post_embedment_mm", 600),
];
check(
  "answered concrete questions leave the queue",
  deckDetailGaps(concreteAnswered, WA).length === 0
);
const journey = settleDetailsJourney({
  workConfirmed: true,
  pendingWrites: 0,
  requiredClarifyCount: 0,
  postHoleCount: openConcrete.length,
  postHoleGaps: openConcrete,
  optionalRefineCount: 0,
});
check(
  "the generation prompt names concrete rather than excavation",
  journey.actionLabel === "Finish 3 concrete answers" &&
    journey.showCreateEstimate === false
);

function conditionKeys(
  areas: { id: string; type: string; name: string }[],
  constraints: { key: string; value: string }[] = []
): string[] {
  const workAreas = areas.map((row) => ({ ...row, status: "confirmed" as const }));
  const jobPlan = composeJobPlan({
    workAreas,
    facts: [],
    constraints,
    qualityLevel: "standard",
    briefText: "",
  });
  return composeClarifyView({
    stage: "work_area_questions",
    briefText: "",
    qualityLevel: "standard",
    workAreas,
    facts: [],
    constraints,
    jobPlan,
  }).candidates
    .filter((row) => row.source === "project_condition")
    .map((row) => row.constraintKey ?? "");
}

const deck = [{ id: WA, type: "deck", name: "Deck" }];
const deckAndBath = [
  ...deck,
  { id: BATH, type: "bathroom", name: "Bathroom" },
];
const first = conditionKeys(deck);
const reloaded = conditionKeys(deck);
const withBathroom = conditionKeys(deckAndBath);
const afterAccess = conditionKeys(deck, [{ key: "site_access", value: "Easy" }]);
check(
  "project-condition order is stable across reload and a saved answer",
  first.join("|") === reloaded.join("|") &&
    first[0] === "site_access" &&
    first[1] === "material_carry_distance" &&
    afterAccess[0] === "material_carry_distance" &&
    !afterAccess.includes("site_access") &&
    withBathroom.slice(0, first.length).join("|") === first.join("|")
);

const parent: ClarifyCandidate = {
  id: "deck-face",
  source: "job_plan_check",
  workAreaId: WA,
  workAreaName: "Deck",
  workAreaType: "deck",
  factKey: "deck.vertical_face_boards_required",
  constraintKey: null,
  questionKey: "deck.vertical_face_boards_required",
  label: "Fascia",
  question: "Are fascia boards included?",
  askClass: "ASK_NOW",
  inputType: "boolean",
  writeTarget: "FACT",
  write: null,
  blocksEstimate: false,
  assumable: true,
  rankScore: 55,
};
const followUp: ClarifyCandidate = {
  ...parent,
  id: "deck-face-length",
  factKey: "deck.vertical_face_board_length_lm",
  questionKey: "deck.vertical_face_board_length_lm",
  label: "Fascia length",
  question: "How long are the fascia boards?",
  rankScore: 54,
};
const access: ClarifyCandidate = {
  ...parent,
  id: "pc:site_access",
  source: "project_condition",
  workAreaId: null,
  workAreaName: null,
  workAreaType: null,
  factKey: null,
  constraintKey: "site_access",
  questionKey: "site_access",
  label: "Site access",
  question: "How difficult is site access?",
  inputType: "select",
  writeTarget: "CONSTRAINT",
  rankScore: 85,
};
const ranked = sortClarifyCandidates([followUp, access, parent]);
const workAreaOrder = ranked
  .filter((row) => row.source !== "project_condition")
  .map((row) => row.questionKey);
check(
  "a fascia follow-up stays beside its question, after project conditions",
  ranked[0]?.constraintKey === "site_access" &&
    workAreaOrder.join("|") ===
      "deck.vertical_face_boards_required|deck.vertical_face_board_length_lm"
);

const fascia = getScopeQuestions("deck").find(
  (row) => row.factKey === "deck.vertical_face_board_length_lm"
);
const hiddenLookup = new Map<string, ProjectFactRecord>();
const shownLookup = new Map<string, ProjectFactRecord>([
  [
    `${WA}:deck.vertical_face_boards_required`,
    {
      key: "deck.vertical_face_boards_required",
      work_area_id: WA,
      value: true,
      source: "user",
    },
  ],
]);
check(
  "the fascia length question appears only after fascia is included",
  fascia != null &&
    shouldHideConditionalQuestion(fascia!, WA, hiddenLookup, new Set(["deck"])) &&
    !shouldHideConditionalQuestion(fascia!, WA, shownLookup, new Set(["deck"]))
);

const grouped = groupDetailsCandidates({
  candidates: [access, followUp, parent],
  workAreas: [{ id: WA, type: "deck", name: "Deck", status: "confirmed" }],
});
check(
  "project conditions remain a group ahead of the deck follow-up",
  grouped[0]?.workAreaName === "Project Conditions" &&
    grouped[1]?.sections.some((section) =>
      section.candidates.some(
        (row) => row.questionKey === "deck.vertical_face_board_length_lm"
      )
    ) === true
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
