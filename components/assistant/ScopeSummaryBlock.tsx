"use client";

import { useMemo, useState } from "react";
import type { ScopeReview } from "@/lib/assistant/types";
import { AddWorkAreaDialog } from "@/components/assistant/AddWorkAreaDialog";
import {
  ScopeReviewMissingSection,
  type MissingQuestionAnswers,
} from "@/components/assistant/ScopeReviewMissingSection";
import { ScopeReviewFactRow } from "@/components/assistant/ScopeReviewFactRow";
import type { WorkArea, WorkAreaActiveQuestion } from "@/components/assistant/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ScopeSummaryBlockProps = {
  scopeReview: ScopeReview;
  workAreas?: WorkArea[];
  editable?: boolean;
  manageWorkAreas?: boolean;
  estimateIsStale?: boolean;
  savingFactKey?: string | null;
  savingWorkAreaId?: string | null;
  workAreaQuestionError?: string | null;
  factError?: string | null;
  isAddingWorkArea?: boolean;
  isExcludingWorkArea?: boolean;
  addWorkAreaError?: string | null;
  onFactSave?: (input: {
    workAreaId: string;
    key: string;
    label: string;
    value: string | number | boolean;
    unit?: string;
    inputType?: "number" | "select" | "boolean" | "text";
  }) => Promise<void>;
  onSaveWorkAreaQuestions?: (input: {
    workAreaId: string;
    workAreaName: string;
    questions: WorkAreaActiveQuestion[];
    answers: MissingQuestionAnswers;
  }) => Promise<void>;
  onAddWorkArea?: (workAreaType: string) => Promise<void>;
  onExcludeWorkArea?: (workAreaId: string) => Promise<void>;
};

