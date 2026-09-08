"use client";

import { cn } from "@/lib/utils";
import { formatSelectAnswerValue } from "@/lib/scopes/fact-labels";
import { optionValueMatches } from "@/lib/scopes/option-match";

export type OptionSelectValue = string | number | boolean | string[] | null | undefined;

type OptionSelectProps = {
  options: readonly string[];
  value: OptionSelectValue;
  multiple?: boolean;
  disabled?: boolean;
  pending?: boolean;
  error?: string | null;
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

export function OptionSelect({
  options,
  value,
  multiple = false,
  disabled,
  pending,
  error,
  onSelect,
}: OptionSelectProps) {
  const selectedList = Array.isArray(value)
    ? value
    : typeof value === "string" && value && multiple
      ? value.split(",").map((item) => item.trim()).filter(Boolean)
      : [];

  return (
    <div className="grid gap-2" data-option-select={multiple ? "multi" : "single"}>
      {options.map((option) => {
        const selected = multiple
          ? selectedList.some((item) => optionValueMatches(option, item)) ||
            optionValueMatches(option, selectedList)
          : optionValueMatches(option, value);
        const copy = splitOptionCopy(option);
        return (
          <button
            key={option}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            data-option-selected={selected ? "true" : "false"}
            className={cn(
              "min-h-11 rounded-xl border px-4 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
                onSelect(next);
                return;
              }
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
