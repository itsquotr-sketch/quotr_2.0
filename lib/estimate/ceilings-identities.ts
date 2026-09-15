/**
 * CEILINGS WA-05A / WA-05B — labour operations and productivity identities.
 *
 * Physical material keys stay in the physical modules. Quotr V1
 * person-hours live in CEILINGS_QUOTR_PRODUCTIVITY_HOURS. Company DNA
 * still does not cover Ceilings.
 */

export const CEILINGS_TIMBER_FRAMING_LABOUR =
  "ceilings.timber_framing.install" as const;
export const CEILINGS_STEEL_PERIMETER_LABOUR =
  "ceilings.steel.perimeter_track.install" as const;
export const CEILINGS_STEEL_PRIMARY_LABOUR =
  "ceilings.steel.primary_channel.install" as const;
export const CEILINGS_STEEL_FURRING_LABOUR =
  "ceilings.steel.furring_channel.install" as const;
export const CEILINGS_STEEL_CLIP_LABOUR =
  "ceilings.steel.crossover_clip.install" as const;
export const CEILINGS_STEEL_DROPPER_LABOUR =
  "ceilings.steel.dropper.install" as const;
export const CEILINGS_PLASTERBOARD_LABOUR =
  "ceilings.plasterboard.install" as const;
export const CEILINGS_PLYWOOD_LABOUR = "ceilings.plywood.install" as const;
export const CEILINGS_TIMBER_LINING_LABOUR =
  "ceilings.timber_lining.install" as const;
export const CEILINGS_GRID_LABOUR = "ceilings.grid.install" as const;
export const CEILINGS_TILE_LABOUR = "ceilings.tile.install" as const;
export const CEILINGS_BULKHEAD_FRAMING_TIMBER_LABOUR =
  "ceilings.bulkhead.framing.timber.install" as const;
export const CEILINGS_BULKHEAD_FRAMING_STEEL_LABOUR =
  "ceilings.bulkhead.framing.steel.install" as const;
export const CEILINGS_BULKHEAD_LINING_LABOUR =
  "ceilings.bulkhead.lining.install" as const;
export const CEILINGS_INSULATION_LABOUR =
  "ceilings.insulation.install" as const;
export const CEILINGS_SPECIALIST_COMPONENT =
  "ceilings.specialist.unsupported" as const;
export const CEILINGS_STOPPING_COMPONENT =
  "ceilings.finish.stopping" as const;
export const CEILINGS_PAINTING_COMPONENT =
  "ceilings.finish.painting" as const;
export const CEILINGS_PAINTING_LABOUR =
  "ceilings.finish.painting.install" as const;
export const CEILINGS_STOPPING_MATERIAL_KEY =
  "stopping.plasterboard.level4.m2" as const;
/** Canonical Painting WA material COST / m². Materials only — not S&A. */
export const CEILINGS_PAINTING_MATERIAL_KEY =
  "painting.material.m2" as const;
/** Legacy Ceiling-only emit key. Resolves as alias of the canonical material. */
export const CEILINGS_PAINTING_MATERIAL_LEGACY_ALIAS =
  "ceilings.painting.m2" as const;
export const PAINTING_LABOUR_HOURS_PER_M2_KEY =
  "painting.labour_hours_per_m2" as const;
/** Owner-approved Quotr V1 painting application productivity. */
export const PAINTING_LABOUR_HOURS_PER_M2 = 0.12;
export const CEILINGS_STOPPING_LEVEL_ASSUMPTION =
  "Assumes Level 4 stopping on plasterboard lining surfaces." as const;

