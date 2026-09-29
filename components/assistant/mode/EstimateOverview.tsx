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

const primaryClassName =
  "h-11 min-h-11 w-full bg-[var(--brand-orange)] text-white hover:bg-[var(--brand-orange)]/90 focus-visible:ring-[var(--brand-orange)] sm:w-auto";

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
  reviewLabel?: string;
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
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className={cn("mt-1", emphasize && "text-2xl font-semibold tracking-tight sm:text-3xl")}>
        {children}
      </div>
    </div>
  );
}

function ActionList({
  title,
  items,
  tone,
}: {
  title: string;
  items: readonly EstimateOverviewAction[];
  tone: "required" | "optional";
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3">
      <h3
        className={cn(
          "text-sm font-medium",
          tone === "required" ? "text-[var(--brand-orange)]" : "text-muted-foreground"
        )}
      >
        {title}
      </h3>
      <ul className="mt-1">
        {items.map((item) => (
          <li
            key={item.id}
            className="border-t border-border/70 py-3"
            data-estimate-overview-action={item.group}
            data-blocks-pricing={item.blocksPricing ? "true" : "false"}
          >
            <p className={tone === "required" ? "font-medium" : ""}>{item.title}</p>
            {item.detail ? (
              <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
            ) : null}
            {item.workAreaName ? (
              <p className="mt-1 text-sm text-muted-foreground">{item.workAreaName}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
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
  reviewLabel = ASSISTANT_ACTION_LABELS.reviewEstimate,
  marginControl,
  marginSaveIndicator,
}: EstimateOverviewProps) {
  const sell = model.sell;
  return (
    <div className="flex min-w-0 flex-col gap-4 overflow-x-hidden" data-estimate-overview>
      <section className="order-1 rounded-xl border border-border/70 bg-card px-4 py-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Estimate status">
            <p
              className="text-lg font-medium"
              data-estimate-overview-status={model.status}
            >
              {model.statusLabel}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {model.statusDetail}
            </p>
          </Stat>
          <Stat label={sell.presentation === "unresolved" ? "Recommended client sell" : sell.label} emphasize>
            {sell.presentation === "hidden" ? (
              <p className="text-sm text-muted-foreground" data-estimate-overview-sell="hidden">
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
                    sell.presentation === "previous" && "text-muted-foreground line-through"
                  )}
                >
                  {sell.exGst}
                </span>
                {sell.gst ? (
                  <span className="ml-2 text-sm font-medium text-muted-foreground">
                    ex GST
                  </span>
                ) : null}
              </p>
            ) : null}
            {sell.gst && sell.inclGst ? (
              <p className="mt-1 text-sm text-muted-foreground" data-estimate-overview-gst>
                {sell.gst} GST · {sell.inclGst} incl GST
              </p>
            ) : null}
          </Stat>
          <Stat label="Required actions">
            <p className="text-lg font-medium tabular-nums" data-estimate-overview-required-count>
              {model.requiredCount}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Required items are listed below. Accuracy and rate notes do not block Pricing.
            </p>
          </Stat>
          <Stat label="Work Areas">
            <p className="text-lg font-medium tabular-nums" data-estimate-overview-work-area-count>
              {model.workAreas.count}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {model.workAreas.missingPricingCount > 0
                ? `${model.workAreas.missingPricingCount} with Pricing Required`
                : model.workAreas.count > 0
                  ? "No missing prices recorded"
                  : "No Work Areas yet"}
            </p>
          </Stat>
        </div>

        {sell.presentation !== "hidden" ? (
          <p className="mt-4 text-sm text-muted-foreground" data-estimate-overview-boundary>
            {sell.boundaryCopy}
          </p>
        ) : null}
      </section>

      {model.composition.length > 0 || model.workAreas.rows.length > 0 ? (
      <section className="order-3 rounded-xl border border-border/70 bg-card px-4 py-4 xl:order-2" data-estimate-overview-commercial>
        {model.composition.length > 0 ? (
          <dl
            className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 xl:grid-cols-4"
            data-estimate-overview-composition
          >
            {model.composition.map((row) => (
              <div key={row.id} className="min-w-0" data-composition-id={row.id}>
                <dt className="text-sm text-muted-foreground">{row.label}</dt>
                <dd className="mt-1 font-medium tabular-nums">
                  {row.id === "margin" && marginControl ? (
                    <span className="inline-flex flex-wrap items-center gap-2">
                      {row.value}
                      {marginControl}
                    </span>
                  ) : (
                    row.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
        {marginSaveIndicator}
        {model.workAreas.rows.length > 0 ? (
          <ul
            className={cn(
              "space-y-2",
              model.composition.length > 0 && "mt-4 border-t border-border/70 pt-4"
            )}
            data-estimate-overview-work-areas
          >
            {model.workAreas.rows.map((area) => (
              <li key={area.name} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0">{area.name}</span>
                {area.note ? (
                  <span className="text-muted-foreground">{area.note}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      ) : null}

      <section className="order-2 rounded-xl border border-border/70 bg-card px-4 py-4 xl:order-3" data-estimate-overview-actions>
        <h2 className="text-sm font-medium">Action centre</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Required checks follow the current readiness rules. Accuracy and rate items can be reviewed now or later.
        </p>
        {model.required.length === 0 &&
        model.accuracy.length === 0 &&
        model.rates.length === 0 ? (
          <p className="mt-3 text-sm">No unresolved matters on this estimate.</p>
        ) : (
          <>
            <ActionList title="Required before Pricing" items={model.required} tone="required" />
            <ActionList
              title="Accuracy and assumptions to review"
              items={model.accuracy}
              tone="optional"
            />
            <ActionList
              title="Rates or benchmarks worth improving"
              items={model.rates}
              tone="optional"
            />
          </>
        )}
      </section>

      <div className="order-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {model.primary === "continue_information" && onContinueInformation ? (
          <Button
            type="button"
            className={primaryClassName}
            data-estimate-overview-primary="continue_information"
            onClick={onContinueInformation}
          >
            {model.primaryLabel}
          </Button>
        ) : null}
        {model.primary === "complete_details" && onCompleteDetails ? (
          <Button
            type="button"
            className={primaryClassName}
            data-estimate-overview-primary="complete_details"
            onClick={onCompleteDetails}
          >
            {model.primaryLabel}
          </Button>
        ) : null}
        {model.primary === "regenerate" && onRegenerate ? (
          <Button
            type="button"
            className={primaryClassName}
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
              className={primaryClassName}
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
              className={primaryClassName}
              variant="default"
            />
          </div>
        ) : null}
        {onReviewEstimate ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 min-h-11 w-full sm:w-auto"
            data-estimate-overview-secondary="review"
            onClick={onReviewEstimate}
          >
            {reviewLabel}
          </Button>
        ) : null}
        {onEditJob ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 min-h-11 w-full sm:w-auto"
            data-estimate-overview-secondary="edit-job"
            onClick={onEditJob}
          >
            {ASSISTANT_ACTION_LABELS.editJob}
          </Button>
        ) : null}
      </div>
      {onViewBreakdown ? (
        <button
          type="button"
          className="order-4 text-left text-sm text-muted-foreground underline-offset-4 hover:underline"
          onClick={onViewBreakdown}
          data-mobile-detailed-breakdown="true"
          data-detailed-breakdown-tertiary="true"
        >
          {ASSISTANT_ACTION_LABELS.viewFullBreakdown}
        </button>
      ) : null}
      <p className="order-4 sr-only" data-pricing-creation-blocked={model.pricingCreationBlocked ? "true" : "false"}>
        {model.pricingCreationBlocked
          ? "Pricing creation is blocked"
          : "Pricing creation can continue"}
      </p>
    </div>
  );
}
