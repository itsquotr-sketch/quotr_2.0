/**
 * FENCE-MATURITY-1A-R1 — timber vertical paling and horizontal slat takeoff.
 */

import {
  FENCE_BOARD_WASTE_DISCLOSURE,
  FENCE_BOARD_WASTE_FACTOR,
  FENCE_DEFAULT_BOARD_THICKNESS_DISCLOSURE,
  FENCE_DEFAULT_EMBEDMENT_DISCLOSURE,
  FENCE_DEFAULT_HOLE_DIAMETER_DISCLOSURE,
  FENCE_DEFAULT_MAX_POST_SPACING_DISCLOSURE,
  FENCE_DEFAULT_SLAT_GAP_DISCLOSURE,
  FENCE_DEFAULT_SPECIES_DISCLOSURE,
  FENCE_VERTICAL_PALING_GAP_DISCLOSURE,
  FENCE_VERTICAL_PALING_GAP_IMPROVE,
  FENCE_DEFAULT_VERTICAL_PALING_GAP_MM,
  FENCE_GATE_CAPPING_ASSUMED_DISCLOSURE,
  FENCE_GATE_POSITION_ASSUMED_DISCLOSURE,
  FENCE_GATE_POST_SAME_SECTION_DISCLOSURE,
  FENCE_HORIZONTAL_SPAN_IMPROVE,
  FENCE_HORIZONTAL_SUPPORT_DECISION,
  FENCE_RAIL_SECTION_DISCLOSURE,
  FENCE_TOP_ALLOWANCE_DISCLOSURE,
} from "@/lib/estimate/fence-defaults";
import {
  fencePostOversizeAttention,
  procureFencePosts,
  type FencePostProcurement,
} from "@/lib/estimate/fence-post-procurement";
import {
  classifyFenceGatePosition,
  defaultRailCountForHeight,
  FENCE_BOARD_THICKNESS_19_MM,
  FENCE_DEFAULT_BOARD_WIDTH_M,
  FENCE_DEFAULT_EMBEDMENT_M,
  FENCE_DEFAULT_GATE_WIDTH_M,
  FENCE_DEFAULT_HOLE_DIAMETER_M,
  FENCE_DEFAULT_MAX_POST_SPACING_M,
  FENCE_DEFAULT_SLAT_GAP_MM,
  FENCE_GATE_POSITION_LABELS,
  FENCE_RAIL_COUNT_RATIONALE,
  FENCE_UNUSUAL_HEIGHT_M,
  gateFrameLm,
  horizontalCourseFit,
  layoutTimberPostsWithGate,
  occupiedSlatHeightM,
  segmentedVerticalBoardCounts,
  type FenceFixedRun,
  type FenceGeometry,
  type FenceGatePosition,
  type FencePostMark,
  type FenceSegmentedPostLayout,
} from "@/lib/estimate/fence-geometry";
import {
  FENCE_POST_IDENTITY,
  FENCE_POST_SECTION_M,
  fenceBoardIdentity,
  fenceCappingIdentity,
  fenceGateFrameIdentity,
  fenceRailIdentity,
  parseFenceRailSection,
} from "@/lib/estimate/fence-identities";
import type { FenceTimberSpecies } from "@/lib/estimate/fence-systems";
import {
  buildPostHoleBaggedConcrete,
  POST_HOLE_PREMIX_20KG_YIELD_M3,
  rectangularSectionDisplacementM3,
  type PostHoleConcreteTakeoff,
} from "@/lib/estimate/post-hole-concrete";
import { round2 } from "@/lib/estimate/facts";
import type { MaterialIdentity } from "@/lib/materials/identity";

export type FenceTimberOrientation = "vertical" | "horizontal";

export const FENCE_SLAT_COURSES_EXCEED_HEIGHT =
  "Selected slat courses exceed the nominated fence height.";

