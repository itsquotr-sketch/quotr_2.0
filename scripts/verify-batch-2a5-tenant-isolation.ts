/**
 * Batch 2A.5 — Local tenant-isolation verification.
 *
 * Run after `supabase db reset` (migrations 001–025):
 *   npx --yes tsx scripts/verify-batch-2a5-tenant-isolation.ts
 *
 * Uses ONLY the local Supabase stack (127.0.0.1). Refuses remote URLs.
 * Never prints tokens or service-role keys.
 * Does not touch production data.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  assertOrgOwnsActiveProject,
  assertOrgOwnsPricingDocument,
  assertOrgOwnsPricingItem,
  assertOrgOwnsProject,
  assertOrgOwnsQuote,
  assertOrgOwnsQuoteItem,
  assertOrgOwnsWorkArea,
  type AuthOrgContext,
} from "../lib/security/org-ownership";
import { resolveLocalDbContainer } from "./local-db-container";

/**
 * Local credentials — loaded from `supabase status -o env` when available.
 * Never printed. Hardcoded demo keys are fallback for standard local stacks only.
 */
const DEMO_LOCAL_URL = "http://127.0.0.1:54321";
const DEMO_LOCAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const DEMO_LOCAL_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

let LOCAL_URL = DEMO_LOCAL_URL;
let LOCAL_ANON_KEY = DEMO_LOCAL_ANON_KEY;
let LOCAL_SERVICE_ROLE_KEY = DEMO_LOCAL_SERVICE_ROLE_KEY;

let DB_CONTAINER = "";
const PASSWORD = "local-2a5-test-password";

