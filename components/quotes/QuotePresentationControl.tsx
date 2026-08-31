"use client";

import { cn } from "@/lib/utils";
import {
  parseQuotePresentationMode,
  type QuotePresentationMode,
} from "@/lib/quotes/presentation";

const OPTIONS: Array<{ value: QuotePresentationMode; label: string; hint: string }> = [
  { value: "grouped", label: "Grouped", hint: "Work area totals" },
  { value: "detailed", label: "Detailed", hint: "Visible lines" },
  { value: "lump_sum", label: "Lump sum", hint: "Scope plus total" },
];

type QuotePresentationControlProps = {
  value: QuotePresentationMode | string | null | undefined;
  disabled?: boolean;
  onChange: (value: QuotePresentationMode) => void;
};

export function QuotePresentationControl({
  value,
  disabled,
  onChange,
}: QuotePresentationControlProps) {
  const mode = parseQuotePresentationMode(value);

  return (
    <div className="space-y-1.5 sm:col-span-2">
      <p className="text-xs font-medium">Client presentation</p>
      <div
        className="inline-flex w-full rounded-lg border border-border/70 bg-muted/30 p-0.5 sm:w-auto"
        role="group"
        aria-label="Client quote presentation"
      >
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            className={cn(
              "flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors sm:flex-none",
              mode === option.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
              disabled && "cursor-not-allowed opacity-60"
            )}
            aria-pressed={mode === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {OPTIONS.find((option) => option.value === mode)?.hint}. Does not change
        the quote total.
      </p>
    </div>
  );
}
