/**
 * CLADDING-05 — nested physical takeoff then hosted commercialisation.
 *
 * A work area with no sections keeps the details-required message.
 */

import { commercializeCladding, claddingCommercialCalculatorFields } from "@/lib/estimate/cladding-commercial";
import { calculateCladdingPhysical } from "@/lib/estimate/cladding-physical";
import type {
  CalculatorResult,
  EstimateContext,
  EstimateWorkArea,
} from "@/lib/estimate/types";

export function calculateCladding(
  context: EstimateContext,
  workArea: EstimateWorkArea
): CalculatorResult {
  const physical = calculateCladdingPhysical({
    facts: context.facts,
    workArea,
  });
  const commercial = commercializeCladding({
    physical,
    workArea,
    rates: context.rates,
    organisationSettings: context.organisationSettings,
    constraints: context.constraints,
  });
  return {
    lineItems: [...commercial.lineItems],
    assumptions: [...commercial.assumptions],
    missingInfo: [...commercial.missingInfo],
    exclusions: [...commercial.exclusions],
    confidence: commercial.lineItems.some((row) => (row.recommendedCost ?? 0) > 0) ? 0.6 : 0,
    ...claddingCommercialCalculatorFields(commercial),
  };
}
