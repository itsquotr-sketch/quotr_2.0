/**
 * RATES-MATERIALS-UI-01 — reviewed presentation mapping for Rates → Materials.
 *
 * Deterministic classification from canonical item keys and catalogue flags.
 * Does not rename, merge, or replace calculator identities. Does not guess
 * families from UI labels at render time.
 */

import type { RateCatalogueEntry } from "@/lib/rates/types";

const DIMENSIONED_PLASTERBOARD_KEY =
  /^sheet\.plasterboard\.([a-z]+)\.(\d+)mm\.(\d+)x(\d+)\.each$/;

function parseDimensionedPlasterboardKey(itemKey: string): {
  family: string;
  thicknessMm: number;
  lengthMm: number;
  widthMm: number;
} | null {
  const match = DIMENSIONED_PLASTERBOARD_KEY.exec(itemKey);
  if (!match) return null;
  return {
    family: match[1]!,
    thicknessMm: Number(match[2]),
    lengthMm: Number(match[3]),
    widthMm: Number(match[4]),
  };
}

export type MaterialCategoryId =
  | "plasterboard"
  | "other_sheet"
  | "timber_framing"
  | "steel_framing"
  | "ceiling_systems"
  | "insulation"
  | "fixings"
  | "paint_stopping"
  | "trim"
  | "bathroom"
  | "deck"
  | "fence"
  | "retaining"
  | "flooring";

export type MaterialVariantLayout = "sheet" | "framing" | "generic";

export type MaterialLegacyKind =
  | "legacy_identity"
  | "alias"
  | "leftover"
  | null;

export type MaterialPresentation = {
  categoryId: MaterialCategoryId;
  categoryName: string;
  familyId: string;
  familyName: string;
  familyDescription: string | null;
  variantLayout: MaterialVariantLayout;
  thickness: string | null;
  sheetSize: string | null;
  section: string | null;
  gradeTreatment: string | null;
  colourType: string | null;
  usedInWorkAreaTypes: readonly string[];
  ordinary: boolean;
  legacyKind: MaterialLegacyKind;
  aliasOfKey: string | null;
};

export const MATERIAL_CATEGORY_ORDER: readonly MaterialCategoryId[] = [
  "plasterboard",
  "other_sheet",
  "timber_framing",
  "steel_framing",
  "ceiling_systems",
  "insulation",
  "fixings",
  "paint_stopping",
  "trim",
  "bathroom",
  "deck",
  "fence",
  "retaining",
  "flooring",
];

export const MATERIAL_CATEGORY_NAMES: Record<MaterialCategoryId, string> = {
  plasterboard: "Plasterboard",
  other_sheet: "Other sheet materials",
  timber_framing: "Timber framing",
  steel_framing: "Steel framing",
  ceiling_systems: "Ceiling systems",
  insulation: "Insulation",
  fixings: "Fixings & consumables",
  paint_stopping: "Paint & stopping",
  trim: "Trim",
  bathroom: "Bathroom finishes",
  deck: "Deck",
  fence: "Fence",
  retaining: "Retaining walls",
  flooring: "Flooring",
};

export const MATERIAL_WORK_AREA_LABELS: Record<string, string> = {
  deck: "Deck",
  fence: "Fence",
  retaining_wall: "Retaining Wall",
  bathroom: "Bathroom",
  ceilings: "Ceilings",
  internal_walls: "Internal Walls",
  painting: "Painting",
  flooring: "Flooring",
};

const PLASTERBOARD_FAMILY_META: Record<
  string,
  { familyId: string; familyName: string; description: string }
> = {
  standard: {
    familyId: "gib-standard",
    familyName: "GIB Standard",
    description: "Standard GIB plasterboard sheets by thickness and size.",
  },
  aqualine: {
    familyId: "gib-aqualine",
    familyName: "GIB Aqualine",
    description: "Wet-area GIB Aqualine sheets by thickness and size.",
  },
  braceline: {
    familyId: "gib-braceline",
    familyName: "GIB Braceline",
    description: "Bracing GIB Braceline sheets by thickness and size.",
  },
  fyreline: {
    familyId: "gib-fyreline",
    familyName: "GIB Fyreline",
    description: "Fire-rated GIB Fyreline sheets by thickness and size.",
  },
  noiseline: {
    familyId: "gib-noiseline",
    familyName: "GIB Noiseline",
    description: "Acoustic GIB Noiseline sheets by thickness and size.",
  },
  weatherline: {
    familyId: "gib-weatherline",
    familyName: "GIB Weatherline",
    description: "GIB Weatherline sheets by thickness and size.",
  },
  barrierline: {
    familyId: "gib-barrierline",
    familyName: "GIB Barrierline",
    description: "GIB Barrierline sheets by thickness and size.",
  },
};

const LEGACY_PLASTERBOARD_GENERIC: Record<
  string,
  { family: string; thickness: string; sheetSize: string }
> = {
  "sheet.plasterboard.standard.each": {
    family: "standard",
    thickness: "13 mm",
    sheetSize: "2400 × 1200",
  },
  "sheet.plasterboard.aqualine.each": {
    family: "aqualine",
    thickness: "13 mm",
    sheetSize: "2400 × 1200",
  },
  "sheet.plasterboard.fyreline.each": {
    family: "fyreline",
    thickness: "13 mm",
    sheetSize: "2400 × 1200",
  },
  "sheet.plasterboard.braceline.each": {
    family: "braceline",
    thickness: "13 mm",
    sheetSize: "2400 × 1200",
  },
};

