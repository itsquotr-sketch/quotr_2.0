/**
 * RETAINING-WALL-MATURITY-1D-R1 — Timber detailed commercial calibration.
 *
 * Quantity × identity × rate. Decomposed labour. Package is fallback only.
 * R1: stock-length pile purchase, disclosed identities, plant/method agreement,
 * cost-first labour sell. Starters are not hidden fudge on the old package total.
 */

import type { OrganisationSettings } from "@/components/setup/types";
import { classifyResolvedSell } from "@/lib/commercial-engine/core/cost-first-authority";
import { DEFAULT_MARGIN_PERCENT } from "@/lib/estimate/constants";
import {
  RW_TIMBER_PILING_METHOD_MANUAL,
  type RwTimberPilingMethod,
} from "@/lib/estimate/retaining-wall-construction-method";
import {
  RW_FACE_BOARD_150_H4_KEY,
  RW_FACE_BOARD_200_H4_KEY,
  RW_H5_SED_POLE_KEY,
  RW_HOUSE_PILE_125_KEY,
  RW_DRAINAGE_AGGREGATE_KEY,
  RW_NOVACOIL_KEY,
} from "@/lib/estimate/retaining-wall-identities";
import {
  RW_H5_SED_150_175_STOCK_STARTERS,
  RW_H5_SED_STOCK_LENGTHS_M,
  rwH5SedStockItemKey,
} from "@/lib/estimate/retaining-wall-pile-procurement";
import { RW_PRODUCTIVITY_KEYS } from "@/lib/estimate/retaining-wall-productivity";
import {
  RW_DRAINAGE_SOCK_KEY,
  RW_DRAINAGE_SOCK_STARTER_COST_PER_LM,
  RW_EXCAVATION_MACHINE_HOURS_KEY,
  RW_EXCAVATION_MANUAL_HOURS_KEY,
  RW_EXCAVATION_MACHINE_HOURS_STARTER,
  RW_EXCAVATION_MANUAL_HOURS_STARTER,
  retainingWallExcavationHoursStarter,
  retainingWallExcavationProductivityKey,
} from "@/lib/estimate/retaining-wall-family-coverage";
import { HOUSE_PILE_BENCHMARK_COST_EX_GST } from "@/lib/estimate/house-pile-benchmarks";

/**
 * Drainage metal is placed loosely / lightly consolidated, not structural fill.
 * 1.25 is a Quotr starter ASSUMPTION: ~15% loose-vs-placed bulkage/handling
 * plus ~10% site waste/spillage. Not a compaction calibration.
 */
export const RW_DRAINAGE_AGGREGATE_PROCUREMENT_FACTOR = 1.25;
export const RW_DRAINAGE_AGGREGATE_PROCUREMENT_BASIS =
  "QUOTR_STARTER_ASSUMPTION_FACTOR_1_25" as const;
export const RW_DRAINAGE_AGGREGATE_PROCUREMENT_KIND = "ASSUMPTION" as const;
export const RW_DRAINAGE_AGGREGATE_PROCUREMENT_NOTE =
  "In-place drainage metal × 1.25 = purchase m³. Assumption covers loose-vs-placed bulkage and handling loss. Not heavy compaction shrinkage. Not a measured conversion.";

/**
 * Fixings / connectors residual: 8% of face-board + purchased pile material.
 * Quotr starter allowance — not an empirical benchmark.
 */
export const RW_TIMBER_FIXINGS_PERCENT_OF_TIMBER = 0.08;
export const RW_TIMBER_FIXINGS_METHOD =
  "QUOTR_STARTER_ALLOWANCE_PERCENT_OF_BOARD_AND_PILE_MATERIAL" as const;
export const RW_TIMBER_FIXINGS_KIND = "QUOTR_STARTER_ALLOWANCE" as const;

export const RW_TIMBER_DRAINAGE_LABOUR_OWNERSHIP =
  "SEPARATE_NOVACOIL_INSTALL_LABOUR" as const;

export const RW_TIMBER_PLANT_TREATMENT =
  "MINI_EXCAVATOR_MACHINE_HOURS_CEIL_TO_DAYS_WHEN_MACHINE_ACCESS_ELSE_MANUAL" as const;

export const RW_TIMBER_CONCRETE_TREATMENT =
  "CONCRETE_PLACEMENT_SEPARATE_FROM_PILE_INSTALL" as const;
export const RW_TIMBER_CONCRETE_OWNERSHIP =
  "POST_HOLE_BAGGED_PREMIX_MATERIAL_PLUS_SEPARATE_PLACEMENT_LABOUR" as const;

