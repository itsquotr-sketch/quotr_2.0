"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EstimateCategoryHeader } from "@/components/ui/estimate-category-header";
import { StatusPill } from "@/components/ui/status-pill";
import { formatCurrency } from "@/components/assistant/format";
import { formatLabourHours } from "@/lib/estimate/builder-presentation-format";
import type {
  BuilderReviewImprovement,
  BuilderReviewView,
} from "@/lib/assistant/builder-review";
import { ASSISTANT_ACTION_LABELS } from "@/lib/assistant/presentation/action-labels";
import { presentEstimateGst } from "@/lib/assistant/presentation/gst-display";
import { PrepareFinalPricingButton, OpenFinalPricingLink } from "@/components/pricing/PrepareFinalPricingButton";
import { cn } from "@/lib/utils";

type BuilderReviewSurfaceProps = {
  view: BuilderReviewView;
  isRegenerating?: boolean;
  onBack: () => void;
  onEditJob?: () => void;
  onRefine?: () => void;
  onImprove?: (improvement: BuilderReviewImprovement) => void;
  onUpdateEstimate?: () => void;
  onChangeMaterial?: (workAreaId: string | null) => void;
  projectId?: string;
  estimateId?: string;
  pricingDocumentId?: string | null;
  gstRate?: number | null;
  showContinueToPricing?: boolean;
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
  onImprove,
  onUpdateEstimate,
  onChangeMaterial,
  projectId,
  estimateId,
  pricingDocumentId = null,
  gstRate = null,
  showContinueToPricing = false,
  className,
}: BuilderReviewSurfaceProps) {
  const multi = view.workAreas.length > 1;
  const gst = presentEstimateGst(view.overview.recommendedSell, gstRate);
  const topAssumptions = view.assumptions.slice(0, 3);
  const [openAreas, setOpenAreas] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const wa of view.workAreas) {
      init[wa.workAreaName] = false;
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
          Review estimate
        </p>
      </div>
      <p className="text-sm text-muted-foreground" data-builder-review-purpose>
        Check Quotr’s working estimate before deciding your final price.
      </p>

      {view.overview.isStale ? (
        <div
          className="rounded-xl border border-amber-300/80 bg-amber-50 px-4 py-3 dark:border-amber-800/60 dark:bg-amber-950/40"
          data-builder-review-stale
        >
          <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
            Estimate needs updating
          </p>
          <p className="mt-1 text-xs text-amber-900/90 dark:text-amber-200/90">
            Update this estimate to apply the latest job details and company
            settings.
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
        className="rounded-xl border border-border/60 bg-card px-4 py-3.5"
        data-builder-review-overview
      >
        <div className="space-y-3">
          <div data-builder-review-recommended-sell>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Recommended sell
            </p>
            <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums">
              {formatCurrency(gst.exGst)}{" "}
              {gst.showGst ? (
                <span className="text-sm font-medium text-muted-foreground">
                  ex GST
                </span>
              ) : null}
            </p>
            {gst.showGst ? (
              <p className="mt-1 text-sm" data-builder-review-gst>
                {formatCurrency(gst.inclGst)} incl GST
                <span className="text-muted-foreground">
                  {" "}
                  · {formatCurrency(gst.gstAmount)} GST
                </span>
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm" data-builder-review-cost-margin>
            <span>
              Estimated cost{" "}
              <span className="font-medium tabular-nums">
                {formatCurrency(view.overview.recommendedCost)}
              </span>
            </span>
            <span>
              Target gross margin{" "}
              <span className="font-medium tabular-nums">
                {view.overview.marginPercent.toFixed(1)}%
              </span>
            </span>
          </div>
          {view.overview.marginSourceLabel ? (
            <p className="text-[11px] leading-snug text-muted-foreground">
              {view.overview.marginSourceLabel}
            </p>
          ) : null}
        </div>

        {view.workAreas.length > 0 ? (
          <ul className="mt-3 space-y-1 border-t border-border/40 pt-3 text-sm" data-builder-review-wa-totals>
            {view.workAreas.map((wa) => (
              <li key={wa.workAreaName} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">{wa.workAreaName}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatCurrency(wa.sell)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-foreground/90">
            {view.overview.workAreaNames.join(" · ")}
          </p>
        )}

        {topAssumptions.length > 0 ? (
          <ul className="mt-3 space-y-1 text-sm" data-builder-review-key-assumptions>
            {topAssumptions.map((item) => (
              <li key={item.id} className="text-muted-foreground">
                {item.label}
              </li>
            ))}
          </ul>
        ) : null}

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
          <details className="mt-3" data-builder-review-category-summary>
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
              Cost breakdown
            </summary>
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
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
            <p
              className="mt-2 text-[11px] text-muted-foreground"
              data-builder-review-cost-reconcile={
                view.costReconciles ? "true" : "false"
              }
            >
              {view.costReconciles
                ? "Category totals match estimated cost."
                : "Category totals are approximate — check line items."}
            </p>
          </details>
        ) : null}
      </div>

      {view.improvements.length > 0 ? (
        <div
          className="rounded-xl border border-border/60 px-4 py-4"
          data-builder-review-improve
        >
          <p className="text-sm font-semibold">Improve this estimate</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Helpful details — not errors.
          </p>
          <ul className="mt-3 space-y-2">
            {view.improvements.map((item) => (
              <li key={item.id} className="text-sm">
                    {onImprove ? (
                      <button
                        type="button"
                        className="flex w-full min-h-11 items-center justify-between gap-3 text-left"
                        onClick={() => onImprove(item)}
                        data-builder-review-improve-item
                        aria-label={`Improve: ${item.label}`}
                      >
                        <span className="min-w-0">
                          <span className="font-medium">{item.label}</span>
                          {item.reason ? (
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {item.reason}
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 text-xs font-medium text-muted-foreground">
                          Improve
                        </span>
                      </button>
                    ) : (
                      <span className="font-medium">{item.label}</span>
                    )}
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
                      {formatCurrency(wa.sell)}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(wa.sell)}
                    </p>
                  )}
                  {multi && !open ? (
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {wa.categories
                        .filter((c) => c.cost > 0)
                        .slice(0, 3)
                        .map((c) => `${c.label} ${formatCurrency(c.cost)}`)
                        .join(" · ")}
                    </p>
                  ) : null}
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
                      <EstimateCategoryHeader
                        label={cat.label}
                        amount={cat.cost > 0 ? formatCurrency(cat.cost) : null}
                      />

                      {cat.groupNotes
                        .filter(
                          (note) =>
                            !(
                              note.id === "pile-procurement" &&
                              cat.lineGroups.length > 0
                            )
                        )
                        .map((note) => (
                        <p
                          key={note.id}
                          className="text-xs leading-snug break-words text-muted-foreground"
                          data-builder-review-group-note={note.id}
                        >
                          <span className="font-medium text-foreground">
                            {note.title}.{" "}
                          </span>
                          {note.detail}
                        </p>
                      ))}

                      {cat.lineGroups.map((group) => (
                        <div
                          key={group.id}
                          className="px-0 py-2"
                          data-builder-review-line-group={group.id}
                          data-commercial="true"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 space-y-0.5">
                              <p className="text-sm font-medium leading-snug">
                                {group.label}
                              </p>
                              {group.supporting ? (
                                <p className="text-xs break-words text-muted-foreground">
                                  {group.supporting}
                                </p>
                              ) : null}
                              {group.secondary ? (
                                <p className="text-xs break-words text-muted-foreground">
                                  {group.secondary}
                                </p>
                              ) : null}
                              {group.rateContext ? (
                                <p className="text-[11px] leading-snug break-words text-muted-foreground">
                                  {group.rateContext}
                                </p>
                              ) : null}
                            </div>
                            <p className="shrink-0 text-sm font-semibold tabular-nums">
                              {formatCurrency(group.recommendedCost)}
                            </p>
                          </div>
                          {group.children.length > 0 ? (
                            <details className="group/stock mt-2">
                              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                                Stock breakdown
                              </summary>
                              <ul className="mt-1.5 space-y-1.5">
                                {group.children.map((child) => (
                                  <li
                                    key={child.id}
                                    className="flex items-start justify-between gap-3 text-xs"
                                    data-builder-review-stock-sku={
                                      child.itemKey ?? child.id
                                    }
                                  >
                                    <span className="min-w-0 break-words">
                                      <span className="font-medium">
                                        {child.label}
                                      </span>
                                      {child.quantity != null ? (
                                        <span className="mt-0.5 block text-muted-foreground">
                                          {formatQty(child.quantity, child.unit)}
                                          {child.costRate != null
                                            ? ` · ${formatCurrency(child.costRate)}${
                                                child.unit ? `/${child.unit}` : ""
                                              } · ${child.rateLabel}`
                                            : ""}
                                        </span>
                                      ) : null}
                                      {child.rateContext ? (
                                        <span className="mt-0.5 block text-[11px] text-muted-foreground">
                                          {child.rateContext}
                                        </span>
                                      ) : null}
                                    </span>
                                    <span className="shrink-0 font-medium tabular-nums">
                                      {formatCurrency(child.recommendedCost)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </details>
                          ) : null}
                          {group.showChangeMaterial &&
                          onChangeMaterial &&
                          (wa.workAreaType === "deck" ||
                            wa.workAreaType === "retaining_wall") ? (
                            <button
                              type="button"
                              className="mt-2 text-xs font-medium text-muted-foreground underline-offset-4 hover:underline"
                              data-builder-review-change-material
                              onClick={() => onChangeMaterial(wa.workAreaId)}
                            >
                              Change material
                            </button>
                          ) : null}
                        </div>
                      ))}

                      <ul className="space-y-1.5">
                        {cat.lines.map((line) => {
                          const pricingRequired =
                            cat.id === "PRICING_REQUIRED" ||
                            line.rateLabel === "Rate required";
                          const labour = cat.id === "LABOUR";
                          return (
                          <li
                            key={line.id}
                            className="px-0 py-2"
                            data-builder-review-line={line.itemKey ?? line.id}
                            data-commercial="true"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 space-y-0.5">
                                <p className="text-sm font-medium leading-snug">
                                  {line.label}
                                </p>
                                {line.isAllowance && !line.quantityFallback ? (
                                  <StatusPill tone="neutral">
                                    Allowance — budgeted amount included in the price
                                  </StatusPill>
                                ) : null}
                                {line.quantityFallback ? (
                                  <div
                                    className="space-y-0.5"
                                    data-quantity-fallback={line.quantityFallback.kind}
                                    data-fallback-label={line.quantityFallback.label}
                                  >
                                    <StatusPill
                                      tone={
                                        line.quantityFallback.kind === "physical_allowance"
                                          ? "warning"
                                          : "neutral"
                                      }
                                    >
                                      {line.quantityFallback.label}
                                    </StatusPill>
                                    <p className="text-xs break-words text-muted-foreground">
                                      {line.quantityFallback.reason}
                                    </p>
                                    {line.quantityFallback.confirmHint ? (
                                      <p className="text-xs break-words text-muted-foreground">
                                        {line.quantityFallback.confirmHint}
                                      </p>
                                    ) : null}
                                  </div>
                                ) : null}
                                {line.supporting ? (
                                  <p className="text-xs break-words text-muted-foreground">
                                    {line.supporting}
                                  </p>
                                ) : null}
                                {labour &&
                                (line.labourRateLabel || line.productivityLabel) ? (
                                  <p
                                    className="text-xs text-muted-foreground"
                                    data-builder-review-labour-provenance
                                  >
                                    {line.labourRateLabel ? (
                                      <span data-labour-rate-source={line.labourRateLabel}>
                                        Labour rate: {line.labourRateLabel}
                                      </span>
                                    ) : null}
                                    {line.labourRateLabel && line.productivityLabel
                                      ? " · "
                                      : null}
                                    {line.productivityLabel ? (
                                      <span data-productivity-source={line.productivityLabel}>
                                        Productivity: {line.productivityLabel}
                                      </span>
                                    ) : null}
                                  </p>
                                ) : null}
                                {line.rateContext ? (
                                  <p className="text-[11px] leading-snug break-words text-muted-foreground">
                                    {line.rateContext}
                                  </p>
                                ) : null}
                                {line.pricingHelper ? (
                                  <p className="text-xs break-words text-muted-foreground">
                                    {line.pricingHelper}
                                  </p>
                                ) : null}
                                {line.detail ? (
                                  <details className="text-xs text-muted-foreground">
                                    <summary className="cursor-pointer">
                                      {labour ? "Calculation details" : "Details"}
                                    </summary>
                                    <p className="mt-1 break-words">{line.detail}</p>
                                  </details>
                                ) : null}
                              </div>
                              {pricingRequired ? (
                                <p className="max-w-[42%] shrink-0 text-right text-xs font-medium text-foreground break-words">
                                  {/spoil/i.test(line.label)
                                    ? "Price required"
                                    : "Needs a trusted price"}
                                </p>
                              ) : (
                                <div className="shrink-0 text-right">
                                  {labour && line.labourHours != null ? (
                                    <p
                                      className="text-xs tabular-nums text-muted-foreground"
                                      aria-label={`${formatLabourHours(line.labourHours)} labour-hours`}
                                    >
                                      {formatLabourHours(line.labourHours)} h
                                    </p>
                                  ) : null}
                                  <p className="text-sm font-semibold tabular-nums">
                                    {formatCurrency(line.recommendedCost)}
                                  </p>
                                </div>
                              )}
                            </div>
                            {(cat.id === "MATERIALS" ||
                              cat.id === "PRICING_REQUIRED") &&
                            onChangeMaterial &&
                            (wa.workAreaType === "deck" ||
                              wa.workAreaType === "retaining_wall") ? (
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
                          );
                        })}
                      </ul>

                      {cat.takeoff.length > 0 || cat.takeoffUnavailableHint ? (
                        <details
                          className="rounded-lg border border-dashed border-border/70 px-3 py-2.5"
                          data-builder-review-takeoff
                          data-commercial="false"
                          data-takeoff-collapsed={
                            cat.takeoffCollapsedByDefault ? "true" : "false"
                          }
                          open={!cat.takeoffCollapsedByDefault}
                        >
                          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                            {cat.takeoffTitle}
                            {cat.takeoff.length > 0 ? (
                              <span className="mt-0.5 block font-normal">
                                {cat.takeoff
                                  .filter((row) =>
                                    /wall face|piles|pile length/i.test(row.label)
                                  )
                                  .slice(0, 3)
                                  .map(
                                    (row) =>
                                      `${row.label} ${formatQty(row.quantity, row.unit)}`
                                  )
                                  .join(" · ")}
                              </span>
                            ) : null}
                          </summary>
                          {cat.takeoff.length > 0 && wa.workAreaType === "deck" ? (
                            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                              {cat.takeoff[0]?.parentAllowanceHint ??
                                "Planning quantities are included within the framing/substructure allowance and are not priced separately."}
                            </p>
                          ) : null}
                          {cat.takeoff.length === 0 && cat.takeoffUnavailableHint ? (
                            <p
                              className="mt-1 text-[11px] leading-snug text-muted-foreground"
                              data-takeoff-unavailable
                            >
                              {cat.takeoffUnavailableHint}
                            </p>
                          ) : null}
                          {cat.takeoffDisclaimer ? (
                            <p
                              className="mt-1 text-[11px] leading-snug text-muted-foreground"
                              data-takeoff-disclaimer
                            >
                              {cat.takeoffDisclaimer}
                            </p>
                          ) : null}
                          {cat.takeoff.length > 0 ? (
                            <ul className="mt-2 space-y-1.5">
                              {cat.takeoff.map((row) => (
                                <li
                                  key={row.requirementId}
                                  className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-xs"
                                  data-takeoff-row={row.componentKey}
                                >
                                  <span className="min-w-0">
                                    <span className="font-medium">{row.label}</span>
                                    {row.detail ? (
                                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                                        {row.detail}
                                      </span>
                                    ) : null}
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
                          ) : null}
                        </details>
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
          className="space-y-2 rounded-xl border border-border/60 px-4 py-3"
          data-builder-review-issues
        >
          {view.assumptions.length > 0 ? (
            <details data-builder-review-assumptions className="group">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium marker:content-none [&::-webkit-details-marker]:hidden">
                Assumptions ({view.assumptions.length})
                <ChevronDown className="size-4 text-muted-foreground group-open:rotate-180 motion-safe:transition-transform" />
              </summary>
              <ul className="mt-1 space-y-1.5 pb-1 text-sm">
                {view.assumptions.map((item) => (
                  <li key={item.id} className="flex gap-2">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Assumption
                    </span>
                    <span>{item.label}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          {view.checks.length > 0 ? (
            <details data-builder-review-checks className="group">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium marker:content-none [&::-webkit-details-marker]:hidden">
                Checks ({view.checks.length})
                <ChevronDown className="size-4 text-muted-foreground group-open:rotate-180 motion-safe:transition-transform" />
              </summary>
              <ul className="mt-1 space-y-1.5 pb-1 text-sm">
                {view.checks.slice(0, 5).map((item) => (
                  <li key={item.id}>{item.label}</li>
                ))}
              </ul>
              {view.checks.length > 5 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  +{view.checks.length - 5} more in Edit job
                </p>
              ) : null}
            </details>
          ) : null}
        </div>
      ) : null}

      <div
        className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"
        data-builder-review-cta
      >
        {showContinueToPricing && projectId && !view.overview.isStale ? (
          <PrepareFinalPricingButton
            projectId={projectId}
            estimateId={estimateId}
            className="h-11 min-h-11 w-full sm:w-auto"
            label={ASSISTANT_ACTION_LABELS.continueToPricing}
          />
        ) : null}
        {pricingDocumentId && projectId && !view.overview.isStale ? (
          <div className="w-full sm:w-auto" data-builder-review-open-pricing>
            <OpenFinalPricingLink
              projectId={projectId}
              pricingDocumentId={pricingDocumentId}
            />
          </div>
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
      <p className="text-xs text-muted-foreground">
        To change these numbers, edit the job and update the estimate. Pricing
        is where you set the final price.
      </p>
    </section>
  );
}
