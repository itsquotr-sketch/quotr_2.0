/**
 * RETAINING-WALL-MATURITY-1A — physical planning orchestrator.
 * Emits unpriced requirements. Does not replace the commercial package.
 */

import type { EstimateContext, EstimateFact } from "@/lib/estimate/types";
import {
  getBooleanFact,
  getNumberFact,
  getNumberFactAny,
  getStringFact,
} from "@/lib/estimate/facts";
import type { EstimateRequirement } from "@/lib/estimate/requirements";
import { resolveMaterialWastage } from "@/lib/settings/material-wastage";
import {
  backfillVolumeM3,
  geometryAssumptionTexts,
  resolveRetainingWallGeometry,
  type RetainingWallGeometry,
} from "@/lib/estimate/retaining-wall-geometry";
import {
  classifyRetainingWallSurcharge,
  retainingWallConsentNotes,
} from "@/lib/estimate/retaining-wall-consent";
import {
  DRAINAGE_AGGREGATE_IDENTITY,
  NOVACOIL_IDENTITY,
  RW_BACKFILL_COMPONENT,
  RW_DRAINAGE_AGGREGATE_KEY,
  RW_EXCAVATION_COMPONENT,
  RW_FACE_AREA_COMPONENT,
  RW_NOVACOIL_COMPONENT,
  RW_NOVACOIL_KEY,
} from "@/lib/estimate/retaining-wall-identities";
import { planningMaterial } from "@/lib/estimate/retaining-wall-planning";
import {
  buildMasonryWallRequirements,
  type MasonryWallTakeoff,
} from "@/lib/estimate/retaining-wall-masonry";
import {
  buildSleeperWallRequirements,
  type SleeperWallTakeoff,
} from "@/lib/estimate/retaining-wall-sleeper";
import {
  buildTimberWallRequirements,
  type TimberPileTakeoff,
} from "@/lib/estimate/retaining-wall-timber";
import {
  classifyRetainingWallSystem,
  type RetainingWallSystemClass,
} from "@/lib/estimate/retaining-wall-systems";
import {
  resolveRetainingWallBackfillIncluded,
  resolveRetainingWallDrainageIncluded,
  RW_BACKFILL_STANDARD_ASSUMPTION,
  RW_DRAINAGE_STANDARD_ASSUMPTION,
} from "@/lib/estimate/retaining-wall-defaults";

export const RW_PLANNING_TAKEOFF_DISCLAIMER =
  "Planning quantities for estimating. Not structural design or a consent determination.";

export type BulkExcavationMode = "NONE" | "DERIVED" | "EXPLICIT_VOLUME";

export type RetainingWallPhysicalModel = {
  geometry: RetainingWallGeometry | null;
  system: RetainingWallSystemClass;
  excavationMode: BulkExcavationMode;
  requirements: EstimateRequirement[];
  assumptions: string[];
  timberPiles?: TimberPileTakeoff;
  sleeperTakeoff?: SleeperWallTakeoff;
  masonryTakeoff?: MasonryWallTakeoff;
};

function factKeysFor(system: RetainingWallSystemClass): string[] {
  const common = [
    "retaining_wall.length_m",
    "retaining_wall.height_m",
    "retaining_wall.height_high_m",
    "retaining_wall.height_low_m",
    "retaining_wall.material",
    "retaining_wall.drainage_required",
    "retaining_wall.backfill_included",
    "retaining_wall.excavation_required",
    "retaining_wall.surcharge",
  ];
  if (system === "TIMBER_RETAINING_WALL") {
    return [
      ...common,
      "retaining_wall.post_spacing_m",
      "retaining_wall.pile_embedment_m",
      "retaining_wall.face_board_section",
    ];
  }
  if (system === "CONCRETE_SLEEPER_WALL") {
    return [
      ...common,
      "retaining_wall.sleeper_length_m",
      "retaining_wall.sleeper_face_height_m",
      "retaining_wall.sleeper_post_spacing_m",
      "retaining_wall.sleeper_post_embedment_m",
      "retaining_wall.hole_diameter_m",
      "retaining_wall.premix_bag_yield_m3",
    ];
  }
  if (system === "CONCRETE_MASONRY_WALL") {
    return [
      ...common,
      "retaining_wall.block_series",
      "retaining_wall.waterproofing_required",
    ];
  }
  return common;
}

