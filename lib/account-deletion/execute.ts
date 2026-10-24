import type { SupabaseClient } from "@supabase/supabase-js";
import {
  confirmationMatches,
  deletionOutcome,
  planPersonalDeletion,
  soleOwnerStripe,
  type DeletionFacts,
  type DeletionPlan,
} from "@/lib/account-deletion/plan";
import type { StripeProviderCheck } from "@/lib/account-deletion/stripe-verification";
import {
  deletionProjectAllowed,
  isDeletionOperator,
} from "@/lib/account-deletion/operator";
import { normalizeDeletionEmail } from "@/lib/account-deletion/request";
import { deleteLoopsContact } from "@/lib/communications/loops-client";

const ACTIVE_STATUSES = ["requested", "verified", "processing"] as const;

const CLEAR_AUTHOR: Array<[string, string]> = [
  ["quotes", "created_by"],
  ["pricing_documents", "created_by"],
  ["project_notes", "captured_by"],
  ["note_proposals", "created_by"],
  ["note_proposals", "reviewed_by"],
];

const RESTRICTED_AUTHOR: Array<[string, string]> = [
  ["projects", "created_by"],
  ["calibration_responses", "created_by"],
  ["productivity_calibration_responses", "created_by"],
  ["subcontractor_rate_applications", "applied_by"],
];

type FulfilResult = {
  dryRun: boolean;
  plan: DeletionPlan;
  completed: boolean;
};

function missingTable(error: { code?: string; message?: string }): boolean {
  return error.code === "42P01" || (error.message ?? "").includes("does not exist");
}

async function countWhere(
  admin: SupabaseClient,
  table: string,
  column: string,
  value: string
): Promise<number> {
  const { count, error } = await admin
    .from(table)
    .select(column, { count: "exact", head: true })
    .eq(column, value);
  if (error) {
    if (missingTable(error)) return 0;
    throw new Error(`Could not read ${table} before deletion.`);
  }
  return count ?? 0;
}

async function setAuthor(
  admin: SupabaseClient,
  table: string,
  column: string,
  fromUserId: string,
  nextUserId: string | null
): Promise<void> {
  const { error } = await admin
    .from(table)
    .update({ [column]: nextUserId })
    .eq(column, fromUserId);
  if (error) {
    if (missingTable(error)) return;
    throw new Error(
      `Could not detach ${table}.${column}. The login was not deleted.`
    );
  }
}

