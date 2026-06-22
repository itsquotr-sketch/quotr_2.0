import {
  cleanClientLabel,
  defaultDeliveryMethod,
  mapEstimateCategoryToItemType,
  roundMoney,
  roundPercent,
} from "@/lib/pricing/calculations";
import { extractEstimateLineItemDetails } from "@/lib/pricing/mappers";
import type { PricingItem } from "@/lib/pricing/types";

export type EstimateLineItemRow = {
  id: string;
  work_area_id: string | null;
  label: string;
  category: string;
  recommended_cost: number | null;
  recommended_sell: number | null;
  notes: string | null;
  sort_order: number;
};

export type RecalibrationItemClassification =
  | "unchanged"
  | "will_update"
  | "manually_protected"
  | "new_item"
  | "orphaned";

export type RecalibrationPreviewItem = {
  classification: RecalibrationItemClassification;
  pricingItemId?: string;
  estimateLineItemId?: string;
  label: string;
  beforeCost: number | null;
  beforeSell: number | null;
  afterCost: number | null;
  afterSell: number | null;
  manuallyEdited: boolean;
  orphaned: boolean;
  note?: string;
};

export type RecalibrationPreview = {
  summary: {
    unchanged: number;
    willUpdate: number;
    manuallyProtected: number;
    newItems: number;
    orphaned: number;
  };
  currentPricingSubtotalSell: number;
  latestEstimateRecommendedSell: number;
  difference: number;
  differencePercent: number;
  items: RecalibrationPreviewItem[];
};

export const MANUAL_PRESERVED_NOTE =
  "Manually edited — preserved during recalibration.";

export const ORPHANED_SOURCE_NOTE =
  "Source estimate item no longer appears in the latest estimate.";

function labelKey(workAreaId: string | null, label: string): string {
  return `${workAreaId ?? ""}|${label.trim().toLowerCase()}`;
}

export function valuesFromEstimateLineItem(lineItem: EstimateLineItemRow) {
  const details = extractEstimateLineItemDetails(lineItem.notes);
  const recommendedCost = Number(lineItem.recommended_cost ?? 0);
  const recommendedSell = Number(lineItem.recommended_sell ?? 0);
  const quantity = details.quantity ?? null;
  const unitCost =
    details.unitCost ??
    (quantity && quantity > 0
      ? recommendedCost / quantity
      : recommendedCost || null);
  const unitSell =
    details.unitSell ??
    (quantity && quantity > 0
      ? recommendedSell / quantity
      : recommendedSell || null);

  const totalCost = roundMoney(recommendedCost);
  const totalSell = roundMoney(recommendedSell);
  const grossProfit = roundMoney(totalSell - totalCost);
  const marginPercent =
    totalSell > 0 ? roundPercent((grossProfit / totalSell) * 100) : 0;
  const markupPercent =
    totalCost > 0 ? roundPercent((grossProfit / totalCost) * 100) : 0;

  return {
    itemType: mapEstimateCategoryToItemType(lineItem.category),
    deliveryMethod: defaultDeliveryMethod(
      mapEstimateCategoryToItemType(lineItem.category)
    ),
    details,
    quantity,
    unitCost: unitCost != null ? roundMoney(unitCost) : null,
    unitSell: unitSell != null ? roundMoney(unitSell) : null,
    totalCost,
    totalSell,
    grossProfit,
    marginPercent,
    markupPercent,
  };
}

function valuesMateriallyMatch(
  pricingItem: PricingItem,
  lineItem: EstimateLineItemRow
): boolean {
  const estimateValues = valuesFromEstimateLineItem(lineItem);
  return (
    pricingItem.total_cost === estimateValues.totalCost &&
    pricingItem.total_sell === estimateValues.totalSell &&
    pricingItem.internal_label.trim() === lineItem.label.trim()
  );
}

