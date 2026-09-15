/**
 * CEILINGS WA-04A–D — physical calculation kernel.
 *
 * Geometry, framing, lining, tile & grid, bulkheads, insulation, and
 * residual fixings bases. No dollars. Hosted nested estimate consumes
 * this via commercializeCeilings in calculateCeilings. Legacy flat
 * Ceiling projects never enter this kernel.
 *
 * Per-Portion, per-Work-Area. No same-product collapse. No labour hours.
 * Lining/tile wastage is applied once via resolveMaterialWastage.
 * Framing purchase still equals installed; framing wastage remains unresolved.
 */

import { buildMaterialRequirement } from "@/lib/estimate/material-requirement";
import { round2 } from "@/lib/estimate/facts";
import type { MaterialRequirement } from "@/lib/estimate/requirements";
import type { EstimateFact, EstimateWorkArea } from "@/lib/estimate/types";
import type { MaterialIdentity } from "@/lib/materials/identity";
import {
  hasCanonicalCeilingsPortions,
  resolveCeilingsPortions,
  type CeilingPortion,
} from "@/lib/estimate/ceilings-portions";
import {
  deriveCeilingGeometry,
  type CeilingGeometryTakeoff,
} from "@/lib/estimate/ceilings-geometry";
import {
  calculateCeilingTimberFraming,
  CEILINGS_TIMBER_FRAMING_COMPONENT,
  type CeilingTimberFramingTakeoff,
} from "@/lib/estimate/ceilings-framing";
import {
  calculateCeilingLining,
  CEILING_GRID_IDENTITY,
  CEILING_GRID_M2_KEY,
  CEILINGS_PLASTERBOARD_COMPONENT,
  CEILINGS_PLYWOOD_COMPONENT,
  CEILINGS_TILE_GRID_GRID_COMPONENT,
  CEILINGS_TILE_GRID_TILE_COMPONENT,
  CEILINGS_TIMBER_LINING_COMPONENT,
  tileAndGridFamiliesDisagree,
  type CeilingLiningTakeoff,
} from "@/lib/estimate/ceilings-lining";
import type { MaterialWastageSettings } from "@/lib/settings/material-wastage";
import {
  calculateCeilingSteelFraming,
  calculateCeilingSuspendedFraming,
  CEILINGS_STEEL_CLIP_COMPONENT,
  CEILINGS_STEEL_FURRING_COMPONENT,
  CEILINGS_STEEL_PERIMETER_COMPONENT,
  CEILINGS_STEEL_PRIMARY_COMPONENT,
  CEILINGS_SUSPENSION_DROPPER_COMPONENT,
  CEILINGS_SUSPENSION_WIRE_COMPONENT,
  STEEL_CEILING_CLIP_IDENTITY,
  STEEL_CEILING_CROSSOVER_CLIP_KEY,
  STEEL_CEILING_DROPPER_IDENTITY,
  STEEL_CEILING_DROPPER_KEY,
  STEEL_CEILING_FURRING_CHANNEL_KEY,
  STEEL_CEILING_FURRING_IDENTITY,
  STEEL_CEILING_PERIMETER_IDENTITY,
  STEEL_CEILING_PERIMETER_TRACK_KEY,
  STEEL_CEILING_PRIMARY_CHANNEL_KEY,
  STEEL_CEILING_PRIMARY_IDENTITY,
  STEEL_CEILING_SUSPENSION_WIRE_KEY,
  STEEL_CEILING_WIRE_IDENTITY,
  type CeilingSteelFrameTakeoff,
  type CeilingSuspendedTakeoff,
} from "@/lib/estimate/ceilings-steel";
import {
  calculateCeilingBulkheads,
  CEILING_BULKHEAD_STEEL_FRAMING_IDENTITY,
  CEILINGS_BULKHEAD_END_CAPS_EXCLUDED,
  CEILINGS_BULKHEAD_FRAMING_STEEL_COMPONENT,
  CEILINGS_BULKHEAD_FRAMING_TIMBER_COMPONENT,
  CEILINGS_BULKHEAD_LINING_COMPONENT,
  CEILINGS_BULKHEAD_LONGITUDINAL_ASSUMPTION,
  CEILINGS_BULKHEAD_NOG_SPACING_ASSUMPTION,
  CEILINGS_BULKHEAD_TIMBER_SIZE_ASSUMPTION,
  type CeilingBulkheadTakeoff,
} from "@/lib/estimate/ceilings-bulkheads";
import {
  calculateCeilingInsulation,
  CEILINGS_INSULATION_COMPONENT,
  CEILINGS_INSULATION_WASTAGE_UNRESOLVED,
  type CeilingInsulationTakeoff,
} from "@/lib/estimate/ceilings-insulation";
import { ceilingFixingsRequirements } from "@/lib/estimate/ceilings-fixings";
import { ceilingInsulationSpecification } from "@/lib/estimate/insulation-fallback";
import {
  ceilingPortionHasUnsupportedBulkhead,
  ceilingPortionSpecialistKind,
} from "@/lib/estimate/ceilings-specialist";
import type { CeilingSpecialistKind } from "@/lib/estimate/ceilings-portions";
import {
  CEILINGS_PAINTING_COMPONENT,
  CEILINGS_PAINTING_MATERIAL_KEY,
  CEILINGS_STOPPING_COMPONENT,
  CEILINGS_STOPPING_LEVEL_ASSUMPTION,
  CEILINGS_STOPPING_MATERIAL_KEY,
} from "@/lib/estimate/ceilings-identities";

export const CEILING_PHYSICAL_COMPLETENESS = {
  COMPLETE_PHYSICAL: "COMPLETE_PHYSICAL",
  INFORMATION_REQUIRED: "INFORMATION_REQUIRED",
  UNSUPPORTED_SPECIALIST: "UNSUPPORTED_SPECIALIST",
} as const;

