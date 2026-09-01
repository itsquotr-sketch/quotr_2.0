"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  formatQuoteNumberRevision,
} from "@/lib/quotes/display";
import { defaultQuoteDeliveryMessage } from "@/lib/quotes/delivery-message";
import { sendQuoteToClient, finalizeQuoteDelivery } from "@/lib/quotes/actions";
import { useIsDesktop } from "@/lib/hooks/use-media-query";
import type { Quote } from "@/lib/quotes/types";
import type { QuoteDeliveryRecord } from "@/lib/quotes/delivery-types";

type QuoteSendSheetProps = {
  quote: Quote;
  projectTitle: string;
  projectClientEmail: string | null;
  deliveries: QuoteDeliveryRecord[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "send" | "resend";
};

function SendFields({
  quote,
  projectTitle,
  recipientName,
  setRecipientName,
  recipientEmail,
  setRecipientEmail,
  message,
  setMessage,
  error,
  success,
}: {
  quote: Quote;
  projectTitle: string;
  recipientName: string;
  setRecipientName: (value: string) => void;
  recipientEmail: string;
  setRecipientEmail: (value: string) => void;
  message: string;
  setMessage: (value: string) => void;
  error: string | null;
  success: string | null;
}) {
  const view = quoteDocumentViewModel(quote);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="quote-send-name">Client</Label>
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
      <div
        className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm"
        data-quote-send-summary="true"
      >
        <p className="font-medium">{formatQuoteNumberRevision(quote)}</p>
        <p className="text-muted-foreground">{projectTitle}</p>
        <p className="mt-1 font-medium tabular-nums">
          {view.totalInclGstFormatted} incl GST
        </p>
        {quote.valid_until ? (
          <p className="text-muted-foreground">
            Valid until {formatPricingDate(quote.valid_until)}
          </p>
        ) : null}
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
  );
}

export function QuoteSendSheet({
  quote,
  projectTitle,
  projectClientEmail,
  deliveries,
  open,
  onOpenChange,
  mode,
}: QuoteSendSheetProps) {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const [isPending, startTransition] = useTransition();
  const latest = deliveries[0];
  const defaultMessage = useMemo(
    () =>
      defaultQuoteDeliveryMessage({
        clientName: quote.client_name,
        projectTitle,
      }),
    [quote.client_name, projectTitle]
  );
  const [recipientName, setRecipientName] = useState(quote.client_name || "");
  const [recipientEmail, setRecipientEmail] = useState(
    latest?.recipient_email || projectClientEmail || ""
  );
  const [message, setMessage] = useState(latest?.message || defaultMessage);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
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

  const title = mode === "resend" ? "Resend quote" : "Send quote";
  const description =
    "Email a secure link to this exact revision. The quote snapshot will not change.";
  const fields = (
    <SendFields
      quote={quote}
      projectTitle={projectTitle}
      recipientName={recipientName}
      setRecipientName={setRecipientName}
      recipientEmail={recipientEmail}
      setRecipientEmail={setRecipientEmail}
      message={message}
      setMessage={setMessage}
      error={error}
      success={success}
    />
  );
  const actions = (
    <>
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
    </>
  );

  const dialogOpen = open && isDesktop;
  const sheetOpen = open && !isDesktop;

  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={onOpenChange}>
        <DialogContent
          data-quote-send-mode="dialog"
          className="max-h-[90vh] overflow-y-auto sm:max-w-[36rem]"
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {fields}
          <DialogFooter className="flex flex-col gap-2 sm:flex-col">
            {actions}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Sheet open={sheetOpen} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          data-quote-send-mode="sheet"
          className="h-[100dvh] max-h-[100dvh] overflow-y-auto sm:h-auto sm:max-h-[90dvh]"
        >
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>
          <div className="px-6 pb-4">{fields}</div>
          <SheetFooter className="flex flex-col gap-2">{actions}</SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
