import type { MaterialBuildUpEntry } from "@/lib/estimate/material-buildup-meta";

export type AssistantStage =
  | "brief"
  | "confirm_work_areas"
  | "quality"
  | "work_area_questions"
  | "constraints"
  | "ready_to_estimate"
  | "estimate_ready";

export type WorkAreaStatus = "suggested" | "confirmed" | "excluded";

export type ScopeItemStatus = "included" | "excluded" | "assumption" | "missing";

export type ScopeItemSource = "user" | "detected" | "assumed" | "benchmark";

export type ScopeItem = {
  id: string;
  label: string;
  description?: string;
  status: ScopeItemStatus;
  source: ScopeItemSource;
};

export type WorkArea = {
  id: string;
  type: string;
  name: string;
  aiConfidence: number;
  status: WorkAreaStatus;
  summary?: string;
  quoteDescription?: string | null;
  includedScopeItems?: ScopeItem[];
  excludedScopeItems?: ScopeItem[];
  assumptions?: string[];
  missingInfo?: string[];
};

export type QuestionInputType =
  | "number"
  | "select"
  | "boolean"
  | "text"
  | "multi_select";

export type Question = {
  id: string;
  workAreaId?: string;
  workAreaName?: string;
  key: string;
  label: string;
  questionText: string;
  inputType: QuestionInputType;
  options?: string[];
  required: boolean;
  unit?: string;
  value?: string | number | boolean | string[] | null;
};

export type WorkAreaActiveQuestion = Question & {
  questionBlockId: string;
  missingItemLabel: string;
};

export type QuestionBlockData = {
  id: string;
  title: string;
  description?: string;
  stage: AssistantStage;
  questions: Question[];
  status: "active" | "submitted";
};

export type EstimateLineItemCategory =
  | "labour"
  | "materials"
  | "subcontractor"
  | "allowance"
  | "contingency";

export type EstimateLineItem = {
  id: string;
  workAreaName: string;
  label: string;
  category: EstimateLineItemCategory;
  costLow: number;
  costHigh: number;
  sellLow: number;
  sellHigh: number;
  recommendedCost: number;
  recommendedSell: number;
  grossProfit: number;
  marginPercent: number;
  markupPercent?: number;
  rateSource: string;
  quantity?: number;
  unit?: string;
  labourHours?: number;
  productivityRate?: number;
  productivityUnit?: string;
  costRate?: number;
  sellRate?: number;
  itemKey?: string;
  sellDerivedFromMargin?: boolean;
  notes?: string;
  materialBuildUps?: MaterialBuildUpEntry[];
};

export type Estimate = {
  costLow: number;
  costHigh: number;
  sellLow: number;
  sellHigh: number;
  recommendedCost: number;
  recommendedSell: number;
  grossProfit: number;
  marginPercent: number;
  markupPercent?: number;
  isStale?: boolean;
  calibrationVersion?: string | null;
  targetMarginPercent?: number | null;
  confidence: number;
  rateSourceSummary: string;
  contingencyAmount?: number;
  assumptions: string[];
  missingInfo: string[];
  includedWorkAreas: WorkArea[];
  excludedWorkAreas: WorkArea[];
  scopeAssumptions: string[];
  scopeExclusions: string[];
  missingInfoByWorkArea?: Record<string, string[]>;
  lineItems: EstimateLineItem[];
};

export type QualityLevel = "budget" | "standard" | "premium" | "unknown";

export type BlockStatus = "active" | "submitted" | "system";
