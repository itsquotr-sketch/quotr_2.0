/**
 * RETAINING-WALL-MATURITY-1A / 2A — concrete sleeper physical takeoff.
 * Steel-post embedment 0.70 × H(x) is an estimating heuristic.
 * Bay geometry is product-length (sleeper length or explicit spacing).
 * Not timber even-bay layout.
 */

import { round2 } from "@/lib/estimate/facts";
import type { MaterialRequirement } from "@/lib/estimate/requirements";
import {
  RETAINING_WALL_DEFAULT_HOLE_DIAMETER_M,
  RETAINING_WALL_SLEEPER_EMBEDMENT_RATIO,
  cylinderVolumeM3,
  heightAtX,
  type RetainingWallGeometry,
} from "@/lib/estimate/retaining-wall-geometry";
import {
  CONCRETE_SLEEPER_IDENTITY,
  RW_CONCRETE_SLEEPER_KEY,
  RW_SLEEPER_COMPONENT,
  RW_SLEEPER_CONCRETE_COMPONENT,
  RW_SLEEPER_POSTS_EA_COMPONENT,
  RW_SLEEPER_POSTS_LM_COMPONENT,
  RW_SLEEPER_PREMIX_20KG_KEY,
  RW_STEEL_POST_KEY,
  STEEL_RW_POST_IDENTITY,
  premix20kgIdentity,
} from "@/lib/estimate/retaining-wall-identities";
import { planningMaterial } from "@/lib/estimate/retaining-wall-planning";
import {
  RW_DEFAULT_SLEEPER_FACE_HEIGHT_M,
  RW_DEFAULT_SLEEPER_LENGTH_M,
  RW_PREMIX_20KG_YIELD_M3,
  RW_SLEEPER_BAY_LAYOUT_KIND,
  RW_SLEEPER_CONCRETE_GRADE_DISCLOSURE,
  RW_SLEEPER_CUT_PROCUREMENT,
  RW_SLEEPER_DEFAULT_EMBEDMENT_DISCLOSURE,
  RW_SLEEPER_DEFAULT_FACE_DISCLOSURE,
  RW_SLEEPER_DEFAULT_LENGTH_DISCLOSURE,
  RW_SLEEPER_DEFAULT_SPACING_DISCLOSURE,
  RW_SLEEPER_DESIGN_CONFIRM,
  RW_SLEEPER_LENGTH_SEMANTICS,
  RW_SLEEPER_NOMINAL_MODULE_DISCLOSURE,
} from "@/lib/estimate/retaining-wall-sleeper-2a";

export type SleeperWallInputs = {
  sleeperLengthM: number | null;
  sleeperFaceHeightM: number | null;
  postSpacingM?: number | null;
  postEmbedmentM: number | null;
  holeDiameterM: number | null;
  premixBagYieldM3: number | null;
  wasteFactor: number;
};

export type SleeperWallTakeoff = {
  /** Discrete purchase EA from bay × courses. Not face-area division. */
  sleeperCount: number | null;
  /** Face-area coverage in sleeper-equivalents. May be fractional. */
  coverageEa: number | null;
  coursesPerBay: number[];
  bayCount: number | null;
  fullBayCount: number;
  residualBayWidthM: number;
  bayWidthsM: number[];
  postPositionsM: number[];
  standardSleeperEa: number;
  cutSleeperEa: number;
  postCount: number | null;
  postLengthsM: number[];
  totalPostLengthM: number;
  holeVolumeM3: number;
  holeVolumeL: number;
  holeDiameterM: number;
  holeCount: number;
  bagCount: number | null;
  bagYieldM3: number;
  /** Purchased sleeper unit length (or explicit post-centre module). */
  targetSpacingM: number;
  /** Standard full-bay width (= module). Not L / bayCount even-split. */
  actualSpacingM: number;
  spacingAssumed: boolean;
  sleeperLengthAssumed: boolean;
  sleeperFaceAssumed: boolean;
  embedmentExplicit: boolean;
  embedmentRatio: number;
  dimensionsMissing: boolean;
  sleeperLengthSemantics: typeof RW_SLEEPER_LENGTH_SEMANTICS;
  bayLayoutKind: typeof RW_SLEEPER_BAY_LAYOUT_KIND;
};

export type SleeperBayLayout = {
  moduleM: number;
  bayCount: number;
  fullBayCount: number;
  residualBayWidthM: number;
  postCount: number;
  positionsM: number[];
  bayWidthsM: number[];
};

/**
 * Full standard bays of the purchased/system module, plus one residual/end bay
 * when wall length is not an exact multiple. Does not even-distribute bays.
 */
