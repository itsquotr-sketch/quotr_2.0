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
export const BATHROOM_FRAMING_TIMBER_LEGACY_KEY =
  "bathroom.framing.90x45.h1.2.lm" as const;
/** Domain-neutral physical material. Bathroom `bathroom.framing` consumes it. */
export const BATHROOM_FRAMING_TIMBER_KEY =
  "timber.framing.90x45.h1.2.lm" as const;

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

/** WA-BATHROOM-04 — floor finish / tiling / waterproofing. */
export const BATHROOM_TILE_WASTE_FACTOR = 0.1;
export const BATHROOM_HALF_HEIGHT_M = 1.2;
export const BATHROOM_SHOWER_ASSUMED_WIDTH_M = 0.9;
export const BATHROOM_SHOWER_ASSUMED_DEPTH_M = 0.9;
export const BATHROOM_SHOWER_ASSUMED_WALL_HEIGHT_M = 2.1;
export const BATHROOM_VINYL_PLANK_LENGTH_M = 0.915;
export const BATHROOM_VINYL_PLANK_WIDTH_M = 0.152;

export const BATHROOM_TILE_MATERIAL_KEY =
  "bathroom.tile.material.m2" as const;
export const BATHROOM_TILE_INSTALL_KEY =
  "bathroom.tile.install.m2" as const;
export const BATHROOM_WATERPROOFING_INSTALL_KEY =
  "bathroom.waterproofing.install.m2" as const;
export const BATHROOM_SHEET_VINYL_MATERIAL_KEY =
  "bathroom.floor_finish.sheet_vinyl.material.m2" as const;
export const BATHROOM_SHEET_VINYL_INSTALL_KEY =
  "bathroom.floor_finish.sheet_vinyl.install.m2" as const;
export const BATHROOM_VINYL_PLANK_MATERIAL_KEY =
  "bathroom.floor_finish.vinyl_plank.material.m2" as const;
export const BATHROOM_VINYL_PLANK_INSTALL_KEY =
  "bathroom.floor_finish.vinyl_plank.install.m2" as const;

export const BATHROOM_FLOOR_TILE_MATERIAL_COMPONENT =
  "bathroom.floor_finish.tile.material" as const;
export const BATHROOM_FLOOR_TILE_INSTALL_COMPONENT =
  "bathroom.floor_finish.tile.install" as const;
export const BATHROOM_WALL_TILE_MATERIAL_COMPONENT =
  "bathroom.wall_tile.material" as const;
export const BATHROOM_WALL_TILE_INSTALL_COMPONENT =
  "bathroom.wall_tile.install" as const;
export const BATHROOM_WATERPROOFING_COMPONENT =
  "bathroom.waterproofing" as const;
export const BATHROOM_SHEET_VINYL_MATERIAL_COMPONENT =
  "bathroom.floor_finish.sheet_vinyl.material" as const;
export const BATHROOM_SHEET_VINYL_INSTALL_COMPONENT =
  "bathroom.floor_finish.sheet_vinyl.install" as const;
export const BATHROOM_VINYL_PLANK_MATERIAL_COMPONENT =
  "bathroom.floor_finish.vinyl_plank.material" as const;
export const BATHROOM_VINYL_PLANK_INSTALL_COMPONENT =
  "bathroom.floor_finish.vinyl_plank.install" as const;
export const BATHROOM_FLOOR_FINISH_OTHER_COMPONENT =
  "bathroom.floor_finish.other" as const;

export const BATHROOM_TILE_MATERIAL_BENCHMARK = 65;
export const BATHROOM_TILER_BENCHMARK = 95;
export const BATHROOM_WATERPROOFING_BENCHMARK = 75;
export const BATHROOM_SHEET_VINYL_MATERIAL_BENCHMARK = 55;
export const BATHROOM_SHEET_VINYL_INSTALL_BENCHMARK = 45;
export const BATHROOM_VINYL_PLANK_MATERIAL_BENCHMARK = 65;
export const BATHROOM_VINYL_PLANK_INSTALL_BENCHMARK = 50;
export const BATHROOM_PLYWOOD_SHEET_BENCHMARK = 145;
export const BATHROOM_FIBRE_CEMENT_SHEET_BENCHMARK = 95;
export const BATHROOM_FRAMING_H12_BENCHMARK = 6.2;

export const BATHROOM_SHOWER_ASSUMPTION_STATEMENT =
  "Quotr has allowed for a typical corner shower: two walls 0.9 m each, 2.1 m high (3.78 m²).";
export const BATHROOM_HALF_HEIGHT_STATEMENT =
  "Half-height wall tiling is 1.2 m.";
