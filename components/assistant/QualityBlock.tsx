"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { QualityLevel } from "@/components/assistant/types";

export const QUALITY_OPTIONS: {
  value: QualityLevel;
  title: string;
  description: string;
}[] = [
  {
    value: "budget",
    title: "Budget",
    description: "Keep costs low with practical allowances.",
  },
  {
    value: "standard",
    title: "Standard",
    description: "Typical contractor-grade finish.",
  },
  {
    value: "premium",
    title: "Premium",
    description: "Higher-spec finish and stronger allowances.",
  },
  {
    value: "unknown",
    title: "Not sure",
    description: "Use standard assumptions for now.",
  },
];

export function qualityLabel(level: QualityLevel): string {
  return QUALITY_OPTIONS.find((o) => o.value === level)?.title ?? level;
}

type QualityBlockProps = {
  selected?: QualityLevel | null;
  submitted?: boolean;
  editing?: boolean;
  isSaving?: boolean;
  onSelect?: (value: QualityLevel) => void;
  onContinue?: () => void;
  onSave?: () => void;
  onCancelEdit?: () => void;
};

export function QualityBlock({
  selected,
  submitted,
  editing,
  isSaving,
  onSelect,
  onContinue,
  onSave,
  onCancelEdit,
}: QualityBlockProps) {
  if (submitted && selected && !editing) {
    const option = QUALITY_OPTIONS.find((o) => o.value === selected);
    return (
      <p className="text-sm">
        <span className="font-medium">{option?.title ?? selected}</span>
        {option?.description ? (
          <span className="text-muted-foreground"> — {option.description}</span>
        ) : null}
      </p>
    );
  }

  const isEditMode = submitted && editing;

  return (
    <div className="space-y-4">
      {isEditMode ? (
        <p className="text-sm text-muted-foreground">
          Choose a new spec level. Regenerate the quick estimate when you are
          ready — final pricing is not changed automatically.
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {QUALITY_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect?.(option.value)}
            className={cn(
              "rounded-2xl border px-4 py-3 text-left transition-colors",
              selected === option.value
                ? "border-primary/30 bg-primary/5 ring-1 ring-primary/20"
                : "border-border hover:bg-muted/50"
            )}
          >
            <p className="text-sm font-medium">{option.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {option.description}
            </p>
          </button>
        ))}
      </div>
      {isEditMode ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={onSave}
            disabled={!selected || isSaving}
          >
            {isSaving ? "Saving…" : "Save spec level"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onCancelEdit}
            disabled={isSaving}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button type="button" onClick={onContinue} disabled={!selected || isSaving}>
          {isSaving ? "Saving…" : "Continue"}
        </Button>
      )}
    </div>
  );
}
