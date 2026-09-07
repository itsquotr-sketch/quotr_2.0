/**
 * WA-BATHROOM-03 — physical requirement and rate identities.
 *
 * Sheet identities are shared `sheet.*` catalogue keys where physically identical.
 * Bathroom H1.2 framing must not reuse Deck H3.2 90×45.
 */

export const BATHROOM_SHEET_LENGTH_M = 2.4;
export const BATHROOM_SHEET_WIDTH_M = 1.2;
export const BATHROOM_SHEET_AREA_M2 = 2.88;
export const BATHROOM_SHEET_WASTE_FACTOR = 0.1;

export const BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY =
  "sheet.plywood.19mm.h3.2.each" as const;
export const BATHROOM_FLOOR_SUBSTRATE_FIBRE_CEMENT_KEY =
  "sheet.fibre_cement.18mm.2400x1200.each" as const;
export const BATHROOM_AQUALINE_SHEET_KEY =
  "sheet.plasterboard.aqualine.each" as const;
export const BATHROOM_FRAMING_TIMBER_KEY =
  "bathroom.framing.90x45.h1.2.lm" as const;

export const BATHROOM_FLOOR_SUBSTRATE_COMPONENT =
  "bathroom.floor_substrate" as const;
export const BATHROOM_WALL_LINING_COMPONENT =
  "bathroom.lining.wall" as const;
export const BATHROOM_CEILING_LINING_COMPONENT =
  "bathroom.lining.ceiling" as const;
export const BATHROOM_FRAMING_COMPONENT = "bathroom.framing" as const;

export const BATHROOM_FLOOR_SUBSTRATE_LABOUR_COMPONENT =
  "bathroom.floor_substrate.install" as const;
export const BATHROOM_WALL_LINING_LABOUR_COMPONENT =
  "bathroom.lining.wall.install" as const;
export const BATHROOM_CEILING_LINING_LABOUR_COMPONENT =
  "bathroom.lining.ceiling.install" as const;
export const BATHROOM_FRAMING_LABOUR_COMPONENT =
  "bathroom.framing.install" as const;

export const BATHROOM_PRODUCTIVITY_KEYS = {
  floorSubstrateM2: "bathroom.floor_substrate.install.hours_per_m2",
  wallLiningM2: "bathroom.lining.wall.install.hours_per_m2",
  ceilingLiningM2: "bathroom.lining.ceiling.install.hours_per_m2",
  framingLm: "bathroom.framing.install.hours_per_lm",
} as const;

export const BATHROOM_PRODUCTIVITY_BENCHMARKS = {
  floorSubstrateM2: 0.4,
  wallLiningM2: 0.3,
  ceilingLiningM2: 0.4,
  framingLm: 0.2,
} as const;

export const BATHROOM_FRAMING_INTENSITY_LM_PER_M2 = {
  none: 0,
  minor: 0.2,
  standard: 0.5,
  major: 1,
} as const;

export const BATHROOM_PLYWOOD_LABEL = "19 mm H3.2 treated plywood";
export const BATHROOM_FIBRE_CEMENT_LABEL = "18 mm fibre cement sheet";
export const BATHROOM_AQUALINE_LABEL = "13 mm GIB Aqualine";
export const BATHROOM_FRAMING_TIMBER_LABEL = "90 × 45 H1.2 radiata pine";

export const BATHROOM_PLYWOOD_ASSUMPTION =
  "Quotr has allowed for 19 mm H3.2 treated plywood.";
export const BATHROOM_AQUALINE_WALL_ASSUMPTION =
  "Quotr has allowed for 13 mm GIB Aqualine wall lining.";
export const BATHROOM_AQUALINE_CEILING_ASSUMPTION =
  "Quotr has allowed for 13 mm GIB Aqualine ceiling lining.";
export const BATHROOM_FRAMING_REQUIRED_MESSAGE =
  "How much local framing or nogging is required?";
export const BATHROOM_SHEET_WASTE_STATEMENT =
  "10% sheet waste included.";
export const BATHROOM_CEILING_NESTED_STATEMENT =
  "Bathroom ceiling lining is included in Bathroom, not in Ceilings, unless a Ceilings Work Area is added for this room.";
