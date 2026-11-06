"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { keepCurrentPricing, previewRecalibration } from "@/lib/pricing/recalibration";
import { RecalibrationPreviewPanel } from "@/components/pricing/RecalibrationPreviewPanel";
import type { RecalibrationPreview } from "@/lib/pricing/recalibration-helpers";
import type { PricingDocument, PricingItem } from "@/lib/pricing/types";

type RecalibrationBannerProps = {
  projectId: string;
  pricingDocumentId: string;
  needsRecalibration: boolean;
  documentMeaningDrift?: boolean;
  quoteExists: boolean;
  latestEstimateIsStale: boolean;
  onKeepCurrent: () => void;
  onApplied: (input: { document: PricingDocument; items: PricingItem[] }) => void;
  canEdit?: boolean;
};

export function RecalibrationBanner({
  projectId,
  pricingDocumentId,
  needsRecalibration,
  documentMeaningDrift = false,
  quoteExists,
  latestEstimateIsStale,
  onKeepCurrent,
  onApplied,
  canEdit = true,
}: RecalibrationBannerProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [keptMessage, setKeptMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<RecalibrationPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const offerUpdate = needsRecalibration || documentMeaningDrift;

  if (!offerUpdate && !keptMessage) {
    return null;
  }

  if (!offerUpdate && keptMessage) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        {keptMessage}
      </p>
    );
  }

  const handlePreviewOpen = () => {
    setError(null);
    setPreviewError(null);
    setPreview(null);
    setPreviewOpen(true);
    setPreviewLoading(true);

    startTransition(async () => {
      const result = await previewRecalibration({ projectId, pricingDocumentId });
      setPreviewLoading(false);
      if (result.error) {
        setPreviewError(result.error);
        return;
      }
      setPreview(result.preview ?? null);
    });
  };

  const handlePreviewClose = () => {
    setPreviewOpen(false);
    setPreview(null);
    setPreviewError(null);
    setPreviewLoading(false);
  };

  const handleKeepCurrent = () => {
    setError(null);
    startTransition(async () => {
      const result = await keepCurrentPricing({ projectId, pricingDocumentId });
      if (result.error) {
        setError(result.error);
        return;
      }
      setKeptMessage(
        "Current pricing kept. You can update from the latest estimate later if needed."
      );
      onKeepCurrent();
    });
  };

  return (
    <>
      <div
        className="space-y-3 rounded-lg border border-amber-300/80 bg-amber-50/90 px-4 py-3 dark:border-amber-800/60 dark:bg-amber-950/30"
        role="alert"
      >
        <div>
          <p className="text-sm font-medium text-amber-950 dark:text-amber-100">
            {needsRecalibration
              ? "This pricing was created from an earlier estimate. A newer estimate is available."
              : "Generated rows no longer match what should appear on the customer quote."}
          </p>
          {documentMeaningDrift ? (
            <p className="mt-2 text-sm text-amber-900/90 dark:text-amber-200/90">
              Preview changes includes a row whose quote visibility differs even
              when the price is unchanged. Update final pricing applies that
              for untouched generated rows.
            </p>
          ) : null}
          {quoteExists ? (
            <p className="mt-2 text-sm text-amber-900/90 dark:text-amber-200/90">
              Existing quotes are not updated automatically. Revise or create a
              new quote if needed.
            </p>
          ) : null}
          {latestEstimateIsStale ? (
            <p className="mt-2 text-sm font-medium text-destructive">
              Regenerate the estimate before updating final pricing.
            </p>
          ) : null}
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="touch"
              variant="outline"
              onClick={handlePreviewOpen}
              disabled={isPending || latestEstimateIsStale}
            >
              Preview changes
            </Button>
            {needsRecalibration ? (
              <Button
                type="button"
                size="touch"
                variant="ghost"
                onClick={handleKeepCurrent}
                disabled={isPending}
              >
                Keep current pricing
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {canEdit ? (
      <RecalibrationPreviewPanel
        open={previewOpen}
        onClose={handlePreviewClose}
        projectId={projectId}
        pricingDocumentId={pricingDocumentId}
        preview={preview}
        previewLoading={previewLoading}
        previewError={previewError}
        latestEstimateIsStale={latestEstimateIsStale}
        onApplied={(result) => {
          handlePreviewClose();
          onApplied(result);
        }}
      />
      ) : null}
    </>
  );
}
