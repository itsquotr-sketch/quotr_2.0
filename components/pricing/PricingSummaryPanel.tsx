"use client";

import { pricingDocumentViewModel } from "@/lib/pricing/financial-view-model";
import type { PricingDocument } from "@/lib/pricing/types";
import type { QuoteSummary } from "@/lib/quotes/types";
import { CreateQuoteButton } from "@/components/quotes/CreateQuoteButton";
import { MetricRow } from "@/components/ui/metric-row";
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
  quoteSummary?: QuoteSummary | null;
  pricingChangedAfterQuote?: boolean;
  className?: string;
  compact?: boolean;
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
            ? "text-right text-lg font-semibold tracking-tight"
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
  quoteSummary = null,
  pricingChangedAfterQuote = false,
  className,
  compact = false,
}: PricingSummaryPanelProps) {
  const isReviewed = document.status === "reviewed";
  const view = pricingDocumentViewModel(document);

  return (
    <Card
      className={cn(
        "border-border/60 shadow-none lg:sticky lg:top-[4.5rem] lg:self-start",
        className
      )}
    >
      <CardHeader className={cn("pb-2", compact && "pb-1.5 pt-4")}>
        <CardTitle className="text-base">Pricing summary</CardTitle>
        <p className="text-xs text-muted-foreground">
          Internal pricing — not a client quote
        </p>
      </CardHeader>
      <CardContent className={cn("space-y-3", compact && "pt-0")}>
        <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-3">
          <SummaryRow
            label="Your final price"
            value={view.subtotalSellFormatted}
            prominent
          />
          {!compact ? (
            <>
              <MetricRow
                label="Estimated cost"
                value={view.subtotalCostFormatted}
                tertiary
              />
              <MetricRow
                label="Expected gross margin"
                value={view.marginLabel}
                tertiary
              />
            </>
          ) : (
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pt-1 text-xs text-muted-foreground">
              <span>Cost {view.subtotalCostFormatted}</span>
              <span>{view.marginLabel} gross margin</span>
            </div>
          )}
        </div>
        {view.showGst ? (
        <div className={cn("rounded-lg border border-border/60 bg-card px-3 py-3", !compact && "border-[var(--brand-orange-muted)]/60")}>
          <SummaryRow
            label={view.gstLabel}
            value={view.gstAmountFormatted}
          />
          <div className="mt-2 border-t border-border/60 pt-2">
            <SummaryRow
              label="Total incl. GST"
              value={view.totalInclGstFormatted}
              prominent
            />
          </div>
        </div>
        ) : (
          <div className="rounded-lg border border-border/60 bg-card px-3 py-3">
            <SummaryRow
              label="Total"
              value={view.totalInclGstFormatted}
              prominent
            />
          </div>
        )}

        <div className="hidden lg:block">
          <CreateQuoteButton
            projectId={projectId}
            pricingDocumentId={document.id}
            isReviewed={isReviewed}
            quoteSummary={quoteSummary}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {quoteSummary
              ? "Open the client quote created from this pricing."
              : isReviewed
                ? "Create a client-facing quote from this pricing."
                : "Mark pricing as reviewed before creating a quote."}
          </p>
        </div>
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