export function sleeperBayLayout(lengthM: number, moduleM: number): SleeperBayLayout {
  const resolvedModuleM = moduleM > 0 ? moduleM : RW_DEFAULT_SLEEPER_LENGTH_M;
  if (!(lengthM > 0)) {
    return {
      moduleM: resolvedModuleM,
      bayCount: 0,
      fullBayCount: 0,
      residualBayWidthM: 0,
      postCount: 0,
      positionsM: [],
      bayWidthsM: [],
    };
  }
  const fullBayCount = Math.floor((lengthM + 1e-12) / resolvedModuleM);
  const remainder = round2(lengthM - fullBayCount * resolvedModuleM);
  const hasResidual = remainder > 1e-9;
  const bayCount = Math.max(1, fullBayCount + (hasResidual ? 1 : 0));
  const positionsM: number[] = [0];
  for (let i = 1; i <= fullBayCount; i += 1) {
    positionsM.push(round2(i * resolvedModuleM));
  }
  if (hasResidual) {
    const end = round2(lengthM);
    if (Math.abs((positionsM.at(-1) ?? 0) - end) > 1e-9) {
      positionsM.push(end);
    }
  }
  const bayWidthsM = positionsM.slice(0, -1).map((x0, index) =>
    round2((positionsM[index + 1] ?? lengthM) - x0)
  );
  return {
    moduleM: resolvedModuleM,
    bayCount,
    fullBayCount: hasResidual ? fullBayCount : bayCount,
    residualBayWidthM: hasResidual ? remainder : 0,
    postCount: bayCount + 1,
    positionsM,
    bayWidthsM,
  };
}

function purchaseUnitsForBay(
  bayWidthM: number,
  sleeperLengthM: number
): { standard: number; cut: number } {
  if (!(bayWidthM > 0) || !(sleeperLengthM > 0)) {
    return { standard: 0, cut: 0 };
  }
  if (bayWidthM <= sleeperLengthM + 1e-9) {
    return bayWidthM < sleeperLengthM - 1e-9
      ? { standard: 0, cut: 1 }
      : { standard: 1, cut: 0 };
  }
  const standard = Math.floor(bayWidthM / sleeperLengthM + 1e-12);
  const rem = bayWidthM - standard * sleeperLengthM;
  return rem > 1e-9 ? { standard, cut: 1 } : { standard, cut: 0 };
}

export function sleeperCoursesForBayHeight(
  requiredHeightM: number,
  sleeperFaceHeightM: number
): number {
  if (!(sleeperFaceHeightM > 0) || !(requiredHeightM > 0)) return 0;
  return Math.ceil(requiredHeightM / sleeperFaceHeightM - 1e-9);
}

