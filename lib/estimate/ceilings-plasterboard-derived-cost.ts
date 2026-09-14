/**
 * CEILINGS WA-05B — dimensioned plasterboard Quotr COST derivation.
 *
 * Same product family + same thickness only. Base is the canonical
 * 2400×1200 (2.88 m²) Quotr COST. Company exact dimensioned rates win
 * in the commercial resolver; this module never invents a family or
 * thickness substitute.
 */

import { getCatalogueEntry } from "@/lib/rates/catalogue";
import { round2 } from "@/lib/estimate/facts";

export const CANONICAL_PLASTERBOARD_SHEET_AREA_M2 = 2.88;

export const LEGACY_PLASTERBOARD_13_2400_KEYS: Record<string, string> = {
  standard: "sheet.plasterboard.standard.each",
  aqualine: "sheet.plasterboard.aqualine.each",
  fyreline: "sheet.plasterboard.fyreline.each",
  braceline: "sheet.plasterboard.braceline.each",
};

const DIMENSIONED_KEY =
  /^sheet\.plasterboard\.([a-z]+)\.(\d+)mm\.(\d+)x(\d+)\.each$/;

export type DimensionedPlasterboardKey = {
  readonly family: string;
  readonly thicknessMm: number;
  readonly lengthMm: number;
  readonly widthMm: number;
  readonly areaM2: number;
};

export type DerivedPlasterboardCost = {
  readonly itemKey: string;
  readonly family: string;
  readonly thicknessMm: number;
  readonly lengthMm: number;
  readonly widthMm: number;
  readonly targetAreaM2: number;
  readonly baseKey: string;
  readonly baseCost: number;
  readonly ratio: number;
  readonly derivedCost: number;
  readonly basis: "quotr_derived_same_family_thickness_2400x1200";
};

export function plasterboardSheetAreaM2(
  lengthMm: number,
  widthMm: number
): number {
  return (lengthMm / 1000) * (widthMm / 1000);
}

export function parseDimensionedPlasterboardKey(
  itemKey: string
): DimensionedPlasterboardKey | null {
  const match = DIMENSIONED_KEY.exec(itemKey);
  if (!match) return null;
  const family = match[1]!;
  const thicknessMm = Number(match[2]);
  const lengthMm = Number(match[3]);
  const widthMm = Number(match[4]);
  if (
    !Number.isFinite(thicknessMm) ||
    !Number.isFinite(lengthMm) ||
    !Number.isFinite(widthMm) ||
    thicknessMm <= 0 ||
    lengthMm <= 0 ||
    widthMm <= 0
  ) {
    return null;
  }
  return {
    family,
    thicknessMm,
    lengthMm,
    widthMm,
    areaM2: plasterboardSheetAreaM2(lengthMm, widthMm),
  };
}

export function canonicalPlasterboard2400x1200Key(
  family: string,
  thicknessMm: number
): string | null {
  if (thicknessMm === 13 && LEGACY_PLASTERBOARD_13_2400_KEYS[family]) {
    return LEGACY_PLASTERBOARD_13_2400_KEYS[family]!;
  }
  if (!family || thicknessMm <= 0) return null;
  return `sheet.plasterboard.${family}.${thicknessMm}mm.2400x1200.each`;
}

function catalogueCost(itemKey: string | null): number | null {
  if (!itemKey) return null;
  const entry = getCatalogueEntry(itemKey);
  if (entry?.defaultCostRate != null && entry.defaultCostRate > 0) {
    return entry.defaultCostRate;
  }
  return null;
}

/**
 * Transparent Quotr derived COST for a dimensioned sheet.
 * Returns null when family/thickness have no same-family 2400×1200 base.
 */
export function derivedDimensionedPlasterboardCost(
  itemKey: string | null | undefined
): DerivedPlasterboardCost | null {
  if (!itemKey) return null;
  const parsed = parseDimensionedPlasterboardKey(itemKey);
  if (!parsed) return null;
  const baseKey = canonicalPlasterboard2400x1200Key(
    parsed.family,
    parsed.thicknessMm
  );
  if (!baseKey || baseKey === itemKey) return null;
  const baseCost = catalogueCost(baseKey);
  if (baseCost == null) return null;
  const ratio = parsed.areaM2 / CANONICAL_PLASTERBOARD_SHEET_AREA_M2;
  if (!(ratio > 0) || !Number.isFinite(ratio)) return null;
  return {
    itemKey,
    family: parsed.family,
    thicknessMm: parsed.thicknessMm,
    lengthMm: parsed.lengthMm,
    widthMm: parsed.widthMm,
    targetAreaM2: parsed.areaM2,
    baseKey,
    baseCost,
    ratio,
    derivedCost: round2(baseCost * ratio),
    basis: "quotr_derived_same_family_thickness_2400x1200",
  };
}
