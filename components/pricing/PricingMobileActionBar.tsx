"use client";

import { Loader2 } from "lucide-react";
import { CreateQuoteButton } from "@/components/quotes/CreateQuoteButton";
import { pricingDocumentViewModel } from "@/lib/pricing/financial-view-model";
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
  const view = pricingDocumentViewModel(document);

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur-sm md:hidden print:hidden",
        className
      )}
      data-pricing-mobile-action-bar="true"
    >
      <div className="mx-auto flex max-w-lg flex-col gap-3 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="min-w-0" data-pricing-mobile-total="true">
          <p className="text-[11px] font-medium text-muted-foreground">
            {view.showGst ? "Total incl. GST" : "Your final price"}
          </p>
          <p className="text-lg font-semibold tabular-nums tracking-tight">
            {view.showGst
              ? view.totalInclGstFormatted
              : view.subtotalSellFormatted}
          </p>
        </div>
        <div
          className="flex w-full flex-col gap-2"
          data-pricing-mobile-actions="true"
        >
          {needsRecalibration && onRecalibrate ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 min-h-11 w-full"
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
              presentation="bar"
            />
          ) : (
            <>
              {onSaveDocument ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-11 min-h-11 w-full"
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
                presentation="bar"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
