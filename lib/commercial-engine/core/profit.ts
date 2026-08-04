import { roundMoney, roundPercent } from "./money";

export type ProfitMetrics = {
  readonly gross_profit: number | null;
  readonly gross_margin_percent: number | null;
  readonly markup_percent: number | null;
  /** False when cost is unknown (e.g. sell-only lump); do not fabricate margin. */
  readonly cost_known: boolean;
};

/**
 * Gross profit triad (F-GP, F-M, F-MU).
 * When cost is unknown, margin/markup/GP are null — do not fabricate 100% margin.
 */
export function deriveProfitMetrics(
  totalCost: number,
  totalSell: number,
  options?: { costKnown?: boolean }
): ProfitMetrics {
  const costKnown = options?.costKnown ?? true;

  if (!costKnown) {
    return {
      gross_profit: null,
      gross_margin_percent: null,
      markup_percent: null,
      cost_known: false,
    };
  }

  const gross_profit = roundMoney(totalSell - totalCost);
  const gross_margin_percent =
    totalSell > 0 ? roundPercent((gross_profit / totalSell) * 100) : 0;
  const markup_percent =
    totalCost > 0 ? roundPercent((gross_profit / totalCost) * 100) : 0;

  return {
    gross_profit,
    gross_margin_percent,
    markup_percent,
    cost_known: true,
  };
}
