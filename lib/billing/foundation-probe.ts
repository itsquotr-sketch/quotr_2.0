import "server-only";
import Stripe from "stripe";
import { upsertTrustedCustomerMapping } from "@/lib/billing/customer-mapping";
import { resolveBillingEnvironment } from "@/lib/billing/environment";
import {
  buildInternalTrialSubscription,
  deriveInternalTrialAccessState,
  isNoCardInternalTrial,
} from "@/lib/billing/trial";
import {
  readStripePriceConfig,
  resolvePlanFromStripePriceItems,
} from "@/lib/billing/prices";
import { evaluateOrgEntitlement } from "@/lib/billing/entitlements";
import {
  getStripeClient,
  getStripeWebhookSecret,
  isStripeSecretConfigured,
  isStripeWebhookConfigured,
} from "@/lib/billing/stripe";
import { createSupabaseBillingStore } from "@/lib/billing/supabase-store";
import { handleStripeWebhookRequest } from "@/lib/billing/webhook-http";
import { createAdminClient } from "@/lib/supabase/admin";
import type { StripePriceConfig } from "@/lib/billing/types";

const EXPECTED_PRICES = {
  builder: {
    unit_amount: 6500,
    currency: "nzd",
    interval: "month",
    tax_behavior: "exclusive",
  },
  business_base: {
    unit_amount: 7900,
    currency: "nzd",
    interval: "month",
    tax_behavior: "exclusive",
  },
  business_seat: {
    unit_amount: 3500,
    currency: "nzd",
    interval: "month",
    tax_behavior: "exclusive",
  },
} as const;

const PROBE_ORG_NAME = "BILLING-1-R2 probe";

function stripePriceIdShape(value: string): "price" | "prod" | "other" {
  const trimmed = value.trim();
  if (trimmed.startsWith("price_")) return "price";
  if (trimmed.startsWith("prod_")) return "prod";
  return "other";
}

function secretPrefixClass(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "missing";
  if (trimmed.startsWith("sk_test_")) return "sk_test";
  if (trimmed.startsWith("sk_live_")) return "sk_live";
  if (trimmed.startsWith("rk_test_")) return "rk_test";
  if (trimmed.startsWith("rk_live_")) return "rk_live";
  return "other";
}

function webhookPrefixClass(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "missing";
  if (trimmed.startsWith("whsec_")) return "whsec";
  return "other";
}

function summarisePrice(
  price: Stripe.Price,
  expected: (typeof EXPECTED_PRICES)[keyof typeof EXPECTED_PRICES]
) {
  const interval = price.recurring?.interval ?? null;
  const intervalCount = price.recurring?.interval_count ?? null;
  const observed = {
    currency: price.currency,
    unit_amount: price.unit_amount,
    interval,
    interval_count: intervalCount,
    tax_behavior: price.tax_behavior ?? null,
  };
  const matches =
    observed.currency === expected.currency &&
    observed.unit_amount === expected.unit_amount &&
    observed.interval === expected.interval &&
    intervalCount === 1 &&
    observed.tax_behavior === expected.tax_behavior;
  return { observed, expected, matches };
}

function stripeErrorSafe(error: unknown) {
  const record =
    error && typeof error === "object" ? (error as Record<string, unknown>) : {};
  const type = typeof record.type === "string" ? record.type : null;
  const code = typeof record.code === "string" ? record.code : null;
  const statusCode =
    typeof record.statusCode === "number" ? record.statusCode : null;
  let kind = "failed";
  if (statusCode === 401 || code === "api_key_expired") kind = "auth";
  else if (code === "resource_missing") kind = "not_found";
  else if (statusCode === 403) kind = "forbidden";
  return { kind, type, code, statusCode };
}

async function retrieveConfiguredPrice(
  stripe: Stripe,
  priceId: string
) {
  try {
    const price = await stripe.prices.retrieve(priceId);
    return { ok: true as const, price };
  } catch (error) {
    return { ok: false as const, error: stripeErrorSafe(error) };
  }
}

