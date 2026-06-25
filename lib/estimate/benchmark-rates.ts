/** Central benchmark material/allowance rates for deterministic v1 calibration. */

export const DECK_BENCHMARKS = {
  treatedPineDecking: { cost: 160, sell: 240 },
  hardwoodDecking: { cost: 230, sell: 340 },
  compositeDecking: { cost: 260, sell: 380 },
  kwilaDecking: { cost: 280, sell: 400 },
  framing: { cost: 120, sell: 180 },
  fixings: { cost: 25, sell: 40 },
  boardLm: { cost: 18, sell: 28 },
  treatedPineLm: { cost: 14, sell: 22 },
  hardwoodLm: { cost: 22, sell: 34 },
  kwilaLm: { cost: 28, sell: 42 },
  compositeLm: { cost: 24, sell: 36 },
  faceBoardLm: { cost: 22, sell: 35 },
  stepAllowance: { cost: 350, sell: 550 },
  stairsAllowance: { cost: 1000, sell: 1500 },
  multiSideStairsAllowance: { cost: 1800, sell: 2600 },
  balustradeAllowance: { cost: 900, sell: 1400 },
  handrailAllowance: { cost: 400, sell: 650 },
  postReplacementEach: { cost: 180, sell: 280 },
  substructureReplacementAllowance: { cost: 1200, sell: 1800 },
  substructurePartialAllowance: { cost: 650, sell: 1000 },
} as const;

export const PERGOLA_BENCHMARKS = {
  frameMaterials: { cost: 180, sell: 280 },
  timberFrame: { cost: 180, sell: 280 },
  steelFrame: { cost: 220, sell: 340 },
  aluminiumFrame: { cost: 200, sell: 310 },
  roofing: { cost: 120, sell: 180 },
  colorsteelRoofing: { cost: 140, sell: 210 },
  polycarbonateRoofing: { cost: 95, sell: 145 },
  footingsAllowance: { cost: 450, sell: 700 },
  gutterAllowance: { cost: 350, sell: 550 },
  finishAllowance: { cost: 450, sell: 700 },
  gutterPerLm: { cost: 45, sell: 70 },
  footingsEach: { cost: 220, sell: 340 },
} as const;

export const RETAINING_WALL_BENCHMARKS = {
  timberFace: { cost: 220, sell: 330 },
  concreteFace: { cost: 400, sell: 600 },
  drainagePerM: { cost: 45, sell: 75 },
  novacoilPerM: { cost: 55, sell: 85 },
  drainConnection: { cost: 1800, sell: 2800 },
  backfillPerM3: { cost: 95, sell: 145 },
  backfillPerFaceM2: { cost: 60, sell: 95 },
  cartingModerate: { cost: 700, sell: 1050 },
  cartingLong: { cost: 1200, sell: 1800 },
  disposalAllowance: { cost: 850, sell: 1300 },
  disposalPerLm: { cost: 35, sell: 55 },
} as const;

export const BATHROOM_BENCHMARKS = {
  materialsPerM2: { cost: 1800, sell: 2600 },
  minimumPackage: { cost: 18000, sell: 25000 },
  waterproofing: { cost: 1200, sell: 1800 },
  tilingPerM2: { cost: 180, sell: 280 },
  underfloorHeating: { cost: 1500, sell: 2400 },
  fixtureInstall: { cost: 1200, sell: 1800 },
  vanity: { cost: 900, sell: 1400 },
  shower: { cost: 1200, sell: 1800 },
  toilet: { cost: 700, sell: 1100 },
  plumbingMinor: { cost: 1200, sell: 1800 },
  plumbingMajor: { cost: 3500, sell: 5200 },
  electricalMinor: { cost: 900, sell: 1400 },
  electricalMajor: { cost: 2800, sell: 4200 },
} as const;

export const KITCHEN_BENCHMARKS = {
  materialsPerM2: { cost: 1500, sell: 2300 },
  minimumPackage: { cost: 20000, sell: 30000 },
  cabinetry: { cost: 8000, sell: 12000 },
  benchtop: { cost: 3000, sell: 4800 },
  appliances: { cost: 2500, sell: 3800 },
  flooring: { cost: 180, sell: 280 },
  plumbing: { cost: 2500, sell: 3800 },
  plumbingMinor: { cost: 1200, sell: 1800 },
  plumbingMajor: { cost: 4000, sell: 6000 },
  electrical: { cost: 2200, sell: 3400 },
  electricalMinor: { cost: 900, sell: 1400 },
  electricalMajor: { cost: 3200, sell: 4800 },
} as const;

export const FENCE_BENCHMARKS = {
  timberPerLm: { cost: 90, sell: 140 },
  metalPerLm: { cost: 140, sell: 220 },
  gate: { cost: 450, sell: 700 },
  disposalAllowance: { cost: 280, sell: 420 },
  handrailAllowance: { cost: 350, sell: 550 },
  finishAllowanceLm: { cost: 28, sell: 42 },
  finishAllowanceFlat: { cost: 650, sell: 1000 },
} as const;

export const DEMOLITION_BENCHMARKS = {
  wastePerM2: { cost: 25, sell: 40 },
  minimum: { cost: 800, sell: 1200 },
} as const;

export const EXTERNAL_STAIRS_BENCHMARKS = {
  materialPerRiser: { cost: 90, sell: 140 },
  landing: { cost: 450, sell: 700 },
  handrail: { cost: 350, sell: 550 },
  roughAllowance: { cost: 1200, sell: 1800 },
} as const;

export const FITOUT_BENCHMARKS = {
  internalWallsPerM2: { cost: 95, sell: 145 },
  ceilingsPerM2: { cost: 75, sell: 115 },
  doorsEach: { cost: 280, sell: 420 },
  flooringPerM2: { cost: 120, sell: 185 },
  vinylPerM2: { cost: 85, sell: 130 },
  carpetPerM2: { cost: 95, sell: 145 },
  hardwoodFlooringPerM2: { cost: 160, sell: 240 },
  laminateFlooringPerM2: { cost: 110, sell: 165 },
  paintingPerM2: { cost: 18, sell: 28 },
  paintPerLitre: { cost: 8, sell: 12 },
  plasterboardSheet: { cost: 18, sell: 28 },
  fyrelineSheet: { cost: 24, sell: 36 },
  aqualineSheet: { cost: 26, sell: 38 },
  bracelineSheet: { cost: 22, sell: 32 },
  plywoodSheet: { cost: 45, sell: 68 },
  ceilingTilePerM2: { cost: 35, sell: 52 },
  plasteringPerM2: { cost: 35, sell: 55 },
  skirtingLm: { cost: 28, sell: 42 },
  removalPerM2: { cost: 22, sell: 35 },
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
