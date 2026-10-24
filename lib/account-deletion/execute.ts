import type { SupabaseClient } from "@supabase/supabase-js";
import {
  confirmationMatches,
  planPersonalDeletion,
  type DeletionFacts,
  type DeletionPlan,
} from "@/lib/account-deletion/plan";
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
    .select("id", { count: "exact", head: true })
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
    retainSubscriptionConfirmed: boolean;
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
  if (organisationId) {
    const { data: subscription, error: subscriptionError } = await admin
      .from("org_subscriptions")
      .select("status")
      .eq("org_id", organisationId)
      .limit(1)
      .maybeSingle();
    if (subscriptionError) throw new Error("Could not read the subscription before deletion.");
    subscriptionStatus = subscription?.status ?? null;
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
      restrictedAuthorCount,
      detachableAuthorCount,
      organisationId,
      continuingMemberId,
      retainSubscriptionConfirmed: input.retainSubscriptionConfirmed,
      retainIssuedDocumentsConfirmed: input.retainIssuedDocumentsConfirmed,
    },
  };
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
  if (successor.role !== "owner") {
    const demoted = await admin
      .from("organisation_memberships")
      .update({ role: "admin", role_changed_at: new Date().toISOString() })
      .eq("org_id", input.orgId)
      .eq("user_id", input.fromUserId)
      .eq("status", "active")
      .eq("role", "owner");
    if (demoted.error) {
      throw new Error("Ownership could not be released. The login was not deleted.");
    }
    const promoted = await admin
      .from("organisation_memberships")
      .update({
        role: "owner",
        role_changed_at: new Date().toISOString(),
        role_changed_by: input.toUserId,
      })
      .eq("id", successor.id);
    if (promoted.error) {
      throw new Error("Ownership could not be transferred. The login was not deleted.");
    }
    await admin.from("profiles").update({ role: "owner" }).eq("id", input.toUserId);
  }
}

export async function fulfilPersonalDeletion(
  admin: SupabaseClient,
  input: {
    requestId: string;
    operatorEmail: string;
    projectRef: string;
    confirmation?: string;
    continuingMemberId?: string | null;
    retainSubscriptionConfirmed?: boolean;
    retainIssuedDocumentsConfirmed?: boolean;
    deleteContact?: (email: string) => Promise<"deleted" | "unconfigured" | "failed">;
  }
): Promise<FulfilResult> {
  if (!isDeletionOperator(input.operatorEmail)) {
    throw new Error("This operator cannot fulfil a deletion request.");
  }
  if (!deletionProjectAllowed(input.projectRef)) {
    throw new Error("Deletion fulfilment is limited to the Preview project.");
  }

  const loaded = await loadFacts(admin, {
    requestId: input.requestId,
    operatorEmail: input.operatorEmail,
    continuingMemberId: input.continuingMemberId,
    retainSubscriptionConfirmed: input.retainSubscriptionConfirmed === true,
    retainIssuedDocumentsConfirmed: input.retainIssuedDocumentsConfirmed === true,
  });
  const plan = planPersonalDeletion(loaded.facts);
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
  if (!confirmationMatches(input.confirmation)) {
    return { dryRun: true, plan, completed: false };
  }
  if (!plan.executable || !loaded.userId) {
    throw new Error("This request cannot be fulfilled. No account was deleted.");
  }
  if (!ACTIVE_STATUSES.includes(loaded.status as (typeof ACTIVE_STATUSES)[number])) {
    throw new Error("This request is not open for fulfilment.");
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
  const provider = input.deleteContact
    ? await input.deleteContact(loaded.facts.targetEmail)
    : await deleteLoopsContact({ email: loaded.facts.targetEmail });
  if (provider === "failed") {
    throw new Error("The contact provider was not updated. The login was not deleted.");
  }

  if (
    loaded.facts.continuingMemberId &&
    loaded.facts.targetIsOwner &&
    loaded.facts.otherActiveMemberCount > 0 &&
    loaded.facts.organisationId
  ) {
    await transferOwnership(admin, {
      orgId: loaded.facts.organisationId,
      fromUserId: loaded.userId,
      toUserId: loaded.facts.continuingMemberId,
    });
  } else if (loaded.facts.continuingMemberId && loaded.facts.organisationId) {
    const successor = await admin
      .from("organisation_memberships")
      .select("id")
      .eq("org_id", loaded.facts.organisationId)
      .eq("user_id", loaded.facts.continuingMemberId)
      .eq("status", "active")
      .maybeSingle();
    if (successor.error || !successor.data) {
      throw new Error("The continuing member is not an active member of this company. The login was not deleted.");
    }
  }

  for (const [table, column] of CLEAR_AUTHOR) {
    await setAuthor(admin, table, column, loaded.userId, null);
  }
  const authorDestination = loaded.facts.continuingMemberId;
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

  const removed = await admin.auth.admin.deleteUser(loaded.userId);
  if (removed.error) {
    throw new Error("The login was not deleted.");
  }

  const completed = await admin
    .from("account_deletion_requests")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      operator_email: input.operatorEmail,
      retained: { summary: plan.outcome, effects: plan.effects },
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.requestId);
  if (completed.error) {
    throw new Error("The login was deleted, but the request row was not marked completed.");
  }

  return { dryRun: false, plan: { ...plan, lifecycle: "completed" }, completed: true };
}
