"use client";

import {
  QuestionBlock,
  type QuestionAnswers,
} from "@/components/assistant/QuestionBlock";
import type { Question } from "@/components/assistant/types";

type ConstraintBlockProps = {
  questions: Question[];
  answers: QuestionAnswers;
  submitted?: boolean;
  isSaving?: boolean;
  onAnswerChange?: (questionId: string, value: string | number | boolean) => void;
  onSubmit?: () => void;
};

export function ConstraintBlock({
  questions,
  answers,
  submitted,
  isSaving,
  onAnswerChange,
  onSubmit,
}: ConstraintBlockProps) {
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
