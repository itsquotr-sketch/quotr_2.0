/**
 * Prove supported personal-deletion paths on Preview only.
 * Disposable fixtures. Does not email, cancel Stripe, or delete a real account.
 * Fixture companies are removed after the assertions.
 *
 * Run: npx tsx scripts/prove-account-deletion-preview.ts
 */
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { fulfilPersonalDeletion } from "../lib/account-deletion/execute";
import { upsertLoopsContact } from "../lib/communications/loops-client";
import {
  INITIAL_DELETION_OPERATOR,
  PREVIEW_SUPABASE_PROJECT_REF,
} from "../lib/account-deletion/operator";

function envValue(name: string): string {
  const fromProcess = process.env[name]?.trim();
  if (fromProcess) return fromProcess;
  const candidates = [
    ".env.local",
    "c:/Users/Admin/Desktop/quotr_2.0/quotr_2.0/.env.local",
  ];
  for (const path of candidates) {
    try {
      const file = readFileSync(path, "utf8");
      const line = file.split(/\r?\n/).find((entry) => entry.startsWith(`${name}=`));
      if (line) return line.slice(name.length + 1).replace(/^"|"$/g, "");
    } catch {
      // Try the next candidate.
    }
  }
  return "";
}

const url = envValue("NEXT_PUBLIC_SUPABASE_URL");
const key = envValue("SUPABASE_SERVICE_ROLE_KEY");
if (!url.includes(PREVIEW_SUPABASE_PROJECT_REF) || url.includes("lxvnylhsbvudzzupxeqr")) {
  console.error("Refusing the proof outside Preview.");
  process.exit(1);
}
process.env.NEXT_PUBLIC_SUPABASE_URL = url;
process.env.SUPABASE_SERVICE_ROLE_KEY = key;

const operator = INITIAL_DELETION_OPERATOR.email;
const results: Record<string, boolean> = {};

function password(): string {
  return randomBytes(24).toString("base64url");
}

async function createFixtureUser(
  admin: SupabaseClient,
  email: string,
  orgId: string,
  role: "owner" | "admin"
): Promise<string> {
  const created = await admin.auth.admin.createUser({
    email,
    password: password(),
    email_confirm: true,
    user_metadata: { deletion_fixture: "true" },
  });
  if (created.error || !created.data.user) {
    throw new Error(`Fixture login was not created: ${created.error?.message ?? "unknown"}`);
  }
  const userId = created.data.user.id;
  const profile = await admin.from("profiles").upsert({
    id: userId,
    org_id: orgId,
    role,
    full_name: "Deletion Fixture",
  });
  if (profile.error) throw new Error(`Fixture profile was not saved: ${profile.error.message}`);
  const membership = await admin.from("organisation_memberships").insert({
    org_id: orgId,
    user_id: userId,
    role,
    status: "active",
    joined_at: new Date().toISOString(),
  });
  if (membership.error) throw new Error(`Fixture membership was not saved: ${membership.error.message}`);
  return userId;
}

async function insertRequest(
  admin: SupabaseClient,
  input: { userId: string; email: string; otherActiveMemberCount: number }
): Promise<string> {
  const request = await admin
    .from("account_deletion_requests")
    .insert({
      user_id: input.userId,
      email_normalized: input.email,
      source: "signed_in",
      identity_confirmed: true,
      resolution: input.otherActiveMemberCount > 0 ? "needs_support" : "recorded",
      status: "verified",
      other_active_member_count: input.otherActiveMemberCount,
      issued_quote_count: 0,
      subscription_status: null,
    })
    .select("id")
    .single();
  if (request.error || !request.data) {
    throw new Error(`Fixture request was not saved: ${request.error?.message ?? "unknown"}`);
  }
  return request.data.id as string;
}

async function cleanup(
  admin: SupabaseClient,
  input: { orgId: string; emails: string[]; userIds: string[] }
): Promise<void> {
  await admin.from("quotes").delete().eq("org_id", input.orgId);
  await admin.from("projects").delete().eq("org_id", input.orgId);
  await admin.from("org_subscriptions").delete().eq("org_id", input.orgId);
  await admin.from("organisation_memberships").delete().eq("org_id", input.orgId);
  await admin.from("account_deletion_requests").delete().in("email_normalized", input.emails);
  await admin.from("account_deletion_suppressions").delete().in("email_normalized", input.emails);
  for (const userId of input.userIds) {
    const existing = await admin.auth.admin.getUserById(userId);
    if (existing.data.user?.user_metadata?.deletion_fixture === "true") {
      await admin.auth.admin.deleteUser(userId);
    }
  }
  const org = await admin.from("organisations").select("name").eq("id", input.orgId).maybeSingle();
  if (org.data?.name?.startsWith("Deletion fixture")) {
    await admin.from("organisations").delete().eq("id", input.orgId);
  }
}

