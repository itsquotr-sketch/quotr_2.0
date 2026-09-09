"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { BillingAccessDenied } from "@/components/billing/BillingAccessDenied";
import { Button } from "@/components/ui/button";
import { createQuoteFromPricing } from "@/lib/quotes/actions";
import type { QuoteSummary } from "@/lib/quotes/types";
import { cn } from "@/lib/utils";

type CreateQuoteButtonProps = {
  projectId: string;
  pricingDocumentId: string;
  isReviewed: boolean;
  quoteSummary: QuoteSummary | null;
  presentation?: "default" | "bar";
};

export function CreateQuoteButton({
  projectId,
  pricingDocumentId,
  isReviewed,
  quoteSummary,
  presentation = "default",
}: CreateQuoteButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [denial, setDenial] = useState<{
    reasonCode?: string;
    upgradeTarget?: "builder" | "business" | "builder_or_business" | null;
  } | null>(null);

  const prominent = presentation === "bar" || isReviewed;

  if (quoteSummary) {
    return (
      <Button
        type="button"
        className={cn("w-full", prominent && "h-11 min-h-11")}
        render={
          <Link href={`/app/projects/${projectId}/quotes/${quoteSummary.id}`} />
        }
      >
        Open quote
      </Button>
    );
  }

  const handleCreate = () => {
    setError(null);
    setDenial(null);
    startTransition(async () => {
      const result = await createQuoteFromPricing({ projectId, pricingDocumentId });
      if (result.error) {
        setError(result.error);
        if (result.reasonCode) {
          setDenial({
            reasonCode: result.reasonCode,
            upgradeTarget: result.upgradeTarget,
          });
        }
      }
    });
  };

  return (
    <div className="space-y-2">
      <Button
        type="button"
        className={cn(
          "w-full",
          prominent && "h-11 min-h-11",
          isReviewed && presentation !== "bar" && "font-semibold"
        )}
        disabled={!isReviewed || isPending}
        data-pricing-create-quote-ready={isReviewed ? "true" : "false"}
        onClick={handleCreate}
      >
        {isPending ? (
          <>
            <Loader2 className="mr-1.5 size-4 animate-spin" />
            Creating quote…
          </>
        ) : (
          "Create quote"
        )}
      </Button>
      {!isReviewed ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Mark pricing as reviewed before creating a quote.
        </p>
      ) : null}
      {error ? (
        denial ? (
          <BillingAccessDenied
            error={error}
            reasonCode={denial.reasonCode}
            upgradeTarget={denial.upgradeTarget}
          />
        ) : (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )
      ) : null}
    </div>
  );
}
