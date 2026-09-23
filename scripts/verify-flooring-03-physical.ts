/**
 * FLOORING-03 / FLOORING-03-R1 — nested physical takeoff proofs.
 *
 * Run: npx --yes tsx scripts/verify-flooring-03-physical.ts
 *
 * No paid AI. No Production. No COST rates. No productivity hours. No waste.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BATHROOM_FLOOR_SUBSTRATE_FC_19MM_1800_KEY,
  BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY,
  BATHROOM_FLOOR_SUBSTRATE_FC_19MM_GENERIC_KEY,
  BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
  BATHROOM_FLOOR_SUBSTRATE_SECURA_KEY,
  BATHROOM_SHEET_AREA_M2,
} from "../lib/estimate/bathroom-identities";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateBathroom } from "../lib/estimate/calculators/bathroom";
import { calculateDemolition } from "../lib/estimate/calculators/demolition";
import {
  calculateCeilings,
  calculateDoors,
  calculateFlooring,
  calculateInternalWalls,
} from "../lib/estimate/calculators/fitout";
import { calculateKitchen } from "../lib/estimate/calculators/kitchen";
import { FITOUT_BENCHMARKS } from "../lib/estimate/benchmark-rates";
import {
  FLOORING_CARPET_REMOVE_HOURS_PER_M2,
  FLOORING_CARPET_SUPPLY_INSTALL_M2,
  FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2,
  FLOORING_CUSTOM_FINISH_COMPONENT,
  FLOORING_CUSTOM_REMOVAL_COMPONENT,
  FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2,
  FLOORING_HARDWOOD_REMOVE_HOURS_PER_M2,
  FLOORING_HARDWOOD_SUPPLY_INSTALL_M2,
  FLOORING_SPECIALIST_COMPONENT,
  FLOORING_SUBFLOOR_FRAMING_MAJOR_ALLOWANCE_M2,
  FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2,
  FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_M2,
  FLOORING_SUBSTRATE_INSTALL_HOURS_PER_SHEET,
  FLOORING_SUBSTRATE_INSTALL_LABOUR,
  FLOORING_SUBSTRATE_MATERIAL_COMPONENT,
  FLOORING_SUBSTRATE_REMOVE_HOURS_PER_M2,
  FLOORING_TILE_REMOVE_HOURS_PER_M2,
  FLOORING_TILE_SUPPLY_INSTALL_M2,
  FLOORING_VINYL_PLANK_REMOVE_HOURS_PER_M2,
  FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2,
  flooringSubstrateSheetCoverageM2,
  isOrdinaryFlooringFinishPackageKey,
} from "../lib/estimate/flooring-identities";
import {
  calculateFlooringPhysical,
  FLOORING_PHYSICAL_COMPLETENESS,
  FLOORING_PRODUCTIVITY_UNRESOLVED_STATEMENT,
  flooringHardwoodTakeoff,
  flooringSubstrateSheetCount,
  flooringTileTakeoff,
  isFlooringLabourHoursPlaceholder,
  physicalNetAreaM2,
  requirementsForNestedItem,
  summariseFlooringPhysicalPortion,
} from "../lib/estimate/flooring-physical";
import {
  createEmptyFlooringPortion,
  FLOORING_NESTED_NOT_CALCULATED_MESSAGE,
  FLOORING_PORTIONS_FACT_KEY,
  type FlooringPortion,
} from "../lib/estimate/flooring-portions";
import {
  applyDoorsFactWrite,
  DOORS_PORTIONS_FACT_KEY,
} from "../lib/estimate/doors-portions";
import { requirementPricingFieldsAreResolved } from "../lib/estimate/requirements";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";
import type { EstimateRequirement } from "../lib/estimate/requirements";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const WA: EstimateWorkArea = {
  id: "f1",
  type: "flooring",
  name: "Flooring",
  sort_order: 1,
  status: "confirmed",
};

function persist(portions: readonly FlooringPortion[]): EstimateFact[] {
  return [
    {
      key: FLOORING_PORTIONS_FACT_KEY,
      work_area_id: WA.id,
      value: portions,
      source: "user",
    },
  ];
}

function ctx(
  facts: EstimateFact[],
  workAreas: EstimateWorkArea[] = [WA]
): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: workAreas,
    facts,
    constraints: [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
      premium_rate_factor: 1.15,
    },
    materialWastageSettings: {
      defaultMaterialWastagePercent: 10,
      timberFramingWastagePercent: 10,
      sheetMaterialWastagePercent: 10,
    },
    rates: [],
  } as unknown as EstimateContext;
}

function ordinary(patch: Partial<FlooringPortion> = {}): FlooringPortion {
  return {
    ...createEmptyFlooringPortion({
      id: patch.id ?? "fa_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1",
      label: patch.label ?? "Living",
    }),
    finish_type: "carpet",
    area_input_method: "direct_m2",
    area_m2: 24,
    underlay_required: true,
    substrate_required: false,
    framing_required: false,
    finish_removal_required: false,
    ...patch,
  };
}

function physical(portions: readonly FlooringPortion[]) {
  return calculateFlooringPhysical({
    facts: persist(portions),
    workArea: WA,
  });
}

function materials(reqs: readonly EstimateRequirement[]) {
  return reqs.filter((row) => row.kind === "material");
}

function labour(reqs: readonly EstimateRequirement[]) {
  return reqs.filter((row) => row.kind === "labour");
}

function byComponent(
  reqs: readonly EstimateRequirement[],
  componentKey: string
) {
  return reqs.filter((row) => row.componentKey === componentKey);
}

function byMaterialKey(
  reqs: readonly EstimateRequirement[],
  materialKey: string
) {
  return materials(reqs).filter((row) => row.materialKey === materialKey);
}

function hay(req: EstimateRequirement): string {
  const specification = req.kind === "material" ? req.specification ?? "" : "";
  return [req.description, req.componentKey, specification].join(" ").toLowerCase();
}

function blobOf(value: unknown): string {
  return JSON.stringify(value);
}

function nestedAvoidsLegacy(result: {
  lineItems: readonly {
    recommendedCost?: number | null;
    costRate?: number | null;
    label?: string;
    itemKey?: string | null;
    notes?: string | null;
  }[];
  missingInfo?: readonly string[];
  assumptions?: readonly string[];
}): boolean {
  const labels = result.lineItems.map((row) => row.label ?? "").join(" | ");
  const notes = result.lineItems.map((row) => row.notes ?? "").join(" | ");
  const keys = result.lineItems.map((row) => row.itemKey ?? "").join(" | ");
  const costs = result.lineItems.map((row) => row.recommendedCost ?? 0);
  const rates = result.lineItems.map((row) => row.costRate ?? 0);
  return (
    !costs.includes(FITOUT_BENCHMARKS.flooringPerM2.cost) &&
    !rates.includes(FITOUT_BENCHMARKS.flooringPerM2.cost) &&
    !costs.includes(FITOUT_BENCHMARKS.removalPerM2.cost) &&
    !keys.includes("scope.flooring.m2") &&
    !labels.includes("Scotia") &&
    !labels.includes("Existing flooring removal") &&
    !notes.includes("Using assumed removal area of 20") &&
    !(result.assumptions ?? []).some((row) => row.includes("Using assumed removal area of 20"))
  );
}

console.log("=== A. Area calculation ===\n");

check(
  "A1. Direct m² uses only the active entered area",
  physicalNetAreaM2(ordinary({ area_input_method: "direct_m2", area_m2: 18.5 })) ===
    18.5
);
check(
  "A2. Length/width uses only active dimensions",
  physicalNetAreaM2(
    ordinary({
      area_input_method: "length_width",
      length_m: 5.2,
      width_m: 3.5,
      area_m2: 99,
    })
  ) ===
    5.2 * 3.5
);
check(
  "A3. Stale direct area is ignored on length/width",
  physicalNetAreaM2(
    ordinary({
      area_input_method: "length_width",
      length_m: 4,
      width_m: 3,
      area_m2: 99,
    })
  ) === 12
);
check(
  "A4. Stale length/width is ignored on direct area",
  physicalNetAreaM2(
    ordinary({
      area_input_method: "direct_m2",
      area_m2: 12,
      length_m: 9,
      width_m: 9,
    })
  ) === 12
);
check(
  "A5. Tile product dimensions never become room dimensions",
  physicalNetAreaM2(
    ordinary({
      finish_type: "tile",
      area_m2: 10,
      tile_width_mm: 600,
      tile_length_mm: 600,
      floor_preparation_required: false,
      underlay_required: null,
    })
  ) === 10 &&
    physicalNetAreaM2(
      ordinary({
        area_input_method: "length_width",
        length_m: null,
        width_m: null,
        tile_width_mm: 600,
        tile_length_mm: 1200,
      })
    ) == null
);
check(
  "A6. Hardwood board width never becomes room width",
  physicalNetAreaM2(
    ordinary({
      finish_type: "hardwood",
      area_input_method: "length_width",
      length_m: null,
      width_m: null,
      hardwood_board_width_mm: 186,
      underlay_required: null,
    })
  ) == null
);
check(
  "A7. Substrate sheet dimensions never become room dimensions",
  physicalNetAreaM2(
    ordinary({
      area_input_method: "length_width",
      length_m: null,
      width_m: null,
      area_m2: 12,
      substrate_required: true,
      substrate_family: "fibre_cement",
      substrate_item_key: BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY,
    })
  ) == null
);
check(
  "A8. No default area, openings deduction, or waste adjustment",
  physicalNetAreaM2(ordinary({ area_input_method: null, area_m2: 20 })) == null &&
    physicalNetAreaM2(ordinary({ area_m2: 10 })) === 10 &&
    !read("lib/estimate/flooring-physical.ts").includes(
      "calculateFlooringAreaWithWastage"
    ) &&
    !read("lib/estimate/flooring-physical.ts").includes("recordDefaultedNumber")
);

console.log("\n=== B. Carpet ===\n");

const carpetYes = physical([ordinary({ underlay_required: true, area_m2: 24 })]);
check(
  "B1. Carpet finish basis equals area",
  byMaterialKey(carpetYes.requirements, FLOORING_CARPET_SUPPLY_INSTALL_M2)[0]
    ?.baseQuantity === 24 &&
    carpetYes.requirements.some(
      (row) =>
        row.kind === "subcontract" &&
        row.componentKey === FLOORING_CARPET_SUPPLY_INSTALL_M2
    )
);
check(
  "B2. Underlay Yes emits the same area",
  byMaterialKey(carpetYes.requirements, FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2)[0]
    ?.baseQuantity === 24
);
check(
  "B3. Underlay No emits no underlay",
  byComponent(
    physical([ordinary({ underlay_required: false })]).requirements,
    FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2
  ).length === 0
);
check(
  "B4. Underlay null is Information Required",
  physical([ordinary({ underlay_required: null })]).portions[0]?.completeness ===
    FLOORING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED &&
    physical([ordinary({ underlay_required: null })]).requirements.length === 0
);
check(
  "B5. No roll width, seams, or waste",
  materials(carpetYes.requirements).every((row) => row.wasteFactor === 0) &&
    materials(carpetYes.requirements).every(
      (row) => row.purchaseUnit !== "roll" && row.baseUnit !== "roll"
    )
);

console.log("\n=== C. Vinyl plank / LVT ===\n");

const vinylYes = physical([
  ordinary({
    finish_type: "vinyl_plank",
    underlay_required: null,
    floor_preparation_required: true,
    area_m2: 16,
  }),
]);
check(
  "C1. Vinyl finish basis equals area",
  byMaterialKey(vinylYes.requirements, FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2)[0]
    ?.baseQuantity === 16
);
check(
  "C2. Preparation Yes emits the same area",
  byMaterialKey(vinylYes.requirements, FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2)[0]
    ?.baseQuantity === 16
);
check(
  "C3. Preparation No emits none",
  byComponent(
    physical([
      ordinary({
        finish_type: "vinyl_plank",
        underlay_required: null,
        floor_preparation_required: false,
      }),
    ]).requirements,
    FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2
  ).length === 0
);
check(
  "C4. Preparation null is Information Required",
  physical([
    ordinary({
      finish_type: "vinyl_plank",
      underlay_required: null,
      floor_preparation_required: null,
    }),
  ]).portions[0]?.completeness === FLOORING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED
);
check(
  "C5. No cartons, plank counts, adhesive, or waste",
  materials(vinylYes.requirements).every(
    (row) =>
      row.wasteFactor === 0 &&
      row.purchaseUnit !== "carton" &&
      row.purchaseUnit !== "plank" &&
      row.baseUnit === "m2"
  )
);

console.log("\n=== D. Tile ===\n");

const tile12 = flooringTileTakeoff(12, 600, 600);
const tilePhysical = physical([
  ordinary({
    finish_type: "tile",
    underlay_required: null,
    floor_preparation_required: false,
    tile_width_mm: 600,
    tile_length_mm: 600,
    area_m2: 12,
  }),
]);
check(
  "D1. Tile subcontract/package basis remains m²",
  byMaterialKey(tilePhysical.requirements, FLOORING_TILE_SUPPLY_INSTALL_M2)[0]
    ?.baseQuantity === 12 &&
    byMaterialKey(tilePhysical.requirements, FLOORING_TILE_SUPPLY_INSTALL_M2)[0]
      ?.baseUnit === "m2" &&
    tilePhysical.requirements.some(
      (row) =>
        row.kind === "subcontract" &&
        row.componentKey === FLOORING_TILE_SUPPLY_INSTALL_M2
    )
);
check(
  "D2. Tile count is informational only",
  tilePhysical.portions[0]?.tile?.wholeTileCount === 34 &&
    !materials(tilePhysical.requirements).some(
      (row) => row.purchaseUnit === "each" || row.baseUnit === "tile"
    )
);
check(
  "D3. 12 m² ÷ 0.36 m² = 33.333... rounded up to 34 tiles",
  tile12 != null &&
    tile12.tileAreaM2 === 0.36 &&
    tile12.rawTileCount === 12 / 0.36 &&
    tile12.wholeTileCount === 34
);
check(
  "D4. Raw tile count is retained",
  tilePhysical.portions[0]?.tile?.rawTileCount === 12 / 0.36
);
const customTile = flooringTileTakeoff(10, 450, 900);
check(
  "D5. Custom positive tile dimensions work",
  customTile != null &&
    customTile.tileAreaM2 === (450 * 900) / 1_000_000 &&
    customTile.wholeTileCount === Math.ceil(10 / ((450 * 900) / 1_000_000))
);
check(
  "D6. Invalid tile dimensions remain unresolved",
  physical([
    ordinary({
      finish_type: "tile",
      underlay_required: null,
      floor_preparation_required: false,
      tile_width_mm: null,
      tile_length_mm: 600,
    }),
  ]).portions[0]?.completeness ===
    FLOORING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED &&
    flooringTileTakeoff(12, 0, 600) == null
);
check(
  "D7. No waste, boxes, adhesive, or grout quantities",
  materials(tilePhysical.requirements).every(
    (row) =>
      row.wasteFactor === 0 &&
      row.purchaseUnit !== "box" &&
      row.purchaseUnit !== "kg"
  )
);
check(
  "D8. Tile count cannot become a priced quantity",
  materials(tilePhysical.requirements).every(
    (row) =>
      row.priced === false &&
      row.unitCost == null &&
      row.purchaseQuantity !== tilePhysical.portions[0]?.tile?.wholeTileCount
  )
);

console.log("\n=== E. Hardwood / timber ===\n");

const hw15 = flooringHardwoodTakeoff(15, 186);
const hwPhysical = physical([
  ordinary({
    finish_type: "hardwood",
    underlay_required: null,
    hardwood_board_width_mm: 186,
    area_m2: 15,
  }),
]);
check(
  "E1. Hardwood subcontract/package basis remains m²",
  byMaterialKey(hwPhysical.requirements, FLOORING_HARDWOOD_SUPPLY_INSTALL_M2)[0]
    ?.baseQuantity === 15 &&
    byMaterialKey(hwPhysical.requirements, FLOORING_HARDWOOD_SUPPLY_INSTALL_M2)[0]
      ?.baseUnit === "m2"
);
check(
  "E2. 15 ÷ 0.186 = 80.645161... lm",
  hw15 != null && hw15.linealM === 15 / 0.186
);
check(
  "E3. Raw lm is informational only",
  hwPhysical.portions[0]?.hardwood?.linealM === 15 / 0.186 &&
    !materials(hwPhysical.requirements).some((row) => row.baseUnit === "lm")
);
check(
  "E4. Standard board width works",
  flooringHardwoodTakeoff(10, 145)?.linealM === 10 / 0.145
);
check(
  "E5. Custom positive board width works",
  flooringHardwoodTakeoff(10, 200)?.linealM === 10 / 0.2
);
check(
  "E6. Invalid board width remains unresolved",
  physical([
    ordinary({
      finish_type: "hardwood",
      underlay_required: null,
      hardwood_board_width_mm: null,
    }),
  ]).portions[0]?.completeness ===
    FLOORING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED &&
    flooringHardwoodTakeoff(15, 0) == null
);
check(
  "E7. No board length, piece count, pack conversion, or waste",
  materials(hwPhysical.requirements).every(
    (row) =>
      row.wasteFactor === 0 &&
      row.purchaseUnit !== "each" &&
      row.purchaseUnit !== "pack"
  )
);

console.log("\n=== F. Substrate ===\n");

check(
  "F1. Substrate No emits no substrate components",
  physical([ordinary({ substrate_required: false })]).requirements.every(
    (row) =>
      row.componentKey !== FLOORING_SUBSTRATE_MATERIAL_COMPONENT &&
      row.componentKey !== FLOORING_SUBSTRATE_INSTALL_LABOUR
  )
);
check(
  "F2. Substrate null is Information Required",
  physical([ordinary({ substrate_required: null })]).portions[0]?.completeness ===
    FLOORING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED
);
check(
  "F3. Substrate Yes without family is Information Required",
  physical([
    ordinary({
      substrate_required: true,
      substrate_family: null,
      substrate_item_key: BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
    }),
  ]).portions[0]?.completeness ===
    FLOORING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED
);
check(
  "F4. Substrate Yes without exact product key is Information Required",
  physical([
    ordinary({
      substrate_required: true,
      substrate_family: "particleboard",
      substrate_item_key: null,
    }),
  ]).portions[0]?.completeness ===
    FLOORING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED
);
check(
  "F5. 19 mm H3.2 plywood 2400 × 1200 coverage is 2.88 m²",
  flooringSubstrateSheetCoverageM2(BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY) ===
    2.88 &&
    flooringSubstrateSheetCoverageM2(BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY) ===
      BATHROOM_SHEET_AREA_M2
);
const ply12 = physical([
  ordinary({
    area_m2: 12,
    substrate_required: true,
    substrate_family: "structural_plywood",
    substrate_item_key: BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
  }),
]);
check(
  "F6. 12 m² plywood rounds up to 5 sheets",
  flooringSubstrateSheetCount(12, 2.88) === 5 &&
    ply12.portions[0]?.substrate?.sheetCount === 5 &&
    byMaterialKey(ply12.requirements, BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY)[0]
      ?.baseQuantity === 5
);
check(
  "F7. 19 mm fibre-cement 2700 × 600 coverage is 1.62 m² from item-key tokens",
  flooringSubstrateSheetCoverageM2(BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY) ===
    1.62
);
check(
  "F8. 19 mm fibre-cement 1800 × 900 coverage is 1.62 m² from item-key tokens",
  flooringSubstrateSheetCoverageM2(BATHROOM_FLOOR_SUBSTRATE_FC_19MM_1800_KEY) ===
    1.62
);
check(
  "F9. Secura 2400 × 600 coverage is 1.44 m² from item-key tokens",
  flooringSubstrateSheetCoverageM2(BATHROOM_FLOOR_SUBSTRATE_SECURA_KEY) === 1.44
);
check(
  "F10. Generic 19 mm FC without encoded size remains unresolved",
  flooringSubstrateSheetCoverageM2(BATHROOM_FLOOR_SUBSTRATE_FC_19MM_GENERIC_KEY) ==
    null &&
    physical([
      ordinary({
        substrate_required: true,
        substrate_family: "fibre_cement",
        substrate_item_key: BATHROOM_FLOOR_SUBSTRATE_FC_19MM_GENERIC_KEY,
      }),
    ]).portions[0]?.completeness ===
      FLOORING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED
);
check(
  "F11. Unknown product keys remain unresolved",
  flooringSubstrateSheetCoverageM2("flooring.invented.sheet.each") == null
);
check(
  "F12. Sheet quantity rounds up without waste",
  flooringSubstrateSheetCount(8, 2.88) === 3 &&
    byMaterialKey(ply12.requirements, BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY)[0]
      ?.wasteFactor === 0
);
const plyLabour = labour(ply12.requirements).find(
  (row) => row.componentKey === FLOORING_SUBSTRATE_INSTALL_LABOUR
);
check(
  "F13. Installation-operation basis equals purchased sheet count, with no hours",
  plyLabour?.productivityBasis.quantity === 5 &&
    plyLabour?.productivityBasis.key === FLOORING_SUBSTRATE_INSTALL_HOURS_PER_SHEET &&
    isFlooringLabourHoursPlaceholder(plyLabour!)
);

console.log("\n=== G. Framing ===\n");

check(
  "G1. Framing No emits nothing",
  physical([ordinary({ framing_required: false })]).requirements.every(
    (row) => !row.componentKey.includes("subfloor_framing")
  )
);
check(
  "G2. Framing null is Information Required",
  physical([ordinary({ framing_required: null })]).portions[0]?.completeness ===
    FLOORING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED
);
const framingMinor = physical([
  ordinary({
    framing_required: true,
    framing_allowance_level: "minor",
    area_m2: 20,
  }),
]);
check(
  "G3. Minor emits one m² allowance requirement",
  byComponent(framingMinor.requirements, FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2)
    .length === 1 &&
    byMaterialKey(
      framingMinor.requirements,
      FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2
    )[0]?.baseQuantity === 20
);
check(
  "G4. Standard emits one m² allowance requirement",
  byComponent(
    physical([
      ordinary({
        framing_required: true,
        framing_allowance_level: "standard",
      }),
    ]).requirements,
    FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_M2
  ).length === 1
);
check(
  "G5. Major emits one m² allowance requirement",
  byComponent(
    physical([
      ordinary({ framing_required: true, framing_allowance_level: "major" }),
    ]).requirements,
    FLOORING_SUBFLOOR_FRAMING_MAJOR_ALLOWANCE_M2
  ).length === 1
);
check(
  "G6. No timber, joist, blocking, or labour quantities",
  byComponent(
    framingMinor.requirements,
    FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2
  ).every((row) => row.kind === "material") &&
    !framingMinor.requirements.some(
      (row) =>
        row.kind === "material" &&
        (row.materialKey === "timber.framing.90x45.h1.2.lm" ||
          row.baseUnit === "lm")
    ) &&
    !framingMinor.requirements.some(
      (row) =>
        row.kind === "labour" && row.componentKey.includes("subfloor_framing")
    )
);
check(
  "G7. No structural-design claim",
  framingMinor.requirements.every(
    (row) => !/structural design|engineer/.test(hay(row))
  )
);

console.log("\n=== H. Removal ===\n");

check(
  "H1. Removal No emits no removal operations",
  labour(
    physical([ordinary({ finish_removal_required: false })]).requirements
  ).every((row) => !row.componentKey.includes(".remove"))
);
check(
  "H2. Removal null is Information Required",
  physical([ordinary({ finish_removal_required: null })]).portions[0]
    ?.completeness === FLOORING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED
);
check(
  "H3. Carpet removal selects the carpet hours identity",
  labour(
    physical([
      ordinary({
        finish_removal_required: true,
        existing_finish_type: "carpet",
        substrate_removal_required: false,
      }),
    ]).requirements
  ).some((row) => row.productivityBasis.key === FLOORING_CARPET_REMOVE_HOURS_PER_M2)
);
check(
  "H4. Vinyl removal selects the vinyl-plank hours identity",
  labour(
    physical([
      ordinary({
        finish_removal_required: true,
        existing_finish_type: "vinyl",
        substrate_removal_required: false,
      }),
    ]).requirements
  ).some(
    (row) => row.productivityBasis.key === FLOORING_VINYL_PLANK_REMOVE_HOURS_PER_M2
  )
);
check(
  "H5. Tile removal selects the tile hours identity",
  labour(
    physical([
      ordinary({
        finish_removal_required: true,
        existing_finish_type: "tile",
        substrate_removal_required: false,
      }),
    ]).requirements
  ).some((row) => row.productivityBasis.key === FLOORING_TILE_REMOVE_HOURS_PER_M2)
);
check(
  "H6. Hardwood removal selects the hardwood hours identity",
  labour(
    physical([
      ordinary({
        finish_removal_required: true,
        existing_finish_type: "hardwood",
        substrate_removal_required: false,
      }),
    ]).requirements
  ).some(
    (row) => row.productivityBasis.key === FLOORING_HARDWOOD_REMOVE_HOURS_PER_M2
  )
);
const customRemoval = physical([
  ordinary({
    finish_removal_required: true,
    existing_finish_type: "other",
    substrate_removal_required: false,
    area_m2: 11,
  }),
]);
check(
  "H7. Other/custom removal retains quantity with no ordinary productivity identity",
  byComponent(customRemoval.requirements, FLOORING_CUSTOM_REMOVAL_COMPONENT)[0]
    ?.kind === "material" &&
    byComponent(customRemoval.requirements, FLOORING_CUSTOM_REMOVAL_COMPONENT).some(
      (row) => row.kind === "material" && row.baseQuantity === 11
    ) &&
    labour(customRemoval.requirements).every(
      (row) =>
        row.productivityBasis.key !== FLOORING_CARPET_REMOVE_HOURS_PER_M2 &&
        row.productivityBasis.key !== FLOORING_VINYL_PLANK_REMOVE_HOURS_PER_M2
    )
);
check(
  "H8. Substrate removal is not emitted when finish removal is No",
  labour(
    physical([
      ordinary({
        finish_removal_required: false,
        substrate_removal_required: true,
      }),
    ]).requirements
  ).every((row) => row.productivityBasis.key !== FLOORING_SUBSTRATE_REMOVE_HOURS_PER_M2)
);
const bothRemoval = physical([
  ordinary({
    finish_removal_required: true,
    existing_finish_type: "tile",
    substrate_removal_required: true,
    area_m2: 14,
  }),
]);
check(
  "H9. Substrate removal emits when finish removal is Yes and substrate removal is Yes",
  labour(bothRemoval.requirements).some(
    (row) =>
      row.productivityBasis.key === FLOORING_SUBSTRATE_REMOVE_HOURS_PER_M2 &&
      row.productivityBasis.quantity === 14
  )
);
check(
  "H10. No disposal requirement is introduced",
  !bothRemoval.requirements.some((row) => /disposal/.test(hay(row)))
);
check(
  "H11. Nested removal does not use legacy $22/m²",
  !blobOf(bothRemoval).includes(String(FITOUT_BENCHMARKS.removalPerM2.cost)) &&
    labour(bothRemoval.requirements).every((row) =>
      isFlooringLabourHoursPlaceholder(row)
    )
);

console.log("\n=== I. Custom, specialist, incomplete ===\n");

const customComplete = physical([
  ordinary({
    id: "fa_custom",
    finish_type: "other",
    other_description: "Cork-look vinyl",
    underlay_required: null,
    area_m2: 9,
    substrate_required: true,
    substrate_family: "structural_plywood",
    substrate_item_key: BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
  }),
]);
check(
  "I1. Custom ordinary finish is complete with a custom/unresolved requirement",
  customComplete.portions[0]?.completeness ===
    FLOORING_PHYSICAL_COMPLETENESS.COMPLETE_PHYSICAL &&
    byComponent(customComplete.requirements, FLOORING_CUSTOM_FINISH_COMPONENT)
      .length === 1 &&
    customComplete.requirements.every(
      (row) => !isOrdinaryFlooringFinishPackageKey(row.componentKey)
    )
);
check(
  "I2. Independently confirmed substrate remains visible on custom finish",
  byComponent(customComplete.requirements, FLOORING_SUBSTRATE_MATERIAL_COMPONENT)
    .length === 1
);
const specialist = physical([
  {
    ...createEmptyFlooringPortion({ id: "fa_spec", label: "Entry" }),
    finish_type: "other",
    specialist_kind: "laminate",
    other_description: "Laminate flooring",
    area_input_method: "direct_m2",
    area_m2: 12,
    substrate_required: true,
    substrate_family: "structural_plywood",
    substrate_item_key: BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
    framing_required: true,
    framing_allowance_level: "minor",
    finish_removal_required: false,
  },
]);
check(
  "I3. Specialist is UNSUPPORTED_SPECIALIST with one specialist requirement",
  specialist.portions[0]?.completeness ===
    FLOORING_PHYSICAL_COMPLETENESS.UNSUPPORTED_SPECIALIST &&
    byComponent(specialist.requirements, FLOORING_SPECIALIST_COMPONENT).length === 1 &&
    specialist.requirements.length === 1
);
check(
  "I4. Specialist has no ordinary finish package",
  specialist.requirements.every(
    (row) => !isOrdinaryFlooringFinishPackageKey(row.componentKey)
  )
);
check(
  "I5. Specialist does not attach ordinary accessories",
  byComponent(specialist.requirements, FLOORING_SUBSTRATE_MATERIAL_COMPONENT)
    .length === 0 &&
    byComponent(specialist.requirements, FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2)
      .length === 0
);
const incomplete = physical([ordinary({ area_m2: null })]);
check(
  "I6. Missing fields are named",
  incomplete.portions[0]?.missingFields.includes("flooring.portion.area_m2") ===
    true && incomplete.missingInfo.some((row) => /Floor area not confirmed/.test(row))
);
check(
  "I7. Missing information does not become quantity zero",
  incomplete.requirements.length === 0 &&
    incomplete.portions[0]?.physicalNetAreaM2 == null
);
check(
  "I8. Complete sibling survives an incomplete sibling",
  (() => {
    const mixed = physical([
      ordinary({ id: "complete-a", label: "Bedrooms", area_m2: 24 }),
      ordinary({
        id: "incomplete-b",
        label: "Lounge",
        finish_type: "vinyl_plank",
        underlay_required: null,
        floor_preparation_required: null,
        area_m2: 18,
      }),
    ]);
    return (
      mixed.portions.find((row) => row.nestedItemId === "complete-a")
        ?.completeness === FLOORING_PHYSICAL_COMPLETENESS.COMPLETE_PHYSICAL &&
      mixed.portions.find((row) => row.nestedItemId === "incomplete-b")
        ?.completeness === FLOORING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED &&
      requirementsForNestedItem(mixed.requirements, "complete-a").length > 0 &&
      requirementsForNestedItem(mixed.requirements, "incomplete-b").length === 0
    );
  })()
);

console.log("\n=== J. Multi-area ownership ===\n");

const vsCustom = physical([
  ordinary({ id: "ord-a", label: "Bed 1", area_m2: 12 }),
  ordinary({
    id: "custom-b",
    label: "Study",
    finish_type: "other",
    other_description: "Cork-look vinyl",
    underlay_required: null,
    area_m2: 8,
  }),
]);
check(
  "J1. Complete sibling survives a custom sibling",
  vsCustom.portions.find((row) => row.nestedItemId === "ord-a")?.completeness ===
    FLOORING_PHYSICAL_COMPLETENESS.COMPLETE_PHYSICAL &&
    requirementsForNestedItem(vsCustom.requirements, "ord-a").some((row) =>
      isOrdinaryFlooringFinishPackageKey(row.componentKey)
    )
);
const vsSpec = physical([
  ordinary({ id: "ord-c", label: "Hall", area_m2: 10 }),
  {
    ...createEmptyFlooringPortion({ id: "spec-d", label: "Entry" }),
    finish_type: "other",
    specialist_kind: "engineered_timber",
    other_description: "Engineered timber",
    area_input_method: "direct_m2",
    area_m2: 6,
  },
]);
check(
  "J2. Complete sibling survives a specialist sibling",
  vsSpec.portions.find((row) => row.nestedItemId === "ord-c")?.completeness ===
    FLOORING_PHYSICAL_COMPLETENESS.COMPLETE_PHYSICAL &&
    vsSpec.portions.find((row) => row.nestedItemId === "spec-d")?.completeness ===
      FLOORING_PHYSICAL_COMPLETENESS.UNSUPPORTED_SPECIALIST &&
    requirementsForNestedItem(vsSpec.requirements, "ord-c").length > 0
);
const twins = physical([
  ordinary({ id: "twin-a", label: "Bed 1", area_m2: 12 }),
  ordinary({ id: "twin-b", label: "Bed 2", area_m2: 12 }),
]);
check(
  "J3. Identical areas retain separate nested IDs",
  twins.portions.map((row) => row.nestedItemId).sort().join(",") === "twin-a,twin-b"
);
check(
  "J4. Identical areas are not physically deduplicated",
  byMaterialKey(twins.requirements, FLOORING_CARPET_SUPPLY_INSTALL_M2).length === 2
);
check(
  "J5. Requirement variant keys stay portion-specific",
  twins.requirements.every(
    (row) => row.variantKey === "twin-a" || row.variantKey === "twin-b"
  )
);
check(
  "J6. Requirement IDs encode nested item identity as the overlap discriminator",
  twins.requirements.every((row) => row.requirementId.includes(row.variantKey ?? ""))
);

console.log("\n=== K. Legacy isolation and zero-hours safety ===\n");

const nestedCalc = calculateFlooring(ctx(persist([ordinary()])), WA);
const nestedIncomplete = calculateFlooring(
  ctx(persist([ordinary({ underlay_required: null })])),
  WA
);
const nestedEmpty = calculateFlooring(ctx(persist([])), WA);
const nestedCustom = calculateFlooring(
  ctx(
    persist([
      ordinary({
        finish_type: "other",
        other_description: "Cork-look vinyl",
        underlay_required: null,
      }),
    ])
  ),
  WA
);
const nestedSpecialist = calculateFlooring(
  ctx(
    persist([
      {
        ...createEmptyFlooringPortion({ label: "Entry" }),
        finish_type: "other",
        specialist_kind: "laminate",
        other_description: "Laminate flooring",
        area_input_method: "direct_m2",
        area_m2: 12,
      },
    ])
  ),
  WA
);
const nestedRemovalOnly = calculateFlooring(
  ctx(
    persist([
      ordinary({
        finish_type: null,
        underlay_required: null,
        finish_removal_required: true,
        existing_finish_type: "carpet",
        substrate_removal_required: false,
      }),
    ])
  ),
  WA
);
const nestedSubstrateOnly = calculateFlooring(
  ctx(
    persist([
      ordinary({
        finish_type: null,
        underlay_required: null,
        substrate_required: true,
        substrate_family: "structural_plywood",
        substrate_item_key: BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
      }),
    ])
  ),
  WA
);
const legacy = calculateFlooring(
  ctx([{ key: "flooring.area_m2", work_area_id: WA.id, value: 20 }]),
  WA
);
check(
  "K1. Flat legacy Flooring control remains unchanged",
  legacy.lineItems.length > 0 &&
    !legacy.missingInfo.includes(FLOORING_NESTED_NOT_CALCULATED_MESSAGE) &&
    legacy.requirements == null
);
check("K2. Nested empty avoids legacy money", nestedAvoidsLegacy(nestedEmpty) && nestedEmpty.lineItems.length === 0);
check("K3. Nested incomplete avoids legacy money", nestedAvoidsLegacy(nestedIncomplete) && nestedIncomplete.lineItems.length === 0);
check(
  "K4. Nested complete avoids legacy money and emits physical requirements",
  nestedAvoidsLegacy(nestedCalc) && (nestedCalc.requirements?.length ?? 0) > 0
);
check("K5. Nested custom avoids legacy money", nestedAvoidsLegacy(nestedCustom));
check("K6. Nested specialist avoids legacy money", nestedAvoidsLegacy(nestedSpecialist));
check(
  "K7. Nested removal-only avoids legacy $22/m²",
  nestedAvoidsLegacy(nestedRemovalOnly) &&
    !nestedRemovalOnly.lineItems.some(
      (row) => row.costRate === FITOUT_BENCHMARKS.removalPerM2.cost
    )
);
check(
  "K8. Nested substrate-only where finish is unanswered avoids legacy money",
  nestedAvoidsLegacy(nestedSubstrateOnly) && nestedSubstrateOnly.lineItems.length === 0
);
check(
  "K9. Nested complete does not use $120/m²",
  nestedCalc.lineItems.every(
    (row) =>
      row.costRate !== FITOUT_BENCHMARKS.flooringPerM2.cost &&
      row.itemKey !== "flooring.material.m2"
  )
);
check(
  "K10. Nested complete does not use 0.8 h/m²",
  labour(nestedCalc.requirements ?? []).every(
    (row) => row.productivityBasis.hoursPerUnit !== 0.8
  ) && !blobOf(nestedCalc.lineItems).includes("0.8")
);
check(
  "K11. Nested complete does not use $8/m² underlay or $18–45/m² preparation",
  nestedCalc.lineItems.every((row) => {
      return (
        row.costRate !== FITOUT_BENCHMARKS.underlayPerM2.cost &&
        row.costRate !== FITOUT_BENCHMARKS.floorPrepMinor.cost &&
        row.costRate !== FITOUT_BENCHMARKS.floorPrepMajor.cost
      );
    })
);
check(
  "K12. Nested complete does not invent 20 m², 12 stairs, scotia, or scope.flooring.m2",
  !blobOf(nestedCalc).includes("Using assumed") &&
    !blobOf(nestedCalc).includes("stairs") &&
    !blobOf(nestedCalc).includes("Scotia") &&
    !blobOf(nestedCalc).includes("scope.flooring.m2")
);
check(
  "K13. Zero hours is a type placeholder: priced false, costs null, unresolved statement",
  labour(ply12.requirements).every((row) => isFlooringLabourHoursPlaceholder(row)) &&
    labour(ply12.requirements).every(
      (row) => requirementPricingFieldsAreResolved(row) === false
    ) &&
    FLOORING_PRODUCTIVITY_UNRESOLVED_STATEMENT.includes("FLOORING-04")
);
const fullEstimate = calculateEstimate(ctx(persist([ordinary()])));
check(
  "K14. Downstream estimate cannot mint $0 labour or COST/sell/GST from nested Flooring",
  fullEstimate.lineItems.length > 0 &&
    !(fullEstimate.lineItems ?? []).some(
      (row) =>
        (row.recommendedCost ?? 0) === 0 &&
        row.category === "labour" &&
        row.rateSourceType !== "missing"
    ) &&
    !blobOf(fullEstimate.lineItems).toLowerCase().includes("gst") &&
    nestedAvoidsLegacy(fullEstimate)
);

console.log("\n=== L. Cross-work-area regression ===\n");

const bathroomFacts: EstimateFact[] = [
  { key: "bathroom.area_m2", work_area_id: "b1", value: 6 },
];
const bathroomWa = {
  id: "b1",
  type: "bathroom",
  name: "Bathroom",
  sort_order: 1,
  status: "confirmed",
} as EstimateWorkArea;
const bathroomBefore = calculateBathroom(
  { ...ctx(bathroomFacts), confirmedWorkAreas: [bathroomWa] },
  bathroomWa
);
const bathroomAfter = calculateBathroom(
  {
    ...ctx([...bathroomFacts, ...persist([ordinary()])]),
    confirmedWorkAreas: [bathroomWa],
  },
  bathroomWa
);
check(
  "L1. Bathroom calculator is unchanged by nested Flooring facts",
  bathroomAfter.lineItems.length === bathroomBefore.lineItems.length
);

const kitchenFacts: EstimateFact[] = [
  { key: "kitchen.area_m2", work_area_id: "k1", value: 12 },
];
const kitchenWa = {
  id: "k1",
  type: "kitchen",
  name: "Kitchen",
  sort_order: 1,
  status: "confirmed",
} as EstimateWorkArea;
const kitchenBefore = calculateKitchen(
  { ...ctx(kitchenFacts), confirmedWorkAreas: [kitchenWa] },
  kitchenWa
);
const kitchenAfter = calculateKitchen(
  {
    ...ctx([...kitchenFacts, ...persist([ordinary()])]),
    confirmedWorkAreas: [kitchenWa],
  },
  kitchenWa
);
check(
  "L2. Kitchen calculator is unchanged by nested Flooring facts",
  kitchenAfter.lineItems.length === kitchenBefore.lineItems.length
);

const doorFacts = applyDoorsFactWrite({
  facts: [],
  workAreaId: "d1",
  key: DOORS_PORTIONS_FACT_KEY,
  value: [
    {
      id: "do_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1",
      label: "Hall",
      installation_type: "prehung_internal",
      leaf_construction: "hollow_core",
      height_mm: 1980,
      width_mm: 810,
      quantity: 1,
      hardware_included: true,
      other_description: null,
      specialist_kind: null,
    },
  ],
});
const doorsWa = { id: "d1", type: "doors", name: "Doors", sort_order: 1 } as EstimateWorkArea;
const doorsBefore = calculateDoors(ctx(doorFacts, [doorsWa]), doorsWa);
const doorsAfter = calculateDoors(
  ctx([...doorFacts, ...persist([ordinary()])], [doorsWa, WA]),
  doorsWa
);
check(
  "L3. Doors frozen fixture still prices independently",
  (doorsBefore.lineItems?.length ?? 0) === (doorsAfter.lineItems?.length ?? 0) &&
    read("lib/estimate/doors-identities.ts").includes("DOORS_V1_HUMAN_QA_FROZEN")
);

const iwWa = {
  id: "w1",
  type: "internal_walls",
  name: "Internal walls",
  sort_order: 1,
} as EstimateWorkArea;
const iwFacts: EstimateFact[] = [
  { key: "internal_walls.area_m2", work_area_id: "w1", value: 40 },
];
const iwBefore = calculateInternalWalls(ctx(iwFacts, [iwWa]), iwWa);
const iwAfter = calculateInternalWalls(
  ctx([...iwFacts, ...persist([ordinary()])], [iwWa, WA]),
  iwWa
);
check(
  "L4. Internal Walls calculator is unchanged by nested Flooring facts",
  iwBefore.lineItems.length === iwAfter.lineItems.length
);

const ceilWa = {
  id: "c1",
  type: "ceilings",
  name: "Ceilings",
  sort_order: 1,
} as EstimateWorkArea;
const ceilFacts: EstimateFact[] = [
  { key: "ceilings.area_m2", work_area_id: "c1", value: 20 },
];
const ceilBefore = calculateCeilings(ctx(ceilFacts, [ceilWa]), ceilWa);
const ceilAfter = calculateCeilings(
  ctx([...ceilFacts, ...persist([ordinary()])], [ceilWa, WA]),
  ceilWa
);
check(
  "L5. Ceiling calculator is unchanged by nested Flooring facts",
  ceilBefore.lineItems.length === ceilAfter.lineItems.length
);

const demoWa = {
  id: "dm1",
  type: "demolition",
  name: "Demolition",
  sort_order: 1,
} as EstimateWorkArea;
const demoFacts: EstimateFact[] = [
  { key: "demolition.floor_area_m2", work_area_id: "dm1", value: 30 },
];
const demoBefore = calculateDemolition(ctx(demoFacts, [demoWa]), demoWa);
const demoAfter = calculateDemolition(
  ctx([...demoFacts, ...persist([ordinary()])], [demoWa, WA]),
  demoWa
);
check(
  "L6. Demolition calculator is unchanged by nested Flooring facts",
  demoBefore.lineItems.length === demoAfter.lineItems.length
);
check(
  "L7. Analysis capability still includes flooring",
  getAnalysisCapableWorkAreaTypes().includes("flooring")
);
check(
  "L8. Identities are not aliased to legacy lumps or Bathroom labour, and coverage is not label-parsed",
  (() => {
    const identities = read("lib/estimate/flooring-identities.ts");
    const physicalSrc = read("lib/estimate/flooring-physical.ts");
    return (
      identities.includes(FLOORING_CARPET_SUPPLY_INSTALL_M2) &&
      !identities.includes('"scope.flooring.m2"') &&
      !identities.includes('"flooring.material.m2"') &&
      !identities.includes("bathroom.floor_substrate.install") &&
      identities.includes("ITEM_KEY_SHEET_MM") &&
      !identities.includes("1.62") &&
      physicalSrc.includes("wasteFactor: 0") &&
      !physicalSrc.includes("FITOUT_BENCHMARKS")
    );
  })()
);

check(
  "summary. Custom and specialist summaries stay distinct",
  /Cork-look vinyl/.test(
    summariseFlooringPhysicalPortion(
      ordinary({
        finish_type: "other",
        other_description: "Cork-look vinyl",
        underlay_required: null,
      })
    )
  ) &&
    /specialist pricing required/.test(
      summariseFlooringPhysicalPortion({
        ...createEmptyFlooringPortion({ label: "Entry" }),
        finish_type: "other",
        specialist_kind: "laminate",
        other_description: "Laminate flooring",
        area_input_method: "direct_m2",
        area_m2: 12,
      })
    )
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
