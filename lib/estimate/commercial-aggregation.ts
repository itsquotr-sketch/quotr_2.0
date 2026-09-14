/**
 * Generic same-identity commercial aggregation.
 *
 * SUM eligible lines that share a caller-supplied grouping key BEFORE
 * exclusive-owner collapse. Eligibility and grouping stay caller-controlled.
 * Do not blindly aggregate every same item_key.
 */

import { round2 } from "@/lib/estimate/facts";
import type { EstimateLineItemInput } from "@/lib/estimate/types";

export type SameIdentityAggregationOptions<T extends EstimateLineItemInput> = {
  readonly isEligible: (item: T) => boolean;
  readonly groupingKey: (item: T) => string | null;
  readonly merge?: (members: readonly T[]) => T;
  readonly areCompatible?: (a: T, b: T) => boolean;
};

/**
 * Same materialKey is not enough. Company vs manual, sell authority,
 * ownership, and priced vs Pricing Required must stay separate.
 */
type AggregationCompatibilityFields = Pick<
  EstimateLineItemInput,
  | "workAreaId"
  | "itemKey"
  | "unit"
  | "category"
  | "componentKey"
  | "componentId"
  | "rateSource"
  | "rateSourceType"
  | "sellAuthority"
  | "pricingOwner"
  | "scopeKey"
  | "includedInTotal"
>;

export function commercialLinesAggregationCompatible(
  a: AggregationCompatibilityFields,
  b: AggregationCompatibilityFields
): boolean {
  if (a.workAreaId !== b.workAreaId) return false;
  if ((a.itemKey ?? "") !== (b.itemKey ?? "")) return false;
  if ((a.unit ?? "") !== (b.unit ?? "")) return false;
  if (a.category !== b.category) return false;
  if ((a.componentKey ?? "") !== (b.componentKey ?? "")) return false;
  if ((a.componentId ?? "") !== (b.componentId ?? "")) return false;
  if ((a.rateSource ?? "") !== (b.rateSource ?? "")) return false;
  if ((a.rateSourceType ?? "") !== (b.rateSourceType ?? "")) return false;
  if ((a.sellAuthority ?? "") !== (b.sellAuthority ?? "")) return false;
  if ((a.pricingOwner ?? "") !== (b.pricingOwner ?? "")) return false;
  if ((a.scopeKey ?? "") !== (b.scopeKey ?? "")) return false;
  if ((a.includedInTotal ?? true) !== (b.includedInTotal ?? true)) return false;
  const aMissing = a.rateSourceType === "missing";
  const bMissing = b.rateSourceType === "missing";
  if (aMissing !== bMissing) return false;
  return true;
}

export function defaultMergeSameIdentityCommercialLines<
  T extends EstimateLineItemInput,
>(members: readonly T[]): T {
  const first = members[0]!;
  if (members.length === 1) return first;
  const labourHours = members.reduce(
    (sum, item) => sum + Number(item.labourHours ?? 0),
    0
  );
  const hasLabour = members.some((item) => item.labourHours != null);
  return {
    ...first,
    quantity: round2(
      members.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0)
    ),
    labourHours: hasLabour ? round2(labourHours) : first.labourHours,
    recommendedCost: round2(
      members.reduce((sum, item) => sum + Number(item.recommendedCost ?? 0), 0)
    ),
    recommendedSell: round2(
      members.reduce((sum, item) => sum + Number(item.recommendedSell ?? 0), 0)
    ),
    grossProfit: round2(
      members.reduce((sum, item) => sum + Number(item.grossProfit ?? 0), 0)
    ),
    costLow: round2(
      members.reduce((sum, item) => sum + Number(item.costLow ?? 0), 0)
    ),
    costHigh: round2(
      members.reduce((sum, item) => sum + Number(item.costHigh ?? 0), 0)
    ),
    sellLow: round2(
      members.reduce((sum, item) => sum + Number(item.sellLow ?? 0), 0)
    ),
    sellHigh: round2(
      members.reduce((sum, item) => sum + Number(item.sellHigh ?? 0), 0)
    ),
  };
}

/**
 * Walk items in order. First eligible occurrence of a grouping key becomes
 * the merged line (first-item provenance). Later members of that key are
 * consumed. Ineligible / ungrouped lines pass through unchanged.
 */
function partitionCompatible<T extends EstimateLineItemInput>(
  members: readonly T[],
  areCompatible?: (a: T, b: T) => boolean
): T[][] {
  if (!areCompatible || members.length <= 1) {
    return members.length ? [[...members]] : [];
  }
  const clusters: T[][] = [];
  for (const item of members) {
    const cluster = clusters.find((list) =>
      list.every(
        (member) =>
          areCompatible(member, item) &&
          commercialLinesAggregationCompatible(member, item)
      )
    );
    if (cluster) cluster.push(item);
    else clusters.push([item]);
  }
  return clusters;
}

export function aggregateSameIdentityCommercialLines<
  T extends EstimateLineItemInput,
>(items: readonly T[], options: SameIdentityAggregationOptions<T>): T[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    if (!options.isEligible(item)) continue;
    const key = options.groupingKey(item);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  const consumed = new Set<T>();
  const merge = options.merge ?? defaultMergeSameIdentityCommercialLines;
  const out: T[] = [];
  for (const item of items) {
    if (!options.isEligible(item)) {
      out.push(item);
      continue;
    }
    const key = options.groupingKey(item);
    if (!key) {
      out.push(item);
      continue;
    }
    if (consumed.has(item)) continue;
    const members = groups.get(key) ?? [item];
    const clusters = partitionCompatible(members, options.areCompatible);
    const cluster =
      clusters.find((list) => list.includes(item)) ?? [item];
    for (const member of cluster) consumed.add(member);
    out.push(cluster.length === 1 ? item : merge(cluster));
  }
  return out;
}
