import type { OrgBillingState, PlanCode, StripePriceConfig } from "@/lib/billing/types";

export const CHECKOUT_PLAN_CODES = ["builder", "business"] as const;
export type CheckoutPlanCode = (typeof CHECKOUT_PLAN_CODES)[number];

export function isCheckoutPlanCode(value: unknown): value is CheckoutPlanCode {
  return (
    typeof value === "string" &&
    (CHECKOUT_PLAN_CODES as readonly string[]).includes(value)
  );
}

export function parseCheckoutPlanCode(
  value: unknown
): CheckoutPlanCode | null {
  return isCheckoutPlanCode(value) ? value : null;
}

/**
 * Browser may send only an internal plan code. Server resolves the Price ID.
 */
export function resolveCheckoutPriceId(
  plan: CheckoutPlanCode,
  prices: StripePriceConfig
): string {
  if (plan === "builder") {
    return prices.builderMonthly;
  }
  return prices.businessBaseMonthly;
}

export type CheckoutGuardResult =
  | { ok: true }
  | {
      ok: false;
      errorCode: string;
      errorSafe: string;
      suggestedPath: "portal" | "upgrade" | "none";
    };

function hasBlockingStripeSubscription(
  state: OrgBillingState
): boolean {
  const sub = state.subscription;
  if (!sub) return false;
  if (sub.source !== "stripe") return false;
  if (!sub.stripeSubscriptionId) return false;
  return sub.status !== "cancelled";
}

/**
 * Active / past_due / scheduled_to_cancel Stripe subscriptions must not
 * open a second subscription Checkout. Internal trials and cancelled
 * Stripe rows may convert via Checkout.
 */
export function canCreateSubscriptionCheckout(
  state: OrgBillingState
): CheckoutGuardResult {
  if (state.activeOverride) {
    return {
      ok: false,
      errorCode: "override_blocks_checkout",
      errorSafe:
        "This organisation has a billing agreement managed by Quotr. Contact support instead of Checkout.",
      suggestedPath: "none",
    };
  }

  const sub = state.subscription;
  if (sub && hasBlockingStripeSubscription(state)) {
    if (sub.planCode === "builder") {
      return {
        ok: false,
        errorCode: "active_subscription_exists",
        errorSafe:
          "This organisation already has a subscription. Manage billing or upgrade to Business.",
        suggestedPath: "upgrade",
      };
    }
    return {
      ok: false,
      errorCode: "active_subscription_exists",
      errorSafe:
        "This organisation already has a subscription. Manage billing instead of starting Checkout.",
      suggestedPath: "portal",
    };
  }

  return { ok: true };
}

export function pickReusableOpenCheckoutSession<
  T extends {
    mode?: string | null;
    url?: string | null;
    metadata?: Record<string, string> | null;
    status?: string | null;
  },
>(sessions: ReadonlyArray<T>, plan: CheckoutPlanCode): T | null {
  return (
    sessions.find(
      (session) =>
        session.mode === "subscription" &&
        session.status !== "expired" &&
        session.metadata?.selected_plan === plan &&
        Boolean(session.url)
    ) ?? null
  );
}

export function checkoutSelectedPlanMetadata(
  plan: CheckoutPlanCode
): Record<string, string> {
  return {
    selected_plan: plan,
  };
}

export function isSelfServicePlanCode(
  plan: PlanCode
): plan is CheckoutPlanCode {
  return plan === "builder" || plan === "business";
}
