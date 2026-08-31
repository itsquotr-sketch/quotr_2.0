"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

type PricingReviewChecklistProps = {
  onMarkReviewed: () => Promise<void>;
  disabled?: boolean;
};

export function PricingReviewChecklist({
  onMarkReviewed,
  disabled = false,
}: PricingReviewChecklistProps) {
  const [reviewed, setReviewed] = useState(false);
  const [isReviewing, startReview] = useTransition();

  const handleMarkReviewed = () => {
    startReview(async () => {
      await onMarkReviewed();
    });
  };

  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex min-w-0 flex-1 items-start gap-2.5 text-sm">
          <Checkbox
            className="mt-0.5"
            checked={reviewed}
            disabled={disabled || isReviewing}
            onCheckedChange={(checked) => setReviewed(checked === true)}
          />
          <span>
            <span className="font-medium">Pricing reviewed</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              I have reviewed this pricing before creating a client quote.
            </span>
          </span>
        </label>

        <Button
          type="button"
          disabled={disabled || isReviewing || !reviewed}
          onClick={handleMarkReviewed}
          className="shrink-0"
        >
          {isReviewing ? (
            <>
              <Loader2 className="mr-1.5 size-4 animate-spin" />
              Marking…
            </>
          ) : (
            "Mark as reviewed"
          )}
        </Button>
      </div>
    </div>
  );
}
