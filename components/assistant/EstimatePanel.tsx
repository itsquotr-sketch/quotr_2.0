"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import {
  formatCurrency,
  formatCurrencyRange,
  formatPercent,
} from "@/components/assistant/format";
import { MarginEditControl } from "@/components/assistant/MarginEditControl";
import type { Estimate } from "@/components/assistant/types";
import type { PanelScopeSummary, ScopeReview } from "@/lib/assistant/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DEFAULT_MARGIN_PERCENT } from "@/lib/estimate/constants";

type EstimatePanelProps = {
  estimate: Estimate | null;
  isGenerating?: boolean;
  isRegenerating?: boolean;
  isSavingMargin?: boolean;
  defaultMarginPercent?: number;
  panelScopeSummaries?: PanelScopeSummary[];
  scopeReview?: ScopeReview;
  questionsSubmitted?: boolean;
  constraintsSubmitted?: boolean;
  canGenerateEstimate?: boolean;
  pendingProposalCount?: number;
  constraintCount?: number;
  onViewBreakdown?: () => void;
  onGenerate?: () => void;
  onRegenerate?: () => void;
  onMarginSave?: (targetMarginPercent: number | null) => Promise<void>;
};

function MetricRow({
  label,
  value,
  prominent,
  dimmed,
}: {
  label: string;
  value: string;
  prominent?: boolean;
  dimmed?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          prominent
            ? "text-right text-2xl font-semibold tracking-tight"
            : "text-right text-sm font-medium",
          dimmed && "text-muted-foreground line-through decoration-muted-foreground/50"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function buildScopeHealthSummary(input: {
  workAreaCount: number;
  missingCount: number;
  constraintCount: number;
  assumptionCount: number;
  pendingProposalCount: number;
}): string {
  const parts = [
    `${input.workAreaCount} work area${input.workAreaCount === 1 ? "" : "s"}`,
    `${input.missingCount} missing`,
    `${input.constraintCount} constraint${input.constraintCount === 1 ? "" : "s"}`,
  ];
  let summary = `Scope health: ${parts.join(" · ")}`;
  if (input.assumptionCount > 0) {
    summary += ` · ${input.assumptionCount} assumption${input.assumptionCount === 1 ? "" : "s"}`;
  }
  if (input.pendingProposalCount > 0) {
    summary += ` · ${input.pendingProposalCount} proposal${input.pendingProposalCount === 1 ? "" : "s"} need review`;
  }
  return summary;
}

export function EstimatePanel({
  estimate,
  isGenerating,
  isRegenerating,
  isSavingMargin,
  defaultMarginPercent = DEFAULT_MARGIN_PERCENT,
  panelScopeSummaries = [],
  scopeReview,
  questionsSubmitted = false,
  constraintsSubmitted = false,
  canGenerateEstimate = false,
  pendingProposalCount = 0,
  constraintCount = 0,
  onViewBreakdown,
  onGenerate,
  onRegenerate,
  onMarginSave,
}: EstimatePanelProps) {
  const isStale = Boolean(estimate?.isStale);
  const showScopePreview = questionsSubmitted && panelScopeSummaries.length > 0;

  const missingCount = estimate
    ? estimate.missingInfo.length
    : scopeReview
      ? scopeReview.workAreas.reduce(
          (sum, workArea) => sum + workArea.missingItems.length,
          0
        )
      : 0;
  const assumptionCount = estimate
    ? estimate.assumptions.length
    : scopeReview
      ? scopeReview.generalAssumptions.length
      : 0;
  const workAreaCount = estimate
    ? estimate.includedWorkAreas.length
    : panelScopeSummaries.length;

  const scopeHealthSummary = buildScopeHealthSummary({
    workAreaCount,
    missingCount,
    constraintCount,
    assumptionCount,
    pendingProposalCount,
  });

  return (
    <Card className="lg:sticky lg:top-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Quick estimate</CardTitle>
        <CardDescription>
          {estimate
            ? "Draft estimate based on your inputs"
            : canGenerateEstimate
              ? "Ready to generate your draft estimate"
              : constraintsSubmitted
                ? "Complete remaining scope steps to generate"
                : "Complete the guided questions to generate a draft quick estimate."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isStale ? (
          <div
            className="space-y-3 rounded-xl border-2 border-amber-400 bg-amber-50 px-3 py-3 dark:border-amber-600 dark:bg-amber-950/40"
            role="alert"
          >
            <div>
              <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                This estimate is outdated
              </p>
              <p className="mt-0.5 text-xs text-amber-900/90 dark:text-amber-200/90">
                Regenerate to update pricing from the latest scope.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              className="h-9 w-full bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500"
              onClick={onRegenerate}
              disabled={isRegenerating || isGenerating}
            >
              {isRegenerating ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Regenerating…
                </>
              ) : (
                "Regenerate estimate"
              )}
            </Button>
          </div>
        ) : null}

        {isGenerating ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Generating quick estimate…
          </div>
        ) : !estimate ? (
          <div className="space-y-4">
            {canGenerateEstimate ? (
              <>
                <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-5 text-center">
                  <p className="text-sm font-medium">Ready to generate</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Scope and constraints are complete. Generate your draft
                    estimate when you are ready.
                  </p>
                </div>
                <Button
                  type="button"
                  className="h-10 w-full"
                  onClick={onGenerate}
                  disabled={isGenerating || !onGenerate}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-1.5 size-4 animate-spin" />
                      Generating estimate…
                    </>
                  ) : (
                    "Generate estimate"
                  )}
                </Button>
              </>
            ) : (
              <div className="rounded-2xl bg-muted/50 px-4 py-6 text-center">
                <p className="text-sm font-medium">No estimate yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {questionsSubmitted
                    ? "Complete scope details and constraints to generate an estimate."
                    : "Work through the assistant to unlock a draft range."}
                </p>
              </div>
            )}

            {showScopePreview && !canGenerateEstimate ? (
              <div className="space-y-2 text-xs text-muted-foreground">
                <p>
                  {workAreaCount} work area{workAreaCount === 1 ? "" : "s"}{" "}
                  included
                </p>
                {assumptionCount > 0 ? (
                  <p>
                    {assumptionCount} assumption
                    {assumptionCount === 1 ? "" : "s"}
                  </p>
                ) : null}
                {missingCount > 0 ? (
                  <p>
                    {missingCount} missing detail
                    {missingCount === 1 ? "" : "s"}
                  </p>
                ) : null}
              </div>
            ) : null}

            {questionsSubmitted ? (
              <p className="text-xs text-muted-foreground">{scopeHealthSummary}</p>
            ) : null}
          </div>
        ) : (
          <>
            <div
              className={cn(
                "space-y-3 rounded-2xl bg-muted/40 p-4",
                isStale && "opacity-60"
              )}
            >
              <MetricRow
                label="Recommended sell"
                value={formatCurrency(estimate.recommendedSell)}
                prominent
                dimmed={isStale}
              />
              <MetricRow
                label="Sell range"
                value={formatCurrencyRange(estimate.sellLow, estimate.sellHigh)}
                dimmed={isStale}
              />

              <div className="grid grid-cols-2 gap-x-3 gap-y-2 pt-1">
                <MetricRow
                  label="Cost"
                  value={formatCurrency(estimate.recommendedCost)}
                  dimmed={isStale}
                />
                <MetricRow
                  label="Gross profit"
                  value={formatCurrency(estimate.grossProfit)}
                  dimmed={isStale}
                />
                <MetricRow
                  label="Margin"
                  value={formatPercent(estimate.marginPercent)}
                  dimmed={isStale}
                />
                <MetricRow
                  label="Confidence"
                  value={`${estimate.confidence}%`}
                  dimmed={isStale}
                />
              </div>
            </div>

            {isStale && onMarginSave ? (
              <p className="text-xs text-amber-800 dark:text-amber-200">
                Regenerate before editing margin.
              </p>
            ) : null}

            <div className="rounded-xl border px-3 py-2">
              <p className="text-xs text-muted-foreground">Rate source</p>
              <p className="mt-0.5 text-sm font-medium leading-snug">
                {estimate.rateSourceSummary}
              </p>
              {estimate.rateSourceSummary
                .toLowerCase()
                .includes("benchmark") ||
              estimate.rateSourceSummary.toLowerCase().includes("missing") ? (
                <Link
                  href="/app/rates"
                  className="mt-1 inline-block text-xs text-muted-foreground underline-offset-2 hover:underline"
                >
                  Set your rates
                </Link>
              ) : null}
            </div>

            <p className="text-xs text-muted-foreground">{scopeHealthSummary}</p>

            <p className="text-xs text-muted-foreground">
              Internal only — not a quote.
            </p>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={onViewBreakdown}
            >
              View full breakdown
            </Button>

            {!isStale && onMarginSave ? (
              <MarginEditControl
                marginPercent={estimate.marginPercent}
                targetMarginPercent={estimate.targetMarginPercent}
                defaultMarginPercent={defaultMarginPercent}
                disabled={isRegenerating || isGenerating}
                isSaving={isSavingMargin}
                onSave={onMarginSave}
              />
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
