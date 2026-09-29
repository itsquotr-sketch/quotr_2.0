"use client";

import type { ReactNode } from "react";
import { PrepareFinalPricingButton } from "@/components/pricing/PrepareFinalPricingButton";
import {
  OpenFinalPricingLink,
} from "@/components/pricing/PrepareFinalPricingButton";
import { Button } from "@/components/ui/button";
import { ASSISTANT_ACTION_LABELS } from "@/lib/assistant/presentation/action-labels";
import type {
  EstimateOverviewAction,
  EstimateOverviewModel,
} from "@/lib/assistant/presentation/estimate-overview";
import { cn } from "@/lib/utils";

const actionButtonClassName = "h-11 min-h-11 w-full sm:w-auto";
const pricingPrimaryClassName =
  "h-11 min-h-11 w-full bg-[var(--brand-orange)] text-white hover:bg-[var(--brand-orange)]/90 focus-visible:ring-[var(--brand-orange)] sm:w-auto";

const VIEW_WORK_AREA_BREAKDOWN = "View work area breakdown";

type EstimateOverviewProps = {
  model: EstimateOverviewModel;
  projectId?: string;
  estimateId?: string;
  pricingDocumentId?: string | null;
  isRegenerating?: boolean;
  onContinueInformation?: () => void;
  onCompleteDetails?: () => void;
  onRegenerate?: () => void;
  onReviewEstimate?: () => void;
  onEditJob?: () => void;
  onViewBreakdown?: () => void;
  marginControl?: ReactNode;
  marginSaveIndicator?: ReactNode;
};

function Stat({
  label,
  children,
  emphasize = false,
}: {
  label: string;
  children: ReactNode;
  emphasize?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium text-foreground/75">{label}</p>
      <div className={cn("mt-1", emphasize && "text-2xl font-semibold tracking-tight sm:text-3xl")}>
        {children}
      </div>
    </div>
  );
}

