"use client";

import { Button } from "@/components/ui/button";
import { ClarifyAnswerControl } from "@/components/assistant/clarify/ClarifyAnswerControl";
import type { ClarifyCandidate } from "@/lib/assistant/clarify/types";
import { clarifyControlType } from "@/lib/assistant/clarify/question-contract";
import { ASSISTANT_ACTION_LABELS } from "@/lib/assistant/presentation/action-labels";
import type { RefineCandidate } from "@/lib/assistant/refine/types";
import { cn } from "@/lib/utils";
import {
  formatRefineCurrentValue,
  isUnsetRefineValue,
} from "@/components/assistant/refine/refine-presentation";

export function toRefineClarifyCandidate(row: RefineCandidate): ClarifyCandidate {
  return {
    id: row.id,
    source: row.writeTarget === "CONSTRAINT" ? "project_condition" : "scope_fact",
    workAreaId: row.workAreaId,
    workAreaName: row.workAreaName,
    workAreaType: row.workAreaType,
    factKey: row.factKey,
    constraintKey: row.constraintKey,
    questionKey: row.questionKey,
    label: row.label,
    question: row.question,
    askClass: row.tier === "advanced" ? "ADVANCED" : "REFINEMENT",
    inputType: row.inputType,
    currentValue: row.currentValue,
    unit: row.unit,
    options: row.options,
    writeTarget: row.writeTarget,
    write: row.write,
    wallTypeId: row.wallTypeId,
    openingId: row.openingId,
    blocksEstimate: false,
    assumable: true,
    rankScore: 0,
    rankReason: "refine",
    assumptionStatement: null,
  };
}

export function RefineFieldRow({
  candidate,
  value,
  persistError,
  focused = false,
  editing,
  onToggleEdit,
  onAnswerBoolean,
  onAnswerValue,
  onContinueMulti,
}: {
  candidate: RefineCandidate;
  value: string | number | boolean | string[] | null | undefined;
  persistError?: string | null;
  focused?: boolean;
  editing: boolean;
  onToggleEdit: (next: boolean) => void;
  onAnswerBoolean?: (
    candidate: ClarifyCandidate,
    presentation: "INCLUDED" | "NOT_INCLUDED"
  ) => void;
  onAnswerValue?: (
    candidate: ClarifyCandidate,
    value: string | number | boolean | string[]
  ) => void;
  onContinueMulti?: () => void;
}) {
  const mapped = toRefineClarifyCandidate(candidate);
  const fieldKey = candidate.factKey ?? candidate.constraintKey;
  const control = clarifyControlType(mapped);
  const unset = isUnsetRefineValue(value);
  const display = formatRefineCurrentValue(candidate, value);

  return (
    <div
      className={cn(
        "min-w-0 py-2.5 first:pt-0",
        focused &&
          "rounded-lg ring-2 ring-[var(--brand-orange)]/30 ring-offset-2 ring-offset-background"
      )}
      data-refine-field={fieldKey}
      data-refine-row={candidate.id}
      data-refine-input-type={candidate.inputType}
      data-refine-control-type={control}
      data-refine-editing={editing ? "true" : "false"}
      data-refine-assumed={candidate.assumed ? "true" : undefined}
      data-refine-unset={unset ? "true" : undefined}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className="break-words text-sm font-medium leading-snug"
            data-refine-label
          >
            {candidate.label}
          </p>
          {!editing ? (
            <p className="mt-0.5 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
              <span
                className={cn(
                  "break-words",
                  unset ? "text-muted-foreground" : "text-foreground"
                )}
                data-refine-value
              >
                {display ?? "Not set"}
              </span>
              {candidate.assumed && !unset ? (
                <span
                  className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                  data-refine-status="assumed"
                >
                  Assumed
                </span>
              ) : unset ? (
                <span
                  className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                  data-refine-status="unset"
                >
                  Optional
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          className="h-9 min-h-9 shrink-0 px-2.5 text-sm"
          data-refine-edit={unset ? "add" : "edit"}
          onClick={() => onToggleEdit(!editing)}
        >
          {editing
            ? ASSISTANT_ACTION_LABELS.cancel
            : unset
              ? "Add"
              : ASSISTANT_ACTION_LABELS.editScope}
        </Button>
      </div>
      {editing ? (
        <div className="mt-2 min-w-0" data-refine-editor>
          <ClarifyAnswerControl
            candidate={mapped}
            value={value}
            persistError={persistError}
            compact
            onAnswerBoolean={onAnswerBoolean}
            onAnswerValue={onAnswerValue}
            onContinueMulti={
              control === "MULTI_SELECT" ? onContinueMulti : undefined
            }
          />
        </div>
      ) : null}
    </div>
  );
}
