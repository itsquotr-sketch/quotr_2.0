/**
 * COMMERCIAL-CLOSE-01: client-safe detailed Quotes + response notifications.
 * No live email. No AI. Does not restamp economic goldens.
 *
 * Run: npx tsx scripts/verify-commercial-close-01.ts
 */
import { readFileSync, readdirSync } from "node:fs";
import {
  clientSafeQuoteLineDescription,
  isEstimatorDiagnosticDescription,
} from "../lib/quotes/client-line-description";
import { resolveQuoteItemDescription } from "../lib/quotes/from-pricing";
import {
  LEGACY_QUOTE_PRESENTATION_FALLBACK,
  NEW_QUOTE_PRESENTATION_MODE,
  parseQuotePresentationMode,
  presentQuoteClientDocument,
} from "../lib/quotes/presentation";
import { mapQuote } from "../lib/quotes/mappers";
import { quoteNotificationIdempotencyKey } from "../lib/quotes/notifications";
import { buildQuoteResponseNotificationEmail } from "../lib/quotes/notification-email";
import { resolveClientFacingTermsSections } from "../lib/quotes/client-terms-display";
import {
  DEFAULT_PAYMENT_TERMS,
  DEFAULT_QUOTE_TERMS,
} from "../lib/settings/defaults";
import type { PricingItem } from "../lib/pricing/types";
import type { Quote, QuoteItem } from "../lib/quotes/types";

function assert(label: string, ok: boolean) {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) process.exitCode = 1;
}

function file(path: string): string {
  return readFileSync(path, "utf8");
}

const migrations = readdirSync("supabase/migrations")
  .filter((name) => name.endsWith(".sql"))
  .sort();
const closeSrc = file("supabase/migrations/045_commercial_close.sql");
const templateSrc = file("components/quotes/QuoteTemplate.tsx");
const workspaceSrc = file("components/quotes/QuoteWorkspace.tsx");
const printSrc = file(
  "app/(protected)/app/projects/[projectId]/quotes/[quoteId]/print/page.tsx"
);
const publicDocSrc = file("components/quotes/QuotePublicDocument.tsx");
const fromPricingSrc = file("lib/quotes/from-pricing.ts");
const buildSrc = file("lib/quotes/build-from-pricing.ts");
const presentationSrc = file("lib/quotes/presentation.ts");
const acceptActionsSrc = file("lib/quotes/acceptance-actions.ts");
const quoteActionsSrc = file("lib/quotes/actions.ts");
const flushSrc = file("lib/quotes/notification-flush.ts");
const notifyActionsSrc = file("lib/quotes/notification-actions.ts");
const webhookSrc = file("app/api/webhooks/resend/route.ts");
const entitlementsSrc = file("lib/quotes/entitlements.ts");
const acceptance044 = file("supabase/migrations/044_quote_acceptance.sql");

