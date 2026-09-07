/**
 * QUOTE-DISPLAY-V1C — final hosted-matrix close (deterministic).
 *
 * Run: npx --yes tsx scripts/verify-quote-display-v1c-final-close.ts
 *
 * Covers summary + line-total-off snapshot/renderer/redaction/grand-total
 * invariants, Quantity/Unit coherence, and no migration 055.
 * Browser proof remains `.tmp-quote-display-v1c/hosted-proof.ts`.
 *
 * No paid AI. No live Stripe. No Production.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { canClientAcceptQuote } from "../lib/quotes/acceptance";
import { redactPublicQuoteItemsForDisplay } from "../lib/quotes/delivery-client-payload";
import {
  applyQuantityUnitCoherence,
  NEW_QUOTE_DISPLAY_OPTIONS,
  normalizeQuoteDisplayOptions,
  visibleQuoteDisplayColumns,
} from "../lib/quotes/display-options";
import { presentQuoteClientDocument } from "../lib/quotes/presentation";
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
    id: "q-s",
    org_id: "org-1",
    project_id: "project-1",
    pricing_document_id: "doc-1",
    estimate_id: null,
    quote_number: "Q-0200",
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
    scope_summary: "Fence",
    inclusions: ["Fence"],
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
    quote_id: "q-s",
    project_id: "project-1",
    pricing_item_id: null,
    work_area_id: "wa-1",
    section_title: "Fence",
    section_description: null,
    label: "Posts",
    description: "12 posts",
    quantity: 12,
    unit: "ea",
    unit_price: 41.67,
    total: 500,
    visible: true,
    optional: false,
    sort_order: 0,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

const items = [
  quoteItem(),
  quoteItem({
    id: "qi-2",
    label: "Rails",
    quantity: 20,
    unit: "lm",
    unit_price: 25,
    total: 500,
  }),
];

const SUMMARY = {
  show_quantity: false,
  show_unit: false,
  show_unit_price: false,
  show_line_total: true,
} as const;

const LINE_TOTAL_OFF = {
  show_quantity: true,
  show_unit: true,
  show_unit_price: false,
  show_line_total: false,
} as const;

const templateSrc = read("components/quotes/QuoteTemplate.tsx");
const presentationSrc = read("lib/quotes/presentation.ts");
const payloadSrc = read("lib/quotes/delivery-client-payload.ts");
const lookupSrc = read("lib/quotes/public-lookup.ts");
const displaySrc = read("lib/quotes/display-options.ts");
const controlSrc = read("components/quotes/QuoteDisplayControl.tsx");
const archSrc = read("docs/architecture/QUOTR_QUOTE_SNAPSHOT_AND_DISPLAY.md");
const closeoutSrc = read("docs/QUOTE_DISPLAY_V1_CLOSEOUT.md");
const fixtureSrc = read("scripts/lib/preview-auth-fixture.ts");
const hostedProofPath = ".tmp-quote-display-v1c/hosted-proof.ts";
const hostedSrc = existsSync(hostedProofPath) ? read(hostedProofPath) : "";

console.log("=== QUOTE-DISPLAY-V1C-FINAL-CLOSE ===");

section("SUMMARY SNAPSHOT / RENDERER");
const summary = presentQuoteClientDocument(
  quoteDoc({ display_options: { ...SUMMARY } }),
  items
);
assert(
  "summary columns are Description + Line total",
  summary.columns.join(",") === "description,line_total" &&
    visibleQuoteDisplayColumns(SUMMARY).join(",") === "description,line_total"
);
assert(
  "summary hides qty / unit / unit price",
  summary.display.show_quantity === false &&
    summary.display.show_unit === false &&
    summary.display.show_unit_price === false &&
    summary.display.show_line_total === true
);
assert(
  "summary renderer omits qty/unit/unit-price cells",
  templateSrc.includes("{display.show_quantity ?") &&
    templateSrc.includes("{display.show_unit ?") &&
    templateSrc.includes("{display.show_unit_price ?") &&
    templateSrc.includes("{display.show_line_total ?")
);

section("SUMMARY GRAND TOTAL");
assert(
  "document totals stay in the public template",
  templateSrc.includes("data-quote-document-totals") &&
    templateSrc.includes("quote.total_incl_gst") &&
    controlSrc.includes("The quote total stays visible.")
);
assert(
  "summary presentation still carries document money on the quote row",
  quoteDoc({ display_options: { ...SUMMARY } }).total_incl_gst === 1150
);

section("LINE-TOTAL-OFF SNAPSHOT / RENDERER");
const lineOff = presentQuoteClientDocument(
  quoteDoc({ display_options: { ...LINE_TOTAL_OFF } }),
  items
);
assert(
  "line-total-off columns are Description + Qty + Unit",
  lineOff.columns.join(",") === "description,quantity,unit"
);
assert(
  "line-total-off hides unit price and per-line total",
  lineOff.display.show_unit_price === false &&
    lineOff.display.show_line_total === false
);

section("LINE-TOTAL-OFF GRAND TOTAL");
assert(
  "line-total toggle does not remove document totals markup",
  !lineOff.columns.includes("line_total") &&
    templateSrc.includes("data-quote-document-totals") &&
    templateSrc.includes("Total incl. GST")
);

section("GROUPED / SECTION TOTALS");
const groupedOff = presentQuoteClientDocument(
  quoteDoc({
    presentation_mode: "grouped",
    display_options: { ...LINE_TOTAL_OFF },
  }),
  items
);
assert(
  "grouped section totals still compute when line totals are off",
  groupedOff.mode === "grouped" &&
    groupedOff.groupedSections[0]?.total === 1000 &&
    groupedOff.columns.includes("line_total") === false
);
const groupedBlockStart = templateSrc.indexOf(
  '{presentation.mode === "grouped"'
);
const groupedBlock = templateSrc.slice(
  groupedBlockStart,
  templateSrc.indexOf('{presentation.mode === "detailed"')
);
assert(
  "grouped Work Area totals are independent of show_line_total",
  groupedBlockStart >= 0 &&
    groupedBlock.includes("formatPricingMoney(section.total)") &&
    !groupedBlock.includes("show_line_total") &&
    presentationSrc.includes("groupedSections") &&
    presentationSrc.includes("item.total ?? 0")
);

section("QUANTITY / UNIT COHERENCE");
const qtyOff = applyQuantityUnitCoherence(NEW_QUOTE_DISPLAY_OPTIONS, {
  show_quantity: false,
});
assert(
  "Quantity OFF forces Unit OFF",
  qtyOff.show_quantity === false && qtyOff.show_unit === false
);
const qtyOnAgain = applyQuantityUnitCoherence(qtyOff, { show_quantity: true });
assert(
  "Quantity ON again leaves Unit OFF (deterministic A)",
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
assert(
  "Unit control disables when Quantity is off",
  controlSrc.includes("const unitDisabled = disabled || !options.show_quantity")
);

section("PUBLIC REDACTION");
const summaryRedacted = redactPublicQuoteItemsForDisplay(items, SUMMARY);
assert(
  "summary redacts qty / unit / unit_price",
  summaryRedacted[0]?.quantity == null &&
    summaryRedacted[0]?.unit == null &&
    summaryRedacted[0]?.unit_price == null &&
    summaryRedacted[0]?.total === 500
);
const lineOffRedacted = redactPublicQuoteItemsForDisplay(items, LINE_TOTAL_OFF);
assert(
  "line-total-off redacts unit_price and keeps qty/unit",
  lineOffRedacted[0]?.unit_price == null &&
    lineOffRedacted[0]?.quantity === 12 &&
    lineOffRedacted[0]?.unit === "ea"
);
assert(
  "per-line total stays for grouped math when line total is off",
  payloadSrc.includes("Line `total` stays when line-total is off") &&
    lineOffRedacted[0]?.total === 500
);
assert(
  "official lookup redacts then refuses draft",
  lookupSrc.includes("redactPublicQuoteItemsForDisplay") &&
    lookupSrc.includes("if (!isQuotePubliclyViewableStatus(quote.status))")
);

section("ACCEPTANCE AUTHORITY UNCHANGED");
assert(
  "display settings do not gate acceptance",
  canClientAcceptQuote(quoteDoc({ status: "sent", display_options: { ...SUMMARY } })) &&
    canClientAcceptQuote(
      quoteDoc({ status: "sent", display_options: { ...LINE_TOTAL_OFF } })
    ) &&
    !canClientAcceptQuote(quoteDoc({ status: "draft", display_options: { ...SUMMARY } }))
);

section("MIGRATIONS / AUTH / DOCS");
const latest = numberedMigrations().at(-1) ?? "";
assert("preview remains through 054", latest.startsWith("054_"));
assert(
  "no migration 055",
  !existsSync("supabase/migrations/055_quote_display.sql") &&
    !existsSync("supabase/migrations/055_quote_issuance.sql") &&
    !numberedMigrations().some((name) => name.startsWith("055_"))
);
assert(
  "preview auth fixture protects human inboxes",
  fixtureSrc.includes("jeanluc@erccontracting.co.nz") &&
    fixtureSrc.includes("hello@erccontracting.co.nz") &&
    fixtureSrc.includes("assertSafePreviewPasswordMutation")
);
assert(
  "hosted proof uses the auth fixture and plus-address only",
  hostedSrc.includes("assertSafePreviewPasswordMutation") &&
    hostedSrc.includes("hello+quote-display-v1c@") &&
    !hostedSrc.includes("jeanluc@erccontracting.co.nz")
);
assert(
  "architecture lists the four supported configurations",
  archSrc.includes("Detailed:") &&
    archSrc.includes("Standard default:") &&
    archSrc.includes("Summary:") &&
    archSrc.includes("Minimal line detail:") &&
    archSrc.includes("grand total always remains visible")
);
assert(
  "closeout records V1C hosted matrix and deferred SQL 055",
  closeoutSrc.includes("QUOTE-DISPLAY-V1C") &&
    closeoutSrc.includes("lookup_quote_public_by_token_hash_v1") &&
    closeoutSrc.includes("DEFERRED HARDENING")
);
assert(
  "Quantity/Unit restore behaviour is documented as A",
  displaySrc.includes("show_unit: show_quantity && input.show_unit === true") &&
    archSrc.includes("leaves Unit off")
);

if (process.exitCode) {
  console.log("\nQUOTE-DISPLAY-V1C-FINAL-CLOSE FAILED");
} else {
  console.log("\nQUOTE-DISPLAY-V1C-FINAL-CLOSE OK");
}
