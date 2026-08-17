/**
 * REQ-4A — shadow reconciliation. Diagnostics only. Does not change money.
 */
import {
  getComponentCommercialAuthority,
  type ComponentCommercialAuthority,
  type RequirementParityClass,
} from "@/lib/estimate/component-authority";
import { findLegacyLinesForRequirement } from "@/lib/estimate/legacy-component-map";
import { round2 } from "@/lib/estimate/facts";
import type { EstimateRequirement } from "@/lib/estimate/requirements";
import type { EstimateLineItemInput } from "@/lib/estimate/types";

export const RECONCILIATION_STATUSES = [
  "PASS",
  "FAIL",
  "NOT_COMPARABLE",
  "MISSING_REQUIREMENT",
  "MISSING_LEGACY_COMPONENT",
  "UNPRICED_REQUIREMENT",
] as const;

export type ReconciliationStatus = (typeof RECONCILIATION_STATUSES)[number];

export type MoneyComparison = {
  status: ReconciliationStatus;
  requirementCost: number | null;
  legacyCost: number | null;
};

export type QuantityComparison = {
  status: ReconciliationStatus;
  requirementQuantity: number | null;
  requirementUnit: string | null;
  legacyQuantity: number | null;
  legacyUnit: string | null;
  reason?: string;
};

export type RequirementLegacyReconciliation = {
  workAreaId: string;
  workAreaType: string;
  componentKey: string;
  authority: ComponentCommercialAuthority;
  parityClass: RequirementParityClass | null;
  requirementId: string | null;
  legacyLineKeys: readonly string[];
  status: ReconciliationStatus;
  costComparison: MoneyComparison;
  quantityComparison: QuantityComparison;
  reasons: readonly string[];
};

function normalizeUnit(unit: string | null | undefined): string | null {
  if (!unit) return null;
  const trimmed = unit.trim().toLowerCase();
  if (trimmed === "m2" || trimmed === "m²") return "m2";
  return trimmed;
}

function costComparison(
  requirementCost: number | null,
  legacyCost: number | null
): MoneyComparison {
  if (requirementCost == null || legacyCost == null) {
    return {
      status: "NOT_COMPARABLE",
      requirementCost,
      legacyCost,
    };
  }
  return {
    status: requirementCost === legacyCost ? "PASS" : "FAIL",
    requirementCost,
    legacyCost,
  };
}

function materialQuantityComparison(
  requirement: Extract<EstimateRequirement, { kind: "material" }>,
  line: EstimateLineItemInput
): QuantityComparison {
  const requirementUnit = normalizeUnit(requirement.purchaseUnit);
  const legacyUnit = normalizeUnit(line.unit);
  if (
    requirementUnit == null ||
    legacyUnit == null ||
    line.quantity == null ||
    requirementUnit !== legacyUnit
  ) {
    return {
      status: "NOT_COMPARABLE",
      requirementQuantity: requirement.purchaseQuantity,
      requirementUnit: requirement.purchaseUnit,
      legacyQuantity: line.quantity ?? null,
      legacyUnit: line.unit ?? null,
      reason: "physical_quantity_units_not_comparable",
    };
  }
  const match = requirement.purchaseQuantity === line.quantity;
  return {
    status: match ? "PASS" : "FAIL",
    requirementQuantity: requirement.purchaseQuantity,
    requirementUnit: requirement.purchaseUnit,
    legacyQuantity: line.quantity ?? null,
    legacyUnit: line.unit ?? null,
  };
}

function labourQuantityComparison(
  requirement: Extract<EstimateRequirement, { kind: "labour" }>,
  line: EstimateLineItemInput
): QuantityComparison {
  if (line.labourHours == null) {
    return {
      status: "NOT_COMPARABLE",
      requirementQuantity: requirement.adjustedHours,
      requirementUnit: "h",
      legacyQuantity: null,
      legacyUnit: null,
      reason: "legacy_line_has_no_labour_hours",
    };
  }
  const match = requirement.adjustedHours === line.labourHours;
  return {
    status: match ? "PASS" : "FAIL",
    requirementQuantity: requirement.adjustedHours,
    requirementUnit: "h",
    legacyQuantity: line.labourHours,
    legacyUnit: "h",
  };
}

