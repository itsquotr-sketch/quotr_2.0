"use client";

import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPricingDate } from "@/lib/pricing/format";
import { formatQuoteRevisionLabel } from "@/lib/quotes/revision";
import { getQuoteStatusDefinition } from "@/lib/quotes/status";
import type { Quote } from "@/lib/quotes/types";

type QuoteHeaderProps = {
  quote: Quote;
  projectTitle: string;
  isSaving?: boolean;
  onSave?: () => void;
};

function buildMetaLine(quote: Quote, projectTitle: string): string {
  const parts = [projectTitle];
  if (quote.client_name) parts.push(quote.client_name);
  if (quote.site_address) parts.push(quote.site_address);
  return parts.join(" · ");
}

export function QuoteHeader({
  quote,
  projectTitle,
  isSaving,
  onSave,
}: QuoteHeaderProps) {
  const statusDef = getQuoteStatusDefinition(quote.status);
  const revisionLabel = formatQuoteRevisionLabel({
    quote_number: quote.quote_number,
    revision_number: quote.revision_number,
  });

  return (
    <div className="space-y-3 border-b pb-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {quote.title}
            </h1>
            <Badge variant={statusDef.variant}>{statusDef.label}</Badge>
            {quote.revision_number > 1 ? (
              <Badge variant="outline" className="text-[10px]">
                Revision {quote.revision_number}
              </Badge>
            ) : null}
            {quote.status === "draft" ? (
              <Badge variant="outline" className="text-[10px]">
                Draft quote
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {buildMetaLine(quote, projectTitle)}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{revisionLabel}</span>
            {quote.issue_date ? (
              <span>Issued {formatPricingDate(quote.issue_date)}</span>
            ) : null}
            {quote.valid_until ? (
              <span>Valid until {formatPricingDate(quote.valid_until)}</span>
            ) : null}
          </div>
        </div>

        {onSave ? (
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={onSave}
            className="shrink-0"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-1.5 size-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
