/**
 * WA-INTERNAL-WALLS-05 — lining product matrix + full-height sheet takeoff.
 *
 * Physical authority is Side A / Side B face configuration, not a one-side /
 * both-sides multiplier. same_lining_both_sides is a UX shortcut only.
 *
 * Full-height vertical model when sheet_length_mm >= wall_height_mm:
 *   base_sheets = ceil(length_m / sheet_width_m − epsilon)
 *   purchase_per_layer = ceil(base_sheets × (1 + waste) − epsilon)
 *   installed = base_sheets × layers
 *   purchase = purchase_per_layer × layers
 *
 * Labour uses installed sheets, not purchase/waste sheets.
 *
 * IW-06: known openings deduct from net lined m² only. Sheet purchase /
 * installed counts stay on the full-height wall-length sheet run unless a
 * later phase can prove a whole bay is eliminated.
 */

import { round2 } from "@/lib/estimate/facts";
import {
  INTERNAL_WALLS_AQUALINE_13_2400_KEY,
  INTERNAL_WALLS_BRACELINE_13_2400_KEY,
  INTERNAL_WALLS_FIBRE_CEMENT_LINING_GAP_MESSAGE,
  INTERNAL_WALLS_FYRELINE_13_2400_KEY,
  INTERNAL_WALLS_LINING_CUSTOM_MESSAGE,
  INTERNAL_WALLS_LINING_PRODUCTIVITY_KEYS,
  INTERNAL_WALLS_LINING_THICKNESS_UNSUPPORTED_MESSAGE,
  INTERNAL_WALLS_PLASTERBOARD_SHEET_WIDTH_MM,
  INTERNAL_WALLS_PLYWOOD_LINING_GAP_MESSAGE,
  INTERNAL_WALLS_SHEET_TOO_SHORT_MESSAGE,
  INTERNAL_WALLS_STANDARD_13_2400_KEY,
} from "@/lib/estimate/internal-walls-identities";
import {
  isLiningThicknessSupported,
  liningProductDisplay,
  materialFamilyForProduct,
  type InternalWallsFace,
  type InternalWallsLiningProduct,
  type InternalWallsWallType,
} from "@/lib/estimate/internal-walls-wall-types";

const SHEET_COUNT_EPSILON = 1e-12;

export type InternalWallsLiningIdentityClass =
  | "supported_combination"
  | "missing_catalogue_identity"
  | "unsupported_custom"
  | "legacy_generic_alias";

export type InternalWallsLiningFaceSide = "side_a" | "side_b";

const LEGACY_13_2400_KEYS: Partial<Record<InternalWallsLiningProduct, string>> = {
  standard_gib: INTERNAL_WALLS_STANDARD_13_2400_KEY,
  aqualine: INTERNAL_WALLS_AQUALINE_13_2400_KEY,
  fyreline: INTERNAL_WALLS_FYRELINE_13_2400_KEY,
  braceline: INTERNAL_WALLS_BRACELINE_13_2400_KEY,
};

const CATALOGUE_SLUG: Partial<Record<InternalWallsLiningProduct, string>> = {
  standard_gib: "standard",
  aqualine: "aqualine",
  fyreline: "fyreline",
  braceline: "braceline",
  noiseline: "noiseline",
  weatherline: "weatherline",
  barrierline: "barrierline",
};

export function plasterboardCatalogueSlug(
  product: InternalWallsLiningProduct
): string | null {
  return CATALOGUE_SLUG[product] ?? null;
}

export function dimensionedPlasterboardKey(params: {
  product: InternalWallsLiningProduct;
  thicknessMm: number;
  lengthMm: number;
  widthMm?: number;
}): string | null {
  const slug = plasterboardCatalogueSlug(params.product);
  if (!slug) return null;
  const width = params.widthMm ?? INTERNAL_WALLS_PLASTERBOARD_SHEET_WIDTH_MM;
  return `sheet.plasterboard.${slug}.${params.thicknessMm}mm.${params.lengthMm}x${width}.each`;
}

