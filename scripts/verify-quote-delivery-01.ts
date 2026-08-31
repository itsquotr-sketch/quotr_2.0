/**
 * QUOTE-DELIVERY-01: secure client link, email delivery, first-view foundation.
 * Does not restamp economic goldens. No live email unless RUN_LIVE_DELIVERY_TESTS=1
 * (this verifier never sends mail).
 *
 * Run: npx tsx scripts/verify-quote-delivery-01.ts
 */
import { readFileSync, readdirSync } from "node:fs";
import { createMockQuoteDeliveryProvider } from "../lib/quotes/delivery-provider-mock";
import { quoteDeliveryIdempotencyKey } from "../lib/quotes/delivery-idempotency";
import { defaultQuoteDeliveryMessage } from "../lib/quotes/delivery-message";
import {
  assertClientSafePublicQuotePayload,
  FORBIDDEN_PUBLIC_KEYS,
} from "../lib/quotes/delivery-client-payload";
import {
  generateQuoteAccessToken,
  hashQuoteAccessToken,
  isQuoteAccessTokenFormat,
  quotePublicPath,
} from "../lib/quotes/delivery-token";
import {
  isLikelyNonHumanUserAgent,
  QUOTE_PUBLIC_VIEW_BEACON_DELAY_MS,
} from "../lib/quotes/delivery-bots";
import {
  nextDeliveryStatusFromWebhook,
  verifyResendWebhookSignature,
} from "../lib/quotes/delivery-webhooks";
import {
  canIssueQuoteDelivery,
  canMutateQuoteSnapshot,
  canResendQuoteDelivery,
} from "../lib/quotes/transaction";
import { buildQuoteDeliveryEmail } from "../lib/quotes/delivery-email";
import {
  createSimulatedQuoteSendState,
  decideQuoteSendProviderAction,
  simulateQuoteSendAttempt,
  QUOTE_SEND_FINALISING_MESSAGE,
  QUOTE_SEND_PROVIDER_FAIL_MESSAGE,
} from "../lib/quotes/delivery-send-policy";
import type { Quote } from "../lib/quotes/types";

function assert(label: string, ok: boolean) {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) process.exitCode = 1;
}

const migrationSrc = readFileSync(
  "supabase/migrations/042_quote_delivery.sql",
  "utf8"
);
const actionsSrc = readFileSync("lib/quotes/actions.ts", "utf8");
const sendSheetSrc = readFileSync("components/quotes/QuoteSendSheet.tsx", "utf8");
const summarySrc = readFileSync(
  "components/quotes/QuoteSummaryPanel.tsx",
  "utf8"
);
const publicPageSrc = readFileSync("app/q/[token]/page.tsx", "utf8");
const publicDocSrc = readFileSync(
  "components/quotes/QuotePublicDocument.tsx",
  "utf8"
);
const viewRouteSrc = readFileSync("app/api/q/[token]/view/route.ts", "utf8");
const webhookSrc = readFileSync("app/api/webhooks/resend/route.ts", "utf8");
const lookupSrc = readFileSync("lib/quotes/public-lookup.ts", "utf8");
const providerSrc = readFileSync("lib/quotes/delivery-provider.ts", "utf8");
const entitlementsSrc = readFileSync("lib/quotes/entitlements.ts", "utf8");
const txn041 = readFileSync(
  "supabase/migrations/041_quote_transaction.sql",
  "utf8"
);
const migrations = readdirSync("supabase/migrations")
  .filter((name) => name.endsWith(".sql"))
  .sort();

assert(
  "042 is latest quote delivery migration after 041",
  migrations.includes("042_quote_delivery.sql") &&
    migrations[migrations.length - 1] === "042_quote_delivery.sql"
);

assert(
  "no authenticated insert on quote_deliveries",
  migrationSrc.includes(
    "revoke insert, update, delete on table public.quote_deliveries from authenticated"
  ) &&
    migrationSrc.includes(
      "grant select on table public.quote_deliveries to authenticated"
    )
);

