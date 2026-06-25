"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import {
  formatCurrency,
  formatCurrencyRange,
  formatPercent,
} from "@/components/assistant/format";
import { Badge } from "@/components/ui/badge";
import { RateSourceBadge } from "@/components/assistant/EstimateCalibrationPanel";
import type {
  Estimate,
  EstimateLineItem,
  EstimateLineItemCategory,
  WorkArea,
} from "@/components/assistant/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { buildEstimateCalibrationSummary } from "@/lib/estimate/estimate-calibration";

const CATEGORY_LABELS: Record<EstimateLineItemCategory, string> = {
  labour: "Labour",
  materials: "Materials",
  subcontractor: "Subcontractor",
  allowance: "Allowance",
  contingency: "Contingency",
};

const CATEGORY_ORDER: EstimateLineItemCategory[] = [
  "labour",
  "materials",
  "subcontractor",
  "allowance",
  "contingency",
];

const CATEGORY_BAR_COLORS: Record<EstimateLineItemCategory, string> = {
  labour: "bg-blue-500",
  materials: "bg-emerald-500",
  subcontractor: "bg-violet-500",
  allowance: "bg-amber-500",
  contingency: "bg-slate-400",
};

type BreakdownTab = "summary" | "work_areas" | "categories" | "line_items";

const TABS: { id: BreakdownTab; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "work_areas", label: "By work area" },
  { id: "categories", label: "By category" },
  { id: "line_items", label: "Line items" },
];

function groupByWorkArea(items: EstimateLineItem[]) {
  return items.reduce<Record<string, EstimateLineItem[]>>((acc, item) => {
    if (!acc[item.workAreaName]) acc[item.workAreaName] = [];
    acc[item.workAreaName].push(item);
    return acc;
  }, {});
}

function sumByCategory(items: EstimateLineItem[]) {
  const totals: Partial<
    Record<
      EstimateLineItemCategory,
      { cost: number; sell: number; profit: number; hours: number }
    >
  > = {};

  for (const item of items) {
    if (!totals[item.category]) {
      totals[item.category] = { cost: 0, sell: 0, profit: 0, hours: 0 };
    }
    totals[item.category]!.cost += item.recommendedCost;
    totals[item.category]!.sell += item.recommendedSell;
    totals[item.category]!.profit += item.grossProfit;
    totals[item.category]!.hours += item.labourHours ?? 0;
  }

  return totals;
}

function sumWorkAreaTotals(items: EstimateLineItem[]) {
  const byArea = groupByWorkArea(items);
  return Object.entries(byArea).map(([name, areaItems]) => ({
    name,
    cost: areaItems.reduce((sum, item) => sum + item.recommendedCost, 0),
    sell: areaItems.reduce((sum, item) => sum + item.recommendedSell, 0),
    profit: areaItems.reduce((sum, item) => sum + item.grossProfit, 0),
    hours: areaItems.reduce((sum, item) => sum + (item.labourHours ?? 0), 0),
    lineItemCount: areaItems.length,
    marginPercent:
      areaItems.reduce((sum, item) => sum + item.recommendedSell, 0) > 0
        ? (areaItems.reduce((sum, item) => sum + item.grossProfit, 0) /
            areaItems.reduce((sum, item) => sum + item.recommendedSell, 0)) *
          100
        : 0,
    items: areaItems,
  }));
}