function mappingCases(config: StripePriceConfig) {
  const builder = resolvePlanFromStripePriceItems(
    [{ priceId: config.builderMonthly, quantity: 1 }],
    config
  );
  const businessBase = resolvePlanFromStripePriceItems(
    [{ priceId: config.businessBaseMonthly, quantity: 1 }],
    config
  );
  const plus1 = resolvePlanFromStripePriceItems(
    [
      { priceId: config.businessBaseMonthly, quantity: 1 },
      { priceId: config.businessSeatMonthly, quantity: 1 },
    ],
    config
  );
  const plus3 = resolvePlanFromStripePriceItems(
    [
      { priceId: config.businessBaseMonthly, quantity: 1 },
      { priceId: config.businessSeatMonthly, quantity: 3 },
    ],
    config
  );
  const plus4 = resolvePlanFromStripePriceItems(
    [
      { priceId: config.businessBaseMonthly, quantity: 1 },
      { priceId: config.businessSeatMonthly, quantity: 4 },
    ],
    config
  );
  const unknown = resolvePlanFromStripePriceItems(
    [{ priceId: "price_not_configured_billing1r2", quantity: 1 }],
    config
  );
  return {
    builder:
      builder.ok &&
      builder.planCode === "builder" &&
      builder.paidSeatQuantity === 1,
    business_base:
      businessBase.ok &&
      businessBase.planCode === "business" &&
      businessBase.paidSeatQuantity === 1,
    business_plus_1_seat:
      plus1.ok && plus1.planCode === "business" && plus1.paidSeatQuantity === 2,
    business_plus_3_seats:
      plus3.ok && plus3.planCode === "business" && plus3.paidSeatQuantity === 4,
    business_plus_4_seats:
      plus4.ok && plus4.planCode === "business" && plus4.paidSeatQuantity === 5,
    unknown_price_rejected: !unknown.ok && unknown.errorCode === "unknown_price",
  };
}

function internalTrialProbe() {
  const now = new Date("2026-09-02T00:00:00.000Z");
  const active = buildInternalTrialSubscription({
    id: "00000000-0000-4000-8000-000000000001",
    orgId: "00000000-0000-4000-8000-000000000002",
    billingEnvironment: "test",
    now,
  });
  const expired = buildInternalTrialSubscription({
    id: "00000000-0000-4000-8000-000000000003",
    orgId: "00000000-0000-4000-8000-000000000002",
    billingEnvironment: "test",
    now,
    trialEndsAt: new Date("2026-08-01T00:00:00.000Z"),
  });
  return {
    no_stripe_ids_required: isNoCardInternalTrial(active),
    persisted_status_trialing: active.status === "trialing",
    source_internal_trial: active.source === "internal_trial",
    active_derived: deriveInternalTrialAccessState(active, now) === "trialing",
    expired_persisted_status: expired.status === "trialing",
    expired_derived:
      deriveInternalTrialAccessState(expired, now) === "trial_expired",
    send_still_allowed: evaluateOrgEntitlement({
      state: {
        orgId: "org",
        billingEnvironment: "test",
        customer: null,
        subscription: null,
        activeOverride: null,
        effectiveTrialState: null,
      },
      capability: "quotes.send",
      mode: "compatibility",
    }).ok,
    acceptance_still_allowed: evaluateOrgEntitlement({
      state: {
        orgId: "org",
        billingEnvironment: "test",
        customer: null,
        subscription: null,
        activeOverride: null,
        effectiveTrialState: null,
      },
      capability: "quotes.acceptance",
      mode: "compatibility",
    }).ok,
  };
}

