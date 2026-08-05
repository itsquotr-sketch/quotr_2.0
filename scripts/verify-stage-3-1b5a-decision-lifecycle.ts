/**
 * Stage 3.1B.5A — Local decision / acceptance lifecycle verification.
 *
 * Uses ONLY local Supabase Docker. Refuses remote URLs.
 * Run after: npx supabase db reset
 *   npx tsx scripts/verify-stage-3-1b5a-decision-lifecycle.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { resolveLocalDbContainer } from "./local-db-container";
import {
  SCOPE_DISCOVERY_CONTRACT_VERSION,
} from "../lib/scope-discovery";
import { SCOPE_RELATIONSHIP_CATALOGUE_VERSION } from "../lib/scope-discovery/catalogue";
import { SCOPE_DISCOVERY_PROMPT_VERSION } from "../lib/scope-discovery/provider";
import {
  insertDiscoveryRun,
  insertDiscoverySuggestions,
  markSuggestionStaleOrSuperseded,
  type PersistenceAuthContext,
} from "../lib/scope-discovery/persistence";
import {
  DECISION_ERROR_CODES,
  acceptScopeSuggestion,
  modifyAcceptScopeSuggestion,
  rejectScopeSuggestion,
  evaluateAcceptEligibility,
} from "../lib/scope-discovery/decisions";

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
      `REFUSING: ${label} is not a local Supabase URL. 3.1B.5A runs against local Docker only.`
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

async function signIn(email: string, password: string): Promise<SupabaseClient> {
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
  email: string;
  password: string;
}> {
  const svc = admin();
  const email = `isd5a-${label}-${randomUUID().slice(0, 8)}@example.local`;
  const password = "local-3-1b5a-test-password";

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
    name: `ISD 5A Org ${label}`,
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

  return { orgId, userId, projectId, email, password };
}

async function seedSuggestion(
  ctx: PersistenceAuthContext,
  projectId: string,
  opts?: {
    type?: string;
    title?: string;
    identity?: string;
    kind?: "WORK_AREA" | "CLARIFICATION_REQUIRED";
  }
): Promise<{ runId: string; suggestionId: string }> {
  const runId = randomUUID();
  const suggestionId = randomUUID();
  const identity = opts?.identity ?? `wa:deck:${randomUUID().slice(0, 8)}`;

  await insertDiscoveryRun(ctx, {
    id: runId,
    projectId,
    trigger: "USER_REQUESTED_RERUN",
    status: "COMPLETED",
    sourceFingerprint: `fp_${randomUUID().slice(0, 8)}`,
    idempotencyKey: `idem_${randomUUID().slice(0, 8)}`,
    contractVersion: SCOPE_DISCOVERY_CONTRACT_VERSION,
    catalogueVersion: SCOPE_RELATIONSHIP_CATALOGUE_VERSION,
    promptVersion: SCOPE_DISCOVERY_PROMPT_VERSION,
    provider: null,
    model: null,
    analysisObjective: "verify",
    sourceSnapshot: snapshot(),
    providerMetadata: null,
    warnings: [],
    errors: [],
    latencyMs: 1,
    inputTokens: null,
    outputTokens: null,
    repairAttempted: false,
    providerCalled: false,
    reusedRunId: null,
    supersededRunId: null,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  });

  const kind = opts?.kind ?? "WORK_AREA";
  await insertDiscoverySuggestions(ctx, [
    {
      id: suggestionId,
      runId,
      projectId,
      suggestionIdentity: identity,
      suggestionKind: kind,
      proposedWorkAreaType: kind === "WORK_AREA" ? (opts?.type ?? "deck") : null,
      proposedTitle: opts?.title ?? "Timber deck",
      proposedDescription: "Proposed deck from discovery",
      relatedWorkAreaId: null,
      parentSuggestionId: null,
      confidence: 0.9,
      confidenceBand: "HIGH",
      evidence: [],
      sourceSnapshot: snapshot(),
      dependencyReferences: [],
      conflictReferences: [],
      missingInformation: [],
      rationaleCode: "verify",
      contractVersion: SCOPE_DISCOVERY_CONTRACT_VERSION,
      catalogueVersion: SCOPE_RELATIONSHIP_CATALOGUE_VERSION,
      promptVersion: SCOPE_DISCOVERY_PROMPT_VERSION,
      providerMetadata: null,
    },
  ]);

  return { runId, suggestionId };
}

async function main(): Promise<void> {
  console.log("=== Stage 3.1B.5A Decision Lifecycle Verification (local only) ===\n");

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

  check(
    "migration 029 file exists",
    readFileSync(
      "supabase/migrations/029_scope_discovery_acceptance_rpc.sql",
      "utf8"
    ).includes("accept_scope_discovery_suggestion")
  );

  check(
    "scope-create unique index exists",
    psql(
      `SELECT COUNT(*) FROM pg_indexes WHERE schemaname='public' AND indexname='scope_discovery_decisions_one_scope_create_uidx'`
    ) === "1"
  );

  check(
    "accept RPC exists",
    psql(
      `SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='accept_scope_discovery_suggestion'`
    ) === "1"
  );

  const anonExec = psql(
    `SELECT COUNT(*) FROM information_schema.routine_privileges WHERE routine_schema='public' AND routine_name='accept_scope_discovery_suggestion' AND grantee='anon' AND privilege_type='EXECUTE'`
  );
  check("anon cannot execute accept RPC", anonExec === "0");

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

  // --- Acceptance ---
  const { suggestionId: acceptSug } = await seedSuggestion(ctxA, orgA.projectId, {
    type: "deck",
    title: "Back deck",
  });

  const factsBefore = Number(
    psql(
      `SELECT COUNT(*) FROM public.project_facts WHERE project_id='${orgA.projectId}'`
    )
  );

  const acceptResult = await acceptScopeSuggestion(ctxA, {
    suggestionId: acceptSug,
    projectId: orgA.projectId,
    sourceRevision: "rev-1",
  });
  check("valid same-org suggestion accepted", acceptResult.ok === true);
  check(
    "Work Area created",
    acceptResult.ok === true && Boolean(acceptResult.workAreaId)
  );
  check(
    "ACCEPT decision appended",
    acceptResult.ok === true && acceptResult.decisionType === "ACCEPT"
  );

  if (acceptResult.ok && acceptResult.workAreaId) {
    const wa = psql(
      `SELECT type || '|' || name || '|' || status || '|' || coalesce(ai_confidence::text,'null') FROM public.work_areas WHERE id='${acceptResult.workAreaId}'`
    );
    check(
      "linkage correct",
      psql(
        `SELECT created_work_area_id FROM public.scope_discovery_decisions WHERE id='${acceptResult.decisionId}'`
      ) === acceptResult.workAreaId
    );
    check(
      "Work Area mapping (confirmed, null confidence, title)",
      wa === "deck|Back deck|confirmed|null"
    );
  }

  const factsAfter = Number(
    psql(
      `SELECT COUNT(*) FROM public.project_facts WHERE project_id='${orgA.projectId}'`
    )
  );
  check("no Facts created", factsAfter === factsBefore);

  const titleAfter = psql(
    `SELECT proposed_title FROM public.scope_discovery_suggestions WHERE id='${acceptSug}'`
  );
  check("original suggestion unchanged after accept", titleAfter === "Back deck");

  const dupAccept = await acceptScopeSuggestion(ctxA, {
    suggestionId: acceptSug,
    projectId: orgA.projectId,
    sourceRevision: "rev-2",
  });
  check(
    "duplicate ACCEPT blocked",
    !dupAccept.ok &&
      (dupAccept.code === DECISION_ERROR_CODES.ALREADY_SCOPE_CREATED ||
        dupAccept.code === DECISION_ERROR_CODES.ALREADY_ACCEPTED)
  );

  const foreignAccept = await acceptScopeSuggestion(ctxB, {
    suggestionId: acceptSug,
    projectId: orgA.projectId,
    sourceRevision: "rev-x",
  });
  check(
    "foreign user blocked on accept",
    !foreignAccept.ok &&
      (foreignAccept.code === DECISION_ERROR_CODES.SUGGESTION_NOT_FOUND ||
        foreignAccept.code === DECISION_ERROR_CODES.FOREIGN_OR_MISSING)
  );

  // Stale / superseded
  const { suggestionId: staleSug } = await seedSuggestion(ctxA, orgA.projectId, {
    type: "fence",
    title: "Fence",
    identity: `wa:fence:${randomUUID().slice(0, 8)}`,
  });
  await markSuggestionStaleOrSuperseded(ctxA, {
    suggestionId: staleSug,
    projectId: orgA.projectId,
    staleReason: "brief_changed",
    supersededBySuggestionId: null,
  });
  const staleResult = await acceptScopeSuggestion(ctxA, {
    suggestionId: staleSug,
    projectId: orgA.projectId,
    sourceRevision: "rev-stale",
  });
  check(
    "stale suggestion blocked",
    !staleResult.ok && staleResult.code === DECISION_ERROR_CODES.STALE_SUGGESTION
  );

  const { suggestionId: parentSug } = await seedSuggestion(ctxA, orgA.projectId, {
    type: "pergola",
    title: "Pergola A",
    identity: `wa:pergola:a:${randomUUID().slice(0, 8)}`,
  });
  const { suggestionId: childSug } = await seedSuggestion(ctxA, orgA.projectId, {
    type: "pergola",
    title: "Pergola B",
    identity: `wa:pergola:b:${randomUUID().slice(0, 8)}`,
  });
  await markSuggestionStaleOrSuperseded(ctxA, {
    suggestionId: parentSug,
    projectId: orgA.projectId,
    staleReason: null,
    supersededBySuggestionId: childSug,
  });
  const superResult = await acceptScopeSuggestion(ctxA, {
    suggestionId: parentSug,
    projectId: orgA.projectId,
    sourceRevision: "rev-super",
  });
  check(
    "superseded suggestion blocked",
    !superResult.ok &&
      superResult.code === DECISION_ERROR_CODES.SUPERSEDED_SUGGESTION
  );

  // --- Rejection ---
  const { suggestionId: rejectSug } = await seedSuggestion(ctxA, orgA.projectId, {
    type: "bathroom",
    title: "Bathroom",
    identity: `wa:bathroom:${randomUUID().slice(0, 8)}`,
  });
  const waBeforeReject = Number(
    psql(
      `SELECT COUNT(*) FROM public.work_areas WHERE project_id='${orgA.projectId}'`
    )
  );
  const rejectResult = await rejectScopeSuggestion(ctxA, {
    suggestionId: rejectSug,
    projectId: orgA.projectId,
    sourceRevision: "rev-rej",
    reasonCode: "not_needed",
  });
  check("valid rejection appended", rejectResult.ok === true);
  const waAfterReject = Number(
    psql(
      `SELECT COUNT(*) FROM public.work_areas WHERE project_id='${orgA.projectId}'`
    )
  );
  check("rejection creates no Work Area", waAfterReject === waBeforeReject);
  check(
    "original suggestion unchanged after reject",
    psql(
      `SELECT proposed_title FROM public.scope_discovery_suggestions WHERE id='${rejectSug}'`
    ) === "Bathroom"
  );

  const rejectIdem = await rejectScopeSuggestion(ctxA, {
    suggestionId: rejectSug,
    projectId: orgA.projectId,
    sourceRevision: "rev-rej-2",
  });
  check(
    "reject retry idempotent",
    rejectIdem.ok === true &&
      rejectResult.ok === true &&
      rejectIdem.decisionId === rejectResult.decisionId
  );

  const rejectAccept = await acceptScopeSuggestion(ctxA, {
    suggestionId: rejectSug,
    projectId: orgA.projectId,
    sourceRevision: "rev-after-rej",
  });
  check(
    "accept after reject blocked",
    !rejectAccept.ok &&
      rejectAccept.code === DECISION_ERROR_CODES.DECISION_CONFLICT
  );

  const foreignReject = await rejectScopeSuggestion(ctxB, {
    suggestionId: rejectSug,
    projectId: orgA.projectId,
    sourceRevision: "rev-fr",
  });
  check(
    "foreign rejection blocked",
    !foreignReject.ok &&
      (foreignReject.code === DECISION_ERROR_CODES.SUGGESTION_NOT_FOUND ||
        foreignReject.code === DECISION_ERROR_CODES.FOREIGN_OR_MISSING)
  );

  const rejectAfterAccept = await rejectScopeSuggestion(ctxA, {
    suggestionId: acceptSug,
    projectId: orgA.projectId,
    sourceRevision: "rev-late",
  });
  check(
    "rejection after scope creation blocked",
    !rejectAfterAccept.ok &&
      rejectAfterAccept.code === DECISION_ERROR_CODES.ALREADY_SCOPE_CREATED
  );

  // Suppression evidence: rejected identity still readable for merge
  check(
    "rejected suggestion remains suppression evidence",
    psql(
      `SELECT COUNT(*) FROM public.scope_discovery_decisions WHERE suggestion_id='${rejectSug}' AND decision_type='REJECT'`
    ) === "1"
  );

  // --- Modify ---
  const { suggestionId: modifySug } = await seedSuggestion(ctxA, orgA.projectId, {
    type: "kitchen",
    title: "Kitchen rough",
    identity: `wa:kitchen:${randomUUID().slice(0, 8)}`,
  });
  const modifyResult = await modifyAcceptScopeSuggestion(ctxA, {
    suggestionId: modifySug,
    projectId: orgA.projectId,
    modifiedTitle: "Kitchen renovation",
    modifiedDescription: "Corrected description",
    modifiedWorkAreaType: "kitchen",
    sourceRevision: "rev-mod",
  });
  check("modified Work Area created", modifyResult.ok === true);
  if (modifyResult.ok && modifyResult.workAreaId) {
    check(
      "modify uses corrected title",
      psql(
        `SELECT name FROM public.work_areas WHERE id='${modifyResult.workAreaId}'`
      ) === "Kitchen renovation"
    );
    check(
      "modification fields preserved on decision",
      psql(
        `SELECT modified_title || '|' || coalesce(modified_description,'') || '|' || coalesce(modified_work_area_type,'') FROM public.scope_discovery_decisions WHERE id='${modifyResult.decisionId}'`
      ) === "Kitchen renovation|Corrected description|kitchen"
    );
  }
  check(
    "original suggestion unchanged after modify",
    psql(
      `SELECT proposed_title FROM public.scope_discovery_suggestions WHERE id='${modifySug}'`
    ) === "Kitchen rough"
  );
  const factsAfterMod = Number(
    psql(
      `SELECT COUNT(*) FROM public.project_facts WHERE project_id='${orgA.projectId}'`
    )
  );
  check("no Facts created on modify", factsAfterMod === factsBefore);

  const secondModify = await modifyAcceptScopeSuggestion(ctxA, {
    suggestionId: modifySug,
    projectId: orgA.projectId,
    modifiedTitle: "Again",
    modifiedDescription: null,
    modifiedWorkAreaType: "kitchen",
    sourceRevision: "rev-mod-2",
  });
  check(
    "second MODIFY blocked",
    !secondModify.ok &&
      secondModify.code === DECISION_ERROR_CODES.ALREADY_SCOPE_CREATED
  );

  const secondAcceptAfterMod = await acceptScopeSuggestion(ctxA, {
    suggestionId: modifySug,
    projectId: orgA.projectId,
    sourceRevision: "rev-mod-acc",
  });
  check(
    "ACCEPT after MODIFY blocked",
    !secondAcceptAfterMod.ok &&
      (secondAcceptAfterMod.code === DECISION_ERROR_CODES.ALREADY_SCOPE_CREATED ||
        secondAcceptAfterMod.code === DECISION_ERROR_CODES.ALREADY_ACCEPTED)
  );

  const badModify = await modifyAcceptScopeSuggestion(ctxA, {
    suggestionId: modifySug,
    projectId: orgA.projectId,
    modifiedTitle: "",
    modifiedDescription: null,
    modifiedWorkAreaType: "not_a_real_type",
    sourceRevision: "rev-bad",
  });
  check(
    "invalid title/type rejected",
    !badModify.ok &&
      (badModify.code === DECISION_ERROR_CODES.INVALID_MODIFICATION ||
        badModify.code === DECISION_ERROR_CODES.VALIDATION_FAILED ||
        badModify.code === DECISION_ERROR_CODES.ALREADY_SCOPE_CREATED)
  );

  // Fresh suggestion for invalid type (schema may catch before RPC)
  const { suggestionId: invSug } = await seedSuggestion(ctxA, orgA.projectId, {
    type: "doors",
    title: "Doors",
    identity: `wa:doors:${randomUUID().slice(0, 8)}`,
  });
  const invType = await modifyAcceptScopeSuggestion(ctxA, {
    suggestionId: invSug,
    projectId: orgA.projectId,
    modifiedTitle: "Doors",
    modifiedDescription: null,
    modifiedWorkAreaType: "spaceship",
    sourceRevision: "rev-inv",
  });
  check(
    "unsupported modified type rejected",
    !invType.ok &&
      invType.code === DECISION_ERROR_CODES.INVALID_MODIFICATION
  );

  // --- Atomicity ---
  const { suggestionId: atomSug } = await seedSuggestion(ctxA, orgA.projectId, {
    type: "ceilings",
    title: "Ceilings",
    identity: `wa:ceilings:${randomUUID().slice(0, 8)}`,
  });
  psql(`
    CREATE OR REPLACE FUNCTION public.__test_fail_wa_insert()
    RETURNS trigger LANGUAGE plpgsql AS $fn$
    BEGIN
      RAISE EXCEPTION 'forced work area failure';
    END;
    $fn$;
    DROP TRIGGER IF EXISTS __test_fail_wa ON public.work_areas;
    CREATE TRIGGER __test_fail_wa
      BEFORE INSERT ON public.work_areas
      FOR EACH ROW EXECUTE FUNCTION public.__test_fail_wa_insert();
  `);
  const atomFailWa = await acceptScopeSuggestion(ctxA, {
    suggestionId: atomSug,
    projectId: orgA.projectId,
    sourceRevision: "rev-atom-wa",
  });
  const decisionsAfterWaFail = psql(
    `SELECT COUNT(*) FROM public.scope_discovery_decisions WHERE suggestion_id='${atomSug}'`
  );
  check(
    "forced Work Area insert failure leaves no decision",
    !atomFailWa.ok && decisionsAfterWaFail === "0"
  );
  psql(`
    DROP TRIGGER IF EXISTS __test_fail_wa ON public.work_areas;
    DROP FUNCTION IF EXISTS public.__test_fail_wa_insert();
  `);

  const { suggestionId: atomSug2 } = await seedSuggestion(ctxA, orgA.projectId, {
    type: "painting",
    title: "Painting",
    identity: `wa:painting:${randomUUID().slice(0, 8)}`,
  });
  psql(`
    CREATE OR REPLACE FUNCTION public.__test_fail_decision_insert()
    RETURNS trigger LANGUAGE plpgsql AS $fn$
    BEGIN
      RAISE EXCEPTION 'forced decision failure';
    END;
    $fn$;
    DROP TRIGGER IF EXISTS __test_fail_dec ON public.scope_discovery_decisions;
    CREATE TRIGGER __test_fail_dec
      BEFORE INSERT ON public.scope_discovery_decisions
      FOR EACH ROW EXECUTE FUNCTION public.__test_fail_decision_insert();
  `);
  const waCountBefore = Number(
    psql(
      `SELECT COUNT(*) FROM public.work_areas WHERE project_id='${orgA.projectId}' AND type='painting'`
    )
  );
  const atomFailDec = await acceptScopeSuggestion(ctxA, {
    suggestionId: atomSug2,
    projectId: orgA.projectId,
    sourceRevision: "rev-atom-dec",
  });
  const waCountAfter = Number(
    psql(
      `SELECT COUNT(*) FROM public.work_areas WHERE project_id='${orgA.projectId}' AND type='painting'`
    )
  );
  check(
    "forced decision failure leaves no Work Area",
    !atomFailDec.ok && waCountAfter === waCountBefore
  );
  psql(`
    DROP TRIGGER IF EXISTS __test_fail_dec ON public.scope_discovery_decisions;
    DROP FUNCTION IF EXISTS public.__test_fail_decision_insert();
  `);

  // Concurrent accepts
  const { suggestionId: raceSug } = await seedSuggestion(ctxA, orgA.projectId, {
    type: "flooring",
    title: "Flooring",
    identity: `wa:flooring:${randomUUID().slice(0, 8)}`,
  });
  const [r1, r2] = await Promise.all([
    acceptScopeSuggestion(ctxA, {
      suggestionId: raceSug,
      projectId: orgA.projectId,
      sourceRevision: "rev-race-1",
    }),
    acceptScopeSuggestion(ctxA, {
      suggestionId: raceSug,
      projectId: orgA.projectId,
      sourceRevision: "rev-race-2",
    }),
  ]);
  const successCount = [r1, r2].filter((r) => r.ok).length;
  const flooringWas = Number(
    psql(
      `SELECT COUNT(*) FROM public.work_areas WHERE project_id='${orgA.projectId}' AND type='flooring' AND status='confirmed'`
    )
  );
  check("concurrent accepts create one Work Area only", successCount === 1 && flooringWas === 1);

  // ACCEPT vs MODIFY race
  const { suggestionId: race2 } = await seedSuggestion(ctxA, orgA.projectId, {
    type: "plastering",
    title: "Plaster",
    identity: `wa:plaster:${randomUUID().slice(0, 8)}`,
  });
  const [a1, m1] = await Promise.all([
    acceptScopeSuggestion(ctxA, {
      suggestionId: race2,
      projectId: orgA.projectId,
      sourceRevision: "rev-am-1",
    }),
    modifyAcceptScopeSuggestion(ctxA, {
      suggestionId: race2,
      projectId: orgA.projectId,
      modifiedTitle: "Plastering corrected",
      modifiedDescription: null,
      modifiedWorkAreaType: "plastering",
      sourceRevision: "rev-am-2",
    }),
  ]);
  const amSuccess = [a1, m1].filter((r) => r.ok).length;
  const plasterWas = Number(
    psql(
      `SELECT COUNT(*) FROM public.work_areas WHERE project_id='${orgA.projectId}' AND type='plastering' AND status='confirmed'`
    )
  );
  check(
    "ACCEPT vs MODIFY race creates one scope only",
    amSuccess === 1 && plasterWas === 1
  );

  // --- Security / eligibility helper ---
  const elig = evaluateAcceptEligibility(
    {
      suggestionId: acceptSug,
      orgId: orgA.orgId,
      projectId: orgA.projectId,
      runOrgId: orgA.orgId,
      runProjectId: orgA.projectId,
      suggestionKind: "WORK_AREA",
      proposedWorkAreaType: "deck",
      proposedTitle: "Back deck",
      staleReason: null,
      supersededBySuggestionId: null,
      hasScopeCreatingDecision: true,
      hasAcceptDecision: true,
      hasRejectDecision: false,
      confirmedWorkAreaTypeExists: true,
    },
    orgA.orgId,
    orgA.projectId
  );
  check(
    "eligibility helper blocks already scope-created",
    !elig.ok && elig.reason === "ALREADY_SCOPE_CREATED"
  );

  const anonClient = createClient(LOCAL_URL, LOCAL_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: anonRpcErr } = await anonClient.rpc(
    "accept_scope_discovery_suggestion",
    {
      p_suggestion_id: acceptSug,
      p_project_id: orgA.projectId,
      p_source_revision: "anon",
    }
  );
  check("anon RPC execution denied", Boolean(anonRpcErr));

  check(
    "auth required (empty user fails)",
    (
      await acceptScopeSuggestion(
        { supabase: clientA, orgId: "", userId: "" },
        {
          suggestionId: acceptSug,
          projectId: orgA.projectId,
          sourceRevision: "x",
        }
      )
    ).ok === false
  );

  // --- Boundaries ---
  const decisionsSrc = walkFiles("lib/scope-discovery/decisions")
    .map((f) => readFileSync(f, "utf8"))
    .join("\n");
  check(
    "no commercial formula imports in decisions",
    !/commercial-engine\/calculations|calculate-line|aggregate/.test(decisionsSrc)
  );
  check(
    "no DNA / Builder Interview in decisions",
    !/company.?dna|builder.?interview/i.test(decisionsSrc)
  );
  check(
    "no UI imports in decisions",
    !/from\s+["']@\/components|from\s+["']react["']/.test(decisionsSrc)
  );

  const appFiles = walkFiles("lib")
    .concat(walkFiles("app"))
    .filter((p) => !p.replace(/\\/g, "/").includes("lib/scope-discovery"));
  check(
    "no production Analyse Job import of decisions",
    !appFiles.some((f) =>
      /scope-discovery\/decisions|from ["']@\/lib\/scope-discovery\/decisions/.test(
        readFileSync(f, "utf8")
      )
    )
  );

  check(
    "docs completion exists",
    statSync(
      "docs/implementation/STAGE_3_1B5A_DECISION_LIFECYCLE_COMPLETION.md",
      { throwIfNoEntry: false }
    )?.isFile() === true
  );

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