export function matchPricingToEstimateLines(
  estimateLineItems: EstimateLineItemRow[],
  pricingItems: PricingItem[]
): Map<string, PricingItem> {
  const estimateIds = new Set(estimateLineItems.map((item) => item.id));
  const matches = new Map<string, PricingItem>();
  const usedPricingIds = new Set<string>();

  const bySourceId = new Map<string, PricingItem>();
  const byLabel = new Map<string, PricingItem>();

  for (const item of pricingItems) {
    if (item.source_estimate_line_item_id) {
      bySourceId.set(item.source_estimate_line_item_id, item);
    }
    byLabel.set(labelKey(item.work_area_id, item.internal_label), item);
  }

  for (const lineItem of estimateLineItems) {
    let match = bySourceId.get(lineItem.id) ?? null;

    if (match && usedPricingIds.has(match.id)) {
      match = null;
    }

    if (!match) {
      const labelMatch = byLabel.get(
        labelKey(lineItem.work_area_id, lineItem.label)
      );
      if (labelMatch && !usedPricingIds.has(labelMatch.id)) {
        const sourceStale =
          labelMatch.source_estimate_line_item_id != null &&
          !estimateIds.has(labelMatch.source_estimate_line_item_id);
        if (sourceStale || labelMatch.source_estimate_line_item_id == null) {
          match = labelMatch;
        }
      }
    }

    if (match) {
      matches.set(lineItem.id, match);
      usedPricingIds.add(match.id);
    }
  }

  return matches;
}

export function buildRecalibrationPreviewData(
  estimateLineItems: EstimateLineItemRow[],
  pricingItems: PricingItem[],
  currentPricingSubtotalSell: number,
  latestEstimateRecommendedSell: number
): RecalibrationPreview {
  const matches = matchPricingToEstimateLines(estimateLineItems, pricingItems);
  const matchedPricingIds = new Set(
    [...matches.values()].map((item) => item.id)
  );
  const estimateIds = new Set(estimateLineItems.map((item) => item.id));

  const items: RecalibrationPreviewItem[] = [];
  const summary = {
    unchanged: 0,
    willUpdate: 0,
    manuallyProtected: 0,
    newItems: 0,
    orphaned: 0,
  };

  for (const lineItem of estimateLineItems) {
    const match = matches.get(lineItem.id);
    const estimateValues = valuesFromEstimateLineItem(lineItem);

    if (!match) {
      summary.newItems += 1;
      items.push({
        classification: "new_item",
        estimateLineItemId: lineItem.id,
        label: lineItem.label,
        beforeCost: null,
        beforeSell: null,
        afterCost: estimateValues.totalCost,
        afterSell: estimateValues.totalSell,
        manuallyEdited: false,
        orphaned: false,
      });
      continue;
    }

    if (match.manually_edited) {
      summary.manuallyProtected += 1;
      items.push({
        classification: "manually_protected",
        pricingItemId: match.id,
        estimateLineItemId: lineItem.id,
        label: match.internal_label,
        beforeCost: match.total_cost,
        beforeSell: match.total_sell,
        afterCost: estimateValues.totalCost,
        afterSell: estimateValues.totalSell,
        manuallyEdited: true,
        orphaned: match.orphaned,
        note: MANUAL_PRESERVED_NOTE,
      });
      continue;
    }

    if (valuesMateriallyMatch(match, lineItem)) {
      summary.unchanged += 1;
      items.push({
        classification: "unchanged",
        pricingItemId: match.id,
        estimateLineItemId: lineItem.id,
        label: match.internal_label,
        beforeCost: match.total_cost,
        beforeSell: match.total_sell,
        afterCost: estimateValues.totalCost,
        afterSell: estimateValues.totalSell,
        manuallyEdited: false,
        orphaned: false,
      });
      continue;
    }

    summary.willUpdate += 1;
    items.push({
      classification: "will_update",
      pricingItemId: match.id,
      estimateLineItemId: lineItem.id,
      label: match.internal_label,
      beforeCost: match.total_cost,
      beforeSell: match.total_sell,
      afterCost: estimateValues.totalCost,
      afterSell: estimateValues.totalSell,
      manuallyEdited: false,
      orphaned: false,
    });
  }

  for (const item of pricingItems) {
    const hasSource = item.source_estimate_line_item_id != null;
    const sourceMissing =
      hasSource && !estimateIds.has(item.source_estimate_line_item_id!);
    const unmatched = !matchedPricingIds.has(item.id);

    if (hasSource && (sourceMissing || unmatched)) {
      summary.orphaned += 1;
      items.push({
        classification: "orphaned",
        pricingItemId: item.id,
        estimateLineItemId: item.source_estimate_line_item_id ?? undefined,
        label: item.internal_label,
        beforeCost: item.total_cost,
        beforeSell: item.total_sell,
        afterCost: null,
        afterSell: null,
        manuallyEdited: item.manually_edited,
        orphaned: true,
        note: ORPHANED_SOURCE_NOTE,
      });
    }
  }

  const difference = roundMoney(
    latestEstimateRecommendedSell - currentPricingSubtotalSell
  );
  const differencePercent =
    currentPricingSubtotalSell > 0
      ? roundPercent((difference / currentPricingSubtotalSell) * 100)
      : latestEstimateRecommendedSell > 0
        ? 100
        : 0;

  return {
    summary,
    currentPricingSubtotalSell,
    latestEstimateRecommendedSell,
    difference,
    differencePercent,
    items,
  };
}

