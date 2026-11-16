import { getNumberFact } from "@/lib/estimate/facts";
import { createRateLineItem } from "@/lib/estimate/line-items";
import { getRateSourceLabel } from "@/lib/estimate/rate-source-labels";
import {
  PAVING_MANUAL_COMPONENT,
  PAVING_NESTED_ID,
} from "@/lib/estimate/stated-outdoor-scope";
import { baseConfidence } from "@/lib/estimate/summary";
import { createAssumptionMetadata } from "@/lib/estimate/assumption-metadata";
import type {
  CalculatorResult,
  EstimateContext,
  EstimateWorkArea,
} from "@/lib/estimate/types";

/**
 * A stated paved area has no supported assembly. The area stays one manual
 * Pricing scope. Paving specification is not invented.
 */
export function calculatePaving(
  context: EstimateContext,
  workArea: EstimateWorkArea
): CalculatorResult {
  const area = getNumberFact(context.facts, workArea.id, "paving.area_m2");
  const assumptionMetadata = createAssumptionMetadata();
  if (area == null || area <= 0) {
    return {
      lineItems: [],
      assumptions: [],
      missingInfo: ["Paved patio area is not stated."],
      exclusions: [],
      confidence: baseConfidence(1),
      assumptionMetadata,
    };
  }
  const line = createRateLineItem({
    workAreaId: workArea.id,
    workAreaName: workArea.name,
    label: "Paved patio",
    category: "materials",
    quantity: area,
    unit: "m2",
    costRate: 0,
    sellRate: 0,
    rateSource: getRateSourceLabel("missing"),
    rateSourceType: "missing",
    componentKey: PAVING_MANUAL_COMPONENT,
    notes: `Paved patio. ${area} m² retained for a manual price. No modelled paving rate.`,
    sortOrder: 1,
    organisationSettings: context.organisationSettings,
  });
  return {
    lineItems: [
      {
        ...line,
        nestedItemId: PAVING_NESTED_ID,
        scopeKey: `paving.manual:${workArea.id}:${PAVING_MANUAL_COMPONENT}`,
        componentId: PAVING_MANUAL_COMPONENT,
        includedInTotal: false,
        pricingOwner: "subcontractor_allowance",
        identitySummary: "Paved patio",
        recommendedCost: 0,
        recommendedSell: 0,
      },
    ],
    assumptions: [],
    missingInfo: ["Paving specification is not stated."],
    exclusions: [],
    confidence: baseConfidence(1),
    assumptionMetadata,
  };
}
