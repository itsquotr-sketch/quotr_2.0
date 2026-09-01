/**
 * COMMERCIAL-NOTIFY-FIX-01: acceptance outbox flush after client accept.
 * No live email. No paid AI. No re-accept of hosted fixtures.
 *
 * Run: npx tsx scripts/verify-commercial-notify-fix-01.ts
 */
import { readFileSync } from "node:fs";
import { createMockQuoteDeliveryProvider } from "../lib/quotes/delivery-provider-mock";
import { quotePublicPath } from "../lib/quotes/delivery-token";
import {
  sendPendingQuoteResponseNotificationDeliveries,
  resolveQuoteResponseNotificationActionUrl,
  type NotificationFlushDeliveryRow,
  type NotificationFlushStore,
} from "../lib/quotes/notification-flush-core";
import { quoteNotificationIdempotencyKey } from "../lib/quotes/notifications";

function assert(label: string, ok: boolean) {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) process.exitCode = 1;
}

function file(path: string): string {
  return readFileSync(path, "utf8");
}

const QUOTE_ID = "7fb61174-30f1-4ff4-a012-1884c5a25214";
const ORG_ID = "a59f0f43-e3d1-4f23-a391-b8317ed9b521";
const ACCEPTANCE_ID = "1a18adac-a3e2-4fca-be9a-557490027ee1";
const BUILDER_USER_ID = "11111111-1111-4111-8111-111111111111";
const TOKEN = "qt_abcdefghijklmnopqrstuvwxyzABCDEFGHIJK12";
const ORIGIN = "https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app";

const acceptActionsSrc = file("lib/quotes/acceptance-actions.ts");
const quoteActionsSrc = file("lib/quotes/actions.ts");
const flushSrc = file("lib/quotes/notification-flush.ts");
const coreSrc = file("lib/quotes/notification-flush-core.ts");
const closeSrc = file("supabase/migrations/045_commercial_close.sql");
const webhookSrc = file("app/api/webhooks/resend/route.ts");
const adminSrc = file("lib/supabase/admin.ts");
const providerSrc = file("lib/quotes/delivery-provider.ts");
const retryRouteSrc = file(
  "app/api/quotes/[quoteId]/notification-flush/route.ts"
);

type MemoryDelivery = NotificationFlushDeliveryRow & {
  provider_message_id: string | null;
  last_error_safe: string | null;
  submitted_at: string | null;
  failed_at: string | null;
};

function createMemoryStore(input: {
  notifications: Array<{ id: string; payload: unknown }>;
  deliveries: MemoryDelivery[];
}): NotificationFlushStore & { deliveries: MemoryDelivery[] } {
  const store = {
    deliveries: input.deliveries,
    async listNotificationsForQuote() {
      return { ok: true as const, rows: input.notifications };
    },
    async listPendingEmailDeliveries() {
      return store.deliveries.filter(
        (row) => row.status === "pending" || row.status === "failed"
      );
    },
    async getIssuerSnapshot() {
      return {
        organisationName: "Quotr Limited",
        tradingName: null,
        legalName: null,
        contactEmail: null,
        contactPhone: null,
        website: null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        region: null,
        postcode: null,
        addressCountry: "NZ",
        nzbn: null,
        gstNumber: null,
        logoUrl: null,
        brandPrimaryColour: null,
        brandAccentColour: null,
        defaultPaymentTerms: null,
      };
    },
    async updateDelivery(update: {
      id: string;
      orgId: string;
      patch: Record<string, unknown>;
    }) {
      const row = store.deliveries.find((item) => item.id === update.id);
      if (!row) return;
      Object.assign(row, update.patch);
    },
  };
  return store;
}

function seedDeliveries(): MemoryDelivery[] {
  return [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      org_id: ORG_ID,
      notification_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      email_kind: "quote_accepted_builder",
      recipient_email: "builder@example.test",
      status: "pending",
      idempotency_key: quoteNotificationIdempotencyKey({
        kind: "quote_accepted_builder",
        evidenceId: ACCEPTANCE_ID,
        recipient: BUILDER_USER_ID,
      }),
      action_url: `/app/projects/proj/quotes/${QUOTE_ID}`,
      attempt_count: 0,
      provider_message_id: null,
      last_error_safe: null,
      submitted_at: null,
      failed_at: null,
    },
    {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      org_id: ORG_ID,
      notification_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      email_kind: "quote_accepted_client",
      recipient_email: "client@example.test",
      status: "pending",
      idempotency_key: quoteNotificationIdempotencyKey({
        kind: "quote_accepted_client",
        evidenceId: ACCEPTANCE_ID,
        recipient: "client@example.test",
      }),
      action_url: null,
      attempt_count: 0,
      provider_message_id: null,
      last_error_safe: null,
      submitted_at: null,
      failed_at: null,
    },
  ];
}