function ProportionalBar({
  segments,
  className,
}: {
  segments: { label: string; value: number; colorClass: string }[];
  className?: string;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (total <= 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <div
        className="flex h-3 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label="Proportional breakdown"
      >
        {segments.map((segment) =>
          segment.value > 0 ? (
            <div
              key={segment.label}
              className={cn("h-full min-w-[2px]", segment.colorClass)}
              style={{ width: `${(segment.value / total) * 100}%` }}
              title={`${segment.label}: ${formatCurrency(segment.value)}`}
            />
          ) : null
        )}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {segments.map((segment) =>
          segment.value > 0 ? (
            <span key={segment.label} className="inline-flex items-center gap-1">
              <span
                className={cn("inline-block size-2 rounded-full", segment.colorClass)}
              />
              {segment.label} {formatCurrency(segment.value)}
            </span>
          ) : null
        )}
      </div>
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  prominent,
}: {
  label: string;
  value: string;
  prominent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl border bg-muted/30 px-3 py-2.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-medium leading-snug",
          prominent ? "text-lg" : "text-sm"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function WorkAreaScopeSection({ workArea }: { workArea: WorkArea }) {
  return (
    <div className="rounded-2xl border bg-muted/20 px-4 py-3">
      <p className="text-sm font-semibold">{workArea.name}</p>
      {workArea.summary ? (
        <p className="mt-1 break-words text-sm text-muted-foreground">
          {workArea.summary}
        </p>
      ) : null}
    </div>
  );
}

function LineItemCard({
  item,
  compact = false,
}: {
  item: EstimateLineItem;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const materialBuildUpLines =
    item.materialBuildUps?.flatMap((buildUp) => {
      const lines = [buildUp.display];
      if (buildUp.basis) {
        lines.push(buildUp.basis);
      }
      const boardWidthMm = buildUp.inputs?.boardWidthMm;
      if (typeof boardWidthMm === "number") {
        lines.push(`Board width: ${boardWidthMm}mm`);
      }
      const areaM2 = buildUp.inputs?.areaM2;
      if (
        typeof areaM2 === "number" &&
        buildUp.buildUpType === "decking_boards_lm"
      ) {
        lines.push(`Deck area: ${areaM2}m²`);
      }
      if (
        buildUp.wastagePercent != null &&
        !buildUp.display.toLowerCase().includes("wastage")
      ) {
        lines.push(`Wastage: ${buildUp.wastagePercent}%`);
      }
      return lines;
    }) ?? [];

  if (compact && !expanded) {
    return (
      <li className="rounded-xl border bg-muted/15">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2.5 text-left sm:min-h-12"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{item.label}</p>
            <p className="text-xs text-muted-foreground">
              {CATEGORY_LABELS[item.category]} · Sell{" "}
              {formatCurrency(item.recommendedSell)}
            </p>
          </div>
          <ChevronDown className="size-4 shrink-0 -rotate-90 text-muted-foreground" />
        </button>
      </li>
    );
  }

  return (
    <li className="rounded-2xl border bg-muted/20 px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="break-words text-sm font-medium">{item.label}</p>
          <div className="mt-1.5">
            <RateSourceBadge source={item.rateSource} />
          </div>
        </div>
        <Badge variant="secondary" className="w-fit shrink-0">
          {CATEGORY_LABELS[item.category]}
        </Badge>
      </div>

      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {item.quantity != null && item.unit ? (
          <div>
            <dt className="text-xs text-muted-foreground">Quantity</dt>
            <dd className="font-medium">
              {item.quantity} {item.unit}
            </dd>
          </div>
        ) : null}
        {item.productivityRate != null && item.productivityUnit ? (
          <div>
            <dt className="text-xs text-muted-foreground">Productivity</dt>
            <dd className="font-medium">
              {item.productivityRate} hrs/{item.productivityUnit}
            </dd>
          </div>
        ) : null}
        {item.labourHours != null ? (
          <div>
            <dt className="text-xs text-muted-foreground">Labour hours</dt>
            <dd className="font-medium">{item.labourHours} hrs</dd>
          </div>
        ) : null}
        {item.costRate != null ? (
          <div>
            <dt className="text-xs text-muted-foreground">Cost rate</dt>
            <dd className="font-medium">{formatCurrency(item.costRate)}</dd>
          </div>
        ) : null}
        {item.sellRate != null ? (
          <div>
            <dt className="text-xs text-muted-foreground">Charge rate</dt>
            <dd className="font-medium">
              {formatCurrency(item.sellRate)}
              {item.sellDerivedFromMargin ? (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  (from margin)
                </span>
              ) : null}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs text-muted-foreground">Recommended cost</dt>
          <dd className="font-medium">{formatCurrency(item.recommendedCost)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Recommended sell</dt>
          <dd className="font-medium">{formatCurrency(item.recommendedSell)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Gross profit</dt>
          <dd className="font-medium">{formatCurrency(item.grossProfit)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Margin</dt>
          <dd className="font-medium">{formatPercent(item.marginPercent)}</dd>
        </div>
      </dl>

      {item.notes ? (
        <p className="mt-2 break-words text-xs text-muted-foreground">
          {item.notes}
        </p>
      ) : null}

      {materialBuildUpLines.length > 0 ? (
        <div className="mt-3 space-y-1 rounded-xl border border-dashed bg-background/60 px-3 py-2.5">
          <p className="text-xs font-medium text-muted-foreground">
            Material quantities
          </p>
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {materialBuildUpLines.map((line, index) => (
              <li key={`${line}-${index}`}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {compact ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2 h-8 px-2 text-xs"
          onClick={() => setExpanded(false)}
        >
          Collapse
        </Button>
      ) : null}
    </li>
  );
}

type EstimateBreakdownModalProps = {
  estimate: Estimate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
};

export function EstimateBreakdownModal({
  estimate,
  open,
  onOpenChange,
  onRegenerate,
  isRegenerating,
}: EstimateBreakdownModalProps) {
  const [activeTab, setActiveTab] = useState<BreakdownTab>("summary");
  const [expandedWorkArea, setExpandedWorkArea] = useState<string | null>(null);

  const grouped = useMemo(
    () => (estimate ? groupByWorkArea(estimate.lineItems) : {}),
    [estimate]
  );

  const categoryTotals = useMemo(
    () => (estimate ? sumByCategory(estimate.lineItems) : {}),
    [estimate]
  );

  const workAreaTotals = useMemo(
    () => (estimate ? sumWorkAreaTotals(estimate.lineItems) : []),
    [estimate]
  );

  const calibrationSummary = useMemo(
    () =>
      estimate
        ? buildEstimateCalibrationSummary(estimate.lineItems)
        : null,
    [estimate]
  );

  if (!estimate) return null;

  const categoryBarSegments = CATEGORY_ORDER.filter(
    (cat) => categoryTotals[cat]
  ).map((cat) => ({
    label: CATEGORY_LABELS[cat],
    value: categoryTotals[cat]!.cost,
    colorClass: CATEGORY_BAR_COLORS[cat],
  }));

  const workAreaBarSegments = workAreaTotals.map((area, index) => ({
    label: area.name,
    value: area.sell,
    colorClass:
      index % 4 === 0
        ? "bg-blue-500"
        : index % 4 === 1
          ? "bg-emerald-500"
          : index % 4 === 2
            ? "bg-violet-500"
            : "bg-amber-500",
  }));

  const totalCost = estimate.recommendedCost;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[90vh] w-[calc(100%-1rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:w-[92vw] sm:max-w-6xl"
        showCloseButton
      >
        <DialogHeader className="shrink-0 border-b px-4 py-4 sm:px-6">
          <DialogTitle className="text-lg">Estimate breakdown</DialogTitle>
          <DialogDescription>
            Internal estimate review only — not a client quote.
          </DialogDescription>
        </DialogHeader>

        <div className="shrink-0 border-b px-4 sm:px-6">
          <div
            className="-mb-px flex gap-1 overflow-x-auto pb-px"
            role="tablist"
            aria-label="Breakdown sections"
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "shrink-0 rounded-t-lg px-3 py-2.5 text-xs font-medium sm:text-sm",
                  activeTab === tab.id
                    ? "border border-b-background bg-background text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
          {estimate.isStale ? (
            <div
              className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30"
              role="status"
            >
              <p className="text-sm font-medium text-amber-950 dark:text-amber-100">
                Estimate outdated
              </p>
              <p className="mt-1 text-sm text-amber-900 dark:text-amber-200">
                Regenerate to update pricing from the latest scope.
              </p>
              {onRegenerate ? (
                <Button
                  type="button"
                  size="sm"
                  className="mt-3"
                  onClick={onRegenerate}
                  disabled={isRegenerating}
                >
                  {isRegenerating ? "Regenerating…" : "Regenerate estimate"}
                </Button>
              ) : null}
            </div>
          ) : null}

          {activeTab === "summary" ? (
            <div className="space-y-6">
              <section className="space-y-3">
                <h3 className="text-sm font-semibold tracking-tight">
                  Commercial summary
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <SummaryMetric
                    label="Recommended sell"
                    value={formatCurrency(estimate.recommendedSell)}
                    prominent
                  />
                  <SummaryMetric
                    label="Sell range"
                    value={formatCurrencyRange(estimate.sellLow, estimate.sellHigh)}
                  />
                  <SummaryMetric
                    label="Estimated cost"
                    value={formatCurrency(estimate.recommendedCost)}
                  />
                  <SummaryMetric
                    label="Cost range"
                    value={formatCurrencyRange(estimate.costLow, estimate.costHigh)}
                  />
                  <SummaryMetric
                    label="Gross profit"
                    value={formatCurrency(estimate.grossProfit)}
                  />
                  <SummaryMetric
                    label="Margin"
                    value={formatPercent(estimate.marginPercent)}
                  />
                  {estimate.markupPercent != null ? (
                    <SummaryMetric
                      label="Markup"
                      value={formatPercent(estimate.markupPercent)}
                    />
                  ) : null}
                  <SummaryMetric
                    label="Confidence"
                    value={`${estimate.confidence}%`}
                  />
                </div>
              </section>

              {categoryBarSegments.length > 0 ? (
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold tracking-tight">
                    Cost split by category
                  </h3>
                  <ProportionalBar segments={categoryBarSegments} />
                </section>
              ) : null}

              {calibrationSummary ? (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold tracking-tight">
                    Rate source mix
                  </h3>
                  <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <SummaryMetric
                      label="Your rates"
                      value={`${calibrationSummary.userRateCount} items`}
                    />
                    <SummaryMetric
                      label="Benchmark"
                      value={`${calibrationSummary.benchmarkCount} items`}
                    />
                    <SummaryMetric
                      label="Fallback"
                      value={`${calibrationSummary.fallbackCount} items`}
                    />
                    <SummaryMetric
                      label="Missing rates"
                      value={`${calibrationSummary.missingCount} items`}
                    />
                  </dl>
                  {calibrationSummary.missingCount > 0 ? (
                    <Link
                      href="/app/rates"
                      className="inline-block text-xs text-muted-foreground underline-offset-2 hover:underline"
                    >
                      Set your rates
                    </Link>
                  ) : null}
                </section>
              ) : null}

              <section className="space-y-3">
                <h3 className="text-sm font-semibold tracking-tight">
                  Scope included
                </h3>
                <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                  {estimate.includedWorkAreas.map((wa) => (
                    <WorkAreaScopeSection key={wa.id} workArea={wa} />
                  ))}
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold tracking-tight">
                  Assumptions
                </h3>
                <ul className="list-inside list-disc space-y-1 break-words text-sm text-muted-foreground">
                  {estimate.assumptions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold tracking-tight">
                  Missing information
                </h3>
                <ul className="list-inside list-disc space-y-1 break-words text-sm text-muted-foreground">
                  {estimate.missingInfo.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold tracking-tight">
                  Exclusions
                </h3>
                <ul className="list-inside list-disc space-y-1 break-words text-sm text-muted-foreground">
                  {estimate.scopeExclusions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            </div>
          ) : null}

          {activeTab === "work_areas" ? (
            <div className="space-y-5">
              {workAreaBarSegments.length > 0 ? (
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold tracking-tight">
                    Sell by work area
                  </h3>
                  <ProportionalBar segments={workAreaBarSegments} />
                </section>
              ) : null}

              {workAreaTotals.map((area) => {
                const isExpanded = expandedWorkArea === area.name;
                return (
                  <section
                    key={area.name}
                    className="rounded-2xl border bg-muted/10"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedWorkArea(isExpanded ? null : area.name)
                      }
                      className="flex min-h-11 w-full items-start justify-between gap-3 px-4 py-3 text-left sm:min-h-12"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{area.name}</p>
                        <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                          <span>
                            Cost:{" "}
                            <strong>{formatCurrency(area.cost)}</strong>
                          </span>
                          <span>
                            Sell:{" "}
                            <strong>{formatCurrency(area.sell)}</strong>
                          </span>
                          <span>
                            Profit:{" "}
                            <strong>{formatCurrency(area.profit)}</strong>
                          </span>
                          <span>
                            Margin:{" "}
                            <strong>{formatPercent(area.marginPercent)}</strong>
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {area.lineItemCount} line items
                          {area.hours > 0
                            ? ` · ${area.hours.toFixed(1)} labour hrs`
                            : ""}
                        </p>
                      </div>
                      <ChevronDown
                        className={cn(
                          "size-4 shrink-0 text-muted-foreground transition-transform",
                          isExpanded && "rotate-180"
                        )}
                      />
                    </button>

                    {isExpanded ? (
                      <ul className="space-y-2 border-t px-4 py-3">
                        {area.items.map((item) => (
                          <LineItemCard key={item.id} item={item} compact />
                        ))}
                      </ul>
                    ) : null}
                  </section>
                );
              })}
            </div>
          ) : null}

          {activeTab === "categories" ? (
            <div className="space-y-5">
              {categoryBarSegments.length > 0 ? (
                <ProportionalBar segments={categoryBarSegments} />
              ) : null}

              <div className="space-y-3">
                {CATEGORY_ORDER.filter((cat) => categoryTotals[cat]).map(
                  (cat) => {
                    const total = categoryTotals[cat]!;
                    const share =
                      totalCost > 0 ? (total.cost / totalCost) * 100 : 0;
                    return (
                      <div
                        key={cat}
                        className="rounded-2xl border px-4 py-3"
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="text-sm font-semibold">
                            {CATEGORY_LABELS[cat]}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {share.toFixed(0)}% of cost
                          </p>
                        </div>
                        <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                          <span>
                            Cost:{" "}
                            <strong>{formatCurrency(total.cost)}</strong>
                          </span>
                          <span>
                            Sell:{" "}
                            <strong>{formatCurrency(total.sell)}</strong>
                          </span>
                          <span>
                            Profit:{" "}
                            <strong>{formatCurrency(total.profit)}</strong>
                          </span>
                          {cat === "labour" && total.hours > 0 ? (
                            <span>
                              Hours:{" "}
                              <strong>{total.hours.toFixed(1)} hrs</strong>
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              CATEGORY_BAR_COLORS[cat]
                            )}
                            style={{ width: `${Math.min(share, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          ) : null}

          {activeTab === "line_items" ? (
            <div className="space-y-6">
              {Object.entries(grouped).map(([workAreaName, items]) => (
                <section key={workAreaName} className="space-y-3">
                  <h3 className="text-sm font-semibold tracking-tight">
                    {workAreaName}
                  </h3>
                  <ul className="space-y-3">
                    {items.map((item) => (
                      <LineItemCard key={item.id} item={item} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
