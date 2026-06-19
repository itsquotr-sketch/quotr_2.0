"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { formatPercent } from "@/components/assistant/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MARGIN_MAX_PERCENT,
  MARGIN_MIN_PERCENT,
  validateTargetMarginPercent,
} from "@/lib/estimate/margin-override";

type MarginEditControlProps = {
  marginPercent: number;
  targetMarginPercent?: number | null;
  defaultMarginPercent: number;
  disabled?: boolean;
  isSaving?: boolean;
  onSave: (targetMarginPercent: number | null) => Promise<void>;
};

export function MarginEditControl({
  marginPercent,
  targetMarginPercent,
  defaultMarginPercent,
  disabled,
  isSaving,
  onSave,
}: MarginEditControlProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(
    String(targetMarginPercent ?? marginPercent)
  );
  const [error, setError] = useState<string | null>(null);

  const hasOverride = targetMarginPercent != null;
  const effectiveDefault = defaultMarginPercent;

  const handleSave = async () => {
    const parsed = Number(draftValue);
    const validationError = validateTargetMarginPercent(parsed);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    await onSave(parsed);
    setIsEditing(false);
  };

  const handleReset = async () => {
    setError(null);
    await onSave(null);
    setDraftValue(String(effectiveDefault));
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <div className="flex items-baseline justify-between gap-3">
        <span className="shrink-0 text-xs text-muted-foreground">Margin</span>
        <div className="flex items-center gap-2">
          <span className="text-right text-sm font-medium">
            {formatPercent(marginPercent)}
            {hasOverride ? (
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                (custom)
              </span>
            ) : null}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={disabled || isSaving}
            onClick={() => {
              setDraftValue(String(targetMarginPercent ?? marginPercent));
              setIsEditing(true);
            }}
          >
            Edit
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-border/70 bg-background px-2.5 py-2">
      <p className="text-xs font-medium text-muted-foreground">
        Target margin %
      </p>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={MARGIN_MIN_PERCENT}
          max={MARGIN_MAX_PERCENT}
          step="0.1"
          value={draftValue}
          disabled={isSaving}
          className="h-8 max-w-[100px]"
          onChange={(event) => setDraftValue(event.target.value)}
        />
        <span className="text-xs text-muted-foreground">%</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Default: {formatPercent(effectiveDefault)}
      </p>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className="h-7 text-xs"
          disabled={isSaving}
          onClick={() => void handleSave()}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-1 size-3 animate-spin" />
              Saving…
            </>
          ) : (
            "Save"
          )}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          disabled={isSaving}
          onClick={() => setIsEditing(false)}
        >
          Cancel
        </Button>
        {hasOverride ? (
          <Button
            type="button"
            size="sm"
            variant="link"
            className="h-7 px-0 text-xs"
            disabled={isSaving}
            onClick={() => void handleReset()}
          >
            Reset to default
          </Button>
        ) : null}
      </div>
    </div>
  );
}