export type FenceTimberTakeoff = {
  orientation: FenceTimberOrientation;
  geometry: FenceGeometry;
  species: FenceTimberSpecies;
  speciesAssumed: boolean;
  thicknessMm: number;
  thicknessAssumed: boolean;
  boardWidthM: number;
  effectiveCoverWidthM: number;
  faceAreaM2: number;
  totalLengthM: number;
  fixedFenceLengthM: number;
  runs: readonly FenceFixedRun[];
  gateCount: number;
  gateWidthM: number;
  gateIncluded: boolean;
  gatePosition: FenceGatePosition | null;
  gatePositionAssumed: boolean;
  gatePositionLabel: string | null;
  boardCount: number;
  fixedBoardCount: number;
  gateBoardCount: number;
  courseCount: number | null;
  courseOverride: boolean;
  slatGapMm: number | null;
  palingGapMm: number | null;
  palingGapAssumed: boolean;
  effectivePitchM: number | null;
  occupiedHeightM: number | null;
  residualM: number | null;
  topClearanceM: number | null;
  bottomClearanceM: number | null;
  boardRequiredLm: number;
  boardPurchasedLm: number;
  wasteFactor: number;
  railCount: number | null;
  railLm: number;
  railRequiredLm: number;
  railPurchasedLm: number;
  railOverride: boolean;
  railSection: string | null;
  railSectionAssumed: boolean;
  cappingIncluded: boolean;
  cappingLm: number;
  fixedCappingLm: number;
  gateCappingLm: number;
  gateCappingIncluded: boolean;
  gateFrameLm: number;
  gateHardwareEa: number;
  postLayout: FenceSegmentedPostLayout;
  posts: readonly FencePostMark[];
  postCount: number;
  gateEdgePostCount: number;
  postRequiredLengthM: number;
  /** Physical required total lm = count × required length. Not purchase. */
  postStockLm: number;
  postPurchasedStockLengthM: number | null;
  postPurchasedLm: number | null;
  postProcurement: FencePostProcurement;
  embedmentM: number;
  embedmentAssumed: boolean;
  holeDiameterM: number;
  holeDiameterAssumed: boolean;
  holeCount: number;
  concrete: PostHoleConcreteTakeoff;
  boardIdentity: MaterialIdentity;
  cappingIdentity: MaterialIdentity | null;
  postIdentity: MaterialIdentity;
  gatePostIdentity: MaterialIdentity;
  railIdentity: MaterialIdentity | null;
  gateFrameIdentity: MaterialIdentity | null;
  horizontalSupportModel: "POST_TO_POST_NO_RAILS" | "VERTICAL_RAILS";
  unusualHeight: boolean;
  assumptions: string[];
  attention: string[];
};

export function resolveFenceBoardWasteFactor(
  timberFramingPercent: number | null | undefined
): { factor: number; disclosure: string; railDisclosure: string } {
  if (
    timberFramingPercent != null &&
    Number.isFinite(timberFramingPercent) &&
    timberFramingPercent >= 0
  ) {
    return {
      factor: timberFramingPercent / 100,
      disclosure: `Board/slat purchased length includes company timber-framing wastage of ${timberFramingPercent}%, applied once.`,
      railDisclosure: `Rail purchased length includes company timber-framing wastage of ${timberFramingPercent}%, applied once to rails (not stacked on face-board waste).`,
    };
  }
  return {
    factor: FENCE_BOARD_WASTE_FACTOR,
    disclosure: FENCE_BOARD_WASTE_DISCLOSURE,
    railDisclosure:
      "Rail purchased length includes a 5% procurement/waste factor, applied once to rails (not stacked on face-board waste).",
  };
}

