"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ClarifyCandidate } from "@/lib/assistant/clarify/types";
import {
  parsePositiveClarifyNumber,
  resolveClarifyUnit,
} from "@/lib/assistant/clarify/numeric";
import { ASSISTANT_ACTION_LABELS } from "@/lib/assistant/presentation/action-labels";

type ClarifyValueFieldProps = {
  candidate: ClarifyCandidate;
  isSaving?: boolean;
  onSubmit: (value: string | number) => void;
};

export function ClarifyValueField({
  candidate,
  isSaving,
  onSubmit,
}: ClarifyValueFieldProps) {
  const isNumber = candidate.inputType === "number";
  const unit = isNumber
    ? resolveClarifyUnit({
        unit: candidate.unit,
        questionKey: candidate.questionKey,
        factKey: candidate.factKey,
      })
    : undefined;
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lastSubmitted, setLastSubmitted] = useState<string | null>(null);

  const commit = () => {
    if (isSaving) return;
    if (isNumber) {
      const parsed = parsePositiveClarifyNumber(draft);
      if (!parsed.ok) {
        setError(parsed.error);
        return;
      }
      const token = String(parsed.value);
      if (lastSubmitted === token) return;
      setError(null);
      setLastSubmitted(token);
      onSubmit(parsed.value);
      return;
    }
    const trimmed = draft.trim();
    if (!trimmed) {
      setError("Enter an answer.");
      return;
    }
    if (lastSubmitted === trimmed) return;
    setError(null);
    setLastSubmitted(trimmed);
    onSubmit(trimmed);
  };

  return (
    <div
      className="space-y-2"
      data-clarify-value-field="true"
      data-clarify-input-type={candidate.inputType}
    >
      <div className="flex items-center gap-2">
        <Input
          type={isNumber ? "number" : "text"}
          inputMode={isNumber ? "decimal" : "text"}
          min={isNumber ? "0" : undefined}
          step={isNumber ? "any" : undefined}
          value={draft}
          disabled={isSaving}
          aria-label={
            unit ? `${candidate.label} in ${unit}` : candidate.label
          }
          aria-invalid={error ? true : undefined}
          className="min-h-11 max-w-[10rem] text-base md:text-sm"
          data-clarify-numeric={isNumber ? "true" : undefined}
          onChange={(event) => {
            setDraft(event.target.value);
            if (error) setError(null);
            setLastSubmitted(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
          }}
        />
        {unit ? (
          <span
            className="shrink-0 text-sm font-medium text-muted-foreground"
            data-clarify-unit={unit}
          >
            {unit}
          </span>
        ) : null}
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
      <Button
        type="button"
        className="min-h-11 w-full sm:w-auto"
        disabled={isSaving}
        data-clarify-value-submit="true"
        onClick={commit}
      >
        {ASSISTANT_ACTION_LABELS.save}
      </Button>
      {candidate.assumable && !candidate.blocksEstimate ? (
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full sm:w-auto"
          disabled={isSaving}
          data-clarify-use-assumption="true"
          onClick={() => onSubmit("Not sure")}
        >
          {ASSISTANT_ACTION_LABELS.useQuotrAssumption}
        </Button>
      ) : null}
      {candidate.assumable && !candidate.blocksEstimate ? (
        <p className="text-xs text-muted-foreground" data-clarify-assumption-hint>
          We&apos;ll use a typical assumption and show it in your estimate.
        </p>
      ) : null}
      </div>
    </div>
  );
}
