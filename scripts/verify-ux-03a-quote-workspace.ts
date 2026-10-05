/**
 * UX-03A — Quote workspace hierarchy and document review.
 *
 * Run: npx tsx scripts/verify-ux-03a-quote-workspace.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { quoteDocumentViewModel } from "../lib/quotes/financial-view-model";
import { canMutateQuoteSnapshot } from "../lib/quotes/transaction";
import type { Quote } from "../lib/quotes/types";

const root = join(__dirname, "..");
let passed = 0;
let failed = 0;

function check(name: string, ok: boolean): void {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}`);
  }
}

function read(path: string): string {
  return readFileSync(join(root, path), "utf8").replaceAll("\r", "");
}

const page = read("app/(protected)/app/projects/[projectId]/quotes/[quoteId]/page.tsx");
const workspace = read("components/quotes/QuoteWorkspace.tsx");
const summary = read("components/quotes/QuoteSummaryPanel.tsx");
const header = read("components/quotes/QuoteHeader.tsx");
const template = read("components/quotes/QuoteTemplate.tsx");
const viewModel = read("lib/quotes/financial-view-model.ts");
const nav = read("components/projects/ProjectSectionHeader.tsx");
const actions = read("lib/quotes/actions.ts");

const snapshot = {
  status: "sent",
  revision_number: 1,
  superseded_by_quote_id: null,
  subtotal: 100,
  gst_rate: 15,
  gst_amount: 15,
  total_incl_gst: 115,
} as Quote;

const view = quoteDocumentViewModel(snapshot);

check(
  "quote figures come from the stored snapshot view model",
  view.subtotalFormatted.includes("100") &&
    view.totalInclGstFormatted.includes("115") &&
    viewModel.includes("Never recalculates") &&
    summary.includes("quoteDocumentViewModel") &&
    !summary.includes("pricingDocumentViewModel")
);
check(
  "the page still loads the existing quote workspace query",
  page.includes("getQuoteWorkspaceDataWithContext") &&
    !workspace.includes("getPricingWorkspaceDataWithContext") &&
    !workspace.includes("* 1.15")
);
check(
  "one commercial summary and no internal cost or margin",
  summary.includes('data-quote-commercial-summary="true"') &&
    summary.includes("Price ex GST") &&
    summary.includes("Total incl. GST") &&
    !summary.includes("Direct cost") &&
    !summary.includes("Expected gross margin") &&
    !template.includes("Expected gross margin") &&
    workspace.includes('data-quote-commercial-summary="true"') === false
);
check(
  "lifecycle and immutability stay on the existing rules",
  workspace.includes("canMutateQuoteSnapshot") &&
    workspace.includes("assertQuoteSnapshotMutable") &&
    workspace.includes("data-quote-readonly-reason") &&
    canMutateQuoteSnapshot({
      status: "sent",
      superseded_by_quote_id: null,
      send_lock_delivery_id: null,
    }) === false &&
    canMutateQuoteSnapshot({
      status: "draft",
      superseded_by_quote_id: null,
      send_lock_delivery_id: null,
    }) === true
);
check(
  "send, share, download and acceptance actions remain",
  workspace.includes("QuoteSendSheet") &&
    workspace.includes("Print / Save as PDF") &&
    workspace.includes("data-quote-send-success") &&
    workspace.includes("markQuoteAccepted") &&
    summary.includes("Send quote") &&
    summary.includes("Resend quote")
);
check(
  "Variations stay outside the four primary stages",
  nav.includes('title="Project information"') &&
    nav.includes('title="Estimate"') &&
    nav.includes('title="Pricing"') &&
    nav.includes('title="Quote"') &&
    nav.includes('data-project-section-columns="four"') &&
    nav.includes("data-project-variations-row") &&
    nav.includes("Separate from Quote") &&
    nav.includes("data-quote-variations-control")
);
check(
  "one primary action follows the existing status",
  /<h2[^>]*>\s*Quote\s*<\/h2>/.test(header) &&
    !header.includes("<h1") &&
    header.includes("text-lg font-semibold leading-6 tracking-tight sm:text-xl") &&
    header.includes("statusDef.label") &&
    header.includes("hasUnsavedChanges") &&
    page.includes("<ProjectWorkspaceHeader") &&
    read("components/projects/ProjectHeader.tsx").includes(
      '<h1 className="min-w-0 text-lg font-semibold tracking-tight break-words sm:text-xl">'
    ) &&
    summary.includes("Send quote") &&
    workspace.includes("overflow-x-hidden") &&
    template.includes("data-quote-work-area") &&
    template.includes("overflow-x-hidden") &&
    !template.includes("overflow-x-auto")
);
check(
  "no new quote query, revalidation or migration",
  actions.includes("export async function updateQuote") &&
    actions.includes("reviseQuoteFromFinalPricing") &&
    !page.includes("revalidatePath") 
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
