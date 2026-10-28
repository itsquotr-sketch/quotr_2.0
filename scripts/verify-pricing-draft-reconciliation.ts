/**
 * Pricing draft reconciliation compares requirement identity, not only money.
 * Run: npx tsx scripts/verify-pricing-draft-reconciliation.ts
 */
import {
  buildRecalibrationPreviewData,
  estimateRequirementScopes,
  matchPricingToEstimateLines,
  pricingDraftReconciliationBlocked,
  pricingRowsNeedingReviewNote,
  pricingRowsToRetire,
  REVIEW_RETAINED_NOTE,
  type EstimateLineItemRow,
} from "../lib/pricing/recalibration-helpers";
import type { PricingItem } from "../lib/pricing/types";

function check(name: string, ok: boolean) {
  if (!ok) throw new Error(name);
  console.log("ok", name);
}

function meta(display: string, fields: Record<string, unknown>): string {
  return `${display}\n__quotr_meta__:${JSON.stringify(fields)}`;
}

function line(input: {
  id: string;
  label: string;
  scope: string;
  component: string;
  quantity: number;
  cost: number;
  sell: number;
  specification: string;
}): EstimateLineItemRow {
  return {
    id: input.id,
    work_area_id: "wa",
    label: input.label,
    category: "materials",
    recommended_cost: input.cost,
    recommended_sell: input.sell,
    notes: meta(input.specification, {
      quantity: input.quantity,
      unit: "m2",
      scopeKey: input.scope,
      rateSourceType: "benchmark",
      includedInTotal: true,
    }),
    sort_order: 0,
    component_key: input.component,
  };
}

function item(input: {
  id: string;
  label: string;
  scope: string | null;
  component: string | null;
  quantity: number | null;
  cost: number;
  sell: number;
  specification: string | null;
  source?: string | null;
  manuallyEdited?: boolean;
  pricingSource?: string;
  note?: string | null;
}): PricingItem {
  const metadata: Record<string, unknown> = {
    quantity: input.quantity,
    unit: input.quantity == null ? undefined : "m2",
    scopeKey: input.scope,
    rateSourceType: input.cost === 0 && input.sell === 0 ? "missing" : "benchmark",
    includedInTotal: !(input.cost === 0 && input.sell === 0),
  };
  if (input.pricingSource) metadata.pricingSource = input.pricingSource;
  return {
    id: input.id,
    org_id: "org",
    pricing_document_id: "doc",
    project_id: "project",
    work_area_id: "wa",
    source_estimate_line_item_id: input.source ?? null,
    component_key: input.component,
    item_type: "material",
    delivery_method: "in_house",
    internal_label: input.label,
    client_label: input.label,
    internal_description: input.specification,
    client_description: null,
    quantity: input.quantity,
    unit: input.quantity == null ? null : "m2",
    unit_cost: null,
    unit_sell: null,
    total_cost: input.cost,
    total_sell: input.sell,
    gross_profit: 0,
    margin_percent: 0,
    markup_percent: 0,
    visible_on_quote: true,
    optional: false,
    sort_order: 0,
    notes_internal: meta(input.specification ?? "", metadata),
    notes_client: null,
    created_at: "",
    updated_at: "",
    manually_edited: input.manuallyEdited ?? false,
    orphaned: false,
    recalibration_note: input.note ?? null,
    calculation_mode: "lump_sum",
    productivity_rate: null,
    productivity_unit: null,
    calculated_quantity: null,
    cost_known: !(input.cost === 0 && input.sell === 0),
  };
}

const packageScope = "flooring:wa:portion:flooring.vinyl_plank.supply_install.m2";
const removalScope = "flooring:wa:portion:flooring.vinyl_plank.remove";
const wasteScope = "flooring:wa:portion:flooring.finish.waste_increment";
const packageSpec = "Package on the net area. The requested waste is not included.";
const removalSpec = "Removal on the net area.";

