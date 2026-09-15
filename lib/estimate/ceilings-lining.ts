/**
 * CEILINGS WA-04C — lining and tile & grid physical takeoff.
 *
 * Canonical lining.family is authority. Stale sub-objects do not start a
 * second lining calculator. Nested downstands, thermal fill, and
 * consumables are out of scope. No labour hours.
 *
 * Sheet/tile counts use countCoveredAreaSheets (generic area helper).
 * The legacy fitout sheet helper is not used here.
 */

import { round2 } from "@/lib/estimate/facts";
import { countCoveredAreaSheets } from "@/lib/estimate/material-buildups";
import { RUN_COUNT_SPACING_EPSILON } from "@/lib/estimate/run-count";
import {
  PHYSICAL_REQUIREMENT_RESOLUTION,
  type PhysicalRequirementResolution,
} from "@/lib/estimate/physical-requirement-resolution";
import {
  dimensionedPlasterboardKey,
  internalWallsLiningMaterialKey,
} from "@/lib/estimate/internal-walls-lining";
import {
  INTERNAL_WALLS_AQUALINE_13_2400_KEY,
  INTERNAL_WALLS_FYRELINE_13_2400_KEY,
  INTERNAL_WALLS_STANDARD_13_2400_KEY,
} from "@/lib/estimate/internal-walls-identities";
import { isLiningThicknessSupported } from "@/lib/estimate/internal-walls-wall-types";
import type { MaterialIdentity } from "@/lib/materials/identity";
import type {
  CeilingDirection,
  CeilingLiningFamily,
  CeilingPlasterboardProduct,
  CeilingPlasterboardThicknessMm,
  CeilingPortion,
  CeilingTileSize,
} from "@/lib/estimate/ceilings-portions";
import {
  deriveCeilingGeometry,
  type CeilingGeometryTakeoff,
} from "@/lib/estimate/ceilings-geometry";
import type { MaterialWastageSettings } from "@/lib/settings/material-wastage";
import { resolveMaterialWastage } from "@/lib/settings/material-wastage";
import {
  CEILINGS_LINING_LAYERS_ASSUMPTION,
  CEILINGS_LINING_LAYERS_ASSUMPTION_STATEMENT,
  CEILINGS_PLASTERBOARD_SHEET_LENGTH_ASSUMPTION_MM,
  CEILINGS_PLASTERBOARD_SHEET_SIZE_ASSUMPTION_STATEMENT,
  CEILINGS_PLASTERBOARD_SHEET_WIDTH_ASSUMPTION_MM,
} from "@/lib/estimate/ceilings-information-contract";
import {
  ceilingAllowsDisclosedPlasterboardLayers,
  ceilingAllowsDisclosedPlasterboardSheetSize,
  ceilingAllowsDisclosedPlasterboardSheetWidth,
} from "@/lib/estimate/ceilings-disclosed-lining";

export const CEILINGS_PLASTERBOARD_COMPONENT =
  "ceilings.lining.plasterboard.material" as const;
export const CEILINGS_PLYWOOD_COMPONENT =
  "ceilings.lining.plywood.material" as const;
export const CEILINGS_TIMBER_LINING_COMPONENT =
  "ceilings.lining.timber.material" as const;
export const CEILINGS_TILE_GRID_GRID_COMPONENT =
  "ceilings.tile_grid.grid" as const;
export const CEILINGS_TILE_GRID_TILE_COMPONENT =
  "ceilings.tile_grid.tile" as const;

export const CEILING_PLYWOOD_SHEET_KEY = "sheet.plywood.each" as const;
export const TIMBER_LINING_PROFILE_KEY = "timber.lining.profile.lm" as const;
export const CEILING_GRID_M2_KEY = "ceiling.grid.m2" as const;
export const CEILING_TILE_300_KEY = "ceiling.tile.300x300.each" as const;
export const CEILING_TILE_600_KEY = "ceiling.tile.600x600.each" as const;
export const CEILING_TILE_1200_600_KEY = "ceiling.tile.1200x600.each" as const;

/** EST-BENCHMARK-01B — ordinary generic commercial tile/grid COST. Not specialty. */
export const CEILING_TILE_GRID_QUOTR_COST = {
  gridM2: 15,
  tile300Each: 4,
  tile600Each: 16,
  tile1200x600Each: 19,
} as const;

