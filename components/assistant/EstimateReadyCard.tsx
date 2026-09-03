"use client";

import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/components/assistant/format";
import { ASSISTANT_ACTION_LABELS } from "@/lib/assistant/presentation/action-labels";
import {
  attentionShowsReviewButton,
  type QuickEstimateAttentionItem,
} from "@/lib/assistant/presentation/quick-estimate-view-model";
import {
  ESTIMATE_RANGE_EXPLANATION,
  presentEstimateGst,
  usesQuotrBenchmarkRates,
} from "@/lib/assistant/presentation/gst-display";
import { staleEstimateMoneyPresentation } from "@/lib/assistant/mode/derive";
import { cn } from "@/lib/utils";
import Link from "next/link";

type EstimateReadyCardProps = {
  workAreaSummaryLine: string;
  workAreaSummaryDetail?: string | null;
  recommendedSell: number;
  sellLow?: number | null;
  sellHigh?: number | null;
  gstRate?: number | null;
  estimatedCost?: number | null;
  targetMarginPercent?: number | null;
  isStale?: boolean;
  isRegenerating?: boolean;
  confidenceBand?: string | null;
  confidenceExplanation?: string | null;
  confidenceReasons?: readonly string[];
  assumptions: readonly string[];
  attentionItems: readonly QuickEstimateAttentionItem[];
  workAreaTotals?: readonly { name: string; sell: number }[];
  rateSourceSummary?: string | null;
  onReviewEstimate?: () => void;
  onEditJob?: () => void;
  onUpdateEstimate?: () => void;
  onReviewAttention?: (item: QuickEstimateAttentionItem) => void;
  compactResult?: boolean;
  /** After Builder Review, Review estimate is no longer the primary progression. */
  reviewIsPrimary?: boolean;
  className?: string;
};

const CONCISE_ASSUMPTION_LIMIT = 5;
const CONCISE_CHECK_LIMIT = 2;

function severityLabel(item: QuickEstimateAttentionItem): string {
  if (item.productSeverity === "assumption") return "Assumption";
  if (item.productSeverity === "check") return "Check";
  if (item.productSeverity === "blocker") return "Blocker";
  return "Attention";
}

