import type { AnalyticsPeriodId } from "@/lib/analytics/periods";

/**
 * Presentation only. Metric maths stay in measure.ts.
 *
 * Projects → Active matches Analytics: non-deleted, non-archived,
 * ACTIVE_PIPELINE_STATUSES.
 *
 * Projects → Quote sent also excludes archived rows.
 * Lead, site visit, scoping, estimating, estimate ready, and quote draft
 * include archived projects, so those counts are not linked.
 */

export const ACTIVE_PROJECTS_HREF = "/app/projects?filter=active";

export function analyticsPeriodHref(period: AnalyticsPeriodId): string {
  return `/app/analytics?period=${period}`;
}

export function pipelineStatusHref(status: string): string | null {
  if (status === "quote_sent") return "/app/projects?filter=quote_sent";
  return null;
}

export function formatAcceptanceLine(input: {
  numerator: number | null;
  denominator: number | null;
  rate: number | null;
}): string {
  if (
    input.rate == null ||
    input.numerator == null ||
    input.denominator == null ||
    input.denominator === 0
  ) {
    return "—";
  }
  const percent = `${Math.round(input.rate * 1000) / 10}%`;
  const projects = input.denominator === 1 ? "project" : "projects";
  return `${percent} · ${input.numerator} of ${input.denominator} ${projects}`;
}

export function trendChartState(input: {
  trend: ReadonlyArray<{ sent: number; accepted: number }>;
  unavailableReason: string | null;
}): "unavailable" | "empty" | "chart" {
  const reason = input.unavailableReason ?? "";
  if (reason.includes("hidden") || reason.includes("incomplete")) {
    return "unavailable";
  }
  const useful = input.trend.some((row) => row.sent > 0 || row.accepted > 0);
  return useful ? "chart" : "empty";
}

export function pipelineGroups<T extends { count: number }>(
  rows: readonly T[]
): { primary: T[]; rest: T[] } {
  return {
    primary: rows.filter((row) => row.count > 0),
    rest: rows.filter((row) => row.count === 0),
  };
}

export function recordListIsPartial(listed: number, total: number): boolean {
  return total > listed;
}
