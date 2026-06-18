import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    throw new Error(".env.local not found");
  }
  const env = {};
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return env;
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error("FAIL: Missing required env vars in .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const anon = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const testEmail = `phase0-test-${Date.now()}@example.com`;
const testPassword = "TestPass123!";
const results = [];

function pass(label) {
  results.push({ label, ok: true });
  console.log(`PASS: ${label}`);
}

function fail(label, detail) {
  results.push({ label, ok: false, detail });
  console.error(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
}

async function checkSchema() {
  for (const table of ["organisations", "profiles", "projects"]) {
    const { error } = await admin.from(table).select("*", { count: "exact", head: true });
    if (error) {
      fail(`Schema: ${table} exists`, error.message);
      return false;
    }
  }
  pass("Schema: organisations, profiles, projects exist");
  return true;
}

async function checkAnonBlocked() {
  const { data: orgs, error: orgErr } = await anon.from("organisations").select("id");
  const { data: profiles, error: profErr } = await anon.from("profiles").select("id");
  const { data: projects, error: projErr } = await anon.from("projects").select("id");

  const orgBlocked = !orgErr && (orgs?.length ?? 0) === 0;
  const profBlocked = !profErr && (profiles?.length ?? 0) === 0;
  const projBlocked = !projErr && (projects?.length ?? 0) === 0;

  if (orgBlocked && profBlocked && projBlocked) {
    pass("RLS: unauthenticated reads return no rows");
    return true;
  }
  fail("RLS: unauthenticated reads blocked", "unexpected rows or errors");
  return false;
}

async function runSignupPath() {
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    fail("Signup: auth user created", authError?.message);
    return null;
  }
  pass("Signup: auth user created");

  const { data: org, error: orgError } = await admin
    .from("organisations")
    .insert({ name: "Phase 0 Test Org" })
    .select("id")
    .single();

  if (orgError || !org) {
    fail("Signup: organisation created", orgError?.message);
    return null;
  }
  pass("Signup: organisation created");

  const { error: profileError } = await admin.from("profiles").insert({
    id: authData.user.id,
    org_id: org.id,
    full_name: "Phase 0 Tester",
    role: "owner",
  });

  if (profileError) {
    fail("Signup: profile created", profileError.message);
    return null;
  }
  pass("Signup: profile created");

  return { userId: authData.user.id, orgId: org.id };
}

async function runLoginAndDashboard(userId, orgId) {
  const userClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: loginError } = await userClient.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (loginError) {
    fail("Login: signInWithPassword", loginError.message);
    return false;
  }
  pass("Login: signInWithPassword");

  const { data: profile, error: profileError } = await userClient
    .from("profiles")
    .select("id, org_id, full_name")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    fail("Dashboard: profile readable by authenticated user", profileError?.message);
    return false;
  }
  pass("Dashboard: profile readable by authenticated user");

  const { data: org, error: orgError } = await userClient
    .from("organisations")
    .select("id, name")
    .eq("id", orgId)
    .single();

  if (orgError || !org) {
    fail("Dashboard: organisation readable by authenticated user", orgError?.message);
    return false;
  }
  pass("Dashboard: organisation readable by authenticated user");

  return true;
}

async function runRlsIsolation(userId, orgId) {
  const { data: otherOrg, error: otherOrgError } = await admin
    .from("organisations")
    .insert({ name: "Other Org Isolation Test" })
    .select("id")
    .single();

  if (otherOrgError || !otherOrg) {
    fail("RLS setup: second organisation", otherOrgError?.message);
    return false;
  }

  const userClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await userClient.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  const { data: leakedOrg } = await userClient
    .from("organisations")
    .select("id")
    .eq("id", otherOrg.id);

  if ((leakedOrg?.length ?? 0) === 0) {
    pass("RLS: user cannot read another organisation");
  } else {
    fail("RLS: user cannot read another organisation", "rows returned");
  }

  const { data: ownProject, error: insertOkError } = await userClient
    .from("projects")
    .insert({
      org_id: orgId,
      created_by: userId,
      title: "RLS test project",
    })
    .select("id")
    .single();

  if (!insertOkError && ownProject) {
    pass("RLS: user can insert project for own org as self");
  } else {
    fail("RLS: user can insert project for own org as self", insertOkError?.message);
  }

  const { error: badInsertError } = await userClient.from("projects").insert({
    org_id: orgId,
    created_by: "00000000-0000-0000-0000-000000000001",
    title: "Should fail",
  });

  if (badInsertError) {
    pass("RLS: user cannot insert project with another created_by");
  } else {
    fail("RLS: user cannot insert project with another created_by");
  }

  await admin.from("organisations").delete().eq("id", otherOrg.id);
  if (ownProject?.id) {
    await admin.from("projects").delete().eq("id", ownProject.id);
  }

  return true;
}

async function cleanup(userId, orgId) {
  await admin.from("profiles").delete().eq("id", userId);
  await admin.from("organisations").delete().eq("id", orgId);
  await admin.auth.admin.deleteUser(userId);
}

async function main() {
  console.log("Phase 0 validation\n");

  const schemaOk = await checkSchema();
  if (!schemaOk) {
    console.error("\nApply supabase/migrations/001_initial.sql in Supabase SQL Editor first.");
    process.exit(1);
  }

  await checkAnonBlocked();

  const signup = await runSignupPath();
  if (!signup) {
    process.exit(1);
  }

  await runLoginAndDashboard(signup.userId, signup.orgId);
  await runRlsIsolation(signup.userId, signup.orgId);
  await cleanup(signup.userId, signup.orgId);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error("Validation error:", err.message);
  process.exit(1);
});
