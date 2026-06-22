"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CreateFinalPricingDialog } from "@/components/pricing/CreateFinalPricingDialog";

type PrepareFinalPricingButtonProps = {
  projectId: string;
  variant?: "default" | "outline";
  className?: string;
  label?: string;
};

export function PrepareFinalPricingButton({
  projectId,
  variant = "default",
  className,
  label = "Prepare final pricing",
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
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

type OpenFinalPricingLinkProps = {
  projectId: string;
  pricingDocumentId: string;
};

export function OpenFinalPricingLink({
  projectId,
  pricingDocumentId,
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
      Open final pricing
    </Button>
  );
}
