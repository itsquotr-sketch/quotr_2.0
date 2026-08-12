/**
 * Stage 3.2.2-R2 — Margin pending presentation helpers.
 *
 * Recommended sell / GP reuse the shared legacy triad (same sell-from-cost
 * core as production). Ranges are scaled from the last authoritative totals
 * until the server returns applyMarginToAmounts aggregates — not a second
 * commercial authority.
 */

import { recalculateSellFromCost } from "@/lib/estimate/margin-override";
import { round2 } from "@/lib/estimate/facts";

export type MarginTotalsOverlay = {
  readonly recommendedSell: number;
  readonly grossProfit: number;
  readonly marginPercent: number;
  readonly sellLow: number;
  readonly sellHigh: number;
  readonly targetMarginPercent: number | null;
};

export function buildPendingMarginTotals(params: {
  readonly recommendedCost: number;
  readonly marginPercent: number;
  readonly previousSell: number;
  readonly previousSellLow: number;
  readonly previousSellHigh: number;
  readonly targetMarginPercent: number | null;
}): MarginTotalsOverlay {
  const triad = recalculateSellFromCost(
    params.recommendedCost,
    params.marginPercent
  );
  const scale =
    params.previousSell > 0 ? triad.recommendedSell / params.previousSell : 1;

  return {
    recommendedSell: triad.recommendedSell,
    grossProfit: triad.grossProfit,
    marginPercent: triad.marginPercent,
    sellLow: round2(params.previousSellLow * scale),
    sellHigh: round2(params.previousSellHigh * scale),
    targetMarginPercent: params.targetMarginPercent,
  };
}

export function marginTotalsMatchEstimate(
  estimate: {
    recommendedSell: number;
    grossProfit: number;
    marginPercent: number;
    sellLow: number;
    sellHigh: number;
    targetMarginPercent?: number | null;
  },
  overlay: MarginTotalsOverlay
): boolean {
  const marginClose =
    Math.abs(estimate.marginPercent - overlay.marginPercent) < 0.05;
  const sellClose =
    Math.abs(estimate.recommendedSell - overlay.recommendedSell) < 0.02;
  const targetMatch =
    (estimate.targetMarginPercent ?? null) === overlay.targetMarginPercent;
  return marginClose && sellClose && targetMatch;
}