export function buildRetainingWallPhysicalModel(params: {
  context: EstimateContext;
  workAreaId: string;
  material: string | null;
}): RetainingWallPhysicalModel {
  const { context, workAreaId } = params;
  const facts = context.facts as EstimateFact[];
  const system = classifyRetainingWallSystem(params.material);
  const lengthM = getNumberFact(facts, workAreaId, "retaining_wall.length_m");
  const heightM = getNumberFact(facts, workAreaId, "retaining_wall.height_m");
  const heightHighM = getNumberFactAny(facts, workAreaId, [
    "retaining_wall.height_high_m",
    "retaining_wall.high_height_m",
  ]);
  const heightLowM = getNumberFactAny(facts, workAreaId, [
    "retaining_wall.height_low_m",
    "retaining_wall.low_height_m",
  ]);
  const geometry = resolveRetainingWallGeometry({
    lengthM,
    heightM,
    heightHighM,
    heightLowM,
  });

  if (!geometry || system === "missing" || system === "unsupported") {
    return {
      geometry,
      system,
      excavationMode: "NONE",
      requirements: [],
      assumptions: [],
    };
  }

  const keys = factKeysFor(system);
  const wasteFactor =
    resolveMaterialWastage(context.materialWastageSettings, "timber_framing") /
    100;
  const requirements: EstimateRequirement[] = [];
  const assumptions = [...geometryAssumptionTexts(geometry)];
  let timberPiles: TimberPileTakeoff | undefined;
  let sleeperTakeoff: SleeperWallTakeoff | undefined;
  let masonryTakeoff: MasonryWallTakeoff | undefined;

  const heightSpec = geometry.sloping
    ? `${geometry.h1M} m → ${geometry.h2M} m`
    : `${geometry.h1M} m`;
  requirements.push(
    planningMaterial({
      workAreaId,
      componentKey: RW_FACE_AREA_COMPONENT,
      description: "Retaining wall face",
      materialKey: null,
      category: "GEOMETRY",
      specification: `Length ${geometry.lengthM} m. Height ${heightSpec}. Face area ${geometry.faceAreaM2} m².`,
      baseQuantity: geometry.faceAreaM2,
      baseUnit: "m2",
      wasteFactor: 0,
      purchaseQuantity: geometry.faceAreaM2,
      purchaseUnit: "m2",
      factKeys: keys,
      source: "retaining_wall.geometry",
    })
  );

  const drainage = resolveRetainingWallDrainageIncluded({
    facts,
    workAreaId,
    system,
  });
  if (drainage.assumed) {
    assumptions.push(RW_DRAINAGE_STANDARD_ASSUMPTION);
  }
  if (drainage.included) {
    requirements.push(
      planningMaterial({
        workAreaId,
        componentKey: RW_NOVACOIL_COMPONENT,
        description: "Novacoil drainage",
        materialKey: RW_NOVACOIL_KEY,
        identity: NOVACOIL_IDENTITY,
        category: "DRAINAGE",
        specification: `${geometry.lengthM} lm along the wall. Net lm. No procurement allowance yet.`,
        baseQuantity: geometry.lengthM,
        baseUnit: "lm",
        wasteFactor: 0,
        purchaseQuantity: geometry.lengthM,
        purchaseUnit: "lm",
        factKeys: keys,
        source: "retaining_wall.drainage",
      })
    );
  }

  const backfill = resolveRetainingWallBackfillIncluded({
    facts,
    workAreaId,
    system,
  });
  if (backfill.assumed) {
    assumptions.push(RW_BACKFILL_STANDARD_ASSUMPTION);
  }
  if (backfill.included) {
    const depthOverride = getNumberFact(
      facts,
      workAreaId,
      "retaining_wall.backfill_depth_m"
    );
    const volume = backfillVolumeM3({
      lengthM: geometry.lengthM,
      h1M: geometry.h1M,
      h2M: geometry.h2M,
      depthM: depthOverride ?? undefined,
    });
    assumptions.push(
      "Planning backfill is in-place / geometric volume (300 mm drainage zone, stopping 150 mm below the retained surface). Not a purchase quantity — no bulking, compaction, or procurement waste. Backfill material is not excavation."
    );
    requirements.push(
      planningMaterial({
        workAreaId,
        componentKey: RW_BACKFILL_COMPONENT,
        description: "Drainage aggregate / backfill (in-place)",
        materialKey: RW_DRAINAGE_AGGREGATE_KEY,
        identity: DRAINAGE_AGGREGATE_IDENTITY,
        category: "BACKFILL",
        specification: `${volume} m³ in-place / geometric volume. Not a purchase quantity.`,
        baseQuantity: volume,
        baseUnit: "m3",
        wasteFactor: 0,
        purchaseQuantity: volume,
        purchaseUnit: "m3",
        factKeys: keys,
        source: "retaining_wall.backfill",
      })
    );
  }

  const excavationRequired = getBooleanFact(
    facts,
    workAreaId,
    "retaining_wall.excavation_required"
  );
  const explicitExcavation = getNumberFact(
    facts,
    workAreaId,
    "retaining_wall.excavation_volume_m3"
  );
  let excavationMode: BulkExcavationMode = "NONE";
  if (excavationRequired === false) {
    excavationMode = "NONE";
  } else if (explicitExcavation != null && explicitExcavation > 0) {
    excavationMode = "EXPLICIT_VOLUME";
    requirements.push(
      planningMaterial({
        workAreaId,
        componentKey: RW_EXCAVATION_COMPONENT,
        description: "Bulk excavation",
        materialKey: null,
        category: "EXCAVATION",
        specification: `${explicitExcavation} m³ supplied excavation volume. Not assumed equal to backfill.`,
        baseQuantity: explicitExcavation,
        baseUnit: "m3",
        wasteFactor: 0,
        purchaseQuantity: explicitExcavation,
        purchaseUnit: "m3",
        factKeys: keys,
        source: "retaining_wall.excavation",
      })
    );
  } else if (excavationRequired === true) {
    excavationMode = "NONE";
    assumptions.push(
      "Bulk excavation is included in scope but no safe planning volume was derived. Backfill volume is not used as excavation quantity."
    );
  }

  const surcharge = classifyRetainingWallSurcharge(
    getStringFact(facts, workAreaId, "retaining_wall.surcharge") ??
      getStringFact(facts, workAreaId, "retaining_wall.surcharge_type")
  );
  assumptions.push(
    ...retainingWallConsentNotes({
      maxHeightM: geometry.maxHeightM,
      surcharge,
    })
  );

  if (system === "TIMBER_RETAINING_WALL") {
    const timber = buildTimberWallRequirements({
      workAreaId,
      geometry,
      factKeys: keys,
      inputs: {
        faceBoardSection: getStringFact(
          facts,
          workAreaId,
          "retaining_wall.face_board_section"
        ),
        pileSpacingM: getNumberFact(
          facts,
          workAreaId,
          "retaining_wall.post_spacing_m"
        ),
        pileEmbedmentM: getNumberFact(
          facts,
          workAreaId,
          "retaining_wall.pile_embedment_m"
        ),
        pileEmbedmentRatio: getNumberFact(
          facts,
          workAreaId,
          "retaining_wall.pile_embedment_ratio"
        ),
        wasteFactor,
      },
    });
    requirements.push(...timber.requirements);
    assumptions.push(...timber.assumptions);
    timberPiles = timber.piles;
  }

  if (system === "CONCRETE_SLEEPER_WALL") {
    const sleeper = buildSleeperWallRequirements({
      workAreaId,
      geometry,
      factKeys: keys,
      inputs: {
        sleeperLengthM: getNumberFact(
          facts,
          workAreaId,
          "retaining_wall.sleeper_length_m"
        ),
        sleeperFaceHeightM: getNumberFact(
          facts,
          workAreaId,
          "retaining_wall.sleeper_face_height_m"
        ),
        postSpacingM: getNumberFact(
          facts,
          workAreaId,
          "retaining_wall.sleeper_post_spacing_m"
        ),
        postEmbedmentM: getNumberFact(
          facts,
          workAreaId,
          "retaining_wall.sleeper_post_embedment_m"
        ),
        holeDiameterM: getNumberFact(
          facts,
          workAreaId,
          "retaining_wall.hole_diameter_m"
        ),
        premixBagYieldM3: getNumberFact(
          facts,
          workAreaId,
          "retaining_wall.premix_bag_yield_m3"
        ),
        wasteFactor,
      },
    });
    requirements.push(...sleeper.requirements);
    assumptions.push(...sleeper.assumptions);
    sleeperTakeoff = sleeper.takeoff;
  }

  if (system === "CONCRETE_MASONRY_WALL") {
    const masonry = buildMasonryWallRequirements({
      workAreaId,
      geometry,
      factKeys: keys,
      inputs: {
        blockSeries: getStringFact(
          facts,
          workAreaId,
          "retaining_wall.block_series"
        ),
        layingMethod: getStringFact(
          facts,
          workAreaId,
          "retaining_wall.block_laying_method"
        ),
        footingWidthM: getNumberFact(
          facts,
          workAreaId,
          "retaining_wall.footing_width_m"
        ),
        footingDepthM: getNumberFact(
          facts,
          workAreaId,
          "retaining_wall.footing_depth_m"
        ),
        verticalStarterSpacingM: getNumberFact(
          facts,
          workAreaId,
          "retaining_wall.vertical_starter_spacing_m"
        ),
        horizontalRebarRuns: getNumberFact(
          facts,
          workAreaId,
          "retaining_wall.horizontal_rebar_runs"
        ),
        waterproofingRequired: getBooleanFact(
          facts,
          workAreaId,
          "retaining_wall.waterproofing_required"
        ),
        waterproofingType: getStringFact(
          facts,
          workAreaId,
          "retaining_wall.waterproofing_type"
        ),
        waterproofingMethod: getStringFact(
          facts,
          workAreaId,
          "retaining_wall.waterproofing_method"
        ),
        wasteFactor,
      },
    });
    requirements.push(...masonry.requirements);
    assumptions.push(...masonry.assumptions);
    masonryTakeoff = masonry.takeoff;
  }

  if (system === "CONCRETE_UNSPECIFIED") {
    assumptions.push(
      "Concrete wall type is unspecified (sleeper vs masonry). Type-specific takeoff is withheld until the system is confirmed."
    );
  }

  return {
    geometry,
    system,
    excavationMode,
    requirements,
    assumptions,
    timberPiles,
    sleeperTakeoff,
    masonryTakeoff,
  };
}
