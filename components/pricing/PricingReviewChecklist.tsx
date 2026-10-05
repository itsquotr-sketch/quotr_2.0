"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

type PricingReviewChecklistProps = {
  onMarkReviewed: () => Promise<void>;
  disabled?: boolean;
  pendingLabel?: string | null;
  blockedReason?: string | null;
};

export function PricingReviewChecklist({
  onMarkReviewed,
  disabled = false,
  pendingLabel = null,
  blockedReason = null,
}: PricingReviewChecklistProps) {
  const [reviewed, setReviewed] = useState(false);
  const isReviewing = pendingLabel != null;

  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      {blockedReason ? (
        <p className="mb-3 text-sm text-amber-950" data-manual-pricing-review-block="true">
          {blockedReason}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex min-w-0 flex-1 items-start gap-2.5 text-sm">
          <Checkbox
            className="mt-0.5"
            checked={reviewed}
            disabled={disabled || isReviewing || Boolean(blockedReason)}
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
          disabled={disabled || isReviewing || !reviewed || Boolean(blockedReason)}
          onClick={() => {
            void onMarkReviewed();
          }}
          className="h-11 min-h-11 shrink-0"
        >
          {pendingLabel ?? "Mark as reviewed"}
        </Button>
      </div>
    </div>
  );
}
