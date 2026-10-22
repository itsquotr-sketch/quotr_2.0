/**
 * Account welcome eligibility, copy, duplicate protection, and
 * provider-accepted / acknowledgement-failed recovery.
 * Run: npx tsx scripts/verify-account-welcome-01.ts
 *
 * Does not send email and does not touch Production.
 */
import { readFileSync } from "node:fs";
import {
  ACCOUNT_WELCOME_CONTINUE_URL,
  ACCOUNT_WELCOME_FIRST_JOB_URL,
  ACCOUNT_WELCOME_GETTING_STARTED_URL,
  ACCOUNT_WELCOME_IDEMPOTENCY_WINDOW_MS,
  ACCOUNT_WELCOME_REPLY_TO,
  ACCOUNT_WELCOME_SUBJECT,
  ACCOUNT_WELCOME_TEMPLATE_VERSION,
  ACCOUNT_WELCOME_WORDMARK_HEIGHT,
  ACCOUNT_WELCOME_WORDMARK_URL,
  ACCOUNT_WELCOME_WORDMARK_WIDTH,
  accountWelcomeGreetingLine,
  accountWelcomeIdempotencyKey,
  buildAccountWelcomeEmail,
  decideAccountWelcomeSend,
  isAccountWelcomeDeliveryEnabled,
  isAccountWelcomeEligible,
  type AccountWelcomeStatus,
} from "../lib/auth/account-welcome";
import {
  deliverAccountWelcomeEmail,
  type AccountWelcomeClaimedRow,
  type AccountWelcomeDeliveryStore,
} from "../lib/auth/account-welcome-send";
import { HELP_SUPPORT_EMAIL } from "../lib/help/content";
import type { QuoteDeliveryEmailPayload, QuoteDeliveryProvider } from "../lib/quotes/delivery-types";
import { setupModeRedirect } from "../lib/setup/first-run-stage";

function assert(label: string, ok: boolean) {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) process.exitCode = 1;
}

function read(rel: string): string {
  return readFileSync(rel, "utf8");
}

const userId = "68086eeb-81e8-418b-90cd-562d13b0ca07";
const signupKey = accountWelcomeIdempotencyKey({
  environment: "preview",
  userId,
  source: "signup",
});
const testKey = accountWelcomeIdempotencyKey({
  environment: "preview",
  userId,
  source: "preview_test",
});
const productionKey = accountWelcomeIdempotencyKey({
  environment: "production",
  userId,
  source: "signup",
});

assert(
  "signup and preview test keys differ, and production is separate",
  signupKey === `${ACCOUNT_WELCOME_TEMPLATE_VERSION}:preview:${userId}` &&
    testKey === `${ACCOUNT_WELCOME_TEMPLATE_VERSION}:preview:test:${userId}` &&
    productionKey === `${ACCOUNT_WELCOME_TEMPLATE_VERSION}:production:${userId}` &&
    new Set([signupKey, testKey, productionKey]).size === 3
);

assert(
  "only a newly provisioned confirmed self-signup is eligible",
  isAccountWelcomeEligible({
    trigger: "signup_confirmation",
    emailConfirmed: true,
    newlyProvisioned: true,
    destination: "/app/setup?mode=basics",
  }) &&
    !isAccountWelcomeEligible({
      trigger: "signup_submission",
      emailConfirmed: false,
      newlyProvisioned: false,
      destination: "/signup",
    }) &&
    !isAccountWelcomeEligible({
      trigger: "confirmation_resend",
      emailConfirmed: false,
      newlyProvisioned: false,
      destination: "/signup",
    }) &&
    !isAccountWelcomeEligible({
      trigger: "login",
      emailConfirmed: true,
      newlyProvisioned: false,
      destination: "/app/dashboard",
    }) &&
    !isAccountWelcomeEligible({
      trigger: "password_recovery",
      emailConfirmed: true,
      newlyProvisioned: false,
      destination: "/reset-password",
    }) &&
    !isAccountWelcomeEligible({
      trigger: "page_refresh",
      emailConfirmed: true,
      newlyProvisioned: false,
      destination: "/app/setup",
    }) &&
    !isAccountWelcomeEligible({
      trigger: "invitation_acceptance",
      emailConfirmed: true,
      newlyProvisioned: true,
      destination: "/invite/continue",
    }) &&
    !isAccountWelcomeEligible({
      trigger: "account_repair",
      emailConfirmed: true,
      newlyProvisioned: true,
      destination: "/app/setup?mode=basics",
    }) &&
    !isAccountWelcomeEligible({
      trigger: "signup_confirmation",
      emailConfirmed: true,
      newlyProvisioned: false,
      destination: "/app/setup?mode=basics",
    }) &&
    !isAccountWelcomeEligible({
      trigger: "signup_confirmation",
      emailConfirmed: false,
      newlyProvisioned: true,
      destination: "/app/setup?mode=basics",
    }) &&
    !isAccountWelcomeEligible({
      trigger: "signup_confirmation",
      emailConfirmed: true,
      newlyProvisioned: true,
      destination: "/reset-password",
    }) &&
    !isAccountWelcomeEligible({
      trigger: "signup_confirmation",
      emailConfirmed: true,
      newlyProvisioned: true,
      destination: "/signup?confirm=required",
    })
);

