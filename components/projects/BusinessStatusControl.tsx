"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { BusinessStatusBadge } from "@/components/projects/BusinessStatusBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { updateProjectBusinessStatus } from "@/lib/projects/status-actions";
import {
  BUSINESS_STATUSES,
  LOST_REASON_OPTIONS,
  type BusinessStatus,
} from "@/lib/projects/status";
import { cn } from "@/lib/utils";

type BusinessStatusControlProps = {
  projectId: string;
  currentStatus: BusinessStatus | string;
  className?: string;
};

export function BusinessStatusControl({
  projectId,
  currentStatus,
  className,
}: BusinessStatusControlProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lostDialogOpen, setLostDialogOpen] = useState(false);

  const applyStatus = (status: BusinessStatus, lostReason?: string) => {
    setError(null);
    startTransition(async () => {
      const result = await updateProjectBusinessStatus({
        projectId,
        businessStatus: status,
        lostReason,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setLostDialogOpen(false);
      router.refresh();
    });
  };

  const handleSelect = (status: BusinessStatus) => {
    if (status === currentStatus) {
      return;
    }

    if (status === "lost") {
      setLostDialogOpen(true);
      return;
    }

    applyStatus(status);
  };

  const handleLostReason = (reason: string) => {
    applyStatus("lost", reason);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={isPending}
          className={cn(
            "inline-flex items-center gap-1 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
            className
          )}
          aria-label="Change project status"
        >
          {isPending ? (
            <span className="inline-flex items-center gap-1 rounded-2xl border border-border/60 bg-muted/30 px-2 py-0.5 text-xs">
              <Loader2 className="size-3 animate-spin" />
              Updating…
            </span>
          ) : (
            <>
              <BusinessStatusBadge status={currentStatus} />
              <ChevronDown className="size-3 text-muted-foreground" />
            </>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          {BUSINESS_STATUSES.map((status) => (
            <DropdownMenuItem
              key={status.value}
              disabled={isPending}
              onClick={() => handleSelect(status.value)}
              className={cn(
                currentStatus === status.value && "bg-accent font-medium"
              )}
            >
              {status.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Dialog
        open={lostDialogOpen}
        onOpenChange={(open) => {
          setLostDialogOpen(open);
          if (!open) {
            setError(null);
          }
        }}
      >
        <DialogContent showCloseButton className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Why was this lost?</DialogTitle>
            <DialogDescription>
              Optional — helps you track why jobs did not proceed.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {LOST_REASON_OPTIONS.map((reason) => (
              <Button
                key={reason}
                type="button"
                variant="outline"
                className="h-auto justify-start px-3 py-2 text-left text-sm font-normal"
                disabled={isPending}
                onClick={() => handleLostReason(reason)}
              >
                {reason}
              </Button>
            ))}
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground"
              disabled={isPending}
              onClick={() => applyStatus("lost")}
            >
              Skip for now
            </Button>
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter className="sr-only">
            <span>Lost reason dialog</span>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
