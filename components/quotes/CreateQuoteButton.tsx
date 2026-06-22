"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useTransition } from "react";
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
    startTransition(async () => {
      await createQuoteFromPricing({ projectId, pricingDocumentId });
    });
  };

  return (
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
  );
}