export const BATHROOM_TILE_WASTE_STATEMENT =
  "10% tile material waste included on purchase quantity. Tiler installation uses net area.";
export const BATHROOM_FLOOR_FINISH_XOR_STATEMENT =
  "One primary bathroom floor finish is priced. Floor substrate is independent.";
export const BATHROOM_FLOORING_WA_OVERLAP_STATEMENT =
  "Bathroom floor finish is nested Bathroom scope. A future standalone Flooring Work Area must not double-price the same bathroom floor.";
export const BATHROOM_FLOOR_FINISH_REQUIRED_MESSAGE =
  "What floor finish is being installed?";
export const BATHROOM_WALL_TILE_EXTENT_REQUIRED_MESSAGE =
  "Are any bathroom walls being tiled, and to what extent?";
export const BATHROOM_SHOWER_GEOMETRY_REQUIRED_MESSAGE =
  "What are the shower width, depth, and tiled wall height?";
export const BATHROOM_WATERPROOFING_EXTENT_REQUIRED_MESSAGE =
  "Which areas are being waterproofed?";
export const BATHROOM_OTHER_FLOOR_FINISH_REQUIRED_MESSAGE =
  "Describe the other floor finish and enter a price, or mark it Pricing Required.";
export const BATHROOM_CUSTOM_WALL_TILE_REQUIRED_MESSAGE =
  "What wall tiling area should be allowed for?";
export const BATHROOM_CUSTOM_WP_AREA_REQUIRED_MESSAGE =
  "What waterproofing area should be allowed for?";
export const BATHROOM_BATH_SURROUND_REQUIRED_MESSAGE =
  "What bath-surround waterproofing area should be allowed for?";
export const BATHROOM_WP_FLOOR_AND_SHOWER_LEGACY_STATEMENT =
  "Quotr has allowed for floor and shower waterproofing, not all bathroom walls.";

/** WA-BATHROOM-05 — fixture PC / ownership / trade hybrid. */
export const BATHROOM_FIXTURE_IDS = [
  "toilet",
  "vanity",
  "basin",
  "shower",
  "shower_enclosure",
  "bath",
  "tapware",
  "heated_towel_rail",
  "mirror",
  "extract_fan",
  "accessories",
  "other",
] as const;

export type BathroomFixtureId = (typeof BATHROOM_FIXTURE_IDS)[number];

export const BATHROOM_FIXTURE_PC_KEYS = {
  toilet: "bathroom.fixture.toilet.pc.each",
  vanity: "bathroom.fixture.vanity.pc.each",
  basin: "bathroom.fixture.basin.pc.each",
  shower: "bathroom.fixture.shower.pc.each",
  shower_enclosure: "bathroom.fixture.shower_enclosure.pc.each",
  bath: "bathroom.fixture.bath.pc.each",
  tapware: "bathroom.fixture.tapware.pc.each",
  heated_towel_rail: "bathroom.fixture.heated_towel_rail.pc.each",
  mirror: "bathroom.fixture.mirror.pc.each",
  extract_fan: "bathroom.fixture.extract_fan.pc.each",
  accessories: "bathroom.fixture.accessories.pc.allowance",
  other: "bathroom.fixture.other.pc.allowance",
} as const;

export const BATHROOM_FIXTURE_PC_BENCHMARKS = {
  toilet: 650,
  vanity: 1200,
  basin: 400,
  shower: 750,
  shower_enclosure: 1200,
  bath: 1000,
  tapware: 650,
  heated_towel_rail: 450,
  mirror: 350,
  extract_fan: 300,
  accessories: 300,
  other: null,
} as const;

export const BATHROOM_FIXTURE_SUPPLY_COMPONENTS = {
  toilet: "bathroom.fixture.toilet.supply",
  vanity: "bathroom.fixture.vanity.supply",
  basin: "bathroom.fixture.basin.supply",
  shower: "bathroom.fixture.shower.supply",
  shower_enclosure: "bathroom.fixture.shower_enclosure.supply",
  bath: "bathroom.fixture.bath.supply",
  tapware: "bathroom.fixture.tapware.supply",
  heated_towel_rail: "bathroom.fixture.heated_towel_rail.supply",
  mirror: "bathroom.fixture.mirror.supply",
  extract_fan: "bathroom.fixture.extract_fan.supply",
  accessories: "bathroom.fixture.accessories.supply",
  other: "bathroom.fixture.other.supply",
} as const;

