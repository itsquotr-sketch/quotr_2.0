"use client";

import Link from "next/link";
import { formatQuoteDateTime } from "@/lib/quotes/display";
import { getQuoteStatusDefinition } from "@/lib/quotes/status";
import type { QuoteEventRecord, QuoteThreadRevision } from "@/lib/quotes/types";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

function formatStamp(value: string | null): string | null {
  return formatQuoteDateTime(value);
}

function revisionLine(revision: QuoteThreadRevision): string {
  const status = getQuoteStatusDefinition(revision.status).label;
  const parts = [`Revision ${revision.revision_number}`, status];
  const sent = formatStamp(revision.sent_at);
  if (sent) parts.push(`Sent ${sent}`);
  if (revision.viewed_at) parts.push("Viewed");
  if (revision.accepted_at) parts.push("Accepted");
  if (revision.declined_at) parts.push("Declined");
  return parts.join(" · ");
}

function eventLabel(event: QuoteEventRecord): string {
  switch (event.event_type) {
    case "quote_created":
      return "Created";
    case "quote_updated":
      return "Updated";
    case "quote_revision_created":
      return "Revision created";
    case "quote_sent":
      return "Sent";
    case "quote_viewed":
      return "Viewed";
    case "quote_accepted":
      return event.actor_type === "client"
        ? "Accepted by client"
        : "Marked accepted manually";
    case "quote_declined":
      return event.actor_type === "client"
        ? "Declined by client"
        : "Marked declined manually";
    case "quote_expired":
      return "Expired";
    case "quote_superseded":
      return "Superseded";
    case "quote_archived":
      return "Archived";
    default:
      return event.event_type;
  }
}

type QuoteTransactionHistoryProps = {
  projectId: string;
  currentQuoteId: string;
  revisions: QuoteThreadRevision[];
  events: QuoteEventRecord[];
};

export function QuoteTransactionHistory({
  projectId,
  currentQuoteId,
  revisions,
  events,
}: QuoteTransactionHistoryProps) {
  const ordered = [...revisions].sort(
    (a, b) => b.revision_number - a.revision_number
  );

  return (
    <div className="space-y-2 rounded-lg border border-border/60 bg-card px-3 py-2.5 print:hidden">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">History</p>
        <Sheet>
          <SheetTrigger className="h-7 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
            Events
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Quote history</SheetTitle>
              <SheetDescription>
                Revision and status events for this quote.
              </SheetDescription>
            </SheetHeader>
            <ol className="space-y-2 px-6 pb-6">
              {events.length === 0 ? (
                <li className="text-sm text-muted-foreground">
                  No events recorded yet.
                </li>
              ) : (
                events.map((event) => (
                  <li key={event.id} className="text-sm">
                    <span className="font-medium">{eventLabel(event)}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      {formatQuoteDateTime(event.occurred_at)}
                    </span>
                  </li>
                ))
              )}
            </ol>
          </SheetContent>
        </Sheet>
      </div>
      <ul className="space-y-1">
        {ordered.map((revision) => (
          <li key={revision.id} className="text-xs leading-relaxed">
            {revision.id === currentQuoteId ? (
              <span className="font-medium text-foreground">
                {revisionLine(revision)}
              </span>
            ) : (
              <Link
                href={`/app/projects/${projectId}/quotes/${revision.id}`}
                className="text-muted-foreground underline-offset-2 hover:underline"
              >
                {revisionLine(revision)}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
