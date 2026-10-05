"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPricingMoney, formatPricingPercent } from "@/lib/pricing/format";
import { pricingDocumentViewModel } from "@/lib/pricing/financial-view-model";
import {
  presentExpectedGrossMarginPercent,
  sellsMatchRecommended,
} from "@/lib/pricing/final-sell";
import { formatProfitabilityDisplay } from "@/lib/financial-presentation/format";
import type { PricingDocument, PricingItem, PricingWorkArea } from "@/lib/pricing/types";

type PricingDecisionCardProps = {
  document: PricingDocument;
  items: PricingItem[];
  workAreas: PricingWorkArea[];
  recommendedSell: number | null;
  disabled?: boolean;
  readOnly?: boolean;
  onApplyFinalSell: (finalSellExGst: number) => Promise<{ error?: string }>;
};

export function PricingDecisionCard({
  document,
  recommendedSell,
  disabled = false,
  readOnly = false,
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
  const priceDifference =
    recommendedSell != null && !usingRecommended
      ? document.subtotal_sell - recommendedSell
      : null;

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
        <h2 className="text-base font-semibold">Final client price</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The estimate is Quotr’s working recommendation. Pricing is what you
          intend to charge. The quote will use this price.
        </p>
      </div>

      {priceDifference != null && recommendedSell != null ? (
        <p className="text-sm text-muted-foreground" data-pricing-final-price-difference>
          {formatPricingMoney(Math.abs(priceDifference))}{" "}
          {priceDifference > 0 ? "above" : "below"} the{" "}
          {formatPricingMoney(recommendedSell)} recommendation.
          {view.costKnown ? ` Expected gross margin ${storedMargin.marginLabel}.` : ""}
        </p>
      ) : null}

      {readOnly ? (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            Final price{view.showGst ? " (ex GST)" : ""}
          </p>
          <p className="text-sm font-medium tabular-nums">{view.subtotalSellFormatted}</p>
          {view.costKnown ? (
            <p className="text-sm text-muted-foreground">
              Expected gross margin {storedMargin.marginLabel}
            </p>
          ) : null}
        </div>
      ) : (
      <div className="space-y-3" data-pricing-final-price-control>
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
      )}
    </section>
  );
}
