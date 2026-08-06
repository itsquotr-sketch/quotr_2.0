"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DISMISS_REASON_OPTIONS,
  type DismissReasonCode,
} from "@/lib/scope-discovery/ui/labels";
import type { SafeSuggestionView } from "@/lib/scope-discovery/application/types";

type ScopeDiscoveryDismissDialogProps = {
  open: boolean;
  suggestion: SafeSuggestionView | null;
  isSaving?: boolean;
  error?: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: {
    reasonCode: DismissReasonCode | null;
    userNote: string | null;
  }) => Promise<void>;
};

export function ScopeDiscoveryDismissDialog({
  open,
  suggestion,
  isSaving,
  error,
  onOpenChange,
  onSubmit,
}: ScopeDiscoveryDismissDialogProps) {
  const [reasonCode, setReasonCode] = useState<DismissReasonCode | "">("");
  const [note, setNote] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setReasonCode("");
          setNote("");
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dismiss suggestion</DialogTitle>
          <DialogDescription>
            {suggestion
              ? `Dismiss “${suggestion.proposedTitle}”. This does not change company defaults.`
              : "Dismiss this suggestion. This does not change company defaults."}
          </DialogDescription>
        </DialogHeader>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Reason (optional)
          </span>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={reasonCode}
            disabled={isSaving}
            onChange={(event) =>
              setReasonCode(event.target.value as DismissReasonCode | "")
            }
          >
            <option value="">Select a reason</option>
            {DISMISS_REASON_OPTIONS.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Note (optional)
          </span>
          <textarea
            className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={note}
            disabled={isSaving}
            maxLength={500}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Short note for your records"
          />
        </label>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            disabled={isSaving}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={isSaving}
            onClick={() =>
              void onSubmit({
                reasonCode: reasonCode || null,
                userNote: note.trim() || null,
              })
            }
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden />
                Dismissing…
              </>
            ) : (
              "Dismiss"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
