import type { OrgBillingState, SubscriptionStatus } from "@/lib/billing/types";

/**
 * New paid-seat Stripe charges and new invitations require a genuinely
 * chargeable Business subscription. BILLING-2 past_due grace still allows
 * existing work; it does not authorize new seat invoices.
 *
 * Internal no-card trial has no team entitlement. Stripe `trialing` is not
 * used for self-service seats in this product.
 */

export const PAID_SEAT_STRIPE_ALLOWED_STATUSES = ["active"] as const;

const BLOCKED_SEAT_ADD_STATUSES: readonly SubscriptionStatus[] = [
  "past_due",
  "unpaid",
  "paused",
  "cancelled",
  "incomplete",
  "scheduled_to_cancel",
  "trialing",
  "administratively_comped",
  "custom_contract",
];

export function isPaidSeatStripeBlockedStatus(
  status: SubscriptionStatus | null | undefined
): boolean {
  if (!status) return true;
  return (BLOCKED_SEAT_ADD_STATUSES as readonly string[]).includes(status);
}

function isChargeableBusiness(state: OrgBillingState): boolean {
  const sub = state.subscription;
  if (!sub) return false;
  if (state.activeOverride) return false;
  return (
    sub.source === "stripe" &&
    sub.planCode === "business" &&
    sub.status === "active" &&
    Boolean(sub.stripeSubscriptionId)
  );
}

/** Owner may send a new invitation only on active paid Business. */
export function canCreatePaidSeatInvitation(
  state: OrgBillingState
): { ok: true } | { ok: false; errorCode: string; errorSafe: string } {
  const sub = state.subscription;
  if (sub?.status === "scheduled_to_cancel") {
    return {
      ok: false,
      errorCode: "subscription_scheduled_to_cancel",
      errorSafe:
        "This subscription is scheduled to end. Resume your Business subscription before adding another user.",
    };
  }
  if (!isChargeableBusiness(state)) {
    return {
      ok: false,
      errorCode: "billing_not_active",
      errorSafe:
        "Your Business subscription needs to be active before you can add another user.",
    };
  }
  return { ok: true };
}

/** Start a new Stripe seat-add (or claim a queued add) only when chargeable. */
export function canStartPaidSeatStripeMutation(
  state: OrgBillingState
): { ok: true; stripeSubscriptionId: string } | { ok: false; errorCode: string; errorSafe: string } {
  const invite = canCreatePaidSeatInvitation(state);
  if (!invite.ok) return invite;
  const id = state.subscription?.stripeSubscriptionId;
  if (!id) {
    return {
      ok: false,
      errorCode: "billing_not_active",
      errorSafe:
        "Your Business subscription needs to be active before you can add another user.",
    };
  }
  return { ok: true, stripeSubscriptionId: id };
}

/**
 * Seat-remove Stripe sync may run while past_due / scheduled_to_cancel
 * (access is already revoked). Do not issue it after cancelled.
 */
export function canStartPaidSeatStripeRemoval(
  state: OrgBillingState
): { ok: true; stripeSubscriptionId: string } | { ok: false; errorCode: string; errorSafe: string } {
  const sub = state.subscription;
  if (!sub?.stripeSubscriptionId || sub.source !== "stripe") {
    return {
      ok: false,
      errorCode: "remove_sync_unavailable",
      errorSafe: "The user was removed. Billing will catch up shortly.",
    };
  }
  if (sub.status === "cancelled" || sub.status === "incomplete") {
    return {
      ok: false,
      errorCode: "remove_sync_unavailable",
      errorSafe: "The user was removed. Billing will catch up shortly.",
    };
  }
  return { ok: true, stripeSubscriptionId: sub.stripeSubscriptionId };
}
