/**
 * FENCE-MATURITY-1A — metal and plastic modular section takeoff.
 * Same geometry engine; different material identities.
 */

import {
  FENCE_DEFAULT_EMBEDMENT_DISCLOSURE,
  FENCE_DEFAULT_HOLE_DIAMETER_DISCLOSURE,
  FENCE_DEFAULT_SECTION_WIDTH_DISCLOSURE,
  FENCE_METAL_DISPLACEMENT_DISCLOSURE,
  FENCE_PLASTIC_DISPLACEMENT_DISCLOSURE,
  FENCE_TOP_ALLOWANCE_DISCLOSURE,
} from "@/lib/estimate/fence-defaults";
import {
  applySectionCountOverride,
  FENCE_DEFAULT_EMBEDMENT_M,
  FENCE_DEFAULT_HOLE_DIAMETER_M,
  FENCE_DEFAULT_SECTION_WIDTH_M,
  FENCE_UNUSUAL_HEIGHT_M,
  modularSectionLayout,
  type FenceGeometry,
} from "@/lib/estimate/fence-geometry";
import {
  fenceMetalPostIdentity,
  fencePlasticPostIdentity,
  fenceSectionProductIdentity,
  type FenceSectionProductIdentity,
} from "@/lib/estimate/fence-identities";
import type { FenceMetalMaterial, FenceSystem } from "@/lib/estimate/fence-systems";
import {
  buildPostHoleBaggedConcrete,
  POST_HOLE_PREMIX_20KG_YIELD_M3,
  type PostHoleConcreteTakeoff,
} from "@/lib/estimate/post-hole-concrete";
import type { MaterialIdentity } from "@/lib/materials/identity";

export type FenceModularTakeoff = {
  system: Extract<FenceSystem, "METAL_SLAT_MODULAR" | "PLASTIC_MODULAR">;
  metalMaterial: FenceMetalMaterial | null;
  geometry: FenceGeometry;
  sectionWidthM: number;
  sectionWidthAssumed: boolean;
  sectionHeightM: number | null;
  heightMismatch: boolean;
  fullSectionCount: number;
  residualWidthM: number;
  purchasedSectionCount: number;
  sectionCountOverridden: boolean;
  coverageShortfallM: number;
  postCount: number;
  holeCount: number;
  positionsM: number[];
  embedmentM: number;
  embedmentAssumed: boolean;
  holeDiameterM: number;
  holeDiameterAssumed: boolean;
  postRequiredLengthM: number;
  postStockLm: number;
  concrete: PostHoleConcreteTakeoff;
  sectionProduct: FenceSectionProductIdentity;
  postIdentity: MaterialIdentity;
  gateIncluded: boolean;
  gateCount: number;
  gateWidthM: number;
  modularGatesModelled: false;
  fixedFenceLengthM: number;
  unusualHeight: boolean;
  assumptions: string[];
  attention: string[];
};

