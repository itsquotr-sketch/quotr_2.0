/**
 * RETAINING-WALL-MATURITY-2A — Concrete Sleeper detailed commercial calibration.
 *
 * Adapt Timber 1D/1F architecture. Do not invent a second estimating model.
 * Starters are disclosed estimating bands, not manufacturer quotes.
 */

import type { OrganisationSettings } from "@/components/setup/types";
import { classifyResolvedSell } from "@/lib/commercial-engine/core/cost-first-authority";
import { DEFAULT_MARGIN_PERCENT } from "@/lib/estimate/constants";
import {
  RW_TIMBER_PILING_METHOD_MANUAL,
  type RwTimberPilingMethod,
} from "@/lib/estimate/retaining-wall-construction-method";
import {
  RW_CONCRETE_SLEEPER_KEY,
  RW_DRAINAGE_AGGREGATE_KEY,
  RW_NOVACOIL_KEY,
  RW_SLEEPER_PREMIX_20KG_KEY,
  RW_STEEL_POST_KEY,
} from "@/lib/estimate/retaining-wall-identities";
import { RW_PRODUCTIVITY_KEYS } from "@/lib/estimate/retaining-wall-productivity";

/** Common NZ 2000 mm sleeper. Disclosed estimating default, not a brand. */
export const RW_DEFAULT_SLEEPER_LENGTH_M = 2;
/** Common NZ 200 mm face height. Disclosed estimating default. */
export const RW_DEFAULT_SLEEPER_FACE_HEIGHT_M = 0.2;
/**
 * 20 kg general-purpose premix yield. Merchant bags vary ~9–11 L.
 * Estimating default only — selected product yield overrides.
 */
export const RW_PREMIX_20KG_YIELD_M3 = 0.01;

/**
 * Fact key `retaining_wall.sleeper_length_m` is the physical purchased
 * sleeper unit length — not a continuously resized bay width.
 */
export const RW_SLEEPER_LENGTH_SEMANTICS = "PHYSICAL_PURCHASED_UNIT_LENGTH" as const;
export const RW_SLEEPER_BAY_LAYOUT_KIND =
  "FULL_STANDARD_BAYS_PLUS_RESIDUAL_END_BAY" as const;
export const RW_SLEEPER_CUT_PROCUREMENT =
  "PURCHASE_STANDARD_UNIT_THEN_CUT" as const;

export const RW_SLEEPER_DEFAULT_LENGTH_DISCLOSURE =
  "Concrete sleeper length assumed 2.0 m (common 2000 mm class). This is the physical purchased unit length, not a resized bay. Estimating default — not a manufacturer SKU.";
export const RW_SLEEPER_DEFAULT_FACE_DISCLOSURE =
  "Concrete sleeper face height assumed 0.20 m (common 200 mm class). Estimating default — not a manufacturer SKU.";
export const RW_SLEEPER_SPACING_KIND = "ESTIMATING_LAYOUT_ASSUMPTION" as const;
export const RW_SLEEPER_DEFAULT_SPACING_DISCLOSURE =
  "Post spacing estimated from the selected/nominal sleeper system for pricing. Confirm manufacturer or engineered design.";
export const RW_SLEEPER_NOMINAL_MODULE_DISCLOSURE =
  "Nominal sleeper module used for estimating — confirm selected system.";
export const RW_SLEEPER_DEFAULT_EMBEDMENT_DISCLOSURE =
  "Steel post embedment is a preliminary estimating assumption of 70% of local wall height at each post (total length ≈ 1.70 × H(x)). Estimating assumption only — not a manufacturer requirement, engineering rule, or structural recommendation.";
export const RW_SLEEPER_DESIGN_CONFIRM =
  "Confirm sleeper system / post spacing and embedment.";
export const RW_SLEEPER_CONCRETE_GRADE_DISCLOSURE =
  "Concrete grade/product to be confirmed with selected wall system/design. Bagged general-purpose premix is an estimating material, not a specified structural mix.";
export const RW_ESTIMATING_ASSUMPTION_CONFIRM = RW_SLEEPER_DESIGN_CONFIRM;

export const RW_SLEEPER_CONCRETE_OWNERSHIP =
  "CONCRETE_PLACEMENT_SEPARATE_FROM_POST_INSTALL" as const;
export const RW_SLEEPER_HOLE_EXCAVATION_OWNERSHIP =
  "POST_HOLE_DIG_OWNED_BY_POST_INSTALL_AND_PLANT" as const;
