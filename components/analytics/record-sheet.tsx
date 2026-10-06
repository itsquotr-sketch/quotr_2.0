"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { loadAnalyticsRecordWindow } from "@/lib/analytics/actions";
import type { AnalyticsRecordLink } from "@/lib/analytics/measure";
import type { AnalyticsWindowId } from "@/lib/analytics/periods";
import { recordListIsPartial } from "@/lib/analytics/presentation";
import { formatInOrgTimezone } from "@/lib/org/timezone";
import { formatPricingMoney } from "@/lib/pricing/format";
import { cn } from "@/lib/utils";

type RecordSheetProps = {
  periodId: AnalyticsWindowId;
  from?: string | null;
  to?: string | null;
  kind: "sent" | "accepted";
  label: string;
  value: string;
  context: string;
  title: string;
  description: string;
  empty: string;
  records: AnalyticsRecordLink[];
  total: number;
  timeZone: string;
  disabled?: boolean;
};

const cardClass =
  "flex h-full min-h-11 min-w-0 flex-col rounded-xl border border-border/60 bg-card px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]";

export function RecordSheet(props: RecordSheetProps) {
  const body = (
    <>
      <p className="text-[11px] font-medium leading-tight text-muted-foreground">{props.label}</p>
      <p className="mt-1 text-lg font-semibold tracking-tight break-words tabular-nums sm:text-2xl">
        {props.value}
      </p>
      <p className="mt-0.5 text-xs leading-4 text-muted-foreground">{props.context}</p>
    </>
  );

  if (props.disabled) {
    return <div className={cardClass}>{body}</div>;
  }

  return (
    <Sheet>
      <SheetTrigger className={cn(cardClass, "w-full hover:bg-muted/20")}>
        {body}
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full data-[side=right]:w-full data-[side=right]:max-w-md"
      >
        <RecordList {...props} />
      </SheetContent>
    </Sheet>
  );
}

function RecordList(props: RecordSheetProps) {
  const [offset, setOffset] = useState(0);
  const [records, setRecords] = useState(props.records);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);
  const pageKey = `${props.periodId}:${props.from ?? ""}:${props.to ?? ""}:${props.kind}:${props.total}:${props.records[0]?.quoteId ?? ""}`;
  const [seenKey, setSeenKey] = useState(pageKey);
  if (seenKey !== pageKey) {
    setSeenKey(pageKey);
    setOffset(0);
    setRecords(props.records);
    setError(null);
  }

  const partial = recordListIsPartial(records.length, props.total) || offset > 0;
  const from = records.length === 0 ? 0 : offset + 1;
  const to = offset + records.length;
  const canPrevious = offset > 0;
  const canNext = to < props.total;

  async function go(nextOffset: number) {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      const result = await loadAnalyticsRecordWindow(
        props.periodId,
        props.kind,
        nextOffset,
        props.from ?? undefined,
        props.to ?? undefined
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRecords(result.records);
      setOffset(result.offset);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{props.title}</SheetTitle>
        <SheetDescription>{props.description}</SheetDescription>
      </SheetHeader>
      {records.length === 0 ? (
        <p className="px-6 text-sm text-muted-foreground">{props.empty}</p>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto px-3">
          {records.map((record) => (
            <li key={record.quoteId}>
              <Link
                href={record.href}
                className="flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{record.projectTitle}</span>
                  {record.amountExGst != null ? (
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {formatPricingMoney(record.amountExGst)} ex GST
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatInOrgTimezone(record.occurredAt, props.timeZone) ?? "—"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="shrink-0 space-y-2 px-6 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {partial
            ? `Showing ${from}–${to} of ${props.total}. Each row is one quote.`
            : "Each row is one quote."}
        </p>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        {partial ? (
          <div className="flex gap-2">
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] disabled:opacity-40"
              disabled={!canPrevious || loading}
              onClick={() => go(Math.max(0, offset - 8))}
            >
              Previous
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] disabled:opacity-40"
              disabled={!canNext || loading}
              aria-busy={loading}
              onClick={() => go(offset + records.length)}
            >
              {loading ? "Loading" : "Next"}
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}

export function EstimateSheet(props: {
  label: string;
  value: string;
  context: string;
  records: AnalyticsRecordLink[];
  disabled?: boolean;
  timeZone: string;
}) {
  const [offset, setOffset] = useState(0);
  const page = props.records.slice(offset, offset + 8);
  const total = props.records.length;
  const from = page.length === 0 ? 0 : offset + 1;
  const to = offset + page.length;
  const body = (
    <>
      <p className="text-[11px] font-medium leading-tight text-muted-foreground">{props.label}</p>
      <p className="mt-1 text-lg font-semibold tracking-tight break-words tabular-nums sm:text-2xl">
        {props.value}
      </p>
      <p className="mt-0.5 text-xs leading-4 text-muted-foreground">{props.context}</p>
    </>
  );
  if (props.disabled) return <div className={cardClass}>{body}</div>;
  return (
    <Sheet>
      <SheetTrigger className={cn(cardClass, "w-full hover:bg-muted/20")}>{body}</SheetTrigger>
      <SheetContent side="right" className="w-full data-[side=right]:w-full data-[side=right]:max-w-md">
        <SheetHeader>
          <SheetTitle>Estimates created</SheetTitle>
          <SheetDescription>
            One estimate row per project. Regenerating it does not add another row.
          </SheetDescription>
        </SheetHeader>
        {page.length === 0 ? (
          <p className="px-6 text-sm text-muted-foreground">No estimates were created in this range.</p>
        ) : (
          <ul className="min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto px-3">
            {page.map((record) => (
              <li key={record.quoteId}>
                <Link
                  href={record.href}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
                >
                  <span className="truncate font-medium">{record.projectTitle}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatInOrgTimezone(record.occurredAt, props.timeZone) ?? "—"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {total > 8 ? (
          <div className="flex gap-2 px-6 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <p className="sr-only">
              Showing {from}–{to} of {total}
            </p>
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-sm disabled:opacity-40"
              disabled={offset === 0}
              onClick={() => setOffset((value) => Math.max(0, value - 8))}
            >
              Previous
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-sm disabled:opacity-40"
              disabled={to >= total}
              onClick={() => setOffset((value) => value + 8)}
            >
              Next
            </button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export function MetricLinkCard(props: {
  href: string;
  label: string;
  value: string;
  context: string;
  disabled?: boolean;
}) {
  const body = (
    <>
      <p className="text-[11px] font-medium leading-tight text-muted-foreground">{props.label}</p>
      <p className="mt-1 text-lg font-semibold tracking-tight break-words tabular-nums sm:text-2xl">
        {props.value}
      </p>
      <p className="mt-0.5 text-xs leading-4 text-muted-foreground">{props.context}</p>
    </>
  );
  if (props.disabled) return <div className={cardClass}>{body}</div>;
  return (
    <Link href={props.href} className={cn(cardClass, "hover:bg-muted/20")}>
      {body}
    </Link>
  );
}