export const CEILING_TIMBER_LINING_EDGE_GAP_ASSUMPTION =
  "Edge gap on both sides equals the selected inter-board gap." as const;

export type CeilingLayerCountSource = "known" | "assumed_disclosed";
export type CeilingSheetSizeSource = "known" | "assumed_disclosed";

export type CeilingLiningStatus =
  | "ok"
  | "not_applicable"
  | "information_required"
  | "invalid";

export type CeilingLiningKind =
  | "none"
  | "plasterboard"
  | "plywood"
  | "timber_lined"
  | "tile_and_grid";

export type CeilingSheetProductResolution =
  | {
      readonly kind: "canonical";
      readonly materialKey: string;
      readonly materialIdentity: MaterialIdentity;
      readonly specification: string;
    }
  | {
      readonly kind: "custom";
      readonly materialKey: string | null;
      readonly materialIdentity: MaterialIdentity;
      readonly specification: string;
    }
  | {
      readonly kind: "unresolved";
      readonly materialKey: null;
      readonly materialIdentity: null;
      readonly specification: string;
    };

export type CeilingLiningTakeoff = {
  readonly status: CeilingLiningStatus;
  readonly resolution: PhysicalRequirementResolution;
  readonly reason: string | null;
  readonly nestedItemId: string;
  readonly family: CeilingLiningKind;
  readonly areaM2: number | null;
  readonly sheetLengthM: number | null;
  readonly sheetWidthM: number | null;
  readonly layerCount: number | null;
  readonly layerCountSource: CeilingLayerCountSource | null;
  readonly layerAssumption: string | null;
  readonly sheetSizeSource: CeilingSheetSizeSource | null;
  readonly sheetSizeAssumption: string | null;
  readonly installedSheetsPerLayer: number | null;
  readonly purchaseSheetsPerLayer: number | null;
  readonly installedSheets: number | null;
  readonly purchaseSheets: number | null;
  readonly wasteFactor: number | null;
  readonly labourBasisInstalled: number | null;
  readonly labourBasisUnit: "sheet" | "lm" | "m2" | "each" | null;
  readonly direction: CeilingDirection | null;
  readonly runLengthM: number | null;
  readonly crossDimensionM: number | null;
  readonly boardCoverWidthM: number | null;
  readonly gapM: number | null;
  readonly moduleM: number | null;
  readonly effectiveCrossM: number | null;
  readonly numberOfRuns: number | null;
  readonly installedLm: number | null;
  readonly purchaseLm: number | null;
  readonly edgeGapConvention: string | null;
  readonly tileSize: CeilingTileSize | null;
  readonly tileLengthM: number | null;
  readonly tileWidthM: number | null;
  readonly installedTiles: number | null;
  readonly purchaseTiles: number | null;
  readonly gridAreaM2: number | null;
  readonly product: CeilingSheetProductResolution;
};

function liningIdentity(
  family: string,
  productFamily: string,
  description: string
): MaterialIdentity {
  return {
    family,
    productFamily,
    section: null,
    grade: null,
    treatment: null,
    treatmentKind: "unknown",
    treatmentCustom: null,
    processing: null,
    processingKind: "unknown",
    species: null,
    originalDescription: description,
  };
}

export const CEILING_PLYWOOD_IDENTITY = liningIdentity(
  "plywood",
  "sheet",
  "Plywood sheet"
);
export const TIMBER_LINING_PROFILE_IDENTITY = liningIdentity(
  "timber",
  "lining_profile",
  "Ceiling timber lining / profile"
);
export const CEILING_GRID_IDENTITY = liningIdentity(
  "ceiling",
  "tile_grid",
  "Ceiling T-grid system"
);

const TILE_SIZE_MM: Record<CeilingTileSize, { length: number; width: number }> = {
  "300x300": { length: 300, width: 300 },
  "600x600": { length: 600, width: 600 },
  "1200x600": { length: 1200, width: 600 },
};

const TILE_KEYS: Record<CeilingTileSize, string> = {
  "300x300": CEILING_TILE_300_KEY,
  "600x600": CEILING_TILE_600_KEY,
  "1200x600": CEILING_TILE_1200_600_KEY,
};

