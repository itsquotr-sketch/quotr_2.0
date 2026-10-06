import { ANALYTICS_PERIODS, type AnalyticsPeriodId } from "@/lib/analytics/periods";

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

export function analyticsRangeHref(input: {
  period: string;
  from?: string | null;
  to?: string | null;
}): string {
  if (input.period === "custom" && input.from && input.to) {
    const params = new URLSearchParams({
      period: "custom",
      from: input.from,
      to: input.to,
    });
    return `/app/analytics?${params.toString()}`;
  }
  const period = ANALYTICS_PERIODS.some((row) => row.id === input.period)
    ? input.period
    : "this_month";
  return `/app/analytics?period=${period}`;
}

export function sharePercents(counts: readonly number[]): number[] | null {
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total < 8) return null;
  const exact = counts.map((count) => (count / total) * 100);
  const floors = exact.map((value) => Math.floor(value));
  let left = 100 - floors.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({ index, fraction: value - (floors[index] ?? 0) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  const shares = [...floors];
  for (const row of order) {
    if (left <= 0) break;
    shares[row.index] = (shares[row.index] ?? 0) + 1;
    left -= 1;
  }
  return shares;
}

export function trendDensity(input: {
  trend: ReadonlyArray<{ sent: number; accepted: number }>;
}): "empty" | "summary" | "chart" {
  const events = input.trend.reduce((sum, row) => sum + row.sent + row.accepted, 0);
  if (events === 0) return "empty";
  if (events < 8) return "summary";
  return "chart";
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

/** One bounded page of an already measured record list. Offset does not change the total. */
export function recordWindow<T>(
  records: readonly T[],
  offset: number,
  limit = 8
): { records: T[]; offset: number; limit: number; total: number; from: number; to: number } {
  const raw = Number.isFinite(offset) ? Math.floor(offset) : 0;
  const start = Math.min(Math.max(raw, 0), 10_000);
  const page = records.slice(start, start + limit);
  return {
    records: page,
    offset: start,
    limit,
    total: records.length,
    from: page.length === 0 ? 0 : start + 1,
    to: start + page.length,
  };
}

export function initialTrendIndex(
  trend: ReadonlyArray<{ sent: number; accepted: number }>
): number {
  for (let index = trend.length - 1; index >= 0; index -= 1) {
    if (trend[index].sent > 0 || trend[index].accepted > 0) return index;
  }
  return 0;
}

export function formatTrendReadout(point: {
  label: string;
  sent: number;
  accepted: number;
  quotedExGst?: number | null;
  acceptedExGst?: number | null;
}): string {
  const quoted =
    point.quotedExGst == null ? "" : ` · Quoted ${point.quotedExGst}`;
  const acceptedValue =
    point.acceptedExGst == null ? "" : ` · Accepted value ${point.acceptedExGst}`;
  return `${point.label} · Sent ${point.sent} · Accepted ${point.accepted}${quoted}${acceptedValue}`;
}
