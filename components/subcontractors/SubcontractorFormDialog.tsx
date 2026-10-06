"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { archiveSubcontractor, restoreSubcontractor } from "@/lib/subcontractors/actions";
import type { Subcontractor } from "@/lib/subcontractors/types";

export function ArchiveSubcontractorButton({
  subcontractor,
}: {
  subcontractor: Subcontractor;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmArchive() {
    setPending(true);
    setError(null);
    const result = await archiveSubcontractor(subcontractor.id);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button type="button" variant="outline" size="touch" onClick={() => setOpen(true)}>
        Archive
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1rem)] min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="break-words">Archive {subcontractor.trading_name}?</DialogTitle>
            <DialogDescription>
              The business and its contacts stay on record. Archive only hides them from the active directory. Nothing is deleted.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="touch"
              className="w-full sm:w-auto"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="touch"
              className="w-full sm:w-auto"
              onClick={() => void confirmArchive()}
              disabled={pending}
            >
              {pending ? "Archiving…" : "Archive subcontractor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function RestoreSubcontractorButton({ subcontractorId }: { subcontractorId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function restore() {
    setPending(true);
    setError(null);
    const result = await restoreSubcontractor(subcontractorId);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" variant="outline" size="touch" onClick={() => void restore()} disabled={pending}>
        {pending ? "Restoring…" : "Restore"}
      </Button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
