export const BILLING_ENVIRONMENTS = ["test", "live"] as const;
export type BillingEnvironment = (typeof BILLING_ENVIRONMENTS)[number];

export const PLAN_CODES = ["builder", "business", "custom"] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export const SUBSCRIPTION_SOURCES = [
  "stripe",
  "internal_trial",
  "override",
] as const;
export type SubscriptionSource = (typeof SUBSCRIPTION_SOURCES)[number];

/**
 * Quotr internal subscription status. Do not dump raw Stripe status here.
 * Stripe uses `canceled`; Quotr uses `cancelled`.
 */
export const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "unpaid",
  "paused",
  "cancelled",
  "incomplete",
  "scheduled_to_cancel",
  "administratively_comped",
  "custom_contract",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const STRIPE_SUBSCRIPTION_STATUSES = [
  "incomplete",
  "incomplete_expired",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "paused",
] as const;
export type StripeSubscriptionStatus =
  (typeof STRIPE_SUBSCRIPTION_STATUSES)[number];

export const PROCESSED_EVENT_STATUSES = [
  "received",
  "processed",
  "failed",
  "ignored",
] as const;
export type ProcessedEventStatus = (typeof PROCESSED_EVENT_STATUSES)[number];

export const BILLING_OVERRIDE_TYPES = [
  "administratively_comped",
  "custom_contract",
  "temporary_access",
] as const;
export type BillingOverrideType = (typeof BILLING_OVERRIDE_TYPES)[number];

export type OrgBillingCustomer = {
  id: string;
  orgId: string;
  billingEnvironment: BillingEnvironment;
  stripeCustomerId: string;
  billingName: string | null;
  billingEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrgSubscription = {
  id: string;
  orgId: string;
  billingEnvironment: BillingEnvironment;
  planCode: PlanCode;
  status: SubscriptionStatus;
  source: SubscriptionSource;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  stripeBasePriceId: string | null;
  stripeSeatPriceId: string | null;
  paidSeatQuantity: number;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  cancelledAt: string | null;
  lastStripeEventCreatedAt: string | null;
  lastStripeEventId: string | null;
  /**
   * Start of the current past_due incident. Null when not past_due, or when
   * the incident start is unknown (no backfill). Grace is past_due_since + 7 days.
   */
  pastDueSince: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StripeProcessedEvent = {
  id: string;
  billingEnvironment: BillingEnvironment;
  stripeEventId: string;
  eventType: string;
  status: ProcessedEventStatus;
  receivedAt: string;
  processedAt: string | null;
  errorCode: string | null;
  errorSafe: string | null;
};

export type OrgBillingOverride = {
  id: string;
  orgId: string;
  billingEnvironment: BillingEnvironment;
  planCode: PlanCode;
  overrideType: BillingOverrideType;
  status: string;
  paidSeatQuantity: number;
  startsAt: string;
  expiresAt: string | null;
  reason: string;
  createdBy: string | null;
  operatorRef: string | null;
  createdAt: string;
  /**
   * Optional capability overlays. Resolver/test-only. Not persisted.
   * 046 stores plan/status/seats/expiry only. 047 adds past_due_since on
   * org_subscriptions — not overlay columns. Explicit deny beats plan allow;
   * explicit allow grants otherwise unavailable keys in-memory only.
   * Custom contract v1 uses configured plan/capability basis and seat override.
   * Persistent overlays need a later migration and platform-admin work.
   */
  capabilityAllow?: string[];
  capabilityDeny?: string[];
};

/**
 * Derived access hint for a Quotr-managed no-card trial.
 * Persisted org_subscriptions.status stays `trialing`.
 * BILLING-1 does not enforce this.
 */
export type EffectiveTrialState = "trialing" | "trial_expired";

export type OrgBillingState = {
  orgId: string;
  billingEnvironment: BillingEnvironment;
  customer: OrgBillingCustomer | null;
  subscription: OrgSubscription | null;
  activeOverride: OrgBillingOverride | null;
  effectiveTrialState: EffectiveTrialState | null;
};

export type StripePriceConfig = {
  builderMonthly: string;
  businessBaseMonthly: string;
  businessSeatMonthly: string;
};

export type StripeEventLike = {
  id: string;
  type: string;
  livemode: boolean;
  created: number;
  data: {
    object: Record<string, unknown>;
  };
};

export type StripeSubscriptionItemLike = {
  priceId: string;
  quantity: number;
  currentPeriodStart: number | null;
  currentPeriodEnd: number | null;
};

export type StripeSubscriptionLike = {
  id: string;
  customerId: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  canceledAt: number | null;
  trialEnd: number | null;
  pauseCollection: boolean;
  metadata: Record<string, string>;
  items: StripeSubscriptionItemLike[];
};

export type PlanPriceResolution =
  | {
      ok: true;
      planCode: "builder" | "business";
      stripeBasePriceId: string;
      stripeSeatPriceId: string | null;
      paidSeatQuantity: number;
      extraSeatQuantity: number;
    }
  | { ok: false; errorCode: string; errorSafe: string };
