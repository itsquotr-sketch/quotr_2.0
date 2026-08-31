"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatPricingDate } from "@/lib/pricing/format";
import { quoteDocumentViewModel } from "@/lib/quotes/financial-view-model";
import { formatQuoteReference } from "@/lib/quotes/display";
import { defaultQuoteDeliveryMessage } from "@/lib/quotes/delivery-message";
import { sendQuoteToClient, finalizeQuoteDelivery } from "@/lib/quotes/actions";
import type { Quote } from "@/lib/quotes/types";
import type { QuoteDeliveryRecord } from "@/lib/quotes/delivery-types";

type QuoteSendSheetProps = {
  quote: Quote;
  projectTitle: string;
  deliveries: QuoteDeliveryRecord[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "send" | "resend";
};

export function QuoteSendSheet({
  quote,
  projectTitle,
  deliveries,
  open,
  onOpenChange,
  mode,
}: QuoteSendSheetProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const latest = deliveries[0];
  const [recipientName, setRecipientName] = useState(
    latest?.recipient_name || quote.client_name || ""
  );
  const [recipientEmail, setRecipientEmail] = useState(
    latest?.recipient_email || ""
  );
  const defaultMessage = useMemo(
    () =>
      defaultQuoteDeliveryMessage({
        clientName: quote.client_name,
        projectTitle,
      }),
    [quote.client_name, projectTitle]
  );
  const [message, setMessage] = useState(latest?.message || defaultMessage);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const view = quoteDocumentViewModel(quote);

  const [needsFinalizeId, setNeedsFinalizeId] = useState<string | null>(
    deliveries.find((row) => row.status === "accepted")?.id ?? null
  );

  const submit = () => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await sendQuoteToClient({
        quoteId: quote.id,
        recipientName,
        recipientEmail,
        message,
      });
      if (result.needsFinalize) {
        setNeedsFinalizeId(result.deliveryId ?? null);
        setError("Email submitted — finalising Quote status.");
        router.refresh();
        return;
      }
      if (result.error) {
        setError(result.error);
        if (result.quoteIssued) router.refresh();
        return;
      }
      if (result.emailInProgress) {
        setSuccess("Send is already in progress.");
        router.refresh();
        return;
      }
      setNeedsFinalizeId(null);
      setSuccess(
        result.emailSubmitted
          ? `Quote sent to ${result.recipientEmail ?? recipientEmail}.`
          : "Quote issued."
      );
      router.refresh();
    });
  };

  const retryFinalize = () => {
    if (!needsFinalizeId) return;
    setError(null);
    startTransition(async () => {
      const result = await finalizeQuoteDelivery(needsFinalizeId);
      if (result.needsFinalize || result.error) {
        setError(
          result.error ?? "Email submitted — finalising Quote status."
        );
        return;
      }
      setNeedsFinalizeId(null);
      setSuccess("Quote status updated.");
      router.refresh();
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[100dvh] max-h-[100dvh] overflow-y-auto sm:h-auto sm:max-h-[90dvh] sm:max-w-lg sm:rounded-t-xl"
      >
        <SheetHeader>
          <SheetTitle>{mode === "resend" ? "Resend quote" : "Send quote"}</SheetTitle>
          <SheetDescription>
            Email a secure link to this exact revision. The quote snapshot will
            not change.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-6 pb-4">
          <div className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm">
            <p className="font-medium">{formatQuoteReference(quote)}</p>
            <p className="text-muted-foreground">
              Revision {quote.revision_number}
              {quote.valid_until
                ? ` · Valid until ${formatPricingDate(quote.valid_until)}`
                : ""}
            </p>
            <p className="mt-1 font-medium tabular-nums">
              Total incl. GST {view.totalInclGstFormatted}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quote-send-name">Recipient</Label>
            <Input
              id="quote-send-name"
              value={recipientName}
              onChange={(event) => setRecipientName(event.target.value)}
              autoComplete="name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quote-send-email">Email</Label>
            <Input
              id="quote-send-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={recipientEmail}
              onChange={(event) => setRecipientEmail(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quote-send-message">Message</Label>
            <Textarea
              id="quote-send-message"
              rows={5}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="text-sm text-green-700 dark:text-green-400" role="status">
              {success}
            </p>
          ) : null}
        </div>
        <SheetFooter className="flex flex-col gap-2">
          <Button
            type="button"
            className="h-11 w-full"
            disabled={isPending}
            onClick={submit}
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : mode === "resend" ? (
              "Resend quote"
            ) : (
              "Send quote"
            )}
          </Button>
          {needsFinalizeId ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full"
              disabled={isPending}
              onClick={retryFinalize}
            >
              Retry Quote status update
            </Button>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
