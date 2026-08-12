"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { ScopeReview } from "@/lib/assistant/types";
import { AddWorkAreaDialog } from "@/components/assistant/AddWorkAreaDialog";
import {
  ScopeReviewMissingSection,
  type MissingQuestionAnswers,
} from "@/components/assistant/ScopeReviewMissingSection";
import { ScopeReviewFactRow } from "@/components/assistant/ScopeReviewFactRow";
import { WorkAreaQuoteDescriptionEditor } from "@/components/work-areas/WorkAreaQuoteDescriptionEditor";
import type { WorkArea, WorkAreaActiveQuestion } from "@/components/assistant/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildEstimateReviewWorkAreaSummary } from "@/lib/assistant/presentation";
import { AssistantEmptyState } from "@/components/assistant/AssistantEmptyState";
import { ASSISTANT_ACTION_LABELS } from "@/lib/assistant/presentation/action-labels";
import { listManualScopeItemsForProject } from "@/lib/work-areas/scope-items/actions";
import type { ManualScopeItemView } from "@/lib/work-areas/scope-items/types";
import { SCOPE_DISCOVERY_UI_COPY } from "@/lib/scope-discovery/ui/labels";

function SummaryMetricLine({
  label,
  value,
  attention,
}: {
  label: string;
  value: string;
  attention?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 text-xs">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span
        className={cn(
          "min-w-0 truncate text-right font-medium",
          attention && "text-amber-900 dark:text-amber-200"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function CollapsedQuotePreview({
  description,
  children,
}: {
  description: string | null | undefined;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const text = description?.trim() ?? "";
  if (!text) return null;

  const preview =
    text.length > 120 ? `${text.slice(0, 120).trim()}…` : text;

  return (
    <div className="mt-2.5 border-t border-border/50 pt-2.5">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-2 text-left"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Full quote description
          </p>
          {!open ? (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {preview}
            </p>
          ) : null}
        </div>
        <ChevronDown
          className={cn(
            "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>
      {open ? <div className="mt-2">{children}</div> : null}
    </div>
  );
}

type ScopeSummaryBlockProps = {
  projectId: string;
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
  constraintPreview?: string;
  onFactSave?: (input: {
    workAreaId: string;
    key: string;
    label: string;
    value: string | number | boolean;
    unit?: string;
    inputType?: "number" | "select" | "boolean" | "text" | "multi_select";
  }) => Promise<void>;
  onSaveWorkAreaQuestions?: (input: {
    workAreaId: string;
    workAreaName: string;
    questions: WorkAreaActiveQuestion[];
    answers: MissingQuestionAnswers;
  }) => Promise<void>;
  workAreaSaveStatus?: Record<string, "idle" | "saving" | "saved" | "error">;
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
  projectId,
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
  constraintPreview,
  onFactSave,
  onSaveWorkAreaQuestions,
  workAreaSaveStatus,
  onAddWorkArea,
  onExcludeWorkArea,
}: ScopeSummaryBlockProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [excludeTarget, setExcludeTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [detailsOpen, setDetailsOpen] = useState<Record<string, boolean>>({});
  /** Once a WA has outstanding details, keep it open until manual collapse (7F-R6-R3). */
  const [stickyDetailsOpen, setStickyDetailsOpen] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [manualScopeItems, setManualScopeItems] = useState<
    readonly ManualScopeItemView[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    void listManualScopeItemsForProject(projectId).then((result) => {
      if (cancelled || !result.ok) return;
      setManualScopeItems(result.items);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Optimistic local answers. Do not remount this block on server value changes —
  // local values stay visible over lagging props (Stage 3.1A-R1).
  const [editedAnswers, setEditedAnswers] = useState<
    Record<string, MissingQuestionAnswers>
  >({});
  const [descriptionOverrides, setDescriptionOverrides] = useState<
    Record<string, string | null>
  >({});

  const missingAnswers = useMemo(() => {
    const merged: Record<string, MissingQuestionAnswers> = {};

    for (const workArea of scopeReview.workAreas) {
      if (workArea.activeQuestions.length === 0) {
        continue;
      }

      const serverAnswers = initMissingAnswers(workArea.activeQuestions);
      const local = editedAnswers[workArea.workAreaId] ?? {};
      const activeIds = new Set(
        workArea.activeQuestions.map((question) => question.id)
      );
      const filteredLocal: MissingQuestionAnswers = {};
      for (const [questionId, value] of Object.entries(local)) {
        if (
          activeIds.has(questionId) ||
          savingWorkAreaId === workArea.workAreaId
        ) {
          filteredLocal[questionId] = value;
        }
      }

      merged[workArea.workAreaId] = {
        ...serverAnswers,
        ...filteredLocal,
      };
    }

    return merged;
  }, [scopeReview.workAreas, editedAnswers, savingWorkAreaId]);

  return (
    <div className="space-y-4">
      {manageWorkAreas ? (
        <div className="rounded-xl border border-border/60 bg-muted/15 px-3 py-3">
          <p className="text-xs text-muted-foreground">
            Changing work areas will mark the estimate as outdated. Recalculate
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
            Recalculate to reflect these changes in the pricing.
          </p>
        </div>
      ) : null}

      {scopeReview.workAreas.length === 0 ? (
        <AssistantEmptyState stage="estimate_review" />
      ) : null}

      {scopeReview.workAreas.map((workArea) => {
        const hasMissing = workArea.missingItems.length > 0;
        const summary = buildEstimateReviewWorkAreaSummary(workArea, {
          constraintPreview,
        });
        // Sticky-open incomplete WAs; completion updates badge without forced collapse.
        if (hasMissing && !stickyDetailsOpen.has(workArea.workAreaId)) {
          const next = new Set(stickyDetailsOpen);
          next.add(workArea.workAreaId);
          setStickyDetailsOpen(next);
        }
        const expanded =
          detailsOpen[workArea.workAreaId] ??
          (stickyDetailsOpen.has(workArea.workAreaId) || hasMissing);
        const waManualIncluded = manualScopeItems.filter(
          (item) =>
            item.workAreaId === workArea.workAreaId &&
            item.state === "INCLUDED"
        );

        return (
        <article
          key={workArea.workAreaId}
          data-work-area-id={workArea.workAreaId}
          className={cn(
            "rounded-xl border bg-card px-3 py-3 sm:px-4 sm:py-3.5",
            hasMissing
              ? "border-amber-200/80 bg-amber-50/30"
              : "border-border/60"
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 space-y-1">
              <h4 className="text-sm font-semibold text-foreground">
                {workArea.workAreaName}
              </h4>
              {workArea.summary && expanded ? (
                <p className="text-xs leading-relaxed text-muted-foreground break-words">
                  {workArea.summary}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {hasMissing ? (
                <Badge
                  variant="outline"
                  className="border-amber-300/80 bg-amber-50 text-[10px] font-medium text-amber-900"
                >
                  {workArea.missingItems.length} outstanding
                </Badge>
              ) : null}
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
          </div>

          <div className="mt-3 space-y-1.5 rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
            {editable ? (
              <WorkAreaQuoteDescriptionEditor
                variant="compact"
                projectId={projectId}
                workAreaId={workArea.workAreaId}
                workAreaName={workArea.workAreaName}
                initialDescription={
                  descriptionOverrides[workArea.workAreaId] ??
                  workArea.quoteDescription
                }
                onSaved={(description) =>
                  setDescriptionOverrides((prev) => ({
                    ...prev,
                    [workArea.workAreaId]: description,
                  }))
                }
              />
            ) : (
              <SummaryMetricLine
                label="Description"
                value={summary.descriptionLabel}
              />
            )}
            <SummaryMetricLine
              label="Measurements"
              value={summary.measurementsLabel}
            />
            <SummaryMetricLine label="Scope" value={summary.scopeLabel} />
            {waManualIncluded.length > 0 ? (
              <SummaryMetricLine
                label="Added by you"
                value={`${waManualIncluded.length} · ${SCOPE_DISCOVERY_UI_COPY.pricingRequired}`}
                attention
              />
            ) : null}
            <SummaryMetricLine
              label="Assumptions"
              value={summary.assumptionsLabel}
            />
            <SummaryMetricLine
              label="Conditions"
              value={summary.constraintsLabel}
            />
            <SummaryMetricLine
              label="Outstanding"
              value={summary.outstandingLabel}
              attention={summary.hasOutstanding}
            />
            <SummaryMetricLine
              label="Estimate readiness"
              value={summary.estimateReadinessLabel}
              attention={summary.hasOutstanding}
            />
          </div>

          <div className="mt-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground underline-offset-2 hover:underline"
              aria-expanded={expanded}
              onClick={() =>
                setDetailsOpen((prev) => ({
                  ...prev,
                  [workArea.workAreaId]: !expanded,
                }))
              }
            >
              {expanded ? "Hide details" : ASSISTANT_ACTION_LABELS.reviewDetails}
              <ChevronDown
                className={cn(
                  "size-3.5 transition-transform",
                  expanded && "rotate-180"
                )}
                aria-hidden
              />
            </button>
          </div>

          {expanded ? (
            <div className="mt-3 space-y-3 border-t border-border/50 pt-3">
          {workArea.missingItems.length > 0 ? (
            <div className="rounded-lg border border-amber-200/70 bg-amber-50/50 px-3 py-2.5">
              <h4 className="text-xs font-medium text-amber-900">
                Outstanding information
              </h4>
              <ul className="mt-1.5 space-y-1 text-sm text-amber-950">
                {workArea.missingItems.map((item) => (
                  <li key={item} className="leading-relaxed break-words">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {waManualIncluded.length > 0 ? (
            <div className="rounded-lg border border-border/60 px-3 py-2.5">
              <h4 className="text-xs font-medium text-muted-foreground">
                Scope added by you
              </h4>
              <ul className="mt-1.5 space-y-1.5 text-sm">
                {waManualIncluded.map((item) => (
                  <li key={item.id} className="leading-relaxed break-words">
                    <span className="font-medium">{item.title}</span>
                    <span className="ml-2 text-xs text-amber-900 dark:text-amber-200">
                      {SCOPE_DISCOVERY_UI_COPY.pricingRequired}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {editable ? null : workArea.quoteDescription ? (
            <CollapsedQuotePreview description={workArea.quoteDescription}>
              <p className="text-xs leading-relaxed text-muted-foreground break-words whitespace-pre-wrap">
                {workArea.quoteDescription}
              </p>
            </CollapsedQuotePreview>
          ) : null}

          {workArea.facts.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
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
              saveStatus={workAreaSaveStatus?.[workArea.workAreaId] ?? "idle"}
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
            </div>
          ) : null}

        </article>
        );
      })}

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
