/**
 * INCIDENT-AI-ANALYSE-01 — Analyse Job flow verifier.
 * DEFAULT: NO REAL AI CALL.
 *
 * Run: npx tsx scripts/verify-analyse-job-flow.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { AIExtractionError } from "../lib/ai/schema";
import {
  ANALYSE_JOB_TIMEOUT_MS,
  ANALYSE_JOB_TIMEOUT_USER_MESSAGE,
  ANALYSE_JOB_PROVIDER,
  AI_PARSE_ERROR,
  isTimeoutOrAbortError,
  userMessageForAnalysisError,
} from "../lib/ai/analyse-job-contract";
import { buildBriefExtractionFromModelText } from "../lib/ai/brief-extraction-result";
import { aiFactsToRows, aiWorkAreasToRows } from "../lib/ai/mappers";
import { SCOPE_CATALOGUE } from "../lib/scopes/catalogue";
import { reportTokenUsage } from "../lib/ai/usage-estimate";
import { shouldRunLiveAiTests } from "../lib/ai/live-ai-tests";

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

console.log("verify-analyse-job-flow: starting (no live AI)…\n");

check("live AI opt-in is off by default", !shouldRunLiveAiTests());

const actions = read("lib/assistant/actions.ts");
const extract = read("lib/ai/extract.ts");
const shell = read("components/assistant/AssistantShell.tsx");
const capture = read("components/assistant/ProjectCaptureBlock.tsx");
const anthropic = read("lib/ai/anthropic.ts");
const retry = read("lib/ai/retry.ts");
const notesUi = read("components/project-notes/AnalyseNotesSection.tsx");

const saveFn = actions.slice(
  actions.indexOf("export async function saveBriefAndSeedWorkAreas"),
  actions.indexOf("export async function confirmWorkAreas")
);

check("1 UI label Analyse job", capture.includes("Analyse job"));
check(
  "1 handleAnalyseJob calls saveBriefAndSeedWorkAreas",
  shell.includes("handleAnalyseJob") &&
    /saveBriefAndSeedWorkAreas\(project\.id, briefText\)/.test(shell)
);
check(
  "1 loading is pendingAction brief",
  shell.includes('isAnalysing={pendingAction === "brief"}')
);

check(
  "4 server entry is saveBriefAndSeedWorkAreas",
  saveFn.includes("extractFromBrief") && saveFn.includes("loadProjectStage")
);
check(
  "4 auth via loadProjectStage",
  saveFn.includes("loadProjectStage(projectId)")
);

check(
  "5 provider is Anthropic only",
  ANALYSE_JOB_PROVIDER === "anthropic" &&
    extract.includes("createAnthropicMessage") &&
    !extract.toLowerCase().includes("openai") &&
    !extract.toLowerCase().includes("gemini")
);

check(
  "9 timeout is 45s",
  ANALYSE_JOB_TIMEOUT_MS === 45_000 &&
    extract.includes("ANALYSE_JOB_TIMEOUT_MS") &&
    anthropic.includes("maxRetries: 0")
);
check(
  "9 retries do not retry timeout",
  retry.includes("isTimeoutOrAbortError") &&
    retry.includes("return false")
);

const allowed = SCOPE_CATALOGUE.map((item) => item.type);
const catalogueByType = new Map(SCOPE_CATALOGUE.map((item) => [item.type, item]));
const brief = "Build a 5m by 4m hardwood deck.";
const fixtureJson = JSON.stringify({
  workAreas: [
    { type: "deck", confidence: 0.9, rationale: "Brief describes a deck." },
  ],
  facts: [
    {
      work_area_type: "deck",
      key: "deck.length_m",
      label: "Length",
      value: 5,
      unit: "m",
      confidence: 0.9,
    },
    {
      work_area_type: "deck",
      key: "deck.width_m",
      label: "Width",
      value: 4,
      unit: "m",
      confidence: 0.9,
    },
  ],
  assumptions: [],
  possibleConstraints: [],
  confidence: 0.9,
  warnings: [],
});

const built = buildBriefExtractionFromModelText({
  rawText: fixtureJson,
  briefText: brief,
  allowedTypes: allowed,
  catalogueTypes: allowed,
});

check("2 fixture emits deck WA", built.output.workAreas.some((wa) => wa.type === "deck"));
check(
  "2 fixture emits length/width facts",
  built.output.facts.some((f) => f.key === "deck.length_m" && f.value === 5) &&
    built.output.facts.some((f) => f.key === "deck.width_m" && f.value === 4)
);

const waRows = aiWorkAreasToRows({
  output: built.output,
  orgId: "org-1",
  projectId: "proj-1",
  catalogueByType,
});
const factRows = aiFactsToRows({
  output: built.output,
  orgId: "org-1",
  projectId: "proj-1",
  workAreaIdByType: new Map([["deck", "wa-deck"]]),
});

check("2 mapped WA rows are suggested", waRows.every((row) => row.status === "suggested"));
check("2 mapped facts are ai_extracted", factRows.every((row) => row.source === "ai_extracted"));
check(
  "3 stage update is confirm_work_areas",
  saveFn.includes('stage: "confirm_work_areas"')
);
check(
  "4 client response uses completeAssistantMutation",
  saveFn.includes("completeAssistantMutation(auth, projectId)")
);
check(
  "5 loading clears on success and error",
  /if \(result\.error\)[\s\S]*setPendingAction\(null\)/.test(shell) &&
    /setPendingAction\(null\);[\s\S]*} catch/.test(shell)
);
check(
  "6 catch always clears pendingAction",
  /} catch \{[\s\S]*setPendingAction\(null\)/.test(shell)
);
check(
  "6 provider error maps to handled action error",
  saveFn.includes("userMessageForAnalysisError") &&
    saveFn.includes("return { error: userMessageForAnalysisError(error) }")
);

let schemaThrew = false;
try {
  buildBriefExtractionFromModelText({
    rawText: "not json at all",
    briefText: brief,
    allowedTypes: allowed,
    catalogueTypes: allowed,
  });
} catch (error) {
  schemaThrew = error instanceof AIExtractionError;
}
check("7 schema-invalid / malformed JSON throws AIExtractionError", schemaThrew);
check(
  "7 parse maps to user-safe error",
  userMessageForAnalysisError(
    new AIExtractionError("Failed to parse AI response as JSON. Preview: abc")
  ) === AI_PARSE_ERROR
);

const timeoutErr = new Error("The operation was aborted due to timeout");
timeoutErr.name = "TimeoutError";
check("8 timeout detected", isTimeoutOrAbortError(timeoutErr));
check(
  "8 timeout user message",
  userMessageForAnalysisError(timeoutErr) === ANALYSE_JOB_TIMEOUT_USER_MESSAGE &&
    shell.includes("ANALYSE_JOB_TIMEOUT_USER_MESSAGE")
);

check(
  "9 no Estimate generation in Analyse Job",
  !saveFn.includes("calculateEstimate") &&
    !saveFn.includes("persistEstimateResult") &&
    !saveFn.includes("persist_estimate_generation")
);
check(
  "10 no Pricing/Quote in Analyse Job",
  !saveFn.includes("lib/pricing") && !saveFn.includes("lib/quotes")
);
check(
  "11 cross-org denied via loadProjectStage / ownership",
  saveFn.includes("loadProjectStage") &&
    read("lib/assistant/load-project-stage.ts").includes("assertOrgOwnsActiveProject")
);

check(
  "notes UI also clears loading in finally",
  notesUi.includes("finally") && notesUi.includes("setIsAnalysing(false)")
);

const usage = reportTokenUsage({
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  inputTokens: 1000,
  outputTokens: 200,
});
check("usage helper does not invent USD", usage.estimatedUsd === null);
check("usage helper totals tokens", usage.totalTokens === 1200);

console.log(`\nANALYSE-JOB-FLOW RESULT: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
