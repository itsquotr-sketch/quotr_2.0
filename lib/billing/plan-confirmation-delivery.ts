import "server-only";

import { after } from "next/server";
import { teamInviteFromHeader } from "@/lib/email/application-email";
import {
  isPlanConfirmationDeliveryEnabled,
  isWebsiteBillingUrl,
  planConfirmationFactsFromStripe,
  planConfirmationSkipReason,
  PLAN_CONFIRMATION_PREVIEW_TEST_RECIPIENT,
  PLAN_CONFIRMATION_PRODUCTION_BILLING_URL,
  resolvePlanConfirmationEnvironment,
  selectPaidPlanRecipient,
  type PaidPlanConfirmationSignal,
  type PlanConfirmationFacts,
} from "@/lib/billing/plan-confirmation";
import {
  createPlanConfirmationStore,
  deliverPaidPlanConfirmation,
  type PlanConfirmationDeliveryResult,
} from "@/lib/billing/plan-confirmation-send";
import { readStripePriceConfig } from "@/lib/billing/prices";
import { getStripeClient } from "@/lib/billing/stripe";
import { billingPortalReturnUrl } from "@/lib/billing/urls";
import { getQuoteDeliveryProvider } from "@/lib/quotes/delivery-provider";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function deliverId(
  admin: SupabaseClient,
  deliveryId: string,
  allowRecipient?: (email: string) => boolean
): Promise<PlanConfirmationDeliveryResult> {
  return deliverPaidPlanConfirmation({
    deliveryId,
    store: createPlanConfirmationStore(admin),
    provider: getQuoteDeliveryProvider(),
    from: teamInviteFromHeader(),
    allowRecipient,
  });
}

async function confirmedOwnerEmails(
  admin: SupabaseClient,
  orgId: string
): Promise<string[]> {
  const { data, error } = await admin
    .from("organisation_memberships")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("role", "owner")
    .eq("status", "active");
  if (error || !Array.isArray(data)) return [];
  const emails: string[] = [];
  for (const row of data) {
    const userId = text(asRecord(row)?.user_id);
    if (!userId) continue;
    const user = await admin.auth.admin.getUserById(userId);
    const email = user.data.user?.email ?? null;
    if (user.data.user?.email_confirmed_at && email) emails.push(email);
  }
  return emails;
}

async function saveSnapshot(
  admin: SupabaseClient,
  deliveryId: string,
  recipientEmail: string,
  facts: PlanConfirmationFacts,
  billingUrl: string
): Promise<string | null> {
  const { error } = await admin.rpc("save_paid_plan_confirmation_snapshot_v1", {
    p_id: deliveryId,
    p_recipient_email: recipientEmail,
    p_company_name: "",
    p_plan_code: facts.planCode,
    p_included_users: facts.includedUsers,
    p_paid_users: facts.paidUsers,
    p_currency: facts.currency,
    p_recurring_exclusive_cents: facts.recurringExclusiveCents,
    p_recurring_tax_cents: facts.recurringTaxCents,
    p_tax_display_name: facts.taxDisplayName,
    p_tax_percent: facts.taxPercent,
    p_tax_inclusive: facts.taxInclusive,
    p_opening_exclusive_cents: facts.openingExclusiveCents,
    p_opening_tax_cents: facts.openingTaxCents,
    p_opening_total_cents: facts.openingTotalCents,
    p_opening_kind: facts.openingKind,
    p_next_billing_at: facts.nextBillingAt,
    p_billing_url: billingUrl,
  });
  if (!error) return null;
  const message = error.message ?? "";
  const code = message.includes("PLAN:") ? message.slice(message.indexOf("PLAN:")).split(/\s/)[0] : "PLAN:SNAPSHOT";
  return code;
}

/**
 * Reads the verified Stripe subscription after the mirror write. A status
 * that is no longer active does not send “your plan is active”.
 */
