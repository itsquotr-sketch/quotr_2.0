/**
 * Read-only interpretation of a Stripe subscription.
 * The operator command performs the HTTP read. This module does not hold a
 * secret and does not cancel, update, or create a subscription.
 */

export type StripeProviderCheck =
  | {
      available: true;
      subscriptionId: string;
      customerId: string;
      status: string;
      nonRenewing: boolean;
      cancelAtPeriodEnd: boolean;
      serviceEnd: string | null;
      outstanding: boolean;
    }
  | { available: false; reason: "unavailable" | "mismatch" };

type StripeSubscriptionBody = {
  id?: unknown;
  customer?: unknown;
  status?: unknown;
  cancel_at_period_end?: unknown;
  cancel_at?: unknown;
  current_period_end?: unknown;
  ended_at?: unknown;
  canceled_at?: unknown;
};

function customerIdOf(customer: unknown): string | null {
  if (typeof customer === "string" && customer.trim()) return customer.trim();
  if (customer && typeof customer === "object" && "id" in customer) {
    const id = (customer as { id?: unknown }).id;
    if (typeof id === "string" && id.trim()) return id.trim();
  }
  return null;
}

function unixIso(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return new Date(value * 1000).toISOString();
}

function earlierIso(left: string | null, right: string | null): string | null {
  if (!left) return right;
  if (!right) return left;
  return left < right ? left : right;
}

export function interpretStripeSubscription(input: {
  expectedSubscriptionId: string;
  expectedCustomerId: string;
  httpOk: boolean;
  body: StripeSubscriptionBody | null;
}): StripeProviderCheck {
  if (!input.httpOk || !input.body) return { available: false, reason: "unavailable" };
  const subscriptionId = typeof input.body.id === "string" ? input.body.id : "";
  const customerId = customerIdOf(input.body.customer);
  if (
    !subscriptionId ||
    !customerId ||
    subscriptionId !== input.expectedSubscriptionId ||
    customerId !== input.expectedCustomerId
  ) {
    return { available: false, reason: "mismatch" };
  }

  const status = typeof input.body.status === "string" ? input.body.status : "";
  const cancelAt = typeof input.body.cancel_at === "number" ? input.body.cancel_at : null;
  const openForSchedule = status === "active" || status === "trialing" || status === "past_due";
  const cancelAtPeriodEnd =
    input.body.cancel_at_period_end === true || (cancelAt != null && openForSchedule);
  const ended =
    status === "canceled" || status === "cancelled" || status === "incomplete_expired";
  const nonRenewing = ended || cancelAtPeriodEnd;
  const serviceEnd = ended
    ? unixIso(input.body.ended_at) ?? unixIso(input.body.canceled_at)
    : earlierIso(unixIso(cancelAt), unixIso(input.body.current_period_end));
  const outstanding = status === "past_due" || status === "unpaid";

  return {
    available: true,
    subscriptionId,
    customerId,
    status,
    nonRenewing,
    cancelAtPeriodEnd,
    serviceEnd,
    outstanding,
  };
}

export function stripeProviderDetail(check: StripeProviderCheck): string {
  if (!check.available) {
    return check.reason === "mismatch"
      ? "Stripe ids do not match the stored customer and subscription. The login was not deleted."
      : "Stripe could not be verified. The login was not deleted.";
  }
  if (!check.nonRenewing) {
    return `Stripe confirmed ${check.subscriptionId} for ${check.customerId} is still set to renew with status ${check.status}. The login was not deleted.`;
  }
  const due = check.outstanding ? " A payment is still outstanding." : "";
  const end = check.serviceEnd ? ` Service ends ${check.serviceEnd}.` : "";
  return `Stripe confirmed ${check.subscriptionId} for ${check.customerId}. Status ${check.status}.${due}${end} This request did not change the subscription.`;
}
