/**
 * Presentation-only profitability / money display helpers — Batch 2B.9.
 * Must not calculate sell, profit, margin, GST, or aggregates.
 */

import {
  formatPricingMoney,
  formatPricingPercent,
} from "@/lib/pricing/format";

export const COST_UNKNOWN_LABEL = "Cost unknown";
export const PROFITABILITY_UNAVAILABLE_LABEL = "Profitability unavailable";
export const MARGIN_UNAVAILABLE_LABEL = "Margin unavailable";

export type ProfitabilityDisplay = {
  readonly costKnown: boolean;
  readonly profitLabel: string;
  readonly marginLabel: string;
  readonly markupLabel: string;
};

/**
 * Format profitability for UI. Unknown cost never shows fabricated margins.
 */
export function formatProfitabilityDisplay(input: {
  costKnown: boolean;
  grossProfit: number;
  marginPercent: number;
  markupPercent?: number | null;
}): ProfitabilityDisplay {
  if (!input.costKnown) {
    return {
      costKnown: false,
      profitLabel: PROFITABILITY_UNAVAILABLE_LABEL,
      marginLabel: MARGIN_UNAVAILABLE_LABEL,
      markupLabel: MARGIN_UNAVAILABLE_LABEL,
    };
  }
  return {
    costKnown: true,
    profitLabel: formatPricingMoney(input.grossProfit),
    marginLabel: formatPricingPercent(input.marginPercent),
    markupLabel: formatPricingPercent(input.markupPercent ?? 0),
  };
}

export function formatMoneyOrDash(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return formatPricingMoney(value);
}

/**
 * Infer sell-only unknown cost when domain has no explicit cost_known flag.
 * Matches OCD-30 / engine: cost 0 + sell > 0 ⇒ unknown.
 */
export function inferDisplayCostKnown(cost: number, sell: number): boolean {
  if (cost === 0 && sell > 0) return false;
  return true;
}
