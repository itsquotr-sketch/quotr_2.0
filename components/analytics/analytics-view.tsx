import Link from "next/link";
import { PeriodFilters } from "@/components/analytics/period-filters";
import { MetricLinkCard, RecordSheet } from "@/components/analytics/record-sheet";
import { TrendChart } from "@/components/analytics/trend-chart";
import type { AnalyticsView, BusinessAnalyticsView } from "@/lib/analytics/measure";
import {
  ACTIVE_PROJECTS_HREF,
  formatAcceptanceLine,
  pipelineGroups,
  pipelineStatusHref,
} from "@/lib/analytics/presentation";
import { formatPricingMoney } from "@/lib/pricing/format";

type AnalyticsViewProps = {
  view: AnalyticsView;
  upgrade: { message: string; href: string } | null;
};

export function AnalyticsView({ view, upgrade }: AnalyticsViewProps) {
  return (
    <div className="min-w-0 space-y-4" data-analytics-page data-analytics-tier={view.tier}>
      <PeriodFilters
        periodId={view.periodId}
        periodLabel={view.periodLabel}
        periodRange={view.periodRange}
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
        <div className="grid grid-cols-2 items-stretch gap-3 lg:grid-cols-4 lg:gap-4">
          <MetricLinkCard
            href={ACTIVE_PROJECTS_HREF}
            label="Active projects"
            value={formatCount(view.activeProjects)}
            context="Current pipeline, not this period"
            disabled={view.activeProjects == null}
          />
          <RecordSheet
            label="Quotes sent"
            value={formatCount(view.quotesSent)}
            context="First sends. Resends are not counted again."
            title="Quotes sent"
            description="First send in this period. A resend of the same quote is not another row."
            empty="No quotes were sent in this period."
            records={view.sentRecords}
            total={view.sentRecordTotal}
            timeZone={view.timeZone}
            disabled={view.quotesSent == null}
          />
          <RecordSheet
            label="Quotes accepted"
            value={formatCount(view.quotesAccepted)}
            context="Accepted in this period"
            title="Quotes accepted"
            description="Accepted commercial snapshots in this period. This is contracted work, not cash received."
            empty="No quotes were accepted in this period."
            records={view.acceptedRecords}
            total={view.acceptedRecordTotal}
            timeZone={view.timeZone}
            disabled={view.quotesAccepted == null}
          />
          <RecordSheet
            label="Accepted quote value"
            value={formatMoney(view.acceptedQuoteValueExGst)}
            context="Ex GST · contracted, not cash"
            title="Accepted quote value"
            description="Sum of accepted quote prices ex GST in this period. Variations are not included."
            empty="No accepted quote value in this period."
            records={view.acceptedRecords}
            total={view.acceptedRecordTotal}
            timeZone={view.timeZone}
            disabled={view.acceptedQuoteValueExGst == null}
          />
        </div>
      </section>

      {view.tier === "business" ? <BusinessSections view={view} /> : null}

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

function BusinessSections({ view }: { view: BusinessAnalyticsView }) {
  return (
    <div className="space-y-3 lg:space-y-4" data-analytics-business>
      <section className="rounded-xl border border-border/60 bg-card px-4 py-4">
        <h2 className="text-sm font-medium">Quote performance</h2>
        <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
          {formatAcceptanceLine(view.acceptance)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {view.acceptance.unavailableReason ??
            "Projects with a first send in this period that now have an accepted quote. Another revision is not another project."}
        </p>
        <div className="mt-4 border-t border-border/60 pt-3">
          <p className="text-[11px] font-medium text-muted-foreground">Median send to acceptance</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {view.timing.medianDays == null ? "—" : `${view.timing.medianDays} days`}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{timingCopy(view)}</p>
        </div>
      </section>

      <TrendChart trend={view.trend} unavailableReason={view.trendUnavailableReason} />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)] lg:gap-4">
        <PipelinePanel view={view} />
        <VariationsPanel view={view} />
      </div>
    </div>
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
              {groups.primary.map((row, index) => (
                <span
                  key={row.status}
                  className="h-full bg-foreground"
                  style={{
                    width: `${(row.count / total) * 100}%`,
                    opacity: Math.max(0.35, 1 - index * 0.12),
                  }}
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
      <span className="min-w-0">{row.label}</span>
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
        className="flex min-h-11 items-center justify-between gap-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
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

function formatCount(value: number | null): string {
  return value == null ? "—" : String(value);
}

function formatMoney(value: number | null): string {
  return value == null ? "—" : formatPricingMoney(value);
}