const currentLines = [
  line({
    id: "pkg-new",
    label: "Vinyl plank / LVT supply and installation",
    scope: packageScope,
    component: "flooring.vinyl_plank.supply_install.m2",
    quantity: 9.6,
    cost: 912,
    sell: 1140,
    specification: packageSpec,
  }),
  line({
    id: "rem-new",
    label: "Vinyl / LVT finish removal",
    scope: removalScope,
    component: "flooring.vinyl_plank.remove",
    quantity: 9.6,
    cost: 57.6,
    sell: 72,
    specification: removalSpec,
  }),
];

const wasteRow = item({
  id: "waste",
  label: "Hallway · requested finish waste",
  scope: wasteScope,
  component: "flooring.finish.waste_increment",
  quantity: 0.96,
  cost: 0,
  sell: 0,
  specification: "Extra finish quantity 0.96 m2 only.",
  source: null,
});

const pricedRows = [
  item({
    id: "pkg",
    label: "Vinyl plank / LVT supply and installation",
    scope: packageScope,
    component: "flooring.vinyl_plank.supply_install.m2",
    quantity: 9.6,
    cost: 912,
    sell: 1140,
    specification: packageSpec,
    source: null,
  }),
  item({
    id: "rem",
    label: "Vinyl / LVT finish removal",
    scope: removalScope,
    component: "flooring.vinyl_plank.remove",
    quantity: 9.6,
    cost: 57.6,
    sell: 72,
    specification: removalSpec,
    source: null,
  }),
  wasteRow,
];

const preview = buildRecalibrationPreviewData(currentLines, pricedRows, 1212, 1212);
check(
  "removed unpriced generated row is visible when the money difference is zero",
  preview.difference === 0 &&
    preview.summary.orphaned === 1 &&
    preview.summary.unchanged === 2 &&
    preview.items.some(
      (row) => row.pricingItemId === "waste" && row.classification === "orphaned"
    )
);
const matched = matchPricingToEstimateLines(currentLines, pricedRows);
const matchedIds = new Set([...matched.values()].map((row) => row.id));
const estimateIds = new Set(currentLines.map((row) => row.id));
const scopes = estimateRequirementScopes(currentLines);
check(
  "the removed waste row is retired and the priced rows stay",
  pricingRowsToRetire(pricedRows, matchedIds, estimateIds, scopes).join() === "waste"
);

const removedHundred = item({
  id: "old-extra",
  label: "Old extra",
  scope: "scope:old",
  component: "old.extra",
  quantity: 1,
  cost: 80,
  sell: 100,
  specification: "Old extra",
  source: null,
});
const addedHundred = line({
  id: "new-extra",
  label: "New extra",
  scope: "scope:new",
  component: "new.extra",
  quantity: 1,
  cost: 80,
  sell: 100,
  specification: "New extra",
});
const cancelPreview = buildRecalibrationPreviewData(
  [addedHundred],
  [removedHundred],
  100,
  100
);
check(
  "added and removed scope is shown when the amounts cancel",
  cancelPreview.difference === 0 &&
    cancelPreview.summary.newItems === 1 &&
    cancelPreview.summary.orphaned === 1
);

const sameMoney = line({
  id: "qty-new",
  label: "Vinyl plank / LVT supply and installation",
  scope: packageScope,
  component: "flooring.vinyl_plank.supply_install.m2",
  quantity: 10.56,
  cost: 912,
  sell: 1140,
  specification: "Supply quantity changed. The package total is unchanged.",
});
const previousQty = item({
  id: "pkg",
  label: "Vinyl plank / LVT supply and installation",
  scope: packageScope,
  component: "flooring.vinyl_plank.supply_install.m2",
  quantity: 9.6,
  cost: 912,
  sell: 1140,
  specification: packageSpec,
  source: null,
});
const qtyPreview = buildRecalibrationPreviewData([sameMoney], [previousQty], 1140, 1140);
check(
  "a changed quantity or specification is an update when the total is unchanged",
  qtyPreview.difference === 0 && qtyPreview.summary.willUpdate === 1
);