export type CeilingPhysicalCompleteness =
  (typeof CEILING_PHYSICAL_COMPLETENESS)[keyof typeof CEILING_PHYSICAL_COMPLETENESS];

export type CeilingPhysicalSource = "canonical" | "legacy_skipped" | "empty";

export type CeilingPortionPhysical = {
  readonly workAreaId: string;
  readonly nestedItemId: string;
  readonly geometry: CeilingGeometryTakeoff;
  readonly timber: CeilingTimberFramingTakeoff;
  readonly steel: CeilingSteelFrameTakeoff;
  readonly suspended: CeilingSuspendedTakeoff;
  readonly lining: CeilingLiningTakeoff;
  readonly bulkheads: readonly CeilingBulkheadTakeoff[];
  readonly insulation: CeilingInsulationTakeoff;
  readonly completeness: CeilingPhysicalCompleteness;
  readonly specialistKind: CeilingSpecialistKind | null;
};

export type CeilingPhysicalResult = {
  readonly workAreaId: string;
  readonly source: CeilingPhysicalSource;
  readonly completeness: CeilingPhysicalCompleteness | "empty";
  readonly portions: readonly CeilingPortionPhysical[];
  readonly requirements: readonly MaterialRequirement[];
  readonly missingInfo: readonly string[];
};

function timberAssumptions(timber: CeilingTimberFramingTakeoff) {
  const text: Array<{ key: string; text: string; source: "calculator_default" }> =
    [];
  if (timber.runDimension_m != null) {
    text.push({
      key: "run_length_m",
      text: `${timber.runDimension_m} m run length`,
      source: "calculator_default",
    });
  }
  if (timber.crossDimension_m != null) {
    text.push({
      key: "cross_dimension_m",
      text: `${timber.crossDimension_m} m cross dimension`,
      source: "calculator_default",
    });
  }
  if (timber.spacing_mm != null) {
    text.push({
      key: "spacing_mm",
      text: `${timber.spacing_mm} mm centres`,
      source: "calculator_default",
    });
  }
  if (timber.direction) {
    text.push({
      key: "direction",
      text:
        timber.direction === "along_length"
          ? "Direction along length"
          : "Direction along width",
      source: "calculator_default",
    });
  }
  return text;
}

function steelFrameAssumptions(frame: CeilingSteelFrameTakeoff) {
  const text: Array<{ key: string; text: string; source: "calculator_default" }> =
    [];
  if (frame.primaryDirection) {
    text.push({
      key: "primary_direction",
      text:
        frame.primaryDirection === "along_length"
          ? "Primary channels along length"
          : "Primary channels along width",
      source: "calculator_default",
    });
  }
  if (frame.primarySpacingMm != null) {
    text.push({
      key: "primary_spacing_mm",
      text: `${frame.primarySpacingMm} mm primary centres`,
      source: "calculator_default",
    });
  }
  if (frame.furringSpacingMm != null) {
    text.push({
      key: "furring_spacing_mm",
      text: `${frame.furringSpacingMm} mm furring centres`,
      source: "calculator_default",
    });
  }
  if (frame.primaryRuns != null) {
    text.push({
      key: "primary_runs",
      text: `${frame.primaryRuns} primary runs`,
      source: "calculator_default",
    });
  }
  if (frame.furringRuns != null) {
    text.push({
      key: "furring_runs",
      text: `${frame.furringRuns} furring runs`,
      source: "calculator_default",
    });
  }
  return text;
}

function suspendedAssumptions(suspended: CeilingSuspendedTakeoff) {
  const text = steelFrameAssumptions(suspended.frame);
  if (suspended.dropHeightM != null) {
    text.push({
      key: "drop_height_m",
      text: `${suspended.dropHeightM} m drop height`,
      source: "calculator_default",
    });
  }
  if (suspended.lengthSupport?.actualSpacing != null) {
    text.push({
      key: "actual_support_spacing_length_m",
      text: `${suspended.lengthSupport.actualSpacing} m actual length-direction support spacing (diagnostic)`,
      source: "calculator_default",
    });
  }
  if (suspended.widthSupport?.actualSpacing != null) {
    text.push({
      key: "actual_support_spacing_width_m",
      text: `${suspended.widthSupport.actualSpacing} m actual width-direction support spacing (diagnostic)`,
      source: "calculator_default",
    });
  }
  return text;
}

function timberMaterialRequirement(params: {
  workArea: Pick<EstimateWorkArea, "id" | "type" | "name">;
  portion: CeilingPortion;
  timber: CeilingTimberFramingTakeoff;
}): MaterialRequirement | null {
  const { timber, workArea, portion } = params;
  if (timber.status !== "ok" || timber.installedFramingLM == null) {
    return null;
  }
  const installed = timber.installedFramingLM;
  return buildMaterialRequirement({
    workAreaId: workArea.id,
    workAreaType: workArea.type || "ceilings",
    componentKey: CEILINGS_TIMBER_FRAMING_COMPONENT,
    variantKey: portion.id,
    description: `${portion.label?.trim() || "Ceiling portion"} — timber framing`,
    confidence: timber.product.kind === "canonical" ? "high" : "low",
    assumptions: timberAssumptions(timber),
    provenance: {
      calculatorSource: "ceilings-physical",
      factKeys: [
        "ceilings.portions",
        "ceilings.portion.length_m",
        "ceilings.portion.width_m",
        "ceilings.portion.spacing_mm",
        "ceilings.portion.direction",
        "ceilings.portion.timber_size",
      ],
      constraintKeys: [],
    },
    priced: false,
    materialKey: timber.product.materialKey,
    materialIdentity: timber.product.materialIdentity ?? undefined,
    category: "FRAMING",
    specification: timber.product.specification,
    baseQuantity: installed,
    baseUnit: "lm",
    wasteFactor: 0,
    purchaseQuantity: installed,
    purchaseUnit: "lm",
    rateSource: "missing",
    unitCost: null,
    totalCost: null,
  });
}

