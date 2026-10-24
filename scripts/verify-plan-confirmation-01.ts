/**
 * Paid plan confirmation. No Stripe calls, no email, no database writes.
 * Run: npx tsx scripts/verify-plan-confirmation-01.ts
 */
import { readFileSync } from "node:fs";
import { deliverPaidPlanConfirmation } from "../lib/billing/plan-confirmation-send";
import {
  buildPlanConfirmationEmail,
  decidePlanConfirmationSend,
  isPlanConfirmationDeliveryEnabled,
  isWebsiteBillingUrl,
  planConfirmationFactsFromStripe,
  planConfirmationIdempotencyKey,
  PLAN_CONFIRMATION_ANDROID_HOST,
  PLAN_CONFIRMATION_PREVIEW_TEST_RECIPIENT,
  selectPaidPlanRecipient,
  shouldEnqueuePaidPlanConfirmation,
} from "../lib/billing/plan-confirmation";
import type { StripePriceConfig } from "../lib/billing/types";
import type { QuoteDeliveryProvider } from "../lib/quotes/delivery-types";

const prices: StripePriceConfig = {
  builderMonthly: "price_builder",
  businessBaseMonthly: "price_business",
  businessSeatMonthly: "price_seat",
};

let failed = 0;
function assert(name: string, condition: boolean): void {
  if (!condition) {
    failed += 1;
    console.error(`FAIL ${name}`);
    return;
  }
  console.log(`ok ${name}`);
}

const activeBuilder = {
  source: "stripe",
  status: "active",
  planCode: "builder",
  stripeSubscriptionId: "sub_new",
};

assert(
  "trial to paid stripe activates",
  shouldEnqueuePaidPlanConfirmation({
    previous: { source: "internal_trial", status: "trialing", stripeSubscriptionId: null },
    next: activeBuilder,
    activeOverride: false,
    eventType: "customer.subscription.created",
  })
);

assert(
  "first paid subscription activates",
  shouldEnqueuePaidPlanConfirmation({
    previous: null,
    next: activeBuilder,
    activeOverride: false,
    eventType: "customer.subscription.updated",
  })
);

for (const status of ["incomplete", "past_due", "unpaid", "trialing", "cancelled"]) {
  assert(
    `${status} payment does not confirm`,
    !shouldEnqueuePaidPlanConfirmation({
      previous: null,
      next: { ...activeBuilder, status },
      activeOverride: false,
      eventType: "customer.subscription.updated",
    })
  );
}

assert(
  "invoice paid does not confirm",
  !shouldEnqueuePaidPlanConfirmation({
    previous: null,
    next: activeBuilder,
    activeOverride: false,
    eventType: "invoice.paid",
  })
);

assert(
  "checkout completed does not confirm",
  !shouldEnqueuePaidPlanConfirmation({
    previous: null,
    next: activeBuilder,
    activeOverride: false,
    eventType: "checkout.session.completed",
  })
);

assert(
  "failed invoice does not confirm",
  !shouldEnqueuePaidPlanConfirmation({
    previous: { source: "stripe", status: "active", stripeSubscriptionId: "sub_new" },
    next: { ...activeBuilder, status: "past_due" },
    activeOverride: false,
    eventType: "invoice.payment_failed",
  })
);

assert(
  "renewal of the same active subscription does not confirm",
  !shouldEnqueuePaidPlanConfirmation({
    previous: { source: "stripe", status: "active", stripeSubscriptionId: "sub_new" },
    next: activeBuilder,
    activeOverride: false,
    eventType: "customer.subscription.updated",
  })
);

assert(
  "duplicate active event does not confirm",
  !shouldEnqueuePaidPlanConfirmation({
    previous: activeBuilder,
    next: activeBuilder,
    activeOverride: false,
    eventType: "customer.subscription.updated",
  })
);

assert(
  "incomplete then active confirms once",
  shouldEnqueuePaidPlanConfirmation({
    previous: { source: "stripe", status: "incomplete", stripeSubscriptionId: "sub_new" },
    next: activeBuilder,
    activeOverride: false,
    eventType: "customer.subscription.updated",
  }) &&
    !shouldEnqueuePaidPlanConfirmation({
      previous: activeBuilder,
      next: activeBuilder,
      activeOverride: false,
      eventType: "customer.subscription.updated",
    })
);

assert(
  "internal trial source does not confirm",
  !shouldEnqueuePaidPlanConfirmation({
    previous: null,
    next: { ...activeBuilder, source: "internal_trial" },
    activeOverride: false,
    eventType: "customer.subscription.updated",
  })
);

assert(
  "complimentary override does not confirm",
  !shouldEnqueuePaidPlanConfirmation({
    previous: null,
    next: activeBuilder,
    activeOverride: true,
    eventType: "customer.subscription.created",
  })
);