/** Canonical aliases that must not compete as ordinary edit rows. */
export const MATERIALS_PAGE_ALIAS_ROWS: ReadonlyArray<{
  aliasKey: string;
  canonicalKey: string;
  label: string;
  unit: string;
  explanation: string;
}> = [
  {
    aliasKey: "bathroom.framing.90x45.h1.2.lm",
    canonicalKey: "timber.framing.90x45.h1.2.lm",
    label: "90 × 45 H1.2 framing (legacy bathroom key)",
    unit: "lm",
    explanation:
      "Kept for earlier estimates. Ordinary Rates editing uses the shared timber framing identity.",
  },
  {
    aliasKey: "sheet.fibre_cement.tile_underlay.6mm.each",
    canonicalKey: "sheet.fibre_cement.tile_underlay.6mm.1800x1200.each",
    label: "6 mm tile underlay (legacy unsized key)",
    unit: "each",
    explanation:
      "Kept for earlier estimates. Ordinary Rates editing uses the 1800 × 1200 identity.",
  },
  {
    aliasKey: "ceilings.painting.m2",
    canonicalKey: "painting.material.m2",
    label: "Ceiling painting materials (legacy key)",
    unit: "m2",
    explanation:
      "Kept for earlier estimates. Ordinary Rates editing uses the shared paint materials identity.",
  },
];

const SHARED_KEY_WORK_AREAS: Record<string, readonly string[]> = {
  "timber.framing.90x45.h1.2.lm": ["internal_walls", "bathroom"],
  "timber.framing.140x45.h1.2.lm": ["internal_walls", "ceilings"],
  "painting.material.m2": ["painting", "ceilings"],
  "insulation.ceiling.thermal.m2": ["ceilings"],
  "insulation.wall.thermal.m2": ["internal_walls"],
  "steel.framing.track.lm": ["internal_walls"],
  "steel.framing.stud.lm": ["internal_walls"],
  "sheet.plywood.19mm.h3.2.each": ["bathroom"],
  "sheet.fibre_cement.18mm.2400x1200.each": ["bathroom"],
  "sheet.fibre_cement.tile_underlay.6mm.1800x1200.each": ["bathroom"],
  "internal_walls.framing.fixings.allowance": ["internal_walls"],
};

function uniqueAreas(areas: string[]): string[] {
  return [...new Set(areas.filter(Boolean))];
}

function plasterboardUsedIn(family: string): readonly string[] {
  if (family === "aqualine") {
    return ["internal_walls", "ceilings", "bathroom"];
  }
  return ["internal_walls", "ceilings"];
}

function plasterboardPresentation(
  familySlug: string,
  extra: Partial<MaterialPresentation>
): MaterialPresentation {
  const meta = PLASTERBOARD_FAMILY_META[familySlug];
  const familyName = meta?.familyName ?? `Plasterboard ${familySlug}`;
  const familyId = meta?.familyId ?? `plasterboard-${familySlug}`;
  return {
    categoryId: "plasterboard",
    categoryName: MATERIAL_CATEGORY_NAMES.plasterboard,
    familyId,
    familyName,
    familyDescription: meta?.description ?? null,
    variantLayout: "sheet",
    thickness: extra.thickness ?? null,
    sheetSize: extra.sheetSize ?? null,
    section: null,
    gradeTreatment: familyName,
    colourType: extra.colourType ?? null,
    usedInWorkAreaTypes: extra.usedInWorkAreaTypes ?? plasterboardUsedIn(familySlug),
    ordinary: extra.ordinary ?? true,
    legacyKind: extra.legacyKind ?? null,
    aliasOfKey: extra.aliasOfKey ?? null,
  };
}

function base(
  partial: Omit<MaterialPresentation, "categoryName"> & {
    categoryName?: string;
  }
): MaterialPresentation {
  return {
    ...partial,
    categoryName: partial.categoryName ?? MATERIAL_CATEGORY_NAMES[partial.categoryId],
  };
}

function fenceSpeciesFamily(species: string): { id: string; name: string } {
  const names: Record<string, string> = {
    radiata_pine: "Radiata pine palings",
    macrocarpa: "Macrocarpa palings",
    cedar: "Cedar palings",
    hardwood: "Hardwood palings",
  };
  return {
    id: `fence-palings-${species}`,
    name: names[species] ?? `${species} palings`,
  };
}

function fenceCappingFamily(species: string): { id: string; name: string } {
  const names: Record<string, string> = {
    radiata_pine: "Radiata pine capping",
    macrocarpa: "Macrocarpa capping",
    cedar: "Cedar capping",
    hardwood: "Hardwood capping",
  };
  return {
    id: `fence-capping-${species}`,
    name: names[species] ?? `${species} capping`,
  };
}

/**
 * Reviewed mapping from a canonical catalogue identity to presentation metadata.
 */
