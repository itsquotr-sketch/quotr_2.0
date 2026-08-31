/**
 * COMMERCIAL-UX-01 helpers: grouping, calculation details, narrative filter.
 * Does not restamp economic goldens.
 *
 * Run: npx tsx scripts/verify-commercial-ux-01.ts
 */
import { buildPricingCalculationDetails } from "../lib/pricing/calculation-details";
import {
  groupPricingItems,
  isManuallyAddedPricingItem,
} from "../lib/pricing/grouping";
import type { PricingItem, PricingWorkArea } from "../lib/pricing/types";
import { readFileSync } from "node:fs";
import { calculateQuoteBaseTotalsFromItems } from "../lib/quotes/base-totals";
import { filterClientFacingNarrative } from "../lib/quotes/client-narrative";
import { sanitizeClientNarrativeBlock } from "../lib/quotes/client-narrative";
import { isInternalClientNarrative } from "../lib/quotes/client-narrative";
import { resolveClientQuoteAssumptions } from "../lib/quotes/client-fields";
import { mapPricingItemsToQuoteItems } from "../lib/quotes/from-pricing";
import { mapQuote } from "../lib/quotes/mappers";
import { calculateAuthoritativeQuoteTotals } from "../lib/quotes/quote-commercial-engine-adapter";
import {
  groupedSectionLabel,
  lumpSumScopeNarrative,
  parseQuotePresentationMode,
  presentQuoteClientDocument,
} from "../lib/quotes/presentation";
import type { Quote, QuoteItem } from "../lib/quotes/types";
import type { OrgQuoteDefaults } from "../lib/settings/types";

function assert(label: string, ok: boolean) {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) process.exitCode = 1;
}

function item(overrides: Partial<PricingItem>): PricingItem {
  return {
    id: "item-1",
    org_id: "org-1",
    pricing_document_id: "doc-1",
    project_id: "project-1",
    work_area_id: "wa-deck",
    source_estimate_line_item_id: "est-1",
    component_key: null,
    item_type: "material",
    delivery_method: "in_house",
    internal_label: "Decking",
    client_label: "Decking",
    internal_description: null,
    client_description: null,
    quantity: 117.9,
    unit: "lm",
    unit_cost: 16.5,
    unit_sell: 18.15,
    total_cost: 1945.35,
    total_sell: 2139.89,
    gross_profit: 194.54,
    margin_percent: 9.09,
    markup_percent: 10,
    visible_on_quote: true,
    optional: false,
    sort_order: 0,
    notes_internal: null,
    notes_client: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    manually_edited: false,
    orphaned: false,
    recalibration_note: null,
    calculation_mode: "quantity_rate",
    productivity_rate: null,
    productivity_unit: null,
    calculated_quantity: null,
    cost_known: true,
    ...overrides,
  };
}

const workAreas: PricingWorkArea[] = [
  {
    id: "wa-deck",
    name: "Deck",
    type: "deck",
    sort_order: 0,
    quote_description: "Supply and construct deck.",
  },
];

const items: PricingItem[] = [
  item({ id: "m1", item_type: "material", sort_order: 1 }),
  item({
    id: "l1",
    item_type: "labour",
    calculation_mode: "productivity_labour",
    quantity: 107.1,
    unit: "lm",
    productivity_rate: 0.077,
    productivity_unit: "lm",
    calculated_quantity: 8.25,
    unit_cost: 95,
    unit_sell: 110,
    total_cost: 783.75,
    total_sell: 907.5,
    sort_order: 2,
  }),
  item({
    id: "e1",
    item_type: "equipment",
    client_label: "Scaffold",
    work_area_id: "wa-deck",
    sort_order: 3,
  }),
  item({
    id: "manual-1",
    source_estimate_line_item_id: null,
    item_type: "allowance",
    client_label: "Manual allowance",
    sort_order: 4,
  }),
];

console.log("--- Grouping is view-state only ---");
const byArea = groupPricingItems(items, workAreas, "work_area");
assert("work area grouping keeps all items", byArea.flatMap((g) => g.items).length === items.length);
assert("work area default title", byArea[0]?.title === "Deck");

