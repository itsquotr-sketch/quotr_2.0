/**
 * BILLING-1 organisation subscription authority foundation.
 * Fixtures and domain tests only. No Checkout. No live Stripe charges.
 * No paid AI. No live email.
 *
 * Run: npx tsx scripts/verify-billing-1.ts
 */
import { readFileSync, readdirSync } from "node:fs";
import Stripe from "stripe";
import { upsertTrustedCustomerMapping } from "../lib/billing/customer-mapping";
import { assertCustomerMappingAssignable } from "../lib/billing/customers";
import { decideProcessedEventClaim, shouldApplyStripeEvent } from "../lib/billing/events";
import {
  eventMatchesBillingEnvironment,
  resolveBillingEnvironment,
} from "../lib/billing/environment";
import { billingLogLine } from "../lib/billing/logging";
import { extraSeatQuantityFromPaidSeats } from "../lib/billing/seats";
import { isBillingOverrideActive } from "../lib/billing/overrides";
import {
  PLAN_CATALOGUE,
  PLAN_CATALOGUE_VERSION,
  TRIAL_DURATION_DAYS,
  TRIAL_ENTITLEMENT_BASIS_PLAN,
  TRIAL_INCLUDED_USERS,
} from "../lib/billing/plans";
import { resolvePlanFromStripePriceItems } from "../lib/billing/prices";
import { diffStripeAgainstMirror } from "../lib/billing/reconciliation";
import { assembleOrgBillingState, loadOrgBillingState } from "../lib/billing/state";
import { mapStripeSubscriptionStatus } from "../lib/billing/status";
import type { BillingStore, EventClaimRecord } from "../lib/billing/store";
import {
  buildInternalTrialSubscription,
  deriveInternalTrialAccessState,
  isNoCardInternalTrial,
} from "../lib/billing/trial";
import type {
  BillingEnvironment,
  OrgBillingCustomer,
  OrgBillingOverride,
  OrgSubscription,
  StripeEventLike,
  StripePriceConfig,
} from "../lib/billing/types";
import { processBillingStripeEvent } from "../lib/billing/webhook";
import { evaluateOrgEntitlement } from "../lib/billing/entitlements";

function assert(label: string, ok: boolean, detail = "") {
  console.log(ok ? "PASS" : "FAIL", label + (ok || !detail ? "" : ` — ${detail}`));
  if (!ok) process.exitCode = 1;
}

function file(path: string): string {
  return readFileSync(path, "utf8");
}

const PRICES: StripePriceConfig = {
  builderMonthly: "price_builder_test",
  businessBaseMonthly: "price_business_base_test",
  businessSeatMonthly: "price_business_seat_test",
};

const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";
const CUSTOMER_A = "cus_test_org_a";
const CUSTOMER_B = "cus_test_org_b";

function nowIso(): string {
  return "2026-09-01T00:00:00.000Z";
}