export function EstimateReadyCard({
  workAreaSummaryLine,
  workAreaSummaryDetail,
  recommendedSell,
  sellLow = null,
  sellHigh = null,
  gstRate = null,
  estimatedCost = null,
  targetMarginPercent = null,
  isStale = false,
  isRegenerating = false,
  confidenceBand,
  confidenceExplanation = null,
  confidenceReasons = [],
  assumptions,
  attentionItems,
  workAreaTotals = [],
  rateSourceSummary = null,
  onReviewEstimate,
  onEditJob,
  onUpdateEstimate,
  onReviewAttention,
  compactResult = false,
  reviewIsPrimary = true,
  className,
}: EstimateReadyCardProps) {
  const money = staleEstimateMoneyPresentation(isStale);
  const gst = presentEstimateGst(recommendedSell, gstRate);
  const showBenchmark = usesQuotrBenchmarkRates(rateSourceSummary);
  const checks = attentionItems.filter(
    (item) =>
      item.productSeverity === "check" ||
      item.productSeverity === "attention" ||
      item.productSeverity === "blocker"
  );
  const topAssumptions = assumptions.slice(0, CONCISE_ASSUMPTION_LIMIT);
  const topChecks = checks.slice(0, CONCISE_CHECK_LIMIT);
  const assumptionCount = assumptions.length;
  const checkCount = checks.length;

  return (
    <section
      className={cn(
        "rounded-xl border bg-card px-4 py-3.5 sm:px-5 sm:py-4",
        isStale
          ? "border-amber-300/80 ring-1 ring-amber-400/20 dark:border-amber-800/60"
          : "border-[var(--brand-orange-muted)]/70 ring-1 ring-[var(--brand-orange)]/10",
        className
      )}
      data-estimate-ready-card="true"
      data-estimate-ready-primary="true"
      data-stale-money-current={money.treatAsCurrent ? "true" : "false"}
      data-stale-hierarchy={
        isStale ? "needs-updating-first" : "current-recommendation"
      }
      data-lead-with-price={money.leadWithPrice ? "true" : "false"}
    >
      {isStale ? (
        <>
          <p
            className="text-lg font-semibold tracking-tight text-amber-950 dark:text-amber-100"
            data-stale-heading
          >
            {money.heading}
          </p>
          {money.explanation ? (
            <p className="mt-1 text-sm text-amber-900/90 dark:text-amber-200/90">
              {money.explanation}
            </p>
          ) : null}
          <div className="mt-2">
            <p className="text-sm font-medium text-foreground">{workAreaSummaryLine}</p>
            {workAreaSummaryDetail ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {workAreaSummaryDetail}
              </p>
            ) : null}
          </div>
          <div className="mt-3" data-previous-estimate>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {money.sellLabel}
            </p>
            <p className="mt-0.5 text-lg font-medium text-muted-foreground line-through">
              {formatCurrency(recommendedSell)}{" "}
              {gst.showGst ? (
                <span className="text-xs font-medium">ex GST</span>
              ) : null}
            </p>
          </div>
        </>
      ) : (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            {money.heading}
          </p>
          <div className="mt-1.5">
            <p className="text-sm font-semibold text-foreground">
              {workAreaSummaryLine}
            </p>
            {workAreaSummaryDetail ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {workAreaSummaryDetail}
              </p>
            ) : null}
          </div>
          <div className="mt-3" data-estimate-recommended-sell>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {money.sellLabel}
            </p>
            <p className="mt-0.5 text-3xl font-semibold tracking-tight tabular-nums">
              {formatCurrency(gst.exGst)}{" "}
              {gst.showGst ? (
                <span className="text-sm font-medium text-muted-foreground">
                  ex GST
                </span>
              ) : null}
            </p>
            {gst.showGst ? (
              <p className="mt-1 text-sm text-foreground" data-estimate-gst>
                {formatCurrency(gst.inclGst)} incl GST
                <span className="text-muted-foreground">
                  {" "}
                  · {formatCurrency(gst.gstAmount)} GST
                </span>
              </p>
            ) : null}
          </div>
          {sellLow != null && sellHigh != null ? (
            <div className="mt-3" data-estimate-range>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Indicative range
              </p>
              <p className="mt-0.5 text-sm font-medium">
                {formatCurrency(sellLow)} – {formatCurrency(sellHigh)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {ESTIMATE_RANGE_EXPLANATION}
              </p>
            </div>
          ) : null}
          {confidenceBand ? (
            <p className="mt-2 text-sm" data-estimate-confidence>
              <span className="font-medium">{confidenceBand} confidence</span>
              {confidenceExplanation ? (
                <span className="text-muted-foreground">
                  {" "}
                  — {confidenceExplanation}
                </span>
              ) : confidenceReasons[0] ? (
                <span className="text-muted-foreground">
                  {" "}
                  — {confidenceReasons[0]}
                </span>
              ) : null}
            </p>
          ) : null}
          {compactResult ? (
            <p className="mt-2 text-sm text-muted-foreground">
              This is your working estimate. Review it before creating final Pricing.
            </p>
          ) : null}
        </>
      )}

      {!isStale && !compactResult && (assumptionCount > 0 || checkCount > 0) ? (
        <p
          className="mt-3 text-xs text-muted-foreground"
          data-estimate-ready-summary-counts
        >
          {assumptionCount > 0
            ? `${assumptionCount} assumption${assumptionCount === 1 ? "" : "s"}`
            : null}
          {assumptionCount > 0 && checkCount > 0 ? " · " : null}
          {checkCount > 0
            ? `${checkCount} check${checkCount === 1 ? "" : "s"}`
            : null}
        </p>
      ) : null}

      {!isStale && !compactResult && topAssumptions.length > 0 ? (
        <div className="mt-2" data-estimate-ready-assumptions>
          <ul className="space-y-1 text-xs text-foreground/90">
            {topAssumptions.map((item) => (
              <li key={item} className="flex gap-1.5">
                <span aria-hidden>•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!isStale && !compactResult && topChecks.length > 0 ? (
        <div className="mt-3" data-estimate-ready-checks>
          <ul className="space-y-2">
            {topChecks.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {severityLabel(item)}
                  </p>
                  <p className="font-medium text-foreground">{item.label}</p>
                </div>
                {onReviewAttention && attentionShowsReviewButton(item) ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-11 min-h-11 shrink-0 px-3 text-xs sm:h-7 sm:min-h-7"
                    onClick={() => onReviewAttention(item)}
                  >
                    Review
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!isStale && !compactResult && workAreaTotals.length > 0 ? (
        <div className="mt-3" data-estimate-work-area-totals>
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Work Areas
          </p>
          <ul className="mt-1 space-y-1 text-sm">
            {workAreaTotals.slice(0, 6).map((area) => (
              <li key={area.name} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">{area.name}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatCurrency(area.sell)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!isStale && !compactResult && (estimatedCost != null || targetMarginPercent != null) ? (
        <div className="mt-3 text-xs text-muted-foreground" data-estimate-composition>
          {estimatedCost != null ? (
            <span>Estimated cost {formatCurrency(estimatedCost)}</span>
          ) : null}
          {estimatedCost != null && targetMarginPercent != null ? " · " : null}
          {targetMarginPercent != null ? (
            <span>Target gross margin {targetMarginPercent.toFixed(0)}%</span>
          ) : null}
        </div>
      ) : null}

      {!isStale && showBenchmark ? (
        <p
          className="mt-3 text-xs text-muted-foreground"
          data-estimate-benchmark-note
        >
          Some rates use Quotr benchmarks. Add your own rates anytime.{" "}
          <Link
            href="/app/rates"
            className="font-medium underline-offset-2 hover:underline"
          >
            Review rates
          </Link>
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {isStale && onUpdateEstimate ? (
          <Button
            type="button"
            className="h-11 min-h-11 w-full sm:w-auto"
            data-estimate-ready-primary-cta="update"
            onClick={onUpdateEstimate}
            disabled={isRegenerating}
          >
            {isRegenerating
              ? ASSISTANT_ACTION_LABELS.updatingEstimate
              : ASSISTANT_ACTION_LABELS.updateEstimate}
          </Button>
        ) : null}
        {!isStale && onReviewEstimate ? (
          <Button
            type="button"
            variant={reviewIsPrimary ? "default" : "outline"}
            className="h-11 min-h-11 w-full sm:w-auto"
            data-estimate-ready-primary-cta={reviewIsPrimary ? "review" : undefined}
            data-estimate-ready-secondary-cta={reviewIsPrimary ? undefined : "review"}
            data-builder-review-entry="true"
            onClick={onReviewEstimate}
          >
            {ASSISTANT_ACTION_LABELS.reviewEstimate}
          </Button>
        ) : null}
        {isStale && onReviewEstimate ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 min-h-11 w-full sm:w-auto"
            data-estimate-ready-secondary-cta="review-previous"
            data-builder-review-entry="stale"
            onClick={onReviewEstimate}
          >
            {ASSISTANT_ACTION_LABELS.reviewPreviousEstimate}
          </Button>
        ) : null}
        {onEditJob ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 min-h-11 w-full sm:w-auto"
            data-estimate-ready-edit-job
            onClick={onEditJob}
          >
            {ASSISTANT_ACTION_LABELS.editJob}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