const byType = groupPricingItems(items, workAreas, "cost_type");
assert(
  "cost type maps equipment to Plant",
  byType.some((g) => g.title === "Plant" && g.items.some((i) => i.id === "e1"))
);
assert(
  "cost type maps material to Materials",
  byType.some((g) => g.title === "Materials" && g.items.some((i) => i.id === "m1"))
);
assert(
  "grouping does not duplicate lines",
  byType.flatMap((g) => g.items).length === items.length
);

const all = groupPricingItems(items, workAreas, "all");
assert("all items is a single group", all.length === 1 && all[0].items.length === items.length);

console.log("\n--- Manual delete eligibility ---");
assert(
  "estimate-sourced items are not manual",
  !isManuallyAddedPricingItem(items[0])
);
assert(
  "null source is manual",
  isManuallyAddedPricingItem(items[3])
);

console.log("\n--- Calculation details ---");
const labourDetails = buildPricingCalculationDetails(items[1]);
assert("labour details exist", labourDetails != null && labourDetails.kind === "labour");
assert(
  "labour rows use stored productivity",
  labourDetails!.rows.some((row) => row.label === "Productivity" && row.value.includes("0.077"))
);
assert(
  "labour hours from stored calculated_quantity",
  labourDetails!.rows.some((row) => row.label === "Calculated labour" && row.value.includes("8.25"))
);

const materialNotes =
  'Decking boards\n__quotr_meta__:' +
  JSON.stringify({
    materialBuildUps: [
      {
        key: "decking_boards",
        label: "kwila decking boards",
        quantity: 117.9,
        unit: "lm",
        wastagePercent: 10,
        display: "Approx. 117.9 lm",
        priced: true,
        rateUnit: "lm",
        outputs: { baseLm: 107.1, totalLm: 117.9 },
      },
    ],
    materialRateResolution: { display: "Your company rate" },
  });
const materialDetails = buildPricingCalculationDetails(
  item({ notes_internal: materialNotes })
);
assert("material details exist", materialDetails != null && materialDetails.kind === "material");
assert(
  "required quantity from stored outputs",
  materialDetails!.rows.some((row) => row.label === "Required quantity" && row.value.includes("107.1"))
);
assert(
  "purchased quantity from stored outputs",
  materialDetails!.rows.some((row) => row.label === "Purchased quantity" && row.value.includes("117.9"))
);
assert(
  "waste from stored wastagePercent",
  materialDetails!.rows.some((row) => row.label === "Waste" && row.value.includes("10"))
);
assert(
  "rate source from stored display",
  materialDetails!.rows.some((row) => row.label === "Rate source" && row.value === "Your company rate")
);

console.log("\n--- Client narrative ---");
assert(
  "internal estimate phrase filtered",
  filterClientFacingNarrative([
    "This is an internal working estimate, not a client quote.",
    "Access from the driveway.",
  ]).join("|") === "Access from the driveway."
);
assert(
  "section description drops carry distance",
  sanitizeClientNarrativeBlock(
    "Supply and construct deck. Carting/disposal access allowance included for approximately 12 m carry distance."
  ) == null ||
    !/carry distance/i.test(
      sanitizeClientNarrativeBlock(
        "Supply and construct deck. Carting/disposal access allowance included for approximately 12 m carry distance."
      ) ?? ""
    )
);

function quoteItem(overrides: Partial<QuoteItem>): QuoteItem {
  return {
    id: "qi-1",
    org_id: "org-1",
    quote_id: "q-1",
    project_id: "project-1",
    pricing_item_id: "item-1",
    work_area_id: "wa-deck",
    section_title: "Deck",
    section_description:
      "Supply and construct approximately 15 m² of new kwila deck including associated substructure, decking, fixings, footings, fascia, steps and installation.",
    label: "Decking",
    description: null,
    quantity: 1,
    unit: "item",
    unit_price: 10486.97,
    total: 10486.97,
    visible: true,
    optional: false,
    sort_order: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
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
    quote_number: "Q-1",
    title: "Quote",
    status: "draft",
    client_name: null,
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
    revision_number: 1,
    parent_quote_id: null,
    revised_from_quote_id: null,
    superseded_by_quote_id: null,
    superseded_at: null,
    revision_note: null,
    presentation_mode: "grouped",
    ...overrides,
  };
}

