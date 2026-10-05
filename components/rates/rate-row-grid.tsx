import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared desktop columns. Headers and rows import the same string so they
 * cannot drift. Numeric columns are fixed; the name column is the only one
 * that wraps.
 *
 * Labour, subcontract, and plant:
 * Item | Your rate | Quotr benchmark | Unit | Status | Charge-out | Action
 */
export const moneyRateColumns =
  "lg:grid-cols-[minmax(0,1.6fr)_5.75rem_6.25rem_3.75rem_8.25rem_6.5rem_5.75rem]";

/** Materials families: no charge-out column. */
export const materialRateColumns =
  "lg:grid-cols-[minmax(0,1.6fr)_5.75rem_6.25rem_3.75rem_9.5rem_5.75rem]";

/** Productivity operations: no charge-out column. */
export const productivityRateColumns =
  "lg:grid-cols-[minmax(0,1.7fr)_8.5rem_8.5rem_4.5rem_8.25rem_5.75rem]";

/** Search, selects, and secondary filter buttons share one control height. */
export const ratesFilterControlClass =
  "box-border h-11 min-h-11 w-full max-w-full rounded-xl border border-border/80 bg-background px-3 py-0 text-base leading-none outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] focus-visible:ring-offset-2 md:text-sm lg:h-9 lg:min-h-9 lg:w-auto";

export const ratesFilterRowClass =
  "grid grid-cols-1 items-center gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center";

export const ratesFilterActionClass =
  "h-11 min-h-11 flex-1 px-3 text-sm lg:h-9 lg:min-h-9 lg:flex-none lg:text-xs";

type HeaderLabel = {
  text: string;
  align?: "end";
};

export function RateGridHeader({
  columns,
  labels,
}: {
  columns: string;
  labels: HeaderLabel[];
}) {
  return (
    <div
      className={cn(
        "hidden border-b border-border/60 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground lg:grid lg:items-end lg:gap-x-2",
        columns
      )}
    >
      {labels.map((label) => (
        <span
          key={label.text}
          className={cn(
            "min-w-0 whitespace-normal leading-tight",
            label.align === "end" && "text-right"
          )}
        >
          {label.text}
        </span>
      ))}
    </div>
  );
}

export function RateGridRow({
  columns,
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  columns: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-1 border-b border-border/50 py-3 last:border-0 sm:grid sm:grid-cols-1 lg:items-start lg:gap-x-2 lg:py-2.5",
        columns,
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function RateField({
  label,
  children,
  align = "start",
  attention = false,
}: {
  label: string;
  children: ReactNode;
  align?: "start" | "end";
  attention?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-baseline justify-between gap-3 lg:block",
        align === "end" && "lg:text-right"
      )}
    >
      <span className="shrink-0 text-xs text-muted-foreground lg:sr-only">
        {label}
      </span>
      <span
        className={cn(
          "min-w-0 text-sm tabular-nums lg:block",
          align === "end" && "text-right",
          attention
            ? "font-medium text-[var(--brand-orange)]"
            : "text-foreground"
        )}
      >
        {children}
      </span>
    </div>
  );
}
