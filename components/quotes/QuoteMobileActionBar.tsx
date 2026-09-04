"use client";

import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Quote } from "@/lib/quotes/types";
import { canMarkQuoteAccepted } from "@/lib/quotes/transaction";

type QuoteMobileActionBarProps = {
  quote: Quote;
  isSaving?: boolean;
  isRevising?: boolean;
  isStatusPending?: boolean;
  canSave?: boolean;
  onSave?: () => void;
  onPrint: () => void;
  onSendQuote?: () => void;
  onResendQuote?: () => void;
  onMarkAccepted?: () => void;
  className?: string;
};

export function QuoteMobileActionBar({
  quote,
  isSaving = false,
  isRevising = false,
  isStatusPending = false,
  canSave = false,
  onSave,
  onPrint,
  onSendQuote,
  onResendQuote,
  onMarkAccepted,
  className,
}: QuoteMobileActionBarProps) {
  const busy = isSaving || isRevising || isStatusPending;
  const showSend = Boolean(onSendQuote);
  const showResend = Boolean(onResendQuote) && !showSend;
  const showMarkAccepted =
    canMarkQuoteAccepted(quote.status) &&
    quote.status !== "accepted" &&
    onMarkAccepted;

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t bg-background/95 p-3 backdrop-blur-sm xl:hidden print:hidden",
        className
      )}
    >
      <Button
        type="button"
        variant="outline"
        className="h-11 shrink-0 px-3"
        onClick={onPrint}
        disabled={busy}
        aria-label="Print or save as PDF"
      >
        <Printer className="size-4" />
      </Button>

      {canSave && onSave ? (
        <Button
          type="button"
          variant={showSend ? "outline" : "default"}
          className="h-11 min-w-0 flex-1"
          disabled={busy}
          onClick={onSave}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save quote"
          )}
        </Button>
      ) : null}
      {showSend ? (
        <Button
          type="button"
          className="h-11 min-w-0 flex-1"
          disabled={busy}
          onClick={onSendQuote}
        >
          Send quote
        </Button>
      ) : null}
      {showResend ? (
        <Button
          type="button"
          variant={canSave ? "outline" : "default"}
          className="h-11 min-w-0 flex-1"
          disabled={busy}
          onClick={onResendQuote}
        >
          Resend
        </Button>
      ) : null}
      {!showSend && !showResend && showMarkAccepted ? (
        <Button
          type="button"
          variant="outline"
          className="h-11 min-w-0 flex-1"
          disabled={busy}
          onClick={onMarkAccepted}
        >
          Mark accepted manually
        </Button>
      ) : !canSave && !showSend && !showResend && !showMarkAccepted ? (
        <Button
          type="button"
          variant="secondary"
          className="h-11 min-w-0 flex-1"
          disabled
        >
          {quote.status === "accepted"
            ? "Accepted"
            : quote.status === "declined"
              ? "Declined"
              : quote.status === "viewed"
                ? "Viewed"
                : quote.status === "sent"
                  ? "Sent"
                  : quote.status === "superseded"
                    ? "Superseded"
                    : "View actions above"}
        </Button>
      ) : null}
    </div>
  );
}
