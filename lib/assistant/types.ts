import type {
  AssistantStage,
  Estimate,
  QualityLevel,
  Question,
  QuestionBlockData,
  WorkArea,
} from "@/components/assistant/types";

export type {
  AssistantStage,
  Estimate,
  QualityLevel,
  Question,
  QuestionBlockData,
  WorkArea,
};

export type AssistantProject = {
  id: string;
  stage: AssistantStage;
  briefText: string | null;
  qualityLevel: QualityLevel | null;
};

export type ConstraintRow = {
  id: string;
  key: string;
  label: string;
  value: string | number | boolean;
};

export type ScopeSummary = {
  includedWorkAreas: WorkArea[];
  scopeAssumptions: string[];
  scopeExclusions: string[];
};

export type PanelScopeSummary = {
  workArea: string;
  summary: string;
};

export type AssistantState = {
  project: AssistantProject;
  workAreas: WorkArea[];
  questionBlock: QuestionBlockData | null;
  constraintQuestions: Question[];
  submittedConstraints: ConstraintRow[];
  estimate: Estimate | null;
  scopeSummary: ScopeSummary;
  panelScopeSummaries: PanelScopeSummary[];
};

export type AssistantActionState = {
  error?: string;
  success?: boolean;
};

export type WorkAreaSelection = {
  work_area_id: string;
  status: "confirmed" | "excluded";
};

export type QuestionAnswerInput = {
  question_id: string;
  value: string | number | boolean;
};

export type ConstraintInput = {
  key: string;
  label: string;
  value: string | number | boolean;
};