export function sleeperWallTakeoff(
  geometry: RetainingWallGeometry,
  inputs: SleeperWallInputs
): SleeperWallTakeoff {
  const sleeperLengthAssumed =
    inputs.sleeperLengthM == null || !(inputs.sleeperLengthM > 0);
  const sleeperFaceAssumed =
    inputs.sleeperFaceHeightM == null || !(inputs.sleeperFaceHeightM > 0);
  const sleeperLengthM = sleeperLengthAssumed
    ? RW_DEFAULT_SLEEPER_LENGTH_M
    : inputs.sleeperLengthM!;
  const sleeperFaceHeightM = sleeperFaceAssumed
    ? RW_DEFAULT_SLEEPER_FACE_HEIGHT_M
    : inputs.sleeperFaceHeightM!;
  const spacingAssumed =
    inputs.postSpacingM == null || !(inputs.postSpacingM > 0);
  const targetSpacingM = spacingAssumed ? sleeperLengthM : inputs.postSpacingM!;
  const layout = sleeperBayLayout(geometry.lengthM, targetSpacingM);
  const { bayCount, postCount: postCountValue, positionsM: positions } = layout;
  const actualSpacingM = layout.moduleM;
  const embedmentExplicit =
    inputs.postEmbedmentM != null && inputs.postEmbedmentM >= 0;
  const postLengthsM = positions.map((x) => {
    const above = heightAtX(geometry.lengthM, geometry.h1M, geometry.h2M, x);
    const embed = embedmentExplicit
      ? inputs.postEmbedmentM!
      : above * RETAINING_WALL_SLEEPER_EMBEDMENT_RATIO;
    return round2(above + embed);
  });
  const diameter =
    inputs.holeDiameterM != null && inputs.holeDiameterM > 0
      ? inputs.holeDiameterM
      : RETAINING_WALL_DEFAULT_HOLE_DIAMETER_M;
  const holeVolumeM3 = positions.reduce((sum, x, index) => {
    const above = heightAtX(geometry.lengthM, geometry.h1M, geometry.h2M, x);
    const length = postLengthsM[index] ?? 0;
    const embed = Math.max(length - above, 0);
    const depth =
      embed > 0 ? embed : above * RETAINING_WALL_SLEEPER_EMBEDMENT_RATIO;
    return sum + cylinderVolumeM3(diameter, depth);
  }, 0);
  const coverageEa = round2(
    geometry.faceAreaM2 / (sleeperLengthM * sleeperFaceHeightM)
  );
  const coursesPerBay =
    positions.length < 2
      ? []
      : positions.slice(0, -1).map((x0, index) => {
          const x1 = positions[index + 1] ?? geometry.lengthM;
          const h0 = heightAtX(
            geometry.lengthM,
            geometry.h1M,
            geometry.h2M,
            x0
          );
          const h1 = heightAtX(
            geometry.lengthM,
            geometry.h1M,
            geometry.h2M,
            x1
          );
          return sleeperCoursesForBayHeight(
            Math.max(h0, h1),
            sleeperFaceHeightM
          );
        });
  const purchasedPerBay = layout.bayWidthsM.map((width) =>
    purchaseUnitsForBay(width, sleeperLengthM)
  );
  const standardSleeperEa = purchasedPerBay.reduce(
    (sum, units, index) => sum + units.standard * (coursesPerBay[index] ?? 0),
    0
  );
  const cutSleeperEa = purchasedPerBay.reduce(
    (sum, units, index) => sum + units.cut * (coursesPerBay[index] ?? 0),
    0
  );
  const purchaseEa = standardSleeperEa + cutSleeperEa;
  const bagYieldM3 =
    inputs.premixBagYieldM3 != null && inputs.premixBagYieldM3 > 0
      ? inputs.premixBagYieldM3
      : RW_PREMIX_20KG_YIELD_M3;
  const bagCount =
    bagYieldM3 > 0 ? Math.ceil(holeVolumeM3 / bagYieldM3 - 1e-12) : null;

  return {
    sleeperCount: purchaseEa,
    coverageEa,
    coursesPerBay,
    bayCount,
    fullBayCount: layout.fullBayCount,
    residualBayWidthM: layout.residualBayWidthM,
    bayWidthsM: layout.bayWidthsM,
    postPositionsM: positions,
    standardSleeperEa,
    cutSleeperEa,
    postCount: postCountValue,
    postLengthsM,
    totalPostLengthM: round2(postLengthsM.reduce((sum, n) => sum + n, 0)),
    holeVolumeM3: round2(holeVolumeM3 * 10000) / 10000,
    holeVolumeL: round2(holeVolumeM3 * 1000),
    holeDiameterM: diameter,
    holeCount: positions.length,
    bagCount,
    bagYieldM3,
    targetSpacingM,
    actualSpacingM,
    spacingAssumed,
    sleeperLengthAssumed,
    sleeperFaceAssumed,
    embedmentExplicit,
    embedmentRatio: RETAINING_WALL_SLEEPER_EMBEDMENT_RATIO,
    dimensionsMissing: false,
    sleeperLengthSemantics: RW_SLEEPER_LENGTH_SEMANTICS,
    bayLayoutKind: RW_SLEEPER_BAY_LAYOUT_KIND,
  };
}