assert(
  "automatic delivery is off unless Preview is explicitly enabled, and Production needs a second flag",
  isAccountWelcomeDeliveryEnabled({}) === false &&
    isAccountWelcomeDeliveryEnabled({
      ACCOUNT_WELCOME_EMAIL_ENABLED: "true",
      VERCEL_ENV: "preview",
    }) === true &&
    isAccountWelcomeDeliveryEnabled({
      ACCOUNT_WELCOME_EMAIL_ENABLED: "yes",
      VERCEL_ENV: "preview",
    }) === false &&
    isAccountWelcomeDeliveryEnabled({
      ACCOUNT_WELCOME_EMAIL_ENABLED: "true",
      VERCEL_ENV: "production",
    }) === false &&
    isAccountWelcomeDeliveryEnabled({
      ACCOUNT_WELCOME_EMAIL_ENABLED: "true",
      ACCOUNT_WELCOME_EMAIL_PRODUCTION: "true",
      VERCEL_ENV: "production",
    }) === true &&
    isAccountWelcomeDeliveryEnabled({
      ACCOUNT_WELCOME_EMAIL_ENABLED: "true",
    }) === false
);

assert(
  "missing or unsafe names use Hi there",
  accountWelcomeGreetingLine(null) === "Hi there," &&
    accountWelcomeGreetingLine("  ") === "Hi there," &&
    accountWelcomeGreetingLine("person@example.com") === "Hi there," &&
    accountWelcomeGreetingLine("Preview Stripe") === "Hi Preview," &&
    accountWelcomeGreetingLine("Jean-Luc Picard") === "Hi Jean-Luc,"
);

const customer = buildAccountWelcomeEmail({ fullName: "Preview Stripe" });
const testMail = buildAccountWelcomeEmail({
  fullName: null,
  previewTest: true,
});
assert(
  "customer copy is the service welcome, with the live setup and help links",
  customer.subject === ACCOUNT_WELCOME_SUBJECT &&
    customer.text.startsWith("Hi Preview,") &&
    customer.text.includes("Your email is confirmed and your Quotr account is ready.") &&
    customer.text.includes("Finish your company setup, then start your first job.") &&
    customer.text.includes(ACCOUNT_WELCOME_CONTINUE_URL) &&
    customer.text.includes(ACCOUNT_WELCOME_GETTING_STARTED_URL) &&
    customer.text.includes(ACCOUNT_WELCOME_FIRST_JOB_URL) &&
    customer.text.includes(`contact ${ACCOUNT_WELCOME_REPLY_TO}.`) &&
    customer.text.trimEnd().endsWith("The Quotr team") &&
    customer.html.includes(">Continue to Quotr<") &&
    customer.html.includes("width=device-width") &&
    customer.html.includes("max-width:560px") &&
    customer.html.includes(`alt="Quotr"`) &&
    customer.html.includes(`src="${ACCOUNT_WELCOME_WORDMARK_URL}"`) &&
    customer.html.includes(`width="${ACCOUNT_WELCOME_WORDMARK_WIDTH}"`) &&
    customer.html.includes(`height="${ACCOUNT_WELCOME_WORDMARK_HEIGHT}"`) &&
    ACCOUNT_WELCOME_WORDMARK_WIDTH >= 110 &&
    ACCOUNT_WELCOME_WORDMARK_WIDTH <= 130 &&
    ACCOUNT_WELCOME_WORDMARK_HEIGHT === 30 &&
    customer.html.includes("line-height:20px;padding:12px 20px") &&
    customer.html.includes("font-size:16px;line-height:24px") &&
    !customer.html.includes("text-transform:uppercase") &&
    !/upgrade|discount|unsubscribe|loops/i.test(customer.text) &&
    !customer.text.includes("Preview test") &&
    !customer.html.includes("Preview test")
);
const productionMarked = buildAccountWelcomeEmail({
  fullName: "Alex Builder",
  previewTest: true,
  environment: "production",
});
assert(
  "a production welcome never carries the preview identification line",
  !productionMarked.text.includes("Preview test") &&
    !productionMarked.html.includes("Preview test") &&
    productionMarked.html.includes(`alt="Quotr"`)
);
assert(
  "reply-to is the established support mailbox",
  ACCOUNT_WELCOME_REPLY_TO === HELP_SUPPORT_EMAIL &&
    ACCOUNT_WELCOME_REPLY_TO === "hello@get-quotr.com"
);
assert(
  "the preview test is identified and still uses the same subject and links",
  testMail.subject === ACCOUNT_WELCOME_SUBJECT &&
    testMail.text.includes("Preview test of the account welcome email.") &&
    testMail.text.includes("Hi there,") &&
    testMail.html.includes(ACCOUNT_WELCOME_CONTINUE_URL)
);