function emptyTakeoff(
  nestedItemId: string,
  status: CeilingLiningStatus,
  reason: string | null,
  family: CeilingLiningKind = "none",
  product: CeilingSheetProductResolution = {
    kind: "unresolved",
    materialKey: null,
    materialIdentity: null,
    specification: "Lining is not resolved",
  }
): CeilingLiningTakeoff {
  return {
    status,
    resolution:
      status === "ok"
        ? PHYSICAL_REQUIREMENT_RESOLUTION.DERIVED
        : status === "not_applicable"
          ? PHYSICAL_REQUIREMENT_RESOLUTION.KNOWN
          : PHYSICAL_REQUIREMENT_RESOLUTION.INFORMATION_REQUIRED,
    reason,
    nestedItemId,
    family,
    areaM2: null,
    sheetLengthM: null,
    sheetWidthM: null,
    layerCount: null,
    layerCountSource: null,
    layerAssumption: null,
    sheetSizeSource: null,
    sheetSizeAssumption: null,
    installedSheetsPerLayer: null,
    purchaseSheetsPerLayer: null,
    installedSheets: null,
    purchaseSheets: null,
    wasteFactor: null,
    labourBasisInstalled: null,
    labourBasisUnit: null,
    direction: null,
    runLengthM: null,
    crossDimensionM: null,
    boardCoverWidthM: null,
    gapM: null,
    moduleM: null,
    effectiveCrossM: null,
    numberOfRuns: null,
    installedLm: null,
    purchaseLm: null,
    edgeGapConvention: null,
    tileSize: null,
    tileLengthM: null,
    tileWidthM: null,
    installedTiles: null,
    purchaseTiles: null,
    gridAreaM2: null,
    product,
  };
}

function classifyPositive(value: unknown): "missing" | "invalid" | "ok" {
  if (value == null) return "missing";
  if (typeof value !== "number" || !Number.isFinite(value)) return "invalid";
  if (value < 0) return "invalid";
  if (value === 0) return "missing";
  return "ok";
}

function classifyNonNegative(value: unknown): "missing" | "invalid" | "ok" {
  if (value == null) return "missing";
  if (typeof value !== "number" || !Number.isFinite(value)) return "invalid";
  if (value < 0) return "invalid";
  return "ok";
}

function mapCeilingPlasterboardProduct(
  product: CeilingPlasterboardProduct
): "standard_gib" | "aqualine" | "fyreline" | null {
  if (product === "standard") return "standard_gib";
  if (product === "aqualine") return "aqualine";
  if (product === "fyreline") return "fyreline";
  return null;
}

function plasterboardLabel(product: CeilingPlasterboardProduct): string {
  if (product === "standard") return "Standard GIB";
  if (product === "aqualine") return "Aqualine";
  if (product === "fyreline") return "Fyreline";
  return "Other plasterboard";
}

export function resolveCeilingPlasterboardProduct(
  product: CeilingPlasterboardProduct | undefined,
  thickness: CeilingPlasterboardThicknessMm | undefined,
  lengthMm: number,
  widthMm: number
): CeilingSheetProductResolution {
  if (product == null) {
    return {
      kind: "unresolved",
      materialKey: null,
      materialIdentity: null,
      specification: "Plasterboard product is not resolved",
    };
  }
  if (thickness == null) {
    return {
      kind: "unresolved",
      materialKey: null,
      materialIdentity: null,
      specification: "Plasterboard thickness is not resolved",
    };
  }
  if (product === "other" || thickness === "other") {
    const spec =
      thickness === "other"
        ? `${plasterboardLabel(product)} — specified thickness unresolved`
        : `${plasterboardLabel(product)} — identity unresolved`;
    return {
      kind: "custom",
      materialKey: null,
      materialIdentity: liningIdentity("plasterboard", "sheet", spec),
      specification: spec,
    };
  }
  const iwProduct = mapCeilingPlasterboardProduct(product);
  if (!iwProduct) {
    return {
      kind: "unresolved",
      materialKey: null,
      materialIdentity: null,
      specification: "Plasterboard product is not resolved",
    };
  }
  const specification = `${thickness} mm ${plasterboardLabel(product)} ${lengthMm} × ${widthMm}`;
  if (!isLiningThicknessSupported(iwProduct, thickness)) {
    return {
      kind: "custom",
      materialKey: null,
      materialIdentity: liningIdentity("plasterboard", "sheet", specification),
      specification: `${specification} — identity unresolved`,
    };
  }
  const resolved = internalWallsLiningMaterialKey({
    product: iwProduct,
    thicknessMm: thickness,
    lengthMm,
    widthMm,
  });
  const materialKey =
    resolved.materialKey ??
    dimensionedPlasterboardKey({
      product: iwProduct,
      thicknessMm: thickness,
      lengthMm,
      widthMm,
    });
  if (!materialKey) {
    return {
      kind: "custom",
      materialKey: null,
      materialIdentity: liningIdentity("plasterboard", "sheet", specification),
      specification: `${specification} — identity unresolved`,
    };
  }
  return {
    kind: "canonical",
    materialKey: materialKey as string,
    materialIdentity: liningIdentity("plasterboard", "sheet", specification),
    specification,
  };
}

