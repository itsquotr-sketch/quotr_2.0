/**
 * Shared unpriced planning-requirement constructors for Retaining Wall 1A.
 */

import { buildLabourRequirement } from "@/lib/estimate/labour-requirement";
import { buildMaterialRequirement } from "@/lib/estimate/material-requirement";
import type {
  LabourRequirement,
  MaterialRequirement,
} from "@/lib/estimate/requirements";
import type { MaterialIdentity } from "@/lib/materials/identity";

export function planningMaterial(params: {
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
    workAreaType: "retaining_wall",
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

export function planningLabourSlot(params: {
  workAreaId: string;
  componentKey: string;
  description: string;
  trade: string;
  productivityKey: string;
  unit: string;
  quantity: number;
  factKeys: string[];
}): LabourRequirement {
  return buildLabourRequirement({
    workAreaId: params.workAreaId,
    workAreaType: "retaining_wall",
    componentKey: params.componentKey,
    description: params.description,
    confidence: "low",
    assumptions: [
      {
        key: "productivity_slot",
        text: "Productivity slot only — no invented hours and no labour money in 1A.",
        source: "calculator_default",
      },
    ],
    provenance: {
      calculatorSource: "retaining_wall.productivity_slot",
      factKeys: params.factKeys,
      constraintKeys: [],
    },
    priced: false,
    trade: params.trade,
    baseHours: 0,
    productivityBasis: {
      key: params.productivityKey,
      hoursPerUnit: 0,
      unit: params.unit,
      quantity: params.quantity,
    },
    adjustmentRef: { factors: [] },
    adjustedHours: 0,
    rateKey: params.productivityKey,
    hourlyCost: null,
    totalCost: null,
    rateProvenance: "missing",
  });
}
