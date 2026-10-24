/**
 * Prove the supported personal-deletion path on Preview only.
 * Creates a disposable company and login, dry-runs, then deletes the login.
 * The company row is retained by fulfilment and removed afterwards as fixture cleanup.
 * Does not send email.
 *
 * Run: npx tsx scripts/prove-account-deletion-preview.ts
 */
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { fulfilPersonalDeletion } from "../lib/account-deletion/execute";
import {
  INITIAL_DELETION_OPERATOR,
  PREVIEW_SUPABASE_PROJECT_REF,
} from "../lib/account-deletion/operator";

function envValue(name: string): string {
  const file = readFileSync(".env.local", "utf8");
  const line = file.split(/\r?\n/).find((entry) => entry.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).replace(/^"|"$/g, "") : "";
}

const url = envValue("NEXT_PUBLIC_SUPABASE_URL");
const key = envValue("SUPABASE_SERVICE_ROLE_KEY");
if (!url.includes(PREVIEW_SUPABASE_PROJECT_REF) || url.includes("lxvnylhsbvudzzupxeqr")) {
  console.error("Refusing the proof outside Preview.");
  process.exit(1);
}
process.env.NEXT_PUBLIC_SUPABASE_URL = url;
process.env.SUPABASE_SERVICE_ROLE_KEY = key;

async function main() {
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = "deletion-fixture@example.invalid";
const operator = INITIAL_DELETION_OPERATOR.email;
let contactAsked = false;

const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
const existing = listed.data.users.find((user) => user.email === email);
if (existing) {
  if (existing.user_metadata?.deletion_fixture !== "true") {
    console.error("A non-fixture user already uses the proof address. Stopped.");
    process.exit(1);
  }
  const removed = await admin.auth.admin.deleteUser(existing.id);
  if (removed.error) {
    console.error("The previous fixture login could not be removed.");
    process.exit(1);
  }
}

const orgId = randomUUID();
const orgInsert = await admin.from("organisations").insert({
  id: orgId,
  name: "Deletion fixture",
});
if (orgInsert.error) {
  console.error("The fixture company could not be created.");
  process.exit(1);
}

const created = await admin.auth.admin.createUser({
  email,
  password: randomBytes(24).toString("base64url"),
  email_confirm: true,
  user_metadata: { deletion_fixture: "true" },
});
if (created.error || !created.data.user) {
  await admin.from("organisations").delete().eq("id", orgId);
  console.error("The fixture login could not be created.");
  process.exit(1);
}
const userId = created.data.user.id;

const profile = await admin.from("profiles").upsert({
  id: userId,
  org_id: orgId,
  role: "owner",
  full_name: "Deletion Fixture",
});
const membership = await admin.from("organisation_memberships").insert({
  org_id: orgId,
  user_id: userId,
  role: "owner",
  status: "active",
  joined_at: new Date().toISOString(),
});
const request = await admin
  .from("account_deletion_requests")
  .insert({
    user_id: userId,
    email_normalized: email,
    source: "signed_in",
    identity_confirmed: true,
    resolution: "recorded",
    status: "verified",
    other_active_member_count: 0,
    issued_quote_count: 0,
    subscription_status: null,
  })
  .select("id")
  .single();

if (profile.error || membership.error || request.error || !request.data) {
  await admin.auth.admin.deleteUser(userId);
  await admin.from("organisations").delete().eq("id", orgId);
  console.error("The fixture request could not be prepared.");
  process.exit(1);
}

const dryRun = await fulfilPersonalDeletion(admin, {
  requestId: request.data.id,
  operatorEmail: operator,
  projectRef: PREVIEW_SUPABASE_PROJECT_REF,
  deleteContact: async () => {
    contactAsked = true;
    return "unconfigured";
  },
});
const dryRunAsked = contactAsked;
const executed = await fulfilPersonalDeletion(admin, {
  requestId: request.data.id,
  operatorEmail: operator,
  projectRef: PREVIEW_SUPABASE_PROJECT_REF,
  confirmation: "delete-personal-account",
  deleteContact: async () => {
    contactAsked = true;
    return "unconfigured";
  },
});

const userAfter = await admin.auth.admin.getUserById(userId);
const orgAfter = await admin.from("organisations").select("id").eq("id", orgId).maybeSingle();
const membersAfter = await admin
  .from("organisation_memberships")
  .select("id", { count: "exact", head: true })
  .eq("org_id", orgId);
const suppression = await admin
  .from("account_deletion_suppressions")
  .select("email_normalized")
  .eq("email_normalized", email)
  .maybeSingle();
const projects = await admin
  .from("projects")
  .select("id", { count: "exact", head: true })
  .eq("org_id", orgId);

const ok =
  dryRun.dryRun &&
  !dryRun.completed &&
  dryRun.plan.executable &&
  !dryRunAsked &&
  executed.completed &&
  !executed.dryRun &&
  userAfter.data.user == null &&
  orgAfter.data?.id === orgId &&
  (membersAfter.count ?? 0) === 0 &&
  (projects.count ?? 0) === 0 &&
  suppression.data?.email_normalized === email;

if ((projects.count ?? 0) === 0 && (membersAfter.count ?? 0) === 0) {
  await admin.from("organisations").delete().eq("id", orgId);
}

console.log(
  JSON.stringify({
    dryRun: dryRun.dryRun,
    executable: dryRun.plan.executable,
    blockers: dryRun.plan.blockers,
    issuedLinks: dryRun.plan.issuedLinks,
    effects: dryRun.plan.effects.map((effect) => effect.target),
    providerCalledDuringDryRun: dryRunAsked,
    completed: executed.completed,
    loginRemoved: userAfter.data.user == null,
    companyRetainedUntilCleanup: orgAfter.data?.id === orgId,
    membershipsAfter: membersAfter.count ?? 0,
    suppressionRecorded: Boolean(suppression.data),
    ok,
  })
);
if (!ok) process.exit(1);
}

void main();