const notifications = [
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    payload: {
      projectTitle: "New Deck Test",
      quoteNumber: "Q-0001",
      revisionNumber: 1,
      signerName: "Jean-Luc Ellis",
      totalInclGst: 6846.71,
      acceptedAt: "2026-09-01T03:00:00.000Z",
    },
  },
];

console.log("--- Source / authority ---");
assert(
  "client accept enqueues deliveries in AFTER INSERT trigger",
  closeSrc.includes("quote_enqueue_client_acceptance_notifications") &&
    closeSrc.includes("quote_accepted_builder") &&
    closeSrc.includes("quote_accepted_client") &&
    closeSrc.includes("if new.source is distinct from 'client'")
);
assert(
  "post-commit flush is awaited after RPC and uses trusted issuerOrgId",
  acceptActionsSrc.includes("ACCEPT_QUOTE_BY_ACCESS_TOKEN_RPC") &&
    acceptActionsSrc.includes("await flushPendingQuoteResponseNotifications") &&
    acceptActionsSrc.indexOf("ACCEPT_QUOTE_BY_ACCESS_TOKEN_RPC") <
      acceptActionsSrc.indexOf("await flushPendingQuoteResponseNotifications") &&
    acceptActionsSrc.includes("document.issuerOrgId") &&
    acceptActionsSrc.includes("document.quote.id") &&
    acceptActionsSrc.includes("quotePublicPath(input.token)") &&
    acceptActionsSrc.includes("const orgId = document.issuerOrgId")
);
assert(
  "public client path does not require builder auth",
  !acceptActionsSrc.includes("requireAuthOrgContext") &&
    !acceptActionsSrc.includes("auth_org_id") &&
    !coreSrc.includes("requireAuthOrgContext") &&
    !coreSrc.includes("auth_org_id") &&
    acceptActionsSrc.includes("createPublicSupabase")
);
assert(
  "manual acceptance does not email client",
  quoteActionsSrc.includes("ACCEPT_QUOTE_REVISION_RPC") &&
    !quoteActionsSrc.includes("flushPendingQuoteResponseNotifications") &&
    closeSrc.includes("if new.source is distinct from 'client'") &&
    closeSrc.includes("quote_accepted_client")
);
assert(
  "acceptance remains committed when Resend fails",
  acceptActionsSrc.includes("await flushPendingQuoteResponseNotifications") &&
    flushSrc.includes("Accept/decline remains canonical") &&
    !acceptActionsSrc.includes("api.resend.com") &&
    !flushSrc.includes("begin") &&
    coreSrc.includes("status: \"failed\"")
);
assert(
  "flush uses the Quote send Resend provider and runtime env",
  flushSrc.includes("getQuoteDeliveryProvider") &&
    providerSrc.includes('process.env["RESEND_API_KEY"]') &&
    adminSrc.includes('readServerEnv("SUPABASE_SERVICE_ROLE_KEY")') &&
    flushSrc.includes("await connection()")
);
assert(
  "raw token is not written to notification_deliveries",
  !coreSrc.includes("action_url: actionUrl") &&
    !coreSrc.includes("patch: { action_url") &&
    !flushSrc.includes("action_url: actionUrl") &&
    closeSrc.includes("quote_accepted_client") &&
    closeSrc.includes("null")
);
assert(
  "webhook matches notification_deliveries by provider_message_id independently",
  webhookSrc.includes("notification_deliveries") &&
    webhookSrc.includes("quote_deliveries") &&
    webhookSrc.includes("provider_message_id") &&
    webhookSrc.includes("eq(\"provider\", \"resend\")")
);
assert(
  "pending/failed retry is builder-auth and quote-owned, not public re-accept",
  retryRouteSrc.includes("requireAuthOrgContext") &&
    retryRouteSrc.includes("runQuoteResponseNotificationFlush") &&
    retryRouteSrc.includes("eq(\"org_id\", auth.orgId)") &&
    !retryRouteSrc.includes("accept_quote_by_access_token") &&
    !retryRouteSrc.includes("createPublicSupabase")
);

