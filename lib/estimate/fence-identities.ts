/**
 * FENCE-MATURITY-1A — material identities.
 * Physical identity only. No invented NZD. Fence posts are NOT retaining-wall piles.
 */

import {
  buildStructuralTimberIdentity,
  CONCRETE_FAMILY,
  STRUCTURAL_TIMBER_FAMILY,
  type MaterialIdentity,
} from "@/lib/materials/identity";
import type {
  FenceMetalMaterial,
  FenceSystem,
  FenceTimberSpecies,
} from "@/lib/estimate/fence-systems";

export const FENCE_POST_SECTION = "100x100";
export const FENCE_POST_TREATMENT = "h4";
export const FENCE_BOARD_WIDTH_MM = 150;

export const FENCE_FACE_AREA_COMPONENT = "fence.face";
export const FENCE_POSTS_EA_COMPONENT = "fence.posts.ea";
export const FENCE_POSTS_LM_COMPONENT = "fence.posts.lm";
export const FENCE_BOARDS_COMPONENT = "fence.boards";
export const FENCE_RAILS_COMPONENT = "fence.rails";
export const FENCE_CAPPING_COMPONENT = "fence.capping";
export const FENCE_GATE_FRAME_COMPONENT = "fence.gate.frame";
export const FENCE_GATE_HARDWARE_COMPONENT = "fence.gate.hardware";
export const FENCE_GATE_POSTS_EA_COMPONENT = "fence.gate.posts.ea";
export const FENCE_CONCRETE_COMPONENT = "fence.post_hole_concrete";
export const FENCE_FIXINGS_TIMBER_COMPONENT = "fence.fixings.timber.allowance";
export const FENCE_FIXINGS_MODULAR_COMPONENT = "fence.fixings.panel_brackets.allowance";
export const FENCE_SECTIONS_COMPONENT = "fence.sections";
export const FENCE_POST_LABOUR_COMPONENT = "fence.posts.install";
export const FENCE_FRAMING_LABOUR_COMPONENT = "fence.framing.install";
export const FENCE_BOARD_LABOUR_COMPONENT = "fence.boards.install";
export const FENCE_CAPPING_LABOUR_COMPONENT = "fence.capping.install";
export const FENCE_GATE_LABOUR_COMPONENT = "fence.gate.install";
export const FENCE_CONCRETE_LABOUR_COMPONENT = "fence.post_hole_concrete.place";
export const FENCE_SECTION_LABOUR_COMPONENT = "fence.sections.install";

export const FENCE_PREMIX_20KG_KEY = "fence.concrete.premix.20kg.bag";
export const FENCE_GATE_HARDWARE_KEY = "fence.gate.hardware.ea";
export const FENCE_FIXINGS_TIMBER_KEY = "fence.fixings.timber.allowance";
export const FENCE_FIXINGS_MODULAR_KEY = "fence.fixings.panel_brackets.allowance";
export const FENCE_POST_MATERIAL_KEY = "fence.timber.post.100x100.h4";
export const FENCE_GATE_FRAME_MATERIAL_KEY = "fence.gate.frame.75x50.h4";
export const FENCE_CAPPING_SECTION = "65x40";

export function fencePostMaterialKey(): string {
  return FENCE_POST_MATERIAL_KEY;
}

export function fenceGateFrameMaterialKey(): string {
  return FENCE_GATE_FRAME_MATERIAL_KEY;
}

export function fenceBoardMaterialKey(
  species: FenceTimberSpecies,
  thicknessMm: number
): string {
  return `fence.board.${species}.150x${thicknessMm}`;
}

export function fenceCappingMaterialKey(species: FenceTimberSpecies): string {
  return `fence.capping.${species}.${FENCE_CAPPING_SECTION}`;
}

export const FENCE_POST_IDENTITY: MaterialIdentity = {
  family: STRUCTURAL_TIMBER_FAMILY,
  productFamily: "fence_post",
  section: FENCE_POST_SECTION,
  grade: null,
  treatment: FENCE_POST_TREATMENT,
  treatmentKind: "known",
  treatmentCustom: null,
  processing: null,
  processingKind: "unknown",
  species: "radiata_pine",
  originalDescription:
    "Treated H4 100×100 timber fence post — not a retaining-wall H5 SED or house pile",
};

export const FENCE_POST_SECTION_M = 0.1;

export const FENCE_PREMIX_IDENTITY: MaterialIdentity = {
  family: CONCRETE_FAMILY,
  productFamily: "premix_20kg",
  section: null,
  grade: "20kg",
  treatment: null,
  treatmentKind: "unknown",
  treatmentCustom: null,
  processing: null,
  processingKind: "unknown",
  species: null,
  originalDescription: "20 kg bagged premix for fence post holes",
};

