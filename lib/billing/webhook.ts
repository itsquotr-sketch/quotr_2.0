import {
  decideProcessedEventClaim,
  shouldApplyStripeEvent,
} from "@/lib/billing/events";
import { eventMatchesBillingEnvironment } from "@/lib/billing/environment";
import { logBillingEvent } from "@/lib/billing/logging";
import {
  extractInvoiceCustomerId,
  extractInvoiceSubscriptionId,
  mapStripeSubscriptionToMirror,
  parseStripeSubscriptionLike,
} from "@/lib/billing/mirror";
import { resolvePastDueSince } from "@/lib/billing/past-due";
import { validateTrustedBillingMetadata } from "@/lib/billing/customers";
import {
  corroborateCheckoutSession,
  parseCheckoutSessionLike,
} from "@/lib/billing/checkout-session";
import type { BillingStore } from "@/lib/billing/store";
import type {
  BillingEnvironment,
  OrgSubscription,
  StripeEventLike,
  StripePriceConfig,
} from "@/lib/billing/types";

export const STRIPE_FOUNDATION_EVENT_TYPES = [
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "checkout.session.completed",
  "invoice.paid",
  "invoice.payment_failed",
] as const;

export type StripeWebhookResult = {
  result:
    | "processed"
    | "ignored"
    | "failed"
    | "duplicate"
    | "in_flight"
    | "rejected";
  errorCode?: string;
  orgId?: string | null;
  httpStatus: number;
};

const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

export async function processBillingStripeEvent(input: {
  event: StripeEventLike;
  billingEnvironment: BillingEnvironment;
  prices: StripePriceConfig | null;
  store: BillingStore;
}): Promise<StripeWebhookResult> {
  const { event, billingEnvironment, store } = input;
  const baseLog = {
    stripeEventId: event.id,
    eventType: event.type,
    billingEnvironment,
  };

  if (!eventMatchesBillingEnvironment(billingEnvironment, event.livemode)) {
    await recordIgnored(
      store,
      event,
      billingEnvironment,
      "environment_mismatch",
      "Stripe livemode does not match BILLING_ENVIRONMENT."
    );
    logBillingEvent({ ...baseLog, result: "ignored", errorCode: "environment_mismatch" });
    return {
      result: "ignored",
      errorCode: "environment_mismatch",
      httpStatus: 200,
    };
  }

  const claim = await store.claimProcessedEvent({
    stripeEventId: event.id,
    eventType: event.type,
    billingEnvironment,
  });
  const existing = claim.inserted ? null : claim.existing;
  const decision = decideProcessedEventClaim(existing);

  if (decision.action === "skip") {
    const result =
      decision.reason === "in_flight" ? "in_flight" : "duplicate";
    logBillingEvent({ ...baseLog, result });
    return { result, httpStatus: 200 };
  }

  try {
    const handled = await handleClaimedEvent(input);
    await store.finalizeProcessedEvent({
      stripeEventId: event.id,
      billingEnvironment,
      status: handled.result === "failed" ? "failed" : handled.result === "processed" ? "processed" : "ignored",
      errorCode: handled.errorCode ?? null,
      errorSafe: handled.errorSafe ?? null,
    });
    logBillingEvent({
      ...baseLog,
      result: handled.result,
      orgId: handled.orgId ?? null,
      errorCode: handled.errorCode ?? null,
    });
    return {
      result: handled.result,
      errorCode: handled.errorCode,
      orgId: handled.orgId,
      httpStatus: handled.result === "failed" ? 500 : 200,
    };
  } catch {
    const errorSafe = "Billing event processing failed.";
    await store.finalizeProcessedEvent({
      stripeEventId: event.id,
      billingEnvironment,
      status: "failed",
      errorCode: "processing_exception",
      errorSafe,
    });
    logBillingEvent({
      ...baseLog,
      result: "failed",
      errorCode: "processing_exception",
    });
    return {
      result: "failed",
      errorCode: "processing_exception",
      httpStatus: 500,
    };
  }
}

