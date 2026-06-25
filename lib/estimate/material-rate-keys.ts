import { DECK_BENCHMARKS } from "@/lib/estimate/benchmark-rates";

/**
 * Standard material rate keys for build-up pricing.
 * Dot-notation item_key values map to the `rates` table (rate_type = material).
 */

export const MATERIAL_RATE_KEYS = {
  deckingTreatedPineM2: "deck.material.treated_pine.m2",
  deckingHardwoodM2: "deck.material.hardwood.m2",
  deckingKwilaM2: "deck.material.hardwood.m2",
  deckingCompositeM2: "deck.material.composite.m2",
  deckingTreatedPineLm: "deck.material.treated_pine.lm",
  deckingHardwoodLm: "deck.material.hardwood.lm",
  deckingKwilaLm: "deck.material.kwila.lm",
  deckingCompositeLm: "deck.material.composite.lm",

  plasterboardStandardSheet: "sheet.plasterboard.standard.each",
  plasterboardFyrelineSheet: "sheet.plasterboard.fyreline.each",
  plasterboardAqualineSheet: "sheet.plasterboard.aqualine.each",
  plasterboardBracelineSheet: "sheet.plasterboard.braceline.each",
  plywoodSheet: "sheet.plywood.each",
  ceilingTileM2: "ceiling.tile.m2",

  backfillM3: "retaining_wall.backfill.m3",
  drainageNovacoilLm: "retaining_wall.drainage.lm",

  vinylM2: "flooring.vinyl.m2",
  carpetM2: "flooring.carpet.m2",
  hardwoodFlooringM2: "flooring.hardwood.m2",
  laminateFlooringM2: "flooring.laminate.m2",
  flooringPackageM2: "flooring.material.m2",

  paintLitre: "paint.litre",
  paintingMaterialM2: "painting.material.m2",
} as const;

export const MATERIAL_CATEGORY_KEYS = {
  decking: "material.category.decking",
  sheet: "material.category.sheet",
  retaining: "material.category.retaining",
  flooring: "material.category.flooring",
  painting: "material.category.painting",
} as const;

export function getDeckBoardLmMaterialKey(material: string | null): string {
  const normalized = material?.toLowerCase() ?? "";
  if (normalized.includes("kwila")) {
    return MATERIAL_RATE_KEYS.deckingKwilaLm;
  }
  if (normalized.includes("composite")) {
    return MATERIAL_RATE_KEYS.deckingCompositeLm;
  }
  if (normalized.includes("hardwood")) {
    return MATERIAL_RATE_KEYS.deckingHardwoodLm;
  }
  if (normalized.includes("pine") || normalized.includes("treated")) {
    return MATERIAL_RATE_KEYS.deckingTreatedPineLm;
  }
  return MATERIAL_RATE_KEYS.deckingHardwoodLm;
}

export function getDeckBoardM2MaterialKey(material: string | null): string {
  const normalized = material?.toLowerCase() ?? "";
  if (normalized.includes("kwila")) {
    return MATERIAL_RATE_KEYS.deckingKwilaM2;
  }
  if (normalized.includes("composite")) {
    return MATERIAL_RATE_KEYS.deckingCompositeM2;
  }
  if (normalized.includes("hardwood")) {
    return MATERIAL_RATE_KEYS.deckingHardwoodM2;
  }
  return MATERIAL_RATE_KEYS.deckingTreatedPineM2;
}

export function getDeckLmBenchmark(material: string | null): {
  cost: number;
  sell: number;
} {
  const normalized = material?.toLowerCase() ?? "";
  if (normalized.includes("kwila")) {
    return DECK_BENCHMARKS.kwilaLm;
  }
  if (normalized.includes("composite")) {
    return DECK_BENCHMARKS.compositeLm;
  }
  if (normalized.includes("hardwood")) {
    return DECK_BENCHMARKS.hardwoodLm;
  }
  if (normalized.includes("pine") || normalized.includes("treated")) {
    return DECK_BENCHMARKS.treatedPineLm;
  }
  return DECK_BENCHMARKS.boardLm;
}

export function getPlasterboardSheetMaterialKey(
  plasterboardType: string | null | undefined
): string {
  const normalized = plasterboardType?.toLowerCase() ?? "";
  if (normalized.includes("fyre")) {
    return MATERIAL_RATE_KEYS.plasterboardFyrelineSheet;
  }
  if (normalized.includes("aqua")) {
    return MATERIAL_RATE_KEYS.plasterboardAqualineSheet;
  }
  if (normalized.includes("braceline") || normalized.includes("brac")) {
    return MATERIAL_RATE_KEYS.plasterboardBracelineSheet;
  }
  return MATERIAL_RATE_KEYS.plasterboardStandardSheet;
}

export function getScopeKeyForWorkArea(
  workAreaType: string
): string | undefined {
  const map: Record<string, string> = {
    deck: "scope.deck.m2",
    retaining_wall: "scope.retaining_wall.face_m2",
    flooring: "scope.flooring.m2",
  };
  return map[workAreaType];
}
