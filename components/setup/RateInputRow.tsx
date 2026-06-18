"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type RateInputRowProps = {
  label: string;
  unit?: string;
  description?: string;
  costRate?: string;
  sellRate?: string;
  markupPercent?: string;
  onCostRateChange?: (value: string) => void;
  onSellRateChange?: (value: string) => void;
  onMarkupPercentChange?: (value: string) => void;
  showMarkup?: boolean;
  optional?: boolean;
};

export function RateInputRow({
  label,
  unit,
  description,
  costRate,
  sellRate,
  markupPercent,
  onCostRateChange,
  onSellRateChange,
  onMarkupPercentChange,
  showMarkup = false,
  optional = false,
}: RateInputRowProps) {
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div>
        <Label className="text-sm font-medium">
          {label}
          {optional ? (
            <span className="ml-1 font-normal text-muted-foreground">
              (optional)
            </span>
          ) : null}
        </Label>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
        {unit ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{unit}</p>
        ) : null}
      </div>
      {showMarkup ? (
        <div className="space-y-2">
          <Label htmlFor={`${label}-markup`} className="text-xs text-muted-foreground">
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
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${label}-cost`} className="text-xs text-muted-foreground">
              Cost rate
            </Label>
            <Input
              id={`${label}-cost`}
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              value={costRate ?? ""}
              onChange={(event) => onCostRateChange?.(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${label}-sell`} className="text-xs text-muted-foreground">
              Sell rate
            </Label>
            <Input
              id={`${label}-sell`}
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              value={sellRate ?? ""}
              onChange={(event) => onSellRateChange?.(event.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
