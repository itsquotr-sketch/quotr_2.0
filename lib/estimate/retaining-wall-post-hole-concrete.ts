/**
 * RETAINING-WALL-PHYSICAL-CORRECTNESS-R6 / R6-R1 — post-hole concrete netting.
 *
 * Gross hole cylinder − embedded post displacement = net concrete placed.
 * Procurement and labour use FULL-PRECISION net; display rounding is separate.
 * Displacement uses known section geometry only; unknown steel area → 0 (conservative).
 */

import { cylinderVolumeM3 } from "@/lib/estimate/retaining-wall-geometry";
import {
  RW_PILE_MATERIAL_H5_SED,
  RW_PILE_MATERIAL_HOUSE_PILE_125,
} from "@/lib/estimate/retaining-wall-family-coverage";
import { HOUSE_PILE_125_RW_IDENTITY } from "@/lib/estimate/retaining-wall-identities";
import { RW_H5_SED_CLASS_DEFAULT } from "@/lib/estimate/retaining-wall-pile-procurement";
import {
  bagCountFromNetConcrete,
  finalizePostHoleConcrete,
  netConcreteFromGrossAndDisplacement,
  rectangularSectionDisplacementM3,
  roundSectionDisplacementM3,
  squareSectionDisplacementM3,
  steelSectionDisplacementM3,
  type PostDisplacementKind,
  type PostDisplacementResult,
  type PostHoleConcreteTakeoff,
} from "@/lib/estimate/post-hole-concrete";

export {
  bagCountFromNetConcrete,
  netConcreteFromGrossAndDisplacement,
  rectangularSectionDisplacementM3,
  roundSectionDisplacementM3,
  squareSectionDisplacementM3,
  steelSectionDisplacementM3,
};
export type { PostDisplacementKind, PostDisplacementResult, PostHoleConcreteTakeoff };

/**
 * Quotr LOW-CONFIDENCE estimating fallback for H5 SED class 150–175 mm.
 * Mid-class diameter — NOT product metadata and NOT an exact selected SED size.
 */
export const RW_H5_SED_DISPLACEMENT_DIAMETER_M = 0.1625;
export const RW_H5_SED_DISPLACEMENT_DIAMETER_KIND =
  "QUOTR_ESTIMATING_FALLBACK" as const;
export const RW_H5_SED_DISPLACEMENT_DISCLOSURE =
  "SED post diameter assumed at 162.5 mm for concrete displacement (Quotr estimating fallback for 150–175 mm class). Confirm the selected post section if known.";

/**
 * Authoritative square section from HOUSE_PILE_125_RW_IDENTITY.section ("125x125").
 * Not derived from free-text labels at runtime.
 */
export function housePileSectionSidesMFromIdentitySection(
  section: string | null | undefined
): { widthM: number; depthM: number } | null {
  const match = /^(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)$/i.exec(
    (section ?? "").trim()
  );
  if (!match) return null;
  const widthMm = Number(match[1]);
  const depthMm = Number(match[2]);
  if (!(widthMm > 0) || !(depthMm > 0)) return null;
  return { widthM: widthMm / 1000, depthM: depthMm / 1000 };
}

const HOUSE_PILE_SIDES_PARSED = housePileSectionSidesMFromIdentitySection(
  HOUSE_PILE_125_RW_IDENTITY.section
);
if (!HOUSE_PILE_SIDES_PARSED) {
  throw new Error(
    "R6-R1: HOUSE_PILE_125_RW_IDENTITY.section must encode authoritative mm sides"
  );
}
const HOUSE_PILE_SIDES = HOUSE_PILE_SIDES_PARSED;

/** Side length (m) from identity section — square 125×125. */
export const RW_HOUSE_PILE_125_SECTION_M = HOUSE_PILE_SIDES.widthM;
export const RW_HOUSE_PILE_125_SECTION_SOURCE =
  "HOUSE_PILE_125_RW_IDENTITY.section" as const;

export const RW_STEEL_POST_DISPLACEMENT_UNKNOWN_DISCLOSURE =
  "Steel-post displacement not deducted because selected section area is not confirmed; concrete quantity is conservatively estimated.";

/**
 * Shared post-hole bagged concrete placement productivity (labour-h / bag).
 * New key — do not reinterpret legacy hours_per_m3 company rates as h/bag.
 */
export const RW_POST_HOLE_CONCRETE_PLACE_HOURS_PER_BAG_KEY =
  "retaining_wall.post_hole_concrete.place.hours_per_bag" as const;

/**
 * @deprecated Legacy labour-h/m³ key. Mature bagged path uses hours_per_bag.
 * Do not consume as h/bag authority.
 */
export const RW_POST_HOLE_CONCRETE_PLACE_HOURS_PER_M3_KEY =
  "retaining_wall.post_hole_concrete.place.hours_per_m3" as const;

/** @deprecated Kept for catalogue identity only. */
export const RW_POST_HOLE_CONCRETE_PLACE_HOURS_PER_M3_STARTER = 3.5;

/**
 * LOW-CONFIDENCE Quotr starter — bagged premix mix/place into post holes.
 * Dimensional conversion of the R6 validated 3.5 labour-h/m³ starter at the
 * canonical 0.01 m³/bag yield: 3.5 × 0.01 = 0.035 labour-h/bag.
 * Not a fixture-derived calibration.
 */
