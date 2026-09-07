/**
 * Small WasteRequirement constructor.
 * Bathroom V1 disposal uses an allowance quantity of 1 unless a physical qty exists.
 */
import { buildRequirementId } from "@/lib/estimate/requirement-id";
import { normalizeRequirement } from "@/lib/estimate/requirement-normalize";
import type {
  RequirementAssumption,
  RequirementConfidence,
  RequirementProvenance,
  WasteRequirement,
} from "@/lib/estimate/requirements";

export function buildWasteRequirement(params: {
  workAreaId: string;
  workAreaType: string;
  componentKey: string;
  variantKey?: string;
  description: string;
  confidence: RequirementConfidence;
  assumptions: readonly RequirementAssumption[];
  provenance: RequirementProvenance;
  priced: boolean;
  wasteKey?: string | null;
  quantity?: number | null;
  unit?: string;
  totalCost: number | null;
}): WasteRequirement {
  const requirementId = buildRequirementId({
    workAreaId: params.workAreaId,
    kind: "waste",
    componentKey: params.componentKey,
    variantKey: params.variantKey,
  });

  const requirement: WasteRequirement = {
    requirementId,
    kind: "waste",
    workAreaId: params.workAreaId,
    workAreaType: params.workAreaType,
    componentKey: params.componentKey,
    variantKey: params.variantKey,
    description: params.description,
    confidence: params.confidence,
    assumptions: params.assumptions,
    provenance: params.provenance,
    priced: params.priced,
    wasteKey: params.wasteKey,
    quantity: params.quantity,
    unit: params.unit,
    totalCost: params.totalCost,
  };
  return normalizeRequirement(requirement) as WasteRequirement;
}
