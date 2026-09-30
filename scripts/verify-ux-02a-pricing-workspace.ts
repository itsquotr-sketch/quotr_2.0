/**
 * UX-02A — Pricing workspace structure and commercial summary.
 *
 * Run: npx tsx scripts/verify-ux-02a-pricing-workspace.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pricingDocumentViewModel, pricingItemViewModel } from "../lib/pricing/financial-view-model";
import type { PricingDocument, PricingItem } from "../lib/pricing/types";

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

const page = read("app/(protected)/app/projects/[projectId]/pricing/[pricingId]/page.tsx");
const workspace = read("components/pricing/PricingWorkspace.tsx");
const summary = read("components/pricing/PricingSummaryPanel.tsx");
const readiness = read("components/pricing/PricingReadiness.tsx");
const section = read("components/pricing/PricingWorkAreaSection.tsx");
const header = read("components/pricing/PricingHeader.tsx");
const actions = read("lib/pricing/actions.ts");
const viewModel = read("lib/pricing/financial-view-model.ts");

const unknownItem = {
  notes_internal: null,
  cost_known: false,
  total_sell: 0,
  total_cost: 0,
  gross_profit: 0,
  margin_percent: 0,
  markup_percent: 0,
  manually_edited: false,
} as PricingItem;

const document = {
  subtotal_cost: 0,
  subtotal_sell: 0,
  gross_profit: 0,
  margin_percent: 0,
  markup_percent: 0,
  gst_rate: 15,
  gst_amount: 0,
  total_incl_gst: 0,
} as PricingDocument;

check(
  "1 commercial figures use the existing view model",
  summary.includes("pricingDocumentViewModel(document)") &&
    summary.includes("view.subtotalSellFormatted") &&
    summary.includes("view.totalInclGstFormatted") &&
    summary.includes("view.marginLabel") &&
    viewModel.includes("does not recalculate money") &&
    !summary.includes("recalculateSellFromCost") &&
    !summary.includes("* 1.15")
);
check(
  "2 unknown money stays Pricing required",
  pricingItemViewModel(unknownItem).pricingRequired === true &&
    pricingItemViewModel(unknownItem).totalSellFormatted === "Pricing required" &&
    summary.includes('"Pricing required"') &&
    section.includes('"Pricing required"') &&
    readiness.includes("Pricing required")
);
check(
  "3 no calculation duplication or new query",
  !workspace.includes("fetch(") &&
    !summary.includes("fetch(") &&
    !readiness.includes("fetch(") &&
    !section.includes("router.refresh") &&
    page.includes("getPricingWorkspaceDataWithContext(auth, projectId, pricingId)") &&
    page.includes("getQuoteSummaryForPricingDocument(pricingId)") &&
    !page.includes("revalidatePath") &&
    actions.includes("export async function markPricingReviewed") &&
    actions.includes("export async function updatePricingItem")
);
check(
  "4 one review action and the existing quote action",
  workspace.includes("<PricingReviewChecklist") &&
    workspace.includes("onMarkReviewed={handleMarkReviewed}") &&
    summary.includes("Next: Create quote") &&
    summary.includes("<CreateQuoteButton") &&
    workspace.includes('className="hidden md:block"')
);
check(
  "5 readiness uses existing document states",
  readiness.includes('document.status === "archived"') &&
    readiness.includes('document.status === "converted_to_quote"') &&
    readiness.includes('document.status === "reviewed"') &&
    readiness.includes("latestEstimateIsStale") &&
    readiness.includes("data-pricing-readonly-reason") &&
    readiness.includes("/quotes/")
);
check(
  "6 Work Areas keep stored grouping and disclosure",
  workspace.includes('useState<PricingGroupBy>("work_area")') &&
    workspace.includes("groupPricingItems") &&
    section.includes("useState(false)") &&
    section.includes("aria-expanded={expanded}") &&
    section.includes("Direct cost") &&
    section.includes("Client sell") &&
    section.includes("min-h-11")
);
check(
  "7 stale, reviewed and converted stay explained",
  readiness.includes("Previous estimate") &&
    workspace.includes("data-pricing-reviewed-status") &&
    workspace.includes("<RecalibrationBanner") &&
    header.includes("statusNote") &&
    !header.includes("{projectTitle}")
);
check(
  "8 routes and compact mobile structure stay",
  page.includes('activeTab="pricing"') &&
    summary.includes("lg:sticky") &&
    summary.includes('className="md:hidden"') === false &&
    workspace.includes('className="md:hidden"') &&
    workspace.includes("overflow-x-hidden") &&
    workspace.includes("PricingMobileActionBar") &&
    !workspace.includes("overflow-x-auto")
);
check(
  "9 stored document view model still formats money",
  typeof pricingDocumentViewModel(document).subtotalSellFormatted === "string" &&
    summary.includes("tabular-nums") &&
    summary.includes("Expected gross margin") &&
    summary.includes("Client sell incl GST")
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
