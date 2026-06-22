"use client";

import { Loader2 } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatPricingMoney } from "@/lib/pricing/format";
import type { Quote } from "@/lib/quotes/types";

type QuoteSummaryPanelProps = {
  quote: Quote;
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
  onMarkSent,
  onMarkAccepted,
  onMarkDeclined,
  onMarkExpired,
}: QuoteSummaryPanelProps) {
  const [isPending, startTransition] = useTransition();

  const runAction = (action?: () => Promise<{ error?: string }>) => {
    if (!action) return;
    startTransition(async () => {
      await action();
    });
  };

  const canMarkSent = quote.status === "draft" || quote.status === "revised";
  const canMarkAccepted =
    quote.status === "sent" || quote.status === "draft";
  const canMarkDeclined =
    quote.status === "sent" || quote.status === "draft";
  const canMarkExpired = quote.status === "sent";

  return (
    <Card className="border-border/60 shadow-none lg:sticky lg:top-[4.5rem] lg:self-start">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Quote summary</CardTitle>
        <p className="text-xs text-muted-foreground">
          Client-facing totals (GST exclusive subtotal)
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <SummaryRow label="Subtotal" value={formatPricingMoney(quote.subtotal)} />
        <SummaryRow
          label={`GST (${quote.gst_rate}%)`}
          value={formatPricingMoney(quote.gst_amount)}
        />
        <div className="border-t pt-3">
          <SummaryRow
            label="Total incl. GST"
            value={formatPricingMoney(quote.total_incl_gst)}
            prominent
          />
        </div>

        <div className="space-y-2 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">
            Status actions
          </p>
          {canMarkSent && onMarkSent ? (
            <Button
              type="button"
              className="w-full"
              disabled={isPending}
              onClick={() => runAction(onMarkSent)}
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Mark as sent"
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
          {quote.status === "sent" ? (
            <p className="text-xs text-muted-foreground">
              Sent {quote.sent_at ? new Date(quote.sent_at).toLocaleDateString("en-NZ") : ""}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
