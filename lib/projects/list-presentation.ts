import {
  formatMissingPriceLines,
  formatScopeCoverageGaps,
} from "@/lib/assistant/presentation/estimate-issues";
import { formatStage } from "@/lib/projects/format";
import type { ProjectListItem } from "@/lib/projects/types";

export function projectPlace(project: ProjectListItem): string | null {
  const place = [project.client_name, project.site_address]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" · ");
  return place || null;
}

/** status_updated_at, otherwise created_at. No separate updated_at field. */
export function projectUpdatedAt(project: ProjectListItem): string {
  return project.status_updated_at ?? project.created_at;
}

/**
 * One supporting line beside the single business-status badge.
 * Uses quote, pricing, and estimate fields already on the list item.
 */
export function projectCurrentState(project: ProjectListItem): string {
  if (project.archived_at) return "Archived";

  const quote = project.quote_summary;
  if (quote) {
    switch (quote.status) {
      case "sent":
        return "Waiting on the client";
      case "viewed":
        return "Client opened the quote";
      case "accepted":
        return "Quote accepted";
      case "declined":
        return "Quote declined";
      case "expired":
        return "Quote expired";
      case "draft":
        return "Quote not sent";
      default:
        return "Quote in progress";
    }
  }

  const missingPrices = project.missing_price_line_count;
  const scopeGaps = project.scope_coverage_gap_count;
  const coverage = coverageState(missingPrices, scopeGaps);
  const pricing = project.pricing_summary;
  if (pricing) {
    if (pricing.needsRecalibration) return "Pricing needs another look";
    if (pricing.status === "reviewed") {
      if (coverage) return coverage;
      if (missingPrices == null || scopeGaps == null) return "Pricing needs review";
      return "Ready to quote";
    }
    if (pricing.status === "converted_to_quote") return "Moved into a quote";
    if (coverage) return `${coverage} · Pricing draft`;
    return "Pricing in draft";
  }

  if (project.has_estimate && project.estimate_is_stale) {
    return "Estimate out of date";
  }
  if (project.has_estimate && coverage) return coverage;
  if (project.has_estimate && (missingPrices == null || scopeGaps == null)) {
    return "Estimate needs review";
  }
  if (project.has_estimate) return "Ready to price";
  return formatStage(project.stage);
}

function coverageState(
  missingPrices: number | null | undefined,
  scopeGaps: number | null | undefined
): string | null {
  const lineText =
    missingPrices != null && missingPrices > 0
      ? formatMissingPriceLines(missingPrices)
      : null;
  const gapText =
    scopeGaps != null && scopeGaps > 0 ? formatScopeCoverageGaps(scopeGaps) : null;
  if (lineText && gapText) return `${lineText}. ${gapText}`;
  return lineText ?? gapText;
}
