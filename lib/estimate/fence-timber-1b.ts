/**
 * FENCE-MATURITY-1B — Timber fence commercial constants.
 * Physical quantities remain 1A. This file owns starter rates, productivity
 * units, access rules, and fixings basis for vertical paling + horizontal slats.
 *
 * Modular (metal/plastic) is not commercially matured here.
 */

import { RW_PREMIX_20KG_KEY } from "@/lib/estimate/retaining-wall-identities";
import {
  FENCE_GATE_HARDWARE_KEY,
  FENCE_PREMIX_20KG_KEY,
  FENCE_TIMBER_FIXINGS_COST_BASIS,
  fenceBoardMaterialKey,
  fenceCappingMaterialKey,
  fenceGateFrameMaterialKey,
  fencePostMaterialKey,
  fenceRailMaterialKey,
} from "@/lib/estimate/fence-identities";
import { FENCE_PRODUCTIVITY_KEYS } from "@/lib/estimate/fence-productivity";
import type { FenceTimberSpecies } from "@/lib/estimate/fence-systems";

export const FENCE_TIMBER_1B_AUTHORITY = "DETAILED_COMPONENT_AUTHORITY" as const;
export const FENCE_TIMBER_1B_PACKAGE = "LEGACY_PACKAGE_AUTHORITY" as const;

export const FENCE_TIMBER_FIXINGS_PERCENT = 0.08;
export const FENCE_TIMBER_FIXINGS_METHOD = FENCE_TIMBER_FIXINGS_COST_BASIS;

export const FENCE_POST_PROCUREMENT_DECISION =
  "PRICE_SMALLEST_STOCK_LENGTH_COVERING_REQUIRED_LENGTH";

export const FENCE_POST_PROCUREMENT_NOTE =
  "Fence posts are priced as purchased stock length × count, $/lm of H4 100×100. Required length is height + embedment. Purchase is the smallest stock length that covers required length (Quotr ladder 1.8 / 2.1 / 2.4 / 2.7 / 3.0 / 3.6 m unless company stock SKUs exist). Physical EA count is preserved.";

export const FENCE_CAPPING_SECTION_DEFAULT = "65x40";
export const FENCE_CAPPING_SECTION_DISCLOSURE =
  "Top capping estimating identity is 65×40 mm, species matching the visible fence timber unless overridden. Not a structural claim.";

export const FENCE_GATE_FRAME_SECTION_DEFAULT = "75x50";
export const FENCE_GATE_FRAME_DISCLOSURE =
  "Timber gate frame uses treated H4 75×50 (same family as fence rails). Frame timber is not hidden inside gate hardware.";

export const FENCE_GATE_LABOUR_OWNERSHIP_1B =
  "One labour-h/gate requirement owns frame assembly, hanging, hinges, latch alignment, and gate-specific adjustment. Gate-face boards remain in the paling/slat material and board-install labour quantities. Do not add a second fabrication labour line.";

export const FENCE_VERTICAL_BOARD_LABOUR_UNIT = "lm" as const;
export const FENCE_HORIZONTAL_SLAT_LABOUR_UNIT = "lm" as const;
export const FENCE_RAIL_LABOUR_UNIT = "lm" as const;

export const FENCE_VERTICAL_BOARD_LABOUR_DECISION =
  "labour-h per required board lm (not gross face m²). Installer effort follows board count and length; paling gap must change labour.";

export const FENCE_HORIZONTAL_SLAT_LABOUR_DECISION =
  "labour-h per required slat lm (not gross face m²). Course/gap changes must change labour.";

export const FENCE_RAIL_LABOUR_DECISION =
  "labour-h per required rail lm (not fence lm). Reacts to 2 vs 3 rails at the 1.5 m height threshold.";

export const FENCE_LABOUR_RATE_PATH =
  "Project exact → Company exact labour.carpenter.hour → labour.general.hour → Quotr carpenter 60/90. No second Fence labour $/h.";