export function classifyMaterialPresentation(
  entry: RateCatalogueEntry
): MaterialPresentation {
  const key = entry.item_key;
  const leftover = entry.calculatorSupport === "leftover";

  const genericPb = LEGACY_PLASTERBOARD_GENERIC[key];
  if (genericPb) {
    return plasterboardPresentation(genericPb.family, {
      thickness: genericPb.thickness,
      sheetSize: genericPb.sheetSize,
      ordinary: false,
      legacyKind: "legacy_identity",
    });
  }

  const dim = parseDimensionedPlasterboardKey(key);
  if (dim) {
    return plasterboardPresentation(dim.family, {
      thickness: `${dim.thicknessMm} mm`,
      sheetSize: `${dim.lengthMm} × ${dim.widthMm}`,
    });
  }

  if (key === "sheet.plywood.each") {
    return base({
      categoryId: "other_sheet",
      familyId: "plywood-generic",
      familyName: "Plywood (generic)",
      familyDescription: "Unspecified plywood sheet. Not bathroom floor plywood.",
      variantLayout: "sheet",
      thickness: null,
      sheetSize: null,
      section: null,
      gradeTreatment: null,
      colourType: null,
      usedInWorkAreaTypes: ["internal_walls", "ceilings"],
      ordinary: !leftover,
      legacyKind: leftover ? "leftover" : null,
      aliasOfKey: null,
    });
  }
  if (key === "sheet.plywood.19mm.h3.2.each") {
    return base({
      categoryId: "other_sheet",
      familyId: "plywood-19-h32",
      familyName: "19 mm H3.2 structural plywood",
      familyDescription: "Bathroom floor plywood. Distinct from generic plywood.",
      variantLayout: "sheet",
      thickness: "19 mm",
      sheetSize: "2400 × 1200",
      section: null,
      gradeTreatment: "H3.2 CCA",
      colourType: null,
      usedInWorkAreaTypes: ["bathroom"],
      ordinary: true,
      legacyKind: null,
      aliasOfKey: null,
    });
  }
  if (key === "sheet.fibre_cement.18mm.2400x1200.each") {
    return base({
      categoryId: "other_sheet",
      familyId: "fc-18mm-legacy",
      familyName: "18 mm fibre cement",
      familyDescription: "Legacy bathroom structural sheet — not 19 mm flooring.",
      variantLayout: "sheet",
      thickness: "18 mm",
      sheetSize: "2400 × 1200",
      section: null,
      gradeTreatment: null,
      colourType: null,
      usedInWorkAreaTypes: ["bathroom"],
      ordinary: false,
      legacyKind: "legacy_identity",
      aliasOfKey: null,
    });
  }
  if (key.startsWith("sheet.fibre_cement.flooring.19mm.")) {
    const size =
      key.includes("2700x600")
        ? "2700 × 600"
        : key.includes("1800x900")
          ? "1800 × 900"
          : null;
    return base({
      categoryId: "other_sheet",
      familyId: "fc-flooring-19mm",
      familyName: "19 mm fibre-cement flooring",
      familyDescription: "Structural 19 mm fibre-cement flooring boards.",
      variantLayout: "sheet",
      thickness: "19 mm",
      sheetSize: size,
      section: null,
      gradeTreatment: null,
      colourType: size ? null : "Size not specified",
      usedInWorkAreaTypes: ["bathroom"],
      ordinary: true,
      legacyKind: null,
      aliasOfKey: null,
    });
  }
  if (key === "sheet.fibre_cement.secura.flooring.2400x600.each") {
    return base({
      categoryId: "other_sheet",
      familyId: "secura-flooring",
      familyName: "Secura flooring",
      familyDescription: "Distinct from generic 18 mm and 19 mm FC flooring.",
      variantLayout: "sheet",
      thickness: null,
      sheetSize: "2400 × 600",
      section: null,
      gradeTreatment: "Secura",
      colourType: null,
      usedInWorkAreaTypes: ["bathroom"],
      ordinary: true,
      legacyKind: null,
      aliasOfKey: null,
    });
  }
  if (key.startsWith("sheet.fibre_cement.tile_underlay.")) {
    return base({
      categoryId: "other_sheet",
      familyId: "tile-underlay-6mm",
      familyName: "6 mm ceramic tile underlay",
      familyDescription: "Hardie Ceramic Tile Underlay over plywood when tiling.",
      variantLayout: "sheet",
      thickness: "6 mm",
      sheetSize: key.includes("1800x1200") ? "1800 × 1200" : null,
      section: null,
      gradeTreatment: null,
      colourType: null,
      usedInWorkAreaTypes: ["bathroom"],
      ordinary: true,
      legacyKind: null,
      aliasOfKey: null,
    });
  }

  if (key.startsWith("timber.framing.")) {
    const sectionMatch = key.match(/timber\.framing\.(\d+x\d+)\.([^.]+\.[^.]+)/);
    const section = sectionMatch ? sectionMatch[1]!.replace("x", " × ") : null;
    const treatment = sectionMatch ? sectionMatch[2]!.toUpperCase().replace(".", ".") : null;
    return base({
      categoryId: "timber_framing",
      familyId: `interior-framing-${sectionMatch?.[1] ?? key}`,
      familyName: section
        ? `${section} interior framing`
        : "Interior framing",
      familyDescription:
        "Shared physical interior framing. Not Deck H3.2 timber.",
      variantLayout: "framing",
      thickness: null,
      sheetSize: null,
      section,
      gradeTreatment: treatment ? treatment.replace("H1.2", "H1.2") : "H1.2",
      colourType: null,
      usedInWorkAreaTypes:
        SHARED_KEY_WORK_AREAS[key] ?? ["internal_walls", "ceilings"],
      ordinary: true,
      legacyKind: null,
      aliasOfKey: null,
    });
  }

  if (
    key.startsWith("timber.") &&
    (key.includes("structural") ||
      key.includes("house_pile") ||
      key.includes("sawn") ||
      entry.work_area_type === "deck")
  ) {
    const sectionMatch = key.match(/(\d+x\d+)/);
    const treatmentMatch = key.match(/h\d(?:\.\d)?/i);
    const gradeMatch = key.match(/sg\d+/i);
    const section = sectionMatch ? sectionMatch[1]!.replace("x", " × ") : null;
    const gradeTreatment = [
      gradeMatch?.[0]?.toUpperCase(),
      treatmentMatch?.[0]?.toUpperCase(),
    ]
      .filter(Boolean)
      .join(" ");
    const isPost =
      /pile|post|support/i.test(`${key} ${entry.label}`) ||
      key.includes("100x100") ||
      key.includes("125x125");
    return base({
      categoryId: "deck",
      familyId: isPost ? "deck-posts" : "deck-framing-timber",
      familyName: isPost ? "Deck posts / piles" : "Deck framing timber",
      familyDescription: isPost
        ? "Exact pile/post identities."
        : "Exact H3.2 structural section identities for decks.",
      variantLayout: "framing",
      thickness: null,
      sheetSize: null,
      section,
      gradeTreatment: gradeTreatment || (isPost ? "H5" : "H3.2"),
      colourType: entry.label,
      usedInWorkAreaTypes: ["deck"],
      ordinary: true,
      legacyKind: leftover ? "leftover" : null,
      aliasOfKey: null,
    });
  }

  if (key.startsWith("steel.framing.")) {
    return base({
      categoryId: "steel_framing",
      familyId: "partition-steel",
      familyName: "Partition track & stud",
      familyDescription: "Ordinary 92 mm internal partition steel.",
      variantLayout: "framing",
      thickness: null,
      sheetSize: null,
      section: key.includes("track") ? "Track" : key.includes("stud") ? "Stud" : null,
      gradeTreatment: "Ordinary partition",
      colourType: null,
      usedInWorkAreaTypes: ["internal_walls"],
      ordinary: true,
      legacyKind: null,
      aliasOfKey: null,
    });
  }

  if (key.startsWith("steel.ceiling.")) {
    return base({
      categoryId: "ceiling_systems",
      familyId: "ceiling-steel",
      familyName: "Ceiling steel",
      familyDescription:
        "Perimeter track, channels, clips, droppers and suspension wire.",
      variantLayout: "generic",
      thickness: null,
      sheetSize: null,
      section: null,
      gradeTreatment: null,
      colourType: entry.label,
      usedInWorkAreaTypes: ["ceilings"],
      ordinary: true,
      legacyKind: leftover ? "leftover" : null,
      aliasOfKey: null,
    });
  }

  if (key === "timber.lining.profile.lm") {
    return base({
      categoryId: "ceiling_systems",
      familyId: "timber-lining",
      familyName: "Timber lining",
      familyDescription: "Decorative lining profile. Not structural framing.",
      variantLayout: "generic",
      thickness: null,
      sheetSize: null,
      section: null,
      gradeTreatment: null,
      colourType: "Profile",
      usedInWorkAreaTypes: ["ceilings"],
      ordinary: true,
      legacyKind: leftover ? "leftover" : null,
      aliasOfKey: null,
    });
  }

  if (key === "ceiling.tile.m2") {
    return base({
      categoryId: "ceiling_systems",
      familyId: "ceiling-tile-legacy-package",
      familyName: "Ceiling tile package (legacy)",
      familyDescription:
        "Leftover package identity. Nested estimates use dimensioned tiles plus T-grid.",
      variantLayout: "generic",
      thickness: null,
      sheetSize: null,
      section: null,
      gradeTreatment: null,
      colourType: "Package / m²",
      usedInWorkAreaTypes: ["ceilings"],
      ordinary: false,
      legacyKind: "leftover",
      aliasOfKey: null,
    });
  }

  if (key === "ceiling.grid.m2") {
    return base({
      categoryId: "ceiling_systems",
      familyId: "ceiling-t-grid",
      familyName: "Ceiling T-grid",
      familyDescription: "Ordinary commercial T-grid priced per ceiling m².",
      variantLayout: "generic",
      thickness: null,
      sheetSize: null,
      section: null,
      gradeTreatment: null,
      colourType: "T-grid",
      usedInWorkAreaTypes: ["ceilings"],
      ordinary: true,
      legacyKind: null,
      aliasOfKey: null,
    });
  }

  if (key.startsWith("ceiling.tile.")) {
    const sizeMatch = key.match(/(\d+)x(\d+)/);
    const sheetSize = sizeMatch
      ? `${sizeMatch[1]} × ${sizeMatch[2]}`
      : null;
    return base({
      categoryId: "ceiling_systems",
      familyId: "ceiling-tiles",
      familyName: "Ceiling tiles",
      familyDescription: "Ordinary generic commercial tiles by sheet size.",
      variantLayout: "sheet",
      thickness: null,
      sheetSize,
      section: null,
      gradeTreatment: "Ordinary commercial",
      colourType: null,
      usedInWorkAreaTypes: ["ceilings"],
      ordinary: true,
      legacyKind: leftover ? "leftover" : null,
      aliasOfKey: null,
    });
  }

  if (key.startsWith("insulation.")) {
    const application = key.includes(".wall.") ? "Wall" : "Ceiling";
    const isFireAcoustic = key.includes("fire_acoustic");
    const isAcoustic = key.includes(".acoustic.") && !isFireAcoustic;
    if (isFireAcoustic || isAcoustic) {
      return base({
        categoryId: "insulation",
        familyId: "wall-specialty-insulation",
        familyName: "Wall insulation",
        familyDescription:
          "Acoustic and fire-acoustic wall insulation. Pricing Required until a company rate exists — no Quotr V1 COST.",
        variantLayout: "generic",
        thickness: null,
        sheetSize: null,
        section: null,
        gradeTreatment: isFireAcoustic ? "Fire and acoustic" : "Acoustic",
        colourType: application,
        usedInWorkAreaTypes: ["internal_walls"],
        ordinary: true,
        legacyKind: leftover ? "leftover" : null,
        aliasOfKey: null,
      });
    }
    return base({
      categoryId: "insulation",
      familyId: "thermal-insulation",
      familyName: "Thermal / standard insulation",
      familyDescription:
        "Ordinary thermal batt. Acoustic and fire products stay Pricing Required identities if registered separately.",
      variantLayout: "generic",
      thickness: null,
      sheetSize: null,
      section: null,
      gradeTreatment: "Thermal / standard",
      colourType: application,
      usedInWorkAreaTypes: key.includes(".wall.")
        ? ["internal_walls"]
        : ["ceilings"],
      ordinary: true,
      legacyKind: leftover ? "leftover" : null,
      aliasOfKey: null,
    });
  }

  if (key.startsWith("ceilings.fixings.") || key === "internal_walls.framing.fixings.allowance") {
    const familyId = key.startsWith("internal_walls.")
      ? "iw-framing-fixings"
      : key.includes("bulkhead")
        ? "ceiling-bulkhead-fixings"
        : "ceiling-fixings";
    const familyName = key.startsWith("internal_walls.")
      ? "Internal wall fixings"
      : key.includes("bulkhead")
        ? "Ceiling bulkhead fixings"
        : "Ceiling fixings";
    const ordinary =
      key !== "ceilings.fixings.bulkhead_framing" && !leftover;
    return base({
      categoryId: "fixings",
      familyId,
      familyName,
      familyDescription: "Residual fixings and consumables allowances.",
      variantLayout: "generic",
      thickness: null,
      sheetSize: null,
      section: null,
      gradeTreatment: null,
      colourType: entry.label,
      usedInWorkAreaTypes: key.startsWith("internal_walls.")
        ? ["internal_walls"]
        : ["ceilings"],
      ordinary,
      legacyKind: leftover || key === "ceilings.fixings.bulkhead_framing"
        ? leftover
          ? "leftover"
          : "legacy_identity"
        : null,
      aliasOfKey: null,
    });
  }

  if (key.startsWith("fence.fixings.") || key === "fence.gate.hardware.ea") {
    return base({
      categoryId: "fixings",
      familyId: key.includes("hardware") ? "fence-gate-hardware" : "fence-fixings",
      familyName: key.includes("hardware")
        ? "Fence gate hardware"
        : "Fence fixings",
      familyDescription: "Fence hardware and residual fixings.",
      variantLayout: "generic",
      thickness: null,
      sheetSize: null,
      section: null,
      gradeTreatment: null,
      colourType: entry.label,
      usedInWorkAreaTypes: ["fence"],
      ordinary: true,
      legacyKind: leftover ? "leftover" : null,
      aliasOfKey: null,
    });
  }

  if (key === "paint.litre" || key === "painting.material.m2") {
    return base({
      categoryId: "paint_stopping",
      familyId: "paint-materials",
      familyName: "Paint materials",
      familyDescription:
        "Per-m² package is used now. Per-litre takeoff stays available until litres are priced.",
      variantLayout: "generic",
      thickness: null,
      sheetSize: null,
      section: null,
      gradeTreatment: null,
      colourType: key.endsWith(".m2") ? "Per m² package" : "Per litre",
      usedInWorkAreaTypes:
        SHARED_KEY_WORK_AREAS[key] ?? ["painting"],
      ordinary: true,
      legacyKind: leftover ? "leftover" : null,
      aliasOfKey: null,
    });
  }

  if (key === "painting.wall.m2") {
    return base({
      categoryId: "paint_stopping",
      familyId: "wall-painting",
      familyName: "Wall painting",
      familyDescription:
        "Internal Walls nested wall paint materials. Pricing Required until a company rate exists. Distinct from shared painting.material.m2.",
      variantLayout: "generic",
      thickness: null,
      sheetSize: null,
      section: null,
      gradeTreatment: null,
      colourType: "Per m² package",
      usedInWorkAreaTypes: ["internal_walls"],
      ordinary: true,
      legacyKind: leftover ? "leftover" : null,
      aliasOfKey: null,
    });
  }

  if (key.startsWith("stopping.") || key === "bathroom.stopping.m2") {
    return base({
      categoryId: "paint_stopping",
      familyId: "stopping",
      familyName: "Plasterboard stopping",
      familyDescription:
        key.includes("level5")
          ? "Level 5 stopping. Pricing Required until a company rate exists."
          : "Ordinary Level 4 stopping on new plasterboard.",
      variantLayout: "generic",
      thickness: null,
      sheetSize: null,
      section: null,
      gradeTreatment: key.includes("level5")
        ? "Level 5"
        : key.includes("level4")
          ? "Level 4"
          : null,
      colourType: entry.label,
      usedInWorkAreaTypes: key.startsWith("bathroom.")
        ? ["bathroom"]
        : ["internal_walls", "ceilings"],
      ordinary: true,
      legacyKind: leftover ? "leftover" : null,
      aliasOfKey: null,
    });
  }

  if (key.includes("skirting") || key.endsWith(".skirting.lm") || key === "internal_walls.skirting.material.lm") {
    return base({
      categoryId: "trim",
      familyId: "wall-skirting",
      familyName: "Wall skirting",
      familyDescription: "Ordinary pine/MDF wall skirting.",
      variantLayout: "generic",
      thickness: null,
      sheetSize: null,
      section: null,
      gradeTreatment: "Ordinary pine/MDF",
      colourType: null,
      usedInWorkAreaTypes: ["internal_walls"],
      ordinary: true,
      legacyKind: leftover ? "leftover" : null,
      aliasOfKey: null,
    });
  }

  if (key === "cornice.wall.lm" || key.startsWith("cornice.")) {
    return base({
      categoryId: "trim",
      familyId: "wall-cornice",
      familyName: "Cornice",
      familyDescription:
        "Wall cornice / scotia. Pricing Required until a company rate exists — no Quotr V1 COST.",
      variantLayout: "generic",
      thickness: null,
      sheetSize: null,
      section: null,
      gradeTreatment: null,
      colourType: entry.label,
      usedInWorkAreaTypes: ["internal_walls"],
      ordinary: true,
      legacyKind: leftover ? "leftover" : null,
      aliasOfKey: null,
    });
  }

  if (key.startsWith("bathroom.")) {
    let familyId = "bathroom-other";
    let familyName = "Bathroom materials";
    if (key.startsWith("bathroom.tile.")) {
      familyId = "bathroom-tile";
      familyName = "Bathroom tiling";
    } else if (key.startsWith("bathroom.waterproofing.")) {
      familyId = "bathroom-waterproofing";
      familyName = "Bathroom waterproofing";
    } else if (key.includes("sheet_vinyl")) {
      familyId = "bathroom-sheet-vinyl";
      familyName = "Bathroom sheet vinyl";
    } else if (key.includes("vinyl_plank")) {
      familyId = "bathroom-vinyl-plank";
      familyName = "Bathroom vinyl plank";
    }
    return base({
      categoryId: "bathroom",
      familyId,
      familyName,
      familyDescription: "Bathroom finish identities. Material PC and install stay separate keys.",
      variantLayout: "generic",
      thickness: null,
      sheetSize: null,
      section: null,
      gradeTreatment: null,
      colourType: entry.label,
      usedInWorkAreaTypes: ["bathroom"],
      ordinary: true,
      legacyKind: leftover ? "leftover" : null,
      aliasOfKey: null,
    });
  }

  if (key.startsWith("deck.material.") || key.includes("deck.fascia") || key.includes("deck.skirting")) {
    const family =
      key.includes("fascia")
        ? {
            id: "deck-fascia",
            name: "Deck fascia",
            desc: "Fascia / edge boards.",
          }
        : key.includes("skirting")
          ? {
              id: "deck-skirting",
              name: "Deck skirting",
              desc: "Full-height skirting / screening.",
            }
          : {
              id: "decking-boards",
              name: "Decking boards",
              desc: "Preferred cost per linear metre of board.",
            };
    const type = key.includes("treated_pine")
      ? "Treated pine"
      : key.includes("hardwood")
        ? "Hardwood"
        : key.includes("kwila")
          ? "Kwila"
          : key.includes("composite")
            ? "Composite"
            : null;
    return base({
      categoryId: "deck",
      familyId: family.id,
      familyName: family.name,
      familyDescription: family.desc,
      variantLayout: "generic",
      thickness: null,
      sheetSize: null,
      section: null,
      gradeTreatment: type,
      colourType: type,
      usedInWorkAreaTypes: ["deck"],
      ordinary: true,
      legacyKind: leftover ? "leftover" : null,
      aliasOfKey: null,
    });
  }

  if (key.startsWith("deck.concrete.") || key.includes("house.pile") || key.startsWith("deck.")) {
    let familyId = "deck-other";
    let familyName = "Deck materials";
    let desc: string | null = null;
    let layout: MaterialVariantLayout = "generic";
    let section: string | null = null;
    let grade: string | null = null;
    if (key.startsWith("deck.concrete.")) {
      familyId = "deck-concrete";
      familyName = "Deck post-hole concrete";
      desc = "20 kg premix bags.";
    } else if (key.includes("125") || key.toLowerCase().includes("pile") || key.includes("100x100") || key.includes("h5")) {
      familyId = "deck-posts";
      familyName = "Deck posts / piles";
      desc = "Exact pile/post identities.";
      layout = "framing";
      const sec = key.match(/(\d+x\d+)/);
      section = sec ? sec[1]!.replace("x", " × ") : null;
      grade = key.toLowerCase().includes("h5") ? "H5" : null;
    }
    return base({
      categoryId: "deck",
      familyId,
      familyName,
      familyDescription: desc,
      variantLayout: layout,
      thickness: null,
      sheetSize: null,
      section,
      gradeTreatment: grade,
      colourType: entry.label,
      usedInWorkAreaTypes: ["deck"],
      ordinary: true,
      legacyKind: leftover ? "leftover" : null,
      aliasOfKey: null,
    });
  }

  if (key.startsWith("fence.board.")) {
    let species = "radiata_pine";
    if (key.includes("macrocarpa")) species = "macrocarpa";
    else if (key.includes("cedar")) species = "cedar";
    else if (key.includes("hardwood")) species = "hardwood";
    else if (key.includes("radiata")) species = "radiata_pine";
    const fam = fenceSpeciesFamily(species);
    const thick = key.match(/150x(\d+)/);
    return base({
      categoryId: "fence",
      familyId: fam.id,
      familyName: fam.name,
      familyDescription: "Fence palings by species. Thickness is the exact variant.",
      variantLayout: "generic",
      thickness: thick ? `${thick[1]} mm` : null,
      sheetSize: null,
      section: "150 wide",
      gradeTreatment: species.replace(/_/g, " "),
      colourType: null,
      usedInWorkAreaTypes: ["fence"],
      ordinary: true,
      legacyKind: leftover ? "leftover" : null,
      aliasOfKey: null,
    });
  }

  if (key.startsWith("fence.capping.")) {
    let species = "radiata_pine";
    if (key.includes("macrocarpa")) species = "macrocarpa";
    else if (key.includes("cedar")) species = "cedar";
    else if (key.includes("hardwood")) species = "hardwood";
    const fam = fenceCappingFamily(species);
    return base({
      categoryId: "fence",
      familyId: fam.id,
      familyName: fam.name,
      familyDescription: "Fence capping 65 × 40 by species.",
      variantLayout: "framing",
      thickness: null,
      sheetSize: null,
      section: "65 × 40",
      gradeTreatment: species.replace(/_/g, " "),
      colourType: null,
      usedInWorkAreaTypes: ["fence"],
      ordinary: true,
      legacyKind: leftover ? "leftover" : null,
      aliasOfKey: null,
    });
  }

  if (key.startsWith("fence.rail.")) {
    const sectionMatch = key.match(/fence\.rail\.(\d+x\d+)/);
    return base({
      categoryId: "fence",
      familyId: "fence-rails",
      familyName: "Fence rails",
      familyDescription: "H4 fence rails by section.",
      variantLayout: "framing",
      thickness: null,
      sheetSize: null,
      section: sectionMatch ? sectionMatch[1]!.replace("x", " × ") : null,
      gradeTreatment: "H4",
      colourType: null,
      usedInWorkAreaTypes: ["fence"],
      ordinary: true,
      legacyKind: leftover ? "leftover" : null,
      aliasOfKey: null,
    });
  }

  if (key === "fence.timber.post.100x100.h4") {
    return base({
      categoryId: "fence",
      familyId: "fence-timber-posts",
      familyName: "Timber fence posts",
      familyDescription: "H4 100 × 100 posts. Not retaining-wall piles.",
      variantLayout: "framing",
      thickness: null,
      sheetSize: null,
      section: "100 × 100",
      gradeTreatment: "H4",
      colourType: null,
      usedInWorkAreaTypes: ["fence"],
      ordinary: true,
      legacyKind: leftover ? "leftover" : null,
      aliasOfKey: null,
    });
  }

  if (key.startsWith("fence.gate.frame") || key === "fence.gate.frame.75x50.h4") {
    return base({
      categoryId: "fence",
      familyId: "fence-gate",
      familyName: "Fence gate framing",
      familyDescription: "Timber gate frame identity.",
      variantLayout: "framing",
      thickness: null,
      sheetSize: null,
      section: "75 × 50",
      gradeTreatment: "H4",
      colourType: null,
      usedInWorkAreaTypes: ["fence"],
      ordinary: true,
      legacyKind: leftover ? "leftover" : null,
      aliasOfKey: null,
    });
  }

  if (key.startsWith("fence.concrete.")) {
    return base({
      categoryId: "fence",
      familyId: "fence-concrete",
      familyName: "Fence post-hole concrete",
      familyDescription: "20 kg premix for fence holes. Distinct key from Deck/RW.",
      variantLayout: "generic",
      thickness: null,
      sheetSize: null,
      section: null,
      gradeTreatment: null,
      colourType: "20 kg bag",
      usedInWorkAreaTypes: ["fence"],
      ordinary: true,
      legacyKind: leftover ? "leftover" : null,
      aliasOfKey: null,
    });
  }

  if (key.startsWith("fence.section.") || key.startsWith("fence.post.metal.") || key.startsWith("fence.post.plastic")) {
    const plastic =
      key.includes("plastic") || entry.label.toLowerCase().includes("plastic");
    const steel = key.includes("steel");
    const aluminium = key.includes("aluminium") || key.includes("aluminum");
    const isPost = key.includes(".post.");
    const familyId = isPost
      ? plastic
        ? "fence-modular-posts-plastic"
        : steel
          ? "fence-modular-posts-steel"
          : "fence-modular-posts-aluminium"
      : plastic
        ? "fence-modular-sections-plastic"
        : steel
          ? "fence-modular-sections-steel"
          : "fence-modular-sections-aluminium";
    return base({
      categoryId: "fence",
      familyId,
      familyName: isPost ? "Modular fence posts" : "Modular fence sections",
      familyDescription: "Manufactured section/post identities. Not timber palings.",
      variantLayout: "generic",
      thickness: null,
      sheetSize: null,
      section: null,
      gradeTreatment: aluminium
        ? "Aluminium"
        : steel
          ? "Steel"
          : plastic
            ? "Plastic / composite"
            : null,
      colourType: entry.label,
      usedInWorkAreaTypes: ["fence"],
      ordinary: true,
      legacyKind: leftover ? "leftover" : null,
      aliasOfKey: null,
    });
  }

  if (key.startsWith("fence.")) {
    return base({
      categoryId: "fence",
      familyId: "fence-other",
      familyName: "Fence materials",
      familyDescription: null,
      variantLayout: "generic",
      thickness: null,
      sheetSize: null,
      section: null,
      gradeTreatment: null,
      colourType: entry.label,
      usedInWorkAreaTypes: ["fence"],
      ordinary: !leftover,
      legacyKind: leftover ? "leftover" : null,
      aliasOfKey: null,
    });
  }

  if (key.startsWith("retaining_wall.")) {
    let familyId = "rw-other";
    let familyName = "Retaining wall materials";
    let layout: MaterialVariantLayout = "generic";
    let section: string | null = null;
    let grade: string | null = null;
    let ordinary = !leftover;
    if (key.includes("face_board")) {
      familyId = "rw-face-boards";
      familyName = "Retaining face boards";
      layout = "framing";
      const sec = key.match(/(\d+x\d+)/);
      section = sec ? sec[1]!.replace("x", " × ") : null;
      grade = "H4 No.2 / retaining";
    } else if (key.includes("h5_sed")) {
      familyId = "rw-h5-poles";
      familyName = "H5 SED poles";
      layout = "framing";
      ordinary = key !== "retaining_wall.timber.pile.h5_sed" && !leftover;
      const len = key.match(/(\d+_\d+m|\d+m)/);
      section = len ? len[1]!.replace("_", ".") : null;
      grade = "H5 SED 150–175 mm";
    } else if (key.includes("sleeper") || key.includes("precast")) {
      familyId = "rw-sleepers";
      familyName = "Precast sleepers";
    } else if (key.includes("h-section") || key.includes("h_section") || key.includes("steel.post")) {
      familyId = "rw-h-posts";
      familyName = "H-section posts";
      layout = "framing";
    } else if (key.includes("novacoil") || key.includes("drainage") || key.includes("backfill") || key.includes("sock")) {
      familyId = "rw-drainage";
      familyName = "Drainage & backfill";
    } else if (key.includes("masonry")) {
      familyId = "rw-masonry";
      familyName = "Masonry retaining";
    } else if (key.includes("premix") || key.includes("concrete")) {
      familyId = "rw-concrete";
      familyName = "Retaining post-hole concrete";
    }
    return base({
      categoryId: "retaining",
      familyId,
      familyName,
      familyDescription: "Retaining-wall identities. Face-m² packages are leftover fallbacks.",
      variantLayout: layout,
      thickness: null,
      sheetSize: null,
      section,
      gradeTreatment: grade,
      colourType: entry.label,
      usedInWorkAreaTypes: ["retaining_wall"],
      ordinary: ordinary && !leftover,
      legacyKind: leftover
        ? "leftover"
        : ordinary
          ? null
          : "legacy_identity",
      aliasOfKey: null,
    });
  }

  if (key.startsWith("flooring.")) {
    return base({
      categoryId: "flooring",
      familyId: "flooring-planned",
      familyName: "Flooring materials",
      familyDescription: "Planned flooring identities. Current estimates may still use a package.",
      variantLayout: "generic",
      thickness: null,
      sheetSize: null,
      section: null,
      gradeTreatment: null,
      colourType: entry.label,
      usedInWorkAreaTypes: ["flooring"],
      ordinary: true,
      legacyKind: leftover ? "leftover" : null,
      aliasOfKey: null,
    });
  }

  const wa = entry.work_area_type?.trim();
  const fallbackCategory: MaterialCategoryId =
    wa === "deck"
      ? "deck"
      : wa === "fence"
        ? "fence"
        : wa === "retaining_wall"
          ? "retaining"
          : wa === "bathroom"
            ? "bathroom"
            : wa === "painting"
              ? "paint_stopping"
              : wa === "flooring"
                ? "flooring"
                : "other_sheet";
  return base({
    categoryId: fallbackCategory,
    familyId: `reviewed-fallback-${(entry.workAreaLabel ?? entry.item_key)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")}`,
    familyName: entry.workAreaLabel ?? entry.label,
    familyDescription:
      "Reviewed fallback grouping — exact identity unchanged.",
    variantLayout: "generic",
    thickness: null,
    sheetSize: null,
    section: null,
    gradeTreatment: null,
    colourType: entry.label,
    usedInWorkAreaTypes: wa ? [wa] : [],
    ordinary: !leftover,
    legacyKind: leftover ? "leftover" : null,
    aliasOfKey: null,
  });
}

export function materialWorkAreaLabel(workAreaType: string): string {
  if (MATERIAL_WORK_AREA_LABELS[workAreaType]) {
    return MATERIAL_WORK_AREA_LABELS[workAreaType]!;
  }
  return workAreaType
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function uniqueWorkAreas(areas: readonly string[]): string[] {
  return uniqueAreas([...areas]);
}
