"use client";

/**
 * Stage 3.2.2-R1 — Project Conditions (ASK + known review).
 * Canonical persistence remains the `constraints` table.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { QuestionField } from "@/components/assistant/QuestionBlock";
import { EditableConstraintRow } from "@/components/assistant/EditableConstraintRow";
import { SaveStatusIndicator } from "@/components/assistant/SaveStatusIndicator";
import type { InterviewCandidate } from "@/lib/builder-interview/types";
import type { InterviewReadiness } from "@/lib/builder-interview/types";
import {
  saveBuilderInterviewProjectAnswers,
  type BuilderInterviewAnswerItem,
  type BuilderInterviewItemResult,
} from "@/lib/assistant/builder-interview-actions";
import { startPreviewPerf } from "@/lib/assistant/preview-performance";
import type { ConstraintRow } from "@/lib/assistant/types";
import type { Question } from "@/components/assistant/types";

export type ProjectConditionsLocalAnswer = {
  kind: "answer" | "not_sure" | "assume" | "skip";
  value?: string | number | boolean;
};

type ConflictState = {
  questionKey: string;
  existingDisplayValue: string;
  proposedDisplayValue: string;
};

type ProjectConditionsBlockProps = {
  projectId: string;
  candidates: readonly InterviewCandidate[];
  remainingCount: number;
  complete: boolean;
  readiness: InterviewReadiness;
  /** Canonical known constraints (same records Site Constraints used). */
  knownConstraints?: readonly ConstraintRow[];
  onConstraintSave?: (input: {
    key: string;
    label: string;
    value: string | number | boolean;
    inputType?: "select" | "boolean";
  }) => Promise<void>;
  savingConstraintKey?: string | null;
  constraintError?: string | null;
  onSnapshotUpdate: (next: {
    candidates: InterviewCandidate[];
    remainingCount: number;
    complete: boolean;
    readiness: InterviewReadiness;
    constraints: ConstraintRow[];
  }) => void;
  focusQuestionKey?: string | null;
};

function isNotSureOption(value: string): boolean {
  const lower = value.trim().toLowerCase();
  return (
    lower === "not sure" ||
    lower === "unknown" ||
    lower === "unsure" ||
    lower === "n/a"
  );
}

function primaryOptions(
  options: readonly string[] | undefined
): string[] | undefined {
  if (!options) return undefined;
  const filtered = options.filter((o) => !isNotSureOption(o));
  return filtered.length > 0 ? filtered : undefined;
}

function candidateToQuestion(c: InterviewCandidate): Question {
  return {
    id: c.questionKey,
    key: c.targetKey,
    label: c.question,
    questionText: c.question,
    inputType: c.inputType === "multi_select" ? "text" : c.inputType,
    options: primaryOptions(c.options),
    required: c.priority === "P0" || c.priority === "P1",
  };
}

