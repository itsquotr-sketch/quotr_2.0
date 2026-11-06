import {
  buildPersistedLineItemNotes,
  buildPricingNotesFromEstimateLineItem,
  parseLineItemNotes,
  stampSellAuthorityOnNotes,
} from "@/lib/estimate/line-item-metadata";
import { pricingOwnerToDeliveryMethod } from "@/lib/estimate/pricing-ownership";
import {
  cleanClientLabel,
  mapEstimateCategoryToItemType,
  roundMoney,
  roundPercent,
} from "@/lib/pricing/calculations";
import { calculateAuthoritativeFieldsFromEstimateLine } from "@/lib/pricing/estimate-to-pricing-adapter";
import { estimateLineIsQuoteVisible } from "@/lib/pricing/scope-finalisation";
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
  component_key?: string | null;
};

export type RecalibrationItemClassification =
  | "unchanged"
  | "will_update"
  | "manually_protected"
  | "new_item"
  | "orphaned"
  | "needs_review";

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
    needsReview: number;
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
  "This generated row will be removed. Its estimate requirement is no longer in the latest estimate.";

export const REVIEW_RETAINED_NOTE =
  "Kept for review. This row was edited, entered manually, or has no stable estimate requirement, so it was not removed.";

export const QUOTE_VISIBILITY_HIDE_NOTE =
  "This row will be hidden from the customer quote. Quantity and price are unchanged, and the task stays unresolved.";

export const QUOTE_VISIBILITY_SHOW_NOTE =
  "This row will be shown on the customer quote. Quantity and price are unchanged.";

export const QUOTE_VISIBILITY_KEPT_NOTE =
  "Quote visibility was chosen in Pricing and is kept. Review that choice before changing it.";

export type QuoteVisibilityChange = "same" | "show" | "hide" | "kept";

export function pricingDraftReconciliationBlocked(
  status: string | null | undefined
): string | null {
  if (status === "converted_to_quote") {
    return "An issued quote is not changed when the estimate is updated.";
  }
  return null;
}

/** Issued and archived documents are not offered a visibility update. */
export function quoteVisibilityDriftApplies(
  status: string | null | undefined
): boolean {
  if (pricingDraftReconciliationBlocked(status)) return false;
  if (status === "archived") return false;
  return true;
}

export function quoteVisibilityOverridden(item: PricingItem): boolean {
  return parseLineItemNotes(item.notes_internal).metadata.quoteVisibilityOverride === true;
}

export function stampQuoteVisibilityOverride(
  notes: string | null | undefined
): string | null {
  const parsed = parseLineItemNotes(notes);
  return buildPersistedLineItemNotes({
    notes: parsed.displayNotes,
    metadata: {
      ...parsed.metadata,
      quoteVisibilityOverride: true,
    },
  });
}

export function sourceRowQuoteVisible(line: EstimateLineItemRow): boolean {
  return estimateLineIsQuoteVisible(parseLineItemNotes(line.notes).metadata);
}

/**
 * Visibility for a row already matched by source id or requirement scope.
 * A price of zero does not decide this. Label, position, and amount do not either.
 */
export function untouchedGeneratedQuoteChange(
  item: PricingItem,
  line: EstimateLineItemRow
): QuoteVisibilityChange {
  const sourceVisible = sourceRowQuoteVisible(line);
  const currentVisible = item.visible_on_quote !== false;
  if (sourceVisible === currentVisible) return "same";
  if (quoteVisibilityOverridden(item)) return "kept";
  return sourceVisible ? "show" : "hide";
}

export function generatedQuoteVisibilityDrift(
  estimateLineItems: EstimateLineItemRow[],
  pricingItems: PricingItem[]
): boolean {
  const matches = matchPricingToEstimateLines(estimateLineItems, pricingItems);
  for (const line of estimateLineItems) {
    const match = matches.get(line.id);
    if (!match || isManualCommercialRow(match)) continue;
    const change = untouchedGeneratedQuoteChange(match, line);
    if (change !== "same") return true;
  }
  return false;
}