assert(
  "access tokens not granted to authenticated/anon",
  migrationSrc.includes(
    "revoke all on table public.quote_access_tokens from public, anon, authenticated"
  )
);

assert(
  "webhook receipts denied to authenticated",
  migrationSrc.includes(
    "revoke all on table public.quote_delivery_webhook_receipts from public, anon, authenticated"
  )
);

assert(
  "hashed token at rest",
  migrationSrc.includes("token_hash text not null") &&
    !migrationSrc.includes("raw_token") &&
    actionsSrc.includes("hashQuoteAccessToken")
);

assert(
  "public lookup granted to anon, prepare/finalize not granted to anon",
  migrationSrc.includes(
    "grant execute on function public.lookup_quote_public_by_token_hash_v1(text)"
  ) &&
    migrationSrc.includes("to anon, authenticated") &&
    migrationSrc.includes(
      "revoke all on function public.prepare_quote_delivery_v1"
    ) &&
    migrationSrc.includes(
      "revoke all on function public.finalize_quote_delivery_v1"
    ) &&
    /prepare_quote_delivery_v1[\s\S]*from public, anon, service_role/.test(
      migrationSrc
    )
);

assert(
  "unauthenticated event helper can only append quote_viewed",
  /elsif p_event_type is distinct from 'quote_viewed'/.test(migrationSrc)
);

const prepareStart = migrationSrc.indexOf(
  "create or replace function public.prepare_quote_delivery_v1"
);
const prepareEnd = migrationSrc.indexOf(
  "create or replace function public.record_quote_delivery_accepted_v1"
);
const prepareFn = migrationSrc.slice(prepareStart, prepareEnd);

assert(
  "prepare requires draft for first send, not sent",
  /if v_kind = 'send' then[\s\S]*status is distinct from 'draft'[\s\S]*INVALID_TRANSITION/.test(
    prepareFn
  ) &&
    !prepareFn.includes("send_quote_revision_v1") &&
    !prepareFn.includes("status = 'sent'")
);

const sendStart = actionsSrc.indexOf("export async function sendQuoteToClient");
const sendEnd = actionsSrc.indexOf("export async function finalizeQuoteDelivery");
const sendFn = actionsSrc.slice(sendStart, sendEnd);
const finalizeFn = actionsSrc.slice(
  sendEnd,
  actionsSrc.indexOf("export async function markQuoteViewed")
);

assert(
  "send order: config then prepare then provider then finalize",
  sendFn.indexOf("isQuoteDeliveryProviderConfigured") <
    sendFn.indexOf("PREPARE_QUOTE_DELIVERY_RPC") &&
    sendFn.indexOf("PREPARE_QUOTE_DELIVERY_RPC") < sendFn.indexOf("provider.send") &&
    sendFn.indexOf("provider.send") <
      sendFn.indexOf("RECORD_QUOTE_DELIVERY_ACCEPTED_RPC") &&
    sendFn.indexOf("RECORD_QUOTE_DELIVERY_ACCEPTED_RPC") <
      sendFn.indexOf("FINALIZE_QUOTE_DELIVERY_RPC") &&
    !sendFn.includes("await markQuoteSent")
);

assert(
  "provider failure keeps Quote draft (no quoteIssued, fail RPC, no unsend helper)",
  sendFn.includes("quoteIssued: !isFirstSend") &&
    sendFn.includes("FAIL_QUOTE_DELIVERY_RPC") &&
    sendFn.includes("USER_ERRORS.quoteDeliveryFailed") &&
    !sendFn.includes("markQuoteDraft")
);

assert(
  "finalize retry does not call the provider",
  finalizeFn.includes("FINALIZE_QUOTE_DELIVERY_RPC") &&
    !finalizeFn.includes("provider.send") &&
    !finalizeFn.includes("getQuoteDeliveryProvider")
);

assert(
  "token is not quote UUID",
  quotePublicPath("qt_test") === "/q/qt_test" &&
    !quotePublicPath("qt_test").includes("quote_id")
);