export const FENCE_GATE_HARDWARE_IDENTITY: MaterialIdentity = {
  family: "hardware",
  productFamily: "fence_gate_hardware",
  section: null,
  grade: null,
  treatment: null,
  treatmentKind: "unknown",
  treatmentCustom: null,
  processing: null,
  processingKind: "unknown",
  species: null,
  originalDescription: "Fence gate hardware — hinges, latch/lock, normal fixings",
};

const SPECIES_DESCRIPTION: Record<FenceTimberSpecies, string> = {
  radiata_pine: "Radiata Pine",
  macrocarpa: "Macrocarpa",
  cedar: "Cedar",
  hardwood: "Hardwood",
};

export function fenceBoardIdentity(params: {
  species: FenceTimberSpecies;
  thicknessMm: number;
}): MaterialIdentity {
  const section = `${FENCE_BOARD_WIDTH_MM}x${params.thicknessMm}`;
  const built = buildStructuralTimberIdentity({
    sectionRaw: section,
    treatmentRaw: "h3.2",
    species: params.species,
    originalDescription: `${SPECIES_DESCRIPTION[params.species]} ${section} mm fence board/paling`,
    productFamily: "fence_board",
  });
  return (
    built ?? {
      family: STRUCTURAL_TIMBER_FAMILY,
      productFamily: "fence_board",
      section,
      grade: null,
      treatment: "h3.2",
      treatmentKind: "known",
      treatmentCustom: null,
      processing: null,
      processingKind: "unknown",
      species: params.species,
      originalDescription: `${SPECIES_DESCRIPTION[params.species]} ${section} mm fence board/paling`,
    }
  );
}

export function fenceCappingIdentity(species: FenceTimberSpecies): MaterialIdentity {
  return {
    family: STRUCTURAL_TIMBER_FAMILY,
    productFamily: "fence_capping",
    section: "65x40",
    grade: null,
    treatment: "h3.2",
    treatmentKind: "known",
    treatmentCustom: null,
    processing: null,
    processingKind: "unknown",
    species,
    originalDescription: `${SPECIES_DESCRIPTION[species]} timber fence capping`,
  };
}

export const FENCE_RAIL_SECTION_DEFAULT = "75x50";
export const FENCE_RAIL_SECTION_DEFAULT_LABEL = "75 × 50mm H4";
export const FENCE_RAIL_SECTION_OPTIONS = [
  "75 × 50mm H4",
  "100 × 50mm H4",
  "75 × 40mm H4",
] as const;

export function parseFenceRailSection(
  raw: string | null | undefined
): { section: string; assumed: boolean } {
  if (!raw || !String(raw).trim() || /not sure/i.test(String(raw))) {
    return { section: FENCE_RAIL_SECTION_DEFAULT, assumed: true };
  }
  const match = String(raw)
    .replace(/×/g, "x")
    .match(/(\d+)\s*x\s*(\d+)/i);
  if (!match) {
    return { section: FENCE_RAIL_SECTION_DEFAULT, assumed: true };
  }
  return { section: `${match[1]}x${match[2]}`, assumed: false };
}

export function fenceRailMaterialKey(section: string): string {
  return `fence.rail.${section}.h4`;
}

export function fenceRailIdentity(section?: string | null): MaterialIdentity {
  const parsed = parseFenceRailSection(section);
  const display = parsed.section.replace("x", "×");
  return {
    family: STRUCTURAL_TIMBER_FAMILY,
    productFamily: "fence_rail",
    section: parsed.section,
    grade: null,
    treatment: FENCE_POST_TREATMENT,
    treatmentKind: "known",
    treatmentCustom: null,
    processing: null,
    processingKind: "unknown",
    species: "radiata_pine",
    originalDescription: `Treated H4 ${display} timber fence rail — structural framing, not the visible paling species. Estimating identity, not structural compliance.`,
  };
}

export function fenceGateFrameIdentity(): MaterialIdentity {
  return {
    family: STRUCTURAL_TIMBER_FAMILY,
    productFamily: "fence_gate_frame",
    section: "75x50",
    grade: null,
    treatment: FENCE_POST_TREATMENT,
    treatmentKind: "known",
    treatmentCustom: null,
    processing: null,
    processingKind: "unknown",
    species: "radiata_pine",
    originalDescription: "Treated timber gate frame (stiles, rails, brace) — estimating model",
  };
}