function steelMaterialRequirement(params: {
  workArea: Pick<EstimateWorkArea, "id" | "type" | "name">;
  portion: CeilingPortion;
  componentKey: string;
  materialKey: string;
  materialIdentity: MaterialIdentity;
  description: string;
  specification: string;
  quantity: number;
  unit: "lm" | "each";
  assumptions: ReturnType<typeof steelFrameAssumptions>;
  factKeys: readonly string[];
}): MaterialRequirement {
  return buildMaterialRequirement({
    workAreaId: params.workArea.id,
    workAreaType: params.workArea.type || "ceilings",
    componentKey: params.componentKey,
    variantKey: params.portion.id,
    description: `${params.portion.label?.trim() || "Ceiling portion"} — ${params.description}`,
    confidence: "high",
    assumptions: params.assumptions,
    provenance: {
      calculatorSource: "ceilings-physical",
      factKeys: [...params.factKeys],
      constraintKeys: [],
    },
    priced: false,
    materialKey: params.materialKey,
    materialIdentity: params.materialIdentity,
    category: "FRAMING",
    specification: params.specification,
    baseQuantity: params.quantity,
    baseUnit: params.unit,
    wasteFactor: 0,
    purchaseQuantity: params.quantity,
    purchaseUnit: params.unit,
    rateSource: "missing",
    unitCost: null,
    totalCost: null,
  });
}

const STEEL_FRAME_FACT_KEYS = [
  "ceilings.portions",
  "ceilings.portion.length_m",
  "ceilings.portion.width_m",
  "ceilings.portion.primary_spacing_mm",
  "ceilings.portion.furring_spacing_mm",
  "ceilings.portion.direction",
] as const;

const SUSPENDED_FACT_KEYS = [
  ...STEEL_FRAME_FACT_KEYS,
  "ceilings.portion.drop_height_m",
  "ceilings.portion.suspension_spacing_m",
  "ceilings.portion.edge_offset_m",
] as const;

function steelFrameRequirements(params: {
  workArea: Pick<EstimateWorkArea, "id" | "type" | "name">;
  portion: CeilingPortion;
  frame: CeilingSteelFrameTakeoff;
}): MaterialRequirement[] {
  const { frame } = params;
  if (
    frame.status !== "ok" ||
    frame.perimeterLm == null ||
    frame.primaryLm == null ||
    frame.furringLm == null ||
    frame.clipCount == null
  ) {
    return [];
  }
  const assumptions = steelFrameAssumptions(frame);
  const shared = {
    workArea: params.workArea,
    portion: params.portion,
    assumptions,
    factKeys: STEEL_FRAME_FACT_KEYS,
  };
  return [
    steelMaterialRequirement({
      ...shared,
      componentKey: CEILINGS_STEEL_PERIMETER_COMPONENT,
      materialKey: STEEL_CEILING_PERIMETER_TRACK_KEY,
      materialIdentity: STEEL_CEILING_PERIMETER_IDENTITY,
      description: "perimeter track / angle",
      specification: "Ceiling perimeter track / angle",
      quantity: frame.perimeterLm,
      unit: "lm",
    }),
    steelMaterialRequirement({
      ...shared,
      componentKey: CEILINGS_STEEL_PRIMARY_COMPONENT,
      materialKey: STEEL_CEILING_PRIMARY_CHANNEL_KEY,
      materialIdentity: STEEL_CEILING_PRIMARY_IDENTITY,
      description: "primary channel",
      specification: "Ceiling primary channel",
      quantity: frame.primaryLm,
      unit: "lm",
    }),
    steelMaterialRequirement({
      ...shared,
      componentKey: CEILINGS_STEEL_FURRING_COMPONENT,
      materialKey: STEEL_CEILING_FURRING_CHANNEL_KEY,
      materialIdentity: STEEL_CEILING_FURRING_IDENTITY,
      description: "furring channel",
      specification: "Ceiling furring channel",
      quantity: frame.furringLm,
      unit: "lm",
    }),
    steelMaterialRequirement({
      ...shared,
      componentKey: CEILINGS_STEEL_CLIP_COMPONENT,
      materialKey: STEEL_CEILING_CROSSOVER_CLIP_KEY,
      materialIdentity: STEEL_CEILING_CLIP_IDENTITY,
      description: "crossover / suspension clip",
      specification: "Ceiling crossover / suspension clip",
      quantity: frame.clipCount,
      unit: "each",
    }),
  ];
}

function suspendedRequirements(params: {
  workArea: Pick<EstimateWorkArea, "id" | "type" | "name">;
  portion: CeilingPortion;
  suspended: CeilingSuspendedTakeoff;
}): MaterialRequirement[] {
  const { suspended } = params;
  if (
    suspended.status !== "ok" ||
    suspended.dropperCount == null ||
    suspended.wireLm == null
  ) {
    return [];
  }
  const frameRows = steelFrameRequirements({
    workArea: params.workArea,
    portion: params.portion,
    frame: suspended.frame,
  }).map((row) => ({
    ...row,
    provenance: {
      ...row.provenance,
      factKeys: [...SUSPENDED_FACT_KEYS],
    },
    assumptions: suspendedAssumptions(suspended),
  }));
  const assumptions = suspendedAssumptions(suspended);
  const shared = {
    workArea: params.workArea,
    portion: params.portion,
    assumptions,
    factKeys: SUSPENDED_FACT_KEYS,
  };
  return [
    ...frameRows,
    steelMaterialRequirement({
      ...shared,
      componentKey: CEILINGS_SUSPENSION_DROPPER_COMPONENT,
      materialKey: STEEL_CEILING_DROPPER_KEY,
      materialIdentity: STEEL_CEILING_DROPPER_IDENTITY,
      description: "suspension dropper",
      specification: "Ceiling suspension dropper",
      quantity: suspended.dropperCount,
      unit: "each",
    }),
    steelMaterialRequirement({
      ...shared,
      componentKey: CEILINGS_SUSPENSION_WIRE_COMPONENT,
      materialKey: STEEL_CEILING_SUSPENSION_WIRE_KEY,
      materialIdentity: STEEL_CEILING_WIRE_IDENTITY,
      description: "suspension wire",
      specification: "Ceiling suspension wire",
      quantity: suspended.wireLm,
      unit: "lm",
    }),
  ];
}