async function recordIgnored(
  store: BillingStore,
  event: StripeEventLike,
  billingEnvironment: BillingEnvironment,
  errorCode: string,
  errorSafe: string
): Promise<void> {
  const claim = await store.claimProcessedEvent({
    stripeEventId: event.id,
    eventType: event.type,
    billingEnvironment,
  });
  const decision = decideProcessedEventClaim(
    claim.inserted ? null : claim.existing
  );
  if (decision.action === "skip" && decision.reason !== "in_flight") {
    return;
  }
  await store.finalizeProcessedEvent({
    stripeEventId: event.id,
    billingEnvironment,
    status: "ignored",
    errorCode,
    errorSafe,
  });
}

async function handleClaimedEvent(input: {
  event: StripeEventLike;
  billingEnvironment: BillingEnvironment;
  prices: StripePriceConfig | null;
  store: BillingStore;
}): Promise<{
  result: "processed" | "ignored" | "failed";
  errorCode?: string;
  errorSafe?: string;
  orgId?: string | null;
}> {
  const { event, billingEnvironment, prices, store } = input;
  const object =
    event.data?.object && typeof event.data.object === "object"
      ? event.data.object
      : {};

  if (event.type === "checkout.session.completed") {
    const session = parseCheckoutSessionLike(object);
    if (!session) {
      return {
        result: "ignored",
        errorCode: "checkout_invalid_session",
        errorSafe: "Checkout session object could not be parsed.",
      };
    }
    const mapped = session.customerId
      ? await store.getCustomerByStripeId(session.customerId, billingEnvironment)
      : null;
    const corroborated = corroborateCheckoutSession({
      session,
      billingEnvironment,
      mappedOrgId: mapped?.orgId ?? null,
      prices,
    });
    return corroborated;
  }

  if (!STRIPE_FOUNDATION_EVENT_TYPES.includes(event.type as never)) {
    return {
      result: "ignored",
      errorCode: "unhandled_event_type",
      errorSafe: "Event type is not part of the BILLING-1 foundation set.",
    };
  }

  if (SUBSCRIPTION_EVENTS.has(event.type)) {
    if (!prices) {
      return {
        result: "failed",
        errorCode: "price_config_missing",
        errorSafe: "Stripe price configuration is not set.",
      };
    }
    const subscription = parseStripeSubscriptionLike(object);
    if (!subscription) {
      return {
        result: "failed",
        errorCode: "invalid_subscription_object",
        errorSafe: "Stripe subscription object could not be parsed.",
      };
    }

    const customer = await store.getCustomerByStripeId(
      subscription.customerId,
      billingEnvironment
    );
    if (!customer) {
      return {
        result: "failed",
        errorCode: "unmapped_customer",
        errorSafe:
          "Stripe customer is not mapped to an organisation. Mapping is created in Checkout, not guessed from metadata.",
      };
    }

    const metadataCheck = validateTrustedBillingMetadata({
      billingEnvironment,
      mappedOrgId: customer.orgId,
      metadata: subscription.metadata,
    });
    if (!metadataCheck.ok) {
      return {
        result: "failed",
        errorCode: metadataCheck.errorCode,
        errorSafe: metadataCheck.errorSafe,
      };
    }

    const existing = await store.getSubscriptionByOrg(
      customer.orgId,
      billingEnvironment
    );
    if (
      existing &&
      !shouldApplyStripeEvent({
        eventCreatedUnix: event.created,
        lastAppliedEventCreatedAt: existing.lastStripeEventCreatedAt,
      })
    ) {
      return {
        result: "ignored",
        errorCode: "stale_event",
        errorSafe: "Older Stripe event did not overwrite newer subscription state.",
        orgId: customer.orgId,
      };
    }

    const mapped = mapStripeSubscriptionToMirror({
      orgId: customer.orgId,
      billingEnvironment,
      subscription,
      prices,
      existing,
      eventId: event.id,
      eventCreatedUnix: event.created,
      deleted: event.type === "customer.subscription.deleted",
    });
    if (!mapped.ok) {
      return {
        result: "failed",
        errorCode: mapped.errorCode,
        errorSafe: mapped.errorSafe,
        orgId: customer.orgId,
      };
    }

    await store.upsertSubscription(mapped.row);
    return { result: "processed", orgId: customer.orgId };
  }

  if (event.type === "invoice.paid") {
    return applyInvoiceEvent({
      event,
      object,
      billingEnvironment,
      store,
      mode: "paid",
    });
  }

  if (event.type === "invoice.payment_failed") {
    return applyInvoiceEvent({
      event,
      object,
      billingEnvironment,
      store,
      mode: "payment_failed",
    });
  }

  return {
    result: "ignored",
    errorCode: "unhandled_event_type",
    errorSafe: "Event type is not part of the BILLING-1 foundation set.",
  };
}

