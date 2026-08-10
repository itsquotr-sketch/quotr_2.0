"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { DerivedFactDisplay } from "@/lib/assistant/types";
import type { Question } from "@/components/assistant/types";
import { normalizeBooleanForUi } from "@/lib/scopes/fact-values";
import { formatSelectAnswerValue } from "@/lib/scopes/fact-labels";
import {
  defaultExpandedQuestionCategory,
  defaultExpandedQuestionCategories,
  groupQuestionsByPresentationCategory,
  provenanceLabelForQuestionSource,
  relatedScopeItemLabel,
  shouldShowWhyThisMatters,
  usedForLabelsForFactKey,
  whyThisMattersForKey,
  type QuestionPresentationCategory,
} from "@/lib/assistant/presentation";
import { AssistantEmptyState } from "@/components/assistant/AssistantEmptyState";
import { ASSISTANT_ACTION_LABELS } from "@/lib/assistant/presentation/action-labels";

export type QuestionAnswers = Record<string, string | number | boolean | string[] | null>;

type QuestionBlockProps = {
  questions: Question[];
  answers: QuestionAnswers;
  derivedFactDisplays?: DerivedFactDisplay[];
  submitted?: boolean;
  isSaving?: boolean;
  submitLabel?: string;
  /** When true, skip presentation categories (rare). */
  disableCategoryGrouping?: boolean;
  /** Hide the block submit control (parent owns save). */
  hideSubmit?: boolean;
  onAnswerChange?: (questionId: string, value: string | number | boolean | string[]) => void;
  onSubmit?: () => void;
};

type QuestionGroup = {
  workAreaId?: string;
  workAreaName: string;
  questions: Question[];
};

function groupQuestionsByWorkArea(questions: Question[]): QuestionGroup[] {
  const groups: QuestionGroup[] = [];
  const groupIndex = new Map<string, number>();

  for (const question of questions) {
    const name = question.workAreaName ?? "General";
    const existingIndex = groupIndex.get(name);

    if (existingIndex === undefined) {
      groupIndex.set(name, groups.length);
      groups.push({
        workAreaId: question.workAreaId,
        workAreaName: name,
        questions: [question],
      });
    } else {
      groups[existingIndex].questions.push(question);
    }
  }

  return groups;
}

function formatAnswer(
  question: Question,
  value: string | number | boolean | string[] | null | undefined
) {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    return value.map((item) => formatSelectAnswerValue(item)).join(", ");
  }
  if (question.inputType === "boolean") {
    return normalizeBooleanForUi(value) ?? String(value);
  }
  if (question.inputType === "select" || question.inputType === "multi_select") {
    return formatSelectAnswerValue(value);
  }
  if (question.unit && typeof value === "number") {
    return `${value} ${question.unit}`;
  }
  if (typeof value === "string") {
    return formatSelectAnswerValue(value);
  }
  return String(value);
}

function chipValueMatches(
  option: string,
  value: string | number | boolean | string[] | null | undefined
): boolean {
  if (Array.isArray(value)) {
    return value.includes(option);
  }
  if (value === option) return true;
  if (option === "Yes") return value === true || value === "true";
  if (option === "No") return value === false || value === "false";
  if (option === "Not sure") {
    return (
      value === "Not sure" ||
      value === "not sure" ||
      value === "not_sure"
    );
  }
  return false;
}

function BooleanChips({
  question,
  value,
  disabled,
  onChange,
}: {
  question: Question;
  value: string | number | boolean | string[] | null | undefined;
  disabled?: boolean;
  onChange: (val: string) => void;
}) {
  const options = question.options ?? ["Yes", "No", "Not sure"];

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option)}
          className={cn(
            "rounded-2xl border px-3 py-1.5 text-sm transition-colors",
            chipValueMatches(option, value)
              ? "border-primary/30 bg-primary/5 font-medium text-primary ring-1 ring-primary/20"
              : "border-border hover:bg-muted/50",
            disabled && "pointer-events-none opacity-70"
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function SelectChips({
  question,
  value,
  disabled,
  onChange,
}: {
  question: Question;
  value: string | number | boolean | string[] | null | undefined;
  disabled?: boolean;
  onChange: (val: string) => void;
}) {
  const options = question.options ?? [];

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option)}
          className={cn(
            "rounded-2xl border px-3 py-1.5 text-sm transition-colors",
            chipValueMatches(option, value)
              ? "border-primary/30 bg-primary/5 font-medium text-primary ring-1 ring-primary/20"
              : "border-border hover:bg-muted/50",
            disabled && "pointer-events-none opacity-70"
          )}
        >
          {formatSelectAnswerValue(option)}
        </button>
      ))}
    </div>
  );
}

