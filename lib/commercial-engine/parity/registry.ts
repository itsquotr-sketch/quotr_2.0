/**
 * Legacy financial implementation registry — Batch 2B.4.
 * Aligned to STAGE_2B_PRICING_ENGINE_AUDIT.md C-01…C-42.
 *
 * @deprecated-for-production This registry is comparison documentation only.
 */

import type { LegacyImplementationRecord } from "./types";

function r(
  partial: LegacyImplementationRecord
): LegacyImplementationRecord {
  return Object.freeze(partial);
}

export const LEGACY_IMPLEMENTATION_REGISTRY: readonly LegacyImplementationRecord[] =
  Object.freeze([
    r({
      legacyId: "LEG-E-01",
      auditId: "C-01",
      domain: "estimate",
      file: "lib/estimate/rates.ts",
      functionName: "deriveSellFromCost",
      calculationMode: "sell_from_margin",
      comparisonFeasibility: "pure",
      intendedAdoptionBatch: "2B.7",
      notes: "Canonical sell-from-cost; engine F-SFM peer",
    }),
    r({
      legacyId: "LEG-E-08",
      auditId: "C-08",
      domain: "estimate",
      file: "lib/estimate/line-items.ts",
      functionName: "deriveMargins",
      calculationMode: "gross_profit_triad",
      comparisonFeasibility: "pure",
      intendedAdoptionBatch: "2B.7",
      notes: "GP triad duplicate #1",
    }),
    r({
      legacyId: "LEG-E-13",
      auditId: "C-13",
      domain: "estimate",
      file: "lib/estimate/summary.ts",
      functionName: "finalizeEstimateResult",
      calculationMode: "estimate_aggregate_no_gst",
      comparisonFeasibility: "pure",
      intendedAdoptionBatch: "2B.7",
      notes: "Estimate header totals excl GST",
    }),
    r({
      legacyId: "LEG-E-15",
      auditId: "C-15",
      domain: "estimate",
      file: "lib/estimate/margin-override.ts",
      functionName: "recalculateSellFromCost",
      calculationMode: "sell_from_margin_plus_triad",
      comparisonFeasibility: "pure",
      intendedAdoptionBatch: "2B.7",
      notes: "Target margin override path",
    }),
    r({
      legacyId: "LEG-E-16",
      auditId: "C-16",
      domain: "estimate",
      file: "lib/estimate/margin-override.ts",
      functionName: "sumLineItemTotals",
      calculationMode: "estimate_aggregate_no_gst",
      comparisonFeasibility: "pure",
      intendedAdoptionBatch: "2B.7",
      notes: "Sums all lines; no includedInTotal filter",
    }),
    r({
      legacyId: "LEG-E-19",
      auditId: "C-19",
      domain: "estimate",
      file: "lib/estimate/calculators/*",
      functionName: "domain calculators",
      calculationMode: "domain_qty_rates",
      comparisonFeasibility: "pure",
      intendedAdoptionBatch: "2B.7",
      notes: "Domain line factories; S1-012 hardcoded pairs",
    }),
    r({
      legacyId: "LEG-E-21",
      auditId: "C-21",
      domain: "estimate",
      file: "lib/assistant/actions.ts",
      functionName: "runEstimateGeneration",
      calculationMode: "orchestrator",
      comparisonFeasibility: "side_effectful",
      intendedAdoptionBatch: "2B.7",
      notes: "Persists estimate; shadow inner pure calcs only",
    }),
    r({
      legacyId: "LEG-E-24",
      auditId: "C-42",
      domain: "client_display",
      file: "lib/estimate/category-breakdown.ts",
      functionName: "sumByCategoryWithSplits",
      calculationMode: "partial_profit_display",
      comparisonFeasibility: "display_only",
      intendedAdoptionBatch: "2B.9",
      notes: "Unrounded partial profit; presentation",
    }),
    r({
      legacyId: "LEG-P-01",
      auditId: "C-24",
      domain: "pricing",
      file: "lib/pricing/pricing-item-calculation.ts",
      functionName: "computeProfitFields",
      calculationMode: "gross_profit_triad",
      comparisonFeasibility: "pure",
      intendedAdoptionBatch: "2B.6",
      notes: "GP triad on pricing items",
    }),
    r({
      legacyId: "LEG-P-02",
      auditId: "C-25",
      domain: "pricing",
      file: "lib/pricing/pricing-item-calculation.ts",
      functionName: "calculatePricingItemEdit / TotalsForSave",
      calculationMode: "quantity_rate|productivity_labour|lump_sum",
      comparisonFeasibility: "pure",
      intendedAdoptionBatch: "2B.6",
      notes: "Core pricing line modes",
    }),
    r({
      legacyId: "LEG-P-03",
      auditId: "C-26",
      domain: "pricing",
      file: "lib/pricing/calculations.ts",
      functionName: "calculateDocumentTotals",
      calculationMode: "document_aggregate_all_plus_gst",
      comparisonFeasibility: "pure",
      intendedAdoptionBatch: "2B.6",
      notes: "Sums ALL items + GST",
    }),
    r({
      legacyId: "LEG-P-04",
      auditId: "C-27",
      domain: "pricing",
      file: "lib/pricing/actions.ts",
      functionName: "recalculateAndPersistDocumentTotals",
      calculationMode: "persist_orchestrator",
      comparisonFeasibility: "side_effectful",
      intendedAdoptionBatch: "2B.6",
      notes: "Usually passes document.gst_rate correctly",
    }),
    r({
      legacyId: "LEG-P-05",
      auditId: "C-28",
      domain: "pricing",
      file: "lib/pricing/actions.ts",
      functionName: "createPricingFromEstimate",
      calculationMode: "estimate_to_pricing_gst",
      comparisonFeasibility: "side_effectful",
      intendedAdoptionBatch: "2B.6",
      notes:
        "C-28 fixed in 2B.5: insert + post-item recalc use organisation GST via lib/pricing/gst-source.ts",
    }),
    r({
      legacyId: "LEG-P-06",
      auditId: "C-29",
      domain: "pricing",
      file: "lib/pricing/recalibration.ts",
      functionName: "recalibration preview/apply",
      calculationMode: "recalibration",
      comparisonFeasibility: "side_effectful",
      intendedAdoptionBatch: "2B.6",
      notes: "Preserves manually edited items",
    }),
    r({
      legacyId: "LEG-P-07",
      auditId: "C-41",
      domain: "client_display",
      file: "components/pricing/PricingWorkAreaSection.tsx",
      functionName: "sectionTotals useMemo",
      calculationMode: "section_aggregate_gst0",
      comparisonFeasibility: "display_only",
      intendedAdoptionBatch: "2B.9",
      notes: "Calls calculateDocumentTotals with gstRate=0",
    }),
    r({
      legacyId: "LEG-Q-01",
      auditId: "C-30",
      domain: "quote",
      file: "lib/quotes/calculations.ts",
      functionName: "calculateQuoteTotals",
      calculationMode: "quote_aggregate_visible_plus_gst",
      comparisonFeasibility: "pure",
      intendedAdoptionBatch: "2B.8",
      notes: "Visible-only; no cost/GP; NaN gst → 15",
    }),
    r({
      legacyId: "LEG-Q-02",
      auditId: "C-31",
      domain: "quote",
      file: "lib/quotes/calculations.ts",
      functionName: "calculateQuoteItemTotal",
      calculationMode: "quote_line_prefer_total",
      comparisonFeasibility: "pure",
      intendedAdoptionBatch: "2B.8",
      notes: "Prefers client total over qty×unit",
    }),
    r({
      legacyId: "LEG-Q-03",
      auditId: "C-32",
      domain: "quote",
      file: "lib/quotes/from-pricing.ts",
      functionName: "mapPricingItemsToQuoteItems",
      calculationMode: "transform",
      comparisonFeasibility: "pure",
      intendedAdoptionBatch: "2B.8",
      notes: "Filters visible_on_quote",
    }),
    r({
      legacyId: "LEG-Q-04",
      auditId: "C-33",
      domain: "quote",
      file: "lib/quotes/build-from-pricing.ts",
      functionName: "build quote payload",
      calculationMode: "orchestrator",
      comparisonFeasibility: "pure",
      intendedAdoptionBatch: "2B.8",
      notes: "Uses document/org GST correctly (contrast C-28)",
    }),
    r({
      legacyId: "LEG-Q-05",
      auditId: "C-34",
      domain: "quote",
      file: "lib/quotes/actions.ts",
      functionName: "create/revise/update",
      calculationMode: "persist_orchestrator",
      comparisonFeasibility: "side_effectful",
      intendedAdoptionBatch: "2B.8",
      notes: "Revision immutability CD-20",
    }),
    r({
      legacyId: "LEG-Q-06",
      auditId: "C-38",
      domain: "client_display",
      file: "components/quotes/QuoteSummaryPanel.tsx",
      functionName: "display stored totals",
      calculationMode: "snapshot_display",
      comparisonFeasibility: "display_only",
      intendedAdoptionBatch: "2B.8",
      notes: "Must not recompute sent quotes",
    }),
    r({
      legacyId: "LEG-UI-01",
      auditId: "C-35",
      domain: "client_display",
      file: "components/pricing/PricingItemEditForm.tsx",
      functionName: "profitPreview",
      calculationMode: "display_gp_triad",
      comparisonFeasibility: "display_only",
      intendedAdoptionBatch: "2B.9",
      notes: "Duplicate GP triad on client",
    }),
    r({
      legacyId: "LEG-UI-02",
      auditId: "C-36",
      domain: "client_display",
      file: "components/assistant/EstimateBreakdownModal.tsx",
      functionName: "sumWorkAreaTotals",
      calculationMode: "unrounded_margin_display",
      comparisonFeasibility: "display_only",
      intendedAdoptionBatch: "2B.9",
      notes: "Unrounded margin%",
    }),
    r({
      legacyId: "LEG-CONST-01",
      auditId: "C-28-const",
      domain: "constants",
      file: "lib/pricing/status.ts",
      functionName: "DEFAULT_GST_RATE",
      calculationMode: "constant",
      comparisonFeasibility: "pure",
      intendedAdoptionBatch: "2B.6",
      notes: "DEFAULT_GST_RATE=15 used incorrectly in C-28",
    }),
    r({
      legacyId: "LEG-DB-01",
      auditId: "C-39",
      domain: "persistence",
      file: "supabase/migrations/*",
      functionName: "CHECK/defaults only",
      calculationMode: "schema",
      comparisonFeasibility: "schema_only",
      intendedAdoptionBatch: "n/a",
      notes: "No SQL money formulas",
    }),
  ]);

export function getLegacyById(
  id: string
): LegacyImplementationRecord | undefined {
  return LEGACY_IMPLEMENTATION_REGISTRY.find((x) => x.legacyId === id);
}

export function assertRegistryIntegrity(): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const row of LEGACY_IMPLEMENTATION_REGISTRY) {
    if (seen.has(row.legacyId)) {
      errors.push(`Duplicate legacy ID: ${row.legacyId}`);
    }
    seen.add(row.legacyId);
  }
  return errors;
}