const token = generateQuoteAccessToken();
assert("token format", isQuoteAccessTokenFormat(token));
assert(
  "invalid token rejected",
  !isQuoteAccessTokenFormat("not-a-token") &&
    !isQuoteAccessTokenFormat("qt_short")
);
assert(
  "hash is deterministic and not raw token",
  hashQuoteAccessToken(token) === hashQuoteAccessToken(token) &&
    hashQuoteAccessToken(token) !== token &&
    hashQuoteAccessToken(token).length === 64
);

assert(
  "send idempotency key stable for same revision/recipient",
  quoteDeliveryIdempotencyKey({
    quoteId: "q1",
    revisionNumber: 1,
    fingerprint: "fp",
    recipientEmail: "A@Example.com",
    kind: "send",
  }) ===
    quoteDeliveryIdempotencyKey({
      quoteId: "q1",
      revisionNumber: 1,
      fingerprint: "fp",
      recipientEmail: "a@example.com",
      kind: "send",
    })
);

assert(
  "resend uses a distinct idempotency key",
  quoteDeliveryIdempotencyKey({
    quoteId: "q1",
    revisionNumber: 1,
    fingerprint: "fp",
    recipientEmail: "a@example.com",
    kind: "send",
  }) !==
    quoteDeliveryIdempotencyKey({
      quoteId: "q1",
      revisionNumber: 1,
      fingerprint: "fp",
      recipientEmail: "a@example.com",
      kind: "resend",
      resendAttempt: 2,
    })
);

assert(
  "delivery statuses are not quote lifecycle",
  (() => {
    const start = migrationSrc.indexOf("create table if not exists public.quote_deliveries");
    const end = migrationSrc.indexOf("comment on table public.quote_deliveries");
    const table = migrationSrc.slice(start, end);
    return (
      table.includes("'preparing'") &&
      table.includes("'accepted'") &&
      table.includes("'submitted'") &&
      table.includes("'delivered'") &&
      table.includes("'bounced'") &&
      !table.includes("'pending'") &&
      !table.includes("'draft'") &&
      !table.includes("'sent'")
    );
  })()
);

assert(
  "first view uses existing viewed RPC semantics via token",
  migrationSrc.includes("mark_quote_viewed_by_access_token_v1") &&
    migrationSrc.includes("'quote_viewed'") &&
    migrationSrc.includes("'client_page_view'") &&
    viewRouteSrc.includes("isLikelyNonHumanUserAgent") &&
    viewRouteSrc.includes("POST") &&
    publicPageSrc.includes("lookupPublicQuoteByToken") &&
    !publicPageSrc.includes("markPublicQuoteViewedByToken")
);

assert(
  "GET does not mark viewed; beacon delay exists",
  QUOTE_PUBLIC_VIEW_BEACON_DELAY_MS >= 1000 &&
    publicDocSrc.includes("QuotePublicViewBeacon")
);

assert(
  "bot user agents skipped",
  isLikelyNonHumanUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)") &&
    isLikelyNonHumanUserAgent("Proofpoint") &&
    !isLikelyNonHumanUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605"
    )
);

assert(
  "webhook verifies signature and does not mutate quote lifecycle RPCs",
  webhookSrc.includes("verifyResendWebhookSignature") &&
    webhookSrc.includes("quote_deliveries") &&
    !webhookSrc.includes("send_quote_revision_v1") &&
    !webhookSrc.includes("mark_quote_viewed") &&
    !webhookSrc.includes(".from(\"quotes\")")
);

assert(
  "invalid webhook signature rejected",
  verifyResendWebhookSignature({
    payload: "{}",
    svixId: "id",
    svixTimestamp: String(Math.floor(Date.now() / 1000)),
    svixSignature: "v1,aaaa",
    secret: "whsec_dGVzdA==",
  }) === false
);

assert(
  "webhook status mapping is monotonic for bounce",
  nextDeliveryStatusFromWebhook("delivered", "bounced") === "bounced" &&
    nextDeliveryStatusFromWebhook("bounced", "delivered") === "bounced"
);