export const FENCE_TIMBER_1B_ACCESS_RULE = {
  method: "PER_INTENT_PROJECT_CONDITION_MODIFIERS" as const,
  siteAccessKeys: ["site_access"] as const,
  carryKey: "material_carry_distance" as const,
  inwardMaterialIncludesCarry: true,
  concretePlacementIncludesCarry: false,
  note:
    "Site access may adjust posts, rails, boards/slats, capping, and gate. Abnormal material carry adjusts those inward-timber intents once each. Post-hole concrete placement gets site access only — bag handling at the workface is in the labour-h/bag baseline. Do not blanket-multiply total Fence labour. Do not add a second post-carry labour line.",
};

export type FenceTimber1BStarter = {
  costPerUnit: number;
  unit: string;
  identity: string;
  confidence: "low" | "medium";
  basis: string;
};

/** LOW-CONFIDENCE Quotr starters. Not tuned to an owner fixture total. */
export const FENCE_TIMBER_1B_MATERIAL_STARTERS: Record<string, FenceTimber1BStarter> = {
  [fencePostMaterialKey()]: {
    costPerUnit: 12,
    unit: "lm",
    identity: "Treated H4 100×100 timber fence post",
    confidence: "low",
    basis:
      "LOW-CONFIDENCE Quotr starter $/lm for H4 100×100 fence post (not H5 SED / house pile). NZ merchant band, ex GST. Company/Project exact overrides.",
  },
  [fenceRailMaterialKey("75x50")]: {
    costPerUnit: 6,
    unit: "lm",
    identity: "Treated H4 75×50 timber fence rail",
    confidence: "low",
    basis: "LOW-CONFIDENCE Quotr starter $/lm for H4 75×50 rail. Company/Project exact overrides.",
  },
  [fenceRailMaterialKey("100x50")]: {
    costPerUnit: 8,
    unit: "lm",
    identity: "Treated H4 100×50 timber fence rail",
    confidence: "low",
    basis: "LOW-CONFIDENCE Quotr starter $/lm for H4 100×50 rail. Company/Project exact overrides.",
  },
  [fenceRailMaterialKey("75x40")]: {
    costPerUnit: 5.5,
    unit: "lm",
    identity: "Treated H4 75×40 timber fence rail",
    confidence: "low",
    basis: "LOW-CONFIDENCE Quotr starter $/lm for H4 75×40 rail. Company/Project exact overrides.",
  },
  [fenceBoardMaterialKey("radiata_pine", 19)]: {
    costPerUnit: 3.2,
    unit: "lm",
    identity: "Radiata Pine 150×19 fence board/paling",
    confidence: "low",
    basis: "LOW-CONFIDENCE Quotr starter $/lm. Not a universal timber rate.",
  },
  [fenceBoardMaterialKey("radiata_pine", 25)]: {
    costPerUnit: 4.5,
    unit: "lm",
    identity: "Radiata Pine 150×25 fence board/paling",
    confidence: "low",
    basis: "LOW-CONFIDENCE Quotr starter $/lm.",
  },
  [fenceBoardMaterialKey("macrocarpa", 19)]: {
    costPerUnit: 5.5,
    unit: "lm",
    identity: "Macrocarpa 150×19 fence board/paling",
    confidence: "low",
    basis: "LOW-CONFIDENCE Quotr starter $/lm. Distinct from Radiata.",
  },
  [fenceBoardMaterialKey("macrocarpa", 25)]: {
    costPerUnit: 7.5,
    unit: "lm",
    identity: "Macrocarpa 150×25 fence board/paling",
    confidence: "low",
    basis: "LOW-CONFIDENCE Quotr starter $/lm.",
  },
  [fenceBoardMaterialKey("cedar", 19)]: {
    costPerUnit: 8,
    unit: "lm",
    identity: "Cedar 150×19 fence board/paling",
    confidence: "low",
    basis: "LOW-CONFIDENCE Quotr starter $/lm. Distinct from Radiata/Macrocarpa.",
  },
  [fenceBoardMaterialKey("cedar", 25)]: {
    costPerUnit: 11,
    unit: "lm",
    identity: "Cedar 150×25 fence board/paling",
    confidence: "low",
    basis: "LOW-CONFIDENCE Quotr starter $/lm.",
  },
  [fenceBoardMaterialKey("hardwood", 19)]: {
    costPerUnit: 7,
    unit: "lm",
    identity: "Hardwood 150×19 fence board (generic)",
    confidence: "low",
    basis:
      "LOW-CONFIDENCE GENERIC hardwood starter. Does not pretend Kwila/Vitex/etc. cost the same. Company exact should replace this.",
  },
  [fenceBoardMaterialKey("hardwood", 25)]: {
    costPerUnit: 9.5,
    unit: "lm",
    identity: "Hardwood 150×25 fence board (generic)",
    confidence: "low",
    basis: "LOW-CONFIDENCE GENERIC hardwood starter. Not a species-specific rate.",
  },
  [fenceCappingMaterialKey("radiata_pine")]: {
    costPerUnit: 4,
    unit: "lm",
    identity: "Radiata Pine 65×40 fence capping",
    confidence: "low",
    basis: "LOW-CONFIDENCE Quotr starter $/lm for 65×40 capping. Not paling stock.",
  },
  [fenceCappingMaterialKey("macrocarpa")]: {
    costPerUnit: 6.5,
    unit: "lm",
    identity: "Macrocarpa 65×40 fence capping",
    confidence: "low",
    basis: "LOW-CONFIDENCE Quotr starter $/lm.",
  },
  [fenceCappingMaterialKey("cedar")]: {
    costPerUnit: 9,
    unit: "lm",
    identity: "Cedar 65×40 fence capping",
    confidence: "low",
    basis: "LOW-CONFIDENCE Quotr starter $/lm.",
  },
  [fenceCappingMaterialKey("hardwood")]: {
    costPerUnit: 8,
    unit: "lm",
    identity: "Hardwood 65×40 fence capping (generic)",
    confidence: "low",
    basis: "LOW-CONFIDENCE GENERIC hardwood capping starter.",
  },
  [fenceGateFrameMaterialKey()]: {
    costPerUnit: 6,
    unit: "lm",
    identity: "Treated H4 75×50 timber gate frame",
    confidence: "low",
    basis: "Same family as H4 75×50 rails. LOW-CONFIDENCE Quotr starter $/lm.",
  },
  [FENCE_GATE_HARDWARE_KEY]: {
    costPerUnit: 85,
    unit: "ea",
    identity: "Fence gate hardware set (hinges, latch/lock, gate fasteners)",
    confidence: "low",
    basis:
      "LOW-CONFIDENCE Quotr starter per gate. Not the legacy $450 package gate allowance. Ordinary fence fixings are separate.",
  },
  [FENCE_PREMIX_20KG_KEY]: {
    costPerUnit: 11.5,
    unit: "bag",
    identity: "20 kg bagged premix concrete",
    confidence: "low",
    basis:
      "Reuses the current RW sleeper 20 kg premix starter band (~$11.50/bag ex GST). Company/Project exact on fence.concrete.premix.20kg.bag or deck.concrete.premix.20kg.bag wins.",
  },
  [RW_PREMIX_20KG_KEY]: {
    costPerUnit: 11.5,
    unit: "bag",
    identity: "20 kg bagged premix concrete (shared commercial bag key)",
    confidence: "low",
    basis: "Alias of the shared deck.concrete.premix.20kg.bag commercial path.",
  },
};

