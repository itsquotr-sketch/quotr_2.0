"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import type { ClarifyCandidate } from "@/lib/assistant/clarify/types";
import type { EstimateReadinessView } from "@/lib/assistant/readiness/types";
import type { RefineCandidate, RefineGroupId, RefineView } from "@/lib/assistant/refine/types";
import { ASSISTANT_ACTION_LABELS } from "@/lib/assistant/presentation/action-labels";

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
  const allCandidates = useMemo(
    () => [...view.highValue, ...view.advanced],
    [view.advanced, view.highValue]
  );

  const groupedByWorkArea = useMemo(() => {
    const buckets = new Map<
      string,
      { label: string; rows: RefineCandidate[] }
    >();
    for (const row of allCandidates) {
      const key = row.workAreaId ?? "project";
      const label = row.workAreaName ?? "Site & project";
      const existing = buckets.get(key) ?? { label, rows: [] };
      existing.rows.push(row);
      buckets.set(key, existing);
    }
    return [...buckets.values()];
  }, [allCandidates]);

  const groups: RefineGroupId[] = [
    "scope",
    "specification",
    "structure",
    "project_conditions",
  ];

  return (
    <div
      className="space-y-4 overflow-x-hidden pb-[max(1rem,env(safe-area-inset-bottom))]"
      data-refine-panel
      data-clarify-panel
      data-refine-all-visible="true"
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

      {groupedByWorkArea.length > 0 ? (
        <div className="space-y-4" data-refine-tier="all-actionable">
          {groupedByWorkArea.map((workAreaBucket) => (
            <section
              key={workAreaBucket.label}
              className="space-y-3"
              data-refine-work-area={workAreaBucket.label}
            >
              <p className="text-xs font-semibold tracking-tight text-foreground">
                {workAreaBucket.label}
              </p>
              {groups.map((group) => {
                const rows = workAreaBucket.rows.filter((row) => row.group === group);
                if (rows.length === 0) return null;
                return (
                  <div
                    key={`${workAreaBucket.label}:${group}`}
                    className="space-y-3"
                    data-refine-group={group}
                  >
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
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
                  </div>
                );
              })}
            </section>
          ))}
        </div>
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
