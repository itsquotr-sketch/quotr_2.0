"use client";

import { useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { ActionFooter } from "@/components/ui/action-footer";
import { Button } from "@/components/ui/button";
import { SaveStatusIndicator } from "@/components/assistant/SaveStatusIndicator";
import { createWallTypeId } from "@/lib/estimate/internal-walls-wall-types";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import type { ClarifyCandidate } from "@/lib/assistant/clarify/types";
import type { EstimateReadinessView } from "@/lib/assistant/readiness/types";
import type { RefineCandidate, RefineView } from "@/lib/assistant/refine/types";
import { ASSISTANT_ACTION_LABELS, ASSISTANT_LOADING_COPY } from "@/lib/assistant/presentation/action-labels";
import { PREMIUM } from "@/lib/ui/premium";
import { cn } from "@/lib/utils";
import { InternalWallsWallTypesPanel } from "@/components/assistant/refine/InternalWallsWallTypesPanel";
import {
  RefineFieldRow,
  toRefineClarifyCandidate,
} from "@/components/assistant/refine/RefineFieldRow";
import { groupRefineCandidatesForDisplay } from "@/components/assistant/refine/refine-presentation";
import { candidateMatchesFocus } from "@/lib/assistant/question-identity";
import {
  booleanChoiceOptions,
  clarifyControlType,
} from "@/lib/assistant/clarify/question-contract";

export function RefineEstimatePanel({
  view,
  isSaving,
  persistError,
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
  onWallTypeAction,
}: {
  view: RefineView;
  isSaving?: boolean;
  persistError?: string | null;
  onDone: () => void;
  onEstimateNow?: () => void;
  canEstimateNow: boolean;
  focusKey?: string | null;
  isStale?: boolean;
  isRegenerating?: boolean;
  updateError?: string | null;
  onUpdateEstimate?: () => void;
  onAnswerBoolean?: (candidate: ClarifyCandidate, presentation: "INCLUDED" | "NOT_INCLUDED") => void;
  onAnswerValue?: (
    candidate: ClarifyCandidate,
    value: string | number | boolean | string[]
  ) => void;
  onWallTypeAction?: (
    workAreaId: string,
    key: string,
    value: string | boolean,
    label: string,
    wallTypeId?: string | null,
    openingId?: string | null
  ) => void | Promise<unknown>;
}) {
  const [localValues, setLocalValues] = useState<
    Record<string, string | number | boolean | string[]>
  >({});
  const [editingId, setEditingId] = useState<string | null | undefined>(undefined);
  const continueLockRef = useRef(false);
  const allCandidates = useMemo(
    () => [...view.highValue, ...view.advanced],
    [view.advanced, view.highValue]
  );
  const candidateIds = useMemo(
    () => new Set(allCandidates.map((row) => row.id)),
    [allCandidates]
  );

  const displayGroups = useMemo(
    () =>
      groupRefineCandidatesForDisplay({
        candidates: allCandidates,
        wallTypePanels: view.wallTypePanels,
        focusKey,
      }),
    [allCandidates, focusKey, view.wallTypePanels]
  );

  const focusedCandidate = focusKey
    ? allCandidates.find((row) => candidateMatchesFocus(row, focusKey))
    : null;

  const workAreaGroups = displayGroups.filter((group) => group.kind === "work_area");
  const projectGroup = displayGroups.find((group) => group.kind === "project_conditions");
  const showUpdate = Boolean(isStale && onUpdateEstimate);
  const showFooter = showUpdate || canEstimateNow;

  const isEditing = (row: RefineCandidate) => {
    if (editingId === undefined) {
      return Boolean(focusKey && candidateMatchesFocus(row, focusKey));
    }
    if (typeof editingId === "string" && !candidateIds.has(editingId)) {
      return false;
    }
    return editingId === row.id;
  };

  const renderRow = (row: RefineCandidate) => {
    const mapped = toRefineClarifyCandidate(row);
    const value = localValues[row.id] ?? row.currentValue ?? null;
    const control = clarifyControlType(mapped);
    return (
      <RefineFieldRow
        key={row.id}
        candidate={row}
        value={value}
        persistError={persistError}
        focused={Boolean(focusKey && candidateMatchesFocus(row, focusKey))}
        editing={isEditing(row)}
        onToggleEdit={(next) => setEditingId(next ? row.id : null)}
        onAnswerBoolean={(candidate, presentation) => {
          const options = booleanChoiceOptions(row);
          setLocalValues((prev) => ({
            ...prev,
            [row.id]:
              presentation === "INCLUDED"
                ? options.includes("Yes")
                  ? "Yes"
                  : "Include"
                : options.includes("Yes")
                  ? "No"
                  : "Not included",
          }));
          onAnswerBoolean?.(candidate, presentation);
          setEditingId(null);
        }}
        onAnswerValue={(candidate, nextValue) => {
          setLocalValues((prev) => ({ ...prev, [row.id]: nextValue }));
          if (control === "MULTI_SELECT") return;
          onAnswerValue?.(candidate, nextValue);
          setEditingId(null);
        }}
        onContinueMulti={() => {
          if (continueLockRef.current) return;
          continueLockRef.current = true;
          const nextValue = localValues[row.id] ?? row.currentValue;
          const set = Array.isArray(nextValue)
            ? nextValue
            : nextValue == null || nextValue === ""
              ? []
              : [String(nextValue)];
          onAnswerValue?.(mapped, set);
          setEditingId(null);
          continueLockRef.current = false;
        }}
      />
    );
  };

  const renderGroup = (group: (typeof displayGroups)[number], span = false) => (
    <section
      key={group.workAreaId ?? group.kind}
      className={cn(
        PREMIUM.card,
        PREMIUM.cardPad,
        "min-w-0",
        span && "lg:col-span-2"
      )}
      data-refine-work-area={group.workAreaName}
      data-refine-work-area-id={group.workAreaId ?? "project"}
    >
      <h2 className={PREMIUM.sectionTitle}>{group.workAreaName}</h2>
      <div className="mt-3 space-y-4">
        {group.sections.map((section) => (
          <div
            key={`${section.id}:${section.wallTypeId ?? ""}`}
            data-refine-group={section.id}
            data-refine-wall-type={section.wallTypeId ?? undefined}
          >
            {group.kind === "project_conditions" &&
            section.id === "project_conditions" ? null : (
              <SectionEyebrow>
                {section.wallTypeLabel
                  ? `${section.label} · ${section.wallTypeLabel}`
                  : section.label}
              </SectionEyebrow>
            )}
            <div className="mt-1 divide-y divide-border/70">
              {section.candidates.map(renderRow)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <div
      className="space-y-4 overflow-x-hidden pb-2 md:space-y-5"
      data-refine-panel
      data-clarify-panel
      data-refine-all-visible="true"
      data-refine-structured="true"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <SectionEyebrow>Improve this estimate</SectionEyebrow>
          {focusedCandidate ? (
            <p className="mt-1 text-sm font-medium" data-refine-focus-context>
              {focusedCandidate.workAreaName ?? "Project"}
              <span className="mx-1.5 text-muted-foreground">→</span>
              {focusedCandidate.label}
            </p>
          ) : (
            <p className="mt-0.5 hidden text-sm text-muted-foreground md:block">
              Review and edit what this estimate is using.
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
          {updateError ? (
            <p className="mt-2 text-sm text-destructive" role="alert">
              {updateError}
            </p>
          ) : null}
        </div>
      ) : persistError ? (
        <p className="text-sm text-destructive" role="alert">
          {persistError}
        </p>
      ) : null}

      {view.wallTypePanels && view.wallTypePanels.length > 0 && onWallTypeAction ? (
        <div className="space-y-4" data-refine-wall-types>
          {view.wallTypePanels.map((panel) => (
            <InternalWallsWallTypesPanel
              key={panel.workAreaId}
              panel={panel}
              isSaving={isSaving}
              onAdd={async (workAreaId) => {
                const id = createWallTypeId();
                await onWallTypeAction(
                  workAreaId,
                  "internal_walls.add_wall_type",
                  id,
                  "Add wall type",
                  id
                );
              }}
              onDuplicate={(workAreaId, wallTypeId) => {
                const copyId = createWallTypeId();
                onWallTypeAction(
                  workAreaId,
                  "internal_walls.duplicate_wall_type",
                  wallTypeId,
                  "Duplicate wall type",
                  copyId
                );
              }}
              onDelete={(workAreaId, wallTypeId) =>
                onWallTypeAction(
                  workAreaId,
                  "internal_walls.delete_wall_type",
                  wallTypeId,
                  "Remove wall type"
                )
              }
              onSelect={(workAreaId, wallTypeId) => {
                setEditingId(null);
                onWallTypeAction(
                  workAreaId,
                  "internal_walls.active_wall_type_id",
                  wallTypeId,
                  "Selected wall type"
                );
              }}
              onAddOpening={async (workAreaId, wallTypeId, openingId) => {
                await onWallTypeAction(
                  workAreaId,
                  "internal_walls.add_opening",
                  openingId,
                  "Add opening",
                  wallTypeId,
                  openingId
                );
              }}
              onDeleteOpening={(workAreaId, wallTypeId, openingId) =>
                onWallTypeAction(
                  workAreaId,
                  "internal_walls.delete_opening",
                  openingId,
                  "Remove opening",
                  wallTypeId,
                  openingId
                )
              }
              onSelectOpening={(workAreaId, wallTypeId, openingId) => {
                setEditingId(null);
                onWallTypeAction(
                  workAreaId,
                  "internal_walls.active_opening_id",
                  openingId,
                  "Selected opening",
                  wallTypeId,
                  openingId
                );
              }}
            />
          ))}
        </div>
      ) : null}

      {displayGroups.length > 0 ? (
        <div
          className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-2 lg:gap-6"
          data-refine-tier="all-actionable"
        >
          {workAreaGroups.map((group) =>
            renderGroup(group, workAreaGroups.length === 1)
          )}
        </div>
      ) : null}

      {projectGroup ? (
        <div className="min-w-0">{renderGroup(projectGroup)}</div>
      ) : null}

      {showFooter ? (
        <ActionFooter
          className="-mx-1 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] md:bottom-0"
          data-refine-cta-bar=""
        >
          <div className="flex w-full flex-col gap-2 sm:flex-row">
            {showUpdate ? (
              <Button
                type="button"
                className="min-h-11 w-full"
                data-refine-update-estimate
                onClick={onUpdateEstimate}
                disabled={isRegenerating}
              >
                {isRegenerating
                  ? ASSISTANT_ACTION_LABELS.updatingEstimate
                  : ASSISTANT_ACTION_LABELS.updateEstimate}
              </Button>
            ) : (
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
            )}
          </div>
        </ActionFooter>
      ) : null}
    </div>
  );
}

export function ClarifyReadinessCard({
  readiness,
  isSaving,
  isGenerating,
  onEstimateNow,
}: {
  readiness: EstimateReadinessView;
  isSaving?: boolean;
  isGenerating?: boolean;
  onEstimateNow?: () => void;
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
            <SectionEyebrow>Need this to estimate</SectionEyebrow>
            <p
              className="mt-1 text-base font-semibold tracking-tight"
              data-readiness-blocker={readiness.blocksEstimate ? "true" : undefined}
            >
              {readiness.blockerCopy ?? readiness.heading}
            </p>
          </>
        ) : (
          <>
            <SectionEyebrow>Ready to estimate</SectionEyebrow>
            <p className="mt-1 text-base font-semibold tracking-tight">
              That&apos;s enough to build your estimate.
            </p>
          </>
        )}
        <p className="mt-1 text-sm text-muted-foreground">
          {readiness.blocksEstimate
            ? readiness.explanation
            : "All required details resolved. You can still change the job afterward."}
        </p>
      {readiness.confidenceLabel ? (
        <p className="mt-1 text-xs text-muted-foreground" data-readiness-confidence>
          {readiness.confidenceLabel}
        </p>
      ) : null}
    </div>

      {readiness.known.length > 0 ? (
        <div data-readiness-known>
          <p className={PREMIUM.eyebrow}>
            Known
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
            We&apos;ve assumed
          </p>
          <ul className="mt-1 space-y-0.5 text-sm">
            {readiness.assumptions.map((row) => (
              <li key={row.id}>• {row.statement}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {isSaving ? (
        <div data-clarify-save-status>
          <SaveStatusIndicator status="saving" isSaving />
        </div>
      ) : null}

      <ActionFooter
        className="bottom-[calc(3.5rem+env(safe-area-inset-bottom))] md:bottom-0"
        innerClassName="flex-col sm:flex-row"
      >
        <Button
          type="button"
          className="min-h-11 w-full"
          data-clarify-primary-cta
          disabled={isSaving || readiness.blocksEstimate}
          onClick={onEstimateNow}
        >
          {isGenerating ? (
            <span className="inline-flex items-center justify-center gap-1.5">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              {ASSISTANT_LOADING_COPY.estimateGenerate}
            </span>
          ) : isSaving ? (
            <span className="inline-flex items-center justify-center gap-1.5">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              {ASSISTANT_ACTION_LABELS.saving}
            </span>
          ) : (
            ASSISTANT_ACTION_LABELS.generateEstimate
          )}
        </Button>
      </ActionFooter>
    </div>
  );
}