export function internalWallsLiningMaterialKey(params: {
  product: InternalWallsLiningProduct;
  thicknessMm: number;
  lengthMm: number;
  widthMm?: number;
}): {
  materialKey: string | null;
  identityClass: InternalWallsLiningIdentityClass;
} {
  const width = params.widthMm ?? INTERNAL_WALLS_PLASTERBOARD_SHEET_WIDTH_MM;
  if (materialFamilyForProduct(params.product) !== "plasterboard") {
    return { materialKey: null, identityClass: "unsupported_custom" };
  }
  const legacy = LEGACY_13_2400_KEYS[params.product];
  if (
    legacy &&
    params.thicknessMm === 13 &&
    params.lengthMm === 2400 &&
    width === INTERNAL_WALLS_PLASTERBOARD_SHEET_WIDTH_MM
  ) {
    return { materialKey: legacy, identityClass: "legacy_generic_alias" };
  }
  const dimensioned = dimensionedPlasterboardKey({
    product: params.product,
    thicknessMm: params.thicknessMm,
    lengthMm: params.lengthMm,
    widthMm: width,
  });
  return {
    materialKey: dimensioned,
    identityClass: "missing_catalogue_identity",
  };
}

export function liningProductivityKeyForProduct(
  product: InternalWallsLiningProduct
): string {
  return INTERNAL_WALLS_LINING_PRODUCTIVITY_KEYS[product];
}

export function liningFacesAreIdentical(
  a: InternalWallsFace,
  b: InternalWallsFace
): boolean {
  return (
    a.lined === b.lined &&
    a.product === b.product &&
    a.thickness_mm === b.thickness_mm &&
    a.sheet_length_mm === b.sheet_length_mm &&
    a.layers === b.layers
  );
}

export type InternalWallsLiningTakeoff =
  | {
      ok: true;
      kind: "full_height";
      side: InternalWallsLiningFaceSide;
      product: InternalWallsLiningProduct;
      productLabel: string;
      thicknessMm: number;
      sheetLengthMm: number;
      sheetWidthMm: number;
      layers: number;
      lengthLm: number;
      heightM: number;
      grossFaceAreaM2: number;
      openingDeductionM2: number;
      netFaceAreaM2: number;
      installedLayerAreaM2: number;
      baseSheetsPerLayer: number;
      purchaseSheetsPerLayer: number;
      installedSheets: number;
      purchaseSheets: number;
      wasteFactor: number;
      materialKey: string | null;
      identityClass: InternalWallsLiningIdentityClass;
      hoursPerSheet: number | null;
      labourHours: number | null;
    }
  | {
      ok: false;
      kind:
        | "not_lined"
        | "too_short"
        | "catalogue_gap"
        | "unsupported_thickness"
        | "incomplete"
        | "custom";
      side: InternalWallsLiningFaceSide;
      message: string | null;
      product: InternalWallsLiningProduct | null;
    };