function rollupStatus(params: {
  cost: ReconciliationStatus;
  quantity: ReconciliationStatus;
  priced: boolean;
}): ReconciliationStatus {
  if (!params.priced) return "UNPRICED_REQUIREMENT";
  if (params.cost === "FAIL" || params.quantity === "FAIL") return "FAIL";
  if (params.cost === "PASS") return "PASS";
  if (params.cost === "NOT_COMPARABLE" && params.quantity === "NOT_COMPARABLE") {
    return "NOT_COMPARABLE";
  }
  return params.cost;
}

export function reconcileRequirementWithLegacyComponent(params: {
  requirement: EstimateRequirement | null;
  lineItems: readonly EstimateLineItemInput[];
  workAreaId: string;
  workAreaType: string;
  componentKey: string;
}): RequirementLegacyReconciliation {
  const authority = getComponentCommercialAuthority({
    workAreaType: params.workAreaType,
    componentKey: params.componentKey,
  });
  const reasons: string[] = [];

  if (!params.requirement) {
    reasons.push("missing_requirement");
    return {
      workAreaId: params.workAreaId,
      workAreaType: params.workAreaType,
      componentKey: params.componentKey,
      authority: authority.authority,
      parityClass: authority.parityClass,
      requirementId: null,
      legacyLineKeys: [],
      status: "MISSING_REQUIREMENT",
      costComparison: {
        status: "MISSING_REQUIREMENT",
        requirementCost: null,
        legacyCost: null,
      },
      quantityComparison: {
        status: "MISSING_REQUIREMENT",
        requirementQuantity: null,
        requirementUnit: null,
        legacyQuantity: null,
        legacyUnit: null,
      },
      reasons,
    };
  }

  const lines = findLegacyLinesForRequirement(params.lineItems, params.requirement);
  if (lines.length === 0) {
    reasons.push("missing_legacy_component");
    return {
      workAreaId: params.workAreaId,
      workAreaType: params.workAreaType,
      componentKey: params.componentKey,
      authority: authority.authority,
      parityClass: authority.parityClass,
      requirementId: params.requirement.requirementId,
      legacyLineKeys: [],
      status: "MISSING_LEGACY_COMPONENT",
      costComparison: {
        status: "MISSING_LEGACY_COMPONENT",
        requirementCost:
          params.requirement.kind === "material" || params.requirement.kind === "labour"
            ? params.requirement.totalCost
            : null,
        legacyCost: null,
      },
      quantityComparison: {
        status: "MISSING_LEGACY_COMPONENT",
        requirementQuantity: null,
        requirementUnit: null,
        legacyQuantity: null,
        legacyUnit: null,
      },
      reasons,
    };
  }

  if (lines.length > 1) {
    reasons.push("duplicate_legacy_component");
  }

  const line = lines[0]!;
  const legacyLineKeys = lines.map(
    (item) => item.itemKey ?? `${item.workAreaId}:${item.label}:${item.sortOrder}`
  );

  if (!params.requirement.priced) {
    reasons.push("unpriced_requirement");
    return {
      workAreaId: params.workAreaId,
      workAreaType: params.workAreaType,
      componentKey: params.componentKey,
      authority: authority.authority,
      parityClass: authority.parityClass,
      requirementId: params.requirement.requirementId,
      legacyLineKeys,
      status: "UNPRICED_REQUIREMENT",
      costComparison: {
        status: "UNPRICED_REQUIREMENT",
        requirementCost:
          params.requirement.kind === "material" || params.requirement.kind === "labour"
            ? params.requirement.totalCost
            : null,
        legacyCost: line.recommendedCost,
      },
      quantityComparison:
        params.requirement.kind === "material"
          ? materialQuantityComparison(params.requirement, line)
          : params.requirement.kind === "labour"
            ? labourQuantityComparison(params.requirement, line)
            : {
                status: "NOT_COMPARABLE",
                requirementQuantity: null,
                requirementUnit: null,
                legacyQuantity: line.quantity ?? null,
                legacyUnit: line.unit ?? null,
                reason: "kind_has_no_physical_quantity_contract",
              },
      reasons,
    };
  }

  const requirementCost =
    params.requirement.kind === "material" || params.requirement.kind === "labour"
      ? params.requirement.totalCost
      : null;
  const cost = costComparison(requirementCost, line.recommendedCost);
  if (cost.status === "FAIL") {
    reasons.push("cost_mismatch");
  }

  let quantity: QuantityComparison;
  if (params.requirement.kind === "material") {
    quantity = materialQuantityComparison(params.requirement, line);
  } else if (params.requirement.kind === "labour") {
    quantity = labourQuantityComparison(params.requirement, line);
  } else {
    quantity = {
      status: "NOT_COMPARABLE",
      requirementQuantity: null,
      requirementUnit: null,
      legacyQuantity: line.quantity ?? null,
      legacyUnit: line.unit ?? null,
      reason: "kind_has_no_physical_quantity_contract",
    };
  }
  if (quantity.status === "FAIL") reasons.push("quantity_mismatch");
  if (quantity.status === "NOT_COMPARABLE") {
    reasons.push(quantity.reason ?? "quantity_not_comparable");
  }

  const status = rollupStatus({
    cost: cost.status,
    quantity: quantity.status,
    priced: true,
  });

  return {
    workAreaId: params.workAreaId,
    workAreaType: params.workAreaType,
    componentKey: params.componentKey,
    authority: authority.authority,
    parityClass: authority.parityClass,
    requirementId: params.requirement.requirementId,
    legacyLineKeys,
    status,
    costComparison: cost,
    quantityComparison: quantity,
    reasons,
  };
}

