/**
 * Manual pricing route for Work Areas without a detailed calculator.
 * Does not call paid AI or Production.
 */
import { readFileSync } from "node:fs";
import { assertOrgOwnsActiveProject } from "../lib/security/org-ownership";
import { roleAllowsPermission } from "../lib/team/permissions";
import {
  ANALYSE_JOB_TIMEOUT_USER_MESSAGE,
  NO_WORK_AREAS_ERROR,
  UNKNOWN_ANALYSIS_ERROR,
  userMessageForErrorClass,
} from "../lib/ai/analyse-job-contract";
import { workAreaTypeHasDetailedCalculator } from "../lib/estimate/calculator-availability";
import { calculateAuthoritativePricingItem } from "../lib/pricing/commercial-engine-adapter";
import { getWorkAreaCapabilityBand } from "../lib/work-areas/support-contract";
import { parseLineItemNotes } from "../lib/estimate/line-item-metadata";
import { pricingItemViewModel } from "../lib/pricing/financial-view-model";
import { mapPricingItemsToQuoteItems } from "../lib/quotes/from-pricing";
import { calculateQuoteBaseTotalsFromItems } from "../lib/quotes/base-totals";
import type { PricingItem } from "../lib/pricing/types";
import {
  MANUAL_ESTIMATE_SKIPPED_MESSAGE,
  MANUAL_PRICING_NOTICE_BODY,
  MANUAL_PRICING_NOTICE_TITLE,
  MANUAL_PRICING_QUOTE_BLOCK,
  MANUAL_WORK_AREA_LINE_MARKER,
  buildManualWorkAreaPricingItemRow,
  copyEnteredManualPrices,
  decideManualPricingHandoff,
  manualScopeSellOmitsBlankCost,
  pricingRowsForOpenManualHandoff,
  isManualPricingWorkAreaType,
  manualWorkAreaPersistence,
  partitionWorkAreasByCalculator,
  presentClientSellForUnresolvedDocument,
  unresolvedManualPricingQuoteBlock,
} from "../lib/work-areas/manual-pricing-route";

let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`ok  ${name}`);
    return;
  }
  failed += 1;
  console.error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
}

const SCOPE = "Supply and lay a 40 square metre concrete driveway, 100 mm thick.";

check("notice is the specified copy", MANUAL_PRICING_NOTICE_TITLE === "You'll price this work yourself" && MANUAL_PRICING_NOTICE_BODY.startsWith("Quotr can include this work"));
check("kitchen keeps its calculator", workAreaTypeHasDetailedCalculator("kitchen") && !isManualPricingWorkAreaType("kitchen"));
check("kitchen is not marked unsupported", getWorkAreaCapabilityBand("kitchen") !== "unsupported");
check("custom work has no calculator", !workAreaTypeHasDetailedCalculator("custom") && isManualPricingWorkAreaType("custom"));
check(
  "mixed selection keeps both areas",
  (() => {
    const split = partitionWorkAreasByCalculator([
      { type: "kitchen", id: "k" },
      { type: "custom", id: "c" },
    ]);
    return split.calculable.length === 1 && split.calculable[0]?.id === "k" && split.manual.length === 1 && split.manual[0]?.id === "c";
  })()
);

const saved = manualWorkAreaPersistence({
  name: "Concreting",
  scopeDescription: SCOPE,
});
check(
  "name and scope persist on the work area",
  saved.ok === true &&
    saved.ok &&
    saved.name === "Concreting" &&
    saved.summary === SCOPE &&
    saved.quoteDescription === SCOPE &&
    saved.type === "custom" &&
    saved.status === "confirmed"
);
check("blank scope is refused", manualWorkAreaPersistence({ name: "Concreting", scopeDescription: "  " }).ok === false);

const row = buildManualWorkAreaPricingItemRow({
  orgId: "org",
  projectId: "project",
  workAreaId: "wa",
  name: "Concreting",
  scope: SCOPE,
  sortOrder: 0,
});
const notes = String(row.notes_internal);
const parsed = parseLineItemNotes(notes);
check("unpriced notes stay Pricing Required", parsed.metadata.rateSourceType === "missing");
check("internal notes do not claim a sell authority", !notes.includes("sellAuthority") && !/benchmark/i.test(notes));
check("client description is the scope only", row.client_description === SCOPE && !String(row.client_description).includes("__quotr"));
check("manual line carries the uniqueness marker", notes.includes(MANUAL_WORK_AREA_LINE_MARKER));
check("blank sell is stored as zero pending, not a completed price", row.total_sell === 0 && row.unit_sell === null && row.quantity === 1 && row.unit === "item");

