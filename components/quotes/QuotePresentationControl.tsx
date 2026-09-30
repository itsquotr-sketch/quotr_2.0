"use client";

import { cn } from "@/lib/utils";
import {
  parseQuotePresentationMode,
  type QuotePresentationMode,
} from "@/lib/quotes/presentation";

const OPTIONS: Array<{ value: QuotePresentationMode; label: string; hint: string }> = [
  {
    value: "detailed",
    label: "Detailed",
    hint: "The client sees each visible line.",
  },
  {
    value: "grouped",
    label: "Grouped",
    hint: "The client sees each Work Area with its stored total.",
  },
  {
    value: "lump_sum",
    label: "Lump sum",
    hint: "The client sees the scope and the quote total.",
  },
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
    <div className="space-y-2 sm:col-span-2">
      <p className="text-sm font-medium">Client presentation</p>
      <div
        className="grid gap-2 sm:grid-cols-3"
        role="radiogroup"
        aria-label="Client quote presentation"
      >
        {OPTIONS.map((option) => {
          const selected = mode === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              disabled={disabled}
              aria-checked={selected}
              className={cn(
                "min-h-11 rounded-lg border px-3 py-2 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "border-foreground/40 bg-background font-semibold text-foreground shadow-sm"
                  : "border-border bg-muted/30 text-muted-foreground",
                disabled && "cursor-not-allowed opacity-60"
              )}
              onClick={() => onChange(option.value)}
            >
              <span className="block">{option.label}</span>
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                {selected ? "Selected" : "Not selected"}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-sm text-muted-foreground">
        {OPTIONS.find((option) => option.value === mode)?.hint} Hidden lines
        stay on the quote. This does not change the quote total.
      </p>
    </div>
  );
}
