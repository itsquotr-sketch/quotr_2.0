/**
 * Small MaterialRequirement constructor.
 *
 * Deterministic ID, canonical field mapping, then REQ-1 validation.
 * Not a generic factory for every future component.
 */
import { round2 } from "@/lib/estimate/facts";
import { buildRequirementId } from "@/lib/estimate/requirement-id";
import { normalizeRequirement } from "@/lib/estimate/requirement-normalize";
import type {
  MaterialRequirement,
  RequirementAssumption,
  RequirementConfidence,
  RequirementProvenance,
  RequirementRateSource,
} from "@/lib/estimate/requirements";
import type { MaterialRateSource } from "@/lib/estimate/resolve-material-rate";

export function mapMaterialRateSourceToRequirement(
  source: MaterialRateSource
): RequirementRateSource {
  switch (source) {
    case "company_specific":
    case "company_category":
    case "company_scope":
      return "company";
    case "benchmark_specific":
    case "benchmark_category":
      return "benchmark";
    case "missing":
      return "missing";
  }
}

export function materialRequirementTotalCost(
  purchaseQuantity: number,
  unitCost: number
): number {
  return round2(purchaseQuantity * unitCost);
}

export function buildMaterialRequirement(params: {
  workAreaId: string;
  workAreaType: string;
  componentKey: string;
  variantKey?: string;
  description: string;
  confidence: RequirementConfidence;
  assumptions: readonly RequirementAssumption[];
  provenance: RequirementProvenance;
  priced: boolean;
  materialKey: string | null;
  materialIdentity?: MaterialRequirement["materialIdentity"];
  category: string;
  specification?: string;
  baseQuantity: number;
  baseUnit: string;
  wasteFactor: number;
  purchaseQuantity: number;
  purchaseUnit: string;
  conversion?: MaterialRequirement["conversion"];
  rateSource: RequirementRateSource;
  unitCost: number | null;
  totalCost: number | null;
}): MaterialRequirement {
  const requirementId = buildRequirementId({
    workAreaId: params.workAreaId,
    kind: "material",
    componentKey: params.componentKey,
    variantKey: params.variantKey,
  });

  const requirement: MaterialRequirement = {
    requirementId,
    kind: "material",
    workAreaId: params.workAreaId,
    workAreaType: params.workAreaType,
    componentKey: params.componentKey,
    variantKey: params.variantKey,
    description: params.description,
    confidence: params.confidence,
    assumptions: params.assumptions,
    provenance: params.provenance,
    priced: params.priced,
    materialKey: params.materialKey,
    materialIdentity: params.materialIdentity,
    category: params.category,
    specification: params.specification,
    baseQuantity: params.baseQuantity,
    baseUnit: params.baseUnit,
    wasteFactor: params.wasteFactor,
    purchaseQuantity: params.purchaseQuantity,
    purchaseUnit: params.purchaseUnit,
    conversion: params.conversion,
    rateSource: params.rateSource,
    unitCost: params.unitCost,
    totalCost: params.totalCost,
  };

  return normalizeRequirement(requirement) as MaterialRequirement;
}
