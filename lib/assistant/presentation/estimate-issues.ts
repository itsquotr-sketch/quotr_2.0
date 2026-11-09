import { parseLineItemNotes } from "@/lib/estimate/line-item-metadata";
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

export const ADD_MISSING_RATE = "Add the missing rate.";
export const CONFIRM_OPEN_SPECIFICATION = "Confirm the open specification.";

/** Catalogue names for generated rates that have no Quotr cost. */
const MISSING_RATE_LABELS: Record<string, string> = {
  "stopping.plasterboard.level5.m2": "Level 5 plasterboard stopping",
};

export function missingRateLabel(itemKey: string | null | undefined): string | null {
  if (!itemKey) return null;
  return MISSING_RATE_LABELS[itemKey] ?? null;
}

export function namedMissingRateAction(labels: readonly string[]): string {
  const unique = [
    ...new Set(labels.map((label) => label.trim()).filter((label) => label.length > 0)),
  ];
  if (unique.length === 1) return `Add the ${unique[0]} rate.`;
  if (unique.length > 1) return `Add the missing rates: ${unique.join(", ")}.`;
  return ADD_MISSING_RATE;
}

function missingRateFace(notes: string | null | undefined): string | null {
  const parsed = parseLineItemNotes(notes);
  const quantity = parsed.metadata.quantity;
  if (quantity == null || !Number.isFinite(quantity) || quantity <= 0) return null;
  const unit = parsed.metadata.unit === "m2" ? "m²" : parsed.metadata.unit?.trim();
  if (!unit) return null;
  const shown = Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(1);
  const side = parsed.displayNotes?.match(/Side [A-Z]/)?.[0];
  return side ? `${side} is ${shown} ${unit}.` : `${shown} ${unit} is not priced.`;
}

/**
 * Pricing review copy for generated lines that still have no rate.
 * A known catalogue rate is named. Quantities stay visible and are not a price.
 */
export function missingRateReviewBlockFromLines(
  lines: readonly { rate_source?: string | null; notes?: string | null }[]
): string | null {
  const missing = lines.filter((line) => lineNeedsPriceFromRateSource(line.rate_source));
  if (missing.length === 0) return null;
  const labels = missing
    .map((line) => missingRateLabel(parseLineItemNotes(line.notes).metadata.itemKey))
    .filter((label): label is string => Boolean(label));
  const faces = missing
    .map((line) => missingRateFace(line.notes))
    .filter((face): face is string => Boolean(face));
  const faceCopy = faces.length > 0 ? ` ${faces.join(" ")}` : "";
  return `${namedMissingRateAction(labels)}${faceCopy} This pricing cannot be marked reviewed as a complete price.`;
}

export function formatMissingPriceNotice(
  count: number,
  rateLabels: readonly string[] = []
): string {
  const action = namedMissingRateAction(rateLabels);
  if (count === 1) return `1 line still needs a price. ${action}`;
  return `${count} lines still need prices. ${action}`;
}

/**
 * The single next pricing action. A missing rate comes before an open
 * specification, and either comes before treating the job as fully priced.
 * GST and Pricing review are not this action.
 */
export function priceCompletenessNextAction(input: {
  readonly missingPriceLineCount: number;
  readonly rateLabels?: readonly string[];
  readonly scopeCoverageGapCount?: number;
  readonly unresolvedSpecificationCount?: number;
}): string | null {
  if (input.missingPriceLineCount > 0) return namedMissingRateAction(input.rateLabels ?? []);
  if ((input.unresolvedSpecificationCount ?? 0) > 0) return CONFIRM_OPEN_SPECIFICATION;
  if ((input.scopeCoverageGapCount ?? 0) > 0) {
    return formatScopeCoverageGaps(input.scopeCoverageGapCount ?? 0);
  }
  return null;
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

/**
 * Visible conditions that do not make a priced job look incomplete.
 * Hazardous-materials Yes, Not sure, and unanswered demolition still block
 * through the commercial condition messages. This question is not that block.
 */
const ASSUMABLE_NONCONSUMED_CONDITION_QUESTION =
  /^(?:what floor(?: level)? (?:are )?(?:the )?works on|is (?:extra )?protection(?: \/| or) dust control required|is there asbestos or hazardous materials risk)\??$/i;

export function classifyReviewNotice(
  label: string
): "missing_price" | "scope_gap" | "specification" | null {
  const text = label.trim();
  if (!text) return null;
  if (ASSUMABLE_NONCONSUMED_CONDITION_QUESTION.test(text)) return null;
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
