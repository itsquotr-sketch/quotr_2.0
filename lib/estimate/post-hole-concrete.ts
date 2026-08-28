/**
 * Shared post-hole bagged-concrete physical helper.
 *
 * Promoted from Retaining Wall R6 math. Work-area agnostic:
 * gross cylinder − post displacement = net concrete.
 * Bags = ceil(FULL-PRECISION net / bagYield) at JOB TOTAL.
 * Display rounding must not drive bags or labour.
 */

import { round2 } from "@/lib/estimate/facts";
import { cylinderVolumeM3 } from "@/lib/estimate/retaining-wall-geometry";

/** Common NZ 20 kg general-purpose premix yield. Merchant bags vary ~9–11 L. */
export const POST_HOLE_PREMIX_20KG_YIELD_M3 = 0.01;

/**
 * Shared physical productivity identity (labour-h / bag).
 * Fence uses a Fence-labelled key so Company rates stored against
 * retaining_wall.* are not silently reused. Same starter magnitude as R6.
 */
export const POST_HOLE_CONCRETE_PLACE_HOURS_PER_BAG_STARTER = 0.035;

export type PostDisplacementKind =
  | "HOUSE_PILE_RECT"
  | "SED_ROUND"
  | "STEEL_SECTION_AREA"
  | "STEEL_UNKNOWN_ZERO"
  | "TIMBER_RECT"
  | "UNKNOWN_ZERO"
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
  return Math.ceil(netConcreteM3 / bagYieldM3 - 1e-12);
}

export type PostHoleConcreteTakeoff = {
  holeDiameterM: number;
  holeCount: number;
  grossHoleVolumeM3: number;
  postDisplacementM3: number;
  netConcreteM3: number;
  netConcreteDisplayM3: number;
  bagCount: number;
  bagYieldM3: number;
  displacementKind: PostDisplacementKind;
  displacementDisclosure: string | null;
};

export function bagsPerHoleAvg(bagCount: number, holeCount: number): number {
  if (!(holeCount > 0)) return 0;
  return bagCount / holeCount;
}

export function finalizePostHoleConcrete(params: {
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

/**
 * Generic post-hole bagged concrete: one cylinder per embedment, minus
 * caller-supplied displacement. holeDiameterM is DIAMETER, not radius.
 */
export function buildPostHoleBaggedConcrete(params: {
  holeDiameterM: number;
  embedmentLengthsM: readonly number[];
  bagYieldM3: number;
  displacementForEmbedment: (embedmentM: number) => PostDisplacementResult;
}): PostHoleConcreteTakeoff {
  let gross = 0;
  let displacement = 0;
  let disclosure: string | null = null;
  let kind: PostDisplacementKind = "NONE";
  for (const embed of params.embedmentLengthsM) {
    gross += cylinderVolumeM3(params.holeDiameterM, embed);
    const d = params.displacementForEmbedment(embed);
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