function liningAssumptions(lining: CeilingLiningTakeoff) {
  const text: Array<{ key: string; text: string; source: "calculator_default" }> =
    [];
  if (lining.layerAssumption) {
    text.push({
      key: "layers",
      text: lining.layerAssumption,
      source: "calculator_default",
    });
  }
  if (lining.sheetSizeAssumption) {
    text.push({
      key: "sheet_size_assumption",
      text: lining.sheetSizeAssumption,
      source: "calculator_default",
    });
  }
  if (lining.areaM2 != null) {
    text.push({
      key: "area_m2",
      text: `${lining.areaM2} m² ceiling area`,
      source: "calculator_default",
    });
  }
  if (
    lining.sheetLengthM != null &&
    lining.sheetWidthM != null &&
    !lining.sheetSizeAssumption
  ) {
    text.push({
      key: "sheet_size_m",
      text: `${lining.sheetLengthM} × ${lining.sheetWidthM} m sheets`,
      source: "calculator_default",
    });
  }
  if (lining.installedSheets != null) {
    text.push({
      key: "installed_sheets",
      text: `${lining.installedSheets} installed sheets`,
      source: "calculator_default",
    });
  }
  if (lining.purchaseSheets != null) {
    text.push({
      key: "purchase_sheets",
      text: `${lining.purchaseSheets} purchase sheets`,
      source: "calculator_default",
    });
  }
  if (lining.wasteFactor != null) {
    text.push({
      key: "waste_factor",
      text: `${Math.round(lining.wasteFactor * 1000) / 10}% waste (once)`,
      source: "calculator_default",
    });
  }
  if (lining.direction) {
    text.push({
      key: "direction",
      text:
        lining.direction === "along_length"
          ? "Boards along length"
          : "Boards along width",
      source: "calculator_default",
    });
  }
  if (lining.boardCoverWidthM != null) {
    text.push({
      key: "board_cover_width_m",
      text: `${lining.boardCoverWidthM} m board cover width`,
      source: "calculator_default",
    });
  }
  if (lining.gapM != null) {
    text.push({
      key: "gap_m",
      text: `${lining.gapM} m inter-board gap`,
      source: "calculator_default",
    });
  }
  if (lining.edgeGapConvention) {
    text.push({
      key: "edge_gap_convention",
      text: lining.edgeGapConvention,
      source: "calculator_default",
    });
  }
  if (lining.numberOfRuns != null) {
    text.push({
      key: "lining_runs",
      text: `${lining.numberOfRuns} lining runs`,
      source: "calculator_default",
    });
  }
  if (lining.tileSize) {
    text.push({
      key: "tile_size",
      text: `${lining.tileSize} tiles`,
      source: "calculator_default",
    });
  }
  if (lining.installedTiles != null) {
    text.push({
      key: "installed_tiles",
      text: `${lining.installedTiles} installed tiles`,
      source: "calculator_default",
    });
  }
  return text;
}

const LINING_FACT_KEYS = [
  "ceilings.portions",
  "ceilings.portion.length_m",
  "ceilings.portion.width_m",
  "ceilings.portion.area_m2",
  "ceilings.portion.lining_family",
  "ceilings.portion.plasterboard_product",
  "ceilings.portion.thickness_mm",
  "ceilings.portion.sheet_length_mm",
  "ceilings.portion.sheet_width_mm",
  "ceilings.portion.layers",
] as const;

