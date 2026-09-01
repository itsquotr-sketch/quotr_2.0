"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { declinePublicQuoteByToken } from "@/lib/quotes/acceptance-actions";
import { useIsDesktop } from "@/lib/hooks/use-media-query";

export function QuoteDeclineSheet({
  token,
  open,
  onOpenChange,
}: {
  token: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await declinePublicQuoteByToken({ token, message });
      if (result.error) {
        setError(result.error);
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  };

  const fields = (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="quote-decline-note">Tell us why (optional)</Label>
        <Textarea
          id="quote-decline-note"
          rows={4}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
      </div>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );

  const actions = (
    <Button
      type="button"
      variant="outline"
      className="h-11 w-full"
      disabled={isPending}
      onClick={submit}
    >
      {isPending ? <Loader2 className="size-4 animate-spin" /> : "Decline quote"}
    </Button>
  );

  const dialogOpen = open && isDesktop;
  const sheetOpen = open && !isDesktop;

  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={onOpenChange}>
        <DialogContent data-quote-decline-mode="dialog" className="sm:max-w-[28rem]">
          <DialogHeader>
            <DialogTitle>Decline this quote?</DialogTitle>
            <DialogDescription>Your response will be recorded.</DialogDescription>
          </DialogHeader>
          {fields}
          <DialogFooter>{actions}</DialogFooter>
        </DialogContent>
      </Dialog>
      <Sheet open={sheetOpen} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          data-quote-decline-mode="sheet"
          className="max-h-[90dvh] overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>Decline this quote?</SheetTitle>
            <SheetDescription>Your response will be recorded.</SheetDescription>
          </SheetHeader>
          <div className="px-6 pb-4">{fields}</div>
          <SheetFooter>{actions}</SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
