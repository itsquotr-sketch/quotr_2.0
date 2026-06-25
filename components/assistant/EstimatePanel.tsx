"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import {
  formatCurrency,
  formatCurrencyRange,
  formatPercent,
} from "@/components/assistant/format";
import { MarginEditControl } from "@/components/assistant/MarginEditControl";
import {
  OpenFinalPricingLink,
  PrepareFinalPricingButton,
} from "@/components/pricing/PrepareFinalPricingButton";
import type { Estimate } from "@/components/assistant/types";
import { qualityLabel } from "@/components/assistant/QualityBlock";
import type { QualityLevel } from "@/components/assistant/types";
import type { PricingSummary } from "@/lib/pricing/types";
import type { QuoteSummary } from "@/lib/quotes/types";
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
import { needsCalibrationRefresh } from "@/lib/estimate/calibration-version";

type EstimatePanelProps = {
  projectId: string;
  estimate: Estimate | null;
  qualityLevel?: QualityLevel | null;
  pricingSummary?: PricingSummary | null;
  quoteSummary?: QuoteSummary | null;
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
  onEditQuality?: () => void;
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

function ScopeHealthChips({
  workAreaCount,
  missingCount,
  constraintCount,
  assumptionCount,
  pendingProposalCount,
}: {
  workAreaCount: number;
  missingCount: number;
  constraintCount: number;
  assumptionCount: number;
  pendingProposalCount: number;
}) {
  const chips = [
    { label: `${workAreaCount} work area${workAreaCount === 1 ? "" : "s"}`, tone: "neutral" as const },
    {
      label: `${missingCount} missing`,
      tone: missingCount > 0 ? ("attention" as const) : ("neutral" as const),
    },
    {
      label: `${constraintCount} constraint${constraintCount === 1 ? "" : "s"}`,
      tone: "neutral" as const,
    },
  ];

  if (assumptionCount > 0) {
    chips.push({
      label: `${assumptionCount} assumption${assumptionCount === 1 ? "" : "s"}`,
      tone: "neutral",
    });
  }

  if (pendingProposalCount > 0) {
    chips.push({
      label: `${pendingProposalCount} to review`,
      tone: "attention",
    });
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <span
          key={chip.label}
          className={cn(
            "rounded-full border px-2 py-0.5 text-[11px] font-medium",
            chip.tone === "attention"
              ? "border-amber-300/80 bg-amber-50 text-amber-900"
              : "border-border/60 bg-muted/40 text-muted-foreground"
          )}
        >
          {chip.label}
        </span>
      ))}
    </div>
  );
}

