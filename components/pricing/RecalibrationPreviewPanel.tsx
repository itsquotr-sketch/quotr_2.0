"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { formatCurrency, formatPercent } from "@/components/assistant/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { applyRecalibration } from "@/lib/pricing/recalibration";
import type { RecalibrationPreview } from "@/lib/pricing/recalibration-helpers";
import type { PricingDocument, PricingItem } from "@/lib/pricing/types";
import { cn } from "@/lib/utils";

type RecalibrationPreviewPanelProps = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  pricingDocumentId: string;
  preview: RecalibrationPreview | null;
  previewLoading: boolean;
  previewError: string | null;
  latestEstimateIsStale: boolean;
  onApplied: (input: { document: PricingDocument; items: PricingItem[] }) => void;
};

const STATUS_LABELS: Record<
  RecalibrationPreview["items"][number]["classification"],
  string
> = {
  unchanged: "Unchanged",
  will_update: "Will update",
  manually_protected: "Manually protected",
  new_item: "New item",
  orphaned: "Orphaned",
};

const STATUS_BADGE_CLASS: Record<
  RecalibrationPreview["items"][number]["classification"],
  string
> = {
  unchanged: "bg-muted text-muted-foreground",
  will_update:
    "bg-amber-100 text-amber-950 dark:bg-amber-950/60 dark:text-amber-100",
  manually_protected:
    "bg-slate-100 text-slate-800 dark:bg-slate-900/60 dark:text-slate-100",
  new_item:
    "bg-sky-100 text-sky-950 dark:bg-sky-950/50 dark:text-sky-100",
  orphaned:
    "bg-orange-100 text-orange-950 dark:bg-orange-950/50 dark:text-orange-100",
};

function formatDifference(before: number | null, after: number | null): string {
  if (before == null || after == null) {
    return "—";
  }
  const diff = after - before;
  if (diff === 0) {
    return formatCurrency(0);
  }
  const prefix = diff > 0 ? "+" : "";
  return `${prefix}${formatCurrency(diff)}`;
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border bg-background px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function PreviewRowCard({
  item,
}: {
  item: RecalibrationPreview["items"][number];
}) {
  return (
    <div className="space-y-2 rounded-lg border bg-background p-3 md:hidden">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium leading-snug">{item.label}</p>
          {item.note ? (
            <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>
          ) : null}
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
            STATUS_BADGE_CLASS[item.classification]
          )}
        >
          {STATUS_LABELS[item.classification]}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Current</p>
          <p className="mt-0.5 font-medium tabular-nums">
            {item.beforeSell != null ? formatCurrency(item.beforeSell) : "—"}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Latest</p>
          <p className="mt-0.5 font-medium tabular-nums">
            {item.afterSell != null ? formatCurrency(item.afterSell) : "—"}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Diff</p>
          <p className="mt-0.5 font-medium tabular-nums">
            {formatDifference(item.beforeSell, item.afterSell)}
          </p>
        </div>
      </div>
    </div>
  );
}

