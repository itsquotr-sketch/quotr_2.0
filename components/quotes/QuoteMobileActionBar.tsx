"use client";

import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { mobileNavBottomClass } from "@/components/layout/mobile-nav-metrics";
import { cn } from "@/lib/utils";
import type { Quote } from "@/lib/quotes/types";
import { canMarkQuoteAccepted } from "@/lib/quotes/transaction";

type QuoteMobileActionBarProps = {
  quote: Quote;
  isSaving?: boolean;
  isRevising?: boolean;
  isStatusPending?: boolean;
  canSave?: boolean;
  hasUnsavedChanges?: boolean;
  onSave?: () => void;
  onPrint: () => void;
  viewMode?: "review" | "preview";
  onShowReview?: () => void;
  onShowPreview?: () => void;
  reviewLabel?: string;
  onRefreshFromPricing?: () => void;
  refreshLabel?: string;
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
  hasUnsavedChanges = false,
  onSave,
  onPrint,
  viewMode = "review",
  onShowReview,
  onShowPreview,
  reviewLabel = "Finalise",
  onRefreshFromPricing,
  refreshLabel,
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
        "fixed inset-x-0 z-40 flex gap-2 border-t bg-background/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-sm xl:hidden print:hidden md:bottom-0",
        mobileNavBottomClass,
        className
      )}
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          type="button"
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium"
          disabled={busy}
          aria-label="More actions"
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-48">
          <DropdownMenuItem className="min-h-11" onClick={onPrint}>
            Print / Save as PDF
          </DropdownMenuItem>
          {onRefreshFromPricing && refreshLabel ? (
            <DropdownMenuItem className="min-h-11" onClick={onRefreshFromPricing}>
              {refreshLabel}
            </DropdownMenuItem>
          ) : null}
          {viewMode === "preview" ? (
            <DropdownMenuItem className="min-h-11" onClick={onShowReview}>
              {reviewLabel}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem className="min-h-11" onClick={onShowPreview}>
              Client preview
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {canSave && hasUnsavedChanges && onSave ? (
        <Button
          type="button"
          variant={showSend ? "outline" : "default"}
          className="h-11 min-w-0 flex-1"
          disabled={busy}
          onClick={onSave}
        >
          {isSaving ? "Saving…" : "Save changes"}
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
      ) : null}
    </div>
  );
}