export const RW_TIMBER_AUTHORITY_WITH_ALLOWANCE =
  "DETAILED_COMPONENT_AUTHORITY_WITH_ALLOWANCE" as const;

/**
 * When excavation is required but bulk m³ is unknown:
 * do not price 0 m³. Use the former package excavation add-on
 * (0.6 h / face-m²) as an explicit EXCAVATION ALLOWANCE.
 * This is not measured m³ productivity.
 */
export const RW_EXCAVATION_UNKNOWN_ALLOWANCE_HOURS_PER_FACE_M2 = 0.6;
export const RW_EXCAVATION_UNKNOWN_TREATMENT =
  "EXPLICIT_EXCAVATION_ALLOWANCE_FROM_LEGACY_PACKAGE_ADDON" as const;

export const RW_TIMBER_PACKAGE_LIFECYCLE = "LEGACY_FALLBACK_ONLY" as const;

/** Quotr starter carpenter COST only. Sell for detailed timber is derived from GM. */
export const RW_TIMBER_STARTER_LABOUR_COST_PER_HOUR = 60;

export const RW_TIMBER_1D_PRODUCTIVITY_STARTERS: Record<
  string,
  {
    hoursPerUnit: number;
    unit: string;
    included: string;
    excluded: string;
    confidence: "starter";
    rationale: string;
    crewMethod: string;
    plantAssumption: string;
  }
> = {
  [RW_PRODUCTIVITY_KEYS.timberFaceM2]: {
    hoursPerUnit: 0.55,
    unit: "m2",
    included:
      "Cutting, placing, levelling, fixing face boards, normal workface handling",
    excluded: "Pile installation, drainage, bulk excavation, off-site cartage, plant",
    confidence: "starter",
    crewMethod: "1 carpenter, piles already in, typical suburban access",
    plantAssumption: "None — hand/small-tool",
    rationale:
      "NZ carpenter timber-face install typically 30–40 min/m² once piles are in. 0.55 h/m² is a mid starter, not the old 2.0+0.6 package lump.",
  },
  [RW_PRODUCTIVITY_KEYS.timberPilesEa]: {
    hoursPerUnit: 0.85,
    unit: "ea",
    included:
      "Set-out, attend machine hole, place, align, plumb, normal handling (MACHINE_ASSISTED)",
    excluded: "Bulk excavation, concrete, spoil export, mini-excavator hire (separate plant)",
    confidence: "starter",
    crewMethod: "1 carpenter attending mini-excavator/auger on an accessible site",
    plantAssumption: "Mini-excavator/auger day priced separately when access allows",
    rationale:
      "0.85 h/ea is carpenter attendance with machine-dug holes. It is not valid as a fully manual dig with no plant. Manual fallback is 1.80 h/ea.",
  },
  [RW_PRODUCTIVITY_KEYS.drainageLm]: {
    hoursPerUnit: 0.15,
    unit: "lm",
    included: "Laying novacoil, normal joining, positioning, drainage-run work",
    excluded: "Drainage aggregate placement, bulk excavation, plant",
    confidence: "starter",
    crewMethod: "1 person along the heel",
    plantAssumption: "None",
    rationale:
      "Novacoil along a timber heel is light work. 0.15 h/lm covers unroll, join, and position.",
  },
  [RW_PRODUCTIVITY_KEYS.backfillM3]: {
    hoursPerUnit: 0.55,
    unit: "m3",
    included:
      "Placement, spreading, manual/basic consolidation of drainage aggregate",
    excluded:
      "Novacoil laying, bulk excavation, mechanical plate-compactor (not required for drainage metal starter)",
    confidence: "starter",
    crewMethod: "1–2 person shovel/barrow in a 300 mm zone",
    plantAssumption: "No compactor — drainage metal is not structural compacted fill",
    rationale:
      "0.55 h/m³ in-place is a small-crew starter for loose drainage metal. Mechanical compaction is out of this starter.",
  },
  [RW_PRODUCTIVITY_KEYS.excavationM3]: {
    hoursPerUnit: 0.45,
    unit: "m3",
    included: "Crew attendance on machine bulk cut when volume is measured",
    excluded: "Pile holes, spoil export, mini-excavator hire (separate plant)",
    confidence: "starter",
    crewMethod: "Carpenter/labourer attending mini-excavator",
    plantAssumption: "Mini-excavator day when digger access allows; manual 1.6 labour-h/m³ if no machine",
    rationale:
      "Measured bulk cut with machine on site is attendance, not 1.6 labour-h/m³ hand digging. Unknown volume stays a labelled face-m² EXCAVATION ALLOWANCE.",
  },
  [RW_EXCAVATION_MACHINE_HOURS_KEY]: {
    hoursPerUnit: RW_EXCAVATION_MACHINE_HOURS_STARTER,
    unit: "m3",
    included: "Machine-assisted bulk excavation crew attendance",
    excluded: "Pile holes, spoil export, mini-excavator hire (separate plant)",
    confidence: "starter",
    crewMethod: "Carpenter/labourer attending mini-excavator",
    plantAssumption: "Mini-excavator when digger access allows",
    rationale: "Shared Timber/Sleeper/Masonry machine-assisted excavation starter.",
  },
  [RW_EXCAVATION_MANUAL_HOURS_KEY]: {
    hoursPerUnit: RW_EXCAVATION_MANUAL_HOURS_STARTER,
    unit: "m3",
    included: "Manual bulk excavation",
    excluded: "Machine plant, pile holes",
    confidence: "starter",
    crewMethod: "Hand digging / barrow when no digger access",
    plantAssumption: "None",
    rationale: "Shared Timber/Sleeper/Masonry manual excavation starter.",
  },
  [RW_PRODUCTIVITY_KEYS.timberConcreteHole]: {
    hoursPerUnit: 0.12,
    unit: "hole",
    included: "LEGACY — mix/place bagged premix per hole (superseded by h/bag key)",
    excluded: "Hole digging, plant, bulk excavation",
    confidence: "starter",
    crewMethod: "Legacy h/hole — not consumed as h/bag authority",
    plantAssumption: "None",
    rationale:
      "Legacy starter retained for catalogue identity only. Mature path uses retaining_wall.post_hole_concrete.place.hours_per_bag.",
  },
  [RW_PRODUCTIVITY_KEYS.postHoleConcreteM3]: {
    hoursPerUnit: 3.5,
    unit: "m3",
    included: "LEGACY — mix/place bagged premix per m³ (superseded by h/bag key)",
    excluded: "Hole digging, post setting, plant, bulk excavation",
    confidence: "starter",
    crewMethod: "Legacy h/m³ — not consumed as h/bag authority",
    plantAssumption: "None",
    rationale:
      "Legacy starter retained for catalogue identity only. Mature path uses retaining_wall.post_hole_concrete.place.hours_per_bag.",
  },
  [RW_PRODUCTIVITY_KEYS.postHoleConcreteBag]: {
    hoursPerUnit: 0.035,
    unit: "bag",
    included: "Mix/place/consolidate one bag of premix into post holes after posts set",
    excluded: "Hole digging, post setting, plant, bulk excavation",
    confidence: "starter",
    crewMethod: "1 person mixing and placing bagged premix",
    plantAssumption: "None",
    rationale:
      "LOW-CONFIDENCE QUOTR STARTER. Dimensional conversion of prior 3.5 labour-h/m³ × 0.01 m³/bag yield = 0.035 labour-h/bag. Company/Project exact overrides.",
  },
};

