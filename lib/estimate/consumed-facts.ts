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
import { FENCE_CALCULATOR_CONSUMED_FACTS } from "@/lib/estimate/calculators/fence";
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
  fence: FENCE_CALCULATOR_CONSUMED_FACTS,
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

/**
 * DECK-MATURITY-2A — additive consumption domains.
 * `isCalculatorConsumedFact` remains the Refine gate (any domain).
 * A fact may be physically consumed without commercial money effect.
 */
export type ConsumedFactDomain =
  | "scope"
  | "physical"
  | "commercial"
  | "confidence";

export type ConsumedFactConsumption = {
  readonly factKey: string;
  readonly scope: boolean;
  readonly physical: boolean;
  readonly commercial: boolean;
  readonly confidence: boolean;
};

/** Structural layout/identity facts: planning takeoff only in 2A. */
const DECK_PHYSICAL_ONLY_FACTS = new Set<string>([
  "deck.board_direction",
  "deck.joist_section",
  "deck.joist_centres_mm",
  "deck.joist_direction",
  "deck.framing_treatment",
  "deck.bearer_section",
  "deck.bearer_row_count",
  "deck.support_type",
  "deck.supports_per_bearer",
  "deck.support_section",
  "deck.footing_length_mm",
  "deck.footing_width_mm",
  "deck.footing_depth_mm",
  "deck.step_count",
  "deck.step_width_m",
  "deck.step_going_m",
  "deck.fascia_material",
]);

/** Retaining Wall 1A physical/planning facts: takeoff only, not package money. */
const RW_PHYSICAL_ONLY_FACTS = new Set<string>([
  "retaining_wall.is_raking",
  "retaining_wall.surcharge",
  "retaining_wall.surcharge_type",
  "retaining_wall.excavation_volume_m3",
  "retaining_wall.post_spacing_m",
  "retaining_wall.pile_embedment_m",
  "retaining_wall.pile_embedment_ratio",
  "retaining_wall.face_board_section",
  "retaining_wall.sleeper_length_m",
  "retaining_wall.sleeper_face_height_m",
  "retaining_wall.sleeper_post_spacing_m",
  "retaining_wall.sleeper_post_embedment_m",
  "retaining_wall.hole_diameter_m",
  "retaining_wall.digger_access",
  "retaining_wall.premix_bag_yield_m3",
  "retaining_wall.block_series",
  "retaining_wall.block_laying_method",
  "retaining_wall.masonry.subcontract_scope",
  "retaining_wall.footing_width_m",
  "retaining_wall.footing_depth_m",
  "retaining_wall.vertical_starter_spacing_m",
  "retaining_wall.horizontal_rebar_runs",
  "retaining_wall.waterproofing_required",
  "retaining_wall.waterproofing_type",
  "retaining_wall.waterproofing_method",
]);

export function getConsumedFactConsumption(
  workAreaType: string | null | undefined,
  factKey: string | null | undefined
): ConsumedFactConsumption | null {
  if (!workAreaType || !factKey) return null;
  if (!isCalculatorConsumedFact(workAreaType, factKey)) return null;
  if (workAreaType === "deck" && DECK_PHYSICAL_ONLY_FACTS.has(factKey)) {
    return {
      factKey,
      scope: false,
      physical: true,
      commercial: false,
      confidence: false,
    };
  }
  if (workAreaType === "retaining_wall" && RW_PHYSICAL_ONLY_FACTS.has(factKey)) {
    return {
      factKey,
      scope: false,
      physical: true,
      commercial: false,
      confidence: factKey.includes("surcharge") || factKey.includes("engineering"),
    };
  }
  return {
    factKey,
    scope: factKey.includes("included") || factKey.includes("required"),
    physical: true,
    commercial: true,
    confidence: factKey.includes("condition") || factKey.includes("engineering"),
  };
}

export function isPhysicalTakeoffConsumedFact(
  workAreaType: string | null | undefined,
  factKey: string | null | undefined
): boolean {
  return getConsumedFactConsumption(workAreaType, factKey)?.physical === true;
}

export function isCommercialConsumedFact(
  workAreaType: string | null | undefined,
  factKey: string | null | undefined
): boolean {
  return getConsumedFactConsumption(workAreaType, factKey)?.commercial === true;
}
