"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ClarifyCandidate } from "@/lib/assistant/clarify/types";
import {
  clarifyFieldIdentity,
  parsePositiveClarifyNumber,
  resolveClarifyUnit,
} from "@/lib/assistant/clarify/numeric";
import { ASSISTANT_ACTION_LABELS } from "@/lib/assistant/presentation/action-labels";

type ClarifyValueFieldProps = {
  candidate: ClarifyCandidate;
  isSaving?: boolean;
  compact?: boolean;
  onSubmit: (value: string | number) => void;
};

type LocalField = {
  identity: string;
  draft: string;
  error: string | null;
  lastSubmitted: string | null;
};

function emptyLocal(identity: string): LocalField {
  return { identity, draft: "", error: null, lastSubmitted: null };
}

export function ClarifyValueField({
  candidate,
  isSaving,
  compact = false,
  onSubmit,
}: ClarifyValueFieldProps) {
  const isNumber = candidate.inputType === "number";
  const fieldKey = clarifyFieldIdentity(candidate);
  const unit = isNumber
    ? resolveClarifyUnit({
        unit: candidate.unit,
        questionKey: candidate.questionKey,
        factKey: candidate.factKey,
      })
    : undefined;
  const [local, setLocal] = useState<LocalField>(() => emptyLocal(fieldKey));

  // Reset draft when the asked fact changes without unmounting. A React `key`
  // remount would abort an in-flight Save server action started from this field.
  if (local.identity !== fieldKey) {
    setLocal(emptyLocal(fieldKey));
  }
  const active = local.identity === fieldKey ? local : emptyLocal(fieldKey);
  const draft = active.draft;
  const error = active.error;
  const lastSubmitted = active.lastSubmitted;

  const commit = () => {
    if (isSaving) return;
    if (isNumber) {
      const parsed = parsePositiveClarifyNumber(draft);
      if (!parsed.ok) {
        setLocal({ ...active, error: parsed.error });
        return;
      }
      const token = `${fieldKey}:${parsed.value}`;
      if (lastSubmitted === token) return;
      setLocal({ ...active, error: null, lastSubmitted: token });
      onSubmit(parsed.value);
      return;
    }
    const trimmed = draft.trim();
    if (!trimmed) {
      setLocal({ ...active, error: "Enter an answer." });
      return;
    }
    const token = `${fieldKey}:${trimmed}`;
    if (lastSubmitted === token) return;
    setLocal({ ...active, error: null, lastSubmitted: token });
    onSubmit(trimmed);
  };

  return (
    <div
      className="space-y-2"
      data-clarify-value-field="true"
      data-clarify-field-key={fieldKey}
      data-clarify-fact-key={candidate.factKey ?? undefined}
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
          className={
            isNumber
              ? "min-h-11 max-w-[10rem] text-base md:text-sm"
              : "min-h-11 w-full text-base md:text-sm"
          }
          data-clarify-numeric={isNumber ? "true" : undefined}
          onChange={(event) => {
            setLocal({
              ...active,
              draft: event.target.value,
              error: null,
              lastSubmitted: null,
            });
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
      {candidate.assumable && !candidate.blocksEstimate && !compact ? (
        <p className="text-xs text-muted-foreground" data-clarify-assumption-hint>
          We&apos;ll use a typical assumption and show it in your estimate.
        </p>
      ) : null}
      </div>
    </div>
  );
}