async function proveEmpty(admin: SupabaseClient): Promise<void> {
  const email = "deletion-fixture-empty@example.invalid";
  const orgId = randomUUID();
  const userIds: string[] = [];
  try {
    const org = await admin.from("organisations").insert({ id: orgId, name: "Deletion fixture empty" });
    if (org.error) throw new Error(org.error.message);
    const userId = await createFixtureUser(admin, email, orgId, "owner");
    userIds.push(userId);
    const requestId = await insertRequest(admin, { userId, email, otherActiveMemberCount: 0 });
    const phone = `+6421${String(1000000 + Math.floor(Math.random() * 8999999))}`;
    const phoneRow = await admin.from("account_phone_numbers").insert({
      user_id: userId,
      phone_e164: phone,
      phone_display: phone,
      country_code: "NZ",
    });
    if (phoneRow.error) throw new Error(phoneRow.error.message);
    const reminder = await admin.from("marketing_engagement_reminders").insert({
      org_id: orgId,
      kind: "setup",
      recipient_user_id: userId,
      due_at: new Date(Date.now() + 86_400_000).toISOString(),
      milestone_at: new Date().toISOString(),
    });
    if (reminder.error) throw new Error(reminder.error.message);
    const dryRun = await fulfilPersonalDeletion(admin, {
      requestId,
      operatorEmail: operator,
      projectRef: PREVIEW_SUPABASE_PROJECT_REF,
      deleteContact: async () => "deleted",
    });
    let providerBlocked = false;
    try {
      await fulfilPersonalDeletion(admin, {
        requestId,
        operatorEmail: operator,
        projectRef: PREVIEW_SUPABASE_PROJECT_REF,
        confirmation: "delete-personal-account",
        deleteContact: async () => "unconfigured",
      });
    } catch {
      providerBlocked = true;
    }
    const stillThere = await admin.auth.admin.getUserById(userId);
    const executed = await fulfilPersonalDeletion(admin, {
      requestId,
      operatorEmail: operator,
      projectRef: PREVIEW_SUPABASE_PROJECT_REF,
      confirmation: "delete-personal-account",
      deleteContact: async () => "deleted",
    });
    const userAfter = await admin.auth.admin.getUserById(userId);
    const phoneAfter = await admin
      .from("account_phone_numbers")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", userId);
    const orgAfter = await admin.from("organisations").select("id").eq("id", orgId).maybeSingle();
    const calls: string[] = [];
    const retry = await upsertLoopsContact({
      properties: { email, userId, source: "settings", marketingConsent: true },
      mode: "explicit_opt_in",
      marketingConsent: true,
      apiKey: "proof-key",
      fetchImpl: async (input) => {
        calls.push(String(input));
        return { ok: false, status: 500, json: async () => ({}) };
      },
    });
    results.empty =
      dryRun.dryRun &&
      dryRun.plan.executable &&
      !dryRun.completed &&
      providerBlocked &&
      stillThere.data.user?.id === userId &&
      executed.completed &&
      executed.plan.outcome.includes("The Loops contact was deleted") &&
      userAfter.data.user == null &&
      (phoneAfter.count ?? 0) === 0 &&
      orgAfter.data?.id === orgId &&
      retry.ok &&
      retry.skipped === "suppressed" &&
      calls.length === 0 &&
      executed.plan.outcome.includes("The personal login was deleted") &&
      executed.plan.outcome.includes("The company was not closed");
  } finally {
    await cleanup(admin, { orgId, emails: [email], userIds });
  }
}

