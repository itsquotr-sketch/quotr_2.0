/**
 * RETAINING-WALL-MATURITY-1A — material identities.
 * Physical identity only. No invented NZD. Do not use Deck house piles.
 */

import {
  STRUCTURAL_FRAMING_PRODUCT_FAMILY,
  STRUCTURAL_TIMBER_FAMILY,
  buildConcreteMaterialIdentity,
  buildStructuralTimberIdentity,
  serializeMaterialIdentityKey,
  type MaterialIdentity,
} from "@/lib/materials/identity";

export const RW_FACE_BOARD_150_H4_KEY =
  "retaining_wall.timber.face_board.150x50.h4";
export const RW_FACE_BOARD_200_H4_KEY =
  "retaining_wall.timber.face_board.200x50.h4";
export const RW_H5_SED_POLE_KEY = "retaining_wall.timber.pile.h5_sed";
export const RW_CONCRETE_SLEEPER_KEY = "retaining_wall.sleeper.precast";
export const RW_STEEL_POST_KEY = "retaining_wall.sleeper.steel_post";
export const RW_DRAINAGE_AGGREGATE_KEY = "retaining_wall.backfill.m3";
export const RW_NOVACOIL_KEY = "retaining_wall.drainage.lm";
export const RW_PREMIX_20KG_KEY = "deck.concrete.premix.20kg.bag";
export const RW_MASONRY_200_KEY = "retaining_wall.masonry.block.200_series";
export const RW_MASONRY_150_KEY = "retaining_wall.masonry.block.150_series";
export const RW_CORE_FILL_KEY = "retaining_wall.masonry.core_fill.m3";
export const RW_FOOTING_CONCRETE_KEY = "retaining_wall.masonry.footing.m3";
export const RW_SUBBASE_KEY = "retaining_wall.masonry.subbase.m3";
export const RW_REBAR_KEY = "retaining_wall.masonry.rebar.lm";
export const RW_WATERPROOFING_LIQUID_KEY =
  "retaining_wall.masonry.waterproofing.liquid";
export const RW_WATERPROOFING_SHEET_KEY =
  "retaining_wall.masonry.waterproofing.sheet";

export const RW_FACE_AREA_COMPONENT = "retaining_wall.face";
export const RW_NOVACOIL_COMPONENT = "retaining_wall.drainage.novacoil";
export const RW_BACKFILL_COMPONENT = "retaining_wall.backfill.volume";
export const RW_EXCAVATION_COMPONENT = "retaining_wall.excavation.bulk";
export const RW_TIMBER_BOARDS_COMPONENT = "retaining_wall.timber.face_boards";
export const RW_TIMBER_PILES_EA_COMPONENT = "retaining_wall.timber.piles.ea";
export const RW_TIMBER_PILES_LM_COMPONENT = "retaining_wall.timber.piles.lm";
export const RW_SLEEPER_COMPONENT = "retaining_wall.sleeper.sleepers";
export const RW_SLEEPER_POSTS_EA_COMPONENT = "retaining_wall.sleeper.posts.ea";
export const RW_SLEEPER_POSTS_LM_COMPONENT = "retaining_wall.sleeper.posts.lm";
export const RW_SLEEPER_CONCRETE_COMPONENT = "retaining_wall.sleeper.hole_concrete";
export const RW_MASONRY_BLOCKS_COMPONENT = "retaining_wall.masonry.blocks";
export const RW_MASONRY_FOOTING_COMPONENT = "retaining_wall.masonry.footing";
export const RW_MASONRY_SUBBASE_COMPONENT = "retaining_wall.masonry.subbase";
export const RW_MASONRY_CORE_COMPONENT = "retaining_wall.masonry.core_fill";
export const RW_MASONRY_WATERPROOF_COMPONENT = "retaining_wall.masonry.waterproofing";
export const RW_MASONRY_REBAR_COMPONENT = "retaining_wall.masonry.rebar";

export type MasonrySeriesMetadata = {
  series: "150" | "200";
  materialKey: string;
  unitsPerM2: number;
  blocksPerM3CoreFill: number;
  moduleMm: { length: number; height: number; width: number };
  identity: MaterialIdentity;
};

function timberBoard(section: string, description: string): MaterialIdentity {
  return (
    buildStructuralTimberIdentity({
      sectionRaw: section,
      treatmentRaw: "H4",
      originalDescription: description,
      productFamily: STRUCTURAL_FRAMING_PRODUCT_FAMILY,
    }) ?? {
      family: STRUCTURAL_TIMBER_FAMILY,
      productFamily: STRUCTURAL_FRAMING_PRODUCT_FAMILY,
      section,
      grade: null,
      treatment: "h4",
      treatmentKind: "known",
      treatmentCustom: null,
      processing: null,
      processingKind: "unknown",
      species: null,
      originalDescription: description,
    }
  );
}

export const TIMBER_FACE_BOARD_150_H4: MaterialIdentity = timberBoard(
  "150x50",
  "150×50 H4 retaining-wall face board"
);

