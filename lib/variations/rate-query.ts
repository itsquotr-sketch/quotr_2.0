/**
 * Pure rate-search helpers. This module does not load the material catalogue,
 * so the Add item picker can filter a loaded list without a server call.
 */

export type VariationRateSearchFields = {
  canonicalKey: string;
  label: string;
  searchText: string;
  familyName: string | null;
  thickness: string | null;
  sheetSize: string | null;
  detail: string | null;
  source: "company_rate" | "quotr_benchmark";
  derived: boolean;
};

export function compactRateSearch(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("×", "x")
    .replaceAll("mm", "")
    .replace(/[^a-z0-9]+/g, "");
}

export function variationRateQueryMatches(haystack: string, query: string | undefined): boolean {
  const needle = query?.trim().toLowerCase() ?? "";
  if (!needle) return true;
  const tokens = needle.split(/\s+/).filter((token) => token.length > 0);
  const compact = compactRateSearch(haystack);
  const spaced = haystack.toLowerCase().replaceAll("×", " x ");
  return tokens.every((token) => spaced.includes(token) || compact.includes(compactRateSearch(token)));
}

function focusedText(rate: VariationRateSearchFields): string {
  return [rate.label, rate.familyName, rate.thickness, rate.sheetSize, rate.detail].filter(Boolean).join(" ");
}

/** Higher scores sort first. Exact label/variant matches outrank partial matches, then company, direct benchmark, derived benchmark. */
export function variationRateRank(rate: VariationRateSearchFields, query: string): number {
  const focused = focusedText(rate);
  const exact = variationRateQueryMatches(focused, query);
  const partial = variationRateQueryMatches(rate.searchText, query);
  let score = exact ? 1000 : partial ? 100 : 0;
  if (rate.source === "company_rate") score += 30;
  else if (!rate.derived) score += 20;
  else score += 10;
  return score;
}

export function variationRateHeading(rate: {
  label: string;
  familyName: string | null;
  thickness: string | null;
  sheetSize: string | null;
}): string {
  const shortFamily = rate.familyName?.replace(/^GIB\s+/i, "").trim();
  const parts = [rate.thickness, shortFamily, rate.sheetSize].filter((part): part is string => Boolean(part));
  if (parts.length >= 2) return parts.join(" ");
  return rate.label;
}

export function filterVariationRateOptions<T extends VariationRateSearchFields>(options: readonly T[], query: string): T[] {
  const needle = query.trim();
  const seen = new Set<string>();
  const matched: T[] = [];
  for (const option of options) {
    if (seen.has(option.canonicalKey)) continue;
    seen.add(option.canonicalKey);
    if (needle && !variationRateQueryMatches(option.searchText, needle)) continue;
    matched.push(option);
  }
  if (!needle) return matched;
  return matched.sort(
    (left, right) =>
      variationRateRank(right, needle) - variationRateRank(left, needle) || left.label.localeCompare(right.label) || left.canonicalKey.localeCompare(right.canonicalKey),
  );
}