const editedWaste = item({
  id: "waste-edited",
  label: "Hallway · requested finish waste",
  scope: wasteScope,
  component: "flooring.finish.waste_increment",
  quantity: 0.96,
  cost: 20,
  sell: 25,
  specification: "Builder entered an amount.",
  source: null,
  manuallyEdited: true,
});
const editedPreview = buildRecalibrationPreviewData(currentLines, [editedWaste], 25, 1212);
check(
  "an edited generated row is kept for review",
  editedPreview.summary.orphaned === 0 &&
    editedPreview.summary.needsReview === 1 &&
    editedPreview.items.some(
      (row) => row.pricingItemId === "waste-edited" && row.note === REVIEW_RETAINED_NOTE
    )
);

const manualRow = item({
  id: "manual",
  label: "Site establishment",
  scope: null,
  component: null,
  quantity: 1,
  cost: 50,
  sell: 50,
  specification: "Added in Pricing.",
  source: null,
  pricingSource: "user_override",
});
const manualPreview = buildRecalibrationPreviewData(currentLines, [...pricedRows.slice(0, 2), manualRow], 1262, 1212);
check(
  "a manual row is retained",
  manualPreview.summary.orphaned === 0 &&
    manualPreview.items.some(
      (row) => row.pricingItemId === "manual" && row.classification === "needs_review"
    )
);

const sameLabelDifferentScope = item({
  id: "other-vinyl",
  label: "Vinyl plank / LVT supply and installation",
  scope: "flooring:other:portion:flooring.vinyl_plank.supply_install.m2",
  component: "flooring.vinyl_plank.supply_install.m2",
  quantity: 9.6,
  cost: 912,
  sell: 1140,
  specification: packageSpec,
  source: null,
});
const labelMatches = matchPricingToEstimateLines(currentLines, [sameLabelDifferentScope]);
check(
  "the same label does not bind a different requirement",
  labelMatches.size === 0
);

const firstRetire = pricingRowsToRetire(pricedRows, matchedIds, estimateIds, scopes);
const afterRemoval = pricedRows.filter((row) => !firstRetire.includes(row.id));
const secondMatched = matchPricingToEstimateLines(currentLines, afterRemoval);
const secondIds = new Set([...secondMatched.values()].map((row) => row.id));
const secondRetire = pricingRowsToRetire(afterRemoval, secondIds, estimateIds, scopes);
const reviewed = { ...manualRow, recalibration_note: REVIEW_RETAINED_NOTE };
const reviewOnce = pricingRowsNeedingReviewNote(
  [manualRow],
  new Set(),
  estimateIds,
  scopes
);
const reviewAgain = pricingRowsNeedingReviewNote(
  [reviewed],
  new Set(),
  estimateIds,
  scopes
);
check(
  "a repeated reconciliation does not retire or re-note the same rows",
  secondRetire.length === 0 && reviewOnce.join() === "manual" && reviewAgain.length === 0
);

check(
  "an issued quote snapshot is not reconciled",
  pricingDraftReconciliationBlocked("converted_to_quote") != null &&
    pricingDraftReconciliationBlocked("draft") == null
);