export const CEILINGS_PRODUCTIVITY_KEYS = {
  timberFramingLm: "ceilings.timber_framing.install.hours_per_lm",
  perimeterLm: "ceilings.steel.perimeter_track.install.hours_per_lm",
  primaryLm: "ceilings.steel.primary_channel.install.hours_per_lm",
  furringLm: "ceilings.steel.furring_channel.install.hours_per_lm",
  clipEach: "ceilings.steel.crossover_clip.install.hours_per_each",
  dropperEach: "ceilings.steel.dropper.install.hours_per_each",
  plasterboardSheet: "ceilings.plasterboard.install.hours_per_sheet",
  plywoodSheet: "ceilings.plywood.install.hours_per_sheet",
  timberLiningLm: "ceilings.timber_lining.install.hours_per_lm",
  gridM2: "ceilings.grid.install.hours_per_m2",
  tileEach: "ceilings.tile.install.hours_per_each",
  bulkheadFramingTimberLm:
    "ceilings.bulkhead.framing.timber.install.hours_per_lm",
  bulkheadFramingSteelLm:
    "ceilings.bulkhead.framing.steel.install.hours_per_lm",
  bulkheadLiningSheet: "ceilings.bulkhead.lining.install.hours_per_sheet",
  insulationM2: "ceilings.insulation.install.hours_per_m2",
} as const;

/** Quotr V1 person-hours per stated unit. Not Company DNA. */
export const CEILINGS_QUOTR_PRODUCTIVITY_HOURS = {
  [CEILINGS_PRODUCTIVITY_KEYS.timberFramingLm]: 0.12,
  [CEILINGS_PRODUCTIVITY_KEYS.perimeterLm]: 0.08,
  [CEILINGS_PRODUCTIVITY_KEYS.primaryLm]: 0.1,
  [CEILINGS_PRODUCTIVITY_KEYS.furringLm]: 0.08,
  [CEILINGS_PRODUCTIVITY_KEYS.clipEach]: 0.015,
  [CEILINGS_PRODUCTIVITY_KEYS.dropperEach]: 0.1,
  [CEILINGS_PRODUCTIVITY_KEYS.plasterboardSheet]: 0.5,
  [CEILINGS_PRODUCTIVITY_KEYS.plywoodSheet]: 0.55,
  [CEILINGS_PRODUCTIVITY_KEYS.timberLiningLm]: 0.1,
  [CEILINGS_PRODUCTIVITY_KEYS.gridM2]: 0.18,
  [CEILINGS_PRODUCTIVITY_KEYS.tileEach]: 0.025,
  [CEILINGS_PRODUCTIVITY_KEYS.bulkheadFramingTimberLm]: 0.18,
  [CEILINGS_PRODUCTIVITY_KEYS.bulkheadFramingSteelLm]: 0.16,
  [CEILINGS_PRODUCTIVITY_KEYS.bulkheadLiningSheet]: 0.5,
  [CEILINGS_PRODUCTIVITY_KEYS.insulationM2]: 0.05,
} as const;

export const TIMBER_FRAMING_140X45_H12_KEY =
  "timber.framing.140x45.h1.2.lm" as const;
export const TIMBER_FRAMING_140X45_H12_QUOTR_COST = 9.65;

/** Residual consumables COST / physical unit. Company exact overrides. */
export const CEILINGS_FIXINGS_QUOTR_COST = {
  timberFramingLm: 0.75,
  steelFramingLm: 0.6,
  plasterboardM2: 2.5,
  plywoodM2: 1.5,
  timberLiningLm: 0.5,
  bulkheadTimberFramingLm: 0.75,
  bulkheadSteelFramingLm: 0.6,
  bulkheadPlasterboardM2: 2.5,
} as const;

export const CEILINGS_PARTIAL_ESTIMATE_MESSAGE =
  "PARTIAL ESTIMATE — PRICING REQUIRED" as const;

export const CEILINGS_WIRE_LABOUR_DECISION =
  "V1 embeds ordinary suspension-wire installation in dropper productivity. No separate hours/lm wire operation. Do not double-count dropper + wire labour." as const;

export const CEILINGS_DNA_COVERAGE =
  "No Ceiling V1 Company DNA tasks exist. bathroom.lining.ceiling.v1 is nested Bathroom lining (hours/m²), not ceilings.plasterboard.install.hours_per_sheet. Generic existing calibrations are not applied without an identity match." as const;

export type CeilingLabourOperationSpec = {
  readonly labourComponentKey: string;
  readonly productivityKey: string;
  readonly unit: string;
  readonly description: string;
};