function liningMaterialRequirement(params: {
  workArea: Pick<EstimateWorkArea, "id" | "type" | "name">;
  portion: CeilingPortion;
  lining: CeilingLiningTakeoff;
}): MaterialRequirement[] {
  const { lining, workArea, portion } = params;
  if (lining.status !== "ok") return [];
  const assumptions = liningAssumptions(lining);
  const shared = {
    workAreaId: workArea.id,
    workAreaType: workArea.type || "ceilings",
    variantKey: portion.id,
    confidence:
      lining.product.kind === "canonical" ? ("high" as const) : ("low" as const),
    assumptions,
    provenance: {
      calculatorSource: "ceilings-physical",
      factKeys: [...LINING_FACT_KEYS],
      constraintKeys: [],
    },
    priced: false,
    rateSource: "missing" as const,
    unitCost: null,
    totalCost: null,
  };
  const label = portion.label?.trim() || "Ceiling portion";

  if (lining.family === "plasterboard" && lining.installedSheets != null) {
    return [
      buildMaterialRequirement({
        ...shared,
        componentKey: CEILINGS_PLASTERBOARD_COMPONENT,
        description: `${label} — plasterboard lining`,
        materialKey: lining.product.materialKey,
        materialIdentity: lining.product.materialIdentity ?? undefined,
        category: "LINING",
        specification: lining.product.specification,
        baseQuantity: lining.installedSheets,
        baseUnit: "each",
        wasteFactor: lining.wasteFactor ?? 0,
        purchaseQuantity: lining.purchaseSheets ?? lining.installedSheets,
        purchaseUnit: "each",
      }),
    ];
  }
  if (lining.family === "plywood" && lining.installedSheets != null) {
    return [
      buildMaterialRequirement({
        ...shared,
        componentKey: CEILINGS_PLYWOOD_COMPONENT,
        description: `${label} — plywood lining`,
        materialKey: lining.product.materialKey,
        materialIdentity: lining.product.materialIdentity ?? undefined,
        category: "LINING",
        specification: lining.product.specification,
        baseQuantity: lining.installedSheets,
        baseUnit: "each",
        wasteFactor: lining.wasteFactor ?? 0,
        purchaseQuantity: lining.purchaseSheets ?? lining.installedSheets,
        purchaseUnit: "each",
      }),
    ];
  }
  if (lining.family === "timber_lined" && lining.installedLm != null) {
    return [
      buildMaterialRequirement({
        ...shared,
        componentKey: CEILINGS_TIMBER_LINING_COMPONENT,
        description: `${label} — timber lining`,
        materialKey: lining.product.materialKey,
        materialIdentity: lining.product.materialIdentity ?? undefined,
        category: "LINING",
        specification: lining.product.specification,
        baseQuantity: lining.installedLm,
        baseUnit: "lm",
        wasteFactor: lining.wasteFactor ?? 0,
        purchaseQuantity: lining.purchaseLm ?? lining.installedLm,
        purchaseUnit: "lm",
      }),
    ];
  }
  if (lining.family === "tile_and_grid" && lining.gridAreaM2 != null) {
    const rows: MaterialRequirement[] = [
      buildMaterialRequirement({
        ...shared,
        componentKey: CEILINGS_TILE_GRID_GRID_COMPONENT,
        description: `${label} — T-grid`,
        materialKey: CEILING_GRID_M2_KEY,
        materialIdentity: CEILING_GRID_IDENTITY,
        category: "LINING",
        specification: "Ceiling T-grid system",
        baseQuantity: lining.gridAreaM2,
        baseUnit: "m2",
        wasteFactor: 0,
        purchaseQuantity: lining.gridAreaM2,
        purchaseUnit: "m2",
      }),
    ];
    if (lining.installedTiles != null) {
      rows.push(
        buildMaterialRequirement({
          ...shared,
          componentKey: CEILINGS_TILE_GRID_TILE_COMPONENT,
          description: `${label} — ceiling tiles`,
          materialKey: lining.product.materialKey,
          materialIdentity: lining.product.materialIdentity ?? undefined,
          category: "LINING",
          specification: lining.product.specification,
          baseQuantity: lining.installedTiles,
          baseUnit: "each",
          wasteFactor: lining.wasteFactor ?? 0,
          purchaseQuantity: lining.purchaseTiles ?? lining.installedTiles,
          purchaseUnit: "each",
        })
      );
    }
    return rows;
  }
  return [];
}

function bulkheadAssumptions(bulkhead: CeilingBulkheadTakeoff) {
  const text: Array<{ key: string; text: string; source: "calculator_default" }> =
    [];
  if (bulkhead.topologyAssumption) {
    text.push({
      key: "topology",
      text: bulkhead.topologyAssumption,
      source: "calculator_default",
    });
  }
  text.push({
    key: "longitudinal_members",
    text: CEILINGS_BULKHEAD_LONGITUDINAL_ASSUMPTION,
    source: "calculator_default",
  });
  text.push({
    key: "nog_spacing",
    text: CEILINGS_BULKHEAD_NOG_SPACING_ASSUMPTION,
    source: "calculator_default",
  });
  if (bulkhead.framingType === "timber") {
    text.push({
      key: "timber_size",
      text: CEILINGS_BULKHEAD_TIMBER_SIZE_ASSUMPTION,
      source: "calculator_default",
    });
  }
  if (bulkhead.layerAssumption) {
    text.push({
      key: "layers",
      text: bulkhead.layerAssumption,
      source: "calculator_default",
    });
  }
  if (bulkhead.sheetSizeAssumption) {
    text.push({
      key: "sheet_size",
      text: bulkhead.sheetSizeAssumption,
      source: "calculator_default",
    });
  }
  text.push({
    key: "end_caps",
    text: CEILINGS_BULKHEAD_END_CAPS_EXCLUDED,
    source: "calculator_default",
  });
  return text;
}

