"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatMoney,
  tryRecommendedChargeOutFromCostString,
} from "@/lib/rates/cost-first-presentation";
import { DEFAULT_MARGIN_PERCENT } from "@/lib/estimate/constants";

type RateInputRowProps = {
  label: string;
  unit?: string;
  description?: string;
  authorityLabel?: string;
  benchmarkHint?: string;
  costRate?: string;
  sellRate?: string;
  markupPercent?: string;
  onCostRateChange?: (value: string) => void;
  onSellRateChange?: (value: string) => void;
  onMarkupPercentChange?: (value: string) => void;
  showMarkup?: boolean;
  optional?: boolean;
  companyGrossMarginPercent?: number;
};

export function RateInputRow({
  label,
  unit,
  description,
  authorityLabel,
  benchmarkHint,
  costRate,
  sellRate,
  markupPercent,
  onCostRateChange,
  onSellRateChange,
  onMarkupPercentChange,
  showMarkup = false,
  optional = false,
  companyGrossMarginPercent = DEFAULT_MARGIN_PERCENT,
}: RateInputRowProps) {
  const [customOpen, setCustomOpen] = useState(Boolean(sellRate?.trim()));

  const recommended = useMemo(
    () =>
      tryRecommendedChargeOutFromCostString(
        costRate ?? "",
        companyGrossMarginPercent
      ),
    [costRate, companyGrossMarginPercent]
  );

  const hasCustomSell = Boolean(sellRate?.trim());

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <Label className="text-sm font-medium">
            {label}
            {optional ? (
              <span className="ml-1 font-normal text-muted-foreground">
                (optional)
              </span>
            ) : null}
          </Label>
          {authorityLabel ? (
            <span className="text-xs text-muted-foreground">{authorityLabel}</span>
          ) : null}
        </div>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
        {unit ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{unit}</p>
        ) : null}
        {benchmarkHint ? (
          <p className="mt-1 text-xs text-muted-foreground">{benchmarkHint}</p>
        ) : null}
      </div>
      {showMarkup ? (
        <div className="space-y-2">
          <Label
            htmlFor={`${label}-markup`}
            className="text-xs text-muted-foreground"
          >
            Markup %
          </Label>
          <Input
            id={`${label}-markup`}
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="e.g. 15"
            value={markupPercent ?? ""}
            onChange={(event) => onMarkupPercentChange?.(event.target.value)}
            className="max-w-[140px]"
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label
              htmlFor={`${label}-cost`}
              className="text-xs text-muted-foreground"
            >
              Your cost
            </Label>
            <div className="relative max-w-[200px]">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <Input
                id={`${label}-cost`}
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="Blank = later"
                value={costRate ?? ""}
                onChange={(event) => onCostRateChange?.(event.target.value)}
                className={cn("pl-7")}
              />
            </div>
          </div>

          <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Recommended charge-out
            </p>
            <p className="mt-0.5 text-base font-semibold tabular-nums">
              {formatMoney(recommended)}
              {unit ? (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  / {unit}
                </span>
              ) : null}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Using {companyGrossMarginPercent}% company gross margin
              {hasCustomSell ? " · custom charge-out set below" : ""}
            </p>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              className="text-xs font-medium text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => setCustomOpen((open) => !open)}
            >
              {customOpen ? "Hide custom charge-out" : "Custom charge-out"}
            </button>
            {customOpen ? (
              <div className="space-y-2">
                <Label
                  htmlFor={`${label}-sell`}
                  className="text-xs text-muted-foreground"
                >
                  Custom charge-out
                </Label>
                <div className="relative max-w-[200px]">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <Input
                    id={`${label}-sell`}
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="Leave blank for recommended"
                    value={sellRate ?? ""}
                    onChange={(event) => onSellRateChange?.(event.target.value)}
                    className={cn("pl-7")}
                  />
                </div>
                {hasCustomSell ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-0"
                    onClick={() => onSellRateChange?.("")}
                  >
                    Clear — use recommended
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
