"use client";

import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/components/assistant/format";
import { ASSISTANT_ACTION_LABELS } from "@/lib/assistant/presentation/action-labels";
import {
  attentionShowsReviewButton,
  type QuickEstimateAttentionItem,
} from "@/lib/assistant/presentation/quick-estimate-view-model";
import type { AssistantUnderstandingSummary } from "@/lib/assistant/presentation/assistant-understanding-summary";
import { cn } from "@/lib/utils";

type EstimateReadyCardProps = {
  understanding?: AssistantUnderstandingSummary | null;
  recommendedSell: number;
  confidenceBand?: string | null;
  assumptions: readonly string[];
  attentionItems: readonly QuickEstimateAttentionItem[];
  onReviewEstimate?: () => void;
  onEditJobDetails?: () => void;
  onReviewAttention?: (item: QuickEstimateAttentionItem) => void;
  className?: string;
};

function severityLabel(item: QuickEstimateAttentionItem): string {
  if (item.productSeverity === "assumption") return "Assumption";
  if (item.productSeverity === "check") return "Check";
  if (item.productSeverity === "blocker") return "Blocker";
  return "Attention";
}

export function EstimateReadyCard({
  understanding,
  recommendedSell,
  confidenceBand,
  assumptions,
  attentionItems,
  onReviewEstimate,
  onEditJobDetails,
  onReviewAttention,
  className,
}: EstimateReadyCardProps) {
  const checks = attentionItems.filter(
    (item) => item.productSeverity === "check" || item.productSeverity === "attention" || item.productSeverity === "blocker"
  );
  const assumptionItems = attentionItems.filter(
    (item) => item.productSeverity === "assumption"
  );

  return (
    <section
      className={cn(
        "rounded-xl border border-[var(--brand-orange-muted)]/70 bg-card px-4 py-4 ring-1 ring-[var(--brand-orange)]/10",
        className
      )}
      data-estimate-ready-card="true"
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Estimate ready
      </p>
      {understanding ? (
        <div className="mt-1.5">
          <p className="text-sm font-semibold text-foreground">
            {understanding.lines[0] ?? understanding.workAreaLabel}
          </p>
          {understanding.lines.length > 1 ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {understanding.lines.slice(1).join(" · ")}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Recommended sell
        </p>
        <p className="mt-0.5 text-3xl font-semibold tracking-tight">
          {formatCurrency(recommendedSell)}{" "}
          <span className="text-sm font-medium text-muted-foreground">+ GST</span>
        </p>
      </div>

      {confidenceBand ? (
        <p className="mt-2 text-sm">
          <span className="text-muted-foreground">Confidence </span>
          <span className="font-medium">{confidenceBand}</span>
        </p>
      ) : null}

      {assumptions.length > 0 ? (
        <div className="mt-3" data-estimate-ready-assumptions>
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Top assumptions
          </p>
          <ul className="mt-1 space-y-1 text-xs text-foreground/90">
            {assumptions.map((item) => (
              <li key={item} className="flex gap-1.5">
                <span aria-hidden>•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {assumptionItems.length > 0 ? (
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {assumptionItems.map((item) => (
            <li key={item.id}>{item.detail}</li>
          ))}
        </ul>
      ) : null}

      {checks.length > 0 ? (
        <div className="mt-3" data-estimate-ready-checks>
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Checks
          </p>
          <ul className="mt-1.5 space-y-2">
            {checks.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {severityLabel(item)}
                  </p>
                  <p className="font-medium text-foreground">{item.label}</p>
                  <p className="text-muted-foreground">{item.detail}</p>
                </div>
                {onReviewAttention && attentionShowsReviewButton(item) ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 shrink-0 px-2 text-xs"
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

      <div className="mt-4 flex flex-wrap gap-2">
        {onReviewEstimate ? (
          <Button type="button" onClick={onReviewEstimate}>
            {ASSISTANT_ACTION_LABELS.reviewEstimate}
          </Button>
        ) : null}
        {onEditJobDetails ? (
          <Button type="button" variant="outline" onClick={onEditJobDetails}>
            {ASSISTANT_ACTION_LABELS.editJobDetails}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
