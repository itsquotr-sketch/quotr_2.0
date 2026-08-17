import type { AppQuestionInputType } from "@/lib/scopes/question-input-types";

/** App/presentation input types. DB persists a subset — see question-input-types. */
export type ScopeQuestionInputType = AppQuestionInputType;

export type ScopeQuestionCategory =
  | "measurement"
  | "scope"
  | "finish"
  | "allowance"
  | "risk"
  | "framing"
  | "supports"
  | "footings";

export type ScopeQuestionTemplate = {
  key: string;
  label: string;
  questionText: string;
  inputType: ScopeQuestionInputType;
  options?: string[];
  unit?: string;
  required: boolean;
  priority: number;
  factKey: string;
  workAreaType: string;
  category?: ScopeQuestionCategory;
};

export type ScopeDefinition = {
  type: string;
  label: string;
  questions: ScopeQuestionTemplate[];
};
