import type {
  AssistantStage,
  Estimate,
  QualityLevel,
  Question,
  QuestionBlockData,
  WorkArea,
  WorkAreaActiveQuestion,
} from "@/components/assistant/types";

export type {
  AssistantStage,
  Estimate,
  QualityLevel,
  Question,
  QuestionBlockData,
  WorkArea,
  WorkAreaActiveQuestion,
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
  /** Present when loaded from constraints.source (3.2.2). */
  source?: string | null;
};

/** Narrow fact rows for Builder Interview live input (3.2.2). */
export type AssistantInterviewFact = {
  key: string;
  workAreaId: string | null;
  value: unknown;
  source?: string | null;
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

export type DerivedFactDisplay = {
  workAreaId: string;
  label: string;
  text: string;
};

export type ScopeReviewSourceLabel =
  | "brief"
  | "answered"
  | "calculated"
  | "assumed"
  | "default"
  | "system"
  | "project spec";

export type ScopeReviewFact = {
  key: string;
  label: string;
  value: string;
  rawValue?: unknown;
  unit?: string;
  sourceLabel: ScopeReviewSourceLabel;
  sourcePriority: number;
  readOnly?: boolean;
  derivedNote?: string;
  conflictWarning?: string;
  inputType?: "number" | "select" | "boolean" | "text" | "multi_select";
  options?: string[];
};

export type ScopeReviewWorkArea = {
  workAreaId: string;
  workAreaType: string;
  workAreaName: string;
  summary?: string;
  quoteDescription?: string | null;
  facts: ScopeReviewFact[];
  missingItems: string[];
  activeQuestions: WorkAreaActiveQuestion[];
  assumptions: string[];
};

export type ScopeReview = {
  workAreas: ScopeReviewWorkArea[];
  excludedWorkAreas: { workAreaId: string; workAreaName: string }[];
  generalAssumptions: string[];
  generalExclusions: string[];
};

export type AssistantState = {
  project: AssistantProject;
  workAreas: WorkArea[];
  questionBlock: QuestionBlockData | null;
  additionalQuestionBlocks: QuestionBlockData[];
  constraintQuestions: Question[];
  submittedConstraints: ConstraintRow[];
  /** Narrow facts for Builder Interview candidate engine (3.2.2). */
  interviewFacts: AssistantInterviewFact[];
  estimate: Estimate | null;
  scopeSummary: ScopeSummary;
  scopeReview: ScopeReview;
  panelScopeSummaries: PanelScopeSummary[];
  derivedFactDisplays: DerivedFactDisplay[];
  defaultMarginPercent: number;
};

/** Authoritative margin totals returned after persist (3.2.2-R2). */
export type MarginUpdateTotals = {
  recommendedSell: number;
  sellLow: number;
  sellHigh: number;
  grossProfit: number;
  marginPercent: number;
  targetMarginPercent: number | null;
};

export type AssistantActionState = {
  error?: string;
  success?: boolean;
  /** Present on successful updateEstimateMargin — server-authoritative. */
  marginTotals?: MarginUpdateTotals;
};

export type WorkAreaSelection = {
  work_area_id: string;
  status: "confirmed" | "excluded";
};

export type QuestionAnswerInput = {
  question_id: string;
  value: string | number | boolean | string[];
};

export type ConstraintInput = {
  key: string;
  label: string;
  value: string | number | boolean;
};
