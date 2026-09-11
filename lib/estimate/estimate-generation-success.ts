/**
 * EF02-FINAL-R3-C — Generate Estimate success invariant.
 *
 * "Calculator returned" is not the same as "a usable estimate was produced".
 * Enforced in runEstimateGeneration before persist / estimate_ready.
 */

import { isMatureInternalWallsPath } from "@/lib/estimate/internal-walls-scope";
import type {
  EstimateFact,
  EstimateLineItemInput,
  EstimateResult,
} from "@/lib/estimate/types";
import { isMatureSupportedWorkAreaType } from "@/lib/work-areas/support-contract";

export const ESTIMATE_UNUSABLE_USER_MESSAGE =
  "Quotr couldn't create a usable estimate from the current job details. Review the job details and try again.";

export type EmptyEstimateClassification =
  | "insufficient_physical"
  | "commercial_empty"
  | "calculator_empty";

export type EstimateGenerationSuccessDecision =
  | { ok: true; reason: "meaningful_output" | "guard_not_applicable" }
  | {
      ok: false;
      reason: "invalid_empty_output";
      classification: EmptyEstimateClassification;
    };

function isIncludedCommercialLine(item: EstimateLineItemInput): boolean {
  return item.includedInTotal !== false;
}

function isPricingRequiredLine(item: EstimateLineItemInput): boolean {
  return isIncludedCommercialLine(item) && item.rateSourceType === "missing";
}

/**
 * Canonical mature estimating instances:
 * - support-contract MATURE_SUPPORTED_TYPES (Deck, Fence, Retaining Wall, Bathroom)
 * - Internal Walls on the existing mature calculator path
 */
export function isConfirmedMatureEstimatingWorkArea(params: {
  type: string;
  workAreaId: string;
  facts: readonly EstimateFact[];
}): boolean {
  if (isMatureSupportedWorkAreaType(params.type)) return true;
  if (params.type === "internal_walls") {
    return isMatureInternalWallsPath({
      facts: params.facts,
      workAreaId: params.workAreaId,
    });
  }
  return false;
}

export function projectRequiresNonemptyEstimate(params: {
  confirmedWorkAreas: readonly { id: string; type: string }[];
  facts: readonly EstimateFact[];
}): boolean {
  return params.confirmedWorkAreas.some((area) =>
    isConfirmedMatureEstimatingWorkArea({
      type: area.type,
      workAreaId: area.id,
      facts: params.facts,
    })
  );
}

export function hasMeaningfulEstimateOutput(
  result: Pick<EstimateResult, "lineItems">
): boolean {
  return result.lineItems.some(isIncludedCommercialLine);
}

export function hasPricingRequiredRepresentation(
  result: Pick<EstimateResult, "lineItems">
): boolean {
  return result.lineItems.some(isPricingRequiredLine);
}

export function classifyEmptyEstimateResult(
  result: Pick<EstimateResult, "lineItems" | "missingInfo" | "requirements">
): EmptyEstimateClassification {
  if ((result.missingInfo ?? []).length > 0) return "insufficient_physical";
  if ((result.requirements ?? []).length > 0) return "commercial_empty";
  return "calculator_empty";
}

export function evaluateEstimateGenerationSuccess(params: {
  confirmedWorkAreas: readonly { id: string; type: string }[];
  facts: readonly EstimateFact[];
  result: Pick<EstimateResult, "lineItems" | "missingInfo" | "requirements">;
}): EstimateGenerationSuccessDecision {
  if (
    !projectRequiresNonemptyEstimate({
      confirmedWorkAreas: params.confirmedWorkAreas,
      facts: params.facts,
    })
  ) {
    return { ok: true, reason: "guard_not_applicable" };
  }
  if (hasMeaningfulEstimateOutput(params.result)) {
    return { ok: true, reason: "meaningful_output" };
  }
  return {
    ok: false,
    reason: "invalid_empty_output",
    classification: classifyEmptyEstimateResult(params.result),
  };
}
