"use client";

import { useMemo } from "react";
import { ActionFooter } from "@/components/ui/action-footer";
import { Button } from "@/components/ui/button";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import type { ClarifyCandidate } from "@/lib/assistant/clarify/types";
import type { EstimateReadinessView } from "@/lib/assistant/readiness/types";
import type { RefineCandidate, RefineGroupId, RefineView } from "@/lib/assistant/refine/types";
import { ASSISTANT_ACTION_LABELS } from "@/lib/assistant/presentation/action-labels";
import { PREMIUM } from "@/lib/ui/premium";
import { cn } from "@/lib/utils";
import { ClarifyValueField } from "@/components/assistant/clarify/ClarifyValueField";

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
    unit: row.unit,
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
  focusKey,
  onAnswerBoolean,
  onAnswerValue,
}: {
  candidate: RefineCandidate;
  isSaving?: boolean;
  focusKey?: string | null;
  onAnswerBoolean?: (candidate: ClarifyCandidate, presentation: "INCLUDED" | "NOT_INCLUDED") => void;
  onAnswerValue?: (candidate: ClarifyCandidate, value: string | number | boolean) => void;
}) {
  const mapped = toClarifyCandidate(candidate);
  const fieldKey = candidate.factKey ?? candidate.constraintKey;
  const focused = Boolean(focusKey && fieldKey === focusKey);
  return (
    <div
      className={cn(
        "space-y-2",
        focused &&
          "rounded-xl ring-2 ring-[var(--brand-orange)]/30 ring-offset-2 ring-offset-background"
      )}
      data-refine-field={fieldKey}
    >
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
        <ClarifyValueField
          candidate={mapped}
          isSaving={isSaving}
          onSubmit={(value) => onAnswerValue?.(mapped, value)}
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
  focusKey,
  isStale = false,
  isRegenerating = false,
  updateError = null,
  onUpdateEstimate,
  onAnswerBoolean,
  onAnswerValue,
}: {
  view: RefineView;
  isSaving?: boolean;
  onDone: () => void;
  onEstimateNow?: () => void;
  canEstimateNow: boolean;
  focusKey?: string | null;
  isStale?: boolean;
  isRegenerating?: boolean;
  updateError?: string | null;
  onUpdateEstimate?: () => void;
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
    const groups = [...buckets.values()];
    if (!focusKey) return groups;
    const focusedIndex = groups.findIndex((bucket) =>
      bucket.rows.some(
        (row) => row.factKey === focusKey || row.constraintKey === focusKey
      )
    );
    if (focusedIndex <= 0) return groups;
    const focused = groups[focusedIndex]!;
    return [focused, ...groups.filter((_, i) => i !== focusedIndex)];
  }, [allCandidates, focusKey]);

  const focusedCandidate = focusKey
    ? allCandidates.find(
        (row) => row.factKey === focusKey || row.constraintKey === focusKey
      )
    : null;

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
          <SectionEyebrow>Refine estimate</SectionEyebrow>
          {focusedCandidate ? (
            <p className="mt-1 text-sm font-medium" data-refine-focus-context>
              {focusedCandidate.workAreaName ?? "Project"}
              <span className="mx-1.5 text-muted-foreground">→</span>
              {focusedCandidate.label}
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-muted-foreground">
              Optional details that this estimate actually uses to improve accuracy.
            </p>
          )}
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

      {isStale ? (
        <div
          className="rounded-xl border border-amber-300/80 bg-amber-50/80 px-3.5 py-3 dark:border-amber-800/60 dark:bg-amber-950/30"
          role="status"
          data-refine-stale="true"
        >
          <p className="text-sm font-medium text-amber-950 dark:text-amber-100">
            Estimate needs updating
          </p>
          <p className="mt-0.5 text-xs text-amber-900/90 dark:text-amber-200/90">
            Saved changes are on the job. Update the estimate when you are ready.
          </p>
          {onUpdateEstimate ? (
            <Button
              type="button"
              className="mt-3 h-11 w-full min-h-11 sm:w-auto"
              data-refine-update-estimate
              onClick={onUpdateEstimate}
              disabled={isRegenerating}
            >
              {isRegenerating
                ? ASSISTANT_ACTION_LABELS.updatingEstimate
                : ASSISTANT_ACTION_LABELS.updateEstimate}
            </Button>
          ) : null}
          {updateError ? (
            <p className="mt-2 text-sm text-destructive" role="alert">
              {updateError}
            </p>
          ) : null}
        </div>
      ) : null}

      {groupedByWorkArea.length > 0 ? (
        <div className="space-y-4" data-refine-tier="all-actionable">
          {groupedByWorkArea.map((workAreaBucket) => (
            <section
              key={workAreaBucket.label}
              className="space-y-3"
              data-refine-work-area={workAreaBucket.label}
            >
              <p className={PREMIUM.sectionTitle}>
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
                    <p className={PREMIUM.eyebrow}>
                      {GROUP_LABEL[group]}
                    </p>
                    {rows.map((row) => (
                      <RefineField
                        key={row.id}
                        candidate={row}
                        isSaving={isSaving}
                        focusKey={focusKey}
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

      {canEstimateNow ? (
        <ActionFooter>
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
        </ActionFooter>
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
        {readiness.blocksEstimate ? (
          <>
            <SectionEyebrow>Need a bit more</SectionEyebrow>
            <p className="mt-1 text-base font-semibold tracking-tight">
              {readiness.heading}
            </p>
          </>
        ) : (
          <>
            <SectionEyebrow>Ready to estimate</SectionEyebrow>
            <p className="mt-1 text-base font-semibold tracking-tight">
              Quotr has enough information to estimate.
            </p>
          </>
        )}
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
          <p className={PREMIUM.eyebrow}>
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
          <p className={PREMIUM.eyebrow}>
            Assuming
          </p>
          <ul className="mt-1 space-y-0.5 text-sm">
            {readiness.assumptions.map((row) => (
              <li key={row.id}>• {row.statement}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <ActionFooter innerClassName="flex-col sm:flex-row">
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
      </ActionFooter>
    </div>
  );
}
