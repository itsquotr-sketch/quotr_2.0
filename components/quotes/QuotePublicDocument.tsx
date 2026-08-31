import { QuotePublicViewBeacon } from "@/components/quotes/QuotePublicViewBeacon";
import { QuoteTemplate } from "@/components/quotes/QuoteTemplate";
import { formatQuoteBadgeLabel } from "@/lib/quotes/status";
import { isQuoteExpired } from "@/lib/quotes/transaction";
import type { Quote, QuoteItem } from "@/lib/quotes/types";

export function QuotePublicDocument({
  quote,
  items,
  superseded,
  token,
}: {
  quote: Quote;
  items: QuoteItem[];
  superseded: boolean;
  token: string;
}) {
  const expired = isQuoteExpired(quote);
  const statusLabel = formatQuoteBadgeLabel(quote.status);

  return (
    <div className="mx-auto w-full max-w-[1040px] space-y-4 px-4 py-6">
      <div className="space-y-2 print:hidden">
        <p className="text-sm text-neutral-600">{statusLabel}</p>
        {superseded ? (
          <div
            className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            role="status"
          >
            This quote has been superseded by a newer revision.
          </div>
        ) : null}
        {expired && quote.status !== "superseded" ? (
          <div
            className="rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-800"
            role="status"
          >
            This quote has expired and is shown as a record only.
          </div>
        ) : null}
        {quote.status === "accepted" ? (
          <div
            className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
            role="status"
          >
            This quote was accepted.
          </div>
        ) : null}
        {quote.status === "declined" ? (
          <div
            className="rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-800"
            role="status"
          >
            This quote was declined and is shown as a record only.
          </div>
        ) : null}
      </div>
      <QuoteTemplate quote={quote} quoteItems={items} companySettings={null} />
      <QuotePublicViewBeacon token={token} />
    </div>
  );
}