function createMemoryStore(seed?: {
  customers?: OrgBillingCustomer[];
  subscriptions?: OrgSubscription[];
  overrides?: OrgBillingOverride[];
}): BillingStore {
  const customers = [...(seed?.customers ?? [])];
  const subscriptions = [...(seed?.subscriptions ?? [])];
  const overrides = [...(seed?.overrides ?? [])];
  const events = new Map<string, EventClaimRecord>();
  const eventKey = (env: BillingEnvironment, id: string) => `${env}:${id}`;

  return {
    async getCustomerByOrg(orgId, billingEnvironment) {
      return (
        customers.find(
          (row) =>
            row.orgId === orgId && row.billingEnvironment === billingEnvironment
        ) ?? null
      );
    },
    async getCustomerByStripeId(stripeCustomerId, billingEnvironment) {
      return (
        customers.find(
          (row) =>
            row.stripeCustomerId === stripeCustomerId &&
            row.billingEnvironment === billingEnvironment
        ) ?? null
      );
    },
    async upsertCustomer(row) {
      const existingIndex = customers.findIndex(
        (item) =>
          item.orgId === row.orgId &&
          item.billingEnvironment === row.billingEnvironment
      );
      const mapped: OrgBillingCustomer = {
        id:
          existingIndex >= 0
            ? customers[existingIndex]!.id
            : `cusmap_${row.orgId}`,
        orgId: row.orgId,
        billingEnvironment: row.billingEnvironment,
        stripeCustomerId: row.stripeCustomerId,
        billingName: row.billingName,
        billingEmail: row.billingEmail,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      if (existingIndex >= 0) {
        customers[existingIndex] = mapped;
      } else {
        customers.push(mapped);
      }
      return mapped;
    },
    async getSubscriptionByOrg(orgId, billingEnvironment) {
      return (
        subscriptions.find(
          (row) =>
            row.orgId === orgId && row.billingEnvironment === billingEnvironment
        ) ?? null
      );
    },
    async getSubscriptionByStripeId(stripeSubscriptionId, billingEnvironment) {
      return (
        subscriptions.find(
          (row) =>
            row.stripeSubscriptionId === stripeSubscriptionId &&
            row.billingEnvironment === billingEnvironment
        ) ?? null
      );
    },
    async upsertSubscription(row) {
      const index = subscriptions.findIndex(
        (item) =>
          item.orgId === row.orgId &&
          item.billingEnvironment === row.billingEnvironment
      );
      if (index >= 0) {
        subscriptions[index] = row;
      } else {
        subscriptions.push(row);
      }
      return row;
    },
    async patchSubscription(orgId, billingEnvironment, patch) {
      const index = subscriptions.findIndex(
        (item) =>
          item.orgId === orgId && item.billingEnvironment === billingEnvironment
      );
      if (index < 0) return null;
      subscriptions[index] = { ...subscriptions[index]!, ...patch };
      return subscriptions[index]!;
    },
    async listOverrides(orgId, billingEnvironment) {
      return overrides.filter(
        (row) =>
          row.orgId === orgId && row.billingEnvironment === billingEnvironment
      );
    },
    async getProcessedEvent(stripeEventId, billingEnvironment) {
      return events.get(eventKey(billingEnvironment, stripeEventId)) ?? null;
    },
    async claimProcessedEvent(input) {
      const key = eventKey(input.billingEnvironment, input.stripeEventId);
      const existing = events.get(key) ?? null;
      if (existing) {
        return { inserted: false, existing };
      }
      const record: EventClaimRecord = {
        stripeEventId: input.stripeEventId,
        eventType: input.eventType,
        status: "received",
      };
      events.set(key, record);
      return { inserted: true, existing: null };
    },
    async finalizeProcessedEvent(input) {
      const key = eventKey(input.billingEnvironment, input.stripeEventId);
      const existing = events.get(key);
      if (!existing) return;
      events.set(key, { ...existing, status: input.status });
    },
  };
}

function mappedCustomer(
  orgId: string,
  stripeCustomerId: string,
  env: BillingEnvironment = "test"
): OrgBillingCustomer {
  return {
    id: `map_${orgId}`,
    orgId,
    billingEnvironment: env,
    stripeCustomerId,
    billingName: "Test Org",
    billingEmail: "billing@example.com",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function subscriptionObject(input: {
  id: string;
  customer: string;
  status?: string;
  cancelAtPeriodEnd?: boolean;
  pause?: boolean;
  canceledAt?: number | null;
  trialEnd?: number | null;
  items: Array<{ price: string; quantity?: number; start?: number; end?: number }>;
  metadata?: Record<string, string>;
}): Record<string, unknown> {
  return {
    id: input.id,
    object: "subscription",
    customer: input.customer,
    status: input.status ?? "active",
    cancel_at_period_end: input.cancelAtPeriodEnd ?? false,
    pause_collection: input.pause ? { behavior: "void" } : null,
    canceled_at: input.canceledAt ?? null,
    trial_end: input.trialEnd ?? null,
    metadata: input.metadata ?? { org_id: ORG_A, billing_environment: "test" },
    items: {
      data: input.items.map((item, index) => ({
        id: `si_${index}`,
        price: { id: item.price },
        quantity: item.quantity ?? 1,
        current_period_start: item.start ?? 1_700_000_000,
        current_period_end: item.end ?? 1_702_592_000,
      })),
    },
  };
}

function event(input: {
  id: string;
  type: string;
  created: number;
  livemode?: boolean;
  object: Record<string, unknown>;
}): StripeEventLike {
  return {
    id: input.id,
    type: input.type,
    livemode: input.livemode ?? false,
    created: input.created,
    data: { object: input.object },
  };
}

async function process(
  store: BillingStore,
  stripeEvent: StripeEventLike,
  env: BillingEnvironment = "test",
  prices: StripePriceConfig | null = PRICES
) {
  return processBillingStripeEvent({
    event: stripeEvent,
    billingEnvironment: env,
    prices,
    store,
  });
}

const migration046 = file("supabase/migrations/046_billing_foundation.sql");
const entitlementsSrc = file("lib/quotes/entitlements.ts");
const webhookRouteSrc = file("app/api/webhooks/stripe/route.ts");
const webhookHttpSrc = file("lib/billing/webhook-http.ts");
const stripeSrc = file("lib/billing/stripe.ts");
const envExample = file(".env.local.example");
const migrations = readdirSync("supabase/migrations")
  .filter((name) => name.endsWith(".sql"))
  .sort();

console.log("=== BILLING-1 subscription authority foundation ===\n");

assert(
  "046 billing foundation remains",
  migrations.includes("046_billing_foundation.sql")
);
assert(
  "049 organisation memberships is latest numbered local migration",
  migrations.includes("047_past_due_authority.sql") &&
    migrations.includes("048_billing_checkout_trial.sql") &&
    migrations.includes("049_organisation_memberships.sql") &&
    migrations[migrations.length - 1] === "049_organisation_memberships.sql"
);
assert(
  "047 only adds past_due_since",
  /add column if not exists past_due_since timestamptz/.test(
    file("supabase/migrations/047_past_due_authority.sql")
  ) &&
    !/create table/i.test(file("supabase/migrations/047_past_due_authority.sql"))
);
assert("046 does not drop subscription_tier", !/drop column.*subscription_tier/i.test(migration046));
assert(
  "046 deprecates organisations.subscription_tier in comment only",
  /DEPRECATED/.test(migration046) && /subscription_tier/.test(migration046)
);
assert(
  "046 creates org_billing_customers",
  /create table if not exists public\.org_billing_customers/.test(migration046)
);
assert(
  "046 creates org_subscriptions",
  /create table if not exists public\.org_subscriptions/.test(migration046)
);
assert(
  "046 creates stripe_processed_events",
  /create table if not exists public\.stripe_processed_events/.test(migration046)
);
assert(
  "046 creates org_billing_overrides",
  /create table if not exists public\.org_billing_overrides/.test(migration046)
);
assert(
  "046 unique org+environment on customers",
  /unique \(org_id, billing_environment\)/.test(migration046)
);
assert(
  "046 unique stripe customer+environment",
  /unique \(stripe_customer_id, billing_environment\)/.test(migration046)
);
assert(
  "046 allows nullable Stripe ids on internal_trial",
  /source in \('internal_trial', 'override'\)/.test(migration046)
);
assert(
  "046 billing_environment on all four tables",
  (migration046.match(/billing_environment text not null/g) ?? []).length >= 4
);
assert(
  "authenticated select-only on customer/subscription",
  /grant select on table public\.org_billing_customers to authenticated/.test(
    migration046
  ) &&
    /grant select on table public\.org_subscriptions to authenticated/.test(
      migration046
    ) &&
    !/grant insert on table public\.org_billing_customers to authenticated/.test(
      migration046
    )
);
assert(
  "no authenticated write policies on billing tables",
  !/on public\.org_billing_customers for insert/.test(migration046) &&
    !/on public\.org_subscriptions for update/.test(migration046) &&
    !/on public\.org_billing_overrides for select/.test(migration046) &&
    !/on public\.stripe_processed_events for select/.test(migration046)
);
assert(
  "RLS uses auth_org_id for org isolation",
  /org_id = public\.auth_org_id\(\)/.test(migration046)
);
assert(
  "anon revoked from billing tables",
  /revoke all on table public\.org_billing_customers from public, anon, authenticated/.test(
    migration046
  )
);
assert(
  "created_by on overrides is nullable",
  /created_by uuid references public\.profiles/.test(migration046) &&
    /created_by is nullable/i.test(migration046)
);
assert(
  "046 does not alter estimate/pricing/quote money tables",
  !/alter table public\.(quotes|quote_items|pricing_items|estimates|estimate_line_items)/.test(
    migration046
  )
);

assert("local unset BILLING_ENVIRONMENT resolves test", resolveBillingEnvironment({}) === "test");
assert(
  "local explicit test resolves test",
  resolveBillingEnvironment({ BILLING_ENVIRONMENT: "test" }) === "test"
);

let localLiveFailed = false;
try {
  resolveBillingEnvironment({ BILLING_ENVIRONMENT: "live" });
} catch {
  localLiveFailed = true;
}
assert("local live fails closed", localLiveFailed);

let unknownFailed = false;
try {
  resolveBillingEnvironment({ BILLING_ENVIRONMENT: "sandbox" });
} catch {
  unknownFailed = true;
}
assert("unknown BILLING_ENVIRONMENT fails closed", unknownFailed);

assert(
  "hosted preview requires explicit test",
  resolveBillingEnvironment({
    VERCEL_ENV: "preview",
    BILLING_ENVIRONMENT: "test",
  }) === "test"
);

let previewLiveFailed = false;
try {
  resolveBillingEnvironment({
    VERCEL_ENV: "preview",
    BILLING_ENVIRONMENT: "live",
  });
} catch {
  previewLiveFailed = true;
}
assert("hosted preview rejects live", previewLiveFailed);

let previewMissingFailed = false;
try {
  resolveBillingEnvironment({ VERCEL_ENV: "preview" });
} catch {
  previewMissingFailed = true;
}
assert("hosted preview does not infer test from VERCEL_ENV alone", previewMissingFailed);

assert(
  "hosted production requires explicit live",
  resolveBillingEnvironment({
    VERCEL_ENV: "production",
    BILLING_ENVIRONMENT: "live",
  }) === "live"
);

let productionTestFailed = false;
try {
  resolveBillingEnvironment({
    VERCEL_ENV: "production",
    BILLING_ENVIRONMENT: "test",
  });
} catch {
  productionTestFailed = true;
}
assert("hosted production rejects test", productionTestFailed);

assert("test env matches livemode=false", eventMatchesBillingEnvironment("test", false));
assert("live env matches livemode=true", eventMatchesBillingEnvironment("live", true));
assert("test env rejects livemode=true", !eventMatchesBillingEnvironment("test", true));
assert("live env rejects livemode=false", !eventMatchesBillingEnvironment("live", false));

assert("plan catalogue versioned", PLAN_CATALOGUE_VERSION === 1);
assert("builder included/max users = 1", PLAN_CATALOGUE.builder.includedUsers === 1 && PLAN_CATALOGUE.builder.maxUsers === 1);
assert(
  "business included 1 max 5",
  PLAN_CATALOGUE.business.includedUsers === 1 && PLAN_CATALOGUE.business.maxUsers === 5
);
assert("custom is admin/configurable", PLAN_CATALOGUE.custom.maxUsers === null);
assert("trial is 14 days, business basis, 1 user", TRIAL_DURATION_DAYS === 14 && TRIAL_ENTITLEMENT_BASIS_PLAN === "business" && TRIAL_INCLUDED_USERS === 1);
assert(
  "plan catalogue has no Stripe price ids",
  !file("lib/billing/plans.ts").includes("price_")
);

const builderPlan = resolvePlanFromStripePriceItems(
  [{ priceId: PRICES.builderMonthly, quantity: 1 }],
  PRICES
);
assert(
  "builder price maps to builder seats=1",
  builderPlan.ok &&
    builderPlan.planCode === "builder" &&
    builderPlan.paidSeatQuantity === 1
);

const businessBase = resolvePlanFromStripePriceItems(
  [{ priceId: PRICES.businessBaseMonthly, quantity: 1 }],
  PRICES
);
assert(
  "business base maps to business seats=1",
  businessBase.ok &&
    businessBase.planCode === "business" &&
    businessBase.paidSeatQuantity === 1 &&
    extraSeatQuantityFromPaidSeats(businessBase.paidSeatQuantity) === 0
);

const businessSeats = resolvePlanFromStripePriceItems(
  [
    { priceId: PRICES.businessBaseMonthly, quantity: 1 },
    { priceId: PRICES.businessSeatMonthly, quantity: 2 },
  ],
  PRICES
);
assert(
  "business base + 2 extra seats → paid_seat_quantity=3",
  businessSeats.ok &&
    businessSeats.planCode === "business" &&
    businessSeats.paidSeatQuantity === 3 &&
    extraSeatQuantityFromPaidSeats(3) === 2
);

const unknownPrice = resolvePlanFromStripePriceItems(
  [{ priceId: "price_unknown", quantity: 1 }],
  PRICES
);
assert("unknown Price is rejected", !unknownPrice.ok && unknownPrice.errorCode === "unknown_price");

const mixed = resolvePlanFromStripePriceItems(
  [
    { priceId: PRICES.builderMonthly, quantity: 1 },
    { priceId: PRICES.businessBaseMonthly, quantity: 1 },
  ],
  PRICES
);
assert("builder+business mix is rejected", !mixed.ok);

assert(
  "active maps to active",
  mapStripeSubscriptionStatus({
    stripeStatus: "active",
    cancelAtPeriodEnd: false,
    pauseCollection: false,
  }) === "active"
);
assert(
  "canceled maps to cancelled",
  mapStripeSubscriptionStatus({
    stripeStatus: "canceled",
    cancelAtPeriodEnd: false,
    pauseCollection: false,
  }) === "cancelled"
);
assert(
  "cancel_at_period_end maps to scheduled_to_cancel",
  mapStripeSubscriptionStatus({
    stripeStatus: "active",
    cancelAtPeriodEnd: true,
    pauseCollection: false,
  }) === "scheduled_to_cancel"
);
assert(
  "pause_collection maps to paused",
  mapStripeSubscriptionStatus({
    stripeStatus: "active",
    cancelAtPeriodEnd: false,
    pauseCollection: true,
  }) === "paused"
);

const trial = buildInternalTrialSubscription({
  id: "trial-1",
  orgId: ORG_A,
  billingEnvironment: "test",
  now: new Date("2026-09-01T00:00:00.000Z"),
});
assert(
  "no-card trial is representable without Stripe ids",
  isNoCardInternalTrial(trial) &&
    trial.planCode === "business" &&
    trial.paidSeatQuantity === 1 &&
    trial.source === "internal_trial"
);
assert(
  "persisted no-card trial status stays trialing",
  trial.status === "trialing"
);
assert(
  "future trial_ends_at derives trialing",
  deriveInternalTrialAccessState(trial, new Date("2026-09-07T00:00:00.000Z")) ===
    "trialing"
);
assert(
  "past trial_ends_at derives trial_expired without changing persisted status",
  deriveInternalTrialAccessState(trial, new Date("2026-09-20T00:00:00.000Z")) ===
    "trial_expired" && trial.status === "trialing"
);
assert(
  "trial_expired is not a persisted subscription status",
  !file("supabase/migrations/046_billing_foundation.sql").includes(
    "trial_expired"
  )
);

assert(
  "duplicate processed event is skipped",
  decideProcessedEventClaim({ status: "processed" }).action === "skip"
);
assert(
  "failed event can be retried",
  decideProcessedEventClaim({ status: "failed" }).reason === "retry_failed"
);
assert(
  "received event is treated in-flight",
  decideProcessedEventClaim({ status: "received" }).reason === "in_flight"
);
assert(
  "older event is not applied",
  !shouldApplyStripeEvent({
    eventCreatedUnix: 1_700_000_050,
    lastAppliedEventCreatedAt: new Date(1_700_000_200 * 1000).toISOString(),
  })
);
assert(
  "newer event is applied",
  shouldApplyStripeEvent({
    eventCreatedUnix: 1_700_000_300,
    lastAppliedEventCreatedAt: new Date(1_700_000_200 * 1000).toISOString(),
  })
);

const cross = assertCustomerMappingAssignable({
  orgId: ORG_B,
  billingEnvironment: "test",
  stripeCustomerId: CUSTOMER_A,
  existingByOrg: null,
  existingByCustomer: mappedCustomer(ORG_A, CUSTOMER_A),
});
assert("cross-org customer reassignment is denied", !cross.ok);

const override: OrgBillingOverride = {
  id: "ovr_1",
  orgId: ORG_A,
  billingEnvironment: "test",
  planCode: "business",
  overrideType: "administratively_comped",
  status: "administratively_comped",
  paidSeatQuantity: 2,
  startsAt: "2026-01-01T00:00:00.000Z",
  expiresAt: "2026-12-01T00:00:00.000Z",
  reason: "beta comp",
  createdBy: null,
  operatorRef: "ops:billing-1",
  createdAt: nowIso(),
};
assert(
  "override foundation is active inside expiry",
  isBillingOverrideActive(override, new Date("2026-06-01T00:00:00.000Z"))
);
assert(
  "override foundation expires",
  !isBillingOverrideActive(override, new Date("2027-01-01T00:00:00.000Z"))
);

const summary = assembleOrgBillingState({
  orgId: ORG_A,
  billingEnvironment: "test",
  customer: mappedCustomer(ORG_A, CUSTOMER_A),
  subscription: trial,
  overrides: [override],
  now: new Date("2026-06-01T00:00:00.000Z"),
});
assert(
  "billing summary returns customer, subscription, override without enforcing access",
  summary.customer?.stripeCustomerId === CUSTOMER_A &&
    summary.subscription?.source === "internal_trial" &&
    summary.activeOverride?.id === "ovr_1" &&
    summary.effectiveTrialState === "trialing"
);

assert(
  "quotes.send remains allowed in compatibility without billing row",
  evaluateOrgEntitlement({
    state: {
      orgId: ORG_A,
      billingEnvironment: "test",
      customer: null,
      subscription: null,
      activeOverride: null,
      effectiveTrialState: null,
    },
    capability: "quotes.send",
    mode: "compatibility",
  }).ok === true
);
assert(
  "quotes.acceptance remains allowed in compatibility without billing row",
  evaluateOrgEntitlement({
    state: {
      orgId: ORG_A,
      billingEnvironment: "test",
      customer: null,
      subscription: null,
      activeOverride: null,
      effectiveTrialState: null,
    },
    capability: "quotes.acceptance",
    mode: "compatibility",
  }).ok === true
);
assert(
  "BILLING-1 store does not own entitlement enforcement",
  entitlementsSrc.includes("evaluateOrgEntitlement") &&
    entitlementsSrc.includes("requireOrgEntitlement") &&
    !entitlementsSrc.includes("org_subscriptions")
);

assert("webhook route uses nodejs runtime", /runtime = "nodejs"/.test(webhookRouteSrc));
assert(
  "webhook route does not require a session",
  !/createClient|getUser|cookies\(/.test(webhookRouteSrc)
);
assert(
  "webhook verifies Stripe signature on raw body",
  /request\.text\(\)/.test(webhookHttpSrc) &&
    /constructStripeWebhookEvent/.test(webhookHttpSrc) &&
    /stripe-signature/.test(webhookHttpSrc)
);
assert(
  "Stripe client is server-only and lazy",
  /import "server-only"/.test(stripeSrc) &&
    /function getStripeClient/.test(stripeSrc) &&
    !/new Stripe\(process\.env/.test(stripeSrc)
);
assert(
  "no publishable key in BILLING-1 app code",
  !/NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY/.test(stripeSrc) &&
    !/loadStripe/.test(file("lib/billing/webhook-http.ts"))
);
assert(
  "env example documents BILLING-1 test vars",
  /BILLING_ENVIRONMENT/.test(envExample) &&
    /STRIPE_PRICE_BUILDER_MONTHLY/.test(envExample)
);

const recon = diffStripeAgainstMirror({
  billingEnvironment: "test",
  mirrors: [trial],
  stripe: [
    {
      stripeSubscriptionId: "sub_missing",
      stripeCustomerId: CUSTOMER_A,
      planCode: "builder",
      paidSeatQuantity: 1,
      livemode: false,
    },
  ],
});
assert("reconciliation seam reports missing mirror", recon.some((issue) => issue.kind === "missing_mirror"));

assert(
  "safe billing logs omit secrets and bodies",
  !billingLogLine({
    stripeEventId: "evt_1",
    eventType: "customer.subscription.updated",
    billingEnvironment: "test",
    result: "processed",
    orgId: ORG_A,
  }).includes("data") &&
    !billingLogLine({ stripeEventId: "whsec_secret" }).includes("whsec")
);

async function runAsyncChecks() {
  const store = createMemoryStore({
    customers: [mappedCustomer(ORG_A, CUSTOMER_A)],
  });

  const created = await process(
    store,
    event({
      id: "evt_sub_created",
      type: "customer.subscription.created",
      created: 1_700_000_100,
      object: subscriptionObject({
        id: "sub_builder",
        customer: CUSTOMER_A,
        items: [{ price: PRICES.builderMonthly }],
      }),
    })
  );
  const afterCreate = await store.getSubscriptionByOrg(ORG_A, "test");
  assert("subscription.created mirrors builder", created.result === "processed" && afterCreate?.planCode === "builder" && afterCreate.paidSeatQuantity === 1 && afterCreate.source === "stripe");

  const duplicate = await process(
    store,
    event({
      id: "evt_sub_created",
      type: "customer.subscription.created",
      created: 1_700_000_100,
      object: subscriptionObject({
        id: "sub_builder",
        customer: CUSTOMER_A,
        items: [{ price: PRICES.builderMonthly }],
      }),
    })
  );
  assert("duplicate Stripe event is idempotent", duplicate.result === "duplicate");

  const businessUpdate = await process(
    store,
    event({
      id: "evt_sub_updated",
      type: "customer.subscription.updated",
      created: 1_700_000_200,
      object: subscriptionObject({
        id: "sub_builder",
        customer: CUSTOMER_A,
        items: [
          { price: PRICES.businessBaseMonthly },
          { price: PRICES.businessSeatMonthly, quantity: 1 },
        ],
      }),
    })
  );
  const afterBusiness = await store.getSubscriptionByOrg(ORG_A, "test");
  assert(
    "subscription.updated maps business + extra seat",
    businessUpdate.result === "processed" &&
      afterBusiness?.planCode === "business" &&
      afterBusiness.paidSeatQuantity === 2
  );

  const stale = await process(
    store,
    event({
      id: "evt_stale",
      type: "customer.subscription.updated",
      created: 1_700_000_050,
      object: subscriptionObject({
        id: "sub_builder",
        customer: CUSTOMER_A,
        status: "canceled",
        items: [{ price: PRICES.builderMonthly }],
      }),
    })
  );
  const afterStale = await store.getSubscriptionByOrg(ORG_A, "test");
  assert(
    "out-of-order older event does not overwrite",
    stale.result === "ignored" &&
      stale.errorCode === "stale_event" &&
      afterStale?.planCode === "business" &&
      afterStale.status === "active"
  );

  const scheduled = await process(
    store,
    event({
      id: "evt_cancel_at_end",
      type: "customer.subscription.updated",
      created: 1_700_000_300,
      object: subscriptionObject({
        id: "sub_builder",
        customer: CUSTOMER_A,
        cancelAtPeriodEnd: true,
        items: [
          { price: PRICES.businessBaseMonthly },
          { price: PRICES.businessSeatMonthly, quantity: 1 },
        ],
      }),
    })
  );
  const afterScheduled = await store.getSubscriptionByOrg(ORG_A, "test");
  assert(
    "scheduled cancellation is mirrored",
    scheduled.result === "processed" &&
      afterScheduled?.status === "scheduled_to_cancel"
  );

  const liveMismatch = await process(
    createMemoryStore({ customers: [mappedCustomer(ORG_A, CUSTOMER_A)] }),
    event({
      id: "evt_live",
      type: "customer.subscription.created",
      created: 1_700_000_400,
      livemode: true,
      object: subscriptionObject({
        id: "sub_live",
        customer: CUSTOMER_A,
        items: [{ price: PRICES.builderMonthly }],
      }),
    }),
    "test"
  );
  assert(
    "test environment rejects live Stripe events",
    liveMismatch.result === "ignored" &&
      liveMismatch.errorCode === "environment_mismatch"
  );

  const unknown = await process(
    createMemoryStore({ customers: [mappedCustomer(ORG_A, CUSTOMER_A)] }),
    event({
      id: "evt_unknown_price",
      type: "customer.subscription.created",
      created: 1_700_000_500,
      object: subscriptionObject({
        id: "sub_unknown",
        customer: CUSTOMER_A,
        items: [{ price: "price_not_configured" }],
      }),
    })
  );
  assert(
    "unknown Price fails event processing",
    unknown.result === "failed" && unknown.errorCode === "unknown_price"
  );

  const checkout = await process(
    createMemoryStore(),
    event({
      id: "evt_checkout",
      type: "checkout.session.completed",
      created: 1_700_000_600,
      object: { id: "cs_test", object: "checkout.session" },
    })
  );
  assert(
    "checkout.session.completed without customer is ignored, not subscription authority",
    checkout.result === "ignored" &&
      checkout.errorCode === "checkout_without_customer"
  );

  const checkoutMapped = await process(
    createMemoryStore({ customers: [mappedCustomer(ORG_A, CUSTOMER_A)] }),
    event({
      id: "evt_checkout_mapped",
      type: "checkout.session.completed",
      created: 1_700_000_610,
      object: {
        id: "cs_test_mapped",
        object: "checkout.session",
        mode: "subscription",
        customer: CUSTOMER_A,
        client_reference_id: ORG_A,
        metadata: {
          org_id: ORG_A,
          billing_environment: "test",
          selected_plan: "builder",
        },
      },
    })
  );
  assert(
    "checkout.session.completed corroborates mapping without writing a plan",
    checkoutMapped.result === "processed" &&
      checkoutMapped.errorCode === "checkout_corroborated" &&
      checkoutMapped.orgId === ORG_A
  );

  const invoiceStore = createMemoryStore({
    customers: [mappedCustomer(ORG_A, CUSTOMER_A)],
    subscriptions: [
      {
        ...trial,
        source: "stripe",
        status: "active",
        stripeSubscriptionId: "sub_pay",
        stripeCustomerId: CUSTOMER_A,
        lastStripeEventCreatedAt: new Date(1_700_000_100 * 1000).toISOString(),
        lastStripeEventId: "evt_prior",
      },
    ],
  });
  const invoicePaid = await process(
    invoiceStore,
    event({
      id: "evt_invoice_paid",
      type: "invoice.paid",
      created: 1_700_000_700,
      object: {
        id: "in_paid",
        customer: CUSTOMER_A,
        subscription: "sub_pay",
      },
    })
  );
  const afterPaid = await invoiceStore.getSubscriptionByOrg(ORG_A, "test");
  assert(
    "invoice.paid does not force active overwrite",
    invoicePaid.result === "processed" && afterPaid?.status === "active"
  );

  const invoiceFailed = await process(
    invoiceStore,
    event({
      id: "evt_invoice_failed",
      type: "invoice.payment_failed",
      created: 1_700_000_800,
      object: {
        id: "in_fail",
        customer: CUSTOMER_A,
        subscription: "sub_pay",
      },
    })
  );
  const afterFailed = await invoiceStore.getSubscriptionByOrg(ORG_A, "test");
  const failedAt = new Date(1_700_000_800 * 1000).toISOString();
  assert(
    "invoice.payment_failed can mark past_due without replacing subscription object",
    invoiceFailed.result === "processed" && afterFailed?.status === "past_due"
  );
  assert(
    "active → past_due sets past_due_since from invoice event time",
    afterFailed?.pastDueSince === failedAt &&
      afterFailed.lastStripeEventCreatedAt ===
        new Date(1_700_000_100 * 1000).toISOString()
  );

  const repeatFailed = await process(
    invoiceStore,
    event({
      id: "evt_invoice_failed_repeat",
      type: "invoice.payment_failed",
      created: 1_700_000_800 + 2 * 86400,
      object: {
        id: "in_fail_repeat",
        customer: CUSTOMER_A,
        subscription: "sub_pay",
      },
    })
  );
  const afterRepeat = await invoiceStore.getSubscriptionByOrg(ORG_A, "test");
  assert(
    "repeated payment_failed does not reset past_due_since",
    repeatFailed.result === "processed" &&
      afterRepeat?.status === "past_due" &&
      afterRepeat.pastDueSince === failedAt
  );

  const recovered = await process(
    invoiceStore,
    event({
      id: "evt_sub_recovered",
      type: "customer.subscription.updated",
      created: 1_700_001_000,
      object: subscriptionObject({
        id: "sub_pay",
        customer: CUSTOMER_A,
        status: "active",
        items: [{ price: PRICES.builderMonthly }],
      }),
    })
  );
  const afterRecovered = await invoiceStore.getSubscriptionByOrg(ORG_A, "test");
  assert(
    "past_due → active clears past_due_since",
    recovered.result === "processed" &&
      afterRecovered?.status === "active" &&
      afterRecovered.pastDueSince === null
  );

  const stalePastDue = await process(
    invoiceStore,
    event({
      id: "evt_stale_past_due",
      type: "customer.subscription.updated",
      created: 1_700_000_200,
      object: subscriptionObject({
        id: "sub_pay",
        customer: CUSTOMER_A,
        status: "past_due",
        items: [{ price: PRICES.builderMonthly }],
      }),
    })
  );
  const afterStalePastDue = await invoiceStore.getSubscriptionByOrg(ORG_A, "test");
  assert(
    "old webhook after recovery cannot recreate stale past_due",
    stalePastDue.result === "ignored" &&
      stalePastDue.errorCode === "stale_event" &&
      afterStalePastDue?.status === "active" &&
      afterStalePastDue.pastDueSince === null
  );

  const staleInvoice = await process(
    invoiceStore,
    event({
      id: "evt_stale_invoice_failed",
      type: "invoice.payment_failed",
      created: 1_700_000_900,
      object: {
        id: "in_fail_stale",
        customer: CUSTOMER_A,
        subscription: "sub_pay",
      },
    })
  );
  const afterStaleInvoice = await invoiceStore.getSubscriptionByOrg(ORG_A, "test");
  assert(
    "payment_failed after newer subscription active cannot regress state",
    staleInvoice.result === "ignored" &&
      staleInvoice.errorCode === "stale_event" &&
      afterStaleInvoice?.status === "active" &&
      afterStaleInvoice.pastDueSince === null
  );

  const secondIncident = await process(
    invoiceStore,
    event({
      id: "evt_new_past_due",
      type: "customer.subscription.updated",
      created: 1_700_002_000,
      object: subscriptionObject({
        id: "sub_pay",
        customer: CUSTOMER_A,
        status: "past_due",
        items: [{ price: PRICES.builderMonthly }],
      }),
    })
  );
  const afterSecond = await invoiceStore.getSubscriptionByOrg(ORG_A, "test");
  assert(
    "new past_due incident after recovery sets a new past_due_since",
    secondIncident.result === "processed" &&
      afterSecond?.status === "past_due" &&
      afterSecond.pastDueSince === new Date(1_700_002_000 * 1000).toISOString()
  );

  const mappingStore = createMemoryStore({
    customers: [mappedCustomer(ORG_A, CUSTOMER_A)],
  });
  const stolen = await upsertTrustedCustomerMapping(mappingStore, {
    orgId: ORG_B,
    billingEnvironment: "test",
    stripeCustomerId: CUSTOMER_A,
  });
  assert("mapping service blocks cross-org customer steal", stolen.ok === false);

  const createdMap = await upsertTrustedCustomerMapping(mappingStore, {
    orgId: ORG_B,
    billingEnvironment: "test",
    stripeCustomerId: CUSTOMER_B,
  });
  assert("mapping service upserts trusted identity", createdMap.ok === true);

  const loaded = await loadOrgBillingState("test-org", "test", createMemoryStore());
  assert(
    "getOrgBillingState/load helper returns empty state without throwing",
    loaded.subscription === null && loaded.customer === null
  );

  const webhookSecret = "whsec_test_billing_1";
  const payload = JSON.stringify({
    id: "evt_signed",
    object: "event",
    type: "checkout.session.completed",
    livemode: false,
    created: 1700000000,
    data: { object: { id: "cs_signed" } },
  });
  const header = Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: webhookSecret,
  });
  const verified = Stripe.webhooks.constructEvent(payload, header, webhookSecret);
  assert("signed Stripe webhook fixture verifies", verified.id === "evt_signed");
  let badSig = false;
  try {
    Stripe.webhooks.constructEvent(payload, header, "whsec_other");
  } catch {
    badSig = true;
  }
  assert("invalid Stripe signature is rejected", badSig);

  const billingLibFiles = [
    "lib/billing/environment.ts",
    "lib/billing/plans.ts",
    "lib/billing/prices.ts",
    "lib/billing/webhook.ts",
    "lib/billing/mirror.ts",
  ];
  assert(
    "billing lib does not import estimator/commercial engines",
    billingLibFiles.every((path) => {
      const src = file(path);
      return !src.includes("lib/estimate") && !src.includes("lib/pricing") && !src.includes("lib/quotes/");
    })
  );

  const uiImport = [
    "components/quotes/QuoteWorkspace.tsx",
    "components/quotes/QuotePublicDocument.tsx",
    "app/(protected)/app/projects/[projectId]/quotes/[quoteId]/page.tsx",
  ];
  assert(
    "no paywall: product UI does not import billing state",
    uiImport.every((path) => {
      try {
        const src = file(path);
        return !src.includes("@/lib/billing") && !src.includes("getOrgBillingState");
      } catch {
        return true;
      }
    })
  );
}

runAsyncChecks()
  .then(() => {
    if (!process.exitCode) {
      console.log("\nBILLING-1 verifier passed.");
    } else {
      console.log("\nBILLING-1 verifier failed.");
    }
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
