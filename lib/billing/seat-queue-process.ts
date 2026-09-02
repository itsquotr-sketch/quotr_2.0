import "server-only";

import { getOrgBillingState } from "@/lib/billing/server";
import {
  canStartPaidSeatStripeMutation,
  canStartPaidSeatStripeRemoval,
} from "@/lib/billing/seat-mutation-gate";
import { applyPaidSeatDecrease, applyPaidSeatIncrease } from "@/lib/billing/seat-apply";
import { createAdminClient } from "@/lib/supabase/admin";

type ClaimedRow = {
  operation_id: string;
  kind: "add" | "remove";
  membership_id: string | null;
  desired_paid_seat_quantity: number;
};

export type ClaimedSeatProcessResult = {
  didStripe: boolean;
  outcome:
    | "none"
    | "skipped_other"
    | "deferred"
    | "awaiting_mirror"
    | "failed"
    | "completed";
};

/**
 * At most one outbound Stripe seat mutation for this org.
 * Claim happens in SQL (durable unique inflight index). This only executes
 * an already-claimed `pending` operation.
 *
 * Pass `onlyMembershipId` from an invitee's HTTP retry so we never charge
 * someone else's older failed operation on their request.
 */
export async function processClaimedSeatMutationForOrg(
  orgId: string,
  opts?: { onlyMembershipId?: string }
): Promise<ClaimedSeatProcessResult> {
  const admin = createAdminClient();
  const { data } = await admin.rpc("get_pending_claimed_seat_operation_v1", {
    p_org_id: orgId,
  });
  const row = (Array.isArray(data) ? data[0] : data) as ClaimedRow | undefined;
  if (!row?.operation_id) {
    return { didStripe: false, outcome: "none" };
  }

  if (opts?.onlyMembershipId && row.membership_id !== opts.onlyMembershipId) {
    return { didStripe: false, outcome: "skipped_other" };
  }

  const billing = await getOrgBillingState(orgId);
  if (row.kind === "add") {
    const gate = canStartPaidSeatStripeMutation(billing);
    if (!gate.ok) {
      await admin.rpc("mark_seat_operation_status_v1", {
        p_operation_id: row.operation_id,
        p_status: "failed",
        p_error_code: gate.errorCode,
        p_error_safe: gate.errorSafe,
      });
      return { didStripe: false, outcome: "failed" };
    }
    let result;
    try {
      result = await applyPaidSeatIncrease({
        stripeSubscriptionId: gate.stripeSubscriptionId,
        orgId,
        operationId: row.operation_id,
        desiredPaidSeatQuantity: Number(row.desired_paid_seat_quantity),
      });
    } catch {
      await admin.rpc("revert_invitation_acceptance_payment_failed_v1", {
        p_membership_id: row.membership_id,
      });
      return { didStripe: true, outcome: "failed" };
    }
    if (!result.ok || result.pendingPayment) {
      await admin.rpc("revert_invitation_acceptance_payment_failed_v1", {
        p_membership_id: row.membership_id,
      });
      return { didStripe: true, outcome: "failed" };
    }
    await admin.rpc("mark_seat_operation_status_v1", {
      p_operation_id: row.operation_id,
      p_status: "awaiting_mirror",
      p_stripe_subscription_id: gate.stripeSubscriptionId,
    });
    if (row.membership_id) {
      await admin.rpc("activate_membership_if_seats_paid_v1", {
        p_membership_id: row.membership_id,
      });
    }
    return { didStripe: true, outcome: "awaiting_mirror" };
  }

  const removeGate = canStartPaidSeatStripeRemoval(billing);
  if (!removeGate.ok) {
    await admin.rpc("mark_seat_operation_status_v1", {
      p_operation_id: row.operation_id,
      p_status: "queued",
      p_error_code: removeGate.errorCode,
      p_error_safe: removeGate.errorSafe,
    });
    return { didStripe: false, outcome: "deferred" };
  }
  try {
    await applyPaidSeatDecrease({
      stripeSubscriptionId: removeGate.stripeSubscriptionId,
      orgId,
      operationId: row.operation_id,
      desiredPaidSeatQuantity: Number(row.desired_paid_seat_quantity),
    });
    await admin.rpc("mark_seat_operation_status_v1", {
      p_operation_id: row.operation_id,
      p_status: "completed",
      p_stripe_subscription_id: removeGate.stripeSubscriptionId,
    });
  } catch {
    await admin.rpc("mark_seat_operation_status_v1", {
      p_operation_id: row.operation_id,
      p_status: "queued",
      p_error_code: "remove_sync_failed",
      p_error_safe: "The user was removed. Billing will catch up shortly.",
    });
    return { didStripe: true, outcome: "deferred" };
  }
  return { didStripe: true, outcome: "completed" };
}

/**
 * After Stripe mirror paid_seat_quantity changes: activate covered
 * pending members, claim at most one next operation, then one Stripe call.
 * Errors here must not fail the webhook HTTP status.
 */
export async function advanceSeatQueueAfterMirror(orgId: string): Promise<void> {
  const admin = createAdminClient();
  await admin.rpc("try_activate_pending_memberships_for_org", {
    p_org_id: orgId,
  });
  await admin.rpc("claim_next_seat_operation_v1", {
    p_org_id: orgId,
    p_only_membership_id: null,
  });
  await processClaimedSeatMutationForOrg(orgId);
}