async function prepareActivation(
  admin: SupabaseClient,
  deliveryId: string,
  signal: PaidPlanConfirmationSignal
): Promise<PlanConfirmationDeliveryResult | null> {
  const prices = readStripePriceConfig();
  if (!prices) {
    await admin.rpc("fail_paid_plan_confirmation_v1", {
      p_id: deliveryId,
      p_error_safe: "Stripe prices are not configured.",
    });
    return {
      outcome: "failed",
      providerMessageId: null,
      idempotencyKey: null,
      recipientEmail: null,
    };
  }

  let billingUrl: string;
  try {
    billingUrl =
      resolvePlanConfirmationEnvironment() === "production"
        ? PLAN_CONFIRMATION_PRODUCTION_BILLING_URL
        : billingPortalReturnUrl();
  } catch {
    await admin.rpc("fail_paid_plan_confirmation_v1", {
      p_id: deliveryId,
      p_error_safe: "The billing website link is not configured.",
    });
    return {
      outcome: "failed",
      providerMessageId: null,
      idempotencyKey: null,
      recipientEmail: null,
    };
  }

  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(signal.stripeSubscriptionId, {
    expand: [
      "latest_invoice",
      "latest_invoice.total_tax_amounts.tax_rate",
      "default_tax_rates",
      "customer",
      "items.data.price",
    ],
  });
  const payload = JSON.parse(JSON.stringify(subscription)) as Record<string, unknown>;
  const facts = planConfirmationFactsFromStripe({
    billingEnvironment: signal.billingEnvironment,
    expectedCustomerId: signal.stripeCustomerId,
    prices,
    subscription: payload,
  });
  if (!facts.ok) {
    await admin.rpc("fail_paid_plan_confirmation_v1", {
      p_id: deliveryId,
      p_error_safe: "The paid subscription was not active with a readable price.",
    });
    return {
      outcome: "failed",
      providerMessageId: null,
      idempotencyKey: null,
      recipientEmail: null,
    };
  }

  const customerRecord = asRecord(payload.customer);
  const stripeCustomerEmail = text(customerRecord?.email);
  const stored = await admin
    .from("org_billing_customers")
    .select("billing_email")
    .eq("org_id", signal.orgId)
    .eq("billing_environment", signal.billingEnvironment)
    .eq("stripe_customer_id", signal.stripeCustomerId)
    .maybeSingle();
  const owners = await confirmedOwnerEmails(admin, signal.orgId);
  const recipient = selectPaidPlanRecipient({
    stripeCustomerEmail,
    storedBillingEmail: text(asRecord(stored.data)?.billing_email),
    confirmedOwnerEmails: owners,
  });
  if (!recipient.ok) {
    await admin.rpc("fail_paid_plan_confirmation_v1", {
      p_id: deliveryId,
      p_error_safe: planConfirmationSkipReason(recipient.reason),
    });
    return {
      outcome: "failed",
      providerMessageId: null,
      idempotencyKey: null,
      recipientEmail: null,
    };
  }

  const snapshotError = await saveSnapshot(
    admin,
    deliveryId,
    recipient.email,
    facts.facts,
    billingUrl
  );
  if (snapshotError) {
    await admin.rpc("fail_paid_plan_confirmation_v1", {
      p_id: deliveryId,
      p_error_safe: "The plan confirmation could not be saved for delivery.",
    });
    return {
      outcome: "failed",
      providerMessageId: null,
      idempotencyKey: null,
      recipientEmail: null,
    };
  }
  return null;
}

export async function deliverPaidPlanConfirmationById(
  deliveryId: string,
  signal?: PaidPlanConfirmationSignal
): Promise<PlanConfirmationDeliveryResult> {
  const admin = createAdminClient();
  if (signal) {
    const { data } = await admin
      .from("plan_confirmation_deliveries")
      .select("recipient_email, recurring_exclusive_cents, status")
      .eq("id", deliveryId)
      .maybeSingle();
    const row = asRecord(data);
    const ready = text(row?.recipient_email) && typeof row?.recurring_exclusive_cents === "number";
    if (!ready && row?.status !== "accepted") {
      const prepared = await prepareActivation(admin, deliveryId, signal);
      if (prepared) return prepared;
    }
  }
  return deliverId(admin, deliveryId);
}

/**
 * Enqueue is a separate database call after the subscription mirror write.
 * Sending runs after the webhook response. Either failure leaves the
 * subscription active.
 */
