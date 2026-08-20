/**
 * ESTIMATOR-SAFETY-0 — Calculator-owned consumed-fact contract.
 *
 * CALCULATOR KNOWS WHAT IT CONSUMES.
 * ASSISTANT KNOWS WHEN TO ASK IT.
 *
 * Assistant Refine adapters may filter/present this declaration.
 * They must not independently invent whether a field affects the estimate.
 *
 * A Work Area-specific Refine adapter is not mature unless every refinement
 * factKey is present in that Work Area's calculator contract.
 */

import { BATHROOM_CALCULATOR_CONSUMED_FACTS } from "@/lib/estimate/calculators/bathroom";
import { DECK_CALCULATOR_CONSUMED_FACTS } from "@/lib/estimate/calculators/deck";
import { PAINTING_CALCULATOR_CONSUMED_FACTS } from "@/lib/estimate/calculators/fitout";
import { KITCHEN_CALCULATOR_CONSUMED_FACTS } from "@/lib/estimate/calculators/kitchen";
import { RETAINING_WALL_CALCULATOR_CONSUMED_FACTS } from "@/lib/estimate/calculators/retaining-wall";

export type CalculatorConsumedFactKey = string;

const CONTRACTS: Readonly<Record<string, readonly string[]>> = {
  deck: DECK_CALCULATOR_CONSUMED_FACTS,
  bathroom: BATHROOM_CALCULATOR_CONSUMED_FACTS,
  painting: PAINTING_CALCULATOR_CONSUMED_FACTS,
  retaining_wall: RETAINING_WALL_CALCULATOR_CONSUMED_FACTS,
  kitchen: KITCHEN_CALCULATOR_CONSUMED_FACTS,
};

/** Project Conditions consumed by labour/access adjustments across calculators. */
export const SHARED_CONSUMED_CONSTRAINT_KEYS = [
  "site_access",
  "material_carry_distance",
] as const;

export function getCalculatorConsumedFacts(
  workAreaType: string
): ReadonlySet<string> {
  const keys = CONTRACTS[workAreaType];
  return new Set(keys ?? []);
}

export function hasCalculatorConsumedFactContract(
  workAreaType: string
): boolean {
  return workAreaType in CONTRACTS;
}

export function isCalculatorConsumedFact(
  workAreaType: string | null | undefined,
  factKey: string | null | undefined
): boolean {
  if (!workAreaType || !factKey) return false;
  return getCalculatorConsumedFacts(workAreaType).has(factKey);
}

export function isCalculatorConsumedConstraint(
  constraintKey: string | null | undefined
): boolean {
  if (!constraintKey) return false;
  return (SHARED_CONSUMED_CONSTRAINT_KEYS as readonly string[]).includes(
    constraintKey
  );
}

/**
 * Refine adapters are mature only when every asked fact is in the
 * calculator-owned contract. Missing contract → not mature.
 */
export function refineFactsAreContractBacked(
  workAreaType: string,
  factKeys: readonly string[]
): boolean {
  if (!hasCalculatorConsumedFactContract(workAreaType)) return false;
  const consumed = getCalculatorConsumedFacts(workAreaType);
  return factKeys.every((key) => consumed.has(key));
}
