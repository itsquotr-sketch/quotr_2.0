/**
 * BETA-3 — document-level final-price presentation and line sell allocation.
 *
 * Uses existing per-line sell override authority. Does not change cost,
 * GST formula, or gross-margin formula (GP ÷ sell).
 */

import {
  MAX_GROSS_MARGIN_PERCENT,
  MIN_GROSS_MARGIN_PERCENT,
  validateGrossMarginPercent,
} from "@/lib/security/margin-validation";
import type { PricingItem } from "@/lib/pricing/types";

const CENTS = 100;

export function roundMoneyCents(value: number): number {
  return Math.round(value * CENTS) / CENTS;
}

export function sellsMatchRecommended(
  currentSell: number,
  recommendedSell: number | null | undefined,
  epsilon = 0.02
): boolean {
  if (recommendedSell == null || !Number.isFinite(recommendedSell)) {
    return false;
  }
  return Math.abs(currentSell - recommendedSell) <= epsilon;
}

/** Display-only expected gross margin from stored cost and a candidate sell. */
export function presentExpectedGrossMarginPercent(
  estimatedCost: number,
  finalSell: number
): { ok: true; marginPercent: number } | { ok: false; error: string } {
  if (!Number.isFinite(estimatedCost) || estimatedCost < 0) {
    return { ok: false, error: "Estimated cost is not available." };
  }
  if (!Number.isFinite(finalSell)) {
    return { ok: false, error: "Enter a valid final price." };
  }
  if (finalSell < 0) {
    return { ok: false, error: "Final price cannot be negative." };
  }
  if (finalSell === 0) {
    if (estimatedCost === 0) {
      return { ok: true, marginPercent: 0 };
    }
    return {
      ok: false,
      error: "Final price cannot be zero when there is an estimated cost.",
    };
  }
  const marginPercent = ((finalSell - estimatedCost) / finalSell) * 100;
  const bounds = validateGrossMarginPercent(marginPercent);
  if (!bounds.ok) {
    if (marginPercent < MIN_GROSS_MARGIN_PERCENT) {
      return {
        ok: false,
        error: "That price is below estimated cost. Enter a higher price.",
      };
    }
    if (marginPercent > MAX_GROSS_MARGIN_PERCENT) {
      return {
        ok: false,
        error: `That price is too high for the allowed ${MAX_GROSS_MARGIN_PERCENT}% gross margin.`,
      };
    }
    return { ok: false, error: bounds.message };
  }
  return { ok: true, marginPercent };
}

export type FinalSellAllocation = {
  readonly itemId: string;
  readonly totalSell: number;
};

export type AllocateFinalSellResult =
  | { ok: true; allocations: readonly FinalSellAllocation[] }
  | { ok: false; error: string };

export function allocateFinalSell(
  items: readonly Pick<PricingItem, "id" | "total_sell" | "total_cost" | "cost_known">[],
  targetSell: number
): AllocateFinalSellResult {
  if (!Number.isFinite(targetSell)) {
    return { ok: false, error: "Enter a valid final price." };
  }
  if (targetSell < 0) {
    return { ok: false, error: "Final price cannot be negative." };
  }

  const knownCost = items.reduce(
    (sum, item) => sum + (item.cost_known === false ? 0 : item.total_cost),
    0
  );
  const anyCostKnown = items.some((item) => item.cost_known !== false);
  if (anyCostKnown) {
    const margin = presentExpectedGrossMarginPercent(knownCost, targetSell);
    if (!margin.ok) {
      return margin;
    }
  }

  const currentSell = roundMoneyCents(
    items.reduce((sum, item) => sum + item.total_sell, 0)
  );
  if (currentSell <= 0) {
    return {
      ok: false,
      error: "Price the line items first, then set your final price.",
    };
  }

  const target = roundMoneyCents(targetSell);
  if (Math.abs(currentSell - target) < 0.005) {
    return {
      ok: true,
      allocations: items.map((item) => ({
        itemId: item.id,
        totalSell: roundMoneyCents(item.total_sell),
      })),
    };
  }

  const scale = target / currentSell;
  const allocations: FinalSellAllocation[] = [];
  let allocated = 0;
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]!;
    const isLast = index === items.length - 1;
    const nextSell = isLast
      ? roundMoneyCents(target - allocated)
      : roundMoneyCents(item.total_sell * scale);
    if (nextSell < 0) {
      return { ok: false, error: "Final price cannot be negative." };
    }
    allocated = roundMoneyCents(allocated + nextSell);
    allocations.push({ itemId: item.id, totalSell: nextSell });
  }

  return { ok: true, allocations };
}

export function unitSellForAllocatedTotal(item: {
  calculation_mode: PricingItem["calculation_mode"];
  quantity: number | null;
  calculated_quantity: number | null;
  unit_sell: number | null;
  totalSell: number;
}): number | null {
  if (item.calculation_mode === "productivity_labour") {
    const hours = item.calculated_quantity;
    if (hours != null && hours > 0) {
      return roundMoneyCents(item.totalSell / hours);
    }
  }
  const quantity = item.quantity;
  if (quantity != null && quantity > 0) {
    return roundMoneyCents(item.totalSell / quantity);
  }
  return item.unit_sell;
}
