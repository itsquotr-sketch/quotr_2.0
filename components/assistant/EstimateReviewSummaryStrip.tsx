"use client";

/**
 * Stage 3.2.2-R4 — Compact Estimate Review (“what Quotr understood”).
 * Reuses Stage 3.1B attention-routing contract — does not invent a second authority.
 * Does not display commercial sell/cost/margin metrics (Quick Estimate owns those).
 */

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  attentionShowsReviewButton,
  type QuickEstimateAttentionItem,
} from "@/lib/assistant/presentation/quick-estimate-view-model";
import {
  formatTruncatedLabelList,
  type EstimateReviewCompactOverview,
} from "@/lib/assistant/presentation/estimate-review-compact-overview";

type EstimateReviewSummaryStripProps = {
  items: readonly QuickEstimateAttentionItem[];
  overview: EstimateReviewCompactOverview;
  isStale?: boolean;
  onReviewAttention?: (item: QuickEstimateAttentionItem) => void;
  onViewDetails?: () => void;
  className?: string;
};

function OverviewBody({
  overview,
}: {
  overview: EstimateReviewCompactOverview;
}) {
  const keyScopeText = formatTruncatedLabelList(
    overview.keyScopeLabels,
    overview.keyScopeOverflow
  );
  const conditionsText = formatTruncatedLabelList(
    overview.conditionLabels,
    overview.conditionOverflow
  );

  return (
    <div className="mt-2 space-y-2" data-estimate-review-overview>
      <div>
        <p className="text-sm font-medium text-foreground">{overview.headline}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {overview.inventoryLine}
        </p>
      </div>

      {keyScopeText ? (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Key scope
          </p>
          <p className="mt-0.5 text-xs text-foreground/90">{keyScopeText}</p>
        </div>
      ) : null}

      {conditionsText ? (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Project conditions
          </p>
          <p className="mt-0.5 text-xs text-foreground/90">{conditionsText}</p>
        </div>
      ) : null}

      {overview.assumptionCount > 0 ? (
        <p className="text-xs text-muted-foreground">
          {overview.assumptionCount} assumption
          {overview.assumptionCount === 1 ? "" : "s"}
        </p>
      ) : null}
    </div>
  );
}

export function EstimateReviewSummaryStrip({
  items,
  overview,
  isStale = false,
  onReviewAttention,
  onViewDetails,
  className,
}: EstimateReviewSummaryStripProps) {
  const actionable = isStale || items.length > 0;

  if (!actionable) {
    return (
      <div
        className={cn(
          "rounded-xl border border-border/50 bg-muted/15 px-3.5 py-3",
          className
        )}
        data-estimate-review-summary="clear"
        role="status"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="text-sm font-medium text-foreground">
            Estimate review{" "}
            <span className="text-muted-foreground" aria-hidden>
              ✓
            </span>{" "}
            <span className="font-normal text-muted-foreground">Clear</span>
          </p>
          {onViewDetails ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 px-2 text-xs text-muted-foreground"
              onClick={onViewDetails}
            >
              View estimate review
            </Button>
          ) : null}
        </div>

        <OverviewBody overview={overview} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-amber-200/70 bg-amber-50/40 px-3.5 py-3 dark:border-amber-900/50 dark:bg-amber-950/20",
        className
      )}
      data-estimate-review-summary="attention"
      data-estimate-review-count={items.length}
      role="status"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {isStale
              ? "Estimate review · Needs refresh"
              : `Estimate review · ${items.length} item${items.length === 1 ? "" : "s"}`}
          </p>
          {isStale ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Scope changed — regenerate the estimate when ready.
            </p>
          ) : null}
        </div>
        {onViewDetails ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shrink-0 px-3 text-xs"
            onClick={onViewDetails}
          >
            View details
          </Button>
        ) : null}
      </div>

      {!isStale ? <OverviewBody overview={overview} /> : null}

      {items.length > 0 ? (
        <div className="mt-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Needs attention
          </p>
          <ul className="mt-1.5 space-y-2">
            {items.slice(0, 4).map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  {item.workAreaName ? (
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {item.workAreaName}
                    </p>
                  ) : null}
                  <p className="font-medium text-foreground">{item.label}</p>
                </div>
                {onReviewAttention && attentionShowsReviewButton(item) ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 shrink-0 px-3 text-xs"
                    onClick={() => onReviewAttention(item)}
                  >
                    Review
                  </Button>
                ) : null}
              </li>
            ))}
            {items.length > 4 ? (
              <li className="text-xs text-muted-foreground">
                +{items.length - 4} more
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