export function ceilingTileMaterialKey(size: CeilingTileSize): string {
  return TILE_KEYS[size];
}

export function tileAndGridFamiliesDisagree(portion: CeilingPortion): boolean {
  const structureTile = portion.structure.family === "tile_and_grid";
  const liningTile = portion.lining.family === "tile_and_grid";
  return structureTile !== liningTile;
}

function sheetDimsFromPortion(portion: CeilingPortion): {
  lengthState: "missing" | "invalid" | "ok";
  widthState: "missing" | "invalid" | "ok";
  lengthMm: number | null;
  widthMm: number | null;
} {
  const lengthState = classifyPositive(portion.lining.sheet_length_mm);
  const widthState = classifyPositive(portion.lining.sheet_width_mm);
  return {
    lengthState,
    widthState,
    lengthMm: lengthState === "ok" ? (portion.lining.sheet_length_mm as number) : null,
    widthMm: widthState === "ok" ? (portion.lining.sheet_width_mm as number) : null,
  };
}

export function resolveCeilingPlasterboardSheetDims(portion: CeilingPortion): {
  lengthState: "missing" | "invalid" | "ok";
  widthState: "missing" | "invalid" | "ok";
  lengthMm: number | null;
  widthMm: number | null;
  source: CeilingSheetSizeSource | null;
} {
  const dims = sheetDimsFromPortion(portion);
  if (dims.lengthState === "invalid" || dims.widthState === "invalid") {
    return { ...dims, source: null };
  }
  let lengthMm = dims.lengthMm;
  let widthMm = dims.widthMm;
  let assumedLength = false;
  let assumedWidth = false;
  if (
    widthMm == null &&
    (lengthMm != null || ceilingAllowsDisclosedPlasterboardSheetSize(portion)) &&
    ceilingAllowsDisclosedPlasterboardSheetWidth(portion)
  ) {
    widthMm = CEILINGS_PLASTERBOARD_SHEET_WIDTH_ASSUMPTION_MM;
    assumedWidth = true;
  }
  if (
    lengthMm == null &&
    (widthMm == null ||
      widthMm === CEILINGS_PLASTERBOARD_SHEET_WIDTH_ASSUMPTION_MM) &&
    ceilingAllowsDisclosedPlasterboardSheetSize(portion)
  ) {
    lengthMm = CEILINGS_PLASTERBOARD_SHEET_LENGTH_ASSUMPTION_MM;
    assumedLength = true;
  }
  if (lengthMm == null || widthMm == null) {
    return { ...dims, lengthMm, widthMm, source: null };
  }
  const source: CeilingSheetSizeSource =
    assumedLength || assumedWidth ? "assumed_disclosed" : "known";
  return {
    lengthState: "ok",
    widthState: "ok",
    lengthMm,
    widthMm,
    source,
  };
}

function areaFromGeometry(geometry: CeilingGeometryTakeoff): number | null {
  if (geometry.status !== "ok" || geometry.area_m2 == null || !(geometry.area_m2 > 0)) {
    return null;
  }
  return geometry.area_m2;
}

