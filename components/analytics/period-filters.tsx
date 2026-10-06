"use client";

import { useState } from "react";
import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { analyticsPeriodHref } from "@/lib/analytics/presentation";
import { ANALYTICS_PERIODS, type AnalyticsPeriodId } from "@/lib/analytics/periods";
import { cn } from "@/lib/utils";

type PeriodFiltersProps = {
  periodId: AnalyticsPeriodId;
  periodLabel: string;
  periodRange: string;
};

export function PeriodFilters({
  periodId,
  periodLabel,
  periodRange,
}: PeriodFiltersProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <p className="min-w-0 text-sm text-muted-foreground">{periodRange}</p>
      <nav className="hidden flex-wrap gap-x-1 md:flex" aria-label="Period">
        {ANALYTICS_PERIODS.map((period) => (
          <PeriodLink key={period.id} id={period.id} selected={period.id === periodId} />
        ))}
      </nav>
      <div className="flex items-center justify-between gap-3 md:hidden">
        <p className="min-w-0 text-sm font-medium">{periodLabel}</p>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
            aria-label="Choose period"
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            Filters
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="max-h-[85dvh] rounded-t-xl pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            <SheetHeader>
              <SheetTitle>Period</SheetTitle>
              <SheetDescription>{periodRange}</SheetDescription>
            </SheetHeader>
            <nav aria-label="Period" className="flex flex-col px-3 pb-3">
              {ANALYTICS_PERIODS.map((period) => {
                const selected = period.id === periodId;
                return (
                  <Link
                    key={period.id}
                    href={analyticsPeriodHref(period.id)}
                    aria-current={selected ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex min-h-11 items-center rounded-lg px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]",
                      selected
                        ? "bg-[var(--brand-orange-muted)] font-medium text-foreground"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    {period.label}
                  </Link>
                );
              })}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

function PeriodLink({ id, selected }: { id: AnalyticsPeriodId; selected: boolean }) {
  const label = ANALYTICS_PERIODS.find((period) => period.id === id)?.label ?? id;
  return (
    <Link
      href={analyticsPeriodHref(id)}
      aria-current={selected ? "page" : undefined}
      className={cn(
        "inline-flex min-h-11 items-center border-b-2 px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]",
        selected
          ? "border-[var(--brand-orange)] font-medium text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </Link>
  );
}