console.log("\n--- Presentation mode ---");
assert("missing mode defaults to grouped", parseQuotePresentationMode(undefined) === "grouped");
assert("unknown mode defaults to grouped", parseQuotePresentationMode("fancy") === "grouped");
assert(
  "mapper defaults missing column to grouped",
  mapQuote({ id: "q", org_id: "o", project_id: "p", title: "Q", status: "draft" })
    .presentation_mode === "grouped"
);

const includedDeck = quoteItem({
  id: "qi-decking",
  label: "Decking",
  total: 8000,
  sort_order: 1,
});
const includedLabour = quoteItem({
  id: "qi-labour",
  label: "Decking installation",
  total: 2486.97,
  sort_order: 2,
});
const optionalScreen = quoteItem({
  id: "qi-screen",
  label: "Privacy screen",
  total: 1850,
  optional: true,
  sort_order: 3,
});
const hiddenBuildUp = quoteItem({
  id: "qi-hidden",
  label: "Joists",
  total: 900,
  visible: false,
  sort_order: 4,
});

const snapshotItems = [
  includedDeck,
  includedLabour,
  optionalScreen,
  hiddenBuildUp,
];
const grouped = presentQuoteClientDocument(
  quoteDoc({ presentation_mode: "grouped", subtotal: 10486.97 }),
  snapshotItems
);
const detailed = presentQuoteClientDocument(
  quoteDoc({ presentation_mode: "detailed", subtotal: 10486.97 }),
  snapshotItems
);
const lumpSum = presentQuoteClientDocument(
  quoteDoc({ presentation_mode: "lump_sum", subtotal: 10486.97 }),
  snapshotItems
);

assert("default grouped mode", grouped.mode === "grouped");
assert("detailed mode", detailed.mode === "detailed");
assert("lump sum mode", lumpSum.mode === "lump_sum");
assert(
  "grouped rolls visible included lines into one work area",
  grouped.groupedSections.length === 1 &&
    grouped.groupedSections[0].total === 10486.97 &&
    groupedSectionLabel(grouped.groupedSections[0].sectionTitle) === "Deck works"
);
assert(
  "grouped keeps work-area client description",
  grouped.groupedSections[0].sectionDescription?.includes("kwila deck") === true
);
assert(
  "presentation modes share the same included sell",
  grouped.includedSell === 10486.97 &&
    detailed.includedSell === grouped.includedSell &&
    lumpSum.includedSell === grouped.includedSell
);
assert(
  "hidden quote lines are not rendered and not in grouped sell",
  grouped.includedItems.every((item) => item.id !== "qi-hidden") &&
    grouped.optionalItems.every((item) => item.id !== "qi-hidden")
);
assert(
  "optional lines are separate from included",
  grouped.optionalItems.length === 1 &&
    grouped.optionalItems[0].label === "Privacy screen" &&
    grouped.includedItems.every((item) => item.optional !== true)
);
assert(
  "lump sum can render scope plus stored total",
  lumpSumScopeNarrative("Deck works as described.", lumpSum) ===
    "Deck works as described."
);

console.log("\n--- Optional economics ---");
const engineStillAddsOptional = calculateAuthoritativeQuoteTotals(
  [
    { total: 10486.97, visible: true },
    { total: 1850, visible: true },
  ],
  15,
  "verify-optional-engine-unchanged"
);
assert(
  "engine formulas still include every visible line passed in",
  engineStillAddsOptional.ok &&
    Math.abs(engineStillAddsOptional.totals.subtotal - 12336.97) < 0.02
);

const baseTotals = calculateQuoteBaseTotalsFromItems(
  snapshotItems,
  15,
  "verify-optional-snapshot-policy"
);
assert(
  "snapshot policy excludes optional from base subtotal",
  baseTotals.ok && Math.abs(baseTotals.totals.subtotal - 10486.97) < 0.02
);
assert(
  "snapshot GST is 15% of base subtotal not optional-inclusive",
  baseTotals.ok && Math.abs(baseTotals.totals.gstAmount - 1573.05) < 0.02
);
assert(
  "hidden quote lines do not enter base total",
  baseTotals.ok &&
    Math.abs(baseTotals.totals.totalInclGst - 12060.02) < 0.02
);

