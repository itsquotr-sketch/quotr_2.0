"use client";

import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { AnalyticsRecordLink } from "@/lib/analytics/measure";
import { recordListIsPartial } from "@/lib/analytics/presentation";
import { formatInOrgTimezone } from "@/lib/org/timezone";
import { formatPricingMoney } from "@/lib/pricing/format";
import { cn } from "@/lib/utils";

type RecordSheetProps = {
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
  "flex h-full min-h-11 min-w-0 flex-col rounded-xl border border-border/60 bg-card px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]";

export function RecordSheet(props: RecordSheetProps) {
  const body = (
    <>
      <p className="text-[11px] font-medium leading-tight text-muted-foreground">{props.label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight break-words tabular-nums sm:text-2xl">
        {props.value}
      </p>
      <p className="mt-0.5 text-xs leading-4 text-muted-foreground">{props.context}</p>
    </>
  );

  if (props.disabled) {
    return <div className={cardClass}>{body}</div>;
  }

  const partial = recordListIsPartial(props.records.length, props.total);

  return (
    <Sheet>
      <SheetTrigger className={cn(cardClass, "w-full hover:bg-muted/20")}>
        {body}
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full data-[side=right]:w-full data-[side=right]:max-w-md"
      >
        <SheetHeader>
          <SheetTitle>{props.title}</SheetTitle>
          <SheetDescription>{props.description}</SheetDescription>
        </SheetHeader>
        {props.records.length === 0 ? (
          <p className="px-6 text-sm text-muted-foreground">{props.empty}</p>
        ) : (
          <ul className="min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto px-3">
            {props.records.map((record) => (
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
        {partial ? (
          <p className="px-6 pb-6 text-xs text-muted-foreground">
            Showing {props.records.length} of {props.total}. Each row is one quote.
          </p>
        ) : (
          <p className="px-6 pb-6 text-xs text-muted-foreground">Each row is one quote.</p>
        )}
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
      <p className="mt-1 text-xl font-semibold tracking-tight break-words tabular-nums sm:text-2xl">
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
