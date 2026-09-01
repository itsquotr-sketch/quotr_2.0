"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { quoteDocumentViewModel } from "@/lib/quotes/financial-view-model";
import {
  canMarkQuoteAccepted,
  canMarkQuoteDeclined,
  canMarkQuoteExpired,
  canMarkQuoteSent,
} from "@/lib/quotes/transaction";
import type { Quote } from "@/lib/quotes/types";

type QuoteSummaryPanelProps = {
  quote: Quote;
  onSendQuote?: () => void;
  onResendQuote?: () => void;
  onMarkSent?: () => Promise<{ error?: string }>;
  onMarkAccepted?: () => Promise<{ error?: string }>;
  onMarkDeclined?: () => Promise<{ error?: string }>;
  onMarkExpired?: () => Promise<{ error?: string }>;
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

export function QuoteSummaryPanel({
  quote,
  onSendQuote,
  onResendQuote,
  onMarkSent,
  onMarkAccepted,
  onMarkDeclined,
  onMarkExpired,
}: QuoteSummaryPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [statusError, setStatusError] = useState<string | null>(null);
  const view = quoteDocumentViewModel(quote);

  const runAction = (action?: () => Promise<{ error?: string }>) => {
    if (!action) return;
    setStatusError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) {
        setStatusError(result.error);
      }
    });
  };

  const canMarkSent = canMarkQuoteSent(quote.status) && quote.status === "draft";
  const canMarkAccepted = canMarkQuoteAccepted(quote.status) && quote.status !== "accepted";
  const canMarkDeclined = canMarkQuoteDeclined(quote.status) && quote.status !== "declined";
  const canMarkExpired = canMarkQuoteExpired(quote.status) && quote.status !== "expired";

  return (
    <Card className="border-border/60 shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Quote summary</CardTitle>
        <p className="text-xs text-muted-foreground">
          Client-facing totals (GST exclusive subtotal)
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <SummaryRow label="Subtotal" value={view.subtotalFormatted} />
        <SummaryRow
          label={view.gstLabel}
          value={view.gstAmountFormatted}
        />
        <div className="border-t pt-3">
          <SummaryRow
            label="Total incl. GST"
            value={view.totalInclGstFormatted}
            prominent
          />
        </div>

        <div className="space-y-2 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">
            Status actions
          </p>
          {statusError ? (
            <p className="text-xs text-destructive" role="alert">
              {statusError}
            </p>
          ) : null}
          {onSendQuote ? (
            <Button
              type="button"
              className="w-full"
              disabled={isPending}
              onClick={onSendQuote}
            >
              Send quote
            </Button>
          ) : null}
          {onResendQuote ? (
            <Button
              type="button"
              className="w-full"
              disabled={isPending}
              onClick={onResendQuote}
            >
              Resend quote
            </Button>
          ) : null}
          {canMarkSent && onMarkSent ? (
            <Button
              type="button"
              variant="ghost"
              className="w-full text-muted-foreground"
              disabled={isPending}
              onClick={() => runAction(onMarkSent)}
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Mark sent without email"
              )}
            </Button>
          ) : null}
          {canMarkAccepted && onMarkAccepted ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={isPending}
              onClick={() => runAction(onMarkAccepted)}
            >
              Mark accepted
            </Button>
          ) : null}
          {canMarkDeclined && onMarkDeclined ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={isPending}
              onClick={() => runAction(onMarkDeclined)}
            >
              Mark declined
            </Button>
          ) : null}
          {canMarkExpired && onMarkExpired ? (
            <Button
              type="button"
              variant="ghost"
              className="w-full text-muted-foreground"
              disabled={isPending}
              onClick={() => runAction(onMarkExpired)}
            >
              Mark expired
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
