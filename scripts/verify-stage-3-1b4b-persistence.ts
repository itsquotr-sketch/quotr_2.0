/**
 * Stage 3.1B.4B — Local scope-discovery persistence verification.
 *
 * Uses ONLY local Supabase Docker. Refuses remote URLs.
 * Run after: npx supabase db reset
 *   npx tsx scripts/verify-stage-3-1b4b-persistence.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { resolveLocalDbContainer } from "./local-db-container";
import {
  SCOPE_DISCOVERY_CONTRACT_VERSION,
  identityKeyForSuggestion,
} from "../lib/scope-discovery";
import { SCOPE_RELATIONSHIP_CATALOGUE_VERSION } from "../lib/scope-discovery/catalogue";
import { SCOPE_DISCOVERY_PROMPT_VERSION } from "../lib/scope-discovery/provider";
import {
  PERSISTENCE_ERROR_CODES,
  ScopeDiscoveryPersistenceError,
  archiveDiscoveryRun,
  completeDiscoveryRun,
  insertDiscoveryDecision,
  insertDiscoveryRun,
  insertDiscoverySuggestions,
  mapRunInsert,
  type PersistenceAuthContext,
} from "../lib/scope-discovery/persistence";

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
      `REFUSING: ${label} is not a local Supabase URL. 3.1B.4B runs against local Docker only.`
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

function snapshot(): Record<string, unknown> {
  return {
    briefRevision: "brief-v1",
    noteRevisionSet: "notes-v1",
    factRevisions: "facts-v1",
    constraintRevisions: "constraints-v1",
    workAreaRevisions: "wa-v1",
    catalogueVersion: SCOPE_RELATIONSHIP_CATALOGUE_VERSION,
    contractVersion: SCOPE_DISCOVERY_CONTRACT_VERSION,
    promptVersion: SCOPE_DISCOVERY_PROMPT_VERSION,
  };
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

async function seedOrg(label: string): Promise<{
  orgId: string;
  userId: string;
  projectId: string;
  workAreaId: string;
  email: string;
  password: string;
}> {
  const svc = admin();
  const email = `isd4b-${label}-${randomUUID().slice(0, 8)}@example.local`;
  const password = "local-3-1b4b-test-password";

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
    name: `ISD 4B Org ${label}`,
  });
  if (orgErr) throw new Error(orgErr.message);

  const { error: profileErr } = await svc.from("profiles").upsert({
    id: userId,
    org_id: orgId,
    full_name: `User ${label}`,
    role: "owner",
  });
  if (profileErr) throw new Error(profileErr.message);

  const projectId = randomUUID();
  const { error: projErr } = await svc.from("projects").insert({
    id: projectId,
    org_id: orgId,
    created_by: userId,
    title: `Project ${label}`,
    stage: "brief",
  });
  if (projErr) throw new Error(projErr.message);

  const workAreaId = randomUUID();
  const { error: waErr } = await svc.from("work_areas").insert({
    id: workAreaId,
    org_id: orgId,
    project_id: projectId,
    type: "deck",
    name: "Deck",
    status: "confirmed",
    sort_order: 0,
  });
  if (waErr) throw new Error(waErr.message);

  return { orgId, userId, projectId, workAreaId, email, password };
}

async function main(): Promise<void> {
  console.log("=== Stage 3.1B.4B Persistence Verification (local only) ===\n");

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

  // --- Migration objects ---
  check(
    "migration 028 file exists",
    readFileSync(
      "supabase/migrations/028_scope_discovery_persistence.sql",
      "utf8"
    ).includes("scope_discovery_runs")
  );
  check(
    "tables exist",
    psql(
      `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('scope_discovery_runs','scope_discovery_suggestions','scope_discovery_decisions')`
    ) === "3"
  );
  check(
    "no evidence table",
    psql(
      `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='scope_discovery_evidence'`
    ) === "0"
  );
  check(
    "RLS enabled on three tables",
    psql(
      `SELECT COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('scope_discovery_runs','scope_discovery_suggestions','scope_discovery_decisions') AND c.relrowsecurity`
    ) === "3"
  );
  check(
    "active idempotency unique index exists",
    psql(
      `SELECT COUNT(*) FROM pg_indexes WHERE schemaname='public' AND indexname='scope_discovery_runs_active_idempotency_uidx'`
    ) === "1"
  );
  check(
    "one-accept unique index exists",
    psql(
      `SELECT COUNT(*) FROM pg_indexes WHERE schemaname='public' AND indexname='scope_discovery_decisions_one_accept_uidx'`
    ) === "1"
  );
  check(
    "no commercial columns",
    psql(
      `SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND table_name LIKE 'scope_discovery_%' AND column_name ~* '(margin|gst|rate|total_sell|sell_price|cost_price)'`
    ) === "0"
  );
  check(
    "no raw provider response column",
    psql(
      `SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND table_name LIKE 'scope_discovery_%' AND column_name ~* '(raw_response|raw_provider|prompt_body)'`
    ) === "0"
  );

  const anonGrants = psql(
    `SELECT COUNT(*) FROM information_schema.role_table_grants WHERE table_schema='public' AND table_name LIKE 'scope_discovery_%' AND grantee='anon' AND privilege_type IN ('SELECT','INSERT','UPDATE','DELETE')`
  );
  check("no anon DML grants", anonGrants === "0");
  const authDecisionWrite = psql(
    `SELECT COUNT(*) FROM information_schema.role_table_grants WHERE table_schema='public' AND table_name='scope_discovery_decisions' AND grantee='authenticated' AND privilege_type IN ('UPDATE','DELETE')`
  );
  check("authenticated has no decision UPDATE/DELETE", authDecisionWrite === "0");
  const authRunDelete = psql(
    `SELECT COUNT(*) FROM information_schema.role_table_grants WHERE table_schema='public' AND table_name IN ('scope_discovery_runs','scope_discovery_suggestions') AND grantee='authenticated' AND privilege_type='DELETE'`
  );
  check("authenticated has no run/suggestion DELETE", authRunDelete === "0");

  // --- Seed orgs ---
  const orgA = await seedOrg("a");
  const orgB = await seedOrg("b");
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

  const runId = randomUUID();
  const suggestionId = randomUUID();
  const identity = `${orgA.projectId}|DEPENDENCY|fascia|${orgA.workAreaId}|-|-`;

  // --- Same-org create ---
  const run = await insertDiscoveryRun(ctxA, {
    id: runId,
    projectId: orgA.projectId,
    trigger: "INITIAL_ANALYSE_JOB",
    status: "RUNNING",
    sourceFingerprint: "fp_test_1",
    idempotencyKey: "idem_test_1",
    contractVersion: SCOPE_DISCOVERY_CONTRACT_VERSION,
    catalogueVersion: SCOPE_RELATIONSHIP_CATALOGUE_VERSION,
    promptVersion: SCOPE_DISCOVERY_PROMPT_VERSION,
    provider: null,
    model: null,
    analysisObjective: "Discover missing scopes",
    sourceSnapshot: snapshot(),
    providerMetadata: null,
    warnings: [],
    errors: [],
    latencyMs: null,
    inputTokens: null,
    outputTokens: null,
    repairAttempted: false,
    providerCalled: false,
    reusedRunId: null,
    supersededRunId: null,
    startedAt: new Date().toISOString(),
    completedAt: null,
  });
  check("user A creates run", run.id === runId && run.org_id === orgA.orgId);

  const suggestions = await insertDiscoverySuggestions(ctxA, [
    {
      id: suggestionId,
      runId,
      projectId: orgA.projectId,
      suggestionIdentity: identity,
      suggestionKind: "DEPENDENCY",
      proposedWorkAreaType: "fascia",
      proposedTitle: "Fascia",
      proposedDescription: "Replace fascia",
      relatedWorkAreaId: orgA.workAreaId,
      parentSuggestionId: null,
      confidence: 0.8,
      confidenceBand: "HIGH",
      evidence: [
        {
          sourceType: "PROJECT_BRIEF_TEXT",
          sourceId: "brief",
          excerptOrValue: "deck",
          relevance: "primary",
          timestamp: new Date().toISOString(),
          provenance: "ai",
          userAuthored: false,
          authoritative: false,
        },
      ],
      sourceSnapshot: snapshot(),
      dependencyReferences: [],
      conflictReferences: [],
      missingInformation: [],
      rationaleCode: "test.fascia",
      contractVersion: SCOPE_DISCOVERY_CONTRACT_VERSION,
      catalogueVersion: SCOPE_RELATIONSHIP_CATALOGUE_VERSION,
      promptVersion: SCOPE_DISCOVERY_PROMPT_VERSION,
      providerMetadata: null,
    },
  ]);
  check(
    "user A inserts suggestions",
    suggestions.length === 1 && suggestions[0].original_status === "PROPOSED"
  );

  await completeDiscoveryRun(ctxA, {
    runId,
    projectId: orgA.projectId,
    status: "COMPLETED_WITH_WARNINGS",
    warnings: ["ORCH-POL-01 deterministic preserved"],
    errors: [],
    latencyMs: 12,
    inputTokens: 1,
    outputTokens: 2,
    repairAttempted: false,
    providerCalled: true,
    provider: "fake",
    model: "fake-model",
    completedAt: new Date().toISOString(),
  });
  check("user A completes run with warnings", true);

  const decisionId = randomUUID();
  const decision = await insertDiscoveryDecision(ctxA, {
    id: decisionId,
    projectId: orgA.projectId,
    runId,
    suggestionId,
    decisionType: "REJECT",
    decidedAt: new Date().toISOString(),
    reasonCode: "not_needed",
    userNote: null,
    modifiedTitle: null,
    modifiedDescription: null,
    modifiedWorkAreaType: null,
    sourceRevision: "brief-v1",
    createdWorkAreaId: null,
  });
  check("user A inserts decision", decision.decision_type === "REJECT");

  const { data: readOwn } = await clientA
    .from("scope_discovery_runs")
    .select("id")
    .eq("id", runId)
    .maybeSingle();
  check("same-org read own run", readOwn?.id === runId);

  // --- Cross-org ---
  const { data: crossRead } = await clientB
    .from("scope_discovery_runs")
    .select("id")
    .eq("id", runId)
    .maybeSingle();
  check("user B cannot read A run", crossRead == null);

  let foreignProjectRejected = false;
  try {
    await insertDiscoveryRun(ctxB, {
      id: randomUUID(),
      projectId: orgA.projectId,
      trigger: "USER_REQUESTED_RERUN",
      status: "RUNNING",
      sourceFingerprint: "fp_x",
      idempotencyKey: "idem_x",
      contractVersion: SCOPE_DISCOVERY_CONTRACT_VERSION,
      catalogueVersion: SCOPE_RELATIONSHIP_CATALOGUE_VERSION,
      promptVersion: SCOPE_DISCOVERY_PROMPT_VERSION,
      provider: null,
      model: null,
      analysisObjective: "x",
      sourceSnapshot: snapshot(),
      providerMetadata: null,
      warnings: [],
      errors: [],
      latencyMs: null,
      inputTokens: null,
      outputTokens: null,
      repairAttempted: false,
      providerCalled: false,
      reusedRunId: null,
      supersededRunId: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
    });
  } catch (e) {
    foreignProjectRejected =
      e instanceof ScopeDiscoveryPersistenceError &&
      e.code === PERSISTENCE_ERROR_CODES.PROJECT_NOT_OWNED;
  }
  check("user B cannot insert using A project", foreignProjectRejected);

  const { error: attachErr } = await clientB
    .from("scope_discovery_suggestions")
    .insert({
      id: randomUUID(),
      org_id: orgB.orgId,
      project_id: orgB.projectId,
      run_id: runId,
      suggestion_identity: "x",
      suggestion_kind: "WORK_AREA",
      proposed_title: "x",
      confidence_band: "LOW",
      evidence: [],
      source_snapshot: snapshot(),
      rationale_code: "x",
      contract_version: SCOPE_DISCOVERY_CONTRACT_VERSION,
      catalogue_version: SCOPE_RELATIONSHIP_CATALOGUE_VERSION,
    });
  check("user B cannot attach suggestion to A run", Boolean(attachErr));

  // --- Integrity via psql (service) ---
  let mismatchRejected = false;
  try {
    psql(`
      INSERT INTO public.scope_discovery_runs (
        id, org_id, project_id, trigger, status, source_fingerprint, idempotency_key,
        contract_version, catalogue_version, prompt_version, analysis_objective,
        source_snapshot, started_at
      ) VALUES (
        gen_random_uuid(), '${orgB.orgId}', '${orgA.projectId}', 'USER_REQUESTED_RERUN', 'RUNNING',
        'fp_m_${randomUUID().slice(0, 8)}', 'idem_m_${randomUUID().slice(0, 8)}',
        '${SCOPE_DISCOVERY_CONTRACT_VERSION}',
        '${SCOPE_RELATIONSHIP_CATALOGUE_VERSION}', '${SCOPE_DISCOVERY_PROMPT_VERSION}',
        'm', '{}'::jsonb, now()
      );
    `);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    mismatchRejected = /org_id must match|project not found/i.test(msg);
  }
  check("project/org mismatch rejected", mismatchRejected);

  // --- Immutability ---
  const { error: mutRunErr } = await clientA
    .from("scope_discovery_runs")
    .update({ source_fingerprint: "hacked" })
    .eq("id", runId);
  check("terminal run payload cannot change", Boolean(mutRunErr));

  const { error: mutSugErr } = await clientA
    .from("scope_discovery_suggestions")
    .update({ proposed_title: "hacked" })
    .eq("id", suggestionId);
  check("suggestion payload cannot change", Boolean(mutSugErr));

  // Authenticated has no UPDATE grant after revoke; assert error and unchanged row.
  const { error: mutDecErr } = await clientA
    .from("scope_discovery_decisions")
    .update({ reason_code: "hacked" })
    .eq("id", decisionId);
  const { data: decAfterUpdate } = await clientA
    .from("scope_discovery_decisions")
    .select("reason_code")
    .eq("id", decisionId)
    .single();
  check(
    "decision update rejected",
    Boolean(mutDecErr) && decAfterUpdate?.reason_code !== "hacked"
  );

  // Trigger defence: service_role bypasses RLS but must still be blocked by append-only trigger.
  let serviceUpdateBlocked = false;
  try {
    psql(
      `UPDATE public.scope_discovery_decisions SET reason_code = 'hacked_svc' WHERE id = '${decisionId}';`
    );
  } catch (e) {
    serviceUpdateBlocked = /append-only/i.test(
      e instanceof Error ? e.message : String(e)
    );
  }
  check("decision update rejected (trigger)", serviceUpdateBlocked);

  const { error: delDecErr } = await clientA
    .from("scope_discovery_decisions")
    .delete()
    .eq("id", decisionId);
  const { data: decAfterDelete } = await clientA
    .from("scope_discovery_decisions")
    .select("id")
    .eq("id", decisionId)
    .maybeSingle();
  check(
    "decision delete rejected",
    Boolean(delDecErr) && Boolean(decAfterDelete?.id)
  );

  let serviceDeleteBlocked = false;
  try {
    psql(
      `DELETE FROM public.scope_discovery_decisions WHERE id = '${decisionId}';`
    );
  } catch (e) {
    serviceDeleteBlocked = /append-only/i.test(
      e instanceof Error ? e.message : String(e)
    );
  }
  check("decision delete rejected (trigger)", serviceDeleteBlocked);

  await archiveDiscoveryRun(ctxA, { runId, projectId: orgA.projectId });
  const { data: archived } = await clientA
    .from("scope_discovery_runs")
    .select("archived_at, source_fingerprint")
    .eq("id", runId)
    .single();
  check(
    "soft archive allowed without rewriting fingerprint",
    Boolean(archived?.archived_at) && archived?.source_fingerprint === "fp_test_1"
  );

  // --- Idempotency ---
  const runActive = randomUUID();
  await insertDiscoveryRun(ctxA, {
    id: runActive,
    projectId: orgA.projectId,
    trigger: "USER_REQUESTED_RERUN",
    status: "RUNNING",
    sourceFingerprint: "fp_active",
    idempotencyKey: "idem_active",
    contractVersion: SCOPE_DISCOVERY_CONTRACT_VERSION,
    catalogueVersion: SCOPE_RELATIONSHIP_CATALOGUE_VERSION,
    promptVersion: SCOPE_DISCOVERY_PROMPT_VERSION,
    provider: null,
    model: null,
    analysisObjective: "active",
    sourceSnapshot: snapshot(),
    providerMetadata: null,
    warnings: [],
    errors: [],
    latencyMs: null,
    inputTokens: null,
    outputTokens: null,
    repairAttempted: false,
    providerCalled: false,
    reusedRunId: null,
    supersededRunId: null,
    startedAt: new Date().toISOString(),
    completedAt: null,
  });

  let dupActive = false;
  try {
    await insertDiscoveryRun(ctxA, {
      id: randomUUID(),
      projectId: orgA.projectId,
      trigger: "USER_REQUESTED_RERUN",
      status: "RUNNING",
      sourceFingerprint: "fp_active",
      idempotencyKey: "idem_active",
      contractVersion: SCOPE_DISCOVERY_CONTRACT_VERSION,
      catalogueVersion: SCOPE_RELATIONSHIP_CATALOGUE_VERSION,
      promptVersion: SCOPE_DISCOVERY_PROMPT_VERSION,
      provider: null,
      model: null,
      analysisObjective: "active",
      sourceSnapshot: snapshot(),
      providerMetadata: null,
      warnings: [],
      errors: [],
      latencyMs: null,
      inputTokens: null,
      outputTokens: null,
      repairAttempted: false,
      providerCalled: false,
      reusedRunId: null,
      supersededRunId: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
    });
  } catch (e) {
    dupActive =
      e instanceof ScopeDiscoveryPersistenceError &&
      e.code === PERSISTENCE_ERROR_CODES.DUPLICATE_ACTIVE_RUN;
  }
  check("duplicate active run rejected", dupActive);

  // Completed run does not block new RUNNING with different key
  const newAfterComplete = await insertDiscoveryRun(ctxA, {
    id: randomUUID(),
    projectId: orgA.projectId,
    trigger: "USER_REQUESTED_RERUN",
    status: "RUNNING",
    sourceFingerprint: "fp_new_material",
    idempotencyKey: "idem_new_material",
    contractVersion: SCOPE_DISCOVERY_CONTRACT_VERSION,
    catalogueVersion: SCOPE_RELATIONSHIP_CATALOGUE_VERSION,
    promptVersion: SCOPE_DISCOVERY_PROMPT_VERSION,
    provider: null,
    model: null,
    analysisObjective: "new",
    sourceSnapshot: snapshot(),
    providerMetadata: null,
    warnings: [],
    errors: [],
    latencyMs: null,
    inputTokens: null,
    outputTokens: null,
    repairAttempted: false,
    providerCalled: false,
    reusedRunId: null,
    supersededRunId: runId,
    startedAt: new Date().toISOString(),
    completedAt: null,
  });
  check(
    "completed run does not block new material run",
    Boolean(newAfterComplete.id)
  );

  let dupIdentity = false;
  try {
    await insertDiscoverySuggestions(ctxA, [
      {
        id: randomUUID(),
        runId,
        projectId: orgA.projectId,
        suggestionIdentity: identity,
        suggestionKind: "DEPENDENCY",
        proposedWorkAreaType: "fascia",
        proposedTitle: "Dup",
        proposedDescription: null,
        relatedWorkAreaId: orgA.workAreaId,
        parentSuggestionId: null,
        confidence: 0.5,
        confidenceBand: "MEDIUM",
        evidence: [],
        sourceSnapshot: snapshot(),
        dependencyReferences: [],
        conflictReferences: [],
        missingInformation: [],
        rationaleCode: "dup",
        contractVersion: SCOPE_DISCOVERY_CONTRACT_VERSION,
        catalogueVersion: SCOPE_RELATIONSHIP_CATALOGUE_VERSION,
        promptVersion: null,
        providerMetadata: null,
      },
    ]);
  } catch (e) {
    dupIdentity =
      e instanceof ScopeDiscoveryPersistenceError &&
      e.code === PERSISTENCE_ERROR_CODES.DUPLICATE_SUGGESTION_IDENTITY;
  }
  check("duplicate suggestion identity in same run rejected", dupIdentity);

  // Same identity in different run allowed
  const otherRunId = newAfterComplete.id;
  const otherSug = await insertDiscoverySuggestions(ctxA, [
    {
      id: randomUUID(),
      runId: otherRunId,
      projectId: orgA.projectId,
      suggestionIdentity: identity,
      suggestionKind: "DEPENDENCY",
      proposedWorkAreaType: "fascia",
      proposedTitle: "Fascia again",
      proposedDescription: null,
      relatedWorkAreaId: orgA.workAreaId,
      parentSuggestionId: null,
      confidence: 0.5,
      confidenceBand: "MEDIUM",
      evidence: [],
      sourceSnapshot: snapshot(),
      dependencyReferences: [],
      conflictReferences: [],
      missingInformation: [],
      rationaleCode: "again",
      contractVersion: SCOPE_DISCOVERY_CONTRACT_VERSION,
      catalogueVersion: SCOPE_RELATIONSHIP_CATALOGUE_VERSION,
      promptVersion: null,
      providerMetadata: null,
    },
  ]);
  check("same identity in different run allowed", otherSug.length === 1);

  const acceptSugId = otherSug[0].id;
  await insertDiscoveryDecision(ctxA, {
    id: randomUUID(),
    projectId: orgA.projectId,
    runId: otherRunId,
    suggestionId: acceptSugId,
    decisionType: "ACCEPT",
    decidedAt: new Date().toISOString(),
    reasonCode: null,
    userNote: null,
    modifiedTitle: null,
    modifiedDescription: null,
    modifiedWorkAreaType: null,
    sourceRevision: "brief-v1",
    createdWorkAreaId: null,
  });
  let dupAccept = false;
  try {
    await insertDiscoveryDecision(ctxA, {
      id: randomUUID(),
      projectId: orgA.projectId,
      runId: otherRunId,
      suggestionId: acceptSugId,
      decisionType: "ACCEPT",
      decidedAt: new Date().toISOString(),
      reasonCode: null,
      userNote: null,
      modifiedTitle: null,
      modifiedDescription: null,
      modifiedWorkAreaType: null,
      sourceRevision: "brief-v1",
      createdWorkAreaId: null,
    });
  } catch (e) {
    dupAccept =
      e instanceof ScopeDiscoveryPersistenceError &&
      e.code === PERSISTENCE_ERROR_CODES.DUPLICATE_ACCEPT;
  }
  check("duplicate ACCEPT rejected", dupAccept);

  // Mapper sanitises secrets
  const mapped = mapRunInsert(
    {
      id: randomUUID(),
      projectId: orgA.projectId,
      trigger: "INITIAL_ANALYSE_JOB",
      status: "RUNNING",
      sourceFingerprint: "fp",
      idempotencyKey: "idem",
      contractVersion: SCOPE_DISCOVERY_CONTRACT_VERSION,
      catalogueVersion: SCOPE_RELATIONSHIP_CATALOGUE_VERSION,
      promptVersion: SCOPE_DISCOVERY_PROMPT_VERSION,
      provider: "anthropic",
      model: "x",
      analysisObjective: "o",
      sourceSnapshot: snapshot(),
      providerMetadata: {
        model: "x",
        ANTHROPIC_API_KEY: "sk-secret",
        rawResponse: "leak",
      },
      warnings: [],
      errors: [],
      latencyMs: null,
      inputTokens: null,
      outputTokens: null,
      repairAttempted: false,
      providerCalled: false,
      reusedRunId: null,
      supersededRunId: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
    },
    orgA.orgId,
    orgA.userId
  );
  check(
    "mapper strips secrets from metadata",
    mapped.provider_metadata !== null &&
      !("ANTHROPIC_API_KEY" in (mapped.provider_metadata as object)) &&
      !("rawResponse" in (mapped.provider_metadata as object))
  );

  // --- Boundaries ---
  const persistSrc = walkFiles("lib/scope-discovery/persistence")
    .map((f) => readFileSync(f, "utf8"))
    .join("\n");
  check("no Work Area creation in persistence adapters", !/createWorkArea|insert\(\{[^}]*work_areas/i.test(persistSrc));
  check("no server action in persistence", !/"use server"/.test(persistSrc));

  const appFiles = [
    ...walkFiles("app"),
    ...walkFiles("components"),
    ...walkFiles("lib").filter(
      (p) => !p.replace(/\\/g, "/").includes("lib/scope-discovery")
    ),
  ];
  check(
    "no production Analyse Job import of persistence",
    !appFiles.some((f) =>
      /scope-discovery\/persistence|from ["']@\/lib\/scope-discovery\/persistence/.test(
        readFileSync(f, "utf8")
      )
    )
  );
  check(
    "docs completion exists",
    (() => {
      try {
        readFileSync(
          "docs/implementation/STAGE_3_1B4B_PERSISTENCE_COMPLETION.md",
          "utf8"
        );
        return true;
      } catch {
        return false;
      }
    })()
  );

  void identityKeyForSuggestion;

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
