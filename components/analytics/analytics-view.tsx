import Link from "next/link";
import { PeriodFilters } from "@/components/analytics/period-filters";
import { EstimateSheet, MetricLinkCard, RecordSheet } from "@/components/analytics/record-sheet";
import { TrendChart } from "@/components/analytics/trend-chart";
import { getStatusStripColor } from "@/components/projects/status-strip";
import type { AnalyticsView, BusinessAnalyticsView } from "@/lib/analytics/measure";
import {
  ACTIVE_PROJECTS_HREF,
  formatAcceptanceLine,
  pipelineGroups,
  pipelineStatusHref,
  sharePercents,
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
      data-analytics-wave1-ms={view.wave1Ms}
      data-analytics-wave2-ms={view.wave2Ms}
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
        <div className="grid grid-cols-2 items-stretch gap-2 lg:grid-cols-5 lg:gap-3">
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
              view.quotedValueExGst == null
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
            value={formatMoney(view.acceptedQuoteValueExGst)}
            context="Snapshot value, not cash received"
            title="Accepted quote value"
            description="Sum of accepted snapshot prices ex GST in this period. Variations are not included. This is contracted work, not cash received."
            empty="No accepted quote value in this period."
            records={view.acceptedRecords}
            total={view.acceptedRecordTotal}
            timeZone={view.timeZone}
            disabled={view.acceptedQuoteValueExGst == null}
          />
          {view.tier === "business" ? (
            <div className="col-span-2 lg:col-span-1">
            <RecordSheet
              periodId={view.periodId}
              from={view.from}
              to={view.to}
              kind="sent"
              label="Sent, since accepted"
              value={
                view.acceptance.numerator == null || view.acceptance.denominator == null
                  ? "—"
                  : `${view.acceptance.numerator} of ${view.acceptance.denominator}`
              }
              context={
                view.acceptance.rate == null
                  ? "Cohort of first sends in this range"
                  : `${Math.round(view.acceptance.rate * 1000) / 10}% of projects first sent in this range`
              }
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
        <FunnelPanel view={view} />
      </div>

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
  const accepted = view.acceptance.numerator;
  const sent = view.acceptance.denominator;
  const remaining = accepted == null || sent == null ? null : sent - accepted;
  return (
    <section className="rounded-xl border border-border/60 bg-card px-4 py-4 xl:col-span-2">
      <h2 className="text-sm font-medium">Quote conversion</h2>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Projects first sent in this range that have an acceptance snapshot. This is not accepted quotes in the range divided by first sends.
      </p>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        <div>
          <dt className="text-[11px] text-muted-foreground">First sent</dt>
          <dd className="text-lg font-semibold tabular-nums">{formatCount(sent)}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted-foreground">Since accepted</dt>
          <dd className="text-lg font-semibold tabular-nums">{formatCount(accepted)}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted-foreground">No snapshot</dt>
          <dd className="text-lg font-semibold tabular-nums">{formatCount(remaining)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-sm text-muted-foreground">
        {view.acceptance.unavailableReason ??
          `${formatAcceptanceLine(view.acceptance)}. Open Sent, since accepted to see each project.`}
      </p>
      <div className="mt-3 border-t border-border/60 pt-3">
        <p className="text-[11px] font-medium text-muted-foreground">Time to acceptance</p>
        <p className="mt-1 text-lg font-semibold tabular-nums">
          {view.timing.medianDays == null ? "—" : `${view.timing.medianDays} days`}
        </p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{timingCopy(view)}</p>
      </div>
    </section>
  );
}

function WorkAreaPanel({ view }: { view: BusinessAnalyticsView }) {
  const rows = view.workAreas ?? [];
  const max = rows.reduce(
    (highest, row) => Math.max(highest, row.estimates + (row.quotedQuotes ?? 0)),
    0
  );
  return (
    <section className="min-w-0 rounded-xl border border-border/60 bg-card px-4 py-4">
      <h2 className="text-sm font-medium">Work areas</h2>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        An estimate counts once in each area it uses. Quoted and accepted money is the sum of lines in that area, not the whole quote repeated. Open Estimates created for the projects.
      </p>
      {view.workAreas == null ? (
        <p className="mt-3 text-sm text-muted-foreground">Work areas are hidden because the read was incomplete.</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No estimates or quote lines in this range.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border/60">
          {rows.slice(0, 8).map((row, index) => {
            const activity = row.estimates + (row.quotedQuotes ?? 0);
            const next = rows[index + 1];
            const nextActivity = next ? next.estimates + (next.quotedQuotes ?? 0) : -1;
            return (
              <li key={row.name} className="flex min-h-11 items-center gap-3 py-2">
                <span
                  className="h-2 shrink-0 rounded-full bg-foreground"
                  style={{ width: `${max === 0 ? 0 : Math.max(8, (activity / max) * 72)}px` }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {row.name}
                    {index === 0 && activity > nextActivity ? (
                      <span className="ml-2 text-[11px] font-normal text-muted-foreground">Most activity</span>
                    ) : null}
                  </span>
                  <span className="block text-xs text-muted-foreground tabular-nums">
                    {row.estimates} {row.estimates === 1 ? "estimate" : "estimates"}
                    {row.quotedQuotes == null
                      ? " · line values unavailable"
                      : ` · ${row.quotedQuotes} quoted`}
                    {row.quotedLineExGst == null ? "" : ` · ${formatMoney(row.quotedLineExGst)} quoted lines`}
                    {row.acceptedLineExGst == null ? "" : ` · ${formatMoney(row.acceptedLineExGst)} accepted lines`}
                  </span>
                </span>
              </li>
            );
          })}
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
  const shares = sharePercents(rows.map((row) => row.lines));
  return (
    <section className="min-w-0 rounded-xl border border-border/60 bg-card px-4 py-4">
      <h2 className="text-sm font-medium">Rate sources</h2>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Line counts on estimates created in this range. Quotr benchmark is the stored source, not a check that the price is accurate.
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
        Current pricing documents. This does not change with the date range. Unknown cost is not treated as zero.
      </p>
      <p className="mt-3 text-lg font-semibold tabular-nums">
        {required == null ? "—" : `${required} lines with no sell price`}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {unknown == null || sell == null
          ? "Sell with an unknown cost is unavailable."
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
                className="flex min-h-11 items-center justify-between gap-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
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