function bulkheadMaterialRequirements(params: {
  workArea: Pick<EstimateWorkArea, "id" | "type" | "name">;
  portion: CeilingPortion;
  bulkhead: CeilingBulkheadTakeoff;
}): MaterialRequirement[] {
  const { bulkhead, workArea, portion } = params;
  if (bulkhead.status !== "ok" || bulkhead.framingLm == null) return [];
  const variantKey = `${portion.id}::${bulkhead.componentId}`;
  const assumptions = bulkheadAssumptions(bulkhead);
  const shared = {
    workAreaId: workArea.id,
    workAreaType: workArea.type || "ceilings",
    variantKey,
    confidence: "high" as const,
    assumptions,
    provenance: {
      calculatorSource: "ceilings-physical",
      factKeys: [
        "ceilings.portions",
        "ceilings.bulkhead.length_m",
        "ceilings.bulkhead.depth_m",
        "ceilings.bulkhead.height_m",
        "ceilings.bulkhead.framing_type",
        "ceilings.bulkhead.lining_type",
        "ceilings.bulkhead.thickness_mm",
      ],
      constraintKeys: [],
    },
    priced: false as const,
    rateSource: "missing" as const,
    unitCost: null,
    totalCost: null,
  };
  const name = portion.label?.trim() || "Ceiling portion";
  const rows: MaterialRequirement[] = [
    buildMaterialRequirement({
      ...shared,
      componentKey:
        bulkhead.framingType === "steel"
          ? CEILINGS_BULKHEAD_FRAMING_STEEL_COMPONENT
          : CEILINGS_BULKHEAD_FRAMING_TIMBER_COMPONENT,
      description: `${name} — bulkhead framing`,
      materialKey: bulkhead.framingMaterialKey,
      materialIdentity:
        bulkhead.framingType === "steel"
          ? CEILING_BULKHEAD_STEEL_FRAMING_IDENTITY
          : undefined,
      category: "FRAMING",
      specification: `${bulkhead.framingLm} lm bulkhead framing`,
      baseQuantity: bulkhead.framingLm,
      baseUnit: "lm",
      wasteFactor: 0,
      purchaseQuantity: bulkhead.framingLm,
      purchaseUnit: "lm",
    }),
  ];
  if (bulkhead.installedSheets != null) {
    rows.push(
      buildMaterialRequirement({
        ...shared,
        componentKey: CEILINGS_BULKHEAD_LINING_COMPONENT,
        description: `${name} — bulkhead lining`,
        materialKey: bulkhead.liningMaterialKey,
        category: "LINING",
        specification: bulkhead.liningSpecification ?? "Bulkhead lining",
        baseQuantity: bulkhead.installedSheets,
        baseUnit: "each",
        wasteFactor: bulkhead.wasteFactor ?? 0,
        purchaseQuantity: bulkhead.purchaseSheets ?? bulkhead.installedSheets,
        purchaseUnit: "each",
      })
    );
  }
  return rows;
}

function insulationMaterialRequirement(params: {
  workArea: Pick<EstimateWorkArea, "id" | "type" | "name">;
  portion: CeilingPortion;
  insulation: CeilingInsulationTakeoff;
}): MaterialRequirement | null {
  const { insulation, workArea, portion } = params;
  if (insulation.status !== "ok" || insulation.installedM2 == null) return null;
  return buildMaterialRequirement({
    workAreaId: workArea.id,
    workAreaType: workArea.type || "ceilings",
    componentKey: CEILINGS_INSULATION_COMPONENT,
    variantKey: portion.id,
    description: `${portion.label?.trim() || "Ceiling portion"} — insulation`,
    confidence: insulation.materialKey ? "medium" : "low",
    assumptions: [
      {
        key: "wastage",
        text: CEILINGS_INSULATION_WASTAGE_UNRESOLVED,
        source: "calculator_default",
      },
    ],
    provenance: {
      calculatorSource: "ceilings-physical",
      factKeys: [
        "ceilings.portions",
        "ceilings.portion.insulation_included",
        "ceilings.portion.insulation_type",
        "ceilings.portion.area_m2",
      ],
      constraintKeys: [],
    },
    priced: false,
    materialKey: insulation.materialKey,
    materialIdentity: insulation.materialIdentity ?? undefined,
    category: "INSULATION",
    specification: insulation.specText
      ? ceilingInsulationSpecification(insulation.specText)
      : "Ceiling insulation",
    baseQuantity: insulation.installedM2,
    baseUnit: "m2",
    wasteFactor: 0,
    purchaseQuantity: insulation.purchaseM2 ?? insulation.installedM2,
    purchaseUnit: "m2",
    rateSource: "missing",
    unitCost: null,
    totalCost: null,
  });
}

function plasterboardFinishAreaM2(params: {
  portion: CeilingPortion;
  lining: CeilingLiningTakeoff;
  bulkheads: readonly CeilingBulkheadTakeoff[];
}): number | null {
  let area = 0;
  if (params.portion.lining.family === "plasterboard") {
    if (params.lining.status === "ok" && params.lining.areaM2 != null) {
      area += params.lining.areaM2;
    } else if (
      params.portion.geometry.area_m2 != null &&
      params.portion.geometry.area_m2 > 0
    ) {
      area += params.portion.geometry.area_m2;
    }
  }
  for (const bulkhead of params.bulkheads) {
    if (bulkhead.status === "unsupported_specialist") continue;
    if (bulkhead.liningAreaM2 != null && bulkhead.liningAreaM2 > 0) {
      area += bulkhead.liningAreaM2;
      continue;
    }
    if (
      bulkhead.lengthM != null &&
      bulkhead.depthM != null &&
      bulkhead.heightM != null
    ) {
      area += bulkhead.lengthM * (bulkhead.depthM + bulkhead.heightM);
    }
  }
  return area > 0 ? round2(area) : null;
}

function ceilingFinishRequirements(params: {
  workArea: Pick<EstimateWorkArea, "id" | "type" | "name">;
  portion: CeilingPortion;
  lining: CeilingLiningTakeoff;
  bulkheads: readonly CeilingBulkheadTakeoff[];
}): MaterialRequirement[] {
  const areaM2 = plasterboardFinishAreaM2(params);
  if (areaM2 == null) return [];
  const name = params.portion.label?.trim() || "Ceiling portion";
  const shared = {
    workAreaId: params.workArea.id,
    workAreaType: params.workArea.type || "ceilings",
    variantKey: params.portion.id,
    confidence: "medium" as const,
    provenance: {
      calculatorSource: "ceilings-physical",
      factKeys: [
        "ceilings.portions",
        "ceilings.portion.stopping_included",
        "ceilings.portion.painting_included",
      ],
      constraintKeys: [] as string[],
    },
    priced: false as const,
    rateSource: "missing" as const,
    unitCost: null,
    totalCost: null,
    baseQuantity: areaM2,
    baseUnit: "m2" as const,
    wasteFactor: 0,
    purchaseQuantity: areaM2,
    purchaseUnit: "m2" as const,
  };
  const rows: MaterialRequirement[] = [];
  if (params.portion.finish.stopping_included === true) {
    rows.push(
      buildMaterialRequirement({
        ...shared,
        componentKey: CEILINGS_STOPPING_COMPONENT,
        description: `${name} — stopping / plastering`,
        assumptions: [
          {
            key: "stopping_level",
            text: CEILINGS_STOPPING_LEVEL_ASSUMPTION,
            source: "calculator_default",
          },
        ],
        materialKey: CEILINGS_STOPPING_MATERIAL_KEY,
        category: "FINISHING",
        specification: `${areaM2} m² plasterboard lining (Level 4 stopping)`,
      })
    );
  }
  if (params.portion.finish.painting_included === true) {
    rows.push(
      buildMaterialRequirement({
        ...shared,
        componentKey: CEILINGS_PAINTING_COMPONENT,
        description: `${name} — Painting materials`,
        assumptions: [],
        materialKey: CEILINGS_PAINTING_MATERIAL_KEY,
        category: "FINISHING",
        specification: `${areaM2} m² plasterboard lining (paint materials)`,
      })
    );
  }
  return rows;
}

