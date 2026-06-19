export type ScopeQuestionInputType = "number" | "select" | "boolean" | "text";

export type ScopeQuestionCategory =
  | "measurement"
  | "scope"
  | "finish"
  | "allowance"
  | "risk";

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
