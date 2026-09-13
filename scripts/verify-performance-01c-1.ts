/**
 * PERFORMANCE-01C-1 — Details saving UX + Pricing transition feedback.
 *
 * Run: npx --yes tsx scripts/verify-performance-01c-1.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  detailsReadyCardVisible,
  shouldHoldClarifyQuestionUntilPersist,
  shouldIgnoreDuplicateClarifyActivation,
} from "../lib/assistant/clarify/interaction";
import { shouldIgnorePendingSingleSelectActivation } from "../lib/assistant/selection/optimistic-select";
import { composeEstimateReadiness } from "../lib/assistant/readiness/compose";
import type { ClarifyView } from "../lib/assistant/clarify/types";
import type { JobPlanView } from "../lib/assistant/job-plan/types";

const root = resolve(import.meta.dirname ?? __dirname, "..");

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

function read(relativePath: string): string {
  const path = join(root, relativePath);
  if (!existsSync(path)) {
    check(`${relativePath} exists`, false, path);
    return "";
  }
  return readFileSync(path, "utf8");
}

console.log("verify-performance-01c-1: starting…\n");

const panel = read("components/assistant/clarify/ClarifyPanel.tsx");
const control = read("components/assistant/clarify/ClarifyAnswerControl.tsx");
const readiness = read("components/assistant/clarify/ClarifyReadiness.tsx");
const optionSelect = read("components/assistant/selection/OptionSelect.tsx");
const pricing = read("components/pricing/CreateFinalPricingDialog.tsx");
const indicator = read("components/assistant/SaveStatusIndicator.tsx");
const shell = read("components/assistant/AssistantShell.tsx");
const composeSrc = read("lib/assistant/readiness/compose.ts");
const generateSrc = read("lib/assistant/actions.ts");

console.log("-- A. pending state / one logical save --");
check(
  "SaveStatusIndicator is the existing spinner (Loader2 + Saving…)",
  indicator.includes('from "lucide-react"') &&
    indicator.includes("Loader2") &&
    indicator.includes("ASSISTANT_ACTION_LABELS.saving")
);
check(
  "ClarifyAnswerControl wires SaveStatusIndicator + pending",
  control.includes("SaveStatusIndicator") &&
    control.includes("pending={pending}") &&
    control.includes("if (pending) return")
);
check(
  "ClarifyPanel tracks pending ids and holds the last question",
  panel.includes("heldPendingId") &&
    panel.includes("shouldHoldClarifyQuestionUntilPersist") &&
    panel.includes("beginPending") &&
    panel.includes("SaveStatusIndicator")
);
check(
  "single-select pending helper ignores repeats",
  shouldIgnorePendingSingleSelectActivation({
    pending: true,
    multiple: false,
  }) === true &&
    shouldIgnorePendingSingleSelectActivation({
      pending: false,
      multiple: false,
    }) === false &&
    shouldIgnorePendingSingleSelectActivation({
      pending: true,
      multiple: true,
    }) === false
);
check(
  "last required / last visible question is held until persist",
  shouldHoldClarifyQuestionUntilPersist({
    remainingRequiredBeforeAnswer: 1,
    visibleCandidateCount: 3,
  }) === true &&
    shouldHoldClarifyQuestionUntilPersist({
      remainingRequiredBeforeAnswer: 4,
      visibleCandidateCount: 1,
    }) === true &&
    shouldHoldClarifyQuestionUntilPersist({
      remainingRequiredBeforeAnswer: 3,
      visibleCandidateCount: 3,
    }) === false
);

console.log("\n-- B. rapid repeated click --");
check(
  "duplicate activation ignored while same candidate is pending",
  shouldIgnoreDuplicateClarifyActivation({
    pendingCandidateId: "q1",
    candidateId: "q1",
  }) === true &&
    shouldIgnoreDuplicateClarifyActivation({
      pendingCandidateId: "q1",
      candidateId: "q2",
    }) === false &&
    shouldIgnoreDuplicateClarifyActivation({
      pendingCandidateId: null,
      candidateId: "q1",
    }) === false
);
check(
  "OptionSelect single-select ignores clicks while pending",
  optionSelect.includes("shouldIgnorePendingSingleSelectActivation") &&
    optionSelect.includes("data-option-pending={pending ? \"true\" : undefined}")
);
check(
  "ClarifyPanel beginPending uses the duplicate helper",
  panel.includes("shouldIgnoreDuplicateClarifyActivation") &&
    panel.includes("pendingLockRef")
);

console.log("\n-- C. failure --");
check(
  "failed persist still rolls back local answer",
  panel.includes("rollbackFailedClarifyPersist") &&
    panel.includes("ids.filter((id) => id !== candidate.id)") &&
    panel.includes("delete next[candidate.id]") &&
    panel.includes(".finally(() => {") &&
    panel.includes("endPending(candidate.id)")
);
check(
  "persistError still blocks Ready",
  detailsReadyCardVisible({
    visibleGroupCount: 0,
    remaining: 0,
    viewEnoughToEstimate: true,
    readinessEnoughToEstimate: true,
    persistError: "Could not save",
  }) === false
);

console.log("\n-- D. pendingReadinessWrites / Ready --");
const interactionSrc = read("lib/assistant/clarify/interaction.ts");
const readyFnStart = interactionSrc.indexOf(
  "export function detailsReadyCardVisible"
);
const readyFn = interactionSrc.slice(readyFnStart, readyFnStart + 500);
check(
  "detailsReadyCardVisible is unchanged (no pendingWrites param)",
  readyFnStart >= 0 &&
    readyFn.includes("persistError") &&
    !readyFn.includes("pendingWrites")
);
check(
  "shell still gates generate on pendingReadinessWrites",
  shell.includes("pendingReadinessWrites > 0") &&
    shell.includes("pendingWrites: pendingReadinessWrites")
);
check(
  "compose still requires pendingWrites === 0 for enoughToEstimate",
  composeSrc.includes("pendingWrites === 0") &&
    composeSrc.includes("canEstimateNow: clarify.canEstimateNow && pendingWrites === 0")
);
check(
  "Ready card still requires readiness.enoughToEstimate",
  panel.includes("readinessEnoughToEstimate: readiness.enoughToEstimate === true")
);

const emptyClarify = {
  enoughToEstimate: true,
  canEstimateNow: true,
  blocksEstimate: false,
  remainingRequiredCount: 0,
  visibleCount: 0,
  candidates: [],
  deferred: [],
  groups: [],
  estimateNowAssumptions: [],
} as unknown as ClarifyView;
const emptyPlan = {
  cards: [],
} as unknown as JobPlanView;
const pendingReady = composeEstimateReadiness({
  clarify: emptyClarify,
  jobPlan: emptyPlan,
  qualityLevel: "standard",
  constraints: [],
  pendingWrites: 1,
});
const settledReady = composeEstimateReadiness({
  clarify: emptyClarify,
  jobPlan: emptyPlan,
  qualityLevel: "standard",
  constraints: [],
  pendingWrites: 0,
});
check(
  "pendingWrites keeps Create Estimate unavailable",
  pendingReady.enoughToEstimate === false &&
    pendingReady.canEstimateNow === false
);
check(
  "settled writes allow Ready when the view is enough",
  settledReady.enoughToEstimate === true &&
    settledReady.canEstimateNow === true
);

console.log("\n-- E. Continue to Pricing --");
check(
  "pricing dialog keeps useTransition + Creating… + disable",
  pricing.includes("useTransition") &&
    pricing.includes("Creating…") &&
    pricing.includes("disabled={isPending}")
);
check(
  "pricing dialog adds circular spinner beside Creating…",
  pricing.includes("Loader2") &&
    pricing.includes("animate-spin") &&
    pricing.includes("data-pricing-create-pending")
);
check(
  "pricing dialog blocks duplicate activation",
  pricing.includes("createLockRef") &&
    pricing.includes("if (isPending || createLockRef.current) return")
);
check(
  "pricing action import is unchanged",
  pricing.includes("createPricingFromEstimate") &&
    !pricing.includes("updateProjectFact")
);

console.log("\n-- F. frozen surfaces --");
check(
  "generate guard import unchanged",
  generateSrc.includes("evaluateGenerateEstimatePermission")
);
check(
  "ClarifyReadiness uses SaveStatusIndicator while saving",
  readiness.includes("SaveStatusIndicator") &&
    readiness.includes("ASSISTANT_LOADING_COPY.estimateGenerate")
);
check(
  "no backend persistence files edited by 01C-1 shape",
  !read("lib/assistant/fact-actions.ts").includes("SaveStatusIndicator") &&
    !read("lib/assistant/load-assistant-mutation-result.ts").includes(
      "SaveStatusIndicator"
    )
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
