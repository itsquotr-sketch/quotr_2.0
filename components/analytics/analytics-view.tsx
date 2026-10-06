import Link from "next/link";
import { PeriodFilters } from "@/components/analytics/period-filters";
import { EstimateSheet, MetricLinkCard, RecordSheet } from "@/components/analytics/record-sheet";
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
    <div
      className="min-w-0 space-y-3 lg:space-y-4"
      data-analytics-page
      data-analytics-tier={view.tier}
      data-analytics-query-ms={view.queryMs}
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
        <div className="grid grid-cols-2 items-stretch gap-2 lg:grid-cols-4 lg:gap-3">
          <EstimateSheet
            label="Estimates created"
            value={formatCount(view.estimatesCreated)}
            context="First created in this range. A regeneration is not another estimate."
            records={view.estimateRecords}
            disabled={view.estimatesCreated == null}
            timeZone={view.timeZone}
          />
          <RecordSheet
            periodId={view.periodId}
            from={view.from}
            to={view.to}
            kind="sent"
            label="Quoted ex GST"
            value={formatMoney(view.quotedValueExGst)}
            context={`${formatCount(view.quotesSent)} first sends. Stored quote total, not cash.`}
            title="Quoted value"
            description="Stored ex GST subtotal of quotes first sent in this range. A later edit of that quote can change this figure. There is no send-time snapshot."
            empty="No quotes were sent in this period."
            records={view.sentRecords}
            total={view.sentRecordTotal}
            timeZone={view.timeZone}
            disabled={view.quotedValueExGst == null}
          />
          <RecordSheet
            periodId={view.periodId}
            from={view.from}
            to={view.to}
            kind="accepted"
            label="Accepted ex GST"
            value={formatMoney(view.acceptedQuoteValueExGst)}
            context={`${formatCount(view.quotesAccepted)} accepted. Contracted, not cash received.`}
            title="Accepted quote value"
            description="Sum of accepted quote prices ex GST in this period. Variations are not included. This is contracted work, not cash received."
            empty="No accepted quote value in this period."
            records={view.acceptedRecords}
            total={view.acceptedRecordTotal}
            timeZone={view.timeZone}
            disabled={view.acceptedQuoteValueExGst == null}
          />
          <MetricLinkCard
            href={ACTIVE_PROJECTS_HREF}
            label="Active projects"
            value={formatCount(view.activeProjects)}
            context="Current pipeline, not this range"
            disabled={view.activeProjects == null}
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
      <div className="grid gap-3 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <TrendChart trend={view.trend} unavailableReason={view.trendUnavailableReason} />
        </div>
        <section className="rounded-xl border border-border/60 bg-card px-4 py-4 xl:col-span-2">
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
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <WorkAreaPanel view={view} />
        <RateSourcePanel view={view} />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]">
        <PipelinePanel view={view} />
        <div className="space-y-3">
          <PricingPanel view={view} />
          <VariationsPanel view={view} />
        </div>
      </div>
    </div>
  );
}

const STAGE_SWATCH: Record<string, string> = {
  lead: "bg-stone-400",
  site_visit: "bg-slate-500",
  scoping: "bg-zinc-600",
  estimating: "bg-amber-600",
  estimate_ready: "bg-sky-700",
  quote_draft: "bg-indigo-500",
  quote_sent: "bg-neutral-950",
};

function WorkAreaPanel({ view }: { view: BusinessAnalyticsView }) {
  const rows = view.workAreas ?? [];
  const max = rows.reduce((highest, row) => Math.max(highest, row.estimates), 0);
  return (
    <section className="min-w-0 rounded-xl border border-border/60 bg-card px-4 py-4">
      <h2 className="text-sm font-medium">Work areas</h2>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Estimates created in this range. A mixed estimate counts once in each area. Its value is not split.
      </p>
      {view.workAreas == null ? (
        <p className="mt-3 text-sm text-muted-foreground">Work areas are hidden because the read was incomplete.</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No estimates were created in this range.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.slice(0, 6).map((row) => (
            <li key={row.name} className="min-w-0">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{row.name}</span>
                <span className="shrink-0 tabular-nums">
                  {row.estimates} {row.estimates === 1 ? "estimate" : "estimates"}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                <span
                  className="block h-full bg-foreground"
                  style={{ width: `${max === 0 ? 0 : (row.estimates / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
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
  return (
    <section className="min-w-0 rounded-xl border border-border/60 bg-card px-4 py-4">
      <h2 className="text-sm font-medium">Rate sources</h2>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Line counts on estimates created in this range. A missing cost is not counted as zero.
      </p>
      {view.rateSources == null ? (
        <p className="mt-3 text-sm text-muted-foreground">Rate sources are hidden because the read was incomplete.</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No estimate lines in this range.</p>
      ) : (
        <ul className="mt-3">
          {rows.map((row) => (
            <li key={row.label} className="flex min-h-11 items-center justify-between gap-3 border-t border-border/60 text-sm">
              <span className="inline-flex min-w-0 items-center gap-2">
                <span className={`size-2.5 shrink-0 rounded-full ${RATE_SWATCH[row.label] ?? "bg-neutral-400"}`} aria-hidden />
                {row.label}
              </span>
              <span className="tabular-nums">
                {row.lines}
                <span className="text-muted-foreground">
                  {" "}
                  · {total === 0 ? "—" : `${Math.round((row.lines / total) * 100)}%`}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PricingPanel({ view }: { view: BusinessAnalyticsView }) {
  const required = view.pricing.requiredCount;
  const unknown = view.pricing.unknownCostCount;
  const sell = view.pricing.unknownCostSellExGst;
  return (
    <section className="min-w-0 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-950">
      <h2 className="text-sm font-medium">Pricing required</h2>
      <p className="mt-1 text-xs leading-5">
        Current pricing documents, not this range. Unknown costs are not treated as zero.
      </p>
      <p className="mt-2 text-xl font-semibold tabular-nums">
        {required == null ? "—" : `${required} unpriced`}
      </p>
      <p className="mt-1 text-sm">
        {unknown == null || sell == null
          ? "Sell with an unknown cost is unavailable."
          : `${unknown} with a sell and an unknown cost · ${formatPricingMoney(sell)} ex GST`}
      </p>
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
                  className={`h-full ${STAGE_SWATCH[row.status] ?? "bg-foreground"}`}
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
        <span className={`size-2.5 shrink-0 rounded-full ${STAGE_SWATCH[row.status] ?? "bg-foreground"}`} aria-hidden />
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
