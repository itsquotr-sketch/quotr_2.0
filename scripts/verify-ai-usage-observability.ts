/**
 * INCIDENT-AI-ANALYSE-02 — AI usage observability verifier.
 * DEFAULT: NO REAL AI CALL. NO live provider.
 *
 * Run: npx tsx scripts/verify-ai-usage-observability.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  AI_USAGE_FORBIDDEN_COLUMNS,
  AI_USAGE_PERSISTED_COLUMNS,
  emptyTokenFields,
  mergeInvocations,
  sumTokenFields,
  tokensFromAnthropicUsage,
  type AiProviderInvocation,
} from "../lib/ai/usage-types";
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

console.log("verify-ai-usage-observability: starting (no live AI)…\n");

check("live AI opt-in is off by default", !shouldRunLiveAiTests());

const migration = read("supabase/migrations/039_ai_usage_events.sql");
const persist = read("lib/ai/usage-events.ts");
const types = read("lib/ai/usage-types.ts");
const actions = read("lib/assistant/actions.ts");
const notesActions = read("lib/project-notes/proposals/actions.ts");
const extract = read("lib/ai/extract.ts");
const notesExtract = read("lib/ai/extract-notes.ts");

check(
  "migration creates ai_usage_events",
  migration.includes("create table public.ai_usage_events")
);
check(
  "migration has required columns",
  [
    "org_id",
    "project_id",
    "feature",
    "provider",
    "model",
    "input_tokens",
    "output_tokens",
    "cache_creation_input_tokens",
    "cache_read_input_tokens",
    "latency_ms",
    "attempt_count",
    "success",
    "error_class",
    "created_at",
  ].every((col) => migration.includes(col))
);
check(
  "migration has no request/completion columns",
  !migration.includes("prompt ") &&
    !migration.includes("brief_text") &&
    !migration.includes("response_text") &&
    !migration.includes("api_key") &&
    !/create table[\s\S]*completion/.test(migration)
);
check("migration enables RLS", migration.includes("enable row level security"));
check(
  "migration org isolation uses auth_org_id",
  migration.includes("org_id = public.auth_org_id()") &&
    migration.includes("for select") &&
    migration.includes("for insert")
);
check(
  "migration has no update/delete policies for session role",
  !migration.includes("for update") && !migration.includes("for delete")
);
check(
  "migration grants authenticated select/insert only",
  migration.includes(
    "grant select, insert on public.ai_usage_events to authenticated"
  ) &&
    !/grant select, insert, update, delete on public.ai_usage_events to authenticated/.test(
      migration
    )
);

check(
  "persisted column contract matches types",
  AI_USAGE_PERSISTED_COLUMNS.includes("input_tokens") &&
    AI_USAGE_PERSISTED_COLUMNS.includes("attempt_count") &&
    AI_USAGE_PERSISTED_COLUMNS.includes("error_class")
);

check(
  "persist insert uses usage table and org_id",
  persist.includes('.from("ai_usage_events")') &&
    persist.includes("org_id: auth.orgId") &&
    persist.includes("project_id: projectId")
);
check(
  "persist insert has no forbidden fields",
  AI_USAGE_FORBIDDEN_COLUMNS.every((col) => !persist.includes(`${col}:`)) &&
    !persist.includes("prompt") &&
    !persist.includes("completion") &&
    !persist.includes("brief_text")
);
check(
  "persist failure cannot fail the mutation",
  persist.includes("must not fail") || persist.includes("Observability must never")
);

const sampleUsage = tokensFromAnthropicUsage({
  input_tokens: 10,
  output_tokens: 4,
  cache_creation_input_tokens: 1,
  cache_read_input_tokens: 2,
});
check(
  "token helper reads Anthropic usage fields",
  sampleUsage.inputTokens === 10 &&
    sampleUsage.outputTokens === 4 &&
    sampleUsage.cacheCreationInputTokens === 1 &&
    sampleUsage.cacheReadInputTokens === 2
);
check(
  "token helper does not invent absent fields",
  emptyTokenFields().inputTokens === null &&
    tokensFromAnthropicUsage({}).inputTokens === null
);

const first: AiProviderInvocation = {
  feature: "analyse_job",
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  latencyMs: 100,
  attemptCount: 1,
  success: false,
  errorClass: "provider_rate_limit",
  usage: { inputTokens: 5, outputTokens: 0, cacheCreationInputTokens: null, cacheReadInputTokens: null },
};
const second: AiProviderInvocation = {
  feature: "analyse_job",
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  latencyMs: 200,
  attemptCount: 1,
  success: true,
  errorClass: null,
  usage: { inputTokens: 8, outputTokens: 3, cacheCreationInputTokens: null, cacheReadInputTokens: null },
};
const merged = mergeInvocations("analyse_job", first, second);
check(
  "logical invocation sums billed tokens and attempts",
  merged.attemptCount === 2 &&
    merged.usage.inputTokens === 13 &&
    merged.usage.outputTokens === 3 &&
    merged.success === true &&
    merged.latencyMs === 300
);
check(
  "sumTokenFields treats null as zero when the other side is present",
  sumTokenFields(emptyTokenFields(), sampleUsage).inputTokens === 10
);

const saveFn = actions.slice(
  actions.indexOf("export async function saveBriefAndSeedWorkAreas"),
  actions.indexOf("export async function confirmWorkAreas")
);
check(
  "Analyse Job logs usage on success and failure",
  saveFn.includes("persistAiUsageEvent") &&
    saveFn.includes("extractionResult.invocation") &&
    saveFn.includes("getExtractionInvocation")
);
check(
  "Analyse Notes logs usage on success and failure",
  notesActions.includes("persistAiUsageEvent") &&
    notesActions.includes("extraction.invocation") &&
    notesActions.includes("getAttachedInvocation")
);
check(
  "Analyse Job feature name is analyse_job",
  extract.includes('feature: "analyse_job"')
);
check(
  "Analyse Notes feature name is analyse_notes",
  notesExtract.includes('feature: "analyse_notes"')
);
check(
  "types module has no request/completion fields",
  !types.includes("prompt:") &&
    !types.includes("completion:") &&
    !types.includes("brief:")
);

console.log(`\nAI-USAGE-OBSERVABILITY RESULT: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
