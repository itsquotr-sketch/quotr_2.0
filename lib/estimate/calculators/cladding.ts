/**
 * CLADDING-03 — nested physical takeoff, with no commercial lines.
 *
 * Hosted path: calculateCladding → calculateCladdingPhysical.
 * Line items stay empty. A work area with no sections keeps the
 * details-required message and invents no area.
 */

import { calculateCladdingPhysical, claddingUnpricedCalculatorFields } from "@/lib/estimate/cladding-physical";
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
  return {
    lineItems: [],
    assumptions: [],
    missingInfo: [...physical.missingInfo],
    exclusions: [],
    confidence: 0,
    ...claddingUnpricedCalculatorFields(physical),
  };
}
