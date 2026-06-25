"use client";

import { Loader2 } from "lucide-react";
import { CreateQuoteButton } from "@/components/quotes/CreateQuoteButton";
import { formatPricingMoney } from "@/lib/pricing/format";
import type { PricingDocument } from "@/lib/pricing/types";
import type { QuoteSummary } from "@/lib/quotes/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PricingMobileActionBarProps = {
  document: PricingDocument;
  projectId: string;
  quoteSummary?: QuoteSummary | null;
  isSaving?: boolean;
  needsRecalibration?: boolean;
  onSaveDocument?: () => void;
  onRecalibrate?: () => void;
  className?: string;
};

export function PricingMobileActionBar({
  document,
  projectId,
  quoteSummary = null,
  isSaving = false,
  needsRecalibration = false,
  onSaveDocument,
  onRecalibrate,
  className,
}: PricingMobileActionBarProps) {
  const isReviewed = document.status === "reviewed";

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur-sm md:hidden print:hidden",
        className
      )}
    >
      <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-muted-foreground">
            Total incl. GST
          </p>
          <p className="text-lg font-semibold tabular-nums tracking-tight">
            {formatPricingMoney(document.total_incl_gst)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          {needsRecalibration && onRecalibrate ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9"
              onClick={onRecalibrate}
            >
              Recalibrate
            </Button>
          ) : quoteSummary ? (
            <CreateQuoteButton
              projectId={projectId}
              pricingDocumentId={document.id}
              isReviewed={isReviewed}
              quoteSummary={quoteSummary}
            />
          ) : (
            <>
              {onSaveDocument ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9"
                  disabled={isSaving}
                  onClick={onSaveDocument}
                >
                  {isSaving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Save"
                  )}
                </Button>
              ) : null}
              <CreateQuoteButton
                projectId={projectId}
                pricingDocumentId={document.id}
                isReviewed={isReviewed}
                quoteSummary={quoteSummary}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
