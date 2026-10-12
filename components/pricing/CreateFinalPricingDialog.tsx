"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
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
  estimateId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Saved quantities disagree with the stated count. Creating Pricing stays disabled. */
  blockedDetail?: string | null;
  onUpdateEstimate?: () => void;
};

export function CreateFinalPricingDialog({
  projectId,
  estimateId,
  open,
  onOpenChange,
  blockedDetail = null,
  onUpdateEstimate,
}: CreateFinalPricingDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const createLockRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [denial, setDenial] = useState<{
    reasonCode?: string;
    upgradeTarget?: "builder" | "business" | "builder_or_business" | null;
  } | null>(null);

  const blocked = Boolean(blockedDetail?.trim());

  const handleUpdate = () => {
    onOpenChange(false);
    if (onUpdateEstimate) {
      onUpdateEstimate();
      return;
    }
    router.push(`/app/projects/${projectId}?updateEstimate=1`);
  };

  const handleCreate = () => {
    if (blocked) return;
    if (isPending || createLockRef.current) return;
    createLockRef.current = true;
    setError(null);
    setDenial(null);
    startTransition(async () => {
      try {
        const result = await createPricingFromEstimate({
          projectId,
          estimateId,
        });
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
      } finally {
        createLockRef.current = false;
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {blocked ? "This estimate needs updating" : "Continue to Pricing?"}
          </DialogTitle>
          <DialogDescription>
            {blocked
              ? blockedDetail
              : "Pricing is where you decide what to charge. Quotr’s estimate stays as the working recommendation. You can still adjust Work Area prices before creating a quote."}
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
            size="touch"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          {blocked ? (
            <Button
              type="button"
              size="touch"
              data-estimate-update-action="true"
              onClick={handleUpdate}
            >
              Update estimate
            </Button>
          ) : (
            <Button
              type="button"
              size="touch"
              disabled={isPending}
              data-pricing-create-pending={isPending ? "true" : undefined}
              onClick={handleCreate}
            >
              {isPending ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  Creating…
                </span>
              ) : (
                "Continue to Pricing"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
