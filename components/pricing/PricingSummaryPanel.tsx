"use client";

import {
  pricingDocumentViewModel,
  pricingItemViewModel,
} from "@/lib/pricing/financial-view-model";
import type { PricingDocument, PricingItem } from "@/lib/pricing/types";
import type { QuoteSummary } from "@/lib/quotes/types";
import { CreateQuoteButton } from "@/components/quotes/CreateQuoteButton";
import {
  CEILINGS_QUOTE_PR_BLOCK_MESSAGE,
  nestedCeilingsQuoteIsBlocked,
} from "@/lib/estimate/ceilings-quote-readiness";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PricingSummaryPanelProps = {
  document: PricingDocument;
  projectId: string;
  items?: PricingItem[];
  quoteSummary?: QuoteSummary | null;
  pricingChangedAfterQuote?: boolean;
  className?: string;
  compact?: boolean;
  canEdit?: boolean;
};

function SummaryRow({
  label,
  value,
  prominent,
}: {
  label: string;
  value: string;
  prominent?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={
          prominent
            ? "text-right text-lg font-semibold tabular-nums tracking-tight"
            : "text-right text-sm font-medium tabular-nums"
        }
      >
        {value}
      </span>
    </div>
  );
}

export function PricingSummaryPanel({
  document,
  projectId,
  items = [],
  quoteSummary = null,
  pricingChangedAfterQuote = false,
  className,
  compact = false,
  canEdit = true,
}: PricingSummaryPanelProps) {
  const isReviewed = document.status === "reviewed";
  const view = pricingDocumentViewModel(document);
  const pricingRequiredCount = items.filter(
    (item) => pricingItemViewModel(item).pricingRequired
  ).length;
  const costValue = view.costKnown ? view.subtotalCostFormatted : "Pricing required";
  const quoteBlockedReason = nestedCeilingsQuoteIsBlocked({ items })
    ? CEILINGS_QUOTE_PR_BLOCK_MESSAGE
    : null;

  return (
    <Card
      className={cn(
        "h-auto border-border/60 shadow-none [--card-spacing:--spacing(3)] lg:sticky lg:top-4 lg:self-start",
        className
      )}
      data-pricing-commercial-summary="true"
    >
      <CardHeader className="gap-1 pb-2">
        <CardTitle className="text-base font-semibold">Commercial summary</CardTitle>
        <p className="text-xs leading-4 text-foreground/70">
          Internal pricing. Expected margin is not realised profit.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="space-y-2">
          <SummaryRow
            label={view.showGst ? "Client sell ex GST" : "Client sell"}
            value={pricingRequiredCount > 0 && !view.costKnown ? "Pricing required" : view.subtotalSellFormatted}
            prominent
          />
          {compact && view.showGst ? (
            <SummaryRow
              label="Client sell incl GST"
              value={view.totalInclGstFormatted}
              prominent
            />
          ) : null}
          {pricingRequiredCount > 0 ? (
            <p className="text-xs leading-4 text-foreground/75" data-pricing-summary-required>
              {pricingRequiredCount} Pricing required
            </p>
          ) : null}
          {compact ? (
            <details className="text-sm">
              <summary className="cursor-pointer py-2 text-xs font-medium leading-4 text-foreground/75">
                Cost, margin and GST
              </summary>
              <div className="space-y-2 pt-1">
                <SummaryRow label="Direct cost" value={costValue} />
                <SummaryRow label="Expected gross margin" value={view.marginLabel} />
                {view.showGst ? (
                  <SummaryRow label={view.gstLabel} value={view.gstAmountFormatted} />
                ) : null}
              </div>
            </details>
          ) : (
            <>
              <SummaryRow label="Direct cost" value={costValue} />
              <SummaryRow label="Expected gross margin" value={view.marginLabel} />
              {view.showGst ? (
                <>
                  <SummaryRow label={view.gstLabel} value={view.gstAmountFormatted} />
                  <SummaryRow label="Client sell incl GST" value={view.totalInclGstFormatted} prominent />
                </>
              ) : null}
            </>
          )}
        </div>

        {compact || (!canEdit && !quoteSummary) ? null : (
          <div
            className={cn(
              isReviewed &&
                !quoteSummary &&
                !quoteBlockedReason &&
                "rounded-lg border border-border bg-muted/30 p-3"
            )}
            data-pricing-desktop-quote-cta={
              quoteSummary
                ? "open"
                : isReviewed && !quoteBlockedReason
                  ? "create"
                  : "blocked"
            }
          >
            {isReviewed && !quoteSummary && !quoteBlockedReason ? (
              <p className="mb-2.5 text-sm font-medium tracking-tight">
                Next: Create quote
              </p>
            ) : null}
            <CreateQuoteButton
              projectId={projectId}
              pricingDocumentId={document.id}
              isReviewed={isReviewed}
              quoteSummary={quoteSummary}
              quoteBlockedReason={quoteBlockedReason}
            />
            {quoteSummary ? (
              <p className="mt-2 text-xs text-muted-foreground">
                The Quote is a separate snapshot. Changes to Pricing will not update it.
              </p>
            ) : isReviewed && !quoteBlockedReason ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Create a client-facing quote from this pricing.
              </p>
            ) : null}
          </div>
        )}
        {pricingChangedAfterQuote ? (
          <p className="text-xs text-amber-800 dark:text-amber-200">
          Existing quotes are not updated automatically. Create a revision if
          you need to send an updated quote.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