function plasterboardTakeoff(params: {
  portion: CeilingPortion;
  geometry: CeilingGeometryTakeoff;
  wastagePercent: number;
}): CeilingLiningTakeoff {
  const nestedItemId = params.portion.id;
  const productCode = params.portion.lining.plasterboard_product;
  const unresolvedProduct: CeilingSheetProductResolution = {
    kind: "unresolved",
    materialKey: null,
    materialIdentity: null,
    specification: "Plasterboard product is not resolved",
  };
  if (params.geometry.status === "invalid") {
    return emptyTakeoff(
      nestedItemId,
      "invalid",
      params.geometry.reason,
      "plasterboard",
      unresolvedProduct
    );
  }
  const areaM2 = areaFromGeometry(params.geometry);
  if (areaM2 == null) {
    return emptyTakeoff(
      nestedItemId,
      params.geometry.status === "information_required"
        ? "information_required"
        : "information_required",
      params.geometry.reason ?? "Plasterboard lining needs a ceiling area.",
      "plasterboard",
      unresolvedProduct
    );
  }
  if (productCode == null) {
    return emptyTakeoff(
      nestedItemId,
      "information_required",
      "Plasterboard product is required.",
      "plasterboard",
      unresolvedProduct
    );
  }
  const dims = resolveCeilingPlasterboardSheetDims(params.portion);
  if (dims.lengthState === "invalid" || dims.widthState === "invalid") {
    return emptyTakeoff(
      nestedItemId,
      "invalid",
      "Plasterboard sheet dimensions must be positive finite lengths.",
      "plasterboard",
      unresolvedProduct
    );
  }
  if (dims.lengthMm == null || dims.widthMm == null) {
    return emptyTakeoff(
      nestedItemId,
      "information_required",
      "Plasterboard lining needs sheet length and width.",
      "plasterboard",
      unresolvedProduct
    );
  }
  const thickness = params.portion.lining.thickness_mm;
  if (thickness == null) {
    return emptyTakeoff(
      nestedItemId,
      "information_required",
      "Plasterboard thickness is required.",
      "plasterboard",
      {
        kind: "unresolved",
        materialKey: null,
        materialIdentity: null,
        specification: "Plasterboard thickness is not resolved",
      }
    );
  }
  const layerRaw = params.portion.lining.layers;
  const layerState = classifyPositive(layerRaw);
  if (layerState === "invalid") {
    return emptyTakeoff(
      nestedItemId,
      "invalid",
      "Lining layer count must be a positive finite value.",
      "plasterboard",
      unresolvedProduct
    );
  }
  const layerKnown = layerState === "ok";
  if (!layerKnown && !ceilingAllowsDisclosedPlasterboardLayers(params.portion)) {
    return emptyTakeoff(
      nestedItemId,
      "information_required",
      "Lining layer count is required for this ceiling system.",
      "plasterboard",
      unresolvedProduct
    );
  }
  const layerCount = layerKnown
    ? (layerRaw as number)
    : CEILINGS_LINING_LAYERS_ASSUMPTION;
  const layerCountSource: CeilingLayerCountSource = layerKnown
    ? "known"
    : "assumed_disclosed";
  const layerAssumption = layerKnown
    ? null
    : CEILINGS_LINING_LAYERS_ASSUMPTION_STATEMENT;
  const sheetSizeSource = dims.source;
  const bothSheetDimsOmitted =
    classifyPositive(params.portion.lining.sheet_length_mm) !== "ok" &&
    classifyPositive(params.portion.lining.sheet_width_mm) !== "ok";
  const sheetSizeAssumption =
    sheetSizeSource === "assumed_disclosed" && bothSheetDimsOmitted
      ? CEILINGS_PLASTERBOARD_SHEET_SIZE_ASSUMPTION_STATEMENT
      : null;
  const counted = countCoveredAreaSheets({
    areaM2,
    sheetLengthM: dims.lengthMm / 1000,
    sheetWidthM: dims.widthMm / 1000,
    wastagePercent: params.wastagePercent,
    layerCount,
  });
  if (!counted) {
    return emptyTakeoff(
      nestedItemId,
      "information_required",
      "Plasterboard sheet count could not be derived from the given area and sheet size.",
      "plasterboard",
      unresolvedProduct
    );
  }
  const product = resolveCeilingPlasterboardProduct(
    productCode,
    thickness,
    dims.lengthMm,
    dims.widthMm
  );
  return {
    ...emptyTakeoff(nestedItemId, "ok", null, "plasterboard", product),
    status: "ok",
    resolution: PHYSICAL_REQUIREMENT_RESOLUTION.DERIVED,
    areaM2,
    sheetLengthM: dims.lengthMm / 1000,
    sheetWidthM: dims.widthMm / 1000,
    layerCount: counted.layerCount,
    layerCountSource,
    layerAssumption,
    sheetSizeSource,
    sheetSizeAssumption,
    installedSheetsPerLayer: counted.installedSheetsPerLayer,
    purchaseSheetsPerLayer: counted.purchaseSheetsPerLayer,
    installedSheets: counted.installedSheets,
    purchaseSheets: counted.purchaseSheets,
    wasteFactor: counted.wasteFactor,
    labourBasisInstalled: counted.installedSheets,
    labourBasisUnit: "sheet",
    product,
  };
}

