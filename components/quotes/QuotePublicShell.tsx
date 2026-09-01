"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  formatQuoteNumberRevision,
  getCompanyDisplayName,
} from "@/lib/quotes/display";
import { resolveQuoteIssuerSettings } from "@/lib/quotes/issuer-snapshot";
import { formatClientQuoteStatusLabel } from "@/lib/quotes/status";
import { isQuoteExpired } from "@/lib/quotes/transaction";
import type { Quote } from "@/lib/quotes/types";

export function QuotePublicShell({
  quote,
  superseded,
}: {
  quote: Quote;
  superseded: boolean;
}) {
  const expired = isQuoteExpired(quote);
  const issuer = resolveQuoteIssuerSettings(quote, null);
  const companyName = getCompanyDisplayName(issuer);
  const statusLabel = formatClientQuoteStatusLabel(quote.status, {
    superseded,
    expired,
  });

  return (
    <div className="space-y-3 print:hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
        <div className="min-w-0 space-y-1">
          {companyName ? (
            <p className="text-sm font-semibold text-neutral-900">
              {companyName}
            </p>
          ) : null}
          <p className="text-sm text-neutral-700">
            {formatQuoteNumberRevision(quote)}
          </p>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            {statusLabel}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-10 shrink-0"
          onClick={() => window.print()}
        >
          <Printer className="mr-2 size-4" />
          Print / Save PDF
        </Button>
      </div>

      <div data-quote-acceptance-seam="true" />

      {superseded ? (
        <div
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          This quote has been superseded by a newer revision. Do not rely on
          this version.
        </div>
      ) : null}
      {expired && quote.status !== "superseded" && !superseded ? (
        <div
          className="rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-800"
          role="status"
        >
          This quote has expired and is shown as a record only.
        </div>
      ) : null}
      {quote.status === "accepted" && !superseded ? (
        <div
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
          role="status"
        >
          This quote was accepted.
        </div>
      ) : null}
      {quote.status === "declined" && !superseded ? (
        <div
          className="rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-800"
          role="status"
        >
          This quote was declined and is shown as a record only.
        </div>
      ) : null}
    </div>
  );
}
