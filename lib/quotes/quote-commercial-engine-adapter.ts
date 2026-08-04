/**
 * Production quote ↔ commercial-engine adapter — Batch 2B.8.
 *
 * Sell-side document aggregates with visible_only + document GST.
 * Does not invent cost/margin on quote lines (quotes do not store cost).
 * Does not import parity. Does not touch Supabase.
 *
 * CD-22 (prefer supplied line total): retained as approved quote-domain
 * policy for draft edits — not an engine line mode.
 */

import {
  buildAggregateRequest,
  buildLineRequest,
  executeCommercialCalculation,
  type CommercialCalculationRecord,
} from "@/lib/commercial-engine";
import { isAuthoritativeQuoteCalculation } from "@/lib/quotes/adoption-authority";
import {
  calculateQuoteItemTotal,
  calculateQuoteTotals,
  type QuoteTotals,
} from "@/lib/quotes/calculations";
import { roundMoney } from "@/lib/pricing/calculations";

export type QuoteAggregateLine = {
  readonly total: number;
  readonly visible: boolean;
};

export type AuthoritativeQuoteTotals = QuoteTotals & {
  readonly gstRatePercent: number;
  readonly costKnown: boolean;
  readonly record: CommercialCalculationRecord | null;
};

export type AuthoritativeQuoteTotalsResult =
  | { readonly ok: true; readonly totals: AuthoritativeQuoteTotals }
  | {
      readonly ok: false;
      readonly error: string;
      readonly codes: readonly string[];
    };

function assertFiniteGstRate(gstRate: number): string | null {
  if (!Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100) {
    return "GST rate must be a finite number between 0 and 100.";
  }
  return null;
}

/**
 * Aggregate quote lines: inclusion_rule = visible_only, GST once on sell subtotal.
 * Quotes are sell-side snapshots — lines map with cost_known=false so margin is
 * not fabricated from zero cost.
 */
export function calculateAuthoritativeQuoteTotals(
  items: readonly QuoteAggregateLine[],
  gstRatePercent: number,
  requestId = "quote-document-aggregate"
): AuthoritativeQuoteTotalsResult {
  const gstError = assertFiniteGstRate(gstRatePercent);
  if (gstError) {
    return { ok: false, error: gstError, codes: ["invalid_gst_rate"] };
  }

  if (!isAuthoritativeQuoteCalculation()) {
    const legacy = calculateQuoteTotals([...items], gstRatePercent);
    return {
      ok: true,
      totals: {
        ...legacy,
        gstRatePercent,
        costKnown: true,
        record: null,
      },
    };
  }

  const request = buildAggregateRequest({
    requestId,
    inclusionRule: "visible_only",
    gstRatePercent,
    lines: items.map((item) => ({
      total_cost: 0,
      total_sell: item.total ?? 0,
      visible: item.visible !== false,
      included_in_total: true,
      // Sell-side quote snapshot — do not invent cost/margin from zero cost.
      cost_known: false,
    })),
    source: {
      source_references: ["quote:document_aggregate"],
      origin: "system",
    },
    commercialSettings: {
      gst_rate_percent: gstRatePercent,
      default_gross_margin_percent: null,
      currency: "NZD",
    },
  });

  const record = executeCommercialCalculation(request);
  if (!record.ok || !record.outputs) {
    return {
      ok: false,
      error:
        record.blockingErrors[0]?.message ??
        "Quote total calculation failed.",
      codes: record.blockingErrors.map((e) => e.code),
    };
  }

  const o = record.outputs;
  return {
    ok: true,
    totals: {
      subtotal: o.totalSell ?? 0,
      gstAmount: o.gstAmount ?? 0,
      totalInclGst: o.gstInclusiveTotal ?? o.totalSell ?? 0,
      gstRatePercent: o.gstRatePercent ?? gstRatePercent,
      costKnown: o.costKnown,
      record,
    },
  };
}

/**
 * Resolve draft quote line sell total.
 *
 * CD-22 decision (Batch 2B.8): prefer an explicit supplied `total` over
 * qty × unit_price. This is intentional quote-domain snapshot/edit policy
 * (client-facing sell figures), not commercial rate arithmetic.
 *
 * When only qty + unit_price are present, authoritative path uses the
 * engine quantity_rate sell-only line; otherwise prefer-total stays domain.
 */
export function resolveAuthoritativeQuoteItemTotal(input: {
  quantity?: number | null;
  unitPrice?: number | null;
  total?: number | null;
}): { ok: true; total: number } | { ok: false; error: string } {
  if (!isAuthoritativeQuoteCalculation()) {
    return { ok: true, total: calculateQuoteItemTotal(input) };
  }

  // CD-22: explicit total wins when provided (approved domain policy).
  if (input.total != null && Number.isFinite(input.total)) {
    return { ok: true, total: roundMoney(input.total) };
  }

  const quantity =
    input.quantity != null && Number.isFinite(input.quantity)
      ? input.quantity
      : null;
  const unitPrice =
    input.unitPrice != null && Number.isFinite(input.unitPrice)
      ? input.unitPrice
      : null;

  if (quantity == null || quantity <= 0 || unitPrice == null) {
    return { ok: true, total: 0 };
  }

  const request = buildLineRequest({
    requestId: "quote-item-qty-rate",
    input: {
      mode: "quantity_rate",
      quantity,
      unit_sell: unitPrice,
      // Sell-only quote line — no cost.
      unit_cost: null,
      source_references: ["quote:item"],
    },
    source: {
      source_references: ["quote:item"],
      origin: "system",
    },
    commercialSettings: {
      gst_rate_percent: null,
      default_gross_margin_percent: null,
      currency: "NZD",
    },
  });

  const record = executeCommercialCalculation(request);
  if (!record.ok || !record.outputs) {
    return {
      ok: false,
      error:
        record.blockingErrors[0]?.message ??
        "Quote item calculation failed.",
    };
  }

  return { ok: true, total: record.outputs.totalSell ?? 0 };
}