function plywoodTakeoff(params: {
  portion: CeilingPortion;
  geometry: CeilingGeometryTakeoff;
  wastagePercent: number;
}): CeilingLiningTakeoff {
  const nestedItemId = params.portion.id;
  const specText =
    params.portion.lining.plywood_spec?.trim() || "Plywood sheet";
  const product: CeilingSheetProductResolution = {
    kind: "canonical",
    materialKey: CEILING_PLYWOOD_SHEET_KEY,
    materialIdentity: {
      ...CEILING_PLYWOOD_IDENTITY,
      originalDescription: specText,
    },
    specification: specText,
  };
  const areaM2 = areaFromGeometry(params.geometry);
  if (params.geometry.status === "invalid") {
    return emptyTakeoff(
      nestedItemId,
      "invalid",
      params.geometry.reason,
      "plywood",
      product
    );
  }
  if (areaM2 == null) {
    return emptyTakeoff(
      nestedItemId,
      "information_required",
      params.geometry.reason ?? "Plywood lining needs a ceiling area.",
      "plywood",
      product
    );
  }
  const dims = sheetDimsFromPortion(params.portion);
  if (dims.lengthState === "invalid" || dims.widthState === "invalid") {
    return emptyTakeoff(
      nestedItemId,
      "invalid",
      "Plywood sheet dimensions must be positive finite lengths.",
      "plywood",
      product
    );
  }
  if (dims.lengthMm == null || dims.widthMm == null) {
    return emptyTakeoff(
      nestedItemId,
      "information_required",
      "Plywood lining needs sheet length and width.",
      "plywood",
      product
    );
  }
  const counted = countCoveredAreaSheets({
    areaM2,
    sheetLengthM: dims.lengthMm / 1000,
    sheetWidthM: dims.widthMm / 1000,
    wastagePercent: params.wastagePercent,
    layerCount: 1,
  });
  if (!counted) {
    return emptyTakeoff(
      nestedItemId,
      "information_required",
      "Plywood sheet count could not be derived from the given area and sheet size.",
      "plywood",
      product
    );
  }
  return {
    ...emptyTakeoff(nestedItemId, "ok", null, "plywood", product),
    status: "ok",
    resolution: PHYSICAL_REQUIREMENT_RESOLUTION.DERIVED,
    areaM2,
    sheetLengthM: dims.lengthMm / 1000,
    sheetWidthM: dims.widthMm / 1000,
    layerCount: 1,
    installedSheetsPerLayer: counted.installedSheetsPerLayer,
    purchaseSheetsPerLayer: counted.purchaseSheetsPerLayer,
    installedSheets: counted.installedSheets,
    purchaseSheets: counted.purchaseSheets,
    wasteFactor: counted.wasteFactor,
    labourBasisInstalled: counted.installedSheets,
    labourBasisUnit: "sheet",
    product,
  };
}