/** False when an explicit update must leave this matched row's visibility and money alone. */
export function shouldApplyMatchedPricingUpdate(
  existing: PricingItem,
  lineItem: EstimateLineItemRow
): boolean {
  if (isManualCommercialRow(existing)) return false;
  const visibility = untouchedGeneratedQuoteChange(existing, lineItem);
  const moneyMatches = valuesMateriallyMatch(existing, lineItem);
  if (visibility === "kept" && moneyMatches) return false;
  if (
    moneyMatches &&
    visibility === "same" &&
    existing.source_estimate_line_item_id === lineItem.id &&
    existing.recalibration_note == null
  ) {
    return false;
  }
  return true;
}

function quoteVisibilityPreviewNote(
  change: QuoteVisibilityChange
): string | undefined {
  if (change === "hide") return QUOTE_VISIBILITY_HIDE_NOTE;
  if (change === "show") return QUOTE_VISIBILITY_SHOW_NOTE;
  if (change === "kept") return QUOTE_VISIBILITY_KEPT_NOTE;
  return undefined;
}

function sameNumber(
  left: number | null | undefined,
  right: number | null | undefined
): boolean {
  const a = left == null || !Number.isFinite(Number(left)) ? null : Number(left);
  const b = right == null || !Number.isFinite(Number(right)) ? null : Number(right);
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) < 0.0001;
}

function requirementScope(
  notes: string | null | undefined
): string | null {
  const scope = parseLineItemNotes(notes).metadata.scopeKey?.trim();
  return scope || null;
}

export function isManualCommercialRow(item: PricingItem): boolean {
  if (item.manually_edited) return true;
  return parseLineItemNotes(item.notes_internal).metadata.pricingSource === "user_override";
}

export function estimateRequirementScopes(
  estimateLineItems: readonly EstimateLineItemRow[]
): Set<string> {
  const scopes = new Set<string>();
  for (const line of estimateLineItems) {
    const scope = requirementScope(line.notes);
    if (scope) scopes.add(scope);
  }
  return scopes;
}

/**
 * An untouched generated row whose requirement is gone.
 * A null source id is not enough: regenerate deletes estimate lines and the
 * foreign key clears source_estimate_line_item_id. The scope key in the
 * notes is the stable requirement identity.
 */
export function generatedRowLostItsRequirement(
  item: PricingItem,
  estimateIds: ReadonlySet<string>,
  estimateScopes: ReadonlySet<string>
): boolean {
  if (isManualCommercialRow(item)) return false;
  const scope = requirementScope(item.notes_internal);
  const sourceId = item.source_estimate_line_item_id;
  const sourceLive = sourceId != null && estimateIds.has(sourceId);
  if (sourceLive) return false;
  if (scope && estimateScopes.has(scope)) return false;
  return Boolean(scope) || sourceId != null;
}

export function pricingRowsToRetire(
  pricingItems: readonly PricingItem[],
  matchedIds: ReadonlySet<string>,
  estimateIds: ReadonlySet<string>,
  estimateScopes: ReadonlySet<string>
): string[] {
  return pricingItems
    .filter(
      (item) =>
        !matchedIds.has(item.id) &&
        generatedRowLostItsRequirement(item, estimateIds, estimateScopes)
    )
    .map((item) => item.id);
}

export function pricingRowsNeedingReviewNote(
  pricingItems: readonly PricingItem[],
  matchedIds: ReadonlySet<string>,
  estimateIds: ReadonlySet<string>,
  estimateScopes: ReadonlySet<string>
): string[] {
  return pricingItems
    .filter(
      (item) =>
        !matchedIds.has(item.id) &&
        !generatedRowLostItsRequirement(item, estimateIds, estimateScopes) &&
        item.recalibration_note !== REVIEW_RETAINED_NOTE
    )
    .map((item) => item.id);
}

