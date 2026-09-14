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
};

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

  const seen = new Set<string>();
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
    if (seen.has(key)) continue;
    seen.add(key);
    const members = groups.get(key) ?? [item];
    out.push(members.length === 1 ? item : merge(members));
  }
  return out;
}
