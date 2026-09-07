/**
 * QUOTE-DISPLAY-V1B — hosted issuance close (deterministic).
 *
 * Run: npx --yes tsx scripts/verify-quote-display-v1b-hosted-close.ts
 *
 * Does not fake hosted browser proof. Hosted matrix is a separate Preview script.
 * No paid AI. No live Stripe. No Production. No migration 055.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { canClientAcceptQuote } from "../lib/quotes/acceptance";
import {
  redactPublicQuoteItemsForDisplay,
} from "../lib/quotes/delivery-client-payload";
import {
  applyQuantityUnitCoherence,
  LEGACY_QUOTE_DISPLAY_OPTIONS,
  NEW_QUOTE_DISPLAY_OPTIONS,
  normalizeQuoteDisplayOptions,
  resolveQuoteDisplayOptions,
} from "../lib/quotes/display-options";
import { presentQuoteClientDocument } from "../lib/quotes/presentation";
import {
  hashQuoteSnapshotFingerprint,
  QUOTE_SNAPSHOT_FINGERPRINT_VERSION,
} from "../lib/quotes/snapshot-fingerprint";
import {
  canMutateQuoteSnapshot,
  isQuotePubliclyViewableStatus,
} from "../lib/quotes/transaction";
import {
  createSimulatedQuoteSendState,
  decideQuoteSendProviderAction,
  simulateQuoteSendAttempt,
} from "../lib/quotes/delivery-send-policy";
import { roleAllowsPermission } from "../lib/team/permissions";
import type { Quote, QuoteItem } from "../lib/quotes/types";

function assert(label: string, ok: boolean) {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) process.exitCode = 1;
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function section(title: string) {
  console.log(`\n=== ${title} ===\n`);
}

function numberedMigrations(): string[] {
  const dir = join(process.cwd(), "supabase/migrations");
  return readdirSync(dir)
    .filter((name) => /^\d+_/.test(name) && name.endsWith(".sql"))
    .sort();
}

function quoteDoc(overrides: Partial<Quote> = {}): Quote {
  return {
    id: "q-a",
    org_id: "org-1",
    project_id: "project-1",
    pricing_document_id: "doc-1",
    estimate_id: null,
    quote_number: "Q-0100",
    title: "Quote",
    status: "draft",
    client_name: "Client",
    site_address: "1 Site Rd",
    issue_date: "2026-08-01",
    valid_until: "2027-12-31",
    subtotal: 1000,
    gst_rate: 15,
    gst_amount: 150,
    total_incl_gst: 1150,
    scope_summary: "Deck",
    inclusions: ["Deck"],
    exclusions: [],
    assumptions: [],
    terms: "Net 7",
    notes_to_client: null,
    created_by: null,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    sent_at: null,
    viewed_at: null,
    accepted_at: null,
    declined_at: null,
    expired_at: null,
    issuer_snapshot: null,
    snapshot_fingerprint: null,
    snapshot_fingerprint_version: null,
    revision_number: 1,
    parent_quote_id: null,
    revised_from_quote_id: null,
    superseded_by_quote_id: null,
    superseded_at: null,
    revision_note: null,
    presentation_mode: "detailed",
    display_options: { ...NEW_QUOTE_DISPLAY_OPTIONS },
    send_lock_delivery_id: null,
    send_lock_fingerprint: null,
    ...overrides,
  };
}

function quoteItem(overrides: Partial<QuoteItem> = {}): QuoteItem {
  return {
    id: "qi-1",
    org_id: "org-1",
    quote_id: "q-a",
    project_id: "project-1",
    pricing_item_id: null,
    work_area_id: "wa-1",
    section_title: "Deck",
    section_description: null,
    label: "Deck framing",
    description: "80 lm framing",
    quantity: 80,
    unit: "lm",
    unit_price: 15.625,
    total: 1250,
    visible: true,
    optional: false,
    sort_order: 0,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

const items = [quoteItem()];
const actionsSrc = read("lib/quotes/actions.ts");
const lookupSrc = read("lib/quotes/public-lookup.ts");
const policySrc = read("lib/quotes/delivery-send-policy.ts");
const templateSrc = read("components/quotes/QuoteTemplate.tsx");
const archSrc = read("docs/architecture/QUOTR_QUOTE_SNAPSHOT_AND_DISPLAY.md");
const fixtureSrc = read("scripts/lib/preview-auth-fixture.ts");
const sendStart = actionsSrc.indexOf("export async function sendQuoteToClient");
const sendEnd = actionsSrc.indexOf("export async function finalizeQuoteDelivery");
const sendFn = actionsSrc.slice(sendStart, sendEnd);

console.log("=== QUOTE-DISPLAY-V1B-HOSTED-CLOSE ===");

section("DEFAULTS");
assert(
  "new draft defaults hide unit price",
  NEW_QUOTE_DISPLAY_OPTIONS.show_quantity === true &&
    NEW_QUOTE_DISPLAY_OPTIONS.show_unit === true &&
    NEW_QUOTE_DISPLAY_OPTIONS.show_unit_price === false &&
    NEW_QUOTE_DISPLAY_OPTIONS.show_line_total === true
);
assert(
  "createQuoteFromPricing persists V1 defaults",
  actionsSrc.includes("NEW_QUOTE_DISPLAY_OPTIONS") &&
    actionsSrc.includes("persistQuoteDisplayOptions")
);

section("ISSUANCE ORDER");
assert(
  "send issues before the email provider",
  sendFn.indexOf("PREPARE_QUOTE_DELIVERY_RPC") <
    sendFn.indexOf("SEND_QUOTE_REVISION_RPC") &&
    sendFn.indexOf("SEND_QUOTE_REVISION_RPC") < sendFn.indexOf("provider.send")
);
assert(
  "simulation issues before provider submit",
  policySrc.includes("Issue / freeze before the external email API")
);

const issuedThenEmailFails = simulateQuoteSendAttempt(
  createSimulatedQuoteSendState(),
  { key: "send:v1:qa:1:fp:a@x.co", kind: "send", providerAccepts: false }
);
assert(
  "email failure after issue leaves Quote sent",
  issuedThenEmailFails.quoteStatus === "sent" &&
    issuedThenEmailFails.deliveries[0]?.status === "failed" &&
    issuedThenEmailFails.quoteSentCount === 1
);

const acceptedNeedsFinalize = simulateQuoteSendAttempt(
  createSimulatedQuoteSendState(),
  {
    key: "send:v1:qa:1:fp:a@x.co",
    kind: "send",
    providerAccepts: true,
    finalizeSucceeds: false,
  }
);
assert(
  "provider accept + finalize fail does not leave a draft Quote",
  acceptedNeedsFinalize.quoteStatus === "sent" &&
    acceptedNeedsFinalize.needsFinalize === true
);

section("NO CLIENT-VALID DRAFT");
assert(
  "draft is not a publicly viewable status",
  !isQuotePubliclyViewableStatus("draft") &&
    isQuotePubliclyViewableStatus("sent") &&
    lookupSrc.includes("if (!isQuotePubliclyViewableStatus(quote.status))")
);
assert(
  "draft cannot be accepted",
  !canClientAcceptQuote(quoteDoc({ status: "draft" })) &&
    canClientAcceptQuote(quoteDoc({ status: "sent" }))
);

section("RETRY / IDEMPOTENCY");
assert(
  "in-progress prepare waits instead of a second provider submit",
  decideQuoteSendProviderAction({ inProgress: true, skipProvider: true }) ===
    "wait"
);
const first = simulateQuoteSendAttempt(createSimulatedQuoteSendState(), {
  key: "send:v1:qa:1:fp:a@x.co",
  kind: "send",
  providerAccepts: true,
});
const retry = simulateQuoteSendAttempt(first, {
  key: "send:v1:qa:1:fp:a@x.co",
  kind: "send",
  providerAccepts: true,
});
assert(
  "retry of submitted send does not issue a second revision",
  retry.quoteSentCount === 1 &&
    retry.providerSubmitCount === 1 &&
    retry.deliveries.length === 1
);

section("SNAPSHOT A/B");
const issuedA = presentQuoteClientDocument(
  quoteDoc({
    status: "sent",
    display_options: { ...NEW_QUOTE_DISPLAY_OPTIONS },
  }),
  items
);
const issuedB = presentQuoteClientDocument(
  quoteDoc({
    id: "q-b",
    revision_number: 2,
    status: "sent",
    display_options: { ...NEW_QUOTE_DISPLAY_OPTIONS, show_unit_price: true },
  }),
  items
);
assert(
  "Quote A hides unit price",
  issuedA.display.show_unit_price === false &&
    !issuedA.columns.includes("unit_price")
);
assert(
  "Quote B shows unit price",
  issuedB.display.show_unit_price === true &&
    issuedB.columns.includes("unit_price")
);
assert(
  "issued A cannot be mutated",
  !canMutateQuoteSnapshot({
    status: "sent",
    send_lock_delivery_id: null,
    superseded_by_quote_id: null,
  })
);

section("SUMMARY / LINE-TOTAL / GRAND TOTAL");
const summary = presentQuoteClientDocument(
  quoteDoc({
    display_options: {
      show_quantity: false,
      show_unit: false,
      show_unit_price: false,
      show_line_total: true,
    },
  }),
  items
);
assert(
  "summary mode is description + line total",
  summary.columns.join(",") === "description,line_total"
);
const lineTotalOff = presentQuoteClientDocument(
  quoteDoc({
    display_options: {
      show_quantity: true,
      show_unit: true,
      show_unit_price: false,
      show_line_total: false,
    },
  }),
  items
);
assert(
  "line-total off still keeps document totals in the template",
  !lineTotalOff.columns.includes("line_total") &&
    templateSrc.includes("data-quote-document-totals") &&
    templateSrc.includes("quote.total_incl_gst")
);

section("QUANTITY / UNIT");
const qtyOff = applyQuantityUnitCoherence(NEW_QUOTE_DISPLAY_OPTIONS, {
  show_quantity: false,
});
assert("Quantity off forces Unit off", qtyOff.show_unit === false);
const qtyOnAgain = applyQuantityUnitCoherence(qtyOff, { show_quantity: true });
assert(
  "Quantity back on leaves Unit off until explicitly restored",
  qtyOnAgain.show_quantity === true && qtyOnAgain.show_unit === false
);
assert(
  "normalize refuses Unit-only display",
  normalizeQuoteDisplayOptions({
    show_quantity: false,
    show_unit: true,
    show_unit_price: false,
    show_line_total: true,
  }).show_unit === false
);

section("LEGACY / PAYLOAD / PERMISSIONS");
assert(
  "legacy fallback is full columns including unit price",
  resolveQuoteDisplayOptions({ display_options: null }).show_unit_price ===
    LEGACY_QUOTE_DISPLAY_OPTIONS.show_unit_price
);
const redacted = redactPublicQuoteItemsForDisplay(items, NEW_QUOTE_DISPLAY_OPTIONS);
assert(
  "hidden unit price is stripped from public items",
  redacted[0]?.unit_price == null && items[0]?.unit_price != null
);
assert(
  "fingerprint v1 unchanged by display options",
  QUOTE_SNAPSHOT_FINGERPRINT_VERSION === "v1" &&
    hashQuoteSnapshotFingerprint(quoteDoc(), items, null) ===
      hashQuoteSnapshotFingerprint(
        quoteDoc({
          display_options: { ...NEW_QUOTE_DISPLAY_OPTIONS, show_unit_price: true },
        }),
        items,
        null
      )
);
assert(
  "viewer cannot mutate; estimator can edit and send",
  !roleAllowsPermission("viewer", "quotes.create") &&
    roleAllowsPermission("estimator", "quotes.create") &&
    roleAllowsPermission("estimator", "quotes.send")
);

section("AUTH / MIGRATIONS / DOCS");
assert(
  "preview auth fixture protects human inboxes",
  fixtureSrc.includes("jeanluc@erccontracting.co.nz") &&
    fixtureSrc.includes("hello@erccontracting.co.nz") &&
    fixtureSrc.includes("assertSafePreviewPasswordMutation")
);
const latest = numberedMigrations().at(-1) ?? "";
assert("preview remains through 054", latest.startsWith("054_"));
assert(
  "no migration 055",
  !existsSync("supabase/migrations/055_quote_display.sql") &&
    !existsSync("supabase/migrations/055_quote_issuance.sql")
);
assert(
  "hosted send submit is a dedicated control",
  read("components/quotes/QuoteSendSheet.tsx").includes("data-quote-send-submit") &&
    read("components/quotes/QuoteAcceptSheet.tsx").includes("data-quote-accept-submit")
);
assert(
  "issued public path survives finalize-pending / refresh",
  read("components/quotes/QuoteSendSheet.tsx").includes("data-quote-public-path") &&
    read("components/quotes/QuoteSendSheet.tsx").includes("rememberPublicPath") &&
    read("components/quotes/QuoteSendSheet.tsx").includes("result.needsFinalize")
);
assert(
  "Create quote is bound to this pricing document, not another Quote on the project",
  read("app/(protected)/app/projects/[projectId]/pricing/[pricingId]/page.tsx").includes(
    "quoteSummary={quoteSummaryForDoc}"
  ) &&
    !read("app/(protected)/app/projects/[projectId]/pricing/[pricingId]/page.tsx").includes(
      "effectiveQuoteSummary"
    )
);
assert(
  "architecture documents issue-before-email and draft token rule",
  archSrc.includes("send_quote_revision_v1") &&
    archSrc.includes("Draft is never rendered as an issued Quote") &&
    archSrc.includes("Email failure after step 5 leaves the Quote **issued**")
);

if (process.exitCode) {
  console.log("\nQUOTE-DISPLAY-V1B-HOSTED-CLOSE FAILED");
} else {
  console.log("\nQUOTE-DISPLAY-V1B-HOSTED-CLOSE OK");
}
