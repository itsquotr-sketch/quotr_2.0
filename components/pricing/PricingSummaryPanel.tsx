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

type PricingSummaryPanelProps = {
  document: PricingDocument;
  projectId: string;
  quoteSummary?: QuoteSummary | null;
  pricingChangedAfterQuote?: boolean;
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
            : "text-right text-sm font-medium"
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
}: PricingSummaryPanelProps) {
  const isReviewed = document.status === "reviewed";

  return (
    <Card className="border-border/60 shadow-none lg:sticky lg:top-[4.5rem] lg:self-start">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Pricing summary</CardTitle>
        <p className="text-xs text-muted-foreground">
          Internal pricing — not a client quote
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <SummaryRow
          label="Total cost"
          value={formatPricingMoney(document.subtotal_cost)}
        />
        <SummaryRow
          label="Total charge"
          value={formatPricingMoney(document.subtotal_sell)}
          prominent
        />
        <SummaryRow
          label="Gross profit"
          value={formatPricingMoney(document.gross_profit)}
        />
        <SummaryRow
          label="Margin"
          value={formatPricingPercent(document.margin_percent)}
        />
        <div className="border-t pt-3">
          <SummaryRow
            label={`GST (${document.gst_rate}%)`}
            value={formatPricingMoney(document.gst_amount)}
          />
          <div className="mt-2">
            <SummaryRow
              label="Total incl. GST"
              value={formatPricingMoney(document.total_incl_gst)}
              prominent
            />
          </div>
        </div>

        <CreateQuoteButton
          projectId={projectId}
          pricingDocumentId={document.id}
          isReviewed={isReviewed}
          quoteSummary={quoteSummary}
        />
        <p className="text-xs text-muted-foreground">
          {quoteSummary
            ? "Open the client quote created from this pricing."
            : isReviewed
              ? "Create a client-facing quote from reviewed pricing."
              : "Mark pricing as reviewed before creating a client quote."}
        </p>
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
