"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { analyticsPeriodHref, analyticsRangeHref } from "@/lib/analytics/presentation";
import { useAnalyticsRefresh } from "@/components/analytics/refresh-context";
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
  const refresh = useAnalyticsRefresh();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(false);
  const [pendingId, setPendingId] = useState<AnalyticsWindowId | null>(null);
  const [draft, setDraft] = useState<{ from: string; to: string; key: string } | null>(null);
  const [error, setError] = useState<string | null>(props.rangeError ?? null);
  const started = useRef<number | null>(null);
  const band = useRef<HTMLDivElement>(null);
  const serverKey = `${props.periodId}:${props.from ?? ""}:${props.to ?? ""}`;
  const sawBusy = useRef(false);
  const sawPending = useRef(false);

  useEffect(() => {
    if (busy && !sawBusy.current) {
      started.current = performance.now();
      sawBusy.current = true;
      return;
    }
    if (busy || !sawBusy.current || started.current == null || !band.current) return;
    band.current.dataset.analyticsSwitchMs = String(Math.round(performance.now() - started.current));
    started.current = null;
    sawBusy.current = false;
  }, [busy]);
  const selected = pendingId ?? props.periodId;
  const from = draft?.key === serverKey ? draft.from : (props.from ?? "");
  const to = draft?.key === serverKey ? draft.to : (props.to ?? "");
  const pendingLabel =
    selected === "custom"
      ? "Custom range"
      : (ANALYTICS_PERIODS.find((period) => period.id === selected)?.label ?? props.periodLabel);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const apply = () => setPhone(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

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

  function go(id: AnalyticsWindowId, fromDate?: string, toDate?: string) {
    setError(null);
    setPendingId(id);
    setOpen(false);
    if (!refresh) {
      const href =
        id === "custom" && fromDate && toDate
          ? analyticsRangeHref({ period: "custom", from: fromDate, to: toDate })
          : analyticsPeriodHref(id === "custom" ? "this_month" : id);
      startTransition(() => {
        router.push(href);
      });
      return;
    }
    setBusy(true);
    void refresh({ period: id, from: fromDate, to: toDate }).then((result) => {
      if (!result.ok && result.stale) return;
      setBusy(false);
      setPendingId(null);
      if (!result.ok && result.error) setError(result.error);
    });
  }

  function applyCustom() {
    const resolved = resolveCustomRange({
      from,
      to,
      timeZone: props.timeZone || "Pacific/Auckland",
    });
    if (!resolved.ok) {
      setError(resolved.error);
      return;
    }
    go("custom", from, to);
  }

  function cancel() {
    setDraft(null);
    setError(props.rangeError ?? null);
    setOpen(false);
  }

  const menu = (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="grid grid-cols-2 gap-1">
        {ANALYTICS_PERIODS.map((period) => (
          <button
            key={period.id}
            type="button"
            aria-current={selected === period.id ? "true" : undefined}
            onClick={() => go(period.id)}
            className={cn(
              "min-h-11 rounded-lg px-3 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]",
              selected === period.id ? "bg-foreground text-background" : "hover:bg-muted"
            )}
          >
            {period.label}
          </button>
        ))}
      </div>
      <div className="border-t border-border/60 pt-3">
        <p className="text-sm font-medium">Custom range</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="text-xs text-muted-foreground">
            Start
            <input
              type="date"
              value={from}
              onChange={(event) =>
              setDraft({ from: event.target.value, to, key: serverKey })
            }
              className="mt-1 h-11 w-full rounded-lg border border-border bg-card px-2 text-sm text-foreground"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            End
            <input
              type="date"
              value={to}
              onChange={(event) =>
              setDraft({ from, to: event.target.value, key: serverKey })
            }
              className="mt-1 h-11 w-full rounded-lg border border-border bg-card px-2 text-sm text-foreground"
            />
          </label>
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Inclusive dates in {props.timeZone || "the organisation timezone"}. The longest range is{" "}
          {ANALYTICS_MAX_RANGE_DAYS} days.
        </p>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={applyCustom}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-foreground px-3 text-sm font-medium text-background outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={cancel}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div ref={band} className="relative min-w-0" data-analytics-filters aria-busy={isPending || busy}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        data-analytics-range-trigger
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] sm:w-auto sm:min-w-72"
      >
        <CalendarRange className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0">
          <span className="block text-sm font-medium">{isPending || busy ? pendingLabel : props.periodLabel}</span>
          <span className="block truncate text-xs text-muted-foreground">{props.periodRange}</span>
        </span>
        {isPending || busy ? (
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">Updating this range</span>
        ) : null}
      </button>

      {open && phone ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            className="max-h-[min(85dvh,40rem)] overflow-y-auto pb-[calc(6.5rem+env(safe-area-inset-bottom))]"
          >
            <SheetHeader>
              <SheetTitle>Date range</SheetTitle>
              <SheetDescription>{props.periodRange}</SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-4">{menu}</div>
          </SheetContent>
        </Sheet>
      ) : null}

      {open && !phone ? (
        <>
          <button
            type="button"
            aria-label="Close date range"
            className="fixed inset-0 z-30 cursor-default"
            onClick={cancel}
          />
          <div
            role="dialog"
            aria-label="Date range"
            className="absolute z-40 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl border border-border/60 bg-card p-3 shadow-lg"
          >
            {menu}
          </div>
        </>
      ) : null}
    </div>
  );
}
