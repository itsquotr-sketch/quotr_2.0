import type {
  BillingEnvironment,
  OrgSubscription,
  PlanCode,
} from "@/lib/billing/types";

export type BillingReconciliationIssueKind =
  | "missing_mirror"
  | "missing_stripe"
  | "seat_mismatch"
  | "plan_mismatch"
  | "status_mismatch"
  | "environment_mismatch";

export type BillingReconciliationIssue = {
  kind: BillingReconciliationIssueKind;
  orgId?: string;
  stripeSubscriptionId?: string | null;
  detail: string;
};

export type StripeReconciliationSnapshot = {
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  planCode: PlanCode;
  paidSeatQuantity: number;
  livemode: boolean;
};

/**
 * Future BILLING-4+ command shape. Not scheduled.
 * Compare Stripe vs org_subscriptions vs paid seats.
 */
export function diffStripeAgainstMirror(input: {
  billingEnvironment: BillingEnvironment;
  mirrors: OrgSubscription[];
  stripe: StripeReconciliationSnapshot[];
}): BillingReconciliationIssue[] {
  const issues: BillingReconciliationIssue[] = [];
  const mirrorsByStripe = new Map(
    input.mirrors
      .filter((row) => row.stripeSubscriptionId)
      .map((row) => [row.stripeSubscriptionId as string, row])
  );
  const stripeById = new Map(
    input.stripe.map((row) => [row.stripeSubscriptionId, row])
  );

  for (const snapshot of input.stripe) {
    const expectedLive = input.billingEnvironment === "live";
    if (snapshot.livemode !== expectedLive) {
      issues.push({
        kind: "environment_mismatch",
        stripeSubscriptionId: snapshot.stripeSubscriptionId,
        detail: "Stripe livemode does not match billing environment.",
      });
    }
    const mirror = mirrorsByStripe.get(snapshot.stripeSubscriptionId);
    if (!mirror) {
      issues.push({
        kind: "missing_mirror",
        stripeSubscriptionId: snapshot.stripeSubscriptionId,
        detail: "Stripe subscription has no org_subscriptions row.",
      });
      continue;
    }
    if (mirror.planCode !== snapshot.planCode) {
      issues.push({
        kind: "plan_mismatch",
        orgId: mirror.orgId,
        stripeSubscriptionId: snapshot.stripeSubscriptionId,
        detail: "Plan code differs from Stripe Price mapping.",
      });
    }
    if (mirror.paidSeatQuantity !== snapshot.paidSeatQuantity) {
      issues.push({
        kind: "seat_mismatch",
        orgId: mirror.orgId,
        stripeSubscriptionId: snapshot.stripeSubscriptionId,
        detail: "paid_seat_quantity differs from Stripe seat mapping.",
      });
    }
  }

  for (const mirror of input.mirrors) {
    if (mirror.source !== "stripe" || !mirror.stripeSubscriptionId) {
      continue;
    }
    if (!stripeById.has(mirror.stripeSubscriptionId)) {
      issues.push({
        kind: "missing_stripe",
        orgId: mirror.orgId,
        stripeSubscriptionId: mirror.stripeSubscriptionId,
        detail: "org_subscriptions Stripe id was not found in Stripe.",
      });
    }
  }

  return issues;
}