export const BATHROOM_FIXTURE_INSTALL_COMPONENTS = {
  vanity: "bathroom.fixture.vanity.install",
  mirror: "bathroom.fixture.mirror.install",
  accessories: "bathroom.fixture.accessories.install",
  shower_enclosure: "bathroom.fixture.shower_enclosure.install",
} as const;

export const BATHROOM_FIXTURE_PRODUCTIVITY_KEYS = {
  vanity: "bathroom.fixture.vanity.install.hours_each",
  mirror: "bathroom.fixture.mirror.install.hours_each",
  accessories: "bathroom.fixture.accessories.install.hours_each",
  shower_enclosure: "bathroom.fixture.shower_enclosure.install.hours_each",
} as const;

export const BATHROOM_FIXTURE_PRODUCTIVITY_BENCHMARKS = {
  vanity: 2.5,
  mirror: 0.75,
  accessories: 0.5,
  shower_enclosure: 3,
} as const;

export const BATHROOM_PLUMBING_COMPONENT = "bathroom.plumbing" as const;
export const BATHROOM_ELECTRICAL_COMPONENT = "bathroom.electrical" as const;
export const BATHROOM_PLUMBING_ALLOWANCE_KEY =
  "bathroom.plumbing.allowance" as const;
export const BATHROOM_ELECTRICAL_ALLOWANCE_KEY =
  "bathroom.electrical.allowance" as const;

export const BATHROOM_PLUMBING_LEVEL_KEYS = {
  none: "bathroom.plumbing.none.allowance",
  minor: "bathroom.plumbing.minor.allowance",
  standard: "bathroom.plumbing.standard.allowance",
  major: "bathroom.plumbing.major.allowance",
} as const;

export const BATHROOM_PLUMBING_BASE_BENCHMARKS = {
  none: 0,
  minor: 1500,
  standard: 3500,
  major: 6500,
} as const;

export const BATHROOM_PLUMBING_MODIFIER_KEYS = {
  toilet: "bathroom.plumbing.modifier.toilet.each",
  vanity_basin: "bathroom.plumbing.modifier.vanity_basin.each",
  shower: "bathroom.plumbing.modifier.shower.each",
  bath: "bathroom.plumbing.modifier.bath.each",
  floor_waste: "bathroom.plumbing.modifier.floor_waste.each",
  relocation: "bathroom.plumbing.modifier.relocation.each",
} as const;

export const BATHROOM_PLUMBING_MODIFIER_BENCHMARKS = {
  toilet: 450,
  vanity_basin: 450,
  shower: 750,
  bath: 650,
  floor_waste: 350,
  relocation: 500,
} as const;

export const BATHROOM_ELECTRICAL_LEVEL_KEYS = {
  none: "bathroom.electrical.none.allowance",
  minor: "bathroom.electrical.minor.allowance",
  standard: "bathroom.electrical.standard.allowance",
  major: "bathroom.electrical.major.allowance",
} as const;

export const BATHROOM_ELECTRICAL_BASE_BENCHMARKS = {
  none: 0,
  minor: 750,
  standard: 1750,
  major: 3500,
} as const;

export const BATHROOM_ELECTRICAL_MODIFIER_KEYS = {
  light: "bathroom.electrical.modifier.light.each",
  extract_fan: "bathroom.electrical.modifier.extract_fan.each",
  heated_towel_rail: "bathroom.electrical.modifier.heated_towel_rail.each",
  gpo: "bathroom.electrical.modifier.gpo.each",
  mirror_power: "bathroom.electrical.modifier.mirror_power.each",
  ufh: "bathroom.electrical.modifier.ufh.each",
  new_circuit: "bathroom.electrical.modifier.new_circuit.each",
} as const;

export const BATHROOM_ELECTRICAL_MODIFIER_BENCHMARKS = {
  light: 180,
  extract_fan: 450,
  heated_towel_rail: 250,
  gpo: 220,
  mirror_power: 220,
  ufh: 450,
  new_circuit: 650,
} as const;

export const BATHROOM_PLUMBING_SCOPE_TEXT_FACT_KEY =
  "bathroom.plumbing.scope_text" as const;
export const BATHROOM_ELECTRICAL_SCOPE_TEXT_FACT_KEY =
  "bathroom.electrical.scope_text" as const;
export const BATHROOM_OWNERSHIP_FACT_PREFIX = "bathroom.fixture." as const;
export const BATHROOM_OWNERSHIP_FACT_SUFFIX = ".ownership" as const;

export const BATHROOM_PLUMBING_BASE_STATEMENT =
  "Plumbing base is mobilisation and rough-in. Fixture and service modifiers are additive and are not already inside the base.";