function timberLinedTakeoff(params: {
  portion: CeilingPortion;
  geometry: CeilingGeometryTakeoff;
  wastagePercent: number;
}): CeilingLiningTakeoff {
  const nestedItemId = params.portion.id;
  const product: CeilingSheetProductResolution = {
    kind: "canonical",
    materialKey: TIMBER_LINING_PROFILE_KEY,
    materialIdentity: TIMBER_LINING_PROFILE_IDENTITY,
    specification: "Ceiling timber lining / profile",
  };
  const lining = params.portion.lining.timber_lined;
  if (
    params.geometry.status !== "ok" ||
    params.geometry.length_m == null ||
    params.geometry.width_m == null
  ) {
    return emptyTakeoff(
      nestedItemId,
      params.geometry.status === "invalid" ? "invalid" : "information_required",
      params.geometry.reason ??
        "Timber-lined ceilings need length and width. Area alone is not enough.",
      "timber_lined",
      product
    );
  }
  if (!lining) {
    return emptyTakeoff(
      nestedItemId,
      "information_required",
      "Timber-lined ceilings need board cover width, gap, and direction.",
      "timber_lined",
      product
    );
  }
  const boardState = classifyPositive(lining.board_width_mm);
  const gapState = classifyNonNegative(lining.gap_mm);
  const direction = lining.direction ?? null;
  if (boardState === "invalid") {
    return emptyTakeoff(
      nestedItemId,
      "invalid",
      "Timber lining board width must be a positive finite length.",
      "timber_lined",
      product
    );
  }
  if (gapState === "invalid") {
    return emptyTakeoff(
      nestedItemId,
      "invalid",
      "Timber lining gap must be a finite value of zero or more.",
      "timber_lined",
      product
    );
  }
  if (boardState === "missing" || direction == null) {
    return emptyTakeoff(
      nestedItemId,
      "information_required",
      boardState === "missing"
        ? "Timber-lined ceilings need a board cover width."
        : "Timber-lined ceilings need a run direction.",
      "timber_lined",
      product
    );
  }
  const boardCoverWidthM = lining.board_width_mm / 1000;
  const gapM = lining.gap_mm / 1000;
  const runLengthM =
    direction === "along_length"
      ? params.geometry.length_m
      : params.geometry.width_m;
  const crossDimensionM =
    direction === "along_length"
      ? params.geometry.width_m
      : params.geometry.length_m;
  const moduleM = boardCoverWidthM + gapM;
  if (!(moduleM > 0)) {
    return emptyTakeoff(
      nestedItemId,
      "invalid",
      "Timber lining module (board cover width + gap) must be greater than zero.",
      "timber_lined",
      product
    );
  }
  const effectiveCrossM = crossDimensionM - 2 * gapM;
  if (!(effectiveCrossM > 0)) {
    return emptyTakeoff(
      nestedItemId,
      "information_required",
      "Timber lining effective cross dimension is not positive after edge gaps.",
      "timber_lined",
      product
    );
  }
  const numberOfRuns = Math.ceil(
    (effectiveCrossM + gapM) / moduleM - RUN_COUNT_SPACING_EPSILON
  );
  if (numberOfRuns < 1) {
    return emptyTakeoff(
      nestedItemId,
      "information_required",
      "Timber lining run count could not be derived.",
      "timber_lined",
      product
    );
  }
  const installedLm = round2(numberOfRuns * runLengthM);
  const wasteFactor = params.wastagePercent / 100;
  const purchaseLm = round2(installedLm * (1 + wasteFactor));
  return {
    ...emptyTakeoff(nestedItemId, "ok", null, "timber_lined", product),
    status: "ok",
    resolution: PHYSICAL_REQUIREMENT_RESOLUTION.DERIVED,
    areaM2: params.geometry.area_m2,
    wasteFactor,
    labourBasisInstalled: installedLm,
    labourBasisUnit: "lm",
    direction,
    runLengthM,
    crossDimensionM,
    boardCoverWidthM,
    gapM,
    moduleM,
    effectiveCrossM,
    numberOfRuns,
    installedLm,
    purchaseLm,
    edgeGapConvention: CEILING_TIMBER_LINING_EDGE_GAP_ASSUMPTION,
    product,
  };
}

