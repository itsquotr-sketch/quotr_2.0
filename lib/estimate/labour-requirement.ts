/**
 * Small LabourRequirement constructor.
 *
 * Deterministic ID, canonical field mapping, then REQ-1 validation.
 * Not a generic factory for every future task.
 */
import { requireEstimateLabourMoney } from "@/lib/estimate/estimate-commercial-engine-adapter";
import { buildRequirementId } from "@/lib/estimate/requirement-id";
import { normalizeRequirement } from "@/lib/estimate/requirement-normalize";
import type { RateSourceType } from "@/lib/estimate/rate-source-labels";
import type {
  LabourAdjustmentRef,
  LabourRequirement,
  RequirementAssumption,
  RequirementConfidence,
  RequirementProvenance,
  RequirementRateSource,
} from "@/lib/estimate/requirements";

export function mapLabourRateSourceToRequirement(
  sourceType: RateSourceType
): RequirementRateSource {
  switch (sourceType) {
    case "user_rate":
      return "company";
    case "work_area_rate":
      return "project_override";
    case "default":
    case "fallback":
    case "missing":
      // resolveLabourRate still returns the grandfathered 60/90 pair when no
      // company labour rate exists. sourceType "missing" is a label (CM-03);
      // the pricing truth is hardcoded legacy, not an unpriced component.
      return "hardcoded_legacy";
    case "benchmark":
    case "productivity":
      return "benchmark";
    case "calibrated_productivity":
    case "derived_from_margin":
      return "company";
  }
}

/** Same rounding path as the existing labour estimate line (cost only). */
export function labourRequirementTotalCost(params: {
  adjustedHours: number;
  hourlyCost: number;
  hourlySell: number;
}): number {
  return requireEstimateLabourMoney({
    labourHours: params.adjustedHours,
    labourCostRate: params.hourlyCost,
    labourSellRate: params.hourlySell,
  }).recommendedCost;
}

export function buildLabourRequirement(params: {
  workAreaId: string;
  workAreaType: string;
  componentKey: string;
  variantKey?: string;
  description: string;
  confidence: RequirementConfidence;
  assumptions: readonly RequirementAssumption[];
  provenance: RequirementProvenance;
  priced: boolean;
  trade: string;
  baseHours: number;
  productivityBasis: LabourRequirement["productivityBasis"];
  adjustmentRef: LabourAdjustmentRef;
  adjustedHours: number;
  rateKey: string;
  hourlyCost: number | null;
  totalCost: number | null;
  rateProvenance: RequirementRateSource;
}): LabourRequirement {
  const requirementId = buildRequirementId({
    workAreaId: params.workAreaId,
    kind: "labour",
    componentKey: params.componentKey,
    variantKey: params.variantKey,
  });

  const requirement: LabourRequirement = {
    requirementId,
    kind: "labour",
    workAreaId: params.workAreaId,
    workAreaType: params.workAreaType,
    componentKey: params.componentKey,
    variantKey: params.variantKey,
    description: params.description,
    confidence: params.confidence,
    assumptions: params.assumptions,
    provenance: params.provenance,
    priced: params.priced,
    trade: params.trade,
    baseHours: params.baseHours,
    productivityBasis: params.productivityBasis,
    adjustmentRef: params.adjustmentRef,
    adjustedHours: params.adjustedHours,
    rateKey: params.rateKey,
    hourlyCost: params.hourlyCost,
    totalCost: params.totalCost,
    rateProvenance: params.rateProvenance,
  };

  return normalizeRequirement(requirement) as LabourRequirement;
}