export const BATHROOM_ELECTRICAL_BASE_STATEMENT =
  "Electrical base is mobilisation and rough-in. Points and connections are additive and are not already inside the base.";
export const BATHROOM_FINISH_LEVEL_PC_STATEMENT =
  "Finish level does not scale fixture PC sums or fixture installation hours. Explicit PC benchmarks apply.";
export const BATHROOM_PC_NOT_MERCHANT_STATEMENT =
  "PC allowances are estimating sums, not merchant quotes.";

/** WA-BATHROOM-06 — demolition / waste / nested finishing. */
export const BATHROOM_DEMOLITION_COMPONENTS = {
  floor_finish: "bathroom.demolition.floor_finish",
  wall_lining: "bathroom.demolition.wall_lining",
  ceiling: "bathroom.demolition.ceiling",
  vanity: "bathroom.demolition.vanity",
  toilet: "bathroom.demolition.toilet",
  shower: "bathroom.demolition.shower",
  bath: "bathroom.demolition.bath",
  fixture: "bathroom.demolition.fixture",
} as const;

export const BATHROOM_DEMOLITION_PRODUCTIVITY_KEYS = {
  floor_finish: "bathroom.demolition.floor_finish.hours_per_m2",
  wall_lining: "bathroom.demolition.wall_lining.hours_per_m2",
  ceiling: "bathroom.demolition.ceiling.hours_per_m2",
  vanity: "bathroom.demolition.vanity.hours_each",
  toilet: "bathroom.demolition.toilet.hours_each",
  shower: "bathroom.demolition.shower.hours_each",
  bath: "bathroom.demolition.bath.hours_each",
  fixture: "bathroom.demolition.fixture.hours_each",
} as const;

export const BATHROOM_DEMOLITION_PRODUCTIVITY_BENCHMARKS = {
  floor_finish: 0.25,
  wall_lining: 0.2,
  ceiling: 0.25,
  vanity: 1,
  toilet: 0.75,
  shower: 1.5,
  bath: 1.5,
  fixture: 0.75,
} as const;

export const BATHROOM_WASTE_COMPONENT = "bathroom.waste.disposal" as const;
export const BATHROOM_WASTE_ALLOWANCE_KEY =
  "bathroom.waste.disposal.allowance" as const;
export const BATHROOM_WASTE_LEVEL_KEYS = {
  minor: "bathroom.waste.minor.allowance",
  standard: "bathroom.waste.standard.allowance",
  major: "bathroom.waste.major.allowance",
} as const;
export const BATHROOM_WASTE_LEVEL_BENCHMARKS = {
  minor: 350,
  standard: 650,
  major: 1000,
} as const;

export const BATHROOM_STOPPING_COMPONENT = "bathroom.stopping" as const;
export const BATHROOM_STOPPING_KEY = "bathroom.stopping.m2" as const;
export const BATHROOM_STOPPING_BENCHMARK = 28;
export const BATHROOM_PAINTING_COMPONENT = "bathroom.painting" as const;
export const BATHROOM_PAINTING_KEY = "bathroom.painting.m2" as const;
export const BATHROOM_PAINTING_BENCHMARK = 30;

export const BATHROOM_STOPPING_UNDER_TILE_STATEMENT =
  "Stopping uses selected new plasterboard lining area. Tiled walls still receive joint stopping / substrate prep, so tiled area is not deducted from stopping.";
export const BATHROOM_PAINT_TILE_XOR_STATEMENT =
  "Tiled wall surfaces are not painted. Half-height tile leaves the upper wall paintable. Full-height tile leaves no wall paint unless overridden.";
export const BATHROOM_DEMOLITION_NESTED_STATEMENT =
  "Bathroom owns this room's strip-out. A standalone Demolition Work Area must not also price the same bathroom demolition.";
export const BATHROOM_FLOORING_REMOVAL_NESTED_STATEMENT =
  "Bathroom floor-finish removal is nested Bathroom scope. A future standalone Flooring Work Area must not double-price the same removal.";
export const BATHROOM_LINING_REMOVAL_NESTED_STATEMENT =
  "Bathroom wet-area wall and ceiling lining removal is nested Bathroom scope. Future Internal Walls / Ceilings must not double-price the same selected removal.";
export const BATHROOM_HAZMAT_PRICING_REQUIRED =
  "Hazardous materials / asbestos — specialist pricing required. Ordinary bathroom demolition is not priced.";
export const BATHROOM_WASTE_ALLOWANCE_STATEMENT =
  "Bathroom disposal is a transparent strip-out allowance derived from selected demolition, not a density model.";
export const BATHROOM_QUOTR_ALLOWANCE_LABEL = "Quotr allowance";
