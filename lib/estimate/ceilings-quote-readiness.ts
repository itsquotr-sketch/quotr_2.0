/**
 * CEILINGS WA-06 — quote readiness for unresolved nested Pricing Required.
 *
 * Builder Review and Pricing stay open. Final Quote send/create is blocked
 * until Ceiling PR lines intended for customer scope are resolved.
 * Uses existing cost_known / rateSourceType=missing semantics.
 */

import { parseLineItemNotes } from "@/lib/estimate/line-item-metadata";
import { CEILINGS_PARTIAL_ESTIMATE_MESSAGE } from "@/lib/estimate/ceilings-identities";

export const CEILINGS_QUOTE_PR_BLOCK_MESSAGE =
  "Some Ceiling items still require pricing. Resolve Pricing Required lines before sending a final quote.";

export const CEILINGS_BUILDER_REVIEW_PARTIAL_MESSAGE =
  "Some Ceiling items still require pricing.";

export function isCeilingCommercialIdentity(params: {
  readonly componentKey?: string | null;
  readonly itemKey?: string | null;
  readonly notes?: string | null;
  readonly label?: string | null;
}): boolean {
  const component = (params.componentKey ?? "").toLowerCase();
  if (component.startsWith("ceilings.")) return true;
  const itemKey = (params.itemKey ?? "").toLowerCase();
  if (
    itemKey.startsWith("steel.ceiling.") ||
    itemKey.startsWith("ceiling.grid") ||
    itemKey.startsWith("ceiling.tile") ||
    itemKey.startsWith("ceiling.insulation") ||
    itemKey.startsWith("timber.lining.profile")
  ) {
    return true;
  }
  const blob = `${params.notes ?? ""} ${params.label ?? ""}`.toLowerCase();
  return (
    blob.includes("ceilings.") ||
    blob.includes("steel.ceiling.") ||
    /\b(primary channel|furring channel|perimeter track|ceiling grid|ceiling tile|ceiling insulation)\b/.test(
      blob
    )
  );
}

export function isUnresolvedCeilingPricingRequired(params: {
  readonly componentKey?: string | null;
  readonly itemKey?: string | null;
  readonly notes?: string | null;
  readonly label?: string | null;
  readonly totalCost?: number | null;
  readonly totalSell?: number | null;
  readonly unitCost?: number | null;
  readonly costKnown?: boolean | null;
  readonly rateSourceType?: string | null;
}): boolean {
  if (!isCeilingCommercialIdentity(params)) return false;
  const cost = Number(params.totalCost ?? 0);
  const sell = Number(params.totalSell ?? 0);
  if (cost > 0 || (params.unitCost != null && params.unitCost > 0)) {
    return false;
  }
  const meta = parseLineItemNotes(params.notes);
  const rateMissing =
    params.rateSourceType === "missing" ||
    meta.metadata.rateSourceType === "missing";
  if (rateMissing) return true;
  if (params.costKnown === false && cost <= 0) return true;
  return cost === 0 && sell === 0 && rateMissing;
}

export function ceilingsQuoteBlockingLabels(
  missingInfo: readonly string[]
): string[] {
  return missingInfo.filter((row) =>
    /partial estimate|pricing required/i.test(row)
  );
}

export function nestedCeilingsQuoteIsBlocked(params: {
  readonly missingInfo?: readonly string[];
  readonly items?: readonly {
    readonly component_key?: string | null;
    readonly componentKey?: string | null;
    readonly itemKey?: string | null;
    readonly notes_internal?: string | null;
    readonly notes?: string | null;
    readonly client_label?: string | null;
    readonly label?: string | null;
    readonly total_cost?: number | null;
    readonly total_sell?: number | null;
    readonly unit_cost?: number | null;
    readonly cost_known?: boolean | null;
  }[];
}): boolean {
  if (
    (params.missingInfo ?? []).some(
      (row) =>
        row === CEILINGS_PARTIAL_ESTIMATE_MESSAGE ||
        /partial estimate — pricing required/i.test(row)
    )
  ) {
    const stillOpen = (params.items ?? []).some((item) =>
      isUnresolvedCeilingPricingRequired({
        componentKey: paramsItemComponent(item),
        itemKey: item.itemKey,
        notes: item.notes_internal ?? item.notes,
        label: item.client_label ?? item.label,
        totalCost: item.total_cost,
        totalSell: item.total_sell,
        unitCost: item.unit_cost,
        costKnown: item.cost_known,
      })
    );
    if (!params.items || params.items.length === 0) return true;
    return stillOpen;
  }
  return (params.items ?? []).some((item) =>
    isUnresolvedCeilingPricingRequired({
      componentKey: paramsItemComponent(item),
      itemKey: item.itemKey,
      notes: item.notes_internal ?? item.notes,
      label: item.client_label ?? item.label,
      totalCost: item.total_cost,
      totalSell: item.total_sell,
      unitCost: item.unit_cost,
      costKnown: item.cost_known,
    })
  );
}

function paramsItemComponent(item: {
  readonly component_key?: string | null;
  readonly componentKey?: string | null;
}): string | null {
  return item.component_key ?? item.componentKey ?? null;
}
