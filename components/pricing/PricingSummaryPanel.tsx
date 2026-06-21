"use client";

import { formatPricingMoney, formatPricingPercent } from "@/lib/pricing/format";
import type { PricingDocument } from "@/lib/pricing/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type PricingSummaryPanelProps = {
  document: PricingDocument;
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

export function PricingSummaryPanel({ document }: PricingSummaryPanelProps) {
  const isReviewed = document.status === "reviewed";

  return (
    <Card className="lg:sticky lg:top-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Pricing summary</CardTitle>
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

        <Button type="button" className="mt-2 w-full" disabled>
          Create quote
        </Button>
        <p className="text-xs text-muted-foreground">
          {isReviewed
            ? "Pricing reviewed — quote creation coming in a future phase."
            : "Mark pricing as reviewed before creating a client quote."}
        </p>
      </CardContent>
    </Card>
  );
}
