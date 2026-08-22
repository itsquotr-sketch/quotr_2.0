"use client";

import type { ReactNode } from "react";
import { formatCurrency } from "@/components/assistant/format";
import { MetricRow } from "@/components/ui/metric-row";
import { estimateDocumentViewModel } from "@/lib/estimate/financial-view-model";
import type { Estimate } from "@/components/assistant/types";
import type { CommercialOverviewBreakdown } from "@/lib/assistant/presentation/commercial-overview-projection";
import { cn } from "@/lib/utils";

type CommercialOverviewMetricsProps = {
  estimate: Estimate;
  breakdown?: CommercialOverviewBreakdown | null;
  isStale?: boolean;
  statusLabel?: string | null;
  statusKind?: "ready" | "attention" | "pending" | "stale";
  compositionHeading?: string;
  otherLabel?: string;
  marginTrailing?: ReactNode;
  marginSaveIndicator?: ReactNode;
};

export function CommercialOverviewMetrics({
  estimate,
  breakdown = null,
  isStale = false,
  statusLabel = null,
  statusKind,
  compositionHeading = "Composition",
  otherLabel = "Other Direct",
  marginTrailing,
  marginSaveIndicator,
}: CommercialOverviewMetricsProps) {
  const financialView = estimateDocumentViewModel(estimate);
  const hasComposition = Boolean(
    breakdown &&
      ((breakdown.materialsCost != null && breakdown.materialsCost > 0) ||
        (breakdown.labourCost != null && breakdown.labourCost > 0) ||
        (breakdown.labourHours != null && breakdown.labourHours > 0) ||
        (breakdown.allowancesCost != null && breakdown.allowancesCost > 0) ||
        (breakdown.subcontractCost != null && breakdown.subcontractCost > 0) ||
        (breakdown.plantCost != null && breakdown.plantCost > 0) ||
        (breakdown.otherCost != null && breakdown.otherCost > 0))
  );

  return (
    <div className="space-y-3" data-commercial-overview-metrics="true">
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
          value={financialView.marginLabel ?? "—"}
          dimmed={isStale}
          tertiary
          trailing={marginTrailing}
        />
        {marginSaveIndicator}
        <MetricRow
          label="Gross profit"
          value={financialView.profitLabel ?? "—"}
          dimmed={isStale}
          tertiary
        />
      </div>
      {hasComposition && breakdown ? (
        <div
          className="space-y-1.5 border-t border-border/40 pt-2.5"
          data-commercial-composition
        >
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {compositionHeading}
          </p>
          {breakdown.materialsCost != null && breakdown.materialsCost > 0 ? (
            <MetricRow
              label="Materials"
              value={formatCurrency(breakdown.materialsCost)}
              dimmed={isStale}
              tertiary
            />
          ) : null}
          {breakdown.labourCost != null && breakdown.labourCost > 0 ? (
            <MetricRow
              label="Labour"
              value={formatCurrency(breakdown.labourCost)}
              dimmed={isStale}
              tertiary
            />
          ) : null}
          {breakdown.labourHours != null && breakdown.labourHours > 0 ? (
            <MetricRow
              label="Labour effort"
              value={`${breakdown.labourHours.toFixed(1)} hrs`}
              dimmed={isStale}
              tertiary
            />
          ) : null}
          {breakdown.allowancesCost != null && breakdown.allowancesCost > 0 ? (
            <MetricRow
              label="Allowances"
              value={formatCurrency(breakdown.allowancesCost)}
              dimmed={isStale}
              tertiary
            />
          ) : null}
          {breakdown.subcontractCost != null && breakdown.subcontractCost > 0 ? (
            <MetricRow
              label="Subcontract"
              value={formatCurrency(breakdown.subcontractCost)}
              dimmed={isStale}
              tertiary
            />
          ) : null}
          {breakdown.plantCost != null && breakdown.plantCost > 0 ? (
            <MetricRow
              label="Plant"
              value={formatCurrency(breakdown.plantCost)}
              dimmed={isStale}
              tertiary
            />
          ) : null}
          {breakdown.otherCost != null && breakdown.otherCost > 0 ? (
            <MetricRow
              label={otherLabel}
              value={formatCurrency(breakdown.otherCost)}
              dimmed={isStale}
              tertiary
            />
          ) : null}
        </div>
      ) : null}
      {statusLabel ? (
        <div className="space-y-1 border-t border-border/40 pt-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Status
          </p>
          <p
            className={cn(
              "text-xs font-medium",
              statusKind === "ready" && "text-foreground",
              statusKind === "attention" &&
                "text-amber-900 dark:text-amber-200",
              statusKind === "stale" && "text-amber-900 dark:text-amber-200",
              statusKind === "pending" && "text-muted-foreground"
            )}
            role="status"
          >
            {statusLabel}
          </p>
        </div>
      ) : null}
    </div>
  );
}