export async function probeHostedStripeConfig() {
  let billingEnvironment = "rejected";
  try {
    billingEnvironment = resolveBillingEnvironment();
  } catch {
    billingEnvironment = "rejected";
  }

  const secretClass = secretPrefixClass(process.env.STRIPE_SECRET_KEY);
  const webhookClass = webhookPrefixClass(process.env.STRIPE_WEBHOOK_SECRET);
  let prices: StripePriceConfig | null = null;
  let priceConfigError: string | null = null;
  try {
    prices = readStripePriceConfig();
  } catch {
    priceConfigError = "incomplete";
  }

  const trial = internalTrialProbe();
  const result: Record<string, unknown> = {
    vercel_env: process.env.VERCEL_ENV ?? null,
    billing_environment: billingEnvironment,
    stripe_secret_prefix: secretClass,
    stripe_secret_is_live:
      secretClass === "sk_live" || secretClass === "rk_live",
    webhook_secret_prefix: webhookClass,
    has_price_builder: Boolean(process.env.STRIPE_PRICE_BUILDER_MONTHLY?.trim()),
    has_price_business_base: Boolean(
      process.env.STRIPE_PRICE_BUSINESS_BASE_MONTHLY?.trim()
    ),
    has_price_business_seat: Boolean(
      process.env.STRIPE_PRICE_BUSINESS_SEAT_MONTHLY?.trim()
    ),
    price_config_error: priceConfigError,
    trial,
    prices_match: false,
    mapping: null as ReturnType<typeof mappingCases> | null,
  };

  if (
    billingEnvironment !== "test" ||
    secretClass !== "sk_test" ||
    !isStripeSecretConfigured() ||
    !prices
  ) {
    return result;
  }

  try {
    const stripe = getStripeClient();
    result.price_id_prefixes = {
      builder: stripePriceIdShape(prices.builderMonthly),
      business_base: stripePriceIdShape(prices.businessBaseMonthly),
      business_seat: stripePriceIdShape(prices.businessSeatMonthly),
    };
    let accountOk = false;
    try {
      await stripe.balance.retrieve();
      accountOk = true;
    } catch (error) {
      result.stripe_account_probe = stripeErrorSafe(error);
    }
    result.stripe_account_reachable = accountOk;

    const [builderRes, businessRes, seatRes] = await Promise.all([
      retrieveConfiguredPrice(stripe, prices.builderMonthly),
      retrieveConfiguredPrice(stripe, prices.businessBaseMonthly),
      retrieveConfiguredPrice(stripe, prices.businessSeatMonthly),
    ]);
    result.builder_retrieve = builderRes.ok ? "ok" : builderRes.error;
    result.business_base_retrieve = businessRes.ok ? "ok" : businessRes.error;
    result.business_seat_retrieve = seatRes.ok ? "ok" : seatRes.error;
    if (builderRes.ok && businessRes.ok && seatRes.ok) {
      const builderCheck = summarisePrice(
        builderRes.price,
        EXPECTED_PRICES.builder
      );
      const businessCheck = summarisePrice(
        businessRes.price,
        EXPECTED_PRICES.business_base
      );
      const seatCheck = summarisePrice(
        seatRes.price,
        EXPECTED_PRICES.business_seat
      );
      result.builder = builderCheck;
      result.business_base = businessCheck;
      result.business_seat = seatCheck;
      result.prices_match =
        builderCheck.matches && businessCheck.matches && seatCheck.matches;
      result.mapping = mappingCases(prices);
    } else {
      result.price_retrieve_error = "stripe_price_retrieve_failed";
      result.mapping = mappingCases(prices);
    }
  } catch (error) {
    result.price_retrieve_error = "stripe_price_retrieve_failed";
    result.price_retrieve_safe = stripeErrorSafe(error);
  }

  return result;
}

function stripeEventPayload(input: {
  id: string;
  type: string;
  livemode: boolean;
  created: number;
  object: Record<string, unknown>;
}) {
  return JSON.stringify({
    id: input.id,
    object: "event",
    type: input.type,
    livemode: input.livemode,
    created: input.created,
    data: { object: input.object },
  });
}

async function postSignedEvent(payload: string): Promise<{
  http_status: number;
  ok_field: boolean | null;
  reached_webhook: boolean;
  delivery: "in_process_signed_handler";
}> {
  const secret = getStripeWebhookSecret();
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
  });
  const request = new Request(
    "https://quotr.internal/api/webhooks/stripe",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": signature,
      },
      body: payload,
    }
  );
  const response = await handleStripeWebhookRequest(request);
  const text = await response.text();
  let okField: boolean | null = null;
  try {
    okField = JSON.parse(text).ok === true;
  } catch {
    okField = null;
  }
  return {
    http_status: response.status,
    ok_field: okField,
    reached_webhook: text.trim().startsWith("{"),
    delivery: "in_process_signed_handler",
  };
}

