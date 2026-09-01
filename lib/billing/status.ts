import type {
  StripeSubscriptionStatus,
  SubscriptionStatus,
} from "@/lib/billing/types";

export type StripeStatusMapInput = {
  stripeStatus: string;
  cancelAtPeriodEnd: boolean;
  pauseCollection: boolean;
};

/**
 * Stripe subscription state → Quotr internal status.
 * cancel_at_period_end while still within the paid period → scheduled_to_cancel.
 * Stripe `canceled` → `cancelled`. pause_collection → paused (even if Stripe
 * status remains active).
 */
export function mapStripeSubscriptionStatus(
  input: StripeStatusMapInput
): SubscriptionStatus {
  if (input.pauseCollection && input.stripeStatus !== "canceled") {
    return "paused";
  }

  if (
    input.cancelAtPeriodEnd &&
    (input.stripeStatus === "active" ||
      input.stripeStatus === "trialing" ||
      input.stripeStatus === "past_due")
  ) {
    return "scheduled_to_cancel";
  }

  switch (input.stripeStatus as StripeSubscriptionStatus | string) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "unpaid":
      return "unpaid";
    case "paused":
      return "paused";
    case "canceled":
    case "incomplete_expired":
      return "cancelled";
    case "incomplete":
      return "incomplete";
    default:
      return "incomplete";
  }
}