function formatKnownValue(value: string | number | boolean): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export function ProjectConditionsBlock({
  projectId,
  candidates,
  remainingCount,
  complete,
  readiness,
  knownConstraints = [],
  onConstraintSave,
  savingConstraintKey = null,
  constraintError = null,
  onSnapshotUpdate,
  focusQuestionKey,
}: ProjectConditionsBlockProps) {
  const [drafts, setDrafts] = useState<
    Record<string, ProjectConditionsLocalAnswer>
  >({});
  const [saving, setSaving] = useState(false);
  const [saveLabel, setSaveLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ConflictState[]>([]);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    if (!focusQuestionKey) return;
    const el = document.querySelector<HTMLElement>(
      `[data-project-condition-key="${focusQuestionKey}"]`
    );
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    const focusable = el?.querySelector<HTMLElement>(
      "input, select, textarea, button"
    );
    focusable?.focus({ preventScroll: true });
  }, [focusQuestionKey]);

  const knownRows = useMemo(() => {
    return knownConstraints.filter((r) => {
      if (r.value === null || r.value === undefined || r.value === "") {
        return false;
      }
      return !isNotSureOption(String(r.value));
    });
  }, [knownConstraints]);

  const setAnswer = useCallback(
    (questionKey: string, value: string | number | boolean | string[]) => {
      const scalar = Array.isArray(value) ? value.join(", ") : value;
      if (typeof scalar === "string" && isNotSureOption(scalar)) {
        setDrafts((prev) => ({
          ...prev,
          [questionKey]: { kind: "not_sure" },
        }));
      } else {
        setDrafts((prev) => ({
          ...prev,
          [questionKey]: { kind: "answer", value: scalar },
        }));
      }
      setConflicts((prev) => prev.filter((c) => c.questionKey !== questionKey));
      setError(null);
    },
    []
  );

  const setKind = useCallback(
    (questionKey: string, kind: "not_sure" | "assume" | "skip") => {
      setDrafts((prev) => ({
        ...prev,
        [questionKey]: { kind },
      }));
      setConflicts((prev) => prev.filter((c) => c.questionKey !== questionKey));
    },
    []
  );

  const handleSave = useCallback(
    async (opts?: { confirmKeys?: ReadonlySet<string> }) => {
      setSaving(true);
      setError(null);
      setSaveLabel(null);

      const answers: BuilderInterviewAnswerItem[] = candidates.map((c) => {
        const draft = drafts[c.questionKey];
        if (!draft) {
          return { questionKey: c.questionKey, kind: "skip" as const };
        }
        return {
          questionKey: c.questionKey,
          kind: draft.kind,
          value: draft.value,
          confirmReplace: opts?.confirmKeys?.has(c.questionKey) ?? false,
        };
      });

      const touched = answers.filter((a) => {
        const d = drafts[a.questionKey];
        return Boolean(d) || opts?.confirmKeys?.has(a.questionKey);
      });

      if (touched.length === 0) {
        setSaving(false);
        setError("Answer at least one question, or skip for now.");
        return;
      }

      try {
        const endAck = startPreviewPerf("builder_interview_batch_save_ack");
        const endComplete = startPreviewPerf(
          "builder_interview_batch_save_complete"
        );
        const result = await saveBuilderInterviewProjectAnswers({
          projectId,
          answers: touched,
        });
        endAck();
        endComplete();
        startPreviewPerf("builder_interview_recompute")();

        const conflictItems = result.items.filter(
          (i): i is Extract<BuilderInterviewItemResult, { status: "conflict" }> =>
            i.status === "conflict"
        );
        setConflicts(
          conflictItems.map((i) => ({
            questionKey: i.questionKey,
            existingDisplayValue: i.existingDisplayValue,
            proposedDisplayValue: i.proposedDisplayValue,
          }))
        );

        onSnapshotUpdate({
          candidates: result.candidates,
          remainingCount: result.remainingCount,
          complete: result.complete,
          readiness: result.readiness,
          constraints: result.constraints,
        });

        if (result.savedCount > 0) {
          setDrafts((prev) => {
            const next = { ...prev };
            for (const item of result.items) {
              if (item.status === "saved" || item.status === "unchanged") {
                delete next[item.questionKey];
              }
            }
            return next;
          });
        }

        if (result.conflictCount > 0) {
          setSaveLabel(
            `${result.savedCount} saved · ${result.conflictCount} need confirmation`
          );
        } else if (result.failedCount > 0) {
          setSaveLabel(
            `${result.savedCount} saved · ${result.failedCount} need retry`
          );
          setError(result.error ?? "Could not save answers");
        } else {
          setSaveLabel(
            result.remainingCount > 0
              ? `Saved · ${result.remainingCount} more available`
              : "Saved"
          );
        }
      } catch {
        setError("Could not save answers");
        setSaveLabel(null);
      } finally {
        setSaving(false);
      }
    },
    [candidates, drafts, onSnapshotUpdate, projectId]
  );

  const confirmConflict = useCallback(
    (questionKey: string, useProposed: boolean) => {
      if (!useProposed) {
        setDrafts((prev) => {
          const next = { ...prev };
          delete next[questionKey];
          return next;
        });
        setConflicts((prev) =>
          prev.filter((c) => c.questionKey !== questionKey)
        );
        return;
      }
      void handleSave({ confirmKeys: new Set([questionKey]) });
    },
    [handleSave]
  );

  const knownSection =
    knownRows.length > 0 ? (
      <div className="space-y-2" data-project-conditions-known="true">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Known from your project
        </p>
        <ul className="space-y-1.5">
          {knownRows.map((row) => (
            <li
              key={row.key}
              className="flex flex-wrap items-baseline justify-between gap-2 text-sm"
            >
              <span className="font-medium text-foreground">{row.label}</span>
              <span className="text-muted-foreground">
                {formatKnownValue(row.value)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  const editSection =
    knownRows.length > 0 && onConstraintSave ? (
      <div className="space-y-2 border-t border-border/40 pt-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 px-2 text-xs text-muted-foreground"
          onClick={() => setEditOpen((v) => !v)}
        >
          {editOpen ? "Hide edit" : "Edit conditions"}
        </Button>
        {editOpen ? (
          <div className="space-y-2" data-project-conditions-edit="true">
            {knownRows.map((row) => (
              <EditableConstraintRow
                key={row.key}
                question={{
                  id: row.key,
                  key: row.key,
                  label: row.label,
                  questionText: row.label,
                  inputType: "select",
                  required: false,
                  value: row.value,
                }}
                value={row.value}
                isSaving={savingConstraintKey === row.key}
                editable
                onSave={async (value) => {
                  await onConstraintSave({
                    key: row.key,
                    label: row.label,
                    value,
                    inputType: "select",
                  });
                }}
              />
            ))}
            {constraintError ? (
              <p className="text-sm text-destructive" role="alert">
                {constraintError}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    ) : null;

  if (complete && candidates.length === 0) {
    return (
      <div className="space-y-4" data-project-conditions-complete="true">
        {knownSection}
        <p className="text-sm text-muted-foreground">
          Project Conditions complete — no further project/site questions in the
          current set.
        </p>
        {editSection}
      </div>
    );
  }

  return (
    <div className="space-y-5" data-project-conditions-card="true">
      {knownSection}

      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          {remainingCount === 1
            ? "1 quick question remaining"
            : `${Math.min(remainingCount, candidates.length)} quick questions remaining`}
        </p>
        <p className="text-xs text-muted-foreground">
          Answer a few quick questions to improve this estimate.
        </p>
      </div>

      <ul className="space-y-5">
        {candidates.map((candidate) => {
          const q = candidateToQuestion(candidate);
          const draft = drafts[candidate.questionKey];
          const conflict = conflicts.find(
            (c) => c.questionKey === candidate.questionKey
          );
          const fieldValue =
            draft?.kind === "answer" && draft.value !== undefined
              ? draft.value
              : null;

          return (
            <li
              key={candidate.questionKey}
              className="space-y-3 rounded-lg border border-border/40 bg-muted/25 px-3 py-3 sm:px-3.5"
              data-project-condition-key={candidate.questionKey}
              data-question-key={candidate.targetKey}
            >
              <div className="space-y-1">
                <p className="text-sm font-semibold leading-snug text-foreground">
                  {candidate.question}
                </p>
                {candidate.reasonForAsking ? (
                  <p className="text-xs text-muted-foreground">
                    {candidate.reasonForAsking}
                  </p>
                ) : null}
              </div>

              <QuestionField
                question={q}
                value={fieldValue}
                onChange={(value) => setAnswer(candidate.questionKey, value)}
              />

              <div
                className="flex flex-wrap gap-2 pt-0.5"
                data-secondary-actions="true"
              >
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-10 min-h-10 border-border/70 bg-background px-3 text-xs font-normal text-muted-foreground shadow-none",
                    draft?.kind === "not_sure" &&
                      "border-foreground/30 font-medium text-foreground"
                  )}
                  onClick={() => setKind(candidate.questionKey, "not_sure")}
                  disabled={saving}
                >
                  Not sure
                </Button>
                {candidate.priority !== "P0" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-10 min-h-10 border-border/70 bg-background px-3 text-xs font-normal text-muted-foreground shadow-none",
                      draft?.kind === "assume" &&
                        "border-foreground/30 font-medium text-foreground"
                    )}
                    onClick={() => setKind(candidate.questionKey, "assume")}
                    disabled={saving}
                  >
                    Use reasonable assumption
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-10 min-h-10 border-border/70 bg-background px-3 text-xs font-normal text-muted-foreground shadow-none",
                    draft?.kind === "skip" &&
                      "border-foreground/30 font-medium text-foreground"
                  )}
                  onClick={() => setKind(candidate.questionKey, "skip")}
                  disabled={saving}
                >
                  Skip for now
                </Button>
              </div>

              {draft?.kind === "not_sure" ? (
                <p className="text-xs text-muted-foreground">
                  Marked as not sure. Quotr will flag this where it materially
                  affects the estimate.
                </p>
              ) : null}
              {draft?.kind === "assume" ? (
                <p className="text-xs text-muted-foreground">
                  Assumption noted for later — not saved as a confirmed
                  condition yet.
                </p>
              ) : null}
              {draft?.kind === "skip" ? (
                <p className="text-xs text-muted-foreground">
                  Skipped for now — you can return to this later.
                </p>
              ) : null}

              {conflict ? (
                <div className="space-y-2 rounded-lg border border-amber-200/80 bg-amber-50/50 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
                  <p className="text-sm text-foreground">
                    This project already has {conflict.existingDisplayValue}{" "}
                    recorded.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11"
                      onClick={() =>
                        confirmConflict(candidate.questionKey, false)
                      }
                      disabled={saving}
                    >
                      Keep {conflict.existingDisplayValue}
                    </Button>
                    <Button
                      type="button"
                      className="h-11"
                      onClick={() =>
                        confirmConflict(candidate.questionKey, true)
                      }
                      disabled={saving}
                    >
                      Use {conflict.proposedDisplayValue}
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          className="h-11 w-full sm:w-auto"
          onClick={() => void handleSave()}
          disabled={saving}
        >
          {saving ? "Saving answers…" : "Save answers"}
        </Button>
        <div className="min-h-5">
          {saving ? (
            <SaveStatusIndicator status="saving" isSaving />
          ) : error ? (
            <SaveStatusIndicator
              status="error"
              hasError
              errorMessage={error}
              onRetry={() => void handleSave()}
            />
          ) : saveLabel ? (
            <p className="text-sm text-muted-foreground">{saveLabel}</p>
          ) : null}
        </div>
      </div>

      {remainingCount > candidates.length ? (
        <p className="text-xs text-muted-foreground">
          {remainingCount - candidates.length} more questions available after
          save.
        </p>
      ) : null}

      {editSection}

      {readiness.state === "NEEDS_IMPORTANT_INFORMATION" &&
      readiness.openP0Keys.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {readiness.openP0Keys.length} important question
          {readiness.openP0Keys.length === 1 ? "" : "s"} still open for this
          estimate.
        </p>
      ) : null}
    </div>
  );
}
