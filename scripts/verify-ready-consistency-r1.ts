/**
 * ESTIMATING-FOUNDATION-02 — Ready consistency (rail / panel / CTA / preflight).
 *
 * Run: npx --yes tsx scripts/verify-ready-consistency-r1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import {
  composeClarifyInputFromEstimateContext,
  evaluateClarifyEstimateReadiness,
  evaluateGenerateEstimatePermission,
} from "../lib/assistant/readiness/clarify-estimate";
import { composeEstimateReadiness } from "../lib/assistant/readiness/compose";
import {
  applyExtractedInternalWallsToFacts,
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

const facts: EstimateFact[] = applyExtractedInternalWallsToFacts({
  facts: [
    {
      key: "internal_walls.job_scope",
      work_area_id: "w1",
      value: "new_partition",
    },
  ],
  workAreaId: "w1",
  types: extractInternalWallsTypesFromBrief(COORDINATION_ORIGINAL_BRIEF),
});

const workAreas = [
  { id: "w1", type: "internal_walls", name: "Internal walls", status: "confirmed" as const },
  { id: "d1", type: "demolition", name: "Demolition / strip-out", status: "confirmed" as const },
];

function authorities(constraints: readonly { key: string; value: string }[]) {
  const compose = composeClarifyInputFromEstimateContext({
    stage: "work_area_questions",
    briefText: COORDINATION_ORIGINAL_BRIEF,
    qualityLevel: "standard",
    workAreas,
    facts,
    constraints,
  });
  const clarify = composeClarifyView(compose);
  const panel = composeEstimateReadiness({
    clarify,
    jobPlan: compose.jobPlan,
    qualityLevel: "standard",
    constraints,
  });
  const estimate = evaluateClarifyEstimateReadiness(compose);
  const generate = evaluateGenerateEstimatePermission({
    compose,
    workAreas,
    facts,
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
  shell.includes('estimateReadiness.enoughToEstimate') &&
    shell.includes('? "Ready"')
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

console.log("\n=== Four authorities agree (not Ready) ===\n");
const blocked = authorities([{ key: "site_access", value: "Easy" }]);
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

if (failed > 0) {
  console.error(`\nFAILED ${failed}  passed ${passed}`);
  process.exit(1);
}
console.log(`\nOK  ${passed} checks`);
