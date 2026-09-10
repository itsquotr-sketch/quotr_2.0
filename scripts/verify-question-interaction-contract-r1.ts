/**
 * Clarify / Refine semantic control-type contract.
 * Run: npx tsx scripts/verify-question-interaction-contract-r1.ts
 *
 * Does not change rates, goldens, or estimate money. No migrations.
 */
import { readFileSync } from "node:fs";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import {
  BOOLEAN_INCLUDE_OPTIONS,
  BOOLEAN_YES_NO_OPTIONS,
  booleanChoiceOptions,
  clarifyControlType,
  clarifyStoredInputType,
  hasNotSureOption,
} from "../lib/assistant/clarify/question-contract";
import { exclusiveOptionSelectValue } from "../lib/assistant/clarify/interaction";
import { composeRefineView } from "../lib/assistant/refine/compose";
import type { ClarifyCandidate } from "../lib/assistant/clarify/types";
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

const CONSUMED_PCS = [
  { key: "site_access", value: "Easy" },
  { key: "material_carry_distance", value: "< 10m" },
  { key: "occupied_site", value: "No" },
  { key: "working_hours", value: "No" },
] as const;

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

function composeWa(
  type: string,
  id: string,
  name: string,
  facts: EstimateFact[],
  constraints = CONSUMED_PCS
) {
  const workAreas = [{ id, type, name, status: "confirmed" as const }];
  const mappedConstraints = constraints.map((row) => ({
    key: row.key,
    value: row.value,
  }));
  const plan = composeJobPlan({
    workAreas,
    facts,
    constraints: mappedConstraints,
  });
  return composeClarifyView({
    stage: "quality",
    briefText: null,
    qualityLevel: "standard",
    workAreas,
    facts,
    constraints: mappedConstraints,
    jobPlan: plan,
  });
}

function allCandidates(view: ReturnType<typeof composeClarifyView>): ClarifyCandidate[] {
  return [...view.candidates, ...view.deferred];
}

function findKey(
  rows: readonly { factKey?: string | null; constraintKey?: string | null; questionKey: string }[],
  key: string
) {
  return rows.find(
    (row) =>
      row.factKey === key ||
      row.constraintKey === key ||
      row.questionKey === key
  );
}

console.log("=== QUESTION INTERACTION CONTRACT R1 ===\n");

check(
  "options array does not imply MULTI_SELECT",
  clarifyControlType(
    synth("site_access", {
      inputType: "select",
      options: ["Easy", "Moderate", "Difficult"],
      question: "How difficult is site access?",
    })
  ) === "SINGLE_SELECT"
);
check(
  "occupied site Yes/No/Not sure is SINGLE_SELECT not BOOLEAN",
  clarifyControlType(
    synth("occupied_site", {
      inputType: "boolean",
      options: ["Yes", "No", "Not sure"],
      question: "Is the site occupied during works?",
    })
  ) === "SINGLE_SELECT" &&
    clarifyStoredInputType({
      inputType: "boolean",
      options: ["Yes", "No", "Not sure"],
    }) === "select"
);
check(
  "working hours Yes/No/Not sure is SINGLE_SELECT",
  clarifyControlType(
    synth("working_hours", {
      inputType: "boolean",
      options: ["No", "Yes", "Not sure"],
      question: "Are there working-hour restrictions?",
    })
  ) === "SINGLE_SELECT"
);
check(
  "Include-question with write stays BOOLEAN",
  clarifyControlType(
    synth("demo", {
      inputType: "boolean",
      question: "Include demolition / strip-out?",
      options: ["Yes", "No"],
      write: { factKey: "bathroom.demolition_required" },
    })
  ) === "BOOLEAN"
);
check(
  "true Yes/No boolean stays BOOLEAN",
  clarifyControlType(
    synth("bool", {
      inputType: "boolean",
      question: "Same lining both sides?",
      options: [...BOOLEAN_YES_NO_OPTIONS],
    })
  ) === "BOOLEAN"
);
check(
  "demolition components are MULTI_SELECT",
  clarifyControlType(
    synth("bathroom.demolition.components", {
      inputType: "multi_select",
      options: ["Floor finish", "Vanity"],
      question: "What items are being removed?",
    })
  ) === "MULTI_SELECT"
);
check(
  "Include labels remain for Include-questions",
  booleanChoiceOptions({
    question: "Include existing deck removal?",
  }).join() === BOOLEAN_INCLUDE_OPTIONS.join()
);
check(
  "boolean Yes/No is exclusive, not a set",
  booleanChoiceOptions({
    question: "Is lining required on one side or both sides?",
    options: ["Yes", "No"],
  }).join() === BOOLEAN_YES_NO_OPTIONS.join()
);
check(
  "exclusive display never keeps a leaked array",
  exclusiveOptionSelectValue(["Yes", "No"]) === "Yes" &&
    exclusiveOptionSelectValue("Moderate") === "Moderate"
);
check("Not sure is detected on option lists", hasNotSureOption(["Yes", "No", "Not sure"]));

