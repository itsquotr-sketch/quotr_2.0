/** Central benchmark material/allowance rates for deterministic v1 calibration. */

export const DECK_BENCHMARKS = {
  treatedPineDecking: { cost: 160, sell: 240 },
  hardwoodDecking: { cost: 230, sell: 340 },
  compositeDecking: { cost: 260, sell: 380 },
  framing: { cost: 120, sell: 180 },
  fixings: { cost: 25, sell: 40 },
  stairsAllowance: { cost: 1000, sell: 1500 },
  balustradeAllowance: { cost: 900, sell: 1400 },
} as const;

export const PERGOLA_BENCHMARKS = {
  frameMaterials: { cost: 180, sell: 280 },
  roofing: { cost: 120, sell: 180 },
} as const;

export const RETAINING_WALL_BENCHMARKS = {
  timberFace: { cost: 220, sell: 330 },
  concreteFace: { cost: 400, sell: 600 },
  drainagePerM: { cost: 45, sell: 75 },
  backfillPerFaceM2: { cost: 60, sell: 95 },
  cartingModerate: { cost: 700, sell: 1050 },
  cartingLong: { cost: 1200, sell: 1800 },
} as const;

export const BATHROOM_BENCHMARKS = {
  materialsPerM2: { cost: 1800, sell: 2600 },
  minimumPackage: { cost: 18000, sell: 25000 },
  waterproofing: { cost: 1200, sell: 1800 },
  tilingPerM2: { cost: 180, sell: 280 },
  vanity: { cost: 900, sell: 1400 },
  shower: { cost: 1200, sell: 1800 },
  toilet: { cost: 700, sell: 1100 },
} as const;

export const KITCHEN_BENCHMARKS = {
  materialsPerM2: { cost: 1500, sell: 2300 },
  minimumPackage: { cost: 20000, sell: 30000 },
  cabinetry: { cost: 8000, sell: 12000 },
  benchtop: { cost: 3000, sell: 4800 },
  plumbing: { cost: 2500, sell: 3800 },
  electrical: { cost: 2200, sell: 3400 },
} as const;

export const FENCE_BENCHMARKS = {
  timberPerLm: { cost: 90, sell: 140 },
  metalPerLm: { cost: 140, sell: 220 },
  gate: { cost: 450, sell: 700 },
} as const;

export const DEMOLITION_BENCHMARKS = {
  wastePerM2: { cost: 25, sell: 40 },
  minimum: { cost: 800, sell: 1200 },
} as const;

export const EXTERNAL_STAIRS_BENCHMARKS = {
  materialPerRiser: { cost: 90, sell: 140 },
  handrail: { cost: 350, sell: 550 },
  roughAllowance: { cost: 1200, sell: 1800 },
} as const;

export const BENCHMARK_RATES = {
  deck: DECK_BENCHMARKS,
  pergola: PERGOLA_BENCHMARKS,
  retainingWall: RETAINING_WALL_BENCHMARKS,
  bathroom: BATHROOM_BENCHMARKS,
  kitchen: KITCHEN_BENCHMARKS,
  fence: FENCE_BENCHMARKS,
  demolition: DEMOLITION_BENCHMARKS,
  externalStairs: EXTERNAL_STAIRS_BENCHMARKS,
} as const;
