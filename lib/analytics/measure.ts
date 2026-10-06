import { classifyRateSource } from "@/lib/estimate/rate-source-labels";
import { parseLineItemNotes } from "@/lib/estimate/line-item-metadata";
import { inferPersistedLineCostKnown } from "@/lib/pricing/authoritative-document-totals";
import { isManualScopePricingRequiredNote } from "@/lib/work-areas/scope-items/pricing-bridge";
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
 *
 * Estimates created — estimates.created_at in the period. One row per project,
 * so a regeneration does not add another estimate. Deleted projects are
 * excluded. Archived projects stay. Not an estimator filter: estimates have
 * no created_by.
 *
 * Quoted ex GST — sum of quotes.subtotal for quotes with a first quote_sent
 * in the period. Once a quote leaves draft, prevent_quote_snapshot_mutation
 * rejects a subtotal change, so this is the value frozen at send, not a later
 * edit and not cash. Each revision is its own quote. A missing total hides
 * the figure. Zero GST does not drop a positive subtotal. It is not the
 * accepted-snapshot population.
 *
 * Conversion cohort — projects with a first send in the period whose sent
 * quote now has an accepted snapshot. This is not accepted-in-period divided
 * by sent-in-period. Those headline counts are different populations.
 *
 * Work-area frequency — Business. Distinct estimates created in the period
 * that include the area. A mixed estimate counts once in each area. Its
 * value is not allocated across areas.
 *
 * Rate-source mix — Business. Line counts on those estimates, from the stored
 * rate_source text. A blank source is "Not recorded", not a default and not
 * a zero cost. Missing prices are their own count. Costs are not summed.
 *
 * Pricing required — Business. Current non-archived pricing items, not the
 * period. Unpriced rows are a count with no dollar value. A positive sell
 * whose stored cost is unknown is counted and its sell is summed; the unknown
 * cost is not treated as zero and no margin is derived.
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
  estimates?: readonly AnalyticsEstimate[];
  quoteTotals?: readonly AnalyticsQuoteTotal[];
  estimateLines?: readonly AnalyticsEstimateLine[];
  pricingItems?: readonly AnalyticsPricingItem[];
  areaLines?: readonly AnalyticsAreaLine[];
  limits: {
    sentTruncated: boolean;
    snapshotsTruncated: boolean;
    projectsTruncated: boolean;
    variationsTruncated: boolean;
    estimatesTruncated?: boolean;
    quoteTotalsTruncated?: boolean;
    linesTruncated?: boolean;
    areaMoneyTruncated?: boolean;
    pricingTruncated?: boolean;
  };
};

export type AnalyticsEstimate = {
  orgId: string;
  estimateId: string;
  projectId: string;
  createdAt: string;
  projectDeleted: boolean;
};

export type AnalyticsQuoteTotal = {
  orgId: string;
  quoteId: string;
  /** Stored quotes.subtotal, ex GST. */
  subtotalExGst: number;
};

export type AnalyticsAreaLine = {
  orgId: string;
  name: string;
  quoteId: string;
  /** Frozen quote line total, ex GST. Null when the line has no stored total. */
  lineExGst: number | null;
  kind: "quoted" | "accepted";
  /** False for optional or hidden lines. Those stay out of the quote total. */
  included?: boolean;
};

export type AnalyticsEstimateLine = {
  orgId: string;
  estimateId: string;
  workAreaName: string;
  rateSource: string | null;
  /** False when recommended_cost was not stored. Never coerced to zero. */
  costStored: boolean;
};

export type AnalyticsPricingItem = {
  orgId: string;
  projectId: string;
  label: string;
  notes: string | null;
  totalCost: number;
  totalSell: number;
  documentArchived: boolean;
  projectDeleted: boolean;
  pricingDocumentId: string;
};

export type AnalyticsWorkArea = {
  name: string;
  estimates: number;
  /** Distinct sent quotes with a line in this area. Null when the line read stopped early. */
  quotedQuotes: number | null;
  /** Sum of frozen quote line totals in this area. Null when the line read is incomplete. */
  quotedLineExGst: number | null;
  /** Sum of accepted snapshot line sell in this area. */
  acceptedLineExGst: number | null;
};

export type AnalyticsRateSource = {
  label: string;
  lines: number;
};

export type WorkAreaCheck = {
  quotedAreasExGst: number | null;
  quotedFrozenExGst: number | null;
  acceptedAreasExGst: number | null;
  acceptedFrozenExGst: number | null;
  /** Optional or hidden quoted lines. Shown so they are not dropped quietly. */
  optionalQuotedExGst: number | null;
};

