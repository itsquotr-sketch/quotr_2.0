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
import { cn } from "@/lib/utils";

export type DeckProductivityDecision = {
  readonly id: string;
  readonly workAreaId: string;
  readonly title: string;
  readonly rateUnit: string;
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

function choiceReady(choice: LineChoice | undefined): boolean {
  if (!choice) return false;
  if (choice.kind !== "job") return true;
  const hours = Number(choice.hours);
  return Number.isFinite(hours) && hours > 0;
}

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
  const selectionsReady =
    decisions.length > 0 &&
    decisions.every((decision) => choiceReady(choices[decision.id]));

  useEffect(() => {
    if (!shownError || !open) return;
    errorRef.current?.focus();
  }, [open, shownError]);

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
    if (pending || applyingRef.current || !selectionsReady) return;
    const selections: DeckProductivitySelection[] = [];
    for (const decision of decisions) {
      const choice = choices[decision.id];
      if (!choice || !choiceReady(choice)) {
        setError("Choose one option for every held line before updating the estimate.");
        return;
      }
      if (choice.kind === "job") {
        selections.push({
          decision,
          choice: "job",
          jobHours: Number(choice.hours),
        });
        continue;
      }
      selections.push({ decision, choice: choice.kind });
    }
    setError(null);
    applyingRef.current = true;
    try {
      const result = await onApply(selections);
      if (result?.error) {
        setError(result.error);
        return;
      }
      onOpenChange(false);
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
        if (pending || applyingRef.current) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        showCloseButton
        className="flex max-h-[min(40rem,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden p-0 max-sm:top-3 max-sm:bottom-[calc(5.75rem+env(safe-area-inset-bottom))] max-sm:h-auto max-sm:max-h-none max-sm:translate-y-0 sm:max-w-lg"
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pt-6 pb-4">
          <DialogHeader>
            <DialogTitle id={titleId}>Review Deck productivity</DialogTitle>
            <DialogDescription>
              These stored calibrations stay on the organisation. A choice here applies to this job only.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            {decisions.map((decision) => {
              const choice = choices[decision.id];
              return (
                <section
                  key={decision.id}
                  className="min-w-0 space-y-3 rounded-lg border border-border p-3"
                  data-productivity-review={decision.factKey}
                >
                  <div>
                    <h3 className="text-sm font-semibold break-words">{decision.title}</h3>
                    <p className="mt-1 text-sm tabular-nums">{decision.quantityLabel}</p>
                  </div>
                  <div className="flex flex-col gap-2" role="group" aria-label={decision.title}>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "h-auto min-h-11 w-full flex-col items-start gap-0.5 whitespace-normal px-3 py-2 text-left",
                        choice?.kind === "calibration" &&
                          "border-2 border-primary bg-primary/10 font-semibold"
                      )}
                      aria-pressed={choice?.kind === "calibration"}
                      data-productivity-choice="calibration"
                      disabled={pending}
                      onClick={() => select(decision.id, "calibration")}
                    >
                      <span>Company calibration{choice?.kind === "calibration" ? " · Selected" : ""}</span>
                      <span className="text-sm font-normal">{decision.storedHours}</span>
                      <span className="text-sm font-normal">{decision.afterAccessLabel} on this job</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "h-auto min-h-11 w-full flex-col items-start gap-0.5 whitespace-normal px-3 py-2 text-left",
                        choice?.kind === "benchmark" &&
                          "border-2 border-primary bg-primary/10 font-semibold"
                      )}
                      aria-pressed={choice?.kind === "benchmark"}
                      data-productivity-choice="benchmark"
                      disabled={pending}
                      onClick={() => select(decision.id, "benchmark")}
                    >
                      <span>Quotr alternative{choice?.kind === "benchmark" ? " · Selected" : ""}</span>
                      <span className="text-sm font-normal">{decision.alternativePhrase}</span>
                      <span className="text-sm font-normal">{decision.alternativeAfterLabel} on this job</span>
                    </Button>
                    <label
                      className={cn(
                        "block rounded-lg border px-3 py-2 text-sm",
                        choice?.kind === "job"
                          ? "border-2 border-primary bg-primary/10 font-semibold"
                          : "border-border"
                      )}
                    >
                      <span>
                        Use a different rate for this job
                        {choice?.kind === "job" ? " · Selected" : ""}
                      </span>
                      <span className="mt-1 flex items-center gap-2 font-normal">
                        <input
                          className="block h-11 min-w-0 flex-1 rounded-md border border-border bg-background px-2"
                          inputMode="decimal"
                          value={choice?.hours ?? ""}
                          disabled={pending}
                          aria-label={`Use a different rate for this job (${decision.rateUnit})`}
                          onFocus={() => select(decision.id, "job")}
                          onChange={(event) =>
                            setChoices((current) => ({
                              ...current,
                              [decision.id]: { kind: "job", hours: event.target.value },
                            }))
                          }
                        />
                        <span>{decision.rateUnit}</span>
                      </span>
                    </label>
                  </div>
                  <p className="text-sm text-foreground/80 break-words">{decision.reason}</p>
                  <details className="text-sm">
                    <summary className="cursor-pointer font-medium">
                      How was this rate recorded?
                    </summary>
                    <div
                      className="mt-2 space-y-2 text-foreground/80"
                      data-productivity-calculation={decision.factKey}
                    >
                      <p className="break-words">Original task: {decision.task}</p>
                      <p className="break-words">
                        Company calibration {decision.storedHours}: {decision.beforeAccessLabel} before access, {decision.afterAccessLabel} after access.
                      </p>
                      <p className="break-words">
                        Quotr {decision.alternativePhrase}: {decision.alternativeBeforeLabel} before access, {decision.alternativeAfterLabel} after access.
                      </p>
                      <p>Rate source: {decision.source ?? "Company calibration"}</p>
                    </div>
                  </details>
                </section>
              );
            })}
          </div>
        </div>
        <div className="shrink-0 space-y-2 border-t border-border bg-popover px-6 py-3">
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
                <Button type="button" className="h-11 min-h-11 w-full" onClick={onRetry}>
                  Retry
                </Button>
              ) : (
                <Button
                  type="button"
                  className="h-11 min-h-11 w-full"
                  data-productivity-retry=""
                  disabled={pending}
                  onClick={() => void apply()}
                >
                  Retry
                </Button>
              )}
            </div>
          ) : null}
          <Button
            type="button"
            className="h-11 min-h-11 w-full"
            data-productivity-apply
            disabled={pending || !selectionsReady}
            aria-busy={pending || undefined}
            onClick={() => void apply()}
          >
            Use selections
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
