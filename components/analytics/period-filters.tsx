"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { analyticsPeriodHref, analyticsRangeHref } from "@/lib/analytics/presentation";
import {
  ANALYTICS_MAX_RANGE_DAYS,
  ANALYTICS_PERIODS,
  resolveCustomRange,
  type AnalyticsWindowId,
} from "@/lib/analytics/periods";
import { cn } from "@/lib/utils";

type PeriodFiltersProps = {
  periodId: AnalyticsWindowId;
  periodLabel: string;
  periodRange: string;
  from: string | null;
  to: string | null;
  timeZone: string;
  rangeError?: string | null;
};

export function PeriodFilters(props: PeriodFiltersProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<AnalyticsWindowId | null>(null);
  const [from, setFrom] = useState(props.from ?? "");
  const [to, setTo] = useState(props.to ?? "");
  const [error, setError] = useState<string | null>(props.rangeError ?? null);
  const started = useRef<number | null>(null);
  const band = useRef<HTMLDivElement>(null);
  const selected = pendingId ?? props.periodId;
  const serverKey = `${props.periodId}:${props.from ?? ""}:${props.to ?? ""}`;

  const sawPending = useRef(false);

  useEffect(() => {
    if (isPending && !sawPending.current) {
      started.current = performance.now();
      sawPending.current = true;
      return;
    }
    if (isPending || !sawPending.current || started.current == null || !band.current) return;
    band.current.dataset.analyticsSwitchMs = String(Math.round(performance.now() - started.current));
    started.current = null;
    sawPending.current = false;
    setPendingId(null);
  }, [isPending, serverKey]);

  function go(href: string, id: AnalyticsWindowId) {
    setError(null);
    setPendingId(id);
    setOpen(false);
    startTransition(() => {
      router.push(href);
    });
  }

  function applyCustom() {
    const resolved = resolveCustomRange({ from, to, timeZone: props.timeZone || "Pacific/Auckland" });
    if (!resolved.ok) {
      setError(resolved.error);
      return;
    }
    go(analyticsRangeHref({ period: "custom", from, to }), "custom");
  }

  const controls = (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Period">
        {ANALYTICS_PERIODS.map((period) => {
          const active = selected === period.id;
          return (
            <button
              key={period.id}
              type="button"
              aria-pressed={active}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]",
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-foreground"
              )}
              onClick={() => go(analyticsPeriodHref(period.id), period.id)}
            >
              {period.label}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={selected === "custom"}
          className={cn(
            "inline-flex min-h-11 items-center rounded-full border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]",
            selected === "custom"
              ? "border-[var(--brand-orange)] bg-[var(--brand-orange-muted)] font-medium"
              : "border-border bg-card"
          )}
          onClick={() => setPendingId("custom")}
        >
          Custom range
        </button>
      </div>
      {selected === "custom" ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            applyCustom();
          }}
        >
          <label className="text-xs text-muted-foreground">
            Start
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="mt-1 block min-h-11 rounded-lg border border-border bg-card px-2 text-sm text-foreground"
              required
            />
          </label>
          <label className="text-xs text-muted-foreground">
            End
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="mt-1 block min-h-11 rounded-lg border border-border bg-card px-2 text-sm text-foreground"
              required
            />
          </label>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-lg bg-foreground px-3 text-sm font-medium text-background outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
          >
            Apply
          </button>
          <p className="pb-3 text-xs text-muted-foreground">
            Inclusive dates, up to {ANALYTICS_MAX_RANGE_DAYS} days.
          </p>
        </form>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );

  return (
    <div
      ref={band}
      className="rounded-xl border border-border/70 bg-card px-3 py-3 sm:px-4"
      data-analytics-filters
      data-analytics-query-ms={undefined}
      aria-busy={isPending}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Range
          </p>
          <p className="mt-1 text-sm font-medium">{props.periodRange}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Active projects and pipeline are current. They do not follow this range.
          </p>
        </div>
        <div className="hidden min-w-0 md:block">{controls}</div>
        <div className="md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
              aria-label="Choose period"
            >
              <SlidersHorizontal className="size-4" aria-hidden />
              Filters
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="max-h-[85dvh] overflow-y-auto rounded-t-xl pb-[max(5.75rem,env(safe-area-inset-bottom))]"
            >
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
                <SheetDescription>{props.periodRange}</SheetDescription>
              </SheetHeader>
              <div className="px-3 pb-3">{controls}</div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      {isPending ? (
        <p className="mt-2 text-xs text-muted-foreground" role="status">
          Updating this range
        </p>
      ) : null}
    </div>
  );
}
