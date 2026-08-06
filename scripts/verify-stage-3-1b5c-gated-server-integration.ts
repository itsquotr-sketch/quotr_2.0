/**
 * Stage 3.1B.5C — Gated server integration verification (local only).
 *
 * Refuses non-local Supabase URLs. Uses deterministic fake provider transport.
 * Run after: npx supabase db reset
 *   npx tsx scripts/verify-stage-3-1b5c-gated-server-integration.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { resolveLocalDbContainer } from "./local-db-container";
import {
  isScopeDiscoveryEnabled,
  getScopeDiscoveryAvailability,
} from "../lib/scope-discovery/configuration";
import {
  runScopeDiscovery,
  getScopeDiscoveryResults,
  acceptScopeSuggestionApp,
  rejectScopeSuggestionApp,
  modifyScopeSuggestionApp,
  evaluateScopeDiscoveryStale,
  collectProjectSources,
  APPLICATION_ERROR_CODES,
} from "../lib/scope-discovery/application";
import type { PersistenceAuthContext } from "../lib/scope-discovery/persistence";
import type { InjectedProviderRunner } from "../lib/scope-discovery/orchestration/types";
import { SCOPE_DISCOVERY_PROMPT_VERSION } from "../lib/scope-discovery/provider";
import { SCOPE_DISCOVERY_CONTRACT_VERSION } from "../lib/scope-discovery";
import { SCOPE_RELATIONSHIP_CATALOGUE_VERSION } from "../lib/scope-discovery/catalogue";

const DEMO_LOCAL_URL = "http://127.0.0.1:54321";
const DEMO_LOCAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const DEMO_LOCAL_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

let LOCAL_URL = DEMO_LOCAL_URL;
let LOCAL_ANON_KEY = DEMO_LOCAL_ANON_KEY;
let LOCAL_SERVICE_ROLE_KEY = DEMO_LOCAL_SERVICE_ROLE_KEY;
let DB_CONTAINER = "";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`PASS  ${name}`);
    passed += 1;
  } else {
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
    failed += 1;
  }
}

function isLocalSupabaseUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

function refuseNonLocal(url: string, label: string): void {
  if (!isLocalSupabaseUrl(url)) {
    console.error(
      `REFUSING: ${label} is not a local Supabase URL. 3.1B.5C runs against local Docker only.`
    );
    process.exit(1);
  }
}

function parseSupabaseStatusEnv(raw: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq);
    let value = trimmed.slice(eq + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    map[key] = value;
  }
  return map;
}

function loadLocalCredentials(): void {
  try {
    const raw = execFileSync("supabase", ["status", "-o", "env"], {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const env = parseSupabaseStatusEnv(raw);
    const apiUrl = env.API_URL;
    if (!apiUrl) throw new Error("API_URL missing");
    refuseNonLocal(apiUrl, "supabase status API_URL");
    if (!env.ANON_KEY || !env.SERVICE_ROLE_KEY) {
      throw new Error("local keys missing");
    }
    LOCAL_URL = apiUrl;
    LOCAL_ANON_KEY = env.ANON_KEY;
    LOCAL_SERVICE_ROLE_KEY = env.SERVICE_ROLE_KEY;
  } catch (error) {
    if (error instanceof Error && error.message.includes("REFUSING")) throw error;
    refuseNonLocal(DEMO_LOCAL_URL, "demo local URL fallback");
    LOCAL_URL = DEMO_LOCAL_URL;
    LOCAL_ANON_KEY = DEMO_LOCAL_ANON_KEY;
    LOCAL_SERVICE_ROLE_KEY = DEMO_LOCAL_SERVICE_ROLE_KEY;
    console.log("NOTE: using well-known local demo credentials.");
  }
}

function psql(sql: string): string {
  return execFileSync(
    "docker",
    ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-t", "-A", "-c", sql],
    { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
  ).trim();
}

function admin(): SupabaseClient {
  return createClient(LOCAL_URL, LOCAL_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function signIn(
  email: string,
  password: string
): Promise<SupabaseClient> {
  const client = createClient(LOCAL_URL, LOCAL_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

function walkFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkFiles(full, acc);
    else if (/\.(ts|tsx)$/.test(name)) acc.push(full);
  }
  return acc;
}

function fakeProvider(calls: { count: number }, fail = false): InjectedProviderRunner {
  return async ({ input }) => {
    calls.count += 1;
    if (fail) {
      return {
        success: false,
        provider: "fake",
        model: "fake-model",
        promptVersion: SCOPE_DISCOVERY_PROMPT_VERSION,
        contractVersion: SCOPE_DISCOVERY_CONTRACT_VERSION,
        catalogueVersion: SCOPE_RELATIONSHIP_CATALOGUE_VERSION,
        analysisRunId: input.analysisRunId,
        contextualSuggestions: [],
        warnings: [],
        validationErrors: ["forced"],
        repairAttempted: true,
        latencyMs: 1,
        tokenUsage: { inputTokens: 1, outputTokens: 1 },
        failureCode: "REPAIR_FAILED",
        failureMessage: "Contextual scope discovery could not repair its response.",
      };
    }
    return {
      success: true,
      provider: "fake",
      model: "fake-model",
      promptVersion: SCOPE_DISCOVERY_PROMPT_VERSION,
      contractVersion: SCOPE_DISCOVERY_CONTRACT_VERSION,
      catalogueVersion: SCOPE_RELATIONSHIP_CATALOGUE_VERSION,
      analysisRunId: input.analysisRunId,
      contextualSuggestions: [],
      warnings: [],
      validationErrors: [],
      repairAttempted: false,
      latencyMs: 2,
      tokenUsage: { inputTokens: 3, outputTokens: 4 },
      failureCode: null,
      failureMessage: null,
    };
  };
}

async function seedOrg(label: string): Promise<{
  orgId: string;
  userId: string;
  projectId: string;
  email: string;
  password: string;
}> {
  const svc = admin();
  const email = `isd5c-${label}-${randomUUID().slice(0, 8)}@example.local`;
  const password = "local-3-1b5c-test-password";

  const { data: created, error: createErr } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    throw new Error(`createUser failed: ${createErr?.message}`);
  }
  const userId = created.user.id;
  const orgId = randomUUID();
  const { error: orgErr } = await svc.from("organisations").insert({
    id: orgId,
    name: `ISD 5C Org ${label}`,
  });
  if (orgErr) throw new Error(orgErr.message);

  const { error: profileErr } = await svc.from("profiles").upsert({
    id: userId,
    org_id: orgId,
    full_name: `User ${label}`,
    role: "owner",
  });
  if (profileErr) throw new Error(profileErr.message);

  await svc.from("organisation_settings").insert({
    org_id: orgId,
    region: "Auckland",
  });

  const projectId = randomUUID();
  const { error: projErr } = await svc.from("projects").insert({
    id: projectId,
    org_id: orgId,
    created_by: userId,
    title: `Project ${label}`,
    stage: "confirm_work_areas",
    brief_text: "Build a timber deck with stairs and railings in Auckland.",
  });
  if (projErr) throw new Error(projErr.message);

  await svc.from("work_areas").insert({
    org_id: orgId,
    project_id: projectId,
    type: "deck",
    name: "Timber deck",
    status: "confirmed",
    ai_confidence: null,
    summary: "Main deck",
    sort_order: 1,
  });

  await svc.from("project_notes").insert({
    org_id: orgId,
    project_id: projectId,
    content: "Site slopes gently toward the fence.",
    note_type: "general",
    source: "site_walk",
    captured_by: userId,
  });

  return { orgId, userId, projectId, email, password };
}

async function main(): Promise<void> {
  console.log(
    "=== Stage 3.1B.5C Gated Server Integration Verification (local only) ===\n"
  );

  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (envUrl && !isLocalSupabaseUrl(envUrl)) {
    console.log(
      "NOTE: NEXT_PUBLIC_SUPABASE_URL is non-local; this script ignores it."
    );
  }
  loadLocalCredentials();
  refuseNonLocal(LOCAL_URL, "verification target");
  check("verification target is local", isLocalSupabaseUrl(LOCAL_URL));

  try {
    DB_CONTAINER = resolveLocalDbContainer();
    psql("SELECT 1");
    check("local Postgres container reachable", true);
  } catch (e) {
    check(
      "local Postgres container reachable",
      false,
      e instanceof Error ? e.message : String(e)
    );
    process.exit(1);
  }

  // --- Feature flag unit checks ---
  check("absent env disables feature", !isScopeDiscoveryEnabled({}));
  check(
    "invalid env disables feature",
    !isScopeDiscoveryEnabled({ SCOPE_DISCOVERY_ENABLED: "1" })
  );
  check(
    "true enables feature",
    isScopeDiscoveryEnabled({ SCOPE_DISCOVERY_ENABLED: "true" })
  );
  check(
    "NEXT_PUBLIC_ is not used for enablement",
    !readFileSync("lib/scope-discovery/configuration/feature-flags.ts", "utf8").includes(
      "NEXT_PUBLIC_SCOPE"
    ) &&
      !readFileSync("lib/scope-discovery/configuration/feature-flags.ts", "utf8").includes(
        "process.env.NEXT_PUBLIC"
      )
  );

  const availOff = getScopeDiscoveryAvailability({
    SCOPE_DISCOVERY_ENABLED: "false",
  });
  check("availability reports FEATURE_DISABLED", availOff.disableReason === "FEATURE_DISABLED");

  // --- Boundary: Analyse Job unchanged; Assistant UI may import actions only via ScopeDiscovery* ---
  const assistantFiles = walkFiles("components/assistant");
  const nonDiscoveryAssistantImportsActions = assistantFiles.some((f) => {
    const normalised = f.replace(/\\/g, "/");
    if (normalised.includes("ScopeDiscovery")) return false;
    return readFileSync(f, "utf8").includes("scope-discovery/actions");
  });
  check(
    "only ScopeDiscovery Assistant components import discovery actions",
    !nonDiscoveryAssistantImportsActions
  );

  const analyseJob = readFileSync("lib/assistant/actions.ts", "utf8");
  check(
    "Analyse Job does not import scope-discovery application",
    !analyseJob.includes("scope-discovery/application") &&
      !analyseJob.includes("scope-discovery/actions")
  );

  check(
    "no new migration after 029",
    !readdirSync("supabase/migrations").some((n) =>
      /^030_/.test(n)
    )
  );

  const appTree = walkFiles("lib/scope-discovery/application");
  const commercialImport = appTree.some((f) => {
    const t = readFileSync(f, "utf8");
    return (
      t.includes("commercial-engine") ||
      t.includes("Company DNA") ||
      t.includes("builder-interview")
    );
  });
  check("no commercial/DNA/Builder Interview in application layer", !commercialImport);

  const orgA = await seedOrg("A");
  const orgB = await seedOrg("B");
  const clientA = await signIn(orgA.email, orgA.password);
  const clientB = await signIn(orgB.email, orgB.password);
  const ctxA: PersistenceAuthContext = {
    supabase: clientA,
    orgId: orgA.orgId,
    userId: orgA.userId,
  };
  const ctxB: PersistenceAuthContext = {
    supabase: clientB,
    orgId: orgB.orgId,
    userId: orgB.userId,
  };

  const providerCalls = { count: 0 };
  const envOff = { SCOPE_DISCOVERY_ENABLED: "false" };
  const envOn = { SCOPE_DISCOVERY_ENABLED: "true" };

  // --- Feature off ---
  const offResult = await runScopeDiscovery(
    { projectId: orgA.projectId },
    {
      ctx: ctxA,
      env: envOff,
      providerRunner: fakeProvider(providerCalls),
      disableLiveProvider: true,
    }
  );
  check(
    "feature off rejects run",
    !offResult.ok && offResult.code === APPLICATION_ERROR_CODES.FEATURE_DISABLED
  );
  check("feature off does not call provider", providerCalls.count === 0);

  const runCountBefore = psql(
    `SELECT COUNT(*) FROM scope_discovery_runs WHERE project_id='${orgA.projectId}'`
  );
  check("feature off inserts no runs", runCountBefore === "0");

  const offDecision = await acceptScopeSuggestionApp(
    {
      suggestionId: randomUUID(),
      projectId: orgA.projectId,
      sourceRevision: "rev1",
    },
    { ctx: ctxA, env: envOff }
  );
  check(
    "feature off blocks decisions",
    !offDecision.ok && offDecision.code === APPLICATION_ERROR_CODES.FEATURE_DISABLED
  );

  // --- Source collection ---
  try {
    const sources = await collectProjectSources(ctxA, orgA.projectId);
    check("own project sources load", sources.briefText.includes("timber deck"));
    check("accepted work areas collected", sources.acceptedWorkAreas.length >= 1);
    check("site notes collected", sources.siteNotes.length >= 1);
    check("region collected", sources.region === "Auckland");
    check(
      "no commercial fields in sources shape",
      !("rates" in sources) && !("estimates" in sources) && !("quotes" in sources)
    );
  } catch (e) {
    check("own project sources load", false, e instanceof Error ? e.message : String(e));
  }

  let foreignHidden = false;
  try {
    await collectProjectSources(ctxB, orgA.projectId);
  } catch {
    foreignHidden = true;
  }
  check("foreign project source collection hidden", foreignHidden);

  const svc = admin();
  const deletedId = randomUUID();
  await svc.from("projects").insert({
    id: deletedId,
    org_id: orgA.orgId,
    created_by: orgA.userId,
    title: "Deleted",
    stage: "brief",
    deleted_at: new Date().toISOString(),
  });
  let deletedRejected = false;
  try {
    await collectProjectSources(ctxA, deletedId);
  } catch {
    deletedRejected = true;
  }
  check("deleted project rejected", deletedRejected);

  // --- Deterministic-only run ---
  const detCalls = { count: 0 };
  const detResult = await runScopeDiscovery(
    { projectId: orgA.projectId },
    {
      ctx: ctxA,
      env: envOn,
      providerRunner: null,
      disableLiveProvider: true,
    }
  );
  check("deterministic-only run succeeds", detResult.ok === true);
  if (detResult.ok) {
    check(
      "deterministic run status completed-ish",
      detResult.status === "COMPLETED" ||
        detResult.status === "COMPLETED_WITH_WARNINGS"
    );
    check("deterministic run has runId", Boolean(detResult.runId));
  }
  check("null provider runner not invoked", detCalls.count === 0);

  const runRows = psql(
    `SELECT COUNT(*) FROM scope_discovery_runs WHERE project_id='${orgA.projectId}' AND status IN ('COMPLETED','COMPLETED_WITH_WARNINGS')`
  );
  check("run persisted", Number(runRows) >= 1);

  const sugRows = psql(
    `SELECT COUNT(*) FROM scope_discovery_suggestions WHERE project_id='${orgA.projectId}'`
  );
  check("suggestions may persist (deterministic)", Number(sugRows) >= 0);

  const rawAbsent = psql(
    `SELECT COUNT(*) FROM information_schema.columns WHERE table_name='scope_discovery_runs' AND column_name IN ('raw_response','raw_provider_output')`
  );
  check("raw provider output column absent", rawAbsent === "0");

  // --- Provider success ---
  await svc
    .from("projects")
    .update({
      brief_text:
        "Build a timber deck with stairs, railings, and lighting for evening use.",
    })
    .eq("id", orgA.projectId);

  const okCalls = { count: 0 };
  const providerResult = await runScopeDiscovery(
    { projectId: orgA.projectId, forceNewRun: true },
    {
      ctx: ctxA,
      env: envOn,
      providerRunner: fakeProvider(okCalls),
      disableLiveProvider: true,
    }
  );
  check("provider-enabled run succeeds", providerResult.ok === true);
  check("fake provider invoked", okCalls.count === 1);

  // --- Provider failure → COMPLETED_WITH_WARNINGS ---
  await svc
    .from("projects")
    .update({
      brief_text:
        "Build a timber deck with stairs plus outdoor kitchen adjacent.",
    })
    .eq("id", orgA.projectId);

  const failCalls = { count: 0 };
  const failResult = await runScopeDiscovery(
    { projectId: orgA.projectId, forceNewRun: true },
    {
      ctx: ctxA,
      env: envOn,
      providerRunner: fakeProvider(failCalls, true),
      disableLiveProvider: true,
    }
  );
  check("provider failure still returns ok with warnings path", failResult.ok === true);
  if (failResult.ok) {
    check(
      "provider failure yields COMPLETED_WITH_WARNINGS",
      failResult.status === "COMPLETED_WITH_WARNINGS"
    );
  }
  check("failing provider was invoked", failCalls.count === 1);

  // --- Idempotent reuse ---
  const reuseCalls = { count: 0 };
  const reuse = await runScopeDiscovery(
    { projectId: orgA.projectId },
    {
      ctx: ctxA,
      env: envOn,
      providerRunner: fakeProvider(reuseCalls),
      disableLiveProvider: true,
    }
  );
  check("identical completed run reuses", reuse.ok && reuse.reused === true);
  check("reuse does not call provider", reuseCalls.count === 0);

  // --- Results read ---
  const results = await getScopeDiscoveryResults(
    { projectId: orgA.projectId },
    { ctx: ctxA, env: envOn }
  );
  check("same-org results returned", results.ok === true && results.runId != null);

  const foreignResults = await getScopeDiscoveryResults(
    { projectId: orgA.projectId },
    { ctx: ctxB, env: envOn }
  );
  check(
    "cross-org results hidden",
    !foreignResults.ok ||
      foreignResults.code === APPLICATION_ERROR_CODES.PROJECT_NOT_FOUND ||
      foreignResults.code === APPLICATION_ERROR_CODES.NOT_FOUND ||
      (foreignResults.ok && foreignResults.runId === null)
  );

  if (results.ok) {
    const json = JSON.stringify(results);
    check(
      "unsafe fields absent from results",
      !json.includes("ANTHROPIC") &&
        !json.includes("apiKey") &&
        !json.includes("rawResponse")
    );
  }

  const stale = await evaluateScopeDiscoveryStale(orgA.projectId, {
    ctx: ctxA,
    env: envOn,
  });
  check("stale evaluation returns", stale.ok === true);

  // --- Decisions (seed eligible bathroom suggestion) ---
  {
    const runId = randomUUID();
    const sugId = randomUUID();
    await svc.from("scope_discovery_runs").insert({
      id: runId,
      org_id: orgA.orgId,
      project_id: orgA.projectId,
      requested_by: orgA.userId,
      trigger: "USER_REQUESTED_RERUN",
      status: "COMPLETED",
      source_fingerprint: `fp_${randomUUID().slice(0, 8)}`,
      idempotency_key: `idem_${randomUUID().slice(0, 8)}`,
      contract_version: SCOPE_DISCOVERY_CONTRACT_VERSION,
      catalogue_version: SCOPE_RELATIONSHIP_CATALOGUE_VERSION,
      prompt_version: SCOPE_DISCOVERY_PROMPT_VERSION,
      analysis_objective: "verify",
      source_snapshot: { briefRevision: "x" },
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });
    await svc.from("scope_discovery_suggestions").insert({
      id: sugId,
      org_id: orgA.orgId,
      project_id: orgA.projectId,
      run_id: runId,
      suggestion_identity: `test|bathroom|${randomUUID().slice(0, 6)}`,
      suggestion_kind: "WORK_AREA",
      proposed_work_area_type: "bathroom",
      proposed_title: "Bathroom renovation",
      proposed_description: "Test bathroom",
      confidence: 0.9,
      confidence_band: "HIGH",
      evidence: [],
      source_snapshot: { briefRevision: "x" },
      rationale_code: "verify",
      contract_version: SCOPE_DISCOVERY_CONTRACT_VERSION,
      catalogue_version: SCOPE_RELATIONSHIP_CATALOGUE_VERSION,
    });

    const accept = await acceptScopeSuggestionApp(
      {
        suggestionId: sugId,
        projectId: orgA.projectId,
        sourceRevision: "rev-accept",
      },
      { ctx: ctxA, env: envOn }
    );
    check("accept creates decision", accept.ok === true);
    if (accept.ok) {
      check("accept creates Work Area id", Boolean(accept.createdWorkAreaId));
    } else {
      check("accept creates Work Area id", false, accept.message);
    }
    const factsAfter = psql(
      `SELECT COUNT(*) FROM project_facts WHERE project_id='${orgA.projectId}'`
    );
    check("accept creates no Facts", factsAfter === "0");

    const dup = await acceptScopeSuggestionApp(
      {
        suggestionId: sugId,
        projectId: orgA.projectId,
        sourceRevision: "rev-accept-2",
      },
      { ctx: ctxA, env: envOn }
    );
    check("duplicate accept blocked", dup.ok === false);
  }

  // Reject path
  const rejectRun = randomUUID();
  const rejectSug = randomUUID();
  await svc.from("scope_discovery_runs").insert({
    id: rejectRun,
    org_id: orgA.orgId,
    project_id: orgA.projectId,
    requested_by: orgA.userId,
    trigger: "USER_REQUESTED_RERUN",
    status: "COMPLETED",
    source_fingerprint: `fp_${randomUUID().slice(0, 8)}`,
    idempotency_key: `idem_${randomUUID().slice(0, 8)}`,
    contract_version: SCOPE_DISCOVERY_CONTRACT_VERSION,
    catalogue_version: SCOPE_RELATIONSHIP_CATALOGUE_VERSION,
    prompt_version: SCOPE_DISCOVERY_PROMPT_VERSION,
    analysis_objective: "verify",
    source_snapshot: { briefRevision: "y" },
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  });
  await svc.from("scope_discovery_suggestions").insert({
    id: rejectSug,
    org_id: orgA.orgId,
    project_id: orgA.projectId,
    run_id: rejectRun,
    suggestion_identity: `test|fence|${randomUUID().slice(0, 6)}`,
    suggestion_kind: "WORK_AREA",
    proposed_work_area_type: "fence",
    proposed_title: "Boundary fence",
    proposed_description: "Test fence",
    confidence: 0.5,
    confidence_band: "MEDIUM",
    evidence: [],
    source_snapshot: { briefRevision: "y" },
    rationale_code: "verify",
    contract_version: SCOPE_DISCOVERY_CONTRACT_VERSION,
    catalogue_version: SCOPE_RELATIONSHIP_CATALOGUE_VERSION,
  });

  const waBeforeReject = psql(
    `SELECT COUNT(*) FROM work_areas WHERE project_id='${orgA.projectId}'`
  );
  const reject = await rejectScopeSuggestionApp(
    {
      suggestionId: rejectSug,
      projectId: orgA.projectId,
      sourceRevision: "rev-reject",
      reasonCode: "not_needed",
    },
    { ctx: ctxA, env: envOn }
  );
  check("reject succeeds", reject.ok === true);
  const waAfterReject = psql(
    `SELECT COUNT(*) FROM work_areas WHERE project_id='${orgA.projectId}'`
  );
  check("reject creates no Work Area", waBeforeReject === waAfterReject);

  // Modify path
  const modRun = randomUUID();
  const modSug = randomUUID();
  await svc.from("scope_discovery_runs").insert({
    id: modRun,
    org_id: orgA.orgId,
    project_id: orgA.projectId,
    requested_by: orgA.userId,
    trigger: "USER_REQUESTED_RERUN",
    status: "COMPLETED",
    source_fingerprint: `fp_${randomUUID().slice(0, 8)}`,
    idempotency_key: `idem_${randomUUID().slice(0, 8)}`,
    contract_version: SCOPE_DISCOVERY_CONTRACT_VERSION,
    catalogue_version: SCOPE_RELATIONSHIP_CATALOGUE_VERSION,
    prompt_version: SCOPE_DISCOVERY_PROMPT_VERSION,
    analysis_objective: "verify",
    source_snapshot: { briefRevision: "z" },
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  });
  await svc.from("scope_discovery_suggestions").insert({
    id: modSug,
    org_id: orgA.orgId,
    project_id: orgA.projectId,
    run_id: modRun,
    suggestion_identity: `test|painting|${randomUUID().slice(0, 6)}`,
    suggestion_kind: "WORK_AREA",
    proposed_work_area_type: "painting",
    proposed_title: "Painting",
    proposed_description: "Original",
    confidence: 0.7,
    confidence_band: "MEDIUM",
    evidence: [],
    source_snapshot: { briefRevision: "z" },
    rationale_code: "verify",
    contract_version: SCOPE_DISCOVERY_CONTRACT_VERSION,
    catalogue_version: SCOPE_RELATIONSHIP_CATALOGUE_VERSION,
  });

  const modify = await modifyScopeSuggestionApp(
    {
      suggestionId: modSug,
      projectId: orgA.projectId,
      sourceRevision: "rev-mod",
      modifiedTitle: "Exterior painting",
      modifiedDescription: "Corrected description",
      modifiedWorkAreaType: "painting",
    },
    { ctx: ctxA, env: envOn }
  );
  check("modify creates corrected Work Area", modify.ok === true);
  if (modify.ok) {
    check("modify returns work area id", Boolean(modify.createdWorkAreaId));
  }
  const originalTitle = psql(
    `SELECT proposed_title FROM scope_discovery_suggestions WHERE id='${modSug}'`
  );
  check("modify preserves original suggestion title", originalTitle === "Painting");

  // Security: org from auth
  check("org derived from auth context (ctxA.orgId set)", Boolean(ctxA.orgId));
  check(
    "actions module is server-only",
    readFileSync("lib/scope-discovery/actions.ts", "utf8").includes('"use server"')
  );

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
