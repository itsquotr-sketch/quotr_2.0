import type { QualityLevel } from "@/components/assistant/types";
import type { OrganisationRate, OrganisationSettings } from "@/components/setup/types";
import type { MaterialBuildUpEntry } from "@/lib/estimate/material-buildup-meta";
import type { MaterialRateResolution } from "@/lib/estimate/material-rate-pricing";
import type {
  PricingOwner,
  PricingSource,
} from "@/lib/estimate/pricing-ownership";
import type {
  AllowanceMinimumMeta,
  LabourMinimumMeta,
  QuantityBasis,
} from "@/lib/estimate/line-item-metadata";
import type { RateSourceType } from "@/lib/estimate/rate-source-labels";
import type { AssumptionMetadata } from "@/lib/estimate/assumption-metadata";
import type { MaterialWastageSettings } from "@/lib/settings/material-wastage";

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
  materialWastageSettings: MaterialWastageSettings | null;
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
  rateSourceType?: RateSourceType;
  itemKey?: string;
  costRate?: number;
  sellRate?: number;
  sellDerivedFromMargin?: boolean;
  notes?: string;
  materialBuildUp?: MaterialBuildUpEntry;
  materialBuildUps?: MaterialBuildUpEntry[];
  materialRateResolution?: MaterialRateResolution;
  sortOrder: number;
  pricingOwner?: PricingOwner;
  scopeKey?: string;
  overlapGroup?: string;
  includedInTotal?: boolean;
  clientVisible?: boolean;
  pricingSource?: PricingSource;
  quantityBasis?: QuantityBasis;
  labourMinimum?: LabourMinimumMeta;
  allowanceMinimum?: AllowanceMinimumMeta;
};

export type CalculatorResult = {
  lineItems: EstimateLineItemInput[];
  assumptions: string[];
  missingInfo: string[];
  exclusions: string[];
  confidence: number;
  assumptionMetadata?: AssumptionMetadata;
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
  assumptionMetadata?: AssumptionMetadata;
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
  sourceType: RateSourceType;
  itemKey: string;
  sellDerivedFromMargin: boolean;
};

export type ResolvedLabourRate = {
  costRate: number;
  sellRate: number;
  sourceLabel: string;
  sourceType: RateSourceType;
  itemKey?: string;
  sellDerivedFromMargin: boolean;
};

export type WorkAreaCalculator = (
  context: EstimateContext,
  workArea: EstimateWorkArea
) => CalculatorResult;