async function applyInvoiceEvent(input: {
  event: StripeEventLike;
  object: Record<string, unknown>;
  billingEnvironment: BillingEnvironment;
  store: BillingStore;
  mode: "paid" | "payment_failed";
}): Promise<{
  result: "processed" | "ignored" | "failed";
  errorCode?: string;
  errorSafe?: string;
  orgId?: string | null;
}> {
  const customerId = extractInvoiceCustomerId(input.object);
  const subscriptionId = extractInvoiceSubscriptionId(input.object);
  if (!customerId) {
    return {
      result: "ignored",
      errorCode: "invoice_without_customer",
      errorSafe: "Invoice event had no customer.",
    };
  }

  const customer = await input.store.getCustomerByStripeId(
    customerId,
    input.billingEnvironment
  );
  if (!customer) {
    return {
      result: "ignored",
      errorCode: "unmapped_customer",
      errorSafe: "Invoice customer is not mapped; not guessed from metadata.",
    };
  }

  const existing =
    (subscriptionId
      ? await input.store.getSubscriptionByStripeId(
          subscriptionId,
          input.billingEnvironment
        )
      : null) ??
    (await input.store.getSubscriptionByOrg(
      customer.orgId,
      input.billingEnvironment
    ));

  if (!existing || existing.orgId !== customer.orgId) {
    return {
      result: "ignored",
      errorCode: "invoice_without_subscription",
      errorSafe: "Invoice could not be matched to an organisation subscription.",
      orgId: customer.orgId,
    };
  }

  if (
    !shouldApplyStripeEvent({
      eventCreatedUnix: input.event.created,
      lastAppliedEventCreatedAt: existing.lastStripeEventCreatedAt,
    })
  ) {
    return {
      result: "ignored",
      errorCode: "stale_event",
      errorSafe: "Older invoice event did not overwrite newer subscription state.",
      orgId: customer.orgId,
    };
  }

  if (input.mode === "paid") {
    return {
      result: "processed",
      orgId: customer.orgId,
      errorCode: "invoice_paid_no_status_overwrite",
      errorSafe:
        "invoice.paid recorded without forcing active; wait for customer.subscription.updated.",
    };
  }

  const patch: Partial<OrgSubscription> = {};
  if (
    existing.status === "active" ||
    existing.status === "trialing" ||
    existing.status === "scheduled_to_cancel" ||
    existing.status === "incomplete"
  ) {
    patch.status = "past_due";
    patch.pastDueSince = resolvePastDueSince({
      previousStatus: existing.status,
      nextStatus: "past_due",
      existingPastDueSince: existing.pastDueSince,
      eventCreatedUnix: input.event.created,
    });
  }
  // Already past_due: do not reset past_due_since. Do not bump
  // lastStripeEventCreatedAt — subscription objects remain authority.

  if (Object.keys(patch).length > 0) {
    await input.store.patchSubscription(
      existing.orgId,
      input.billingEnvironment,
      patch
    );
  }
  return { result: "processed", orgId: customer.orgId };
}