export function RecalibrationPreviewPanel({
  open,
  onClose,
  projectId,
  pricingDocumentId,
  preview,
  previewLoading,
  previewError,
  latestEstimateIsStale,
  onApplied,
}: RecalibrationPreviewPanelProps) {
  const [isApplying, startApply] = useTransition();
  const [applyError, setApplyError] = useState<string | null>(null);

  const handleApply = () => {
    setApplyError(null);
    startApply(async () => {
      const result = await applyRecalibration({ projectId, pricingDocumentId });
      if (result.error) {
        setApplyError(result.error);
        return;
      }
      if (result.document && result.items) {
        onApplied({ document: result.document, items: result.items });
      }
    });
  };

  const error = previewError ?? applyError;
  const hasManualProtected = (preview?.summary.manuallyProtected ?? 0) > 0;
  const hasOrphaned = (preview?.summary.orphaned ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton
        className="flex w-[calc(100%-1.5rem)] max-h-[min(92vh,900px)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:w-[min(calc(100vw-2rem),960px)] sm:max-w-5xl"
      >
        <DialogHeader className="shrink-0 border-b px-4 py-4 sm:px-6">
          <DialogTitle className="text-lg">Recalibration preview</DialogTitle>
          <DialogDescription>
            Compare current final pricing with the latest estimate before
            updating.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 max-h-[75vh]">
          {previewLoading ? (
            <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading preview…
            </div>
          ) : null}

          {error ? (
            <p className="mb-4 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          {preview && !previewLoading ? (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                <SummaryCard label="New items" value={preview.summary.newItems} />
                <SummaryCard
                  label="Items to update"
                  value={preview.summary.willUpdate}
                />
                <SummaryCard
                  label="Manually protected"
                  value={preview.summary.manuallyProtected}
                />
                <SummaryCard
                  label="Orphaned items"
                  value={preview.summary.orphaned}
                />
                <SummaryCard
                  label="Unchanged"
                  value={preview.summary.unchanged}
                />
              </div>

              <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Current pricing subtotal
                  </p>
                  <p className="mt-1 text-base font-semibold tabular-nums">
                    {formatCurrency(preview.currentPricingSubtotalSell)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Latest estimate subtotal
                  </p>
                  <p className="mt-1 text-base font-semibold tabular-nums">
                    {formatCurrency(preview.latestEstimateRecommendedSell)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Difference</p>
                  <p className="mt-1 text-base font-semibold tabular-nums">
                    {formatCurrency(preview.difference)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Difference %</p>
                  <p className="mt-1 text-base font-semibold tabular-nums">
                    {formatPercent(preview.differencePercent)}
                  </p>
                </div>
              </div>

              {preview.items.length > 0 ? (
                <>
                  <div className="space-y-2 md:hidden">
                    {preview.items.map((item, index) => (
                      <PreviewRowCard
                        key={`${item.classification}-${item.pricingItemId ?? item.estimateLineItemId ?? index}`}
                        item={item}
                      />
                    ))}
                  </div>

                  <div className="hidden overflow-x-auto rounded-xl border md:block">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 font-medium">Item</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="px-4 py-3 text-right font-medium">
                            Current charge
                          </th>
                          <th className="px-4 py-3 text-right font-medium">
                            Latest estimate charge
                          </th>
                          <th className="px-4 py-3 text-right font-medium">
                            Difference
                          </th>
                          <th className="px-4 py-3 font-medium">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {preview.items.map((item, index) => (
                          <tr
                            key={`${item.classification}-${item.pricingItemId ?? item.estimateLineItemId ?? index}`}
                          >
                            <td className="px-4 py-3 align-top">
                              <p className="font-medium leading-snug">
                                {item.label}
                              </p>
                            </td>
                            <td className="px-4 py-3 align-top">
                              <span
                                className={cn(
                                  "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
                                  STATUS_BADGE_CLASS[item.classification]
                                )}
                              >
                                {STATUS_LABELS[item.classification]}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right align-top tabular-nums">
                              {item.beforeSell != null
                                ? formatCurrency(item.beforeSell)
                                : "—"}
                            </td>
                            <td className="px-4 py-3 text-right align-top tabular-nums">
                              {item.afterSell != null
                                ? formatCurrency(item.afterSell)
                                : "—"}
                            </td>
                            <td className="px-4 py-3 text-right align-top tabular-nums">
                              {formatDifference(item.beforeSell, item.afterSell)}
                            </td>
                            <td className="max-w-[220px] px-4 py-3 align-top text-xs text-muted-foreground">
                              {item.note ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No pricing changes to apply. Your final pricing already matches
                  the latest estimate.
                </p>
              )}
            </div>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 flex-col gap-3 border-t bg-background px-4 py-4 sm:flex-row sm:px-6">
          <div className="w-full space-y-1 text-xs text-muted-foreground sm:mr-auto sm:max-w-md sm:text-left">
            {hasManualProtected ? (
              <p>Manual edits will be preserved.</p>
            ) : null}
            {hasOrphaned ? (
              <p>
                Items no longer in the latest estimate will be kept and flagged,
                not deleted.
              </p>
            ) : null}
          </div>
          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isApplying}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleApply}
              disabled={
                isApplying || previewLoading || !preview || latestEstimateIsStale
              }
              className="w-full sm:w-auto"
            >
              {isApplying ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Updating…
                </>
              ) : (
                "Update final pricing"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
