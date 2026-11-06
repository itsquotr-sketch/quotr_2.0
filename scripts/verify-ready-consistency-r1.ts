/**
 * ESTIMATING-FOUNDATION-02 — Ready consistency (rail / panel / CTA / preflight).
 *
 * Run: npx --yes tsx scripts/verify-ready-consistency-r1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { isInitialCaptureQuestion } from "../lib/assistant/clarify/question-contract";
import {
  composeClarifyInputFromEstimateContext,
  evaluateClarifyEstimateReadiness,
  evaluateGenerateEstimatePermission,
} from "../lib/assistant/readiness/clarify-estimate";
import { composeEstimateReadiness } from "../lib/assistant/readiness/compose";
import {
  applyExtractedInternalWallsToFacts,
  applyInternalWallsNoAccessoryScope,
  COORDINATION_ORIGINAL_BRIEF,
  extractInternalWallsTypesFromBrief,
} from "../lib/estimate/internal-walls-brief";
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

const facts: EstimateFact[] = applyInternalWallsNoAccessoryScope({
  facts: applyExtractedInternalWallsToFacts({
    facts: [
      {
        key: "internal_walls.job_scope",
        work_area_id: "w1",
        value: "new_partition",
      },
    ],
    workAreaId: "w1",
    types: extractInternalWallsTypesFromBrief(COORDINATION_ORIGINAL_BRIEF),
  }),
  workAreaId: "w1",
});

const workAreas = [
  { id: "w1", type: "internal_walls", name: "Internal walls", status: "confirmed" as const },
  { id: "d1", type: "demolition", name: "Demolition / strip-out", status: "confirmed" as const },
];

function authorities(
  constraints: readonly { key: string; value: string }[],
  pendingWrites = 0,
  factRows: readonly EstimateFact[] = facts
) {
  const compose = composeClarifyInputFromEstimateContext({
    stage: "work_area_questions",
    briefText: COORDINATION_ORIGINAL_BRIEF,
    qualityLevel: "standard",
    workAreas,
    facts: factRows,
    constraints,
  });
  const clarify = composeClarifyView(compose);
  const panel = composeEstimateReadiness({
    clarify,
    jobPlan: compose.jobPlan,
    qualityLevel: "standard",
    constraints,
    pendingWrites,
  });
  const estimate = evaluateClarifyEstimateReadiness(compose);
  const generate = evaluateGenerateEstimatePermission({
    compose,
    workAreas,
    facts: factRows,
    unresolvedRequiredProjectConditionKeys: [],
  });
  return { clarify, panel, estimate, generate };
}

console.log("=== Shared authority wiring ===\n");
const shell = read("components/assistant/AssistantShell.tsx");
const panelUi = read("components/assistant/clarify/ClarifyPanel.tsx");
const actions = read("lib/assistant/actions.ts");
check(
  "Details rail uses estimateReadiness.enoughToEstimate",
  shell.includes("estimateReadiness.enoughToEstimate") &&
    shell.includes("detailsReadinessPhase") &&
    shell.includes("detailsStageStatusLabel") &&
    read("lib/assistant/readiness/details-status.ts").includes('if (input.pendingWrites > 0) return "saving"') &&
    read("lib/assistant/readiness/details-status.ts").includes('if (input.enoughToEstimate) return "ready"') &&
    read("lib/assistant/readiness/details-status.ts").includes('return "Ready"')
);
check(
  "rail does not use visibleCount as Ready",
  shell.includes("remainingRequiredCount") &&
    !shell.includes('`${clarifyView.visibleCount} to clarify`')
);
check(
  "Ready card requires panel enoughToEstimate",
  panelUi.includes("readiness.enoughToEstimate === true") &&
    panelUi.includes("view.enoughToEstimate === true")
);
check(
  "Create Estimate uses evaluateGenerateEstimatePermission",
  actions.includes("evaluateGenerateEstimatePermission")
);
check(
  "rail never labels Details as Not sure",
  !shell.includes('statusLabel="Not sure"') &&
    !/Details[\s\S]{0,200}Not sure/.test(shell)
);

console.log("\n=== Unresolved wall scope does not block unrelated generation ===\n");
const openWallScope = authorities(
  [
    { key: "site_access", value: "Easy" },
    { key: "material_carry_distance", value: "< 10m" },
  ],
  0,
  facts.filter((row) => row.key !== "internal_walls.job_scope")
);
const openWallQuestion = openWallScope.clarify.candidates.find(
  (row) => row.factKey === "internal_walls.job_scope"
);
check(
  "unresolved wall scope does not block generation",
  openWallScope.clarify.remainingRequiredCount === 0 &&
    openWallScope.panel.enoughToEstimate === true &&
    openWallScope.estimate.ready === true &&
    openWallScope.generate.ready === true
);
check(
  "unresolved wall scope stays open and is not assumed",
  openWallQuestion != null &&
    !isInitialCaptureQuestion(openWallQuestion) &&
    openWallQuestion.assumable === false &&
    openWallQuestion.blocksEstimate === false
);

console.log("\n=== Confirmed wall scope still requires its measurements ===\n");
const missingLength = facts.map((row) => {
  if (row.key !== "internal_walls.wall_types" || !Array.isArray(row.value)) {
    return row;
  }
  return {
    ...row,
    value: row.value.map((type) =>
      type != null && typeof type === "object"
        ? { ...type, length_lm: null }
        : type
    ),
  };
});
const blocked = authorities(
  [
    { key: "site_access", value: "Easy" },
    { key: "material_carry_distance", value: "< 10m" },
  ],
  0,
  missingLength
);
check("clarify remainingRequiredCount > 0", blocked.clarify.remainingRequiredCount > 0);
check("panel enoughToEstimate false", blocked.panel.enoughToEstimate === false);
check("estimate ready false", blocked.estimate.ready === false);
check("generate ready false", blocked.generate.ready === false);
check(
  "all four blocked together",
  !blocked.clarify.enoughToEstimate &&
    !blocked.panel.enoughToEstimate &&
    !blocked.estimate.ready &&
    !blocked.generate.ready
);

console.log("\n=== Four authorities agree (Ready) ===\n");
const ready = authorities([
  { key: "site_access", value: "Easy" },
  { key: "material_carry_distance", value: "< 10m" },
]);
check("clarify enoughToEstimate", ready.clarify.enoughToEstimate === true);
check("panel enoughToEstimate", ready.panel.enoughToEstimate === true);
check("estimate ready", ready.estimate.ready === true);
check("generate ready", ready.generate.ready === true);
check(
  "Create Estimate availability matches Ready",
  ready.generate.ready === ready.panel.enoughToEstimate &&
    ready.generate.ready === ready.estimate.ready
);
check(
  "demolition applicability extras do not create a second generate gate",
  evaluateGenerateEstimatePermission({
    compose: composeClarifyInputFromEstimateContext({
      stage: "work_area_questions",
      briefText: COORDINATION_ORIGINAL_BRIEF,
      qualityLevel: "standard",
      workAreas,
      facts,
      constraints: [
        { key: "site_access", value: "Easy" },
        { key: "material_carry_distance", value: "< 10m" },
      ],
    }),
    workAreas,
    facts,
    unresolvedRequiredProjectConditionKeys: [
      "floor_level",
      "services_isolated",
      "hazardous_materials_risk",
      "waste_bin_access",
    ],
  }).ready === true
);

console.log("\n=== Project-condition write race (EF02-A) ===\n");
const readyConstraints = [
  { key: "site_access", value: "Easy" },
  { key: "material_carry_distance", value: "< 10m" },
];

const unresolvedCarry = authorities([{ key: "site_access", value: "Easy" }], 0);
const openCarry = unresolvedCarry.clarify.candidates.find(
  (row) => row.constraintKey === "material_carry_distance"
);
check(
  "unresolved carry does not block generation",
  unresolvedCarry.panel.enoughToEstimate === true &&
    unresolvedCarry.generate.ready === true
);
check(
  "unresolved carry stays open and is not a short carry",
  openCarry != null &&
    !isInitialCaptureQuestion(openCarry) &&
    openCarry.assumable === false
);

const persistencePending = authorities(readyConstraints, 1);
check(
  "carry answered but write still pending: Ready stays false, not a false-positive",
  persistencePending.clarify.enoughToEstimate === true &&
    persistencePending.panel.enoughToEstimate === false,
  "clarify (fact-complete) view must already be true here so the pending gate is the only thing blocking Ready"
);
check(
  "pending write surfaces a Saving state, not a contradictory Ready",
  Boolean(persistencePending.panel.blockerCopy?.toLowerCase().includes("saving"))
);

const persistenceResolved = authorities(readyConstraints, 0);
check(
  "once persistence resolves: Ready flips true immediately",
  persistenceResolved.panel.enoughToEstimate === true &&
    persistenceResolved.generate.ready === true
);

console.log("\n=== Unified pending-write authority (source) ===\n");
const shellForRace = read("components/assistant/AssistantShell.tsx");
check(
  "handleClarifyBoolean raises the unified counter unconditionally",
  /setClarifyWritePending\(true\);\s*setPendingReadinessWrites\(\(n\) => n \+ 1\);/.test(
    shellForRace
  )
);
check(
  "handleClarifyValue raises the unified counter unconditionally (covers select Project Conditions)",
  /if \(isNumericOrText\) setClarifyWritePending\(true\);\s*setPendingReadinessWrites\(\(n\) => n \+ 1\);/.test(
    shellForRace
  )
);
check(
  "both handlers release the counter in `finally` (survives early return and error paths)",
  (shellForRace.match(
    /finally \{\s*setClarifyWritePending\(false\);\s*setPendingReadinessWrites\(\(n\) => Math\.max\(0, n - 1\)\);\s*\}/g
  ) ?? []).length === 2
);
check(
  "Create Estimate is gated by the unified counter, not the number/text-only flag",
  shellForRace.includes("pendingReadinessWrites > 0") &&
    !/handleGenerateEstimate[\s\S]{0,200}clarifyWritePending/.test(shellForRace)
);
check(
  "Details readiness is composed from the unified counter",
  shellForRace.includes("pendingWrites: pendingReadinessWrites")
);
check(
  "chip/select UI still does not disable via the number/text-only flag (unchanged UX)",
  shellForRace.includes("if (isNumericOrText) setClarifyWritePending(true)")
);

if (failed > 0) {
  console.error(`\nFAILED ${failed}  passed ${passed}`);
  process.exit(1);
}
console.log(`\nOK  ${passed} checks`);