export type PricingExposure = {
  requiredCount: number | null;
  unknownCostCount: number | null;
  /** Sell on rows whose cost is unknown. Null when the read is incomplete. */
  unknownCostSellExGst: number | null;
  documents: PricingDocumentLink[];
};

export type PricingDocumentLink = {
  projectId: string;
  projectTitle: string;
  pricingDocumentId: string;
  href: string;
  unpricedLines: number;
  unknownCostLines: number;
};

export type AnalyticsRecordLink = {
  projectId: string;
  projectTitle: string;
  href: string;
  occurredAt: string;
  quoteId: string;
  /** Accepted snapshot ex GST. Null on a send row. */
  amountExGst: number | null;
  note?: string | null;
};

export type PersonalAnalyticsView = {
  tier: "personal";
  periodId: PeriodWindow["id"];
  periodLabel: string;
  periodRange: string;
  timeZone: string;
  from: string | null;
  to: string | null;
  activeProjects: number | null;
  quotesSent: number | null;
  quotesAccepted: number | null;
  acceptedQuoteValueExGst: number | null;
  estimatesCreated: number | null;
  quotedValueExGst: number | null;
  sentRecords: AnalyticsRecordLink[];
  acceptedRecords: AnalyticsRecordLink[];
  estimateRecords: AnalyticsRecordLink[];
  sentRecordTotal: number;
  acceptedRecordTotal: number;
  estimateRecordTotal: number;
  queryMs: number;
  wave1Ms: number;
  wave2Ms: number;
  serverTiming: Record<string, number>;
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
  trend: Array<{
    label: string;
    sent: number;
    accepted: number;
    quotedExGst: number | null;
    acceptedExGst: number | null;
  }>;
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
  workAreas: AnalyticsWorkArea[] | null;
  workAreaCheck: WorkAreaCheck | null;
  rateSources: AnalyticsRateSource[] | null;
  pricing: PricingExposure;
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
  workAreas: AnalyticsWorkArea[] | null;
  workAreaCheck: WorkAreaCheck | null;
  rateSources: AnalyticsRateSource[] | null;
  pricing: PricingExposure;
  estimateRecords: AnalyticsRecordLink[];
  quotedValueExGst: number | null;
  estimatesCreated: number | null;
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

  const totals = new Map(
    (input.quoteTotals ?? [])
      .filter((row) => row.orgId === orgId)
      .map((row) => [row.quoteId, row.subtotalExGst])
  );
  const trendUnavailable = input.limits.sentTruncated || input.limits.snapshotsTruncated;
  const trend = trendUnavailable
    ? []
    : trendBuckets(input.window).map((bucket) => {
        const sentRows = sendsInPeriod.filter((row) =>
          inBucket(row.occurredAt, bucket.start, bucket.end)
        );
        const acceptedRows = acceptedInPeriod.filter((row) =>
          inBucket(row.acceptedAt, bucket.start, bucket.end)
        );
        const quotedValues = sentRows.map((row) => totals.get(row.quoteId));
        const quotedComplete = quotedValues.every(
          (value) => value != null && Number.isFinite(value)
        );
        return {
          label: bucket.label,
          sent: sentRows.length,
          accepted: acceptedRows.length,
          quotedExGst: quotedComplete
            ? sumExGst(quotedValues.filter((value): value is number => value != null))
            : null,
          acceptedExGst: sumExGst(acceptedRows.map((row) => row.sellExGst)),
        };
      });
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

  const estimatesInPeriod = (input.estimates ?? []).filter(
    (row) =>
      row.orgId === orgId &&
      !row.projectDeleted &&
      inPeriod(row.createdAt, input.window)
  );
  const estimatesCreated = input.limits.estimatesTruncated ? null : estimatesInPeriod.length;
  const estimateIdSet = new Set(estimatesInPeriod.map((row) => row.estimateId));

  let quotedValueExGst: number | null = null;
  if (!input.limits.sentTruncated && !input.limits.quoteTotalsTruncated) {
    const values: number[] = [];
    let complete = true;
    for (const row of sendsInPeriod) {
      const value = totals.get(row.quoteId);
      if (value == null || !Number.isFinite(value)) {
        complete = false;
        break;
      }
      values.push(value);
    }
    quotedValueExGst = complete ? sumExGst(values) : null;
  }

  const lines = (input.estimateLines ?? []).filter(
    (row) => row.orgId === orgId && estimateIdSet.has(row.estimateId)
  );
  const areaLines = (input.areaLines ?? []).filter((row) => row.orgId === orgId);
  const areaMoney = !input.limits.areaMoneyTruncated;
  const workAreas = input.limits.estimatesTruncated || input.limits.linesTruncated
    ? null
    : workAreaFrequency(lines, areaMoney ? areaLines : []).map((row) =>
        areaMoney
          ? row
          : { ...row, quotedQuotes: null, quotedLineExGst: null, acceptedLineExGst: null }
      );
  const workAreaCheck = areaMoney && workAreas
    ? reconcileWorkAreas({
        areas: workAreas,
        areaLines,
        quoteTotals: totals,
        sentQuoteIds: sendsInPeriod.map((row) => row.quoteId),
        acceptedTotal: acceptedQuoteValueExGst,
      })
    : null;
  const rateSources = input.limits.estimatesTruncated || input.limits.linesTruncated
    ? null
    : rateSourceMix(lines);

  const pricingRows = (input.pricingItems ?? []).filter(
    (row) => row.orgId === orgId && !row.documentArchived && !row.projectDeleted
  );
  const pricing = input.limits.pricingTruncated
    ? { requiredCount: null, unknownCostCount: null, unknownCostSellExGst: null, documents: [] }
    : pricingExposure(pricingRows, titles);

  const sentRecords = toLinks(sendsInPeriod, titles, "occurredAt", (quoteId) => {
    const value = totals.get(quoteId);
    return value == null || !Number.isFinite(value) ? null : value;
  }).map((record) => ({
    ...record,
    note: acceptedSentQuotes.has(record.projectId)
      ? "Accepted since this send"
      : "No acceptance snapshot",
  }));
  const estimateRecords = estimatesInPeriod
    .slice()
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((row) => ({
      projectId: row.projectId,
      projectTitle: titles.get(row.projectId) || "Project",
      href: `/app/projects/${row.projectId}`,
      occurredAt: row.createdAt,
      quoteId: row.estimateId,
      amountExGst: null,
    }));
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
    estimatesCreated,
    quotedValueExGst,
    estimateRecords,
    workAreas,
    workAreaCheck,
    rateSources,
    pricing,
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
      input.limits.variationsTruncated ||
      Boolean(input.limits.estimatesTruncated) ||
      Boolean(input.limits.quoteTotalsTruncated) ||
      Boolean(input.limits.linesTruncated) ||
      Boolean(input.limits.pricingTruncated) ||
      (quotesSent != null && quotesSent > 0 && quotedValueExGst == null),
  };
}

