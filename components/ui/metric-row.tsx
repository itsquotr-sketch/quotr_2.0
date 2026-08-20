import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function MetricRow({
  label,
  value,
  prominent,
  dimmed,
  tertiary,
  trailing,
}: {
  label: string;
  value: string;
  prominent?: boolean;
  dimmed?: boolean;
  tertiary?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <div
      className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5"
      data-metric-row="true"
    >
      <span
        className={cn(
          "shrink-0 text-muted-foreground",
          tertiary ? "text-[11px]" : "text-xs"
        )}
      >
        {label}
      </span>
      <div className="flex min-w-0 items-center justify-end gap-1.5">
        <span
          className={cn(
            "text-right tabular-nums",
            prominent
              ? "text-3xl font-semibold tracking-tight text-foreground"
              : tertiary
                ? "text-sm font-medium text-foreground/90"
                : "text-sm font-medium",
            dimmed &&
              "text-muted-foreground line-through decoration-muted-foreground/50"
          )}
        >
          {value}
        </span>
        {trailing}
      </div>
    </div>
  );
}
