"use client";

import { Button } from "@/components/ui/button";
import type { PricingGroupBy } from "@/lib/pricing/grouping";
import { cn } from "@/lib/utils";

const GROUP_OPTIONS: Array<{ value: PricingGroupBy; label: string }> = [
  { value: "work_area", label: "Work Areas" },
  { value: "cost_type", label: "Cost Type" },
  { value: "all", label: "All Items" },
];

type PricingGroupControlProps = {
  value: PricingGroupBy;
  onChange: (value: PricingGroupBy) => void;
  selectionMode?: boolean;
  onSelectionModeChange?: (next: boolean) => void;
  selectedCount?: number;
};

export function PricingGroupControl({
  value,
  onChange,
  selectionMode = false,
  onSelectionModeChange,
  selectedCount = 0,
}: PricingGroupControlProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div
        className="inline-flex rounded-lg border border-border/70 bg-muted/30 p-0.5"
        role="group"
        aria-label="Group pricing items"
      >
        {GROUP_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={cn(
              "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              value === option.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {onSelectionModeChange ? (
        <Button
          type="button"
          variant={selectionMode ? "secondary" : "outline"}
          size="sm"
          className="h-8 md:hidden"
          onClick={() => onSelectionModeChange(!selectionMode)}
        >
          {selectionMode
            ? selectedCount > 0
              ? `Done (${selectedCount})`
              : "Done"
            : "Select"}
        </Button>
      ) : null}
    </div>
  );
}
