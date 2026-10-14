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
};

type DeckProductivityReviewDialogProps = {
  open: boolean;
  decisions: readonly DeckProductivityDecision[];
  pending?: boolean;
  loadError?: string | null;
  onOpenChange: (open: boolean) => void;
  onRetry?: () => void;
  onDecide: (
    decision: DeckProductivityDecision,
    key: string,
    value: string
  ) => Promise<{ error?: string } | void>;
};

export function DeckProductivityReviewDialog({
  open,
  decisions,
  pending = false,
  loadError = null,
  onOpenChange,
  onRetry,
  onDecide,
}: DeckProductivityReviewDialogProps) {
  const titleId = useId();
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const shownError = error ?? loadError;

  useEffect(() => {
    if (!shownError) return;
    errorRef.current?.focus();
  }, [shownError]);

  useEffect(() => {
    if (open && decisions.length === 0 && !loadError && !pending) onOpenChange(false);
  }, [decisions.length, loadError, onOpenChange, open, pending]);

  async function choose(decision: DeckProductivityDecision, key: string, value: string) {
    setError(null);
    setSavingKey(`${decision.id}:${key}:${value}`);
    try {
      const result = await onDecide(decision, key, value);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setError(null);
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              <p className="text-sm text-foreground/80">{decision.source ?? "Company calibration"}</p>
              <p className="text-sm font-medium break-words" data-productivity-calculation={decision.factKey}>
                {decision.calculation}
              </p>
              <p className="text-sm break-words">
                {decision.quantityLabel} · stored {decision.projectedHours}
                {decision.alternativeHours ? ` · Quotr ${decision.alternativeHours}` : ""}
              </p>
              <p className="text-sm text-foreground/80 break-words">{decision.reason}</p>
              <details className="text-sm">
                <summary className="cursor-pointer font-medium">Why review this rate?</summary>
                <p className="mt-2 break-words text-foreground/80">{decision.task}</p>
                {decision.alternativeScope ? (
                  <p className="mt-2 break-words text-foreground/80">{decision.alternativeScope}</p>
                ) : null}
              </details>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  className="h-11 min-h-11"
                  disabled={pending || savingKey != null}
                  onClick={() => choose(decision, decision.factKey, decision.value)}
                >
                  {savingKey === `${decision.id}:${decision.factKey}:${decision.value}`
                    ? "Saving…"
                    : "Use company calibration"}
                </Button>
                {decision.benchmarkLabel && decision.benchmarkValue ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 min-h-11"
                    disabled={pending || savingKey != null}
                    onClick={() =>
                      choose(decision, decision.factKey, decision.benchmarkValue!)
                    }
                  >
                    {savingKey ===
                    `${decision.id}:${decision.factKey}:${decision.benchmarkValue}`
                      ? "Saving…"
                      : decision.benchmarkLabel}
                  </Button>
                ) : null}
                <RevisedHours
                  disabled={pending || savingKey != null}
                  saving={savingKey?.startsWith(`${decision.id}:${decision.jobFactKey}:`) === true}
                  onInvalid={setError}
                  onSave={(hours) => choose(decision, decision.jobFactKey, hours)}
                />
              </div>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RevisedHours({
  disabled,
  saving,
  onSave,
  onInvalid,
}: {
  disabled: boolean;
  saving: boolean;
  onSave: (hours: string) => void;
  onInvalid: (message: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <form
      className="flex min-w-0 flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const hours = Number(value);
        if (!Number.isFinite(hours) || hours <= 0) {
          onInvalid("Enter hours greater than zero.");
          return;
        }
        onSave(String(hours));
      }}
    >
      <label className="text-sm">
        This job (h)
        <input
          className="mt-1 block h-11 w-28 rounded-md border border-border bg-background px-2"
          inputMode="decimal"
          value={value}
          disabled={disabled}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <Button type="submit" variant="outline" className="h-11 min-h-11" disabled={disabled}>
        {saving ? "Saving…" : "Enter this job's rate"}
      </Button>
    </form>
  );
}
