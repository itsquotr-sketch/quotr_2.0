/**
 * Question input-type contract (Stage 3.1B.7F-R6-R2).
 *
 * DB (`questions_input_type_check`, migration 002): number | select | boolean | text
 * App presentation may use multi_select; it persists as text + options and is
 * rehydrated via template identity (key → template.inputType), not by guessing
 * from "text + options" alone (which would mis-promote ordinary text questions).
 *
 * Do not add DB aliases (radio, dropdown, yes_no, etc.) without an approved migration.
 */

export const DB_QUESTION_INPUT_TYPES = [
  "number",
  "select",
  "boolean",
  "text",
] as const;

export type DbQuestionInputType = (typeof DB_QUESTION_INPUT_TYPES)[number];

/** Application / presentation types (templates + QuestionBlock). */
export const APP_QUESTION_INPUT_TYPES = [
  ...DB_QUESTION_INPUT_TYPES,
  "multi_select",
] as const;

export type AppQuestionInputType = (typeof APP_QUESTION_INPUT_TYPES)[number];

export const QUESTION_BLOCK_PREPARE_USER_ERROR =
  "We couldn't prepare the project questions. Please try again.";

export function isDbQuestionInputType(
  value: string
): value is DbQuestionInputType {
  return (DB_QUESTION_INPUT_TYPES as readonly string[]).includes(value);
}

export function isAppQuestionInputType(
  value: string
): value is AppQuestionInputType {
  return (APP_QUESTION_INPUT_TYPES as readonly string[]).includes(value);
}

/**
 * Templates and UI may use multi_select; DB stores text (with options retained).
 */
export function toPersistedQuestionInputType(
  inputType: AppQuestionInputType
): DbQuestionInputType {
  if (inputType === "multi_select") {
    return "text";
  }
  return inputType;
}

/**
 * Rehydrate UI type from a persisted questions row.
 *
 * `templateInputType` (from registry key/factKey lookup) is authoritative.
 * Without a template, trust the persisted DB type and never promote
 * text→multi_select from options alone.
 */
export function resolveUiQuestionInputType(params: {
  persistedInputType: string;
  options?: unknown;
  key?: string;
  templateInputType?: AppQuestionInputType;
}): AppQuestionInputType {
  if (params.templateInputType && isAppQuestionInputType(params.templateInputType)) {
    return params.templateInputType;
  }

  const persisted = params.persistedInputType;
  if (persisted === "multi_select") {
    return "multi_select";
  }
  if (isDbQuestionInputType(persisted)) {
    return persisted;
  }
  return "text";
}

export type QuestionInputTypeValidationFailure = {
  ok: false;
  key: string;
  inputType: string;
  message: string;
};

export type QuestionInputTypeValidationResult =
  | { ok: true }
  | QuestionInputTypeValidationFailure;

/** Reject unknown app aliases before any DB insert. */
export function validateQuestionInputType(
  inputType: string,
  questionKey = "unknown"
): QuestionInputTypeValidationResult {
  if (!isAppQuestionInputType(inputType)) {
    return {
      ok: false,
      key: questionKey,
      inputType,
      message: `Unsupported question input type "${inputType}" for key "${questionKey}".`,
    };
  }
  const persisted = toPersistedQuestionInputType(inputType);
  if (!isDbQuestionInputType(persisted)) {
    return {
      ok: false,
      key: questionKey,
      inputType,
      message: `Question input type "${inputType}" cannot be persisted for key "${questionKey}".`,
    };
  }
  return { ok: true };
}

export function validateQuestionInputTypes(
  questions: ReadonlyArray<{ key: string; inputType: string }>
): QuestionInputTypeValidationResult {
  for (const question of questions) {
    const result = validateQuestionInputType(
      question.inputType,
      question.key
    );
    if (!result.ok) {
      return result;
    }
  }
  return { ok: true };
}

/** Map internal/DB errors to a safe user-facing message when appropriate. */
export function toQuestionBlockUserError(internalMessage: string): string {
  if (
    /input_type|questions_input_type_check|check constraint|unsupported question input|cannot be persisted/i.test(
      internalMessage
    )
  ) {
    return QUESTION_BLOCK_PREPARE_USER_ERROR;
  }
  if (
    /violates check constraint|postgres|pgrst|supabase/i.test(internalMessage)
  ) {
    return QUESTION_BLOCK_PREPARE_USER_ERROR;
  }
  return internalMessage;
}

export function logQuestionInputTypeFailure(params: {
  category: string;
  questionKey?: string;
  inputType?: string;
  detail?: string;
}): void {
  console.error("[question-block]", {
    category: params.category,
    questionKey: params.questionKey ?? null,
    inputType: params.inputType ?? null,
    detail: params.detail ?? null,
  });
}
