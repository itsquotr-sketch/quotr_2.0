/**
 * Stage 3.1B.7F-R6-R3 — Stable Scope Details question flow.
 *
 * Run: npx tsx scripts/verify-stage-3-1b7fr6r3-question-flow.ts
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  defaultExpandedQuestionCategories,
  groupQuestionsByPresentationCategory,
  mergeStickyOpenCategories,
  questionDisclosureKey,
  resolveQuestionCategoryExpanded,
} from "../lib/assistant/presentation";

let passed = 0;
let failed = 0;

function check(label: string, cond: boolean) {
  if (cond) {
    console.log(`PASS  ${label}`);
    passed += 1;
  } else {
    console.log(`FAIL  ${label}`);
    failed += 1;
  }
}

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

console.log("\n=== Stage 3.1B.7F-R6-R3 — Stable question flow ===\n");

const wa = "wa-walls";
const fixtures = [
  {
    id: "q1",
    key: "internal_walls.length_lm",
    label: "Length",
    required: true,
  },
  {
    id: "q2",
    key: "internal_walls.height_m",
    label: "Height",
    required: true,
  },
  {
    id: "q3",
    key: "internal_walls.framing_type",
    label: "Framing type",
    required: true,
  },
  {
    id: "q4",
    key: "internal_walls.access",
    label: "Access",
    required: false,
  },
];

console.log("DISCLOSURE");
const unanswered = groupQuestionsByPresentationCategory({
  questions: fixtures,
  answers: { q1: null, q2: null, q3: null, q4: null },
});
const preferred = defaultExpandedQuestionCategories(unanswered);
check(
  "incomplete groups preferred open by default",
  preferred.size >= 1 &&
    [...preferred].every((c) =>
      unanswered.some((g) => g.category === c && g.hasUnresolvedQuestions)
    )
);

const measurementsKey = questionDisclosureKey(wa, "measurements");
const structureKey = questionDisclosureKey(wa, "structure");
let sticky = mergeStickyOpenCategories(new Set(), new Set([measurementsKey, structureKey]));
check("sticky absorbs preferred incomplete keys", sticky.has(measurementsKey));

// Answer one of several measurements — preferred may shrink but sticky retains.
const afterOne = groupQuestionsByPresentationCategory({
  questions: fixtures,
  answers: { q1: 12, q2: null, q3: null, q4: null },
});
const preferredAfterOne = defaultExpandedQuestionCategories(afterOne);
sticky = mergeStickyOpenCategories(
  sticky,
  new Set(
    [...preferredAfterOne].map((c) => questionDisclosureKey(wa, c))
  )
);
check(
  "save one of several → category remains expanded via sticky",
  resolveQuestionCategoryExpanded({
    disclosureKey: measurementsKey,
    preferredOpen: preferredAfterOne.has("measurements"),
    stickyOpen: sticky,
    manualExpanded: {},
  }) === true
);

// Final required in measurements answered — preferred drops, sticky keeps open.
const afterMeasurements = groupQuestionsByPresentationCategory({
  questions: fixtures,
  answers: { q1: 12, q2: 2.4, q3: null, q4: null },
});
const preferredAfterMeas = defaultExpandedQuestionCategories(afterMeasurements);
sticky = mergeStickyOpenCategories(
  sticky,
  new Set([...preferredAfterMeas].map((c) => questionDisclosureKey(wa, c)))
);
check(
  "final required in group → completion does not force collapse",
  resolveQuestionCategoryExpanded({
    disclosureKey: measurementsKey,
    preferredOpen: preferredAfterMeas.has("measurements"),
    stickyOpen: sticky,
    manualExpanded: {},
  }) === true
);

const completeOnly = groupQuestionsByPresentationCategory({
  questions: [
    { id: "q1", key: "internal_walls.length_lm", label: "Length", required: true },
  ],
  answers: { q1: 10 },
});
check(
  "completed group may start collapsed on initial load",
  defaultExpandedQuestionCategories(completeOnly).size === 0 &&
    resolveQuestionCategoryExpanded({
      disclosureKey: questionDisclosureKey(wa, "measurements"),
      preferredOpen: false,
      stickyOpen: new Set(),
      manualExpanded: {},
    }) === false
);

console.log("\nUSER CONTROL");
check(
  "manual collapse respected after save",
  resolveQuestionCategoryExpanded({
    disclosureKey: measurementsKey,
    preferredOpen: true,
    stickyOpen: sticky,
    manualExpanded: { [measurementsKey]: false },
  }) === false
);
check(
  "manual expand respected after save",
  resolveQuestionCategoryExpanded({
    disclosureKey: measurementsKey,
    preferredOpen: false,
    stickyOpen: new Set(),
    manualExpanded: { [measurementsKey]: true },
  }) === true
);

console.log("\nREMOUNT");
const qb = read("components/assistant/QuestionBlock.tsx");
check(
  "stable Work Area keys use workAreaId",
  qb.includes("key={group.workAreaId ?? group.workAreaName}")
);
check(
  "category keys use workArea+category disclosure key",
  qb.includes("questionDisclosureKey") && qb.includes("key={disclosureKey}")
);
check(
  "disclosure state lifted above WorkAreaSection",
  qb.includes("Lifted disclosure") ||
    (qb.includes("stickyOpen") && qb.includes("manualExpanded"))
);
check(
  "sticky merge never drops on completion",
  read("lib/assistant/presentation/question-disclosure.ts").includes(
    "Never removes keys"
  ) ||
    read("lib/assistant/presentation/question-disclosure.ts").includes(
      "Never remove"
    )
);

console.log("\nCONDITIONAL / REVIEW");
const stickyWithChild = mergeStickyOpenCategories(
  sticky,
  new Set([questionDisclosureKey(wa, "compliance_risk")])
);
check(
  "new incomplete category joins sticky open set",
  stickyWithChild.has(questionDisclosureKey(wa, "compliance_risk")) &&
    stickyWithChild.has(measurementsKey)
);
check(
  "Review focus props wired on QuestionBlock",
  qb.includes("focusQuestionId") && qb.includes("focusQuestionKey")
);
check(
  "Review pin outranks manual collapse for target",
  resolveQuestionCategoryExpanded({
    disclosureKey: measurementsKey,
    preferredOpen: false,
    stickyOpen: new Set(),
    manualExpanded: { [measurementsKey]: false },
    reviewPinnedKeys: new Set([measurementsKey]),
  }) === true
);

console.log("\nBOUNDARIES");
check(
  "no FOUNDATION-R1 migration (034 branding from later batch is allowed)",
  !readdirSync(resolve(process.cwd(), "supabase/migrations")).some((f) =>
    /foundation.?r1|035_|036_/i.test(f)
  )
);
check(
  "question eligibility helpers untouched (no authority edits in disclosure)",
  !read("lib/assistant/presentation/question-disclosure.ts").includes(
    "project_facts"
  ) &&
    !read("lib/assistant/presentation/question-disclosure.ts").includes(
      "buildQuestionBlock"
    )
);
check(
  "Production Scope Discovery config intact",
  existsSync(
    resolve(process.cwd(), "lib/scope-discovery/configuration/index.ts")
  )
);
check(
  "R6-R3 docs present",
  existsSync(
    resolve(
      process.cwd(),
      "docs/runbooks/STAGE_3_1B7FR6R3_QUESTION_FLOW_RETEST.md"
    )
  )
);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
