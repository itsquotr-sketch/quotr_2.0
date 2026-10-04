/**
 * Details → Create estimate handoff.
 *
 * Local completion shows the action immediately. A press during a save
 * is recorded once, then generation uses the existing readiness path.
 * A failed save does not generate.
 *
 * Run: npx --yes tsx scripts/verify-estimate-handoff.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  clarifyGenerateIntentAction,
  clarifyQueuedGenerateAction,
  localAnswersCompleteForGenerate,
} from "../lib/assistant/clarify/interaction";
import {
  createGenerateOnceLock,
  decideGenerateAfterSync,
} from "../lib/assistant/clarify/generate-sync";
import type { ClarifyCandidate } from "../lib/assistant/clarify/types";

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

function candidate(id: string): ClarifyCandidate {
  return {
    id,
    source: "scope_fact",
    workAreaId: "wa",
    workAreaName: "Deck",
    workAreaType: "deck",
    factKey: "deck.height_m",
    constraintKey: null,
    questionKey: id,
    label: "Height",
    question: "How high is the deck?",
    askClass: "ASK_NOW",
    inputType: "select",
    writeTarget: "FACT",
    write: null,
    blocksEstimate: true,
    assumable: false,
    rankScore: 1,
    rankReason: "required",
    assumptionStatement: null,
  };
}

const last = candidate("height");

console.log("verify-estimate-handoff\n");

check(
  "1 waiting after the final answer keeps Create estimate available",
  localAnswersCompleteForGenerate({
    remainingRequiredCount: 1,
    candidates: [last],
    resolvedIds: new Set(),
    heldPendingId: "height",
    heldValue: "1m",
    blocksEstimate: false,
    persistError: null,
  }) === true
);

check(
  "a stale blocked view does not hide a locally complete answer",
  localAnswersCompleteForGenerate({
    remainingRequiredCount: 1,
    candidates: [last],
    resolvedIds: new Set(),
    heldPendingId: "height",
    heldValue: "1m",
    blocksEstimate: true,
    persistError: null,
  }) === true
);

check(
  "incomplete required answers are not locally complete",
  localAnswersCompleteForGenerate({
    remainingRequiredCount: 2,
    candidates: [last, candidate("width")],
    resolvedIds: new Set(),
    heldPendingId: "height",
    heldValue: "1m",
    blocksEstimate: false,
    persistError: null,
  }) === false
);

const queued = clarifyGenerateIntentAction({
  savesPending: true,
  alreadyQueued: false,
  alreadyGenerating: false,
  persistError: false,
});
const secondPress = clarifyGenerateIntentAction({
  savesPending: true,
  alreadyQueued: true,
  alreadyGenerating: false,
  persistError: false,
});
check("2 press during a pending save queues once", queued === "queue");
check("5 a second press is ignored", secondPress === "ignore");

async function slowSaveThenGenerate(): Promise<void> {
  let savesPending = true;
  let intentQueued = false;
  let generateCalls = 0;
  const started = clarifyGenerateIntentAction({
    savesPending,
    alreadyQueued: intentQueued,
    alreadyGenerating: false,
    persistError: false,
  });
  if (started === "queue") intentQueued = true;
  await new Promise((resolve) => setTimeout(resolve, 40));
  const whileSaving = clarifyQueuedGenerateAction({
    intentQueued,
    savesPending,
    persistError: false,
    localAnswersComplete: true,
  });
  savesPending = false;
  const afterSave = clarifyQueuedGenerateAction({
    intentQueued,
    savesPending,
    persistError: false,
    localAnswersComplete: true,
  });
  if (afterSave === "generate") {
    intentQueued = false;
    generateCalls += 1;
  }
  const again = clarifyQueuedGenerateAction({
    intentQueued,
    savesPending,
    persistError: false,
    localAnswersComplete: true,
  });
  check("3 a slowed save waits, then generates once", whileSaving === "wait" && generateCalls === 1 && again === "wait");
}

void slowSaveThenGenerate().then(() => {

check(
  "4 a failed save does not generate",
  clarifyQueuedGenerateAction({
    intentQueued: true,
    savesPending: false,
    persistError: true,
    localAnswersComplete: false,
  }) === "cancel" &&
    decideGenerateAfterSync({
      writeFailed: true,
      pendingWritesRemaining: 0,
      permissionReady: true,
    }).generate === false
);

const lock = createGenerateOnceLock();
check(
  "5 one generation lock",
  lock.tryAcquire() === true && lock.tryAcquire() === false
);

check(
  "6 a later answer is not generated while an earlier save is still pending",
  clarifyQueuedGenerateAction({
    intentQueued: true,
    savesPending: true,
    persistError: false,
    localAnswersComplete: true,
  }) === "wait" &&
    decideGenerateAfterSync({
      writeFailed: false,
      pendingWritesRemaining: 1,
      permissionReady: true,
    }).reason === "pending_writes"
);

check(
  "unsaved answers are not a generate decision",
  decideGenerateAfterSync({
    writeFailed: false,
    pendingWritesRemaining: 1,
    permissionReady: true,
  }).generate === false &&
    clarifyGenerateIntentAction({
      savesPending: false,
      alreadyQueued: false,
      alreadyGenerating: false,
      persistError: true,
    }) === "ignore"
);

const panel = readFileSync(
  resolve(root, "components/assistant/clarify/ClarifyPanel.tsx"),
  "utf8"
);
const shell = readFileSync(
  resolve(root, "components/assistant/AssistantShell.tsx"),
  "utf8"
);
const labels = readFileSync(
  resolve(root, "lib/assistant/presentation/action-labels.ts"),
  "utf8"
);

check(
  "panel shows Create estimate from local completion and queues one press",
  panel.includes("localAnswersCompleteForGenerate") &&
    panel.includes("clarifyGenerateIntentAction") &&
    panel.includes("clarifyQueuedGenerateAction") &&
    panel.includes("data-clarify-primary-cta") &&
    panel.includes("finishingAnswers")
);
check(
  "one save status, no second saving sentence",
  labels.includes('savingAnswer: "Saving answer…"') &&
    labels.includes('finishingAnswers: "Finishing answers…"') &&
    panel.includes("savingAnswer") &&
    !panel.includes("Saving the last answer") &&
    !panel.includes("SaveStatusIndicator") &&
    !panel.includes("Loader2")
);
check(
  "generation still waits, revalidates, and locks",
  shell.includes("decideGenerateAfterSync") &&
    shell.includes("evaluateGenerateEstimatePermission") &&
    shell.includes("pendingWriteTrackerRef.current.waitAll()") &&
    shell.includes("generateLockRef.current.tryAcquire()") &&
    !panel.includes("generateStaticEstimate")
);
check(
  "leaving the panel does not generate from an effect cleanup",
  !panel.includes("return () => {\n    onEstimateNow") &&
    !panel.includes("return () => onEstimateNow")
);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
});