export function valuesFromEstimateLineItem(lineItem: EstimateLineItemRow) {
  const itemType = mapEstimateCategoryToItemType(lineItem.category);
  const { metadata } = parseLineItemNotes(lineItem.notes);
  const deliveryMethod = pricingOwnerToDeliveryMethod(
    metadata.pricingOwner,
    itemType
  );

  const authoritative = calculateAuthoritativeFieldsFromEstimateLine(
    lineItem,
    `estimate-line-${lineItem.id}`
  );
  if (!authoritative.ok) {
    throw new Error(authoritative.error);
  }
  const fields = authoritative.fields;
  const sellAuthority = authoritative.sellAuthority;

  return {
    itemType,
    deliveryMethod,
    pricingOwner: metadata.pricingOwner,
    scopeKey: metadata.scopeKey,
    overlapGroup: metadata.overlapGroup,
    includedInTotal: metadata.includedInTotal,
    clientVisible: metadata.clientVisible,
    quantity: fields.quantity,
    unit: fields.unit,
    unitCost: fields.unitCost,
    unitSell: fields.unitSell,
    totalCost: fields.totalCost,
    totalSell: fields.totalSell,
    grossProfit: fields.grossProfit,
    marginPercent: fields.marginPercent,
    markupPercent: fields.markupPercent,
    calculationMode: fields.calculationMode,
    productivityRate: fields.productivityRate,
    productivityUnit: fields.productivityUnit,
    calculatedQuantity: fields.calculatedQuantity,
    costKnown: fields.costKnown,
    internalDescription: parseDisplayNotes(lineItem.notes),
    notesInternal: stampSellAuthorityOnNotes(
      buildPricingNotesFromEstimateLineItem(lineItem.notes),
      sellAuthority
    ),
    sellAuthority,
  };
}

function parseDisplayNotes(notes: string | null | undefined): string | null {
  if (!notes) {
    return null;
  }
  const marker = "\n__quotr_meta__:";
  const markerIndex = notes.indexOf(marker);
  const displayNotes =
    markerIndex === -1 ? notes : notes.slice(0, markerIndex).trim();
  return displayNotes || null;
}

/**
 * Money, quantity, and wording. Quote visibility is a separate comparison:
 * an untouched generated row can match here and still need a visibility update.
 */
