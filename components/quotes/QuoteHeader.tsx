"use client";

import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { formatPricingDate } from "@/lib/pricing/format";
import {
  formatQuoteDateTime,
  formatQuoteNumberRevision,
  formatQuoteWorkspaceTitle,
} from "@/lib/quotes/display";
import { formatAcceptanceSourceLabel } from "@/lib/quotes/acceptance";
import { getQuoteStatusDefinition } from "@/lib/quotes/status";
import type { QuoteAcceptanceRecord } from "@/lib/quotes/acceptance-types";
import type { Quote } from "@/lib/quotes/types";

type QuoteHeaderProps = {
  quote: Quote;
  projectTitle: string;
  acceptance?: QuoteAcceptanceRecord | null;
  isSaving?: boolean;
  onSave?: () => void;
  timeZone?: string;
};

export function QuoteHeader({
  quote,
  acceptance = null,
  isSaving,
  onSave,
  hasUnsavedChanges = false,
  timeZone,
}: QuoteHeaderProps & { hasUnsavedChanges?: boolean }) {
  const statusDef = getQuoteStatusDefinition(quote.status);
  const workspaceTitle = formatQuoteWorkspaceTitle(quote.title);
  const quoteIdentity = workspaceTitle.startsWith("Quote — ")
    ? workspaceTitle.slice("Quote — ".length)
    : null;
  const context = [quote.client_name, quote.site_address].filter(Boolean).join(" · ");

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold leading-6 tracking-tight sm:text-xl">
              Quote
            </h2>
            <StatusBadge variant={statusDef.variant}>{statusDef.label}</StatusBadge>
          </div>
          <p className="text-sm font-medium text-foreground">
            {formatQuoteNumberRevision(quote)}
            {quoteIdentity ? ` · ${quoteIdentity}` : ""}
          </p>
          {context ? (
            <p className="text-xs text-muted-foreground">{context}</p>
          ) : null}
          <p className="text-sm text-muted-foreground">{statusDef.description}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {quote.issue_date ? (
              <span>Issued {formatPricingDate(quote.issue_date)}</span>
            ) : null}
            {quote.valid_until ? (
              <span>Valid until {formatPricingDate(quote.valid_until)}</span>
            ) : null}
            {quote.status === "accepted" && acceptance ? (
              <span>
                {acceptance.source === "client" && acceptance.signer_name
                  ? `Accepted by client ${acceptance.signer_name}`
                  : formatAcceptanceSourceLabel(acceptance.source)}
                {formatQuoteDateTime(acceptance.accepted_at, timeZone)
                  ? ` · ${formatQuoteDateTime(acceptance.accepted_at, timeZone)}`
                  : ""}
              </span>
            ) : null}
          </div>
        </div>

        {onSave && hasUnsavedChanges ? (
          <Button
            type="button"
            variant="outline"
            size="touch"
            disabled={isSaving}
            onClick={onSave}
            className="hidden shrink-0 xl:inline-flex"
          >
            {isSaving ? "Saving…" : "Save changes"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