const hiddenPricing = mapPricingItemsToQuoteItems(
  [
    item({ id: "vis", visible_on_quote: true, total_sell: 100, client_label: "Visible" }),
    item({ id: "hid", visible_on_quote: false, total_sell: 50, client_label: "Hidden" }),
    item({
      id: "opt",
      visible_on_quote: true,
      optional: true,
      total_sell: 25,
      client_label: "Optional light",
    }),
  ],
  new Map([["wa-deck", "Deck"]])
);
assert(
  "hidden pricing lines never become quote items",
  hiddenPricing.every((row) => row.pricing_item_id !== "hid") &&
    hiddenPricing.some((row) => row.pricing_item_id === "vis")
);
assert(
  "optional pricing lines persist on the quote snapshot",
  hiddenPricing.some((row) => row.pricing_item_id === "opt" && row.optional === true)
);

console.log("\n--- Structural client narrative ---");
const leftover =
  "Estimator used leftover packers from the yard for temporary set-out.";
const arbitraryInternal = "Internal productivity assumption XYZ";
const orgDefaults: OrgQuoteDefaults = {
  defaultGstRate: 15,
  defaultQuoteValidityDays: 30,
  defaultPaymentTerms: null,
  defaultQuoteTerms: null,
  defaultQuoteExclusions: null,
  defaultQuoteAssumptions:
    "Pricing is based on the information provided and standard working conditions unless noted otherwise.",
};
assert(
  "leftover packers is not on the phrase blacklist",
  !isInternalClientNarrative(leftover)
);
const clientAssumptions = resolveClientQuoteAssumptions({
  pricingClientAssumptions: [],
  orgDefaults,
});
assert(
  "arbitrary estimate narrative does not become client assumptions",
  !clientAssumptions.some((line) => /leftover packers/i.test(line)) &&
    !clientAssumptions.includes(arbitraryInternal)
);
assert(
  "client assumptions come from org defaults when pricing client field is empty",
  clientAssumptions.some((line) => /information provided/i.test(line))
);

const clientFieldsSrc = readFileSync("lib/quotes/client-fields.ts", "utf8");
assert(
  "client-fields signature has no estimate source",
  clientFieldsSrc.includes("pricingClientAssumptions") &&
    !clientFieldsSrc.includes("estimateAssumptions")
);
const pricingActionsSrc = readFileSync("lib/pricing/actions.ts", "utf8");
assert(
  "pricing create no longer copies estimate assumptions into client fields",
  pricingActionsSrc.includes("pricingClientAssumptions: []") &&
    pricingActionsSrc.includes("formatEstimateNarrativeForInternalNotes")
);

console.log("\n--- PDF / preview parity + Pricing polish wiring ---");
const templateSrc = readFileSync("components/quotes/QuoteTemplate.tsx", "utf8");
const printSrc = readFileSync(
  "app/(protected)/app/projects/[projectId]/quotes/[quoteId]/print/page.tsx",
  "utf8"
);
assert(
  "preview and PDF share QuoteTemplate + presentQuoteClientDocument",
  templateSrc.includes("presentQuoteClientDocument") &&
    printSrc.includes("QuoteTemplate") &&
    !templateSrc.includes("calculateQuoteTotals") &&
    !templateSrc.includes("calculateAuthoritativeQuoteTotals")
);
assert(
  "template renders optional items separately",
  templateSrc.includes("Optional items") &&
    templateSrc.includes("OPTIONAL_ITEMS_CLIENT_NOTE")
);
assert(
  "template displays stored quote totals",
  templateSrc.includes("quote.subtotal") &&
    templateSrc.includes("quote.gst_amount") &&
    templateSrc.includes("quote.total_incl_gst")
);

assert(
  "pricing edits invalidate review",
  pricingActionsSrc.includes('status: "draft"') &&
    pricingActionsSrc.includes("reviewed_at: null")
);
assert(
  "bulk visibility action exists and invalidates review",
  pricingActionsSrc.includes("setPricingItemsQuoteVisibility") &&
    /visible_on_quote: parsed\.data\.visibleOnQuote[\s\S]*reviewed_at: null/.test(
      pricingActionsSrc
    )
);

if (!process.exitCode) {
  console.log("\nCOMMERCIAL-UX-01 checks passed.");
} else {
  console.log("\nCOMMERCIAL-UX-01 checks failed.");
}