assert(
  "completed setup opened at /app/setup continues into the app, and unfinished setup resumes",
  setupModeRedirect(undefined, "done") === "/app/dashboard" &&
    setupModeRedirect(undefined, "address") === "/app/setup?mode=address" &&
    ACCOUNT_WELCOME_CONTINUE_URL.endsWith("/app/setup") &&
    !ACCOUNT_WELCOME_CONTINUE_URL.includes("?")
);

assert(
  "an accepted row is not sent again, and an expired send keeps the same key",
  decideAccountWelcomeSend({
    status: "accepted",
    leaseUntil: null,
    now: "2026-10-22T00:00:00.000Z",
    idempotencyKey: signupKey,
  }).action === "skip_accepted" &&
    decideAccountWelcomeSend({
      status: "sending",
      leaseUntil: "2026-10-22T00:02:00.000Z",
      now: "2026-10-22T00:01:00.000Z",
      idempotencyKey: signupKey,
    }).action === "skip_in_flight" &&
    decideAccountWelcomeSend({
      status: "sending",
      leaseUntil: "2026-10-22T00:00:30.000Z",
      now: "2026-10-22T00:01:00.000Z",
      idempotencyKey: signupKey,
    }).idempotencyKey === signupKey &&
    decideAccountWelcomeSend({
      status: "failed",
      leaseUntil: null,
      now: "2026-10-22T00:01:00.000Z",
      idempotencyKey: signupKey,
    }).idempotencyKey === signupKey &&
    decideAccountWelcomeSend({
      status: "failed",
      leaseUntil: null,
      now: "2026-10-23T01:00:00.000Z",
      idempotencyKey: signupKey,
      idempotencyStartedAt: "2026-10-22T01:00:00.000Z",
    }).action === "reconcile" &&
    decideAccountWelcomeSend({
      status: "failed",
      leaseUntil: null,
      now: new Date(
        Date.parse("2026-10-22T01:00:00.000Z") +
          ACCOUNT_WELCOME_IDEMPOTENCY_WINDOW_MS -
          1000
      ).toISOString(),
      idempotencyKey: signupKey,
      idempotencyStartedAt: "2026-10-22T01:00:00.000Z",
    }).action === "send"
);

type MemoryRow = {
  status: AccountWelcomeStatus;
  idempotencyKey: string;
  providerMessageId: string | null;
  leaseUntil: string | null;
  fullName: string | null;
  recipientEmail: string;
  source: "signup" | "preview_test";
  environment: "preview" | "production";
  idempotencyStartedAt: string | null;
  reconcile: boolean;
  failCount: number;
};

