/**
 * REQ-3.1 — Deck labour LabourRequirement (shadow).
 *
 * Reuses the existing Deck labour hours result and resolveLabourRate object.
 * Does not recalculate hours, Project Conditions, or call a second rate resolver.
 *
 * Scope: the lumped "Deck labour" line only.
 * Does not emit demolition, fascia/face labour, stairs, or balustrade.
 */
import {
  buildLabourRequirement,
  labourRequirementTotalCost,
  mapLabourRateSourceToRequirement,
} from "@/lib/estimate/labour-requirement";
import type { LabourHoursResult } from "@/lib/estimate/labour-hours";
import { PROJECT_LABOUR_PRODUCTIVITY_FACTOR_KEY } from "@/lib/estimate/requirements";
import type {
  LabourRequirement,
  RequirementAssumption,
} from "@/lib/estimate/requirements";
import type { EstimateWorkArea, ResolvedLabourRate } from "@/lib/estimate/types";

export const DECK_LABOUR_COMPONENT_KEY = "deck.labour";
export const DECK_LABOUR_TRADE = "carpenter";
export const DECK_LABOUR_RATE_KEY = "labour.carpenter.hour";
export const DECK_LABOUR_PRODUCTIVITY_KEY = "deck.base_labour_hours_per_m2";

const LABOUR_CONSTRAINT_KEYS = [
  "site_access",
  "material_carry_distance",
  "occupied_site",
  "working_hours",
  "site_slope",
] as const;

export function labourConstraintKeysFrom(
  constraints: readonly { key: string; value: unknown }[]
): string[] {
  return LABOUR_CONSTRAINT_KEYS.filter((key) =>
    constraints.some((constraint) => {
      if (constraint.key !== key) return false;
      if (constraint.value == null) return false;
      return String(constraint.value).trim().length > 0;
    })
  );
}

export function buildDeckLabourRequirement(params: {
  workArea: EstimateWorkArea;
  hours: LabourHoursResult;
  labourRate: ResolvedLabourRate;
  elevated: boolean;
  assumedArea: boolean;
  factKeys: readonly string[];
  constraintKeys: readonly string[];
}): LabourRequirement {
  const rateProvenance = mapLabourRateSourceToRequirement(
    params.labourRate.sourceType
  );
  const hourlyCost = params.labourRate.costRate;
  const priced = Number.isFinite(hourlyCost) && rateProvenance !== "missing";
  const totalCost =
    priced && hourlyCost != null
      ? labourRequirementTotalCost({
          adjustedHours: params.hours.adjustedHours,
          hourlyCost,
          hourlySell: params.labourRate.sellRate,
        })
      : null;

  const assumptions: RequirementAssumption[] = [];
  if (params.assumedArea) {
    assumptions.push({
      key: "deck.labour.assumed_area",
      text: "Using assumed deck area of 20 m² for rough estimate.",
      source: "assumed_default",
    });
  }
  if (params.elevated) {
    assumptions.push({
      key: "deck.labour.elevated_productivity",
      text: "Elevated deck adds extra labour productivity allowance.",
      source: "calculator_default",
    });
  }

  const factors =
    params.hours.adjustmentFactor === 1
      ? []
      : [
          {
            key: PROJECT_LABOUR_PRODUCTIVITY_FACTOR_KEY,
            value: params.hours.adjustmentFactor,
          },
        ];

  return buildLabourRequirement({
    workAreaId: params.workArea.id,
    workAreaType: params.workArea.type,
    componentKey: DECK_LABOUR_COMPONENT_KEY,
    description: "Deck labour",
    confidence: "medium",
    assumptions,
    provenance: {
      calculatorSource: "deck.labour",
      factKeys: [...params.factKeys],
      constraintKeys: [...params.constraintKeys],
    },
    priced,
    trade: DECK_LABOUR_TRADE,
    baseHours: params.hours.baseHours,
    productivityBasis: {
      key: DECK_LABOUR_PRODUCTIVITY_KEY,
      hoursPerUnit: params.hours.productivityHoursPerUnit,
      unit: "m²",
      quantity: params.hours.quantity,
    },
    adjustmentRef: { factors },
    adjustedHours: params.hours.adjustedHours,
    rateKey: params.labourRate.itemKey ?? DECK_LABOUR_RATE_KEY,
    hourlyCost,
    totalCost,
    rateProvenance,
  });
}
