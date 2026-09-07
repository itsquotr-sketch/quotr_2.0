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