async function proveReferencesAndMembers(admin: SupabaseClient): Promise<void> {
  const ownerEmail = "deletion-fixture-owner@example.invalid";
  const memberEmail = "deletion-fixture-member@example.invalid";
  const orgId = randomUUID();
  const userIds: string[] = [];
  try {
    const org = await admin.from("organisations").insert({ id: orgId, name: "Deletion fixture members" });
    if (org.error) throw new Error(org.error.message);
    const ownerId = await createFixtureUser(admin, ownerEmail, orgId, "owner");
    const memberId = await createFixtureUser(admin, memberEmail, orgId, "admin");
    userIds.push(ownerId, memberId);
    const project = await admin.from("projects").insert({
      org_id: orgId,
      created_by: memberId,
      title: "Deletion fixture project",
    }).select("id").single();
    if (project.error || !project.data) throw new Error(project.error?.message ?? "project");
    const quote = await admin.from("quotes").insert({
      org_id: orgId,
      project_id: project.data.id,
      created_by: memberId,
      title: "Deletion fixture quote",
      status: "sent",
      sent_at: new Date().toISOString(),
    }).select("id").single();
    if (quote.error || !quote.data) throw new Error(quote.error?.message ?? "quote");

    const requestId = await insertRequest(admin, {
      userId: memberId,
      email: memberEmail,
      otherActiveMemberCount: 1,
    });
    const blocked = await fulfilPersonalDeletion(admin, {
      requestId,
      operatorEmail: operator,
      projectRef: PREVIEW_SUPABASE_PROJECT_REF,
      retainIssuedDocumentsConfirmed: true,
      deleteContact: async () => "unconfigured",
    });
    let refused = false;
    try {
      await fulfilPersonalDeletion(admin, {
        requestId,
        operatorEmail: operator,
        projectRef: PREVIEW_SUPABASE_PROJECT_REF,
        confirmation: "delete-personal-account",
        retainIssuedDocumentsConfirmed: true,
        deleteContact: async () => "unconfigured",
      });
    } catch {
      refused = true;
    }
    const executed = await fulfilPersonalDeletion(admin, {
      requestId,
      operatorEmail: operator,
      projectRef: PREVIEW_SUPABASE_PROJECT_REF,
      confirmation: "delete-personal-account",
      continuingMemberId: ownerId,
      retainIssuedDocumentsConfirmed: true,
      deleteContact: async () => "deleted",
    });
    const memberAfter = await admin.auth.admin.getUserById(memberId);
    const ownerAfter = await admin.auth.admin.getUserById(ownerId);
    const projectAfter = await admin.from("projects").select("id, created_by").eq("id", project.data.id).single();
    const quoteAfter = await admin.from("quotes").select("id, created_by, sent_at").eq("id", quote.data.id).single();
    const ownerMembership = await admin
      .from("organisation_memberships")
      .select("role")
      .eq("user_id", ownerId)
      .eq("status", "active")
      .maybeSingle();
    const ownerProfile = await admin
      .from("profiles")
      .select("org_id, role")
      .eq("id", ownerId)
      .maybeSingle();
    const stored = await admin
      .from("account_deletion_requests")
      .select("status, retained")
      .eq("id", requestId)
      .single();
    const summary = (stored.data?.retained as { summary?: string } | null)?.summary ?? "";
    results.references =
      blocked.dryRun &&
      !blocked.plan.executable &&
      blocked.plan.blockers.includes("continuing_member_required") &&
      refused &&
      memberAfter.data.user == null &&
      ownerAfter.data.user?.id === ownerId &&
      projectAfter.data?.id === project.data.id &&
      projectAfter.data?.created_by === ownerId &&
      quoteAfter.data?.sent_at != null &&
      quoteAfter.data?.created_by == null &&
      ownerMembership.data?.role === "owner" &&
      ownerProfile.data?.role === "owner" &&
      ownerProfile.data?.org_id === orgId &&
      stored.data?.status === "completed" &&
      summary.includes("The personal login was deleted") &&
      summary.includes("not remove them") &&
      executed.completed;
  } finally {
    await cleanup(admin, { orgId, emails: [ownerEmail, memberEmail], userIds });
  }
}

