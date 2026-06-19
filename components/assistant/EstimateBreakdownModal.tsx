"use client";

import { useMemo } from "react";
import {
  formatCurrency,
  formatCurrencyRange,
  formatPercent,
} from "@/components/assistant/format";
import type {
  Estimate,
  EstimateLineItem,
  EstimateLineItemCategory,
  WorkArea,
} from "@/components/assistant/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

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
      { cost: number; sell: number; profit: number }
    >
  > = {};

  for (const item of items) {
    if (!totals[item.category]) {
      totals[item.category] = { cost: 0, sell: 0, profit: 0 };
    }
    totals[item.category]!.cost += item.recommendedCost;
    totals[item.category]!.sell += item.recommendedSell;
    totals[item.category]!.profit += item.grossProfit;
  }

  return totals;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold tracking-tight">{children}</h3>;
}

function SummaryMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl border bg-muted/30 px-3 py-2.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium leading-snug">{value}</span>
    </div>
  );
}

function WorkAreaScopeSection({ workArea }: { workArea: WorkArea }) {
  return (
    <div className="rounded-2xl border bg-muted/20 px-4 py-3">
      <p className="text-sm font-semibold">{workArea.name}</p>
      {workArea.summary ? (
        <p className="mt-1 text-sm text-muted-foreground break-words">
          {workArea.summary}
        </p>
      ) : null}

      {workArea.includedScopeItems?.length ? (
        <div className="mt-3">
          <p className="text-xs font-medium text-muted-foreground">
            Included scope
          </p>
          <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-sm break-words">
            {workArea.includedScopeItems.map((item) => (
              <li key={item.id}>{item.label}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {workArea.assumptions?.length ? (
        <div className="mt-3">
          <p className="text-xs font-medium text-muted-foreground">
            Assumptions
          </p>
          <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-sm text-muted-foreground break-words">
            {workArea.assumptions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {workArea.missingInfo?.length ? (
        <div className="mt-3">
          <p className="text-xs font-medium text-muted-foreground">
            Missing info
          </p>
          <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-sm text-muted-foreground break-words">
            {workArea.missingInfo.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function LineItemCard({ item }: { item: EstimateLineItem }) {
  return (
    <li className="rounded-2xl border bg-muted/20 px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium break-words">{item.label}</p>
          <p className="mt-1 text-xs text-muted-foreground break-words">
            {item.rateSource}
          </p>
        </div>
        <Badge variant="secondary" className="w-fit shrink-0">
          {CATEGORY_LABELS[item.category]}
        </Badge>
      </div>

      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">Cost range</dt>
          <dd className="font-medium">
            {formatCurrencyRange(item.costLow, item.costHigh)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Sell range</dt>
          <dd className="font-medium">
            {formatCurrencyRange(item.sellLow, item.sellHigh)}
          </dd>
        </div>
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
        <p className="mt-2 text-xs text-muted-foreground break-words">
          {item.notes}
        </p>
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
  const grouped = useMemo(
    () => (estimate ? groupByWorkArea(estimate.lineItems) : {}),
    [estimate]
  );

  const categoryTotals = useMemo(
    () => (estimate ? sumByCategory(estimate.lineItems) : {}),
    [estimate]
  );

  if (!estimate) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[85vh] w-[calc(100%-1rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:w-[90vw] sm:max-w-6xl"
        showCloseButton
      >
        <DialogHeader className="shrink-0 border-b px-4 py-4 sm:px-8">
          <DialogTitle className="text-lg">Estimate breakdown</DialogTitle>
          <DialogDescription>
            Internal estimate review only — not a client quote.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-8">
          <div className="space-y-6">
            {estimate.isStale ? (
              <div
                className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30"
                role="status"
              >
                <p className="text-sm font-medium text-amber-950 dark:text-amber-100">
                  Estimate outdated
                </p>
                <p className="mt-1 text-sm text-amber-900 dark:text-amber-200">
                  This estimate is based on older inputs. Regenerate to update
                  the pricing.
                </p>
                {onRegenerate ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 border-amber-300 bg-white hover:bg-amber-50 dark:border-amber-800 dark:bg-transparent"
                    onClick={onRegenerate}
                    disabled={isRegenerating}
                  >
                    {isRegenerating ? "Regenerating…" : "Regenerate estimate"}
                  </Button>
                ) : null}
              </div>
            ) : null}

            <section className="space-y-3">
              <SectionHeading>Commercial summary</SectionHeading>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryMetric
                  label="Estimated cost range"
                  value={formatCurrencyRange(
                    estimate.costLow,
                    estimate.costHigh
                  )}
                />
                <SummaryMetric
                  label="Sell range"
                  value={formatCurrencyRange(estimate.sellLow, estimate.sellHigh)}
                />
                <SummaryMetric
                  label="Recommended cost"
                  value={formatCurrency(estimate.recommendedCost)}
                />
                <SummaryMetric
                  label="Recommended sell"
                  value={formatCurrency(estimate.recommendedSell)}
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
                <SummaryMetric
                  label="Rate source"
                  value={estimate.rateSourceSummary}
                />
              </div>
            </section>

            <Separator />

            <section className="space-y-3">
              <SectionHeading>Included scope</SectionHeading>
              <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                {estimate.includedWorkAreas.map((wa) => (
                  <WorkAreaScopeSection key={wa.id} workArea={wa} />
                ))}
              </div>
            </section>

            <Separator />

            <section className="space-y-3">
              <SectionHeading>Category totals</SectionHeading>
              <div className="grid gap-2 sm:grid-cols-2">
                {CATEGORY_ORDER.filter((cat) => categoryTotals[cat]).map(
                  (cat) => {
                    const total = categoryTotals[cat]!;
                    return (
                      <div
                        key={cat}
                        className="flex flex-col gap-1 rounded-2xl border px-3 py-2.5 text-sm sm:flex-row sm:items-baseline sm:justify-between"
                      >
                        <span className="font-medium">
                          {CATEGORY_LABELS[cat]}
                        </span>
                        <span className="text-muted-foreground">
                          Cost {formatCurrency(total.cost)} · Sell{" "}
                          {formatCurrency(total.sell)} · Profit{" "}
                          {formatCurrency(total.profit)}
                        </span>
                      </div>
                    );
                  }
                )}
              </div>
            </section>

            <Separator />

            {Object.entries(grouped).map(([workAreaName, items]) => (
              <section key={workAreaName} className="space-y-3">
                <SectionHeading>Line items — {workAreaName}</SectionHeading>
                <ul className="space-y-3">
                  {items.map((item) => (
                    <LineItemCard key={item.id} item={item} />
                  ))}
                </ul>
              </section>
            ))}

            <Separator />

            <section className="space-y-2">
              <SectionHeading>Assumptions</SectionHeading>
              <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground break-words">
                {estimate.assumptions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>

            <section className="space-y-2">
              <SectionHeading>Missing information</SectionHeading>
              <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground break-words">
                {estimate.missingInfo.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>

            <section className="space-y-2">
              <SectionHeading>Exclusions / not priced</SectionHeading>
              <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground break-words">
                {estimate.scopeExclusions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              {estimate.excludedWorkAreas.length > 0 ? (
                <p className="text-sm text-muted-foreground break-words">
                  Excluded work areas:{" "}
                  {estimate.excludedWorkAreas.map((wa) => wa.name).join(", ")}
                </p>
              ) : null}
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
