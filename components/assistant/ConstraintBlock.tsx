"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  QuestionField,
  type QuestionAnswers,
} from "@/components/assistant/QuestionBlock";
import { EditableConstraintRow } from "@/components/assistant/EditableConstraintRow";
import type { Question } from "@/components/assistant/types";
import { ChevronDown } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  groupConstraintsByPresentationCategory,
  provenanceLabelForQuestionSource,
  ASSISTANT_EMPTY_STATES,
} from "@/lib/assistant/presentation";
import { ASSISTANT_ACTION_LABELS } from "@/lib/assistant/presentation/action-labels";
import {
  buildSiteConstraintFallbackQuestions,
  hasNoKnownConstraintValues,
  SITE_CONSTRAINT_FALLBACK_INTRO,
} from "@/lib/assistant/site-constraint-fallback";
import { AssistantEmptyState } from "@/components/assistant/AssistantEmptyState";

type ConstraintBlockProps = {
  questions: Question[];
  answers: QuestionAnswers;
  submitted?: boolean;
  editable?: boolean;
  isSaving?: boolean;
  savingConstraintKey?: string | null;
  constraintError?: string | null;
  /** Confirmed work-area types for context-aware fallback filtering. */
  workAreaTypes?: readonly string[];
  onAnswerChange?: (questionId: string, value: string | number | boolean | string[]) => void;
  onSubmit?: () => void;
  onConstraintSave?: (input: {
    key: string;
    label: string;
    value: string | number | boolean;
    inputType?: "select" | "boolean";
  }) => Promise<void>;
};

function ConstraintCategorySection({
  label,
  expanded,
  onToggle,
  children,
}: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border/50 bg-muted/10">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <h4 className="text-xs font-semibold text-foreground">{label}</h4>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180"
          )}
          aria-hidden
        />
      </button>
      {expanded ? (
        <div className="border-t border-border/40 px-3 py-3">{children}</div>
      ) : null}
    </section>
  );
}

