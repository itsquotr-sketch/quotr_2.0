import {
  TRIAL_DURATION_DAYS,
  TRIAL_ENTITLEMENT_BASIS_PLAN,
  TRIAL_INCLUDED_USERS,
} from "@/lib/billing/plans";
import type {
  BillingEnvironment,
  EffectiveTrialState,
  OrgSubscription,
} from "@/lib/billing/types";

/**
 * Quotr-managed no-card trial exists BEFORE a Stripe Customer/subscription.
 * Represented as org_subscriptions source=internal_trial, status=trialing,
 * plan_code=business, paid_seat_quantity=1, nullable Stripe ids.
 * BILLING-1 does not start trials on signup.
 */
export function buildInternalTrialSubscription(input: {
  id: string;
  orgId: string;
  billingEnvironment: BillingEnvironment;
  now?: Date;
  trialEndsAt?: Date;
}): OrgSubscription {
  const now = input.now ?? new Date();
  const trialEndsAt =
    input.trialEndsAt ??
    new Date(now.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);
  const isoNow = now.toISOString();

  return {
    id: input.id,
    orgId: input.orgId,
    billingEnvironment: input.billingEnvironment,
    planCode: TRIAL_ENTITLEMENT_BASIS_PLAN,
    status: "trialing",
    source: "internal_trial",
    stripeSubscriptionId: null,
    stripeCustomerId: null,
    stripeBasePriceId: null,
    stripeSeatPriceId: null,
    paidSeatQuantity: TRIAL_INCLUDED_USERS,
    currentPeriodStart: isoNow,
    currentPeriodEnd: trialEndsAt.toISOString(),
    trialEndsAt: trialEndsAt.toISOString(),
    cancelAtPeriodEnd: false,
    cancelledAt: null,
    lastStripeEventCreatedAt: null,
    lastStripeEventId: null,
    createdAt: isoNow,
    updatedAt: isoNow,
  };
}

export function isNoCardInternalTrial(
  subscription: Pick<
    OrgSubscription,
    "source" | "status" | "stripeCustomerId" | "stripeSubscriptionId"
  >
): boolean {
  return (
    subscription.source === "internal_trial" &&
    subscription.status === "trialing" &&
    subscription.stripeCustomerId == null &&
    subscription.stripeSubscriptionId == null
  );
}

/**
 * Future BILLING-2 resolver. Persisted status remains `trialing`.
 * `trial_expired` is derived from trial_ends_at, never stored in BILLING-1.
 */
export function deriveInternalTrialAccessState(
  subscription: Pick<OrgSubscription, "source" | "status" | "trialEndsAt">,
  now: Date = new Date()
): EffectiveTrialState | null {
  if (subscription.source !== "internal_trial") {
    return null;
  }
  if (subscription.status !== "trialing") {
    return null;
  }
  if (!subscription.trialEndsAt) {
    return "trialing";
  }
  const ends = new Date(subscription.trialEndsAt).getTime();
  if (!Number.isFinite(ends)) {
    return "trialing";
  }
  if (now.getTime() >= ends) {
    return "trial_expired";
  }
  return "trialing";
}