export const RW_TIMBER_PILE_HOURS_MANUAL = 1.8;
export const RW_TIMBER_EXCAVATION_HOURS_MANUAL_M3 = 1.6;

export function timber1DPileHours(method: RwTimberPilingMethod): number {
  return method === RW_TIMBER_PILING_METHOD_MANUAL
    ? RW_TIMBER_PILE_HOURS_MANUAL
    : RW_TIMBER_1D_PRODUCTIVITY_STARTERS[RW_PRODUCTIVITY_KEYS.timberPilesEa]!
        .hoursPerUnit;
}

export function timber1DExcavationHoursM3(method: RwTimberPilingMethod): number {
  return retainingWallExcavationHoursStarter(method);
}

export function timber1DExcavationProductivityKey(
  method: RwTimberPilingMethod
): string {
  return retainingWallExcavationProductivityKey(method);
}

const stockMaterialStarters: Record<
  string,
  { costPerUnit: number; unit: string; identity: string; rationale: string }
> = Object.fromEntries(
  RW_H5_SED_STOCK_LENGTHS_M.map((lengthM) => {
    const key = rwH5SedStockItemKey(lengthM);
    const starter = RW_H5_SED_150_175_STOCK_STARTERS[lengthM];
    return [
      key,
      {
        costPerUnit: starter.costEachExGst,
        unit: "ea",
        identity: `H5 SED 150–175 mm × ${lengthM} m stock pole`,
        rationale: starter.rationale,
      },
    ];
  })
);

export const RW_TIMBER_1D_MATERIAL_STARTERS: Record<
  string,
  { costPerUnit: number; unit: string; identity: string; rationale: string }
