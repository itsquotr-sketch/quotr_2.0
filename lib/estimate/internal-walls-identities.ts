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
export const INTERNAL_WALLS_STEEL_TRACK_KEY = "steel.framing.track.lm" as const;
export const INTERNAL_WALLS_STEEL_STUD_KEY = "steel.framing.stud.lm" as const;
export const INTERNAL_WALLS_FRAMING_STEEL_TRACK_COMPONENT =
  "internal_walls.framing.steel.track.material" as const;
export const INTERNAL_WALLS_FRAMING_STEEL_STUD_COMPONENT =
  "internal_walls.framing.steel.stud.material" as const;
export const INTERNAL_WALLS_FRAMING_STEEL_LABOUR_COMPONENT =
  "internal_walls.framing.steel.track_and_stud.install" as const;
/** Unsupported steel systems only — not standard track-and-stud. */
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

/** Future Company DNA task — not calibrated in IW-04. */
export const INTERNAL_WALLS_FRAMING_STEEL_HOURS_PER_M2_KEY =
  "internal_walls.framing.steel.track_and_stud.hours_per_m2" as const;

export const INTERNAL_WALLS_PRODUCTIVITY_KEYS = {
  timber90M2: INTERNAL_WALLS_FRAMING_90_HOURS_PER_M2_KEY,
  timber140M2: INTERNAL_WALLS_FRAMING_140_HOURS_PER_M2_KEY,
  steelTrackAndStudM2: INTERNAL_WALLS_FRAMING_STEEL_HOURS_PER_M2_KEY,
} as const;

export const INTERNAL_WALLS_PRODUCTIVITY_BENCHMARKS = {
  timber90M2: 0.45,
  timber140M2: 0.5,
  steelTrackAndStudM2: 0.4,
} as const;

export const INTERNAL_WALLS_FRAMING_WASTE_CATEGORY = "timber_framing" as const;

/**
 * No canonical steel-framing waste category exists (timber_framing is timber-only;
 * default 10% is generic material waste, not approved steel framing waste).
 * V1 purchase lm = raw lm. Do not invent a percent.
 */
export const INTERNAL_WALLS_STEEL_WASTE_FACTOR = 0 as const;

export const INTERNAL_WALLS_STUD_CENTRES_REQUIRED_MESSAGE =
  "Add a stud spacing for this wall type.";

export const INTERNAL_WALLS_STEEL_FRAMING_NOT_PRICED_MESSAGE =
  "This steel framing system is not priced yet.";

export const INTERNAL_WALLS_OTHER_FRAMING_NOT_PRICED_MESSAGE =
  "This framing type needs a price before it can be estimated.";

export const INTERNAL_WALLS_OTHER_TIMBER_SIZE_MESSAGE =
  "This timber size needs a rate.";

export const INTERNAL_WALLS_LINING_NOT_PRICED_STATEMENT =
  "Lining materials and labour are not priced yet.";

export const INTERNAL_WALLS_SHEET_TOO_SHORT_MESSAGE =
  "Selected sheet length does not span the wall height." as const;

export const INTERNAL_WALLS_PLYWOOD_LINING_GAP_MESSAGE =
  "No canonical wall-lining plywood identity." as const;

export const INTERNAL_WALLS_FIBRE_CEMENT_LINING_GAP_MESSAGE =
  "No canonical wall-lining fibre-cement identity." as const;

export const INTERNAL_WALLS_LINING_CUSTOM_MESSAGE =
  "This lining product needs a price before it can be estimated." as const;

export const INTERNAL_WALLS_LINING_THICKNESS_UNSUPPORTED_MESSAGE =
  "This lining thickness is not a validated combination for the selected product." as const;

export const INTERNAL_WALLS_LINING_LABOUR_OWNER_REQUIRED_MESSAGE =
  "Lining labour Pricing Required — no owner-approved hours/sheet." as const;

export const INTERNAL_WALLS_LINING_GROSS_SHEET_ASSUMPTION =
  "Lining sheet count stays on the full-height sheet run. Known openings are deducted from net lined area only." as const;

export const INTERNAL_WALLS_OPENING_FRAMING_90_MATERIAL_COMPONENT =
  "internal_walls.opening.framing.timber.90x45.material" as const;
export const INTERNAL_WALLS_OPENING_FRAMING_140_MATERIAL_COMPONENT =
  "internal_walls.opening.framing.timber.140x45.material" as const;
export const INTERNAL_WALLS_OPENING_FRAMING_OTHER_TIMBER_MATERIAL_COMPONENT =
  "internal_walls.opening.framing.timber.other.material" as const;
export const INTERNAL_WALLS_OPENING_FRAMING_STEEL_TRACK_COMPONENT =
  "internal_walls.opening.framing.steel.track.material" as const;
export const INTERNAL_WALLS_OPENING_FRAMING_STEEL_STUD_COMPONENT =
  "internal_walls.opening.framing.steel.stud.material" as const;
export const INTERNAL_WALLS_OPENING_FRAMING_STEEL_COMPONENT =
  "internal_walls.opening.framing.steel" as const;
export const INTERNAL_WALLS_OPENING_FORM_LABOUR_COMPONENT =
  "internal_walls.opening.form.labour" as const;
export const INTERNAL_WALLS_OPENING_LINING_MAKE_GOOD_COMPONENT =
  "internal_walls.opening.lining.make_good" as const;