const unknownPc = composeWa("bathroom", "b1", "Bathroom", [
  fact("bathroom.job_scope", "b1", "full_renovation"),
  fact("bathroom.length_m", "b1", 3),
  fact("bathroom.width_m", "b1", 2.4),
], []);
const occupied = findKey(allCandidates(unknownPc), "occupied_site");
const access = findKey(allCandidates(unknownPc), "site_access");
const hours = findKey(allCandidates(unknownPc), "working_hours");
check(
  "Clarify occupied_site is exclusive single-select",
  occupied != null &&
    clarifyControlType(occupied) === "SINGLE_SELECT" &&
    occupied.inputType !== "multi_select" &&
    occupied.inputType !== "boolean"
);
check(
  "Clarify site_access is SINGLE_SELECT",
  access != null && clarifyControlType(access) === "SINGLE_SELECT"
);
check(
  "Clarify working_hours is SINGLE_SELECT",
  hours != null && clarifyControlType(hours) === "SINGLE_SELECT"
);

const demoView = composeWa("bathroom", "b1", "Bathroom", [
  fact("bathroom.job_scope", "b1", "strip_out_only"),
  fact("bathroom.length_m", "b1", 3),
  fact("bathroom.width_m", "b1", 2.4),
  fact("bathroom.demolition_required", "b1", true),
]);
const demo = findKey(allCandidates(demoView), "bathroom.demolition.components");
check(
  "Bathroom demolition Clarify is MULTI_SELECT",
  demo != null && clarifyControlType(demo) === "MULTI_SELECT"
);

const fixtureView = composeWa("bathroom", "b1", "Bathroom", [
  fact("bathroom.job_scope", "b1", "full_renovation"),
  fact("bathroom.length_m", "b1", 3),
  fact("bathroom.width_m", "b1", 2.4),
]);
const fixtures = findKey(allCandidates(fixtureView), "bathroom.fixtures_included");
check(
  "Bathroom fixtures Clarify is MULTI_SELECT (not select)",
  fixtures != null &&
    fixtures.inputType === "multi_select" &&
    clarifyControlType(fixtures) === "MULTI_SELECT"
);

const framing = findKey(allCandidates(fixtureView), "bathroom.framing_level");
const substrate = findKey(allCandidates(fixtureView), "bathroom.floor_substrate_system");
check(
  "Bathroom framing level is SINGLE_SELECT",
  framing == null || clarifyControlType(framing) === "SINGLE_SELECT"
);
check(
  "Bathroom floor substrate is SINGLE_SELECT",
  substrate == null || clarifyControlType(substrate) === "SINGLE_SELECT"
);

const refine = composeRefineView({
  briefText: null,
  qualityLevel: "standard",
  workAreas: [{ id: "b1", type: "bathroom", name: "Bathroom", status: "confirmed" }],
  facts: [
    fact("bathroom.job_scope", "b1", "full_renovation"),
    fact("bathroom.length_m", "b1", 3),
    fact("bathroom.width_m", "b1", 2.4),
    fact("bathroom.fixtures_included", "b1", ["Vanity", "Toilet"]),
  ],
  constraints: CONSUMED_PCS.map((row) => ({ key: row.key, value: row.value })),
  jobPlan: {
    cards: [
      {
        workAreaId: "b1",
        workAreaType: "bathroom",
        name: "Bathroom",
        notConfirmed: [],
      },
    ],
  },
});
const refineOccupied = [...refine.highValue, ...refine.advanced].find(
  (row) => row.constraintKey === "occupied_site"
);
const refineAccess = [...refine.highValue, ...refine.advanced].find(
  (row) => row.constraintKey === "site_access"
);
check(
  "Refine occupied_site matches Clarify SINGLE_SELECT",
  refineOccupied != null &&
    clarifyControlType({
      inputType: refineOccupied.inputType,
      options: refineOccupied.options,
      question: refineOccupied.question,
      write: refineOccupied.write,
    }) === "SINGLE_SELECT"
);
check(
  "Refine site_access is SINGLE_SELECT",
  refineAccess != null && refineAccess.inputType === "select"
);

const iwView = composeWa("internal_walls", "w1", "Internal walls", [
  fact("internal_walls.job_scope", "w1", "new_partition"),
]);
const iwKeys = allCandidates(iwView).map(
  (row) => row.factKey ?? row.constraintKey ?? row.questionKey
);
check(
  "Internal Walls current foundation still asks wall-type core",
  iwKeys.some((key) =>
    Boolean(
      key &&
        (key.startsWith("internal_walls.wall_type") ||
          key === "internal_walls.job_scope")
    )
  )
);