function asItem(overrides: Partial<PricingItem>): PricingItem {
  return {
    id: "item",
    org_id: "org",
    pricing_document_id: "doc",
    project_id: "project",
    work_area_id: "wa",
    source_estimate_line_item_id: null,
    component_key: null,
    item_type: "allowance",
    delivery_method: "allowance",
    internal_label: "Concreting",
    client_label: "Concreting",
    internal_description: SCOPE,
    client_description: SCOPE,
    quantity: 1,
    unit: "item",
    unit_cost: null,
    unit_sell: null,
    total_cost: 0,
    total_sell: 0,
    gross_profit: 0,
    margin_percent: 0,
    markup_percent: 0,
    visible_on_quote: true,
    optional: false,
    sort_order: 0,
    notes_internal: notes,
    notes_client: null,
    created_at: "",
    updated_at: "",
    manually_edited: false,
    orphaned: false,
    recalibration_note: null,
    calculation_mode: "lump_sum",
    productivity_rate: null,
    productivity_unit: null,
    calculated_quantity: null,
    cost_known: false,
    ...overrides,
  };
}

const unpriced = asItem({});
const unpricedView = pricingItemViewModel(unpriced);
check(
  "unpriced manual line reads Pricing required",
  unpricedView.pricingRequired === true &&
    unpricedView.totalSellFormatted === "Pricing required" &&
    !unpricedView.totalSellFormatted.includes("$0")
);
check(
  "unpriced manual line blocks the quote",
  unresolvedManualPricingQuoteBlock([unpriced]) === MANUAL_PRICING_QUOTE_BLOCK
);
check(
  "a zero document sell is not shown as a complete price",
  presentClientSellForUnresolvedDocument({
    pricingRequiredCount: 1,
    subtotalSell: 0,
    costKnown: true,
    formattedSell: "$0.00",
  }) === "Pricing required"
);
check(
  "a priced supported total stays visible beside Pricing Required lines",
  presentClientSellForUnresolvedDocument({
    pricingRequiredCount: 1,
    subtotalSell: 500,
    costKnown: false,
    formattedSell: "$500.00",
  }) === "$500.00"
);

const priced = asItem({ total_sell: 1000, unit_sell: 1000, cost_known: false });
const pricedView = pricingItemViewModel(priced);
check(
  "an entered sell is shown",
  pricedView.pricingRequired === false && pricedView.totalSellFormatted !== "Pricing required"
);
check("a priced manual line can be quoted", unresolvedManualPricingQuoteBlock([priced]) === null);

const quoteItems = mapPricingItemsToQuoteItems(
  [priced],
  new Map([["wa", "Concreting"]]),
  new Map([["wa", SCOPE]])
);
check(
  "quote shows the manual scope once, on the section",
  quoteItems.length === 1 &&
    quoteItems[0]?.label === "Concreting" &&
    quoteItems[0]?.section_title === "Concreting" &&
    quoteItems[0]?.section_description === SCOPE &&
    quoteItems[0]?.description == null &&
    quoteItems[0]?.total === 1000 &&
    quoteItems[0]?.quantity === 1 &&
    quoteItems[0]?.unit === "item"
);
const supportedLine = mapPricingItemsToQuoteItems(
  [asItem({
    id: "deck-line",
    work_area_id: "deck",
    client_label: "Decking",
    client_description: "140 mm hardwood boards",
    total_sell: 18218.38,
    quantity: 282.85,
    unit: "lm",
  })],
  new Map([["deck", "Deck"]]),
  new Map([["deck", "Supply and install the deck."]])
);
check(
  "a supported line keeps its own description",
  supportedLine[0]?.description === "140 mm hardwood boards" &&
    supportedLine[0]?.section_description === "Supply and install the deck." &&
    supportedLine[0]?.total === 18218.38 &&
    supportedLine[0]?.quantity === 282.85
);
check(
  "quote line hides internal pricing notes",
  quoteItems[0]?.description == null &&
    !String(quoteItems[0]?.section_description).includes("Pricing required") &&
    !String(quoteItems[0]?.section_description).includes("rateSourceType") &&
    !String(quoteItems[0]?.section_description).includes("sellAuthority")
);
const totals = calculateQuoteBaseTotalsFromItems(quoteItems, 15, "manual-pricing-gst");
check(
  "document GST uses the existing quote total",
  totals.ok === true &&
    totals.ok &&
    totals.totals.subtotal === 1000 &&
    totals.totals.gstAmount === 150 &&
    totals.totals.totalInclGst === 1150
);

check("viewer cannot edit projects", roleAllowsPermission("viewer", "projects.edit") === false);
check("viewer cannot edit pricing", roleAllowsPermission("viewer", "pricing.edit") === false);
check("estimator can edit projects and pricing", roleAllowsPermission("estimator", "projects.edit") && roleAllowsPermission("estimator", "pricing.edit"));