function includedStatusIncomplete(
  status: string,
  included: boolean
): boolean {
  if (!included) return false;
  return status === "information_required" || status === "invalid";
}

function rollupPortionCompleteness(params: {
  specialistKind: CeilingSpecialistKind | null;
  unsupportedBulkhead: boolean;
  missingBulkheads: boolean;
  geometry: CeilingGeometryTakeoff;
  timber: CeilingTimberFramingTakeoff;
  steel: CeilingSteelFrameTakeoff;
  suspended: CeilingSuspendedTakeoff;
  lining: CeilingLiningTakeoff;
  bulkheads: readonly CeilingBulkheadTakeoff[];
  insulation: CeilingInsulationTakeoff;
  skipOrdinary: boolean;
}): CeilingPhysicalCompleteness {
  if (params.specialistKind || params.unsupportedBulkhead) {
    return CEILING_PHYSICAL_COMPLETENESS.UNSUPPORTED_SPECIALIST;
  }
  if (params.missingBulkheads) {
    return CEILING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED;
  }
  if (
    includedStatusIncomplete(params.geometry.status, true) ||
    includedStatusIncomplete(
      params.timber.status,
      params.timber.status !== "not_applicable"
    ) ||
    includedStatusIncomplete(
      params.steel.status,
      params.steel.status !== "not_applicable"
    ) ||
    includedStatusIncomplete(
      params.suspended.status,
      params.suspended.status !== "not_applicable"
    ) ||
    includedStatusIncomplete(
      params.lining.status,
      !params.skipOrdinary && params.lining.status !== "not_applicable"
    ) ||
    params.bulkheads.some(
      (row) =>
        row.status === "information_required" || row.status === "invalid"
    ) ||
    includedStatusIncomplete(
      params.insulation.status,
      params.insulation.status !== "not_applicable"
    )
  ) {
    return CEILING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED;
  }
  return CEILING_PHYSICAL_COMPLETENESS.COMPLETE_PHYSICAL;
}

export function rollupCeilingsPhysicalCompleteness(
  portions: readonly CeilingPortionPhysical[]
): CeilingPhysicalCompleteness | "empty" {
  if (portions.length === 0) return "empty";
  if (
    portions.some(
      (row) =>
        row.completeness === CEILING_PHYSICAL_COMPLETENESS.UNSUPPORTED_SPECIALIST
    )
  ) {
    return CEILING_PHYSICAL_COMPLETENESS.UNSUPPORTED_SPECIALIST;
  }
  if (
    portions.some(
      (row) =>
        row.completeness === CEILING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED
    )
  ) {
    return CEILING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED;
  }
  return CEILING_PHYSICAL_COMPLETENESS.COMPLETE_PHYSICAL;
}

export function calculatePortionCeilingsPhysical(params: {
  workArea: Pick<EstimateWorkArea, "id" | "type" | "name">;
  portion: CeilingPortion;
  materialWastageSettings?: MaterialWastageSettings | null;
}): {
  readonly portion: CeilingPortionPhysical;
  readonly requirements: readonly MaterialRequirement[];
} {
  const specialistKind = ceilingPortionSpecialistKind(params.portion);
  const skipOrdinary = specialistKind != null;
  const geometry = deriveCeilingGeometry(params.portion);
  const timber = calculateCeilingTimberFraming(params.portion, geometry);
  const steel = calculateCeilingSteelFraming(params.portion, geometry);
  const suspended = calculateCeilingSuspendedFraming(params.portion, geometry);
  const lining = calculateCeilingLining(
    params.portion,
    geometry,
    params.materialWastageSettings
  );
  const bulkheads = calculateCeilingBulkheads({
    portion: params.portion,
    materialWastageSettings: params.materialWastageSettings,
  });
  const insulation = calculateCeilingInsulation({
    portion: params.portion,
    geometry,
  });
  const suppressFraming =
    tileAndGridFamiliesDisagree(params.portion) || skipOrdinary;
  const requirements: MaterialRequirement[] = [];
  if (!suppressFraming && !skipOrdinary) {
    const timberRow = timberMaterialRequirement({
      workArea: params.workArea,
      portion: params.portion,
      timber,
    });
    if (timberRow) requirements.push(timberRow);
    if (steel.status === "ok") {
      requirements.push(
        ...steelFrameRequirements({
          workArea: params.workArea,
          portion: params.portion,
          frame: steel,
        })
      );
    }
    if (suspended.status === "ok") {
      requirements.push(
        ...suspendedRequirements({
          workArea: params.workArea,
          portion: params.portion,
          suspended,
        })
      );
    }
  }
  if (!skipOrdinary) {
    requirements.push(
      ...liningMaterialRequirement({
        workArea: params.workArea,
        portion: params.portion,
        lining,
      })
    );
  }
  for (const bulkhead of bulkheads) {
    requirements.push(
      ...bulkheadMaterialRequirements({
        workArea: params.workArea,
        portion: params.portion,
        bulkhead,
      })
    );
  }
  const insulationRow = insulationMaterialRequirement({
    workArea: params.workArea,
    portion: params.portion,
    insulation,
  });
  if (insulationRow) requirements.push(insulationRow);
  if (!skipOrdinary) {
    requirements.push(
      ...ceilingFinishRequirements({
        workArea: params.workArea,
        portion: params.portion,
        lining,
        bulkheads,
      })
    );
  }
  if (!skipOrdinary) {
    requirements.push(
      ...ceilingFixingsRequirements({
        workArea: params.workArea,
        portion: params.portion,
        timber,
        steel,
        suspended,
        lining,
        bulkheads,
        includeFramingFixings: !suppressFraming,
      })
    );
  }
  const completeness = rollupPortionCompleteness({
    specialistKind,
    unsupportedBulkhead: ceilingPortionHasUnsupportedBulkhead(params.portion),
    missingBulkheads:
      params.portion.has_bulkheads === true &&
      params.portion.bulkheads.length === 0,
    geometry,
    timber,
    steel,
    suspended,
    lining,
    bulkheads,
    insulation,
    skipOrdinary,
  });
  return {
    portion: {
      workAreaId: params.workArea.id,
      nestedItemId: params.portion.id,
      geometry,
      timber,
      steel,
      suspended,
      lining,
      bulkheads,
      insulation,
      completeness,
      specialistKind,
    },
    requirements,
  };
}

