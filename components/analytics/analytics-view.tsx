import Link from "next/link";
import { ANALYTICS_PERIODS } from "@/lib/analytics/periods";
import { formatInOrgTimezone } from "@/lib/org/timezone";
import { formatPricingMoney } from "@/lib/pricing/format";
import type { AnalyticsView, BusinessAnalyticsView } from "@/lib/analytics/measure";
import { cn } from "@/lib/utils";

type AnalyticsViewProps = {
  view: AnalyticsView;
  upgrade: { message: string; href: string } | null;
};

export function AnalyticsView({ view, upgrade }: AnalyticsViewProps) {
  return (
    <div className="space-y-4" data-analytics-page data-analytics-tier={view.tier}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <p className="text-sm text-muted-foreground">{view.periodRange}</p>
        <nav aria-label="Period" className="flex flex-wrap gap-x-1 gap-y-1">
          {ANALYTICS_PERIODS.map((period) => {
            const selected = period.id === view.periodId;
            return (
              <Link
                key={period.id}
                href={`/app/analytics?period=${period.id}`}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center border-b-2 px-2 text-sm",
                  selected
                    ? "border-foreground font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {period.label}
              </Link>
            );
          })}
        </nav>
      </div>

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
          <MetricLink
            href="/app/projects"
            label="Active projects"
            value={formatCount(view.activeProjects)}
            context="Current pipeline"
          />
          <MetricCard
            label="Quotes sent"
            value={formatCount(view.quotesSent)}
            context="First sends in this period"
          />
          <MetricCard
            label="Quotes accepted"
            value={formatCount(view.quotesAccepted)}
            context="Accepted in this period"
          />
          <MetricCard
            label="Accepted quote value"
            value={formatMoney(view.acceptedQuoteValueExGst)}
            context="Ex GST · contracted, not cash"
          />
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
        <RecordList
          title="Quotes sent"
          empty="No quotes were sent in this period."
          records={view.sentRecords}
          total={view.sentRecordTotal}
          timeZone={view.timeZone}
        />
        <RecordList
          title="Quotes accepted"
          empty="No quotes were accepted in this period."
          records={view.acceptedRecords}
          total={view.acceptedRecordTotal}
          timeZone={view.timeZone}
        />
      </div>

      {view.tier === "business" ? <BusinessSections view={view} /> : null}

      {upgrade ? (
        <section className="rounded-xl border border-border/60 bg-card px-4 py-4" data-analytics-upgrade>
          <h2 className="text-sm font-medium">More detail on Business</h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">{upgrade.message}</p>
          <Link
            href={upgrade.href}
            className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            View plans
          </Link>
        </section>
      ) : null}
    </div>
  );
}

