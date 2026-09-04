"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPricingMoney, formatPricingPercent } from "@/lib/pricing/format";
import { pricingDocumentViewModel } from "@/lib/pricing/financial-view-model";
import {
  presentExpectedGrossMarginPercent,
  sellsMatchRecommended,
} from "@/lib/pricing/final-sell";
import { presentPricingSectionTotals } from "@/lib/pricing/presentation-section-totals";
import { formatProfitabilityDisplay } from "@/lib/financial-presentation/format";
import type { PricingDocument, PricingItem, PricingWorkArea } from "@/lib/pricing/types";

type PricingDecisionCardProps = {
  document: PricingDocument;
  items: PricingItem[];
  workAreas: PricingWorkArea[];
  recommendedSell: number | null;
  disabled?: boolean;
  onApplyFinalSell: (finalSellExGst: number) => Promise<{ error?: string }>;
};

export function PricingDecisionCard({
  document,
  items,
  workAreas,
  recommendedSell,
  disabled = false,
  onApplyFinalSell,
}: PricingDecisionCardProps) {
  const view = pricingDocumentViewModel(document);
  const usingRecommended = sellsMatchRecommended(
    document.subtotal_sell,
    recommendedSell
  );
  const [mode, setMode] = useState<"recommended" | "own">(
    usingRecommended || recommendedSell == null ? "recommended" : "own"
  );
  const [ownPrice, setOwnPrice] = useState(
    String(document.subtotal_sell.toFixed(2))
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const workAreaRows = useMemo(() => {
    const byArea = new Map<string, PricingItem[]>();
    for (const item of items) {
      const key = item.work_area_id ?? "none";
      const list = byArea.get(key) ?? [];
      list.push(item);
      byArea.set(key, list);
    }
    const named = workAreas.map((area) => {
      const sectionItems = byArea.get(area.id) ?? [];
      const totals = presentPricingSectionTotals(sectionItems);
      return { id: area.id, name: area.name, sell: totals.subtotalSell };
    });
    const unallocated = byArea.get("none") ?? [];
    if (unallocated.length > 0) {
      named.push({
        id: "none",
        name: "Other",
        sell: presentPricingSectionTotals(unallocated).subtotalSell,
      });
    }
    return named.filter((row) => row.sell > 0 || named.length === 1);
  }, [items, workAreas]);

  const typedSell = Number(ownPrice);
  const previewMargin =
    mode === "own" && Number.isFinite(typedSell)
      ? presentExpectedGrossMarginPercent(document.subtotal_cost, typedSell)
      : presentExpectedGrossMarginPercent(
          document.subtotal_cost,
          document.subtotal_sell
        );
  const storedMargin = formatProfitabilityDisplay({
    costKnown: view.costKnown,
    grossProfit: document.gross_profit,
    marginPercent: document.margin_percent,
  });

  const apply = (target: number) => {
    setError(null);
    startTransition(async () => {
      const result = await onApplyFinalSell(target);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOwnPrice(target.toFixed(2));
    });
  };

  return (
    <section
      className="space-y-4 rounded-xl border border-border/60 bg-card px-4 py-4"
      data-pricing-decision-card="true"
      data-pricing-using-recommended={usingRecommended ? "true" : "false"}
    >
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Pricing
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          The estimate is Quotr’s working recommendation. Pricing is what you
          intend to charge. The quote will use this price.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div data-pricing-recommended-price>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Recommended price
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">
            {recommendedSell != null
              ? formatPricingMoney(recommendedSell)
              : "—"}
            {view.showGst ? (
              <span className="ml-1 text-sm font-medium text-muted-foreground">
                ex GST
              </span>
            ) : null}
          </p>
        </div>
        <div data-pricing-final-price>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Your final price
          </p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight">
            {view.subtotalSellFormatted}
            {view.showGst ? (
              <span className="ml-1 text-sm font-medium text-muted-foreground">
                ex GST
              </span>
            ) : null}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm" data-pricing-decision-metrics>
        <span>
          Estimated cost{" "}
          <span className="font-medium tabular-nums">
            {view.subtotalCostFormatted}
          </span>
        </span>
        <span>
          Expected gross margin{" "}
          <span className="font-medium tabular-nums">{storedMargin.marginLabel}</span>
        </span>
      </div>

      {view.showGst ? (
        <div className="text-sm" data-pricing-gst>
          <p>
            {view.totalInclGstFormatted} incl GST
            <span className="text-muted-foreground">
              {" "}
              · {view.gstAmountFormatted} {view.gstLabel}
            </span>
          </p>
        </div>
      ) : (
        <p className="text-sm font-medium tabular-nums" data-pricing-total>
          {view.totalInclGstFormatted}
        </p>
      )}

      {workAreaRows.length > 0 ? (
        <ul className="space-y-1 text-sm" data-pricing-work-area-breakdown>
          {workAreaRows.map((row) => (
            <li key={row.id} className="flex justify-between gap-3">
              <span className="min-w-0 truncate">{row.name}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {formatPricingMoney(row.sell)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="space-y-3 border-t border-border/50 pt-3" data-pricing-final-price-control>
        <p className="text-sm font-medium">Choose a final price</p>
        <div className="flex flex-col gap-2">
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="radio"
              name="pricing-final-mode"
              checked={mode === "recommended"}
              disabled={disabled || recommendedSell == null}
              onChange={() => setMode("recommended")}
            />
            Use Quotr recommendation
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="radio"
              name="pricing-final-mode"
              checked={mode === "own"}
              disabled={disabled}
              onChange={() => setMode("own")}
            />
            Set my own price
          </label>
        </div>

        {mode === "own" ? (
          <div className="space-y-2">
            <Label htmlFor="pricing-final-sell">
              Final price{view.showGst ? " (ex GST)" : ""}
            </Label>
            <Input
              id="pricing-final-sell"
              inputMode="decimal"
              value={ownPrice}
              disabled={disabled || isPending}
              onChange={(event) => setOwnPrice(event.target.value)}
            />
            {previewMargin.ok ? (
              <p className="text-xs text-muted-foreground" data-pricing-own-margin-preview>
                Expected gross margin {formatPricingPercent(previewMargin.marginPercent)}
              </p>
            ) : (
              <p className="text-xs text-destructive" role="alert">
                {previewMargin.error}
              </p>
            )}
          </div>
        ) : null}

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {mode === "recommended" && recommendedSell != null && !usingRecommended ? (
          <Button
            type="button"
            className="h-11 w-full sm:w-auto"
            disabled={disabled || isPending}
            onClick={() => apply(recommendedSell)}
          >
            {isPending ? "Updating…" : "Use recommended price"}
          </Button>
        ) : null}
        {mode === "own" ? (
          <Button
            type="button"
            className="h-11 w-full sm:w-auto"
            disabled={
              disabled ||
              isPending ||
              !previewMargin.ok ||
              !Number.isFinite(typedSell)
            }
            onClick={() => apply(typedSell)}
          >
            {isPending ? "Updating…" : "Apply this price"}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
