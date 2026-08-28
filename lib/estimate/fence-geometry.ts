/**
 * FENCE-MATURITY-1A — shared fence geometry.
 * Length is the complete fence line including gate openings unless noted.
 * Face area = length × height (full internal precision).
 */

import { round2 } from "@/lib/estimate/facts";

export const FENCE_DEFAULT_MAX_POST_SPACING_M = 1.8;
export const FENCE_DEFAULT_SECTION_WIDTH_M = 1.8;
export const FENCE_DEFAULT_BOARD_WIDTH_M = 0.15;
export const FENCE_BOARD_THICKNESS_19_MM = 19;
export const FENCE_BOARD_THICKNESS_25_MM = 25;
export const FENCE_RAIL_COUNT_HEIGHT_THRESHOLD_M = 1.5;
export const FENCE_DEFAULT_EMBEDMENT_M = 0.6;
export const FENCE_DEFAULT_HOLE_DIAMETER_M = 0.3;
export const FENCE_DEFAULT_SLAT_GAP_MM = 10;
export const FENCE_DEFAULT_GATE_WIDTH_M = 0.9;
export const FENCE_UNUSUAL_HEIGHT_M = 2.1;
export const FENCE_STRAIGHT_RUN_DISCLOSURE =
  "Straight-run estimating assumption. Corners and multiple fence lines are not modelled as a polygon in Fence 1A.";

export type FenceGeometry = {
  lengthM: number;
  heightM: number;
  faceAreaM2: number;
};

export function fenceFaceAreaM2(lengthM: number, heightM: number): number {
  if (!(lengthM > 0) || !(heightM > 0)) return 0;
  return lengthM * heightM;
}

export function resolveFenceGeometry(params: {
  lengthM: number | null;
  heightM: number | null;
}): FenceGeometry | null {
  if (params.lengthM == null || !(params.lengthM > 0)) return null;
  if (params.heightM == null || !(params.heightM > 0)) return null;
  return {
    lengthM: params.lengthM,
    heightM: params.heightM,
    faceAreaM2: fenceFaceAreaM2(params.lengthM, params.heightM),
  };
}

export type FencePostLayout = {
  readonly targetSpacingM: number;
  readonly actualSpacingM: number;
  readonly bayCount: number;
  readonly postCount: number;
  readonly positionsM: number[];
  readonly firstAtZero: boolean;
  readonly lastAtLength: boolean;
  readonly layoutKind:
    | "TIMBER_MAX_SPACING"
    | "MODULAR_RESIDUAL"
    | "GATE_END_ASSUMED"
    | "TIMBER_SEGMENTED_GATE";
};

/**
 * Timber max-centre spacing. Bays even-split so resolved spacing <= max.
 * First post at 0, last post at L. Never leave unsupported residual beyond the last post.
 */
export function timberMaxSpacingLayout(
  lengthM: number,
  maxSpacingM: number
): FencePostLayout {
  const target =
    maxSpacingM > 0 ? maxSpacingM : FENCE_DEFAULT_MAX_POST_SPACING_M;
  if (!(lengthM > 0)) {
    return {
      targetSpacingM: target,
      actualSpacingM: target,
      bayCount: 0,
      postCount: 0,
      positionsM: [],
      firstAtZero: false,
      lastAtLength: false,
      layoutKind: "TIMBER_MAX_SPACING",
    };
  }
  const bayCount = Math.max(1, Math.ceil(lengthM / target - 1e-12));
  const actualSpacingM = lengthM / bayCount;
  const positionsM: number[] = [];
  for (let i = 0; i < bayCount; i += 1) {
    positionsM.push(round2((i * lengthM) / bayCount));
  }
  positionsM.push(round2(lengthM));
  return {
    targetSpacingM: target,
    actualSpacingM,
    bayCount,
    postCount: bayCount + 1,
    positionsM,
    firstAtZero: positionsM[0] === 0,
    lastAtLength: Math.abs((positionsM.at(-1) ?? 0) - round2(lengthM)) < 1e-9,
    layoutKind: "TIMBER_MAX_SPACING",
  };
}