export async function schedulePaidPlanConfirmation(
  signal: PaidPlanConfirmationSignal
): Promise<void> {
  try {
    if (!isPlanConfirmationDeliveryEnabled()) return;
    const environment = resolvePlanConfirmationEnvironment();
    if (!environment) return;
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("enqueue_paid_plan_confirmation_v1", {
      p_org_id: signal.orgId,
      p_billing_environment: signal.billingEnvironment,
      p_environment: environment,
      p_stripe_subscription_id: signal.stripeSubscriptionId,
      p_stripe_customer_id: signal.stripeCustomerId,
    });
    if (error) return;
    const row = asRecord(data);
    const deliveryId = text(row?.id);
    const status = text(row?.status);
    // Eligibility was already decided by the subscription transition.
    // An existing pending row for that same subscription still uses one
    // idempotency key. Accepted rows are not sent again.
    if (!deliveryId || status === "accepted" || text(row?.provider_message_id)) {
      return;
    }
    after(async () => {
      try {
        await deliverPaidPlanConfirmationById(deliveryId, signal);
      } catch {
        // The row stays pending or failed. The same idempotency key retries.
      }
    });
  } catch {
    // Plan confirmation must not block subscription activation.
  }
}

export async function sendPreviewPlanConfirmationTest(input: {
  planCode: "builder" | "business";
  includedUsers: number;
  paidUsers: number;
  currency: string;
  recurringExclusiveCents: number;
  recurringTaxCents: number;
  taxDisplayName: string;
  taxPercent: number;
  taxInclusive: boolean;
  openingExclusiveCents: number;
  openingTaxCents: number;
  openingTotalCents: number;
  openingKind: "prorated" | "discounted" | "prorated_discounted";
  nextBillingAt: string;
  billingUrl: string;
}): Promise<PlanConfirmationDeliveryResult & { recipientMatched: boolean; errorCode?: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("enqueue_paid_plan_confirmation_preview_test_v1", {
    p_plan_code: input.planCode,
    p_included_users: input.includedUsers,
    p_paid_users: input.paidUsers,
    p_currency: input.currency,
    p_recurring_exclusive_cents: input.recurringExclusiveCents,
    p_recurring_tax_cents: input.recurringTaxCents,
    p_tax_display_name: input.taxDisplayName,
    p_tax_percent: input.taxPercent,
    p_tax_inclusive: input.taxInclusive,
    p_opening_exclusive_cents: input.openingExclusiveCents,
    p_opening_tax_cents: input.openingTaxCents,
    p_opening_total_cents: input.openingTotalCents,
    p_opening_kind: input.openingKind,
    p_next_billing_at: input.nextBillingAt,
    p_billing_url: input.billingUrl,
  });
  if (error || !data) {
    const message = error?.message ?? "";
    const errorCode = message.includes("PLAN:")
      ? message.slice(message.indexOf("PLAN:")).split(/\s/)[0]
      : "enqueue";
    return {
      outcome: "failed",
      providerMessageId: null,
      idempotencyKey: null,
      recipientEmail: null,
      recipientMatched: false,
      errorCode,
    };
  }
  const row = asRecord(data);
  const deliveryId = text(row?.id);
  const recipient = text(row?.recipient_email);
  const recipientMatched = recipient === PLAN_CONFIRMATION_PREVIEW_TEST_RECIPIENT;
  if (!deliveryId || !recipientMatched) {
    return {
      outcome: "refused",
      providerMessageId: text(row?.provider_message_id),
      idempotencyKey: text(row?.idempotency_key),
      recipientEmail: recipient,
      recipientMatched: false,
    };
  }
  if (row?.status !== "accepted" && isWebsiteBillingUrl(input.billingUrl)) {
    await admin
      .from("plan_confirmation_deliveries")
      .update({ billing_url: input.billingUrl })
      .eq("id", deliveryId)
      .is("provider_message_id", null);
  }
  if (row?.status === "accepted" && text(row.provider_message_id)) {
    return {
      outcome: "skipped_accepted",
      providerMessageId: text(row.provider_message_id),
      idempotencyKey: text(row.idempotency_key),
      recipientEmail: recipient,
      recipientMatched: true,
    };
  }
  const delivered = await deliverId(admin, deliveryId, (email) => {
    return email === PLAN_CONFIRMATION_PREVIEW_TEST_RECIPIENT;
  });
  return { ...delivered, recipientMatched: delivered.recipientEmail === PLAN_CONFIRMATION_PREVIEW_TEST_RECIPIENT };
}
