"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

const CHECKLIST_ITEMS = [
  { key: "scope", label: "Scope reviewed" },
  { key: "quantities", label: "Quantities checked" },
  { key: "subcontractors", label: "Subcontractor allowances checked" },
  { key: "terms", label: "Terms / exclusions reviewed" },
] as const;

type ReviewCheckKey = (typeof CHECKLIST_ITEMS)[number]["key"];

type PricingReviewChecklistProps = {
  onMarkReviewed: () => Promise<void>;
  disabled?: boolean;
};

export function PricingReviewChecklist({
  onMarkReviewed,
  disabled = false,
}: PricingReviewChecklistProps) {
  const [checks, setChecks] = useState<Record<ReviewCheckKey, boolean>>({
    scope: false,
    quantities: false,
    subcontractors: false,
    terms: false,
  });
  const [isReviewing, startReview] = useTransition();

  const allComplete = Object.values(checks).every(Boolean);

  const handleMarkReviewed = () => {
    startReview(async () => {
      await onMarkReviewed();
    });
  };

  return (
    <div className="rounded-xl border bg-card px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-3">
          <div>
            <p className="text-sm font-medium">Pricing sign-off</p>
            <p className="text-xs text-muted-foreground">
              Complete the checklist before marking pricing as reviewed.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {CHECKLIST_ITEMS.map((item) => (
              <label
                key={item.key}
                className="flex items-center gap-2 text-sm"
              >
                <Checkbox
                  checked={checks[item.key]}
                  disabled={disabled || isReviewing}
                  onCheckedChange={(checked) =>
                    setChecks((current) => ({
                      ...current,
                      [item.key]: checked === true,
                    }))
                  }
                />
                {item.label}
              </label>
            ))}
          </div>
          {!allComplete ? (
            <p className="text-xs text-muted-foreground">
              Complete the review checklist before marking pricing as reviewed.
            </p>
          ) : null}
        </div>

        <Button
          type="button"
          disabled={disabled || isReviewing || !allComplete}
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
