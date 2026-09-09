/**
 * Clarify interaction race / advance / Continue contract.
 * Run: npx tsx scripts/verify-clarify-interaction-race-r1.ts
 *
 * Pure state-machine checks. No Production. No migrations.
 */
import { readFileSync } from "node:fs";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { isInitialCaptureQuestion } from "../lib/assistant/clarify/question-contract";
import {
  currentClarifyCandidate,
  effectiveRemainingRequiredCount,
  mergeConstraintSnapshotWithLaterOverlay,
  persistClarifyValueType,
  shouldPersistOnOptionToggle,
  shouldRefreshAfterStaleMutation,
  shouldAdvanceOnSelect,
} from "../lib/assistant/clarify/interaction";
import { shouldAcceptPersistedAnswer } from "../lib/assistant/selection/latest-answer";
import { shouldApplyAssistantMutation } from "../lib/assistant/assistant-mutation-result";
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

function synth(
  id: string,
  overrides: Partial<ClarifyCandidate> = {}
): ClarifyCandidate {
  return {
    id,
    source: "scope_fact",
    workAreaId: "wa-1",
    workAreaName: "Bathroom",
    workAreaType: "bathroom",
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

console.log("=== CLARIFY INTERACTION RACE R1 ===\n");

const q1 = synth("q1", { question: "How difficult is site access?" });
const q2 = synth("q2", { question: "Is the site occupied during works?" });
const q3 = synth("q3", { question: "Floor substrate?" });
const q4 = synth("q4", { question: "Next?" });
const batch = [q1, q2, q3, q4];

const afterQ1 = currentClarifyCandidate({
  candidates: batch,
  locallyResolvedIds: new Set(["q1"]),
  rewind: null,
  heldMulti: null,
});
const afterQ2 = currentClarifyCandidate({
  candidates: batch,
  locallyResolvedIds: new Set(["q1", "q2"]),
  rewind: null,
  heldMulti: null,
});
const afterQ3 = currentClarifyCandidate({
  candidates: batch,
  locallyResolvedIds: new Set(["q1", "q2", "q3"]),
  rewind: null,
  heldMulti: null,
});
const staleBatchStillHasQ1 = currentClarifyCandidate({
  candidates: batch,
  locallyResolvedIds: new Set(["q1", "q2", "q3"]),
  rewind: null,
  heldMulti: null,
});

check("rapid Q1 advances to Q2 without waiting for persist", afterQ1?.id === "q2");
check("rapid Q2 advances to Q3", afterQ2?.id === "q3");
check("rapid Q3 advances to Q4", afterQ3?.id === "q4");
check(
  "stale candidate list cannot reopen Q1/Q2/Q3",
  staleBatchStillHasQ1?.id === "q4"
);
check(
  "current question never regresses to an accepted id",
  currentClarifyCandidate({
    candidates: [q1, q2],
    locallyResolvedIds: new Set(["q1", "q2"]),
    rewind: null,
    heldMulti: null,
  }) === null
);

const remainingBefore = 4;
const remainingAfterLocal = effectiveRemainingRequiredCount({
  remainingRequiredCount: remainingBefore,
  candidates: batch.map((row) => ({
    ...row,
    askClass: "ASK_NOW",
  })),
  locallyResolvedIds: new Set(["q1", "q2"]),
});
check(
  "remaining count uses the same local resolved authority",
  remainingAfterLocal === 2 && remainingAfterLocal < remainingBefore
);
check(
  "remaining count does not increase when overlay is lagging",
  effectiveRemainingRequiredCount({
    remainingRequiredCount: 4,
    candidates: batch,
    locallyResolvedIds: new Set(["q1", "q2", "q3"]),
  }) === 1
);

const merged = mergeConstraintSnapshotWithLaterOverlay({
  incoming: [
    { key: "site_access", value: "Easy" },
    { key: "occupied_site", value: "No" },
  ],
  previous: [
    { key: "site_access", value: "Moderate" },
    { key: "occupied_site", value: "Yes" },
    { key: "working_hours", value: "Yes" },
  ],
  overlaySeqByKey: new Map([
    ["site_access", 1],
    ["occupied_site", 2],
    ["working_hours", 3],
  ]),
  requestSeq: 1,
});
check(
  "late Q1 constraint snapshot cannot clear newer Q2/Q3",
  merged.find((row) => row.key === "occupied_site")?.value === "Yes" &&
    merged.find((row) => row.key === "working_hours")?.value === "Yes"
);
check(
  "incoming Q1 value is kept when it is not newer-overlaid",
  merged.find((row) => row.key === "site_access")?.value === "Easy"
);

check(
  "stale mutation seq is ignored",
  shouldApplyAssistantMutation({
    currentProjectId: "p1",
    applied: { projectId: "p1", requestSeq: 4 },
    incoming: { projectId: "p1", requestSeq: 2 },
  }) === false
);
check(
  "later persist seq wins",
  shouldAcceptPersistedAnswer({ persistedSeq: 1, latestSeqForKey: 3 }) === false &&
    shouldAcceptPersistedAnswer({ persistedSeq: 3, latestSeqForKey: 3 }) === true
);
check(
  "router.refresh is skipped when a newer overlay exists",
  shouldRefreshAfterStaleMutation({
    factSeqByKey: new Map([["f", 5]]),
    constraintSeqByKey: new Map(),
    requestSeq: 2,
  }) === false
);
check(
  "router.refresh is allowed when no newer overlay exists",
  shouldRefreshAfterStaleMutation({
    factSeqByKey: new Map([["f", 2]]),
    constraintSeqByKey: new Map([["c", 2]]),
    requestSeq: 2,
  }) === true
);

check(
  "multi-select toggles do not persist",
  shouldPersistOnOptionToggle("MULTI_SELECT") === false
);
check(
  "single-select and boolean persist on select",
  shouldPersistOnOptionToggle("SINGLE_SELECT") &&
    shouldPersistOnOptionToggle("BOOLEAN") &&
    shouldAdvanceOnSelect("SINGLE_SELECT") &&
    shouldAdvanceOnSelect("BOOLEAN")
);
check(
  "multi-select Continue persists one complete array",
  persistClarifyValueType(
    { inputType: "multi_select" },
    ["floor finish", "wall lining", "vanity", "toilet"]
  ) === "multi_select"
);
check(
  "Not sure persists as select, not boolean false",
  persistClarifyValueType({ inputType: "select" }, "Not sure") === "select"
);

const plan = composeJobPlan({
  workAreas: [{ id: "b1", type: "bathroom", name: "Bathroom", status: "confirmed" }],
  facts: [
    fact("bathroom.job_scope", "b1", "strip_out_only"),
    fact("bathroom.length_m", "b1", 3),
    fact("bathroom.width_m", "b1", 2.4),
    fact("bathroom.demolition_required", "b1", true),
  ],
  constraints: [],
});
const demoView = composeClarifyView({
  stage: "quality",
  briefText: null,
  qualityLevel: "standard",
  workAreas: [{ id: "b1", type: "bathroom", name: "Bathroom", status: "confirmed" }],
  facts: [
    fact("bathroom.job_scope", "b1", "strip_out_only"),
    fact("bathroom.length_m", "b1", 3),
    fact("bathroom.width_m", "b1", 2.4),
    fact("bathroom.demolition_required", "b1", true),
  ],
  constraints: [],
  jobPlan: plan,
});
const demo = [...demoView.candidates, ...demoView.deferred].find(
  (row) => row.factKey === "bathroom.demolition.components"
);
check(
  "Bathroom demolition is the Continue whole-set question",
  demo != null &&
    demo.inputType === "multi_select" &&
    isInitialCaptureQuestion(demo)
);

const overlayed = composeClarifyView({
  stage: "quality",
  briefText: null,
  qualityLevel: "standard",
  workAreas: [{ id: "b1", type: "bathroom", name: "Bathroom", status: "confirmed" }],
  facts: [
    fact("bathroom.job_scope", "b1", "strip_out_only"),
    fact("bathroom.length_m", "b1", 3),
    fact("bathroom.width_m", "b1", 2.4),
    fact("bathroom.demolition_required", "b1", true),
    fact("bathroom.demolition.components", "b1", [
      "floor finish",
      "wall lining",
      "vanity",
      "toilet",
    ]),
  ],
  constraints: [],
  jobPlan: composeJobPlan({
    workAreas: [{ id: "b1", type: "bathroom", name: "Bathroom", status: "confirmed" }],
    facts: [
      fact("bathroom.job_scope", "b1", "strip_out_only"),
      fact("bathroom.length_m", "b1", 3),
      fact("bathroom.width_m", "b1", 2.4),
      fact("bathroom.demolition_required", "b1", true),
      fact("bathroom.demolition.components", "b1", [
        "floor finish",
        "wall lining",
        "vanity",
        "toilet",
      ]),
    ],
    constraints: [],
  }),
});
check(
  "whole demolition set is treated as resolved after one commit",
  ![...overlayed.candidates, ...overlayed.deferred].some(
    (row) => row.factKey === "bathroom.demolition.components"
  )
);

const shellSrc = read("components/assistant/AssistantShell.tsx");
const clarifySrc = read("components/assistant/clarify/ClarifyPanel.tsx");
check(
  "AssistantShell merges later constraint overlays",
  shellSrc.includes("mergeConstraintSnapshotWithLaterOverlay")
);
check(
  "AssistantShell skips refresh when newer overlay exists",
  shellSrc.includes("shouldRefreshAfterStaleMutation") &&
    shellSrc.includes("onRejectedCanonicalMutation")
);
check(
  "ClarifyPanel current question skips locally accepted ids",
  clarifySrc.includes("currentClarifyCandidate") &&
    clarifySrc.includes("locallyResolvedIds")
);
check(
  "Continue advances before awaiting the set write",
  /advance\(showing\);\s*void Promise\.resolve\(onAnswerValue/.test(clarifySrc)
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
