/**
 * Authoritative pricing-document aggregation — Batch 2B.6A.
 * Uses commercial-engine calculateDocumentAggregate / contract execution.
 * No Supabase. No duplicated GST/margin formulas.
 */

import {
  buildAggregateRequest,
  executeCommercialCalculation,
  type AggregateLineInput,
  type CommercialCalculationRecord,
} from "@/lib/commercial-engine";
import { persistCommercialMetric } from "@/lib/pricing/commercial-engine-adapter";
import type { DocumentTotals } from "@/lib/pricing/calculations";

export type AuthoritativeAggregateLine = {
  readonly total_cost: number;
  readonly total_sell: number;
  readonly visible?: boolean | null;
  /** When omitted, inferred: cost 0 + sell > 0 → unknown. */
  readonly cost_known?: boolean | null;
};

export type AuthoritativeDocumentTotals = DocumentTotals & {
  readonly costKnown: boolean;
  readonly record: CommercialCalculationRecord | null;
};

export type AuthoritativeDocumentTotalsResult =
  | { readonly ok: true; readonly totals: AuthoritativeDocumentTotals }
  | {
      readonly ok: false;
      readonly error: string;
      readonly codes: readonly string[];
    };

/**
 * Infer cost_known for a persisted pricing line without inventing cost.
 * Matches OCD-30 / lump-sum engine: 0 cost + positive sell ⇒ unknown.
 */
export function inferPersistedLineCostKnown(line: {
  total_cost: number;
  total_sell: number;
  cost_known?: boolean | null;
}): boolean {
  if (line.cost_known === false) return false;
  if (line.cost_known === true) return true;
  if (line.total_cost === 0 && line.total_sell > 0) return false;
  return true;
}

export function mapItemsToAggregateLines(
  items: readonly AuthoritativeAggregateLine[]
): AggregateLineInput[] {
  return items.map((item) => ({
    total_cost: item.total_cost,
    total_sell: item.total_sell,
    visible: item.visible ?? true,
    included_in_total: true,
    cost_known: inferPersistedLineCostKnown(item),
  }));
}

/**
 * Aggregate remaining pricing items with stored document GST (applied once).
 * Empty document → zero money totals, GST 0, known cost.
 */
export function calculateAuthoritativeDocumentTotals(
  items: readonly AuthoritativeAggregateLine[],
  gstRatePercent: number,
  requestId = "pricing-document-aggregate"
): AuthoritativeDocumentTotalsResult {
  const lines = mapItemsToAggregateLines(items);
  const request = buildAggregateRequest({
    requestId,
    lines,
    inclusionRule: "all",
    gstRatePercent,
    source: {
      source_references: ["pricing:document_aggregate"],
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
        "Document total calculation failed.",
      codes: record.blockingErrors.map((e) => e.code),
    };
  }

  const o = record.outputs;
  const costKnown = o.costKnown;

  return {
    ok: true,
    totals: {
      subtotalCost: o.totalCost ?? 0,
      subtotalSell: o.totalSell ?? 0,
      grossProfit: persistCommercialMetric(o.grossProfit, costKnown),
      marginPercent: persistCommercialMetric(o.grossMarginPercent, costKnown),
      markupPercent: persistCommercialMetric(o.markupPercent, costKnown),
      gstAmount: o.gstAmount ?? 0,
      totalInclGst: o.gstInclusiveTotal ?? o.totalSell ?? 0,
      costKnown,
      record,
    },
  };
}