export function QuestionField({
  question,
  value,
  disabled,
  onChange,
}: {
  question: Question;
  value: string | number | boolean | string[] | null | undefined;
  disabled?: boolean;
  onChange: (val: string | number | boolean | string[]) => void;
}) {
  switch (question.inputType) {
    case "number":
      return (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            step="any"
            value={value === null || value === undefined ? "" : String(value)}
            disabled={disabled}
            onChange={(e) =>
              onChange(e.target.value === "" ? "" : Number(e.target.value))
            }
            className="max-w-[140px]"
          />
          {question.unit ? (
            <span className="text-sm text-muted-foreground">{question.unit}</span>
          ) : null}
        </div>
      );
    case "select":
      return (
        <SelectChips
          question={question}
          value={value}
          disabled={disabled}
          onChange={onChange}
        />
      );
    case "multi_select": {
      const selected = Array.isArray(value)
        ? value
        : typeof value === "string" && value
          ? value.split(",").map((item) => item.trim())
          : [];
      const options = question.options ?? [];
      return (
        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const isSelected = selected.includes(option);
            return (
              <button
                key={option}
                type="button"
                disabled={disabled}
                onClick={() => {
                  const next = isSelected
                    ? selected.filter((item) => item !== option)
                    : [...selected, option];
                  onChange(next as unknown as string);
                }}
                className={cn(
                  "rounded-2xl border px-3 py-1.5 text-sm transition-colors",
                  isSelected
                    ? "border-primary/30 bg-primary/5 font-medium text-primary ring-1 ring-primary/20"
                    : "border-border hover:bg-muted/50",
                  disabled && "pointer-events-none opacity-70"
                )}
              >
                {formatSelectAnswerValue(option)}
              </button>
            );
          })}
        </div>
      );
    }
    case "boolean":
      return (
        <BooleanChips
          question={question}
          value={value}
          disabled={disabled}
          onChange={onChange}
        />
      );
    case "text":
    default:
      return (
        <Input
          value={value === null || value === undefined ? "" : String(value)}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

function QuestionContextMeta({
  question,
  value,
  sourceLabel,
}: {
  question: Question;
  value: string | number | boolean | string[] | null | undefined;
  sourceLabel: string | null;
}) {
  const [whyOpen, setWhyOpen] = useState(false);
  const why = whyThisMattersForKey(question.key);
  const usedFor = usedForLabelsForFactKey(question.key);
  const scopeItem = relatedScopeItemLabel(question.key);
  const hasValue =
    value !== null && value !== undefined && value !== "";
  const showSource = Boolean(sourceLabel && hasValue);

  if (!showSource && !scopeItem && usedFor.length === 0 && !why) {
    return null;
  }

  return (
    <div className="space-y-1.5 text-[11px] leading-relaxed text-muted-foreground">
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {question.workAreaName ? (
          <span>
            <span className="sr-only">Work area: </span>
            {question.workAreaName}
          </span>
        ) : null}
        {scopeItem ? (
          <span>
            Scope: {scopeItem}
          </span>
        ) : null}
        {showSource ? (
          <span aria-label={`Answer source: ${sourceLabel}`}>
            {sourceLabel}
          </span>
        ) : null}
      </div>
      {usedFor.length > 0 ? (
        <div>
          <p className="font-medium text-muted-foreground/90">Used for</p>
          <ul className="mt-0.5 list-inside list-disc">
            {usedFor.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {why && shouldShowWhyThisMatters(question.key) ? (
        <div>
          <button
            type="button"
            className="inline-flex items-center gap-1 font-medium text-foreground/80 underline-offset-2 hover:underline"
            aria-expanded={whyOpen}
            onClick={() => setWhyOpen((v) => !v)}
          >
            Why this matters
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform",
                whyOpen && "rotate-180"
              )}
              aria-hidden
            />
          </button>
          {whyOpen ? <p className="mt-1 max-w-prose">{why}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function CategorySection({
  label,
  category,
  expanded,
  hasUnresolvedRequired,
  remainingRequiredCount,
  completed,
  onToggle,
  children,
}: {
  label: string;
  category: QuestionPresentationCategory;
  expanded: boolean;
  hasUnresolvedRequired: boolean;
  remainingRequiredCount: number;
  completed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const headingId = `question-cat-${category}`;
  const remainingLabel =
    remainingRequiredCount === 1
      ? "1 question remaining"
      : `${remainingRequiredCount} questions remaining`;
  return (
    <section
      className={cn(
        "rounded-xl border",
        hasUnresolvedRequired
          ? "border-amber-300/80 bg-amber-50/40 dark:border-amber-800/50 dark:bg-amber-950/20"
          : "border-border/50 bg-background/60"
      )}
      aria-labelledby={headingId}
    >
      <h5 className="sr-only" id={headingId}>
        {label}
        {hasUnresolvedRequired ? ` — ${remainingLabel}` : ""}
      </h5>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
        aria-expanded={expanded}
        aria-controls={`question-cat-panel-${category}`}
        onClick={onToggle}
      >
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-foreground">{label}</span>
          {hasUnresolvedRequired ? (
            <span className="rounded-md border border-amber-300/80 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              {remainingLabel}
            </span>
          ) : completed ? (
            <span className="text-[10px] text-muted-foreground">✓ Complete</span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180"
          )}
          aria-hidden
        />
      </button>
      {expanded ? (
        <div
          id={`question-cat-panel-${category}`}
          className="space-y-4 border-t border-border/40 px-3 py-3"
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}

function WorkAreaSection({
  group,
  derivedLines,
  answers,
  submitted,
  disableCategoryGrouping,
  onAnswerChange,
}: {
  group: QuestionGroup;
  derivedLines: DerivedFactDisplay[];
  answers: QuestionAnswers;
  submitted?: boolean;
  disableCategoryGrouping?: boolean;
  onAnswerChange?: (questionId: string, value: string | number | boolean | string[]) => void;
}) {
  const categoryGroups = useMemo(
    () =>
      groupQuestionsByPresentationCategory({
        questions: group.questions,
        answers: Object.fromEntries(
          group.questions.map((q) => [q.id, answers[q.id]])
        ),
      }),
    [group.questions, answers]
  );

  const preferred = useMemo(
    () => defaultExpandedQuestionCategory(categoryGroups),
    [categoryGroups]
  );
  const preferredExpandedSet = useMemo(
    () => defaultExpandedQuestionCategories(categoryGroups),
    [categoryGroups]
  );

  const [manualExpanded, setManualExpanded] = useState<
    Partial<Record<QuestionPresentationCategory, boolean>>
  >({});

  const isCategoryExpanded = (category: QuestionPresentationCategory) => {
    if (category in manualExpanded) return manualExpanded[category]!;
    // 7F-R5: every group with unresolved required questions starts open.
    if (preferredExpandedSet.has(category)) return true;
    // When all required groups are complete, keep preferred (first) open.
    if (preferredExpandedSet.size === 0) return category === preferred;
    return false;
  };

  const renderQuestion = (question: Question) => {
    const value = answers[question.id];
    const derivedMatch = derivedLines.find((d) =>
      d.label.toLowerCase().includes(question.label.toLowerCase().slice(0, 12))
    );
    const sourceLabel = derivedMatch
      ? "Calculated"
      : provenanceLabelForQuestionSource(
          value === null || value === undefined || value === ""
            ? null
            : "user"
        );

    if (submitted) {
      return (
        <div
          key={question.id}
          className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]"
        >
          <dt className="text-sm text-muted-foreground">{question.label}</dt>
          <dd className="space-y-1.5">
            <p className="text-sm font-medium">
              {formatAnswer(question, value)}
            </p>
            <QuestionContextMeta
              question={question}
              value={value}
              sourceLabel={sourceLabel}
            />
          </dd>
        </div>
      );
    }

    return (
      <div key={question.id} className="space-y-2">
        <Label className="text-sm font-medium leading-snug">
          {question.questionText}
          {question.required ? (
            <span className="sr-only"> (required)</span>
          ) : null}
        </Label>
        <QuestionField
          question={question}
          value={value}
          onChange={(val) => onAnswerChange?.(question.id, val)}
        />
        <QuestionContextMeta
          question={question}
          value={value}
          sourceLabel={
            value === null || value === undefined || value === ""
              ? null
              : provenanceLabelForQuestionSource("user")
          }
        />
      </div>
    );
  };

  return (
    <section className="rounded-2xl border border-border/60 bg-muted/15 p-4 sm:p-5">
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-foreground">
          {group.workAreaName}
        </h4>
      </div>

      {derivedLines.length > 0 ? (
        <div className="mb-4 space-y-1.5">
          {derivedLines.map((line) => (
            <p
              key={`${line.workAreaId}-${line.label}`}
              className="text-sm text-muted-foreground"
            >
              <span className="font-medium text-foreground">{line.label}:</span>{" "}
              {line.text}
              <span className="ml-2 text-[11px]">Calculated</span>
            </p>
          ))}
        </div>
      ) : null}

      {disableCategoryGrouping ? (
        submitted ? (
          <dl className="space-y-3">{group.questions.map(renderQuestion)}</dl>
        ) : (
          <div className="space-y-5">{group.questions.map(renderQuestion)}</div>
        )
      ) : (
        <div className="space-y-3">
          {categoryGroups.map((cat) => {
            const remainingRequiredCount = cat.questions.filter((q) => {
              if (!q.required) return false;
              const v = answers[q.id];
              return v === null || v === undefined || v === "";
            }).length;
            const completed =
              remainingRequiredCount === 0 &&
              cat.questions.every((q) => {
                const v = answers[q.id];
                return v !== null && v !== undefined && v !== "";
              });
            const expanded = isCategoryExpanded(cat.category);
            return (
              <CategorySection
                key={cat.category}
                category={cat.category}
                label={cat.label}
                expanded={expanded}
                hasUnresolvedRequired={remainingRequiredCount > 0}
                remainingRequiredCount={remainingRequiredCount}
                completed={completed}
                onToggle={() =>
                  setManualExpanded((prev) => ({
                    ...prev,
                    [cat.category]: !isCategoryExpanded(cat.category),
                  }))
                }
              >
                {submitted ? (
                  <dl className="space-y-3">
                    {cat.questions.map(renderQuestion)}
                  </dl>
                ) : (
                  <div className="space-y-5">
                    {cat.questions.map(renderQuestion)}
                  </div>
                )}
              </CategorySection>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function QuestionBlock({
  questions,
  answers,
  derivedFactDisplays = [],
  submitted,
  isSaving,
  submitLabel = "Save",
  disableCategoryGrouping,
  hideSubmit,
  onAnswerChange,
  onSubmit,
}: QuestionBlockProps) {
  const [validationError, setValidationError] = useState<string | null>(null);
  const groups = useMemo(() => groupQuestionsByWorkArea(questions), [questions]);

  const derivedByWorkAreaId = useMemo(() => {
    const map = new Map<string, DerivedFactDisplay[]>();
    for (const display of derivedFactDisplays) {
      const existing = map.get(display.workAreaId) ?? [];
      existing.push(display);
      map.set(display.workAreaId, existing);
    }
    return map;
  }, [derivedFactDisplays]);

  const handleSubmit = () => {
    const missing = questions.filter(
      (q) =>
        q.required &&
        (answers[q.id] === null ||
          answers[q.id] === undefined ||
          answers[q.id] === "")
    );

    if (missing.length > 0) {
      setValidationError("Please answer all required questions before submitting.");
      return;
    }

    setValidationError(null);
    onSubmit?.();
  };

  if (questions.length === 0) {
    return (
      <div className="space-y-5">
        <AssistantEmptyState stage="scope_details" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <WorkAreaSection
          key={group.workAreaName}
          group={group}
          derivedLines={
            group.workAreaId
              ? (derivedByWorkAreaId.get(group.workAreaId) ?? [])
              : []
          }
          answers={answers}
          submitted={submitted}
          disableCategoryGrouping={disableCategoryGrouping}
          onAnswerChange={onAnswerChange}
        />
      ))}
      {validationError ? (
        <p className="text-sm text-destructive" role="alert">
          {validationError}
        </p>
      ) : null}
      {!submitted && !hideSubmit ? (
        <Button type="button" onClick={handleSubmit} disabled={isSaving}>
          {isSaving ? ASSISTANT_ACTION_LABELS.saving : submitLabel}
        </Button>
      ) : null}
    </div>
  );
}
