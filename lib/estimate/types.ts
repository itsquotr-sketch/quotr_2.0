import type { QualityLevel } from "@/components/assistant/types";
import type { OrganisationRate, OrganisationSettings } from "@/components/setup/types";

export type EstimateProject = {
  id: string;
  qualityLevel: QualityLevel | null;
};

export type EstimateWorkArea = {
  id: string;
  type: string;
  name: string;
  summary?: string | null;
  sort_order: number;
};

export type EstimateFact = {
  key: string;
  work_area_id: string | null;
  value: unknown;
  source?: string | null;
};

export type EstimateConstraint = {
  key: string;
  label: string;
  value: unknown;
};

export type EstimateContext = {
  project: EstimateProject;
  confirmedWorkAreas: EstimateWorkArea[];
  facts: EstimateFact[];
  constraints: EstimateConstraint[];
  organisationSettings: OrganisationSettings | null;
  rates: OrganisationRate[];
};

export type LineItemCategory =
  | "labour"
  | "materials"
  | "subcontractor"
  | "allowance"
  | "contingency";

export type EstimateLineItemInput = {
  workAreaId: string;
  workAreaName: string;
  label: string;
  category: LineItemCategory;
  costLow: number;
  costHigh: number;
  sellLow: number;
  sellHigh: number;
  recommendedCost: number;
  recommendedSell: number;
  grossProfit: number;
  marginPercent: number;
  markupPercent: number;
  quantity?: number;
  unit?: string;
  labourHours?: number;
  productivityRate?: number;
  productivityUnit?: string;
  rateSource: string;
  notes?: string;
  sortOrder: number;
};

export type CalculatorResult = {
  lineItems: EstimateLineItemInput[];
  assumptions: string[];
  missingInfo: string[];
  exclusions: string[];
  confidence: number;
};

export type EstimateResult = {
  costLow: number;
  costHigh: number;
  sellLow: number;
  sellHigh: number;
  recommendedCost: number;
  recommendedSell: number;
  grossProfit: number;
  marginPercent: number;
  markupPercent: number;
  confidence: number;
  rateSourceSummary: string;
  assumptions: string[];
  missingInfo: string[];
  exclusions: string[];
  lineItems: EstimateLineItemInput[];
};

export type ProductivityRate = {
  key: string;
  label: string;
  hoursPerUnit: number;
  unit: string;
  sourceLabel: string;
};

export type ResolvedRate = {
  costRate: number;
  sellRate: number;
  costRateLow: number;
  costRateHigh: number;
  sellRateLow: number;
  sellRateHigh: number;
  unit: string;
  sourceLabel: string;
};

export type ResolvedLabourRate = {
  costRate: number;
  sellRate: number;
  sourceLabel: string;
};

export type WorkAreaCalculator = (
  context: EstimateContext,
  workArea: EstimateWorkArea
) => CalculatorResult;