async function proveSoleOwner(admin: SupabaseClient): Promise<void> {
  const email = "deletion-fixture-sole@example.invalid";
  const orgId = randomUUID();
  const userIds: string[] = [];
  try {
    const org = await admin.from("organisations").insert({ id: orgId, name: "Deletion fixture sole" });
    if (org.error) throw new Error(org.error.message);
    const userId = await createFixtureUser(admin, email, orgId, "owner");
    userIds.push(userId);
    const project = await admin.from("projects").insert({
      org_id: orgId,
      created_by: userId,
      title: "Deletion fixture sole project",
    }).select("id").single();
    if (project.error || !project.data) throw new Error(project.error?.message ?? "project");
    const quote = await admin.from("quotes").insert({
      org_id: orgId,
      project_id: project.data.id,
      created_by: userId,
      title: "Deletion fixture sole quote",
      status: "sent",
      sent_at: new Date().toISOString(),
    }).select("id").single();
    if (quote.error || !quote.data) throw new Error(quote.error?.message ?? "quote");
    const subscription = await admin.from("org_subscriptions").insert({
      org_id: orgId,
      billing_environment: "test",
      plan_code: "builder",
      status: "active",
      source: "override",
      paid_seat_quantity: 1,
    }).select("id, status").single();
    if (subscription.error || !subscription.data) {
      throw new Error(subscription.error?.message ?? "subscription");
    }
    const requestId = await insertRequest(admin, { userId, email, otherActiveMemberCount: 0 });
    const dryRun = await fulfilPersonalDeletion(admin, {
      requestId,
      operatorEmail: operator,
      projectRef: PREVIEW_SUPABASE_PROJECT_REF,
      deleteContact: async () => "unconfigured",
    });
    let refused = false;
    try {
      await fulfilPersonalDeletion(admin, {
        requestId,
        operatorEmail: operator,
        projectRef: PREVIEW_SUPABASE_PROJECT_REF,
        confirmation: "delete-personal-account",
        deleteContact: async () => "unconfigured",
      });
    } catch {
      refused = true;
    }
    const stillThere = await admin.auth.admin.getUserById(userId);
    const executed = await fulfilPersonalDeletion(admin, {
      requestId,
      operatorEmail: operator,
      projectRef: PREVIEW_SUPABASE_PROJECT_REF,
      confirmation: "delete-personal-account",
      retainIssuedDocumentsConfirmed: true,
      deleteContact: async () => "deleted",
    });
    const userAfter = await admin.auth.admin.getUserById(userId);
    const projectAfter = await admin.from("projects").select("id, created_by").eq("id", project.data.id).single();
    const quoteAfter = await admin.from("quotes").select("sent_at, created_by").eq("id", quote.data.id).single();
    const subscriptionAfter = await admin
      .from("org_subscriptions")
      .select("status, source")
      .eq("id", subscription.data.id)
      .single();
    const stored = await admin.from("account_deletion_requests").select("status, retained").eq("id", requestId).single();
    const summary = (stored.data?.retained as { summary?: string } | null)?.summary ?? "";
    results.soleOwner =
      dryRun.dryRun &&
      !dryRun.plan.executable &&
      dryRun.plan.blockers.includes("issued_documents_retention_unconfirmed") &&
      !dryRun.plan.blockers.includes("billing_resolution_required") &&
      dryRun.plan.effects.some((effect) => effect.action === "retain" && effect.target === "subscription") &&
      refused &&
      stillThere.data.user?.id === userId &&
      executed.completed &&
      userAfter.data.user == null &&
      projectAfter.data?.id === project.data.id &&
      projectAfter.data?.created_by == null &&
      quoteAfter.data?.sent_at != null &&
      quoteAfter.data?.created_by == null &&
      subscriptionAfter.data?.status === "active" &&
      subscriptionAfter.data?.source === "override" &&
      stored.data?.status === "completed" &&
      summary.includes("no Stripe subscription") &&
      summary.includes("The company was not closed");
  } finally {
    await cleanup(admin, { orgId, emails: [email], userIds });
  }
}

