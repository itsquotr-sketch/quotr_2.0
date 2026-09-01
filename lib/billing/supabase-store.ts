import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  BillingEnvironment,
  OrgBillingCustomer,
  OrgBillingOverride,
  OrgSubscription,
} from "@/lib/billing/types";
import type { BillingStore, EventClaimRecord } from "@/lib/billing/store";

type CustomerRow = {
  id: string;
  org_id: string;
  billing_environment: BillingEnvironment;
  stripe_customer_id: string;
  billing_name: string | null;
  billing_email: string | null;
  created_at: string;
  updated_at: string;
};

type SubscriptionRow = {
  id: string;
  org_id: string;
  billing_environment: BillingEnvironment;
  plan_code: OrgSubscription["planCode"];
  status: OrgSubscription["status"];
  source: OrgSubscription["source"];
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  stripe_base_price_id: string | null;
  stripe_seat_price_id: string | null;
  paid_seat_quantity: number;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
  last_stripe_event_created_at: string | null;
  last_stripe_event_id: string | null;
  created_at: string;
  updated_at: string;
};

type OverrideRow = {
  id: string;
  org_id: string;
  billing_environment: BillingEnvironment;
  plan_code: OrgBillingOverride["planCode"];
  override_type: OrgBillingOverride["overrideType"];
  status: string;
  paid_seat_quantity: number;
  starts_at: string;
  expires_at: string | null;
  reason: string;
  created_by: string | null;
  operator_ref: string | null;
  created_at: string;
};

type EventRow = {
  stripe_event_id: string;
  event_type: string;
  status: EventClaimRecord["status"];
};