export type PromotionEligibility = {
  eligible: boolean;
  promoted: boolean;
  reasons: readonly string[];
  reconciliation: RequirementLegacyReconciliation;
  snapshotPersisted: boolean;
};

export function evaluatePromotionEligibility(params: {
  reconciliation: RequirementLegacyReconciliation;
  snapshotPersisted: boolean;
  duplicateRequirement: boolean;
}): PromotionEligibility {
  const reasons: string[] = [...params.reconciliation.reasons];
  if (params.reconciliation.authority !== "SHADOW") {
    reasons.push("authority_not_shadow");
  }
  if (params.reconciliation.parityClass !== "SEMANTIC_REIMPLEMENTATION") {
    reasons.push("parity_class_not_semantic_reimplementation");
  }
  if (params.reconciliation.status !== "PASS") {
    reasons.push(`reconciliation_${params.reconciliation.status.toLowerCase()}`);
  }
  if (!params.snapshotPersisted) {
    reasons.push("missing_snapshot");
  }
  if (params.duplicateRequirement) {
    reasons.push("duplicate_requirement");
  }
  const eligible =
    params.reconciliation.authority === "SHADOW" &&
    params.reconciliation.parityClass === "SEMANTIC_REIMPLEMENTATION" &&
    params.reconciliation.status === "PASS" &&
    params.snapshotPersisted &&
    !params.duplicateRequirement;

  return {
    eligible,
    promoted: params.reconciliation.authority === "REQUIREMENT_AUTHORITATIVE",
    reasons: [...new Set(reasons)],
    reconciliation: params.reconciliation,
    snapshotPersisted: params.snapshotPersisted,
  };
}

export function roundMoney(value: number): number {
  return round2(value);
}