export type FenceModularLayout = {
  readonly moduleM: number;
  readonly fullSectionCount: number;
  readonly residualWidthM: number;
  readonly purchasedSectionCount: number;
  readonly postCount: number;
  readonly holeCount: number;
  readonly positionsM: number[];
  readonly bayWidthsM: number[];
  readonly layoutKind: "MODULAR_RESIDUAL";
  readonly coverageShortfallM: number;
};

/**
 * Fixed-module layout. Does NOT even-redistribute bays.
 * full = floor(L/W); residual = L - full*W; residual > 0 → one extra purchased section.
 * posts = purchased sections + 1 (both end posts).
 */
export function modularSectionLayout(
  lengthM: number,
  moduleM: number
): FenceModularLayout {
  const resolvedModuleM = moduleM > 0 ? moduleM : FENCE_DEFAULT_SECTION_WIDTH_M;
  if (!(lengthM > 0)) {
    return {
      moduleM: resolvedModuleM,
      fullSectionCount: 0,
      residualWidthM: 0,
      purchasedSectionCount: 0,
      postCount: 0,
      holeCount: 0,
      positionsM: [],
      bayWidthsM: [],
      layoutKind: "MODULAR_RESIDUAL",
      coverageShortfallM: 0,
    };
  }
  const fullSectionCount = Math.floor((lengthM + 1e-12) / resolvedModuleM);
  const remainder = lengthM - fullSectionCount * resolvedModuleM;
  const hasResidual = remainder > 1e-9;
  const purchasedSectionCount = Math.max(
    1,
    fullSectionCount + (hasResidual ? 1 : 0)
  );
  const positionsM: number[] = [0];
  for (let i = 1; i <= fullSectionCount; i += 1) {
    positionsM.push(round2(i * resolvedModuleM));
  }
  if (hasResidual) {
    const end = round2(lengthM);
    if (Math.abs((positionsM.at(-1) ?? 0) - end) > 1e-9) {
      positionsM.push(end);
    }
  } else if (fullSectionCount === 0) {
    positionsM.push(round2(lengthM));
  }
  const bayWidthsM = positionsM.slice(0, -1).map((x0, index) =>
    round2((positionsM[index + 1] ?? lengthM) - x0)
  );
  const postCount = positionsM.length;
  return {
    moduleM: resolvedModuleM,
    fullSectionCount: hasResidual ? fullSectionCount : purchasedSectionCount,
    residualWidthM: hasResidual ? remainder : 0,
    purchasedSectionCount,
    postCount,
    holeCount: postCount,
    positionsM,
    bayWidthsM,
    layoutKind: "MODULAR_RESIDUAL",
    coverageShortfallM: 0,
  };
}

/**
 * Apply an explicit purchased-section override without rewriting it.
 * Coverage shortfall is reported when override × module is materially less than L.
 */
export function applySectionCountOverride(
  layout: FenceModularLayout,
  lengthM: number,
  overrideCount: number
): FenceModularLayout {
  if (!(overrideCount > 0) || !Number.isFinite(overrideCount)) return layout;
  const purchased = Math.round(overrideCount);
  const coverage = purchased * layout.moduleM;
  const shortfall = Math.max(0, lengthM - coverage);
  const positionsM: number[] = [0];
  for (let i = 1; i < purchased; i += 1) {
    positionsM.push(round2(Math.min(i * layout.moduleM, lengthM)));
  }
  positionsM.push(round2(lengthM));
  const unique = positionsM.filter(
    (x, i, arr) => i === 0 || Math.abs(x - (arr[i - 1] ?? 0)) > 1e-9
  );
  return {
    ...layout,
    purchasedSectionCount: purchased,
    postCount: unique.length,
    holeCount: unique.length,
    positionsM: unique,
    bayWidthsM: unique.slice(0, -1).map((x0, index) =>
      round2((unique[index + 1] ?? lengthM) - x0)
    ),
    coverageShortfallM: shortfall > 0.05 ? shortfall : 0,
  };
}