async function receipt(stripeEventId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("stripe_processed_events")
    .select("event_type, status, error_code, billing_environment")
    .eq("stripe_event_id", stripeEventId)
    .eq("billing_environment", "test")
    .maybeSingle();
  return data
    ? {
        present: true,
        billing_environment: data.billing_environment,
        event_type: data.event_type,
        status: data.status,
        error_code: data.error_code,
        stripe_event_id_kind: stripeEventId.startsWith("evt_")
          ? "evt"
          : "other",
      }
    : { present: false };
}

export async function probeSignedCheckoutSession() {
  if (resolveBillingEnvironment() !== "test") {
    return { ok: false, error: "billing_environment_not_test" };
  }
  if (!isStripeWebhookConfigured()) {
    return { ok: false, error: "webhook_secret_missing" };
  }
  const id = `evt_b1r2_cs_${crypto.randomUUID().replaceAll("-", "")}`;
  const payload = stripeEventPayload({
    id,
    type: "checkout.session.completed",
    livemode: false,
    created: Math.floor(Date.now() / 1000),
    object: {
      id: "cs_test_billing1r2_no_checkout",
      object: "checkout.session",
      mode: "subscription",
      status: "complete",
      payment_status: "unpaid",
    },
  });
  const posted = await postSignedEvent(payload);
  const first = await receipt(id);
  return {
    ok:
      posted.http_status === 200 &&
      first.present === true &&
      (first.status === "ignored" || first.status === "processed") &&
      (first.error_code === "checkout_without_customer" ||
        first.error_code === "checkout_corroborated"),
    stripe_event_id: id,
    http: posted,
    receipt: first,
    expected_status: "ignored_or_processed",
    expected_error_code: "checkout_without_customer_or_corroborated",
  };
}

export async function probeReplaySignedEvent(stripeEventId: string) {
  if (!stripeEventId.startsWith("evt_b1r2_")) {
    return { ok: false, error: "event_id_not_probe" };
  }
  const before = await receipt(stripeEventId);
  const payload = stripeEventPayload({
    id: stripeEventId,
    type: "checkout.session.completed",
    livemode: false,
    created: Math.floor(Date.now() / 1000),
    object: {
      id: "cs_test_billing1r2_no_checkout",
      object: "checkout.session",
      mode: "subscription",
      status: "complete",
      payment_status: "unpaid",
    },
  });
  const posted = await postSignedEvent(payload);
  const after = await receipt(stripeEventId);
  const admin = createAdminClient();
  const { count } = await admin
    .from("stripe_processed_events")
    .select("id", { count: "exact", head: true })
    .eq("billing_environment", "test")
    .eq("stripe_event_id", stripeEventId);
  return {
    ok:
      posted.http_status === 200 &&
      before.present &&
      after.present &&
      count === 1,
    http: posted,
    before,
    after,
    receipt_row_count: count ?? null,
  };
}

export async function probeLivemodeRejected() {
  const id = `evt_b1r2_live_${crypto.randomUUID().replaceAll("-", "")}`;
  const payload = stripeEventPayload({
    id,
    type: "checkout.session.completed",
    livemode: true,
    created: Math.floor(Date.now() / 1000),
    object: {
      id: "cs_live_fixture_not_stripe",
      object: "checkout.session",
    },
  });
  const posted = await postSignedEvent(payload);
  const row = await receipt(id);
  return {
    ok:
      posted.http_status === 200 &&
      row.present === true &&
      row.status === "ignored" &&
      row.error_code === "environment_mismatch",
    http: posted,
    receipt: row,
    expected_error_code: "environment_mismatch",
    used_live_stripe: false,
  };
}

function subscriptionObject(input: {
  id: string;
  customer: string;
  orgId: string;
  status?: string;
  items: Array<{ priceId: string; quantity?: number }>;
  deleted?: boolean;
}) {
  const start = Math.floor(Date.now() / 1000);
  return {
    id: input.id,
    object: "subscription",
    customer: input.customer,
    status: input.status ?? "trialing",
    cancel_at_period_end: false,
    canceled_at: input.deleted ? start : null,
    trial_end: start + 14 * 24 * 60 * 60,
    metadata: {
      org_id: input.orgId,
      billing_environment: "test",
    },
    items: {
      object: "list",
      data: input.items.map((item) => ({
        object: "subscription_item",
        quantity: item.quantity ?? 1,
        current_period_start: start,
        current_period_end: start + 30 * 24 * 60 * 60,
        price: { id: item.priceId, object: "price" },
      })),
    },
  };
}

