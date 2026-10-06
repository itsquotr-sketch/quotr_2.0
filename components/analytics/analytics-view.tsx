import Link from "next/link";
import { PeriodFilters } from "@/components/analytics/period-filters";
import { EstimateSheet, MetricLinkCard, RecordSheet } from "@/components/analytics/record-sheet";
import { TrendChart } from "@/components/analytics/trend-chart";
import { WorkAreaPanel } from "@/components/analytics/work-areas";
import { getStatusStripColor } from "@/components/projects/status-strip";
import type { AnalyticsView, BusinessAnalyticsView } from "@/lib/analytics/measure";
import {
  ACTIVE_PROJECTS_HREF,
  formatAcceptanceLine,
  formatTurnaround,
  pipelineGroups,
  pipelineStatusHref,
  sharePercents,
} from "@/lib/analytics/presentation";
import { formatPricingMoney } from "@/lib/pricing/format";
import { analyticsTimingAttribute } from "@/lib/analytics/server-timing";

/** Wraps from the content width, including a 200% browser zoom, instead of the viewport breakpoint. */
const summaryGridClass =
  "grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] items-stretch gap-2 lg:gap-3";

type AnalyticsViewProps = {
  view: AnalyticsView;
  upgrade: { message: string; href: string } | null;
  headlinePhase?: "ready" | "updating";
  businessPhase?: "ready" | "updating";
  headlineMs?: number | null;
  businessMs?: number | null;
  businessTiming?: Record<string, number> | null;
  businessError?: string | null;
};

