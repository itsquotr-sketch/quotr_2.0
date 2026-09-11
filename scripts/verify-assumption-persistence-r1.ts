/**
 * EF02-D1 / EF02-FINAL-R3-A — accepted ASSUME_IF_SKIPPED values persist as
 * assumption facts. Numeric Not sure must resolve before Number() coerce.
 *
 * Run: npx --yes tsx scripts/verify-assumption-persistence-r1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  clarifyPersistResultFailed,
  detailsReadyCardVisible,
  persistClarifyValueType,
} from "../lib/assistant/clarify/interaction";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { plannedAssumptionWrites } from "../lib/assistant/clarify/persist-assumptions";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { composeRefineView } from "../lib/assistant/refine/compose";
import { resolveCommittedFactWrite } from "../lib/assistant/scope-persistence";
import { BATHROOM_WALL_HEIGHT_ASSUMPTION_M } from "../lib/estimate/bathroom-geometry";
import { DEFAULT_FASCIA_GROUND_GAP_M } from "../lib/estimate/deck-fascia";
import { DEFAULT_STEP_GOING_M, DEFAULT_STEP_WIDTH_M } from "../lib/estimate/deck-steps-physical";
import {
  DECK_BOARD_MATERIAL_ASSUMPTION,
  DECK_HEIGHT_ASSUMPTION_M,
  disclosedAssumptionForNotSure,
} from "../lib/estimate/disclosed-assumptions";
import type { EstimateFact } from "../lib/estimate/types";
import { disclosedProjectConditionForNotSure } from "../lib/project-conditions/consumed-authority";
import { normalizeAnswerForStorage } from "../lib/scopes/fact-values";

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
  workAreaId: string,
  value: unknown,
  source?: string
): EstimateFact {
  return { key, work_area_id: workAreaId, value, source };
}

const workAreas = [
  { id: "d1", type: "deck", name: "Deck", status: "confirmed" as const },
];
const constraints = [
  { key: "site_access", value: "Easy" },
  { key: "material_carry_distance", value: "< 10m" },
  { key: "occupied_site", value: "No" },
  { key: "working_hours", value: "No" },
];

console.log("=== EF02-D1 assumption persistence ===\n");

check(
  "Not sure height → 0.6 assumption source",
  disclosedAssumptionForNotSure("deck.height_m", "Not sure")?.value ===
    DECK_HEIGHT_ASSUMPTION_M &&
    disclosedAssumptionForNotSure("deck.height_m", "Not sure")?.source ===
      "assumption"
);
check(
  "Not sure board material → Hardwood assumption",
  disclosedAssumptionForNotSure("deck.board_material", "Not sure")?.value ===
    DECK_BOARD_MATERIAL_ASSUMPTION
);
check(
  "Known height stays user-owned",
  disclosedAssumptionForNotSure("deck.height_m", 0.8) == null
);

console.log("\n=== EF02-FINAL-R3-A canonical write order ===\n");

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const persistSrc = read("lib/assistant/scope-persistence.ts");
const resolveIdx = persistSrc.indexOf("export function resolveCommittedFactWrite");
const normalizeInResolve = persistSrc.indexOf(
  "normalizeAnswerForStorage",
  resolveIdx
);
const notSureInResolve = persistSrc.indexOf("isNotSureValue", resolveIdx);
check(
  "commitUserFactEdit uses resolveCommittedFactWrite",
  persistSrc.includes("resolveCommittedFactWrite({") &&
    persistSrc.includes("commitUserFactEdit")
);
check(
  "Not sure is detected before Number() normalisation",
  resolveIdx >= 0 &&
    notSureInResolve > resolveIdx &&
    normalizeInResolve > notSureInResolve
);
check(
  "old order Number(Not sure) is NaN",
  Number.isNaN(Number("Not sure"))
);

const numericAssumeKeys: Array<{
  key: string;
  valueType: "number";
  expected: number;
}> = [
  { key: "deck.height_m", valueType: "number", expected: DECK_HEIGHT_ASSUMPTION_M },
  {
    key: "deck.ground_clearance_m",
    valueType: "number",
    expected: DEFAULT_FASCIA_GROUND_GAP_M,
  },
  { key: "deck.step_width_m", valueType: "number", expected: DEFAULT_STEP_WIDTH_M },
  { key: "deck.step_going_m", valueType: "number", expected: DEFAULT_STEP_GOING_M },
  {
    key: "bathroom.wall_height_m",
    valueType: "number",
    expected: BATHROOM_WALL_HEIGHT_ASSUMPTION_M,
  },
];

for (const row of numericAssumeKeys) {
  const write = resolveCommittedFactWrite({
    key: row.key,
    value: "Not sure",
    valueType: row.valueType,
  });
  check(
    `numeric Not sure ${row.key} → assumed ${row.expected}`,
    write.value === row.expected &&
      write.source === "assumption" &&
      write.value != null &&
      Number.isFinite(Number(write.value))
  );
}

const typedHeight = resolveCommittedFactWrite({
  key: "deck.height_m",
  value: 0.6,
  valueType: "number",
});
const typedHeightString = resolveCommittedFactWrite({
  key: "deck.height_m",
  value: "0.6",
  valueType: "number",
});
check(
  "explicit numeric 0.6 persists as user",
  typedHeight.value === 0.6 && typedHeight.source === "user"
);
check(
  "explicit numeric string 0.6 persists as user",
  typedHeightString.value === 0.6 && typedHeightString.source === "user"
);
check(
  "explicit 0.6 is not classified as assumption",
  disclosedAssumptionForNotSure("deck.height_m", 0.6) == null &&
    disclosedAssumptionForNotSure("deck.height_m", "0.6") == null
);

const boardAssume = resolveCommittedFactWrite({
  key: "deck.board_material",
  value: "Not sure",
  valueType: "select",
});
const boardExplicit = resolveCommittedFactWrite({
  key: "deck.board_material",
  value: "Hardwood",
  valueType: "select",
});
check(
  "select Not sure still persists as disclosed assumption",
  boardAssume.value === DECK_BOARD_MATERIAL_ASSUMPTION &&
    boardAssume.source === "assumption"
);
check(
  "explicit select value stays user",
  boardExplicit.value === "Hardwood" && boardExplicit.source === "user"
);

const booleanYes = resolveCommittedFactWrite({
  key: "bathroom.demolition_required",
  value: true,
  valueType: "boolean",
});
const booleanNotSure = resolveCommittedFactWrite({
  key: "bathroom.demolition_required",
  value: "Not sure",
  valueType: "boolean",
});
check(
  "boolean true stays user",
  booleanYes.value === true && booleanYes.source === "user"
);
check(
  "boolean Not sure is not coerced to false",
  booleanNotSure.value === "Not sure" && booleanNotSure.source === "user"
);
check(
  "occupied_site Not sure still disclosed No / assumption",
  disclosedProjectConditionForNotSure("occupied_site", "Not sure")?.value ===
    "No" &&
    disclosedProjectConditionForNotSure("occupied_site", "Not sure")?.source ===
      "assumption"
);
check(
  "working_hours Not sure still disclosed No / assumption",
  disclosedProjectConditionForNotSure("working_hours", "Not sure")?.value ===
    "No" &&
    disclosedProjectConditionForNotSure("working_hours", "Not sure")?.source ===
      "assumption"
);
check(
  "normalizeAnswerForStorage is not used on Not sure number tokens",
  persistClarifyValueType({ inputType: "number" }, "Not sure") === "select" &&
    persistClarifyValueType({ inputType: "number" }, 0.6) === "number" &&
    persistClarifyValueType({ inputType: "select" }, "Not sure") === "select" &&
    persistClarifyValueType({ inputType: "boolean" }, true) === "boolean"
);
check(
  "legacy number coerce of Not sure is NaN, canonical write is not",
  Number.isNaN(normalizeAnswerForStorage("Not sure", "number") as number) &&
    !Number.isNaN(
      Number(
        resolveCommittedFactWrite({
          key: "deck.height_m",
          value: "Not sure",
          valueType: "number",
        }).value
      )
    )
);

console.log("\n=== EF02-FINAL-R3-A persist error rollback / Ready ===\n");

const panelSrc = read("components/assistant/clarify/ClarifyPanel.tsx");
const shellSrc = read("components/assistant/AssistantShell.tsx");
check(
  "failed persist rolls back locallyResolvedIds",
  panelSrc.includes("rollbackFailedClarifyPersist") &&
    panelSrc.includes("ids.filter((id) => id !== candidate.id)") &&
    panelSrc.includes("delete next[candidate.id]")
);
check(
  "failed persist result rewinds the optimistic advance",
  clarifyPersistResultFailed({
    error: 'null value in column "value" of relation "project_facts"',
  }) === true &&
    clarifyPersistResultFailed({ success: true }) === false &&
    clarifyPersistResultFailed(undefined) === false
);
check(
  "handleClarifyValue returns the persist error to the panel",
  /if \(result\.error\) \{[\s\S]*?setActionError\(result\.error\);[\s\S]*?return result;/.test(
    shellSrc
  )
);
check(
  "Ready card is false while persistError exists even if the candidate is hidden",
  detailsReadyCardVisible({
    visibleGroupCount: 0,
    remaining: 0,
    viewEnoughToEstimate: true,
    readinessEnoughToEstimate: true,
    persistError: 'null value in column "value"',
  }) === false
);
check(
  "Ready card is true only after a successful write with no persistError",
  detailsReadyCardVisible({
    visibleGroupCount: 0,
    remaining: 0,
    viewEnoughToEstimate: true,
    readinessEnoughToEstimate: true,
    persistError: null,
  }) === true
);
check(
  "ClarifyPanel gates Ready on persistError",
  panelSrc.includes("detailsReadyCardVisible") &&
    panelSrc.includes("persistError")
);
check(
  "EF02-A pendingWrites counter is unchanged",
  /if \(isNumericOrText\) setClarifyWritePending\(true\);\s*setPendingReadinessWrites\(\(n\) => n \+ 1\);/.test(
    shellSrc
  ) &&
    (shellSrc.match(
      /finally \{\s*setClarifyWritePending\(false\);\s*setPendingReadinessWrites\(\(n\) => Math\.max\(0, n - 1\)\);\s*\}/g
    ) ?? []).length === 2
);

const unresolved = [fact("deck.length_m", "d1", 5), fact("deck.width_m", "d1", 4)];
const plan = composeJobPlan({
  workAreas,
  facts: unresolved,
  constraints,
  briefText: "New 5 by 4 pine deck.",
});
const clarify = composeClarifyView({
  stage: "quality",
  briefText: "New 5 by 4 pine deck.",
  qualityLevel: "standard",
  workAreas,
  facts: unresolved,
  constraints,
  jobPlan: plan,
});
const writes = plannedAssumptionWrites({
  view: clarify,
  facts: unresolved,
  constraints,
});
check(
  "skipped ASSUME_IF_SKIPPED height is planned as assumption fact",
  writes.some(
    (row) =>
      row.key === "deck.height_m" &&
      row.value === DECK_HEIGHT_ASSUMPTION_M &&
      row.source === "assumption"
  )
);

const assumedFacts = [
  ...unresolved,
  fact("deck.height_m", "d1", DECK_HEIGHT_ASSUMPTION_M, "assumption"),
];
const assumedPlan = composeJobPlan({
  workAreas,
  facts: assumedFacts,
  constraints,
  briefText: "New 5 by 4 pine deck.",
});
const refine = composeRefineView({
  briefText: "New 5 by 4 pine deck.",
  qualityLevel: "standard",
  workAreas,
  facts: assumedFacts,
  constraints,
  jobPlan: {
    cards: assumedPlan.cards.map((card) => ({
      workAreaId: card.workAreaId,
      workAreaType: card.workAreaType,
      name: card.name,
      notConfirmed: card.notConfirmed,
    })),
  },
});
const height = [...refine.highValue, ...refine.advanced].filter(
  (row) => row.factKey === "deck.height_m"
);
check("Refine has one height row", height.length === 1);
check(
  "Refine height is 0.6 assumed, not a blank question",
  height[0]?.currentValue === DECK_HEIGHT_ASSUMPTION_M &&
    height[0]?.assumed === true
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