function ActionItems({ items }: { items: readonly EstimateOverviewAction[] }) {
  return (
    <ul className="mt-1">
      {items.map((item) => (
        <li
          key={item.id}
          className="border-t border-border/70 py-3"
          data-estimate-overview-action={item.group}
          data-blocks-pricing={item.blocksPricing ? "true" : "false"}
        >
          <p className={item.blocksPricing ? "font-medium text-foreground" : "text-foreground/90"}>
            {item.title}
          </p>
          {item.detail ? (
            <p className="mt-1 text-sm text-foreground/75">{item.detail}</p>
          ) : null}
          {item.workAreaName ? (
            <p className="mt-1 text-sm text-foreground/75">{item.workAreaName}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function CollapsedNotice({
  summary,
  items,
  marker,
}: {
  summary: string;
  items: readonly EstimateOverviewAction[];
  marker: "assumptions" | "benchmark";
}) {
  if (items.length === 0) return null;
  return (
    <details
      className="mt-3 border-t border-border/70 pt-3"
      data-estimate-overview-disclosure={marker}
    >
      <summary className="cursor-pointer rounded-sm text-sm font-semibold text-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {summary}
      </summary>
      <ActionItems items={items} />
    </details>
  );
}

export function EstimateOverview({
  model,
  projectId,
  estimateId,
  pricingDocumentId = null,
  isRegenerating = false,
  onContinueInformation,
  onCompleteDetails,
  onRegenerate,
  onReviewEstimate,
  onEditJob,
  onViewBreakdown,
  marginControl,
  marginSaveIndicator,
}: EstimateOverviewProps) {
  const sell = model.sell;
  const direct = model.composition.find((row) => row.id === "direct");
  const margin = model.composition.find((row) => row.id === "margin");
  const categoryRows = model.composition.filter(
    (row) => row.id !== "direct" && row.id !== "margin"
  );
  const readyForPricing =
    model.required.length === 0 && !model.pricingCreationBlocked;
  const blockerRepeatsStatus = model.required.some((item) => item.title === model.statusDetail);
  const showQuietStatus =
    (model.status === "stale" || model.status === "incomplete") && !blockerRepeatsStatus;

  return (
    <div className="flex min-w-0 flex-col gap-4 overflow-x-hidden" data-estimate-overview>
      <section className="order-1 rounded-xl border border-border/70 bg-card px-4 py-4" data-estimate-overview-commercial>
        <Stat label={sell.presentation === "unresolved" ? "Recommended client sell" : sell.label} emphasize>
          {sell.presentation === "hidden" ? (
            <p className="text-sm text-foreground/75" data-estimate-overview-sell="hidden">
              No estimate yet
            </p>
          ) : null}
          {sell.presentation === "unresolved" ? (
            <p className="text-lg font-medium" data-estimate-overview-sell="unresolved">
              Pricing Required
            </p>
          ) : null}
          {sell.exGst ? (
            <p
              data-estimate-overview-sell={sell.presentation}
              data-sell-current={sell.presentation === "current" ? "true" : "false"}
            >
              <span
                className={cn(
                  "tabular-nums",
                  sell.presentation === "previous" && "text-foreground/70 line-through"
                )}
              >
                {sell.exGst}
              </span>
              {sell.gst ? (
                <span className="ml-2 text-sm font-medium text-foreground/75">
                  ex GST
                </span>
              ) : null}
            </p>
          ) : null}
          {sell.gst && sell.inclGst ? (
            <p className="mt-1 text-sm text-foreground/75" data-estimate-overview-gst>
              {sell.gst} GST · {sell.inclGst} incl GST
            </p>
          ) : null}
        </Stat>

        {showQuietStatus ? (
          <p
            className="mt-3 text-sm leading-6 text-foreground/75"
            data-estimate-overview-status={model.status}
          >
            {model.statusDetail}
          </p>
        ) : (
          <p className="sr-only" data-estimate-overview-status={model.status}>
            {model.statusLabel}
          </p>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {direct ? (
            <Stat label="Direct cost">
              <p className="text-lg font-medium tabular-nums" data-composition-id="direct">
                {direct.value}
              </p>
            </Stat>
          ) : null}
          {margin ? (
            <Stat label="Effective gross margin">
              <p className="text-lg font-medium tabular-nums" data-composition-id="margin">
                {marginControl ? (
                  <span className="inline-flex flex-wrap items-center gap-2">
                    {margin.value}
                    {marginControl}
                  </span>
                ) : (
                  margin.value
                )}
              </p>
            </Stat>
          ) : null}
          <Stat label="Work Areas">
            <p className="text-lg font-medium" data-estimate-overview-work-area-count>
              {model.workAreas.summaryLine}
            </p>
          </Stat>
          <Stat label="Pricing Required">
            <p className="text-lg font-medium tabular-nums" data-estimate-overview-pricing-attention-count>
              {model.pricingAttentionCount}
            </p>
          </Stat>
        </div>

        {model.workAreas.names.length > 0 ? (
          <p
            className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm text-foreground/80"
            data-estimate-overview-work-areas
          >
            {model.workAreas.names.map((name) => (
              <span key={name}>{name}</span>
            ))}
          </p>
        ) : null}

        {categoryRows.length > 0 ? (
          <dl
            className="mt-4 grid grid-cols-1 gap-x-4 gap-y-3 border-t border-border/70 pt-4 sm:grid-cols-2 xl:grid-cols-4"
            data-estimate-overview-composition
          >
            {categoryRows.map((row) => (
              <div key={row.id} className="min-w-0" data-composition-id={row.id}>
                <dt className="text-sm font-medium text-foreground/75">{row.label}</dt>
                <dd className="mt-1 font-medium tabular-nums text-foreground">{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {model.reconciliation.note ? (
          <p className="mt-3 text-sm text-foreground/75" data-estimate-overview-reconciliation={model.reconciliation.state}>
            {model.reconciliation.note}
          </p>
        ) : (
          <p className="sr-only" data-estimate-overview-reconciliation={model.reconciliation.state}>
            {model.reconciliation.state}
          </p>
        )}
        {marginSaveIndicator}
        {sell.presentation !== "hidden" ? (
          <p className="mt-4 text-sm text-foreground/75" data-estimate-overview-boundary>
            {sell.boundaryCopy}
          </p>
        ) : null}
      </section>

      <section className="order-2 rounded-xl border border-border/70 bg-card px-4 py-4" data-estimate-overview-actions>
        <h2 className="text-sm font-semibold text-foreground">Action centre</h2>
        {readyForPricing ? (
          <div className="mt-3" data-estimate-overview-ready="true">
            <h3 className="text-sm font-semibold text-foreground">Ready for Pricing</h3>
            <p className="mt-1 text-sm text-foreground/75">No required issues remain.</p>
          </div>
        ) : (
          <div className="mt-3" data-estimate-overview-blockers="true">
            <h3 className="text-sm font-semibold text-foreground">Required before Pricing</h3>
            <p className="mt-1 text-sm font-medium tabular-nums text-foreground" data-estimate-overview-required-count>
              {model.requiredCount}
            </p>
            <ActionItems items={model.required} />
          </div>
        )}
        {model.pricingAttention.length > 0 ? (
          <div className="mt-3 border-t border-border/70 pt-3" data-estimate-overview-pricing-attention="true">
            <h3 className="text-sm font-semibold text-foreground/80">Needs attention in Pricing</h3>
            <ActionItems items={model.pricingAttention} />
          </div>
        ) : null}
        <CollapsedNotice
          summary={model.assumptionSummary ?? ""}
          items={model.accuracy}
          marker="assumptions"
        />
        <CollapsedNotice
          summary={model.benchmarkSummary ?? ""}
          items={model.rates}
          marker="benchmark"
        />
      </section>

      <div className="order-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {model.primary === "continue_information" && onContinueInformation ? (
          <Button
            type="button"
            className={actionButtonClassName}
            data-estimate-overview-primary="continue_information"
            onClick={onContinueInformation}
          >
            {model.primaryLabel}
          </Button>
        ) : null}
        {model.primary === "complete_details" && onCompleteDetails ? (
          <Button
            type="button"
            className={actionButtonClassName}
            data-estimate-overview-primary="complete_details"
            onClick={onCompleteDetails}
          >
            {model.primaryLabel}
          </Button>
        ) : null}
        {model.primary === "regenerate" && onRegenerate ? (
          <Button
            type="button"
            className={actionButtonClassName}
            data-estimate-overview-primary="regenerate"
            data-pricing-creation-blocked="true"
            onClick={onRegenerate}
            disabled={isRegenerating}
          >
            {isRegenerating ? ASSISTANT_ACTION_LABELS.updatingEstimate : model.primaryLabel}
          </Button>
        ) : null}
        {model.primary === "continue_pricing" &&
        model.pricingEntry === "create" &&
        projectId ? (
          <div data-estimate-overview-primary="continue_pricing" data-pricing-entry="create">
            <PrepareFinalPricingButton
              projectId={projectId}
              estimateId={estimateId}
              className={pricingPrimaryClassName}
              label={model.primaryLabel}
            />
          </div>
        ) : null}
        {model.primary === "continue_pricing" &&
        model.pricingEntry === "open" &&
        projectId &&
        pricingDocumentId ? (
          <div
            className="w-full sm:w-auto"
            data-estimate-overview-primary="continue_pricing"
            data-pricing-entry="open"
          >
            <OpenFinalPricingLink
              projectId={projectId}
              pricingDocumentId={pricingDocumentId}
              className={pricingPrimaryClassName}
              variant="default"
              label={model.primaryLabel}
            />
          </div>
        ) : null}
        {onReviewEstimate ? (
          <Button
            type="button"
            variant="outline"
            className={actionButtonClassName}
            data-estimate-overview-secondary="review"
            onClick={onReviewEstimate}
          >
            {VIEW_WORK_AREA_BREAKDOWN}
          </Button>
        ) : null}
        {onEditJob ? (
          <Button
            type="button"
            variant="outline"
            className={actionButtonClassName}
            data-estimate-overview-secondary="edit-job"
            onClick={onEditJob}
          >
            {ASSISTANT_ACTION_LABELS.editJobDetails}
          </Button>
        ) : null}
      </div>
      {onViewBreakdown ? (
        <button
          type="button"
          className="order-3 rounded-sm text-left text-sm text-foreground/75 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onViewBreakdown}
          data-mobile-detailed-breakdown="true"
          data-detailed-breakdown-tertiary="true"
        >
          {ASSISTANT_ACTION_LABELS.viewFullBreakdown}
        </button>
      ) : null}
      <p className="order-3 sr-only" data-pricing-creation-blocked={model.pricingCreationBlocked ? "true" : "false"}>
        {model.pricingCreationBlocked
          ? "Pricing creation is blocked"
          : "Pricing creation can continue"}
      </p>
    </div>
  );
}
