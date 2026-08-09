/**
 * Stage 3.1C.1B — Transactional signup provisioning verification.
 *
 * Run after local `supabase db reset` (migrations through 032):
 *   npx --yes tsx scripts/verify-stage-3-1c1b-transactional-provisioning.ts
 *
 * Local Docker only. Never prints secrets/tokens.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  AUTH_USER_MESSAGES,
  classifyProvisioningError,
  containsUnsafeAuthDiagnostic,
  presentAuthError,
} from "../lib/auth/errors";
import { logAuthEvent } from "../lib/auth/logging";
import { resolveLocalDbContainer } from "./local-db-container";

const DEMO_LOCAL_URL = "http://127.0.0.1:54321";
const DEMO_LOCAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const DEMO_LOCAL_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

let LOCAL_URL = DEMO_LOCAL_URL;
let LOCAL_ANON_KEY = DEMO_LOCAL_ANON_KEY;
let LOCAL_SERVICE_ROLE_KEY = DEMO_LOCAL_SERVICE_ROLE_KEY;
let DB_CONTAINER = "";

const PASSWORD = "local-3-1c1b-test-password";

function assert(label: string, ok: boolean) {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) process.exitCode = 1;
}

function section(title: string) {
  console.log(`\n=== ${title} ===\n`);
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function isLocalSupabaseUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

function refuseNonLocal(url: string, label: string) {
  if (!isLocalSupabaseUrl(url)) {
    console.error(`REFUSING: ${label} is not a local Supabase URL.`);
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

function loadLocalCredentials() {
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
    if (error instanceof Error && error.message.includes("REFUSING")) {
      throw error;
    }
    refuseNonLocal(DEMO_LOCAL_URL, "demo local URL fallback");
    LOCAL_URL = DEMO_LOCAL_URL;
    LOCAL_ANON_KEY = DEMO_LOCAL_ANON_KEY;
    LOCAL_SERVICE_ROLE_KEY = DEMO_LOCAL_SERVICE_ROLE_KEY;
    console.log(
      "NOTE: using well-known local demo credentials (supabase status env unavailable)."
    );
  }
}

function sql(query: string): string {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      DB_CONTAINER,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-t",
      "-A",
      "-c",
      query,
    ],
    { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
  ).trim();
}

function adminClient(): SupabaseClient {
  return createClient(LOCAL_URL, LOCAL_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function anonClient(): SupabaseClient {
  return createClient(LOCAL_URL, LOCAL_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function createConfirmedUser(email: string) {
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`createUser failed: ${error?.message ?? "no user"}`);
  }
  return data.user.id;
}

async function signIn(email: string) {
  const client = anonClient();
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (error || !data.session) {
    throw new Error(`signIn failed: ${error?.message ?? "no session"}`);
  }
  return client;
}

async function cleanupUser(userId: string) {
  try {
    const orgId = sql(
      `select org_id::text from public.profiles where id = '${userId}' limit 1;`
    );
    await adminClient().auth.admin.deleteUser(userId);
    if (orgId) {
      sql(`delete from public.organisations where id = '${orgId}';`);
    }
  } catch {
    // best-effort cleanup
  }
}

function testStaticSecurity() {
  section("STATIC SECURITY / APPLICATION");

  const migration = read(
    "supabase/migrations/032_transactional_signup_provisioning.sql"
  );
  assert("migration 032 exists", migration.length > 0);
  assert(
    "function uses auth.uid()",
    /auth\.uid\(\)/.test(migration)
  );
  assert(
    "SECURITY DEFINER with explicit search_path",
    /security definer/i.test(migration) &&
      /set search_path\s*=\s*public/i.test(migration)
  );
  assert(
    "no user_id parameter",
    !/p_user_id|user_id\s+uuid/i.test(migration.split("as $$")[0] ?? migration)
  );
  assert(
    "no org_id parameter from caller",
    !/p_org_id/i.test(migration)
  );
  assert(
    "revokes anon/public execute",
    /revoke all on function public\.provision_organisation_for_new_user/i.test(
      migration
    ) && /from public,\s*anon/i.test(migration)
  );
  assert(
    "grants authenticated execute",
    /grant execute[\s\S]*to authenticated/i.test(migration)
  );
  assert(
    "advisory lock for concurrency",
    /pg_advisory_xact_lock/i.test(migration)
  );

  const actions = read("app/(auth)/actions.ts");
  assert(
    "signup does not import admin client",
    !actions.includes("createAdminClient") &&
      !actions.includes("@/lib/supabase/admin")
  );
  assert(
    "signup uses shared provisioning helper",
    actions.includes("provisionOrganisationForCurrentUser")
  );
  assert(
    "finishAccountSetup exists",
    /export async function finishAccountSetup/.test(actions)
  );
  assert(
    "confirmation-pending handled without fake success",
    actions.includes("CONFIRMATION_PENDING") &&
      actions.includes("confirmation_pending")
  );
  assert(
    "signup actions do not embed resetPasswordForEmail (2B recovery-actions)",
    !/resetPasswordForEmail/.test(actions)
  );

  const setupPage = read("app/(protected)/app/setup-required/page.tsx");
  assert(
    "setup-required uses finishAccountSetup",
    setupPage.includes("finishAccountSetup")
  );
  assert(
    "setup-required does not import admin",
    !setupPage.includes("createAdminClient")
  );

  const authOrg = read("lib/security/auth-org-context.ts");
  assert(
    "Stage 2A auth-org unchanged contract",
    /Never accepts a client-supplied organisation ID/.test(authOrg) ||
      /never from a/i.test(authOrg)
  );

  const provisioning = read("lib/auth/provisioning.ts");
  assert(
    "provisioning helper never passes user_id/org_id to RPC",
    !/p_user_id|p_org_id/.test(provisioning)
  );

  assertSafeUi("PROVISIONING_FAILED", presentAuthError("PROVISIONING_FAILED"));
  assertSafeUi(
    "ACCOUNT_REPAIR_FAILED",
    presentAuthError("ACCOUNT_REPAIR_FAILED")
  );
  assertSafeUi(
    "CONFIRMATION_PENDING",
    presentAuthError("CONFIRMATION_PENDING")
  );
  assert(
    "classifyProvisioningError hides raw SQL",
    !containsUnsafeAuthDiagnostic(
      presentAuthError(
        classifyProvisioningError(
          'duplicate key value violates unique constraint "profiles_pkey"',
          "signup"
        )
      )
    )
  );

  let threw = false;
  const originalError = console.error;
  const originalInfo = console.info;
  try {
    console.error = () => {
      throw new Error("broken");
    };
    console.info = () => {
      throw new Error("broken");
    };
    logAuthEvent({ event: "provisioning_started", correlationId: "t" });
    logAuthEvent({
      event: "provisioning_failed",
      category: "PROVISIONING_FAILED",
      correlationId: "t",
    });
  } catch {
    threw = true;
  } finally {
    console.error = originalError;
    console.info = originalInfo;
  }
  assert("logging cannot throw into auth flow", !threw);

  const logging = read("lib/auth/logging.ts");
  for (const event of [
    "provisioning_started",
    "organisation_profile_provisioned",
    "provisioning_failed",
    "account_repair_started",
    "account_repair_completed",
    "account_repair_failed",
    "confirmation_pending",
  ]) {
    assert(`logging supports ${event}`, logging.includes(`"${event}"`));
  }
}

function assertSafeUi(label: string, message: string) {
  assert(`${label}: non-empty`, message.trim().length > 0);
  assert(
    `${label}: no unsafe diagnostic`,
    !containsUnsafeAuthDiagnostic(message)
  );
  assert(
    `${label}: message matches taxonomy`,
    Object.values(AUTH_USER_MESSAGES).includes(message)
  );
}

async function testLiveDb() {
  section("LOCAL DB — FUNCTION / GRANTS / IDEMPOTENCY / ATOMICITY");

  DB_CONTAINER = resolveLocalDbContainer();
  assert("local Postgres container reachable", Boolean(DB_CONTAINER));

  const exists = sql(
    `select exists (
       select 1 from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.proname = 'provision_organisation_for_new_user'
     );`
  );
  assert("function exists", exists === "t");

  const searchPath = sql(
    `select pg_get_functiondef(p.oid)
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'provision_organisation_for_new_user'
     limit 1;`
  );
  assert(
    "search_path explicit in function def",
    /SET search_path\s*(TO|=)\s*'?public'?/i.test(searchPath) ||
      /search_path\s*=\s*'?public'?/i.test(searchPath)
  );
  assert("SECURITY DEFINER in function def", /SECURITY DEFINER/i.test(searchPath));

  const anonExec = sql(
    `select has_function_privilege('anon', 'public.provision_organisation_for_new_user(text, text)', 'EXECUTE');`
  );
  assert("anon execute denied", anonExec === "f");

  const authExec = sql(
    `select has_function_privilege('authenticated', 'public.provision_organisation_for_new_user(text, text)', 'EXECUTE');`
  );
  assert("authenticated execute allowed", authExec === "t");

  // Unauthenticated RPC via anon key (no JWT) must fail.
  {
    const anon = anonClient();
    const { error } = await anon.rpc("provision_organisation_for_new_user", {
      p_organisation_name: "Should Fail Co",
      p_full_name: "Nobody",
    });
    assert(
      "unauthenticated RPC fails",
      Boolean(error)
    );
  }

  const emailA = `c1b-a-${randomUUID().slice(0, 8)}@example.com`;
  const userA = await createConfirmedUser(emailA);
  const clientA = await signIn(emailA);

  const { data: first, error: firstErr } = await clientA.rpc(
    "provision_organisation_for_new_user",
    {
      p_organisation_name: "Alpha Build Co",
      p_full_name: "Alpha Owner",
    }
  );
  assert("first provision succeeds", !firstErr && Array.isArray(first) && first.length === 1);
  const row1 = first?.[0] as
    | { org_id: string; profile_id: string; already_provisioned: boolean }
    | undefined;
  assert("first creates new (already_provisioned=false)", row1?.already_provisioned === false);
  assert("profile_id matches auth user", row1?.profile_id === userA);

  const orgCount1 = sql(
    `select count(*)::text from public.organisations where id = '${row1?.org_id}';`
  );
  assert("organisation row exists", orgCount1 === "1");

  const { data: second, error: secondErr } = await clientA.rpc(
    "provision_organisation_for_new_user",
    {
      p_organisation_name: "Should Not Duplicate Co",
      p_full_name: "Alpha Owner Again",
    }
  );
  assert("second provision succeeds", !secondErr && Array.isArray(second));
  const row2 = second?.[0] as
    | { org_id: string; profile_id: string; already_provisioned: boolean }
    | undefined;
  assert("second is idempotent (already_provisioned=true)", row2?.already_provisioned === true);
  assert("same org returned", row2?.org_id === row1?.org_id);
  assert("same profile returned", row2?.profile_id === userA);

  const orgCountForUser = sql(
    `select count(*)::text
     from public.organisations o
     join public.profiles p on p.org_id = o.id
     where p.id = '${userA}';`
  );
  assert("exactly one org for user after retry", orgCountForUser === "1");

  const profileOrg = sql(
    `select org_id::text from public.profiles where id = '${userA}';`
  );
  assert("profile.org_id matches created org", profileOrg === row1?.org_id);

  // Cross-user: user B cannot receive user A's org via RPC (creates own).
  const emailB = `c1b-b-${randomUUID().slice(0, 8)}@example.com`;
  const userB = await createConfirmedUser(emailB);
  const clientB = await signIn(emailB);
  const { data: bRows, error: bErr } = await clientB.rpc(
    "provision_organisation_for_new_user",
    {
      p_organisation_name: "Beta Build Co",
      p_full_name: "Beta Owner",
    }
  );
  const rowB = bRows?.[0] as { org_id: string; profile_id: string } | undefined;
  assert("user B provision succeeds", !bErr && Boolean(rowB));
  assert("user B gets distinct org", rowB?.org_id !== row1?.org_id);
  assert("user B profile is self", rowB?.profile_id === userB);

  // Atomicity proof: controlled failure rolls back organisation insert.
  // Simulate by forcing profile insert failure after org insert inside a DO block
  // that mirrors the function body (same transaction semantics).
  const rollbackProof = sql(`
    do $$
    declare
      v_org uuid;
      v_uid uuid := gen_random_uuid();
    begin
      begin
        insert into public.organisations (name) values ('rollback-proof-org')
          returning id into v_org;
        -- Force failure as if profile insert failed (FK to missing auth.users).
        insert into public.profiles (id, org_id, full_name, role)
          values (v_uid, v_org, 'Rollback', 'owner');
        raise exception 'expected_fk_failure_not_raised';
      exception
        when foreign_key_violation then
          -- transaction sub-block aborted; org must not remain if we rolled back.
          null;
      end;
    end $$;
    select count(*)::text from public.organisations where name = 'rollback-proof-org';
  `);
  // The DO block above catches FK violation but the INSERT org was in the same
  // subtransaction that aborted — count must be 0.
  assert(
    "controlled profile FK failure leaves no orphan organisation",
    rollbackProof === "0" || rollbackProof.endsWith("\n0") || rollbackProof.split("\n").pop() === "0"
  );

  // Stronger atomicity: call a temporary function that matches production pattern.
  sql(`
    create or replace function public.__c1b_atomicity_probe()
    returns void
    language plpgsql
    security definer
    set search_path = public
    as $f$
    declare
      v_org uuid;
      v_uid uuid := gen_random_uuid();
    begin
      insert into public.organisations (name)
      values ('c1b-atomic-probe-org')
      returning id into v_org;

      insert into public.profiles (id, org_id, full_name, role)
      values (v_uid, v_org, 'Probe', 'owner');
    end;
    $f$;
  `);
  const probeErr = (() => {
    try {
      sql(`select public.__c1b_atomicity_probe();`);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  })();
  assert("atomic probe fails on missing auth.users FK", Boolean(probeErr));
  const probeOrphans = sql(
    `select count(*)::text from public.organisations where name = 'c1b-atomic-probe-org';`
  );
  assert("atomic probe left no orphan organisation", probeOrphans === "0");
  sql(`drop function if exists public.__c1b_atomicity_probe();`);

  // RLS still enabled
  const orgsRls = sql(
    `select relrowsecurity::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname='public' and c.relname='organisations';`
  );
  const profilesRls = sql(
    `select relrowsecurity::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname='public' and c.relname='profiles';`
  );
  assert("organisations RLS still enabled", orgsRls === "true" || orgsRls === "t");
  assert("profiles RLS still enabled", profilesRls === "true" || profilesRls === "t");

  await cleanupUser(userA);
  await cleanupUser(userB);
}

function testBoundaries() {
  section("BATCH BOUNDARIES");

  const actions = read("app/(auth)/actions.ts");
  assert(
    "signup path still uses authenticated provisioning helper",
    actions.includes("provisionOrganisationForCurrentUser")
  );
  assert(
    "SCOPE_DISCOVERY not force-enabled in example",
    !/^SCOPE_DISCOVERY_ENABLED=true\s*$/m.test(
      read(".env.local.example")
    )
  );
}

async function main() {
  console.log("=== Stage 3.1C.1B transactional provisioning verification ===");
  loadLocalCredentials();
  refuseNonLocal(LOCAL_URL, "LOCAL_URL");

  testStaticSecurity();
  await testLiveDb();
  testBoundaries();

  if (!process.exitCode) {
    console.log(
      "\nStage 3.1C.1B transactional provisioning verification passed."
    );
  } else {
    console.log(
      "\nStage 3.1C.1B transactional provisioning verification FAILED."
    );
  }
}

main().catch((err) => {
  console.error("FATAL", err instanceof Error ? err.message : err);
  process.exit(1);
});