async function loadFacts(
  admin: SupabaseClient,
  input: {
    requestId: string;
    operatorEmail: string;
    continuingMemberId?: string | null;
    retainIssuedDocumentsConfirmed: boolean;
  }
): Promise<{ facts: DeletionFacts; userId: string | null; status: string }> {
  const { data: request, error } = await admin
    .from("account_deletion_requests")
    .select("email_normalized, identity_confirmed, status, user_id")
    .eq("id", input.requestId)
    .maybeSingle();
  if (error || !request) throw new Error("Deletion request was not found.");
  const email = normalizeDeletionEmail(request.email_normalized);
  if (!email) throw new Error("Deletion request has no email.");

  let userId = request.user_id as string | null;
  if (!userId) {
    const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const match = listed.data.users.find(
      (user) => normalizeDeletionEmail(user.email ?? "") === email
    );
    userId = match?.id ?? null;
  }

  let organisationId: string | null = null;
  let otherActiveMemberCount = 0;
  let targetIsOwner = false;
  if (userId) {
    const { data: membership } = await admin
      .from("organisation_memberships")
      .select("org_id, role")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    organisationId = membership?.org_id ?? null;
    targetIsOwner = membership?.role === "owner";
    if (organisationId) {
      const { count, error: memberError } = await admin
        .from("organisation_memberships")
        .select("id", { count: "exact", head: true })
        .eq("org_id", organisationId)
        .eq("status", "active");
      if (memberError) throw new Error("Could not read membership before deletion.");
      otherActiveMemberCount = Math.max(0, (count ?? 0) - 1);
    }
  }

  const issuedQuoteCount = organisationId
    ? await (async () => {
        const { count, error: quoteError } = await admin
          .from("quotes")
          .select("id", { count: "exact", head: true })
          .eq("org_id", organisationId)
          .not("sent_at", "is", null);
        if (quoteError) throw new Error("Could not read issued quotes before deletion.");
        return count ?? 0;
      })()
    : 0;

  let subscriptionStatus: string | null = null;
  let subscriptionSource: string | null = null;
  let stripeSubscriptionId: string | null = null;
  let stripeCustomerId: string | null = null;
  let cancelAtPeriodEnd = false;
  let currentPeriodEnd: string | null = null;
  if (organisationId) {
    const { data: subscription, error: subscriptionError } = await admin
      .from("org_subscriptions")
      .select(
        "status, source, cancel_at_period_end, current_period_end, stripe_subscription_id, stripe_customer_id"
      )
      .eq("org_id", organisationId)
      .limit(1)
      .maybeSingle();
    if (subscriptionError) throw new Error("Could not read the subscription before deletion.");
    subscriptionStatus = subscription?.status ?? null;
    subscriptionSource = subscription?.source ?? null;
    stripeSubscriptionId = subscription?.stripe_subscription_id ?? null;
    stripeCustomerId = subscription?.stripe_customer_id ?? null;
    cancelAtPeriodEnd = subscription?.cancel_at_period_end === true;
    currentPeriodEnd = subscription?.current_period_end ?? null;
  }

  let restrictedAuthorCount = 0;
  let detachableAuthorCount = 0;
  if (userId) {
    for (const [table, column] of RESTRICTED_AUTHOR) {
      restrictedAuthorCount += await countWhere(admin, table, column, userId);
    }
    for (const [table, column] of CLEAR_AUTHOR) {
      detachableAuthorCount += await countWhere(admin, table, column, userId);
    }
  }

  const continuingMemberId =
    input.continuingMemberId && input.continuingMemberId !== userId
      ? input.continuingMemberId
      : null;

  return {
    userId,
    status: request.status as string,
    facts: {
      targetEmail: email,
      operatorEmail: input.operatorEmail,
      identityConfirmed: request.identity_confirmed === true,
      otherActiveMemberCount,
      targetIsOwner,
      issuedQuoteCount,
      subscriptionStatus,
      subscriptionSource,
      stripeSubscriptionId,
      stripeCustomerId,
      stripeProvider: null,
      cancelAtPeriodEnd,
      currentPeriodEnd,
      restrictedAuthorCount,
      detachableAuthorCount,
      organisationId,
      continuingMemberId,
      retainIssuedDocumentsConfirmed: input.retainIssuedDocumentsConfirmed,
    },
  };
}

async function activeOwnerIds(admin: SupabaseClient, orgId: string): Promise<string[]> {
  const { data, error } = await admin
    .from("organisation_memberships")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("status", "active")
    .eq("role", "owner");
  if (error) throw new Error("Could not read the company owner. The login was not deleted.");
  return (data ?? []).map((row) => row.user_id as string);
}

async function setMembershipRole(
  admin: SupabaseClient,
  input: { orgId: string; userId: string; role: "owner" | "admin"; changedBy?: string }
): Promise<void> {
  const { error } = await admin
    .from("organisation_memberships")
    .update({
      role: input.role,
      role_changed_at: new Date().toISOString(),
      ...(input.changedBy ? { role_changed_by: input.changedBy } : {}),
    })
    .eq("org_id", input.orgId)
    .eq("user_id", input.userId)
    .eq("status", "active");
  if (error) throw new Error("Ownership could not be changed. The login was not deleted.");
}