export function internalWallsLiningFaceTakeoff(params: {
  type: Pick<InternalWallsWallType, "length_lm" | "height_m">;
  face: InternalWallsFace;
  side: InternalWallsLiningFaceSide;
  wasteFactor: number;
  hoursPerSheet: number | null;
  openingDeductionM2?: number;
}): InternalWallsLiningTakeoff {
  const { face, side, wasteFactor, hoursPerSheet } = params;
  if (!face.lined) {
    return {
      ok: false,
      kind: "not_lined",
      side,
      message: null,
      product: face.product,
    };
  }

  const product = face.product;
  if (!product) {
    return {
      ok: false,
      kind: "incomplete",
      side,
      message: "Add a lining product for this face.",
      product: null,
    };
  }

  if (product === "plywood") {
    return {
      ok: false,
      kind: "catalogue_gap",
      side,
      message: INTERNAL_WALLS_PLYWOOD_LINING_GAP_MESSAGE,
      product,
    };
  }
  if (product === "fibre_cement") {
    return {
      ok: false,
      kind: "catalogue_gap",
      side,
      message: INTERNAL_WALLS_FIBRE_CEMENT_LINING_GAP_MESSAGE,
      product,
    };
  }
  if (product === "other") {
    return {
      ok: false,
      kind: "custom",
      side,
      message: INTERNAL_WALLS_LINING_CUSTOM_MESSAGE,
      product,
    };
  }

  const lengthLm = params.type.length_lm;
  const heightM = params.type.height_m;
  if (lengthLm == null || heightM == null || !(lengthLm > 0) || !(heightM > 0)) {
    return {
      ok: false,
      kind: "incomplete",
      side,
      message: null,
      product,
    };
  }

  const thicknessMm = face.thickness_mm;
  const sheetLengthMm = face.sheet_length_mm;
  const layers = face.layers ?? 1;
  if (thicknessMm == null || sheetLengthMm == null || layers < 1) {
    return {
      ok: false,
      kind: "incomplete",
      side,
      message: "Add lining thickness, sheet length, and layers for this face.",
      product,
    };
  }

  if (!isLiningThicknessSupported(product, thicknessMm)) {
    return {
      ok: false,
      kind: "unsupported_thickness",
      side,
      message: INTERNAL_WALLS_LINING_THICKNESS_UNSUPPORTED_MESSAGE,
      product,
    };
  }

  const heightMm = Math.round(heightM * 1000);
  if (sheetLengthMm < heightMm) {
    return {
      ok: false,
      kind: "too_short",
      side,
      message: INTERNAL_WALLS_SHEET_TOO_SHORT_MESSAGE,
      product,
    };
  }

  const sheetWidthMm = INTERNAL_WALLS_PLASTERBOARD_SHEET_WIDTH_MM;
  const sheetWidthM = sheetWidthMm / 1000;
  const baseSheetsPerLayer = Math.ceil(lengthLm / sheetWidthM - SHEET_COUNT_EPSILON);
  const purchaseSheetsPerLayer = Math.ceil(
    baseSheetsPerLayer * (1 + wasteFactor) - SHEET_COUNT_EPSILON
  );
  const installedSheets = baseSheetsPerLayer * layers;
  const purchaseSheets = purchaseSheetsPerLayer * layers;
  const grossFaceAreaM2 = lengthLm * heightM;
  const openingDeductionM2 = Math.max(0, params.openingDeductionM2 ?? 0);
  const netFaceAreaM2 = Math.max(0, grossFaceAreaM2 - openingDeductionM2);
  const installedLayerAreaM2 = netFaceAreaM2 * layers;
  const identity = internalWallsLiningMaterialKey({
    product,
    thicknessMm,
    lengthMm: sheetLengthMm,
    widthMm: sheetWidthMm,
  });
  const labourHours =
    hoursPerSheet != null && hoursPerSheet > 0
      ? round2(installedSheets * hoursPerSheet)
      : null;

  return {
    ok: true,
    kind: "full_height",
    side,
    product,
    productLabel: liningProductDisplay(product) ?? product,
    thicknessMm,
    sheetLengthMm,
    sheetWidthMm,
    layers,
    lengthLm,
    heightM,
    grossFaceAreaM2,
    openingDeductionM2,
    netFaceAreaM2,
    installedLayerAreaM2,
    baseSheetsPerLayer,
    purchaseSheetsPerLayer,
    installedSheets,
    purchaseSheets,
    wasteFactor,
    materialKey: identity.materialKey,
    identityClass: identity.identityClass,
    hoursPerSheet,
    labourHours,
  };
}

export function formatInternalWallsLiningTakeoff(
  takeoff: Extract<InternalWallsLiningTakeoff, { ok: true }>
): string {
  const layerLabel = takeoff.layers === 1 ? "1 layer" : `${takeoff.layers} layers`;
  return [
    `${takeoff.thicknessMm} mm ${takeoff.productLabel}`,
    `${takeoff.sheetLengthMm} × ${takeoff.sheetWidthMm}`,
    layerLabel,
    `${takeoff.lengthLm} × ${takeoff.heightM} m`,
    `${takeoff.installedSheets} sheets installed`,
    `${takeoff.purchaseSheets} sheets incl. waste`,
    `${round2(takeoff.grossFaceAreaM2)} m² gross`,
    takeoff.openingDeductionM2 > 0
      ? `${round2(takeoff.openingDeductionM2)} m² opening deduction`
      : null,
    `${round2(takeoff.netFaceAreaM2)} m² net`,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function aggregateInternalWallsLiningPurchaseSheets(
  requirements: readonly { kind: string; materialKey?: string | null; purchaseQuantity: number }[],
  materialKey: string
): number {
  return round2(
    requirements
      .filter(
        (row) => row.kind === "material" && row.materialKey === materialKey
      )
      .reduce((sum, row) => sum + row.purchaseQuantity, 0)
  );
}

export function aggregateInternalWallsLiningInstalledSheets(
  requirements: readonly {
    kind: string;
    componentKey: string;
    productivityBasis?: { quantity: number };
  }[],
  labourComponentKey: string
): number {
  return round2(
    requirements
      .filter(
        (row) =>
          row.kind === "labour" && row.componentKey === labourComponentKey
      )
      .reduce((sum, row) => sum + (row.productivityBasis?.quantity ?? 0), 0)
  );
}