export const FENCE_TIMBER_1B_PRODUCTIVITY_STARTERS: Record<
  string,
  { hoursPerUnit: number; unit: string; label: string; basis: string }
> = {
  [FENCE_PRODUCTIVITY_KEYS.postInstall]: {
    hoursPerUnit: 0.7,
    unit: "post",
    label: "Fence post installation",
    basis:
      "LOW-CONFIDENCE. 0.70 total person-hours per post for set-out, ordinary 300 mm hand hole, normal-soil/normal-access handling, set/plumb/brace. 42 person-minutes. 0.45 (27 min) was too aggressive for a general default that includes hole digging. Not elapsed crew time.",
  },
  [FENCE_PRODUCTIVITY_KEYS.railLm]: {
    hoursPerUnit: 0.08,
    unit: "lm",
    label: "Fence rail installation",
    basis:
      "LOW-CONFIDENCE. 0.08 labour-h per required rail lm. Replaces fence-lm framing so 2 vs 3 rails changes hours.",
  },
  [FENCE_PRODUCTIVITY_KEYS.verticalBoardsLm]: {
    hoursPerUnit: 0.05,
    unit: "lm",
    label: "Vertical paling installation",
    basis:
      "LOW-CONFIDENCE. 0.05 labour-h per required board lm. Gap/board-count changes hours. Not gross face m².",
  },
  [FENCE_PRODUCTIVITY_KEYS.horizontalSlatsLm]: {
    hoursPerUnit: 0.06,
    unit: "lm",
    label: "Horizontal timber slat installation",
    basis:
      "LOW-CONFIDENCE. 0.06 labour-h per required slat lm. Course count changes hours. Distinct from vertical paling.",
  },
  [FENCE_PRODUCTIVITY_KEYS.cappingLm]: {
    hoursPerUnit: 0.08,
    unit: "lm",
    label: "Fence capping installation",
    basis: "LOW-CONFIDENCE. 0.08 labour-h per installed capping lm.",
  },
  [FENCE_PRODUCTIVITY_KEYS.gateInstall]: {
    hoursPerUnit: 2,
    unit: "gate",
    label: "Timber gate fabrication & installation",
    basis:
      "LOW-CONFIDENCE. 2.0 labour-h/gate for frame assembly, hanging, hinges/latch and alignment. 1.5 was too aggressive for that combined scope. Face-board install stays on paling/slat labour. Not elapsed crew time.",
  },
  [FENCE_PRODUCTIVITY_KEYS.postHoleConcreteBag]: {
    hoursPerUnit: 0.06,
    unit: "bag",
    label: "Fence post-hole concrete placement",
    basis:
      "LOW-CONFIDENCE Fence-specific. 0.06 labour-h/bag (3.6 person-minutes) for mix and place at the workface. 0.035 (2.1 min) was too tight as a Fence field default. Not the RW R6 0.035 starter. Not h/m³ or h/hole.",
  },
};

export function timber1BMaterialStarter(
  itemKey: string | null | undefined
): { costPerUnit: number; unit: string } | null {
  if (!itemKey) return null;
  const row = FENCE_TIMBER_1B_MATERIAL_STARTERS[itemKey];
  if (!row || !(row.costPerUnit > 0)) return null;
  return { costPerUnit: row.costPerUnit, unit: row.unit };
}

export function timber1BProductivityStarter(
  productivityKey: string
): { hoursPerUnit: number; unit: string } | null {
  const row = FENCE_TIMBER_1B_PRODUCTIVITY_STARTERS[productivityKey];
  return row
    ? { hoursPerUnit: row.hoursPerUnit, unit: row.unit }
    : null;
}

export function fenceBoardSpeciesKeys(
  species: FenceTimberSpecies
): { board19: string; board25: string; capping: string } {
  return {
    board19: fenceBoardMaterialKey(species, 19),
    board25: fenceBoardMaterialKey(species, 25),
    capping: fenceCappingMaterialKey(species),
  };
}

export const FENCE_TIMBER_FIXINGS_BASE_COMPONENTS = [
  "fence.boards",
  "fence.rails",
  "fence.capping",
] as const;
