"use client";

/**
 * Stage 3.2.2 — Project Conditions card (Builder Interview ASK layer).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { QuestionField } from "@/components/assistant/QuestionBlock";
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
  onSnapshotUpdate: (next: {
    candidates: InterviewCandidate[];
    remainingCount: number;
    complete: boolean;
    readiness: InterviewReadiness;
    constraints: ConstraintRow[];
  }) => void;
  focusQuestionKey?: string | null;
};

function candidateToQuestion(c: InterviewCandidate) {
  return {
    id: c.questionKey,
    key: c.targetKey,
    label: c.question,
    questionText: c.question,
    inputType: c.inputType === "multi_select" ? ("text" as const) : c.inputType,
    options: c.options ? [...c.options] : undefined,
    required: c.priority === "P0" || c.priority === "P1",
  };
}

export function ProjectConditionsBlock({
  projectId,
  candidates,
  remainingCount,
  complete,
  readiness,
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

  const intro =
    remainingCount === 0
      ? "No important project conditions remaining."
      : remainingCount === 1
        ? "1 quick question will improve this estimate."
        : `${Math.min(remainingCount, candidates.length)} quick questions will improve this estimate.`;

  const setAnswer = useCallback(
    (questionKey: string, value: string | number | boolean | string[]) => {
      const scalar = Array.isArray(value) ? value.join(", ") : value;
      setDrafts((prev) => ({
        ...prev,
        [questionKey]: { kind: "answer", value: scalar },
      }));
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
      const t0 =
        typeof performance !== "undefined" ? performance.now() : Date.now();

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

      // Only send items the user touched (or conflicts being confirmed)
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

        if (typeof console !== "undefined" && process.env.NODE_ENV !== "production") {
          const elapsed =
            (typeof performance !== "undefined" ? performance.now() : Date.now()) -
            t0;
          console.info(
            `[quotr-preview-perf] builder_interview_batch_save_complete=${Math.round(elapsed)}ms candidates=${result.remainingCount} saved=${result.savedCount}`
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
        setConflicts((prev) => prev.filter((c) => c.questionKey !== questionKey));
        return;
      }
      void handleSave({ confirmKeys: new Set([questionKey]) });
    },
    [handleSave]
  );

  const readinessHint = useMemo(() => {
    if (readiness.state === "NEEDS_IMPORTANT_INFORMATION") {
      return `${readiness.openP0Keys.length} important question${readiness.openP0Keys.length === 1 ? "" : "s"} remaining`;
    }
    if (readiness.state === "READY_WITH_ASSUMPTIONS") {
      return "Ready with assumptions";
    }
    return "Ready";
  }, [readiness]);

  if (complete && candidates.length === 0) {
    return (
      <div className="space-y-3" data-project-conditions-complete="true">
        <p className="text-sm text-muted-foreground">
          Project Conditions complete — no currently applicable project/site
          questions remain.
        </p>
        <p className="text-xs text-muted-foreground">{readinessHint}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-project-conditions-card="true">
      <div className="space-y-1">
        <p className="text-sm text-foreground">{intro}</p>
        <p className="text-xs text-muted-foreground">
          Answer a few quick questions to improve this estimate.
        </p>
      </div>

      <ul className="space-y-4">
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
              className="space-y-2 rounded-xl border border-border/50 bg-muted/10 p-3"
              data-project-condition-key={candidate.questionKey}
              data-question-key={candidate.targetKey}
            >
              <QuestionField
                question={q}
                value={fieldValue}
                onChange={(value) => setAnswer(candidate.questionKey, value)}
              />
              {candidate.reasonForAsking ? (
                <p className="text-xs text-muted-foreground">
                  {candidate.reasonForAsking}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-11 min-w-[5.5rem]"
                  onClick={() => setKind(candidate.questionKey, "not_sure")}
                  disabled={saving}
                >
                  Not sure
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-11 min-w-[5.5rem]"
                  onClick={() => setKind(candidate.questionKey, "skip")}
                  disabled={saving}
                >
                  Skip for now
                </Button>
                {candidate.askPolicy === "ASK" &&
                candidate.priority !== "P0" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-11 text-muted-foreground"
                    onClick={() => setKind(candidate.questionKey, "assume")}
                    disabled={saving}
                    title="Assumption recording comes in a later update"
                  >
                    Use reasonable assumption
                  </Button>
                ) : null}
              </div>

              {draft?.kind === "not_sure" ? (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Marked not sure — Quotr will not invent a value.
                </p>
              ) : null}
              {draft?.kind === "assume" ? (
                <p className="text-xs text-muted-foreground">
                  Assumption noted for later — not saved as a confirmed condition
                  yet.
                </p>
              ) : null}
              {draft?.kind === "skip" ? (
                <p className="text-xs text-muted-foreground">Skipped for now.</p>
              ) : null}

              {conflict ? (
                <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
                  <p className="text-sm font-medium text-foreground">
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

      <p className="text-xs text-muted-foreground sr-only">
        Readiness: {readiness.state}. {readinessHint}
      </p>
      <Label className="sr-only">Project conditions answers</Label>
      <div
        className={cn(
          "text-xs text-muted-foreground",
          readiness.state === "NEEDS_IMPORTANT_INFORMATION" && "text-amber-700"
        )}
      >
        Project information · {readinessHint}
      </div>
    </div>
  );
}
