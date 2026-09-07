/**
 * Small SubcontractRequirement constructor.
 * Quantity lives on the commercial line; the requirement carries trade + cost.
 */
import { buildRequirementId } from "@/lib/estimate/requirement-id";
import { normalizeRequirement } from "@/lib/estimate/requirement-normalize";
import type {
  RequirementAssumption,
  RequirementConfidence,
  RequirementProvenance,
  SubcontractRequirement,
} from "@/lib/estimate/requirements";

export function buildSubcontractRequirement(params: {
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
  allowanceCost?: number | null;
  quotedCost?: number | null;
  totalCost: number | null;
}): SubcontractRequirement {
  const requirementId = buildRequirementId({
    workAreaId: params.workAreaId,
    kind: "subcontract",
    componentKey: params.componentKey,
    variantKey: params.variantKey,
  });

  const requirement: SubcontractRequirement = {
    requirementId,
    kind: "subcontract",
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
    allowanceCost: params.allowanceCost,
    quotedCost: params.quotedCost,
    totalCost: params.totalCost,
  };

  return normalizeRequirement(requirement) as SubcontractRequirement;
}
