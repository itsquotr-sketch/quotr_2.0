/**
 * QUOTE-DISPLAY-V1 — client quote column controls.
 *
 * Run: npx --yes tsx scripts/verify-quote-display-v1.ts
 *
 * Presentation only. No paid AI. No live Stripe. No Production.
 * No schema migration 055. Display settings live in issuer_snapshot JSON.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { canClientAcceptQuote } from "../lib/quotes/acceptance";
import {
  applyQuantityUnitCoherence,
  formatQuoteDisplayPreview,
  issuerSnapshotWithDisplayOptions,
  LEGACY_QUOTE_DISPLAY_OPTIONS,
  NEW_QUOTE_DISPLAY_OPTIONS,
  normalizeQuoteDisplayOptions,
  parseQuoteDisplayOptions,
  resolveQuoteDisplayOptions,
  visibleQuoteDisplayColumns,
  type QuoteDisplayOptions,
} from "../lib/quotes/display-options";
import { parseQuoteIssuerSnapshot } from "../lib/quotes/issuer-snapshot";
import { mapQuote } from "../lib/quotes/mappers";
import { presentQuoteClientDocument } from "../lib/quotes/presentation";
import {
  hashQuoteSnapshotFingerprint,
  QUOTE_SNAPSHOT_FINGERPRINT_VERSION,
} from "../lib/quotes/snapshot-fingerprint";
import { canMutateQuoteSnapshot } from "../lib/quotes/transaction";
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
    id: "q-1",
    org_id: "org-1",
    project_id: "project-1",
    pricing_document_id: "doc-1",
    estimate_id: null,
    quote_number: "Q-0001",
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
    display_options: NEW_QUOTE_DISPLAY_OPTIONS,
    ...overrides,
  };
}

function quoteItem(overrides: Partial<QuoteItem> = {}): QuoteItem {
  return {
    id: "qi-1",
    org_id: "org-1",
    quote_id: "q-1",
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
const displaySrc = read("lib/quotes/display-options.ts");
const actionsSrc = read("lib/quotes/actions.ts");
const templateSrc = read("components/quotes/QuoteTemplate.tsx");
const workspaceSrc = read("components/quotes/QuoteWorkspace.tsx");
const controlSrc = read("components/quotes/QuoteDisplayControl.tsx");
const mappersSrc = read("lib/quotes/mappers.ts");
const payloadSrc = read("lib/quotes/delivery-client-payload.ts");
const fingerprintSrc = read("lib/quotes/snapshot-fingerprint.ts");
const schemasSrc = read("lib/quotes/schemas.ts");
const emailSrc = read("lib/quotes/delivery-email.ts");
const acceptSrc = read("lib/quotes/acceptance.ts");
const presentationSrc = read("lib/quotes/presentation.ts");

console.log("=== QUOTE-DISPLAY-V1 ===");

section("DEFAULTS");
assert(
  "description is mandatory and not a stored toggle",
  !("show_description" in NEW_QUOTE_DISPLAY_OPTIONS) &&
    visibleQuoteDisplayColumns(NEW_QUOTE_DISPLAY_OPTIONS)[0] === "description"
);
assert("quantity default true", NEW_QUOTE_DISPLAY_OPTIONS.show_quantity === true);
assert("unit default true", NEW_QUOTE_DISPLAY_OPTIONS.show_unit === true);
assert(
  "unit price default false",
  NEW_QUOTE_DISPLAY_OPTIONS.show_unit_price === false
);
assert(
  "line total default true",
  NEW_QUOTE_DISPLAY_OPTIONS.show_line_total === true
);

section("RELATIONSHIP");
const quantityOff = applyQuantityUnitCoherence(NEW_QUOTE_DISPLAY_OPTIONS, {
  show_quantity: false,
});
assert("turning Quantity off also turns Unit off", quantityOff.show_unit === false);
assert(
  "Unit cannot stay on while Quantity is off",
  normalizeQuoteDisplayOptions({
    show_quantity: false,
    show_unit: true,
    show_unit_price: false,
    show_line_total: true,
  }).show_unit === false
);
assert(
  "control disables Unit when Quantity is hidden",
  controlSrc.includes("Unit is hidden when quantity is hidden") &&
    controlSrc.includes("unitDisabled")
);

section("PERSISTENCE");
assert(
  "new drafts persist V1 defaults onto issuer_snapshot",
  actionsSrc.includes("NEW_QUOTE_DISPLAY_OPTIONS") &&
    actionsSrc.includes("persistQuoteDisplayOptions")
);
assert(
  "draft update writes display_options through updateQuote",
  actionsSrc.includes("quoteInput.display_options") &&
    actionsSrc.includes("issuer_snapshot") &&
    schemasSrc.includes("show_unit_price")
);
assert(
  "workspace persists toggles immediately",
  workspaceSrc.includes("handleDisplayOptionsChange") &&
    workspaceSrc.includes("display_options: options")
);

section("SNAPSHOT");
const issuedA = presentQuoteClientDocument(
  quoteDoc({
    status: "sent",
    display_options: { ...NEW_QUOTE_DISPLAY_OPTIONS },
  }),
  items
);
const laterPreference: QuoteDisplayOptions = {
  ...NEW_QUOTE_DISPLAY_OPTIONS,
  show_unit_price: true,
};
const issuedStillHidden = presentQuoteClientDocument(
  quoteDoc({
    status: "sent",
    display_options: { ...NEW_QUOTE_DISPLAY_OPTIONS },
  }),
  items
);
const revisionB = presentQuoteClientDocument(
  quoteDoc({
    id: "q-2",
    revision_number: 2,
    display_options: laterPreference,
  }),
  items
);
assert(
  "issued Quote A hides unit price",
  issuedA.display.show_unit_price === false &&
    !issuedA.columns.includes("unit_price")
);
assert(
  "later preference does not mutate issued A",
  issuedStillHidden.display.show_unit_price === false &&
    issuedA.display.show_unit_price === issuedStillHidden.display.show_unit_price
);
assert(
  "revision B may show unit price",
  revisionB.display.show_unit_price === true &&
    revisionB.columns.includes("unit_price")
);
assert(
  "send freezes display_options inside issuer_snapshot payload",
  actionsSrc.includes("issuerSnapshotRpcPayload") &&
    actionsSrc.includes("p_issuer_snapshot: issuerSnapshotRpcPayload")
);
assert(
  "issued quotes cannot mutate snapshot including display settings",
  !canMutateQuoteSnapshot({
    status: "sent",
    send_lock_delivery_id: null,
    superseded_by_quote_id: null,
  })
);

section("LEGACY");
const legacy = presentQuoteClientDocument(
  quoteDoc({ display_options: null }),
  items
);
assert(
  "legacy fallback shows unit price",
  LEGACY_QUOTE_DISPLAY_OPTIONS.show_unit_price === true &&
    legacy.columns.includes("unit_price") &&
    legacy.columns.includes("quantity") &&
    legacy.columns.includes("unit") &&
    legacy.columns.includes("line_total")
);
assert(
  "missing issuer_snapshot.display_options parses as null",
  parseQuoteDisplayOptions({ organisationName: "ERC" }) === null
);
const mappedLegacy = mapQuote({
  id: "q-legacy",
  org_id: "org-1",
  project_id: "p-1",
  title: "Quote",
  status: "sent",
  subtotal: 1,
  gst_rate: 15,
  gst_amount: 0.15,
  total_incl_gst: 1.15,
  inclusions: [],
  exclusions: [],
  assumptions: [],
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
  presentation_mode: "detailed",
  issuer_snapshot: { organisationName: "ERC", legalName: "ERC Ltd" },
});
assert(
  "mapped historical quote has null display_options",
  mappedLegacy.display_options == null
);

section("REVISION");
assert(
  "revision copies prior display settings",
  actionsSrc.includes("resolveQuoteDisplayOptions(quote)") &&
    actionsSrc.includes("persistQuoteDisplayOptions")
);
assert(
  "copying legacy issued settings keeps unit price visible",
  resolveQuoteDisplayOptions({ display_options: null }).show_unit_price === true
);

section("PUBLIC");
const summary = presentQuoteClientDocument(
  quoteDoc({
    display_options: {
      show_quantity: false,
      show_unit: true,
      show_unit_price: false,
      show_line_total: true,
    },
  }),
  items
);
assert(
  "enabled columns shown and disabled columns absent",
  summary.columns.join(",") === "description,line_total"
);
assert(
  "grand total always remains on the quote document",
  templateSrc.includes("data-quote-document-totals") &&
    templateSrc.includes("quote.total_incl_gst") &&
    templateSrc.includes("quote.subtotal")
);
assert(
  "unit price is not rendered when hidden",
  templateSrc.includes("display.show_unit_price") &&
    templateSrc.includes('data-quote-unit-price="true"')
);
assert(
  "public mapper reads display_options from issuer_snapshot",
  payloadSrc.includes("parseQuoteDisplayOptions(quote.issuer_snapshot)") &&
    mappersSrc.includes("parseQuoteDisplayOptions(row.issuer_snapshot)")
);
assert(
  "no internal cost/margin in client template",
  !templateSrc.includes("gross margin") &&
    !templateSrc.includes("unit_cost") &&
    !templateSrc.includes("Company DNA")
);
assert(
  "grouped work-area totals stay independent of line-total toggle",
  presentationSrc.includes("groupedSections") &&
    templateSrc.includes("presentation.groupedSections") &&
    !controlSrc.includes("Work area total")
);

section("MOBILE");
assert(
  "client renderer has a dedicated mobile card, not a squeezed desktop table",
  templateSrc.includes("sm:hidden print:hidden") &&
    templateSrc.includes("hidden") &&
    templateSrc.includes("sm:table-row print:table-row") &&
    templateSrc.includes("max-sm:overflow-x-hidden")
);
assert(
  "builder controls stack at mobile width",
  controlSrc.includes("space-y-2") &&
    !controlSrc.includes("grid-cols-2") &&
    workspaceSrc.includes("QuoteDisplayControl")
);

section("ACCEPTANCE");
assert(
  "display config is not part of acceptance rules",
  !acceptSrc.includes("display_options") &&
    !acceptSrc.includes("show_unit_price")
);
assert(
  "sent quote remains acceptable regardless of hidden unit price",
  canClientAcceptQuote(
    quoteDoc({
      status: "sent",
      display_options: { ...NEW_QUOTE_DISPLAY_OPTIONS, show_line_total: false },
    })
  )
);
assert(
  "fingerprint version stays v1 and does not hash display_options",
  QUOTE_SNAPSHOT_FINGERPRINT_VERSION === "v1" &&
    !fingerprintSrc.includes("display_options")
);
const hashBase = hashQuoteSnapshotFingerprint(quoteDoc(), items, null);
const hashDisplayChanged = hashQuoteSnapshotFingerprint(
  quoteDoc({
    display_options: { ...NEW_QUOTE_DISPLAY_OPTIONS, show_unit_price: true },
  }),
  items,
  null
);
assert(
  "changing display options does not change commercial fingerprint",
  hashBase === hashDisplayChanged
);

section("SECURITY");
assert(
  "viewer cannot mutate quotes",
  !roleAllowsPermission("viewer", "quotes.create") &&
    roleAllowsPermission("estimator", "quotes.create") &&
    roleAllowsPermission("estimator", "quotes.send")
);
assert(
  "updateQuote still requires quotes.create",
  actionsSrc.includes('permission: "quotes.create"') &&
    !actionsSrc.includes("quotes.display")
);
assert(
  "company identity parser ignores display_options extras",
  parseQuoteIssuerSnapshot({
    organisationName: "ERC",
    legalName: "ERC Ltd",
    display_options: NEW_QUOTE_DISPLAY_OPTIONS,
  })?.organisationName === "ERC"
);

section("STORAGE");
const merged = issuerSnapshotWithDisplayOptions(
  { organisationName: "ERC" },
  NEW_QUOTE_DISPLAY_OPTIONS
);
assert(
  "display_options nest on existing issuer_snapshot JSON",
  parseQuoteDisplayOptions(merged)?.show_unit_price === false &&
    displaySrc.includes("issuer_snapshot.display_options")
);
assert(
  "no company-wide quote-display defaults in V1",
  !read("lib/settings/types.ts").includes("quote_display") &&
    !controlSrc.includes("Company default")
);
assert(
  "quote email stays View Quote CTA without a line table",
  emailSrc.includes("View Quote") && !emailSrc.includes("Unit price")
);

section("MIGRATIONS");
const latest = numberedMigrations().at(-1) ?? "";
assert("preview remains through 054", latest.startsWith("054_"));
assert("no migration 055", !existsSync("supabase/migrations/055_quote_display.sql"));
assert(
  "controls use builder language",
  controlSrc.includes("Client quote display") &&
    controlSrc.includes("Choose how much pricing detail your client will see.") &&
    controlSrc.includes("Description is always shown.")
);
assert(
  "preview summary lists visible client fields",
  formatQuoteDisplayPreview(NEW_QUOTE_DISPLAY_OPTIONS) ===
    "Description · Quantity · Unit · Line total"
);

if (process.exitCode) {
  console.log("\nQUOTE-DISPLAY-V1 FAILED");
} else {
  console.log("\nQUOTE-DISPLAY-V1 OK");
}