const owner = "owner@example.com";
assert(
  "recipient is the verified owner mailbox",
  selectPaidPlanRecipient({
    stripeCustomerEmail: " Owner@Example.com ",
    storedBillingEmail: "owner@example.com",
    confirmedOwnerEmails: [owner, "member@example.com"],
  }).ok === true &&
    (selectPaidPlanRecipient({
      stripeCustomerEmail: " Owner@Example.com ",
      storedBillingEmail: "owner@example.com",
      confirmedOwnerEmails: [owner, "member@example.com"],
    }) as { email: string }).email === owner
);

assert(
  "webhook metadata disagreement is refused",
  selectPaidPlanRecipient({
    stripeCustomerEmail: "other@example.com",
    storedBillingEmail: owner,
    confirmedOwnerEmails: [owner],
  }).ok === false
);

assert(
  "a non-owner member is not selected",
  selectPaidPlanRecipient({
    stripeCustomerEmail: "member@example.com",
    storedBillingEmail: "member@example.com",
    confirmedOwnerEmails: [owner],
  }).ok === false
);

const facts = planConfirmationFactsFromStripe({
  billingEnvironment: "test",
  expectedCustomerId: "cus_test",
  prices,
  subscription: {
    status: "active",
    livemode: false,
    customer: "cus_test",
    current_period_end: 1796083200,
    default_tax_rates: [{ percentage: 15, display_name: "GST", inclusive: false }],
    items: {
      data: [
        {
          quantity: 1,
          price: { id: "price_builder", unit_amount: 1000, currency: "nzd" },
        },
      ],
    },
    latest_invoice: {
      object: "invoice",
      subtotal: 200,
      tax: 30,
      total: 230,
      total_discount_amounts: [],
      lines: { data: [{ proration: true }] },
    },
  },
});
assert("stripe amounts are read", facts.ok === true);
if (facts.ok) {
  assert("recurring price is the stripe unit amount", facts.facts.recurringExclusiveCents === 1000);
  assert("gst is calculated from the stripe rate", facts.facts.recurringTaxCents === 150);
  assert("opening charge is distinguished", facts.facts.openingKind === "prorated" && facts.facts.openingTotalCents === 230);
  const email = buildPlanConfirmationEmail({
    companyName: "Preview Test Company",
    facts: facts.facts,
    billingUrl: "https://quotr.example/app/settings/billing",
    previewTest: true,
  });
  assert(
    "subject names the plan",
    email.subject === "Preview test: Your Quotr Builder plan is active"
  );
  assert("body uses stripe amounts", email.text.includes("NZ$10.00") && email.text.includes("NZ$1.50"));
  assert("body distinguishes today's charge", email.text.includes("Today's charge is NZ$2.30") && email.text.includes("not the ongoing price"));
  assert("body does not use a catalogue price", !email.text.includes("NZ$65.00") && !email.text.includes("65.00"));
  assert("wordmark is present", email.html.includes("alt=\"Quotr\""));
  assert("same account covers website and android", email.text.includes("Android app") && email.text.includes("same Quotr account"));
  assert("support mailbox is present", email.text.includes("hello@get-quotr.com"));
  assert("billing link is present", email.text.includes("https://quotr.example/app/settings/billing"));
  assert("email is not labelled a tax invoice", email.text.includes("It is not a tax invoice"));
  assert("no marketing consent language", !/unsubscribe|newsletter|marketing/i.test(email.text));
}

assert(
  "inactive stripe subscription is not readable as active",
  planConfirmationFactsFromStripe({
    billingEnvironment: "test",
    expectedCustomerId: "cus_test",
    prices,
    subscription: {
      status: "incomplete",
      livemode: false,
      customer: "cus_test",
      items: { data: [{ quantity: 1, price: { id: "price_builder", unit_amount: 1000, currency: "nzd" } }] },
    },
  }).ok === false
);

assert(
  "live mode is refused in the test environment",
  planConfirmationFactsFromStripe({
    billingEnvironment: "test",
    expectedCustomerId: "cus_test",
    prices,
    subscription: {
      status: "active",
      livemode: true,
      customer: "cus_test",
      items: { data: [{ quantity: 1, price: { id: "price_builder", unit_amount: 1000, currency: "nzd" } }] },
    },
  }).ok === false
);

assert(
  "android host is not a billing link",
  !isWebsiteBillingUrl(`https://${PLAN_CONFIRMATION_ANDROID_HOST}/app/settings/billing`) &&
    isWebsiteBillingUrl("https://quotr.example/app/settings/billing")
);