async function sendSubscriptionEvent(input: {
  eventId: string;
  type:
    | "customer.subscription.created"
    | "customer.subscription.updated"
    | "customer.subscription.deleted";
  created: number;
  object: Record<string, unknown>;
}) {
  const payload = stripeEventPayload({
    id: input.eventId,
    type: input.type,
    livemode: false,
    created: input.created,
    object: input.object,
  });
  const posted = await postSignedEvent(payload);
  return { posted, receipt: await receipt(input.eventId) };
}

export async function probeSubscriptionMirror() {
  if (resolveBillingEnvironment() !== "test") {
    return { ok: false, error: "billing_environment_not_test" };
  }
  const prices = readStripePriceConfig();
  if (!prices) {
    return { ok: false, error: "price_config_missing" };
  }

  const stripe = getStripeClient();
  const admin = createAdminClient();
  const store = createSupabaseBillingStore();

  let orgId: string | null = null;
  const existingOrg = await admin
    .from("organisations")
    .select("id")
    .eq("name", PROBE_ORG_NAME)
    .limit(1)
    .maybeSingle();
  orgId = existingOrg.data?.id ?? null;
  if (!orgId) {
    const createdOrg = await admin
      .from("organisations")
      .insert({ name: PROBE_ORG_NAME })
      .select("id")
      .single();
    if (createdOrg.error || !createdOrg.data?.id) {
      return { ok: false, error: "probe_org_create_failed" };
    }
    orgId = createdOrg.data.id;
  }
  if (!orgId) {
    return { ok: false, error: "probe_org_missing" };
  }
  const probeOrgId = orgId;

  await admin
    .from("org_subscriptions")
    .delete()
    .eq("org_id", probeOrgId)
    .eq("billing_environment", "test");
  await admin
    .from("org_billing_customers")
    .delete()
    .eq("org_id", probeOrgId)
    .eq("billing_environment", "test");

  const customer = await stripe.customers.create({
    metadata: {
      org_id: probeOrgId,
      billing_environment: "test",
      probe: "billing-1-r2",
    },
  });

  const mapped = await upsertTrustedCustomerMapping(store, {
    orgId: probeOrgId,
    billingEnvironment: "test",
    stripeCustomerId: customer.id,
    billingName: "BILLING-1-R2 probe",
  });
  if (!mapped.ok) {
    await stripe.customers.del(customer.id);
    return { ok: false, error: mapped.errorCode };
  }

  const subId = `sub_b1r2_${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}`;
  const createdUnix = Math.floor(Date.now() / 1000);
  const created = await sendSubscriptionEvent({
    eventId: `evt_b1r2_subc_${crypto.randomUUID().replaceAll("-", "")}`,
    type: "customer.subscription.created",
    created: createdUnix,
    object: subscriptionObject({
      id: subId,
      customer: customer.id,
      orgId: probeOrgId,
      items: [{ priceId: prices.builderMonthly }],
    }),
  });

  const afterCreate = await store.getSubscriptionByOrg(probeOrgId, "test");
  const plus1 = await sendSubscriptionEvent({
    eventId: `evt_b1r2_subu1_${crypto.randomUUID().replaceAll("-", "")}`,
    type: "customer.subscription.updated",
    created: createdUnix + 1,
    object: subscriptionObject({
      id: subId,
      customer: customer.id,
      orgId: probeOrgId,
      status: "active",
      items: [
        { priceId: prices.businessBaseMonthly },
        { priceId: prices.businessSeatMonthly, quantity: 1 },
      ],
    }),
  });
  const afterPlus1 = await store.getSubscriptionByOrg(probeOrgId, "test");
  const plus3 = await sendSubscriptionEvent({
    eventId: `evt_b1r2_subu3_${crypto.randomUUID().replaceAll("-", "")}`,
    type: "customer.subscription.updated",
    created: createdUnix + 2,
    object: subscriptionObject({
      id: subId,
      customer: customer.id,
      orgId: probeOrgId,
      status: "active",
      items: [
        { priceId: prices.businessBaseMonthly },
        { priceId: prices.businessSeatMonthly, quantity: 3 },
      ],
    }),
  });
  const afterPlus3 = await store.getSubscriptionByOrg(probeOrgId, "test");
  const plus4 = await sendSubscriptionEvent({
    eventId: `evt_b1r2_subu4_${crypto.randomUUID().replaceAll("-", "")}`,
    type: "customer.subscription.updated",
    created: createdUnix + 3,
    object: subscriptionObject({
      id: subId,
      customer: customer.id,
      orgId: probeOrgId,
      status: "active",
      items: [
        { priceId: prices.businessBaseMonthly },
        { priceId: prices.businessSeatMonthly, quantity: 4 },
      ],
    }),
  });
  const afterPlus4 = await store.getSubscriptionByOrg(probeOrgId, "test");
  const unknown = await sendSubscriptionEvent({
    eventId: `evt_b1r2_unk_${crypto.randomUUID().replaceAll("-", "")}`,
    type: "customer.subscription.updated",
    created: createdUnix + 4,
    object: subscriptionObject({
      id: subId,
      customer: customer.id,
      orgId: probeOrgId,
      status: "active",
      items: [{ priceId: "price_not_configured_billing1r2" }],
    }),
  });
  const afterUnknown = await store.getSubscriptionByOrg(probeOrgId, "test");
  const deleted = await sendSubscriptionEvent({
    eventId: `evt_b1r2_subd_${crypto.randomUUID().replaceAll("-", "")}`,
    type: "customer.subscription.deleted",
    created: createdUnix + 5,
    object: subscriptionObject({
      id: subId,
      customer: customer.id,
      orgId: probeOrgId,
      status: "canceled",
      deleted: true,
      items: [
        { priceId: prices.businessBaseMonthly },
        { priceId: prices.businessSeatMonthly, quantity: 4 },
      ],
    }),
  });
  const afterDeleted = await store.getSubscriptionByOrg(probeOrgId, "test");

  await stripe.customers.del(customer.id);

  const ok = Boolean(
    created.posted.http_status === 200 &&
      created.receipt.status === "processed" &&
      afterCreate?.planCode === "builder" &&
      afterCreate.paidSeatQuantity === 1 &&
      afterCreate.source === "stripe" &&
      afterCreate.status === "trialing" &&
      plus1.receipt.status === "processed" &&
      afterPlus1?.planCode === "business" &&
      afterPlus1.paidSeatQuantity === 2 &&
      plus3.receipt.status === "processed" &&
      afterPlus3?.paidSeatQuantity === 4 &&
      plus4.receipt.status === "processed" &&
      afterPlus4?.paidSeatQuantity === 5 &&
      unknown.posted.http_status === 500 &&
      unknown.receipt.status === "failed" &&
      afterUnknown?.paidSeatQuantity === 5 &&
      deleted.receipt.status === "processed" &&
      afterDeleted?.status === "cancelled" &&
      afterDeleted.lastStripeEventId &&
      afterCreate.lastStripeEventCreatedAt
  );

  return {
    ok,
    customer_mapped: mapped.ok,
    created: {
      http_status: created.posted.http_status,
      receipt: created.receipt,
      plan: afterCreate?.planCode ?? null,
      paid_seat_quantity: afterCreate?.paidSeatQuantity ?? null,
      status: afterCreate?.status ?? null,
      source: afterCreate?.source ?? null,
    },
    business_plus_1: {
      paid_seat_quantity: afterPlus1?.paidSeatQuantity ?? null,
      plan: afterPlus1?.planCode ?? null,
    },
    business_plus_3: { paid_seat_quantity: afterPlus3?.paidSeatQuantity ?? null },
    business_plus_4: { paid_seat_quantity: afterPlus4?.paidSeatQuantity ?? null },
    unknown_price: {
      http_status: unknown.posted.http_status,
      receipt: unknown.receipt,
      seats_unchanged: afterUnknown?.paidSeatQuantity === 5,
    },
    deleted: {
      status: afterDeleted?.status ?? null,
      receipt: deleted.receipt,
    },
    watermark_present: Boolean(afterDeleted?.lastStripeEventCreatedAt),
    billing_environment: afterDeleted?.billingEnvironment ?? null,
  };
}