function pricingItem(overrides: Partial<PricingItem>): PricingItem {
  return {
    id: "item-1",
    org_id: "org-1",
    pricing_document_id: "doc-1",
    project_id: "project-1",
    work_area_id: null,
    source_estimate_line_item_id: null,
    component_key: null,
    item_type: "labour",
    delivery_method: "in_house",
    internal_label: "Install decking",
    client_label: "Install decking",
    internal_description:
      "Physical driver: deck area\nRequired quantity: 42.0 m²\nPurchased quantity: 46.2 m²\nWaste 10%",
    client_description: null,
    quantity: 42,
    unit: "m²",
    unit_cost: 80,
    unit_sell: 100,
    total_cost: 3360,
    total_sell: 4200,
    gross_profit: 840,
    margin_percent: 20,
    markup_percent: 25,
    calculation_mode: "productivity_labour",
    productivity_rate: 0.35,
    productivity_unit: "hrs/m²",
    calculated_quantity: 14.7,
    visible_on_quote: true,
    optional: false,
    sort_order: 0,
    notes_internal: "Physical driver: deck area · 0.35 hrs/m²",
    notes_client: null,
    manually_edited: false,
    orphaned: false,
    recalibration_note: null,
    cost_known: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function quoteItem(overrides: Partial<QuoteItem> = {}): QuoteItem {
  return {
    id: "qi-1",
    org_id: "org-1",
    quote_id: "q-1",
    project_id: "p-1",
    pricing_item_id: null,
    work_area_id: null,
    section_title: "Deck",
    section_description: null,
    label: "Install decking",
    description: null,
    quantity: 42,
    unit: "m²",
    unit_price: 100,
    total: 4200,
    visible: true,
    optional: false,
    sort_order: 0,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function quoteDoc(overrides: Partial<Quote> = {}): Quote {
  return {
    id: "q-1",
    org_id: "org-1",
    project_id: "project-1",
    pricing_document_id: "doc-1",
    estimate_id: null,
    quote_number: "Q-0001",
    title: "Quote",
    status: "sent",
    client_name: "Jean-Luc Ellis",
    site_address: null,
    issue_date: null,
    valid_until: null,
    subtotal: 10486.97,
    gst_rate: 15,
    gst_amount: 1573.05,
    total_incl_gst: 12060.02,
    scope_summary: "Deck works as described.",
    inclusions: ["Deck"],
    exclusions: [],
    assumptions: [],
    terms: null,
    notes_to_client: null,
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    sent_at: null,
    viewed_at: null,
    accepted_at: null,
    declined_at: null,
    expired_at: null,
    issuer_snapshot: null,
    snapshot_fingerprint: null,
    snapshot_fingerprint_version: null,
    revision_number: 3,
    parent_quote_id: null,
    revised_from_quote_id: null,
    superseded_by_quote_id: null,
    superseded_at: null,
    revision_note: null,
    presentation_mode: "detailed",
    ...overrides,
  };
}

console.log("=== COMMERCIAL-CLOSE-01 ===\n");

console.log("--- Schema / default ---");
assert(
  "045 is latest additive migration",
  migrations.includes("044_quote_acceptance.sql") &&
    migrations.at(-1) === "045_commercial_close.sql"
);
assert(
  "045 sets new-quote DB default to detailed without rewriting rows",
  closeSrc.includes("alter column presentation_mode set default 'detailed'") &&
    !/update\s+public\.quotes/i.test(closeSrc)
);
assert(
  "app create writes detailed",
  NEW_QUOTE_PRESENTATION_MODE === "detailed" &&
    buildSrc.includes("NEW_QUOTE_PRESENTATION_MODE") &&
    presentationSrc.includes('NEW_QUOTE_PRESENTATION_MODE: QuotePresentationMode = "detailed"')
);
assert(
  "unknown/missing presentation stays grouped for history",
  parseQuotePresentationMode(undefined) === "grouped" &&
    parseQuotePresentationMode("fancy") === "grouped" &&
    LEGACY_QUOTE_PRESENTATION_FALLBACK === "grouped" &&
    mapQuote({ id: "q", org_id: "o", project_id: "p", title: "Q", status: "sent" })
      .presentation_mode === "grouped"
);
assert(
  "041 revision copy of presentation_mode is not replaced by 045",
  !closeSrc.includes("create_quote_revision") &&
    !closeSrc.includes("insert_draft_quote")
);

console.log("\n--- Client-safe detailed lines ---");
const leaked =
  "Required quantity: 42.0 m²\nPurchased quantity: 46.2 m²\nWaste 10%\nPhysical driver: deck area\n0.35 person-hours/m²";
assert(
  "estimator diagnostic classifier catches calculation-detail leak",
  isEstimatorDiagnosticDescription(leaked)
);
assert(
  "client-safe helper drops leaked calculation detail",
  clientSafeQuoteLineDescription(leaked) === null
);
assert(
  "intentional client description is kept",
  clientSafeQuoteLineDescription("Supply and install timber decking.") ===
    "Supply and install timber decking."
);
assert(
  "snapshot path never falls back to internal notes",
  resolveQuoteItemDescription(pricingItem({})) === null &&
    fromPricingSrc.includes("item.client_description") &&
    fromPricingSrc.includes("item.notes_client") &&
    !fromPricingSrc.includes("item.internal_description") &&
    !fromPricingSrc.includes("item.notes_internal")
);
assert(
  "intentional notes_client still snapshots",
  resolveQuoteItemDescription(
    pricingItem({ notes_client: "Includes stairs to lawn." })
  ) === "Includes stairs to lawn."
);
assert(
  "diagnostic notes_client is not used as client copy",
  resolveQuoteItemDescription(
    pricingItem({ notes_client: leaked })
  ) === null
);
assert(
  "QuoteTemplate/public/PDF share clientSafeQuoteLineDescription",
  templateSrc.includes("clientSafeQuoteLineDescription") &&
    file("lib/quotes/delivery-client-payload.ts").includes(
      "clientSafeQuoteLineDescription"
    ) &&
    file("lib/quotes/mappers.ts").includes("clientSafeQuoteLineDescription") &&
    printSrc.includes("QuoteTemplate") &&
    publicDocSrc.includes("QuoteTemplate")
);
assert(
  "client QuoteTemplate does not import Pricing calculation details",
  !templateSrc.includes("calculation-details") &&
    !templateSrc.includes("buildPricingCalculationDetails") &&
    !templateSrc.toLowerCase().includes("required quantity") &&
    !templateSrc.toLowerCase().includes("physical driver")
);
assert(
  "accepted PDF keeps evidence section on the same client-safe template",
  templateSrc.includes("QuoteAcceptanceRecordSection") &&
    printSrc.includes("acceptance={data.acceptance}")
);

console.log("\n--- Presentation economic parity ---");
const items = [
  quoteItem({ id: "a", total: 8000, sort_order: 1 }),
  quoteItem({ id: "b", total: 2486.97, sort_order: 2 }),
  quoteItem({
    id: "opt",
    total: 1850,
    optional: true,
    sort_order: 3,
  }),
];
const detailed = presentQuoteClientDocument(quoteDoc({ presentation_mode: "detailed" }), items);
const grouped = presentQuoteClientDocument(quoteDoc({ presentation_mode: "grouped" }), items);
const lump = presentQuoteClientDocument(quoteDoc({ presentation_mode: "lump_sum" }), items);
assert(
  "presentation modes share included sell; optional stays out of base",
  detailed.includedSell === 10486.97 &&
    grouped.includedSell === detailed.includedSell &&
    lump.includedSell === detailed.includedSell &&
    detailed.optionalItems.length === 1
);
assert(
  "template money still uses stored quote totals",
  templateSrc.includes("quote.subtotal") &&
    templateSrc.includes("quote.gst_amount") &&
    templateSrc.includes("quote.total_incl_gst") &&
    !templateSrc.includes("includedSell")
);
assert(
  "detailed default is presentation only",
  detailed.mode === "detailed" &&
    grouped.mode === "grouped" &&
    lump.mode === "lump_sum"
);

console.log("\n--- Notifications ---");
assert(
  "durable notifications + notification_deliveries outbox exist",
  closeSrc.includes("create table if not exists public.notifications") &&
    closeSrc.includes("create table if not exists public.notification_deliveries") &&
    closeSrc.includes("'pending'") &&
    closeSrc.includes("'submitted'") &&
    closeSrc.includes("'delivered'") &&
    closeSrc.includes("'failed'")
);
assert(
  "enqueue is AFTER INSERT trigger, no Resend in SQL",
  closeSrc.includes("after insert on public.quote_acceptances") &&
    closeSrc.includes("after insert on public.quote_declines") &&
    !closeSrc.includes("api.resend.com") &&
    closeSrc.includes("if new.source is distinct from 'client'")
);
assert(
  "public accept/decline flush after RPC, errors swallowed",
    acceptActionsSrc.includes("await flushQuoteResponseNotificationsForPublicToken") &&
    acceptActionsSrc.lastIndexOf("ACCEPT_QUOTE_BY_ACCESS_TOKEN_RPC") <
      acceptActionsSrc.indexOf("await flushQuoteResponseNotificationsForPublicToken") &&
    flushSrc.includes("Accept/decline remains canonical") &&
    !quoteActionsSrc.includes("flushQuoteResponseNotificationsForPublicToken")
);
assert(
  "flush is quote-scoped and not inside a SQL transaction",
  flushSrc.includes("quote_access_tokens") &&
    flushSrc.includes("hashQuoteAccessToken") &&
    !flushSrc.includes(".rpc(") &&
    !acceptActionsSrc.includes("api.resend.com")
);
assert(
  "idempotency keys are stable per evidence + recipient",
  quoteNotificationIdempotencyKey({
    kind: "quote_accepted_builder",
    evidenceId: "acc-1",
    recipient: "user-1",
  }) === "quote-accepted-builder:v1:acc-1:user-1" &&
    quoteNotificationIdempotencyKey({
      kind: "quote_accepted_client",
      evidenceId: "acc-1",
      recipient: "Client@Example.com",
    }) === "quote-accepted-client:v1:acc-1:client@example.com" &&
    quoteNotificationIdempotencyKey({
      kind: "quote_declined_builder",
      evidenceId: "dec-1",
      recipient: "user-1",
    }) === "quote-declined-builder:v1:dec-1:user-1" &&
    closeSrc.includes("quote-accepted-builder:v1:") &&
    closeSrc.includes("quote-accepted-client:v1:") &&
    closeSrc.includes("quote-declined-builder:v1:") &&
    closeSrc.includes("on conflict (idempotency_key) do nothing")
);
assert(
  "client confirmation uses signer_email, not project email",
  closeSrc.includes("quote_accepted_client") &&
    closeSrc.includes("new.signer_email") &&
    !closeSrc.includes("client_email")
);
assert(
  "client decline confirmation is deferred in v1",
  !closeSrc.includes("quote_declined_client") &&
    closeSrc.includes("Client decline confirmation email is intentionally omitted")
);
assert(
  "recipient is quote.created_by else oldest org owner",
  closeSrc.includes("p_quote.created_by") &&
    closeSrc.includes("role = 'owner'") &&
    closeSrc.includes("recipient_user_id") &&
    closeSrc.includes("org_id")
);
assert(
  "in-app builder inbox exists; not a giant notification centre",
  file("components/layout/notification-bell.tsx").includes(
    "listMyQuoteNotifications"
  ) &&
    file("components/layout/app-shell.tsx").includes("NotificationBell") &&
    file("components/app-sidebar.tsx").includes("NotificationBell") &&
    notifyActionsSrc.includes("mark_notifications_read_v1") &&
    !file("components/layout/notification-bell.tsx").includes("Notification centre")
);
assert(
  "builder emails are client-safe and use issuer identity",
  (() => {
    const accepted = buildQuoteResponseNotificationEmail({
      kind: "quote_accepted_builder",
      companyName: "Quotr Limited",
      projectTitle: "New Deck Test",
      quoteNumber: "Q-0001",
      revisionNumber: 3,
      signerName: "Jean-Luc Ellis",
      totalInclGst: 12060.02,
      occurredAt: "2026-09-01T03:00:00.000Z",
      declineNote: null,
      actionUrl: "https://example.test/app/projects/p/quotes/q",
    });
    const declined = buildQuoteResponseNotificationEmail({
      kind: "quote_declined_builder",
      companyName: "Quotr Limited",
      projectTitle: "New Deck Test",
      quoteNumber: "Q-0001",
      revisionNumber: 3,
      signerName: "Jean-Luc Ellis",
      totalInclGst: null,
      occurredAt: "2026-09-01T03:00:00.000Z",
      declineNote: "Timing does not work.",
      actionUrl: "https://example.test/app/projects/p/quotes/q",
    });
    const client = buildQuoteResponseNotificationEmail({
      kind: "quote_accepted_client",
      companyName: "Quotr Limited",
      projectTitle: "New Deck Test",
      quoteNumber: "Q-0001",
      revisionNumber: 3,
      signerName: "Jean-Luc Ellis",
      totalInclGst: 12060.02,
      occurredAt: "2026-09-01T03:00:00.000Z",
      declineNote: null,
      actionUrl: "https://example.test/q/qt_token",
    });
    const blob = `${accepted.subject}\n${accepted.text}\n${declined.text}\n${client.text}`.toLowerCase();
    return (
      accepted.subject === "New Deck Test — Quote Q-0001 accepted" &&
      declined.subject === "New Deck Test — Quote Q-0001 declined" &&
      client.text.includes("Your acceptance has been recorded.") &&
      !blob.includes("required quantity") &&
      !blob.includes("physical driver") &&
      !blob.includes("productivity") &&
      !blob.includes("unit_cost")
    );
  })()
);
assert(
  "flush uses issuer snapshot, not inferred company-name correction",
  flushSrc.includes("issuer_snapshot") &&
    flushSrc.includes("parseQuoteIssuerSnapshot")
);
assert(
  "Resend webhook can mark notification deliveries without breaking quote delivery",
  webhookSrc.includes("notification_deliveries") &&
    webhookSrc.includes("quote_deliveries") &&
    webhookSrc.includes("isMissingNotificationTableError")
);
assert(
  "RLS: authenticated select own notifications; anon cannot access deliveries",
  closeSrc.includes("recipient_user_id = auth.uid()") &&
    closeSrc.includes("revoke all on table public.notifications") &&
    closeSrc.includes("revoke all on table public.notification_deliveries") &&
    closeSrc.includes("grant select on table public.notifications to authenticated") &&
    !closeSrc.includes("grant select on table public.notification_deliveries to authenticated") &&
    !closeSrc.includes("grant insert on table public.notifications to authenticated")
);
assert(
  "045 does not add notification fields to acceptance evidence",
  !closeSrc.includes("alter table public.quote_acceptances") &&
    !closeSrc.includes("alter table public.quote_declines") &&
    acceptance044.includes("signer_email") &&
    acceptance044.includes("snapshot_fingerprint")
);
assert(
  "manual builder accept/decline does not send response emails",
  quoteActionsSrc.includes("ACCEPT_QUOTE_REVISION_RPC") &&
    !quoteActionsSrc.includes("flushQuoteResponseNotifications")
);
assert(
  "notifications are not gated on Billing plan strings",
  !closeSrc.toLowerCase().includes("subscription_tier") &&
    !flushSrc.includes("quotes.send") &&
    entitlementsSrc.includes('"quotes.acceptance"') &&
    entitlementsSrc.includes("Future billing seam")
);

console.log("\n--- Sidebar / terms / mobile ---");
assert(
  "desktop quote sidebar remains one sticky stack",
  workspaceSrc.includes("xl:sticky xl:top-[4.5rem]") &&
    workspaceSrc.includes("xl:max-h-[calc(100vh-5.5rem)]")
);
assert(
  "duplicate default payment/validity/variations remain stripped",
  resolveClientFacingTermsSections({
    quoteTerms: `${DEFAULT_QUOTE_TERMS}\n\n${DEFAULT_PAYMENT_TERMS}`,
    issuerPaymentTerms: DEFAULT_PAYMENT_TERMS,
    hasValiditySection: true,
  }).terms === null &&
    resolveClientFacingTermsSections({
      quoteTerms: "Site must remain accessible.\n\nCustom retention 10%.",
      issuerPaymentTerms: DEFAULT_PAYMENT_TERMS,
      hasValiditySection: true,
    }).terms?.includes("Site must remain accessible") === true
);
assert(
  "detailed mobile cards wrap; table overflow is contained",
  templateSrc.includes("sm:hidden print:hidden") &&
    templateSrc.includes("max-sm:overflow-x-hidden") &&
    templateSrc.includes("break-words") &&
    templateSrc.includes("overflow-x-hidden")
);
assert(
  "no Analytics / RFQ / Billing start in this close",
  !closeSrc.toLowerCase().includes("analytics") &&
    !closeSrc.toLowerCase().includes("rfq") &&
    !closeSrc.toLowerCase().includes("subcontractor") &&
    !file("lib/quotes/notification-actions.ts").toLowerCase().includes("billing")
);

if (process.exitCode) {
  console.log("\nCOMMERCIAL-CLOSE-01 verifier failed");
} else {
  console.log("\nCOMMERCIAL-CLOSE-01 verifier passed");
}
