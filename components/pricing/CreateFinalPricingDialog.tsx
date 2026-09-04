"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BillingAccessDenied } from "@/components/billing/BillingAccessDenied";
import { createPricingFromEstimate } from "@/lib/pricing/actions";

type CreateFinalPricingDialogProps = {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateFinalPricingDialog({
  projectId,
  open,
  onOpenChange,
}: CreateFinalPricingDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [denial, setDenial] = useState<{
    reasonCode?: string;
    upgradeTarget?: "builder" | "business" | "builder_or_business" | null;
  } | null>(null);

  const handleCreate = () => {
    setError(null);
    setDenial(null);
    startTransition(async () => {
      const result = await createPricingFromEstimate({ projectId });
      if (result.error) {
        setError(result.error);
        if (result.reasonCode) {
          setDenial({
            reasonCode: result.reasonCode,
            upgradeTarget: result.upgradeTarget,
          });
        }
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Continue to Pricing?</DialogTitle>
          <DialogDescription>
            Pricing is where you decide what to charge. Quotr’s estimate stays
            as the working recommendation. You can still adjust Work Area
            prices before creating a quote.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          denial ? (
            <BillingAccessDenied
              error={error}
              reasonCode={denial.reasonCode}
              upgradeTarget={denial.upgradeTarget}
            />
          ) : (
            <p className="text-sm text-destructive" role="alert">{error}</p>
          )
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={isPending} onClick={handleCreate}>
            {isPending ? "Creating…" : "Continue to Pricing"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