assert(
  "flags default off",
  !isPlanConfirmationDeliveryEnabled({}) &&
    isPlanConfirmationDeliveryEnabled({
      PLAN_CONFIRMATION_EMAIL_ENABLED: "true",
      VERCEL_ENV: "preview",
    }) &&
    !isPlanConfirmationDeliveryEnabled({
      PLAN_CONFIRMATION_EMAIL_ENABLED: "true",
      VERCEL_ENV: "production",
    })
);

const key = planConfirmationIdempotencyKey({
  environment: "preview",
  stripeSubscriptionId: "sub_new",
  source: "activation",
});
assert(
  "retry keeps the same idempotency key",
  decidePlanConfirmationSend({
    status: "failed",
    leaseUntil: null,
    now: "2026-10-25T00:00:00.000Z",
    idempotencyKey: key,
  }).idempotencyKey === key
);

async function main(): Promise<void> {
let sends = 0;
const provider: QuoteDeliveryProvider = {
  name: "resend",
  isConfigured: () => true,
  async send(payload) {
    sends += 1;
    assert("provider receives the stable key", payload.idempotencyKey === key);
    assert("provider receives only the authorised test recipient", payload.to === PLAN_CONFIRMATION_PREVIEW_TEST_RECIPIENT);
    return { ok: true, providerMessageId: "re_test_message" };
  },
};

const row = {
  id: "delivery-1",
  status: "pending" as const,
  source: "preview_test" as const,
  environment: "preview" as const,
  idempotencyKey: key,
  idempotencyStartedAt: null,
  recipientEmail: PLAN_CONFIRMATION_PREVIEW_TEST_RECIPIENT,
  companyName: "Preview Test Company",
  planCode: "builder" as const,
  includedUsers: 1,
  paidUsers: 1,
  currency: "nzd",
  recurringExclusiveCents: 1000,
  recurringTaxCents: 150,
  taxDisplayName: "GST",
  taxInclusive: false,
  openingExclusiveCents: 200,
  openingTaxCents: 30,
  openingTotalCents: 230,
  openingKind: "prorated" as const,
  nextBillingAt: "2026-11-30T11:00:00.000Z",
  billingUrl: "https://quotr.example/app/settings/billing",
  providerMessageId: null as string | null,
  leaseUntil: null as string | null,
};
let accepted = false;
const first = await deliverPaidPlanConfirmation({
  deliveryId: row.id,
  from: "Quotr <no-reply@get-quotr.com>",
  provider,
  allowRecipient: (email) => email === PLAN_CONFIRMATION_PREVIEW_TEST_RECIPIENT,
  store: {
    async claim() {
      if (accepted) {
        return { claimed: false, reason: "accepted", providerMessageId: "re_test_message", idempotencyKey: key };
      }
      return { claimed: true, row };
    },
    async acknowledge() {
      accepted = true;
      return true;
    },
    async fail() {
      throw new Error("fail was not expected");
    },
  },
});
const second = await deliverPaidPlanConfirmation({
  deliveryId: row.id,
  from: "Quotr <no-reply@get-quotr.com>",
  provider,
  allowRecipient: (email) => email === PLAN_CONFIRMATION_PREVIEW_TEST_RECIPIENT,
  store: {
    async claim() {
      return { claimed: false, reason: "accepted", providerMessageId: "re_test_message", idempotencyKey: key };
    },
    async acknowledge() {
      return true;
    },
    async fail() {
      throw new Error("fail was not expected");
    },
  },
});
assert("first delivery is accepted", first.outcome === "accepted" && sends === 1);
assert("duplicate delivery does not send again", second.outcome === "skipped_accepted" && sends === 1);

const refused = await deliverPaidPlanConfirmation({
  deliveryId: row.id,
  from: "Quotr <no-reply@get-quotr.com>",
  provider,
  allowRecipient: () => false,
  store: {
    async claim() {
      return { claimed: true, row: { ...row, recipientEmail: "someone-else@example.com" } };
    },
    async acknowledge() {
      return true;
    },
    async fail() {
      return undefined;
    },
  },
});
assert("another recipient is refused", refused.outcome === "refused" && sends === 1);

const migration = readFileSync("supabase/migrations/124_plan_confirmation_email.sql", "utf8");
assert(
  "migration does not backfill subscriptions",
  !/insert into public\.plan_confirmation_deliveries[\s\S]*select[\s\S]*org_subscriptions/i.test(migration) &&
    migration.includes("on conflict")
);
const webhook = readFileSync("lib/billing/webhook-http.ts", "utf8");
assert(
  "email is scheduled after the billing event returns",
  webhook.indexOf("processBillingStripeEvent") < webhook.indexOf("schedulePaidPlanConfirmation")
);

if (failed > 0) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("plan confirmation checks passed");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "plan confirmation checks failed");
  process.exit(1);
});
