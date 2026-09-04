"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { QuoteAcceptSheet } from "@/components/quotes/QuoteAcceptSheet";
import { QuoteDeclineSheet } from "@/components/quotes/QuoteDeclineSheet";
import { canClientAcceptQuote } from "@/lib/quotes/acceptance";
import { quoteDocumentViewModel } from "@/lib/quotes/financial-view-model";
import type { Quote } from "@/lib/quotes/types";

export function QuotePublicActions({
  quote,
  token,
  seedName,
  seedEmail,
  superseded,
}: {
  quote: Quote;
  token: string;
  seedName: string;
  seedEmail: string;
  superseded: boolean;
}) {
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const eligible = canClientAcceptQuote(quote) && !superseded;
  const view = quoteDocumentViewModel(quote);

  if (!eligible) return null;

  return (
    <>
      <div
        data-quote-public-actions="desktop"
        className="hidden print:hidden gap-2 sm:flex"
      >
        <Button type="button" className="h-11" onClick={() => setAcceptOpen(true)}>
          Accept quote
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-11 text-muted-foreground"
          onClick={() => setDeclineOpen(true)}
        >
          Decline
        </Button>
      </div>

      <div
        data-quote-public-actions="mobile"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-sm sm:hidden print:hidden"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 text-sm font-semibold tabular-nums">
            {view.showGst
              ? `${view.totalInclGstFormatted} incl GST`
              : view.totalInclGstFormatted}
          </p>
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="ghost"
              className="h-11 text-muted-foreground"
              onClick={() => setDeclineOpen(true)}
            >
              Decline
            </Button>
            <Button type="button" className="h-11" onClick={() => setAcceptOpen(true)}>
              Accept quote
            </Button>
          </div>
        </div>
      </div>

      <QuoteAcceptSheet
        key={`${token}:accept:${acceptOpen ? "open" : "closed"}`}
        quote={quote}
        token={token}
        seedName={seedName}
        seedEmail={seedEmail}
        open={acceptOpen}
        onOpenChange={setAcceptOpen}
      />
      <QuoteDeclineSheet
        key={`${token}:decline:${declineOpen ? "open" : "closed"}`}
        token={token}
        open={declineOpen}
        onOpenChange={setDeclineOpen}
      />
    </>
  );
}
