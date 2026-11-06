import { calculateBathroom } from "@/lib/estimate/calculators/bathroom";
import { calculateCladding } from "@/lib/estimate/calculators/cladding";
import {
  calculatePreliminaries,
  PRELIMINARIES_WORK_AREA_TYPE,
} from "@/lib/estimate/preliminaries";
import { calculateDeck } from "@/lib/estimate/calculators/deck";
import { calculateDemolition } from "@/lib/estimate/calculators/demolition";
import { calculateExternalStairs } from "@/lib/estimate/calculators/external-stairs";
import { calculateFence } from "@/lib/estimate/calculators/fence";
import {
  calculateCeilings,
  calculateDoors,
  calculateFlooring,
  calculateInternalWalls,
  calculatePainting,
  calculatePlastering,
} from "@/lib/estimate/calculators/fitout";
import { calculateKitchen } from "@/lib/estimate/calculators/kitchen";
import { calculatePergola } from "@/lib/estimate/calculators/pergola";
import { calculateRetainingWall } from "@/lib/estimate/calculators/retaining-wall";
import { createAssumptionMetadata, mergeAssumptionMetadata } from "@/lib/estimate/assumption-metadata";
import { finalizeEstimateResult, mergeUnique } from "@/lib/estimate/summary";
import { mergeDuplicateMaterialBuildUpLineItems } from "@/lib/estimate/material-buildup-dedupe";
import { dedupePricedItemsByScopeOwnership } from "@/lib/estimate/pricing-ownership";
import { collectRequirements } from "@/lib/estimate/requirement-normalize";
import { applyRegisteredComponentCommercialAuthority } from "@/lib/estimate/component-commercial-selection";
import {
  workAreaTypeHasDetailedCalculator,
  type DetailedCalculatorWorkAreaType,
} from "@/lib/estimate/calculator-availability";
import type {
  CalculatorResult,
  EstimateContext,
  EstimateLineItemInput,
  EstimateResult,
  WorkAreaCalculator,
} from "@/lib/estimate/types";

const CALCULATORS: Record<DetailedCalculatorWorkAreaType, WorkAreaCalculator> = {
  deck: calculateDeck,
  pergola: calculatePergola,
  retaining_wall: calculateRetainingWall,
  external_stairs: calculateExternalStairs,
  bathroom: calculateBathroom,
  kitchen: calculateKitchen,
  fence: calculateFence,
  demolition: calculateDemolition,
  internal_walls: calculateInternalWalls,
  ceilings: calculateCeilings,
  doors: calculateDoors,
  flooring: calculateFlooring,
  painting: calculatePainting,
  plastering: calculatePlastering,
  cladding: calculateCladding,
  preliminaries: (context, workArea) => calculatePreliminaries(context, workArea),
};

export class EstimateEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EstimateEngineError";
  }
}

export function calculateEstimate(context: EstimateContext): EstimateResult {
  const confirmed = context.confirmedWorkAreas;

  if (confirmed.length === 0) {
    throw new EstimateEngineError("No confirmed work areas to estimate.");
  }

  const lineItems: EstimateLineItemInput[] = [];
  const assumptions: string[] = [];
  const missingInfo: string[] = [];
  const exclusions: string[] = [];
  const calculatorResults: CalculatorResult[] = [];
  const assumptionMetadata = createAssumptionMetadata();
  let sortOrder = 1;

  const ordered = [...confirmed].sort((left, right) => {
    if (left.type === PRELIMINARIES_WORK_AREA_TYPE) return 1;
    if (right.type === PRELIMINARIES_WORK_AREA_TYPE) return -1;
    return left.sort_order - right.sort_order;
  });

  for (const workArea of ordered) {
    if (workArea.type === PRELIMINARIES_WORK_AREA_TYPE) continue;
    const calculator = workAreaTypeHasDetailedCalculator(workArea.type)
      ? CALCULATORS[workArea.type]
      : undefined;

    if (!calculator) {
      missingInfo.push(`No calculator available for ${workArea.name}.`);
      calculatorResults.push({
        lineItems: [],
        assumptions: [],
        missingInfo: [`No calculator available for ${workArea.name}.`],
        exclusions: [],
        confidence: 40,
      });
      continue;
    }

    const result = calculator(context, workArea);
    calculatorResults.push(result);

    if (result.assumptionMetadata) {
      const merged = mergeAssumptionMetadata([
        assumptionMetadata,
        result.assumptionMetadata,
      ]);
      assumptionMetadata.defaultedFacts = merged.defaultedFacts;
      assumptionMetadata.assumptionSeverity = merged.assumptionSeverity;
    }

    for (const item of result.lineItems) {
      lineItems.push({
        ...item,
        sortOrder: sortOrder++,
      });
    }

    assumptions.push(...result.assumptions);
    missingInfo.push(...result.missingInfo);
    exclusions.push(...result.exclusions);
  }

  const preliminaries = ordered.find(
    (workArea) => workArea.type === PRELIMINARIES_WORK_AREA_TYPE
  );
  if (preliminaries) {
    const result = calculatePreliminaries(context, preliminaries, lineItems);
    calculatorResults.push(result);
    for (const item of result.lineItems) {
      lineItems.push({ ...item, sortOrder: sortOrder++ });
    }
    assumptions.push(...result.assumptions);
    missingInfo.push(...result.missingInfo);
    exclusions.push(...result.exclusions);
  }

  if (lineItems.length === 0) {
    missingInfo.push(
      "No priced line items could be generated from confirmed work areas."
    );
  }

  const requirements = collectRequirements(calculatorResults);
  const composed = applyRegisteredComponentCommercialAuthority({
    lineItems: dedupePricedItemsByScopeOwnership(
      mergeDuplicateMaterialBuildUpLineItems(lineItems)
    ),
    requirements,
    workAreas: confirmed,
    organisationSettings: context.organisationSettings,
  });

  const estimate = finalizeEstimateResult({
    lineItems: composed.lineItems,
    assumptions: mergeUnique(assumptions),
    missingInfo: mergeUnique(missingInfo),
    exclusions: mergeUnique(exclusions),
    calculatorResults,
    assumptionMetadata,
  });

  // Physical collection only. Do not add requirement cost on top of legacy money.
  return {
    ...estimate,
    requirements,
    commercialSelections: composed.selections,
    legacyCommercialCandidates: composed.legacyCandidates,
  };
}