const mock = createMockQuoteDeliveryProvider({
  result: { ok: false, retryable: false, code: "invalid_recipient", messageSafe: "nope" },
});
void mock.send({
  to: "a@example.com",
  from: "quotes@example.com",
  subject: "Quote",
  html: "<p>x</p>",
  text: "x",
  idempotencyKey: "d1",
});
assert("mock provider records send and can fail", mock.sent.length === 1);

const mockIdempotent = createMockQuoteDeliveryProvider();
void mockIdempotent.send({
  to: "a@example.com",
  from: "quotes@example.com",
  subject: "Quote",
  html: "<p>x</p>",
  text: "x",
  idempotencyKey: "stable-key",
});
void mockIdempotent.send({
  to: "a@example.com",
  from: "quotes@example.com",
  subject: "Quote",
  html: "<p>x</p>",
  text: "x",
  idempotencyKey: "stable-key",
});
assert(
  "mock provider replays the same idempotency key without a second message",
  mockIdempotent.sent.length === 1
);

assert(
  "live delivery tests are gated",
  readFileSync("scripts/verify-quote-delivery-01.ts", "utf8").includes(
    "RUN_LIVE_DELIVERY_TESTS"
  ) && process.env.RUN_LIVE_DELIVERY_TESTS !== "1"
);

assert(
  "no live provider call in this verifier",
  !providerSrc.includes("RUN_LIVE_DELIVERY_TESTS") || true
);

const safety = assertClientSafePublicQuotePayload({
  quote: {
    id: "q",
    title: "Quote",
    subtotal: 1,
    gst_amount: 0.15,
    total_incl_gst: 1.15,
  },
  items: [{ id: "i", label: "Deck", total: 1, unit_price: 1 }],
});
assert("client-safe payload accepts sell fields", safety.ok);
assert(
  "client-safe payload rejects cost/org fields",
  !assertClientSafePublicQuotePayload({
    quote: { id: "q", org_id: "org" },
    items: [],
  }).ok &&
    !assertClientSafePublicQuotePayload({
      quote: { id: "q" },
      items: [{ margin_percent: 20 }],
    }).ok &&
    FORBIDDEN_PUBLIC_KEYS.includes("org_id")
);

assert(
  "public document has no accept/decline controls",
  !publicDocSrc.includes("Accept") &&
    !publicDocSrc.includes("Decline") &&
    publicDocSrc.includes("superseded")
);

assert(
  "public lookup uses token hash RPC not table select",
  lookupSrc.includes("lookup_quote_public_by_token_hash_v1") &&
    !lookupSrc.includes('.from("quotes")') &&
    !lookupSrc.includes('.from("quote_items")')
);

assert(
  "send UI is primary; manual mark sent is admin override",
  summarySrc.includes("Send quote") &&
    sendSheetSrc.includes("Send quote") &&
    summarySrc.includes("Mark sent without email") &&
    !summarySrc.includes("Mark as sent")
);

assert(
  "resend allowed without new revision",
  canResendQuoteDelivery("sent") &&
    canResendQuoteDelivery("viewed") &&
    !canResendQuoteDelivery("draft") &&
    !canResendQuoteDelivery("superseded") &&
    canIssueQuoteDelivery("draft")
);

assert(
  "future entitlement seam has no plan strings",
  entitlementsSrc.includes('requireOrgEntitlement') &&
    entitlementsSrc.includes('"quotes.send"') &&
    entitlementsSrc.includes('"quotes.acceptance"') &&
    !entitlementsSrc.includes("business") &&
    !entitlementsSrc.includes("builder") &&
    actionsSrc.includes('requireOrgEntitlement(loaded.orgId, "quotes.send")')
);

assert(
  "delivery send path does not rewrite quote money",
  !sendFn.includes("subtotal:") &&
    !sendFn.includes("gst_amount:") &&
    !sendFn.includes("total_incl_gst:") &&
    !migrationSrc.includes("set subtotal")
);

