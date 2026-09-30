/**
 * UX-02C — Pricing duplication removal and final-review polish.
 *
 * Run: npx tsx scripts/verify-ux-02c-pricing-review.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

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

const decision = read("components/pricing/PricingDecisionCard.tsx");
const summary = read("components/pricing/PricingSummaryPanel.tsx");
const description = read("components/work-areas/WorkAreaQuoteDescriptionEditor.tsx");
const group = read("components/pricing/PricingGroupControl.tsx");
const header = read("components/pricing/PricingHeader.tsx");
const mobile = read("components/pricing/PricingMobileActionBar.tsx");
const workspace = read("components/pricing/PricingWorkspace.tsx");
const page = read("app/(protected)/app/projects/[projectId]/pricing/[pricingId]/page.tsx");
const actions = read("lib/pricing/actions.ts");

check(
  "commercial summary remains the full figure display",
  summary.includes('data-pricing-commercial-summary="true"') &&
    summary.includes("Direct cost") &&
    summary.includes("Expected gross margin") &&
    summary.includes("Client sell incl GST") &&
    summary.includes("lg:sticky")
);
check(
  "lower card is the final-price choice",
  decision.includes("Final client price") &&
    decision.includes("The quote will use this price.") &&
    decision.includes("Use Quotr recommendation") &&
    decision.includes("Set my own price") &&
    decision.includes("data-pricing-final-price-control") &&
    decision.includes("onApplyFinalSell")
);
check(
  "lower card does not repeat the commercial breakdown",
  !decision.includes("Direct cost") &&
    !decision.includes("data-pricing-work-area-breakdown") &&
    !decision.includes("data-pricing-gst") &&
    !decision.includes("presentPricingSectionTotals") &&
    !decision.includes("* 1.15")
);
check(
  "a different final price uses the stored margin only",
  decision.includes("data-pricing-final-price-difference") &&
    decision.includes("document.margin_percent") &&
    decision.includes("presentExpectedGrossMarginPercent")
);
check(
  "mobile summary sizes to its content and keeps the disclosure",
  summary.includes("h-auto") &&
    !summary.includes("min-h-[") &&
    summary.includes("Client sell ex GST") &&
    summary.includes("Cost, margin and GST") &&
    summary.includes("compact && view.showGst")
);
check(
  "client description actions wrap and do not auto-accept a suggestion",
  description.includes("data-pricing-client-description") &&
    description.includes("Use suggested description") &&
    description.includes("Add description") &&
    description.includes("Edit description") &&
    description.includes("flex-wrap") &&
    description.includes("A suggestion is saved only when you choose it.") &&
    description.includes("generateWorkAreaQuoteDescriptionDraft") &&
    description.includes("updateWorkAreaQuoteDescription")
);
check(
  "selection mode uses explicit wording and keeps bulk delete rules",
  group.includes("Select items") &&
    group.includes("Finish selecting") &&
    !group.includes(">Select<") &&
    workspace.includes("Select the lines to show, hide, or delete.") &&
    actions.includes("Only manually added lines can be bulk-deleted")
);
check(
  "save, review and quote actions keep their hierarchy",
  header.includes("Save changes") &&
    header.includes("hasUnsavedChanges") &&
    mobile.includes("Mark as reviewed") &&
    mobile.includes("Save changes") &&
    mobile.includes('document.status === "converted_to_quote"') &&
    mobile.includes("Open quote") === false &&
    summary.includes("CreateQuoteButton") &&
    workspace.includes("markPricingReviewed") &&
    workspace.includes("updatePricingDocument")
);
check(
  "no query, calculation or migration change",
  page.includes("getPricingWorkspaceDataWithContext") &&
    !decision.includes("supabase") &&
    !summary.includes("supabase") &&
    actions.includes("export async function applyPricingFinalSell")
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