export type FenceSectionProductIdentity = {
  itemKey: string;
  familyKey: string;
  skuKey: string;
  system: Extract<FenceSystem, "METAL_SLAT_MODULAR" | "PLASTIC_MODULAR">;
  material: string;
  sectionWidthM: number;
  sectionHeightM: number | null;
  unit: "ea";
  description: string;
};

function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function fenceSectionFamilyKey(
  system: Extract<FenceSystem, "METAL_SLAT_MODULAR" | "PLASTIC_MODULAR">,
  material: string
): string {
  const systemSlug =
    system === "METAL_SLAT_MODULAR" ? "metal_slat" : "plastic_composite";
  return `fence.section.${systemSlug}.${slug(material) || "standard"}`;
}

export function fenceSectionSkuKey(
  system: Extract<FenceSystem, "METAL_SLAT_MODULAR" | "PLASTIC_MODULAR">,
  material: string,
  widthM: number,
  heightM: number | null
): string {
  const family = fenceSectionFamilyKey(system, material);
  const w = Math.round(widthM * 1000);
  const h = heightM != null && heightM > 0 ? Math.round(heightM * 1000) : null;
  return h != null ? `${family}.${w}x${h}` : `${family}.${w}`;
}

export function fenceSectionProductIdentity(params: {
  system: Extract<FenceSystem, "METAL_SLAT_MODULAR" | "PLASTIC_MODULAR">;
  material: string;
  sectionWidthM: number;
  sectionHeightM: number | null;
}): FenceSectionProductIdentity {
  const familyKey = fenceSectionFamilyKey(params.system, params.material);
  const skuKey = fenceSectionSkuKey(
    params.system,
    params.material,
    params.sectionWidthM,
    params.sectionHeightM
  );
  const label =
    params.system === "METAL_SLAT_MODULAR"
      ? `${params.material} slat fence section`
      : "Plastic / composite fence section";
  const heightBit =
    params.sectionHeightM != null
      ? ` × ${Math.round(params.sectionHeightM * 1000)} mm high`
      : "";
  return {
    itemKey: familyKey,
    familyKey,
    skuKey,
    system: params.system,
    material: params.material,
    sectionWidthM: params.sectionWidthM,
    sectionHeightM: params.sectionHeightM,
    unit: "ea",
    description: `${label} ${Math.round(params.sectionWidthM * 1000)} mm wide${heightBit}`,
  };
}

export function fenceMetalPostIdentity(material: FenceMetalMaterial): MaterialIdentity {
  return {
    family: material === "steel" ? "steel" : "aluminium",
    productFamily: "fence_post",
    section: null,
    grade: null,
    treatment: null,
    treatmentKind: "unknown",
    treatmentCustom: null,
    processing: null,
    processingKind: "unknown",
    species: null,
    originalDescription: `${material === "steel" ? "Steel" : "Aluminium"} fence post — section area unconfirmed`,
  };
}

export function fencePlasticPostIdentity(): MaterialIdentity {
  return {
    family: "plastic_composite",
    productFamily: "fence_post",
    section: null,
    grade: null,
    treatment: null,
    treatmentKind: "unknown",
    treatmentCustom: null,
    processing: null,
    processingKind: "unknown",
    species: null,
    originalDescription:
      "Plastic / composite fence post — displacement not deducted (section metadata unknown)",
  };
}

export const FENCE_TAKEOFF_COMPONENT_KEYS = [
  FENCE_FACE_AREA_COMPONENT,
  FENCE_POSTS_EA_COMPONENT,
  FENCE_POSTS_LM_COMPONENT,
  FENCE_BOARDS_COMPONENT,
  FENCE_RAILS_COMPONENT,
  FENCE_CAPPING_COMPONENT,
  FENCE_GATE_FRAME_COMPONENT,
  FENCE_GATE_HARDWARE_COMPONENT,
  FENCE_GATE_POSTS_EA_COMPONENT,
  FENCE_CONCRETE_COMPONENT,
  FENCE_FIXINGS_TIMBER_COMPONENT,
  FENCE_FIXINGS_MODULAR_COMPONENT,
  FENCE_SECTIONS_COMPONENT,
] as const;

/**
 * FENCE-MATURITY-1B-R1 timber fixings:
 * 8% of boards/slats + rails + capping material cost only.
 * Excludes posts, concrete, gate frame, gate hardware, waste, demolition, finish.
 */
export const FENCE_TIMBER_FIXINGS_COST_BASIS =
  "PROPORTIONAL_8_PERCENT_OF_BOARD_RAIL_CAPPING_MATERIAL_COST";
