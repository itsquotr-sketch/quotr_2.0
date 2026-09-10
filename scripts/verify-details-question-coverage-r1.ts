/**
 * EF02-C1 — Deck Details/Clarify question coverage + single-source classification.
 *
 * Run: npx --yes tsx scripts/verify-details-question-coverage-r1.ts
 *
 * No paid AI. No Production. No migration. Does not weaken existing assertions.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { composeRefineView } from "../lib/assistant/refine/compose";
import {
  deckFactQuestionClass,
  mapDeckQuestionClassToLevel1,
} from "../lib/estimate/deck-information-contract";
import {
  listDeckClarifyDescriptors,
  listDeckQuestionDescriptors,
} from "../lib/estimate/deck-question-descriptors";
import { getQuestionTemplateByKey } from "../lib/scopes/registry";
import { getLevel1BlockingClass } from "../lib/scopes/level1-blocking";
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

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

const CONSUMED_PCS = [
  { key: "site_access", value: "Easy" },
  { key: "material_carry_distance", value: "< 10m" },
  { key: "occupied_site", value: "No" },
  { key: "working_hours", value: "No" },
] as const;

function composeDeck(params: {
  facts: EstimateFact[];
  briefText?: string | null;
}) {
  const briefText =
    params.briefText ?? "Build a new 5 by 4 metre pine deck.";
  const workAreas = [
    { id: "d1", type: "deck", name: "Deck", status: "confirmed" as const },
  ];
  const constraints = CONSUMED_PCS.map((row) => ({
    key: row.key,
    value: row.value,
  }));
  const plan = composeJobPlan({
    workAreas,
    facts: params.facts,
    constraints,
    briefText,
  });
  const clarify = composeClarifyView({
    stage: "quality",
    briefText,
    qualityLevel: "standard",
    workAreas,
    facts: params.facts,
    constraints,
    jobPlan: plan,
  });
  const refine = composeRefineView({
    briefText,
    qualityLevel: "standard",
    workAreas,
    facts: params.facts,
    constraints,
    jobPlan: {
      cards: plan.cards.map((card) => ({
        workAreaId: card.workAreaId,
        workAreaType: card.workAreaType,
        name: card.name,
        notConfirmed: card.notConfirmed,
      })),
    },
  });
  return { clarify, plan, refine };
}

function allClarifyKeys(
  view: ReturnType<typeof composeClarifyView>
): string[] {
  return [...view.candidates, ...view.deferred]
    .map((row) => row.factKey)
    .filter((key): key is string => Boolean(key));
}

function clarifyRow(
  view: ReturnType<typeof composeClarifyView>,
  factKey: string
) {
  return [...view.candidates, ...view.deferred].find(
    (row) => row.factKey === factKey
  );
}

console.log("=== EF02-C1 Details question coverage ===\n");

const coreFacts = [
  fact("deck.length_m", "d1", 5),
  fact("deck.width_m", "d1", 4),
];
const core = composeDeck({ facts: coreFacts });
const coreKeys = allClarifyKeys(core.clarify);

check(
  "deck.height_m has a Clarify generation path when unresolved",
  coreKeys.includes("deck.height_m") &&
    clarifyRow(core.clarify, "deck.height_m")?.askClass === "ASSUME_IF_SKIPPED"
);
check(
  "deck.board_material has a Clarify generation path when unresolved",
  coreKeys.includes("deck.board_material") &&
    clarifyRow(core.clarify, "deck.board_material")?.askClass ===
      "ASSUME_IF_SKIPPED"
);
check(
  "height and board_material carry an assumption option",
  Boolean(clarifyRow(core.clarify, "deck.height_m")?.assumptionStatement) &&
    Boolean(clarifyRow(core.clarify, "deck.board_material")?.assumptionStatement) &&
    clarifyRow(core.clarify, "deck.height_m")?.assumable === true &&
    clarifyRow(core.clarify, "deck.board_material")?.assumable === true
);
check(
  "known height is suppressed",
  !allClarifyKeys(
    composeDeck({
      facts: [...coreFacts, fact("deck.height_m", "d1", 0.4)],
    }).clarify
  ).includes("deck.height_m")
);
check(
  "known board_material is suppressed",
  !allClarifyKeys(
    composeDeck({
      facts: [...coreFacts, fact("deck.board_material", "d1", "Kwila")],
    }).clarify
  ).includes("deck.board_material")
);

const withSteps = composeDeck({
  facts: [...coreFacts, fact("deck.steps_included", "d1", true)],
  briefText: "Build a new 5 by 4 metre pine deck with steps.",
});
const withStepKeys = allClarifyKeys(withSteps.clarify);
const widthRow = clarifyRow(withSteps.clarify, "deck.step_width_m");
const goingRow = clarifyRow(withSteps.clarify, "deck.step_going_m");
check(
  "step_width_m and step_going_m share the same Clarify rule when steps are included",
  withStepKeys.includes("deck.step_width_m") &&
    withStepKeys.includes("deck.step_going_m") &&
    widthRow?.askClass === goingRow?.askClass &&
    widthRow?.askClass === "ASSUME_IF_SKIPPED" &&
    widthRow?.economicClass === "REQUIRED_FOR_ECONOMIC_MODEL" &&
    goingRow?.economicClass === "REQUIRED_FOR_ECONOMIC_MODEL"
);

const noSteps = composeDeck({
  facts: [...coreFacts, fact("deck.steps_included", "d1", false)],
  briefText: "Build a new 5 by 4 metre pine deck. No stairs.",
});
const noStepKeys = allClarifyKeys(noSteps.clarify);
check(
  "step geometry is gated off when steps are not included",
  !noStepKeys.includes("deck.step_width_m") &&
    !noStepKeys.includes("deck.step_going_m")
);

const ctx = {
  facts: coreFacts,
  workAreaId: "d1",
  briefText: "Build a new 5 by 4 metre pine deck.",
};
const missingRelevant = listDeckClarifyDescriptors().filter((row) => {
  if (!row.isRelevant(ctx)) return false;
  if (coreFacts.some((f) => f.key === row.factKey)) return false;
  return !coreKeys.includes(row.factKey);
});
check(
  "every relevant HARD_MINIMUM / ASK_NOW / ASSUME_IF_SKIPPED Deck fact has a Clarify path",
  missingRelevant.length === 0,
  missingRelevant.map((row) => row.factKey).join(", ")
);

const lowLevel = composeDeck({
  facts: [...coreFacts, fact("deck.height_m", "d1", 0.4)],
});
const elevated = composeDeck({
  facts: [...coreFacts, fact("deck.height_m", "d1", 1.4)],
});
check(
  "balustrade parent gate: not asked on low-level, asked when elevated",
  !allClarifyKeys(lowLevel.clarify).includes("deck.balustrade_required") &&
    allClarifyKeys(elevated.clarify).includes("deck.balustrade_required")
);

const framingOff = composeDeck({
  facts: [...coreFacts, fact("deck.substructure_included", "d1", false)],
});
check(
  "concrete parent gate preserved (not a Clarify ASK when substructure excluded)",
  deckFactQuestionClass("deck.concrete_to_supports") === "REFINE" &&
    !allClarifyKeys(framingOff.clarify).includes("deck.concrete_to_supports")
);

check(
  "visible Details set is the complete currently relevant unresolved set (not a 3-at-a-time batch)",
  core.clarify.visibleCount === core.clarify.candidates.length &&
    core.clarify.visibleCount > 3 &&
    core.clarify.candidates.some((row) => row.askClass === "ASSUME_IF_SKIPPED") &&
    core.clarify.groups.some((group) => group.workAreaType === "deck")
);

check(
  "Refine does not emit unresolved height/material (Details-owned until assumed)",
  ![...core.refine.highValue, ...core.refine.advanced].some(
    (row) =>
      row.factKey === "deck.height_m" &&
      (row.currentValue == null || row.currentValue === "")
  ) &&
    ![...core.refine.highValue, ...core.refine.advanced].some(
      (row) =>
        row.factKey === "deck.board_material" &&
        (row.currentValue == null || row.currentValue === "")
    )
);

console.log("\n=== Single-source Deck classification ===\n");

const contractSrc = read("lib/estimate/deck-information-contract.ts");
const descriptorsSrc = read("lib/estimate/deck-question-descriptors.ts");
const blockingSrc = read("lib/scopes/level1-blocking.ts");
const templateSrc = read("lib/scopes/templates/deck.ts");
const composeSrc = read("lib/assistant/clarify/compose.ts");
const jobPlanSrc = read("lib/assistant/job-plan/adapters/deck.ts");
const suppressSrc = read("lib/assistant/clarify/suppress.ts");

check(
  "canonical descriptors assemble askClass + relevance + section",
  descriptorsSrc.includes("askClass: row.questionClass") &&
    descriptorsSrc.includes("isRelevant") &&
    descriptorsSrc.includes("section:") &&
    listDeckQuestionDescriptors().some(
      (row) =>
        row.factKey === "deck.height_m" &&
        row.askClass === "ASSUME_IF_SKIPPED" &&
        row.section === "geometry"
    )
);
check(
  "Clarify compose consumes listDeckClarifyDescriptors",
  composeSrc.includes("listDeckClarifyDescriptors") &&
    composeSrc.includes("mapDeckAskClassToClarify")
);
check(
  "level1-blocking defers Deck to the information contract",
  blockingSrc.includes("deckFactQuestionClass") &&
    blockingSrc.includes("mapDeckQuestionClassToLevel1") &&
    !blockingSrc.includes("DECK_HARD_MINIMUM_KEYS") &&
    !blockingSrc.includes("DECK_ASSUMABLE_KEYS")
);
check(
  "templates are not a second classification authority for the known contradictions",
  !/substructure_included[\s\S]{0,220}level1BlockingClass/.test(templateSrc) &&
    !/balustrade_required[\s\S]{0,220}level1BlockingClass/.test(templateSrc)
);

const subTemplate = getQuestionTemplateByKey("deck.substructure_included");
const balTemplate = getQuestionTemplateByKey("deck.balustrade_required");
check(
  "deck.substructure_included canonical class is ASK_NOW",
  deckFactQuestionClass("deck.substructure_included") === "ASK_NOW" &&
    getLevel1BlockingClass(subTemplate!) ===
      mapDeckQuestionClassToLevel1("ASK_NOW") &&
    getLevel1BlockingClass(subTemplate!) !== "REFINEMENT"
);
check(
  "deck.balustrade_required canonical class is ASK_NOW",
  deckFactQuestionClass("deck.balustrade_required") === "ASK_NOW" &&
    getLevel1BlockingClass(balTemplate!) ===
      mapDeckQuestionClassToLevel1("ASK_NOW") &&
    getLevel1BlockingClass(balTemplate!) !== "REFINEMENT"
);
check(
  "height/board_material stay ASSUME_IF_SKIPPED in the contract",
  deckFactQuestionClass("deck.height_m") === "ASSUME_IF_SKIPPED" &&
    deckFactQuestionClass("deck.board_material") === "ASSUME_IF_SKIPPED" &&
    deckFactQuestionClass("deck.step_width_m") === "ASSUME_IF_SKIPPED" &&
    deckFactQuestionClass("deck.step_going_m") === "ASSUME_IF_SKIPPED"
);

check(
  "conditional gates remain in Job Plan / suppress / descriptors",
  jobPlanSrc.includes("showConcrete") &&
    jobPlanSrc.includes("showBalustrade") &&
    suppressSrc.includes("stepsAreRelevant") &&
    suppressSrc.includes("shouldAskBalustrade") &&
    descriptorsSrc.includes("shouldAskPileReplacement") &&
    descriptorsSrc.includes("showConcrete")
);
check(
  "contract still forbids a second classification table in templates",
  templateSrc.includes("deck-information-contract.ts") &&
    contractSrc.includes('questionClass: "ASK_NOW"')
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
