/**
 * Shared unpriced planning-requirement constructors for Fence 1A.
 */

import { buildLabourRequirement } from "@/lib/estimate/labour-requirement";
import { buildMaterialRequirement } from "@/lib/estimate/material-requirement";
import type {
  LabourRequirement,
  MaterialRequirement,
} from "@/lib/estimate/requirements";
import type { MaterialIdentity } from "@/lib/materials/identity";

export function fencePlanningMaterial(params: {
  workAreaId: string;
  componentKey: string;
  variantKey?: string;
  description: string;
  materialKey: string | null;
  identity?: MaterialIdentity;
  category: string;
  specification: string;
  baseQuantity: number;
  baseUnit: string;
  wasteFactor: number;
  purchaseQuantity: number;
  purchaseUnit: string;
  factKeys: string[];
  source: string;
  confidence?: MaterialRequirement["confidence"];
}): MaterialRequirement {
  return buildMaterialRequirement({
    workAreaId: params.workAreaId,
    workAreaType: "fence",
    componentKey: params.componentKey,
    variantKey: params.variantKey,
    description: params.description,
    confidence: params.confidence ?? "medium",
    assumptions: [],
    provenance: {
      calculatorSource: params.source,
      factKeys: params.factKeys,
      constraintKeys: [],
    },
    priced: false,
    materialKey: params.materialKey,
    materialIdentity: params.identity,
    category: params.category,
    specification: params.specification,
    baseQuantity: params.baseQuantity,
    baseUnit: params.baseUnit,
    wasteFactor: params.wasteFactor,
    purchaseQuantity: params.purchaseQuantity,
    purchaseUnit: params.purchaseUnit,
    rateSource: "missing",
    unitCost: null,
    totalCost: null,
  });
}

export function fencePlanningLabour(params: {
  workAreaId: string;
  componentKey: string;
  description: string;
  trade: string;
  productivityKey: string;
  hoursPerUnit: number;
  unit: string;
  quantity: number;
  factKeys: string[];
  accessSensitive: boolean;
}): LabourRequirement {
  const baseHours = params.hoursPerUnit * params.quantity;
  return buildLabourRequirement({
    workAreaId: params.workAreaId,
    workAreaType: "fence",
    componentKey: params.componentKey,
    description: params.description,
    confidence: "low",
    assumptions: [
      {
        key: "productivity_starter",
        text: params.accessSensitive
          ? "LOW-CONFIDENCE productivity starter. Access/carry may adjust this activity. Not 1A package money."
          : "LOW-CONFIDENCE productivity starter. Not access-multiplied in Fence 1A. Not package money.",
        source: "calculator_default",
      },
    ],
    provenance: {
      calculatorSource: "fence.productivity",
      factKeys: params.factKeys,
      constraintKeys: params.accessSensitive
        ? ["site_access", "material_carry_distance"]
        : [],
    },
    priced: false,
    trade: params.trade,
    baseHours,
    productivityBasis: {
      key: params.productivityKey,
      hoursPerUnit: params.hoursPerUnit,
      unit: params.unit,
      quantity: params.quantity,
    },
    adjustmentRef: { factors: [] },
    adjustedHours: baseHours,
    rateKey: params.productivityKey,
    hourlyCost: null,
    totalCost: null,
    rateProvenance: "benchmark",
  });
}
