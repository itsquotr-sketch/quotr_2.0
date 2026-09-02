/**
 * Authenticated Preview RLS live check for billing tables.
 * Never prints emails, passwords, or secrets.
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PREVIEW_REF = "shhpjsoldmqtkdbgrbtm";
const FIXTURE_ORG = "a59f0f43-e3d1-4f23-a391-b8317ed9b521";

function parseEnvFile(filePath) {
  const env = {};
  for (const raw of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    let value = line.slice(idx + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[line.slice(0, idx)] = value;
  }
  return env;
}

function fail(message) {
  console.error(`[billing-1-r2-rls] ${message}`);
  process.exit(1);
}

const env = parseEnvFile(path.join(ROOT, ".env.local"));
if (!env.NEXT_PUBLIC_SUPABASE_URL?.includes(PREVIEW_REF)) {
  fail("Not Preview ref.");
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: otherOrg } = await admin
  .from("organisations")
  .select("id")
  .neq("id", FIXTURE_ORG)
  .limit(1)
  .maybeSingle();
if (!otherOrg?.id) fail("No second organisation for cross-org check.");

const { data: existingOwn } = await admin
  .from("org_billing_customers")
  .select("id")
  .eq("org_id", FIXTURE_ORG)
  .eq("billing_environment", "test")
  .maybeSingle();

let seededOwnId = null;
if (!existingOwn?.id) {
  const inserted = await admin
    .from("org_billing_customers")
    .insert({
      org_id: FIXTURE_ORG,
      billing_environment: "test",
      stripe_customer_id: `cus_b1r2_rls_${Date.now()}`,
    })
    .select("id")
    .single();
  if (inserted.error || !inserted.data?.id) fail("Could not seed own-org billing customer.");
  seededOwnId = inserted.data.id;
}

const { data: existingOther } = await admin
  .from("org_billing_customers")
  .select("id")
  .eq("org_id", otherOrg.id)
  .eq("billing_environment", "test")
  .maybeSingle();

let seededOtherId = null;
if (!existingOther?.id) {
  const inserted = await admin
    .from("org_billing_customers")
    .insert({
      org_id: otherOrg.id,
      billing_environment: "test",
      stripe_customer_id: `cus_b1r2_other_${Date.now()}`,
    })
    .select("id")
    .single();
  if (inserted.error || !inserted.data?.id) fail("Could not seed other-org billing customer.");
  seededOtherId = inserted.data.id;
}

const { data: existingOwnSub } = await admin
  .from("org_subscriptions")
  .select("id")
  .eq("org_id", FIXTURE_ORG)
  .eq("billing_environment", "test")
  .maybeSingle();
let seededOwnSubId = null;
if (!existingOwnSub?.id) {
  const inserted = await admin
    .from("org_subscriptions")
    .insert({
      org_id: FIXTURE_ORG,
      billing_environment: "test",
      plan_code: "builder",
      status: "trialing",
      source: "internal_trial",
      paid_seat_quantity: 1,
    })
    .select("id")
    .single();
  if (inserted.error || !inserted.data?.id) fail("Could not seed own-org subscription.");
  seededOwnSubId = inserted.data.id;
}

const { data: existingOtherSub } = await admin
  .from("org_subscriptions")
  .select("id")
  .eq("org_id", otherOrg.id)
  .eq("billing_environment", "test")
  .maybeSingle();
let seededOtherSubId = null;
if (!existingOtherSub?.id) {
  const inserted = await admin
    .from("org_subscriptions")
    .insert({
      org_id: otherOrg.id,
      billing_environment: "test",
      plan_code: "builder",
      status: "trialing",
      source: "internal_trial",
      paid_seat_quantity: 1,
    })
    .select("id")
    .single();
  if (inserted.error || !inserted.data?.id) fail("Could not seed other-org subscription.");
  seededOtherSubId = inserted.data.id;
}

const { data: ownerProfile } = await admin
  .from("profiles")
  .select("id")
  .eq("org_id", FIXTURE_ORG)
  .eq("role", "owner")
  .maybeSingle();
if (!ownerProfile?.id) fail("Fixture owner missing.");
const owner = await admin.auth.admin.getUserById(ownerProfile.id);
if (owner.error || !owner.data.user?.email) fail("Fixture owner email missing.");
const password = `Billing1r2rls-${Date.now()}-Aa`;
const updated = await admin.auth.admin.updateUserById(ownerProfile.id, { password });
if (updated.error) fail("Password reset failed.");

const member = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const signedIn = await member.auth.signInWithPassword({
  email: owner.data.user.email,
  password,
});
if (signedIn.error) fail("Authenticated sign-in failed.");

const ownCustomers = await member.from("org_billing_customers").select("org_id");
const ownSubs = await member.from("org_subscriptions").select("org_id");
const otherCustomers = await member
  .from("org_billing_customers")
  .select("org_id")
  .eq("org_id", otherOrg.id);
const otherSubs = await member
  .from("org_subscriptions")
  .select("org_id")
  .eq("org_id", otherOrg.id);
const insertOwn = await member.from("org_billing_customers").insert({
  org_id: FIXTURE_ORG,
  billing_environment: "live",
  stripe_customer_id: "cus_should_fail",
});
const updateOwn = await member
  .from("org_billing_customers")
  .update({ billing_name: "nope" })
  .eq("org_id", FIXTURE_ORG)
  .select("id");
const deleteOwn = await member
  .from("org_billing_customers")
  .delete()
  .eq("org_id", FIXTURE_ORG)
  .select("id");
const insertSub = await member.from("org_subscriptions").insert({
  org_id: FIXTURE_ORG,
  billing_environment: "test",
  plan_code: "builder",
  status: "active",
  source: "internal_trial",
  paid_seat_quantity: 1,
});
const updateSub = await member
  .from("org_subscriptions")
  .update({ paid_seat_quantity: 5 })
  .eq("org_id", FIXTURE_ORG)
  .select("id");
const deleteSub = await member
  .from("org_subscriptions")
  .delete()
  .eq("org_id", FIXTURE_ORG)
  .select("id");

const anonSelectCustomers = await anon.from("org_billing_customers").select("id").limit(1);
const anonSelectSubs = await anon.from("org_subscriptions").select("id").limit(1);
const anonSelectEvents = await anon.from("stripe_processed_events").select("id").limit(1);

const ownCustomerIds = (ownCustomers.data ?? []).map((row) => row.org_id);
const ownSubIds = (ownSubs.data ?? []).map((row) => row.org_id);
const otherVisible = (otherCustomers.data ?? []).length > 0;
const otherSubVisible = (otherSubs.data ?? []).length > 0;

let report;
try {
  report = {
    authenticated_select_own_customers: !ownCustomers.error,
    authenticated_select_own_subscriptions: !ownSubs.error,
    own_customer_org_ids_are_self: ownCustomerIds.every((id) => id === FIXTURE_ORG),
    own_customer_row_visible: ownCustomerIds.length > 0,
    own_subscription_org_ids_are_self: ownSubIds.every((id) => id === FIXTURE_ORG),
    own_subscription_row_visible: ownSubIds.length > 0,
    cannot_select_other_org: !otherVisible && !otherCustomers.error,
    cannot_select_other_org_subscription: !otherSubVisible && !otherSubs.error,
    cannot_insert_customer: Boolean(insertOwn.error),
    cannot_update_customer: Boolean(updateOwn.error) || (updateOwn.data ?? []).length === 0,
    cannot_delete_customer: Boolean(deleteOwn.error) || (deleteOwn.data ?? []).length === 0,
    cannot_insert_subscription: Boolean(insertSub.error),
    cannot_update_subscription: Boolean(updateSub.error) || (updateSub.data ?? []).length === 0,
    cannot_delete_subscription: Boolean(deleteSub.error) || (deleteSub.data ?? []).length === 0,
    anon_denied_customers:
      Boolean(anonSelectCustomers.error) || (anonSelectCustomers.data ?? []).length === 0,
    anon_denied_subscriptions:
      Boolean(anonSelectSubs.error) || (anonSelectSubs.data ?? []).length === 0,
    anon_denied_events:
      Boolean(anonSelectEvents.error) || (anonSelectEvents.data ?? []).length === 0,
  };
} finally {
  if (seededOwnId) {
    await admin.from("org_billing_customers").delete().eq("id", seededOwnId);
  }
  if (seededOtherId) {
    await admin.from("org_billing_customers").delete().eq("id", seededOtherId);
  }
  if (seededOwnSubId) {
    await admin.from("org_subscriptions").delete().eq("id", seededOwnSubId);
  }
  if (seededOtherSubId) {
    await admin.from("org_subscriptions").delete().eq("id", seededOtherSubId);
  }
}

if (!report) process.exit(1);

const green =
  report.authenticated_select_own_customers &&
  report.authenticated_select_own_subscriptions &&
  report.own_customer_org_ids_are_self &&
  report.own_customer_row_visible &&
  report.own_subscription_org_ids_are_self &&
  report.own_subscription_row_visible &&
  report.cannot_select_other_org &&
  report.cannot_select_other_org_subscription &&
  report.cannot_insert_customer &&
  report.cannot_update_customer &&
  report.cannot_delete_customer &&
  report.cannot_insert_subscription &&
  report.cannot_update_subscription &&
  report.cannot_delete_subscription &&
  report.anon_denied_customers &&
  report.anon_denied_subscriptions &&
  report.anon_denied_events;

console.log(JSON.stringify({ ok: green, ...report }, null, 2));
if (!green) process.exit(1);
