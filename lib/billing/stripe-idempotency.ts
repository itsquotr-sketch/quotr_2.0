import type { BillingEnvironment } from "@/lib/billing/types";
import type { CheckoutPlanCode } from "@/lib/billing/checkout-plan";

/**
 * Stripe idempotency keys. Server-only conceptually; these builders are pure
 * and must never be sent from the browser as authority.
 *
 * Stripe keys last 24 hours. Customer create is stable per org+env so retries
 * reuse the same Stripe Customer. Checkout uses a 30s window plus reuse of
 * open sessions. Upgrade is stable per subscription so double-click does not
 * create a second invoice.
 */
export function stripeCustomerCreateIdempotencyKey(
  billingEnvironment: BillingEnvironment,
  orgId: string
): string {
  return `quotr:customer:create:${billingEnvironment}:${orgId}`;
}

export function stripeCheckoutIdempotencyKey(
  orgId: string,
  billingEnvironment: BillingEnvironment,
  plan: CheckoutPlanCode,
  nowMs: number = Date.now()
): string {
  const window = Math.floor(nowMs / 30_000);
  return `quotr:checkout:${billingEnvironment}:${orgId}:${plan}:${window}`;
}

export function stripeUpgradeToBusinessIdempotencyKey(
  billingEnvironment: BillingEnvironment,
  orgId: string,
  stripeSubscriptionId: string
): string {
  return `quotr:upgrade:business:${billingEnvironment}:${orgId}:${stripeSubscriptionId}`;
}

export function resolveCustomerCreateRace(input: {
  mappingAfterCreate: { orgId: string; stripeCustomerId: string } | null;
  createdStripeCustomerId: string;
  orgId: string;
}): "upsert" | "reuse" | "conflict" {
  if (!input.mappingAfterCreate) {
    return "upsert";
  }
  if (
    input.mappingAfterCreate.orgId === input.orgId &&
    input.mappingAfterCreate.stripeCustomerId === input.createdStripeCustomerId
  ) {
    return "reuse";
  }
  return "conflict";
}