export const FENCE_GATE_POST_ASSUMPTION =
  "Gate location along the run is unknown. Estimating assumption: the gate opening occupies the start of the fence line (x = 0). One gate-edge post coincides with the fence end post at x = 0; the second gate-edge post sits at the opening width. Remaining fixed fence is laid out independently and does not space through the opening.";

/**
 * Timber/modular posts with unknown gate placement.
 * Guarantees two gate-edge posts; deducts the end-post coincidence at x = 0.
 */
export function layoutPostsWithEndGate(params: {
  lengthM: number;
  innerLayout: (fixedLengthM: number) => FencePostLayout;
  gateOpeningsM: readonly number[];
}): FencePostLayout & { gateOpeningM: number; fixedFenceLengthM: number } {
  const gateOpeningM = Math.max(
    0,
    params.gateOpeningsM.reduce((sum, w) => sum + Math.max(w, 0), 0)
  );
  const lengthM = params.lengthM;
  if (!(lengthM > 0)) {
    const empty = params.innerLayout(0);
    return { ...empty, gateOpeningM, fixedFenceLengthM: 0 };
  }
  if (!(gateOpeningM > 1e-9)) {
    const inner = params.innerLayout(lengthM);
    return { ...inner, gateOpeningM: 0, fixedFenceLengthM: lengthM };
  }
  const opening = Math.min(gateOpeningM, lengthM);
  const fixedFenceLengthM = Math.max(lengthM - opening, 0);
  if (fixedFenceLengthM <= 1e-9) {
    return {
      targetSpacingM: 0,
      actualSpacingM: lengthM,
      bayCount: 1,
      postCount: 2,
      positionsM: [0, round2(lengthM)],
      firstAtZero: true,
      lastAtLength: true,
      layoutKind: "GATE_END_ASSUMED",
      gateOpeningM: opening,
      fixedFenceLengthM: 0,
    };
  }
  const inner = params.innerLayout(fixedFenceLengthM);
  const positionsM = [0];
  for (const x of inner.positionsM) {
    positionsM.push(round2(opening + x));
  }
  const unique = positionsM.filter(
    (x, i, arr) => i === 0 || Math.abs(x - (arr[i - 1] ?? 0)) > 1e-9
  );
  return {
    targetSpacingM: inner.targetSpacingM,
    actualSpacingM: inner.actualSpacingM,
    bayCount: unique.length - 1,
    postCount: unique.length,
    positionsM: unique,
    firstAtZero: unique[0] === 0,
    lastAtLength: Math.abs((unique.at(-1) ?? 0) - round2(lengthM)) < 1e-9,
    layoutKind: "GATE_END_ASSUMED",
    gateOpeningM: opening,
    fixedFenceLengthM,
  };
}

export type FenceGatePosition = "AT_END" | "WITHIN_FENCE_RUN";

export const FENCE_GATE_POSITION_LABELS: Record<FenceGatePosition, string> = {
  AT_END: "At an end",
  WITHIN_FENCE_RUN: "Within the fence run",
};

export const FENCE_GATE_POSITION_OPTIONS = [
  FENCE_GATE_POSITION_LABELS.AT_END,
  FENCE_GATE_POSITION_LABELS.WITHIN_FENCE_RUN,
  "Not sure",
] as const;

export function classifyFenceGatePosition(
  raw: string | null | undefined
): FenceGatePosition | null {
  if (!raw || !raw.trim()) return null;
  const t = raw.toLowerCase();
  if (t.includes("not sure") || t.includes("unsure")) return null;
  if (
    t.includes("within") ||
    t.includes("centre") ||
    t.includes("center") ||
    t.includes("internal") ||
    t === "within_fence_run"
  ) {
    return "WITHIN_FENCE_RUN";
  }
  if (t.includes("end") || t === "at_end") return "AT_END";
  return null;
}

export type FenceFixedRun = {
  readonly startM: number;
  readonly endM: number;
  readonly lengthM: number;
};

export type FencePostRole = "start" | "end" | "gate_edge" | "intermediate";

export type FencePostMark = {
  readonly xM: number;
  readonly roles: readonly FencePostRole[];
};