export const RW_SLEEPER_FIXINGS_TREATMENT = "NOT_APPLICABLE_SLOTTED_H_POST" as const;
export const RW_SLEEPER_PACKAGE_LIFECYCLE = "LEGACY_FALLBACK_ONLY" as const;
export const RW_SLEEPER_PLANT_TREATMENT =
  "MINI_EXCAVATOR_MACHINE_HOURS_CEIL_TO_DAYS_WHEN_MACHINE_ACCESS_ELSE_MANUAL" as const;
export const RW_SLEEPER_AUTHORITY_WITH_ALLOWANCE =
  "DETAILED_COMPONENT_AUTHORITY_WITH_ALLOWANCE" as const;

/** Same machine occupancy as timber pile holes — auger work is the same driver. */
export const RW_SLEEPER_PLANT_HOURS_PER_POST_BASIS =
  "SAME_AUGER_OCCUPANCY_AS_TIMBER_PILE_HOLES_0_20_H_EA" as const;

export const RW_SLEEPER_2A_ACCESS_RULE = {
  appliesTo: [
    "excavation",
    "post_installation",
    "sleeper_installation",
    "concrete_placement",
    "drainage",
    "backfill",
  ] as const,
  method: "PER_INTENT_PROJECT_CONDITION_MODIFIERS" as const,
  excavationIncludesMaterialCarry: false,
  inwardMaterialIncludesCarry: true,
  note:
    "Site access may adjust excavation, posts, sleepers, concrete placement, drainage, and backfill. Material carry adjusts inward-material intents only. Bulk excavation does not inherit material carry. Post-hole digging is not a second excavation labour. Spoil/export uses waste facts, not material_carry_distance.",
};

export const RW_SLEEPER_2A_PRODUCTIVITY_STARTERS: Record<
  string,
  {
    hoursPerUnit: number;
    unit: string;
    included: string;
    excluded: string;
    confidence: "starter";
    confidenceBand: "low" | "medium";
    rationale: string;
    crewMethod: string;
    plantAssumption: string;
  }
> = {
  [RW_PRODUCTIVITY_KEYS.sleeperPostsEa]: {
    hoursPerUnit: 0.95,
    unit: "ea",
    included:
      "Set-out, attend machine hole, place H-section post, align, plumb, brace (MACHINE_ASSISTED)",
    excluded:
      "Bulk excavation, sleeper install, concrete placement (separate), spoil export, mini-excavator hire",
    confidence: "starter",
    confidenceBand: "low",
    crewMethod: "1 carpenter attending mini-excavator/auger on an accessible site",
    plantAssumption: "Mini-excavator/auger day priced separately when access allows",
    rationale:
      "Steel H-posts are heavier to place than timber SED piles (0.85 h/ea). 0.95 h/ea is carpenter attendance with machine-dug holes. Not a fully manual dig. Manual fallback is 2.00 h/ea.",
  },
  [RW_PRODUCTIVITY_KEYS.sleeperConcreteHole]: {
    hoursPerUnit: 0.12,
    unit: "hole",
    included: "Mix/place bagged concrete, basic consolidation, strike off at post hole",
    excluded: "Hole excavation, post setting, sleeper install, bulk excavation, plant",
    confidence: "starter",
    confidenceBand: "low",
    crewMethod: "1 person with bagged premix at already-set posts",
    plantAssumption: "None — hand mix/place",
    rationale:
      "A 300 mm post hole is a small pour. ~7 min/hole covers mix, place, and consolidate. Not combined with post-install hours.",
  },
  [RW_PRODUCTIVITY_KEYS.sleeperSleepersEa]: {
    hoursPerUnit: 0.22,
    unit: "ea",
    included: "Lift, slot into H-post, pack/level, normal workface handling",
    excluded: "Post installation, concrete, drainage, bulk excavation, plant",
    confidence: "starter",
    confidenceBand: "low",
    crewMethod: "1–2 person handling of 2000×200 sleepers once posts are in",
    plantAssumption: "None — hand/small-tool. Awkward carry is Project Conditions.",
    rationale:
      "Discrete sleeper units, not face m². ~13 min/ea is a suburban starter for standard 200 mm sleepers into H-posts.",
  },
};

export const RW_SLEEPER_POST_HOURS_MANUAL = 2;
export const RW_SLEEPER_EXCAVATION_HOURS_MANUAL_M3 = 1.6;

