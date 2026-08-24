/**
 * RETAINING-WALL-MATURITY-1A — timber physical takeoff.
 * Planning quantities. Embedment is an estimating heuristic, not design.
 */

import { round2 } from "@/lib/estimate/facts";
import type { MaterialRequirement } from "@/lib/estimate/requirements";
import {
  RETAINING_WALL_DEFAULT_PILE_SPACING_M,
  RETAINING_WALL_PILE_SPACING_KIND,
  RETAINING_WALL_TIMBER_EMBEDMENT_RATIO,
  heightAtX,
  timberPileLayout,
  type RetainingWallGeometry,
} from "@/lib/estimate/retaining-wall-geometry";
import {
  H5_SED_POLE_IDENTITY,
  RW_H5_SED_POLE_KEY,
  RW_TIMBER_BOARDS_COMPONENT,
  RW_TIMBER_PILES_EA_COMPONENT,
  RW_TIMBER_PILES_LM_COMPONENT,
  timberFaceBoardFromFact,
} from "@/lib/estimate/retaining-wall-identities";
import { planningMaterial } from "@/lib/estimate/retaining-wall-planning";

export const RW_TIMBER_DEFAULT_EMBEDMENT_DISCLOSURE =
  "Pile embedment estimated at 50% of retained height.";
export const RW_ESTIMATING_ASSUMPTION_CONFIRM =
  "Estimating assumption — confirm structural/design requirements.";
export const RW_TIMBER_DEFAULT_SPACING_DISCLOSURE =
  "Pile centres use 1.2 m as target/max estimating spacing. Actual generated spacing may be smaller so bays sit evenly along the wall. Not a structural standard.";

export type TimberWallInputs = {
  faceBoardSection: string | null;
  pileSpacingM: number | null;
  pileEmbedmentM: number | null;
  pileEmbedmentRatio: number | null;
  wasteFactor: number;
};

export type TimberPileTakeoff = {
  count: number;
  spacingM: number;
  targetSpacingM: number;
  actualSpacingM: number;
  bayCount: number;
  spacingAssumed: boolean;
  embedmentRatio: number;
  embedmentExplicit: boolean;
  positionsM: number[];
  lengthsM: number[];
  totalLengthM: number;
};

export function timberPileTakeoff(
  geometry: RetainingWallGeometry,
  inputs: TimberWallInputs
): TimberPileTakeoff {
  const spacingAssumed =
    inputs.pileSpacingM == null || !(inputs.pileSpacingM > 0);
  const targetSpacingM = spacingAssumed
    ? RETAINING_WALL_DEFAULT_PILE_SPACING_M
    : inputs.pileSpacingM!;
  const layout = timberPileLayout(geometry.lengthM, targetSpacingM);
  const embedmentExplicit =
    inputs.pileEmbedmentM != null && inputs.pileEmbedmentM >= 0;
  const embedmentRatio =
    inputs.pileEmbedmentRatio != null && inputs.pileEmbedmentRatio > 0
      ? inputs.pileEmbedmentRatio
      : RETAINING_WALL_TIMBER_EMBEDMENT_RATIO;
  const lengthsM = layout.positionsM.map((x) => {
    const above = heightAtX(geometry.lengthM, geometry.h1M, geometry.h2M, x);
    const embed = embedmentExplicit
      ? inputs.pileEmbedmentM!
      : above * embedmentRatio;
    return round2(above + embed);
  });
  return {
    count: layout.pileCount,
    spacingM: targetSpacingM,
    targetSpacingM,
    actualSpacingM: layout.actualSpacingM,
    bayCount: layout.bayCount,
    spacingAssumed,
    embedmentRatio,
    embedmentExplicit,
    positionsM: layout.positionsM,
    lengthsM,
    totalLengthM: round2(lengthsM.reduce((sum, n) => sum + n, 0)),
  };
}

export function timberFaceBoardLm(
  faceAreaM2: number,
  faceHeightM: number
): number {
  if (!(faceHeightM > 0)) return 0;
  return round2(faceAreaM2 / faceHeightM);
}

