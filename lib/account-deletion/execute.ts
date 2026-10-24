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

type FulfilResult = {
  dryRun: boolean;
  plan: DeletionPlan;
  completed: boolean;
};

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
  if (error) throw new Error(`Could not read ${table} before deletion.`);
  return count ?? 0;
}

async function loadFacts(
  admin: SupabaseClient,
  input: {
  requestId: string;
  operatorEmail: string;
}): Promise<{ facts: DeletionFacts; userId: string | null; status: string }> {
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
  if (userId) {
    const { data: membership } = await admin
      .from("organisation_memberships")
      .select("org_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    organisationId = membership?.org_id ?? null;
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

  let blockingReferenceCount = 0;
  if (userId) {
    const tables: Array<[string, string]> = [
      ["projects", "created_by"],
      ["quotes", "created_by"],
      ["pricing_documents", "created_by"],
      ["project_notes", "captured_by"],
      ["note_proposals", "created_by"],
    ];
    for (const [table, column] of tables) {
      blockingReferenceCount += await countWhere(admin, table, column, userId);
    }
  }

  return {
    userId,
    status: request.status as string,
    facts: {
      targetEmail: email,
      operatorEmail: input.operatorEmail,
      identityConfirmed: request.identity_confirmed === true,
      otherActiveMemberCount,
      issuedQuoteCount,
      subscriptionStatus,
      blockingReferenceCount,
      organisationId,
    },
  };
}

export async function fulfilPersonalDeletion(
  admin: SupabaseClient,
  input: {
  requestId: string;
  operatorEmail: string;
  projectRef: string;
  confirmation?: string;
  deleteContact?: (email: string) => Promise<"deleted" | "unconfigured" | "failed">;
}): Promise<FulfilResult> {
  if (!isDeletionOperator(input.operatorEmail)) {
    throw new Error("This operator cannot fulfil a deletion request.");
  }
  if (!deletionProjectAllowed(input.projectRef)) {
    throw new Error("Deletion fulfilment is limited to the Preview project.");
  }

  const loaded = await loadFacts(admin, input);
  const plan = planPersonalDeletion(loaded.facts);
  if (loaded.status === "completed") {
    return {
      dryRun: true,
      completed: true,
      plan: { ...plan, lifecycle: "completed", executable: false, effects: plan.effects.filter((effect) => effect.action === "retain") },
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
      retained: plan.effects.filter((effect) => effect.action === "retain"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.requestId);
  if (completed.error) {
    throw new Error("The login was deleted, but the request row was not marked completed.");
  }

  return { dryRun: false, plan: { ...plan, lifecycle: "completed" }, completed: true };
}
