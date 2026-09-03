/**
 * BETA-2 — Estimate GST presentation only.
 * Does not change sell-from-cost, margin, or persisted estimate money.
 * GST is applied for display from organisation_settings.default_gst_rate.
 */

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
  const gstAmount = showGst ? Math.round(sell * (rate / 100)) : 0;
  return {
    gstRate: rate,
    exGst: sell,
    gstAmount,
    inclGst: sell + gstAmount,
    showGst,
  };
}

export function usesQuotrBenchmarkRates(rateSourceSummary: string | null | undefined): boolean {
  const text = (rateSourceSummary ?? "").toLowerCase();
  return text.includes("benchmark");
}
