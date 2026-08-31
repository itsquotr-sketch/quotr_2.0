"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { buildPricingCalculationDetails } from "@/lib/pricing/calculation-details";
import type { PricingItem } from "@/lib/pricing/types";
import { cn } from "@/lib/utils";

type PricingCalculationDetailsProps = {
  item: PricingItem;
  rawNotes?: string | null;
  className?: string;
};

export function PricingCalculationDetails({
  item,
  rawNotes,
  className,
}: PricingCalculationDetailsProps) {
  const [open, setOpen] = useState(false);
  const details = useMemo(() => buildPricingCalculationDetails(item), [item]);
  const showDebug =
    process.env.NODE_ENV === "development" && Boolean(rawNotes?.trim());

  if (!details && !showDebug) {
    return null;
  }

  return (
    <div className={cn("rounded-md border border-border/60 bg-muted/20", className)}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <span className="text-xs font-medium">Calculation details</span>
        <ChevronDown
          className={cn(
            "size-3.5 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open ? (
        <div className="space-y-2 border-t border-border/50 px-3 py-2">
          {details ? (
            <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 text-xs">
              {details.rows.map((row) => (
                <div key={row.label} className="contents">
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className="text-right font-medium tabular-nums text-foreground">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-xs text-muted-foreground">
              No stored calculation details for this item.
            </p>
          )}
          {showDebug ? (
            <details className="pt-1">
              <summary className="cursor-pointer text-[11px] text-muted-foreground">
                Debug data
              </summary>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-background p-2 text-[10px] text-muted-foreground">
                {rawNotes}
              </pre>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
