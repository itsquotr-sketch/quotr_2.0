/**
 * INCIDENT-AI-ANALYSE-01 — AI call boundary verifier.
 * NO REAL AI CALLS.
 *
 * Run: npx tsx scripts/verify-ai-call-boundaries.ts
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { RUN_LIVE_AI_TESTS_ENV, shouldRunLiveAiTests } from "../lib/ai/live-ai-tests";

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
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function listScripts(): string[] {
  return readdirSync(join(root, "scripts"))
    .filter((name) => name.endsWith(".ts"))
    .map((name) => `scripts/${name}`);
}

console.log("verify-ai-call-boundaries: starting (no live AI)…\n");

check("default does not enable live AI tests", !shouldRunLiveAiTests({}));
check(
  "opt-in token is RUN_LIVE_AI_TESTS=1",
  RUN_LIVE_AI_TESTS_ENV === "RUN_LIVE_AI_TESTS" &&
    shouldRunLiveAiTests({ RUN_LIVE_AI_TESTS: "1" }) &&
    !shouldRunLiveAiTests({ RUN_LIVE_AI_TESTS: "true" })
);

const liveScripts = [
  "scripts/verify-fact-coverage.ts",
  "scripts/verify-outdoor-ai-extraction.ts",
  "scripts/verify-internal-ai-extraction.ts",
];

for (const script of liveScripts) {
  const src = read(script);
  check(
    `${script} requires RUN_LIVE_AI_TESTS`,
    src.includes("shouldRunLiveAiTests") && src.includes("logLiveAiSkip")
  );
  check(
    `${script} can make paid Anthropic calls when opted in`,
    src.includes("@anthropic-ai/sdk") && src.includes("messages.create")
  );
}

const allScripts = listScripts();
const paidWithoutGate: string[] = [];
for (const script of allScripts) {
  if (liveScripts.includes(script)) continue;
  if (script === "scripts/verify-ai-call-boundaries.ts") continue;
  if (script === "scripts/report-ai-usage.ts") continue;
  if (script === "scripts/diagnose-analyse-job-once.ts") continue;
  const src = read(script);
  const makesPaidCall =
    src.includes("@anthropic-ai/sdk") &&
    (src.includes("messages.create") || src.includes("new Anthropic"));
  if (makesPaidCall && !src.includes("shouldRunLiveAiTests")) {
    paidWithoutGate.push(script);
  }
}
check(
  "no other scripts make ungated Anthropic SDK calls",
  paidWithoutGate.length === 0,
  paidWithoutGate.join(", ")
);

const masters = [
  "scripts/verify-system-performance-speed-2.ts",
  "scripts/verify-system-performance-speed-1b-b.ts",
  "scripts/verify-system-performance-speed-1b-a.ts",
  "scripts/verify-system-performance-speed-1a.ts",
  "scripts/verify-system-performance-speed-0.ts",
];
for (const script of masters) {
  const src = read(script);
  check(
    `${script} has no Anthropic SDK import`,
    !src.includes("@anthropic-ai/sdk") && !src.includes("messages.create")
  );
}

const fenceFamily = read("scripts/verify-fence-family-final-closure.ts");
check(
  "Fence family still spawns fact-coverage (now gated by child skip)",
  fenceFamily.includes("verify-fact-coverage.ts")
);

const extract = read("lib/ai/extract.ts");
const notes = read("lib/ai/extract-notes.ts");
const discovery = read("lib/scope-discovery/provider/anthropic-provider.ts");
const anthropic = read("lib/ai/anthropic.ts");

check(
  "Analyse Job declares Anthropic + model helper",
  extract.includes("getAnthropicModel") &&
    extract.includes("createAnthropicMessage") &&
    anthropic.includes('process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6"')
);
check(
  "Analyse Notes declares Anthropic",
  notes.includes("createAnthropicMessage")
);
check(
  "Scope discovery transport declares Anthropic (gated feature)",
  discovery.includes("createAnthropicMessage")
);

const openaiLib = read("lib/ai/extract.ts") + read("lib/ai/extract-notes.ts") + anthropic;
check(
  "no OpenAI SDK in Analyse Job / notes / client helper",
  !/from ["']openai["']/.test(openaiLib) && !openaiLib.includes("OPENAI_API_KEY")
);

const libFiles = [
  "lib/ai/extract.ts",
  "lib/ai/extract-notes.ts",
  "lib/ai/anthropic.ts",
  "lib/scope-discovery/provider/anthropic-provider.ts",
];
for (const file of libFiles) {
  const src = read(file);
  check(
    `${file} has no Gemini/Google generative SDK`,
    !src.toLowerCase().includes("gemini") &&
      !src.includes("@google/generative") &&
      !src.includes("GOOGLE_GENERATIVE_AI_API_KEY")
  );
}

const diagnose = read("scripts/diagnose-analyse-job-once.ts");
check(
  "diagnose script is one-shot and gated by DIAGNOSE_ANALYSE_JOB=1",
  diagnose.includes("DIAGNOSE_ANALYSE_JOB") &&
    diagnose.includes('!== "1"') &&
    diagnose.includes("--live") &&
    !diagnose.includes("shouldRunLiveAiTests")
);
check(
  "diagnose script is not the live regression master",
  !diagnose.includes("verify-fact-coverage") &&
    !diagnose.includes("verify-outdoor-ai") &&
    !diagnose.includes("verify-internal-ai")
);
check(
  ".env.local.example documents RUN_LIVE_AI_TESTS",
  read(".env.local.example").includes("RUN_LIVE_AI_TESTS")
);

console.log(`\nAI-CALL-BOUNDARIES RESULT: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