export function buildTimberWallRequirements(params: {
  workAreaId: string;
  geometry: RetainingWallGeometry;
  inputs: TimberWallInputs;
  factKeys: string[];
}): {
  requirements: MaterialRequirement[];
  assumptions: string[];
  piles: TimberPileTakeoff;
} {
  const board = timberFaceBoardFromFact(params.inputs.faceBoardSection);
  const netLm = timberFaceBoardLm(params.geometry.faceAreaM2, board.faceHeightM);
  const purchaseLm = round2(netLm * (1 + params.inputs.wasteFactor));
  const piles = timberPileTakeoff(params.geometry, params.inputs);
  const assumptions: string[] = [];
  if (piles.spacingAssumed) {
    assumptions.push(RW_TIMBER_DEFAULT_SPACING_DISCLOSURE);
  } else {
    assumptions.push(
      `Pile centres use ${piles.targetSpacingM} m as target/max estimating spacing. Generated actual spacing ${round2(piles.actualSpacingM)} m so bays sit evenly. ${RETAINING_WALL_PILE_SPACING_KIND.replaceAll("_", " ").toLowerCase()} — not a structural standard.`
    );
  }
  if (!piles.embedmentExplicit) {
    if (piles.embedmentRatio === RETAINING_WALL_TIMBER_EMBEDMENT_RATIO) {
      assumptions.push(RW_TIMBER_DEFAULT_EMBEDMENT_DISCLOSURE);
    } else {
      assumptions.push(
        `Pile embedment estimated at ${round2(piles.embedmentRatio * 100)}% of retained height.`
      );
    }
    assumptions.push(RW_ESTIMATING_ASSUMPTION_CONFIRM);
  }
  if (!params.inputs.faceBoardSection) {
    assumptions.push("Face boards assumed 150×50 H4.");
  }

  const common = {
    workAreaId: params.workAreaId,
    factKeys: params.factKeys,
    source: "retaining_wall.timber",
  };

  const requirements: MaterialRequirement[] = [
    planningMaterial({
      ...common,
      componentKey: RW_TIMBER_BOARDS_COMPONENT,
      description: `Timber face boards ${board.faceHeightM === 0.2 ? "200×50" : "150×50"} H4`,
      materialKey: board.materialKey,
      identity: board.identity,
      category: "TIMBER",
      specification: `${netLm} lm net from face area ${params.geometry.faceAreaM2} m² / ${board.faceHeightM} m board height. Waste applied once.`,
      baseQuantity: netLm,
      baseUnit: "lm",
      wasteFactor: params.inputs.wasteFactor,
      purchaseQuantity: purchaseLm,
      purchaseUnit: "lm",
    }),
    planningMaterial({
      ...common,
      componentKey: RW_TIMBER_PILES_EA_COMPONENT,
      description: "H5 SED / pole piles",
      materialKey: RW_H5_SED_POLE_KEY,
      identity: H5_SED_POLE_IDENTITY,
      category: "TIMBER",
      specification: `${piles.count} piles. Target/max centres ${piles.targetSpacingM} m; actual even-bay spacing ${round2(piles.actualSpacingM)} m. Lengths follow H(x), not max wall height.`,
      baseQuantity: piles.count,
      baseUnit: "ea",
      wasteFactor: 0,
      purchaseQuantity: piles.count,
      purchaseUnit: "ea",
    }),
    planningMaterial({
      ...common,
      componentKey: RW_TIMBER_PILES_LM_COMPONENT,
      description: "H5 SED / pole pile length",
      materialKey: RW_H5_SED_POLE_KEY,
      identity: H5_SED_POLE_IDENTITY,
      category: "TIMBER",
      specification: `Total estimated pile length ${piles.totalLengthM} lm (above-ground H(x) + embedment).`,
      baseQuantity: piles.totalLengthM,
      baseUnit: "lm",
      wasteFactor: 0,
      purchaseQuantity: piles.totalLengthM,
      purchaseUnit: "lm",
    }),
  ];

  return { requirements, assumptions, piles };
}