export function AnalyticsView({
  view,
  upgrade,
  headlinePhase = "ready",
  businessPhase = "ready",
  headlineMs = null,
  businessMs = null,
  businessTiming = null,
  businessError = null,
}: AnalyticsViewProps) {
  return (
    <div
      className="min-w-0 space-y-3 lg:space-y-4"
      data-analytics-page
      data-analytics-tier={view.tier}
      data-analytics-query-ms={view.queryMs}
      data-analytics-wave1-ms={view.wave1Ms}
      data-analytics-wave2-ms={view.wave2Ms}
      data-analytics-server-timing={analyticsTimingAttribute(view.serverTiming)}
      data-analytics-headline-ms={headlineMs ?? undefined}
      data-analytics-business-ms={businessMs ?? undefined}
      data-analytics-business-timing={
        businessTiming ? analyticsTimingAttribute(businessTiming) : undefined
      }
    >
      <PeriodFilters
        periodId={view.periodId}
        periodLabel={view.periodLabel}
        periodRange={view.periodRange}
        from={view.from}
        to={view.to}
        timeZone={view.timeZone}
      />

      {view.incomplete ? (
        <p className="rounded-xl border border-border/60 bg-card px-4 py-3 text-sm text-muted-foreground">
          Some figures are hidden because this period has more records than Analytics can read in one pass.
        </p>
      ) : null}

      <section aria-labelledby="analytics-summary-heading">
        <h2 id="analytics-summary-heading" className="sr-only">
          Summary
        </h2>
        {headlinePhase === "updating" ? (
          <UpdatingSummary business={view.tier === "business"} />
        ) : (
        <div data-analytics-summary className={summaryGridClass}>
          <EstimateSheet
            label="Estimates created"
            value={formatCount(view.estimatesCreated)}
            context="First created in this range"
            records={view.estimateRecords}
            disabled={view.estimatesCreated == null}
            timeZone={view.timeZone}
          />
          <RecordSheet
            periodId={view.periodId}
            from={view.from}
            to={view.to}
            kind="sent"
            label="First sends"
            value={formatCount(view.quotesSent)}
            context={
              view.quotesSent === 0
                ? "No quotes sent in this range"
                : view.quotedValueExGst == null
                  ? "Quoted total unavailable"
                  : `${formatMoney(view.quotedValueExGst)} frozen at send`
            }
            title="First sends"
            description="Quotes with a first send in this range. Each amount is the ex GST subtotal frozen when that quote left draft. A revision is a different quote. This is not cash received."
            empty="No quotes were sent in this period."
            records={view.sentRecords}
            total={view.sentRecordTotal}
            timeZone={view.timeZone}
            disabled={view.quotesSent == null}
          />
          <RecordSheet
            periodId={view.periodId}
            from={view.from}
            to={view.to}
            kind="accepted"
            label="Accepted quotes"
            value={formatCount(view.quotesAccepted)}
            context="Accepted in this range"
            title="Accepted quotes"
            description="Quotes whose accepted snapshot falls in this range. This is not the same set as quotes first sent in the range. Variations are not included. This is contracted work, not cash received."
            empty="No quotes were accepted in this period."
            records={view.acceptedRecords}
            total={view.acceptedRecordTotal}
            timeZone={view.timeZone}
            disabled={view.quotesAccepted == null}
          />
          <RecordSheet
            periodId={view.periodId}
            from={view.from}
            to={view.to}
            kind="accepted"
            label="Accepted ex GST"
            value={view.quotesAccepted === 0 ? "None" : formatMoney(view.acceptedQuoteValueExGst)}
            context={
              view.quotesAccepted === 0
                ? "No accepted quotes in this range"
                : "Snapshot value, not cash received"
            }
            title="Accepted quote value"
            description="Sum of accepted snapshot prices ex GST in this period. Variations are not included. This is contracted work, not cash received."
            empty="No accepted quote value in this period."
            records={view.acceptedRecords}
            total={view.acceptedRecordTotal}
            timeZone={view.timeZone}
            disabled={view.acceptedQuoteValueExGst == null}
          />
          {view.tier === "business" ? (
            <div className="min-w-0">
            <RecordSheet
              periodId={view.periodId}
              from={view.from}
              to={view.to}
              kind="sent"
              label="Accepted from sent projects"
              value={formatAcceptanceLine(view.acceptance)}
              context="Send cohort, not accepted quotes this month"
              title="Projects first sent in this range"
              description="These are the projects first sent in the range. A row marked accepted has an acceptance snapshot. A row with no acceptance snapshot has not been accepted. Declined, expired, and superseded are not a separate status here."
              empty="No quotes were sent in this period."
              records={view.sentRecords}
              total={view.sentRecordTotal}
              timeZone={view.timeZone}
              disabled={view.acceptance.denominator == null}
            />
            </div>
          ) : (
            <MetricLinkCard
              href={ACTIVE_PROJECTS_HREF}
              label="Active projects"
              value={formatCount(view.activeProjects)}
              context="Current pipeline, not this range"
              disabled={view.activeProjects == null}
            />
          )}
        </div>
        )}
      </section>

      {view.tier === "business" && headlinePhase === "updating" ? (
        <section
          className="rounded-xl border border-border/60 bg-card px-4 py-6"
          data-analytics-trend-pending
          aria-busy="true"
        >
          <h2 className="text-sm font-medium">Commercial activity</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Updating quoted and accepted values for this range.
          </p>
        </section>
      ) : null}
      {view.tier === "business" && headlinePhase === "ready" ? (
        <div className="grid gap-3 xl:grid-cols-5">
          <div className="min-w-0 xl:col-span-3">
            <TrendChart trend={view.trend} unavailableReason={view.trendUnavailableReason} />
          </div>
          <FunnelPanel view={view} />
        </div>
      ) : null}
      {view.tier === "business" && businessPhase === "updating" ? <BusinessPending /> : null}
      {view.tier === "business" && businessPhase === "ready" && businessError ? (
        <p className="rounded-xl border border-border/60 bg-card px-4 py-3 text-sm text-muted-foreground">
          {businessError}
        </p>
      ) : null}
      {view.tier === "business" && businessPhase === "ready" && !businessError ? (
        <BusinessPanels view={view} />
      ) : null}

      {upgrade ? (
        <section
          className="rounded-xl border border-border/60 bg-card px-4 py-4"
          data-analytics-upgrade
        >
          <h2 className="text-sm font-medium">More detail on Business</h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">{upgrade.message}</p>
          <Link
            href={upgrade.href}
            className="mt-3 inline-flex min-h-11 items-center text-sm font-medium underline-offset-4 hover:underline"
          >
            View plans
          </Link>
        </section>
      ) : null}
    </div>
  );
}

function BusinessPanels({ view }: { view: BusinessAnalyticsView }) {
  return (
    <div className="space-y-3 lg:space-y-4" data-analytics-business>
      <WorkAreaPanel view={view} />

      <div className="grid gap-3 lg:grid-cols-2">
        <PricingPanel view={view} />
        <RateSourcePanel view={view} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <PipelinePanel view={view} />
        <VariationsPanel view={view} />
      </div>
    </div>
  );
}