export function ConstraintBlock({
  questions,
  answers,
  submitted,
  editable,
  isSaving,
  savingConstraintKey,
  constraintError,
  workAreaTypes,
  onAnswerChange,
  onSubmit,
  onConstraintSave,
}: ConstraintBlockProps) {
  const effectiveQuestions = useMemo(() => {
    if (questions.length > 0) return questions;
    // Zero detected — surface existing taxonomy confirmation questions.
    return buildSiteConstraintFallbackQuestions({ workAreaTypes });
  }, [questions, workAreaTypes]);

  const grouped = useMemo(
    () => groupConstraintsByPresentationCategory(effectiveQuestions),
    [effectiveQuestions]
  );

  const showFallbackIntro =
    !submitted &&
    hasNoKnownConstraintValues({
      questions: effectiveQuestions,
      answers,
    });

  const [expandedCategories, setExpandedCategories] = useState<
    Record<string, boolean>
  >({});

  const isExpanded = (category: string) =>
    expandedCategories[category] ?? true;

  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = () => {
    const missing = effectiveQuestions.filter(
      (q) =>
        q.required &&
        (answers[q.id] === null ||
          answers[q.id] === undefined ||
          answers[q.id] === "")
    );
    if (missing.length > 0) {
      setValidationError(
        "Please answer all required site constraints before submitting."
      );
      return;
    }
    setValidationError(null);
    onSubmit?.();
  };

  if (effectiveQuestions.length === 0) {
    return <AssistantEmptyState stage="site_constraints" />;
  }

  const intro = showFallbackIntro ? (
    <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2.5 text-sm text-muted-foreground">
      <p>{SITE_CONSTRAINT_FALLBACK_INTRO}</p>
      {ASSISTANT_EMPTY_STATES.site_constraints.nextAction ? (
        <p className="mt-1 text-xs">
          {ASSISTANT_EMPTY_STATES.site_constraints.nextAction}
        </p>
      ) : null}
    </div>
  ) : (
    <p className="text-[11px] text-muted-foreground">
      Project-wide site constraints apply across Work Areas unless noted.
    </p>
  );

  if (submitted && editable) {
    return (
      <div className="space-y-3">
        {intro}
        {grouped.map((group) => (
          <ConstraintCategorySection
            key={group.category}
            label={group.label}
            expanded={isExpanded(group.category)}
            onToggle={() =>
              setExpandedCategories((prev) => ({
                ...prev,
                [group.category]: !isExpanded(group.category),
              }))
            }
          >
            <dl className="space-y-3">
              {group.items.map((question) => (
                <div key={question.id} className="space-y-1">
                  <EditableConstraintRow
                    question={question}
                    value={
                      answers[question.id] as
                        | string
                        | number
                        | boolean
                        | null
                        | undefined
                    }
                    editable
                    isSaving={savingConstraintKey === question.key}
                    error={
                      savingConstraintKey === question.key
                        ? constraintError
                        : null
                    }
                    onSave={
                      onConstraintSave
                        ? async (value) =>
                            onConstraintSave({
                              key: question.key,
                              label: question.label,
                              value,
                              inputType: question.inputType as
                                | "select"
                                | "boolean",
                            })
                        : undefined
                    }
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Project-wide
                    {answers[question.id] != null && answers[question.id] !== ""
                      ? ` · ${provenanceLabelForQuestionSource("user")}`
                      : ""}
                  </p>
                </div>
              ))}
            </dl>
          </ConstraintCategorySection>
        ))}
      </div>
    );
  }

  if (!submitted) {
    return (
      <div className="space-y-4">
        {intro}
        {grouped.map((group) => (
          <ConstraintCategorySection
            key={group.category}
            label={group.label}
            expanded={isExpanded(group.category)}
            onToggle={() =>
              setExpandedCategories((prev) => ({
                ...prev,
                [group.category]: !isExpanded(group.category),
              }))
            }
          >
            <div className="space-y-4">
              {group.items.map((question) => (
                <div key={question.id} className="space-y-2">
                  <Label className="text-sm font-medium leading-snug">
                    {question.questionText}
                  </Label>
                  <QuestionField
                    question={question}
                    value={answers[question.id]}
                    onChange={(val) => onAnswerChange?.(question.id, val)}
                  />
                </div>
              ))}
            </div>
          </ConstraintCategorySection>
        ))}
        {validationError ? (
          <p className="text-sm text-destructive" role="alert">
            {validationError}
          </p>
        ) : null}
        <Button type="button" onClick={handleSubmit} disabled={isSaving}>
          {isSaving
            ? ASSISTANT_ACTION_LABELS.saving
            : ASSISTANT_ACTION_LABELS.save}
        </Button>
      </div>
    );
  }

  // submitted && !editable — read-only summary (same grouping; no QuestionBlock remount)
  return (
    <div className="space-y-3">
      {intro}
      {grouped.map((group) => (
        <ConstraintCategorySection
          key={group.category}
          label={group.label}
          expanded={isExpanded(group.category)}
          onToggle={() =>
            setExpandedCategories((prev) => ({
              ...prev,
              [group.category]: !isExpanded(group.category),
            }))
          }
        >
          <dl className="space-y-3">
            {group.items.map((question) => {
              const raw = answers[question.id];
              const display =
                raw === null || raw === undefined || raw === ""
                  ? "—"
                  : Array.isArray(raw)
                    ? raw.join(", ")
                    : String(raw);
              return (
                <div key={question.id} className="space-y-1">
                  <dt className="text-sm font-medium leading-snug">
                    {question.questionText}
                  </dt>
                  <dd className="text-sm text-muted-foreground">{display}</dd>
                </div>
              );
            })}
          </dl>
        </ConstraintCategorySection>
      ))}
    </div>
  );
}
