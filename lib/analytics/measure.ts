import { ACTIVE_PIPELINE_STATUSES, getBusinessStatusDefinition } from "@/lib/projects/status";
import type { AnalyticsTier } from "@/lib/analytics/access";
import { recordWindow } from "@/lib/analytics/presentation";
import {
  formatPeriodRange,
  inPeriod,
  trendBuckets,
  type PeriodWindow,
} from "@/lib/analytics/periods";

export const ANALYTICS_LINK_LIMIT = 8;

/**
 * Metric contract
 *
 * Active projects — current Dashboard pipeline. Non-deleted, non-archived
 * projects whose business_status is in ACTIVE_PIPELINE_STATUSES. Not filtered
 * by the selected period. A sent quote sitting in quote_sent is pipeline, not
 * revenue.
 *
 * Quotes sent — distinct quotes with a quote_events row of event_type
 * quote_sent whose occurred_at falls in the period. Resends do not create
 * another quote_sent row and are not counted. Viewed, declined, expired, and
 * superseded events are not sends. Each revision is its own quote. Archived
 * projects still count.
 *
 * Quotes accepted — accepted_commercial_snapshots whose accepted_at falls in
 * the period. One snapshot per quote. A quote_accepted event without a
 * snapshot is not an acceptance. Value is the sum of sell_ex_gst (contracted
 * value ex GST), never sell_incl_gst and never cash received.
 *
 * Acceptance rate — Business. Denominator: distinct projects with a quote_sent
 * event in the period. Extra revisions do not increase it. Numerator: those
 * projects whose in-period sent quote has an accepted snapshot, whenever that
 * snapshot was accepted. Zero denominator is null, displayed as —.
 *
 * Pipeline — Business. Current active-status counts. Not a historical series.
 * Trend — Business. quote_sent events and in-period snapshot acceptances,
 * bucketed in the organisation timezone. Hidden when a source query is truncated.
 *
 * Timing — Business. Median elapsed days from that quote's quote_sent
 * occurred_at to the snapshot accepted_at, for snapshots accepted in the
 * period. Missing or inverted send times are excluded, not treated as zero.
 *
 * Variations — Business. variation rows with status accepted and accepted_at
 * in the period. Adjustment is net_adjustment_ex_gst. Rejected variations are
 * ignored. The adjustment is not added to the accepted quote baseline.
 */

export type AnalyticsProject = {
  id: string;
  orgId: string;
  title: string;
  businessStatus: string;
  archivedAt: string | null;
  deletedAt: string | null;
};

export type AnalyticsQuoteEvent = {
  orgId: string;
  quoteId: string;
  projectId: string;
  eventType: string;
  occurredAt: string;
};

export type AnalyticsSnapshot = {
  orgId: string;
  quoteId: string;
  projectId: string;
  sellExGst: number;
  gstRate: number;
  sellInclGst: number;
  acceptedAt: string;
};

export type AnalyticsVariation = {
  orgId: string;
  variationId: string;
  projectId: string;
  status: "accepted" | "rejected" | "draft" | "issued" | "withdrawn" | "superseded";
  netAdjustmentExGst: number;
  gstRate: number;
  adjustmentInclGst: number;
  acceptedAt: string | null;
};

export type AnalyticsDelivery = {
  orgId: string;
  quoteId: string;
  kind: "send" | "resend";
};

export type AnalyticsMeasureInput = {
  orgId: string;
  window: PeriodWindow;
  projects: readonly AnalyticsProject[];
  quoteEvents: readonly AnalyticsQuoteEvent[];
  snapshots: readonly AnalyticsSnapshot[];
  variations: readonly AnalyticsVariation[];
  /** Ignored by every measure. Present so fixtures can prove resends are not sends. */
  deliveries?: readonly AnalyticsDelivery[];
  activeProjectCount?: number | null;
  limits: {
    sentTruncated: boolean;
    snapshotsTruncated: boolean;
    projectsTruncated: boolean;
    variationsTruncated: boolean;
  };
};

export type AnalyticsRecordLink = {
  projectId: string;
  projectTitle: string;
  href: string;
  occurredAt: string;
  quoteId: string;
  /** Accepted snapshot ex GST. Null on a send row. */
  amountExGst: number | null;
};