export function presentAnalytics(
  measured: AnalyticsMeasurement,
  tier: AnalyticsTier,
  window: PeriodWindow,
  recordPage?: { kind: "sent" | "accepted"; offset: number },
  queryMs = 0,
  waves: { wave1Ms?: number; wave2Ms?: number; serverTiming?: Record<string, number> } = {}
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
    from: window.from,
    to: window.to,
    activeProjects: measured.activeProjects,
    quotesSent: measured.quotesSent,
    quotesAccepted: measured.quotesAccepted,
    acceptedQuoteValueExGst: measured.acceptedQuoteValueExGst,
    estimatesCreated: measured.estimatesCreated,
    quotedValueExGst: measured.quotedValueExGst,
    sentRecords: sentPage.records,
    acceptedRecords: acceptedPage.records,
    estimateRecords: measured.estimateRecords,
    sentRecordTotal: sentPage.total,
    acceptedRecordTotal: acceptedPage.total,
    estimateRecordTotal: measured.estimateRecords.length,
    queryMs,
    wave1Ms: waves.wave1Ms ?? queryMs,
    wave2Ms: waves.wave2Ms ?? 0,
    serverTiming: waves.serverTiming ?? {},
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
    workAreas: measured.workAreas,
    workAreaCheck: measured.workAreaCheck,
    rateSources: measured.rateSources,
    pricing: measured.pricing,
  };
  return business;
}

export function classifyPricingExposure(item: {
  notes: string | null;
  totalCost: number;
  totalSell: number;
}): "required" | "unknown_cost" | "priced" {
  const metadata = parseLineItemNotes(item.notes).metadata;
  const missingSource = metadata.rateSourceType === "missing" && item.totalCost <= 0;
  const costKnown = missingSource
    ? false
    : inferPersistedLineCostKnown({
        total_cost: item.totalCost,
        total_sell: item.totalSell,
      });
  const sell = Number(item.totalSell);
  const unpriced = !Number.isFinite(sell) || sell <= 0;
  if ((isManualScopePricingRequiredNote(item.notes) && unpriced) || (!costKnown && unpriced)) {
    return "required";
  }
  if (!costKnown && Number.isFinite(sell) && sell > 0) return "unknown_cost";
  return "priced";
}

function moneyCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function reconcileWorkAreas(input: {
  areas: AnalyticsWorkArea[];
  areaLines: readonly AnalyticsAreaLine[];
  quoteTotals: ReadonlyMap<string, number>;
  sentQuoteIds: readonly string[];
  acceptedTotal: number | null;
}): WorkAreaCheck {
  const quoted = input.areaLines.filter((line) => line.kind === "quoted" && line.included !== false);
  const optional = input.areaLines.filter((line) => line.kind === "quoted" && line.included === false);
  const accepted = input.areaLines.filter((line) => line.kind === "accepted" && line.included !== false);
  const quotedIncomplete = quoted.some((line) => line.lineExGst == null || !Number.isFinite(line.lineExGst));
  const acceptedIncomplete = accepted.some((line) => line.lineExGst == null || !Number.isFinite(line.lineExGst));
  const lineByQuote = new Map<string, number>();
  for (const line of quoted) {
    if (line.lineExGst == null) continue;
    lineByQuote.set(line.quoteId, (lineByQuote.get(line.quoteId) ?? 0) + line.lineExGst);
  }
  let quotedFrozen = 0;
  let quotedKnown = true;
  let quotedGap = 0;
  for (const id of input.sentQuoteIds) {
    const total = input.quoteTotals.get(id);
    if (total == null || !Number.isFinite(total)) {
      quotedKnown = false;
      continue;
    }
    quotedFrozen += total;
    quotedGap += total - (lineByQuote.get(id) ?? 0);
  }
  quotedGap = moneyCents(quotedGap);
  if (quotedKnown && !quotedIncomplete && quotedGap !== 0) {
    addGap(input.areas, "quotedLineExGst", quotedGap);
  }
  const acceptedLineSum = moneyCents(
    accepted.reduce((sum, line) => sum + (line.lineExGst ?? 0), 0)
  );
  const acceptedGap =
    input.acceptedTotal == null ? 0 : moneyCents(input.acceptedTotal - acceptedLineSum);
  if (input.acceptedTotal != null && !acceptedIncomplete && acceptedGap !== 0) {
    addGap(input.areas, "acceptedLineExGst", acceptedGap);
  }
  const quotedAreas = moneyCents(
    input.areas.reduce((sum, row) => sum + (row.quotedLineExGst ?? 0), 0)
  );
  const acceptedAreas = moneyCents(
    input.areas.reduce((sum, row) => sum + (row.acceptedLineExGst ?? 0), 0)
  );
  return {
    quotedAreasExGst: quotedKnown && !quotedIncomplete ? quotedAreas : null,
    quotedFrozenExGst: quotedKnown && !quotedIncomplete ? moneyCents(quotedFrozen) : null,
    acceptedAreasExGst: input.acceptedTotal == null || acceptedIncomplete ? null : acceptedAreas,
    acceptedFrozenExGst:
      input.acceptedTotal == null || acceptedIncomplete ? null : moneyCents(input.acceptedTotal),
    optionalQuotedExGst: optional.some((line) => line.lineExGst == null)
      ? null
      : moneyCents(optional.reduce((sum, line) => sum + (line.lineExGst ?? 0), 0)),
  };
}

function addGap(
  areas: AnalyticsWorkArea[],
  field: "quotedLineExGst" | "acceptedLineExGst",
  gap: number
): void {
  const current = areas.find((row) => row.name === "Unallocated");
  if (current) {
    current[field] = moneyCents((current[field] ?? 0) + gap);
    return;
  }
  areas.push({
    name: "Unallocated",
    estimates: 0,
    quotedQuotes: 0,
    quotedLineExGst: field === "quotedLineExGst" ? gap : 0,
    acceptedLineExGst: field === "acceptedLineExGst" ? gap : 0,
  });
}

function areaLabel(name: string): string {
  const trimmed = name.trim();
  return trimmed || "Unallocated";
}

