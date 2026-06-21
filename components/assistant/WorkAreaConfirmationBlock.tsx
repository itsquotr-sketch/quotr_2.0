"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WorkArea } from "@/components/assistant/types";

type WorkAreaConfirmationBlockProps = {
  workAreas: WorkArea[];
  submitted?: boolean;
  isSaving?: boolean;
  onConfirm?: (workAreas: WorkArea[]) => void;
  onToggle?: (id: string) => void;
};

export function confidenceLabel(confidence: number): string {
  if (confidence >= 0.75) return "High confidence";
  if (confidence >= 0.4) return "Possible";
  return "Low confidence";
}

export function buildWorkAreasSummary(workAreas: WorkArea[]): string {
  const included = workAreas.filter((wa) => wa.status !== "excluded");
  const excluded = workAreas.filter((wa) => wa.status === "excluded");
  const names = included.map((wa) => wa.name).join(", ");
  if (included.length === 0) {
    return excluded.length > 0
      ? `None included · ${excluded.length} excluded`
      : "No work areas";
  }
  if (excluded.length > 0) {
    return `${names} · ${included.length} included, ${excluded.length} excluded`;
  }
  return `${names} · ${included.length} included`;
}

function ReadOnlySummary({ workAreas }: { workAreas: WorkArea[] }) {
  const included = workAreas.filter((wa) => wa.status !== "excluded");
  const excluded = workAreas.filter((wa) => wa.status === "excluded");

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-muted-foreground">Included</p>
        {included.length > 0 ? (
          <ul className="mt-1.5 space-y-1">
            {included.map((wa) => (
              <li key={wa.id} className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">{wa.name}</span>
                <span className="text-xs text-muted-foreground">
                  {confidenceLabel(wa.aiConfidence)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">None</p>
        )}
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">Not included</p>
        {excluded.length > 0 ? (
          <ul className="mt-1.5 space-y-1">
            {excluded.map((wa) => (
              <li key={wa.id} className="text-sm text-muted-foreground">
                {wa.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">None</p>
        )}
      </div>
    </div>
  );
}

export function WorkAreaConfirmationBlock({
  workAreas,
  submitted,
  isSaving,
  onConfirm,
  onToggle,
}: WorkAreaConfirmationBlockProps) {
  const included = workAreas.filter((wa) => wa.status !== "excluded");

  if (submitted) {
    return <ReadOnlySummary workAreas={workAreas} />;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {workAreas.map((wa) => {
          const isIncluded = wa.status !== "excluded";

          return (
            <button
              key={wa.id}
              type="button"
              onClick={() => onToggle?.(wa.id)}
              className={cn(
                "rounded-2xl border px-4 py-3 text-left transition-colors",
                isIncluded
                  ? "border-primary/30 bg-primary/5 ring-1 ring-primary/20"
                  : "border-border bg-muted/30 opacity-60"
              )}
            >
              <p className="text-sm font-medium">{wa.name}</p>
              <p
                className={cn(
                  "mt-1 text-xs text-muted-foreground",
                  wa.aiConfidence < 0.4 && "italic opacity-80"
                )}
              >
                {confidenceLabel(wa.aiConfidence)}
              </p>
            </button>
          );
        })}
      </div>
      <Button
        type="button"
        onClick={() => onConfirm?.(workAreas)}
        disabled={included.length === 0 || isSaving}
      >
        {isSaving ? "Saving…" : "Confirm work areas"}
      </Button>
    </div>
  );
}