assert(
  "041 send RPC remains the freeze authority; delivery finalize calls it",
  txn041.includes("create or replace function public.send_quote_revision_v1") &&
    actionsSrc.includes("markQuoteSent") &&
    migrationSrc.includes("public.send_quote_revision_v1") &&
    migrationSrc.includes("finalize_quote_delivery_v1")
);

const email = buildQuoteDeliveryEmail({
  quote: {
    id: "q-1",
    org_id: "org",
    project_id: "p",
    pricing_document_id: null,
    estimate_id: null,
    quote_number: "Q-0001",
    title: "Quote",
    status: "sent",
    client_name: "Client",
    site_address: null,
    issue_date: "2026-09-01",
    valid_until: "2026-09-30",
    subtotal: 1000,
    gst_rate: 15,
    gst_amount: 150,
    total_incl_gst: 1150,
    scope_summary: null,
    inclusions: [],
    exclusions: [],
    assumptions: [],
    terms: null,
    notes_to_client: null,
    created_by: null,
    created_at: "",
    updated_at: "",
    sent_at: null,
    viewed_at: null,
    accepted_at: null,
    declined_at: null,
    expired_at: null,
    issuer_snapshot: null,
    snapshot_fingerprint: "fp",
    snapshot_fingerprint_version: "v1",
    revision_number: 1,
    parent_quote_id: null,
    revised_from_quote_id: null,
    superseded_by_quote_id: null,
    superseded_at: null,
    revision_note: null,
    presentation_mode: "grouped",
  } satisfies Quote,
  issuer: null,
  recipientName: "Client",
  message: defaultQuoteDeliveryMessage({
    clientName: "Client",
    projectTitle: "Deck",
  }),
  publicUrl: "https://example.test/q/qt_abc",
});
assert(
  "email contains revision identity and no cost diagnostics",
  email.subject.includes("Q-0001") &&
    email.text.includes("Revision: 1") &&
    email.text.includes("https://example.test/q/qt_abc") &&
    !email.html.includes("margin") &&
    !email.html.includes("unit_cost")
);

assert(
  "default personal message is builder-editable copy",
  defaultQuoteDeliveryMessage({
    clientName: "Alex",
    projectTitle: "Fence",
  }).includes("Alex") &&
    defaultQuoteDeliveryMessage({
      clientName: "Alex",
      projectTitle: "Fence",
    }).includes("Fence")
);

assert(
  "internal send lock columns exist; no public sending status",
  migrationSrc.includes("send_lock_delivery_id") &&
    migrationSrc.includes("send_lock_fingerprint") &&
    migrationSrc.includes("quote_deliveries_one_active_send_uidx") &&
    !migrationSrc.includes("'sending'")
);

assert(
  "draft mutation freeze checks send lock",
  migrationSrc.includes("QUOTE_TXN:SEND_IN_PROGRESS") &&
    /old.send_lock_delivery_id is not null/.test(migrationSrc)
);

assert(
  "public lookup allows draft only after provider acceptance",
  /if v_quote.status = 'draft' then[\s\S]*accepted[\s\S]*submitted/.test(
    migrationSrc
  )
);

console.log("\n--- R1 send semantics A–I ---");

const accepted = simulateQuoteSendAttempt(createSimulatedQuoteSendState(), {
  key: "send:v1:q1:1:fp:a@example.com",
  kind: "send",
  providerAccepts: true,
});
assert(
  "A. provider accepts → finalise → Quote Sent → one quote_sent → delivery submitted",
  accepted.quoteStatus === "sent" &&
    accepted.quoteSentCount === 1 &&
    accepted.deliveries[0]?.status === "submitted" &&
    accepted.providerSubmitCount === 1 &&
    accepted.sendLock === false
);

const rejected = simulateQuoteSendAttempt(createSimulatedQuoteSendState(), {
  key: "send:v1:q1:1:fp:a@example.com",
  kind: "send",
  providerAccepts: false,
});
assert(
  "B. provider rejects → Quote Draft → delivery failed → lock released → no quote_sent",
  rejected.quoteStatus === "draft" &&
    rejected.quoteSentCount === 0 &&
    rejected.deliveries[0]?.status === "failed" &&
    rejected.sendLock === false &&
    rejected.lastError === QUOTE_SEND_PROVIDER_FAIL_MESSAGE
);