export function EstimatePanel({
  projectId,
  estimate,
  qualityLevel = null,
  pricingSummary = null,
  quoteSummary = null,
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
  onEditQuality,
}: EstimatePanelProps) {
  const isStale = Boolean(estimate?.isStale);
  const needsCalibrationUpdate =
    Boolean(estimate) &&
    !isStale &&
    needsCalibrationRefresh(estimate?.calibrationVersion);
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

  const scopeHealthChips = {
    workAreaCount,
    missingCount,
    constraintCount,
    assumptionCount,
    pendingProposalCount,
  };

  const [mobileExpanded, setMobileExpanded] = useState(false);

  const summaryValue = estimate
    ? formatCurrency(estimate.recommendedSell)
    : canGenerateEstimate
      ? "Ready to generate"
      : "Not ready";

  const panelBody = (
    <>
        {qualityLevel ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Spec level</p>
              <p className="text-sm font-medium">{qualityLabel(qualityLevel)}</p>
            </div>
            {onEditQuality ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 shrink-0 px-2 text-xs"
                onClick={onEditQuality}
              >
                Edit
              </Button>
            ) : null}
          </div>
        ) : null}

        {needsCalibrationUpdate ? (
          <div
            className="rounded-lg border border-sky-300/80 bg-sky-50 px-3 py-2 dark:border-sky-700 dark:bg-sky-950/40"
            role="status"
          >
            <p className="text-xs text-sky-950 dark:text-sky-100">
              This estimate was created before the latest calibration updates.
              Regenerate to apply updated questions and calculations.
            </p>
          </div>
        ) : null}

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
                <div className="rounded-xl border border-[var(--brand-orange-muted)] bg-[var(--brand-orange-muted)]/40 px-4 py-5 text-center">
                  <p className="text-sm font-medium">Ready to generate</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Scope and constraints are complete. Generate your draft
                    estimate when you are ready.
                  </p>
                </div>
                <Button
                  type="button"
                  className="h-10 w-full bg-[var(--brand-orange)] text-white hover:bg-[var(--brand-orange)]/90"
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
              <ScopeHealthChips {...scopeHealthChips} />
            ) : null}
          </div>
        ) : (
          <>
            <div
              className={cn(
                "space-y-3 rounded-xl border border-border/60 bg-muted/30 p-4",
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

            <ScopeHealthChips {...scopeHealthChips} />

            <p className="text-xs text-muted-foreground">
              Internal only — not a quote.
            </p>

            <Button
              type="button"
              variant="outline"
              className="w-full border-border bg-background hover:bg-muted/50"
              onClick={onViewBreakdown}
            >
              View full breakdown
            </Button>

            {estimate && !isStale ? (
              pricingSummary ? (
                <div className="space-y-2">
                  {pricingSummary.needsRecalibration ? (
                    <p className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-center text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-200">
                      Final pricing may need updating.
                    </p>
                  ) : null}
                  <OpenFinalPricingLink
                    projectId={projectId}
                    pricingDocumentId={pricingSummary.id}
                  />
                  {pricingSummary.status === "reviewed" ? (
                    <p className="text-center text-xs font-medium text-[var(--brand-orange)]">
                      Pricing reviewed
                    </p>
                  ) : (
                    <p className="text-center text-xs text-muted-foreground">
                      Final pricing draft in progress
                    </p>
                  )}
                  {quoteSummary ? (
                    <>
                      <p className="text-center text-xs font-medium text-[var(--brand-orange)]">
                        Draft quote created
                      </p>
                      <Button
                        type="button"
                        className="w-full bg-[var(--brand-orange)] text-white hover:bg-[var(--brand-orange)]/90"
                        render={
                          <Link
                            href={`/app/projects/${projectId}/quotes/${quoteSummary.id}`}
                          />
                        }
                      >
                        View quote
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button type="button" className="w-full" disabled>
                        Create quote
                      </Button>
                      <p className="text-center text-xs text-muted-foreground">
                        {pricingSummary.status === "reviewed"
                          ? "Create a quote from reviewed final pricing."
                          : "Mark final pricing as reviewed before creating a quote."}
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <PrepareFinalPricingButton
                  projectId={projectId}
                  className="w-full"
                />
              )
            ) : null}

            {estimate && isStale ? (
              <p className="text-xs text-amber-800 dark:text-amber-200">
                Regenerate estimate before preparing final pricing.
              </p>
            ) : null}

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
    </>
  );

  return (
    <Card
      className={cn(
        "overflow-hidden border-border/60 bg-card shadow-sm lg:sticky lg:top-6"
      )}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 border-b border-border/60 px-4 py-3 text-left lg:hidden"
        onClick={() => setMobileExpanded((prev) => !prev)}
        aria-expanded={mobileExpanded}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold">Quick estimate</p>
          <p className="truncate text-xs text-muted-foreground">{summaryValue}</p>
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            mobileExpanded && "rotate-180"
          )}
        />
      </button>

      <CardHeader className="hidden pb-3 lg:block">
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

      <CardContent
        className={cn(
          "space-y-4",
          !mobileExpanded && "hidden lg:block"
        )}
      >
        {panelBody}
      </CardContent>
    </Card>
  );
}