export type FenceSegmentedPostLayout = FencePostLayout & {
  readonly gateOpeningM: number;
  readonly fixedFenceLengthM: number;
  readonly runs: readonly FenceFixedRun[];
  readonly posts: readonly FencePostMark[];
  readonly gateEdgePostCount: number;
  readonly gateStartM: number;
  readonly gateEndM: number;
  readonly maxSpacingHonoured: boolean;
  readonly fenceBayWidthsM: readonly number[];
};

function uniqueSortedPositions(values: readonly number[]): number[] {
  const sorted = [...values].map((x) => round2(x)).sort((a, b) => a - b);
  return sorted.filter(
    (x, i, arr) => i === 0 || Math.abs(x - (arr[i - 1] ?? 0)) > 1e-9
  );
}

/**
 * One-gate run segmentation. AT_END places the opening at x = L − W.
 * WITHIN_FENCE_RUN centres the opening. Multiple gates collapse to one
 * opening of total width (exact multi-gate coordinates are future work).
 */
export function segmentFenceRuns(params: {
  lengthM: number;
  gateWidthM: number;
  gateCount?: number;
  position: FenceGatePosition;
}): {
  runs: FenceFixedRun[];
  gateStartM: number;
  gateEndM: number;
  openingM: number;
} {
  const lengthM = params.lengthM;
  const count = Math.max(1, Math.round(params.gateCount ?? 1));
  const openingM = Math.min(
    Math.max(params.gateWidthM, 0) * count,
    Math.max(lengthM, 0)
  );
  if (!(lengthM > 0) || !(openingM > 1e-9)) {
    return {
      runs:
        lengthM > 0
          ? [{ startM: 0, endM: round2(lengthM), lengthM }]
          : [],
      gateStartM: 0,
      gateEndM: 0,
      openingM: 0,
    };
  }
  let gateStartM: number;
  if (params.position === "AT_END") {
    gateStartM = Math.max(lengthM - openingM, 0);
  } else {
    gateStartM = Math.max((lengthM - openingM) / 2, 0);
  }
  const gateEndM = Math.min(gateStartM + openingM, lengthM);
  const runs: FenceFixedRun[] = [];
  if (gateStartM > 1e-9) {
    const endM = round2(gateStartM);
    runs.push({
      startM: 0,
      endM,
      lengthM: endM,
    });
  }
  if (lengthM - gateEndM > 1e-9) {
    const startM = round2(gateEndM);
    const endM = round2(lengthM);
    runs.push({
      startM,
      endM,
      lengthM: round2(endM - startM),
    });
  }
  return {
    runs,
    gateStartM: round2(gateStartM),
    gateEndM: round2(gateEndM),
    openingM,
  };
}

