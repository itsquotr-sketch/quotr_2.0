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
  readonly storedHours: string;
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
  const [savingId, setSavingId] = useState<string | null>(null);
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
    setSavingId(decision.id);
    try {
      const result = await onDecide(decision, key, value);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setError(null);
    } finally {
      setSavingId(null);
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
              <p className="text-sm font-medium break-words" data-productivity-calculation={decision.factKey}>
                {decision.calculation}
              </p>
              <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <Fact label="Stored hours" value={decision.storedHours} />
                <Fact label="This estimate" value={decision.quantityLabel} />
                <Fact label="Projected hours" value={decision.projectedHours} />
              </dl>
              <p className="text-sm text-foreground/80 break-words">
                <span className="font-medium">Original task. </span>
                {decision.task}
              </p>
              <p className="text-sm text-foreground/80 break-words">{decision.reason}</p>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  className="h-11 min-h-11"
                  disabled={pending || savingId != null}
                  onClick={() => choose(decision, decision.factKey, decision.value)}
                >
                  {savingId === decision.id
                    ? "Saving…"
                    : decision.factKey.includes("concrete")
                      ? "Use this company rate for these bags"
                      : "Use this company rate for post setting on this job"}
                </Button>
                {decision.benchmarkLabel && decision.benchmarkValue ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 min-h-11"
                    disabled={pending || savingId != null}
                    onClick={() => choose(decision, decision.factKey, decision.benchmarkValue!)}
                  >
                    {savingId === decision.id ? "Saving…" : decision.benchmarkLabel}
                  </Button>
                ) : null}
                <RevisedHours
                  disabled={pending || savingId != null}
                  saving={savingId === decision.id}
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

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-foreground/70">{label}</dt>
      <dd className="font-medium break-words">{value}</dd>
    </div>
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
        Revised hours
        <input
          className="mt-1 block h-11 w-28 rounded-md border border-border bg-background px-2"
          inputMode="decimal"
          value={value}
          disabled={disabled}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <Button type="submit" variant="outline" className="h-11 min-h-11" disabled={disabled}>
        {saving ? "Saving…" : "Enter this job's hours"}
      </Button>
    </form>
  );
}
