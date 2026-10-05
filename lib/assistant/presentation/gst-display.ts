/**
 * BETA-2 — Estimate GST presentation only.
 * Does not change sell-from-cost, margin, or persisted estimate money.
 * GST is applied for display from organisation_settings.default_gst_rate
 * through the commercial engine's document F-GST rule.
 */

import { calculateDocumentAggregate } from "@/lib/commercial-engine";

export const ESTIMATE_RANGE_EXPLANATION =
  "Indicative range based on your current rate settings.";

export type EstimateGstPresentation = {
  readonly gstRate: number;
  readonly exGst: number;
  readonly gstAmount: number;
  readonly inclGst: number;
  readonly showGst: boolean;
};

export function presentEstimateGst(
  recommendedSell: number,
  gstRatePercent: number | null | undefined
): EstimateGstPresentation {
  const sell = Number.isFinite(recommendedSell) ? recommendedSell : 0;
  const rate =
    gstRatePercent != null && Number.isFinite(gstRatePercent)
      ? gstRatePercent
      : 0;
  const showGst = rate > 0;
  if (!showGst) {
    return {
      gstRate: rate,
      exGst: sell,
      gstAmount: 0,
      inclGst: sell,
      showGst: false,
    };
  }

  const aggregate = calculateDocumentAggregate({
    inclusion_rule: "all",
    gst_rate_percent: rate,
    lines: [
      {
        total_cost: 0,
        total_sell: sell,
        included_in_total: true,
        visible: true,
        cost_known: false,
      },
    ],
  });
  if (!aggregate.ok || aggregate.gst_amount == null || aggregate.total_incl_gst == null) {
    return {
      gstRate: rate,
      exGst: sell,
      gstAmount: 0,
      inclGst: sell,
      showGst: false,
    };
  }

  return {
    gstRate: rate,
    exGst: sell,
    gstAmount: aggregate.gst_amount,
    inclGst: aggregate.total_incl_gst,
    showGst: true,
  };
}

export function usesQuotrBenchmarkRates(rateSourceSummary: string | null | undefined): boolean {
  const text = (rateSourceSummary ?? "").toLowerCase();
  return text.includes("benchmark");
}