async function proveOwnerLeaves(admin: SupabaseClient): Promise<void> {
  const ownerEmail = "deletion-fixture-departing-owner@example.invalid";
  const memberEmail = "deletion-fixture-next-owner@example.invalid";
  const orgId = randomUUID();
  const userIds: string[] = [];
  try {
    const org = await admin.from("organisations").insert({ id: orgId, name: "Deletion fixture transfer" });
    if (org.error) throw new Error(org.error.message);
    const ownerId = await createFixtureUser(admin, ownerEmail, orgId, "owner");
    const memberId = await createFixtureUser(admin, memberEmail, orgId, "admin");
    userIds.push(ownerId, memberId);
    const project = await admin.from("projects").insert({
      org_id: orgId,
      created_by: ownerId,
      title: "Deletion fixture owned project",
    }).select("id").single();
    if (project.error || !project.data) throw new Error(project.error?.message ?? "project");
    const requestId = await insertRequest(admin, {
      userId: ownerId,
      email: ownerEmail,
      otherActiveMemberCount: 1,
    });
    const executed = await fulfilPersonalDeletion(admin, {
      requestId,
      operatorEmail: operator,
      projectRef: PREVIEW_SUPABASE_PROJECT_REF,
      confirmation: "delete-personal-account",
      continuingMemberId: memberId,
      deleteContact: async () => "deleted",
    });
    const ownerAfter = await admin.auth.admin.getUserById(ownerId);
    const memberProfile = await admin.from("profiles").select("org_id, role").eq("id", memberId).single();
    const memberMembership = await admin
      .from("organisation_memberships")
      .select("role, status")
      .eq("user_id", memberId)
      .maybeSingle();
    const projectAfter = await admin.from("projects").select("created_by").eq("id", project.data.id).single();
    results.ownerTransfer =
      executed.completed &&
      ownerAfter.data.user == null &&
      memberMembership.data?.role === "owner" &&
      memberMembership.data?.status === "active" &&
      memberProfile.data?.role === "owner" &&
      memberProfile.data?.org_id === orgId &&
      projectAfter.data?.created_by === memberId;
  } finally {
    await cleanup(admin, { orgId, emails: [ownerEmail, memberEmail], userIds });
  }
}

async function proveRenewingSubscription(admin: SupabaseClient): Promise<void> {
  const email = "deletion-fixture-renewing@example.invalid";
  const orgId = randomUUID();
  const userIds: string[] = [];
  try {
    const org = await admin.from("organisations").insert({ id: orgId, name: "Deletion fixture renewing" });
    if (org.error) throw new Error(org.error.message);
    const userId = await createFixtureUser(admin, email, orgId, "owner");
    userIds.push(userId);
    const subscription = await admin.from("org_subscriptions").insert({
      org_id: orgId,
      billing_environment: "test",
      plan_code: "builder",
      status: "active",
      source: "stripe",
      stripe_subscription_id: "sub_deletion_fixture_not_real",
      stripe_customer_id: "cus_deletion_fixture_not_real",
      cancel_at_period_end: false,
      paid_seat_quantity: 1,
    }).select("id").single();
    if (subscription.error || !subscription.data) throw new Error(subscription.error?.message ?? "subscription");
    const requestId = await insertRequest(admin, { userId, email, otherActiveMemberCount: 0 });
    let refused = false;
    try {
      await fulfilPersonalDeletion(admin, {
        requestId,
        operatorEmail: operator,
        projectRef: PREVIEW_SUPABASE_PROJECT_REF,
        confirmation: "delete-personal-account",
        deleteContact: async () => "deleted",
      });
    } catch {
      refused = true;
    }
    const userAfter = await admin.auth.admin.getUserById(userId);
    const subscriptionAfter = await admin
      .from("org_subscriptions")
      .select("status, cancel_at_period_end")
      .eq("id", subscription.data.id)
      .single();
    const stored = await admin.from("account_deletion_requests").select("status").eq("id", requestId).single();
    results.renewingBlocked =
      refused &&
      userAfter.data.user?.id === userId &&
      subscriptionAfter.data?.status === "active" &&
      subscriptionAfter.data?.cancel_at_period_end === false &&
      stored.data?.status !== "completed";
  } finally {
    await cleanup(admin, { orgId, emails: [email], userIds });
  }
}

