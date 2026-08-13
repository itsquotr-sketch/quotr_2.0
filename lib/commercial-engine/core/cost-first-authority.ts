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

import { deriveSellFromCost } from "@/lib/commercial-engine/core/sell-from-margin";
import {
  MAX_GROSS_MARGIN_PERCENT,
  MIN_GROSS_MARGIN_PERCENT,
} from "@/lib/commercial-engine/versioning";

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
