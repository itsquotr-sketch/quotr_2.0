/**
 * RETAINING-WALL-MATURITY-1A — concrete sleeper physical takeoff.
 * Steel-post embedment 0.70 × H(x) is an estimating heuristic.
 */

import { round2 } from "@/lib/estimate/facts";
import type { MaterialRequirement } from "@/lib/estimate/requirements";
import {
  RETAINING_WALL_DEFAULT_HOLE_DIAMETER_M,
  RETAINING_WALL_SLEEPER_EMBEDMENT_RATIO,
  cylinderVolumeM3,
  heightAtX,
  postPositionsM,
  type RetainingWallGeometry,
} from "@/lib/estimate/retaining-wall-geometry";
import {
  CONCRETE_SLEEPER_IDENTITY,
  RW_CONCRETE_SLEEPER_KEY,
  RW_PREMIX_20KG_KEY,
  RW_SLEEPER_COMPONENT,
  RW_SLEEPER_CONCRETE_COMPONENT,
  RW_SLEEPER_POSTS_EA_COMPONENT,
  RW_SLEEPER_POSTS_LM_COMPONENT,
  RW_STEEL_POST_KEY,
  STEEL_RW_POST_IDENTITY,
  premix20kgIdentity,
} from "@/lib/estimate/retaining-wall-identities";
import { planningMaterial } from "@/lib/estimate/retaining-wall-planning";

export type SleeperWallInputs = {
  sleeperLengthM: number | null;
  sleeperFaceHeightM: number | null;
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
  postCount: number | null;
  postLengthsM: number[];
  totalPostLengthM: number;
  holeVolumeM3: number;
  holeVolumeL: number;
  bagCount: number | null;
  dimensionsMissing: boolean;
};

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
  const dimensionsMissing =
    inputs.sleeperLengthM == null ||
    !(inputs.sleeperLengthM > 0) ||
    inputs.sleeperFaceHeightM == null ||
    !(inputs.sleeperFaceHeightM > 0);

  const bayCount = dimensionsMissing
    ? null
    : Math.max(1, Math.ceil(geometry.lengthM / inputs.sleeperLengthM!));
  const postCountValue = bayCount == null ? null : bayCount + 1;
  const spacingM = inputs.sleeperLengthM ?? geometry.lengthM;
  const positions = postCountValue
    ? postPositionsM(geometry.lengthM, spacingM)
    : [];
  const postLengthsM = positions.map((x) => {
    const above = heightAtX(geometry.lengthM, geometry.h1M, geometry.h2M, x);
    const embed =
      inputs.postEmbedmentM != null && inputs.postEmbedmentM >= 0
        ? inputs.postEmbedmentM
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
    const depth = embed > 0 ? embed : above * RETAINING_WALL_SLEEPER_EMBEDMENT_RATIO;
    return sum + cylinderVolumeM3(diameter, depth);
  }, 0);
  const coverageEa = dimensionsMissing
    ? null
    : round2(
        geometry.faceAreaM2 /
          (inputs.sleeperLengthM! * inputs.sleeperFaceHeightM!)
      );
  const coursesPerBay =
    dimensionsMissing || positions.length < 2
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
            inputs.sleeperFaceHeightM!
          );
        });
  const sleeperCount = dimensionsMissing
    ? null
    : coursesPerBay.reduce((sum, n) => sum + n, 0);
  const bagCount =
    inputs.premixBagYieldM3 != null && inputs.premixBagYieldM3 > 0
      ? Math.ceil(holeVolumeM3 / inputs.premixBagYieldM3)
      : null;

  return {
    sleeperCount,
    coverageEa,
    coursesPerBay,
    bayCount,
    postCount: postCountValue,
    postLengthsM,
    totalPostLengthM: round2(postLengthsM.reduce((sum, n) => sum + n, 0)),
    holeVolumeM3: round2(holeVolumeM3 * 10000) / 10000,
    holeVolumeL: round2(holeVolumeM3 * 1000),
    bagCount,
    dimensionsMissing,
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
  if (takeoff.dimensionsMissing) {
    assumptions.push(
      "Concrete sleeper length and face height are required before sleeper count can be derived."
    );
  }
  if (params.inputs.postEmbedmentM == null) {
    assumptions.push(
      "Steel post embedment estimated at 0.70 × retained height at each post (1.70 × H(x) total length). Estimating heuristic, not engineering design."
    );
  }
  if (takeoff.sleeperCount != null) {
    assumptions.push(
      `Sleeper purchase is ${takeoff.sleeperCount} EA from bay × courses. Face-area coverage is ${takeoff.coverageEa} sleeper-equivalents and is not the purchase quantity.`
    );
  }
  assumptions.push(
    `Post holes modelled as cylinders. A 300 mm × 600 mm hole is ${round2(cylinderVolumeM3(0.3, 0.6) * 1000)} L, not 36 L or three bags.`
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
        description: "Precast concrete sleepers",
        materialKey: RW_CONCRETE_SLEEPER_KEY,
        identity: CONCRETE_SLEEPER_IDENTITY,
        category: "SLEEPER",
        specification: `${takeoff.sleeperCount} sleepers purchase EA (${takeoff.bayCount} bays × courses). Coverage from face area ≈ ${takeoff.coverageEa}. Discrete units — not a fractional face-area purchase.`,
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
        description: "Steel retaining-wall posts",
        materialKey: RW_STEEL_POST_KEY,
        identity: STEEL_RW_POST_IDENTITY,
        category: "SLEEPER",
        specification: `${takeoff.postCount} posts (bays + 1). Lengths follow H(x).`,
        baseQuantity: takeoff.postCount,
        baseUnit: "ea",
        wasteFactor: 0,
        purchaseQuantity: takeoff.postCount,
        purchaseUnit: "ea",
      }),
      planningMaterial({
        ...common,
        componentKey: RW_SLEEPER_POSTS_LM_COMPONENT,
        description: "Steel retaining-wall post length",
        materialKey: RW_STEEL_POST_KEY,
        identity: STEEL_RW_POST_IDENTITY,
        category: "SLEEPER",
        specification: `Total estimated post length ${takeoff.totalPostLengthM} lm.`,
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
        ? `${takeoff.holeVolumeM3} m³ (${takeoff.holeVolumeL} L) → ${takeoff.bagCount} bags at selected yield.`
        : `${takeoff.holeVolumeM3} m³ (${takeoff.holeVolumeL} L). Bag count needs selected bag yield — not a hardcoded three-bag rule.`;

    requirements.push(
      planningMaterial({
        ...common,
        componentKey: RW_SLEEPER_CONCRETE_COMPONENT,
        description: "Post-hole concrete",
        materialKey: RW_PREMIX_20KG_KEY,
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