export function calculateCeilingsPhysical(params: {
  readonly facts: readonly EstimateFact[];
  readonly workArea: Pick<EstimateWorkArea, "id" | "type" | "name">;
  readonly materialWastageSettings?: MaterialWastageSettings | null;
  readonly briefText?: string | null;
}): CeilingPhysicalResult {
  const workAreaId = params.workArea.id;
  if (!hasCanonicalCeilingsPortions(params.facts, workAreaId)) {
    const resolved = resolveCeilingsPortions({
      facts: params.facts,
      workAreaId,
      briefText: params.briefText,
    });
    if (resolved.source === "legacy_dual_read") {
      return {
        workAreaId,
        source: "legacy_skipped",
        completeness: "empty",
        portions: [],
        requirements: [],
        missingInfo: [],
      };
    }
    return {
      workAreaId,
      source: "empty",
      completeness: "empty",
      portions: [],
      requirements: [],
      missingInfo: [],
    };
  }

  const resolved = resolveCeilingsPortions({
    facts: params.facts,
    workAreaId,
    briefText: params.briefText,
  });
  const portions: CeilingPortionPhysical[] = [];
  const requirements: MaterialRequirement[] = [];
  const missingInfo: string[] = [];

  for (const portion of resolved.portions) {
    const calculated = calculatePortionCeilingsPhysical({
      workArea: params.workArea,
      portion,
      materialWastageSettings: params.materialWastageSettings,
    });
    portions.push(calculated.portion);
    requirements.push(...calculated.requirements);
    if (
      calculated.portion.geometry.status === "invalid" ||
      calculated.portion.geometry.status === "information_required"
    ) {
      if (calculated.portion.geometry.reason) {
        missingInfo.push(calculated.portion.geometry.reason);
      }
    }
    if (calculated.portion.timber.status === "information_required") {
      if (calculated.portion.timber.reason) {
        missingInfo.push(calculated.portion.timber.reason);
      }
    }
    if (
      calculated.portion.steel.status === "information_required" ||
      calculated.portion.steel.status === "invalid"
    ) {
      if (calculated.portion.steel.reason) {
        missingInfo.push(calculated.portion.steel.reason);
      }
    }
    if (
      calculated.portion.suspended.status === "information_required" ||
      calculated.portion.suspended.status === "invalid"
    ) {
      if (calculated.portion.suspended.reason) {
        missingInfo.push(calculated.portion.suspended.reason);
      }
    }
    if (
      calculated.portion.lining.status === "information_required" ||
      calculated.portion.lining.status === "invalid"
    ) {
      if (calculated.portion.lining.reason) {
        missingInfo.push(calculated.portion.lining.reason);
      }
    }
    for (const bulkhead of calculated.portion.bulkheads) {
      if (
        bulkhead.status === "information_required" ||
        bulkhead.status === "invalid" ||
        bulkhead.status === "unsupported_specialist"
      ) {
        if (bulkhead.reason) missingInfo.push(bulkhead.reason);
      }
    }
    if (
      calculated.portion.insulation.status === "information_required" ||
      calculated.portion.insulation.status === "invalid"
    ) {
      if (calculated.portion.insulation.reason) {
        missingInfo.push(calculated.portion.insulation.reason);
      }
    }
  }

  return {
    workAreaId,
    source: "canonical",
    completeness: rollupCeilingsPhysicalCompleteness(portions),
    portions,
    requirements,
    missingInfo: [...new Set(missingInfo)],
  };
}

export function ceilingRequirementNestedItemId(
  requirement: { readonly variantKey?: string }
): string | undefined {
  const variant = requirement.variantKey;
  if (!variant) return undefined;
  return variant.includes("::") ? variant.split("::")[0] : variant;
}

export function ceilingRequirementComponentId(
  requirement: { readonly variantKey?: string }
): string | undefined {
  const variant = requirement.variantKey;
  if (!variant || !variant.includes("::")) return undefined;
  return variant.split("::")[1];
}
