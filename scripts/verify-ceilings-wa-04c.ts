/**
 * CEILINGS WA-04C — linings + tile & grid physical calculator.
 *
 * Run: npx --yes tsx scripts/verify-ceilings-wa-04c.ts
 *
 * No bulkhead, insulation, fixings, labour hours, or commercial money.
 * Preview only.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import {
  calculateCeilingLining,
  CEILING_GRID_M2_KEY,
  CEILING_PLYWOOD_SHEET_KEY,
  CEILING_TILE_600_KEY,
  CEILINGS_PLASTERBOARD_COMPONENT,
  CEILINGS_PLYWOOD_COMPONENT,
  CEILINGS_TILE_GRID_GRID_COMPONENT,
  CEILINGS_TILE_GRID_TILE_COMPONENT,
  CEILINGS_TIMBER_LINING_COMPONENT,
  CEILING_TIMBER_LINING_EDGE_GAP_ASSUMPTION,
  TIMBER_LINING_PROFILE_KEY,
} from "../lib/estimate/ceilings-lining";
import {
  calculateCeilingsPhysical,
  calculatePortionCeilingsPhysical,
  ceilingRequirementNestedItemId,
} from "../lib/estimate/ceilings-physical";
import {
  applyCeilingsFactWrite,
  CEILINGS_NESTED_NOT_CALCULATED_MESSAGE,
  CEILINGS_PORTIONS_FACT_KEY,
  createEmptyCeilingPortion,
  hasCanonicalCeilingsPortions,
  type CeilingPortion,
  type CeilingTileSize,
} from "../lib/estimate/ceilings-portions";
import { dimensionedPlasterboardKey } from "../lib/estimate/internal-walls-lining";
import {
  INTERNAL_WALLS_STANDARD_13_2400_KEY,
  INTERNAL_WALLS_TIMBER_140_KEY,
} from "../lib/estimate/internal-walls-identities";
import { countCoveredAreaSheets } from "../lib/estimate/material-buildups";
import {
  CEILINGS_STEEL_CLIP_COMPONENT,
  CEILINGS_SUSPENSION_DROPPER_COMPONENT,
} from "../lib/estimate/ceilings-steel";
import { CEILINGS_TIMBER_FRAMING_COMPONENT } from "../lib/estimate/ceilings-framing";
import type { EstimateContext, EstimateFact, EstimateWorkArea } from "../lib/estimate/types";
import type { MaterialWastageSettings } from "../lib/settings/material-wastage";

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
  return readFileSync(join(process.cwd(), rel), rel.endsWith(".ts") ? "utf8" : "utf8");
}

const P1 = "aaaaaaaa-bbbb-4ccc-8ddd-111111111111";
const P2 = "bbbbbbbb-cccc-4ddd-8eee-222222222222";

const WASTAGE: MaterialWastageSettings = {
  defaultMaterialWastagePercent: 10,
  sheetMaterialWastagePercent: 10,
  timberFramingWastagePercent: 10,
};

function portion(params: {
  id?: string;
  label?: string;
  family?: CeilingPortion["structure"]["family"];
  lining?: CeilingPortion["lining"]["family"];
  length?: number | null;
  width?: number | null;
  area?: number | null;
  mode?: "length_width" | "area_only";
  product?: CeilingPortion["lining"]["plasterboard_product"];
  thickness?: CeilingPortion["lining"]["thickness_mm"] | null;
  sheetLength?: number;
  sheetWidth?: number;
  layers?: number | null;
  plywoodSpec?: string;
  boardWidth?: number;
  gap?: number;
  direction?: "along_length" | "along_width";
  tileSize?: CeilingTileSize;
  steel?: boolean;
  suspended?: boolean;
}): CeilingPortion {
  const row = createEmptyCeilingPortion({
    id: params.id ?? P1,
    label: params.label ?? "Lounge",
  });
  row.geometry.mode = params.mode ?? "length_width";
  row.geometry.length_m = params.length ?? null;
  row.geometry.width_m = params.width ?? null;
  row.geometry.area_m2 = params.area ?? null;
  row.structure.family = params.family ?? "existing_framing";
  if (params.lining) row.lining.family = params.lining;
  if (params.product) row.lining.plasterboard_product = params.product;
  if (params.thickness !== undefined) {
    row.lining.thickness_mm = params.thickness ?? undefined;
  }
  if (params.sheetLength != null) row.lining.sheet_length_mm = params.sheetLength;
  if (params.sheetWidth != null) row.lining.sheet_width_mm = params.sheetWidth;
  if (params.layers !== undefined) row.lining.layers = params.layers;
  if (params.plywoodSpec) row.lining.plywood_spec = params.plywoodSpec;
  if (params.lining === "timber_lined") {
    row.lining.timber_lined = {
      board_width_mm: params.boardWidth ?? 90,
      gap_mm: params.gap ?? 10,
      direction: params.direction ?? "along_length",
    };
  }
  if (params.tileSize) {
    row.lining.tile = { size: params.tileSize };
  }
  if (params.steel || params.family === "steel_direct_fix") {
    row.structure.steel = {
      primary_spacing_mm: 450,
      furring_spacing_mm: 450,
      direction: "along_length",
    };
  }
  if (params.family === "suspended_steel" || params.suspended) {
    row.structure.steel = {
      primary_spacing_mm: 450,
      furring_spacing_mm: 450,
      direction: "along_length",
    };
    row.structure.suspended = {
      drop_height_m: 0.6,
      max_spacing_m: 1.2,
      edge_offset_m: 0.2,
    };
  }
  if (params.family === "timber_direct_fix") {
    row.structure.timber = {
      size: "140x45_h1.2",
      spacing_mm: 450,
      direction: "along_length",
    };
  }
  return row;
}

function writePortions(
  portions: CeilingPortion[],
  workAreaId = "c1"
): EstimateFact[] {
  return applyCeilingsFactWrite({
    facts: [],
    workAreaId,
    key: CEILINGS_PORTIONS_FACT_KEY,
    value: portions,
  });
}

function wa(id = "c1", name = "Ceilings"): EstimateWorkArea {
  return { id, type: "ceilings", name, sort_order: 1 };
}

function estimateCtx(facts: EstimateFact[]): EstimateContext {
  return {
    project: { id: "ceilings-wa-04c", qualityLevel: "standard" },
    confirmedWorkAreas: [wa()],
    facts,
    constraints: [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
      budget_rate_factor: 0.9,
      premium_rate_factor: 1.15,
    },
    materialWastageSettings: WASTAGE,
    rates: [],
  } as unknown as EstimateContext;
}

function physical(portions: CeilingPortion[], workArea = wa()) {
  return calculateCeilingsPhysical({
    facts: writePortions(portions, workArea.id),
    workArea,
    materialWastageSettings: WASTAGE,
  });
}

function byComponent(
  requirements: readonly { componentKey: string; variantKey?: string }[],
  componentKey: string,
  nestedItemId?: string
) {
  return requirements.find(
    (row) =>
      row.componentKey === componentKey &&
      (nestedItemId == null || row.variantKey === nestedItemId)
  );
}

console.log("=== CEILINGS WA-04C linings + tile & grid ===\n");

const counted = countCoveredAreaSheets({
  areaM2: 12,
  sheetLengthM: 3,
  sheetWidthM: 1.2,
  wastagePercent: 10,
});
check(
  "shared area sheet helper: 12 / 3.6 → 4 installed / 5 purchase",
  counted?.installedSheets === 4 && counted.purchaseSheets === 5
);

const pb = calculateCeilingLining(
  portion({
    family: "existing_framing",
    lining: "plasterboard",
    length: 4,
    width: 3,
    product: "standard",
    thickness: 13,
    sheetLength: 3000,
    sheetWidth: 1200,
  }),
  undefined,
  WASTAGE
);
check(
  "A plasterboard 12m² / 3x1.2 → 4 installed sheets",
  pb.status === "ok" && pb.installedSheets === 4 && pb.installedSheetsPerLayer === 4
);
check(
  "B 10% waste → 5 purchase sheets",
  pb.purchaseSheets === 5 && pb.wasteFactor === 0.1
);
check(
  "C labour basis later remains 4, not 5",
  pb.labourBasisInstalled === 4 &&
    pb.labourBasisUnit === "sheet" &&
    pb.labourBasisInstalled !== pb.purchaseSheets
);

const pbPhysical = physical([
  portion({
    family: "existing_framing",
    lining: "plasterboard",
    length: 4,
    width: 3,
    product: "standard",
    thickness: 13,
    sheetLength: 3000,
    sheetWidth: 1200,
  }),
]);
const pbReq = byComponent(pbPhysical.requirements, CEILINGS_PLASTERBOARD_COMPONENT, P1);
const expectedPbKey = dimensionedPlasterboardKey({
  product: "standard_gib",
  thicknessMm: 13,
  lengthMm: 3000,
  widthMm: 1200,
});
check(
  "C requirement installed/purchase split",
  pbReq?.baseQuantity === 4 &&
    pbReq.purchaseQuantity === 5 &&
    pbReq.wasteFactor === 0.1 &&
    pbReq.priced === false
);

const areaOnly = calculateCeilingLining(
  portion({
    family: "existing_framing",
    lining: "plasterboard",
    mode: "area_only",
    length: null,
    width: null,
    area: 30,
    product: "standard",
    thickness: 13,
    sheetLength: 3000,
    sheetWidth: 1200,
  }),
  undefined,
  WASTAGE
);
check(
  "D area-only existing-frame plasterboard works",
  areaOnly.status === "ok" &&
    areaOnly.areaM2 === 30 &&
    areaOnly.installedSheets === Math.ceil(30 / 3.6) &&
    areaOnly.sheetLengthM === 3
);

check(
  "E plasterboard product identity shared, not Ceilings-specific",
  pb.product.kind === "canonical" &&
    pb.product.materialKey === expectedPbKey &&
    pb.product.materialKey?.startsWith("sheet.plasterboard.") === true &&
    pb.product.materialKey !== INTERNAL_WALLS_STANDARD_13_2400_KEY &&
    !pb.product.materialKey?.startsWith("ceilings.") &&
    pbReq?.materialKey === expectedPbKey
);

const otherPb = calculateCeilingLining(
  portion({
    family: "existing_framing",
    lining: "plasterboard",
    length: 4,
    width: 3,
    product: "other",
    thickness: 13,
    sheetLength: 3000,
    sheetWidth: 1200,
  }),
  undefined,
  WASTAGE
);
check(
  "F unresolved plasterboard product not silently Standard",
  otherPb.status === "ok" &&
    otherPb.installedSheets === 4 &&
    otherPb.product.kind === "custom" &&
    otherPb.product.materialKey == null &&
    otherPb.product.materialKey !== INTERNAL_WALLS_STANDARD_13_2400_KEY &&
    otherPb.product.materialKey !== expectedPbKey
);

const ply = calculateCeilingLining(
  portion({
    family: "existing_framing",
    lining: "plywood",
    length: 4,
    width: 3,
    sheetLength: 2400,
    sheetWidth: 1200,
    plywoodSpec: "Plywood ceiling lining",
  }),
  undefined,
  WASTAGE
);
check(
  "G plywood 12m² / 2.4x1.2 → 5 installed",
  ply.status === "ok" && ply.installedSheets === 5
);
check("H 10% waste → 6 purchase", ply.purchaseSheets === 6);
check(
  "I plywood identity distinct from plasterboard",
  ply.product.materialKey === CEILING_PLYWOOD_SHEET_KEY &&
    ply.product.materialKey !== expectedPbKey &&
    !String(ply.product.materialKey).includes("plasterboard") &&
    physical([
      portion({
        lining: "plywood",
        length: 4,
        width: 3,
        sheetLength: 2400,
        sheetWidth: 1200,
      }),
    ]).requirements.some((row) => row.componentKey === CEILINGS_PLYWOOD_COMPONENT)
);

const timberAreaOnly = calculateCeilingLining(
  portion({
    family: "existing_framing",
    lining: "timber_lined",
    mode: "area_only",
    length: null,
    width: null,
    area: 12,
    boardWidth: 90,
    gap: 10,
  }),
  undefined,
  WASTAGE
);
check(
  "J timber-lined area-only rejected",
  timberAreaOnly.status === "information_required" &&
    timberAreaOnly.installedLm == null
);

const timberLined = calculateCeilingLining(
  portion({
    family: "existing_framing",
    lining: "timber_lined",
    length: 4,
    width: 3,
    boardWidth: 90,
    gap: 10,
    direction: "along_length",
  }),
  undefined,
  WASTAGE
);
check(
  "K timber-lined 4x3 / 90mm + 10mm / along_length → 30 runs / 120lm",
  timberLined.status === "ok" &&
    timberLined.numberOfRuns === 30 &&
    timberLined.installedLm === 120
);
check(
  "L timber edge-gap convention recorded",
  timberLined.edgeGapConvention === CEILING_TIMBER_LINING_EDGE_GAP_ASSUMPTION &&
    timberLined.product.materialKey === TIMBER_LINING_PROFILE_KEY &&
    !TIMBER_LINING_PROFILE_KEY.startsWith("timber.framing.") &&
    physical([
      portion({
        lining: "timber_lined",
        length: 4,
        width: 3,
        boardWidth: 90,
        gap: 10,
      }),
    ]).requirements.some((row) => row.componentKey === CEILINGS_TIMBER_LINING_COMPONENT)
);

const badBoard = calculateCeilingLining(
  portion({
    lining: "timber_lined",
    length: 4,
    width: 3,
    boardWidth: -90,
    gap: 10,
  }),
  undefined,
  WASTAGE
);
check(
  "M invalid board width rejected",
  badBoard.status === "invalid" && timberLined.installedLm === 120
);

const negGapPortion = portion({
  lining: "timber_lined",
  length: 4,
  width: 3,
  boardWidth: 90,
  gap: 10,
});
negGapPortion.lining.timber_lined = {
  board_width_mm: 90,
  gap_mm: -10,
  direction: "along_length",
};
const badGap = calculateCeilingLining(negGapPortion, undefined, WASTAGE);
check(
  "N invalid negative gap rejected",
  badGap.status === "invalid" && badGap.installedLm == null
);

const tile = calculateCeilingLining(
  portion({
    family: "tile_and_grid",
    lining: "tile_and_grid",
    mode: "area_only",
    length: null,
    width: null,
    area: 30,
    tileSize: "600x600",
  }),
  undefined,
  WASTAGE
);
const tilePhysical = physical([
  portion({
    family: "tile_and_grid",
    lining: "tile_and_grid",
    mode: "area_only",
    length: null,
    width: null,
    area: 30,
    tileSize: "600x600",
  }),
]);
const gridReq = byComponent(
  tilePhysical.requirements,
  CEILINGS_TILE_GRID_GRID_COMPONENT,
  P1
);
const tileReq = byComponent(
  tilePhysical.requirements,
  CEILINGS_TILE_GRID_TILE_COMPONENT,
  P1
);
check(
  "O Tile/Grid 30m² → grid 30m²",
  tile.status === "ok" &&
    tile.gridAreaM2 === 30 &&
    gridReq?.baseQuantity === 30 &&
    gridReq.baseUnit === "m2" &&
    gridReq.materialKey === CEILING_GRID_M2_KEY &&
    gridReq.wasteFactor === 0
);
check(
  "P 600x600 → 84 installed tiles",
  tile.installedTiles === 84 && tileReq?.baseQuantity === 84
);
check(
  "Q 10% waste → 93 purchase tiles",
  tile.purchaseTiles === 93 &&
    tileReq?.purchaseQuantity === 93 &&
    tileReq.materialKey === CEILING_TILE_600_KEY
);
check(
  "R Tile/Grid emits NO timber frame",
  tilePhysical.requirements.every(
    (row) => row.componentKey !== CEILINGS_TIMBER_FRAMING_COMPONENT
  ) &&
    tilePhysical.portions[0]?.timber.status === "not_applicable"
);
check(
  "S Tile/Grid emits NO plasterboard steel frame",
  tilePhysical.requirements.every(
    (row) => !row.componentKey.startsWith("ceilings.framing.steel")
  )
);
check(
  "T Tile/Grid emits NO plasterboard suspension frame",
  tilePhysical.requirements.every(
    (row) => !row.componentKey.startsWith("ceilings.suspension")
  ) &&
    !tilePhysical.requirements.some(
      (row) => row.componentKey === CEILINGS_SUSPENSION_DROPPER_COMPONENT
    )
);

const missingTile = calculateCeilingLining(
  portion({
    family: "tile_and_grid",
    lining: "tile_and_grid",
    mode: "area_only",
    area: 30,
  }),
  undefined,
  WASTAGE
);
check(
  "U missing tile size not silently 600x600 in physical calculator",
  missingTile.status === "information_required" &&
    missingTile.installedTiles == null &&
    missingTile.tileSize == null &&
    !read("lib/estimate/ceilings-lining.ts").includes('?? "600x600"') &&
    !read("lib/estimate/ceilings-lining.ts").includes("?? '600x600'")
);

const incompatible = createEmptyCeilingPortion({ id: P1, label: "Mixed" });
incompatible.structure.family = "timber_direct_fix";
incompatible.lining.family = "tile_and_grid";
incompatible.geometry.mode = "length_width";
incompatible.geometry.length_m = 4;
incompatible.geometry.width_m = 3;
incompatible.structure.timber = {
  size: "140x45_h1.2",
  spacing_mm: 450,
  direction: "along_length",
};
incompatible.lining.tile = { size: "600x600" };
const incompatibleDirect = calculateCeilingLining(incompatible, undefined, WASTAGE);
const incompatiblePortion = calculatePortionCeilingsPhysical({
  workArea: wa(),
  portion: incompatible,
  materialWastageSettings: WASTAGE,
});
check(
  "V incompatible grid/lining state safely rejected",
  incompatibleDirect.status === "information_required" &&
    incompatibleDirect.installedTiles == null &&
    incompatiblePortion.portion.lining.status === "information_required" &&
    incompatiblePortion.requirements.length === 0
);

const twoPb = physical([
  portion({
    id: P1,
    label: "A",
    lining: "plasterboard",
    length: 4,
    width: 3,
    product: "standard",
    thickness: 13,
    sheetLength: 3000,
    sheetWidth: 1200,
  }),
  portion({
    id: P2,
    label: "B",
    lining: "plasterboard",
    length: 4,
    width: 3,
    product: "standard",
    thickness: 13,
    sheetLength: 3000,
    sheetWidth: 1200,
  }),
]);
const twoPbReqs = twoPb.requirements.filter(
  (row) => row.componentKey === CEILINGS_PLASTERBOARD_COMPONENT
);
check(
  "W multi-Portion same plasterboard remains physically separate",
  twoPbReqs.length === 2 &&
    twoPbReqs[0]?.variantKey === P1 &&
    twoPbReqs[1]?.variantKey === P2 &&
    twoPbReqs[0]?.requirementId !== twoPbReqs[1]?.requirementId &&
    twoPbReqs[0]?.baseQuantity === 4 &&
    twoPbReqs[1]?.baseQuantity === 4
);

const ground = calculateCeilingsPhysical({
  facts: [
    ...writePortions(
      [
        portion({
          id: P1,
          lining: "plasterboard",
          length: 4,
          width: 3,
          product: "standard",
          thickness: 13,
          sheetLength: 3000,
          sheetWidth: 1200,
        }),
      ],
      "c-ground"
    ),
    ...writePortions(
      [
        portion({
          id: P2,
          lining: "plasterboard",
          length: 4,
          width: 3,
          product: "standard",
          thickness: 13,
          sheetLength: 3000,
          sheetWidth: 1200,
        }),
      ],
      "c-garage"
    ),
  ],
  workArea: wa("c-ground", "Ground Floor Ceilings"),
  materialWastageSettings: WASTAGE,
});
const garage = calculateCeilingsPhysical({
  facts: [
    ...writePortions(
      [
        portion({
          id: P1,
          lining: "plasterboard",
          length: 4,
          width: 3,
          product: "standard",
          thickness: 13,
          sheetLength: 3000,
          sheetWidth: 1200,
        }),
      ],
      "c-ground"
    ),
    ...writePortions(
      [
        portion({
          id: P2,
          lining: "plasterboard",
          length: 4,
          width: 3,
          product: "standard",
          thickness: 13,
          sheetLength: 3000,
          sheetWidth: 1200,
        }),
      ],
      "c-garage"
    ),
  ],
  workArea: wa("c-garage", "Garage Ceilings"),
  materialWastageSettings: WASTAGE,
});
check(
  "X repeated Ceiling WAs remain separate",
  ground.workAreaId === "c-ground" &&
    garage.workAreaId === "c-garage" &&
    ground.requirements.every((row) => row.workAreaId === "c-ground") &&
    garage.requirements.every((row) => row.workAreaId === "c-garage")
);

const existingPlus = physical([
  portion({
    family: "existing_framing",
    lining: "plasterboard",
    mode: "area_only",
    length: null,
    width: null,
    area: 30,
    product: "standard",
    thickness: 13,
    sheetLength: 3000,
    sheetWidth: 1200,
  }),
]);
check(
  "Y existing framing + plasterboard emits lining only",
  existingPlus.requirements.some(
    (row) => row.componentKey === CEILINGS_PLASTERBOARD_COMPONENT
  ) &&
    existingPlus.requirements.every(
      (row) =>
        row.componentKey !== CEILINGS_TIMBER_FRAMING_COMPONENT &&
        !row.componentKey.startsWith("ceilings.framing.steel")
    ) &&
    existingPlus.portions[0]?.timber.status === "not_applicable"
);

const timberPlus = physical([
  portion({
    family: "timber_direct_fix",
    lining: "plasterboard",
    length: 4,
    width: 3,
    product: "standard",
    thickness: 13,
    sheetLength: 3000,
    sheetWidth: 1200,
  }),
]);
check(
  "Z timber frame + plasterboard emits both physical groups",
  timberPlus.requirements.some(
    (row) =>
      row.componentKey === CEILINGS_TIMBER_FRAMING_COMPONENT &&
      row.materialKey === INTERNAL_WALLS_TIMBER_140_KEY
  ) &&
    timberPlus.requirements.some(
      (row) => row.componentKey === CEILINGS_PLASTERBOARD_COMPONENT
    )
);

const steelPlus = physical([
  portion({
    family: "steel_direct_fix",
    lining: "plasterboard",
    length: 4,
    width: 3,
    product: "standard",
    thickness: 13,
    sheetLength: 3000,
    sheetWidth: 1200,
    steel: true,
  }),
]);
check(
  "AA steel frame + plasterboard emits both physical groups",
  steelPlus.requirements.some(
    (row) => row.componentKey === CEILINGS_STEEL_CLIP_COMPONENT
  ) &&
    steelPlus.requirements.some(
      (row) => row.componentKey === CEILINGS_PLASTERBOARD_COMPONENT
    ) &&
    steelPlus.portions[0]?.steel.clipCount === 80
);

const suspendedPlus = physical([
  portion({
    family: "suspended_steel",
    lining: "plasterboard",
    length: 4,
    width: 3,
    product: "standard",
    thickness: 13,
    sheetLength: 3000,
    sheetWidth: 1200,
    suspended: true,
  }),
]);
check(
  "AB suspended steel + plasterboard emits both physical groups",
  suspendedPlus.requirements.some(
    (row) => row.componentKey === CEILINGS_SUSPENSION_DROPPER_COMPONENT
  ) &&
    suspendedPlus.requirements.some(
      (row) => row.componentKey === CEILINGS_PLASTERBOARD_COMPONENT
    ) &&
    suspendedPlus.portions[0]?.suspended.dropperCount === 16
);

check(
  "AC no bulkhead takeoff yet",
  !read("lib/estimate/ceilings-lining.ts").includes("ceilings.bulkhead") &&
    !tilePhysical.requirements.some((row) =>
      row.componentKey.startsWith("ceilings.bulkhead")
    )
);
check(
  "AD no insulation takeoff yet",
  !read("lib/estimate/ceilings-lining.ts").includes("ceilings.insulation") &&
    !tilePhysical.requirements.some((row) =>
      row.componentKey.includes("insulation")
    )
);
check(
  "AE no fixings takeoff yet",
  !read("lib/estimate/ceilings-lining.ts").includes("ceilings.fixings") &&
    !tilePhysical.requirements.some((row) =>
      row.componentKey.includes("fixing")
    )
);
check(
  "AF no labour/money",
  !read("lib/estimate/ceilings-lining.ts").includes("hoursPer") &&
    !read("lib/estimate/ceilings-physical.ts").includes("hoursPer") &&
    !read("lib/estimate/ceilings-physical.ts").includes("priced: true") &&
    pbReq?.priced === false &&
    pbReq.unitCost == null
);

const nestedHosted = calculateEstimate(
  estimateCtx(
    writePortions([
      portion({
        lining: "plasterboard",
        length: 4,
        width: 3,
        product: "standard",
        thickness: 13,
        sheetLength: 3000,
        sheetWidth: 1200,
      }),
    ])
  )
);
check(
  "AG nested Ceiling uses the new engine, never the temporary guard",
  nestedHosted.lineItems.length > 0 &&
    !nestedHosted.missingInfo.some((row) =>
      row.includes(CEILINGS_NESTED_NOT_CALCULATED_MESSAGE)
    ) &&
    !nestedHosted.lineItems.some((item) =>
      /materials allowance/i.test(item.label)
    ) &&
    read("lib/estimate/calculators/fitout.ts").includes("calculateCeilingsPhysical") &&
    read("lib/estimate/calculators/fitout.ts").includes("commercializeCeilings")
);

const legacyFacts: EstimateFact[] = [
  { key: "ceilings.area_m2", work_area_id: "c1", value: 30 },
  { key: "ceilings.structure_type", work_area_id: "c1", value: "Existing structure" },
  { key: "ceilings.ceiling_type", work_area_id: "c1", value: "Plasterboard" },
];
const legacyEstimate = calculateEstimate(estimateCtx(legacyFacts));
const legacyPhysical = calculateCeilingsPhysical({
  facts: legacyFacts,
  workArea: wa(),
});
check(
  "AH legacy flat calculator unchanged",
  !hasCanonicalCeilingsPortions(legacyFacts, "c1") &&
    legacyEstimate.lineItems.length > 0 &&
    !legacyEstimate.missingInfo.some((row) =>
      row.includes(CEILINGS_NESTED_NOT_CALCULATED_MESSAGE)
    ) &&
    legacyPhysical.source === "legacy_skipped" &&
    read("lib/estimate/calculators/fitout.ts").includes("LEGACY CEILINGS CALCULATOR")
);

check(
  "U/V provenance nestedItemId + workAreaId",
  pbReq?.variantKey === P1 &&
    ceilingRequirementNestedItemId(pbReq) === P1 &&
    pbReq.workAreaId === "c1" &&
    pbPhysical.portions[0]?.nestedItemId === P1
);

check(
  "no calculateSheetCount default in lining kernel",
  read("lib/estimate/ceilings-lining.ts").includes("countCoveredAreaSheets") &&
    !read("lib/estimate/ceilings-lining.ts").includes("calculateSheetCount") &&
    !read("lib/estimate/ceilings-physical.ts").includes("calculateSheetCount")
);

if (failed > 0) {
  console.log(`\n${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`\nAll ${passed} CEILINGS WA-04C checks passed.`);