function workAreaFrequency(
  lines: readonly AnalyticsEstimateLine[],
  areaLines: readonly AnalyticsAreaLine[]
): AnalyticsWorkArea[] {
  const sets = new Map<string, Set<string>>();
  for (const line of lines) {
    const name = areaLabel(line.workAreaName);
    const current = sets.get(name) ?? new Set<string>();
    current.add(line.estimateId);
    sets.set(name, current);
  }
  const quoted = new Map<string, { quotes: Set<string>; values: number[]; complete: boolean }>();
  const accepted = new Map<string, { values: number[]; complete: boolean }>();
  for (const line of areaLines) {
    if (line.included === false) continue;
    const name = areaLabel(line.name);
    if (line.kind === "quoted") {
      const current = quoted.get(name) ?? { quotes: new Set<string>(), values: [], complete: true };
      current.quotes.add(line.quoteId);
      if (line.lineExGst == null || !Number.isFinite(line.lineExGst)) current.complete = false;
      else current.values.push(line.lineExGst);
      quoted.set(name, current);
    } else {
      const current = accepted.get(name) ?? { values: [], complete: true };
      if (line.lineExGst == null || !Number.isFinite(line.lineExGst)) current.complete = false;
      else current.values.push(line.lineExGst);
      accepted.set(name, current);
    }
  }
  const names = new Set([...sets.keys(), ...quoted.keys(), ...accepted.keys()]);
  return [...names]
    .map((name) => ({
      name,
      estimates: sets.get(name)?.size ?? 0,
      quotedQuotes: quoted.get(name)?.quotes.size ?? 0,
      quotedLineExGst: quoted.get(name)?.complete === false ? null : sumExGst(quoted.get(name)?.values ?? []),
      acceptedLineExGst:
        accepted.get(name)?.complete === false ? null : sumExGst(accepted.get(name)?.values ?? []),
    }))
    .sort((a, b) => {
      if (a.name === "Unallocated") return 1;
      if (b.name === "Unallocated") return -1;
      return (
        b.estimates + (b.quotedQuotes ?? 0) - (a.estimates + (a.quotedQuotes ?? 0)) ||
        a.name.localeCompare(b.name)
      );
    });
}

function rateSourceMix(lines: readonly AnalyticsEstimateLine[]): AnalyticsRateSource[] {
  const counts = new Map<string, number>();
  for (const line of lines) {
    const label = rateSourceLabel(line.rateSource);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, lines: count }))
    .sort((a, b) => b.lines - a.lines || a.label.localeCompare(b.label));
}

function rateSourceLabel(raw: string | null): string {
  if (raw == null || raw.trim() === "") return "Not recorded";
  const token = raw.trim().toLowerCase();
  if (token === "missing" || token === "rate_missing") return "Pricing required";
  if (token === "user_rate" || token === "work_area_rate" || token === "calibrated_productivity") {
    return "Your rates";
  }
  const source = classifyRateSource(raw);
  if (source === "user_rate" || source === "work_area_rate" || source === "calibrated_productivity") {
    return "Your rates";
  }
  if (source === "benchmark" || source === "productivity") return "Quotr benchmark";
  if (source === "missing") return "Pricing required";
  if (source === "fallback" || source === "default") return "Allowance";
  return "Other";
}

function pricingExposure(
  rows: readonly AnalyticsPricingItem[],
  titles: ReadonlyMap<string, string>
): PricingExposure {
  let requiredCount = 0;
  let unknownCostCount = 0;
  const sells: number[] = [];
  const documents = new Map<string, PricingDocumentLink>();
  for (const row of rows) {
    const kind = classifyPricingExposure(row);
    if (kind === "priced") continue;
    if (kind === "required") requiredCount += 1;
    if (kind === "unknown_cost") {
      unknownCostCount += 1;
      sells.push(row.totalSell);
    }
    const current = documents.get(row.pricingDocumentId) ?? {
      projectId: row.projectId,
      projectTitle: titles.get(row.projectId) || "Project",
      pricingDocumentId: row.pricingDocumentId,
      href: `/app/projects/${row.projectId}/pricing/${row.pricingDocumentId}`,
      unpricedLines: 0,
      unknownCostLines: 0,
    };
    if (kind === "required") current.unpricedLines += 1;
    if (kind === "unknown_cost") current.unknownCostLines += 1;
    documents.set(row.pricingDocumentId, current);
  }
  return {
    requiredCount,
    unknownCostCount,
    unknownCostSellExGst: sumExGst(sells),
    documents: [...documents.values()].sort(
      (a, b) => b.unpricedLines + b.unknownCostLines - (a.unpricedLines + a.unknownCostLines)
    ),
  };
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
