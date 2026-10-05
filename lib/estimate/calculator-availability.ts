/**
 * Detailed Work Area calculators.
 *
 * This is the same set registered in `calculate-estimate.ts`.
 * The Record type on that map must stay in lockstep with this list.
 * It is not a maturity, Verified, or Beta ranking.
 */

export const DETAILED_CALCULATOR_WORK_AREA_TYPES = [
  "deck",
  "pergola",
  "retaining_wall",
  "external_stairs",
  "bathroom",
  "kitchen",
  "fence",
  "demolition",
  "internal_walls",
  "ceilings",
  "doors",
  "flooring",
  "painting",
  "plastering",
  "cladding",
] as const;

export type DetailedCalculatorWorkAreaType =
  (typeof DETAILED_CALCULATOR_WORK_AREA_TYPES)[number];

const DETAILED = new Set<string>(DETAILED_CALCULATOR_WORK_AREA_TYPES);

export function workAreaTypeHasDetailedCalculator(
  type: string
): type is DetailedCalculatorWorkAreaType {
  return DETAILED.has(type);
}
