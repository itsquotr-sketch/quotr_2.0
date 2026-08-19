"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ClarifyCandidate } from "@/lib/assistant/clarify/types";
import type { EstimateReadinessView } from "@/lib/assistant/readiness/types";
import type { RefineCandidate, RefineGroupId, RefineView } from "@/lib/assistant/refine/types";
import { ASSISTANT_ACTION_LABELS } from "@/lib/assistant/presentation/action-labels";
import { cn } from "@/lib/utils";

const GROUP_LABEL: Record<RefineGroupId, string> = {
  scope: "Scope",
  specification: "Specification",
  structure: "Structure",
  project_conditions: "Project Conditions",
  advanced: "Advanced",
};

function toClarifyCandidate(row: RefineCandidate): ClarifyCandidate {
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
    options: row.options,
    writeTarget: row.writeTarget,
    write: row.write,
    blocksEstimate: false,
    assumable: true,
    rankScore: 0,
    rankReason: "refine",
    assumptionStatement: null,
  };
}

function RefineField({
  candidate,
  isSaving,
  onAnswerBoolean,
  onAnswerValue,
}: {
  candidate: RefineCandidate;
  isSaving?: boolean;
  onAnswerBoolean?: (candidate: ClarifyCandidate, presentation: "INCLUDED" | "NOT_INCLUDED") => void;
  onAnswerValue?: (candidate: ClarifyCandidate, value: string | number | boolean) => void;
}) {
  const mapped = toClarifyCandidate(candidate);
  return (
    <div className="space-y-2" data-refine-field={candidate.factKey ?? candidate.constraintKey}>
      {candidate.workAreaName ? (
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {candidate.workAreaName}
        </p>
      ) : null}
      <p className="text-sm font-medium leading-snug">{candidate.question}</p>
      {candidate.inputType === "boolean" ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            className="min-h-11 w-full sm:w-auto"
            disabled={isSaving}
            onClick={() => onAnswerBoolean?.(mapped, "INCLUDED")}
          >
            Include
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full sm:w-auto"
            disabled={isSaving}
            onClick={() => onAnswerBoolean?.(mapped, "NOT_INCLUDED")}
          >
            Not included
          </Button>
        </div>
      ) : candidate.options && candidate.options.length > 0 ? (
        <div className="grid gap-2">
          {candidate.options.map((option) => (
            <button
              key={option}
              type="button"
              disabled={isSaving}
              className="min-h-11 rounded-xl border border-border px-4 py-3 text-left text-sm hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onAnswerValue?.(mapped, option)}
            >
              {option}
            </button>
          ))}
        </div>
      ) : (
        <input
          className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
          inputMode={candidate.inputType === "number" ? "decimal" : "text"}
          aria-label={candidate.label}
          disabled={isSaving}
          onBlur={(event) => {
            const raw = event.target.value;
            if (!raw.trim()) return;
            const value =
              candidate.inputType === "number" ? Number(raw) : raw;
            if (candidate.inputType === "number" && !Number.isFinite(value)) return;
            onAnswerValue?.(mapped, value);
          }}
        />
      )}
    </div>
  );
}