function FunnelPanel({ view }: { view: BusinessAnalyticsView }) {
  return (
    <section className="rounded-xl border border-border/60 bg-card px-4 py-4 xl:col-span-2">
      <h2 className="text-sm font-medium">Quote conversion</h2>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
        {view.acceptance.unavailableReason ? "—" : formatAcceptanceLine(view.acceptance)}
      </p>
      <details className="mt-3">
        <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] [&::-webkit-details-marker]:hidden">
          How this differs from accepted quotes
        </summary>
        <p className="pb-2 text-xs leading-5 text-muted-foreground">
          This follows projects first sent in the range and counts how many have an acceptance snapshot since that send. Accepted quotes count snapshots dated in the selected range, which can be a different set.
        </p>
      </details>
      <div className="mt-3 border-t border-border/60 pt-3">
        <p className="text-[11px] font-medium text-muted-foreground">Time to acceptance</p>
        <p className="mt-1 text-lg font-semibold tabular-nums">{formatTurnaround(view.timing.medianDays)}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{timingCopy(view)}</p>
      </div>
    </section>
  );
}

const RATE_SWATCH: Record<string, string> = {
  "Your rates": "bg-neutral-950",
  "Quotr benchmark": "bg-neutral-500",
  Allowance: "bg-stone-400",
  "Pricing required": "bg-amber-500",
  "Not recorded": "bg-neutral-300",
  Other: "bg-neutral-400",
};

