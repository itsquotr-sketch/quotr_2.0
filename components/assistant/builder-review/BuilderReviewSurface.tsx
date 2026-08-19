"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/components/assistant/format";
import type { BuilderReviewView } from "@/lib/assistant/builder-review";
import { ASSISTANT_ACTION_LABELS } from "@/lib/assistant/presentation/action-labels";
import { cn } from "@/lib/utils";

type BuilderReviewSurfaceProps = {
  view: BuilderReviewView;
  isRegenerating?: boolean;
  onBack: () => void;
  onEditJob?: () => void;
  onRefine?: () => void;
  onUpdateEstimate?: () => void;
  onChangeMaterial?: (workAreaId: string | null) => void;
  className?: string;
};

function formatQty(quantity: number | null, unit: string | null): string | null {
  if (quantity == null) return null;
  const q = Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(1);
  return unit ? `${q} ${unit}` : q;
}

export function BuilderReviewSurface({
  view,
  isRegenerating = false,
  onBack,
  onEditJob,
  onRefine,
  onUpdateEstimate,
  onChangeMaterial,
  className,
}: BuilderReviewSurfaceProps) {
  const multi = view.workAreas.length > 1;
  const [openAreas, setOpenAreas] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const wa of view.workAreas) {
      init[wa.workAreaName] = true;
    }
    return init;
  });

  return (
    <section
      className={cn(
        "space-y-4 overflow-x-hidden pb-[max(1rem,env(safe-area-inset-bottom))]",
        className
      )}
      data-builder-review-surface="true"
      data-builder-review-entry="open"
      data-estimate-stale={view.overview.isStale ? "true" : "false"}
      data-takeoff-affects-money="false"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          className="h-11 min-h-11 px-3"
          data-builder-review-back
          onClick={onBack}
        >
          ← Back
        </Button>
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Builder Review
        </p>
      </div>

      {view.overview.isStale ? (
        <div
          className="rounded-xl border border-amber-300/80 bg-amber-50 px-4 py-3 dark:border-amber-800/60 dark:bg-amber-950/40"
          data-builder-review-stale
        >
          <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
            Estimate needs updating
          </p>
          <p className="mt-1 text-xs text-amber-900/90 dark:text-amber-200/90">
            Review shows the previous estimate. Update after job changes.
          </p>
          {onUpdateEstimate ? (
            <Button
              type="button"
              className="mt-3 h-11 min-h-11 w-full sm:w-auto"
              data-builder-review-update
              disabled={isRegenerating}
              onClick={onUpdateEstimate}
            >
              {isRegenerating
                ? ASSISTANT_ACTION_LABELS.updatingEstimate
                : ASSISTANT_ACTION_LABELS.updateEstimate}
            </Button>
          ) : null}
        </div>
      ) : null}

      <div
        className="rounded-xl border border-border/60 bg-card px-4 py-4"
        data-builder-review-overview
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Recommended sell
            </p>
            <p className="mt-0.5 text-2xl font-semibold tracking-tight">
              {formatCurrency(view.overview.recommendedSell)}{" "}
              <span className="text-sm font-medium text-muted-foreground">
                + GST
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Cost
            </p>
            <p className="text-sm font-medium">
              {formatCurrency(view.overview.recommendedCost)}
            </p>
            <p className="text-xs text-muted-foreground">
              GM {view.overview.marginPercent.toFixed(1)}%
            </p>
          </div>
        </div>

        <p className="mt-3 text-sm text-foreground/90">
          {view.overview.workAreaNames.join(" · ")}
        </p>

        {view.overview.confidenceBand ? (
          <div className="mt-3" data-builder-review-confidence>
            <p className="text-sm">
              <span className="text-muted-foreground">Confidence </span>
              <span className="font-medium">{view.overview.confidenceBand}</span>
            </p>
            {view.overview.confidenceExplanation ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {view.overview.confidenceExplanation}
              </p>
            ) : null}
          </div>
        ) : null}

        {view.overview.categorySummary.length > 0 ? (
          <ul
            className="mt-3 grid gap-1.5 border-t border-border/40 pt-3 sm:grid-cols-2"
            data-builder-review-category-summary
          >
            {view.overview.categorySummary.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-medium">{formatCurrency(row.cost)}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <p
          className="mt-2 text-[11px] text-muted-foreground"
          data-builder-review-cost-reconcile={
            view.costReconciles ? "true" : "false"
          }
        >
          {view.costReconciles
            ? "Category totals reconcile to estimate cost."
            : "Category totals are approximate — check line items."}
        </p>
      </div>

      {view.improvements.length > 0 ? (
        <div
          className="rounded-xl border border-border/60 px-4 py-4"
          data-builder-review-improve
        >
          <p className="text-sm font-semibold">Improve this estimate</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {view.improvements.length} detail
            {view.improvements.length === 1 ? "" : "s"} could improve accuracy
          </p>
          <ul className="mt-3 space-y-2">
            {view.improvements.map((item) => (
              <li key={item.id} className="text-sm">
                <span className="font-medium">{item.label}</span>
                {item.reason ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {item.reason}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            {onRefine ? (
              <Button
                type="button"
                className="h-11 min-h-11 w-full sm:w-auto"
                data-builder-review-refine
                onClick={onRefine}
              >
                {ASSISTANT_ACTION_LABELS.refineEstimate}
              </Button>
            ) : null}
            {onEditJob ? (
              <Button
                type="button"
                variant="outline"
                className="h-11 min-h-11 w-full sm:w-auto"
                data-builder-review-edit-job
                onClick={onEditJob}
              >
                {ASSISTANT_ACTION_LABELS.editJob}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="space-y-3" data-builder-review-work-areas>
        {view.workAreas.map((wa) => {
          const open = openAreas[wa.workAreaName] !== false;
          return (
            <div
              key={wa.workAreaName}
              className="overflow-hidden rounded-xl border border-border/60"
              data-builder-review-work-area={wa.workAreaType ?? wa.workAreaName}
              data-work-area-cost={wa.cost}
            >
              <button
                type="button"
                className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left"
                aria-expanded={open}
                data-builder-review-wa-toggle
                onClick={() =>
                  setOpenAreas((prev) => ({
                    ...prev,
                    [wa.workAreaName]: !open,
                  }))
                }
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{wa.workAreaName}</p>
                  {!multi ? (
                    <p className="text-xs text-muted-foreground">
                      Cost {formatCurrency(wa.cost)}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(wa.cost)} cost
                    </p>
                  )}
                </div>
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform",
                    open && "rotate-180"
                  )}
                />
              </button>

              {open ? (
                <div className="space-y-4 border-t border-border/40 px-4 py-3">
                  {wa.categories.map((cat) => (
                    <section
                      key={cat.id}
                      className="space-y-2"
                      data-builder-review-category={cat.id}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {cat.label}
                        </p>
                        {cat.cost > 0 ? (
                          <p className="text-xs font-medium">
                            {formatCurrency(cat.cost)}
                          </p>
                        ) : null}
                      </div>

                      <ul className="space-y-3">
                        {cat.lines.map((line) => (
                          <li
                            key={line.id}
                            className="rounded-lg bg-muted/20 px-3 py-2.5"
                            data-builder-review-line={line.itemKey ?? line.id}
                            data-commercial="true"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-medium leading-snug">
                                  {line.label}
                                </p>
                                {line.isAllowance ? (
                                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                                    Allowance / package
                                  </p>
                                ) : null}
                                {line.specification ? (
                                  <p className="mt-0.5 text-xs text-muted-foreground">
                                    {line.specification}
                                  </p>
                                ) : null}
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {[
                                    formatQty(line.quantity, line.unit),
                                    line.labourHours != null
                                      ? `${line.labourHours} labour-hours`
                                      : null,
                                    line.costRate != null
                                      ? `${formatCurrency(line.costRate)}${
                                          line.unit ? `/${line.unit}` : line.labourHours != null ? "/hour" : ""
                                        }`
                                      : null,
                                    line.rateLabel,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </p>
                              </div>
                              <p className="shrink-0 text-sm font-medium">
                                {formatCurrency(line.recommendedCost)}
                              </p>
                            </div>
                            {cat.id === "MATERIALS" && onChangeMaterial ? (
                              <button
                                type="button"
                                className="mt-2 text-xs font-medium text-muted-foreground underline-offset-4 hover:underline"
                                data-builder-review-change-material
                                onClick={() =>
                                  onChangeMaterial(wa.workAreaId)
                                }
                              >
                                Change material
                              </button>
                            ) : null}
                          </li>
                        ))}
                      </ul>

                      {cat.takeoff.length > 0 ? (
                        <div
                          className="rounded-lg border border-dashed border-border/70 px-3 py-2.5"
                          data-builder-review-takeoff
                          data-commercial="false"
                        >
                          <p className="text-xs font-medium text-foreground">
                            Recommended takeoff
                          </p>
                          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                            {cat.takeoff[0]?.parentAllowanceHint}
                          </p>
                          <ul className="mt-2 space-y-1.5">
                            {cat.takeoff.map((row) => (
                              <li
                                key={row.requirementId}
                                className="flex items-baseline justify-between gap-2 text-xs"
                                data-takeoff-row={row.componentKey}
                              >
                                <span>
                                  {row.label}
                                  {row.specification
                                    ? ` · ${row.specification}`
                                    : ""}
                                  {row.confidenceLabel ? (
                                    <span className="mt-0.5 block text-[10px] text-muted-foreground">
                                      {row.confidenceLabel}
                                    </span>
                                  ) : null}
                                </span>
                                <span className="shrink-0 font-medium">
                                  {formatQty(row.quantity, row.unit)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </section>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {(view.assumptions.length > 0 || view.checks.length > 0) ? (
        <div
          className="space-y-3 rounded-xl border border-border/60 px-4 py-4"
          data-builder-review-issues
        >
          {view.assumptions.length > 0 ? (
            <div data-builder-review-assumptions>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Assumptions
              </p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {view.assumptions.map((item) => (
                  <li key={item.id} className="flex gap-2">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Assumption
                    </span>
                    <span>{item.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {view.checks.length > 0 ? (
            <div data-builder-review-checks>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Checks
              </p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {view.checks.slice(0, 5).map((item) => (
                  <li key={item.id}>{item.label}</li>
                ))}
              </ul>
              {view.checks.length > 5 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  +{view.checks.length - 5} more in Edit job
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
