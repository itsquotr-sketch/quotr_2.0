"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import {
  formatCurrency,
  formatCurrencyRange,
} from "@/components/assistant/format";
import { estimateDocumentViewModel } from "@/lib/estimate/financial-view-model";
import { MarginEditControl } from "@/components/assistant/MarginEditControl";
import { SaveStatusIndicator } from "@/components/assistant/SaveStatusIndicator";
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
import { MetricRow } from "@/components/ui/metric-row";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DEFAULT_MARGIN_PERCENT } from "@/lib/estimate/constants";
import { defaultedFactWarnings } from "@/lib/estimate/assumption-metadata";
import { needsCalibrationRefresh } from "@/lib/estimate/calibration-version";
import { ASSISTANT_ACTION_LABELS } from "@/lib/assistant/presentation/action-labels";
import { AssistantEmptyState } from "@/components/assistant/AssistantEmptyState";
import { presentAssistantError } from "@/lib/assistant/presentation/error-messages";
import {
  QUICK_ESTIMATE_STICKY_CLASS,
  attentionShowsReviewButton,
  buildQuickEstimateAttentionItems,
  buildQuickEstimateMobileSummary,
  buildQuickEstimateScopeSummaryLines,
  buildQuickEstimateStatusPresentation,
  type QuickEstimateAttentionItem,
} from "@/lib/assistant/presentation/quick-estimate-view-model";
import {
  deriveQuickEstimateConfidencePresentation,
  rankQuickEstimateAssumptions,
} from "@/lib/assistant/presentation/quick-estimate-confidence";
import { applyLevel1AttentionPresentation } from "@/lib/assistant/presentation/attention-severity";
import type { AssistantUnderstandingSummary } from "@/lib/assistant/presentation/assistant-understanding-summary";
import { AssistantUnderstandingSummaryCard } from "@/components/assistant/AssistantUnderstandingSummaryCard";
import { MAX_QUICK_ESTIMATE_TOP_ASSUMPTIONS } from "@/lib/scopes/estimate-priority";
import { staleEstimateMoneyPresentation } from "@/lib/assistant/mode/derive";

type EstimatePanelProps = {
  projectId: string;
  estimate: Estimate | null;
  qualityLevel?: QualityLevel | null;
  pricingSummary?: PricingSummary | null;
  quoteSummary?: QuoteSummary | null;
  isGenerating?: boolean;
  isRegenerating?: boolean;
  isSavingMargin?: boolean;
  marginSaveLabel?: string | null;
  defaultMarginPercent?: number;
  panelScopeSummaries?: PanelScopeSummary[];
  scopeReview?: ScopeReview;
  questionsSubmitted?: boolean;
  constraintsSubmitted?: boolean;
  canGenerateEstimate?: boolean;
  pendingProposalCount?: number;
  /** Soft warning only — does not block generation (3.1B.6R3.1). */
  unresolvedScopeImpactCount?: number;
  unresolvedScopeImpactLabels?: readonly string[];
  /** Align visual weight with active workflow stage (3.1B.7A). */
  isActiveStage?: boolean;
  /** Presentation-only scope hierarchy (3.1B.7B / 3.1B.7C). */
  quickEstimatePresentation?: {
    estimatedWorkAreas: string;
    includedScopeItems: string;
    outstandingClarifications: string;
    unansweredRequiredDetails: string;
    assumptionsLabel: string;
    estimateReadinessLabel: string;
    confidenceDrivers: readonly string[];
    confidenceComplete: readonly string[];
    confidenceOutstanding: readonly string[];
  } | null;
  constraintCount?: number;
  /** Named Scope Details items still needing confirmation (7F-R5). */
  pendingScopeDetailTitles?: readonly string[];
  /** Undecided scope rows for Scope Review attention (7F-R6-R4.1). */
  scopeReviewAttention?: readonly {
    readonly label: string;
    readonly workAreaName?: string;
    readonly workAreaId?: string | null;
    readonly suggestionId: string;
  }[];
  /** Stage 3.2.2 — presentation-only project information readiness. */
  projectInformationLabel?: string | null;
  /** Stage 3.2.2 — Project Conditions attention routing. */
  projectConditionsAttention?: readonly {
    readonly label: string;
    readonly questionKey: string;
    readonly factKey?: string;
  }[];
  /** DECK-2B — compact pre-estimate understanding lines. */
  understandingSummaries?: readonly AssistantUnderstandingSummary[];
  /** DECK-2B-R2 — after estimate, sidebar is commercial metrics only. */
  compactCommercialSidebar?: boolean;
  /** R3 — optional cost breakdown for Commercial Overview. */
  commercialBreakdown?: {
    materialsCost?: number | null;
    labourCost?: number | null;
    labourHours?: number | null;
    allowancesCost?: number | null;
    subcontractCost?: number | null;
    plantCost?: number | null;
    otherCost?: number | null;
  } | null;
  onViewBreakdown?: () => void;
  onGenerate?: () => void;
  onRegenerate?: () => void;
  onMarginSave?: (targetMarginPercent: number | null) => Promise<void>;
  onEditQuality?: () => void;
  onReviewAttention?: (item: QuickEstimateAttentionItem) => void;
  /**
   * Stage 3.2.2-R4 — fired once when the panel auto-presents Ready to generate
   * (mobile expand + optional parent scroll).
   */
  onReadyToGeneratePresented?: () => void;
};

