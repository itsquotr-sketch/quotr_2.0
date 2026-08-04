/**
 * Known mismatch register — Batch 2B.4.
 * Captures audit defects and intentional engine corrections.
 */

import type { KnownMismatchRecord } from "./types";

export const KNOWN_MISMATCH_REGISTER: readonly KnownMismatchRecord[] =
  Object.freeze([
    Object.freeze({
      mismatchId: "KM-GST-C28",
      auditRefs: Object.freeze(["C-28", "CD-09"]),
      legacyIds: Object.freeze(["LEG-P-05", "LEG-CONST-01"]),
      title: "createPricingFromEstimate GST overwrite (corrected 2B.5)",
      description:
        "Historical defect: insert used organisation GST, then recalculateAndPersistDocumentTotals(..., DEFAULT_GST_RATE=15). Batch 2B.5 passes the same validated organisation/document GST into the post-item recalc. Prior 2B.4 parity evidence retained via legacyCreatePricingFromEstimateGstBug notes.",
      classification: "EXACT_MATCH" as const,
      commercialAuthority: "owner_commercial_decisions" as const,
      engineIsAuthoritative: true,
      retainLegacyTemporarily: true,
      blocksAdoption: false,
      specialHandling:
        "Live path fixed in 2B.5 (lib/pricing/gst-source.ts + createPricingFromEstimate). Do not silently rewrite historical pricing_documents that may still store GST amounts inconsistent with gst_rate. Engine adoption remains 2B.6.",
      historicalSnapshotRule:
        "Existing pricing docs may already store wrong GST amounts from pre-2B.5 creates; do not bulk-rewrite. Future recalculation uses stored gst_rate. Sent/accepted quotes remain immutable.",
      targetBatch: "2B.5",
    }),
    Object.freeze({
      mismatchId: "KM-SELL-ONLY-MARGIN",
      auditRefs: Object.freeze(["OCD-30", "CCS-042"]),
      legacyIds: Object.freeze(["LEG-P-01", "LEG-P-02", "LEG-E-08"]),
      title: "Sell-only / unknown-cost fabricates margin",
      description:
        "Legacy GP triad with cost=0 and sell>0 yields margin 100% (or 0% markup). Approved engine returns null profit/margin when cost_known=false.",
      classification: "APPROVED_ENGINE_CORRECTION" as const,
      commercialAuthority: "owner_commercial_decisions" as const,
      engineIsAuthoritative: true,
      retainLegacyTemporarily: true,
      blocksAdoption: false,
      specialHandling:
        "On adoption, map null metrics to UI 'unknown'; do not persist fabricated 100% margin as truth.",
      historicalSnapshotRule:
        "Historical lines may store 100% margin; retain stored snapshot; new calcs use null.",
      targetBatch: "2B.6",
    }),
    Object.freeze({
      mismatchId: "KM-GP-DUPLICATION",
      auditRefs: Object.freeze(["S1-001", "C-08", "C-10", "C-13", "C-15", "C-16", "C-24", "C-26", "C-35"]),
      legacyIds: Object.freeze(["LEG-E-08", "LEG-E-13", "LEG-E-15", "LEG-P-01", "LEG-P-03", "LEG-UI-01"]),
      title: "Multiple independent GP triad implementations",
      description:
        "Same formula copied ≥10 times. Arithmetic usually matches when inputs match; drift risk remains.",
      classification: "LEGACY_INCONSISTENCY" as const,
      commercialAuthority: "canonical_golden_results" as const,
      engineIsAuthoritative: true,
      retainLegacyTemporarily: true,
      blocksAdoption: false,
      specialHandling: "Replace callers with engine gradually; parity fixtures prove equivalence first.",
      historicalSnapshotRule: "No change to stored values until adoption batch.",
      targetBatch: "2B.6–2B.9",
    }),
    Object.freeze({
      mismatchId: "KM-CLIENT-DUP",
      auditRefs: Object.freeze(["C-35", "C-36", "C-41", "C-42"]),
      legacyIds: Object.freeze(["LEG-UI-01", "LEG-UI-02", "LEG-P-07", "LEG-E-24"]),
      title: "Client-side duplicate / unrounded display calculations",
      description:
        "Client profit preview and work-area/category rollups duplicate server math; some margins unrounded.",
      classification: "PRESENTATION_ONLY_DIFFERENCE" as const,
      commercialAuthority: "canonical_golden_results" as const,
      engineIsAuthoritative: true,
      retainLegacyTemporarily: true,
      blocksAdoption: false,
      specialHandling: "2B.9 remove client financial authority; display engine/server results only.",
      historicalSnapshotRule: "N/A — display only.",
      targetBatch: "2B.9",
    }),
    Object.freeze({
      mismatchId: "KM-PRICING-QUOTE-DIVERGENCE",
      auditRefs: Object.freeze(["S1-010", "C-26", "C-30", "CD-21"]),
      legacyIds: Object.freeze(["LEG-P-03", "LEG-Q-01"]),
      title: "Pricing all-items vs quote visible-only subtotals",
      description:
        "Pricing document sums all items; quotes sum visible only. Can diverge without UX warning.",
      classification: "DEFERRED_WORKFLOW_DIFFERENCE" as const,
      commercialAuthority: "mixed_documented_disagreement" as const,
      engineIsAuthoritative: true,
      retainLegacyTemporarily: true,
      blocksAdoption: false,
      specialHandling:
        "Engine already supports inclusion_rule all|visible_only. Adoption must pass explicit rule. UX warning Stage 6 / CCS-045.",
      historicalSnapshotRule: "Quotes remain visible-only snapshots; pricing remains all-items.",
      targetBatch: "2B.8 / Stage 6",
    }),
    Object.freeze({
      mismatchId: "KM-AVERAGED-MARGINS",
      auditRefs: Object.freeze(["CCS-024", "OCD-16"]),
      legacyIds: Object.freeze(["LEG-P-03", "LEG-E-13"]),
      title: "Aggregate margin from totals not averaged line margins",
      description:
        "Legacy document/estimate aggregates correctly derive margin from summed totals (not average of line %). Engine matches. Guard fixture ensures no regression to averaging.",
      classification: "EXACT_MATCH" as const,
      commercialAuthority: "canonical_golden_results" as const,
      engineIsAuthoritative: true,
      retainLegacyTemporarily: false,
      blocksAdoption: false,
      specialHandling: "Parity fixture CCS-024 mixed margins.",
      historicalSnapshotRule: "N/A",
      targetBatch: "n/a",
    }),
  ]);

export function isRegisteredBlockingMismatch(fixtureId: string, legacyId: string): boolean {
  return KNOWN_MISMATCH_REGISTER.some(
    (m) =>
      m.blocksAdoption &&
      (m.legacyIds.includes(legacyId) || fixtureId.includes(m.mismatchId))
  );
}