export const CEILING_LABOUR_OPERATIONS: readonly CeilingLabourOperationSpec[] = [
  {
    labourComponentKey: CEILINGS_TIMBER_FRAMING_LABOUR,
    productivityKey: CEILINGS_PRODUCTIVITY_KEYS.timberFramingLm,
    unit: "lm",
    description: "Timber ceiling framing install",
  },
  {
    labourComponentKey: CEILINGS_STEEL_PERIMETER_LABOUR,
    productivityKey: CEILINGS_PRODUCTIVITY_KEYS.perimeterLm,
    unit: "lm",
    description: "Ceiling perimeter track install",
  },
  {
    labourComponentKey: CEILINGS_STEEL_PRIMARY_LABOUR,
    productivityKey: CEILINGS_PRODUCTIVITY_KEYS.primaryLm,
    unit: "lm",
    description: "Ceiling primary channel install",
  },
  {
    labourComponentKey: CEILINGS_STEEL_FURRING_LABOUR,
    productivityKey: CEILINGS_PRODUCTIVITY_KEYS.furringLm,
    unit: "lm",
    description: "Ceiling furring channel install",
  },
  {
    labourComponentKey: CEILINGS_STEEL_CLIP_LABOUR,
    productivityKey: CEILINGS_PRODUCTIVITY_KEYS.clipEach,
    unit: "each",
    description: "Ceiling crossover clip install",
  },
  {
    labourComponentKey: CEILINGS_STEEL_DROPPER_LABOUR,
    productivityKey: CEILINGS_PRODUCTIVITY_KEYS.dropperEach,
    unit: "each",
    description: "Ceiling dropper install (includes ordinary wire)",
  },
  {
    labourComponentKey: CEILINGS_PLASTERBOARD_LABOUR,
    productivityKey: CEILINGS_PRODUCTIVITY_KEYS.plasterboardSheet,
    unit: "sheet",
    description: "Ceiling plasterboard install",
  },
  {
    labourComponentKey: CEILINGS_PLYWOOD_LABOUR,
    productivityKey: CEILINGS_PRODUCTIVITY_KEYS.plywoodSheet,
    unit: "sheet",
    description: "Ceiling plywood install",
  },
  {
    labourComponentKey: CEILINGS_TIMBER_LINING_LABOUR,
    productivityKey: CEILINGS_PRODUCTIVITY_KEYS.timberLiningLm,
    unit: "lm",
    description: "Ceiling timber lining install",
  },
  {
    labourComponentKey: CEILINGS_GRID_LABOUR,
    productivityKey: CEILINGS_PRODUCTIVITY_KEYS.gridM2,
    unit: "m2",
    description: "Ceiling T-grid install",
  },
  {
    labourComponentKey: CEILINGS_TILE_LABOUR,
    productivityKey: CEILINGS_PRODUCTIVITY_KEYS.tileEach,
    unit: "each",
    description: "Ceiling tile install",
  },
  {
    labourComponentKey: CEILINGS_BULKHEAD_FRAMING_TIMBER_LABOUR,
    productivityKey: CEILINGS_PRODUCTIVITY_KEYS.bulkheadFramingTimberLm,
    unit: "lm",
    description: "Bulkhead timber framing install",
  },
  {
    labourComponentKey: CEILINGS_BULKHEAD_FRAMING_STEEL_LABOUR,
    productivityKey: CEILINGS_PRODUCTIVITY_KEYS.bulkheadFramingSteelLm,
    unit: "lm",
    description: "Bulkhead steel framing install",
  },
  {
    labourComponentKey: CEILINGS_BULKHEAD_LINING_LABOUR,
    productivityKey: CEILINGS_PRODUCTIVITY_KEYS.bulkheadLiningSheet,
    unit: "sheet",
    description: "Bulkhead lining install",
  },
  {
    labourComponentKey: CEILINGS_INSULATION_LABOUR,
    productivityKey: CEILINGS_PRODUCTIVITY_KEYS.insulationM2,
    unit: "m2",
    description: "Ceiling insulation install",
  },
  {
    labourComponentKey: CEILINGS_PAINTING_LABOUR,
    productivityKey: PAINTING_LABOUR_HOURS_PER_M2_KEY,
    unit: "m2",
    description: "Painting labour",
  },
];
