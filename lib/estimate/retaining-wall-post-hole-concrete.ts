/**
 * RETAINING-WALL-PHYSICAL-CORRECTNESS-R6 / R6-R1 — post-hole concrete netting.
 *
 * Gross hole cylinder − embedded post displacement = net concrete placed.
 * Procurement and labour use FULL-PRECISION net; display rounding is separate.
 * Displacement uses known section geometry only; unknown steel area → 0 (conservative).
 */

import { round2 } from "@/lib/estimate/facts";
import { cylinderVolumeM3 } from "@/lib/estimate/retaining-wall-geometry";
import {
  RW_PILE_MATERIAL_H5_SED,
  RW_PILE_MATERIAL_HOUSE_PILE_125,
} from "@/lib/estimate/retaining-wall-family-coverage";
import { HOUSE_PILE_125_RW_IDENTITY } from "@/lib/estimate/retaining-wall-identities";
import { RW_H5_SED_CLASS_DEFAULT } from "@/lib/estimate/retaining-wall-pile-procurement";

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

export type PostDisplacementKind =
  | "HOUSE_PILE_RECT"
  | "SED_ROUND"
  | "STEEL_SECTION_AREA"
  | "STEEL_UNKNOWN_ZERO"
  | "NONE";

export type PostDisplacementResult = {
  volumeM3: number;
  kind: PostDisplacementKind;
  disclosure: string | null;
};

export function squareSectionDisplacementM3(
  sideM: number,
  embedmentM: number
): number {
  if (!(sideM > 0) || !(embedmentM > 0)) return 0;
  return sideM * sideM * embedmentM;
}

export function rectangularSectionDisplacementM3(
  widthM: number,
  depthM: number,
  embedmentM: number
): number {
  if (!(widthM > 0) || !(depthM > 0) || !(embedmentM > 0)) return 0;
  return widthM * depthM * embedmentM;
}

export function roundSectionDisplacementM3(
  diameterM: number,
  embedmentM: number
): number {
  return cylinderVolumeM3(diameterM, embedmentM);
}

export function steelSectionDisplacementM3(
  crossSectionAreaM2: number,
  embedmentM: number
): number {
  if (!(crossSectionAreaM2 > 0) || !(embedmentM > 0)) return 0;
  return crossSectionAreaM2 * embedmentM;
}

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

export function netConcreteFromGrossAndDisplacement(
  grossHoleVolumeM3: number,
  postDisplacementM3: number
): number {
  return Math.max(grossHoleVolumeM3 - Math.max(postDisplacementM3, 0), 0);
}

export function bagCountFromNetConcrete(
  netConcreteM3: number,
  bagYieldM3: number
): number {
  if (!(netConcreteM3 > 0) || !(bagYieldM3 > 0)) return 0;
  // ceil on full-precision net. Tiny epsilon only avoids FP exact-multiple overshoot.
  return Math.ceil(netConcreteM3 / bagYieldM3 - 1e-12);
}

export type PostHoleConcreteTakeoff = {
  holeDiameterM: number;
  holeCount: number;
  /** Full-precision gross (calc authority). Display may round2. */
  grossHoleVolumeM3: number;
  /** Full-precision displacement (calc authority). */
  postDisplacementM3: number;
  /** Full-precision net — bags and labour use this, not a pre-rounded display value. */
  netConcreteM3: number;
  /** Display helper only — round2(net). Must not drive bags or labour. */
  netConcreteDisplayM3: number;
  bagCount: number;
  bagYieldM3: number;
  displacementKind: PostDisplacementKind;
  displacementDisclosure: string | null;
};

function finalizePostHoleConcrete(params: {
  holeDiameterM: number;
  holeCount: number;
  gross: number;
  displacement: number;
  bagYieldM3: number;
  kind: PostDisplacementKind;
  disclosure: string | null;
}): PostHoleConcreteTakeoff {
  const grossHoleVolumeM3 = params.gross;
  const postDisplacementM3 = params.displacement;
  const netConcreteM3 = netConcreteFromGrossAndDisplacement(
    grossHoleVolumeM3,
    postDisplacementM3
  );
  return {
    holeDiameterM: params.holeDiameterM,
    holeCount: params.holeCount,
    grossHoleVolumeM3,
    postDisplacementM3,
    netConcreteM3,
    netConcreteDisplayM3: round2(netConcreteM3),
    bagCount: bagCountFromNetConcrete(netConcreteM3, params.bagYieldM3),
    bagYieldM3: params.bagYieldM3,
    displacementKind: params.kind,
    displacementDisclosure: params.disclosure,
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