export function layoutTimberPostsWithGate(params: {
  lengthM: number;
  maxSpacingM: number;
  gateWidthM: number;
  gateCount?: number;
  position: FenceGatePosition;
}): FenceSegmentedPostLayout {
  const target =
    params.maxSpacingM > 0 ? params.maxSpacingM : FENCE_DEFAULT_MAX_POST_SPACING_M;
  const lengthM = params.lengthM;
  const empty = (): FenceSegmentedPostLayout => ({
    targetSpacingM: target,
    actualSpacingM: target,
    bayCount: 0,
    postCount: 0,
    positionsM: [],
    firstAtZero: false,
    lastAtLength: false,
    layoutKind: "TIMBER_SEGMENTED_GATE",
    gateOpeningM: 0,
    fixedFenceLengthM: 0,
    runs: [],
    posts: [],
    gateEdgePostCount: 0,
    gateStartM: 0,
    gateEndM: 0,
    maxSpacingHonoured: true,
    fenceBayWidthsM: [],
  });
  if (!(lengthM > 0)) return empty();

  const segmented = segmentFenceRuns({
    lengthM,
    gateWidthM: params.gateWidthM,
    gateCount: params.gateCount,
    position: params.position,
  });

  if (!(segmented.openingM > 1e-9)) {
    const inner = timberMaxSpacingLayout(lengthM, target);
    const posts: FencePostMark[] = inner.positionsM.map((x, i, arr) => {
      const roles: FencePostRole[] = [];
      if (i === 0) roles.push("start");
      if (i === arr.length - 1) roles.push("end");
      if (roles.length === 0) roles.push("intermediate");
      return { xM: x, roles };
    });
    return {
      ...inner,
      layoutKind: "TIMBER_SEGMENTED_GATE",
      gateOpeningM: 0,
      fixedFenceLengthM: lengthM,
      runs: segmented.runs,
      posts,
      gateEdgePostCount: 0,
      gateStartM: 0,
      gateEndM: 0,
      maxSpacingHonoured: inner.positionsM
        .slice(0, -1)
        .every((x, i) => (inner.positionsM[i + 1] ?? 0) - x <= target + 1e-9),
      fenceBayWidthsM: inner.positionsM.slice(0, -1).map((x, i) =>
        round2((inner.positionsM[i + 1] ?? lengthM) - x)
      ),
    };
  }

  const raw: number[] = [0, round2(lengthM), segmented.gateStartM, segmented.gateEndM];
  const fenceBayWidthsM: number[] = [];
  for (const run of segmented.runs) {
    const inner = timberMaxSpacingLayout(run.lengthM, target);
    for (const x of inner.positionsM) {
      raw.push(round2(run.startM + x));
    }
    for (let i = 0; i < inner.positionsM.length - 1; i += 1) {
      fenceBayWidthsM.push(
        round2((inner.positionsM[i + 1] ?? run.lengthM) - (inner.positionsM[i] ?? 0))
      );
    }
  }
  const positionsM = uniqueSortedPositions(raw);
  const posts: FencePostMark[] = positionsM.map((x, i, arr) => {
    const roles: FencePostRole[] = [];
    if (i === 0) roles.push("start");
    if (i === arr.length - 1) roles.push("end");
    if (
      Math.abs(x - segmented.gateStartM) < 1e-6 ||
      Math.abs(x - segmented.gateEndM) < 1e-6
    ) {
      roles.push("gate_edge");
    }
    if (roles.length === 0) roles.push("intermediate");
    return { xM: x, roles };
  });
  const maxSpacingHonoured = fenceBayWidthsM.every((w) => w <= target + 1e-9);
  const fixedFenceLengthM = segmented.runs.reduce((s, r) => s + r.lengthM, 0);
  return {
    targetSpacingM: target,
    actualSpacingM:
      fenceBayWidthsM.length > 0
        ? Math.max(...fenceBayWidthsM)
        : target,
    bayCount: Math.max(positionsM.length - 1, 0),
    postCount: positionsM.length,
    positionsM,
    firstAtZero: positionsM[0] === 0,
    lastAtLength: Math.abs((positionsM.at(-1) ?? 0) - round2(lengthM)) < 1e-9,
    layoutKind: "TIMBER_SEGMENTED_GATE",
    gateOpeningM: segmented.openingM,
    fixedFenceLengthM,
    runs: segmented.runs,
    posts,
    gateEdgePostCount: posts.filter((p) => p.roles.includes("gate_edge")).length,
    gateStartM: segmented.gateStartM,
    gateEndM: segmented.gateEndM,
    maxSpacingHonoured,
    fenceBayWidthsM,
  };
}

export function segmentedVerticalBoardCounts(params: {
  runs: readonly FenceFixedRun[];
  gateWidthM: number;
  gateCount: number;
  boardWidthM?: number;
  gapMm?: number;
  /** @deprecated prefer boardWidthM; treated as board width with gap 0. */
  effectiveCoverWidthM?: number;
}): { fixedBoardCount: number; gateBoardCount: number; totalBoardCount: number } {
  const boardWidthM = params.boardWidthM || params.effectiveCoverWidthM || 0;
  const gapMm = params.gapMm ?? 0;
  const fixedBoardCount = params.runs.reduce(
    (sum, run) =>
      sum +
      verticalBoardCount({
        faceRunLengthM: run.lengthM,
        boardWidthM,
        gapMm,
      }),
    0
  );
  const gateBoardCount =
    params.gateCount > 0 && params.gateWidthM > 0
      ? params.gateCount *
        verticalBoardCount({
          faceRunLengthM: params.gateWidthM,
          boardWidthM,
          gapMm,
        })
      : 0;
  return {
    fixedBoardCount,
    gateBoardCount,
    totalBoardCount: fixedBoardCount + gateBoardCount,
  };
}

