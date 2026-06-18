"use client";

import { Loader2 } from "lucide-react";
import {
  formatCurrency,
  formatCurrencyRange,
  formatPercent,
} from "@/components/assistant/format";
import type { Estimate } from "@/components/assistant/types";
import type { PanelScopeSummary } from "@/lib/assistant/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type EstimatePanelProps = {
  estimate: Estimate | null;
  isGenerating?: boolean;
  panelScopeSummaries?: PanelScopeSummary[];
  onViewBreakdown?: () => void;
};

function MetricRow({
  label,
  value,
  prominent,
}: {
  label: string;
  value: string;
  prominent?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span
        className={
          prominent
            ? "text-right text-lg font-semibold tracking-tight"
            : "text-right text-sm font-medium"
        }
      >
        {value}
      </span>
    </div>
  );
}

function previewItems(items: string[], limit = 2) {
  const shown = items.slice(0, limit);
  const remaining = items.length - shown.length;
  return { shown, remaining };
}

export function EstimatePanel({
  estimate,
  isGenerating,
  panelScopeSummaries = [],
  onViewBreakdown,
}: EstimatePanelProps) {
  const assumptionPreview = estimate
    ? previewItems(estimate.assumptions)
    : { shown: [], remaining: 0 };
  const missingPreview = estimate
    ? previewItems(estimate.missingInfo)
    : { shown: [], remaining: 0 };

  return (
    <Card className="lg:sticky lg:top-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Quick estimate</CardTitle>
        <CardDescription>
          {estimate
            ? "Draft estimate based on your inputs"
            : "Complete the guided questions to generate a draft quick estimate."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isGenerating ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Generating quick estimate…
          </div>
        ) : !estimate ? (
          <div className="rounded-2xl bg-muted/50 px-4 py-8 text-center">
            <p className="text-sm font-medium">No estimate yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Work through the assistant to unlock a draft range.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3 rounded-2xl bg-muted/40 p-4">
              <MetricRow
                label="Recommended sell"
                value={formatCurrency(estimate.recommendedSell)}
                prominent
              />
              <Separator />
              <MetricRow
                label="Sell range"
                value={formatCurrencyRange(estimate.sellLow, estimate.sellHigh)}
              />
              <MetricRow
                label="Estimated cost"
                value={formatCurrency(estimate.recommendedCost)}
              />
              <MetricRow
                label="Gross profit"
                value={formatCurrency(estimate.grossProfit)}
              />
              <MetricRow
                label="Margin"
                value={formatPercent(estimate.marginPercent)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border px-3 py-2">
                <p className="text-xs text-muted-foreground">Confidence</p>
                <p className="mt-0.5 text-sm font-medium">
                  {estimate.confidence}%
                </p>
              </div>
              <div className="rounded-2xl border px-3 py-2">
                <p className="text-xs text-muted-foreground">Rate source</p>
                <p className="mt-0.5 text-sm font-medium leading-snug">
                  {estimate.rateSourceSummary}
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Internal working estimate — not a client quote.
            </p>

            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Included scope
              </p>
              <ul className="mt-1.5 space-y-1 text-xs">
                {estimate.includedWorkAreas.map((wa) => {
                  const entry = panelScopeSummaries.find(
                    (s) => s.workArea === wa.name
                  );
                  return (
                    <li key={wa.id}>
                      <span className="font-medium">{wa.name}:</span>{" "}
                      <span className="text-muted-foreground">
                        {entry?.summary ?? wa.summary}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Assumptions
              </p>
              <ul className="mt-1.5 list-inside list-disc space-y-1 text-xs text-muted-foreground">
                {assumptionPreview.shown.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              {assumptionPreview.remaining > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  +{assumptionPreview.remaining} more in full breakdown
                </p>
              ) : null}
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Missing info
              </p>
              <ul className="mt-1.5 list-inside list-disc space-y-1 text-xs text-muted-foreground">
                {missingPreview.shown.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              {missingPreview.remaining > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  +{missingPreview.remaining} more in full breakdown
                </p>
              ) : null}
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={onViewBreakdown}
            >
              View full breakdown
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
