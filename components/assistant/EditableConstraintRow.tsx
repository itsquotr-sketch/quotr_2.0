"use client";

import { Loader2, Pencil } from "lucide-react";
import { useState } from "react";
import type { Question } from "@/components/assistant/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatConstraintDisplayValue } from "@/components/assistant/ScopeReviewFactRow";

type EditableConstraintRowProps = {
  question: Question;
  value: string | number | boolean | null | undefined;
  editable?: boolean;
  isSaving?: boolean;
  error?: string | null;
  onSave?: (value: string | number | boolean) => Promise<void>;
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

export function EditableConstraintRow({
  question,
  value,
  editable = false,
  isSaving,
  error,
  onSave,
}: EditableConstraintRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState<string | number | boolean>(
    (value ?? "") as string | number | boolean
  );

  const canEdit = editable && Boolean(onSave);

  const handleSave = async () => {
    if (!onSave || draftValue === null || draftValue === "") return;
    await onSave(draftValue);
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <div className="group grid gap-1 sm:grid-cols-[1fr_1.2fr] sm:items-start">
        <dt className="text-sm text-muted-foreground">{question.label}</dt>
        <dd className="flex items-start justify-between gap-2 text-sm font-medium">
          <span>{formatConstraintDisplayValue(value)}</span>
          {canEdit ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 px-2 text-xs opacity-70 group-hover:opacity-100"
              onClick={() => {
                setDraftValue((value ?? "") as string | number | boolean);
                setIsEditing(true);
              }}
              disabled={isSaving}
            >
              <Pencil className="mr-1 size-3" />
              Edit
            </Button>
          ) : null}
        </dd>
      </div>
    );
  }

  const options = question.options ?? ["Yes", "No", "Not sure"];

  return (
    <div className="rounded-lg border border-border/70 bg-background px-2.5 py-2 sm:col-span-2">
      <p className="text-xs font-medium text-muted-foreground">
        {question.label}
      </p>
      <div className="mt-2 space-y-2">
        {question.inputType === "boolean" || question.inputType === "select" ? (
          <div className="flex flex-wrap gap-1.5">
            {options.map((option) => (
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
        ) : (
          <Input
            value={draftValue === null ? "" : String(draftValue)}
            disabled={isSaving}
            className="h-8"
            onChange={(event) => setDraftValue(event.target.value)}
          />
        )}

        {error ? (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}

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
            onClick={() => setIsEditing(false)}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