async function transferOwnership(
  admin: SupabaseClient,
  input: { orgId: string; fromUserId: string; toUserId: string }
): Promise<void> {
  const { data: successor, error: successorError } = await admin
    .from("organisation_memberships")
    .select("id, role")
    .eq("org_id", input.orgId)
    .eq("user_id", input.toUserId)
    .eq("status", "active")
    .maybeSingle();
  if (successorError || !successor) {
    throw new Error("The continuing member is not an active member of this company. The login was not deleted.");
  }

  let owners = await activeOwnerIds(admin, input.orgId);
  if (owners.length === 0) {
    await setMembershipRole(admin, { orgId: input.orgId, userId: input.fromUserId, role: "owner" });
    owners = await activeOwnerIds(admin, input.orgId);
    if (!owners.includes(input.fromUserId)) {
      throw new Error("The company has no active owner. The login was not deleted.");
    }
  }
  if (successor.role === "owner" || owners.includes(input.toUserId)) {
    const confirmedOwners = await activeOwnerIds(admin, input.orgId);
    if (confirmedOwners.length < 1 || !confirmedOwners.includes(input.toUserId)) {
      throw new Error("The company has no active owner. The login was not deleted.");
    }
  } else if (!owners.includes(input.fromUserId)) {
    throw new Error("The named member is not the active owner. The login was not deleted.");
  } else {
    await setMembershipRole(admin, { orgId: input.orgId, userId: input.fromUserId, role: "admin" });
    try {
      await setMembershipRole(admin, {
        orgId: input.orgId,
        userId: input.toUserId,
        role: "owner",
        changedBy: input.toUserId,
      });
    } catch (error) {
      await setMembershipRole(admin, { orgId: input.orgId, userId: input.fromUserId, role: "owner" });
      throw error;
    }
    const confirmedOwners = await activeOwnerIds(admin, input.orgId);
    if (confirmedOwners.length !== 1 || confirmedOwners[0] !== input.toUserId) {
      if (!confirmedOwners.includes(input.toUserId)) {
        await setMembershipRole(admin, { orgId: input.orgId, userId: input.fromUserId, role: "owner" });
      }
      throw new Error("The company would have no active owner. The login was not deleted.");
    }
  }

  const confirmed = await admin
    .from("organisation_memberships")
    .select("role")
    .eq("org_id", input.orgId)
    .eq("user_id", input.toUserId)
    .eq("status", "active")
    .maybeSingle();
  const profile = await admin
    .from("profiles")
    .select("org_id, role")
    .eq("id", input.toUserId)
    .maybeSingle();
  if (
    confirmed.error ||
    confirmed.data?.role !== "owner" ||
    profile.error ||
    profile.data?.org_id !== input.orgId ||
    profile.data?.role !== "owner"
  ) {
    throw new Error("The continuing member cannot administer this company. The login was not deleted.");
  }
}

async function withStripeProvider(
  facts: DeletionFacts,
  verify: FulfilInput["verifyStripeSubscription"]
): Promise<DeletionFacts> {
  if (!soleOwnerStripe(facts)) return facts;
  if (!facts.stripeSubscriptionId || !facts.stripeCustomerId) {
    return { ...facts, stripeProvider: { available: false, reason: "mismatch" } };
  }
  if (!verify) return { ...facts, stripeProvider: { available: false, reason: "unavailable" } };
  try {
    const stripeProvider = await verify({
      subscriptionId: facts.stripeSubscriptionId,
      customerId: facts.stripeCustomerId,
    });
    return { ...facts, stripeProvider };
  } catch {
    return { ...facts, stripeProvider: { available: false, reason: "unavailable" } };
  }
}

type FulfilInput = {
  requestId: string;
  operatorEmail: string;
  projectRef: string;
  confirmation?: string;
  continuingMemberId?: string | null;
  retainIssuedDocumentsConfirmed?: boolean;
  deleteContact?: (email: string) => Promise<"deleted" | "absent" | "unconfigured" | "failed">;
  verifyStripeSubscription?: (input: {
    subscriptionId: string;
    customerId: string;
  }) => Promise<StripeProviderCheck>;
  afterLoginRemoved?: () => Promise<void>;
};

async function markCompleted(
  admin: SupabaseClient,
  input: { requestId: string; operatorEmail: string; plan: DeletionPlan; provider: "deleted" | "absent" }
): Promise<FulfilResult> {
  const effects = input.plan.effects.map((effect) =>
    effect.action === "delete" && effect.target === "loops_contact"
      ? {
          ...effect,
          detail:
            input.provider === "absent"
              ? "No Loops contact remained."
              : "The Loops contact was deleted.",
        }
      : effect
  );
  const outcome = deletionOutcome(effects);
  const completed = await admin
    .from("account_deletion_requests")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      operator_email: input.operatorEmail,
      retained: { summary: outcome, effects },
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.requestId)
    .neq("status", "completed");
  if (completed.error) {
    throw new Error("The login was deleted, but the request row was not marked completed.");
  }
  return {
    dryRun: false,
    plan: { ...input.plan, lifecycle: "completed", outcome, effects },
    completed: true,
  };
}

