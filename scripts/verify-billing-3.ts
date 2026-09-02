/**
 * BILLING-3 trial / Checkout / Portal / Billing UX.
 * Fixtures and domain tests only. No live Stripe charges. No paid AI.
 *
 * Run: npx tsx scripts/verify-billing-3.ts
 */
import { readFileSync, readdirSync } from "node:fs";
import { buildBillingPageView } from "../lib/billing/billing-page-view";
import {
  canCreateSubscriptionCheckout,
  parseCheckoutPlanCode,
  pickReusableOpenCheckoutSession,
  resolveCheckoutPriceId,
} from "../lib/billing/checkout-plan";
import { corroborateCheckoutSession } from "../lib/billing/checkout-session";
import { PLAN_DISPLAY_CATALOGUE } from "../lib/billing/display-catalogue";
import { evaluateOrgEntitlement } from "../lib/billing/entitlements";
import { checkoutGstMode, invoiceIncludesConfiguredTaxRate } from "../lib/billing/gst";
import {
  customerCreateParamsAreStable,
  stripeCustomerCreateParams,
  stripeCustomerProfileUpdateParams,
} from "../lib/billing/customer-identity";
import {
  mapStripeSubscriptionToMirror,
  parseStripeSubscriptionLike,
  pendingUpdatePriceIdsFromSubscriptionObject,
} from "../lib/billing/mirror";
import {
  canDowngradeBusinessToBuilder,
  canUpgradeBuilderToBusiness,
} from "../lib/billing/plan-change";
import { resolvePlanFromStripePriceItems } from "../lib/billing/prices";
import type { BillingStore, EventClaimRecord } from "../lib/billing/store";
import {
  resolveCustomerCreateRace,
  stripeCheckoutIdempotencyKey,
  stripeCustomerCreateIdempotencyKey,
  stripeUpgradeToBusinessIdempotencyKey,
} from "../lib/billing/stripe-idempotency";
import { deriveTrialCountdown, trialBannerNotice } from "../lib/billing/trial-countdown";
import { buildInternalTrialSubscription } from "../lib/billing/trial";
import {
  BUILDER_TO_BUSINESS_BILLING_CYCLE_ANCHOR,
  BUILDER_TO_BUSINESS_PAYMENT_BEHAVIOR,
  BUILDER_TO_BUSINESS_PRORATION_BEHAVIOR,
  buildBuilderToBusinessUpgradeParams,
  resolveBuilderToBusinessMutation,
  resolveUpgradeConfirmKind,
  subscriptionAlreadyOnBusinessPrice,
} from "../lib/billing/upgrade-policy";
import type {
  BillingEnvironment,
  OrgBillingCustomer,
  OrgBillingOverride,
  OrgBillingState,
  OrgSubscription,
  StripeEventLike,
  StripePriceConfig,
} from "../lib/billing/types";
import { processBillingStripeEvent } from "../lib/billing/webhook";

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
const NOW = new Date("2026-09-02T00:00:00.000Z");