async function proveProviderOverMirror(admin: SupabaseClient): Promise<void> {
  const blockedEmail = "deletion-fixture-mirror@example.invalid";
  const allowedEmail = "deletion-fixture-provider@example.invalid";
  const blockedOrg = randomUUID();
  const allowedOrg = randomUUID();
  const userIds: string[] = [];
  try {
    for (const [orgId, name] of [
      [blockedOrg, "Deletion fixture mirror"],
      [allowedOrg, "Deletion fixture provider"],
    ] as const) {
      const org = await admin.from("organisations").insert({ id: orgId, name });
      if (org.error) throw new Error(org.error.message);
    }
    const blockedUser = await createFixtureUser(admin, blockedEmail, blockedOrg, "owner");
    const allowedUser = await createFixtureUser(admin, allowedEmail, allowedOrg, "owner");
    userIds.push(blockedUser, allowedUser);
    for (const orgId of [blockedOrg, allowedOrg]) {
      const subscription = await admin.from("org_subscriptions").insert({
        org_id: orgId,
        billing_environment: "test",
        plan_code: "builder",
        status: "active",
        source: "stripe",
        stripe_subscription_id: `sub_deletion_fixture_${orgId.slice(0, 8)}`,
        stripe_customer_id: `cus_deletion_fixture_${orgId.slice(0, 8)}`,
        cancel_at_period_end: true,
        current_period_end: "2026-11-01T00:00:00.000Z",
        paid_seat_quantity: 1,
      });
      if (subscription.error) throw new Error(subscription.error.message);
    }
    const blockedRequest = await insertRequest(admin, {
      userId: blockedUser,
      email: blockedEmail,
      otherActiveMemberCount: 0,
    });
    let mirrorRefused = false;
    try {
      await fulfilPersonalDeletion(admin, {
        requestId: blockedRequest,
        operatorEmail: operator,
        projectRef: PREVIEW_SUPABASE_PROJECT_REF,
        confirmation: "delete-personal-account",
        verifyStripeSubscription: async () => ({
          available: true,
          subscriptionId: `sub_deletion_fixture_${blockedOrg.slice(0, 8)}`,
          customerId: `cus_deletion_fixture_${blockedOrg.slice(0, 8)}`,
          status: "active",
          nonRenewing: false,
          cancelAtPeriodEnd: false,
          serviceEnd: null,
          outstanding: false,
        }),
        deleteContact: async () => "deleted",
      });
    } catch {
      mirrorRefused = true;
    }
    const allowedRequest = await insertRequest(admin, {
      userId: allowedUser,
      email: allowedEmail,
      otherActiveMemberCount: 0,
    });
    const allowed = await fulfilPersonalDeletion(admin, {
      requestId: allowedRequest,
      operatorEmail: operator,
      projectRef: PREVIEW_SUPABASE_PROJECT_REF,
      confirmation: "delete-personal-account",
      verifyStripeSubscription: async () => ({
        available: true,
        subscriptionId: `sub_deletion_fixture_${allowedOrg.slice(0, 8)}`,
        customerId: `cus_deletion_fixture_${allowedOrg.slice(0, 8)}`,
        status: "past_due",
        nonRenewing: true,
        cancelAtPeriodEnd: true,
        serviceEnd: "2026-12-15T00:00:00.000Z",
        outstanding: true,
      }),
      deleteContact: async () => "deleted",
    });
    const blockedUserAfter = await admin.auth.admin.getUserById(blockedUser);
    const allowedUserAfter = await admin.auth.admin.getUserById(allowedUser);
    const subscriptionAfter = await admin
      .from("org_subscriptions")
      .select("status, cancel_at_period_end")
      .eq("org_id", allowedOrg)
      .single();
    results.providerOverMirror =
      mirrorRefused &&
      blockedUserAfter.data.user?.id === blockedUser &&
      allowed.completed &&
      allowed.plan.outcome.includes("2026-12-15T00:00:00.000Z") &&
      allowed.plan.outcome.includes("A payment is still outstanding") &&
      allowedUserAfter.data.user == null &&
      subscriptionAfter.data?.status === "active" &&
      subscriptionAfter.data?.cancel_at_period_end === true;
  } finally {
    await cleanup(admin, { orgId: blockedOrg, emails: [blockedEmail], userIds: [userIds[0]].filter(Boolean) });
    await cleanup(admin, { orgId: allowedOrg, emails: [allowedEmail], userIds: [userIds[1]].filter(Boolean) });
  }
}