/** Future Company DNA tasks — no owner-approved hours/sheet in IW-05. */
export const INTERNAL_WALLS_LINING_PRODUCTIVITY_KEYS = {
  standard_gib: "internal_walls.lining.standard_gib.hours_per_sheet",
  aqualine: "internal_walls.lining.aqualine.hours_per_sheet",
  fyreline: "internal_walls.lining.fyreline.hours_per_sheet",
  braceline: "internal_walls.lining.braceline.hours_per_sheet",
  noiseline: "internal_walls.lining.noiseline.hours_per_sheet",
  weatherline: "internal_walls.lining.weatherline.hours_per_sheet",
  barrierline: "internal_walls.lining.barrierline.hours_per_sheet",
  plywood: "internal_walls.lining.plywood.hours_per_sheet",
  fibre_cement: "internal_walls.lining.fibre_cement.hours_per_sheet",
  other: "internal_walls.lining.other.hours_per_sheet",
} as const;

export const INTERNAL_WALLS_LINING_WASTE_CATEGORY = "sheet_material" as const;

export const INTERNAL_WALLS_PLASTERBOARD_SHEET_WIDTH_MM = 1200 as const;

export const INTERNAL_WALLS_STANDARD_13_2400_KEY =
  "sheet.plasterboard.standard.each" as const;
export const INTERNAL_WALLS_AQUALINE_13_2400_KEY =
  "sheet.plasterboard.aqualine.each" as const;
export const INTERNAL_WALLS_FYRELINE_13_2400_KEY =
  "sheet.plasterboard.fyreline.each" as const;
export const INTERNAL_WALLS_BRACELINE_13_2400_KEY =
  "sheet.plasterboard.braceline.each" as const;

export function internalWallsLiningMaterialComponent(
  product: string
): string {
  return `internal_walls.lining.${product}.material`;
}

export function internalWallsLiningLabourComponent(product: string): string {
  return `internal_walls.lining.${product}.install`;
}

export function internalWallsLiningOverlapGroup(wallTypeId: string): string {
  return `internal_walls.lining:${wallTypeId}`;
}

export function isInternalWallsLiningComponentKey(
  key: string | null | undefined
): boolean {
  if (!key) return false;
  return key.startsWith("internal_walls.lining.") &&
    (key.endsWith(".material") || key.endsWith(".install"));
}

export const INTERNAL_WALLS_FRAMING_COMPONENT_KEYS = [
  INTERNAL_WALLS_FRAMING_90_MATERIAL_COMPONENT,
  INTERNAL_WALLS_FRAMING_140_MATERIAL_COMPONENT,
  INTERNAL_WALLS_FRAMING_OTHER_TIMBER_MATERIAL_COMPONENT,
  INTERNAL_WALLS_FRAMING_90_LABOUR_COMPONENT,
  INTERNAL_WALLS_FRAMING_140_LABOUR_COMPONENT,
  INTERNAL_WALLS_FRAMING_FIXINGS_COMPONENT,
  INTERNAL_WALLS_FRAMING_STEEL_TRACK_COMPONENT,
  INTERNAL_WALLS_FRAMING_STEEL_STUD_COMPONENT,
  INTERNAL_WALLS_FRAMING_STEEL_LABOUR_COMPONENT,
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

export const INTERNAL_WALLS_OPENING_FRAMING_COMPONENT_KEYS = [
  INTERNAL_WALLS_OPENING_FRAMING_90_MATERIAL_COMPONENT,
  INTERNAL_WALLS_OPENING_FRAMING_140_MATERIAL_COMPONENT,
  INTERNAL_WALLS_OPENING_FRAMING_OTHER_TIMBER_MATERIAL_COMPONENT,
  INTERNAL_WALLS_OPENING_FRAMING_STEEL_TRACK_COMPONENT,
  INTERNAL_WALLS_OPENING_FRAMING_STEEL_STUD_COMPONENT,
  INTERNAL_WALLS_OPENING_FRAMING_STEEL_COMPONENT,
  INTERNAL_WALLS_OPENING_FORM_LABOUR_COMPONENT,
  INTERNAL_WALLS_OPENING_LINING_MAKE_GOOD_COMPONENT,
] as const;

export function internalWallsOpeningFramingOverlapGroup(
  wallTypeId: string,
  openingId: string
): string {
  return `internal_walls.opening.framing:${wallTypeId}:${openingId}`;
}

export function isInternalWallsOpeningComponentKey(
  key: string | null | undefined
): boolean {
  if (!key) return false;
  return (
    INTERNAL_WALLS_OPENING_FRAMING_COMPONENT_KEYS as readonly string[]
  ).includes(key);
}

export function looksLikeDoorProductMoney(params: {
  label?: string | null;
  componentKey?: string | null;
  itemKey?: string | null;
}): boolean {
  const hay = [
    params.label ?? "",
    params.componentKey ?? "",
    params.itemKey ?? "",
  ]
    .join(" ")
    .toLowerCase();
  if (!hay.trim()) return false;
  if (hay.includes("door leaf / hardware")) return false;
  if (hay.includes("door opening")) return false;
  return (
    /door leaf/.test(hay) ||
    /door jamb/.test(hay) ||
    /door frame/.test(hay) ||
    /door hardware/.test(hay) ||
    /door install/.test(hay) ||
    /doors\.count/.test(hay) ||
    /doors\.package/.test(hay) ||
    /generic door allowance/.test(hay)
  );
}
