"use client";

import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPricingDate } from "@/lib/pricing/format";
import {
  formatQuoteNumberRevision,
  formatQuoteWorkspaceTitle,
} from "@/lib/quotes/display";
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

  return (
    <div className="space-y-2 border-b pb-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
              {formatQuoteWorkspaceTitle(quote.title)}
            </h1>
            <Badge variant={statusDef.variant}>{statusDef.label}</Badge>
          </div>
          <p className="text-sm font-medium text-foreground">
            {formatQuoteNumberRevision(quote)}
          </p>
          <p className="text-sm text-muted-foreground">
            {buildMetaLine(quote, projectTitle)}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
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
