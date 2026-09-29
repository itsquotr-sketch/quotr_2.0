"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CreateFinalPricingDialog } from "@/components/pricing/CreateFinalPricingDialog";
import { cn } from "@/lib/utils";

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
  label = "Continue to Pricing",
}: PrepareFinalPricingButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        className={className}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <CreateFinalPricingDialog
        projectId={projectId}
        estimateId={estimateId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

type OpenFinalPricingLinkProps = {
  projectId: string;
  pricingDocumentId: string;
  variant?: "default" | "outline";
  className?: string;
  label?: string;
};

export function OpenFinalPricingLink({
  projectId,
  pricingDocumentId,
  variant = "outline",
  className,
  label = "Open Pricing",
}: OpenFinalPricingLinkProps) {
  return (
    <Button
      type="button"
      variant={variant}
      className={cn("w-full", className)}
      render={
        <Link href={`/app/projects/${projectId}/pricing/${pricingDocumentId}`} />
      }
    >
      {label}
    </Button>
  );
}
