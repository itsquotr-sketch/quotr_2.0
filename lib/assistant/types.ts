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

import type { EstimateRequirement } from "@/lib/estimate/requirements";
import type { PricingSummary } from "@/lib/pricing/types";

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
  /** Immutable generation evidence for Builder Review takeoff (projection only). */
  requirementSnapshotRequirements: readonly EstimateRequirement[];
  scopeSummary: ScopeSummary;
  scopeReview: ScopeReview;
  panelScopeSummaries: PanelScopeSummary[];
  derivedFactDisplays: DerivedFactDisplay[];
  defaultMarginPercent: number;
  defaultGstRate: number;
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

/**
 * Canonical Generate/Update response. Projection of persisted estimate rows.
 * Client must not recalculate commercial money from this payload.
 */
export type EstimateGenerationResult = {
  projectId: string;
  estimateId: string;
  generationId: string;
  stage: AssistantStage;
  stale: boolean;
  estimate: Estimate;
  requirementSnapshotRequirements: readonly EstimateRequirement[];
  pricingSummary: PricingSummary | null;
};

/**
 * Canonical Clarify / Job Plan / fact-mutation response.
 * Projection of persisted Facts SoT + sibling Assistant state after the
 * existing mutation pipeline. Does not include Estimate line items / money.
 */
export type AssistantMutationResult = {
  projectId: string;
  stage: AssistantStage;
  workAreas: WorkArea[];
  interviewFacts: AssistantInterviewFact[];
  derivedFactDisplays: DerivedFactDisplay[];
  scopeReview: ScopeReview;
  panelScopeSummaries: PanelScopeSummary[];
  scopeSummary: ScopeSummary;
  questionBlock: QuestionBlockData | null;
  additionalQuestionBlocks: QuestionBlockData[];
  constraintQuestions: Question[];
  submittedConstraints: ConstraintRow[];
  estimateStale: boolean;
  hasEstimate: boolean;
};

export type AssistantActionState = {
  error?: string;
  reasonCode?: string;
  upgradeTarget?: "builder" | "business" | "builder_or_business" | null;
  success?: boolean;
  /** Present when addWorkAreaToProject succeeds — for optimistic Job Plan refresh. */
  workArea?: WorkArea;
  /** Present on successful updateEstimateMargin — server-authoritative. */
  marginTotals?: MarginUpdateTotals;
  /**
   * Present after successful Generate/Update persist. Projection of the
   * persisted estimate — not an unpersisted calculator DTO.
   */
  estimateGeneration?: EstimateGenerationResult;
  /**
   * Present after successful Clarify / Job Plan / fact / constraint mutation.
   * Projection of persisted Facts / questions / readiness / stale — not money.
   */
  assistantMutation?: AssistantMutationResult;
  /**
   * Persist succeeded (or equivalent) but canonical response could not be
   * built. Client may router.refresh() as recovery only.
   */
  recoveryRefresh?: boolean;
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