async function proveOwnerRepair(admin: SupabaseClient): Promise<void> {
  const ownerEmail = "deletion-fixture-ownerless@example.invalid";
  const memberEmail = "deletion-fixture-ownerless-member@example.invalid";
  const orgId = randomUUID();
  const userIds: string[] = [];
  try {
    const org = await admin.from("organisations").insert({ id: orgId, name: "Deletion fixture ownerless" });
    if (org.error) throw new Error(org.error.message);
    const ownerId = await createFixtureUser(admin, ownerEmail, orgId, "owner");
    const memberId = await createFixtureUser(admin, memberEmail, orgId, "admin");
    userIds.push(ownerId, memberId);
    const demoted = await admin
      .from("organisation_memberships")
      .update({ role: "admin" })
      .eq("org_id", orgId)
      .eq("user_id", ownerId);
    if (demoted.error) throw new Error(demoted.error.message);
    const requestId = await insertRequest(admin, {
      userId: ownerId,
      email: ownerEmail,
      otherActiveMemberCount: 1,
    });
    let refused = false;
    try {
      await fulfilPersonalDeletion(admin, {
        requestId,
        operatorEmail: operator,
        projectRef: PREVIEW_SUPABASE_PROJECT_REF,
        confirmation: "delete-personal-account",
        deleteContact: async () => "deleted",
      });
    } catch {
      refused = true;
    }
    const owners = await admin
      .from("organisation_memberships")
      .select("user_id, role")
      .eq("org_id", orgId)
      .eq("status", "active")
      .eq("role", "owner");
    const ownerAfter = await admin.auth.admin.getUserById(ownerId);
    const stored = await admin.from("account_deletion_requests").select("status").eq("id", requestId).single();
    results.ownerRepaired =
      refused &&
      owners.data?.length === 1 &&
      owners.data[0]?.user_id === ownerId &&
      ownerAfter.data.user?.id === ownerId &&
      stored.data?.status !== "completed";
  } finally {
    await cleanup(admin, { orgId, emails: [ownerEmail, memberEmail], userIds });
  }
}

async function proveResume(admin: SupabaseClient): Promise<void> {
  const email = "deletion-fixture-resume@example.invalid";
  const orgId = randomUUID();
  const userIds: string[] = [];
  try {
    const org = await admin.from("organisations").insert({ id: orgId, name: "Deletion fixture resume" });
    if (org.error) throw new Error(org.error.message);
    const userId = await createFixtureUser(admin, email, orgId, "owner");
    userIds.push(userId);
    const requestId = await insertRequest(admin, { userId, email, otherActiveMemberCount: 0 });
    let interrupted = false;
    try {
      await fulfilPersonalDeletion(admin, {
        requestId,
        operatorEmail: operator,
        projectRef: PREVIEW_SUPABASE_PROJECT_REF,
        confirmation: "delete-personal-account",
        deleteContact: async () => "deleted",
        afterLoginRemoved: async () => {
          throw new Error("stop before completion");
        },
      });
    } catch {
      interrupted = true;
    }
    const midway = await admin.from("account_deletion_requests").select("status").eq("id", requestId).single();
    const gone = await admin.auth.admin.getUserById(userId);
    const resumed = await fulfilPersonalDeletion(admin, {
      requestId,
      operatorEmail: operator,
      projectRef: PREVIEW_SUPABASE_PROJECT_REF,
      confirmation: "delete-personal-account",
      deleteContact: async () => "absent",
    });
    const orgAfter = await admin.from("organisations").select("id").eq("id", orgId).maybeSingle();
    results.resume =
      interrupted &&
      midway.data?.status === "processing" &&
      gone.data.user == null &&
      resumed.completed &&
      resumed.plan.outcome.includes("No Loops contact remained") &&
      orgAfter.data?.id === orgId;
  } finally {
    await cleanup(admin, { orgId, emails: [email], userIds });
  }
}

async function main() {
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await proveEmpty(admin);
  await proveReferencesAndMembers(admin);
  await proveOwnerLeaves(admin);
  await proveSoleOwner(admin);
  await proveRenewingSubscription(admin);
  await proveProviderOverMirror(admin);
  await proveOwnerRepair(admin);
  await proveResume(admin);
  const leftover = await admin
    .from("organisations")
    .select("id", { count: "exact", head: true })
    .like("name", "Deletion fixture%");
  results.leftoverOrganisations = (leftover.count ?? 0) === 0;
  console.log(JSON.stringify(results));
  if (
    !results.empty ||
    !results.references ||
    !results.ownerTransfer ||
    !results.soleOwner ||
    !results.renewingBlocked ||
    !results.providerOverMirror ||
    !results.ownerRepaired ||
    !results.resume ||
    !results.leftoverOrganisations
  ) {
    process.exit(1);
  }
}

void main();