function mapCustomer(row: CustomerRow): OrgBillingCustomer {
  return {
    id: row.id,
    orgId: row.org_id,
    billingEnvironment: row.billing_environment,
    stripeCustomerId: row.stripe_customer_id,
    billingName: row.billing_name,
    billingEmail: row.billing_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSubscription(row: SubscriptionRow): OrgSubscription {
  return {
    id: row.id,
    orgId: row.org_id,
    billingEnvironment: row.billing_environment,
    planCode: row.plan_code,
    status: row.status,
    source: row.source,
    stripeSubscriptionId: row.stripe_subscription_id,
    stripeCustomerId: row.stripe_customer_id,
    stripeBasePriceId: row.stripe_base_price_id,
    stripeSeatPriceId: row.stripe_seat_price_id,
    paidSeatQuantity: row.paid_seat_quantity,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    trialEndsAt: row.trial_ends_at,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    cancelledAt: row.cancelled_at,
    lastStripeEventCreatedAt: row.last_stripe_event_created_at,
    lastStripeEventId: row.last_stripe_event_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapOverride(row: OverrideRow): OrgBillingOverride {
  return {
    id: row.id,
    orgId: row.org_id,
    billingEnvironment: row.billing_environment,
    planCode: row.plan_code,
    overrideType: row.override_type,
    status: row.status,
    paidSeatQuantity: row.paid_seat_quantity,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    reason: row.reason,
    createdBy: row.created_by,
    operatorRef: row.operator_ref,
    createdAt: row.created_at,
  };
}

function subscriptionWrite(row: OrgSubscription) {
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      row.id
    );
  return {
    ...(uuid ? { id: row.id } : {}),
    org_id: row.orgId,
    billing_environment: row.billingEnvironment,
    plan_code: row.planCode,
    status: row.status,
    source: row.source,
    stripe_subscription_id: row.stripeSubscriptionId,
    stripe_customer_id: row.stripeCustomerId,
    stripe_base_price_id: row.stripeBasePriceId,
    stripe_seat_price_id: row.stripeSeatPriceId,
    paid_seat_quantity: row.paidSeatQuantity,
    current_period_start: row.currentPeriodStart,
    current_period_end: row.currentPeriodEnd,
    trial_ends_at: row.trialEndsAt,
    cancel_at_period_end: row.cancelAtPeriodEnd,
    cancelled_at: row.cancelledAt,
    last_stripe_event_created_at: row.lastStripeEventCreatedAt,
    last_stripe_event_id: row.lastStripeEventId,
  };
}

export function createSupabaseBillingStore(): BillingStore {
  const admin = createAdminClient();

  const getProcessedEvent: BillingStore["getProcessedEvent"] = async (
    stripeEventId,
    billingEnvironment
  ) => {
    const { data, error } = await admin
      .from("stripe_processed_events")
      .select("stripe_event_id, event_type, status")
      .eq("stripe_event_id", stripeEventId)
      .eq("billing_environment", billingEnvironment)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row = data as EventRow;
    return {
      stripeEventId: row.stripe_event_id,
      eventType: row.event_type,
      status: row.status,
    };
  };

  return {
    async getCustomerByOrg(orgId, billingEnvironment) {
      const { data, error } = await admin
        .from("org_billing_customers")
        .select("*")
        .eq("org_id", orgId)
        .eq("billing_environment", billingEnvironment)
        .maybeSingle();
      if (error) throw error;
      return data ? mapCustomer(data as CustomerRow) : null;
    },

    async getCustomerByStripeId(stripeCustomerId, billingEnvironment) {
      const { data, error } = await admin
        .from("org_billing_customers")
        .select("*")
        .eq("stripe_customer_id", stripeCustomerId)
        .eq("billing_environment", billingEnvironment)
        .maybeSingle();
      if (error) throw error;
      return data ? mapCustomer(data as CustomerRow) : null;
    },

    async upsertCustomer(row) {
      const { data, error } = await admin
        .from("org_billing_customers")
        .upsert(
          {
            org_id: row.orgId,
            billing_environment: row.billingEnvironment,
            stripe_customer_id: row.stripeCustomerId,
            billing_name: row.billingName,
            billing_email: row.billingEmail,
          },
          { onConflict: "org_id,billing_environment" }
        )
        .select("*")
        .single();
      if (error) throw error;
      return mapCustomer(data as CustomerRow);
    },

    async getSubscriptionByOrg(orgId, billingEnvironment) {
      const { data, error } = await admin
        .from("org_subscriptions")
        .select("*")
        .eq("org_id", orgId)
        .eq("billing_environment", billingEnvironment)
        .maybeSingle();
      if (error) throw error;
      return data ? mapSubscription(data as SubscriptionRow) : null;
    },

    async getSubscriptionByStripeId(stripeSubscriptionId, billingEnvironment) {
      const { data, error } = await admin
        .from("org_subscriptions")
        .select("*")
        .eq("stripe_subscription_id", stripeSubscriptionId)
        .eq("billing_environment", billingEnvironment)
        .maybeSingle();
      if (error) throw error;
      return data ? mapSubscription(data as SubscriptionRow) : null;
    },

    async upsertSubscription(row) {
      const payload = subscriptionWrite(row);
      const { data, error } = await admin
        .from("org_subscriptions")
        .upsert(payload, { onConflict: "org_id,billing_environment" })
        .select("*")
        .single();
      if (error) throw error;
      return mapSubscription(data as SubscriptionRow);
    },

    async patchSubscription(orgId, billingEnvironment, patch) {
      const update: Record<string, unknown> = {};
      if (patch.planCode !== undefined) update.plan_code = patch.planCode;
      if (patch.status !== undefined) update.status = patch.status;
      if (patch.source !== undefined) update.source = patch.source;
      if (patch.stripeSubscriptionId !== undefined) {
        update.stripe_subscription_id = patch.stripeSubscriptionId;
      }
      if (patch.stripeCustomerId !== undefined) {
        update.stripe_customer_id = patch.stripeCustomerId;
      }
      if (patch.stripeBasePriceId !== undefined) {
        update.stripe_base_price_id = patch.stripeBasePriceId;
      }
      if (patch.stripeSeatPriceId !== undefined) {
        update.stripe_seat_price_id = patch.stripeSeatPriceId;
      }
      if (patch.paidSeatQuantity !== undefined) {
        update.paid_seat_quantity = patch.paidSeatQuantity;
      }
      if (patch.currentPeriodStart !== undefined) {
        update.current_period_start = patch.currentPeriodStart;
      }
      if (patch.currentPeriodEnd !== undefined) {
        update.current_period_end = patch.currentPeriodEnd;
      }
      if (patch.trialEndsAt !== undefined) update.trial_ends_at = patch.trialEndsAt;
      if (patch.cancelAtPeriodEnd !== undefined) {
        update.cancel_at_period_end = patch.cancelAtPeriodEnd;
      }
      if (patch.cancelledAt !== undefined) update.cancelled_at = patch.cancelledAt;
      if (patch.lastStripeEventCreatedAt !== undefined) {
        update.last_stripe_event_created_at = patch.lastStripeEventCreatedAt;
      }
      if (patch.lastStripeEventId !== undefined) {
        update.last_stripe_event_id = patch.lastStripeEventId;
      }
      const { data, error } = await admin
        .from("org_subscriptions")
        .update(update)
        .eq("org_id", orgId)
        .eq("billing_environment", billingEnvironment)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data ? mapSubscription(data as SubscriptionRow) : null;
    },

    async listOverrides(orgId, billingEnvironment) {
      const { data, error } = await admin
        .from("org_billing_overrides")
        .select("*")
        .eq("org_id", orgId)
        .eq("billing_environment", billingEnvironment);
      if (error) throw error;
      return ((data ?? []) as OverrideRow[]).map(mapOverride);
    },

    getProcessedEvent,

    async claimProcessedEvent(input) {
      const { data, error } = await admin
        .from("stripe_processed_events")
        .insert({
          billing_environment: input.billingEnvironment,
          stripe_event_id: input.stripeEventId,
          event_type: input.eventType,
          status: "received",
        })
        .select("stripe_event_id, event_type, status")
        .maybeSingle();

      if (!error && data) {
        return { inserted: true, existing: null };
      }
      if (error && error.code !== "23505") {
        throw error;
      }
      const existing = await getProcessedEvent(
        input.stripeEventId,
        input.billingEnvironment
      );
      return { inserted: false, existing };
    },

    async finalizeProcessedEvent(input) {
      const { error } = await admin
        .from("stripe_processed_events")
        .update({
          status: input.status,
          processed_at: new Date().toISOString(),
          error_code: input.errorCode ?? null,
          error_safe: input.errorSafe ?? null,
        })
        .eq("stripe_event_id", input.stripeEventId)
        .eq("billing_environment", input.billingEnvironment);
      if (error) throw error;
    },
  };
}
