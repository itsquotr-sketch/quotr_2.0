"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  formatQuoteDateTime,
  formatQuoteNumberRevision,
  getCompanyDisplayName,
} from "@/lib/quotes/display";
import { formatPricingDate } from "@/lib/pricing/format";
import { resolveQuoteIssuerSettings } from "@/lib/quotes/issuer-snapshot";
import { resolveDisplayTimezone } from "@/lib/org/timezone";
import { formatClientQuoteStatusLabel } from "@/lib/quotes/status";
import { isQuoteExpired } from "@/lib/quotes/transaction";
import type { Quote } from "@/lib/quotes/types";
import type { PublicQuoteAcceptanceSummary } from "@/lib/quotes/acceptance-types";
import type { ReactNode } from "react";

export function QuotePublicShell({
  quote,
  superseded,
  acceptance,
  actions,
}: {
  quote: Quote;
  superseded: boolean;
  acceptance?: PublicQuoteAcceptanceSummary | null;
  actions?: ReactNode;
}) {
  const expired = isQuoteExpired(quote);
  const issuer = resolveQuoteIssuerSettings(quote, null);
  const companyName = getCompanyDisplayName(issuer);
  const displayTimeZone = resolveDisplayTimezone(issuer?.timezone);
  const statusLabel = formatClientQuoteStatusLabel(quote.status, {
    superseded,
    expired,
  });
  const acceptedAt = formatQuoteDateTime(
    acceptance?.accepted_at ?? quote.accepted_at,
    displayTimeZone
  );

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
        <div className="flex flex-wrap items-center gap-2">
          {actions}
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
      </div>

      <div data-quote-acceptance-seam="true" />

      {superseded ? (
        <div
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          This quote has been superseded by a newer revision.
        </div>
      ) : null}
      {expired && quote.status !== "superseded" && !superseded ? (
        <div
          className="rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-800"
          role="status"
        >
          {quote.valid_until
            ? `This quote expired on ${formatPricingDate(quote.valid_until)}.`
            : "This quote has expired and is shown as a record only."}
        </div>
      ) : null}
      {quote.status === "accepted" && !superseded ? (
        <div
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
          role="status"
        >
          <p className="font-medium">Quote accepted</p>
          {acceptance?.source === "client" && acceptance.signer_name ? (
            <p className="mt-1">
              Accepted by {acceptance.signer_name}
              {acceptedAt ? ` · ${acceptedAt}` : ""}
            </p>
          ) : acceptedAt ? (
            <p className="mt-1">Accepted {acceptedAt}</p>
          ) : null}
          <p className="mt-1">Your acceptance has been recorded.</p>
        </div>
      ) : null}
      {quote.status === "declined" && !superseded ? (
        <div
          className="rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-800"
          role="status"
        >
          <p className="font-medium">Quote declined</p>
          {quote.declined_at && formatQuoteDateTime(quote.declined_at, displayTimeZone) ? (
            <p className="mt-1">
              {formatQuoteDateTime(quote.declined_at, displayTimeZone)}
            </p>
          ) : null}
          <p className="mt-1">Your response has been recorded.</p>
        </div>
      ) : null}
    </div>
  );
}
