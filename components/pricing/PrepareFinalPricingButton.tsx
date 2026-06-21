"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPricingFromEstimate } from "@/lib/pricing/actions";

type PrepareFinalPricingButtonProps = {
  projectId: string;
  estimateId?: string;
  variant?: "default" | "outline";
  className?: string;
  label?: string;
};

export function PrepareFinalPricingButton({
  projectId,
  estimateId,
  variant = "default",
  className,
  label = "Prepare final pricing",
}: PrepareFinalPricingButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const result = await createPricingFromEstimate({ projectId, estimateId });
      if (result.error) {
        alert(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <Button
      type="button"
      variant={variant}
      className={className}
      disabled={isPending}
      onClick={handleClick}
    >
      {isPending ? (
        <>
          <Loader2 className="mr-1.5 size-4 animate-spin" />
          Preparing…
        </>
      ) : (
        label
      )}
    </Button>
  );
}

type OpenFinalPricingLinkProps = {
  projectId: string;
  pricingDocumentId: string;
  reviewed?: boolean;
};

export function OpenFinalPricingLink({
  projectId,
  pricingDocumentId,
  reviewed = false,
}: OpenFinalPricingLinkProps) {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      render={
        <Link href={`/app/projects/${projectId}/pricing/${pricingDocumentId}`} />
      }
    >
      {reviewed ? "Open final pricing" : "Open final pricing"}
    </Button>
  );
}
