/**
 * RECOVERY-5B — Builder Review projection types.
 * Presentation only. Does not mutate commercial money or authority.
 */

import type { EstimateLineItem } from "@/components/assistant/types";
import type { EstimateRequirement } from "@/lib/estimate/requirements";

export const BUILDER_REVIEW_CATEGORIES = [
  "MATERIALS",
  "LABOUR",
  "ALLOWANCES",
  "SUBCONTRACT",
  "PLANT",
  "WASTE",
  "OTHER_DIRECT_COSTS",
  "PRICING_REQUIRED",
] as const;

export type BuilderReviewCategoryId = (typeof BUILDER_REVIEW_CATEGORIES)[number];

export type BuilderReviewRateLabel =
  | "Company rate"
  | "Quotr benchmark"
  | "Preliminary fallback"
  | "Rate required"
  | "Default allowance"
  | "Work area rate"
  | string;

export type BuilderReviewPricedLine = {
  readonly id: string;
  readonly label: string;
  readonly category: BuilderReviewCategoryId;
  readonly recommendedCost: number;
  readonly recommendedSell: number;
  readonly quantity: number | null;
  readonly unit: string | null;
  readonly labourHours: number | null;
  readonly costRate: number | null;
  readonly rateLabel: BuilderReviewRateLabel;
  readonly itemKey: string | null;
  readonly componentKey: string | null;
  readonly isAllowance: boolean;
  readonly specification: string | null;
  readonly sourceLine: EstimateLineItem;
};

export type BuilderReviewTakeoffRow = {
  readonly requirementId: string;
  readonly componentKey: string;
  readonly label: string;
  readonly quantity: number;
  readonly unit: string;
  readonly specification: string | null;
  readonly detail: string | null;
  readonly confidenceLabel: "Preliminary quantity" | "Based on current layout assumptions" | null;
  readonly commercial: false;
  readonly parentAllowanceHint: string | null;
};

export type BuilderReviewCategoryGroup = {
  readonly id: BuilderReviewCategoryId;
  readonly label: string;
  readonly cost: number;
  readonly lines: readonly BuilderReviewPricedLine[];
  /** Non-commercial planning quantities attached under this category. */
  readonly takeoff: readonly BuilderReviewTakeoffRow[];
  readonly takeoffDisclaimer: string | null;
  readonly takeoffUnavailableHint: string | null;
};

export type BuilderReviewWorkAreaGroup = {
  readonly workAreaId: string | null;
  readonly workAreaName: string;
  readonly workAreaType: string | null;
  readonly cost: number;
  readonly sell: number;
  readonly categories: readonly BuilderReviewCategoryGroup[];
};

export type BuilderReviewIssue = {
  readonly id: string;
  readonly kind: "assumption" | "check" | "improve";
  readonly label: string;
  readonly detail: string | null;
  readonly editSection: "job_plan" | "project_conditions" | "details" | "advanced" | "refine";
};

export type BuilderReviewImprovement = {
  readonly id: string;
  readonly label: string;
  readonly reason: string | null;
  readonly editSection: BuilderReviewIssue["editSection"];
};

export type BuilderReviewCategorySummary = {
  readonly id: BuilderReviewCategoryId;
  readonly label: string;
  readonly cost: number;
};

export type BuilderReviewOverview = {
  readonly recommendedSell: number;
  readonly recommendedCost: number;
  readonly marginPercent: number;
  readonly confidenceBand: string | null;
  readonly confidenceExplanation: string | null;
  readonly workAreaCount: number;
  readonly workAreaNames: readonly string[];
  readonly categorySummary: readonly BuilderReviewCategorySummary[];
  readonly isStale: boolean;
};

export type BuilderReviewView = {
  readonly overview: BuilderReviewOverview;
  readonly workAreas: readonly BuilderReviewWorkAreaGroup[];
  readonly assumptions: readonly BuilderReviewIssue[];
  readonly checks: readonly BuilderReviewIssue[];
  readonly improvements: readonly BuilderReviewImprovement[];
  readonly costReconciles: boolean;
  readonly projectedCost: number;
  readonly estimateCost: number;
  /** Invariant proof: takeoff rows never contribute to projectedCost. */
  readonly takeoffAffectsMoney: false;
  readonly requirements: readonly EstimateRequirement[];
};

export type ComposeBuilderReviewInput = {
  readonly estimate: {
    readonly recommendedCost: number;
    readonly recommendedSell: number;
    readonly marginPercent: number;
    readonly confidence: number;
    readonly isStale?: boolean;
    readonly assumptions: readonly string[];
    readonly missingInfo: readonly string[];
    readonly lineItems: readonly EstimateLineItem[];
  };
  readonly workAreas: readonly {
    readonly id: string;
    readonly name: string;
    readonly type: string;
    readonly status: string;
  }[];
  readonly requirements?: readonly EstimateRequirement[];
  readonly attentionItems?: readonly {
    readonly id: string;
    readonly label: string;
    readonly productSeverity?: string | null;
    readonly attentionKind?: string | null;
    readonly reviewTarget?: string;
    readonly factKey?: string;
    readonly workAreaId?: string;
  }[];
  readonly confidenceBand?: string | null;
};