export function sleeper2APostHours(method: RwTimberPilingMethod): number {
  return method === RW_TIMBER_PILING_METHOD_MANUAL
    ? RW_SLEEPER_POST_HOURS_MANUAL
    : RW_SLEEPER_2A_PRODUCTIVITY_STARTERS[RW_PRODUCTIVITY_KEYS.sleeperPostsEa]!
        .hoursPerUnit;
}

export function sleeper2AExcavationHoursM3(method: RwTimberPilingMethod): number {
  return method === RW_TIMBER_PILING_METHOD_MANUAL
    ? RW_SLEEPER_EXCAVATION_HOURS_MANUAL_M3
    : 0.45;
}

export type RwSleeperStarterConfidence = "low" | "medium";

export const RW_SLEEPER_2A_MATERIAL_STARTERS: Record<
  string,
  {
    costPerUnit: number;
    unit: string;
    identity: string;
    rationale: string;
    confidence: RwSleeperStarterConfidence;
  }
> = {
  [RW_CONCRETE_SLEEPER_KEY]: {
    costPerUnit: 36,
    unit: "ea",
    identity: "Precast concrete sleeper 2000×200 mm class",
    confidence: "low",
    rationale:
      "LOW-CONFIDENCE QUOTR STARTER BENCHMARK. Indicative 2000×200 class band only — not a trusted current market price or supplier quote. Company/Project exact overrides.",
  },
  [RW_STEEL_POST_KEY]: {
    costPerUnit: 58,
    unit: "lm",
    identity: "H-section steel retaining post (theoretical length)",
    confidence: "low",
    rationale:
      "LOW-CONFIDENCE QUOTR STARTER BENCHMARK. Indicative H-section $/lm only — not a supplier quote. Stock-length SKUs are not invented. Company/Project exact overrides.",
  },
  [RW_SLEEPER_PREMIX_20KG_KEY]: {
    costPerUnit: 11.5,
    unit: "bag",
    identity: "20 kg general-purpose premix bag",
    confidence: "medium",
    rationale:
      "MEDIUM-CONFIDENCE QUOTR STARTER. Conservative current NZ retail band for 20 kg GP/rapid premix (~$11–12/bag ex GST), not the cheapest listed product. Yield 0.01 m³/bag. Company/Project exact overrides. Not a specified structural mix.",
  },
  [RW_NOVACOIL_KEY]: {
    costPerUnit: 8.5,
    unit: "lm",
    identity: "100 mm slotted drainage coil (novacoil)",
    confidence: "medium",
    rationale: "Shared Timber 1D starter — same product on sleeper walls.",
  },
  [RW_DRAINAGE_AGGREGATE_KEY]: {
    costPerUnit: 72,
    unit: "m3",
    identity: "Drainage aggregate / drainage metal (purchased m³)",
    confidence: "medium",
    rationale: "Shared Timber 1D starter — same drainage metal on sleeper walls.",
  },
};

export function sleeper2AMaterialStarter(
  itemKey: string | null | undefined,
  unit?: string | null
): {
  costPerUnit: number;
  unit: string;
  confidence: RwSleeperStarterConfidence;
} | null {
  if (!itemKey) return null;
  const row = RW_SLEEPER_2A_MATERIAL_STARTERS[itemKey];
  if (!row || row.costPerUnit <= 0) return null;
  if (unit && row.unit !== unit) return null;
  return {
    costPerUnit: row.costPerUnit,
    unit: row.unit,
    confidence: row.confidence,
  };
}

export function sleeper2AProductivityStarter(
  productivityKey: string
): { hoursPerUnit: number; unit: string } | null {
  const row = RW_SLEEPER_2A_PRODUCTIVITY_STARTERS[productivityKey];
  return row ? { hoursPerUnit: row.hoursPerUnit, unit: row.unit } : null;
}

export function detailedSleeperLabourFromCost(
  costPerHour: number,
  organisationSettings: OrganisationSettings | null
): {
  costPerHour: number;
  sellPerHour: number;
  sellAuthority: "derived_from_gross_margin";
  sellDerivedFromMargin: true;
  grossMarginPercent: number;
} {
  const gm =
    organisationSettings?.default_margin_percent ?? DEFAULT_MARGIN_PERCENT;
  const classified = classifyResolvedSell({
    costRate: costPerHour,
    sellRate: null,
    applicableGrossMarginPercent: gm,
  });
  return {
    costPerHour,
    sellPerHour: classified.sellRate,
    sellAuthority: "derived_from_gross_margin",
    sellDerivedFromMargin: true,
    grossMarginPercent: gm,
  };
}
