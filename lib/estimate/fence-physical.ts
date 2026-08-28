/**
 * FENCE-MATURITY-1A — physical planning orchestrator.
 * Emits unpriced requirements. Does not replace the commercial package.
 */

import type { EstimateContext, EstimateFact } from "@/lib/estimate/types";
import {
  getBooleanFact,
  getNumberFact,
  getStringFact,
} from "@/lib/estimate/facts";
import type { EstimateRequirement } from "@/lib/estimate/requirements";
import { FENCE_STRAIGHT_RUN_DISCLOSURE, resolveFenceGeometry } from "@/lib/estimate/fence-geometry";
import {
  FENCE_BOARDS_COMPONENT,
  FENCE_BOARD_LABOUR_COMPONENT,
  FENCE_CAPPING_COMPONENT,
  FENCE_CAPPING_LABOUR_COMPONENT,
  FENCE_CONCRETE_COMPONENT,
  FENCE_CONCRETE_LABOUR_COMPONENT,
  FENCE_FACE_AREA_COMPONENT,
  FENCE_FIXINGS_MODULAR_COMPONENT,
  FENCE_FIXINGS_MODULAR_KEY,
  FENCE_FIXINGS_TIMBER_COMPONENT,
  FENCE_FIXINGS_TIMBER_KEY,
  FENCE_FRAMING_LABOUR_COMPONENT,
  FENCE_GATE_FRAME_COMPONENT,
  FENCE_GATE_HARDWARE_COMPONENT,
  FENCE_GATE_HARDWARE_IDENTITY,
  FENCE_GATE_POSTS_EA_COMPONENT,
  fenceRailMaterialKey,
  FENCE_GATE_HARDWARE_KEY,
  FENCE_GATE_LABOUR_COMPONENT,
  FENCE_POSTS_EA_COMPONENT,
  FENCE_POSTS_LM_COMPONENT,
  FENCE_POST_LABOUR_COMPONENT,
  FENCE_PREMIX_20KG_KEY,
  FENCE_PREMIX_IDENTITY,
  FENCE_RAILS_COMPONENT,
  FENCE_SECTIONS_COMPONENT,
  FENCE_SECTION_LABOUR_COMPONENT,
} from "@/lib/estimate/fence-identities";
import {
  classifyFenceMetalMaterial,
  classifyFenceSystem,
  classifyFenceTimberSpecies,
  isModularFenceSystem,
  isTimberFenceSystem,
  type FenceSystemClass,
} from "@/lib/estimate/fence-systems";
import { buildFenceTimberTakeoff, type FenceTimberTakeoff } from "@/lib/estimate/fence-timber";
import { buildFenceModularTakeoff, type FenceModularTakeoff } from "@/lib/estimate/fence-modular";
import {
  fencePlanningLabour,
  fencePlanningMaterial,
} from "@/lib/estimate/fence-planning";
import {
  FENCE_PRODUCTIVITY_KEYS,
  FENCE_PRODUCTIVITY_STARTERS,
} from "@/lib/estimate/fence-productivity";
import { FENCE_PACKAGE_XOR_NOTE } from "@/lib/estimate/fence-defaults";
import { round2 } from "@/lib/estimate/facts";
import { formatPostHoleBaggedConcreteCopy } from "@/lib/estimate/retaining-wall-builder-copy";

export const FENCE_PLANNING_TAKEOFF_DISCLAIMER =
  "Planning quantities for estimating. Not structural design, wind engineering, or a compliance determination.";

export type FencePhysicalModel = {
  geometry: ReturnType<typeof resolveFenceGeometry>;
  system: FenceSystemClass;
  requirements: EstimateRequirement[];
  assumptions: string[];
  attention: string[];
  timber?: FenceTimberTakeoff;
  modular?: FenceModularTakeoff;
};

