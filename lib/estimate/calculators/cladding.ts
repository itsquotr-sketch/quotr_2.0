/**
 * CLADDING-01B — staged calculator guard.
 *
 * Recognises the Cladding Work Area so it cannot fall through to another
 * calculator. Emits no line items, no zero-dollar rows, and no invented area.
 */

import { CLADDING_STAGED_NOT_CALCULATED_MESSAGE, storedCladdingPortions } from "@/lib/estimate/cladding-portions";
import type {
  CalculatorResult,
  EstimateContext,
  EstimateWorkArea,
} from "@/lib/estimate/types";

export function calculateCladding(
  context: EstimateContext,
  workArea: EstimateWorkArea
): CalculatorResult {
  storedCladdingPortions(context.facts, workArea.id);
  return {
    lineItems: [],
    assumptions: [],
    missingInfo: [CLADDING_STAGED_NOT_CALCULATED_MESSAGE],
    exclusions: [],
    confidence: 0,
  };
}