> = {
  [RW_FACE_BOARD_150_H4_KEY]: {
    costPerUnit: 12.8,
    unit: "lm",
    identity: "150×50 H4 No.2 / retaining-grade face board (not SG8)",
    rationale:
      "2025/26 NZ merchant band for H4 No.2 / retaining RS 150×50, ex GST. Not an SG8 structural rate.",
  },
  [RW_FACE_BOARD_200_H4_KEY]: {
    costPerUnit: 17.4,
    unit: "lm",
    identity: "200×50 H4 No.2 / retaining-grade face board (not SG8)",
    rationale:
      "2025/26 NZ merchant band for H4 No.2 / retaining RS 200×50, ex GST. Not an SG8 structural rate.",
  },
  [RW_H5_SED_POLE_KEY]: {
    costPerUnit: 0,
    unit: "lm",
    identity: "H5 SED generic $/lm — leftover, not a commercial identity",
    rationale:
      "Generic $/lm must not price all SED classes. Purchase is stock-length EA.",
  },
  [RW_NOVACOIL_KEY]: {
    costPerUnit: 8.5,
    unit: "lm",
    identity: "100 mm punched / slotted drainage coil (novacoil)",
    rationale: "2025/26 merchant band for 100 mm punched/slotted drain coil, ex GST.",
  },
  [RW_HOUSE_PILE_125_KEY]: {
    costPerUnit: HOUSE_PILE_BENCHMARK_COST_EX_GST,
    unit: "lm",
    identity: "125×125 H5 sawn house pile — retaining post alternative",
    rationale:
      "Reuses Deck house-pile Quotr starter $/lm. Purchase is stock-length lm, not required lm.",
  },
  [RW_DRAINAGE_SOCK_KEY]: {
    costPerUnit: RW_DRAINAGE_SOCK_STARTER_COST_PER_LM,
    unit: "lm",
    identity: "Drainage coil filter sock",
    rationale:
      "LOW-CONFIDENCE Quotr starter for filter sock $/lm when builder selects sock Yes.",
  },
  [RW_DRAINAGE_AGGREGATE_KEY]: {
    costPerUnit: 72,
    unit: "m3",
    identity: "Drainage aggregate / drainage metal (purchased m³)",
    rationale:
      "2025/26 GAP/drainage metal builder-buy band, ex GST, applied to purchase m³ after the 1.25 assumption.",
  },
  ...stockMaterialStarters,
};

export function timber1DMaterialStarter(
  itemKey: string | null | undefined
): { costPerUnit: number; unit: string } | null {
  if (!itemKey) return null;
  const row = RW_TIMBER_1D_MATERIAL_STARTERS[itemKey];
  if (!row || row.costPerUnit <= 0) return null;
  return { costPerUnit: row.costPerUnit, unit: row.unit };
}

export function timber1DProductivityStarter(
  productivityKey: string
): { hoursPerUnit: number; unit: string } | null {
  const row = RW_TIMBER_1D_PRODUCTIVITY_STARTERS[productivityKey];
  return row
    ? { hoursPerUnit: row.hoursPerUnit, unit: row.unit }
    : null;
}

export function drainageAggregatePurchaseM3(inPlaceM3: number): number {
  return Math.round(inPlaceM3 * RW_DRAINAGE_AGGREGATE_PROCUREMENT_FACTOR * 100) /
    100;
}

export function detailedTimberLabourFromCost(
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

export const RW_TIMBER_1D_ACCESS_RULE = {
  appliesTo: [
    "excavation",
    "piling",
    "face_boards",
    "drainage",
    "backfill",
  ] as const,
  method: "PER_INTENT_PROJECT_CONDITION_MODIFIERS" as const,
  excavationIncludesMaterialCarry: false,
  inwardMaterialIncludesCarry: true,
  note:
    "Site access may adjust excavation, piling, face, drainage, and backfill. Material carry adjusts inward-material intents only (piles, boards, novacoil, aggregate/backfill). Bulk excavation does not inherit material carry. Spoil/export uses waste/spoil/carting facts, not material_carry_distance. Not a second retaining-wall labour line. Plant feasibility is a separate access test.",
};

export const RW_TIMBER_1D_REQUIRED_MATERIAL_CATEGORIES = [
  "face_boards",
  "sed_piles_stock",
  "novacoil_if_drainage",
  "drainage_aggregate_if_backfill",
  "residual_fixings",
] as const;

export const RW_TIMBER_1D_REQUIRED_LABOUR_CATEGORIES = [
  "pile_installation",
  "face_board_installation",
  "drainage_installation_if_drainage",
  "drainage_backfill_if_backfill",
  "bulk_excavation_if_required_and_covered",
] as const;