function factKeysFor(system: FenceSystemClass): string[] {
  const common = [
    "fence.length_m",
    "fence.height_m",
    "fence.system",
    "fence.material",
    "fence.post_embedment_m",
    "fence.hole_diameter_m",
    "fence.demolition_required",
    "fence.slope_condition",
  ];
  if (isTimberFenceSystem(system)) {
    return [
      ...common,
      "fence.timber_species",
      "fence.board_thickness_mm",
      "fence.top_capping",
      "fence.post_spacing_m",
      "fence.rail_count",
      "fence.rail_section",
      "fence.gate_included",
      "fence.gate_count",
      "fence.gate_width_m",
      "fence.gate_position",
      "fence.gate_capping",
      ...(system === "TIMBER_HORIZONTAL_SLAT"
        ? ["fence.slat_gap_mm", "fence.horizontal_course_count"]
        : ["fence.vertical_paling_gap_mm"]),
    ];
  }
  if (isModularFenceSystem(system)) {
    return [
      ...common,
      "fence.section_width_m",
      "fence.section_count",
      "fence.section_height_m",
      "fence.metal_material",
      "fence.paling_or_panel_type",
    ];
  }
  return common;
}

function parseThicknessMm(raw: string | number | null): number | null {
  if (raw == null) return null;
  if (typeof raw === "number" && (raw === 19 || raw === 25)) return raw;
  const text = String(raw);
  if (/\b25\b/.test(text)) return 25;
  if (/\b19\b/.test(text)) return 19;
  return null;
}

function parseCapping(value: boolean | string | null): boolean | null {
  if (value === true) return true;
  if (value === false) return false;
  if (typeof value === "string") {
    const t = value.toLowerCase();
    if (t === "yes") return true;
    if (t === "no") return false;
  }
  return null;
}

