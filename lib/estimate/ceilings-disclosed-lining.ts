/**
 * CEILINGS WA-08-R2 — ordinary plasterboard lining disclosed assumptions.
 *
 * Sheet size and layer count may resolve through ASSUMED_DISCLOSED without
 * becoming user-known nested facts. Specialist / proprietary systems and
 * product-constrained identities do not receive the generic default.
 */

import {
  CEILINGS_LINING_LAYERS_ASSUMPTION,
  CEILINGS_PLASTERBOARD_SHEET_LENGTH_ASSUMPTION_MM,
  CEILINGS_PLASTERBOARD_SHEET_WIDTH_ASSUMPTION_MM,
} from "@/lib/estimate/ceilings-information-contract";
import type { CeilingPortion } from "@/lib/estimate/ceilings-portions";
import {
  ceilingPortionHasUnknownProprietaryFireAcoustic,
  ceilingPortionSpecialistKind,
} from "@/lib/estimate/ceilings-specialist";
import { INTERNAL_WALLS_PLASTERBOARD_SHEET_WIDTH_MM } from "@/lib/estimate/internal-walls-identities";
import {
  isLiningSheetLengthSupported,
  isLiningThicknessSupported,
  type InternalWallsLiningProduct,
} from "@/lib/estimate/internal-walls-wall-types";

function hasPositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function mapCeilingPlasterboardProduct(
  product: CeilingPortion["lining"]["plasterboard_product"]
): InternalWallsLiningProduct | null {
  if (product === "standard") return "standard_gib";
  if (product === "aqualine") return "aqualine";
  if (product === "fyreline") return "fyreline";
  return null;
}

function ordinaryPlasterboardWithoutSpecialistSystem(
  portion: CeilingPortion
): boolean {
  if (portion.lining.family !== "plasterboard") return false;
  if (ceilingPortionSpecialistKind(portion) != null) return false;
  if (ceilingPortionHasUnknownProprietaryFireAcoustic(portion)) return false;
  if (portion.fire_acoustic_requirement === "specified") return false;
  return true;
}

function mappedOrdinaryPlasterboardProduct(
  portion: CeilingPortion
): InternalWallsLiningProduct | null {
  if (!ordinaryPlasterboardWithoutSpecialistSystem(portion)) return null;
  return mapCeilingPlasterboardProduct(portion.lining.plasterboard_product);
}

export function ceilingAllowsDisclosedPlasterboardLayers(
  portion: CeilingPortion
): boolean {
  if (!ordinaryPlasterboardWithoutSpecialistSystem(portion)) return false;
  const product = portion.lining.plasterboard_product;
  return (
    product === "standard" ||
    product === "aqualine" ||
    product === "fyreline" ||
    product === "other"
  );
}

export function ceilingAllowsDisclosedPlasterboardSheetSize(
  portion: CeilingPortion
): boolean {
  const iwProduct = mappedOrdinaryPlasterboardProduct(portion);
  if (!iwProduct) return false;
  const thickness = portion.lining.thickness_mm;
  if (typeof thickness !== "number") return false;
  if (!isLiningThicknessSupported(iwProduct, thickness)) return false;
  if (
    !isLiningSheetLengthSupported(
      iwProduct,
      CEILINGS_PLASTERBOARD_SHEET_LENGTH_ASSUMPTION_MM
    )
  ) {
    return false;
  }
  return (
    INTERNAL_WALLS_PLASTERBOARD_SHEET_WIDTH_MM ===
    CEILINGS_PLASTERBOARD_SHEET_WIDTH_ASSUMPTION_MM
  );
}

export function ceilingAllowsDisclosedPlasterboardSheetWidth(
  portion: CeilingPortion
): boolean {
  const iwProduct = mappedOrdinaryPlasterboardProduct(portion);
  if (!iwProduct) return false;
  return (
    INTERNAL_WALLS_PLASTERBOARD_SHEET_WIDTH_MM ===
    CEILINGS_PLASTERBOARD_SHEET_WIDTH_ASSUMPTION_MM
  );
}

export function ceilingDisclosedLiningAssumptionCurrentValue(
  portion: CeilingPortion,
  factKey: string
): { value: number; source: "assumption" } | null {
  if (factKey === "ceilings.portion.layers") {
    if (hasPositive(portion.lining.layers)) return null;
    if (!ceilingAllowsDisclosedPlasterboardLayers(portion)) return null;
    return {
      value: CEILINGS_LINING_LAYERS_ASSUMPTION,
      source: "assumption",
    };
  }
  if (factKey === "ceilings.portion.sheet_length_mm") {
    if (hasPositive(portion.lining.sheet_length_mm)) return null;
    if (
      hasPositive(portion.lining.sheet_width_mm) &&
      portion.lining.sheet_width_mm !==
        CEILINGS_PLASTERBOARD_SHEET_WIDTH_ASSUMPTION_MM
    ) {
      return null;
    }
    if (!ceilingAllowsDisclosedPlasterboardSheetSize(portion)) return null;
    return {
      value: CEILINGS_PLASTERBOARD_SHEET_LENGTH_ASSUMPTION_MM,
      source: "assumption",
    };
  }
  if (factKey === "ceilings.portion.sheet_width_mm") {
    if (hasPositive(portion.lining.sheet_width_mm)) return null;
    if (!ceilingAllowsDisclosedPlasterboardSheetWidth(portion)) return null;
    if (
      !hasPositive(portion.lining.sheet_length_mm) &&
      !ceilingAllowsDisclosedPlasterboardSheetSize(portion)
    ) {
      return null;
    }
    return {
      value: CEILINGS_PLASTERBOARD_SHEET_WIDTH_ASSUMPTION_MM,
      source: "assumption",
    };
  }
  return null;
}