async function main() {
const crossOrg = await assertOrgOwnsActiveProject(
  {
    supabase: {
      from() {
        const api = {
          select() {
            return api;
          },
          eq() {
            return api;
          },
          is() {
            return api;
          },
          async maybeSingle() {
            return { data: null, error: null };
          },
        };
        return api;
      },
    } as never,
    orgId: "org-a",
    user: { id: "user-a" },
  },
  "project-in-another-org"
);
check(
  "cross-organisation project write is denied",
  "error" in crossOrg && crossOrg.error === "Project not found."
);

const pricingActions = readFileSync("lib/pricing/actions.ts", "utf8");
const capture = readFileSync("components/assistant/ProjectCaptureBlock.tsx", "utf8");
const notice = readFileSync("components/assistant/ManualPricingNotice.tsx", "utf8");
const prompt = readFileSync("lib/ai/brief-extraction-prompt.ts", "utf8");
check(
  "manual route uses project and pricing permissions",
  pricingActions.includes('permission: "projects.edit"') &&
    pricingActions.includes('permission: "pricing.edit"') &&
    pricingActions.includes("assertOrgOwnsActiveProject") &&
    pricingActions.includes("continueManualWorkToPricing")
);
check(
  "estimate generation skips a manual-only job",
  readFileSync("lib/assistant/actions.ts", "utf8").includes("MANUAL_ESTIMATE_SKIPPED_MESSAGE") &&
    !MANUAL_ESTIMATE_SKIPPED_MESSAGE.toLowerCase().includes("fail")
);
check(
  "no-work-area analysis is not shown as the retry failure",
  capture.includes("!manualRecovery") &&
    capture.includes('data-manual-work-area-recovery="true"') &&
    capture.includes("ManualPricingScopeForm") &&
    notice.includes("Continue with manual pricing") &&
    notice.includes("MANUAL_PRICING_NOTICE_TITLE")
);
check("extraction prompt was not extended for concreting", !prompt.includes("MANUAL_PRICING_WORK_AREA_TYPE") && !prompt.includes("standalone concreting"));
check(
  "timeout keeps retry copy and is not manual recovery",
  userMessageForErrorClass("timeout") === ANALYSE_JOB_TIMEOUT_USER_MESSAGE &&
    userMessageForErrorClass("timeout") !== NO_WORK_AREAS_ERROR &&
    ANALYSE_JOB_TIMEOUT_USER_MESSAGE.toLowerCase().includes("try again")
);
check(
  "server failure keeps retry copy and is not manual recovery",
  userMessageForErrorClass("provider_server") === UNKNOWN_ANALYSIS_ERROR &&
    userMessageForErrorClass("provider_server") !== NO_WORK_AREAS_ERROR &&
    UNKNOWN_ANALYSIS_ERROR.toLowerCase().includes("try again")
);
check(
  "only a zero-result analysis uses the manual recovery message",
  userMessageForErrorClass("no_work_areas") === NO_WORK_AREAS_ERROR &&
    userMessageForErrorClass("parse") !== NO_WORK_AREAS_ERROR
);
check(
  "a blank manual cost is omitted so the engine does not invent a margin",
  manualScopeSellOmitsBlankCost({
    originatedAsPricingRequired: true,
    totalCost: 0,
    totalSell: 1000,
  }) &&
    !manualScopeSellOmitsBlankCost({
      originatedAsPricingRequired: true,
      totalCost: 2400,
      totalSell: 3000,
    }) &&
    !manualScopeSellOmitsBlankCost({
      originatedAsPricingRequired: false,
      totalCost: 0,
      totalSell: 1000,
    })
);
const sellOnly = calculateAuthoritativePricingItem({
  calculationMode: "lump_sum",
  quantity: 1,
  unit: "item",
  totalSell: 1000,
  manualSellOverride: true,
  requestId: "manual-sell-only",
});
check(
  "sell-only lump sum keeps the entered price and an unknown cost",
  sellOnly.ok === true &&
    sellOnly.ok &&
    sellOnly.fields.totalSell === 1000 &&
    sellOnly.fields.totalCost === 0 &&
    sellOnly.fields.costKnown === false &&
    sellOnly.fields.marginPercent === 0 &&
    sellOnly.fields.grossProfit === 0
);
const knownCost = calculateAuthoritativePricingItem({
  calculationMode: "lump_sum",
  quantity: 1,
  unit: "item",
  totalCost: 800,
  totalSell: 1000,
  requestId: "manual-known-cost",
});
check(
  "an entered cost still uses the existing lump-sum margin",
  knownCost.ok === true &&
    knownCost.ok &&
    knownCost.fields.costKnown === true &&
    knownCost.fields.totalCost === 800 &&
    knownCost.fields.totalSell === 1000 &&
    knownCost.fields.marginPercent === 20
);
const manualRouteStart = pricingActions.indexOf("export async function continueManualWorkToPricing");
check(
  "null-estimate Pricing is created only on the manual route",
  manualRouteStart > 0 &&
    pricingActions.slice(manualRouteStart).includes("estimate_id: null") &&
    !pricingActions.slice(0, manualRouteStart).includes("estimate_id: null")
);
check(
  "a repeated continue reuses the same manual area and null-estimate draft",
  pricingActions.includes("claimConfirmedManualWorkArea") &&
    pricingActions.includes("claimOpenManualPricingDocument") &&
    pricingActions.includes("claimManualWorkAreaPricingLine") &&
    pricingActions.includes('.is("estimate_id", null)') &&
    pricingActions.includes('existingDoc?.status === "converted_to_quote"')
);
const claimSource = readFileSync("lib/work-areas/manual-continuation-claim.ts", "utf8");
check(
  "same manual scope is reused from the unique key",
  claimSource.includes('.eq("quote_description", row.quote_description)') &&
    claimSource.includes("isUniqueViolation")
);
const openManual = {
  id: "manual-doc",
  status: "draft",
  estimate_id: null,
  created_at: "2026-10-06T00:00:00.000Z",
};
check(
  "an open manual Pricing document receives the later supported area",
  decideManualPricingHandoff([openManual]).action === "fold_into_open"
);
check(
  "a reviewed manual document is folded and sent back for review",
  decideManualPricingHandoff([{ ...openManual, status: "reviewed" }]).action ===
    "fold_into_open" &&
    decideManualPricingHandoff([{ ...openManual, status: "reviewed" }]).action ===
      "fold_into_open"
);
const reviewed = decideManualPricingHandoff([{ ...openManual, status: "reviewed" }]);
check(
  "folding a reviewed document resets review without touching a quote",
  reviewed.action === "fold_into_open" && reviewed.action && reviewed.resetReview === true
);
check(
  "a converted manual document is not rewritten",
  decideManualPricingHandoff([{ ...openManual, status: "converted_to_quote" }]).action ===
    "new_after_quote"
);
check(
  "supported-only Pricing still creates its own document",
  decideManualPricingHandoff([
    { id: "deck-doc", status: "draft", estimate_id: "estimate-1", created_at: "2026-10-06T00:00:00.000Z" },
  ]).action === "create_new"
);
const keptPrice = copyEnteredManualPrices({
  incomingRows: [row],
  pricedItems: [{
    work_area_id: "wa",
    notes_internal: notes,
    total_sell: 1000,
    unit_sell: 1000,
    total_cost: 0,
    unit_cost: null,
    quantity: 1,
    unit: "item",
    client_description: SCOPE,
    gross_profit: 0,
    margin_percent: 0,
    markup_percent: 0,
  }],
});
check(
  "a later document copies the entered manual price",
  keptPrice[0]?.total_sell === 1000 && keptPrice[0]?.client_description === SCOPE
);
const foldedRows = pricingRowsForOpenManualHandoff({
  existingItems: [{ work_area_id: "wa", notes_internal: notes }],
  incomingRows: [
    row,
    { ...row, work_area_id: "deck", source_estimate_line_item_id: "line-1", total_sell: 18218.38 },
  ],
});
check(
  "folding keeps the priced manual line and adds the calculated line",
  foldedRows.length === 1 && foldedRows[0]?.source_estimate_line_item_id === "line-1"
);
check(
  "job plan copy no longer calls a manual area an estimate",
    readFileSync("components/assistant/job-plan/JobPlanWorkAreaCard.tsx", "utf8").includes("from this job?") &&
    readFileSync("components/assistant/job-plan/JobPlanWorkAreaCard.tsx", "utf8").includes("from this estimate?") &&
    readFileSync("components/assistant/job-plan/JobPlanPanel.tsx", "utf8").includes(
      "If Quotr cannot calculate it, describe the scope and enter your price in Pricing."
    )
);
check(
  "quote creation copies a snapshot instead of reading Pricing live",
  readFileSync("lib/quotes/actions.ts", "utf8").includes("buildQuoteSnapshotFromReviewedPricing") &&
    readFileSync("lib/quotes/actions.ts", "utf8").includes("INSERT_DRAFT_QUOTE_RPC")
);

if (failed > 0) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nmanual work area pricing checks passed");
}

void main();