function tileGridTakeoff(params: {
  portion: CeilingPortion;
  geometry: CeilingGeometryTakeoff;
  wastagePercent: number;
}): CeilingLiningTakeoff {
  const nestedItemId = params.portion.id;
  const unresolved: CeilingSheetProductResolution = {
    kind: "unresolved",
    materialKey: null,
    materialIdentity: null,
    specification: "Ceiling tile size is not resolved",
  };
  if (params.geometry.status === "invalid") {
    return emptyTakeoff(
      nestedItemId,
      "invalid",
      params.geometry.reason,
      "tile_and_grid",
      unresolved
    );
  }
  const areaM2 = areaFromGeometry(params.geometry);
  if (areaM2 == null) {
    return emptyTakeoff(
      nestedItemId,
      "information_required",
      params.geometry.reason ?? "Tile & Grid needs a ceiling area.",
      "tile_and_grid",
      unresolved
    );
  }
  const size = params.portion.lining.tile?.size ?? null;
  if (size == null) {
    return emptyTakeoff(
      nestedItemId,
      "information_required",
      "Tile & Grid needs a tile size.",
      "tile_and_grid",
      unresolved
    );
  }
  const mm = TILE_SIZE_MM[size];
  const counted = countCoveredAreaSheets({
    areaM2,
    sheetLengthM: mm.length / 1000,
    sheetWidthM: mm.width / 1000,
    wastagePercent: params.wastagePercent,
    layerCount: 1,
  });
  if (!counted) {
    return emptyTakeoff(
      nestedItemId,
      "information_required",
      "Tile count could not be derived from the given area and tile size.",
      "tile_and_grid",
      unresolved
    );
  }
  const specification = `Ceiling tile ${size.replace("x", " × ")}`;
  const product: CeilingSheetProductResolution = {
    kind: "canonical",
    materialKey: ceilingTileMaterialKey(size),
    materialIdentity: liningIdentity("ceiling", "tile", specification),
    specification,
  };
  return {
    ...emptyTakeoff(nestedItemId, "ok", null, "tile_and_grid", product),
    status: "ok",
    resolution: PHYSICAL_REQUIREMENT_RESOLUTION.DERIVED,
    areaM2,
    wasteFactor: counted.wasteFactor,
    labourBasisInstalled: counted.installedSheets,
    labourBasisUnit: "each",
    tileSize: size,
    tileLengthM: mm.length / 1000,
    tileWidthM: mm.width / 1000,
    installedTiles: counted.installedSheets,
    purchaseTiles: counted.purchaseSheets,
    gridAreaM2: areaM2,
    product,
  };
}

export function calculateCeilingLining(
  portion: CeilingPortion,
  geometry?: CeilingGeometryTakeoff,
  wastageSettings?: MaterialWastageSettings | null
): CeilingLiningTakeoff {
  const nestedItemId = portion.id;
  if (tileAndGridFamiliesDisagree(portion)) {
    return emptyTakeoff(
      nestedItemId,
      "information_required",
      "Tile & Grid structure and lining must agree. Dual framing/lining is not calculated."
    );
  }
  const family: CeilingLiningFamily | null = portion.lining.family;
  const geo = geometry ?? deriveCeilingGeometry(portion);
  if (family == null) {
    return emptyTakeoff(
      nestedItemId,
      "not_applicable",
      "No lining family is selected for this ceiling portion."
    );
  }
  if (family === "plasterboard") {
    return plasterboardTakeoff({
      portion,
      geometry: geo,
      wastagePercent: resolveMaterialWastage(wastageSettings, "sheet_material"),
    });
  }
  if (family === "plywood") {
    return plywoodTakeoff({
      portion,
      geometry: geo,
      wastagePercent: resolveMaterialWastage(wastageSettings, "sheet_material"),
    });
  }
  if (family === "timber_lined") {
    return timberLinedTakeoff({
      portion,
      geometry: geo,
      wastagePercent: resolveMaterialWastage(wastageSettings, "default"),
    });
  }
  if (family === "tile_and_grid") {
    return tileGridTakeoff({
      portion,
      geometry: geo,
      wastagePercent: resolveMaterialWastage(wastageSettings, "sheet_material"),
    });
  }
  return emptyTakeoff(
    nestedItemId,
    "not_applicable",
    "This lining family is not calculated."
  );
}

export function sharedPlasterboardKeysForCeilings(): readonly string[] {
  return [
    INTERNAL_WALLS_STANDARD_13_2400_KEY,
    INTERNAL_WALLS_AQUALINE_13_2400_KEY,
    INTERNAL_WALLS_FYRELINE_13_2400_KEY,
  ];
}