export function buildFencePhysicalModel(params: {
  context: EstimateContext;
  workAreaId: string;
}): FencePhysicalModel {
  const { context, workAreaId } = params;
  const facts = context.facts as EstimateFact[];
  const system = classifyFenceSystem(
    getStringFact(facts, workAreaId, "fence.system") ??
      getStringFact(facts, workAreaId, "fence.material"),
    getStringFact(facts, workAreaId, "fence.paling_or_panel_type")
  );
  const lengthM = getNumberFact(facts, workAreaId, "fence.length_m");
  const heightM = getNumberFact(facts, workAreaId, "fence.height_m");
  const geometry = resolveFenceGeometry({ lengthM, heightM });

  if (!geometry || system === "missing" || system === "unsupported") {
    return {
      geometry,
      system,
      requirements: [],
      assumptions: [],
      attention: [],
    };
  }

  const keys = factKeysFor(system);
  const requirements: EstimateRequirement[] = [];
  const assumptions = [FENCE_STRAIGHT_RUN_DISCLOSURE, FENCE_PACKAGE_XOR_NOTE];
  const attention: string[] = [];

  requirements.push(
    fencePlanningMaterial({
      workAreaId,
      componentKey: FENCE_FACE_AREA_COMPONENT,
      description: "Fence face",
      materialKey: null,
      category: "GEOMETRY",
      specification: `Length ${geometry.lengthM} m. Height ${geometry.heightM} m. Face area ${geometry.faceAreaM2} m².`,
      baseQuantity: geometry.faceAreaM2,
      baseUnit: "m2",
      wasteFactor: 0,
      purchaseQuantity: geometry.faceAreaM2,
      purchaseUnit: "m2",
      factKeys: keys,
      source: "fence.geometry",
    })
  );

  const timberFramingPercent =
    context.materialWastageSettings?.timberFramingWastagePercent ?? null;

  let timber: FenceTimberTakeoff | undefined;
  let modular: FenceModularTakeoff | undefined;

  if (isTimberFenceSystem(system)) {
    timber = buildFenceTimberTakeoff({
      geometry,
      orientation: system === "TIMBER_HORIZONTAL_SLAT" ? "horizontal" : "vertical",
      species: classifyFenceTimberSpecies(
        getStringFact(facts, workAreaId, "fence.timber_species")
      ),
      thicknessMm: parseThicknessMm(
        getNumberFact(facts, workAreaId, "fence.board_thickness_mm") ??
          getStringFact(facts, workAreaId, "fence.board_thickness_mm")
      ),
      maxPostSpacingM: getNumberFact(facts, workAreaId, "fence.post_spacing_m"),
      embedmentM: getNumberFact(facts, workAreaId, "fence.post_embedment_m"),
      holeDiameterM: getNumberFact(facts, workAreaId, "fence.hole_diameter_m"),
      slatGapMm: getNumberFact(facts, workAreaId, "fence.slat_gap_mm"),
      verticalPalingGapMm: getNumberFact(
        facts,
        workAreaId,
        "fence.vertical_paling_gap_mm"
      ),
      railCount: getNumberFact(facts, workAreaId, "fence.rail_count"),
      railSection: getStringFact(facts, workAreaId, "fence.rail_section"),
      cappingIncluded: parseCapping(
        getBooleanFact(facts, workAreaId, "fence.top_capping") ??
          getStringFact(facts, workAreaId, "fence.top_capping")
      ),
      gateIncluded: getBooleanFact(facts, workAreaId, "fence.gate_included"),
      gateCount: getNumberFact(facts, workAreaId, "fence.gate_count"),
      gateWidthM: getNumberFact(facts, workAreaId, "fence.gate_width_m"),
      gatePosition: getStringFact(facts, workAreaId, "fence.gate_position"),
      gateCappingIncluded: parseCapping(
        getBooleanFact(facts, workAreaId, "fence.gate_capping") ??
          getStringFact(facts, workAreaId, "fence.gate_capping")
      ),
      horizontalCourseCount: getNumberFact(
        facts,
        workAreaId,
        "fence.horizontal_course_count"
      ),
      wastePercent: timberFramingPercent,
    });
    assumptions.push(...timber.assumptions);
    attention.push(...timber.attention);

    const concreteCopy = formatPostHoleBaggedConcreteCopy({
      bagCount: timber.concrete.bagCount,
      holeCount: timber.holeCount,
      unitCost: null,
      sloping: false,
      holeDiameterM: timber.holeDiameterM,
      grossHoleVolumeM3: timber.concrete.grossHoleVolumeM3,
      postDisplacementM3: timber.concrete.postDisplacementM3,
      netConcreteM3: timber.concrete.netConcreteM3,
      bagYieldM3: timber.concrete.bagYieldM3,
    });

    requirements.push(
      fencePlanningMaterial({
        workAreaId,
        componentKey: FENCE_POSTS_EA_COMPONENT,
        description: "Fence posts",
        materialKey: "fence.timber.post.100x100.h4",
        identity: timber.postIdentity,
        category: "POSTS",
        specification: `${timber.postCount} EA · ${round2(timber.postRequiredLengthM)} m required length (height + embedment)`,
        baseQuantity: timber.postCount,
        baseUnit: "ea",
        wasteFactor: 0,
        purchaseQuantity: timber.postCount,
        purchaseUnit: "ea",
        factKeys: keys,
        source: "fence.timber.posts",
      })
    );
    requirements.push(
      fencePlanningMaterial({
        workAreaId,
        componentKey: FENCE_POSTS_LM_COMPONENT,
        description: "Fence post stock length",
        materialKey: "fence.timber.post.100x100.h4",
        identity: timber.postIdentity,
        category: "POSTS",
        specification: `${round2(timber.postStockLm)} lm theoretical (${timber.postCount} × ${round2(timber.postRequiredLengthM)} m)`,
        baseQuantity: timber.postStockLm,
        baseUnit: "lm",
        wasteFactor: 0,
        purchaseQuantity: timber.postStockLm,
        purchaseUnit: "lm",
        factKeys: keys,
        source: "fence.timber.posts.lm",
      })
    );
    if (timber.gateIncluded && timber.gateEdgePostCount > 0) {
      requirements.push(
        fencePlanningMaterial({
          workAreaId,
          componentKey: FENCE_GATE_POSTS_EA_COMPONENT,
          description: "Gate posts",
          materialKey: "fence.timber.post.100x100.h4",
          identity: timber.gatePostIdentity,
          category: "POSTS",
          specification: `${timber.gateEdgePostCount} gate-edge posts · included in fence post count · assumed same section as fence posts`,
          baseQuantity: timber.gateEdgePostCount,
          baseUnit: "ea",
          wasteFactor: 0,
          purchaseQuantity: timber.gateEdgePostCount,
          purchaseUnit: "ea",
          factKeys: keys,
          source: "fence.timber.gate_posts",
        })
      );
    }
    requirements.push(
      fencePlanningMaterial({
        workAreaId,
        componentKey: FENCE_BOARDS_COMPONENT,
        description:
          system === "TIMBER_HORIZONTAL_SLAT" ? "Slats" : "Palings",
        materialKey: `fence.board.${timber.species}.${timber.thicknessMm}`,
        identity: timber.boardIdentity,
        category: "BOARDS",
        specification:
          system === "TIMBER_HORIZONTAL_SLAT"
            ? `${timber.courseCount} courses · occupied height ${round2(timber.occupiedHeightM ?? 0)} m · residual clearance ${round2(timber.residualM ?? 0)} m (≈${Math.round((timber.topClearanceM ?? 0) * 1000)} mm top + ${Math.round((timber.bottomClearanceM ?? 0) * 1000)} mm bottom) · ${round2(timber.boardRequiredLm)} lm required · ${round2(timber.boardPurchasedLm)} lm purchased`
            : `Board width: ${Math.round(timber.boardWidthM * 1000)}mm. Paling gap: ${timber.palingGapMm ?? 0}mm. Effective pitch: ${Math.round((timber.effectivePitchM ?? timber.boardWidthM) * 1000)}mm. Board count: ${timber.boardCount} EA (${timber.fixedBoardCount} fixed runs + ${timber.gateBoardCount} gate). ${round2(timber.boardRequiredLm)} lm required · ${round2(timber.boardPurchasedLm)} lm purchased`,
        baseQuantity: timber.boardRequiredLm,
        baseUnit: "lm",
        wasteFactor: timber.wasteFactor,
        purchaseQuantity: timber.boardPurchasedLm,
        purchaseUnit: "lm",
        factKeys: keys,
        source: "fence.timber.boards",
      })
    );
    if (timber.railLm > 0 && timber.railIdentity) {
      requirements.push(
        fencePlanningMaterial({
          workAreaId,
          componentKey: FENCE_RAILS_COMPONENT,
          description: "Rails",
          materialKey: fenceRailMaterialKey(timber.railSection ?? "75x50"),
          identity: timber.railIdentity,
          category: "FRAMING",
          specification: `${timber.railCount} rails × ${round2(timber.fixedFenceLengthM)} m fixed run = ${round2(timber.railRequiredLm)} lm required · ${round2(timber.railPurchasedLm)} lm purchased · ${timber.railSection} H4 (gate openings excluded)`,
          baseQuantity: timber.railRequiredLm,
          baseUnit: "lm",
          wasteFactor: timber.wasteFactor,
          purchaseQuantity: timber.railPurchasedLm,
          purchaseUnit: "lm",
          factKeys: keys,
          source: "fence.timber.rails",
        })
      );
    }
    if (timber.cappingIncluded && timber.cappingIdentity) {
      requirements.push(
        fencePlanningMaterial({
          workAreaId,
          componentKey: FENCE_CAPPING_COMPONENT,
          description: "Top capping",
          materialKey: `fence.capping.${timber.species}`,
          identity: timber.cappingIdentity,
          category: "CAPPING",
          specification:
            timber.gateCappingLm > 0
              ? `${round2(timber.fixedCappingLm)} lm fixed fence + ${round2(timber.gateCappingLm)} lm gate = ${round2(timber.cappingLm)} lm`
              : `${round2(timber.fixedCappingLm)} lm along the fixed fence top`,
          baseQuantity: timber.cappingLm,
          baseUnit: "lm",
          wasteFactor: 0,
          purchaseQuantity: timber.cappingLm,
          purchaseUnit: "lm",
          factKeys: keys,
          source: "fence.timber.capping",
        })
      );
    }
    if (timber.gateIncluded && timber.gateFrameIdentity) {
      requirements.push(
        fencePlanningMaterial({
          workAreaId,
          componentKey: FENCE_GATE_FRAME_COMPONENT,
          description: "Gate framing",
          materialKey: "fence.gate.frame.lm",
          identity: timber.gateFrameIdentity,
          category: "GATE",
          specification: `${timber.gateCount} gate(s) · ${round2(timber.gateFrameLm)} lm (2 stiles + 2 rails + 1 brace)`,
          baseQuantity: timber.gateFrameLm,
          baseUnit: "lm",
          wasteFactor: 0,
          purchaseQuantity: timber.gateFrameLm,
          purchaseUnit: "lm",
          factKeys: keys,
          source: "fence.timber.gate_frame",
        })
      );
      requirements.push(
        fencePlanningMaterial({
          workAreaId,
          componentKey: FENCE_GATE_HARDWARE_COMPONENT,
          description: "Gate hardware",
          materialKey: FENCE_GATE_HARDWARE_KEY,
          identity: FENCE_GATE_HARDWARE_IDENTITY,
          category: "GATE",
          specification: `${timber.gateHardwareEa} EA — hinges, latch/lock, normal fixings`,
          baseQuantity: timber.gateHardwareEa,
          baseUnit: "ea",
          wasteFactor: 0,
          purchaseQuantity: timber.gateHardwareEa,
          purchaseUnit: "ea",
          factKeys: keys,
          source: "fence.timber.gate_hardware",
        })
      );
    }
    requirements.push(
      fencePlanningMaterial({
        workAreaId,
        componentKey: FENCE_CONCRETE_COMPONENT,
        description: "Post-hole concrete (bagged premix)",
        materialKey: FENCE_PREMIX_20KG_KEY,
        identity: FENCE_PREMIX_IDENTITY,
        category: "CONCRETE",
        specification: `${concreteCopy.supporting}. ${concreteCopy.secondary ?? ""}`.trim(),
        baseQuantity: timber.concrete.bagCount,
        baseUnit: "bag",
        wasteFactor: 0,
        purchaseQuantity: timber.concrete.bagCount,
        purchaseUnit: "bag",
        factKeys: keys,
        source: "fence.post_hole_concrete",
      })
    );
    requirements.push(
      fencePlanningMaterial({
        workAreaId,
        componentKey: FENCE_FIXINGS_TIMBER_COMPONENT,
        description: "Fixings",
        materialKey: FENCE_FIXINGS_TIMBER_KEY,
        category: "FIXINGS",
        specification:
          "Timber nails/screws/connectors allowance. Separate from gate hardware. Package owns money in 1A.",
        baseQuantity: 1,
        baseUnit: "allowance",
        wasteFactor: 0,
        purchaseQuantity: 1,
        purchaseUnit: "allowance",
        factKeys: keys,
        source: "fence.timber.fixings",
      })
    );

    requirements.push(
      fencePlanningLabour({
        workAreaId,
        componentKey: FENCE_POST_LABOUR_COMPONENT,
        description: "Post installation",
        trade: "fencing",
        productivityKey: FENCE_PRODUCTIVITY_KEYS.postInstall,
        hoursPerUnit: FENCE_PRODUCTIVITY_STARTERS[FENCE_PRODUCTIVITY_KEYS.postInstall],
        unit: "post",
        quantity: timber.postCount,
        factKeys: keys,
        accessSensitive: true,
      })
    );
    if (timber.railLm > 0) {
      requirements.push(
        fencePlanningLabour({
          workAreaId,
          componentKey: FENCE_FRAMING_LABOUR_COMPONENT,
          description: "Fence framing",
          trade: "fencing",
          productivityKey: FENCE_PRODUCTIVITY_KEYS.framingLm,
          hoursPerUnit: FENCE_PRODUCTIVITY_STARTERS[FENCE_PRODUCTIVITY_KEYS.framingLm],
          unit: "lm",
          quantity: timber.fixedFenceLengthM,
          factKeys: keys,
          accessSensitive: true,
        })
      );
    }
    requirements.push(
      fencePlanningLabour({
        workAreaId,
        componentKey: FENCE_BOARD_LABOUR_COMPONENT,
        description:
          system === "TIMBER_HORIZONTAL_SLAT"
            ? "Board/slat installation"
            : "Board installation",
        trade: "fencing",
        productivityKey:
          system === "TIMBER_HORIZONTAL_SLAT"
            ? FENCE_PRODUCTIVITY_KEYS.horizontalSlatsM2
            : FENCE_PRODUCTIVITY_KEYS.verticalBoardsM2,
        hoursPerUnit:
          system === "TIMBER_HORIZONTAL_SLAT"
            ? FENCE_PRODUCTIVITY_STARTERS[FENCE_PRODUCTIVITY_KEYS.horizontalSlatsM2]
            : FENCE_PRODUCTIVITY_STARTERS[FENCE_PRODUCTIVITY_KEYS.verticalBoardsM2],
        unit: "m2",
        quantity: timber.faceAreaM2,
        factKeys: keys,
        accessSensitive: true,
      })
    );
    if (timber.cappingIncluded) {
      requirements.push(
        fencePlanningLabour({
          workAreaId,
          componentKey: FENCE_CAPPING_LABOUR_COMPONENT,
          description: "Top-cap installation",
          trade: "fencing",
          productivityKey: FENCE_PRODUCTIVITY_KEYS.cappingLm,
          hoursPerUnit: FENCE_PRODUCTIVITY_STARTERS[FENCE_PRODUCTIVITY_KEYS.cappingLm],
          unit: "lm",
          quantity: timber.cappingLm,
          factKeys: keys,
          accessSensitive: true,
        })
      );
    }
    if (timber.gateIncluded) {
      requirements.push(
        fencePlanningLabour({
          workAreaId,
          componentKey: FENCE_GATE_LABOUR_COMPONENT,
          description: "Gate installation",
          trade: "fencing",
          productivityKey: FENCE_PRODUCTIVITY_KEYS.gateInstall,
          hoursPerUnit: FENCE_PRODUCTIVITY_STARTERS[FENCE_PRODUCTIVITY_KEYS.gateInstall],
          unit: "gate",
          quantity: timber.gateCount,
          factKeys: keys,
          accessSensitive: true,
        })
      );
    }
    requirements.push(
      fencePlanningLabour({
        workAreaId,
        componentKey: FENCE_CONCRETE_LABOUR_COMPONENT,
        description: "Post-hole concrete placement",
        trade: "fencing",
        productivityKey: FENCE_PRODUCTIVITY_KEYS.postHoleConcreteBag,
        hoursPerUnit:
          FENCE_PRODUCTIVITY_STARTERS[FENCE_PRODUCTIVITY_KEYS.postHoleConcreteBag],
        unit: "bag",
        quantity: timber.concrete.bagCount,
        factKeys: keys,
        accessSensitive: false,
      })
    );
  }

  if (isModularFenceSystem(system)) {
    modular = buildFenceModularTakeoff({
      geometry,
      system,
      metalMaterial: classifyFenceMetalMaterial(
        getStringFact(facts, workAreaId, "fence.metal_material") ??
          getStringFact(facts, workAreaId, "fence.material")
      ),
      sectionWidthM: getNumberFact(facts, workAreaId, "fence.section_width_m"),
      sectionHeightM: getNumberFact(facts, workAreaId, "fence.section_height_m"),
      sectionCountOverride: getNumberFact(facts, workAreaId, "fence.section_count"),
      embedmentM: getNumberFact(facts, workAreaId, "fence.post_embedment_m"),
      holeDiameterM: getNumberFact(facts, workAreaId, "fence.hole_diameter_m"),
    });
    assumptions.push(...modular.assumptions);
    attention.push(...modular.attention);

    const residualBit =
      modular.residualWidthM > 0
        ? `${modular.fullSectionCount} full + 1 cut/residual (${round2(modular.residualWidthM)} m)`
        : `${modular.purchasedSectionCount} full sections`;
    const concreteCopy = formatPostHoleBaggedConcreteCopy({
      bagCount: modular.concrete.bagCount,
      holeCount: modular.holeCount,
      unitCost: null,
      sloping: false,
      holeDiameterM: modular.holeDiameterM,
      grossHoleVolumeM3: modular.concrete.grossHoleVolumeM3,
      postDisplacementM3: modular.concrete.postDisplacementM3,
      netConcreteM3: modular.concrete.netConcreteM3,
      bagYieldM3: modular.concrete.bagYieldM3,
    });

    requirements.push(
      fencePlanningMaterial({
        workAreaId,
        componentKey: FENCE_SECTIONS_COMPONENT,
        description: "Fence sections",
        materialKey: modular.sectionProduct.itemKey,
        category: "SECTIONS",
        specification: `${residualBit} · ${modular.purchasedSectionCount} purchased EA · ${modular.sectionWidthM} m module`,
        baseQuantity: modular.purchasedSectionCount,
        baseUnit: "ea",
        wasteFactor: 0,
        purchaseQuantity: modular.purchasedSectionCount,
        purchaseUnit: "ea",
        factKeys: keys,
        source: "fence.modular.sections",
      })
    );
    requirements.push(
      fencePlanningMaterial({
        workAreaId,
        componentKey: FENCE_POSTS_EA_COMPONENT,
        description: "Fence posts",
        materialKey:
          system === "PLASTIC_MODULAR"
            ? "fence.plastic.post"
            : "fence.metal.post",
        identity: modular.postIdentity,
        category: "POSTS",
        specification: `${modular.postCount} EA · posts = sections + 1`,
        baseQuantity: modular.postCount,
        baseUnit: "ea",
        wasteFactor: 0,
        purchaseQuantity: modular.postCount,
        purchaseUnit: "ea",
        factKeys: keys,
        source: "fence.modular.posts",
      })
    );
    requirements.push(
      fencePlanningMaterial({
        workAreaId,
        componentKey: FENCE_CONCRETE_COMPONENT,
        description: "Post-hole concrete (bagged premix)",
        materialKey: FENCE_PREMIX_20KG_KEY,
        identity: FENCE_PREMIX_IDENTITY,
        category: "CONCRETE",
        specification: `${concreteCopy.supporting}. ${concreteCopy.secondary ?? ""}`.trim(),
        baseQuantity: modular.concrete.bagCount,
        baseUnit: "bag",
        wasteFactor: 0,
        purchaseQuantity: modular.concrete.bagCount,
        purchaseUnit: "bag",
        factKeys: keys,
        source: "fence.post_hole_concrete",
      })
    );
    requirements.push(
      fencePlanningMaterial({
        workAreaId,
        componentKey: FENCE_FIXINGS_MODULAR_COMPONENT,
        description: "Fixings/brackets",
        materialKey: FENCE_FIXINGS_MODULAR_KEY,
        category: "FIXINGS",
        specification:
          "Panel-to-post brackets/fixings if not included in the panel kit. Package owns money in 1A.",
        baseQuantity: 1,
        baseUnit: "allowance",
        wasteFactor: 0,
        purchaseQuantity: 1,
        purchaseUnit: "allowance",
        factKeys: keys,
        source: "fence.modular.fixings",
      })
    );
    requirements.push(
      fencePlanningLabour({
        workAreaId,
        componentKey: FENCE_POST_LABOUR_COMPONENT,
        description: "Post installation",
        trade: "fencing",
        productivityKey: FENCE_PRODUCTIVITY_KEYS.postInstall,
        hoursPerUnit: FENCE_PRODUCTIVITY_STARTERS[FENCE_PRODUCTIVITY_KEYS.postInstall],
        unit: "post",
        quantity: modular.postCount,
        factKeys: keys,
        accessSensitive: true,
      })
    );
    requirements.push(
      fencePlanningLabour({
        workAreaId,
        componentKey: FENCE_SECTION_LABOUR_COMPONENT,
        description: "Section installation",
        trade: "fencing",
        productivityKey: FENCE_PRODUCTIVITY_KEYS.sectionInstall,
        hoursPerUnit: FENCE_PRODUCTIVITY_STARTERS[FENCE_PRODUCTIVITY_KEYS.sectionInstall],
        unit: "section",
        quantity: modular.purchasedSectionCount,
        factKeys: keys,
        accessSensitive: true,
      })
    );
    requirements.push(
      fencePlanningLabour({
        workAreaId,
        componentKey: FENCE_CONCRETE_LABOUR_COMPONENT,
        description: "Post-hole concrete placement",
        trade: "fencing",
        productivityKey: FENCE_PRODUCTIVITY_KEYS.postHoleConcreteBag,
        hoursPerUnit:
          FENCE_PRODUCTIVITY_STARTERS[FENCE_PRODUCTIVITY_KEYS.postHoleConcreteBag],
        unit: "bag",
        quantity: modular.concrete.bagCount,
        factKeys: keys,
        accessSensitive: false,
      })
    );
  }

  const demolition = getBooleanFact(facts, workAreaId, "fence.demolition_required");
  if (demolition == null) {
    attention.push("Confirm existing-fence removal");
  }

  return {
    geometry,
    system,
    requirements,
    assumptions,
    attention,
    timber,
    modular,
  };
}