export const TIMBER_FACE_BOARD_200_H4: MaterialIdentity = timberBoard(
  "200x50",
  "200×50 H4 retaining-wall face board"
);

export const H5_SED_POLE_IDENTITY: MaterialIdentity = {
  family: STRUCTURAL_TIMBER_FAMILY,
  productFamily: "sed_pole",
  section: null,
  grade: null,
  treatment: "h5",
  treatmentKind: "known",
  treatmentCustom: null,
  processing: null,
  processingKind: "unknown",
  species: null,
  originalDescription:
    "H5 SED / pole — retaining-wall pile, not a deck house pile",
};

export const CONCRETE_SLEEPER_IDENTITY: MaterialIdentity = {
  family: "precast",
  productFamily: "concrete_sleeper",
  section: null,
  grade: null,
  treatment: null,
  treatmentKind: "unknown",
  treatmentCustom: null,
  processing: null,
  processingKind: "unknown",
  species: null,
  originalDescription: "Precast concrete retaining-wall sleeper",
};

export const STEEL_RW_POST_IDENTITY: MaterialIdentity = {
  family: "steel",
  productFamily: "retaining_wall_post",
  section: null,
  grade: null,
  treatment: null,
  treatmentKind: "unknown",
  treatmentCustom: null,
  processing: null,
  processingKind: "unknown",
  species: null,
  originalDescription: "Steel retaining-wall post",
};

export const DRAINAGE_AGGREGATE_IDENTITY: MaterialIdentity = {
  family: "aggregate",
  productFamily: "drainage_metal",
  section: null,
  grade: null,
  treatment: null,
  treatmentKind: "unknown",
  treatmentCustom: null,
  processing: null,
  processingKind: "unknown",
  species: null,
  originalDescription: "Free-draining drainage aggregate / drainage metal",
};

export const NOVACOIL_IDENTITY: MaterialIdentity = {
  family: "drainage",
  productFamily: "novacoil",
  section: null,
  grade: null,
  treatment: null,
  treatmentKind: "unknown",
  treatmentCustom: null,
  processing: null,
  processingKind: "unknown",
  species: null,
  originalDescription: "Perforated drainage coil (novacoil)",
};

export function premix20kgIdentity(): MaterialIdentity {
  return buildConcreteMaterialIdentity({
    mixRaw: "20kg premix",
    originalDescription: "20 kg premix concrete bag",
  });
}

export const MASONRY_SERIES_200: MasonrySeriesMetadata = {
  series: "200",
  materialKey: RW_MASONRY_200_KEY,
  unitsPerM2: 12.5,
  blocksPerM3CoreFill: 125,
  moduleMm: { length: 390, height: 190, width: 190 },
  identity: {
    family: "masonry",
    productFamily: "concrete_masonry_block",
    section: "390x190x190",
    grade: "200-series",
    treatment: null,
    treatmentKind: "unknown",
    treatmentCustom: null,
    processing: null,
    processingKind: "unknown",
    species: null,
    originalDescription: "200-series masonry block 390×190×190",
  },
};

export const MASONRY_SERIES_150: MasonrySeriesMetadata = {
  series: "150",
  materialKey: RW_MASONRY_150_KEY,
  unitsPerM2: 12.5,
  blocksPerM3CoreFill: 165,
  moduleMm: { length: 390, height: 190, width: 140 },
  identity: {
    family: "masonry",
    productFamily: "concrete_masonry_block",
    section: "390x190x140",
    grade: "150-series",
    treatment: null,
    treatmentKind: "unknown",
    treatmentCustom: null,
    processing: null,
    processingKind: "unknown",
    species: null,
    originalDescription: "150-series masonry block",
  },
};

export function masonrySeriesFromFact(
  raw: string | null
): MasonrySeriesMetadata | null {
  if (!raw) return MASONRY_SERIES_200;
  const t = raw.toLowerCase();
  if (t.includes("150") || t.includes("15-series") || t.includes("15 series")) {
    return MASONRY_SERIES_150;
  }
  if (t.includes("200") || t.includes("20-series") || t.includes("20 series")) {
    return MASONRY_SERIES_200;
  }
  if (t.includes("300") || t.includes("25-series") || t.includes("25 series")) {
    return null;
  }
  return MASONRY_SERIES_200;
}

export function timberFaceBoardFromFact(raw: string | null): {
  identity: MaterialIdentity;
  materialKey: string;
  faceHeightM: number;
} {
  const t = (raw ?? "").toLowerCase();
  if (t.includes("200") || t.includes("200x50") || t.includes("200×50")) {
    return {
      identity: TIMBER_FACE_BOARD_200_H4,
      materialKey: RW_FACE_BOARD_200_H4_KEY,
      faceHeightM: 0.2,
    };
  }
  return {
    identity: TIMBER_FACE_BOARD_150_H4,
    materialKey: RW_FACE_BOARD_150_H4_KEY,
    faceHeightM: 0.15,
  };
}

export function identityKey(identity: MaterialIdentity): string {
  return serializeMaterialIdentityKey(identity);
}
