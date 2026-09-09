/**
 * WA-INTERNAL-WALLS-03 — timber framing requirement and shared material identities.
 *
 * Physical timber keys stay shared (`timber.framing.*`). Requirement component
 * keys may be Work-Area-specific. Do not create `internal_walls.90x45...`.
 *
 * Productivity keys below are owner-approved Quotr benchmarks and likely
 * future Company DNA tasks. IW-03 does not add calibration catalogue rows.
 */

export const INTERNAL_WALLS_TIMBER_90_KEY =
  "timber.framing.90x45.h1.2.lm" as const;
export const INTERNAL_WALLS_TIMBER_140_KEY =
  "timber.framing.140x45.h1.2.lm" as const;

export const INTERNAL_WALLS_TIMBER_90_LABEL = "90 × 45 H1.2 timber" as const;
export const INTERNAL_WALLS_TIMBER_140_LABEL = "140 × 45 H1.2 timber" as const;

export const INTERNAL_WALLS_FRAMING_90_MATERIAL_COMPONENT =
  "internal_walls.framing.timber.90x45.material" as const;
export const INTERNAL_WALLS_FRAMING_140_MATERIAL_COMPONENT =
  "internal_walls.framing.timber.140x45.material" as const;
export const INTERNAL_WALLS_FRAMING_OTHER_TIMBER_MATERIAL_COMPONENT =
  "internal_walls.framing.timber.other.material" as const;
export const INTERNAL_WALLS_FRAMING_90_LABOUR_COMPONENT =
  "internal_walls.framing.timber.90x45.install" as const;
export const INTERNAL_WALLS_FRAMING_140_LABOUR_COMPONENT =
  "internal_walls.framing.timber.140x45.install" as const;
export const INTERNAL_WALLS_FRAMING_FIXINGS_COMPONENT =
  "internal_walls.framing.fixings.allowance" as const;
export const INTERNAL_WALLS_FRAMING_STEEL_COMPONENT =
  "internal_walls.framing.steel" as const;
export const INTERNAL_WALLS_FRAMING_OTHER_COMPONENT =
  "internal_walls.framing.other" as const;

export const INTERNAL_WALLS_CARPENTER_LABOUR_KEY = "labour.carpenter.hour" as const;

/** Future Company DNA task — not calibrated in IW-03. */
export const INTERNAL_WALLS_FRAMING_90_HOURS_PER_M2_KEY =
  "internal_walls.framing.timber.90x45.hours_per_m2" as const;
/** Future Company DNA task — not calibrated in IW-03. */
export const INTERNAL_WALLS_FRAMING_140_HOURS_PER_M2_KEY =
  "internal_walls.framing.timber.140x45.hours_per_m2" as const;

export const INTERNAL_WALLS_PRODUCTIVITY_KEYS = {
  timber90M2: INTERNAL_WALLS_FRAMING_90_HOURS_PER_M2_KEY,
  timber140M2: INTERNAL_WALLS_FRAMING_140_HOURS_PER_M2_KEY,
} as const;

export const INTERNAL_WALLS_PRODUCTIVITY_BENCHMARKS = {
  timber90M2: 0.45,
  timber140M2: 0.5,
} as const;

export const INTERNAL_WALLS_FRAMING_WASTE_CATEGORY = "timber_framing" as const;

export const INTERNAL_WALLS_STUD_CENTRES_REQUIRED_MESSAGE =
  "Add a stud spacing for this wall type.";

export const INTERNAL_WALLS_STEEL_FRAMING_NOT_PRICED_MESSAGE =
  "Steel framing takeoff is not priced yet.";

export const INTERNAL_WALLS_OTHER_FRAMING_NOT_PRICED_MESSAGE =
  "This framing type needs a price before it can be estimated.";

export const INTERNAL_WALLS_OTHER_TIMBER_SIZE_MESSAGE =
  "This timber size needs a rate.";

export const INTERNAL_WALLS_LINING_NOT_PRICED_STATEMENT =
  "Lining materials and labour are not priced yet.";

export const INTERNAL_WALLS_FRAMING_COMPONENT_KEYS = [
  INTERNAL_WALLS_FRAMING_90_MATERIAL_COMPONENT,
  INTERNAL_WALLS_FRAMING_140_MATERIAL_COMPONENT,
  INTERNAL_WALLS_FRAMING_OTHER_TIMBER_MATERIAL_COMPONENT,
  INTERNAL_WALLS_FRAMING_90_LABOUR_COMPONENT,
  INTERNAL_WALLS_FRAMING_140_LABOUR_COMPONENT,
  INTERNAL_WALLS_FRAMING_FIXINGS_COMPONENT,
  INTERNAL_WALLS_FRAMING_STEEL_COMPONENT,
  INTERNAL_WALLS_FRAMING_OTHER_COMPONENT,
] as const;

export function internalWallsFramingOverlapGroup(wallTypeId: string): string {
  return `internal_walls.framing:${wallTypeId}`;
}

export function isInternalWallsFramingComponentKey(key: string | null | undefined): boolean {
  if (!key) return false;
  return (INTERNAL_WALLS_FRAMING_COMPONENT_KEYS as readonly string[]).includes(key);
}
