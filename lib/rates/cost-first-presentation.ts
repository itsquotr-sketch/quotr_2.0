/**
 * Cost-first Rates presentation helpers (UI + verify).
 * Arithmetic authority: commercial-engine F-SFM — do not reimplement margin math here.
 */

import {
  classifyResolvedSell,
  deriveSellFromGrossMargin,
} from "@/lib/commercial-engine/core/cost-first-authority";
import { DEFAULT_MARGIN_PERCENT } from "@/lib/estimate/constants";
import { round2 } from "@/lib/estimate/facts";

export type CompanyRateSellMode =
  /** sell_rate null — derive from company GM */
  | "derived"
  /** Persisted sell retained (legacy pair or deliberate custom) */
  | "retained_custom";

export type CompanyRatePresentation = {
  costRate: number | null;
  persistedSellRate: number | null;
  recommendedChargeOut: number | null;
  sellMode: CompanyRateSellMode;
  /** True when a persisted sell differs from recommended (or any sell is stored) */
  hasRetainedChargeOut: boolean;
  /** True when recommended differs from retained sell by > 1c */
  recommendedDiffersFromRetained: boolean;
  companyGrossMarginPercent: number;
};

export function resolveCompanyGrossMarginPercent(
  settingsMargin: number | null | undefined
): number {
  return settingsMargin ?? DEFAULT_MARGIN_PERCENT;
}

/** Live recommended charge-out from cost + company GM (client-safe). */
export function recommendedChargeOutFromCost(
  cost: number,
  companyGrossMarginPercent: number
): number {
  return deriveSellFromGrossMargin(cost, companyGrossMarginPercent);
}

export function tryRecommendedChargeOutFromCostString(
  costString: string,
  companyGrossMarginPercent: number
): number | null {
  const trimmed = costString.trim();
  if (!trimmed) return null;
  const cost = Number(trimmed);
  if (!Number.isFinite(cost) || cost < 0) return null;
  try {
    return recommendedChargeOutFromCost(cost, companyGrossMarginPercent);
  } catch {
    return null;
  }
}

/**
 * Classify a persisted company rate for display / edit (CF-D2 / CF-D3).
 * Any non-null sell_rate is treated as retained custom/legacy — never silently
 * rewritten to recommended.
 */
export function presentCompanyRate(params: {
  costRate: number | null | undefined;
  sellRate: number | null | undefined;
  companyGrossMarginPercent: number;
}): CompanyRatePresentation {
  const margin = params.companyGrossMarginPercent;
  const costRate = params.costRate ?? null;
  const persistedSellRate = params.sellRate ?? null;

  let recommendedChargeOut: number | null = null;
  if (costRate != null && costRate >= 0) {
    try {
      recommendedChargeOut = recommendedChargeOutFromCost(costRate, margin);
    } catch {
      recommendedChargeOut = null;
    }
  }

  const hasRetainedChargeOut = persistedSellRate != null;
  const sellMode: CompanyRateSellMode = hasRetainedChargeOut
    ? "retained_custom"
    : "derived";

  const recommendedDiffersFromRetained =
    hasRetainedChargeOut &&
    recommendedChargeOut != null &&
    Math.abs(round2(persistedSellRate! - recommendedChargeOut)) > 0.009;

  return {
    costRate,
    persistedSellRate,
    recommendedChargeOut,
    sellMode,
    hasRetainedChargeOut,
    recommendedDiffersFromRetained,
    companyGrossMarginPercent: margin,
  };
}

/** Display charge-out for tables: retained sell, else recommended, else — */
export function displayChargeOut(params: {
  costRate: number | null | undefined;
  sellRate: number | null | undefined;
  companyGrossMarginPercent: number;
}): {
  value: number | null;
  isRecommended: boolean;
  isCustom: boolean;
} {
  const presented = presentCompanyRate(params);
  if (presented.hasRetainedChargeOut) {
    return {
      value: presented.persistedSellRate,
      isRecommended: false,
      isCustom: true,
    };
  }
  return {
    value: presented.recommendedChargeOut,
    isRecommended: presented.recommendedChargeOut != null,
    isCustom: false,
  };
}

/**
 * Build sell_rate to persist on save.
 * - derived / use-recommended → null (resolve derives)
 * - retained or explicit custom → number
 */
export function sellRateForPersistence(params: {
  mode: CompanyRateSellMode | "explicit_override";
  customSellString: string;
}): number | null {
  if (params.mode === "derived") {
    return null;
  }
  const trimmed = params.customSellString.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Resolve-time check used by verifies — mirrors estimate resolvers. */
export function resolveUnitSellForVerify(params: {
  costRate: number;
  sellRate: number | null;
  companyGrossMarginPercent: number;
  explicitSellOverride?: boolean;
}) {
  return classifyResolvedSell({
    costRate: params.costRate,
    sellRate: params.sellRate,
    applicableGrossMarginPercent: params.companyGrossMarginPercent,
    explicitSellOverride: params.explicitSellOverride,
  });
}

export function formatMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `$${value.toFixed(2)}`;
}
