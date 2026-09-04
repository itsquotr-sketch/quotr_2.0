/**
 * BETA-3 — GST presentation from stored pricing/quote amounts.
 * Does not recalculate GST, sell, or margin.
 */

export type StoredGstPresentation = {
  readonly gstRate: number;
  readonly showGst: boolean;
  readonly exGst: number;
  readonly gstAmount: number;
  readonly inclGst: number;
  readonly gstLabel: string;
};

export function presentStoredGst(input: {
  gstRate: number;
  gstAmount: number;
  subtotalExGst: number;
  totalInclGst: number;
}): StoredGstPresentation {
  const gstRate = Number.isFinite(input.gstRate) ? input.gstRate : 0;
  const showGst = gstRate > 0;
  return {
    gstRate,
    showGst,
    exGst: input.subtotalExGst,
    gstAmount: input.gstAmount,
    inclGst: input.totalInclGst,
    gstLabel: showGst ? `GST (${gstRate}%)` : "GST",
  };
}
