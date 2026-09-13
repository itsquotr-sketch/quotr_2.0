"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClarifyValueField } from "@/components/assistant/clarify/ClarifyValueField";
import { SaveStatusIndicator } from "@/components/assistant/SaveStatusIndicator";
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
  pending = false,
  compact = false,
  onAnswerBoolean,
  onAnswerValue,
  onContinueMulti,
}: {
  candidate: ClarifyCandidate;
  value: string | number | boolean | string[] | null | undefined;
  persistError?: string | null;
  continuePending?: boolean;
  pending?: boolean;
  compact?: boolean;
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
  const showSaving = pending || Boolean(continuePending);

  if (control === "BOOLEAN") {
    return (
      <div
        className="space-y-1.5"
        data-clarify-answer-pending={pending ? "true" : undefined}
      >
        <OptionSelect
          key={candidate.id}
          options={booleanOptions}
          value={booleanPresentationToChoice(value, booleanOptions)}
          error={persistError}
          compact={compact}
          pending={pending}
          onSelect={(next) => {
            if (pending) return;
            const picked = Array.isArray(next) ? next[0] : next;
            onAnswerBoolean?.(
              candidate,
              booleanChoiceToPresentation(String(picked ?? ""))
            );
          }}
        />
        {showSaving ? (
          <div className="flex h-5 items-center">
            <SaveStatusIndicator status="saving" isSaving />
          </div>
        ) : null}
      </div>
    );
  }

  if (control === "MULTI_SELECT" && candidate.options && candidate.options.length > 0) {
    return (
      <div
        className="space-y-1.5"
        data-clarify-answer-pending={continuePending ? "true" : undefined}
      >
        <OptionSelect
          key={candidate.id}
          options={candidate.options}
          value={value}
          multiple
          error={persistError}
          compact={compact}
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
            {continuePending ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                Saving…
              </span>
            ) : (
              "Continue"
            )}
          </Button>
        ) : null}
      </div>
    );
  }

  if (candidate.options && candidate.options.length > 0) {
    return (
      <div
        className="space-y-1.5"
        data-clarify-answer-pending={pending ? "true" : undefined}
      >
        <OptionSelect
          key={candidate.id}
          options={candidate.options}
          value={exclusiveOptionSelectValue(value)}
          multiple={false}
          error={persistError}
          compact={compact}
          pending={pending}
          onSelect={(next) => {
            if (pending) return;
            const picked = Array.isArray(next) ? next[0] : next;
            onAnswerValue?.(candidate, picked ?? "");
          }}
        />
        {showSaving ? (
          <div className="flex h-5 items-center">
            <SaveStatusIndicator status="saving" isSaving />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <ClarifyValueField
        candidate={candidate}
        compact={compact}
        isSaving={pending}
        onSubmit={(next) => onAnswerValue?.(candidate, next)}
      />
      {showSaving ? (
        <div className="flex h-5 items-center">
          <SaveStatusIndicator status="saving" isSaving />
        </div>
      ) : null}
    </div>
  );
}