export const RW_POST_HOLE_CONCRETE_PLACE_HOURS_PER_BAG_STARTER = 0.035;
export const RW_POST_HOLE_CONCRETE_PLACE_STARTER_CONFIDENCE = "low" as const;
export const RW_POST_HOLE_CONCRETE_PLACE_STARTER_RATIONALE =
  "LOW-CONFIDENCE QUOTR STARTER. Total person-hours to mix and place one bag of post-hole concrete. Dimensional conversion of the prior 3.5 labour-h/m³ starter × 0.01 m³/bag yield. Company/Project exact overrides.";

export function timberPostDisplacementForEmbedment(params: {
  pileMaterial:
    | typeof RW_PILE_MATERIAL_H5_SED
    | typeof RW_PILE_MATERIAL_HOUSE_PILE_125;
  embedmentM: number;
}): PostDisplacementResult {
  const { pileMaterial, embedmentM } = params;
  if (!(embedmentM > 0)) {
    return { volumeM3: 0, kind: "NONE", disclosure: null };
  }
  if (pileMaterial === RW_PILE_MATERIAL_HOUSE_PILE_125) {
    return {
      volumeM3: rectangularSectionDisplacementM3(
        HOUSE_PILE_SIDES.widthM,
        HOUSE_PILE_SIDES.depthM,
        embedmentM
      ),
      kind: "HOUSE_PILE_RECT",
      disclosure: null,
    };
  }
  return {
    volumeM3: roundSectionDisplacementM3(
      RW_H5_SED_DISPLACEMENT_DIAMETER_M,
      embedmentM
    ),
    kind: "SED_ROUND",
    disclosure: RW_H5_SED_DISPLACEMENT_DISCLOSURE,
  };
}

/**
 * Steel H-post: use actual steel cross-section area when known.
 * Unknown → 0 displacement (over-order concrete, disclosed).
 */
export function steelPostDisplacementForEmbedment(params: {
  embedmentM: number;
  crossSectionAreaM2: number | null;
}): PostDisplacementResult {
  const { embedmentM, crossSectionAreaM2 } = params;
  if (!(embedmentM > 0)) {
    return { volumeM3: 0, kind: "NONE", disclosure: null };
  }
  if (crossSectionAreaM2 != null && crossSectionAreaM2 > 0) {
    return {
      volumeM3: steelSectionDisplacementM3(crossSectionAreaM2, embedmentM),
      kind: "STEEL_SECTION_AREA",
      disclosure: null,
    };
  }
  return {
    volumeM3: 0,
    kind: "STEEL_UNKNOWN_ZERO",
    disclosure: RW_STEEL_POST_DISPLACEMENT_UNKNOWN_DISCLOSURE,
  };
}

export function buildTimberPostHoleConcrete(params: {
  holeDiameterM: number;
  embedmentLengthsM: readonly number[];
  pileMaterial:
    | typeof RW_PILE_MATERIAL_H5_SED
    | typeof RW_PILE_MATERIAL_HOUSE_PILE_125;
  bagYieldM3: number;
}): PostHoleConcreteTakeoff {
  let gross = 0;
  let displacement = 0;
  let disclosure: string | null = null;
  let kind: PostDisplacementKind = "NONE";
  for (const embed of params.embedmentLengthsM) {
    // cylinderVolumeM3 expects DIAMETER (not radius).
    gross += cylinderVolumeM3(params.holeDiameterM, embed);
    const d = timberPostDisplacementForEmbedment({
      pileMaterial: params.pileMaterial,
      embedmentM: embed,
    });
    displacement += d.volumeM3;
    if (d.disclosure) disclosure = d.disclosure;
    if (d.kind !== "NONE") kind = d.kind;
  }
  return finalizePostHoleConcrete({
    holeDiameterM: params.holeDiameterM,
    holeCount: params.embedmentLengthsM.length,
    gross,
    displacement,
    bagYieldM3: params.bagYieldM3,
    kind,
    disclosure,
  });
}

export function buildSleeperPostHoleConcrete(params: {
  holeDiameterM: number;
  embedmentLengthsM: readonly number[];
  bagYieldM3: number;
  /** Known steel cross-section area in m²; null → conservative zero. */
  steelCrossSectionAreaM2: number | null;
}): PostHoleConcreteTakeoff {
  let gross = 0;
  let displacement = 0;
  let disclosure: string | null = null;
  let kind: PostDisplacementKind = "NONE";
  for (const embed of params.embedmentLengthsM) {
    gross += cylinderVolumeM3(params.holeDiameterM, embed);
    const d = steelPostDisplacementForEmbedment({
      embedmentM: embed,
      crossSectionAreaM2: params.steelCrossSectionAreaM2,
    });
    displacement += d.volumeM3;
    if (d.disclosure) disclosure = d.disclosure;
    if (d.kind !== "NONE") kind = d.kind;
  }
  return finalizePostHoleConcrete({
    holeDiameterM: params.holeDiameterM,
    holeCount: params.embedmentLengthsM.length,
    gross,
    displacement,
    bagYieldM3: params.bagYieldM3,
    kind,
    disclosure,
  });
}

void RW_H5_SED_CLASS_DEFAULT;
void RW_H5_SED_DISPLACEMENT_DIAMETER_KIND;
void RW_HOUSE_PILE_125_SECTION_SOURCE;