export function buildFenceTimberTakeoff(params: {
  geometry: FenceGeometry;
  orientation: FenceTimberOrientation;
  species: FenceTimberSpecies | null;
  thicknessMm: number | null;
  maxPostSpacingM: number | null;
  embedmentM: number | null;
  holeDiameterM: number | null;
  slatGapMm: number | null;
  verticalPalingGapMm?: number | null;
  railCount: number | null;
  railSection?: string | null;
  cappingIncluded: boolean | null;
  gateIncluded: boolean | null;
  gateCount: number | null;
  gateWidthM: number | null;
  gatePosition?: string | null;
  gateCappingIncluded?: boolean | null;
  horizontalCourseCount?: number | null;
  wastePercent: number | null;
  selectedPostStockLengthM?: number | null;
  availablePostStockLengthsM?: readonly number[];
}): FenceTimberTakeoff {
  const assumptions: string[] = [];
  const attention: string[] = [];
  const { geometry } = params;

  const species: FenceTimberSpecies = params.species ?? "radiata_pine";
  const speciesAssumed = params.species == null;
  if (speciesAssumed) assumptions.push(FENCE_DEFAULT_SPECIES_DISCLOSURE);

  const thicknessMm =
    params.thicknessMm === 19 || params.thicknessMm === 25
      ? params.thicknessMm
      : FENCE_BOARD_THICKNESS_19_MM;
  const thicknessAssumed = params.thicknessMm == null;
  if (thicknessAssumed) assumptions.push(FENCE_DEFAULT_BOARD_THICKNESS_DISCLOSURE);

  const maxSpacing =
    params.maxPostSpacingM != null && params.maxPostSpacingM > 0
      ? params.maxPostSpacingM
      : FENCE_DEFAULT_MAX_POST_SPACING_M;
  if (params.maxPostSpacingM == null) {
    assumptions.push(FENCE_DEFAULT_MAX_POST_SPACING_DISCLOSURE);
  }

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

  const gateIncluded = params.gateIncluded === true;
  const gateCount = gateIncluded
    ? Math.max(1, Math.round(params.gateCount ?? 1))
    : 0;
  let gateWidthM = 0;
  if (gateIncluded) {
    if (params.gateWidthM != null && params.gateWidthM > 0) {
      gateWidthM = params.gateWidthM;
    } else {
      gateWidthM = FENCE_DEFAULT_GATE_WIDTH_M;
      assumptions.push(
        "Gate width assumed at 900 mm (Quotr estimating default). Confirm if known."
      );
      attention.push("Confirm gate width");
    }
  }

  let gatePosition: FenceGatePosition | null = null;
  let gatePositionAssumed = false;
  if (gateIncluded) {
    const classified = classifyFenceGatePosition(params.gatePosition);
    if (classified) {
      gatePosition = classified;
    } else {
      gatePosition = "WITHIN_FENCE_RUN";
      gatePositionAssumed = true;
      assumptions.push(FENCE_GATE_POSITION_ASSUMED_DISCLOSURE);
    }
  }

  const postLayout = layoutTimberPostsWithGate({
    lengthM: geometry.lengthM,
    maxSpacingM: maxSpacing,
    gateWidthM: gateIncluded ? gateWidthM : 0,
    gateCount: gateIncluded ? gateCount : 0,
    position: gatePosition ?? "WITHIN_FENCE_RUN",
  });
  const runs = postLayout.runs;
  const fixedFenceLengthM = postLayout.fixedFenceLengthM;
  const gateEdgePostCount = postLayout.gateEdgePostCount;
  if (gateIncluded) {
    assumptions.push(FENCE_GATE_POST_SAME_SECTION_DISCLOSURE);
  }

  const boardWidthM = FENCE_DEFAULT_BOARD_WIDTH_M;
  let palingGapMm: number | null = null;
  let palingGapAssumed = false;
  let effectivePitchM: number | null = null;
  if (params.orientation === "vertical") {
    if (params.verticalPalingGapMm != null && params.verticalPalingGapMm >= 0) {
      palingGapMm = params.verticalPalingGapMm;
    } else {
      palingGapMm = FENCE_DEFAULT_VERTICAL_PALING_GAP_MM;
      palingGapAssumed = true;
      assumptions.push(FENCE_VERTICAL_PALING_GAP_DISCLOSURE);
      attention.push(FENCE_VERTICAL_PALING_GAP_IMPROVE);
    }
    effectivePitchM = boardWidthM + palingGapMm / 1000;
  }
  const effectiveCoverWidthM = boardWidthM;
  const boards = segmentedVerticalBoardCounts({
    runs,
    gateWidthM: gateIncluded ? gateWidthM : 0,
    gateCount,
    boardWidthM,
    gapMm: palingGapMm ?? 0,
  });
  let boardCount = 0;
  let fixedBoardCount = boards.fixedBoardCount;
  let gateBoardCount = boards.gateBoardCount;
  let courseCount: number | null = null;
  let courseOverride = false;
  let slatGapMm: number | null = null;
  let occupiedHeightM: number | null = null;
  let residualM: number | null = null;
  let topClearanceM: number | null = null;
  let bottomClearanceM: number | null = null;
  let boardRequiredLm = 0;
  let railCount: number | null = null;
  let railLm = 0;
  let railOverride = false;
  let railSection: string | null = null;
  let railSectionAssumed = false;
  let horizontalSupportModel: FenceTimberTakeoff["horizontalSupportModel"] =
    "VERTICAL_RAILS";

  if (params.orientation === "vertical") {
    boardCount = boards.totalBoardCount;
    boardRequiredLm = boardCount * geometry.heightM;
    const derivedRails = defaultRailCountForHeight(geometry.heightM);
    if (params.railCount != null && params.railCount > 0) {
      railCount = Math.round(params.railCount);
      railOverride = true;
    } else {
      railCount = derivedRails;
      assumptions.push(FENCE_RAIL_COUNT_RATIONALE);
    }
    railLm = (railCount ?? 0) * fixedFenceLengthM;
    const railParsed = parseFenceRailSection(params.railSection);
    railSection = railParsed.section;
    railSectionAssumed = railParsed.assumed;
    if (railSectionAssumed) assumptions.push(FENCE_RAIL_SECTION_DISCLOSURE);
    horizontalSupportModel = "VERTICAL_RAILS";
  } else {
    slatGapMm =
      params.slatGapMm != null && params.slatGapMm >= 0
        ? params.slatGapMm
        : FENCE_DEFAULT_SLAT_GAP_MM;
    if (params.slatGapMm == null) {
      assumptions.push(FENCE_DEFAULT_SLAT_GAP_DISCLOSURE);
      attention.push("Confirm horizontal slat gap");
    }
    const derivedFit = horizontalCourseFit({
      heightM: geometry.heightM,
      boardWidthM,
      gapMm: slatGapMm,
    });
    if (params.horizontalCourseCount != null && params.horizontalCourseCount > 0) {
      courseCount = Math.round(params.horizontalCourseCount);
      courseOverride = true;
      occupiedHeightM = occupiedSlatHeightM(courseCount, boardWidthM, slatGapMm);
      residualM = geometry.heightM - occupiedHeightM;
      if (occupiedHeightM > geometry.heightM + 1e-9) {
        attention.push(FENCE_SLAT_COURSES_EXCEED_HEIGHT);
        topClearanceM = 0;
        bottomClearanceM = 0;
      } else {
        const half = Math.max(residualM, 0) / 2;
        topClearanceM = half;
        bottomClearanceM = half;
      }
    } else {
      courseCount = derivedFit.courseCount;
      occupiedHeightM = derivedFit.occupiedHeightM;
      residualM = derivedFit.residualM;
      topClearanceM = derivedFit.topClearanceM;
      bottomClearanceM = derivedFit.bottomClearanceM;
    }
    boardCount = courseCount;
    fixedBoardCount = courseCount;
    gateBoardCount = 0;
    boardRequiredLm = courseCount * geometry.lengthM;
    railCount = null;
    railLm = 0;
    horizontalSupportModel = "POST_TO_POST_NO_RAILS";
    assumptions.push(FENCE_HORIZONTAL_SUPPORT_DECISION);
    attention.push(FENCE_HORIZONTAL_SPAN_IMPROVE);
  }

  const waste = resolveFenceBoardWasteFactor(params.wastePercent);
  assumptions.push(waste.disclosure);
  const boardPurchasedLm = boardRequiredLm * (1 + waste.factor);
  const railRequiredLm = railLm;
  const railPurchasedLm = railRequiredLm * (1 + waste.factor);
  if (railRequiredLm > 0) assumptions.push(waste.railDisclosure);

  const cappingIncluded = params.cappingIncluded === true;
  const gateVisualWidthM = gateIncluded ? gateCount * gateWidthM : 0;
  let gateCappingIncluded = false;
  if (cappingIncluded && gateIncluded) {
    if (params.gateCappingIncluded === false) {
      gateCappingIncluded = false;
    } else {
      gateCappingIncluded = true;
      if (params.gateCappingIncluded == null) {
        assumptions.push(FENCE_GATE_CAPPING_ASSUMED_DISCLOSURE);
      }
    }
  }
  const fixedCappingLm = cappingIncluded ? fixedFenceLengthM : 0;
  const gateCappingLm = gateCappingIncluded ? gateVisualWidthM : 0;
  const cappingLm = fixedCappingLm + gateCappingLm;
  if (params.cappingIncluded == null) {
    assumptions.push("Top capping not included unless confirmed.");
  }

  const gateFrame = gateIncluded
    ? gateFrameLm(geometry.heightM, gateWidthM) * gateCount
    : 0;
  const gateHardwareEa = gateCount;

  const postRequiredLengthM = geometry.heightM + embedmentM;
  assumptions.push(FENCE_TOP_ALLOWANCE_DISCLOSURE);
  const postStockLm = postLayout.postCount * postRequiredLengthM;
  const postProcurement = procureFencePosts({
    requiredLengthEachM: postRequiredLengthM,
    postCount: postLayout.postCount,
    selectedStockLengthM: params.selectedPostStockLengthM,
    availableStockLengthsM: params.availablePostStockLengthsM,
  });
  if (postProcurement.ok) {
    assumptions.push(
      `Fence posts purchased as ${postProcurement.purchaseLengthEachM} m stock covering ${round2(postRequiredLengthM)} m required length (height + embedment). ${postProcurement.source === "selected" ? "Builder/company stock length selected." : postProcurement.source === "company_ladder" ? "Company stock-length ladder." : "Quotr H4 100×100 stock ladder."}`
    );
  } else if (postProcurement.reason === "exceeds_max_stock") {
    attention.push(fencePostOversizeAttention(postRequiredLengthM));
  } else if (postProcurement.reason === "selected_too_short") {
    attention.push(
      `Selected post stock length is shorter than the required ${round2(postRequiredLengthM)} m. Pricing Required — short stock was not used.`
    );
  }

  const unusualHeight = geometry.heightM > FENCE_UNUSUAL_HEIGHT_M;
  if (unusualHeight) {
    attention.push(
      "Confirm post embedment for this tall fence — the 0.6 m default may not be plausible."
    );
  }
  if (params.maxPostSpacingM == null) {
    attention.push("Confirm post spacing");
  }
  if (embedmentAssumed) {
    attention.push("Confirm post embedment");
  }

  const embedments = Array.from({ length: postLayout.postCount }, () => embedmentM);
  const concrete = buildPostHoleBaggedConcrete({
    holeDiameterM,
    embedmentLengthsM: embedments,
    bagYieldM3: POST_HOLE_PREMIX_20KG_YIELD_M3,
    displacementForEmbedment: (embed) => ({
      volumeM3: rectangularSectionDisplacementM3(
        FENCE_POST_SECTION_M,
        FENCE_POST_SECTION_M,
        embed
      ),
      kind: "TIMBER_RECT",
      disclosure: null,
    }),
  });

  const postIdentity = FENCE_POST_IDENTITY;
  const gatePostIdentity = postIdentity;
  const railIdentity =
    railLm > 0 ? fenceRailIdentity(railSection) : null;

  return {
    orientation: params.orientation,
    geometry,
    species,
    speciesAssumed,
    thicknessMm,
    thicknessAssumed,
    boardWidthM,
    effectiveCoverWidthM,
    faceAreaM2: geometry.faceAreaM2,
    totalLengthM: geometry.lengthM,
    fixedFenceLengthM,
    runs,
    gateCount,
    gateWidthM,
    gateIncluded,
    gatePosition,
    gatePositionAssumed,
    gatePositionLabel: gatePosition ? FENCE_GATE_POSITION_LABELS[gatePosition] : null,
    boardCount,
    fixedBoardCount,
    gateBoardCount,
    courseCount,
    courseOverride,
    slatGapMm,
    palingGapMm,
    palingGapAssumed,
    effectivePitchM,
    occupiedHeightM,
    residualM,
    topClearanceM,
    bottomClearanceM,
    boardRequiredLm,
    boardPurchasedLm,
    wasteFactor: waste.factor,
    railCount,
    railLm,
    railRequiredLm,
    railPurchasedLm,
    railOverride,
    railSection,
    railSectionAssumed,
    cappingIncluded,
    cappingLm,
    fixedCappingLm,
    gateCappingLm,
    gateCappingIncluded,
    gateFrameLm: gateFrame,
    gateHardwareEa,
    postLayout,
    posts: postLayout.posts,
    postCount: postLayout.postCount,
    gateEdgePostCount,
    postRequiredLengthM,
    postStockLm,
    postPurchasedStockLengthM: postProcurement.ok
      ? postProcurement.purchaseLengthEachM
      : null,
    postPurchasedLm: postProcurement.ok ? postProcurement.purchaseLm : null,
    postProcurement,
    embedmentM,
    embedmentAssumed,
    holeDiameterM,
    holeDiameterAssumed,
    holeCount: postLayout.postCount,
    concrete,
    boardIdentity: fenceBoardIdentity({ species, thicknessMm }),
    cappingIdentity: cappingIncluded ? fenceCappingIdentity(species) : null,
    postIdentity,
    gatePostIdentity,
    railIdentity,
    gateFrameIdentity: gateIncluded ? fenceGateFrameIdentity() : null,
    horizontalSupportModel,
    unusualHeight,
    assumptions,
    attention,
  };
}
