"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createQuoteFromPricing } from "@/lib/quotes/actions";
import type { QuoteSummary } from "@/lib/quotes/types";

type CreateQuoteButtonProps = {
  projectId: string;
  pricingDocumentId: string;
  isReviewed: boolean;
  quoteSummary: QuoteSummary | null;
};

export function CreateQuoteButton({
  projectId,
  pricingDocumentId,
  isReviewed,
  quoteSummary,
}: CreateQuoteButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (quoteSummary) {
    return (
      <Button
        type="button"
        className="w-full"
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
    startTransition(async () => {
      const result = await createQuoteFromPricing({ projectId, pricingDocumentId });
      if (result.error) {
        setError(result.error);
      }
    });
  };

  return (
    <div className="space-y-2">
      <Button
        type="button"
        className="w-full"
        disabled={!isReviewed || isPending}
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
          Mark final pricing as reviewed before creating a quote.
        </p>
      ) : null}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