export type PersonalAnalyticsView = {
  tier: "personal";
  periodId: PeriodWindow["id"];
  periodLabel: string;
  periodRange: string;
  timeZone: string;
  activeProjects: number | null;
  quotesSent: number | null;
  quotesAccepted: number | null;
  acceptedQuoteValueExGst: number | null;
  sentRecords: AnalyticsRecordLink[];
  acceptedRecords: AnalyticsRecordLink[];
  sentRecordTotal: number;
  acceptedRecordTotal: number;
  incomplete: boolean;
};

export type BusinessAnalyticsView = Omit<PersonalAnalyticsView, "tier"> & {
  tier: "business";
  acceptance: {
    numerator: number | null;
    denominator: number | null;
    rate: number | null;
    unavailableReason: string | null;
  };
  pipeline: Array<{ status: string; label: string; count: number }> | null;
  pipelineUnavailableReason: string | null;
  trend: Array<{ label: string; sent: number; accepted: number }>;
  trendUnavailableReason: string | null;
  timing: {
    medianDays: number | null;
    sample: number;
    excluded: number;
  };
  variations: {
    acceptedCount: number | null;
    adjustmentExGst: number | null;
  };
};

export type AnalyticsView = PersonalAnalyticsView | BusinessAnalyticsView;

export type AnalyticsMeasurement = {
  activeProjects: number | null;
  quotesSent: number | null;
  quotesAccepted: number | null;
  acceptedQuoteValueExGst: number | null;
  sentQuoteIds: string[];
  acceptedQuoteIds: string[];
  sentRecords: AnalyticsRecordLink[];
  acceptedRecords: AnalyticsRecordLink[];
  acceptance: BusinessAnalyticsView["acceptance"];
  pipeline: BusinessAnalyticsView["pipeline"];
  pipelineUnavailableReason: string | null;
  trend: BusinessAnalyticsView["trend"];
  trendUnavailableReason: string | null;
  timing: BusinessAnalyticsView["timing"];
  variations: BusinessAnalyticsView["variations"];
  incomplete: boolean;
};