export function buildPricingItemRowFromEstimate(
  lineItem: EstimateLineItemRow,
  orgId: string,
  pricingDocumentId: string,
  projectId: string,
  sortOrder: number
) {
  const values = valuesFromEstimateLineItem(lineItem);

  return {
    org_id: orgId,
    pricing_document_id: pricingDocumentId,
    project_id: projectId,
    work_area_id: lineItem.work_area_id,
    source_estimate_line_item_id: lineItem.id,
    item_type: values.itemType,
    delivery_method: values.deliveryMethod,
    internal_label: lineItem.label,
    client_label: cleanClientLabel(lineItem.label),
    internal_description: values.details.internalDescription ?? null,
    client_description: values.details.internalDescription ?? null,
    quantity: values.quantity,
    unit: values.details.unit ?? null,
    unit_cost: values.unitCost,
    unit_sell: values.unitSell,
    total_cost: values.totalCost,
    total_sell: values.totalSell,
    gross_profit: values.grossProfit,
    margin_percent: values.marginPercent,
    markup_percent: values.markupPercent,
    visible_on_quote: true,
    optional: false,
    sort_order: sortOrder,
    manually_edited: false,
    orphaned: false,
    recalibration_note: null,
    notes_internal: values.details.internalDescription ?? null,
  };
}

export function buildPricingItemUpdateFromEstimate(
  lineItem: EstimateLineItemRow,
  existing: PricingItem
) {
  const values = valuesFromEstimateLineItem(lineItem);

  return {
    work_area_id: lineItem.work_area_id,
    source_estimate_line_item_id: lineItem.id,
    item_type: values.itemType,
    delivery_method: values.deliveryMethod,
    internal_label: lineItem.label,
    client_label: cleanClientLabel(lineItem.label),
    internal_description: values.details.internalDescription ?? null,
    client_description: values.details.internalDescription ?? null,
    quantity: values.quantity,
    unit: values.details.unit ?? null,
    unit_cost: values.unitCost,
    unit_sell: values.unitSell,
    total_cost: values.totalCost,
    total_sell: values.totalSell,
    gross_profit: values.grossProfit,
    margin_percent: values.marginPercent,
    markup_percent: values.markupPercent,
    orphaned: false,
    recalibration_note: null,
    manually_edited: false,
    sort_order: existing.sort_order,
    visible_on_quote: existing.visible_on_quote,
    optional: existing.optional,
    notes_client: existing.notes_client,
  };
}
