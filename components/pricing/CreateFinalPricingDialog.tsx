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

  const handleCreate = () => {
    setError(null);
    startTransition(async () => {
      const result = await createPricingFromEstimate({ projectId });
      if (result.error) {
        setError(result.error);
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
          <DialogTitle>Create final pricing?</DialogTitle>
          <DialogDescription>
            Create final pricing from the current estimate? You can review and
            edit all line items before marking pricing as reviewed.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="text-sm text-destructive" role="alert">{error}</p>
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
            {isPending ? "Creating…" : "Create final pricing"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
