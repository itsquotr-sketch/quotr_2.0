"use client";

import { formatPricingMoney, formatPricingPercent } from "@/lib/pricing/format";
import type { PricingDocument } from "@/lib/pricing/types";
import type { QuoteSummary } from "@/lib/quotes/types";
import { CreateQuoteButton } from "@/components/quotes/CreateQuoteButton";
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
          {!compact ? (
            <>
              <SummaryRow
                label="Total cost"
                value={formatPricingMoney(document.subtotal_cost)}
              />
              <SummaryRow
                label="Total charge"
                value={formatPricingMoney(document.subtotal_sell)}
              />
              <SummaryRow
                label="Gross profit"
                value={formatPricingMoney(document.gross_profit)}
              />
              <SummaryRow
                label="Margin"
                value={formatPricingPercent(document.margin_percent)}
              />
            </>
          ) : (
            <SummaryRow
              label="Total charge"
              value={formatPricingMoney(document.subtotal_sell)}
              prominent
            />
          )}
        </div>
        <div className={cn("rounded-lg border border-border/60 bg-card px-3 py-3", !compact && "border-[var(--brand-orange-muted)]/60")}>
          {!compact ? (
            <SummaryRow
              label={`GST (${document.gst_rate}%)`}
              value={formatPricingMoney(document.gst_amount)}
            />
          ) : null}
          <div className={cn(!compact && "mt-2 border-t border-border/60 pt-2")}>
            <SummaryRow
              label="Total incl. GST"
              value={formatPricingMoney(document.total_incl_gst)}
              prominent
            />
          </div>
        </div>

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
                ? "Create a client-facing quote from reviewed pricing."
                : "Mark pricing as reviewed before creating a client quote."}
          </p>
        </div>
        {pricingChangedAfterQuote ? (
          <p className="text-xs text-amber-800 dark:text-amber-200">
            Existing quotes are not updated automatically. Revise or create a
            new quote if needed.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
