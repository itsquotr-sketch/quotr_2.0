/**
 * CEILINGS WA-04A/B — physical calculation kernel.
 *
 * Geometry + timber direct-fix + steel direct-fix + suspended steel.
 * Not hosted money. Not wired into calculateCeilings / customer estimate
 * output. Call from verifiers, the physical pipeline, or Preview diagnostics.
 *
 * Per-Portion, per-Work-Area. No same-product collapse. No lining, tile/grid,
 * bulkhead, labour, or waste percent in this slice. Purchase quantity equals
 * installed only; wastage remains unresolved until a later slice.
 */

import { buildMaterialRequirement } from "@/lib/estimate/material-requirement";
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

export type CeilingPhysicalSource = "canonical" | "legacy_skipped" | "empty";

export type CeilingPortionPhysical = {
  readonly workAreaId: string;
  readonly nestedItemId: string;
  readonly geometry: CeilingGeometryTakeoff;
  readonly timber: CeilingTimberFramingTakeoff;
  readonly steel: CeilingSteelFrameTakeoff;
  readonly suspended: CeilingSuspendedTakeoff;
};

export type CeilingPhysicalResult = {
  readonly workAreaId: string;
  readonly source: CeilingPhysicalSource;
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

export function calculatePortionCeilingsPhysical(params: {
  workArea: Pick<EstimateWorkArea, "id" | "type" | "name">;
  portion: CeilingPortion;
}): {
  readonly portion: CeilingPortionPhysical;
  readonly requirements: readonly MaterialRequirement[];
} {
  const geometry = deriveCeilingGeometry(params.portion);
  const timber = calculateCeilingTimberFraming(params.portion, geometry);
  const steel = calculateCeilingSteelFraming(params.portion, geometry);
  const suspended = calculateCeilingSuspendedFraming(params.portion, geometry);
  const requirements: MaterialRequirement[] = [];
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
  return {
    portion: {
      workAreaId: params.workArea.id,
      nestedItemId: params.portion.id,
      geometry,
      timber,
      steel,
      suspended,
    },
    requirements,
  };
}

export function calculateCeilingsPhysical(params: {
  readonly facts: readonly EstimateFact[];
  readonly workArea: Pick<EstimateWorkArea, "id" | "type" | "name">;
}): CeilingPhysicalResult {
  const workAreaId = params.workArea.id;
  if (!hasCanonicalCeilingsPortions(params.facts, workAreaId)) {
    const resolved = resolveCeilingsPortions({
      facts: params.facts,
      workAreaId,
    });
    if (resolved.source === "legacy_dual_read") {
      return {
        workAreaId,
        source: "legacy_skipped",
        portions: [],
        requirements: [],
        missingInfo: [],
      };
    }
    return {
      workAreaId,
      source: "empty",
      portions: [],
      requirements: [],
      missingInfo: [],
    };
  }

  const resolved = resolveCeilingsPortions({
    facts: params.facts,
    workAreaId,
  });
  const portions: CeilingPortionPhysical[] = [];
  const requirements: MaterialRequirement[] = [];
  const missingInfo: string[] = [];

  for (const portion of resolved.portions) {
    const calculated = calculatePortionCeilingsPhysical({
      workArea: params.workArea,
      portion,
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
  }

  return {
    workAreaId,
    source: "canonical",
    portions,
    requirements,
    missingInfo: [...new Set(missingInfo)],
  };
}

export function ceilingRequirementNestedItemId(
  requirement: MaterialRequirement
): string | undefined {
  return requirement.variantKey;
}
