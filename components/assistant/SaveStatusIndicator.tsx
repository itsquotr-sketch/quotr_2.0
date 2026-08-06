"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  resolveDisplayedSaveStatus,
  saveStatusLabel,
  type SaveStatus,
} from "@/lib/assistant/presentation/save-status";
import { ASSISTANT_ACTION_LABELS } from "@/lib/assistant/presentation/action-labels";
import { Button } from "@/components/ui/button";

type SaveStatusIndicatorProps = {
  status: SaveStatus;
  isSaving?: boolean;
  hasError?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
  className?: string;
};

/**
 * Shared Saving… / Saved / Could not save + Retry presentation.
 * Failed saves never show Saved.
 */
export function SaveStatusIndicator({
  status,
  isSaving,
  hasError,
  errorMessage,
  onRetry,
  className,
}: SaveStatusIndicatorProps) {
  const resolved = resolveDisplayedSaveStatus({
    status,
    isSaving,
    hasError,
  });
  const label = saveStatusLabel(resolved);

  if (resolved === "idle" && !errorMessage) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {resolved === "saving" ? (
        <span
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          {ASSISTANT_ACTION_LABELS.saving}
        </span>
      ) : null}
      {resolved === "saved" ? (
        <span
          className="text-xs text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          {ASSISTANT_ACTION_LABELS.saved}
        </span>
      ) : null}
      {resolved === "error" ? (
        <>
          <span
            className="text-xs text-destructive"
            role="alert"
            aria-live="assertive"
          >
            {errorMessage?.trim() ||
              label ||
              ASSISTANT_ACTION_LABELS.couldNotSave}
          </span>
          {onRetry ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={onRetry}
            >
              {ASSISTANT_ACTION_LABELS.retry}
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
