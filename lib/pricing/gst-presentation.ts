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

export const GST_REGISTRATION_UNSET_QUOTE_BLOCK =
  "GST registration is not decided. Choose whether the business is GST registered before creating a quote. GST is not added until then.";

export type GstRegistrationPresentation = "stored" | "registered" | "not_registered" | "unset";

/**
 * Stored document GST is shown only after registration is decided.
 * Unknown does not display or add the stored rate. The document row is not rewritten.
 */
export function presentGstForRegistration(input: {
  gstRegistered?: boolean | null;
  gstRate: number;
  gstAmount: number;
  subtotalExGst: number;
  totalInclGst: number;
}): StoredGstPresentation & { readonly registration: GstRegistrationPresentation } {
  if (input.gstRegistered === undefined) {
    return {
      ...presentStoredGst(input),
      registration: "stored",
    };
  }
  if (input.gstRegistered == null) {
    return {
      gstRate: 0,
      showGst: false,
      exGst: input.subtotalExGst,
      gstAmount: 0,
      inclGst: input.subtotalExGst,
      gstLabel: "GST not decided",
      registration: "unset",
    };
  }
  if (input.gstRegistered === false) {
    return {
      gstRate: 0,
      showGst: false,
      exGst: input.subtotalExGst,
      gstAmount: 0,
      inclGst: input.subtotalExGst,
      gstLabel: "GST",
      registration: "not_registered",
    };
  }
  return {
    ...presentStoredGst(input),
    registration: "registered",
  };
}

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
