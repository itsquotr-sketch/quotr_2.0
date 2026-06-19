"use client";

import {
  QuestionBlock,
  type QuestionAnswers,
} from "@/components/assistant/QuestionBlock";
import { EditableConstraintRow } from "@/components/assistant/EditableConstraintRow";
import type { Question } from "@/components/assistant/types";

type ConstraintBlockProps = {
  questions: Question[];
  answers: QuestionAnswers;
  submitted?: boolean;
  editable?: boolean;
  isSaving?: boolean;
  savingConstraintKey?: string | null;
  constraintError?: string | null;
  onAnswerChange?: (questionId: string, value: string | number | boolean) => void;
  onSubmit?: () => void;
  onConstraintSave?: (input: {
    key: string;
    label: string;
    value: string | number | boolean;
    inputType?: "select" | "boolean";
  }) => Promise<void>;
};

export function ConstraintBlock({
  questions,
  answers,
  submitted,
  editable,
  isSaving,
  savingConstraintKey,
  constraintError,
  onAnswerChange,
  onSubmit,
  onConstraintSave,
}: ConstraintBlockProps) {
  if (submitted && editable) {
    return (
      <dl className="space-y-3">
        {questions.map((question) => (
          <EditableConstraintRow
            key={question.id}
            question={question}
            value={answers[question.id]}
            editable
            isSaving={savingConstraintKey === question.key}
            error={
              savingConstraintKey === question.key ? constraintError : null
            }
            onSave={
              onConstraintSave
                ? async (value) =>
                    onConstraintSave({
                      key: question.key,
                      label: question.label,
                      value,
                      inputType: question.inputType as "select" | "boolean",
                    })
                : undefined
            }
          />
        ))}
      </dl>
    );
  }

  return (
    <QuestionBlock
      questions={questions}
      answers={answers}
      submitted={submitted}
      isSaving={isSaving}
      submitLabel="Submit constraints"
      onAnswerChange={onAnswerChange}
      onSubmit={onSubmit}
    />
  );
}
