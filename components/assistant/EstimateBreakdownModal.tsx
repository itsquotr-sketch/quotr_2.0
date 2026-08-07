"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import {
  formatCurrency,
  formatCurrencyRange,
  formatPercent,
} from "@/components/assistant/format";
import { Badge } from "@/components/ui/badge";
import { RateSourceBadge } from "@/components/assistant/EstimateCalibrationPanel";
import { PricingOwnershipBadge } from "@/components/pricing/PricingOwnershipBadge";
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
import { defaultedFactWarnings } from "@/lib/estimate/assumption-metadata";
import {
  presentEstimateCategoryTotals,
  presentEstimateWorkAreaTotals,
} from "@/lib/estimate/presentation-breakdown";
import { estimateDocumentViewModel, estimateLineViewModel } from "@/lib/estimate/financial-view-model";
import { formatProfitabilityDisplay } from "@/lib/financial-presentation/format";
import { buildEstimateCalibrationSummary } from "@/lib/estimate/estimate-calibration";
import {
  getCommercialTrustDetailLines,
  lineItemRenderKey,
} from "@/lib/estimate/commercial-realism";
import { ASSISTANT_ACTION_LABELS } from "@/lib/assistant/presentation/action-labels";
import { listManualScopeItemsForProject } from "@/lib/work-areas/scope-items/actions";
import { SCOPE_DISCOVERY_UI_COPY } from "@/lib/scope-discovery/ui/labels";

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

function includedItems(items: EstimateLineItem[]) {
  return items.filter((item) => item.includedInTotal !== false);
}

function groupByWorkArea(
  items: EstimateLineItem[],
  confirmedNames?: readonly string[]
) {
  const confirmed = confirmedNames
    ? new Set(
        confirmedNames.map((n) => n.trim().toLowerCase()).filter(Boolean)
      )
    : null;
  return includedItems(items).reduce<Record<string, EstimateLineItem[]>>(
    (acc, item) => {
      const raw = item.workAreaName?.trim() || "";
      let name: string;
      if (!raw) {
        name = "Unallocated";
      } else if (
        confirmed &&
        confirmed.size > 0 &&
        !confirmed.has(raw.toLowerCase())
      ) {
        name = "Unallocated";
      } else {
        name = raw;
      }
      if (!acc[name]) acc[name] = [];
      acc[name].push(item);
      return acc;
    },
    {}
  );
}

function sumByCategory(items: EstimateLineItem[]) {
  const splitTotals = presentEstimateCategoryTotals(includedItems(items));

  const totals: Partial<
    Record<
      EstimateLineItemCategory,
      { cost: number; sell: number; profit: number; hours: number }
    >
  > = {};

  for (const [category, value] of Object.entries(splitTotals)) {
    if (!value) continue;
    const mapped =
      category === "mixed"
        ? ("allowance" as EstimateLineItemCategory)
        : (category as EstimateLineItemCategory);
    if (!totals[mapped]) {
      totals[mapped] = { cost: 0, sell: 0, profit: 0, hours: 0 };
    }
    totals[mapped]!.cost += value.cost;
    totals[mapped]!.sell += value.sell;
    totals[mapped]!.profit += value.profit;
  }

  for (const item of includedItems(items)) {
    if (item.category !== "labour") continue;
    totals.labour ??= { cost: 0, sell: 0, profit: 0, hours: 0 };
    totals.labour.hours += item.labourHours ?? 0;
  }

  return totals;
}