export type FenceCommercialCoverage = {
  category: string;
  owner:
    | "MATERIAL"
    | "LABOUR"
    | "ALLOWANCE"
    | "WASTE"
    | "PRICING_REQUIRED"
    | "NOT_APPLICABLE";
  authority1A: "PACKAGE" | "SHADOW" | "LEGACY";
};

export const FENCE_COMMERCIAL_COVERAGE_MAP: readonly FenceCommercialCoverage[] = [
  { category: "Fence posts", owner: "MATERIAL", authority1A: "SHADOW" },
  { category: "Gate posts", owner: "MATERIAL", authority1A: "SHADOW" },
  { category: "Fence boards/slats", owner: "MATERIAL", authority1A: "SHADOW" },
  { category: "Rails / framing", owner: "MATERIAL", authority1A: "SHADOW" },
  { category: "Top capping", owner: "MATERIAL", authority1A: "SHADOW" },
  { category: "Gate framing", owner: "MATERIAL", authority1A: "SHADOW" },
  { category: "Gate hardware", owner: "ALLOWANCE", authority1A: "LEGACY" },
  { category: "Post-hole concrete", owner: "MATERIAL", authority1A: "SHADOW" },
  { category: "Fixings", owner: "ALLOWANCE", authority1A: "SHADOW" },
  { category: "Fence sections", owner: "MATERIAL", authority1A: "SHADOW" },
  { category: "Post installation", owner: "LABOUR", authority1A: "SHADOW" },
  { category: "Fence framing labour", owner: "LABOUR", authority1A: "SHADOW" },
  { category: "Board/slat installation", owner: "LABOUR", authority1A: "SHADOW" },
  { category: "Section installation", owner: "LABOUR", authority1A: "SHADOW" },
  { category: "Top-cap installation", owner: "LABOUR", authority1A: "SHADOW" },
  { category: "Gate installation", owner: "LABOUR", authority1A: "LEGACY" },
  { category: "Post-hole concrete placement", owner: "LABOUR", authority1A: "SHADOW" },
  { category: "Package fence materials", owner: "MATERIAL", authority1A: "PACKAGE" },
  { category: "Package fence labour", owner: "LABOUR", authority1A: "PACKAGE" },
  { category: "Existing fence removal", owner: "LABOUR", authority1A: "LEGACY" },
  { category: "Fence disposal", owner: "WASTE", authority1A: "LEGACY" },
  { category: "Finish/stain/paint", owner: "NOT_APPLICABLE", authority1A: "SHADOW" },
  { category: "Corners / slope stepping", owner: "NOT_APPLICABLE", authority1A: "SHADOW" },
];

export const FENCE_COMMERCIAL_AUTHORITY_1A = "LEGACY_PACKAGE_AUTHORITY" as const;