export async function fulfilPersonalDeletion(
  admin: SupabaseClient,
  input: FulfilInput
): Promise<FulfilResult> {
  if (!isDeletionOperator(input.operatorEmail)) {
    throw new Error("This operator cannot fulfil a deletion request.");
  }
  const executing = confirmationMatches(input.confirmation);
  if (!deletionProjectAllowed(input.projectRef, executing ? "execute" : "dry-run")) {
    throw new Error(
      executing
        ? "Deletion execution is limited to the Preview project."
        : "Deletion fulfilment is limited to the Preview project."
    );
  }

  const loaded = await loadFacts(admin, {
    requestId: input.requestId,
    operatorEmail: input.operatorEmail,
    continuingMemberId: input.continuingMemberId,
    retainIssuedDocumentsConfirmed: input.retainIssuedDocumentsConfirmed === true,
  });
  const facts = await withStripeProvider(loaded.facts, input.verifyStripeSubscription);
  const plan = planPersonalDeletion(facts);
  if (loaded.status === "completed") {
    return {
      dryRun: true,
      completed: true,
      plan: {
        ...plan,
        lifecycle: "completed",
        executable: false,
        effects: plan.effects.filter((effect) => effect.action === "retain"),
      },
    };
  }
  if (!executing) {
    return { dryRun: true, plan, completed: false };
  }
  if (!loaded.userId) {
    if (loaded.status !== "processing" || !facts.identityConfirmed || !plan.outcome) {
      throw new Error("This request cannot be fulfilled. No account was deleted.");
    }
    const provider = input.deleteContact
      ? await input.deleteContact(facts.targetEmail)
      : await deleteLoopsContact({ email: facts.targetEmail });
    if (provider !== "deleted" && provider !== "absent") {
      throw new Error("The Loops contact was not removed. The request was not marked completed.");
    }
    return markCompleted(admin, {
      requestId: input.requestId,
      operatorEmail: input.operatorEmail,
      plan,
      provider,
    });
  }
  if (!ACTIVE_STATUSES.includes(loaded.status as (typeof ACTIVE_STATUSES)[number])) {
    throw new Error("This request is not open for fulfilment.");
  }

  const lookup = await admin.auth.admin.getUserById(loaded.userId);
  if (lookup.error && !/not found/i.test(lookup.error.message)) {
    throw new Error("Could not read the login. The login was not deleted.");
  }
  if (lookup.data.user && facts.organisationId) {
    const ownersNow = await activeOwnerIds(admin, facts.organisationId);
    if (ownersNow.length === 0) {
      await setMembershipRole(admin, {
        orgId: facts.organisationId,
        userId: loaded.userId,
        role: "owner",
      });
      const repaired = await activeOwnerIds(admin, facts.organisationId);
      if (!repaired.includes(loaded.userId)) {
        throw new Error("The company has no active owner. The login was not deleted.");
      }
      const reloaded = await loadFacts(admin, {
        requestId: input.requestId,
        operatorEmail: input.operatorEmail,
        continuingMemberId: input.continuingMemberId,
        retainIssuedDocumentsConfirmed: input.retainIssuedDocumentsConfirmed === true,
      });
      Object.assign(facts, await withStripeProvider(reloaded.facts, input.verifyStripeSubscription));
      Object.assign(plan, planPersonalDeletion(facts));
    }
  }
  if (!lookup.data.user) {
    if (!facts.identityConfirmed) {
      throw new Error("This request cannot be fulfilled. No account was deleted.");
    }
    const provider = input.deleteContact
      ? await input.deleteContact(facts.targetEmail)
      : await deleteLoopsContact({ email: facts.targetEmail });
    if (provider !== "deleted" && provider !== "absent") {
      throw new Error("The Loops contact was not removed. The request was not marked completed.");
    }
    const phoneLeft = await countWhere(admin, "account_phone_numbers", "user_id", loaded.userId);
    const profileLeft = await countWhere(admin, "profiles", "id", loaded.userId);
    const queueLeft = await countWhere(admin, "marketing_engagement_reminders", "recipient_user_id", loaded.userId);
    if (phoneLeft > 0 || profileLeft > 0 || queueLeft > 0) {
      throw new Error("Personal records still remain. The request was not marked completed.");
    }
    if (!plan.outcome) {
      throw new Error("The billing check is not available. The request was not marked completed.");
    }
    return markCompleted(admin, { requestId: input.requestId, operatorEmail: input.operatorEmail, plan, provider });
  }
  if (!plan.executable) {
    throw new Error("This request cannot be fulfilled. No account was deleted.");
  }

  const processing = await admin
    .from("account_deletion_requests")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("id", input.requestId)
    .in("status", [...ACTIVE_STATUSES]);
  if (processing.error) throw new Error("The request could not be marked processing.");

  const { error: suppressionError } = await admin.from("account_deletion_suppressions").insert({
    email_normalized: loaded.facts.targetEmail,
    reason: "Personal login deleted. Later contact sync must not create this person again.",
  });
  if (suppressionError && suppressionError.code !== "23505") {
    throw new Error("The contact suppression was not recorded. The login was not deleted.");
  }
  const reminders = await admin
    .from("marketing_engagement_reminders")
    .update({ suppressed_at: new Date().toISOString() })
    .eq("recipient_user_id", loaded.userId)
    .is("released_at", null)
    .is("suppressed_at", null);
  if (reminders.error && !missingTable(reminders.error)) {
    throw new Error("A queued reminder could not be stopped. The login was not deleted.");
  }

  const provider = input.deleteContact
    ? await input.deleteContact(facts.targetEmail)
    : await deleteLoopsContact({ email: facts.targetEmail });
  if (provider !== "deleted" && provider !== "absent") {
    throw new Error("The Loops contact was not removed. The login was not deleted.");
  }

  const ownerIds = facts.organisationId ? await activeOwnerIds(admin, facts.organisationId) : [];
  const needsTransfer = Boolean(
    facts.continuingMemberId &&
      facts.organisationId &&
      facts.otherActiveMemberCount > 0 &&
      (facts.targetIsOwner || ownerIds.length === 0)
  );
  if (needsTransfer && facts.organisationId && facts.continuingMemberId) {
    await transferOwnership(admin, {
      orgId: facts.organisationId,
      fromUserId: loaded.userId,
      toUserId: facts.continuingMemberId,
    });
  } else if (facts.continuingMemberId && facts.organisationId) {
    const successor = await admin
      .from("organisation_memberships")
      .select("id")
      .eq("org_id", loaded.facts.organisationId)
      .eq("user_id", facts.continuingMemberId)
      .eq("status", "active")
      .maybeSingle();
    if (successor.error || !successor.data) {
      throw new Error("The continuing member is not an active member of this company. The login was not deleted.");
    }
  }

  for (const [table, column] of CLEAR_AUTHOR) {
    await setAuthor(admin, table, column, loaded.userId, null);
  }
  const authorDestination = facts.continuingMemberId;
  for (const [table, column] of RESTRICTED_AUTHOR) {
    await setAuthor(admin, table, column, loaded.userId, authorDestination);
  }
  let remaining = 0;
  for (const [table, column] of RESTRICTED_AUTHOR) {
    remaining += await countWhere(admin, table, column, loaded.userId);
  }
  if (remaining > 0) {
    throw new Error("A personal author pointer is still required. The login was not deleted.");
  }

  if (facts.otherActiveMemberCount > 0 && facts.organisationId) {
    const owners = await activeOwnerIds(admin, facts.organisationId);
    if (owners.length < 1 || owners.includes(loaded.userId)) {
      throw new Error("The company would be left without an active owner. The login was not deleted.");
    }
  }

  const removed = await admin.auth.admin.deleteUser(loaded.userId);
  if (removed.error) {
    const again = await admin.auth.admin.getUserById(loaded.userId);
    if (again.data.user) throw new Error("The login was not deleted.");
  }
  if (input.afterLoginRemoved) await input.afterLoginRemoved();

  const phoneLeft = await countWhere(admin, "account_phone_numbers", "user_id", loaded.userId);
  const profileLeft = await countWhere(admin, "profiles", "id", loaded.userId);
  const queueLeft = await countWhere(admin, "marketing_engagement_reminders", "recipient_user_id", loaded.userId);
  if (phoneLeft > 0 || profileLeft > 0 || queueLeft > 0) {
    throw new Error("Personal records still remain. The request was not marked completed.");
  }

  return markCompleted(admin, {
    requestId: input.requestId,
    operatorEmail: input.operatorEmail,
    plan,
    provider,
  });
}
