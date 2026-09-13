/**
 * PERFORMANCE-01E — Details → Generate Estimate synchronization boundary.
 *
 * Run: npx --yes tsx scripts/verify-performance-01e.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  canShowGenerateCta,
  detailsReadyCardVisible,
} from "../lib/assistant/clarify/interaction";
import {
  canInitiateGenerateEstimate,
  createGenerateOnceLock,
  createPendingWriteTracker,
  decideGenerateAfterSync,
  GENERATE_MIN_VISIBLE_MS,
  generateStatusDetail,
  remainingGenerateMinDisplayMs,
} from "../lib/assistant/clarify/generate-sync";
import { composeEstimateReadiness } from "../lib/assistant/readiness/compose";
import type { ClarifyView } from "../lib/assistant/clarify/types";
import type { JobPlanView } from "../lib/assistant/job-plan/types";
import type { AssistantActionState } from "../lib/assistant/types";

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

console.log("verify-performance-01e: starting…\n");

async function main(): Promise<void> {

const shell = read("components/assistant/AssistantShell.tsx");
const panel = read("components/assistant/clarify/ClarifyPanel.tsx");
const readinessUi = read("components/assistant/clarify/ClarifyReadiness.tsx");
const statusUi = read("components/assistant/clarify/GenerateEstimateStatus.tsx");
const composeSrc = read("lib/assistant/readiness/compose.ts");
const permissionSrc = read("lib/assistant/readiness/clarify-estimate.ts");
const generateSrc = read("lib/assistant/actions.ts");

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
const emptyPlan = { cards: [] } as unknown as JobPlanView;

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
const unanswered = composeEstimateReadiness({
  clarify: {
    ...emptyClarify,
    enoughToEstimate: false,
    canEstimateNow: false,
    remainingRequiredCount: 1,
  },
  jobPlan: emptyPlan,
  qualityLevel: "standard",
  constraints: [],
  pendingWrites: 0,
});

console.log("-- A. no pending writes — Generate works normally --");
check(
  "settled writes are EF02 Ready",
  settledReady.enoughToEstimate === true &&
    settledReady.canEstimateNow === true &&
    settledReady.canInitiateGenerate === true
);
check(
  "Generate CTA is shown when settled Ready",
  canShowGenerateCta({
    canInitiateGenerate: settledReady.canInitiateGenerate,
    enoughToEstimate: settledReady.enoughToEstimate,
  }) === true
);
check(
  "permission still requires pendingWrites === 0",
  permissionSrc.includes("pendingWrites === 0")
);

console.log("\n-- B. one pending final answer — initiate immediately, wait, then generate --");
check(
  "locally complete + pending write can initiate Generate",
  pendingReady.canInitiateGenerate === true &&
    pendingReady.enoughToEstimate === false
);
check(
  "CTA may be initiated while persistence is in flight",
  canShowGenerateCta({
    canInitiateGenerate: pendingReady.canInitiateGenerate,
    enoughToEstimate: pendingReady.enoughToEstimate,
  }) === true
);
check(
  "shell waits for pending writes instead of returning early",
  /pendingReadinessWrites > 0[\s\S]{0,400}waitAll/.test(shell) &&
    !/pendingReadinessWrites > 0\s*\)\s*\{[\s\S]{0,80}return;/.test(
      shell.slice(shell.indexOf("const handleGenerateEstimate"))
    )
);

console.log("\n-- C. several pending writes settle before generation --");
{
  const tracker = createPendingWriteTracker();
  const order: string[] = [];
  const slow = (label: string, ms: number, ok = true): Promise<AssistantActionState> =>
    new Promise((resolve) => {
      setTimeout(() => {
        order.push(label);
        resolve(ok ? { success: true } : { error: "Could not save." });
      }, ms);
    });
  tracker.trackAction(slow("a", 20));
  tracker.trackAction(slow("b", 40));
  tracker.trackAction(slow("c", 10));
  const settled = await tracker.waitAll();
  check(
    "waitAll waits until every in-flight write settles",
    order.sort().join("") === "abc" &&
      settled.pendingRemaining === 0 &&
      settled.failed === null
  );
}

console.log("\n-- D. parent answer reveals child — no generation --");
check(
  "readiness change after sync does not generate",
  decideGenerateAfterSync({
    writeFailed: false,
    pendingWritesRemaining: 0,
    permissionReady: false,
  }).generate === false &&
    decideGenerateAfterSync({
      writeFailed: false,
      pendingWritesRemaining: 0,
      permissionReady: false,
    }).reason === "readiness_changed"
);
check(
  "Generate re-evaluates permission after writes with pendingWrites: 0",
  shell.includes("waitAll") &&
    shell.includes("pendingWrites: 0") &&
    shell.includes("evaluateGenerateEstimatePermission") &&
    shell.includes("setGenerateReturnFocusId")
);

console.log("\n-- E. pending write fails — no generation, error, answers preserved --");
{
  const tracker = createPendingWriteTracker();
  tracker.trackAction(Promise.resolve({ error: "Could not save." }));
  const settled = await tracker.waitAll();
  const decision = decideGenerateAfterSync({
    writeFailed: Boolean(settled.failed),
    pendingWritesRemaining: settled.pendingRemaining,
    permissionReady: true,
  });
  check(
    "failed write blocks generation",
    decision.generate === false && decision.reason === "write_failed"
  );
  check(
    "shell surfaces a save error on write failure",
    shell.includes('presentAssistantError("save"') &&
      shell.includes("write_failed")
  );
}

console.log("\n-- F. double Generate — only one request --");
{
  const lock = createGenerateOnceLock();
  check("first acquire succeeds", lock.tryAcquire() === true);
  check("second acquire is rejected", lock.tryAcquire() === false);
  lock.release();
  check("retry acquire succeeds after release", lock.tryAcquire() === true);
}
check(
  "shell uses generate-once lock and isGenerating guard",
  shell.includes("generateLockRef") &&
    shell.includes("tryAcquire") &&
    /const handleGenerateEstimate = useCallback\(\(\) => \{[\s\S]{0,200}isGenerating/.test(
      shell
    )
);

console.log("\n-- G. generation fails — retry possible, answers preserved --");
check(
  "generation errors use generateNotice, not persistError CTA hide",
  shell.includes("setGenerateNotice") &&
    panel.includes("generateNotice") &&
    canShowGenerateCta({
      persistError: null,
      canInitiateGenerate: true,
      enoughToEstimate: true,
    }) === true
);
check(
  "save persistError still blocks initiation",
  canShowGenerateCta({
    persistError: "Could not save.",
    canInitiateGenerate: true,
    enoughToEstimate: false,
  }) === false
);
check(
  "Ready card still requires persist success",
  detailsReadyCardVisible({
    visibleGroupCount: 0,
    remaining: 0,
    viewEnoughToEstimate: true,
    readinessEnoughToEstimate: true,
    persistError: "Could not save",
  }) === false
);

console.log("\n-- H. fast generation — no excessive forced delay --");
check(
  "minimum display is 250–400ms",
  GENERATE_MIN_VISIBLE_MS >= 250 && GENERATE_MIN_VISIBLE_MS <= 400
);
check(
  "fast path only pads up to the minimum",
  remainingGenerateMinDisplayMs(40) > 0 &&
    remainingGenerateMinDisplayMs(40) <= 400 &&
    remainingGenerateMinDisplayMs(500) === 0
);
check(
  "shell applies remainingGenerateMinDisplayMs, not a multi-second pad",
  shell.includes("remainingGenerateMinDisplayMs") &&
    !shell.includes("delayMs(2000)") &&
    !shell.includes("delayMs(3000)")
);

console.log("\n-- I. pricing/estimate result is not duplicated --");
const generateFn = generateSrc.slice(
  generateSrc.indexOf("async function runEstimateGeneration"),
  generateSrc.indexOf("export async function generateStaticEstimate")
);
check(
  "server loads the generated estimate after persist, not before calculate",
  generateFn.includes("persistEstimateResult") &&
    generateFn.includes("loadEstimateGenerationResult(auth, projectId, { generationId })") &&
    generateFn.indexOf("persistEstimateResult") <
      generateFn.indexOf("loadEstimateGenerationResult(auth, projectId, { generationId })")
);
check(
  "successful generate still projects without router.refresh",
  shell.includes("shouldRefresh = false") &&
    /isEstimateMutation && !result.recoveryRefresh && generation/.test(shell)
);
check(
  "handleGenerateEstimate does not fetch estimate a second time",
  !/handleGenerateEstimate[\s\S]{0,2500}loadEstimateGenerationResult/.test(shell)
);

console.log("\n-- J. pendingReadinessWrites safety remains intact --");
check(
  "EF02 enoughToEstimate still requires pendingWrites === 0",
  composeSrc.includes("pendingWrites === 0") &&
    pendingReady.enoughToEstimate === false &&
    unanswered.canInitiateGenerate === false
);
check(
  "unanswered required questions cannot initiate Generate",
  canInitiateGenerateEstimate({
    viewEnoughToEstimate: false,
    blocksEstimate: false,
  }) === false && unanswered.canInitiateGenerate === false
);
check(
  "shell still increments/releases pendingReadinessWrites in finally",
  (shell.match(
    /finally \{\s*setClarifyWritePending\(false\);\s*setPendingReadinessWrites\(\(n\) => Math\.max\(0, n - 1\)\);\s*\}/g
  ) ?? []).length === 2
);
check(
  "generate permission after sync never skips the pending-write gate",
  decideGenerateAfterSync({
    writeFailed: false,
    pendingWritesRemaining: 1,
    permissionReady: true,
  }).generate === false
);

console.log("\n-- generating UX / a11y --");
check(
  "generating UI uses real stages only",
  statusUi.includes("aria-live") &&
    statusUi.includes('role="status"') &&
    generateStatusDetail({ stage: "saving", elapsedMs: 0 }) ===
      "Saving job details" &&
    generateStatusDetail({ stage: "readiness", elapsedMs: 0 }) ===
      "Checking estimate readiness" &&
    generateStatusDetail({ stage: "building", elapsedMs: 0 }) ===
      "Building your estimate"
);
check(
  "no fake percent / construction gimmick",
  !statusUi.includes("%") &&
    !statusUi.includes("hard hat") &&
    !panel.includes("percent")
);
check(
  "answers disable while generating",
  panel.includes("disabled={isGenerating}") &&
    panel.includes("if (isGenerating) return") &&
    readinessUi.includes("aria-busy")
);
check(
  "01C Saving indicators hide once Generate is primary",
  panel.includes("!isGenerating && (pendingIds.length > 0 || isSaving)") &&
    readinessUi.includes("isSaving && !isGenerating")
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log(`\nOK  ${passed} checks`);
}

void main();