export function buildSleeperWallRequirements(params: {
  workAreaId: string;
  geometry: RetainingWallGeometry;
  inputs: SleeperWallInputs;
  factKeys: string[];
}): {
  requirements: MaterialRequirement[];
  assumptions: string[];
  takeoff: SleeperWallTakeoff;
} {
  const takeoff = sleeperWallTakeoff(params.geometry, params.inputs);
  const assumptions: string[] = [];
  if (takeoff.sleeperLengthAssumed) {
    assumptions.push(RW_SLEEPER_DEFAULT_LENGTH_DISCLOSURE);
  }
  if (takeoff.sleeperFaceAssumed) {
    assumptions.push(RW_SLEEPER_DEFAULT_FACE_DISCLOSURE);
  }
  if (takeoff.spacingAssumed) {
    assumptions.push(RW_SLEEPER_DEFAULT_SPACING_DISCLOSURE);
    assumptions.push(RW_SLEEPER_NOMINAL_MODULE_DISCLOSURE);
  } else {
    assumptions.push(
      `Post centres use the explicit ${takeoff.targetSpacingM} m system/user spacing. Layout is ${takeoff.fullBayCount} full module bay(s)${takeoff.residualBayWidthM > 0 ? ` plus a ${takeoff.residualBayWidthM} m residual/end bay` : ""}. Not even-distributed. Confirm the selected system.`
    );
  }
  if (!takeoff.embedmentExplicit) {
    assumptions.push(RW_SLEEPER_DEFAULT_EMBEDMENT_DISCLOSURE);
  }
  if (takeoff.spacingAssumed || !takeoff.embedmentExplicit) {
    assumptions.push(RW_SLEEPER_DESIGN_CONFIRM);
  }
  if (takeoff.sleeperCount != null) {
    const cutHint =
      takeoff.cutSleeperEa > 0
        ? ` ${takeoff.standardSleeperEa} standard + ${takeoff.cutSleeperEa} cut/end (purchased as full units, ${RW_SLEEPER_CUT_PROCUREMENT}).`
        : "";
    assumptions.push(
      `Sleeper purchase is ${takeoff.sleeperCount} EA.${cutHint} Face-area coverage is ${takeoff.coverageEa} sleeper-equivalents and is not the purchase quantity.`
    );
  }
  assumptions.push(RW_SLEEPER_CONCRETE_GRADE_DISCLOSURE);
  assumptions.push(
    `Post holes modelled as cylinders (${round2(takeoff.holeDiameterM * 1000)} mm diameter × local embedment depth × ${takeoff.holeCount} holes). A 300 mm × 600 mm hole is ${round2(cylinderVolumeM3(0.3, 0.6) * 1000)} L, not 36 L or three bags.`
  );

  const common = {
    workAreaId: params.workAreaId,
    factKeys: params.factKeys,
    source: "retaining_wall.sleeper",
  };
  const requirements: MaterialRequirement[] = [];

  if (takeoff.sleeperCount != null) {
    requirements.push(
      planningMaterial({
        ...common,
        componentKey: RW_SLEEPER_COMPONENT,
        description: "Concrete sleepers",
        materialKey: RW_CONCRETE_SLEEPER_KEY,
        identity: CONCRETE_SLEEPER_IDENTITY,
        category: "SLEEPER",
        specification: `${takeoff.sleeperCount} EA purchased${
          takeoff.cutSleeperEa > 0
            ? ` (${takeoff.standardSleeperEa} standard + ${takeoff.cutSleeperEa} cut/end)`
            : ""
        }. ${takeoff.fullBayCount} full ${takeoff.targetSpacingM} m bays${
          takeoff.residualBayWidthM > 0
            ? ` + ${takeoff.residualBayWidthM} m residual/end`
            : ""
        }. Discrete units — not a fractional face-area purchase.`,
        baseQuantity: takeoff.sleeperCount,
        baseUnit: "ea",
        wasteFactor: 0,
        purchaseQuantity: takeoff.sleeperCount,
        purchaseUnit: "ea",
      })
    );
  }

  if (takeoff.postCount != null) {
    requirements.push(
      planningMaterial({
        ...common,
        componentKey: RW_SLEEPER_POSTS_EA_COMPONENT,
        description: "Steel retaining posts",
        materialKey: RW_STEEL_POST_KEY,
        identity: STEEL_RW_POST_IDENTITY,
        category: "SLEEPER",
        specification: `${takeoff.postCount} posts (bays + 1). Lengths follow local H(x).`,
        baseQuantity: takeoff.postCount,
        baseUnit: "ea",
        wasteFactor: 0,
        purchaseQuantity: takeoff.postCount,
        purchaseUnit: "ea",
      }),
      planningMaterial({
        ...common,
        componentKey: RW_SLEEPER_POSTS_LM_COMPONENT,
        description: "Steel retaining post length",
        materialKey: RW_STEEL_POST_KEY,
        identity: STEEL_RW_POST_IDENTITY,
        category: "SLEEPER",
        specification: `Total theoretical post length ${takeoff.totalPostLengthM} lm. Not a stock-length purchase.`,
        baseQuantity: takeoff.totalPostLengthM,
        baseUnit: "lm",
        wasteFactor: 0,
        purchaseQuantity: takeoff.totalPostLengthM,
        purchaseUnit: "lm",
      })
    );
  }

  if (takeoff.postCount != null && takeoff.holeVolumeM3 > 0) {
    const holeSpec =
      takeoff.bagCount != null
        ? `${takeoff.holeVolumeM3} m³ required (${takeoff.holeVolumeL} L, ${takeoff.holeCount} holes) → ${takeoff.bagCount} bags.`
        : `${takeoff.holeVolumeM3} m³ required (${takeoff.holeVolumeL} L, ${takeoff.holeCount} holes).`;

    requirements.push(
      planningMaterial({
        ...common,
        componentKey: RW_SLEEPER_CONCRETE_COMPONENT,
        description: "Post-hole concrete",
        materialKey: RW_SLEEPER_PREMIX_20KG_KEY,
        identity: premix20kgIdentity(),
        category: "CONCRETE",
        specification: holeSpec,
        baseQuantity: takeoff.holeVolumeM3,
        baseUnit: "m3",
        wasteFactor: 0,
        purchaseQuantity:
          takeoff.bagCount != null ? takeoff.bagCount : takeoff.holeVolumeM3,
        purchaseUnit: takeoff.bagCount != null ? "bag" : "m3",
      })
    );
  }

  return { requirements, assumptions, takeoff };
}