console.log("\n--- Action URL ---");
const clientUrl = resolveQuoteResponseNotificationActionUrl({
  kind: "quote_accepted_client",
  storedActionUrl: null,
  publicPath: quotePublicPath(TOKEN),
  origin: ORIGIN,
});
const builderUrl = resolveQuoteResponseNotificationActionUrl({
  kind: "quote_accepted_builder",
  storedActionUrl: `/app/projects/proj/quotes/${QUOTE_ID}`,
  publicPath: quotePublicPath(TOKEN),
  origin: ORIGIN,
});
assert(
  "client action URL is the stable public /q/{token} path",
  clientUrl === `${ORIGIN}/q/${TOKEN}` &&
    quotePublicPath(TOKEN).startsWith("/q/qt_")
);
assert(
  "client URL is not reconstructed from stored DB token",
  resolveQuoteResponseNotificationActionUrl({
    kind: "quote_accepted_client",
    storedActionUrl: `${ORIGIN}/q/${TOKEN}`,
    publicPath: null,
    origin: ORIGIN,
  }) === null
);
assert(
  "builder action URL stays the in-app quote path",
  builderUrl === `${ORIGIN}/app/projects/proj/quotes/${QUOTE_ID}` &&
    !builderUrl.includes("/q/")
);

console.log("\n--- Flush loop ---");
async function main() {
  const store = createMemoryStore({
    notifications,
    deliveries: seedDeliveries(),
  });
  const provider = createMockQuoteDeliveryProvider();
  const result = await sendPendingQuoteResponseNotificationDeliveries(
    { quoteId: QUOTE_ID, orgId: ORG_ID, publicPath: quotePublicPath(TOKEN) },
    {
      store,
      provider,
      origin: ORIGIN,
      fromAddress: "Quotr <quotes@example.test>",
    }
  );
  const builder = store.deliveries.find((row) => row.email_kind === "quote_accepted_builder");
  const client = store.deliveries.find((row) => row.email_kind === "quote_accepted_client");
  assert(
    "post-commit flush submits builder email",
    result.submitted === 2 &&
      result.failed === 0 &&
      builder?.status === "submitted" &&
      Boolean(builder?.provider_message_id)
  );
  assert(
    "post-commit flush submits client confirmation",
    client?.status === "submitted" &&
      Boolean(client?.provider_message_id) &&
      client?.recipient_email === "client@example.test"
  );
  assert(
    "client email uses public token URL without putting the raw token in HTML copy",
    provider.sent[1]?.html.includes(`href="${ORIGIN}/q/${TOKEN}"`) === true &&
      !provider.sent[1]?.html.replace(/href="[^"]+"/g, "").includes(TOKEN) &&
      provider.sent[0]?.html.includes("/app/projects/")
  );
  assert(
    "flush does not persist the raw token on the delivery row",
    client?.action_url === null
  );
  assert(
    "empty public quote org_id is rejected",
    (await sendPendingQuoteResponseNotificationDeliveries(
      { quoteId: QUOTE_ID, orgId: "" },
      {
        store,
        provider: createMockQuoteDeliveryProvider(),
        origin: ORIGIN,
        fromAddress: "Quotr <quotes@example.test>",
      }
    )).skipped === "invalid_context"
  );

console.log("\n--- Retry / idempotency / Resend failure ---");
{
  const store = createMemoryStore({
    notifications,
    deliveries: seedDeliveries(),
  });
  const provider = createMockQuoteDeliveryProvider();
  await sendPendingQuoteResponseNotificationDeliveries(
    { quoteId: QUOTE_ID, orgId: ORG_ID, publicPath: quotePublicPath(TOKEN) },
    {
      store,
      provider,
      origin: ORIGIN,
      fromAddress: "Quotr <quotes@example.test>",
    }
  );
  const firstIds = store.deliveries.map((row) => row.provider_message_id);
  const retry = await sendPendingQuoteResponseNotificationDeliveries(
    { quoteId: QUOTE_ID, orgId: ORG_ID, publicPath: quotePublicPath(TOKEN) },
    {
      store,
      provider,
      origin: ORIGIN,
      fromAddress: "Quotr <quotes@example.test>",
    }
  );
  assert(
    "pending/failed retry does not duplicate submitted intent",
    retry.submitted === 0 &&
      retry.skipped === "no_rows" &&
      provider.sent.length === 2 &&
      store.deliveries.every((row) => row.status === "submitted") &&
      store.deliveries.map((row) => row.provider_message_id).join() ===
        firstIds.join()
  );
}

{
  const store = createMemoryStore({
    notifications,
    deliveries: seedDeliveries(),
  });
  store.deliveries[0].status = "failed";
  store.deliveries[1].status = "pending";
  const provider = createMockQuoteDeliveryProvider();
  const result = await sendPendingQuoteResponseNotificationDeliveries(
    { quoteId: QUOTE_ID, orgId: ORG_ID },
    {
      store,
      provider,
      origin: ORIGIN,
      fromAddress: "Quotr <quotes@example.test>",
    }
  );
  assert(
    "failed and pending rows are retried without new notification intent",
    result.submitted === 2 &&
      provider.sent.length === 2 &&
      provider.sent[0]?.idempotencyKey ===
        quoteNotificationIdempotencyKey({
          kind: "quote_accepted_builder",
          evidenceId: ACCEPTANCE_ID,
          recipient: BUILDER_USER_ID,
        }) &&
      provider.sent[1]?.idempotencyKey ===
        quoteNotificationIdempotencyKey({
          kind: "quote_accepted_client",
          evidenceId: ACCEPTANCE_ID,
          recipient: "client@example.test",
        })
  );
  assert(
    "retry without raw token still sends client confirmation",
    provider.sent[1]?.to === "client@example.test" &&
      !provider.sent[1]?.html.includes("/q/")
  );
}

{
  const store = createMemoryStore({
    notifications,
    deliveries: seedDeliveries(),
  });
  const provider = createMockQuoteDeliveryProvider({
    result: {
      ok: false,
      retryable: true,
      code: "provider_unavailable",
      messageSafe: "The email service is temporarily unavailable.",
    },
  });
  const result = await sendPendingQuoteResponseNotificationDeliveries(
    { quoteId: QUOTE_ID, orgId: ORG_ID, publicPath: quotePublicPath(TOKEN) },
    {
      store,
      provider,
      origin: ORIGIN,
      fromAddress: "Quotr <quotes@example.test>",
    }
  );
  assert(
    "Resend failure marks deliveries failed and does not throw",
    result.submitted === 0 &&
      result.failed === 2 &&
      store.deliveries.every((row) => row.status === "failed") &&
      store.deliveries.every((row) => row.attempt_count === 1)
  );
}

{
  const store = createMemoryStore({
    notifications,
    deliveries: seedDeliveries(),
  });
  const unconfigured = createMockQuoteDeliveryProvider({ configured: false });
  const result = await sendPendingQuoteResponseNotificationDeliveries(
    { quoteId: QUOTE_ID, orgId: ORG_ID },
    {
      store,
      provider: unconfigured,
      origin: ORIGIN,
      fromAddress: "Quotr <quotes@example.test>",
    }
  );
  assert(
    "unconfigured provider leaves rows pending for later retry",
    result.skipped === "provider_unconfigured" &&
      store.deliveries.every((row) => row.status === "pending") &&
      store.deliveries.every((row) => row.attempt_count === 0)
  );
}

assert(
  "idempotency keys remain evidence-scoped",
  quoteNotificationIdempotencyKey({
    kind: "quote_accepted_builder",
    evidenceId: ACCEPTANCE_ID,
    recipient: BUILDER_USER_ID,
  }) === `quote-accepted-builder:v1:${ACCEPTANCE_ID}:${BUILDER_USER_ID}` &&
    quoteNotificationIdempotencyKey({
      kind: "quote_accepted_client",
      evidenceId: ACCEPTANCE_ID,
      recipient: "Client@Example.test",
    }) === `quote-accepted-client:v1:${ACCEPTANCE_ID}:client@example.test`
);

if (process.exitCode) {
  console.log("\nCOMMERCIAL-NOTIFY-FIX-01 verifier failed");
} else {
  console.log("\nCOMMERCIAL-NOTIFY-FIX-01 verifier passed");
}
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