function GlobalList({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  if (!items.length) return null;

  return (
    <div>
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {title}
      </h4>
      <ul className="mt-1.5 space-y-1.5 text-sm">
        {items.map((item) => (
          <li key={item} className="leading-relaxed break-words">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function initMissingAnswers(
  questions: WorkAreaActiveQuestion[]
): MissingQuestionAnswers {
  return Object.fromEntries(
    questions.map((question) => [question.id, question.value ?? null])
  );
}

export function ScopeSummaryBlock({
  scopeReview,
  workAreas = [],
  editable = false,
  manageWorkAreas = false,
  estimateIsStale,
  savingFactKey,
  savingWorkAreaId,
  workAreaQuestionError,
  factError,
  isAddingWorkArea,
  isExcludingWorkArea,
  addWorkAreaError,
  onFactSave,
  onSaveWorkAreaQuestions,
  onAddWorkArea,
  onExcludeWorkArea,
}: ScopeSummaryBlockProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [excludeTarget, setExcludeTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [editedAnswers, setEditedAnswers] = useState<
    Record<string, MissingQuestionAnswers>
  >({});

  const missingAnswers = useMemo(() => {
    const merged: Record<string, MissingQuestionAnswers> = {};

    for (const workArea of scopeReview.workAreas) {
      if (workArea.activeQuestions.length === 0) {
        continue;
      }

      merged[workArea.workAreaId] = {
        ...initMissingAnswers(workArea.activeQuestions),
        ...(editedAnswers[workArea.workAreaId] ?? {}),
      };
    }

    return merged;
  }, [scopeReview.workAreas, editedAnswers]);

  return (
    <div className="space-y-4">
      {manageWorkAreas ? (
        <div className="rounded-xl border border-border/60 bg-muted/15 px-3 py-3">
          <p className="text-xs text-muted-foreground">
            Changing work areas will mark the estimate as outdated. Regenerate
            when you are ready.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 h-8"
            disabled={isAddingWorkArea || isExcludingWorkArea}
            onClick={() => setAddDialogOpen(true)}
          >
            Add work area
          </Button>
        </div>
      ) : null}

      {estimateIsStale ? (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
          role="status"
        >
          <p className="font-medium">Estimate outdated</p>
          <p className="mt-0.5">
            Regenerate to reflect these changes in the pricing.
          </p>
        </div>
      ) : null}

      {scopeReview.workAreas.map((workArea) => (
        <article
          key={workArea.workAreaId}
          className="rounded-xl border border-border/60 bg-muted/20 px-3 py-3 sm:px-4 sm:py-3.5"
        >
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-semibold text-foreground">
              {workArea.workAreaName}
            </h4>
            {manageWorkAreas && onExcludeWorkArea ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 px-2 text-xs text-muted-foreground"
                disabled={isExcludingWorkArea || isAddingWorkArea}
                onClick={() =>
                  setExcludeTarget({
                    id: workArea.workAreaId,
                    name: workArea.workAreaName,
                  })
                }
              >
                Remove from estimate
              </Button>
            ) : null}
          </div>
          {workArea.summary ? (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground break-words">
              {workArea.summary}
            </p>
          ) : null}

          {workArea.facts.length > 0 ? (
            <div className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {workArea.facts.map((fact) => {
                const factKey = `${workArea.workAreaId}:${fact.key}`;
                return (
                  <ScopeReviewFactRow
                    key={factKey}
                    fact={fact}
                    editable={editable}
                    isSaving={savingFactKey === factKey}
                    error={savingFactKey === factKey ? factError : null}
                    onSave={
                      onFactSave
                        ? async (value) =>
                            onFactSave({
                              workAreaId: workArea.workAreaId,
                              key: fact.key,
                              label: fact.label,
                              value,
                              unit: fact.unit,
                              inputType: fact.inputType,
                            })
                        : undefined
                    }
                  />
                );
              })}
            </div>
          ) : null}

          {workArea.activeQuestions.length > 0 && onSaveWorkAreaQuestions ? (
            <ScopeReviewMissingSection
              workAreaName={workArea.workAreaName}
              questions={workArea.activeQuestions}
              answers={
                missingAnswers[workArea.workAreaId] ??
                initMissingAnswers(workArea.activeQuestions)
              }
              isSaving={savingWorkAreaId === workArea.workAreaId}
              error={
                savingWorkAreaId === workArea.workAreaId
                  ? workAreaQuestionError
                  : null
              }
              onAnswerChange={(questionId, value) =>
                setEditedAnswers((prev) => ({
                  ...prev,
                  [workArea.workAreaId]: {
                    ...(prev[workArea.workAreaId] ?? {}),
                    [questionId]: value,
                  },
                }))
              }
              onSave={() =>
                void onSaveWorkAreaQuestions({
                  workAreaId: workArea.workAreaId,
                  workAreaName: workArea.workAreaName,
                  questions: workArea.activeQuestions,
                  answers:
                    missingAnswers[workArea.workAreaId] ??
                    initMissingAnswers(workArea.activeQuestions),
                })
              }
            />
          ) : null}

          {workArea.missingItems.length > 0 ? (
            <div className="mt-3 border-t border-border/50 pt-3">
              <h4 className="text-xs font-medium text-amber-700 dark:text-amber-400">
                Missing
              </h4>
              <ul className="mt-1.5 list-inside list-disc space-y-1 text-sm text-amber-800 dark:text-amber-300">
                {workArea.missingItems.map((item) => (
                  <li key={item} className="leading-relaxed break-words">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </article>
      ))}

      {scopeReview.excludedWorkAreas.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Not included:{" "}
          {scopeReview.excludedWorkAreas
            .map((workArea) => workArea.workAreaName)
            .join(", ")}
        </p>
      ) : null}

      <div className="space-y-4 border-t border-border/60 pt-4">
        <GlobalList
          title="General assumptions"
          items={scopeReview.generalAssumptions}
        />
        <GlobalList
          title="Not priced / excluded"
          items={scopeReview.generalExclusions}
        />
      </div>

      {onAddWorkArea ? (
        <AddWorkAreaDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          workAreas={workAreas}
          isSaving={isAddingWorkArea}
          error={addWorkAreaError}
          onAdd={async (workAreaType) => {
            await onAddWorkArea(workAreaType);
            setAddDialogOpen(false);
          }}
        />
      ) : null}

      <Dialog
        open={excludeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setExcludeTarget(null);
        }}
      >
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Remove from estimate?</DialogTitle>
            <DialogDescription>
              Remove {excludeTarget?.name} from this estimate? Existing details
              will be kept in case you add it back later. The estimate will need
              to be regenerated.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={isExcludingWorkArea}
              onClick={() => setExcludeTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isExcludingWorkArea || !excludeTarget}
              onClick={() => {
                if (!excludeTarget || !onExcludeWorkArea) return;
                void onExcludeWorkArea(excludeTarget.id).then(() => {
                  setExcludeTarget(null);
                });
              }}
            >
              {isExcludingWorkArea ? "Removing…" : "Remove from estimate"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