function memoryStore(row: MemoryRow, ackFails: { remaining: number }): AccountWelcomeDeliveryStore {
  return {
    async claim(_id, now) {
      const decision = decideAccountWelcomeSend({
        status: row.status,
        leaseUntil: row.leaseUntil,
        now: now.toISOString(),
        idempotencyKey: row.idempotencyKey,
        idempotencyStartedAt: row.idempotencyStartedAt,
        providerMessageId: row.providerMessageId,
      });
      if (decision.action === "reconcile") {
        row.reconcile = true;
        row.status = "failed";
        row.leaseUntil = null;
        return {
          claimed: false,
          reason: "reconcile",
          providerMessageId: null,
          idempotencyKey: row.idempotencyKey,
        };
      }
      if (decision.action === "skip_accepted") {
        return {
          claimed: false,
          reason: "accepted",
          providerMessageId: row.providerMessageId,
          idempotencyKey: row.idempotencyKey,
        };
      }
      if (decision.action === "skip_in_flight") {
        return {
          claimed: false,
          reason: "in_flight",
          providerMessageId: null,
          idempotencyKey: row.idempotencyKey,
        };
      }
      row.status = "sending";
      row.leaseUntil = new Date(now.getTime() + 90_000).toISOString();
      if (!row.idempotencyStartedAt) row.idempotencyStartedAt = now.toISOString();
      return {
        claimed: true,
        row: {
          id: "delivery-1",
          status: row.status,
          idempotencyKey: row.idempotencyKey,
          recipientEmail: row.recipientEmail,
          fullName: row.fullName,
          providerMessageId: row.providerMessageId,
          leaseUntil: row.leaseUntil,
          source: row.source,
          environment: row.environment,
          idempotencyStartedAt: row.idempotencyStartedAt,
        } satisfies AccountWelcomeClaimedRow,
      };
    },
    async acknowledge(_id, providerMessageId) {
      if (ackFails.remaining > 0) {
        ackFails.remaining -= 1;
        return false;
      }
      row.status = "accepted";
      row.providerMessageId = providerMessageId;
      row.leaseUntil = null;
      return true;
    },
    async fail() {
      row.status = "failed";
      row.leaseUntil = null;
      row.failCount += 1;
    },
  };
}

function replayProvider(): QuoteDeliveryProvider & { sent: QuoteDeliveryEmailPayload[] } {
  const sent: QuoteDeliveryEmailPayload[] = [];
  const accepted = new Map<string, string>();
  return {
    name: "resend",
    sent,
    isConfigured: () => true,
    async send(payload) {
      const existing = accepted.get(payload.idempotencyKey);
      if (existing) return { ok: true, providerMessageId: existing };
      const id = `email_${accepted.size + 1}`;
      accepted.set(payload.idempotencyKey, id);
      sent.push(payload);
      return { ok: true, providerMessageId: id };
    },
  };
}