function RateSourcePanel({ view }: { view: BusinessAnalyticsView }) {
  const rows = view.rateSources ?? [];
  const total = rows.reduce((sum, row) => sum + row.lines, 0);
  const shares = sharePercents(rows.map((row) => row.lines));
  return (
    <section className="min-w-0 rounded-xl border border-border/60 bg-card px-4 py-4">
      <h2 className="text-sm font-medium">Rate sources</h2>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Estimate lines created in this range. Pricing required here is not the same count as a current Pricing document with no sell price. Quotr benchmark is the stored source, not a check that the price is accurate.
      </p>
      {view.rateSources == null ? (
        <p className="mt-3 text-sm text-muted-foreground">Rate sources are hidden because the read was incomplete.</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No estimate lines in this range.</p>
      ) : (
        <>
          <p className="mt-3 text-sm tabular-nums">{total} lines</p>
          <ul className="mt-1">
            {rows.map((row, index) => (
              <li key={row.label} className="flex min-h-11 items-center justify-between gap-3 border-t border-border/60 text-sm">
                <span className="inline-flex min-w-0 items-center gap-2">
                  <span className={`size-2.5 shrink-0 rounded-full ${RATE_SWATCH[row.label] ?? "bg-neutral-400"}`} aria-hidden />
                  {row.label}
                </span>
                <span className="tabular-nums">
                  {row.lines}
                  {shares ? <span className="text-muted-foreground"> · {shares[index]}%</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function PricingPanel({ view }: { view: BusinessAnalyticsView }) {
  const required = view.pricing.requiredCount;
  const unknown = view.pricing.unknownCostCount;
  const sell = view.pricing.unknownCostSellExGst;
  const documents = view.pricing.documents;
  const affected = documents.length;
  return (
    <section className="min-w-0 rounded-xl border border-border/60 bg-card px-4 py-4">
      <h2 className="text-sm font-medium">Pricing required</h2>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Current pricing documents, not estimate lines in the date range. Unknown cost is not treated as zero.
      </p>
      <p className="mt-3 text-lg font-semibold tabular-nums">
        {required == null
          ? "—"
          : required === 0
            ? "No lines with a missing sell price"
            : `${required} lines with no sell price`}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {unknown == null || sell == null
          ? "Sell with an unknown cost is unavailable."
          : unknown === 0
            ? "No priced lines with an unknown cost"
            : `${unknown} priced lines with unknown cost · ${formatPricingMoney(sell)} sell ex GST`}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {required == null ? "Affected documents are unavailable." : `${affected} pricing documents`}
      </p>
      {documents.length > 0 ? (
        <ul className="mt-2">
          {documents.slice(0, 8).map((document) => (
            <li key={document.pricingDocumentId} className="border-t border-border/60">
              <Link
                href={document.href}
                className="flex min-h-11 items-center justify-between gap-3 rounded-lg px-2 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
              >
                <span className="min-w-0 truncate">{document.projectTitle}</span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {document.unpricedLines} unpriced · {document.unknownCostLines} unknown cost
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function PipelinePanel({ view }: { view: BusinessAnalyticsView }) {
  const rows = view.pipeline ?? [];
  const groups = pipelineGroups(rows);
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <section className="min-w-0 rounded-xl border border-border/60 bg-card px-4 py-4">
      <h2 className="text-sm font-medium">Current pipeline</h2>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Current status, not the selected period. A sent quote is pipeline, not revenue.
      </p>
      {view.pipelineUnavailableReason || !view.pipeline ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {view.pipelineUnavailableReason ?? "Pipeline breakdown is unavailable."}
        </p>
      ) : (
        <>
          {total > 0 ? (
            <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
              {groups.primary.map((row) => (
                <span
                  key={row.status}
                  className={`h-full ${getStatusStripColor(row.status)}`}
                  style={{ width: `${(row.count / total) * 100}%` }}
                />
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No projects are in the current pipeline.</p>
          )}
          <ul className="mt-2">
            {groups.primary.map((row) => (
              <PipelineRow key={row.status} row={row} />
            ))}
          </ul>
          {groups.rest.length > 0 ? (
            <details className="mt-1">
              <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] [&::-webkit-details-marker]:hidden">
                Show all statuses
              </summary>
              <ul>
                {groups.rest.map((row) => (
                  <PipelineRow key={row.status} row={row} />
                ))}
              </ul>
            </details>
          ) : null}
        </>
      )}
    </section>
  );
}

function PipelineRow({
  row,
}: {
  row: { status: string; label: string; count: number };
}) {
  const href = pipelineStatusHref(row.status);
  const body = (
    <>
      <span className="inline-flex min-w-0 items-center gap-2">
        <span className={`size-2.5 shrink-0 rounded-full ${getStatusStripColor(row.status)}`} aria-hidden />
        <span className="min-w-0">{row.label}</span>
      </span>
      <span className="tabular-nums font-medium">{row.count}</span>
    </>
  );
  if (!href) {
    return (
      <li className="flex min-h-11 items-center justify-between gap-3 border-t border-border/60 text-sm">
        {body}
      </li>
    );
  }
  return (
    <li className="border-t border-border/60">
      <Link
        href={href}
        className="flex min-h-11 items-center justify-between gap-3 rounded-lg px-2 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
      >
        {body}
      </Link>
    </li>
  );
}

function VariationsPanel({ view }: { view: BusinessAnalyticsView }) {
  const count = view.variations.acceptedCount;
  const money = view.variations.adjustmentExGst;
  return (
    <section className="min-w-0 rounded-xl border border-border/60 bg-card px-4 py-4">
      <h2 className="text-sm font-medium">Accepted variations</h2>
      <p className="mt-2 text-xl font-semibold tabular-nums">
        {count == null || money == null
          ? "—"
          : count === 0
            ? "None in this range"
            : `${count} · ${formatPricingMoney(money)} ex GST`}
      </p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Separate from accepted quote value. Declined variations are not included.
      </p>
    </section>
  );
}

function timingCopy(view: BusinessAnalyticsView): string {
  if (view.quotesAccepted === 0) return "No quotes were accepted in this period.";
  if (view.timing.sample === 0) {
    return view.timing.excluded > 0
      ? `${view.timing.excluded} accepted ${view.timing.excluded === 1 ? "quote has" : "quotes have"} no reliable send time.`
      : "No accepted quote in this period has a send time.";
  }
  const base = `Median of ${view.timing.sample} accepted ${view.timing.sample === 1 ? "quote" : "quotes"} with a first-send time.`;
  if (view.timing.excluded === 0) return base;
  return `${base} ${view.timing.excluded} left out because the send time is missing or later than acceptance.`;
}

function UpdatingSummary({ business }: { business: boolean }) {
  const labels = business
    ? ["Estimates created", "First sends", "Accepted quotes", "Accepted ex GST", "Accepted from sent projects"]
    : ["Estimates created", "First sends", "Accepted quotes", "Accepted ex GST", "Active projects"];
  return (
    <div
      className={summaryGridClass}
      data-analytics-headlines-pending
      aria-busy="true"
    >
      {labels.map((label) => (
        <div key={label} className="min-h-11 rounded-xl border border-border/60 bg-card px-3 py-2">
          <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-lg font-semibold">Updating</p>
        </div>
      ))}
    </div>
  );
}

function BusinessPending() {
  return (
    <section
      className="rounded-xl border border-border/60 bg-card px-4 py-6"
      data-analytics-business-pending
      aria-busy="true"
    >
      <h2 className="text-sm font-medium">Updating this range</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Work areas, pricing, and pipeline are loading for the selected dates.
      </p>
    </section>
  );
}

function formatCount(value: number | null): string {
  return value == null ? "—" : String(value);
}

function formatMoney(value: number | null): string {
  return value == null ? "—" : formatPricingMoney(value);
}
