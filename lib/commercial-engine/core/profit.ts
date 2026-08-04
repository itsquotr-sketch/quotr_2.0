import { roundMoney, roundPercent } from "./money";

export type ProfitMetrics = {
  readonly gross_profit: number;
  readonly gross_margin_percent: number;
  readonly markup_percent: number;
};

/**
 * Gross profit triad (F-GP, F-M, F-MU).
 * Margin = GP ÷ sell; markup = GP ÷ cost (derived metric only).
 */
export function deriveProfitMetrics(
  totalCost: number,
  totalSell: number
): ProfitMetrics {
  const gross_profit = roundMoney(totalSell - totalCost);
  const gross_margin_percent =
    totalSell > 0 ? roundPercent((gross_profit / totalSell) * 100) : 0;
  const markup_percent =
    totalCost > 0 ? roundPercent((gross_profit / totalCost) * 100) : 0;

  return { gross_profit, gross_margin_percent, markup_percent };
}