async function main() {
const row: MemoryRow = {
  status: "pending",
  idempotencyKey: testKey,
  providerMessageId: null,
  leaseUntil: null,
  fullName: "Preview Stripe",
  recipientEmail: "hello+test@erccontracting.co.nz",
  source: "preview_test",
  environment: "preview",
  idempotencyStartedAt: null,
  reconcile: false,
  failCount: 0,
};
const ackFails = { remaining: 3 };
const store = memoryStore(row, ackFails);
const resend = replayProvider();
const acceptedUnacked = await deliverAccountWelcomeEmail({
  deliveryId: "delivery-1",
  store,
  provider: resend,
  from: "Quotr <no-reply@get-quotr.com>",
  now: new Date("2026-10-22T01:00:00.000Z"),
});
row.leaseUntil = "2026-10-22T01:00:00.000Z";
const recoveredSend = await deliverAccountWelcomeEmail({
  deliveryId: "delivery-1",
  store,
  provider: resend,
  from: "Quotr <no-reply@get-quotr.com>",
  now: new Date("2026-10-22T01:02:00.000Z"),
});
assert(
  "provider acceptance followed by a failed acknowledgement retries the same key and does not send a second email",
  acceptedUnacked.outcome === "accepted_unacked" &&
    acceptedUnacked.providerMessageId === "email_1" &&
    acceptedUnacked.idempotencyKey === testKey &&
    row.idempotencyKey === testKey &&
    recoveredSend.outcome === "accepted" &&
    recoveredSend.providerMessageId === "email_1" &&
    resend.sent.length === 1 &&
    resend.sent[0]?.replyTo === "hello@get-quotr.com" &&
    resend.sent[0]?.subject === ACCOUNT_WELCOME_SUBJECT &&
    resend.sent[0]?.text.includes("Preview test of the account welcome email.")
);

const failedRow: MemoryRow = {
  status: "pending",
  idempotencyKey: signupKey,
  providerMessageId: null,
  leaseUntil: null,
  fullName: "Alex Builder",
  recipientEmail: "alex@example.com",
  source: "signup",
  environment: "production",
  idempotencyStartedAt: null,
  reconcile: false,
  failCount: 0,
};
let calls = 0;
const flaky: QuoteDeliveryProvider = {
  name: "resend",
  isConfigured: () => true,
  async send(payload) {
    calls += 1;
    if (payload.idempotencyKey !== signupKey) {
      return {
        ok: false,
        retryable: false,
        code: "provider_rejected",
        messageSafe: "The email could not be sent.",
      };
    }
    if (calls === 1) {
      return {
        ok: false,
        retryable: true,
        code: "provider_timeout",
        messageSafe: "The email service timed out. Try again shortly.",
      };
    }
    return { ok: true, providerMessageId: "email_retry" };
  },
};
const failedStore = memoryStore(failedRow, { remaining: 0 });
const failed = await deliverAccountWelcomeEmail({
  deliveryId: "delivery-2",
  store: failedStore,
  provider: flaky,
  from: "Quotr <no-reply@get-quotr.com>",
  now: new Date("2026-10-22T02:00:00.000Z"),
});
const statusAfterFailure = failedRow.status;
const retried = await deliverAccountWelcomeEmail({
  deliveryId: "delivery-2",
  store: failedStore,
  provider: flaky,
  from: "Quotr <no-reply@get-quotr.com>",
  now: new Date("2026-10-22T02:05:00.000Z"),
});
assert(
  "a provider failure keeps the idempotency key and a later attempt can still accept",
  failed.outcome === "failed" &&
    failed.idempotencyKey === signupKey &&
    statusAfterFailure === "failed" &&
    failedRow.idempotencyKey === signupKey &&
    retried.outcome === "accepted" &&
    retried.idempotencyKey === signupKey &&
    retried.providerMessageId === "email_retry"
);

const duplicate = await deliverAccountWelcomeEmail({
  deliveryId: "delivery-2",
  store: failedStore,
  provider: flaky,
  from: "Quotr <no-reply@get-quotr.com>",
  now: new Date("2026-10-22T02:06:00.000Z"),
});
assert(
  "an accepted welcome is not sent on a later attempt",
  duplicate.outcome === "skipped_accepted" &&
    duplicate.providerMessageId === "email_retry" &&
    calls === 2
);

const refused = await deliverAccountWelcomeEmail({
  deliveryId: "delivery-3",
  store: memoryStore(
    {
      status: "pending",
      idempotencyKey: testKey,
      providerMessageId: null,
      leaseUntil: null,
      fullName: "Other",
      recipientEmail: "other@example.com",
      source: "preview_test",
      environment: "preview",
      idempotencyStartedAt: null,
      reconcile: false,
      failCount: 0,
    },
    { remaining: 0 }
  ),
  provider: replayProvider(),
  from: "Quotr <no-reply@get-quotr.com>",
  allowRecipient: (email) => email === "hello+test@erccontracting.co.nz",
});
assert(
  "the preview test path refuses any other recipient",
  refused.outcome === "refused"
);

const migration = read("supabase/migrations/113_account_welcome_email.sql");
const activation = read("supabase/migrations/114_account_welcome_activation.sql");
const confirmation = read("lib/auth/finish-email-confirmation.ts");
const login = read("app/(auth)/actions.ts");
const recovery = read("lib/auth/recovery-actions.ts");
const route = read("app/api/internal/account-welcome-preview-test/route.ts");
const providerSource = read("lib/quotes/delivery-provider.ts");
const resendSource = read("lib/email/resend-send.ts");
const consent = read("lib/communications/marketing-consent-source.ts");

assert(
  "durable duplicate protection is per user, version, and environment",
  migration.includes("account_welcome_deliveries_identity_uidx") &&
    migration.includes("user_id, template_version, environment, source") &&
    migration.includes("account_welcome_deliveries_idempotency_uidx") &&
    migration.includes("account-welcome-v1:' || p_environment || ':' || p_user_id") &&
    activation.includes("account-welcome-v1:' || p_environment || ':' || p_user_id") &&
    activation.includes("WELCOME:BEFORE_ACTIVATION") &&
    activation.includes("WELCOME:INVITE") &&
    activation.includes("interval '24 hours'") &&
    activation.includes("for update") &&
    !activation.includes("interval '2 hours'") &&
    !activation.includes("WELCOME:NOT_NEW") &&
    migration.includes("revoke all on table public.account_welcome_deliveries from public, anon, authenticated") &&
    migration.includes("grant execute on function public.enqueue_account_welcome_signup_v1(uuid, uuid, text) to service_role") &&
    !migration.includes("grant execute on function public.enqueue_account_welcome_signup_v1(uuid, uuid, text) to authenticated") &&
    !migration.includes("marketing_consent") &&
    !migration.includes("loops")
);
assert(
  "confirmation schedules only after a new self-signup provision, and other auth paths do not",
  confirmation.includes('trigger: "signup_confirmation"') &&
    confirmation.includes("result.alreadyProvisioned === false") &&
    confirmation.includes("scheduleAccountWelcomeEmail") &&
    !login.includes("scheduleAccountWelcomeEmail") &&
    !recovery.includes("scheduleAccountWelcomeEmail") &&
    !read("lib/team/actions.ts").includes("scheduleAccountWelcomeEmail")
);
assert(
  "the preview test route is not a public sender",
  route.includes('process.env.VERCEL_ENV !== "preview"') &&
    route.includes("timingSafeEqual") &&
    route.includes("PREVIEW_SUPABASE_PROJECT_REF") &&
    route.includes("sendPreviewAccountWelcomeTest") &&
    !route.includes("request.json") &&
    !route.includes("searchParams")
);
assert(
  "welcome mail uses the existing Resend provider and idempotency header",
  providerSource.includes('process.env["RESEND_API_KEY"]') &&
    providerSource.includes("sendResendEmail") &&
    resendSource.includes('"Idempotency-Key": payload.idempotencyKey') &&
    resendSource.includes("https://api.resend.com/emails") &&
    read("lib/auth/account-welcome-delivery.ts").includes("getQuoteDeliveryProvider") &&
    read("lib/auth/account-welcome.ts").includes("teamInviteFromHeader") &&
    read("scripts/retry-preview-account-welcome.ts").includes("shhpjsoldmqtkdbgrbtm") &&
    read("scripts/retry-production-account-welcome.ts").includes("lxvnylhsbvudzzupxeqr") &&
    read("docs/architecture/QUOTR_APPLICATION_EMAIL.md").includes(
      "npx tsx scripts/retry-preview-account-welcome.ts --yes"
    ) &&
    read("docs/architecture/QUOTR_APPLICATION_EMAIL.md").includes(
      "npx tsx scripts/retry-production-account-welcome.ts --yes"
    )
);
const expiredRow: MemoryRow = {
  status: "failed",
  idempotencyKey: signupKey,
  providerMessageId: null,
  leaseUntil: null,
  fullName: "Alex Builder",
  recipientEmail: "alex@example.com",
  source: "signup",
  environment: "production",
  idempotencyStartedAt: "2026-10-22T01:00:00.000Z",
  reconcile: false,
  failCount: 0,
};
let expiredCalls = 0;
const expired = await deliverAccountWelcomeEmail({
  deliveryId: "delivery-4",
  store: memoryStore(expiredRow, { remaining: 0 }),
  provider: {
    name: "resend",
    isConfigured: () => true,
    async send() {
      expiredCalls += 1;
      return { ok: true, providerMessageId: "email_late" };
    },
  },
  from: "Quotr <no-reply@get-quotr.com>",
  now: new Date("2026-10-23T01:00:00.000Z"),
});
assert(
  "an uncertain welcome past the 24-hour window is not sent again",
  expired.outcome === "reconcile" &&
    expired.idempotencyKey === signupKey &&
    expiredRow.reconcile === true &&
    expiredRow.idempotencyKey === signupKey &&
    expiredCalls === 0
);

assert(
  "marketing consent is untouched",
  consent.includes('value === "signup"') &&
    !read("lib/auth/account-welcome-delivery.ts").includes("marketing_consent") &&
    !read("lib/auth/account-welcome-delivery.ts").includes("loops")
);

if (process.exitCode) {
  console.log("\nACCOUNT WELCOME CHECKS FAILED");
} else {
  console.log("\nACCOUNT WELCOME CHECKS PASSED");
}
}

main();