export function defaultRailCountForHeight(heightM: number): number {
  if (!(heightM > 0)) return 2;
  return heightM >= FENCE_RAIL_COUNT_HEIGHT_THRESHOLD_M ? 3 : 2;
}

export const FENCE_RAIL_COUNT_RATIONALE =
  "Disclosed Quotr estimating assumption, not engineering design. Fences below 1.5 m use 2 rails; 1.5 m and above use 3 rails — a common NZ paling construction split on 1.8 m centres. Builder can override.";

export type HorizontalCourseFit = {
  courseCount: number;
  occupiedHeightM: number;
  residualM: number;
  topClearanceM: number;
  bottomClearanceM: number;
};

/**
 * Whole-board FIT-WITHIN-HEIGHT. Does not exceed nominated fence height
 * under the default model. Residual clearance is split top/bottom for
 * presentation — not fabrication design.
 */
export function horizontalCourseFit(params: {
  heightM: number;
  boardWidthM: number;
  gapMm: number;
}): HorizontalCourseFit {
  const gapM = Math.max(params.gapMm, 0) / 1000;
  const B = params.boardWidthM;
  const H = params.heightM;
  const empty: HorizontalCourseFit = {
    courseCount: 0,
    occupiedHeightM: 0,
    residualM: Math.max(H, 0),
    topClearanceM: 0,
    bottomClearanceM: 0,
  };
  if (!(H > 0) || !(B > 0)) return empty;
  const courseCount = Math.max(
    1,
    Math.floor((H + gapM) / (B + gapM) + 1e-12)
  );
  const occupiedHeightM = courseCount * B + (courseCount - 1) * gapM;
  const residualM = Math.max(H - occupiedHeightM, 0);
  const half = residualM / 2;
  return {
    courseCount,
    occupiedHeightM,
    residualM,
    topClearanceM: half,
    bottomClearanceM: half,
  };
}

export function occupiedSlatHeightM(
  courseCount: number,
  boardWidthM: number,
  gapMm: number
): number {
  if (!(courseCount > 0) || !(boardWidthM > 0)) return 0;
  const gapM = Math.max(gapMm, 0) / 1000;
  return courseCount * boardWidthM + (courseCount - 1) * gapM;
}

export function horizontalCourseCount(params: {
  heightM: number;
  boardWidthM: number;
  gapMm: number;
}): number {
  return horizontalCourseFit(params).courseCount;
}

/**
 * Whole palings along a run. No trailing gap after the last board:
 * ceil((L + G) / (B + G)). G = 0 reduces to ceil(L / B).
 */
export function verticalBoardCount(params: {
  faceRunLengthM: number;
  boardWidthM?: number;
  gapMm?: number;
  /** @deprecated prefer boardWidthM; treated as board width. */
  effectiveCoverWidthM?: number;
}): number {
  const boardWidthM = params.boardWidthM || params.effectiveCoverWidthM || 0;
  const gapM = Math.max(params.gapMm ?? 0, 0) / 1000;
  if (!(params.faceRunLengthM > 0) || !(boardWidthM > 0)) {
    return 0;
  }
  return Math.max(
    1,
    Math.ceil((params.faceRunLengthM + gapM) / (boardWidthM + gapM) - 1e-12)
  );
}

export function gateFrameLm(gateHeightM: number, gateWidthM: number): number {
  if (!(gateHeightM > 0) || !(gateWidthM > 0)) return 0;
  return (
    2 * gateHeightM +
    2 * gateWidthM +
    Math.sqrt(gateHeightM * gateHeightM + gateWidthM * gateWidthM)
  );
}