const liningSideA = "internal_walls.lining.unspecified.side_a:wt";
const liningSideB = "internal_walls.lining.unspecified.side_b:wt";
const liningMaterial = "internal_walls.lining.standard_gib.material:wt";
const paintingScope = "internal_walls.painting.coverage_unresolved:wt";
const preparationScope = "flooring:wa:portion:flooring.carpet_tile.preparation_unresolved";
const installScope = "flooring:wa:portion:flooring.carpet_tile.straight.install";
const beforeLines = [
  line({ id: "line-a", label: "Side A lining", scope: liningSideA, component: "internal_walls.lining.unspecified.side_a", quantity: 64.8, cost: 0, sell: 0, specification: "Choose the lining product." }),
  line({ id: "line-b", label: "Side B lining", scope: liningSideB, component: "internal_walls.lining.unspecified.side_b", quantity: 64.8, cost: 0, sell: 0, specification: "Choose the lining product." }),
  line({ id: "paint", label: "Wall painting", scope: paintingScope, component: "internal_walls.painting.coverage_unresolved", quantity: 1, cost: 0, sell: 0, specification: "No painting rate is applied." }),
  line({ id: "prep", label: "Floor preparation", scope: preparationScope, component: "flooring.carpet_tile.preparation_unresolved", quantity: 120, cost: 0, sell: 0, specification: "Floor preparation is not priced." }),
  line({ id: "install", label: "Carpet tile installation", scope: installScope, component: "flooring.carpet_tile.straight.install", quantity: 120, cost: 1350, sell: 1687.5, specification: "Installation uses the net area." }),
];
const beforeRows = beforeLines.map((row) =>
  item({
    id: `price-${row.id}`,
    label: row.label,
    scope: requirementScopeOf(row.notes),
    component: row.component_key ?? null,
    quantity: 1,
    cost: row.recommended_cost ?? 0,
    sell: row.recommended_sell ?? 0,
    specification: row.label,
    source: row.id,
  })
);
const afterLines = [
  line({ id: "mat-a", label: "Side A lining", scope: liningMaterial, component: "internal_walls.lining.standard_gib.material", quantity: 22, cost: 400, sell: 500, specification: "13 mm standard plasterboard." }),
  line({ id: "mat-b", label: "Side B lining", scope: "internal_walls.lining.standard_gib.material:wt:b", component: "internal_walls.lining.standard_gib.material", quantity: 22, cost: 400, sell: 500, specification: "13 mm standard plasterboard." }),
  line({ id: "paint", label: "Wall painting", scope: paintingScope, component: "internal_walls.painting.coverage_unresolved", quantity: 1, cost: 0, sell: 0, specification: "No painting rate is applied." }),
  line({ id: "prep", label: "Floor preparation", scope: preparationScope, component: "flooring.carpet_tile.preparation_unresolved", quantity: 120, cost: 0, sell: 0, specification: "Floor preparation is not priced." }),
  line({ id: "install", label: "Carpet tile installation", scope: installScope, component: "flooring.carpet_tile.straight.install", quantity: 120, cost: 1350, sell: 1687.5, specification: "Installation uses the net area." }),
];
const editedPreparation = {
  ...beforeRows.find((row) => row.id === "price-prep")!,
  manually_edited: true,
  total_cost: 80,
  total_sell: 100,
};
const manualCoverage = item({
  id: "manual-coverage",
  label: "Protection",
  scope: null,
  component: null,
  quantity: 1,
  cost: 40,
  sell: 40,
  specification: "Added in Pricing.",
  source: null,
  pricingSource: "user_override",
});
const coveragePreview = buildRecalibrationPreviewData(
  afterLines,
  [...beforeRows.filter((row) => row.id !== "price-prep"), editedPreparation, manualCoverage],
  0,
  0
);
const coverageMatched = matchPricingToEstimateLines(afterLines, [
  ...beforeRows.filter((row) => row.id !== "price-prep"),
  editedPreparation,
  manualCoverage,
]);
const coverageMatchedIds = new Set([...coverageMatched.values()].map((row) => row.id));
const coverageEstimateIds = new Set(afterLines.map((row) => row.id));
const coverageScopes = estimateRequirementScopes(afterLines);
const coverageRetired = pricingRowsToRetire(
  beforeRows,
  coverageMatchedIds,
  coverageEstimateIds,
  coverageScopes
);
check(
  "new coverage rows keep their identities and drop only the replaced lining requirements",
  coverageRetired.sort().join() === "price-line-a,price-line-b" &&
    coveragePreview.items.some(
      (row) => row.pricingItemId === "price-prep" && row.classification === "manually_protected"
    ) &&
    coveragePreview.items.some(
      (row) => row.pricingItemId === "manual-coverage" && row.classification === "needs_review"
    ) &&
    coveragePreview.summary.newItems === 2
);

function requirementScopeOf(notes: string | null): string {
  const match = notes?.match(/"scopeKey":"([^"]+)"/);
  return match?.[1] ?? "";
}

console.log("pricing draft reconciliation verifier passed");
