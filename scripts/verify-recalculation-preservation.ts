/**
 * Verifies that recalibration preserves manually edited pricing items.
 *
 * Run: npx tsx scripts/verify-recalculation-preservation.ts
 */
import {
  buildPricingItemRowFromEstimate,
  buildPricingItemUpdateFromEstimate,
  matchPricingToEstimateLines,
  MANUAL_PRESERVED_NOTE,
  type EstimateLineItemRow,
} from "../lib/pricing/recalibration-helpers";
import type { PricingItem } from "../lib/pricing/types";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`PASS: ${msg}`);
}

const orgId = "org-1";
const projectId = "proj-1";
const docId = "doc-1";

const estimateLines: EstimateLineItemRow[] = [
  {
    id: "est-1",
    work_area_id: "wa-1",
    label: "Deck labour",
    category: "labour",
    recommended_cost: 1200,
    recommended_sell: 1800,
    notes: null,
    sort_order: 0,
  },
  {
    id: "est-2",
    work_area_id: "wa-1",
    label: "Decking materials package",
    category: "materials",
    recommended_cost: 800,
    recommended_sell: 1200,
    notes: null,
    sort_order: 1,
  },
];

function mockPricingItem(
  overrides: Partial<PricingItem> & Pick<PricingItem, "id" | "manually_edited">
): PricingItem {
  return {
    org_id: orgId,
    project_id: projectId,
    pricing_document_id: docId,
    source_estimate_line_item_id: null,
    work_area_id: "wa-1",
    work_area_name: "Deck",
    internal_label: "Item",
    client_label: "Item",
    category: "labour",
    quantity: 1,
    unit: "item",
    cost_rate: 100,
    sell_rate: 150,
    total_cost: 100,
    total_sell: 150,
    sort_order: 0,
    orphaned: false,
    recalibration_note: null,
    client_description: null,
    is_visible: true,
    calculation_metadata: null,
    ...overrides,
  };
}

const pricingItems: PricingItem[] = [
  mockPricingItem({
    id: "pi-1",
    source_estimate_line_item_id: "est-1",
    internal_label: "Deck labour",
    client_label: "Deck labour",
    category: "labour",
    cost_rate: 1200,
    sell_rate: 1800,
    total_cost: 1200,
    total_sell: 1800,
    sort_order: 0,
    manually_edited: false,
  }),
  mockPricingItem({
    id: "pi-2",
    source_estimate_line_item_id: "est-2",
    internal_label: "Decking materials package",
    client_label: "Decking materials package",
    category: "materials",
    cost_rate: 950,
    sell_rate: 1500,
    total_cost: 950,
    total_sell: 1500,
    sort_order: 1,
    manually_edited: true,
  }),
];

const updatedEstimateLines: EstimateLineItemRow[] = [
  {
    ...estimateLines[0],
    recommended_cost: 1400,
    recommended_sell: 2100,
  },
  {
    ...estimateLines[1],
    recommended_cost: 900,
    recommended_sell: 1350,
  },
];

const matches = matchPricingToEstimateLines(updatedEstimateLines, pricingItems);

const edited = pricingItems.find((item) => item.manually_edited)!;
const unedited = pricingItems.find((item) => !item.manually_edited)!;

const editedMatch = matches.get("est-2");
assert(editedMatch?.id === edited.id, "Edited item matched by source line id");

const uneditedMatch = matches.get("est-1");
assert(uneditedMatch?.id === unedited.id, "Unedited item matched");

assert(
  MANUAL_PRESERVED_NOTE.includes("preserved"),
  "Manual preserve note is defined"
);

const updatedPatch = buildPricingItemUpdateFromEstimate(
  updatedEstimateLines[0],
  unedited
);

assert(
  Number(updatedPatch.total_sell) === 2100,
  "Unedited item receives updated sell from estimate"
);

assert(
  Number(updatedPatch.total_cost) === 1400,
  "Unedited item receives updated cost from estimate"
);

const insertRow = buildPricingItemRowFromEstimate(
  { ...updatedEstimateLines[1], id: "est-new" },
  orgId,
  docId,
  projectId,
  2
);

assert(insertRow.manually_edited === false, "New rows are not manually edited");

console.log("\nRecalculation preservation checks passed.");
