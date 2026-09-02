import type { OrgBillingOverride, OrgSubscription } from "@/lib/billing/types";
import { deriveInternalTrialAccessState } from "@/lib/billing/trial";

export const PAST_DUE_GRACE_DAYS = 7;
export const CANCELLED_READ_EXPORT_DAYS = 90;

export const ACCESS_CLASSES = [
  "full",
  "full_with_billing_warning",
  "read_export",
  "billing_onboarding",
  "none",
] as const;
export type AccessClass = (typeof ACCESS_CLASSES)[number];

export const EFFECTIVE_BILLING_SOURCES = [
  "override",
  "internal_trial",
  "stripe",
  "none",
] as const;
export type EffectiveBillingSource = (typeof EFFECTIVE_BILLING_SOURCES)[number];

export type EffectiveAccessPolicy = {
  source: EffectiveBillingSource;
  accessClass: AccessClass;
  planCode: "builder" | "business" | "custom" | null;
  billingStatus: string;
  trialExpired: boolean;
  withinPastDueGrace: boolean;
  warning: "payment_past_due" | null;
};

function addDays(iso: string | null, days: number): Date | null {
  if (!iso) return null;
  const start = new Date(iso).getTime();
  if (!Number.isFinite(start)) return null;
  return new Date(start + days * 24 * 60 * 60 * 1000);
}

/**
 * Grace window is [past_due_since, past_due_since + 7 days).
 * The exact +7-day instant is exclusive (not in grace).
 * NULL past_due_since fails closed: no grace.
 * Do not use Stripe watermarks, updated_at, or current_period_end.
 */
export function isWithinPastDueGrace(
  subscription: Pick<OrgSubscription, "status" | "pastDueSince">,
  now: Date
): boolean {
  if (subscription.status !== "past_due") {
    return false;
  }
  const ends = addDays(subscription.pastDueSince, PAST_DUE_GRACE_DAYS);
  if (!ends) {
    return false;
  }
  return now.getTime() < ends.getTime();
}

function overridePlanStatus(override: OrgBillingOverride): {
  planCode: OrgBillingOverride["planCode"];
  billingStatus: string;
} {
  if (override.overrideType === "administratively_comped") {
    return {
      planCode: override.planCode,
      billingStatus: "administratively_comped",
    };
  }
  if (override.overrideType === "custom_contract") {
    return { planCode: override.planCode, billingStatus: "custom_contract" };
  }
  return { planCode: override.planCode, billingStatus: "active" };
}

/**
 * Precedence (deterministic; one org_subscriptions row per org+env):
 * 1. Valid unexpired override (comps / custom / temporary access)
 * 2. Internal trial (including derived trial_expired)
 * 3. Stripe (or override-written) subscription row
 * 4. No paid access / uninitialized
 *
 * Active Stripe and a stale internal trial cannot coexist on the same row:
 * Checkout overwrites source. If source=stripe, Stripe policy applies even
 * when trial_ends_at is in the past.
 */
export function resolveEffectiveAccessPolicy(input: {
  subscription: OrgSubscription | null;
  activeOverride: OrgBillingOverride | null;
  now?: Date;
}): EffectiveAccessPolicy {
  const now = input.now ?? new Date();

  if (input.activeOverride) {
    const mapped = overridePlanStatus(input.activeOverride);
    return {
      source: "override",
      accessClass: "full",
      planCode: mapped.planCode,
      billingStatus: mapped.billingStatus,
      trialExpired: false,
      withinPastDueGrace: false,
      warning: null,
    };
  }

  const subscription = input.subscription;
  if (!subscription) {
    return {
      source: "none",
      accessClass: "none",
      planCode: null,
      billingStatus: "uninitialized",
      trialExpired: false,
      withinPastDueGrace: false,
      warning: null,
    };
  }

  if (subscription.source === "internal_trial") {
    const trial = deriveInternalTrialAccessState(subscription, now);
    if (trial === "trial_expired") {
      return {
        source: "internal_trial",
        accessClass: "read_export",
        planCode: subscription.planCode,
        billingStatus: "trialing",
        trialExpired: true,
        withinPastDueGrace: false,
        warning: null,
      };
    }
    return {
      source: "internal_trial",
      accessClass: "full",
      planCode: "business",
      billingStatus: "trialing",
      trialExpired: false,
      withinPastDueGrace: false,
      warning: null,
    };
  }

  const stripeSource: EffectiveBillingSource =
    subscription.source === "override" ? "override" : "stripe";

  if (subscription.status === "scheduled_to_cancel") {
    const periodEnd = subscription.currentPeriodEnd
      ? new Date(subscription.currentPeriodEnd).getTime()
      : null;
    if (periodEnd != null && Number.isFinite(periodEnd) && now.getTime() > periodEnd) {
      return {
        source: stripeSource,
        accessClass: "read_export",
        planCode: subscription.planCode,
        billingStatus: "cancelled",
        trialExpired: false,
        withinPastDueGrace: false,
        warning: null,
      };
    }
    return {
      source: stripeSource,
      accessClass: "full",
      planCode: subscription.planCode,
      billingStatus: "scheduled_to_cancel",
      trialExpired: false,
      withinPastDueGrace: false,
      warning: null,
    };
  }

  if (subscription.status === "past_due") {
    const withinGrace = isWithinPastDueGrace(subscription, now);
    return {
      source: stripeSource,
      accessClass: withinGrace ? "full_with_billing_warning" : "read_export",
      planCode: subscription.planCode,
      billingStatus: "past_due",
      trialExpired: false,
      withinPastDueGrace: withinGrace,
      warning: "payment_past_due",
    };
  }

  if (subscription.status === "incomplete") {
    return {
      source: stripeSource,
      accessClass: "billing_onboarding",
      planCode: subscription.planCode,
      billingStatus: "incomplete",
      trialExpired: false,
      withinPastDueGrace: false,
      warning: null,
    };
  }

  if (
    subscription.status === "unpaid" ||
    subscription.status === "paused" ||
    subscription.status === "cancelled"
  ) {
    return {
      source: stripeSource,
      accessClass: "read_export",
      planCode: subscription.planCode,
      billingStatus: subscription.status,
      trialExpired: false,
      withinPastDueGrace: false,
      warning: null,
    };
  }

  if (
    subscription.status === "administratively_comped" ||
    subscription.status === "custom_contract"
  ) {
    return {
      source: stripeSource,
      accessClass: "full",
      planCode: subscription.planCode,
      billingStatus: subscription.status,
      trialExpired: false,
      withinPastDueGrace: false,
      warning: null,
    };
  }

  return {
    source: stripeSource,
    accessClass: "full",
    planCode: subscription.planCode,
    billingStatus: subscription.status,
    trialExpired: false,
    withinPastDueGrace: false,
    warning: null,
  };
}