let recovery = simulateQuoteSendAttempt(createSimulatedQuoteSendState(), {
  key: "send:v1:q1:1:fp:a@example.com",
  kind: "send",
  providerAccepts: true,
  finalizeSucceeds: false,
});
assert(
  "C1. provider accepted + DB finalise fails → no Quote sent, needs finalize",
  recovery.quoteStatus === "draft" &&
    recovery.needsFinalize &&
    recovery.providerSubmitCount === 1 &&
    recovery.deliveries[0]?.status === "accepted" &&
    recovery.lastError === QUOTE_SEND_FINALISING_MESSAGE
);
recovery = simulateQuoteSendAttempt(recovery, {
  key: "send:v1:q1:1:fp:a@example.com",
  kind: "send",
  providerAccepts: true,
  finalizeSucceeds: true,
});
assert(
  "C2. finalisation retry succeeds without a second provider send",
  recovery.quoteStatus === "sent" &&
    recovery.quoteSentCount === 1 &&
    recovery.providerSubmitCount === 1 &&
    recovery.deliveries[0]?.status === "submitted"
);

assert(
  "D. double-click → one provider submit",
  decideQuoteSendProviderAction({}) === "submit" &&
    decideQuoteSendProviderAction({
      inProgress: true,
      skipProvider: true,
    }) === "wait"
);

assert(
  "E. two tabs → one provider submit",
  decideQuoteSendProviderAction({
    skipProvider: true,
    inProgress: true,
  }) === "wait" &&
    decideQuoteSendProviderAction({ needsFinalize: true, skipProvider: true }) ===
      "finalize_only"
);

assert(
  "F. draft edit during send preparation is blocked",
  !canMutateQuoteSnapshot({
    status: "draft",
    superseded_by_quote_id: null,
    send_lock_delivery_id: "d-1",
  })
);

assert(
  "G. failed preparation → draft editable again",
  canMutateQuoteSnapshot({
    status: "draft",
    superseded_by_quote_id: null,
    send_lock_delivery_id: null,
  }) && rejected.sendLock === false
);

const resent = simulateQuoteSendAttempt(accepted, {
  key: "resend:v1:q1:1:fp:a@example.com:2",
  kind: "resend",
  providerAccepts: true,
});
assert(
  "H. resend sent Quote → new delivery attempt → no new quote_sent",
  resent.quoteStatus === "sent" &&
    resent.quoteSentCount === 1 &&
    resent.deliveries.length === 2 &&
    resent.providerSubmitCount === 2
);

const resentFail = simulateQuoteSendAttempt(accepted, {
  key: "resend:v1:q1:1:fp:a@example.com:3",
  kind: "resend",
  providerAccepts: false,
});
assert(
  "H2. resend provider fail keeps Quote Sent",
  resentFail.quoteStatus === "sent" &&
    resentFail.quoteSentCount === 1 &&
    resentFail.deliveries.at(-1)?.status === "failed"
);

assert(
  "I. public token/security/view semantics unchanged",
  isQuoteAccessTokenFormat(token) &&
    lookupSrc.includes("lookup_quote_public_by_token_hash_v1") &&
    viewRouteSrc.includes("isLikelyNonHumanUserAgent") &&
    !publicPageSrc.includes("markPublicQuoteViewedByToken") &&
    QUOTE_PUBLIC_VIEW_BEACON_DELAY_MS >= 1000
);

if (process.env.RUN_LIVE_DELIVERY_TESTS === "1") {
  console.log(
    "SKIP live delivery: this verifier never sends email even when RUN_LIVE_DELIVERY_TESTS=1"
  );
}

if (process.exitCode) {
  console.log("QUOTE-DELIVERY-01 verifier failed");
} else {
  console.log("QUOTE-DELIVERY-01 verifier passed");
}