function sumWorkAreaTotals(
  items: EstimateLineItem[],
  confirmedNames?: readonly string[]
) {
  return presentEstimateWorkAreaTotals(includedItems(items), {
    confirmedWorkAreaNames: confirmedNames,
  });
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
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    overview: true,
    confirmed: true,
    commercial: true,
  });

  const toggle = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const sections: {
    key: string;
    title: string;
    defaultOpen: boolean;
    empty?: boolean;
    body: ReactNode;
  }[] = [
    {
      key: "overview",
      title: "Overview",
      defaultOpen: true,
      body: (
        <>
          {workArea.summary ? (
            <p className="break-words text-sm text-muted-foreground">
              {workArea.summary}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No overview text.</p>
          )}
        </>
      ),
    },
    {
      key: "confirmed",
      title: "Confirmed scope",
      defaultOpen: true,
      empty: !(workArea.includedScopeItems && workArea.includedScopeItems.length),
      body: (
        <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
          {(workArea.includedScopeItems ?? []).map((item) => (
            <li key={item.id}>{item.label}</li>
          ))}
        </ul>
      ),
    },
    {
      key: "quantities",
      title: "Quantities and measurements",
      defaultOpen: false,
      empty: !workArea.summary,
      body: (
        <p className="text-sm text-muted-foreground">
          Measurement drivers appear in Scope Details and Estimate Review. Line
          quantities are listed under Commercial breakdown.
        </p>
      ),
    },
    {
      key: "assumptions",
      title: "Assumptions",
      defaultOpen: false,
      empty: !(workArea.assumptions && workArea.assumptions.length),
      body: (
        <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
          {(workArea.assumptions ?? []).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ),
    },
    {
      key: "optional",
      title: "Optional items",
      defaultOpen: false,
      empty: !(
        workArea.includedScopeItems &&
        workArea.includedScopeItems.some((i) => i.status === "assumption")
      ),
      body: (
        <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
          {(workArea.includedScopeItems ?? [])
            .filter((i) => i.status === "assumption")
            .map((item) => (
              <li key={item.id}>{item.label}</li>
            ))}
        </ul>
      ),
    },
    {
      key: "not_required",
      title: "Not required",
      defaultOpen: false,
      empty: !(workArea.excludedScopeItems && workArea.excludedScopeItems.length),
      body: (
        <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
          {(workArea.excludedScopeItems ?? []).map((item) => (
            <li key={item.id}>{item.label}</li>
          ))}
        </ul>
      ),
    },
    {
      key: "outstanding",
      title: "Outstanding information",
      defaultOpen: false,
      empty: !(workArea.missingInfo && workArea.missingInfo.length),
      body: (
        <ul className="list-inside list-disc space-y-1 text-sm text-amber-900 dark:text-amber-200">
          {(workArea.missingInfo ?? []).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ),
    },
  ];

  return (
    <div className="rounded-2xl border bg-muted/20 px-4 py-3">
      <p className="text-sm font-semibold">{workArea.name}</p>
      <div className="mt-3 space-y-2">
        {sections.map((section) => {
          if (section.empty) return null;
          const open = openSections[section.key] ?? section.defaultOpen;
          return (
            <div
              key={section.key}
              className="rounded-lg border border-border/50 bg-background/50"
            >
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
                aria-expanded={open}
                onClick={() => toggle(section.key)}
              >
                <span className="text-xs font-semibold">{section.title}</span>
                <ChevronDown
                  className={cn(
                    "size-3.5 text-muted-foreground transition-transform",
                    open && "rotate-180"
                  )}
                  aria-hidden
                />
              </button>
              {open ? (
                <div className="border-t border-border/40 px-3 py-2">
                  {section.body}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
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
  const trustDetailLines = getCommercialTrustDetailLines({
    quantityBasis: item.quantityBasis,
    labourMinimum: item.labourMinimum,
    allowanceMinimum: item.allowanceMinimum,
    pricingOwner: item.pricingOwner,
    notes: item.notes,
  });
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
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <RateSourceBadge source={item.rateSource} />
            <PricingOwnershipBadge
              owner={item.pricingOwner}
              includedInTotal={item.includedInTotal}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="w-fit shrink-0">
            {CATEGORY_LABELS[item.category]}
          </Badge>
        </div>
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
          <dd className="font-medium">
            {estimateLineViewModel(item).profitLabel}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Margin</dt>
          <dd className="font-medium">
            {estimateLineViewModel(item).marginLabel}
          </dd>
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

      {trustDetailLines.length > 0 ? (
        <div className="mt-3 space-y-1 rounded-xl border border-dashed bg-background/60 px-3 py-2.5">
          <p className="text-xs font-medium text-muted-foreground">
            Commercial detail
          </p>
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {trustDetailLines.map((line) => (
              <li key={line}>{line}</li>
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
  projectId?: string;
};

export function EstimateBreakdownModal({
  estimate,
  open,
  onOpenChange,
  onRegenerate,
  isRegenerating,
  projectId,
}: EstimateBreakdownModalProps) {
  const [activeTab, setActiveTab] = useState<BreakdownTab>("summary");
  const [expandedWorkArea, setExpandedWorkArea] = useState<string | null>(null);
  const [manualScopeByWa, setManualScopeByWa] = useState<
    Record<string, { title: string }[]>
  >({});

  useEffect(() => {
    if (!open || !projectId) return;
    let cancelled = false;
    void listManualScopeItemsForProject(projectId).then((result) => {
      if (cancelled || !result.ok) return;
      const next: Record<string, { title: string }[]> = {};
      for (const item of result.items) {
        if (item.state !== "INCLUDED") continue;
        const list = next[item.workAreaId] ?? [];
        list.push({ title: item.title });
        next[item.workAreaId] = list;
      }
      setManualScopeByWa(next);
    });
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  const confirmedWorkAreaNames = useMemo(
    () => estimate?.includedWorkAreas.map((wa) => wa.name) ?? [],
    [estimate]
  );

  const groupedLineItems = useMemo(
    () =>
      estimate
        ? Object.entries(
            groupByWorkArea(estimate.lineItems, confirmedWorkAreaNames)
          )
        : [],
    [estimate, confirmedWorkAreaNames]
  );

  const categoryTotals = useMemo(
    () => (estimate ? sumByCategory(estimate.lineItems) : {}),
    [estimate]
  );

  const workAreaTotals = useMemo(
    () =>
      estimate
        ? sumWorkAreaTotals(estimate.lineItems, confirmedWorkAreaNames)
        : [],
    [estimate, confirmedWorkAreaNames]
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
                  {isRegenerating ? "Recalculating…" : ASSISTANT_ACTION_LABELS.recalculateEstimate}
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
                    value={estimateDocumentViewModel(estimate).profitLabel}
                  />
                  <SummaryMetric
                    label="Margin"
                    value={estimateDocumentViewModel(estimate).marginLabel}
                  />
                  {estimate.markupPercent != null ? (
                    <SummaryMetric
                      label="Markup"
                      value={
                        estimateDocumentViewModel(estimate).markupLabel ??
                        formatPercent(estimate.markupPercent)
                      }
                    />
                  ) : null}
                  <SummaryMetric
                    label="Estimate confidence"
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

              <section className="space-y-3">
                <h3 className="text-sm font-semibold tracking-tight">
                  Scope and quantity drivers
                </h3>
                <p className="text-xs text-muted-foreground">
                  Values below come from confirmed work areas, user answers,
                  and deterministic calculations. Money totals use server
                  commercial results — nothing is recalculated in this dialog.
                </p>
                <div className="space-y-3">
                  {estimate.includedWorkAreas.map((wa) => (
                    <div
                      key={wa.id}
                      className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5"
                    >
                      <p className="text-sm font-medium">{wa.name}</p>
                      {wa.includedScopeItems &&
                      wa.includedScopeItems.length > 0 ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Included:{" "}
                          {wa.includedScopeItems
                            .map((item) => item.label)
                            .join(", ")}
                        </p>
                      ) : null}
                      {wa.excludedScopeItems &&
                      wa.excludedScopeItems.length > 0 ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Not required:{" "}
                          {wa.excludedScopeItems
                            .map((item) => item.label)
                            .join(", ")}
                        </p>
                      ) : null}
                      {(manualScopeByWa[wa.id] ?? []).length > 0 ? (
                        <p className="mt-1 text-xs text-amber-900 dark:text-amber-200">
                          Added by you ({SCOPE_DISCOVERY_UI_COPY.pricingRequired}
                          ):{" "}
                          {(manualScopeByWa[wa.id] ?? [])
                            .map((item) => item.title)
                            .join(", ")}
                        </p>
                      ) : null}
                      {wa.assumptions && wa.assumptions.length > 0 ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Assumptions: {wa.assumptions.join("; ")}
                        </p>
                      ) : null}
                      {wa.missingInfo && wa.missingInfo.length > 0 ? (
                        <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
                          Unresolved: {wa.missingInfo.join("; ")}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
                {estimate.scopeAssumptions.length > 0 ? (
                  <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
                    {estimate.scopeAssumptions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold tracking-tight">
                  Assumptions
                </h3>
                {estimate.assumptionMetadata?.assumptionSeverity === "critical" ? (
                  <div
                    className="rounded-md border border-amber-300/80 bg-amber-50/90 px-3 py-2 text-sm text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100"
                    role="alert"
                  >
                    <p className="font-medium">
                      Critical dimensions were assumed — confirm before pricing.
                    </p>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
                      {defaultedFactWarnings(estimate.assumptionMetadata).map(
                        (item) => (
                          <li key={item}>{item}</li>
                        )
                      )}
                    </ul>
                  </div>
                ) : null}
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
                            <strong>
                              {
                                formatProfitabilityDisplay({
                                  costKnown: area.costKnown,
                                  grossProfit: area.profit,
                                  marginPercent: area.marginPercent,
                                }).profitLabel
                              }
                            </strong>
                          </span>
                          <span>
                            Margin:{" "}
                            <strong>
                              {
                                formatProfitabilityDisplay({
                                  costKnown: area.costKnown,
                                  grossProfit: area.profit,
                                  marginPercent: area.marginPercent,
                                }).marginLabel
                              }
                            </strong>
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
                      <div className="space-y-3 border-t px-4 py-3">
                        {(() => {
                          const wa = estimate.includedWorkAreas.find(
                            (w) => w.name === area.name
                          );
                          return wa ? <WorkAreaScopeSection workArea={wa} /> : null;
                        })()}
                        <div className="rounded-lg border border-border/50">
                          <p className="border-b border-border/40 px-3 py-2 text-xs font-semibold">
                            Commercial breakdown
                          </p>
                          <ul className="space-y-2 px-3 py-3">
                            {area.items.map((item, index) => (
                              <LineItemCard
                                key={lineItemRenderKey(item, index)}
                                item={item}
                                compact
                              />
                            ))}
                          </ul>
                        </div>
                        {area.items.some((i) => i.category === "allowance") ? (
                          <p className="text-xs text-muted-foreground">
                            Allowances are labelled in each line item category
                            badge.
                          </p>
                        ) : null}
                      </div>
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
              {groupedLineItems.map(([workAreaName, items]) => (
                <section key={workAreaName} className="space-y-3">
                  <h3 className="text-sm font-semibold tracking-tight">
                    {workAreaName}
                  </h3>
                  <ul className="space-y-3">
                    {items.map((item, index) => (
                      <LineItemCard
                        key={lineItemRenderKey(item, index)}
                        item={item}
                      />
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