export function measureAnalytics(input: AnalyticsMeasureInput): AnalyticsMeasurement {
  const orgId = input.orgId;
  const projects = input.projects.filter((row) => row.orgId === orgId);
  const events = input.quoteEvents.filter((row) => row.orgId === orgId);
  const snapshots = dedupeSnapshots(
    input.snapshots.filter((row) => row.orgId === orgId)
  );
  const variations = input.variations.filter((row) => row.orgId === orgId);
  const titles = new Map(projects.map((row) => [row.id, row.title]));

  const activeFromRows = projects.filter(isCurrentPipelineProject).length;
  const activeProjects =
    input.activeProjectCount === null
      ? null
      : input.activeProjectCount !== undefined
        ? input.activeProjectCount
        : input.limits.projectsTruncated
          ? null
          : activeFromRows;

  const sendsInPeriod = distinctByQuote(
    events.filter(
      (row) => row.eventType === "quote_sent" && inPeriod(row.occurredAt, input.window)
    )
  );
  const quotesSent = input.limits.sentTruncated ? null : sendsInPeriod.length;

  const acceptedInPeriod = snapshots.filter((row) =>
    inPeriod(row.acceptedAt, input.window)
  );
  const quotesAccepted = input.limits.snapshotsTruncated
    ? null
    : acceptedInPeriod.length;
  const acceptedQuoteValueExGst = input.limits.snapshotsTruncated
    ? null
    : sumExGst(acceptedInPeriod.map((row) => row.sellExGst));

  const sentQuoteIds = new Set(sendsInPeriod.map((row) => row.quoteId));
  const projectsSent = new Set(sendsInPeriod.map((row) => row.projectId));
  const acceptedSentQuotes = new Set(
    snapshots
      .filter((row) => sentQuoteIds.has(row.quoteId))
      .map((row) => row.projectId)
  );
  const numerator = [...projectsSent].filter((projectId) =>
    acceptedSentQuotes.has(projectId)
  ).length;

  let acceptance: BusinessAnalyticsView["acceptance"];
  if (input.limits.sentTruncated) {
    acceptance = {
      numerator: null,
      denominator: null,
      rate: null,
      unavailableReason:
        "Acceptance rate is hidden because not every send in this period could be read.",
    };
  } else if (projectsSent.size === 0) {
    acceptance = {
      numerator: 0,
      denominator: 0,
      rate: null,
      unavailableReason: "No project was sent a quote in this period.",
    };
  } else {
    acceptance = {
      numerator,
      denominator: projectsSent.size,
      rate: numerator / projectsSent.size,
      unavailableReason: null,
    };
  }

  const pipeline = input.limits.projectsTruncated
    ? null
    : ACTIVE_PIPELINE_STATUSES.map((status) => ({
        status,
        label: getBusinessStatusDefinition(status).label,
        count: projects.filter(
          (row) => isCurrentPipelineProject(row) && row.businessStatus === status
        ).length,
      }));

  const trendUnavailable = input.limits.sentTruncated || input.limits.snapshotsTruncated;
  const trend = trendUnavailable
    ? []
    : trendBuckets(input.window).map((bucket) => ({
        label: bucket.label,
        sent: sendsInPeriod.filter((row) =>
          inBucket(row.occurredAt, bucket.start, bucket.end)
        ).length,
        accepted: acceptedInPeriod.filter((row) =>
          inBucket(row.acceptedAt, bucket.start, bucket.end)
        ).length,
      }));
  const trendHasActivity = trend.some((bucket) => bucket.sent > 0 || bucket.accepted > 0);

  const sendTimeByQuote = new Map<string, string>();
  for (const row of events) {
    if (row.eventType !== "quote_sent") continue;
    const existing = sendTimeByQuote.get(row.quoteId);
    if (!existing || Date.parse(row.occurredAt) < Date.parse(existing)) {
      sendTimeByQuote.set(row.quoteId, row.occurredAt);
    }
  }

  const durations: number[] = [];
  let excluded = 0;
  if (!input.limits.snapshotsTruncated) {
    for (const row of acceptedInPeriod) {
      const sentAt = sendTimeByQuote.get(row.quoteId);
      if (!sentAt) {
        excluded += 1;
        continue;
      }
      const days = (Date.parse(row.acceptedAt) - Date.parse(sentAt)) / 86_400_000;
      if (!Number.isFinite(days) || days < 0) {
        excluded += 1;
        continue;
      }
      durations.push(days);
    }
  }

  const acceptedVariations = variations.filter(
    (row) =>
      row.status === "accepted" &&
      row.acceptedAt != null &&
      inPeriod(row.acceptedAt, input.window)
  );
  const variationsResult: BusinessAnalyticsView["variations"] =
    input.limits.variationsTruncated
      ? { acceptedCount: null, adjustmentExGst: null }
      : {
          acceptedCount: acceptedVariations.length,
          adjustmentExGst: sumExGst(
            acceptedVariations.map((row) => row.netAdjustmentExGst)
          ),
        };

  const sentRecords = toLinks(sendsInPeriod, titles, "occurredAt", () => null);
  const acceptedRecords = toLinks(
    acceptedInPeriod,
    titles,
    "acceptedAt",
    (quoteId) => acceptedInPeriod.find((row) => row.quoteId === quoteId)?.sellExGst ?? null
  );

  return {
    activeProjects,
    quotesSent,
    quotesAccepted,
    acceptedQuoteValueExGst,
    sentQuoteIds: sendsInPeriod.map((row) => row.quoteId),
    acceptedQuoteIds: acceptedInPeriod.map((row) => row.quoteId),
    sentRecords,
    acceptedRecords,
    acceptance,
    pipeline,
    pipelineUnavailableReason: input.limits.projectsTruncated
      ? "Pipeline breakdown is hidden because not every active project could be read."
      : null,
    trend: trendHasActivity ? trend : [],
    trendUnavailableReason: trendUnavailable
      ? "The period trend is hidden because a source query was incomplete."
      : trendHasActivity
        ? null
        : "No quotes were sent or accepted in this period.",
    timing: {
      medianDays: input.limits.snapshotsTruncated ? null : median(durations),
      sample: input.limits.snapshotsTruncated ? 0 : durations.length,
      excluded: input.limits.snapshotsTruncated ? 0 : excluded,
    },
    variations: variationsResult,
    incomplete:
      input.limits.sentTruncated ||
      input.limits.snapshotsTruncated ||
      input.limits.projectsTruncated ||
      input.limits.variationsTruncated,
  };
}

