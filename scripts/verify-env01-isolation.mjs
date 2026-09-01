#!/usr/bin/env node
/**
 * ENVIRONMENT-01 isolation probe.
 * Creates a synthetic Preview auth user + organisation.
 * Read-only checks Production for the same email.
 * Does not print emails, names, or keys.
 */

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PREVIEW_REF = "shhpjsoldmqtkdbgrbtm";
const PRODUCTION_REF = "lxvnylhsbvudzzupxeqr";

function parseEnvFile(filePath) {
  const env = {};
  const text = fs.readFileSync(filePath, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    env[line.slice(0, idx)] = line.slice(idx + 1);
  }
  return env;
}

function fail(message) {
  console.error(`[isolation] ${message}`);
  process.exit(1);
}

const previewEnv = parseEnvFile(path.join(ROOT, ".env.local"));
const productionEnv = parseEnvFile(path.join(ROOT, ".env.production.local"));

if (!previewEnv.NEXT_PUBLIC_SUPABASE_URL?.includes(PREVIEW_REF)) {
  fail("Preview env is not quotr_preview.");
}
if (!productionEnv.NEXT_PUBLIC_SUPABASE_URL?.includes(PRODUCTION_REF)) {
  fail("Production backup env is not quotr_2.0.");
}

const preview = createClient(
  previewEnv.NEXT_PUBLIC_SUPABASE_URL,
  previewEnv.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);
const previewUser = createClient(
  previewEnv.NEXT_PUBLIC_SUPABASE_URL,
  previewEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);
const production = createClient(
  productionEnv.NEXT_PUBLIC_SUPABASE_URL,
  productionEnv.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const stamp = Date.now();
const email = `env01.r1.${stamp}@quotr-preview.test`;
const password = `Env01r1-${stamp}-Aa`;

const { count: previewOrgsBefore, error: previewCountErr } = await preview
  .from("organisations")
  .select("id", { count: "exact", head: true });
if (previewCountErr) fail(`Preview org count failed: ${previewCountErr.message}`);

const { count: productionOrgsBefore, error: productionCountErr } = await production
  .from("organisations")
  .select("id", { count: "exact", head: true });
if (productionCountErr) fail(`Production org count failed: ${productionCountErr.message}`);

const created = await preview.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { isolation_probe: "ENVIRONMENT-01-R1" },
});
if (created.error || !created.data.user) {
  fail(`Preview createUser failed: ${created.error?.message ?? "no user"}`);
}

const signed = await previewUser.auth.signInWithPassword({ email, password });
if (signed.error || !signed.data.session) {
  fail(`Preview sign-in failed: ${signed.error?.message ?? "no session"}`);
}

const authed = createClient(
  previewEnv.NEXT_PUBLIC_SUPABASE_URL,
  previewEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${signed.data.session.access_token}` },
    },
  }
);

const provisioned = await authed.rpc("provision_organisation_for_new_user", {
  p_organisation_name: `ENV01-R1 ${stamp}`,
  p_full_name: "Env Probe",
});
if (provisioned.error) {
  fail(`Preview provision failed: ${provisioned.error.message}`);
}

const { count: previewOrgsAfter } = await preview
  .from("organisations")
  .select("id", { count: "exact", head: true });
const { count: previewProfilesAfter } = await preview
  .from("profiles")
  .select("id", { count: "exact", head: true });
const { count: productionOrgsAfter } = await production
  .from("organisations")
  .select("id", { count: "exact", head: true });

const listed = await production.auth.admin.listUsers({ page: 1, perPage: 200 });
if (listed.error) {
  fail(`Production user list failed: ${listed.error.message}`);
}
const productionHits = (listed.data.users ?? []).filter(
  (user) => user.email === email
).length;

console.log(
  JSON.stringify(
    {
      preview_ref: PREVIEW_REF,
      production_ref: PRODUCTION_REF,
      preview_orgs_before: previewOrgsBefore,
      preview_orgs_after: previewOrgsAfter,
      preview_profiles_after: previewProfilesAfter,
      production_orgs_before: productionOrgsBefore,
      production_orgs_after: productionOrgsAfter,
      production_email_hits: productionHits,
      preview_user_created: true,
      provision_ok: !provisioned.error,
    },
    null,
    2
  )
);

if (productionOrgsAfter !== productionOrgsBefore) {
  fail("Production organisation count changed.");
}
if (productionHits !== 0) {
  fail("Synthetic Preview email exists on Production.");
}
if ((previewOrgsAfter ?? 0) < (previewOrgsBefore ?? 0) + 1) {
  fail("Preview organisation was not created.");
}
