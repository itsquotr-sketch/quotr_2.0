/**
 * COMMERCIAL-P0 — Cost-first commercial authority contract.
 *
 * Canonical paths (exactly three — no accidental fourth):
 * 1. NORMAL: cost + applicable gross margin → sell (F-SFM)
 * 2. EXPLICIT OVERRIDE: cost + explicit sell override → sell (provenanced)
 * 3. LEGACY COMPAT: existing paired cost/sell preserved until cost-first rates batch
 *
 * Markup is never a sell authority.
 */

import { roundMoney } from "@/lib/commercial-engine/core/money";
import { deriveSellFromCost } from "@/lib/commercial-engine/core/sell-from-margin";
import {
  MAX_GROSS_MARGIN_PERCENT,
  MIN_GROSS_MARGIN_PERCENT,
} from "@/lib/commercial-engine/versioning";

export const SELL_AUTHORITY_VALUES = [
  "derived_from_gross_margin",
  "legacy_paired_rate",
  "explicit_sell_override",
] as const;

/** How unit sell was obtained for a resolved rate. */
export type SellAuthority =
  /** sell = cost / (1 − GM) using org/default margin at resolve time */
  | "derived_from_gross_margin"
  /** Both cost and sell present from company/benchmark/default pair — grandfathered */
  | "legacy_paired_rate"
  /** Deliberate sell override (e.g. pricing project override) — not silent */
  | "explicit_sell_override";

/** How estimate-level recommended sell was obtained after line construction. */
export type EstimateSellAuthority =
  /** Lines retain resolved unit sells (legacy pairs and/or derived) */
  | "line_resolved_sells"
  /** Project target_margin rewrote all line sells from cost via F-SFM */
  | "project_target_margin";

export type CommercialSnapshotKind =
  | "live_derived"
  | "recalibratable_snapshot"
  | "historical_immutable_snapshot";

export type ResolvedSellSemantics = {
  sellAuthority: SellAuthority;
  /** Org/default GM used when sellAuthority is derived_from_gross_margin; else null */
  grossMarginPercent: number | null;
  isLegacyPairedRate: boolean;
  isExplicitSellOverride: boolean;
  /** Alias of sellAuthority === derived_from_gross_margin (compat with sellDerivedFromMargin) */
  sellDerivedFromMargin: boolean;
};

/**
 * Classify unit sell semantics for rate resolution (CF-D2 / CF-D3 / CF-D6).
 *
 * - If sell is null/undefined → derive from cost + GM (NORMAL).
 * - If both present and not marked explicit override → LEGACY paired (grandfather).
 * - If explicitOverride → EXPLICIT OVERRIDE path.
 */
export function classifyResolvedSell(params: {
  costRate: number;
  sellRate: number | null | undefined;
  applicableGrossMarginPercent: number;
  explicitSellOverride?: boolean;
}): {
  sellRate: number;
} & ResolvedSellSemantics {
  if (params.explicitSellOverride && params.sellRate != null) {
    return {
      sellRate: params.sellRate,
      sellAuthority: "explicit_sell_override",
      grossMarginPercent: null,
      isLegacyPairedRate: false,
      isExplicitSellOverride: true,
      sellDerivedFromMargin: false,
    };
  }

  if (params.sellRate == null) {
    const sellRate = deriveSellFromCost(
      params.costRate,
      params.applicableGrossMarginPercent
    );
    return {
      sellRate,
      sellAuthority: "derived_from_gross_margin",
      grossMarginPercent: params.applicableGrossMarginPercent,
      isLegacyPairedRate: false,
      isExplicitSellOverride: false,
      sellDerivedFromMargin: true,
    };
  }

  return {
    sellRate: params.sellRate,
    sellAuthority: "legacy_paired_rate",
    grossMarginPercent: null,
    isLegacyPairedRate: true,
    isExplicitSellOverride: false,
    sellDerivedFromMargin: false,
  };
}

/** F-SFM wrapper — canonical NORMAL path. */
export function deriveSellFromGrossMargin(
  cost: number,
  grossMarginPercent: number
): number {
  return deriveSellFromCost(cost, grossMarginPercent);
}

/**
 * Project margin override: replace sell from cost (does NOT stack on legacy sell).
 * cost 60, legacy sell 90, GM 20% → 75 (not 108 / 112.5).
 */
export function applyProjectGrossMarginToCost(
  cost: number,
  projectGrossMarginPercent: number
): number {
  return deriveSellFromCost(cost, projectGrossMarginPercent);
}

export function isSellAuthority(value: unknown): value is SellAuthority {
  return (SELL_AUTHORITY_VALUES as readonly string[]).includes(String(value));
}

export function isEstimateSellAuthority(
  value: unknown
): value is EstimateSellAuthority {
  return value === "line_resolved_sells" || value === "project_target_margin";
}

const PAIRED_TOTAL_TOLERANCE = 0.05;

/**
 * Historical rows may omit sellAuthority. Infer only when deterministic.
 *
 * - persisted enum wins
 * - sellDerivedFromMargin true → derived_from_gross_margin
 * - notes pair × qty/hours matches recommended sell → legacy_paired_rate
 * - notes pair present but totals do not match → derived_from_gross_margin
 *   (typical project-GM rewrite that left source sellRate as evidence)
 * - otherwise derived_from_gross_margin (cost-first default)
 */
export function interpretLineSellAuthority(params: {
  persisted?: unknown;
  sellDerivedFromMargin?: boolean | null;
  sourceSellRate?: number | null;
  recommendedSell: number;
  quantity?: number | null;
  labourHours?: number | null;
}): SellAuthority {
  if (isSellAuthority(params.persisted)) {
    return params.persisted;
  }
  if (params.sellDerivedFromMargin === true) {
    return "derived_from_gross_margin";
  }
  const moneyQty =
    params.labourHours != null && params.labourHours > 0
      ? params.labourHours
      : params.quantity != null && params.quantity > 0
        ? params.quantity
        : null;
  if (
    params.sourceSellRate != null &&
    Number.isFinite(params.sourceSellRate) &&
    moneyQty != null
  ) {
    const pairedTotal = roundMoney(params.sourceSellRate * moneyQty);
    if (Math.abs(pairedTotal - params.recommendedSell) <= PAIRED_TOTAL_TOLERANCE) {
      return "legacy_paired_rate";
    }
    return "derived_from_gross_margin";
  }
  return "derived_from_gross_margin";
}

export function interpretEstimateSellAuthority(params: {
  persisted?: unknown;
  targetMarginPercent?: number | null;
}): EstimateSellAuthority {
  if (isEstimateSellAuthority(params.persisted)) {
    return params.persisted;
  }
  if (
    params.targetMarginPercent != null &&
    Number.isFinite(params.targetMarginPercent)
  ) {
    return "project_target_margin";
  }
  return "line_resolved_sells";
}

export function commercialSnapshotKindForPricingDocument(params: {
  needsRecalibration: boolean;
  status: string;
}): CommercialSnapshotKind {
  if (params.status === "archived") {
    return "historical_immutable_snapshot";
  }
  return "recalibratable_snapshot";
}

export function commercialSnapshotKindForQuote(params: {
  status: string;
  supersededByQuoteId?: string | null;
}): CommercialSnapshotKind {
  if (params.status === "draft" && !params.supersededByQuoteId) {
    return "recalibratable_snapshot";
  }
  // sent / accepted / superseded drafts — historical money; revise to change
  return "historical_immutable_snapshot";
}

export {
  MIN_GROSS_MARGIN_PERCENT,
  MAX_GROSS_MARGIN_PERCENT,
  deriveSellFromCost,
};
