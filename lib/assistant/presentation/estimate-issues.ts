import { classifyRateSource } from "@/lib/estimate/rate-source-labels";

/**
 * One issue model for the estimate, work-area cards, Pricing, and the
 * dashboard. The four counts are never added into a single unlabeled total.
 */
export type EstimateIssueModel = {
  readonly missingPriceLineCount: number;
  readonly workAreasWithMissingPrices: number;
  readonly unresolvedSpecificationCount: number;
  readonly scopeCoverageGapCount: number;
};

export function lineNeedsPriceFromRateSource(raw: string | null | undefined): boolean {
  const source = (raw ?? "").trim();
  if (!source) return false;
  if (/^missing$/i.test(source)) return true;
  if (classifyRateSource(source) === "missing") return true;
  return /pricing required|rate required/i.test(source);
}

export function formatMissingPriceLines(count: number): string {
  if (count === 1) return "1 line needs a price";
  return `${count} lines need prices`;
}

export function formatMissingPriceNotice(count: number): string {
  if (count === 1) return "1 line still needs a price. Complete this in Pricing.";
  return `${count} lines still need prices. Complete these in Pricing.`;
}

export const GENERATED_LINES_PRICED = "Generated lines priced";

export function generatedLinesArePriced(input: {
  readonly missingPriceLineCount: number;
  readonly scopeCoverageGapCount?: number;
  readonly unresolvedSpecificationCount?: number;
}): boolean {
  return (
    input.missingPriceLineCount <= 0 &&
    ((input.scopeCoverageGapCount ?? 0) > 0 ||
      (input.unresolvedSpecificationCount ?? 0) > 0)
  );
}

export function formatWorkAreaPriceSummary(input: {
  readonly workAreaCount: number;
  readonly missingPriceLineCount: number;
  readonly workAreasWithMissingPrices: number;
  readonly scopeCoverageGapCount?: number;
  readonly unresolvedSpecificationCount?: number;
}): string {
  const areas =
    input.workAreaCount === 1 ? "1 Work Area" : `${input.workAreaCount} Work Areas`;
  if (input.missingPriceLineCount <= 0) {
    if (generatedLinesArePriced(input)) return `${areas} · ${GENERATED_LINES_PRICED}`;
    return `${areas} · All priced lines`;
  }
  const lines = formatMissingPriceLines(input.missingPriceLineCount);
  if (
    input.workAreasWithMissingPrices > 0 &&
    input.workAreasWithMissingPrices < input.workAreaCount
  ) {
    const affected =
      input.workAreasWithMissingPrices === 1
        ? "1 Work Area"
        : `${input.workAreasWithMissingPrices} Work Areas`;
    return `${areas} · ${lines} in ${affected}`;
  }
  return `${areas} · ${lines}`;
}

export function formatScopeCoverageGaps(count: number): string | null {
  if (count <= 0) return null;
  if (count === 1) return "1 requested task has no line";
  return `${count} requested tasks have no line`;
}

export function formatUnresolvedSpecifications(count: number): string | null {
  if (count <= 0) return null;
  if (count === 1) return "1 specification is still open";
  return `${count} specifications are still open`;
}

export function scopeGapCountFromNotices(value: unknown): number {
  return countNotices(value, "scope_gap");
}

export function specificationCountFromNotices(value: unknown): number {
  return countNotices(value, "specification");
}

function countNotices(
  value: unknown,
  kind: "scope_gap" | "specification"
): number {
  if (!Array.isArray(value)) return 0;
  let count = 0;
  for (const item of value) {
    if (typeof item === "string" && classifyReviewNotice(item) === kind) {
      count += 1;
    }
  }
  return count;
}

export function aggregateMissingPriceLineCounts(
  rows: readonly {
    readonly project_id: string;
    readonly rate_source?: string | null;
  }[]
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!lineNeedsPriceFromRateSource(row.rate_source)) continue;
    counts.set(row.project_id, (counts.get(row.project_id) ?? 0) + 1);
  }
  return counts;
}

export function issuesFromEstimateRecord(input: {
  readonly lineItems?: readonly {
    readonly rateSource?: string | null;
    readonly workAreaName?: string | null;
  }[];
  readonly notices?: readonly string[];
}): EstimateIssueModel {
  const areas = new Set<string>();
  let lines = 0;
  for (const item of input.lineItems ?? []) {
    if (!lineNeedsPriceFromRateSource(item.rateSource)) continue;
    lines += 1;
    const name = item.workAreaName?.trim();
    if (name) areas.add(name);
  }
  let scopeCoverageGapCount = 0;
  let unresolvedSpecificationCount = 0;
  for (const notice of input.notices ?? []) {
    const kind = classifyReviewNotice(notice);
    if (kind === "scope_gap") scopeCoverageGapCount += 1;
    else if (kind === "specification") unresolvedSpecificationCount += 1;
  }
  return {
    missingPriceLineCount: lines,
    workAreasWithMissingPrices: areas.size,
    unresolvedSpecificationCount,
    scopeCoverageGapCount,
  };
}

export function classifyReviewNotice(
  label: string
): "missing_price" | "scope_gap" | "specification" | null {
  const text = label.trim();
  if (!text) return null;
  if (/pricing required|rate required/i.test(text)) return "missing_price";
  if (
    /add a lining product|requested and not priced|cannot be calculated|no priced line|coverage not specified|unsupported scope|coverage is unresolved|not a complete pile price|stay unresolved while existing piles|does not assume they are replaced|stay unresolved and are not priced|do not establish a complete or structurally adequate/i.test(
      text
    )
  ) {
    return "scope_gap";
  }
  if (/\?\s*$/.test(text)) return "specification";
  return null;
}