/** Collapsible secondary section — presentation local state only. */
function QuickEstimateDisclosure({
  title,
  collapsedHint,
  children,
  defaultOpen = false,
}: {
  title: string;
  collapsedHint: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  return (
    <div className="rounded-md border border-border/50">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-2 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="min-w-0">
          <span className="block text-xs font-medium text-foreground">
            {title}
          </span>
          {!open ? (
            <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
              {collapsedHint}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            "mt-0.5 size-3.5 shrink-0 text-muted-foreground motion-safe:transition-transform",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>
      <div
        id={panelId}
        hidden={!open}
        className={cn(!open && "hidden")}
        aria-hidden={!open}
      >
        <div className="border-t border-border/40 px-3 py-2">{children}</div>
      </div>
    </div>
  );
}

/**
 * Project readiness detail (was always-visible Project health).
 * Scope / assumptions live in sibling disclosures — avoid duplicating them here.
 */
function QuickEstimateHierarchy({
  model,
}: {
  model: {
    outstandingClarifications: string;
    unansweredRequiredDetails: string;
    estimateReadinessLabel: string;
    confidenceDrivers: readonly string[];
    confidenceComplete: readonly string[];
    confidenceOutstanding: readonly string[];
  };
}) {
  const healthRows = [
    {
      label: "Unresolved clarifications",
      value: model.outstandingClarifications,
    },
    {
      label: "Unanswered required details",
      value: model.unansweredRequiredDetails,
    },
    {
      label: "Estimate readiness",
      value: model.estimateReadinessLabel,
    },
  ];
  return (
    <div className="space-y-2.5">
      <p className="sr-only">Project health</p>
      <ul className="space-y-1.5">
        {healthRows.map((row) => (
          <li key={row.label} className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {row.label}
            </p>
            <p className="truncate text-xs font-medium text-foreground/90">
              {row.value}
            </p>
          </li>
        ))}
      </ul>
      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Confidence drivers
        </p>
        {model.confidenceComplete.length > 0 ? (
          <div className="mt-1">
            <p className="text-[11px] font-medium text-foreground/80">Complete</p>
            <ul
              className="mt-0.5 space-y-0.5"
              aria-label="Complete confidence drivers"
            >
              {model.confidenceComplete.map((driver) => (
                <li
                  key={driver}
                  className="flex gap-1.5 text-[11px] text-muted-foreground"
                >
                  <span aria-hidden>•</span>
                  <span>{driver}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {model.confidenceOutstanding.length > 0 ? (
          <div className="mt-1.5">
            <p className="text-[11px] font-medium text-foreground/80">
              Outstanding
            </p>
            <ul
              className="mt-0.5 space-y-0.5"
              aria-label="Outstanding confidence drivers"
            >
              {model.confidenceOutstanding.map((driver) => (
                <li
                  key={driver}
                  className="flex gap-1.5 text-[11px] text-amber-900 dark:text-amber-200"
                >
                  <span aria-hidden>•</span>
                  <span>{driver}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {model.confidenceComplete.length === 0 &&
        model.confidenceOutstanding.length === 0 ? (
          <ul className="mt-0.5 space-y-0.5">
            {model.confidenceDrivers.map((driver) => (
              <li
                key={driver}
                className="flex gap-1.5 text-[11px] text-muted-foreground"
              >
                <span aria-hidden>•</span>
                <span>{driver}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
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
  marginSaveLabel = null,
  defaultMarginPercent = DEFAULT_MARGIN_PERCENT,
  panelScopeSummaries = [],
  scopeReview,
  constraintsSubmitted = false,
  canGenerateEstimate = false,
  pendingProposalCount = 0,
  unresolvedScopeImpactCount = 0,
  unresolvedScopeImpactLabels = [],
  isActiveStage = false,
  quickEstimatePresentation = null,
  pendingScopeDetailTitles = [],
  scopeReviewAttention = [],
  projectInformationLabel = null,
  projectConditionsAttention = [],
  understandingSummaries = [],
  compactCommercialSidebar = false,
  commercialBreakdown = null,
  onViewBreakdown,
  onGenerate,
  onRegenerate,
  onMarginSave,
  onEditQuality,
  onReviewAttention,
  onReadyToGeneratePresented,
}: EstimatePanelProps) {
  const isStale = Boolean(estimate?.isStale);
  const staleMoney = staleEstimateMoneyPresentation(isStale);
  const needsCalibrationUpdate =
    Boolean(estimate) &&
    !isStale &&
    needsCalibrationRefresh(estimate?.calibrationVersion);

  const scopeByTitle = new Map(
    scopeReviewAttention.map((s) => [s.label.trim().toLowerCase(), s])
  );

  const missingByWorkArea =
    scopeReview?.workAreas.flatMap((workArea) =>
      workArea.missingItems
        .filter((item) => item.trim())
        .map((label) => {
          const matched = workArea.activeQuestions.find(
            (q) =>
              q.missingItemLabel === label ||
              q.label === label ||
              q.key.endsWith(label.toLowerCase().replace(/\s+/g, "_"))
          );
          // R6-R4: actionable QUESTION only with a concrete matched question.
          const actionableQuestion = Boolean(matched?.id);
          if (actionableQuestion) {
            return {
              workAreaName: workArea.workAreaName,
              workAreaId: workArea.workAreaId,
              label,
              factKey: matched?.key,
              questionId: matched?.id,
              actionable: true as const,
              reviewTarget: "estimateReview" as const,
              attentionKind: "QUESTION" as const,
            };
          }
          // R6-R4.1: unmatched label that maps to a scope row → Scope Review.
          const scopeHit = scopeByTitle.get(label.trim().toLowerCase());
          if (scopeHit) {
            return {
              workAreaName: scopeHit.workAreaName ?? workArea.workAreaName,
              workAreaId: scopeHit.workAreaId ?? workArea.workAreaId,
              label,
              suggestionId: scopeHit.suggestionId,
              scopeItemId: scopeHit.suggestionId,
              actionable: true as const,
              reviewTarget: "scopeReview" as const,
              attentionKind: "SCOPE" as const,
              detailOverride: "Review scope",
            };
          }
          return {
            workAreaName: workArea.workAreaName,
            workAreaId: workArea.workAreaId,
            label,
            actionable: false as const,
            attentionKind: "NON_ACTIONABLE_INFORMATION" as const,
          };
        })
    ) ?? [];
  const pendingDetailMissing =
    missingByWorkArea.length === 0 && pendingScopeDetailTitles.length > 0
      ? pendingScopeDetailTitles
          .map((label) => label.trim())
          .filter(Boolean)
          .map((label) => {
            const scopeHit = scopeByTitle.get(label.toLowerCase());
            if (scopeHit) {
              return {
                workAreaName: scopeHit.workAreaName ?? "",
                workAreaId: scopeHit.workAreaId ?? undefined,
                label,
                suggestionId: scopeHit.suggestionId,
                scopeItemId: scopeHit.suggestionId,
                actionable: true as const,
                attentionKind: "SCOPE" as const,
                reviewTarget: "scopeReview" as const,
                detailOverride: "Review scope",
              };
            }
            // Remaining pending titles are question-backed NEEDS_DETAIL that
            // lack activeEditors in scopeReview — do not fake Scope Details CTA.
            return {
              workAreaName: "",
              label,
              actionable: false as const,
              attentionKind: "ASSUMPTION" as const,
              detailOverride: "Allowance / confirmation required",
            };
          })
      : [];
  const effectiveMissingByWorkArea =
    missingByWorkArea.length > 0
      ? missingByWorkArea
      : pendingDetailMissing;
  const missingLabels: string[] =
    effectiveMissingByWorkArea.length > 0
      ? effectiveMissingByWorkArea.map((entry) => entry.label)
      : estimate
        ? estimate.missingInfo.filter((item) => item.trim())
        : [];
  const topAssumptions = estimate
    ? rankQuickEstimateAssumptions(
        estimate.assumptions,
        MAX_QUICK_ESTIMATE_TOP_ASSUMPTIONS
      )
    : [];
  const scopeSummaryLine =
    quickEstimatePresentation?.estimatedWorkAreas &&
    quickEstimatePresentation.estimatedWorkAreas !== "None yet"
      ? quickEstimatePresentation.estimatedWorkAreas
      : understandingSummaries[0]?.compactLine ?? null;

  const assumptionCount = estimate
    ? estimate.assumptions.length
    : scopeReview
      ? scopeReview.generalAssumptions.length
      : 0;
  const workAreaCount = estimate
    ? estimate.includedWorkAreas.length
    : panelScopeSummaries.length;

  // 7F-R5: never invent "open clarification" from needs-detail counts.
  const clarificationLabels: string[] = [];

  const attentionItems = applyLevel1AttentionPresentation(
    buildQuickEstimateAttentionItems({
      missingLabels,
      missingByWorkArea: effectiveMissingByWorkArea,
      clarificationLabels,
      pendingProposalCount,
      scopeReviewAttention: scopeReviewAttention.map((s) => ({
        label: s.label,
        workAreaName: s.workAreaName,
        workAreaId: s.workAreaId,
        suggestionId: s.suggestionId,
      })),
      projectConditionsAttention,
      unresolvedScopeImpactLabels:
        unresolvedScopeImpactLabels.length > 0
          ? unresolvedScopeImpactLabels
          : unresolvedScopeImpactCount > 0
            ? Array.from(
                { length: unresolvedScopeImpactCount },
                () => "Suggested scope change"
              )
            : [],
    })
  );

  const confidencePresentation = estimate
    ? deriveQuickEstimateConfidencePresentation({
        confidencePercent: estimate.confidence,
        assumptionSeverity: estimate.assumptionMetadata?.assumptionSeverity,
        missingInfoCount: estimate.missingInfo.length,
        attentionCount: attentionItems.length,
      })
    : null;

  const status = buildQuickEstimateStatusPresentation({
    hasEstimate: Boolean(estimate),
    isStale,
    canGenerateEstimate,
    attentionItems,
    assumptionCritical:
      estimate?.assumptionMetadata?.assumptionSeverity === "critical",
    readinessLabel: quickEstimatePresentation?.estimateReadinessLabel,
  });

  const mobileSummary = buildQuickEstimateMobileSummary({
    hasEstimate: Boolean(estimate),
    sellDisplay: estimate ? formatCurrency(estimate.recommendedSell) : null,
    confidencePercent: estimate?.confidence ?? null,
    statusLabel: status.statusLabel,
    canGenerateEstimate,
  });

  const scopeLines = quickEstimatePresentation
    ? buildQuickEstimateScopeSummaryLines({
        estimatedWorkAreas: quickEstimatePresentation.estimatedWorkAreas,
        includedScopeItems: quickEstimatePresentation.includedScopeItems,
        outstandingClarifications:
          quickEstimatePresentation.outstandingClarifications,
        unansweredRequiredDetails:
          quickEstimatePresentation.unansweredRequiredDetails,
        workAreaCount,
        includedScopeItemCountLabel:
          quickEstimatePresentation.includedScopeItems,
      })
    : null;

  const readinessCollapsedHint =
    status.kind === "attention" || status.kind === "stale"
      ? status.statusLabel
      : status.kind === "ready"
        ? "Ready for pricing"
        : status.statusLabel;

  const [mobileExpanded, setMobileExpanded] = useState(() => Boolean(estimate));
  const prevCanGenerateRef = useRef(false);
  const readyPresentedRef = useRef(false);
  const panelRootRef = useRef<HTMLDivElement | null>(null);

  // Stage 3.2.2-R4: one-shot expand + scroll when becoming ready to generate.
  useEffect(() => {
    if (!canGenerateEstimate || estimate) {
      if (!canGenerateEstimate) {
        readyPresentedRef.current = false;
      }
      prevCanGenerateRef.current = Boolean(canGenerateEstimate);
      return;
    }

    const shouldPresent =
      !prevCanGenerateRef.current && !readyPresentedRef.current;
    prevCanGenerateRef.current = true;

    if (!shouldPresent) {
      return;
    }

    readyPresentedRef.current = true;
    setMobileExpanded(true);
    window.requestAnimationFrame(() => {
      panelRootRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
      onReadyToGeneratePresented?.();
    });
  }, [canGenerateEstimate, estimate, onReadyToGeneratePresented]);

  const financialView = estimate
    ? estimateDocumentViewModel(estimate)
    : null;

  const pricingActions =
    estimate && !isStale ? (
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
                variant="outline"
                className="w-full"
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
              <Button type="button" variant="outline" className="w-full" disabled>
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
          className="w-full bg-[var(--brand-orange)] text-white hover:bg-[var(--brand-orange)]/90"
          label={
            compactCommercialSidebar
              ? ASSISTANT_ACTION_LABELS.continueToPricing
              : undefined
          }
        />
      )
    ) : null;

  const panelBody = (
    <>
      {qualityLevel && !compactCommercialSidebar ? (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Finish level
            </p>
            <p className="text-sm font-medium">{qualityLabel(qualityLevel)}</p>
          </div>
          {onEditQuality && !compactCommercialSidebar ? (
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

      {isStale && !compactCommercialSidebar ? (
        <div
          className="space-y-3 rounded-xl border-2 border-amber-400 bg-amber-50 px-3 py-3 dark:border-amber-600 dark:bg-amber-950/40"
          role="alert"
        >
          <div>
            <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
              This estimate is outdated
            </p>
            <p className="mt-0.5 text-xs text-amber-900/90 dark:text-amber-200/90">
              {presentAssistantError("stale")}
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
              ASSISTANT_ACTION_LABELS.recalculateEstimate
            )}
          </Button>
        </div>
      ) : null}

      {isGenerating ? (
        <div
          className="flex items-center gap-2 py-8 text-sm text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Generating Quick Estimate…
        </div>
      ) : !estimate ? (
        <div className="space-y-4">
          {canGenerateEstimate ? (
            <>
              <AssistantUnderstandingSummaryCard summaries={understandingSummaries} />
              <div className="rounded-xl border border-[var(--brand-orange-muted)] bg-[var(--brand-orange-muted)]/40 px-4 py-5 text-center">
                <p className="text-sm font-medium">
                  I have enough to give you an initial estimate now.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Optional specification can wait for Builder Review.
                </p>
              </div>
              {unresolvedScopeImpactCount > 0 ? (
                <p
                  className="rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
                  role="status"
                >
                  {unresolvedScopeImpactCount === 1
                    ? "1 suggested scope change is still open in Scope Review. You can generate now, or review it first."
                    : `${unresolvedScopeImpactCount} suggested scope changes are still open in Scope Review. You can generate now, or review them first.`}
                </p>
              ) : null}
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
                  ASSISTANT_ACTION_LABELS.estimateNow
                )}
              </Button>
            </>
          ) : (
            <AssistantEmptyState stage="quick_estimate" />
          )}

          {quickEstimatePresentation ? (
            <QuickEstimateDisclosure
              title="Project readiness"
              collapsedHint={readinessCollapsedHint}
            >
              <QuickEstimateHierarchy model={quickEstimatePresentation} />
            </QuickEstimateDisclosure>
          ) : null}
        </div>
      ) : (
        <>
          {/* DECK-2B — Level 1 Quick Estimate summary */}
          {!compactCommercialSidebar ? (
          <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Work area
              </p>
              <p className="text-sm font-medium">
                {quickEstimatePresentation?.estimatedWorkAreas ?? "Project"}
              </p>
            </div>
            {scopeSummaryLine ? (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Scope summary
                </p>
                <p className="text-sm text-foreground/90">{scopeSummaryLine}</p>
              </div>
            ) : null}
            {confidencePresentation ? (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Confidence
                </p>
                <p className="text-sm font-medium">{confidencePresentation.band}</p>
                <p className="text-xs text-muted-foreground">
                  {confidencePresentation.reasons.join(" · ")}
                </p>
              </div>
            ) : null}
            {topAssumptions.length > 0 ? (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Top assumptions
                </p>
                <ul className="mt-1 space-y-1 text-xs text-foreground/90">
                  {topAssumptions.map((item) => (
                    <li key={item} className="flex gap-1.5">
                      <span aria-hidden>•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                {estimate.assumptions.length > topAssumptions.length ? (
                  <button
                    type="button"
                    className="mt-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
                    onClick={onViewBreakdown}
                  >
                    View all assumptions
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          ) : null}

          {/* —— Commercial hierarchy (dominant) —— */}
          {compactCommercialSidebar && isStale ? (
            <div
              className="space-y-2"
              data-compact-stale-summary="true"
            >
              <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                {staleMoney.heading}
              </p>
              <p className="text-xs text-muted-foreground">
                {staleMoney.explanation}
              </p>
              <div data-previous-estimate>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {staleMoney.sellLabel}
                </p>
                <p className="mt-0.5 text-lg font-medium text-muted-foreground line-through">
                  {formatCurrency(estimate.recommendedSell)}
                </p>
              </div>
            </div>
          ) : compactCommercialSidebar ? (
          <div className="space-y-3" data-compact-commercial-summary="true">
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Commercial
              </p>
              <MetricRow
                label="Direct cost"
                value={formatCurrency(estimate.recommendedCost)}
                dimmed={isStale}
                tertiary
              />
              <MetricRow
                label="Effective gross margin"
                value={financialView?.marginLabel ?? "—"}
                dimmed={isStale}
                tertiary
                trailing={
                  !isStale && onMarginSave ? (
                    <MarginEditControl
                      marginPercent={estimate.marginPercent}
                      targetMarginPercent={estimate.targetMarginPercent}
                      defaultMarginPercent={defaultMarginPercent}
                      disabled={isRegenerating || isGenerating}
                      isSaving={isSavingMargin}
                      onSave={onMarginSave}
                      presentation="inline"
                    />
                  ) : null
                }
              />
              {!isStale && onMarginSave && isSavingMargin ? (
                <SaveStatusIndicator status="saving" isSaving />
              ) : !isStale && onMarginSave && marginSaveLabel ? (
                <p
                  className="text-xs text-muted-foreground"
                  data-margin-save-label
                >
                  {marginSaveLabel}
                </p>
              ) : null}
              <MetricRow
                label="Gross profit"
                value={financialView?.profitLabel ?? "—"}
                dimmed={isStale}
                tertiary
              />
            </div>
            {commercialBreakdown &&
              (commercialBreakdown.materialsCost != null ||
                commercialBreakdown.labourCost != null ||
                commercialBreakdown.labourHours != null ||
                commercialBreakdown.allowancesCost != null ||
                commercialBreakdown.subcontractCost != null ||
                commercialBreakdown.plantCost != null ||
                commercialBreakdown.otherCost != null) ? (
              <div className="space-y-1.5 border-t border-border/40 pt-2.5" data-commercial-composition>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Estimate Composition
                </p>
                {commercialBreakdown.materialsCost != null && commercialBreakdown.materialsCost > 0 ? (
                  <MetricRow
                    label="Materials"
                    value={formatCurrency(commercialBreakdown.materialsCost)}
                    dimmed={isStale}
                    tertiary
                  />
                ) : null}
                {commercialBreakdown.labourCost != null && commercialBreakdown.labourCost > 0 ? (
                  <MetricRow
                    label="Labour"
                    value={formatCurrency(commercialBreakdown.labourCost)}
                    dimmed={isStale}
                    tertiary
                  />
                ) : null}
                {commercialBreakdown.labourHours != null && commercialBreakdown.labourHours > 0 ? (
                  <MetricRow
                    label="Labour effort"
                    value={`${commercialBreakdown.labourHours.toFixed(1)} hrs`}
                    dimmed={isStale}
                    tertiary
                  />
                ) : null}
                {commercialBreakdown.allowancesCost != null && commercialBreakdown.allowancesCost > 0 ? (
                  <MetricRow
                    label="Allowances"
                    value={formatCurrency(commercialBreakdown.allowancesCost)}
                    dimmed={isStale}
                    tertiary
                  />
                ) : null}
                {commercialBreakdown.subcontractCost != null && commercialBreakdown.subcontractCost > 0 ? (
                  <MetricRow
                    label="Subcontract"
                    value={formatCurrency(commercialBreakdown.subcontractCost)}
                    dimmed={isStale}
                    tertiary
                  />
                ) : null}
                {commercialBreakdown.plantCost != null && commercialBreakdown.plantCost > 0 ? (
                  <MetricRow
                    label="Plant"
                    value={formatCurrency(commercialBreakdown.plantCost)}
                    dimmed={isStale}
                    tertiary
                  />
                ) : null}
                {commercialBreakdown.otherCost != null && commercialBreakdown.otherCost > 0 ? (
                  <MetricRow
                    label="Other"
                    value={formatCurrency(commercialBreakdown.otherCost)}
                    dimmed={isStale}
                    tertiary
                  />
                ) : null}
              </div>
            ) : null}
          </div>
          ) : (
          <div className={cn("space-y-3", isStale && "opacity-60")}>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {staleMoney.sellLabel}
              </p>
              <p
                className={cn(
                  "mt-0.5 text-3xl font-semibold tracking-tight text-foreground",
                  isStale &&
                    "text-muted-foreground line-through decoration-muted-foreground/50"
                )}
              >
                {formatCurrency(estimate.recommendedSell)}
              </p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Estimate range
              </p>
              <p
                className={cn(
                  "mt-0.5 text-sm font-medium text-foreground/90",
                  isStale && "text-muted-foreground line-through"
                )}
              >
                {formatCurrencyRange(estimate.sellLow, estimate.sellHigh)}
              </p>
            </div>

            <MetricRow
              label="Estimate confidence"
              value={
                confidencePresentation
                  ? `${confidencePresentation.band} (${estimate.confidence}%)`
                  : `${estimate.confidence}%`
              }
              dimmed={isStale}
            />

            <div className="space-y-1.5 border-t border-border/40 pt-2.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Commercial metrics
              </p>
              <MetricRow
                label="Cost"
                value={formatCurrency(estimate.recommendedCost)}
                dimmed={isStale}
                tertiary
              />
              <MetricRow
                label="Margin"
                value={financialView?.marginLabel ?? "—"}
                dimmed={isStale}
                tertiary
                trailing={
                  !isStale && onMarginSave ? (
                    <MarginEditControl
                      marginPercent={estimate.marginPercent}
                      targetMarginPercent={estimate.targetMarginPercent}
                      defaultMarginPercent={defaultMarginPercent}
                      disabled={isRegenerating || isGenerating}
                      isSaving={isSavingMargin}
                      onSave={onMarginSave}
                      presentation="inline"
                    />
                  ) : null
                }
              />
              {!isStale && onMarginSave && isSavingMargin ? (
                <SaveStatusIndicator status="saving" isSaving />
              ) : !isStale && onMarginSave && marginSaveLabel ? (
                <p
                  className="text-xs text-muted-foreground"
                  data-margin-save-label
                >
                  {marginSaveLabel}
                </p>
              ) : null}
              <MetricRow
                label="Gross profit"
                value={financialView?.profitLabel ?? "—"}
                dimmed={isStale}
                tertiary
              />
            </div>
          </div>
          )}
          {!(compactCommercialSidebar && isStale) ? (
          <div className="space-y-1 border-t border-border/40 pt-2.5">
            {compactCommercialSidebar ? (
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Status
              </p>
            ) : null}
          <p
            className={cn(
              "text-xs font-medium",
              status.kind === "ready" && "text-foreground",
              status.kind === "attention" &&
                "text-amber-900 dark:text-amber-200",
              status.kind === "stale" && "text-amber-900 dark:text-amber-200",
              status.kind === "pending" && "text-muted-foreground"
            )}
            role="status"
          >
            {status.statusLabel}
          </p>
          </div>
          ) : null}

          {projectInformationLabel ? (
            <p
              className="text-[11px] text-muted-foreground"
              data-project-information-readiness="true"
            >
              Project information
              <span className="mx-1 text-border">·</span>
              {projectInformationLabel}
            </p>
          ) : null}

          {status.kind === "attention" &&
          status.attentionItems.length > 0 &&
          !compactCommercialSidebar ? (
            <ul className="space-y-2.5 rounded-lg border border-amber-200/70 bg-amber-50/50 px-3 py-2.5 dark:border-amber-900/50 dark:bg-amber-950/20">
              {status.attentionItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    {item.workAreaName ? (
                      <p className="text-[10px] font-medium uppercase tracking-wide text-amber-900/70 dark:text-amber-200/70">
                        {item.workAreaName}
                      </p>
                    ) : null}
                    <p className="font-medium text-amber-950 dark:text-amber-100">
                      {item.label}
                    </p>
                    <p className="text-amber-900/80 dark:text-amber-200/80">
                      {item.detail}
                    </p>
                  </div>
                  {onReviewAttention &&
                  attentionShowsReviewButton(item) ? (
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
          ) : null}

          {/* True blockers stay outside collapsed sections */}
          {estimate.assumptionMetadata?.assumptionSeverity === "critical" &&
          !compactCommercialSidebar ? (
            <div
              className="rounded-md border border-amber-300/80 bg-amber-50/90 px-3 py-2 text-xs text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100"
              role="alert"
            >
              <p className="font-medium">
                Assumed dimensions affect this estimate — confirm before
                pricing.
              </p>
              <ul className="mt-1.5 list-inside list-disc space-y-0.5">
                {defaultedFactWarnings(estimate.assumptionMetadata)
                  .slice(0, 3)
                  .map((item) => (
                    <li key={item}>{item}</li>
                  ))}
              </ul>
            </div>
          ) : null}

          {isStale && onMarginSave ? (
            <p className="text-xs text-amber-800 dark:text-amber-200">
              Regenerate before editing margin.
            </p>
          ) : null}

          {estimate && isStale ? (
            <p className="text-xs text-amber-800 dark:text-amber-200">
              Recalculate estimate before preparing final pricing.
            </p>
          ) : null}

          {/* Primary CTA — commercial decision */}
          {pricingActions}

          <p className="text-[11px] text-muted-foreground">
            Internal only — not a quote.
          </p>

          {compactCommercialSidebar && onViewBreakdown ? (
            <button
              type="button"
              className="text-left text-[11px] text-muted-foreground underline-offset-4 hover:underline"
              onClick={onViewBreakdown}
              data-detailed-breakdown-tertiary="true"
            >
              {ASSISTANT_ACTION_LABELS.viewFullBreakdown}
            </button>
          ) : null}

          {!compactCommercialSidebar ? (
          <>
          <div
            className="space-y-1.5"
            data-estimate-secondary-details
          >
            {/* Mobile: one collapsed “Estimate details” control */}
            <div className="lg:hidden" data-mobile-estimate-details>
              <QuickEstimateDisclosure
                title="Estimate details"
                collapsedHint="Scope · Assumptions · Rates · Readiness"
                defaultOpen={false}
              >
                <div className="space-y-1.5">
                  {quickEstimatePresentation ? (
                    <QuickEstimateDisclosure
                      title="Project readiness"
                      collapsedHint={readinessCollapsedHint}
                    >
                      <QuickEstimateHierarchy
                        model={quickEstimatePresentation}
                      />
                    </QuickEstimateDisclosure>
                  ) : null}

                  {scopeLines ? (
                    <QuickEstimateDisclosure
                      title="Scope"
                      collapsedHint={scopeLines.collapsed}
                    >
                      <ul className="space-y-1.5 text-xs">
                        <li>
                          <span className="text-muted-foreground">
                            Work Areas —{" "}
                          </span>
                          {scopeLines.workAreas}
                        </li>
                        <li>
                          <span className="text-muted-foreground">
                            Included scope —{" "}
                          </span>
                          {scopeLines.includedScope}
                        </li>
                      </ul>
                    </QuickEstimateDisclosure>
                  ) : null}

                  <QuickEstimateDisclosure
                    title="Assumptions"
                    collapsedHint={
                      assumptionCount === 0
                        ? "None listed"
                        : `${assumptionCount} assumption${assumptionCount === 1 ? "" : "s"}`
                    }
                  >
                    {estimate.assumptions.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No assumptions listed for this estimate.
                      </p>
                    ) : (
                      <ul className="space-y-1 text-xs text-foreground/90">
                        {topAssumptions.map((item) => (
                          <li key={item} className="flex gap-1.5">
                            <span aria-hidden>•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                        {estimate.assumptions.length > topAssumptions.length ? (
                          <li className="text-muted-foreground">
                            +{estimate.assumptions.length - topAssumptions.length}{" "}
                            more —{" "}
                            <button
                              type="button"
                              className="underline-offset-2 hover:underline"
                              onClick={onViewBreakdown}
                            >
                              View all assumptions
                            </button>
                          </li>
                        ) : null}
                      </ul>
                    )}
                  </QuickEstimateDisclosure>

                  <QuickEstimateDisclosure
                    title="Rate sources"
                    collapsedHint={estimate.rateSourceSummary}
                  >
                    <p className="text-sm font-medium leading-snug">
                      {estimate.rateSourceSummary}
                    </p>
                    {estimate.rateSourceSummary
                      .toLowerCase()
                      .includes("benchmark") ||
                    estimate.rateSourceSummary
                      .toLowerCase()
                      .includes("missing") ? (
                      <Link
                        href="/app/rates"
                        className="mt-1 inline-block text-xs text-muted-foreground underline-offset-2 hover:underline"
                      >
                        Set your rates
                      </Link>
                    ) : null}
                  </QuickEstimateDisclosure>
                </div>
              </QuickEstimateDisclosure>
            </div>

            {/* Desktop rail: keep four disclosures */}
            <div className="hidden space-y-1.5 lg:block" data-desktop-estimate-details>
              {quickEstimatePresentation ? (
                <QuickEstimateDisclosure
                  title="Project readiness"
                  collapsedHint={readinessCollapsedHint}
                >
                  <QuickEstimateHierarchy model={quickEstimatePresentation} />
                </QuickEstimateDisclosure>
              ) : null}

              {scopeLines ? (
                <QuickEstimateDisclosure
                  title="Scope"
                  collapsedHint={scopeLines.collapsed}
                >
                  <ul className="space-y-1.5 text-xs">
                    <li>
                      <span className="text-muted-foreground">Work Areas — </span>
                      {scopeLines.workAreas}
                    </li>
                    <li>
                      <span className="text-muted-foreground">
                        Included scope —{" "}
                      </span>
                      {scopeLines.includedScope}
                    </li>
                  </ul>
                </QuickEstimateDisclosure>
              ) : null}

              <QuickEstimateDisclosure
                title="Assumptions"
                collapsedHint={
                  assumptionCount === 0
                    ? "None listed"
                    : `${assumptionCount} assumption${assumptionCount === 1 ? "" : "s"}`
                }
              >
                {estimate.assumptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No assumptions listed for this estimate.
                  </p>
                ) : (
                  <ul className="space-y-1 text-xs text-foreground/90">
                    {estimate.assumptions.slice(0, 8).map((item) => (
                      <li key={item} className="flex gap-1.5">
                        <span aria-hidden>•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                    {estimate.assumptions.length > 8 ? (
                      <li className="text-muted-foreground">
                        +{estimate.assumptions.length - 8} more — use full
                        breakdown
                      </li>
                    ) : null}
                  </ul>
                )}
              </QuickEstimateDisclosure>

              <QuickEstimateDisclosure
                title="Rate sources"
                collapsedHint={estimate.rateSourceSummary}
              >
                <p className="text-sm font-medium leading-snug">
                  {estimate.rateSourceSummary}
                </p>
                {estimate.rateSourceSummary.toLowerCase().includes("benchmark") ||
                estimate.rateSourceSummary.toLowerCase().includes("missing") ? (
                  <Link
                    href="/app/rates"
                    className="mt-1 inline-block text-xs text-muted-foreground underline-offset-2 hover:underline"
                  >
                    Set your rates
                  </Link>
                ) : null}
              </QuickEstimateDisclosure>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full border-border bg-background hover:bg-muted/50"
            onClick={onViewBreakdown}
          >
            {ASSISTANT_ACTION_LABELS.viewFullBreakdown}
          </Button>
          </>
          ) : null}
        </>
      )}
    </>
  );

  return (
    <Card
      ref={panelRootRef}
      className={cn(
        "overflow-hidden border-border/60 bg-card transition-[box-shadow,border-color] duration-200 ease-out",
        QUICK_ESTIMATE_STICKY_CLASS,
        isActiveStage
          ? "border-[var(--brand-orange-muted)] shadow-md ring-1 ring-[var(--brand-orange)]/25"
          : estimate
            ? "border-[var(--brand-orange-muted)]/60 shadow-md ring-1 ring-[var(--brand-orange)]/15"
            : "shadow-sm"
      )}
      data-estimate-panel-active={isActiveStage ? "true" : "false"}
      data-compact-commercial-sidebar={compactCommercialSidebar ? "true" : "false"}
      data-quick-estimate-sticky="lg"
      data-ready-to-generate={canGenerateEstimate && !estimate ? "true" : "false"}
      data-mobile-qe-expanded={mobileExpanded ? "true" : "false"}
    >
      {/* Mobile header — pre-estimate: compact toggle; post-estimate: title only */}
      {estimate ? (
        <div
          className="border-b border-border/60 px-4 py-3 lg:hidden"
          data-mobile-qe-header="estimate"
        >
          <p className="text-sm font-semibold">
            {compactCommercialSidebar ? "Commercial Overview" : "Quick Estimate"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Draft estimate based on your inputs
          </p>
        </div>
      ) : (
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 border-b border-border/60 px-4 py-3 text-left lg:hidden"
          onClick={() => setMobileExpanded((prev) => !prev)}
          aria-expanded={mobileExpanded}
          data-mobile-qe-header="pending"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold">Quick Estimate</p>
            <p className="truncate text-xs text-muted-foreground">
              {mobileSummary.primaryLine}
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-foreground/80">
              {mobileSummary.secondaryActionLabel}
            </p>
          </div>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              mobileExpanded && "rotate-180"
            )}
            aria-hidden
          />
        </button>
      )}

      <CardHeader className="hidden pb-3 lg:block">
        <CardTitle className="text-base">
          {estimate && compactCommercialSidebar ? "Commercial Overview" : "Quick Estimate"}
        </CardTitle>
        <CardDescription>
          {estimate
            ? "Draft estimate based on your inputs"
            : canGenerateEstimate
              ? "Ready to generate your draft estimate"
              : constraintsSubmitted
                ? "A few things left to clarify"
                : "Job plan confirmed. Estimate when clarified or safely assumed."}
        </CardDescription>
      </CardHeader>

      <CardContent
        className={cn(
          "space-y-4",
          !estimate && !mobileExpanded && "hidden lg:block"
        )}
        data-mobile-qe-body={estimate ? "always" : mobileExpanded ? "open" : "closed"}
      >
        {panelBody}
      </CardContent>
    </Card>
  );
}
