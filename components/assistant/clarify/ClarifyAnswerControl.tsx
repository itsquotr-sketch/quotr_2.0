"use client";

import { Button } from "@/components/ui/button";
import { ClarifyValueField } from "@/components/assistant/clarify/ClarifyValueField";
import { OptionSelect } from "@/components/assistant/selection/OptionSelect";
import {
  booleanChoiceOptions,
  booleanChoiceToPresentation,
  booleanPresentationToChoice,
  clarifyControlType,
} from "@/lib/assistant/clarify/question-contract";
import { exclusiveOptionSelectValue } from "@/lib/assistant/clarify/interaction";
import type { ClarifyCandidate } from "@/lib/assistant/clarify/types";

export function ClarifyAnswerControl({
  candidate,
  value,
  persistError,
  continuePending,
  onAnswerBoolean,
  onAnswerValue,
  onContinueMulti,
}: {
  candidate: ClarifyCandidate;
  value: string | number | boolean | string[] | null | undefined;
  persistError?: string | null;
  continuePending?: boolean;
  onAnswerBoolean?: (
    candidate: ClarifyCandidate,
    presentation: "INCLUDED" | "NOT_INCLUDED"
  ) => void;
  onAnswerValue?: (
    candidate: ClarifyCandidate,
    value: string | number | boolean | string[]
  ) => void | Promise<unknown>;
  onContinueMulti?: () => void;
}) {
  const control = clarifyControlType(candidate);
  const booleanOptions = booleanChoiceOptions(candidate);
  const multiSelectedCount = Array.isArray(value) ? value.length : 0;

  if (control === "BOOLEAN") {
    return (
      <OptionSelect
        key={candidate.id}
        options={booleanOptions}
        value={booleanPresentationToChoice(value, booleanOptions)}
        error={persistError}
        onSelect={(next) => {
          const picked = Array.isArray(next) ? next[0] : next;
          onAnswerBoolean?.(
            candidate,
            booleanChoiceToPresentation(String(picked ?? ""))
          );
        }}
      />
    );
  }

  if (control === "MULTI_SELECT" && candidate.options && candidate.options.length > 0) {
    return (
      <>
        <OptionSelect
          key={candidate.id}
          options={candidate.options}
          value={value}
          multiple
          error={persistError}
          onSelect={(next) => onAnswerValue?.(candidate, next)}
        />
        {onContinueMulti ? (
          <Button
            type="button"
            className="min-h-11 w-full sm:w-auto"
            data-clarify-multi-continue
            disabled={
              continuePending ||
              (candidate.blocksEstimate && multiSelectedCount === 0)
            }
            onClick={onContinueMulti}
          >
            {continuePending ? "Saving…" : "Continue"}
          </Button>
        ) : null}
      </>
    );
  }

  if (candidate.options && candidate.options.length > 0) {
    return (
      <OptionSelect
        key={candidate.id}
        options={candidate.options}
        value={exclusiveOptionSelectValue(value)}
        multiple={false}
        error={persistError}
        onSelect={(next) => {
          const picked = Array.isArray(next) ? next[0] : next;
          onAnswerValue?.(candidate, picked ?? "");
        }}
      />
    );
  }

  return (
    <ClarifyValueField
      candidate={candidate}
      onSubmit={(next) => onAnswerValue?.(candidate, next)}
    />
  );
}
