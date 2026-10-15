"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type DeckProductivityDecision = {
  readonly id: string;
  readonly workAreaId: string;
  readonly title: string;
  readonly source?: string;
  readonly storedHours: string;
  readonly alternativePhrase?: string;
  readonly alternativeScope?: string;
  readonly alternativeHours?: string;
  readonly task: string;
  readonly quantityLabel: string;
  readonly projectedHours: string;
  readonly calculation: string;
  readonly reason: string;
  readonly factKey: string;
  readonly value: string;
  readonly jobFactKey: string;
  readonly benchmarkLabel?: string | null;
  readonly benchmarkValue?: string | null;
  readonly itemKey: string;
  readonly beforeAccessLabel: string;
  readonly afterAccessLabel: string;
  readonly alternativeBeforeLabel: string;
  readonly alternativeAfterLabel: string;
};

export type DeckProductivitySelection = {
  readonly decision: DeckProductivityDecision;
  readonly choice: "calibration" | "benchmark" | "job";
  readonly jobHours?: number;
};

type DeckProductivityReviewDialogProps = {
  open: boolean;
  decisions: readonly DeckProductivityDecision[];
  pending?: boolean;
  loadError?: string | null;
  onOpenChange: (open: boolean) => void;
  onRetry?: () => void;
  onApply: (
    selections: readonly DeckProductivitySelection[]
  ) => Promise<{ error?: string } | void>;
};

type LineChoice = {
  readonly kind: "calibration" | "benchmark" | "job";
  readonly hours: string;
};

export function DeckProductivityReviewDialog({
  open,
  decisions,
  pending = false,
  loadError = null,
  onOpenChange,
  onRetry,
  onApply,
}: DeckProductivityReviewDialogProps) {
  const titleId = useId();
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [choices, setChoices] = useState<Record<string, LineChoice>>({});
  const applyingRef = useRef(false);
  const shownError = error ?? loadError;
  const applyLabel =
    decisions.length === 2
      ? "Apply both decisions and update estimate"
      : "Apply the decisions and update estimate";

  useEffect(() => {
    if (!shownError) return;
    errorRef.current?.focus();
  }, [shownError]);

  useEffect(() => {
    if (open && decisions.length === 0 && !loadError && !pending) onOpenChange(false);
  }, [decisions.length, loadError, onOpenChange, open, pending]);

  function select(id: string, kind: LineChoice["kind"]) {
    setChoices((current) => ({
      ...current,
      [id]: { kind, hours: current[id]?.hours ?? "" },
    }));
  }

  async function apply() {
    if (pending || applyingRef.current) return;
    const selections: DeckProductivitySelection[] = [];
    for (const decision of decisions) {
      const choice = choices[decision.id];
      if (!choice) {
        setError("Choose one option for every held line before updating the estimate.");
        return;
      }
      if (choice.kind === "job") {
        const hours = Number(choice.hours);
        if (!Number.isFinite(hours) || hours <= 0) {
          setError("Enter a productivity greater than zero for the revised rate.");
          return;
        }
        selections.push({ decision, choice: "job", jobHours: hours });
        continue;
      }
      selections.push({ decision, choice: choice.kind });
    }
    setError(null);
    applyingRef.current = true;
    try {
      const result = await onApply(selections);
      if (result?.error) setError(result.error);
    } catch {
      setError("The productivity choice was not saved. Try again.");
    } finally {
      applyingRef.current = false;
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        showCloseButton
        className="max-h-[calc(100dvh-7.5rem)] overflow-x-hidden overflow-y-auto overscroll-contain max-sm:top-4 max-sm:translate-y-0 sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle id={titleId}>Review Deck productivity</DialogTitle>
          <DialogDescription>
            These stored calibrations stay on the organisation. A choice here applies to this job only.
          </DialogDescription>
        </DialogHeader>
        {shownError ? (
          <div className="space-y-2">
            <p
              ref={errorRef}
              tabIndex={-1}
              className="text-sm text-destructive outline-none"
              role="alert"
            >
              {shownError}
            </p>
            {loadError && onRetry ? (
              <Button type="button" className="h-11 min-h-11" onClick={onRetry}>
                Retry
              </Button>
            ) : null}
          </div>
        ) : null}
        <div className="space-y-4">
          {decisions.map((decision) => (
            <section
              key={decision.id}
              className="min-w-0 space-y-2 rounded-lg border border-border p-3"
              data-productivity-review={decision.factKey}
            >
              <h3 className="text-sm font-semibold break-words">{decision.title}</h3>
              <p className="text-sm break-words">
                Original task: {decision.task}
              </p>
              <p className="text-sm break-words" data-productivity-calculation={decision.factKey}>
                {decision.quantityLabel}. Company calibration {decision.storedHours}: {decision.beforeAccessLabel} before access, {decision.afterAccessLabel} after access.
              </p>
              <p className="text-sm break-words">
                Quotr {decision.alternativePhrase}: {decision.alternativeBeforeLabel} before access, {decision.alternativeAfterLabel} after access.
              </p>
              <p className="text-sm text-foreground/80">
                Rate source: {decision.source ?? "Company calibration"}
              </p>
              <p className="text-sm text-foreground/80 break-words">{decision.reason}</p>
              <div className="flex flex-col gap-2" role="group" aria-label={decision.title}>
                <Button
                  type="button"
                  variant={choices[decision.id]?.kind === "calibration" ? "default" : "outline"}
                  className="h-11 min-h-11"
                  aria-pressed={choices[decision.id]?.kind === "calibration"}
                  disabled={pending}
                  onClick={() => select(decision.id, "calibration")}
                >
                  Use company calibration
                </Button>
                <Button
                  type="button"
                  variant={choices[decision.id]?.kind === "benchmark" ? "default" : "outline"}
                  className="h-11 min-h-11"
                  aria-pressed={choices[decision.id]?.kind === "benchmark"}
                  disabled={pending}
                  onClick={() => select(decision.id, "benchmark")}
                >
                  {decision.benchmarkLabel ?? "Use Quotr rate"}
                </Button>
                <label className="text-sm">
                  Revised rate for this job (h)
                  <input
                    className="mt-1 block h-11 w-full rounded-md border border-border bg-background px-2"
                    inputMode="decimal"
                    value={choices[decision.id]?.hours ?? ""}
                    disabled={pending}
                    aria-pressed={choices[decision.id]?.kind === "job"}
                    onFocus={() => select(decision.id, "job")}
                    onChange={(event) =>
                      setChoices((current) => ({
                        ...current,
                        [decision.id]: { kind: "job", hours: event.target.value },
                      }))
                    }
                  />
                </label>
              </div>
            </section>
          ))}
        </div>
        <Button
          type="button"
          className="h-11 min-h-11 w-full"
          data-productivity-apply
          disabled={pending || decisions.length === 0}
          aria-busy={pending || undefined}
          onClick={() => void apply()}
        >
          {pending
            ? decisions.length === 2
              ? "Applying both decisions…"
              : "Applying the decisions…"
            : applyLabel}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
