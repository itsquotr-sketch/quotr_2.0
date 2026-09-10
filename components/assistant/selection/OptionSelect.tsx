"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatSelectAnswerValue } from "@/lib/scopes/fact-labels";
import { optionValueMatches } from "@/lib/scopes/option-match";
import {
  displayedOptionSelectValue,
  type OptimisticSelectValue,
} from "@/lib/assistant/selection/optimistic-select";

export type OptionSelectValue = OptimisticSelectValue;

type OptionSelectProps = {
  options: readonly string[];
  value: OptionSelectValue;
  multiple?: boolean;
  disabled?: boolean;
  pending?: boolean;
  error?: string | null;
  compact?: boolean;
  onSelect: (next: string | string[]) => void;
};

function splitOptionCopy(option: string): { title: string; detail: string | null } {
  const idx = option.indexOf(" — ");
  if (idx <= 0) {
    return { title: formatSelectAnswerValue(option), detail: null };
  }
  return {
    title: option.slice(0, idx).trim(),
    detail: option.slice(idx + 3).trim() || null,
  };
}

function selectedListFromValue(value: OptionSelectValue, multiple: boolean): string[] {
  if (!multiple) return [];
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value) {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function exclusiveDisplayValue(value: OptionSelectValue): OptionSelectValue {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export function OptionSelect({
  options,
  value,
  multiple = false,
  disabled,
  pending,
  error,
  compact = false,
  onSelect,
}: OptionSelectProps) {
  const [optimistic, setOptimistic] = useState<OptionSelectValue | undefined>(
    undefined
  );
  const display = displayedOptionSelectValue({
    optimistic,
    committed: value,
  });
  const exclusiveDisplay = multiple ? display : exclusiveDisplayValue(display);
  const selectedList = selectedListFromValue(display, multiple);

  return (
    <div
      className={cn("grid w-full min-w-0", compact ? "gap-1.5" : "gap-2")}
      data-option-select={multiple ? "multi" : "single"}
      data-option-optimistic={optimistic !== undefined ? "true" : "false"}
    >
      {options.map((option) => {
        const selected = multiple
          ? selectedList.some((item) => optionValueMatches(option, item))
          : optionValueMatches(option, exclusiveDisplay);
        const copy = splitOptionCopy(option);
        return (
          <button
            key={option}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            data-option-selected={selected ? "true" : "false"}
            className={cn(
              "w-full min-w-0 rounded-xl border px-4 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              compact ? "min-h-10 py-2.5" : "min-h-11 py-3",
              selected
                ? "border-primary/40 bg-primary/10 font-medium text-foreground ring-1 ring-primary/25"
                : "border-border bg-background hover:bg-muted/40",
              disabled && "pointer-events-none opacity-70"
            )}
            onClick={() => {
              if (multiple) {
                const next = selected
                  ? selectedList.filter((item) => !optionValueMatches(option, item))
                  : [...selectedList, option];
                setOptimistic(next);
                onSelect(next);
                return;
              }
              setOptimistic(option);
              onSelect(option);
            }}
          >
            <span className="block leading-snug">{copy.title}</span>
            {copy.detail ? (
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                {copy.detail}
              </span>
            ) : null}
          </button>
        );
      })}
      {pending ? (
        <p className="text-xs text-muted-foreground" data-option-pending>
          Saving…
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