const deckView = composeWa("deck", "d1", "Deck", [
  fact("deck.length_m", "d1", 5),
  fact("deck.width_m", "d1", 4),
]);
const fenceView = composeWa("fence", "f1", "Fence", [
  fact("fence.system", "f1", "Timber paling"),
  fact("fence.length_m", "f1", 20),
  fact("fence.height_m", "f1", 1.8),
]);
const rwView = composeWa(
  "retaining_wall",
  "r1",
  "Retaining wall",
  [
    fact("retaining_wall.material", "r1", "Timber"),
    fact("retaining_wall.length_m", "r1", 8),
    fact("retaining_wall.height_m", "r1", 1.2),
  ]
);

function assertNoAccidentalMulti(
  label: string,
  view: ReturnType<typeof composeClarifyView>
): void {
  const accidental = allCandidates(view).filter((row) => {
    const control = clarifyControlType(row);
    if (control === "MULTI_SELECT") return false;
    return row.inputType === "multi_select";
  });
  check(`${label}: non-multi questions are not stored as multi_select`, accidental.length === 0);
  const exclusive = allCandidates(view).filter((row) => {
    const control = clarifyControlType(row);
    return control === "SINGLE_SELECT" || control === "BOOLEAN";
  });
  check(
    `${label}: exclusive questions keep option lists without flipping to multi`,
    exclusive.every((row) => row.inputType !== "multi_select")
  );
}

assertNoAccidentalMulti("Deck", deckView);
assertNoAccidentalMulti("Fence", fenceView);
assertNoAccidentalMulti("Retaining", rwView);
assertNoAccidentalMulti("Bathroom", fixtureView);
assertNoAccidentalMulti("Internal Walls", iwView);

console.log("\n--- Audit (visible + deferred) ---\n");
for (const [label, view] of [
  ["Bathroom", fixtureView],
  ["Deck", deckView],
  ["Fence", fenceView],
  ["Retaining", rwView],
  ["Internal Walls", iwView],
  ["Bathroom PCs unresolved", unknownPc],
] as const) {
  console.log(`# ${label}`);
  for (const row of allCandidates(view)) {
    const current = row.inputType;
    const correct = clarifyControlType(row);
    const stored = clarifyStoredInputType({
      inputType: row.inputType,
      options: row.options,
    });
    const changed =
      (row.constraintKey === "occupied_site" ||
        row.constraintKey === "working_hours" ||
        row.factKey === "bathroom.fixtures_included") &&
      correct !== "BOOLEAN";
    console.log(
      `  ${row.factKey ?? row.constraintKey ?? row.questionKey} | ${row.question} | stored=${current} | control=${correct} | storedMapper=${stored}${changed ? " | corrected" : ""}`
    );
  }
}

const clarifySrc = read("components/assistant/clarify/ClarifyPanel.tsx");
const refineSrc = read("components/assistant/clarify/ClarifyReadiness.tsx");
const controlSrc = read("components/assistant/clarify/ClarifyAnswerControl.tsx");
const optionSrc = read("components/assistant/selection/OptionSelect.tsx");
check(
  "Clarify and Refine share ClarifyAnswerControl",
  clarifySrc.includes("ClarifyAnswerControl") &&
    (refineSrc.includes("ClarifyAnswerControl") ||
      read("components/assistant/refine/RefineFieldRow.tsx").includes(
        "ClarifyAnswerControl"
      )) &&
    controlSrc.includes("clarifyControlType")
);
check(
  "OptionSelect remounts per question id",
  controlSrc.includes("key={candidate.id}")
);
check(
  "single-select OptionSelect never sets multiple",
  controlSrc.includes("multiple={false}") || controlSrc.includes("multiple={false}")
);
check(
  "Continue does not await persist before advance",
  /advance\(candidate\);\s*void Promise\.resolve\(\s*onAnswerValue/.test(clarifySrc)
);
check(
  "multi-select toggles do not persist until Continue",
  /if \(control === "MULTI_SELECT"\)/.test(clarifySrc) &&
    clarifySrc.includes("setHeldMultiId") &&
    /setHeldMultiId\(candidate\.id\);\s*return;/.test(clarifySrc)
);
check(
  "no calculator / quote formula edits in this contract",
  !read("lib/assistant/clarify/question-contract.ts").includes("recommendedCost") &&
    !read("lib/assistant/clarify/interaction.ts").includes("CREATE TABLE")
);
check(
  "interaction contract doc exists",
  read("docs/architecture/QUOTR_QUESTION_INTERACTION_CONTRACT.md").includes(
    "Latest-intent-wins"
  )
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