function assert(label: string, ok: boolean) {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) process.exitCode = 1;
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
    console.error(
      `REFUSING: ${label} is not a local Supabase URL. Batch 2A.5 runs against local Docker only.`
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

function loadLocalCredentials() {
  try {
    const raw = execFileSync("supabase", ["status", "-o", "env"], {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const env = parseSupabaseStatusEnv(raw);
    const apiUrl = env.API_URL;
    if (!apiUrl) {
      throw new Error("API_URL missing from supabase status");
    }
    refuseNonLocal(apiUrl, "supabase status API_URL");
    if (!env.ANON_KEY || !env.SERVICE_ROLE_KEY) {
      throw new Error("local keys missing from supabase status");
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

function guardEnvironment() {
  console.log("\n--- Local environment guard ---\n");

  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (envUrl && !isLocalSupabaseUrl(envUrl)) {
    console.log(
      "NOTE: NEXT_PUBLIC_SUPABASE_URL points to a non-local host; this script ignores it and uses local Supabase only."
    );
  }

  const override = process.env.QUOTR_ISOLATION_SUPABASE_URL;
  if (override) {
    refuseNonLocal(override, "QUOTR_ISOLATION_SUPABASE_URL");
  }

  loadLocalCredentials();
  refuseNonLocal(LOCAL_URL, "verification target URL");
  assert("verification target is local", isLocalSupabaseUrl(LOCAL_URL));

  try {
    DB_CONTAINER = resolveLocalDbContainer();
    execFileSync(
      "docker",
      ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-t", "-A", "-c", "SELECT 1"],
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
    );
    assert("local Postgres container reachable", true);
  } catch {
    assert("local Postgres container reachable", false);
    process.exit(1);
  }

  const migration025 = execFileSync(
    "docker",
    [
      "exec",
      "-i",
      DB_CONTAINER,
      "psql",
      "-U",
      "postgres",
      "-t",
      "-A",
      "-c",
      `SELECT COUNT(*)::text FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       WHERE NOT t.tgisinternal AND t.tgname = 'work_areas_project_org_match'`,
    ],
    { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
  ).trim();
  assert("migration 025 project-child triggers present", migration025 === "1");

  const grantsOk = execFileSync(
    "docker",
    [
      "exec",
      "-i",
      DB_CONTAINER,
      "psql",
      "-U",
      "postgres",
      "-t",
      "-A",
      "-c",
      `SELECT (
         -- authenticated / service_role have required DML
         has_table_privilege('authenticated', 'public.projects', 'SELECT')
         AND has_table_privilege('authenticated', 'public.projects', 'INSERT')
         AND has_table_privilege('authenticated', 'public.projects', 'UPDATE')
         AND has_table_privilege('authenticated', 'public.projects', 'DELETE')
         AND has_table_privilege('service_role', 'public.organisations', 'SELECT')
         AND has_table_privilege('service_role', 'public.organisations', 'INSERT')
         AND has_table_privilege('service_role', 'public.organisations', 'UPDATE')
         AND has_table_privilege('service_role', 'public.organisations', 'DELETE')
         -- no unnecessary privileges
         AND NOT has_table_privilege('authenticated', 'public.projects', 'TRUNCATE')
         AND NOT has_table_privilege('authenticated', 'public.projects', 'REFERENCES')
         AND NOT has_table_privilege('authenticated', 'public.projects', 'TRIGGER')
         AND NOT has_table_privilege('service_role', 'public.projects', 'TRUNCATE')
         AND NOT has_table_privilege('anon', 'public.projects', 'SELECT')
         AND NOT has_table_privilege('anon', 'public.projects', 'INSERT')
         AND NOT has_table_privilege('anon', 'public.projects', 'UPDATE')
         AND NOT has_table_privilege('anon', 'public.projects', 'DELETE')
         AND NOT has_table_privilege('anon', 'public.projects', 'TRUNCATE')
       )::text`,
    ],
    { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
  ).trim();
  assert(
    "migration 026 least-privilege grants (authenticated/service_role SIDU; anon none; no TRUNCATE/REFERENCES/TRIGGER)",
    grantsOk === "t" || grantsOk === "true"
  );

  const rlsStillOn = execFileSync(
    "docker",
    [
      "exec",
      "-i",
      DB_CONTAINER,
      "psql",
      "-U",
      "postgres",
      "-t",
      "-A",
      "-c",
      `SELECT (
         (SELECT COUNT(*) FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relkind = 'r'
            AND c.relname IN (
              'organisations','profiles','projects','work_areas','project_facts',
              'question_blocks','questions','constraints','estimates','estimate_line_items',
              'rates','organisation_settings','organisation_work_areas','project_notes',
              'note_proposals','pricing_documents','pricing_items','quotes','quote_items',
              'pricing_audit_log'
            )
            AND c.relrowsecurity) = 20
       )::text`,
    ],
    { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
  ).trim();
  assert(
    "RLS remains enabled on all 20 organisation-owned tables after 026",
    rlsStillOn === "t" || rlsStillOn === "true"
  );
}

function psql(sql: string): string {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      DB_CONTAINER,
      "psql",
      "-U",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-t",
      "-A",
      "-c",
      sql,
    ],
    { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
  ).trim();
}

function psqlOk(sql: string): boolean {
  try {
    psql(sql);
    return true;
  } catch {
    return false;
  }
}

function adminClient(): SupabaseClient {
  return createClient(LOCAL_URL, LOCAL_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function userClient(email: string): Promise<{
  client: SupabaseClient;
  userId: string;
}> {
  const client = createClient(LOCAL_URL, LOCAL_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (error || !data.user) {
    throw new Error(`sign-in failed for local test user: ${error?.message ?? "unknown"}`);
  }
  return { client, userId: data.user.id };
}

type OrgBundle = {
  orgId: string;
  label: string;
  user1Email: string;
  user1Id: string;
  user2Email?: string;
  user2Id?: string;
  projectId: string;
  workAreaId: string;
  factId: string;
  questionBlockId: string;
  questionId: string;
  constraintId: string;
  estimateId: string;
  lineItemId: string;
  pricingDocumentId: string;
  pricingItemId: string;
  quoteId: string;
  quoteItemId: string;
  settingsId: string;
  rateId: string;
};

async function createUser(
  admin: SupabaseClient,
  email: string
): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`createUser failed: ${error?.message ?? "unknown"}`);
  }
  return data.user.id;
}

async function seedOrganisation(
  admin: SupabaseClient,
  label: string,
  withSecondUser: boolean
): Promise<OrgBundle> {
  const suffix = randomUUID().slice(0, 8);
  const orgId = randomUUID();
  const projectId = randomUUID();
  const workAreaId = randomUUID();
  const factId = randomUUID();
  const questionBlockId = randomUUID();
  const questionId = randomUUID();
  const constraintId = randomUUID();
  const estimateId = randomUUID();
  const lineItemId = randomUUID();
  const pricingDocumentId = randomUUID();
  const pricingItemId = randomUUID();
  const quoteId = randomUUID();
  const quoteItemId = randomUUID();
  const settingsId = randomUUID();
  const rateId = randomUUID();

  const user1Email = `2a5-${label}-u1-${suffix}@example.local`;
  const user1Id = await createUser(admin, user1Email);

  let user2Email: string | undefined;
  let user2Id: string | undefined;
  if (withSecondUser) {
    user2Email = `2a5-${label}-u2-${suffix}@example.local`;
    user2Id = await createUser(admin, user2Email);
  }

  const { error: orgError } = await admin.from("organisations").insert({
    id: orgId,
    name: `2A5 Org ${label} ${suffix}`,
  });
  if (orgError) throw new Error(orgError.message);

  const profiles = [
    { id: user1Id, org_id: orgId, role: "owner", full_name: `User ${label}1` },
  ];
  if (user2Id) {
    profiles.push({
      id: user2Id,
      org_id: orgId,
      role: "member",
      full_name: `User ${label}2`,
    });
  }
  const { error: profileError } = await admin.from("profiles").insert(profiles);
  if (profileError) throw new Error(profileError.message);

  const { error: projectError } = await admin.from("projects").insert({
    id: projectId,
    org_id: orgId,
    created_by: user1Id,
    title: `Project ${label}`,
    stage: "brief",
  });
  if (projectError) throw new Error(projectError.message);

  const { error: waError } = await admin.from("work_areas").insert({
    id: workAreaId,
    org_id: orgId,
    project_id: projectId,
    type: "outdoor",
    name: `Work Area ${label}`,
    status: "confirmed",
    sort_order: 0,
  });
  if (waError) throw new Error(waError.message);

  const { error: factError } = await admin.from("project_facts").insert({
    id: factId,
    org_id: orgId,
    project_id: projectId,
    key: `fact_${suffix}`,
    label: "Fact",
    value: '"1"',
    source: "user",
  });
  if (factError) throw new Error(factError.message);

  const { error: blockError } = await admin.from("question_blocks").insert({
    id: questionBlockId,
    org_id: orgId,
    project_id: projectId,
    stage: "work_area_questions",
    title: `Block ${label}`,
    status: "active",
    sort_order: 0,
  });
  if (blockError) throw new Error(blockError.message);

  const { error: questionError } = await admin.from("questions").insert({
    id: questionId,
    org_id: orgId,
    project_id: projectId,
    question_block_id: questionBlockId,
    key: `q_${suffix}`,
    label: "Label",
    question_text: "Question?",
    input_type: "text",
    required: false,
    sort_order: 0,
  });
  if (questionError) throw new Error(questionError.message);

  const { error: constraintError } = await admin.from("constraints").insert({
    id: constraintId,
    org_id: orgId,
    project_id: projectId,
    key: `c_${suffix}`,
    label: "Constraint",
    value: '"x"',
  });
  if (constraintError) throw new Error(constraintError.message);

  const { error: estimateError } = await admin.from("estimates").insert({
    id: estimateId,
    org_id: orgId,
    project_id: projectId,
    status: "draft",
  });
  if (estimateError) throw new Error(estimateError.message);

  const { error: lineError } = await admin.from("estimate_line_items").insert({
    id: lineItemId,
    org_id: orgId,
    project_id: projectId,
    estimate_id: estimateId,
    work_area_name: `Work Area ${label}`,
    label: "Labour",
    category: "labour",
    sort_order: 0,
  });
  if (lineError) throw new Error(lineError.message);

  const { error: pricingError } = await admin.from("pricing_documents").insert({
    id: pricingDocumentId,
    org_id: orgId,
    project_id: projectId,
    title: `Pricing ${label}`,
    status: "draft",
    gst_rate: 15,
    subtotal_cost: 0,
    subtotal_sell: 0,
    gross_profit: 0,
    margin_percent: 0,
    markup_percent: 0,
    gst_amount: 0,
    total_incl_gst: 0,
    created_by: user1Id,
  });
  if (pricingError) throw new Error(pricingError.message);

  const { error: pricingItemError } = await admin.from("pricing_items").insert({
    id: pricingItemId,
    org_id: orgId,
    pricing_document_id: pricingDocumentId,
    project_id: projectId,
    item_type: "labour",
    delivery_method: "in_house",
    internal_label: `Item ${label}`,
    client_label: `Item ${label}`,
    quantity: 1,
    total_cost: 0,
    total_sell: 0,
    gross_profit: 0,
    margin_percent: 0,
    markup_percent: 0,
    sort_order: 0,
    visible_on_quote: true,
    optional: false,
  });
  if (pricingItemError) throw new Error(pricingItemError.message);

  const { error: quoteError } = await admin.from("quotes").insert({
    id: quoteId,
    org_id: orgId,
    project_id: projectId,
    pricing_document_id: pricingDocumentId,
    title: `Quote ${label}`,
    status: "draft",
    gst_rate: 15,
    subtotal: 0,
    gst_amount: 0,
    total_incl_gst: 0,
    created_by: user1Id,
  });
  if (quoteError) throw new Error(quoteError.message);

  const { error: quoteItemError } = await admin.from("quote_items").insert({
    id: quoteItemId,
    org_id: orgId,
    quote_id: quoteId,
    project_id: projectId,
    label: `Quote Item ${label}`,
    quantity: 1,
    unit_price: 0,
    total: 0,
    visible: true,
    optional: false,
    sort_order: 0,
  });
  if (quoteItemError) throw new Error(quoteItemError.message);

  const { error: settingsError } = await admin
    .from("organisation_settings")
    .insert({ id: settingsId, org_id: orgId });
  if (settingsError) throw new Error(settingsError.message);

  const { error: rateError } = await admin.from("rates").insert({
    id: rateId,
    org_id: orgId,
    rate_type: "labour",
    item_key: `labour_${suffix}`,
    label: `Rate ${label}`,
    unit: "hr",
    cost_rate: 50,
    sell_rate: 70,
    active: true,
  });
  if (rateError) throw new Error(rateError.message);

  // Optional pricing audit row
  await admin.from("pricing_audit_log").insert({
    organisation_id: orgId,
    project_id: projectId,
    pricing_document_id: pricingDocumentId,
    quote_id: quoteId,
    user_id: user1Id,
    action: "2a5_seed",
    new_values: { label },
  });

  return {
    orgId,
    label,
    user1Email,
    user1Id,
    user2Email,
    user2Id,
    projectId,
    workAreaId,
    factId,
    questionBlockId,
    questionId,
    constraintId,
    estimateId,
    lineItemId,
    pricingDocumentId,
    pricingItemId,
    quoteId,
    quoteItemId,
    settingsId,
    rateId,
  };
}

async function cleanupOrganisations(
  admin: SupabaseClient,
  bundles: OrgBundle[]
) {
  for (const bundle of bundles) {
    await admin.from("organisations").delete().eq("id", bundle.orgId);
    await admin.auth.admin.deleteUser(bundle.user1Id);
    if (bundle.user2Id) {
      await admin.auth.admin.deleteUser(bundle.user2Id);
    }
  }
}

function asAuthCtx(
  client: SupabaseClient,
  orgId: string,
  userId: string
): AuthOrgContext {
  return {
    supabase: client as AuthOrgContext["supabase"],
    orgId,
    user: { id: userId },
  };
}

async function testSameOrgAccess(orgA: OrgBundle) {
  console.log("\n--- Same-organisation control ---\n");

  const { client: a1, userId: a1Id } = await userClient(orgA.user1Email);

  const { data: project, error: projectError } = await a1
    .from("projects")
    .select("id, title")
    .eq("id", orgA.projectId)
    .maybeSingle();
  assert(
    "User A1 can read Organisation A project",
    !projectError && project?.id === orgA.projectId
  );

  const { data: updated, error: updateError } = await a1
    .from("projects")
    .update({ title: "Project A updated" })
    .eq("id", orgA.projectId)
    .select("title")
    .maybeSingle();
  assert(
    "User A1 can update Organisation A project",
    !updateError && updated?.title === "Project A updated"
  );

  const newWa = randomUUID();
  const { error: insertError } = await a1.from("work_areas").insert({
    id: newWa,
    org_id: orgA.orgId,
    project_id: orgA.projectId,
    type: "indoor",
    name: "Extra Area A",
    status: "confirmed",
    sort_order: 1,
  });
  assert("User A1 can create Organisation A child work area", !insertError);

  const { error: deleteError } = await a1
    .from("work_areas")
    .delete()
    .eq("id", newWa);
  assert("User A1 can delete Organisation A child where allowed", !deleteError);

  const owned = await assertOrgOwnsProject(
    asAuthCtx(a1, orgA.orgId, a1Id),
    orgA.projectId
  );
  assert("User A1 ownership helper accepts Project A", !("error" in owned));

  if (orgA.user2Email && orgA.user2Id) {
    const { client: a2, userId: a2Id } = await userClient(orgA.user2Email);
    const { data: projectForA2 } = await a2
      .from("projects")
      .select("id")
      .eq("id", orgA.projectId)
      .maybeSingle();
    assert(
      "User A2 (same company) can read Organisation A project",
      projectForA2?.id === orgA.projectId
    );
    const ownedA2 = await assertOrgOwnsProject(
      asAuthCtx(a2, orgA.orgId, a2Id),
      orgA.projectId
    );
    assert(
      "User A2 ownership helper accepts Project A (company-level access)",
      !("error" in ownedA2)
    );
    await a2.auth.signOut();
  }

  await a1.auth.signOut();
}

async function testAnonymousDeniedAccess(orgA: OrgBundle) {
  console.log("\n--- Anonymous access to customer-owned tables ---\n");

  const anon = createClient(LOCAL_URL, LOCAL_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: projects, error: projectError } = await anon
    .from("projects")
    .select("id")
    .eq("id", orgA.projectId);
  assert(
    "anonymous client cannot read customer project rows",
    (projects == null || projects.length === 0) && Boolean(projectError)
  );

  const { data: orgs, error: orgError } = await anon
    .from("organisations")
    .select("id")
    .eq("id", orgA.orgId);
  assert(
    "anonymous client cannot read organisation rows",
    (orgs == null || orgs.length === 0) && Boolean(orgError)
  );

  const { error: insertError } = await anon.from("projects").insert({
    id: randomUUID(),
    org_id: orgA.orgId,
    title: "anon should fail",
    created_by: orgA.user1Id,
  });
  assert("anonymous client cannot insert customer project rows", Boolean(insertError));
}

async function testCrossOrgReads(orgA: OrgBundle, orgB: OrgBundle) {
  console.log("\n--- Cross-organisation direct reads (RLS) ---\n");

  const { client: a1 } = await userClient(orgA.user1Email);
  const { client: b1 } = await userClient(orgB.user1Email);

  const tables: Array<{
    label: string;
    run: (client: SupabaseClient) => Promise<unknown[]>;
  }> = [
    {
      label: "project",
      run: async (c) =>
        (await c.from("projects").select("id").eq("id", orgB.projectId)).data ??
        [],
    },
    {
      label: "work area",
      run: async (c) =>
        (await c.from("work_areas").select("id").eq("id", orgB.workAreaId))
          .data ?? [],
    },
    {
      label: "facts",
      run: async (c) =>
        (await c.from("project_facts").select("id").eq("id", orgB.factId))
          .data ?? [],
    },
    {
      label: "questions",
      run: async (c) =>
        (await c.from("questions").select("id").eq("id", orgB.questionId))
          .data ?? [],
    },
    {
      label: "constraints",
      run: async (c) =>
        (await c.from("constraints").select("id").eq("id", orgB.constraintId))
          .data ?? [],
    },
    {
      label: "estimate",
      run: async (c) =>
        (await c.from("estimates").select("id").eq("id", orgB.estimateId))
          .data ?? [],
    },
    {
      label: "estimate line items",
      run: async (c) =>
        (
          await c
            .from("estimate_line_items")
            .select("id")
            .eq("id", orgB.lineItemId)
        ).data ?? [],
    },
    {
      label: "pricing document",
      run: async (c) =>
        (
          await c
            .from("pricing_documents")
            .select("id")
            .eq("id", orgB.pricingDocumentId)
        ).data ?? [],
    },
    {
      label: "pricing items",
      run: async (c) =>
        (
          await c
            .from("pricing_items")
            .select("id")
            .eq("id", orgB.pricingItemId)
        ).data ?? [],
    },
    {
      label: "quote",
      run: async (c) =>
        (await c.from("quotes").select("id").eq("id", orgB.quoteId)).data ?? [],
    },
    {
      label: "quote items",
      run: async (c) =>
        (await c.from("quote_items").select("id").eq("id", orgB.quoteItemId))
          .data ?? [],
    },
    {
      label: "company settings",
      run: async (c) =>
        (
          await c
            .from("organisation_settings")
            .select("id")
            .eq("id", orgB.settingsId)
        ).data ?? [],
    },
    {
      label: "rates",
      run: async (c) =>
        (await c.from("rates").select("id").eq("id", orgB.rateId)).data ?? [],
    },
    {
      label: "pricing audit records",
      run: async (c) =>
        (
          await c
            .from("pricing_audit_log")
            .select("id")
            .eq("organisation_id", orgB.orgId)
        ).data ?? [],
    },
  ];

  for (const table of tables) {
    const rows = await table.run(a1);
    assert(
      `User A1 cannot read Organisation B ${table.label}`,
      rows.length === 0
    );
  }

  // Inverse: B cannot read A project (representative)
  const { data: inverse } = await b1
    .from("projects")
    .select("id")
    .eq("id", orgA.projectId);
  assert(
    "User B1 cannot read Organisation A project",
    (inverse ?? []).length === 0
  );

  const { data: inverseQuote } = await b1
    .from("quotes")
    .select("id")
    .eq("id", orgA.quoteId);
  assert(
    "User B1 cannot read Organisation A quote",
    (inverseQuote ?? []).length === 0
  );

  await a1.auth.signOut();
  await b1.auth.signOut();
}

async function testCrossOrgWrites(orgA: OrgBundle, orgB: OrgBundle) {
  console.log("\n--- Cross-organisation direct writes (RLS) ---\n");

  const { client: a1 } = await userClient(orgA.user1Email);
  const { client: b1 } = await userClient(orgB.user1Email);

  const { data: updatedProject, error: updateProjectError } = await a1
    .from("projects")
    .update({ title: "Hacked B" })
    .eq("id", orgB.projectId)
    .select("id");
  assert(
    "User A1 cannot update Project B",
    (updatedProject ?? []).length === 0 && !updateProjectError
  );

  const { error: insertWaError } = await a1.from("work_areas").insert({
    id: randomUUID(),
    org_id: orgA.orgId,
    project_id: orgB.projectId,
    type: "outdoor",
    name: "Cross WA",
    status: "confirmed",
    sort_order: 9,
  });
  assert(
    "User A1 cannot insert work area under Project B (RLS and/or trigger)",
    Boolean(insertWaError)
  );

  const { data: estUpdate } = await a1
    .from("estimates")
    .update({ status: "ready" })
    .eq("id", orgB.estimateId)
    .select("id");
  assert("User A1 cannot update Estimate B", (estUpdate ?? []).length === 0);

  const { error: lineInsertError } = await a1.from("estimate_line_items").insert({
    id: randomUUID(),
    org_id: orgA.orgId,
    project_id: orgB.projectId,
    estimate_id: orgB.estimateId,
    work_area_name: "X",
    label: "X",
    category: "labour",
    sort_order: 9,
  });
  assert(
    "User A1 cannot insert estimate line under Estimate B",
    Boolean(lineInsertError)
  );

  const { data: pricingUpdate } = await a1
    .from("pricing_documents")
    .update({ title: "Hacked" })
    .eq("id", orgB.pricingDocumentId)
    .select("id");
  assert(
    "User A1 cannot update Pricing Document B",
    (pricingUpdate ?? []).length === 0
  );

  const { data: pricingItemUpdate } = await a1
    .from("pricing_items")
    .update({ client_label: "Hacked" })
    .eq("id", orgB.pricingItemId)
    .select("id");
  assert(
    "User A1 cannot update Pricing Item B",
    (pricingItemUpdate ?? []).length === 0
  );

  const { data: pricingItemDelete } = await a1
    .from("pricing_items")
    .delete()
    .eq("id", orgB.pricingItemId)
    .select("id");
  assert(
    "User A1 cannot delete Pricing Item B",
    (pricingItemDelete ?? []).length === 0
  );

  const { data: quoteUpdate } = await a1
    .from("quotes")
    .update({ title: "Hacked" })
    .eq("id", orgB.quoteId)
    .select("id");
  assert("User A1 cannot update Quote B", (quoteUpdate ?? []).length === 0);

  const { data: quoteItemUpdate } = await a1
    .from("quote_items")
    .update({ label: "Hacked" })
    .eq("id", orgB.quoteItemId)
    .select("id");
  assert(
    "User A1 cannot update Quote Item B",
    (quoteItemUpdate ?? []).length === 0
  );

  const { data: quoteItemDelete } = await a1
    .from("quote_items")
    .delete()
    .eq("id", orgB.quoteItemId)
    .select("id");
  assert(
    "User A1 cannot delete Quote Item B",
    (quoteItemDelete ?? []).length === 0
  );

  // Child with org A under parent B — trigger proof via service-role path below;
  // authenticated path should also fail.
  const { error: mismatchedChild } = await a1.from("work_areas").insert({
    id: randomUUID(),
    org_id: orgA.orgId,
    project_id: orgB.projectId,
    type: "outdoor",
    name: "Mismatch child",
    status: "confirmed",
    sort_order: 10,
  });
  assert(
    "User A1 cannot create child with Org A org_id under Org B parent",
    Boolean(mismatchedChild)
  );

  const { data: reparent } = await a1
    .from("work_areas")
    .update({ project_id: orgB.projectId })
    .eq("id", orgA.workAreaId)
    .select("id");
  assert(
    "User A1 cannot reparent Organisation A child to Organisation B project via RLS",
    (reparent ?? []).length === 0
  );

  // Inverse representative
  const { data: inverseUpdate } = await b1
    .from("projects")
    .update({ title: "Hacked A" })
    .eq("id", orgA.projectId)
    .select("id");
  assert(
    "User B1 cannot update Project A",
    (inverseUpdate ?? []).length === 0
  );

  await a1.auth.signOut();
  await b1.auth.signOut();
}

async function testApplicationOwnership(orgA: OrgBundle, orgB: OrgBundle) {
  console.log("\n--- Application ownership guards ---\n");

  const { client: a1, userId: a1Id } = await userClient(orgA.user1Email);
  const ctxA = asAuthCtx(a1, orgA.orgId, a1Id);

  const foreignProject = await assertOrgOwnsActiveProject(ctxA, orgB.projectId);
  assert(
    "assistant/active project access rejects Project B for User A",
    "error" in foreignProject && foreignProject.error === "Project not found."
  );

  const foreignPricing = await assertOrgOwnsPricingDocument(
    ctxA,
    orgB.pricingDocumentId
  );
  assert(
    "pricing document access rejects Pricing Document B for User A",
    "error" in foreignPricing &&
      foreignPricing.error === "Pricing document not found."
  );

  const foreignPricingItem = await assertOrgOwnsPricingItem(
    ctxA,
    orgB.pricingItemId
  );
  assert(
    "pricing item update/delete rejects Pricing Item B for User A",
    "error" in foreignPricingItem &&
      foreignPricingItem.error === "Pricing item not found."
  );

  const foreignQuote = await assertOrgOwnsQuote(ctxA, orgB.quoteId);
  assert(
    "quote access rejects Quote B for User A",
    "error" in foreignQuote && foreignQuote.error === "Quote not found."
  );

  const foreignQuoteItem = await assertOrgOwnsQuoteItem(ctxA, orgB.quoteItemId);
  assert(
    "quote item update/delete rejects Quote Item B for User A",
    "error" in foreignQuoteItem &&
      foreignQuoteItem.error === "Quote item not found."
  );

  const foreignWorkArea = await assertOrgOwnsWorkArea(ctxA, orgB.workAreaId);
  assert(
    "work area ownership rejects Work Area B for User A",
    "error" in foreignWorkArea && foreignWorkArea.error === "Work area not found."
  );

  // Soft-delete Project A and prove active guard rejects while rows remain
  const admin = adminClient();
  await admin
    .from("projects")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", orgA.projectId);

  const softDeleted = await assertOrgOwnsActiveProject(ctxA, orgA.projectId);
  assert(
    "active-project ownership rejects soft-deleted Project A",
    "error" in softDeleted && softDeleted.error === "Project not found."
  );

  const lifecycleStillSees = await assertOrgOwnsProject(ctxA, orgA.projectId);
  assert(
    "lifecycle ownership still resolves soft-deleted Project A for same org",
    !("error" in lifecycleStillSees)
  );

  const { count: childCount } = await admin
    .from("work_areas")
    .select("id", { count: "exact", head: true })
    .eq("project_id", orgA.projectId);
  assert(
    "soft-deleted project child rows remain physically stored",
    (childCount ?? 0) >= 1
  );

  // Restore for later cleanup consistency
  await admin
    .from("projects")
    .update({ deleted_at: null })
    .eq("id", orgA.projectId);

  await a1.auth.signOut();
}

function testParentChildTriggers(orgA: OrgBundle, orgB: OrgBundle) {
  console.log("\n--- Parent-child organisation consistency (DB triggers) ---\n");

  const seven: Array<{ table: string; insert: (org: string, project: string, id: string) => string }> = [
    {
      table: "work_areas",
      insert: (org, project, id) => `
        INSERT INTO public.work_areas (id, org_id, project_id, type, name, status, sort_order)
        VALUES ('${id}', '${org}', '${project}', 'outdoor', 'T', 'confirmed', 20)`,
    },
    {
      table: "project_facts",
      insert: (org, project, id) => `
        INSERT INTO public.project_facts (id, org_id, project_id, key, label, value, source)
        VALUES ('${id}', '${org}', '${project}', 'k_${id.slice(0, 8)}', 'L', '"1"'::jsonb, 'user')`,
    },
    {
      table: "question_blocks",
      insert: (org, project, id) => `
        INSERT INTO public.question_blocks (id, org_id, project_id, stage, title, status, sort_order)
        VALUES ('${id}', '${org}', '${project}', 'constraints', 'T', 'active', 20)`,
    },
    {
      table: "constraints",
      insert: (org, project, id) => `
        INSERT INTO public.constraints (id, org_id, project_id, key, label, value)
        VALUES ('${id}', '${org}', '${project}', 'k_${id.slice(0, 8)}', 'L', '"x"'::jsonb)`,
    },
  ];

  for (const child of seven) {
    const okId = randomUUID();
    assert(
      `${child.table}: valid same-org insert succeeds`,
      psqlOk(child.insert(orgA.orgId, orgA.projectId, okId))
    );
    assert(
      `${child.table}: mismatched-org insert fails`,
      !psqlOk(child.insert(orgA.orgId, orgB.projectId, randomUUID()))
    );
    assert(
      `${child.table}: cannot update to mismatched org_id`,
      !psqlOk(
        `UPDATE public.${child.table} SET org_id = '${orgB.orgId}' WHERE id = '${okId}'`
      )
    );
    assert(
      `${child.table}: cannot reparent to foreign project`,
      !psqlOk(
        `UPDATE public.${child.table} SET project_id = '${orgB.projectId}' WHERE id = '${okId}'`
      )
    );
    const still = psql(
      `SELECT org_id::text FROM public.${child.table} WHERE id = '${okId}'`
    );
    assert(
      `${child.table}: failed update leaves original org unchanged`,
      still === orgA.orgId
    );
    psql(`DELETE FROM public.${child.table} WHERE id = '${okId}'`);
  }

  // estimates / estimate_line_items / questions covered via targeted checks
  assert(
    "estimates: mismatched-org insert fails",
    !psqlOk(`
      INSERT INTO public.estimates (id, org_id, project_id, status)
      VALUES ('${randomUUID()}', '${orgA.orgId}', '${orgB.projectId}', 'draft')
    `)
  );

  assert(
    "estimate_line_items: mismatched-org insert fails",
    !psqlOk(`
      INSERT INTO public.estimate_line_items (
        id, org_id, project_id, estimate_id, work_area_name, label, category, sort_order
      ) VALUES (
        '${randomUUID()}', '${orgA.orgId}', '${orgB.projectId}', '${orgB.estimateId}',
        'X', 'X', 'labour', 30
      )
    `)
  );

  assert(
    "questions: mismatched-org insert fails",
    !psqlOk(`
      INSERT INTO public.questions (
        id, org_id, project_id, question_block_id, key, label, question_text, input_type, required, sort_order
      ) VALUES (
        '${randomUUID()}', '${orgA.orgId}', '${orgB.projectId}', '${orgB.questionBlockId}',
        'bad', 'L', 'Q?', 'text', false, 30
      )
    `)
  );

  // Migration 023 pricing/quote item protections
  assert(
    "pricing_items (023): mismatched org_id insert fails",
    !psqlOk(`
      INSERT INTO public.pricing_items (
        id, org_id, pricing_document_id, project_id, item_type, delivery_method,
        internal_label, client_label, quantity, total_cost, total_sell,
        gross_profit, margin_percent, markup_percent, sort_order, visible_on_quote, optional
      ) VALUES (
        '${randomUUID()}', '${orgA.orgId}', '${orgB.pricingDocumentId}', '${orgB.projectId}',
        'labour', 'in_house', 'X', 'X', 1, 0, 0, 0, 0, 0, 30, true, false
      )
    `)
  );

  assert(
    "quote_items (023): mismatched org_id insert fails",
    !psqlOk(`
      INSERT INTO public.quote_items (
        id, org_id, quote_id, project_id, label, quantity, unit_price, total, visible, optional, sort_order
      ) VALUES (
        '${randomUUID()}', '${orgA.orgId}', '${orgB.quoteId}', '${orgB.projectId}',
        'X', 1, 0, 0, true, false, 30
      )
    `)
  );
}

async function testSoftDelete(orgA: OrgBundle, orgB: OrgBundle) {
  console.log("\n--- Soft-deleted projects ---\n");

  const admin = adminClient();
  const { client: a1, userId: a1Id } = await userClient(orgA.user1Email);
  const { client: b1 } = await userClient(orgB.user1Email);
  const ctxA = asAuthCtx(a1, orgA.orgId, a1Id);

  const before = await assertOrgOwnsActiveProject(ctxA, orgA.projectId);
  assert("active project accessible to its organisation", !("error" in before));

  await admin
    .from("projects")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", orgA.projectId);

  const after = await assertOrgOwnsActiveProject(ctxA, orgA.projectId);
  assert(
    "after deleted_at, active application guards reject it",
    "error" in after
  );

  const { data: children } = await admin
    .from("work_areas")
    .select("id")
    .eq("project_id", orgA.projectId);
  assert(
    "child records remain physically stored after soft-delete",
    (children ?? []).length >= 1
  );

  // Authenticated A1 may still see children via RLS (app-layer hide), but must not
  // get active ownership. Document distinction: active path fails.
  const { data: foreignDeleted } = await b1
    .from("projects")
    .select("id")
    .eq("id", orgA.projectId);
  assert(
    "Organisation B cannot access soft-deleted Project A",
    (foreignDeleted ?? []).length === 0
  );

  const { data: foreignChildren } = await b1
    .from("work_areas")
    .select("id")
    .eq("project_id", orgA.projectId);
  assert(
    "Organisation B cannot access soft-deleted project children",
    (foreignChildren ?? []).length === 0
  );

  const stillExists = await admin
    .from("projects")
    .select("id, deleted_at")
    .eq("id", orgA.projectId)
    .maybeSingle();
  assert(
    "no hard deletion occurs (project row still present with deleted_at)",
    Boolean(stillExists.data?.id && stillExists.data.deleted_at)
  );

  await admin
    .from("projects")
    .update({ deleted_at: null })
    .eq("id", orgA.projectId);

  await a1.auth.signOut();
  await b1.auth.signOut();
}

async function testErrorDisclosure(orgA: OrgBundle, orgB: OrgBundle) {
  console.log("\n--- Error disclosure ---\n");

  const { client: a1, userId: a1Id } = await userClient(orgA.user1Email);
  const ctxA = asAuthCtx(a1, orgA.orgId, a1Id);
  const missingId = randomUUID();

  const missingProject = await assertOrgOwnsProject(ctxA, missingId);
  const foreignProject = await assertOrgOwnsProject(ctxA, orgB.projectId);
  assert(
    "missing and foreign project IDs produce equivalent public errors",
    "error" in missingProject &&
      "error" in foreignProject &&
      missingProject.error === foreignProject.error &&
      missingProject.error === "Project not found." &&
      !missingProject.error.includes(orgB.orgId)
  );

  const missingItem = await assertOrgOwnsPricingItem(ctxA, missingId);
  const foreignItem = await assertOrgOwnsPricingItem(ctxA, orgB.pricingItemId);
  assert(
    "missing and foreign pricing item IDs produce equivalent public errors",
    "error" in missingItem &&
      "error" in foreignItem &&
      missingItem.error === foreignItem.error
  );

  const missingQuote = await assertOrgOwnsQuote(ctxA, missingId);
  const foreignQuote = await assertOrgOwnsQuote(ctxA, orgB.quoteId);
  assert(
    "missing and foreign quote IDs produce equivalent public errors",
    "error" in missingQuote &&
      "error" in foreignQuote &&
      missingQuote.error === foreignQuote.error
  );

  // Sensitive fields must not appear in public ownership errors
  const sample =
    "error" in foreignProject ? foreignProject.error : "";
  assert(
    "ownership errors omit organisation IDs and foreign metadata",
    !sample.includes(orgB.orgId) &&
      !sample.includes(orgB.projectId) &&
      !sample.toLowerCase().includes("stack") &&
      !sample.toLowerCase().includes("permission denied")
  );

  await a1.auth.signOut();
}

async function main() {
  console.log("=== Batch 2A.5 tenant-isolation verification (local only) ===");
  guardEnvironment();

  const admin = adminClient();
  let orgA: OrgBundle | null = null;
  let orgB: OrgBundle | null = null;

  try {
    console.log("\n--- Seeding disposable local organisations ---\n");
    orgA = await seedOrganisation(admin, "A", true);
    orgB = await seedOrganisation(admin, "B", false);
    assert("Organisation A seed completed", Boolean(orgA.orgId));
    assert("Organisation B seed completed", Boolean(orgB.orgId));

    await testSameOrgAccess(orgA);
    await testAnonymousDeniedAccess(orgA);
    await testCrossOrgReads(orgA, orgB);
    await testCrossOrgWrites(orgA, orgB);
    await testApplicationOwnership(orgA, orgB);
    testParentChildTriggers(orgA, orgB);
    await testSoftDelete(orgA, orgB);
    await testErrorDisclosure(orgA, orgB);
  } catch (error) {
    console.error(
      "FAIL Batch 2A.5 setup or execution error:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  } finally {
    if (orgA && orgB) {
      console.log("\n--- Cleanup disposable local data ---\n");
      try {
        await cleanupOrganisations(admin, [orgA, orgB]);
        console.log("PASS disposable organisations cleaned up");
      } catch (cleanupError) {
        console.log(
          "NOTE: cleanup incomplete — safe to `supabase db reset`:",
          cleanupError instanceof Error
            ? cleanupError.message
            : String(cleanupError)
        );
      }
    }
  }

  if (process.exitCode && process.exitCode !== 0) {
    console.log("\nBatch 2A.5 verification FAILED");
    process.exit(1);
  }
  console.log("\nBatch 2A.5 verification PASSED");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