function BusinessSections({ view }: { view: BusinessAnalyticsView }) {
  const maxTrend = Math.max(
    1,
    ...view.trend.map((bucket) => Math.max(bucket.sent, bucket.accepted))
  );

  return (
    <div className="space-y-3 lg:space-y-4" data-analytics-business>
      <section className="rounded-xl border border-border/60 bg-card px-4 py-4">
        <h2 className="text-[11px] font-medium text-muted-foreground">Acceptance rate</h2>
        <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
          {view.acceptance.rate == null ? "—" : formatRate(view.acceptance.rate)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {view.acceptance.unavailableReason ??
            `${view.acceptance.numerator} of ${view.acceptance.denominator} projects sent in this period have an accepted quote. Further revisions are not counted again.`}
        </p>
      </section>

      <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
        <section className="rounded-xl border border-border/60 bg-card px-4 py-4">
          <h2 className="text-[11px] font-medium text-muted-foreground">Pipeline</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Current pipeline. This is not the selected period, and a sent quote is not revenue.
          </p>
          {view.pipelineUnavailableReason || !view.pipeline ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {view.pipelineUnavailableReason ?? "Pipeline breakdown is unavailable."}
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border/60">
              {view.pipeline.map((row) => (
                <li key={row.status} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span>{row.label}</span>
                  <span className="tabular-nums font-medium">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border/60 bg-card px-4 py-4">
          <h2 className="text-[11px] font-medium text-muted-foreground">Sends and acceptances</h2>
          {view.trendUnavailableReason || view.trend.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {view.trendUnavailableReason ?? "No quotes were sent or accepted in this period."}
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {view.trend.map((bucket) => (
                <li key={bucket.label} className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-3 text-sm">
                  <span className="text-muted-foreground">{bucket.label}</span>
                  <span className="min-w-0">
                    <span className="flex h-2 overflow-hidden rounded-full bg-muted">
                      <span
                        className="bg-foreground"
                        style={{ width: `${(bucket.sent / maxTrend) * 100}%` }}
                      />
                    </span>
                    <span className="mt-1 block text-xs tabular-nums text-muted-foreground">
                      {bucket.sent} sent · {bucket.accepted} accepted
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
        <section className="rounded-xl border border-border/60 bg-card px-4 py-4">
          <h2 className="text-[11px] font-medium text-muted-foreground">Send to acceptance</h2>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
            {view.timing.medianDays == null ? "—" : `${view.timing.medianDays} days`}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {timingCopy(view)}
          </p>
        </section>
        <section className="rounded-xl border border-border/60 bg-card px-4 py-4">
          <h2 className="text-[11px] font-medium text-muted-foreground">Accepted variations</h2>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
            {formatCount(view.variations.acceptedCount)}
          </p>
          <p className="mt-1 text-sm tabular-nums">
            {formatMoney(view.variations.adjustmentExGst)}
            <span className="ml-2 text-muted-foreground">adjustment ex GST</span>
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Kept separate from the accepted quote. Declined variations are not included.
          </p>
        </section>
      </div>
    </div>
  );
}

function timingCopy(view: BusinessAnalyticsView): string {
  if (view.quotesAccepted === 0) {
    return "No quotes were accepted in this period.";
  }
  if (view.timing.sample === 0) {
    return view.timing.excluded > 0
      ? `${view.timing.excluded} accepted ${view.timing.excluded === 1 ? "quote has" : "quotes have"} no reliable send time.`
      : "No accepted quote in this period has a send time.";
  }
  const base = `Median of ${view.timing.sample} accepted ${view.timing.sample === 1 ? "quote" : "quotes"} with a first-send time.`;
  if (view.timing.excluded === 0) return base;
  return `${base} ${view.timing.excluded} left out because the send time is missing or later than acceptance.`;
}

function MetricLink(props: { href: string; label: string; value: string; context: string }) {
  return (
    <Link
      href={props.href}
      className="flex h-full min-h-11 flex-col rounded-xl border border-border/60 bg-card px-3 py-2.5 outline-none hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
    >
      <MetricBody {...props} />
    </Link>
  );
}

function MetricCard(props: { label: string; value: string; context: string }) {
  return (
    <div className="flex h-full min-h-11 flex-col rounded-xl border border-border/60 bg-card px-3 py-2.5">
      <MetricBody {...props} />
    </div>
  );
}

function MetricBody(props: { label: string; value: string; context: string }) {
  return (
    <>
      <p className="text-[11px] font-medium leading-tight text-muted-foreground">{props.label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{props.value}</p>
      <p className="mt-0.5 text-xs leading-4 text-muted-foreground">{props.context}</p>
    </>
  );
}

function RecordList(props: {
  title: string;
  empty: string;
  records: AnalyticsView["sentRecords"];
  total: number;
  timeZone: string;
}) {
  return (
    <section className="rounded-xl border border-border/60 bg-card px-4 py-4">
      <h2 className="text-[11px] font-medium text-muted-foreground">{props.title}</h2>
      {props.records.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{props.empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-border/60">
          {props.records.map((record) => (
            <li key={record.quoteId}>
              <Link
                href={record.href}
                className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
              >
                <span className="min-w-0 truncate font-medium">{record.projectTitle}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatInOrgTimezone(record.occurredAt, props.timeZone) ?? "—"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {props.total > props.records.length ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Showing {props.records.length} of {props.total}
        </p>
      ) : null}
    </section>
  );
}

function formatCount(value: number | null): string {
  return value == null ? "—" : String(value);
}

function formatMoney(value: number | null): string {
  return value == null ? "—" : formatPricingMoney(value);
}

function formatRate(rate: number): string {
  return `${Math.round(rate * 1000) / 10}%`;
}
