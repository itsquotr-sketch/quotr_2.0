"use client";

import type { ReactNode } from "react";
import { PrepareFinalPricingButton } from "@/components/pricing/PrepareFinalPricingButton";
import { ASSISTANT_ACTION_LABELS } from "@/lib/assistant/presentation/action-labels";
import { cn } from "@/lib/utils";

type EstimateReadySurfaceProps = {
  projectId: string;
  estimateId?: string;
  isStale: boolean;
  isRegenerating?: boolean;
  pricingCtaEnabled: boolean;
  /** After Builder Review, Continue to Pricing is the primary next action. */
  pricingCtaPrimary?: boolean;
  reviewOpen?: boolean;
  children: ReactNode;
};

export function EstimateReadySurface({
  projectId,
  estimateId,
  isStale,
  isRegenerating = false,
  pricingCtaEnabled,
  pricingCtaPrimary = false,
  reviewOpen = false,
  children,
}: EstimateReadySurfaceProps) {
  return (
    <div
      className="space-y-3 overflow-x-hidden"
      data-assistant-surface="estimate_ready"
      data-estimate-stale={isStale ? "true" : "false"}
      data-estimate-regenerating={isRegenerating ? "true" : "false"}
      data-update-estimate-busy={isRegenerating ? "true" : "false"}
    >
      {children}
      {!isStale && !reviewOpen ? (
        <p
          className="text-xs text-muted-foreground"
          data-estimate-pricing-boundary
        >
          This is your working estimate. Review it before creating final Pricing.
        </p>
      ) : null}
      {!isStale && !reviewOpen ? (
        <p
          className="text-xs text-muted-foreground"
          data-estimate-calibrate-later
        >
          Want Quotr to match how your crew works? Calibrate how you work from
          the dashboard.
        </p>
      ) : null}
      {!isStale && pricingCtaEnabled && !reviewOpen ? (
        <div
          className="lg:hidden"
          data-estimate-ready-mobile-pricing
          data-estimate-pricing-cta={pricingCtaPrimary ? "primary" : "secondary"}
        >
          <PrepareFinalPricingButton
            projectId={projectId}
            estimateId={estimateId}
            className="h-11 w-full min-h-11"
            variant={pricingCtaPrimary ? "default" : "outline"}
            label={ASSISTANT_ACTION_LABELS.continueToPricing}
          />
        </div>
      ) : null}
    </div>
  );
}

export function EstimateReadyJobDetails({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn(className)} data-estimate-ready-job-details="true">
      {children}
    </div>
  );
}
