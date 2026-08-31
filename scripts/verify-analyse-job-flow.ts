/**
 * INCIDENT-AI-ANALYSE-01 — Analyse Job flow verifier.
 * DEFAULT: NO REAL AI CALL.
 *
 * Run: npx tsx scripts/verify-analyse-job-flow.ts
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { AIExtractionError } from "../lib/ai/schema";
import {
  ANALYSE_JOB_ACTION_MAX_DURATION_SECONDS,
  ANALYSE_JOB_PROVIDER_TIMEOUT_MS,
  ANALYSE_JOB_RETRY_MIN_REMAINING_MS,
  ANALYSE_JOB_TIMEOUT_MS,
  ANALYSE_JOB_TIMEOUT_USER_MESSAGE,
  ANALYSE_JOB_PROVIDER,
  AI_PARSE_ERROR,
  AI_SETUP_ERROR,
  UNKNOWN_ANALYSIS_ERROR,
  classifyAnalysisError,
  isTimeoutOrAbortError,
  userMessageForAnalysisError,
} from "../lib/ai/analyse-job-contract";
import { isRetryableAnthropicError } from "../lib/ai/retry";
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
const page = read("app/(protected)/app/projects/[projectId]/page.tsx");
const usageEvents = read("lib/ai/usage-events.ts");
const notesExtract = read("lib/ai/extract-notes.ts");
const notesActions = read("lib/project-notes/proposals/actions.ts");

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
  "9 provider timeout is 75s not whole-action",
  ANALYSE_JOB_PROVIDER_TIMEOUT_MS === 75_000 &&
    ANALYSE_JOB_TIMEOUT_MS === 75_000 &&
    extract.includes("ANALYSE_JOB_TIMEOUT_MS") &&
    anthropic.includes("maxRetries: 0") &&
    anthropic.includes("ANALYSE_JOB_PROVIDER_TIMEOUT_MS")
);
check(
  "9 action maxDuration is 120s on project page",
  ANALYSE_JOB_ACTION_MAX_DURATION_SECONDS === 120 &&
    /export const maxDuration = 120/.test(page)
);
check(
  "9 retries do not retry timeout",
  retry.includes("isTimeoutOrAbortError") &&
    retry.includes("return false")
);
check(
  "9 retry requires remaining budget",
  ANALYSE_JOB_RETRY_MIN_REMAINING_MS === 8_000 &&
    anthropic.includes("ANALYSE_JOB_RETRY_MIN_REMAINING_MS") &&
    anthropic.includes("attemptCount > 1")
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
  "8 timeout user message is for real timeout only",
  userMessageForAnalysisError(timeoutErr) === ANALYSE_JOB_TIMEOUT_USER_MESSAGE
);
check(
  "8 client catch is not always timeout",
  shell.includes("UNKNOWN_ANALYSIS_ERROR") &&
    !/action === "brief"[\s\S]{0,80}ANALYSE_JOB_TIMEOUT_USER_MESSAGE/.test(shell)
);
check(
  "8 substring timeout is not classified as timeout",
  !isTimeoutOrAbortError(new Error("timeout configuration is invalid")) &&
    classifyAnalysisError(new Error("timeout configuration is invalid")) ===
      "unknown"
);
check(
  "8 provider 400 is invalid not timeout",
  classifyAnalysisError({ status: 400, message: "invalid model" }) ===
    "provider_invalid" &&
    userMessageForAnalysisError({ status: 400 }) === AI_SETUP_ERROR &&
    userMessageForAnalysisError({ status: 400 }) !==
      ANALYSE_JOB_TIMEOUT_USER_MESSAGE
);
check(
  "8 provider 401/403 are auth",
  classifyAnalysisError({ status: 401 }) === "provider_auth" &&
    classifyAnalysisError({ status: 403 }) === "provider_auth"
);
check(
  "8 provider 429 is rate limit and retryable",
  classifyAnalysisError({ status: 429 }) === "provider_rate_limit" &&
    isRetryableAnthropicError({ status: 429 })
);
check(
  "8 provider 500 is server and retryable",
  classifyAnalysisError({ status: 500 }) === "provider_server" &&
    isRetryableAnthropicError({ status: 500 })
);
check(
  "8 400/401/403 are not retryable",
  !isRetryableAnthropicError({ status: 400 }) &&
    !isRetryableAnthropicError({ status: 401 }) &&
    !isRetryableAnthropicError({ status: 403 })
);
check(
  "8 parse error is not timeout",
  userMessageForAnalysisError(
    new AIExtractionError("Failed to parse AI response as JSON. Preview: abc")
  ) === AI_PARSE_ERROR
);
check(
  "8 unknown client fallback exists",
  UNKNOWN_ANALYSIS_ERROR.length > 0
);
check(
  "8 notes UI catch is not timeout string",
  !notesUi.includes(ANALYSE_JOB_TIMEOUT_USER_MESSAGE)
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

check(
  "12 one Anthropic call in extractFromBrief",
  (extract.match(/await createAnthropicMessage/g) ?? []).length === 1 &&
    !extract.includes("isRepair") &&
    !saveFn.includes("createAnthropicScopeDiscoveryTransport")
);

check(
  "13 malformed JSON is local parse only in Analyse Job",
  read("lib/ai/brief-extraction-result.ts").includes("parseJsonObject") &&
    !extract.toLowerCase().includes("repair")
);

check(
  "29 Analyse Job persists usage event",
  saveFn.includes("persistAiUsageEvent") &&
    extract.includes("invocation") &&
    usageEvents.includes("ai_usage_events") &&
    !usageEvents.includes("prompt") &&
    !usageEvents.includes("completion")
);

check(
  "32 Analyse Notes persists usage and shares provider timeout",
  notesExtract.includes("ANALYSE_JOB_TIMEOUT_MS") &&
    notesExtract.includes("invocation") &&
    notesActions.includes("persistAiUsageEvent")
);

const usage = reportTokenUsage({
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  inputTokens: 1000,
  outputTokens: 200,
});
check("usage helper does not invent USD", usage.estimatedUsd === null);
check("usage helper totals tokens", usage.totalTokens === 1200);

check(
  "03 Analyse Job does not run Speed 2 derived reconciliation",
  !saveFn.includes("persistDerivedFactsForProject")
);
check(
  "03 telemetry insert is best-effort try/catch",
  usageEvents.includes("try {") &&
    usageEvents.includes("Observability must never") &&
    usageEvents.includes("from(\"ai_usage_events\")")
);
check(
  "03 canonical load failure is recovery not throw",
  read("lib/assistant/complete-assistant-mutation.ts").includes(
    "recoveryRefresh: true"
  )
);

function listUseServerFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listUseServerFiles(full));
      continue;
    }
    if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".tsx")) continue;
    const src = readFileSync(full, "utf8");
    if (src.startsWith('"use server"') || src.startsWith("'use server'")) {
      out.push(full.slice(root.length + 1).replaceAll("\\", "/"));
    }
  }
  return out;
}

const useServerFiles = [
  ...listUseServerFiles(join(root, "lib")),
  ...listUseServerFiles(join(root, "app")),
];
/** Proven Next/Turbopack crash: type-only re-export becomes a runtime server-action binding. */
function hasTypeOnlyReexport(src: string): boolean {
  return /export type \{/.test(src) || /export \{[\s\S]*?\btype\s+\w/.test(src);
}
const typeReexports = useServerFiles.filter((file) =>
  hasTypeOnlyReexport(read(file))
);
check(
  "03 use-server modules do not re-export types (Next/Turbopack ReferenceError)",
  typeReexports.length === 0,
  typeReexports.join(", ")
);
check(
  "03 notes actions imported by capture card is a use-server module",
  useServerFiles.includes("lib/project-notes/actions.ts")
);
check(
  "03 ProjectNoteListResult remains on non-server-action note-loaders",
  read("lib/project-notes/note-loaders.ts").includes(
    "export type ProjectNoteListResult"
  ) && !read("lib/project-notes/note-loaders.ts").startsWith('"use server"')
);

try {
  execFileSync("npx", ["tsx", "scripts/verify-analyse-job-fresh-project.ts"], {
    cwd: root,
    stdio: "inherit",
    timeout: 60_000,
    shell: process.platform === "win32",
    env: { ...process.env, RUN_LIVE_AI_TESTS: undefined },
  });
  check("03 fresh-project / failure-phase harness", true);
} catch {
  check("03 fresh-project / failure-phase harness", false);
}

console.log(`\nANALYSE-JOB-FLOW RESULT: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
