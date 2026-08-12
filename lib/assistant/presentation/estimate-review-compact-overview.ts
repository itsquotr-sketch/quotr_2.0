/**
 * Stage 3.2.2-R4 — Compact Estimate Review overview (presentation only).
 * Explains what Quotr understood/priced — not commercial totals.
 */

export type EstimateReviewCompactOverview = {
  readonly headline: string;
  readonly inventoryLine: string;
  readonly keyScopeLabels: readonly string[];
  readonly keyScopeOverflow: number;
  readonly conditionLabels: readonly string[];
  readonly conditionOverflow: number;
  readonly assumptionCount: number;
  readonly includedScopeCount: number;
  readonly detailsConfirmedCount: number;
  readonly workAreaCount: number;
};

const DEFAULT_KEY_SCOPE_LIMIT = 5;
const DEFAULT_CONDITION_LIMIT = 3;

function truncateLabels(
  labels: readonly string[],
  limit: number
): { readonly shown: readonly string[]; readonly overflow: number } {
  const cleaned = labels
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((label, index, arr) => arr.indexOf(label) === index);
  if (cleaned.length <= limit) {
    return { shown: cleaned, overflow: 0 };
  }
  return {
    shown: cleaned.slice(0, limit),
    overflow: cleaned.length - limit,
  };
}

/**
 * Build a compact “what Quotr understood” overview from already-loaded Assistant state.
 */
export function buildEstimateReviewCompactOverview(params: {
  readonly workAreaNames: readonly string[];
  readonly includedScopeTitles: readonly string[];
  readonly includedScopeCount?: number;
  readonly detailsConfirmedCount?: number;
  readonly conditionLabels?: readonly string[];
  readonly assumptionCount?: number;
  readonly keyScopeLimit?: number;
  readonly conditionLimit?: number;
}): EstimateReviewCompactOverview {
  const workAreaNames = params.workAreaNames
    .map((n) => n.trim())
    .filter(Boolean);
  const workAreaCount = workAreaNames.length;
  const includedScopeCount =
    params.includedScopeCount ?? params.includedScopeTitles.length;
  const detailsConfirmedCount = Math.max(0, params.detailsConfirmedCount ?? 0);
  const assumptionCount = Math.max(0, params.assumptionCount ?? 0);

  const keyScope = truncateLabels(
    params.includedScopeTitles,
    params.keyScopeLimit ?? DEFAULT_KEY_SCOPE_LIMIT
  );
  const conditions = truncateLabels(
    params.conditionLabels ?? [],
    params.conditionLimit ?? DEFAULT_CONDITION_LIMIT
  );

  const headline =
    workAreaCount === 0
      ? "Project scope"
      : workAreaCount === 1
        ? workAreaNames[0]!
        : `${workAreaCount} work areas`;

  const scopePart =
    includedScopeCount === 0
      ? "No scope items included yet"
      : `${includedScopeCount} scope item${includedScopeCount === 1 ? "" : "s"} included`;
  const detailsPart =
    detailsConfirmedCount === 0
      ? null
      : `${detailsConfirmedCount} detail${detailsConfirmedCount === 1 ? "" : "s"} confirmed`;

  const inventoryLine =
    workAreaCount > 1
      ? `${workAreaCount} work areas · ${scopePart}`
      : detailsPart
        ? `${scopePart} · ${detailsPart}`
        : scopePart;

  return {
    headline,
    inventoryLine,
    keyScopeLabels: keyScope.shown,
    keyScopeOverflow: keyScope.overflow,
    conditionLabels: conditions.shown,
    conditionOverflow: conditions.overflow,
    assumptionCount,
    includedScopeCount,
    detailsConfirmedCount,
    workAreaCount,
  };
}

export function formatTruncatedLabelList(
  labels: readonly string[],
  overflow: number
): string {
  if (labels.length === 0) return "";
  const base = labels.join(" · ");
  return overflow > 0 ? `${base} +${overflow}` : base;
}