function nowIso(): string {
  return NOW.toISOString();
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

function emptyState(): OrgBillingState {
  return {
    orgId: ORG_A,
    billingEnvironment: "test",
    customer: null,
    subscription: null,
    activeOverride: null,
    effectiveTrialState: null,
  };
}

function stripeSub(plan: "builder" | "business"): OrgSubscription {
  return {
    id: "sub_1",
    orgId: ORG_A,
    billingEnvironment: "test",
    planCode: plan,
    status: "active",
    source: "stripe",
    stripeSubscriptionId: "sub_stripe",
    stripeCustomerId: CUSTOMER_A,
    stripeBasePriceId: plan === "builder" ? PRICES.builderMonthly : PRICES.businessBaseMonthly,
    stripeSeatPriceId: null,
    paidSeatQuantity: 1,
    currentPeriodStart: nowIso(),
    currentPeriodEnd: "2026-10-02T00:00:00.000Z",
    trialEndsAt: null,
    cancelAtPeriodEnd: false,
    cancelledAt: null,
    lastStripeEventCreatedAt: nowIso(),
    lastStripeEventId: "evt_1",
    pastDueSince: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

console.log("=== BILLING-3 trial / Checkout / Portal ===\n");

const migrations = readdirSync("supabase/migrations")
  .filter((name) => name.endsWith(".sql"))
  .sort();
const migration048 = file("supabase/migrations/048_billing_checkout_trial.sql");
const provision032 = file(
  "supabase/migrations/032_transactional_signup_provisioning.sql"
);
const checkoutPlanSrc = file("lib/billing/checkout-plan.ts");
const billingActionsSrc = file("lib/billing/billing-actions.ts");
const webhookSrc = file("lib/billing/webhook.ts");
const billingPageSrc = file("components/billing/BillingPageContent.tsx");
const acceptanceSrc = file("lib/quotes/acceptance-actions.ts");
const rls046 = file("supabase/migrations/046_billing_foundation.sql");

assert(
  "050 is latest numbered local migration; 048 trial remains",
  migrations.at(-1) === "050_unbind_removed_membership.sql" &&
    migrations.includes("049_organisation_memberships.sql") &&
    /ensure_org_internal_trial/.test(migration048)
);
assert(
  "048 forbids Production apply in this programme but is environment-neutral SQL",
  /Do NOT apply to Production/.test(migration048) &&
    /billing_runtime_config/.test(migration048) &&
    !/select 'test'::text/.test(migration048) &&
    !/shhpjsoldmqtkdbgrbtm/.test(migration048) &&
    !/lxvnylhsbvudzzupxeqr/.test(migration048) &&
    /never NEXT_PUBLIC/.test(migration048)
);
assert(
  "DB env config is a singleton table, service_role writable, no authenticated grants",
  /create table if not exists public\.billing_runtime_config/.test(migration048) &&
    /check \(id\)/.test(migration048) &&
    /revoke all on table public\.billing_runtime_config from public, anon, authenticated/.test(
      migration048
    ) &&
    /grant select, insert, update, delete on table public\.billing_runtime_config to service_role/.test(
      migration048
    ) &&
    /No authenticated policies/.test(migration048)
);
assert(
  "runtime env fails closed when missing or invalid",
  /BILLING:RUNTIME_ENV_UNCONFIGURED/.test(migration048) &&
    /BILLING:RUNTIME_ENV_INVALID/.test(migration048) &&
    /v_count is distinct from 1/.test(migration048)
);
assert(
  "048 does not seed test or live",
  !/insert into public\.billing_runtime_config/.test(migration048)
);
assert(
  "trial insert is ON CONFLICT DO NOTHING (first create wins)",
  /on conflict \(org_id, billing_environment\) do nothing/.test(migration048) &&
    !/trial_ends_at\s*=/.test(migration048)
);
assert(
  "provision uses billing_runtime_environment and never accepts env from caller",
  /v_env text := public\.billing_runtime_environment\(\)/.test(migration048) &&
    !/p_billing_environment/.test(migration048) &&
    /Never accepts user_id\/org_id\/billing_environment/.test(migration048)
);
assert(
  "provision calls ensure_org_internal_trial on new and already-provisioned paths",
  /perform public\.ensure_org_internal_trial\(v_existing_org\)/.test(migration048) &&
    /perform public\.ensure_org_internal_trial\(v_org_id\)/.test(migration048)
);
assert(
  "032 original provision body is preserved as history; 048 replaces the function",
  /provision_organisation_for_new_user/.test(provision032) &&
    /ensure_org_internal_trial/.test(migration048)
);
assert(
  "authenticated cannot execute trial ensure or bootstrap",
  /revoke all on function public\.ensure_org_internal_trial/.test(migration048) &&
    /from public, anon, authenticated/.test(migration048) &&
    /revoke all on function public\.bootstrap_missing_preview_internal_trials/.test(
      migration048
    )
);
assert(
  "Preview bootstrap uses now() + 14 days, not organisations.created_at",
  /bootstrap_missing_preview_internal_trials/.test(migration048) &&
    /now\(\) \+ interval '14 days'/.test(migration048) &&
    !/o\.created_at/.test(migration048) &&
    /BOOTSTRAP_PREVIEW_TEST_ONLY/.test(migration048)
);
assert(
  "no invitation/membership tables in 048",
  /No membership\/invitation tables/.test(migration048) &&
    !/org_membership/.test(migration048) &&
    /billing_runtime_config/.test(migration048)
);

assert(
  "Preview bootstrap refuses live (zero inserts)",
  /if v_env is distinct from 'test'/.test(migration048) &&
    /BILLING:BOOTSTRAP_PREVIEW_TEST_ONLY/.test(migration048)
);
assert(
  "authenticated cannot mutate runtime environment",
  /revoke all on table public\.billing_runtime_config from public, anon, authenticated/.test(
    migration048
  ) &&
    !/grant insert on table public\.billing_runtime_config to authenticated/.test(
      migration048
    )
);

const trial = buildInternalTrialSubscription({
  id: "trial_1",
  orgId: ORG_A,
  billingEnvironment: "test",
  now: NOW,
});
const trialState: OrgBillingState = {
  ...emptyState(),
  subscription: trial,
  effectiveTrialState: "trialing",
};
assert(
  "internal trial may start Checkout",
  canCreateSubscriptionCheckout(trialState).ok
);

const activeBuilder: OrgBillingState = {
  ...emptyState(),
  subscription: stripeSub("builder"),
  customer: {
    id: "map_a",
    orgId: ORG_A,
    billingEnvironment: "test",
    stripeCustomerId: CUSTOMER_A,
    billingName: "A",
    billingEmail: "a@example.com",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
};
assert(
  "active Stripe subscription cannot open a second Checkout",
  !canCreateSubscriptionCheckout(activeBuilder).ok &&
    canCreateSubscriptionCheckout(activeBuilder).ok === false
);

const cancelled: OrgBillingState = {
  ...emptyState(),
  subscription: { ...stripeSub("builder"), status: "cancelled" },
};
assert(
  "cancelled Stripe subscription may retry Checkout",
  canCreateSubscriptionCheckout(cancelled).ok
);

assert("browser plan parser rejects Price IDs", parseCheckoutPlanCode("price_abc") === null);
assert("browser plan parser accepts builder", parseCheckoutPlanCode("builder") === "builder");
assert(
  "server maps builder to configured Price ID",
  resolveCheckoutPriceId("builder", PRICES) === PRICES.builderMonthly
);
assert(
  "server maps business to base Price only (no seat item)",
  resolveCheckoutPriceId("business", PRICES) === PRICES.businessBaseMonthly
);

const countdown14 = deriveTrialCountdown({
  trialEndsAt: new Date(NOW.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  effectiveTrialState: "trialing",
  now: NOW,
});
assert(
  "14-day countdown is whole days, not hours",
  countdown14?.daysRemaining === 14 &&
    countdown14.label.includes("14 days") &&
    countdown14.tone === "normal"
);
const countdown7 = deriveTrialCountdown({
  trialEndsAt: new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  effectiveTrialState: "trialing",
  now: NOW,
});
assert("7 days remaining is subtle banner", countdown7?.tone === "subtle");
const countdown3 = deriveTrialCountdown({
  trialEndsAt: new Date(NOW.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  effectiveTrialState: "trialing",
  now: NOW,
});
assert("3 days remaining is stronger banner", countdown3?.tone === "strong");
const expired = deriveTrialCountdown({
  trialEndsAt: new Date(NOW.getTime() - 1000).toISOString(),
  effectiveTrialState: "trial_expired",
  now: NOW,
});
assert("expired trial countdown is expired", expired?.expired === true);
assert(
  "normal trial has no app-wide banner",
  trialBannerNotice(countdown14) === null
);
assert(
  "expired trial has choose-plan banner",
  trialBannerNotice(expired)?.ctaLabel === "Choose a plan"
);

const view = buildBillingPageView(trialState, NOW);
assert(
  "billing page shows trial and allows plan selection",
  view.kind === "trial" && view.canCheckout && view.statusLabel === "Trial"
);

assert(
  "display catalogue holds NZD exclusive amounts; Checkout uses Price IDs",
  PLAN_DISPLAY_CATALOGUE.builder.exclusiveMonthlyNzd === 65 &&
    PLAN_DISPLAY_CATALOGUE.business.exclusiveMonthlyNzd === 79 &&
    PLAN_DISPLAY_CATALOGUE.business.extraSeatExclusiveMonthlyNzd === 35 &&
    !/6500/.test(checkoutPlanSrc) &&
    /resolveCheckoutPriceId/.test(billingActionsSrc)
);
assert(
  "Checkout enables Stripe promotion codes; no app coupon catalogue",
  /allow_promotion_codes:\s*true/.test(billingActionsSrc) &&
    !/coupon_code/.test(billingActionsSrc) &&
    !/promotion_codes/.test(file("supabase/migrations/048_billing_checkout_trial.sql"))
);
assert(
  "Checkout action input is an internal plan code, not a browser Price ID",
  /export async function startCheckout\(\s*planInput: string/.test(billingActionsSrc) &&
    /parseCheckoutPlanCode\(planInput\)/.test(billingActionsSrc)
);
assert(
  "success redirect waits for webhook; page does not write active/builder/business",
  /Confirming your subscription/.test(billingPageSrc) &&
    /getBillingPageState/.test(billingPageSrc) &&
    !/upsertSubscription/.test(billingPageSrc)
);
assert(
  "GST tax rate is optional env, not Quote GST",
  /readNzGstTaxRateId/.test(billingActionsSrc) &&
    /STRIPE_TAX_RATE_NZ_GST/.test(file(".env.local.example")) &&
    !/default_gst_rate/.test(billingActionsSrc) &&
    checkoutGstMode(null) === "exclusive_no_gst_line" &&
    checkoutGstMode("txr_test") === "exclusive_plus_configured_gst"
);

assert(
  "Customer create idempotency is stable per org+env and not client-exposed",
  stripeCustomerCreateIdempotencyKey("test", ORG_A) ===
    `quotr:customer:create:test:${ORG_A}` &&
    stripeCustomerCreateIdempotencyKey("live", ORG_A) !==
      stripeCustomerCreateIdempotencyKey("test", ORG_A) &&
    !/idempotencyKey/.test(billingPageSrc)
);
assert(
  "concurrent first Customer create reuses the same Stripe Customer",
  resolveCustomerCreateRace({
    mappingAfterCreate: null,
    createdStripeCustomerId: CUSTOMER_A,
    orgId: ORG_A,
  }) === "upsert" &&
    resolveCustomerCreateRace({
      mappingAfterCreate: { orgId: ORG_A, stripeCustomerId: CUSTOMER_A },
      createdStripeCustomerId: CUSTOMER_A,
      orgId: ORG_A,
    }) === "reuse" &&
    resolveCustomerCreateRace({
      mappingAfterCreate: { orgId: ORG_A, stripeCustomerId: "cus_other" },
      createdStripeCustomerId: CUSTOMER_A,
      orgId: ORG_A,
    }) === "conflict"
);
assert(
  "Checkout double-click reuses open session and shares a 30s Stripe key",
  pickReusableOpenCheckoutSession(
    [
      {
        mode: "subscription",
        url: "https://checkout.stripe.com/c/pay/cs_test_1",
        metadata: { selected_plan: "builder" },
        status: "open",
      },
    ],
    "builder"
  )?.url === "https://checkout.stripe.com/c/pay/cs_test_1" &&
    pickReusableOpenCheckoutSession(
      [
        {
          mode: "subscription",
          url: "https://checkout.stripe.com/c/pay/cs_test_1",
          metadata: { selected_plan: "builder" },
          status: "open",
        },
      ],
      "business"
    ) === null &&
    stripeCheckoutIdempotencyKey(ORG_A, "test", "builder", 30_000) ===
      stripeCheckoutIdempotencyKey(ORG_A, "test", "builder", 59_999) &&
    stripeCheckoutIdempotencyKey(ORG_A, "test", "builder", 30_000) !==
      stripeCheckoutIdempotencyKey(ORG_A, "test", "builder", 60_000)
);

assert(
  "Builder→Business uses always_invoice + pending_if_incomplete + unchanged cycle + webhook authority",
  BUILDER_TO_BUSINESS_PRORATION_BEHAVIOR === "always_invoice" &&
    BUILDER_TO_BUSINESS_PAYMENT_BEHAVIOR === "pending_if_incomplete" &&
    BUILDER_TO_BUSINESS_BILLING_CYCLE_ANCHOR === "unchanged" &&
    /payment_behavior/.test(file("lib/billing/upgrade-policy.ts")) &&
    /upgradeConfirmPath/.test(billingActionsSrc) &&
    /upgrade=\$\{kind\}/.test(file("lib/billing/upgrade-policy.ts")) &&
    /Confirming your upgrade/.test(billingPageSrc) &&
    !/plan_code:\s*"business"/.test(billingActionsSrc)
);
const upgradeParams = buildBuilderToBusinessUpgradeParams({
  builderItemId: "si_builder",
  businessPriceId: PRICES.businessBaseMonthly,
  orgId: ORG_A,
  billingEnvironment: "test",
  existingMetadata: { org_id: ORG_A },
});
assert(
  "upgrade pending update is price-only; GST is not re-sent",
  upgradeParams.items[0]?.price === PRICES.businessBaseMonthly &&
    upgradeParams.items[0]?.id === "si_builder" &&
    !("tax_rates" in (upgradeParams.items[0] ?? {})) &&
    !("default_tax_rates" in upgradeParams) &&
    upgradeParams.proration_behavior === "always_invoice" &&
    upgradeParams.payment_behavior === "pending_if_incomplete" &&
    upgradeParams.billing_cycle_anchor === "unchanged"
);
assert(
  "upgrade params never invent item tax_rates",
  !("tax_rates" in (upgradeParams.items[0] ?? {})) &&
    !("default_tax_rates" in upgradeParams)
);
assert(
  "upgrade double-click is idempotent per subscription",
  stripeUpgradeToBusinessIdempotencyKey("test", ORG_A, "sub_stripe") ===
    stripeUpgradeToBusinessIdempotencyKey("test", ORG_A, "sub_stripe") &&
    subscriptionAlreadyOnBusinessPrice(
      [{ priceId: PRICES.businessBaseMonthly }],
      PRICES
    ) &&
    !subscriptionAlreadyOnBusinessPrice(
      [{ priceId: PRICES.builderMonthly }],
      PRICES
    )
);
assert(
  "successful pending_if_incomplete upgrade mutates only when current is Builder",
  resolveBuilderToBusinessMutation({
    currentPriceIds: [PRICES.builderMonthly],
    pendingUpdate: null,
    prices: PRICES,
  }) === "mutate" &&
    resolveUpgradeConfirmKind({
      currentPriceIds: [PRICES.businessBaseMonthly],
      pendingUpdate: null,
      prices: PRICES,
    }) === "pending"
);
assert(
  "failed prorated payment keeps current Builder and does not mutate again",
  resolveBuilderToBusinessMutation({
    currentPriceIds: [PRICES.builderMonthly],
    pendingUpdate: {
      subscription_items: [{ price: PRICES.businessBaseMonthly }],
    },
    prices: PRICES,
  }) === "pending_equivalent" &&
    resolveUpgradeConfirmKind({
      currentPriceIds: [PRICES.builderMonthly],
      pendingUpdate: {
        subscription_items: [{ price: PRICES.businessBaseMonthly }],
      },
      prices: PRICES,
    }) === "payment"
);
assert(
  "proration invoice GST is detected from inherited default_tax_rates, not upgrade tax mutation",
  invoiceIncludesConfiguredTaxRate(
    {
      default_tax_rates: ["txr_gst"],
      lines: { data: [{ tax_rates: [] }] },
    },
    "txr_gst"
  ) &&
    !invoiceIncludesConfiguredTaxRate({ lines: { data: [{ tax_rates: [] }] } }, "txr_gst") &&
    !("tax_rates" in (upgradeParams.items[0] ?? {})) &&
    /pending_if_incomplete/.test(file("lib/billing/upgrade-policy.ts")) &&
    /items\[\]\.tax_rates/.test(file("lib/billing/upgrade-policy.ts"))
);
assert(
  "Customer create params stay stable when name/email change",
  JSON.stringify(stripeCustomerCreateParams(ORG_A, "test")) ===
    JSON.stringify(stripeCustomerCreateParams(ORG_A, "test")) &&
    customerCreateParamsAreStable(
      stripeCustomerCreateParams(ORG_A, "test") as unknown as Record<string, unknown>
    ) &&
    stripeCustomerProfileUpdateParams({
      companyName: "First Ltd",
      billingEmail: "first@example.com",
    }).name === "First Ltd" &&
    stripeCustomerProfileUpdateParams({
      companyName: "Second Ltd",
      billingEmail: "second@example.com",
    }).email === "second@example.com" &&
    /stripeCustomerCreateParams/.test(file("lib/billing/ensure-customer.ts")) &&
    /stripeCustomerProfileUpdateParams/.test(file("lib/billing/ensure-customer.ts")) &&
    !/customers\.create\(\s*\{[\s\S]*name:/.test(file("lib/billing/ensure-customer.ts"))
);

assert(
  "Builder→Business upgrade is Stripe-backed, not a DB flip",
  canUpgradeBuilderToBusiness(activeBuilder).ok &&
    /subscriptions\.update/.test(billingActionsSrc)
);
assert(
  "upgrade payment failure copy remains Builder with Manage billing",
  /payment needs attention/.test(billingPageSrc) &&
    /Manage billing/.test(billingPageSrc)
);
assert(
  "Customer unique constraints remain defence-in-depth",
  /unique \(org_id, billing_environment\)/.test(rls046) &&
    /unique \(stripe_customer_id, billing_environment\)/.test(rls046)
);
assert(
  "Portal recommendation disables plan/seat switching",
  /STRIPE_PORTAL_CONFIGURATION_ID/.test(file(".env.local.example")) &&
    /disables plan\/seat switching/.test(file(".env.local.example")) &&
    /plan\/seat switching until BILLING-4/.test(
      file("docs/architecture/QUOTR_BILLING_ARCHITECTURE.md")
    )
);
assert(
  "trial row is internal_trial Business 1-seat 14 days from DB env",
  /'internal_trial'/.test(migration048) &&
    /'business'/.test(migration048) &&
    /paid_seat_quantity[\s\S]*1/.test(migration048) &&
    /now\(\) \+ interval '14 days'/.test(migration048)
);
assert(
  "Business→Builder downgrade requires team reduced to one",
  canDowngradeBusinessToBuilder({
    ...emptyState(),
    subscription: stripeSub("business"),
  }).errorCode === "downgrade_team_state_required"
);

const pendingUpdateObject = {
  id: "sub_paid",
  object: "subscription",
  customer: CUSTOMER_A,
  status: "active",
  cancel_at_period_end: false,
  metadata: {
    org_id: ORG_A,
    billing_environment: "test",
    selected_plan: "business",
  },
  items: {
    data: [
      {
        id: "si_1",
        price: { id: PRICES.builderMonthly },
        quantity: 1,
        current_period_start: 1_700_000_800,
        current_period_end: 1_702_592_800,
      },
    ],
  },
  pending_update: {
    subscription_items: [{ price: PRICES.businessBaseMonthly }],
  },
};
const parsedPending = parseStripeSubscriptionLike(
  pendingUpdateObject as Record<string, unknown>
);
assert(
  "parser maps current items only and does not treat pending_update as items",
  parsedPending?.items.length === 1 &&
    parsedPending.items[0]?.priceId === PRICES.builderMonthly &&
    pendingUpdatePriceIdsFromSubscriptionObject(
      pendingUpdateObject as Record<string, unknown>
    )[0] === PRICES.businessBaseMonthly
);
const pendingMirror = mapStripeSubscriptionToMirror({
  orgId: ORG_A,
  billingEnvironment: "test",
  subscription: parsedPending!,
  prices: PRICES,
  existing: stripeSub("builder"),
  eventId: "evt_pending",
  eventCreatedUnix: 1_700_000_850,
});
assert(
  "pending_update does not grant Business in the mirror",
  pendingMirror.ok && pendingMirror.row.planCode === "builder"
);
const pendingEntitlement = evaluateOrgEntitlement({
  state: {
    ...activeBuilder,
    subscription: pendingMirror.ok ? pendingMirror.row : stripeSub("builder"),
  },
  capability: "team.invite",
  mode: "strict",
});
assert(
  "pending Business update does not leak Business capabilities",
  pendingEntitlement.ok === false
);

async function runWebhookConversion() {
  const store = createMemoryStore({
  customers: [
    {
      id: "map_a",
      orgId: ORG_A,
      billingEnvironment: "test",
      stripeCustomerId: CUSTOMER_A,
      billingName: "A",
      billingEmail: "a@example.com",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
  ],
  subscriptions: [trial],
});

const converted = await processBillingStripeEvent({
  event: {
    id: "evt_sub_created",
    type: "customer.subscription.created",
    livemode: false,
    created: 1_700_000_800,
    data: {
      object: {
        id: "sub_paid",
        object: "subscription",
        customer: CUSTOMER_A,
        status: "active",
        cancel_at_period_end: false,
        metadata: { org_id: ORG_A, billing_environment: "test" },
        items: {
          data: [
            {
              id: "si_1",
              price: { id: PRICES.builderMonthly },
              quantity: 1,
              current_period_start: 1_700_000_800,
              current_period_end: 1_702_592_800,
            },
          ],
        },
      },
    },
  } satisfies StripeEventLike,
  billingEnvironment: "test",
  prices: PRICES,
  store,
});
const after = await store.getSubscriptionByOrg(ORG_A, "test");
assert(
  "webhook converts the same org+env trial row to Stripe Builder",
  converted.result === "processed" &&
    after?.source === "stripe" &&
    after.planCode === "builder" &&
    after.status === "active" &&
    after.paidSeatQuantity === 1 &&
    after.stripeSubscriptionId === "sub_paid"
);

  const pendingPay = await processBillingStripeEvent({
    event: {
      id: "evt_sub_pending_upgrade",
      type: "customer.subscription.updated",
      livemode: false,
      created: 1_700_000_850,
      data: { object: pendingUpdateObject as Record<string, unknown> },
    } satisfies StripeEventLike,
    billingEnvironment: "test",
    prices: PRICES,
    store,
  });
  const afterPendingPay = await store.getSubscriptionByOrg(ORG_A, "test");
  assert(
    "failed prorated payment webhook keeps Builder",
    pendingPay.result === "processed" &&
      afterPendingPay?.planCode === "builder" &&
      afterPendingPay.source === "stripe"
  );

  const upgraded = await processBillingStripeEvent({
    event: {
      id: "evt_sub_upgraded",
      type: "customer.subscription.updated",
      livemode: false,
      created: 1_700_000_900,
      data: {
        object: {
          id: "sub_paid",
          object: "subscription",
          customer: CUSTOMER_A,
          status: "active",
          cancel_at_period_end: false,
          metadata: { org_id: ORG_A, billing_environment: "test" },
          items: {
            data: [
              {
                id: "si_1",
                price: { id: PRICES.businessBaseMonthly },
                quantity: 1,
                current_period_start: 1_700_000_800,
                current_period_end: 1_702_592_800,
              },
            ],
          },
        },
      },
    } satisfies StripeEventLike,
    billingEnvironment: "test",
    prices: PRICES,
    store,
  });
  const afterUpgrade = await store.getSubscriptionByOrg(ORG_A, "test");
  assert(
    "webhook, not the upgrade action, is Business plan authority",
    upgraded.result === "processed" &&
      afterUpgrade?.planCode === "business" &&
      afterUpgrade.source === "stripe" &&
      !/plan_code:\s*"business"/.test(billingActionsSrc)
  );
  assert(
    "later successful payment webhook applies Business",
    afterUpgrade?.planCode === "business"
  );
}

const checkoutOrgB = corroborateCheckoutSession({
  session: {
    id: "cs_x",
    mode: "subscription",
    customerId: CUSTOMER_A,
    clientReferenceId: ORG_B,
    paymentStatus: "paid",
    status: "complete",
    subscriptionId: "sub_x",
    metadata: { org_id: ORG_B, billing_environment: "test", selected_plan: "builder" },
    priceIds: [PRICES.builderMonthly],
  },
  billingEnvironment: "test",
  mappedOrgId: ORG_A,
  prices: PRICES,
});
assert(
  "cross-org Checkout corroboration fails",
  checkoutOrgB.result === "failed" &&
    checkoutOrgB.errorCode === "checkout_org_mismatch"
);

assert(
  "checkout.session.completed does not become subscription authority",
  /corroborateCheckoutSession/.test(webhookSrc) &&
    !/upsertSubscription/.test(
      webhookSrc.slice(
        webhookSrc.indexOf("checkout.session.completed"),
        webhookSrc.indexOf("checkout.session.completed") + 900
      )
    )
);

const expiredState: OrgBillingState = {
  ...emptyState(),
  subscription: {
    ...trial,
    trialEndsAt: "2026-08-01T00:00:00.000Z",
  },
  effectiveTrialState: "trial_expired",
};
const expiredDecision = evaluateOrgEntitlement({
  state: expiredState,
  capability: "projects.create",
  mode: "strict",
});
assert(
  "expired trial blocks create in strict mode",
  expiredDecision.ok === false && expiredDecision.reasonCode === "trial_expired"
);
const expiredRead = evaluateOrgEntitlement({
  state: expiredState,
  capability: "company_rates.basic",
  mode: "strict",
});
assert("expired trial still allows non-producing historical access", expiredRead.ok === true);
const expiredAccept = evaluateOrgEntitlement({
  state: expiredState,
  capability: "quotes.acceptance",
  mode: "strict",
});
assert("public/transaction acceptance is not blocked after expiry", expiredAccept.ok === true);

const missing = evaluateOrgEntitlement({
  state: emptyState(),
  capability: "projects.create",
  mode: "strict",
});
assert(
  "missing billing row is blocked in strict mode",
  missing.ok === false && missing.reasonCode === "billing_uninitialized"
);
const missingCompat = evaluateOrgEntitlement({
  state: emptyState(),
  capability: "projects.create",
  mode: "compatibility",
});
assert(
  "compatibility still allows uninitialized orgs until bootstrap+strict",
  missingCompat.ok === true
);

assert(
  "public acceptance is not gated by organisation billing",
  !/requireOrgEntitlement/.test(acceptanceSrc) &&
    !/entitlementDeniedError/.test(acceptanceSrc)
);
assert(
  "046 RLS still: members SELECT own billing; no writes",
  /Organisation members can select own subscription/.test(rls046) &&
    /revoke all on table public\.org_subscriptions from public, anon, authenticated/.test(
      rls046
    ) &&
    /grant select on table public\.org_subscriptions to authenticated/.test(rls046)
);
assert(
  "Billing nav and page exist",
  /\/app\/settings\/billing/.test(file("components/app-sidebar.tsx")) &&
    /label: "Billing"/.test(file("components/app-sidebar.tsx")) &&
    /Choose Builder/.test(billingPageSrc)
);
assert(
  "Portal is server-created and org-scoped",
  /billingPortal\.sessions\.create/.test(billingActionsSrc) &&
    /state\.customer\?\.stripeCustomerId/.test(billingActionsSrc)
);
assert(
  "seat Price is not included in BILLING-3 Checkout",
  !/businessSeatMonthly/.test(billingActionsSrc) &&
    resolvePlanFromStripePriceItems(
      [{ priceId: PRICES.businessBaseMonthly, quantity: 1 }],
      PRICES
    ).ok
);
assert(
  "enforcement mode remains compatibility unless explicitly strict",
  /BILLING_ENFORCEMENT_MODE=compatibility/.test(file(".env.local.example")) &&
    /after Preview bootstrap/.test(file(".env.local.example"))
);

void runWebhookConversion().then(() => {
  if (process.exitCode) {
    console.log("\nBILLING-3 verifier failed.");
    process.exit(1);
  }
  console.log("\nBILLING-3 verifier passed.");
});