export function buildFenceModularTakeoff(params: {
  geometry: FenceGeometry;
  system: Extract<FenceSystem, "METAL_SLAT_MODULAR" | "PLASTIC_MODULAR">;
  metalMaterial: FenceMetalMaterial | null;
  sectionWidthM: number | null;
  sectionHeightM: number | null;
  sectionCountOverride: number | null;
  embedmentM: number | null;
  holeDiameterM: number | null;
}): FenceModularTakeoff {
  const assumptions: string[] = [];
  const attention: string[] = [];
  const { geometry, system } = params;

  const sectionWidthM =
    params.sectionWidthM != null && params.sectionWidthM > 0
      ? params.sectionWidthM
      : FENCE_DEFAULT_SECTION_WIDTH_M;
  const sectionWidthAssumed = params.sectionWidthM == null;
  if (sectionWidthAssumed) {
    assumptions.push(FENCE_DEFAULT_SECTION_WIDTH_DISCLOSURE);
    attention.push("Confirm modular panel width/product");
  }

  const metalMaterial: FenceMetalMaterial | null =
    system === "METAL_SLAT_MODULAR" ? params.metalMaterial ?? "aluminium" : null;
  if (system === "METAL_SLAT_MODULAR" && params.metalMaterial == null) {
    assumptions.push(
      "Metal slat material assumed aluminium unless steel is specified."
    );
  }
  let layout = modularSectionLayout(geometry.lengthM, sectionWidthM);
  const sectionCountOverridden =
    params.sectionCountOverride != null && params.sectionCountOverride > 0;
  if (sectionCountOverridden) {
    layout = applySectionCountOverride(
      layout,
      geometry.lengthM,
      params.sectionCountOverride as number
    );
  }

  const postCount = layout.postCount;
  const positionsM = layout.positionsM;
  const fixedFenceLengthM = geometry.lengthM;

  const embedmentM =
    params.embedmentM != null && params.embedmentM > 0
      ? params.embedmentM
      : FENCE_DEFAULT_EMBEDMENT_M;
  const embedmentAssumed = params.embedmentM == null;
  if (embedmentAssumed) assumptions.push(FENCE_DEFAULT_EMBEDMENT_DISCLOSURE);

  const holeDiameterM =
    params.holeDiameterM != null && params.holeDiameterM > 0
      ? params.holeDiameterM
      : FENCE_DEFAULT_HOLE_DIAMETER_M;
  const holeDiameterAssumed = params.holeDiameterM == null;
  if (holeDiameterAssumed) assumptions.push(FENCE_DEFAULT_HOLE_DIAMETER_DISCLOSURE);

  const displacementDisclosure =
    system === "PLASTIC_MODULAR"
      ? FENCE_PLASTIC_DISPLACEMENT_DISCLOSURE
      : FENCE_METAL_DISPLACEMENT_DISCLOSURE;
  if (displacementDisclosure) assumptions.push(displacementDisclosure);

  const unusualHeight = geometry.heightM > FENCE_UNUSUAL_HEIGHT_M;
  if (unusualHeight) {
    attention.push(
      "Confirm post embedment for this tall fence — the 0.6 m default may not be plausible."
    );
  }
  if (layout.coverageShortfallM > 0) {
    attention.push(
      "Section count coverage is less than the fence length — confirm section count."
    );
  }

  const sectionHeightM =
    params.sectionHeightM != null && params.sectionHeightM > 0
      ? params.sectionHeightM
      : null;
  const heightMismatch =
    sectionHeightM != null &&
    Math.abs(sectionHeightM - geometry.heightM) > 0.05;
  if (heightMismatch) {
    attention.push(
      "Selected panel height does not match the fence height. Manufactured sections are not stretched."
    );
  }

  assumptions.push(FENCE_TOP_ALLOWANCE_DISCLOSURE);
  const postRequiredLengthM = geometry.heightM + embedmentM;
  const postStockLm = postCount * postRequiredLengthM;

  const embedments = Array.from({ length: postCount }, () => embedmentM);
  const concrete = buildPostHoleBaggedConcrete({
    holeDiameterM,
    embedmentLengthsM: embedments,
    bagYieldM3: POST_HOLE_PREMIX_20KG_YIELD_M3,
    displacementForEmbedment: () => ({
      volumeM3: 0,
      kind: "UNKNOWN_ZERO",
      disclosure: displacementDisclosure,
    }),
  });

  const materialLabel =
    system === "PLASTIC_MODULAR"
      ? "plastic_composite"
      : metalMaterial ?? "aluminium";
  const sectionProduct = fenceSectionProductIdentity({
    system,
    material: materialLabel,
    sectionWidthM,
    sectionHeightM: sectionHeightM ?? geometry.heightM,
  });

  return {
    system,
    metalMaterial,
    geometry,
    sectionWidthM,
    sectionWidthAssumed,
    sectionHeightM,
    heightMismatch,
    fullSectionCount: layout.fullSectionCount,
    residualWidthM: layout.residualWidthM,
    purchasedSectionCount: layout.purchasedSectionCount,
    sectionCountOverridden,
    coverageShortfallM: layout.coverageShortfallM,
    postCount,
    holeCount: postCount,
    positionsM,
    embedmentM,
    embedmentAssumed,
    holeDiameterM,
    holeDiameterAssumed,
    postRequiredLengthM,
    postStockLm,
    concrete,
    sectionProduct,
    postIdentity:
      system === "PLASTIC_MODULAR"
        ? fencePlasticPostIdentity()
        : fenceMetalPostIdentity(metalMaterial ?? "aluminium"),
    gateIncluded: false,
    gateCount: 0,
    gateWidthM: 0,
    modularGatesModelled: false,
    fixedFenceLengthM,
    unusualHeight,
    assumptions,
    attention,
  };
}