export function presentAnalytics(
  measured: AnalyticsMeasurement,
  tier: AnalyticsTier,
  window: PeriodWindow,
  recordPage?: { kind: "sent" | "accepted"; offset: number }
): AnalyticsView {
  const sentPage = recordWindow(
    measured.sentRecords,
    recordPage?.kind === "sent" ? recordPage.offset : 0,
    ANALYTICS_LINK_LIMIT
  );
  const acceptedPage = recordWindow(
    measured.acceptedRecords,
    recordPage?.kind === "accepted" ? recordPage.offset : 0,
    ANALYTICS_LINK_LIMIT
  );
  const personal: PersonalAnalyticsView = {
    tier: "personal",
    periodId: window.id,
    periodLabel: window.label,
    periodRange: formatPeriodRange(window),
    timeZone: window.timeZone,
    activeProjects: measured.activeProjects,
    quotesSent: measured.quotesSent,
    quotesAccepted: measured.quotesAccepted,
    acceptedQuoteValueExGst: measured.acceptedQuoteValueExGst,
    sentRecords: sentPage.records,
    acceptedRecords: acceptedPage.records,
    sentRecordTotal: sentPage.total,
    acceptedRecordTotal: acceptedPage.total,
    incomplete: measured.incomplete,
  };
  if (tier !== "business") return personal;
  const business: BusinessAnalyticsView = {
    ...personal,
    tier: "business",
    acceptance: measured.acceptance,
    pipeline: measured.pipeline,
    pipelineUnavailableReason: measured.pipelineUnavailableReason,
    trend: measured.trend,
    trendUnavailableReason: measured.trendUnavailableReason,
    timing: measured.timing,
    variations: measured.variations,
  };
  return business;
}

function isCurrentPipelineProject(project: AnalyticsProject): boolean {
  if (project.deletedAt) return false;
  if (project.archivedAt) return false;
  return ACTIVE_PIPELINE_STATUSES.includes(
    project.businessStatus as (typeof ACTIVE_PIPELINE_STATUSES)[number]
  );
}

function distinctByQuote(events: AnalyticsQuoteEvent[]): AnalyticsQuoteEvent[] {
  const seen = new Set<string>();
  const rows: AnalyticsQuoteEvent[] = [];
  const ordered = [...events].sort(
    (a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt)
  );
  for (const row of ordered) {
    if (seen.has(row.quoteId)) continue;
    seen.add(row.quoteId);
    rows.push(row);
  }
  return rows;
}

function dedupeSnapshots(rows: readonly AnalyticsSnapshot[]): AnalyticsSnapshot[] {
  const byQuote = new Map<string, AnalyticsSnapshot>();
  for (const row of rows) {
    const existing = byQuote.get(row.quoteId);
    if (!existing || Date.parse(row.acceptedAt) < Date.parse(existing.acceptedAt)) {
      byQuote.set(row.quoteId, row);
    }
  }
  return [...byQuote.values()];
}

function sumExGst(values: number[]): number | null {
  let cents = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) return null;
    cents += Math.round(value * 100);
  }
  return cents / 100;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const raw =
    sorted.length % 2 === 1
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  return Math.round(raw * 10) / 10;
}

function inBucket(iso: string, start: string, end: string): boolean {
  const time = Date.parse(iso);
  return time >= Date.parse(start) && time < Date.parse(end);
}

function toLinks(
  rows: Array<{ quoteId: string; projectId: string; occurredAt?: string; acceptedAt?: string }>,
  titles: Map<string, string>,
  field: "occurredAt" | "acceptedAt",
  amountFor: (quoteId: string) => number | null
): AnalyticsRecordLink[] {
  return [...rows]
    .sort((a, b) => {
      const aTime = Date.parse(field === "occurredAt" ? a.occurredAt ?? "" : a.acceptedAt ?? "");
      const bTime = Date.parse(field === "occurredAt" ? b.occurredAt ?? "" : b.acceptedAt ?? "");
      return bTime - aTime;
    })
    .map((row) => ({
      projectId: row.projectId,
      projectTitle: titles.get(row.projectId) || "Project",
      href: `/app/projects/${row.projectId}`,
      occurredAt: (field === "occurredAt" ? row.occurredAt : row.acceptedAt) ?? "",
      quoteId: row.quoteId,
      amountExGst: amountFor(row.quoteId),
    }));
}
