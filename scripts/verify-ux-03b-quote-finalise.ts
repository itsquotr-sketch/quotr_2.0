/**
 * UX-03B — Quote finalise, preview and send preparation.
 *
 * Run: npx tsx scripts/verify-ux-03b-quote-finalise.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { canIssueQuoteDelivery, canMutateQuoteSnapshot } from "../lib/quotes/transaction";

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

const workspace = read("components/quotes/QuoteWorkspace.tsx");
const page = read("app/(protected)/app/projects/[projectId]/quotes/[quoteId]/page.tsx");
const send = read("components/quotes/QuoteSendSheet.tsx");
const presentation = read("components/quotes/QuotePresentationControl.tsx");
const display = read("components/quotes/QuoteDisplayControl.tsx");
const mobile = read("components/quotes/QuoteMobileActionBar.tsx");
const actions = read("lib/quotes/actions.ts");
const summary = read("components/quotes/QuoteSummaryPanel.tsx");

check(
  "draft opens in Finalise and issued quotes open in preview",
  workspace.includes('initiallyEditable ? "review" : "preview"') &&
    workspace.includes('isEditable ? "finalise" : "details"') &&
    workspace.includes('data-quote-view-control="true"') &&
    workspace.includes('aria-selected={showReview}') &&
    workspace.includes(">Finalise") === false &&
    workspace.includes("{reviewLabel}")
);

check(
  "one editable source stays mounted across view changes",
  workspace.includes("quoteDraftRef") &&
    workspace.includes('defaultValue={quote.title}') &&
    workspace.includes('!showReview && "hidden"') &&
    workspace.split("<QuoteTemplate").length === 1
);

check(
  "client context is a warning and sending stays allowed",
  workspace.includes("data-quote-client-warning") &&
    workspace.includes("You can still send this Quote") &&
    workspace.includes("You choose the client name and email when you send.") &&
    workspace.includes("/information") &&
    canIssueQuoteDelivery("draft") === true &&
    workspace.includes('data-quote-client-warning="true"') &&
    workspace.includes('role="status"') 
);

check(
  "presentation and display rules stay presentation-only",
  presentation.includes("does not change the quote total") &&
    presentation.includes('role="radiogroup"') &&
    presentation.includes("Hidden lines") &&
    display.includes("Description cannot be turned off") &&
    display.includes("data-quote-display-control") &&
    display.includes("show_line_total")
);

check(
  "terms, work areas and snapshot totals stay in place",
  workspace.includes('id="quote-terms"') &&
    workspace.includes("aria-expanded={termsOpen}") &&
    workspace.includes("Hidden lines stay on the quote") &&
    workspace.includes("presentQuoteClientDocument") &&
    workspace.includes("quoteItemViewModel") &&
    !workspace.includes("Direct cost") &&
    !workspace.includes("Expected gross margin") &&
    summary.includes("quoteDocumentViewModel") &&
    summary.includes("Stored on this quote snapshot.")
);

check(
  "send dialog keeps the existing action and pending error behaviour",
  send.includes("sendQuoteToClient") &&
    send.includes('data-quote-send-submit="true"') &&
    send.includes('role="alert"') &&
    send.includes("disabled={isPending}") &&
    send.includes(">Client<") &&
    send.includes("Cancel") &&
    !send.includes(">Recipient<") &&
    actions.includes("export async function sendQuoteToClient")
);

check(
  "issued quotes stay immutable and revisions stay distinct",
  workspace.includes("assertQuoteSnapshotMutable") &&
    workspace.includes("Create revision") &&
    workspace.includes("This issued snapshot is not edited here") &&
    canMutateQuoteSnapshot({
      status: "accepted",
      superseded_by_quote_id: null,
      send_lock_delivery_id: null,
    }) === false
);

check(
  "mobile actions keep one primary send and no new queries",
  mobile.includes("More actions") &&
    mobile.includes("Send quote") &&
    mobile.includes("mobileNavBottomClass") &&
    workspace.includes("overflow-x-hidden") &&
    page.includes("getQuoteWorkspaceDataWithContext") &&
    !page.includes("revalidatePath") &&
    !workspace.includes("getPricingWorkspaceDataWithContext")
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