export function RefineEstimatePanel({
  view,
  isSaving,
  onDone,
  onEstimateNow,
  canEstimateNow,
  onAnswerBoolean,
  onAnswerValue,
}: {
  view: RefineView;
  isSaving?: boolean;
  onDone: () => void;
  onEstimateNow?: () => void;
  canEstimateNow: boolean;
  onAnswerBoolean?: (candidate: ClarifyCandidate, presentation: "INCLUDED" | "NOT_INCLUDED") => void;
  onAnswerValue?: (candidate: ClarifyCandidate, value: string | number | boolean) => void;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const groups: RefineGroupId[] = [
    "scope",
    "specification",
    "structure",
    "project_conditions",
  ];
  const highByGroup = (id: RefineGroupId) =>
    view.highValue.filter((row) => row.group === id);

  return (
    <div
      className="space-y-4 overflow-x-hidden pb-[max(1rem,env(safe-area-inset-bottom))]"
      data-refine-panel
      data-clarify-panel
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Refine estimate
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Optional details that this estimate actually uses to improve accuracy.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-11 min-h-11 shrink-0 px-4"
          data-refine-done
          onClick={onDone}
        >
          {ASSISTANT_ACTION_LABELS.done}
        </Button>
      </div>

      {canEstimateNow ? (
        <Button
          type="button"
          className="min-h-11 w-full"
          data-clarify-primary-cta
          disabled={isSaving}
          onClick={onEstimateNow}
        >
          {isSaving
            ? ASSISTANT_ACTION_LABELS.saving
            : ASSISTANT_ACTION_LABELS.estimateNow}
        </Button>
      ) : null}

      {view.highValue.length > 0 ? (
        <div className="space-y-3" data-refine-tier="most-useful">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Most useful
          </p>
          {groups.map((group) => {
            const rows = highByGroup(group);
            if (rows.length === 0) return null;
            return (
              <section key={group} className="space-y-3" data-refine-group={group}>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {GROUP_LABEL[group]}
                </p>
                {rows.map((row) => (
                  <RefineField
                    key={row.id}
                    candidate={row}
                    isSaving={isSaving}
                    onAnswerBoolean={onAnswerBoolean}
                    onAnswerValue={onAnswerValue}
                  />
                ))}
              </section>
            );
          })}
        </div>
      ) : null}

      {view.advanced.length > 0 ? (
        <section data-refine-group="advanced">
          <button
            type="button"
            className="flex min-h-11 w-full items-center justify-between rounded-xl border border-border/60 px-3 py-2 text-left"
            data-refine-advanced-toggle
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen((open) => !open)}
          >
            <span className="text-sm font-medium">More detail</span>
            <ChevronDown
              className={cn(
                "size-4 text-muted-foreground transition-transform",
                advancedOpen && "rotate-180"
              )}
            />
          </button>
          {advancedOpen ? (
            <div className="mt-3 space-y-3" data-refine-advanced>
              {view.advanced.map((row) => (
                <RefineField
                  key={row.id}
                  candidate={row}
                  isSaving={isSaving}
                  onAnswerBoolean={onAnswerBoolean}
                  onAnswerValue={onAnswerValue}
                />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

export function ClarifyReadinessCard({
  readiness,
  showRefine,
  isSaving,
  onEstimateNow,
  onRefine,
}: {
  readiness: EstimateReadinessView;
  showRefine: boolean;
  isSaving?: boolean;
  onEstimateNow?: () => void;
  onRefine?: () => void;
}) {
  return (
    <div
      className="space-y-4 overflow-x-hidden"
      data-clarify-panel
      data-clarify-readiness
      data-clarify-empty="true"
    >
      <div>
        <p className="text-base font-semibold tracking-tight">{readiness.heading}</p>
        <p className="mt-1 text-sm text-muted-foreground">{readiness.explanation}</p>
        {readiness.confidenceLabel ? (
          <p className="mt-1 text-xs text-muted-foreground" data-readiness-confidence>
            {readiness.confidenceLabel}
          </p>
        ) : null}
      </div>

      {readiness.blockerCopy && readiness.blocksEstimate ? (
        <p className="text-sm font-medium" data-readiness-blocker>
          {readiness.blockerCopy}
        </p>
      ) : null}

      {readiness.known.length > 0 ? (
        <div data-readiness-known>
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Using
          </p>
          <ul className="mt-1 space-y-0.5 text-sm">
            {readiness.known.map((row) => (
              <li key={row}>• {row}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {readiness.assumptions.length > 0 ? (
        <div data-readiness-assumptions>
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Assuming
          </p>
          <ul className="mt-1 space-y-0.5 text-sm">
            {readiness.assumptions.map((row) => (
              <li key={row.id}>• {row.statement}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          className="min-h-11 w-full"
          data-clarify-primary-cta
          disabled={isSaving || readiness.blocksEstimate}
          onClick={onEstimateNow}
        >
          {isSaving
            ? ASSISTANT_ACTION_LABELS.saving
            : ASSISTANT_ACTION_LABELS.estimateNow}
        </Button>
        {showRefine ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full"
            data-clarify-refine-cta
            disabled={isSaving}
            onClick={onRefine}
          >
            {ASSISTANT_ACTION_LABELS.refineEstimate}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