export function valuesMateriallyMatch(
  pricingItem: PricingItem,
  lineItem: EstimateLineItemRow
): boolean {
  const estimateValues = valuesFromEstimateLineItem(lineItem);
  return (
    pricingItem.total_cost === estimateValues.totalCost &&
    pricingItem.total_sell === estimateValues.totalSell &&
    pricingItem.internal_label.trim() === lineItem.label.trim() &&
    sameNumber(pricingItem.quantity, estimateValues.quantity) &&
    (pricingItem.unit ?? "") === (estimateValues.unit ?? "") &&
    (pricingItem.component_key ?? null) === (lineItem.component_key ?? null) &&
    (pricingItem.internal_description ?? "").trim() ===
      (estimateValues.internalDescription ?? "").trim()
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
  const byScope = new Map<string, PricingItem>();

  for (const item of pricingItems) {
    if (
      item.source_estimate_line_item_id &&
      estimateIds.has(item.source_estimate_line_item_id)
    ) {
      bySourceId.set(item.source_estimate_line_item_id, item);
    }
    const scope = requirementScope(item.notes_internal);
    if (scope && !byScope.has(scope)) {
      byScope.set(scope, item);
    }
  }

  for (const lineItem of estimateLineItems) {
    let match = bySourceId.get(lineItem.id) ?? null;
    const lineScope = requirementScope(lineItem.notes);

    if (match && usedPricingIds.has(match.id)) {
      match = null;
    }

    if (!match && lineScope) {
      const scopeMatch = byScope.get(lineScope) ?? null;
      if (scopeMatch && !usedPricingIds.has(scopeMatch.id)) {
        match = scopeMatch;
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
    needsReview: 0,
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

    if (isManualCommercialRow(match)) {
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

    const moneyMatches = valuesMateriallyMatch(match, lineItem);
    const visibility = untouchedGeneratedQuoteChange(match, lineItem);
    const visibilityNote = quoteVisibilityPreviewNote(visibility);
    if (visibility === "kept" && moneyMatches) {
      summary.needsReview += 1;
      items.push({
        classification: "needs_review",
        pricingItemId: match.id,
        estimateLineItemId: lineItem.id,
        label: match.internal_label,
        beforeCost: match.total_cost,
        beforeSell: match.total_sell,
        afterCost: estimateValues.totalCost,
        afterSell: estimateValues.totalSell,
        manuallyEdited: false,
        orphaned: false,
        note: QUOTE_VISIBILITY_KEPT_NOTE,
      });
      continue;
    }

    if (moneyMatches && visibility === "same") {
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
      note: visibilityNote,
    });
  }

  const estimateScopes = estimateRequirementScopes(estimateLineItems);
  for (const item of pricingItems) {
    if (matchedPricingIds.has(item.id)) continue;
    if (generatedRowLostItsRequirement(item, estimateIds, estimateScopes)) {
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
      continue;
    }
    summary.needsReview += 1;
    items.push({
      classification: "needs_review",
      pricingItemId: item.id,
      estimateLineItemId: item.source_estimate_line_item_id ?? undefined,
      label: item.internal_label,
      beforeCost: item.total_cost,
      beforeSell: item.total_sell,
      afterCost: item.total_cost,
      afterSell: item.total_sell,
      manuallyEdited: item.manually_edited,
      orphaned: false,
      note: REVIEW_RETAINED_NOTE,
    });
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

function pricingFieldsToRowValues(
  values: ReturnType<typeof valuesFromEstimateLineItem>
) {
  return {
    quantity: values.quantity,
    unit: values.unit,
    unit_cost: values.unitCost,
    unit_sell: values.unitSell,
    total_cost: values.totalCost,
    total_sell: values.totalSell,
    gross_profit: values.grossProfit,
    margin_percent: values.marginPercent,
    markup_percent: values.markupPercent,
    calculation_mode: values.calculationMode,
    productivity_rate: values.productivityRate,
    productivity_unit: values.productivityUnit,
    calculated_quantity: values.calculatedQuantity,
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
    internal_description: values.internalDescription,
    client_description: null,
    ...pricingFieldsToRowValues(values),
    visible_on_quote: estimateLineIsQuoteVisible(values),
    optional: false,
    sort_order: sortOrder,
    manually_edited: false,
    orphaned: false,
    recalibration_note: null,
    notes_internal: values.notesInternal,
    component_key: lineItem.component_key ?? null,
  };
}

export function buildPricingItemUpdateFromEstimate(
  lineItem: EstimateLineItemRow,
  existing: PricingItem
) {
  const values = valuesFromEstimateLineItem(lineItem);
  const followSourceVisibility = !quoteVisibilityOverridden(existing);

  return {
    work_area_id: lineItem.work_area_id,
    source_estimate_line_item_id: lineItem.id,
    item_type: values.itemType,
    delivery_method: values.deliveryMethod,
    internal_label: lineItem.label,
    client_label: cleanClientLabel(lineItem.label),
    internal_description: values.internalDescription,
    client_description: existing.client_description,
    ...pricingFieldsToRowValues(values),
    orphaned: false,
    recalibration_note: null,
    manually_edited: false,
    sort_order: existing.sort_order,
    visible_on_quote: followSourceVisibility
      ? estimateLineIsQuoteVisible(values)
      : existing.visible_on_quote,
    optional: existing.optional,
    notes_client: existing.notes_client,
    notes_internal: followSourceVisibility
      ? values.notesInternal
      : stampQuoteVisibilityOverride(values.notesInternal),
    component_key: lineItem.component_key ?? existing.component_key ?? null,
  };
}
