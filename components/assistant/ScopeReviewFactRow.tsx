"use client";

import { Loader2, Pencil } from "lucide-react";
import { useState } from "react";
import type { ScopeReviewFact, ScopeReviewSourceLabel } from "@/lib/assistant/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { normalizeBooleanForUi } from "@/lib/scopes/fact-values";

const SOURCE_DISPLAY: Record<ScopeReviewSourceLabel, string> = {
  brief: "Recognised from brief",
  answered: "Answered",
  calculated: "Calculated",
  assumed: "Assumed",
  default: "Default",
  system: "System",
  "project spec": "Project spec",
};

function chipValueMatches(
  option: string,
  value: string | number | boolean | null | undefined
): boolean {
  if (value === option) return true;
  if (option === "Yes") return value === true || value === "true";
  if (option === "No") return value === false || value === "false";
  if (option === "Not sure") {
    return (
      value === "Not sure" ||
      value === "not sure" ||
      value === "not_sure"
    );
  }
  return false;
}

type ScopeReviewFactRowProps = {
  fact: ScopeReviewFact;
  editable?: boolean;
  isSaving?: boolean;
  error?: string | null;
  onSave?: (value: string | number | boolean) => Promise<void>;
};

export function ScopeReviewFactRow({
  fact,
  editable = false,
  isSaving,
  error,
  onSave,
}: ScopeReviewFactRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState<string | number | boolean>(
    fact.rawValue as string | number | boolean
  );
  const [localError, setLocalError] = useState<string | null>(null);

  const canEdit = editable && !fact.readOnly && Boolean(onSave);
  const sourceText = SOURCE_DISPLAY[fact.sourceLabel] ?? fact.sourceLabel;

  const handleSave = async () => {
    if (!onSave) return;
    setLocalError(null);

    if (fact.inputType === "number") {
      const numeric = Number(draftValue);
      if (!Number.isFinite(numeric) || numeric <= 0) {
        setLocalError("Enter a valid number.");
        return;
      }
      await onSave(numeric);
    } else {
      await onSave(draftValue);
    }

    setIsEditing(false);
  };

  const handleCancel = () => {
    setDraftValue(fact.rawValue as string | number | boolean);
    setLocalError(null);
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <div className="group text-sm leading-relaxed">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="text-muted-foreground">{fact.label}:</span>{" "}
            <span className="text-foreground">{fact.value}</span>{" "}
            <span className="text-muted-foreground">({sourceText})</span>
            {fact.derivedNote ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {fact.derivedNote}
              </p>
            ) : null}
          </div>
          {canEdit ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 px-2 text-xs opacity-70 group-hover:opacity-100"
              onClick={() => {
                setDraftValue(fact.rawValue as string | number | boolean);
                setIsEditing(true);
              }}
              disabled={isSaving}
            >
              <Pencil className="mr-1 size-3" />
              Edit
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/70 bg-background px-2.5 py-2">
      <p className="text-xs font-medium text-muted-foreground">{fact.label}</p>
      <div className="mt-2 space-y-2">
        {fact.inputType === "boolean" || fact.inputType === "select" ? (
          <div className="flex flex-wrap gap-1.5">
            {(fact.options ?? ["Yes", "No", "Not sure"]).map((option) => (
              <button
                key={option}
                type="button"
                disabled={isSaving}
                onClick={() => setDraftValue(option)}
                className={cn(
                  "rounded-2xl border px-2.5 py-1 text-xs transition-colors",
                  chipValueMatches(option, draftValue)
                    ? "border-primary/30 bg-primary/5 font-medium text-primary"
                    : "border-border hover:bg-muted/50"
                )}
              >
                {option}
              </button>
            ))}
          </div>
        ) : fact.inputType === "number" ? (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={draftValue === null ? "" : String(draftValue)}
              disabled={isSaving}
              className="h-8 max-w-[120px]"
              onChange={(event) => setDraftValue(event.target.value)}
            />
            {fact.unit ? (
              <span className="text-xs text-muted-foreground">{fact.unit}</span>
            ) : null}
          </div>
        ) : (
          <Input
            value={draftValue === null ? "" : String(draftValue)}
            disabled={isSaving}
            className="h-8"
            onChange={(event) => setDraftValue(event.target.value)}
          />
        )}

        {(localError || error) && (
          <p className="text-xs text-destructive" role="alert">
            {localError ?? error}
          </p>
        )}

        <div className="flex gap-2">
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
            onClick={handleCancel}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

export function formatConstraintDisplayValue(value: unknown): string {
  const bool = normalizeBooleanForUi(value);
  if (bool) return bool;
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}
