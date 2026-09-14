/**
 * CEILINGS WA-04D — conventional two-face downstand bulkhead takeoff.
 *
 * V1 topology only. Island / boxed / complex are unsupported-specialist.
 * End caps excluded. One lining layer assumed and disclosed. No labour.
 */

import { round2 } from "@/lib/estimate/facts";
import { countCoveredAreaSheets } from "@/lib/estimate/material-buildups";
import { runCountFromSpacing } from "@/lib/estimate/run-count";
import {
  PHYSICAL_REQUIREMENT_RESOLUTION,
  type PhysicalRequirementResolution,
} from "@/lib/estimate/physical-requirement-resolution";
import { INTERNAL_WALLS_TIMBER_90_KEY } from "@/lib/estimate/internal-walls-identities";
import { resolveCeilingPlasterboardProduct } from "@/lib/estimate/ceilings-lining";
import type { MaterialIdentity } from "@/lib/materials/identity";
import type { MaterialWastageSettings } from "@/lib/settings/material-wastage";
import { resolveMaterialWastage } from "@/lib/settings/material-wastage";
import {
  CEILINGS_BULKHEAD_TOPOLOGY_ASSUMPTION,
  isUnsupportedCeilingBulkhead,
  type CeilingBulkhead,
  type CeilingBulkheadLining,
  type CeilingPlasterboardProduct,
  type CeilingPortion,
} from "@/lib/estimate/ceilings-portions";

export const CEILINGS_BULKHEAD_LONGITUDINAL_MEMBERS = 3 as const;
export const CEILINGS_BULKHEAD_NOG_SPACING_M = 0.45 as const;
export const CEILINGS_BULKHEAD_NOG_SPACING_MM = 450 as const;

export const CEILINGS_BULKHEAD_FRAMING_TIMBER_COMPONENT =
  "ceilings.bulkhead.framing.timber" as const;
export const CEILINGS_BULKHEAD_FRAMING_STEEL_COMPONENT =
  "ceilings.bulkhead.framing.steel" as const;
export const CEILINGS_BULKHEAD_LINING_COMPONENT =
  "ceilings.bulkhead.lining.material" as const;

export const CEILING_BULKHEAD_STEEL_FRAMING_KEY =
  "steel.ceiling.bulkhead.framing.lm" as const;

export const CEILINGS_BULKHEAD_END_CAPS_EXCLUDED =
  "V1 bulkhead lining excludes end caps." as const;
export const CEILINGS_BULKHEAD_LAYERS_ASSUMPTION_STATEMENT =
  "Assumes one layer of bulkhead lining." as const;
export const CEILINGS_BULKHEAD_TIMBER_SIZE_ASSUMPTION =
  "Assumes 90 × 45 H1.2 timber for bulkhead framing." as const;
export const CEILINGS_BULKHEAD_NOG_SPACING_ASSUMPTION =
  "Assumes bulkhead nogs at 450 mm centres." as const;
export const CEILINGS_BULKHEAD_LONGITUDINAL_ASSUMPTION =
  "Assumes three longitudinal bulkhead framing members." as const;

export type CeilingBulkheadStatus =
  | "ok"
  | "not_applicable"
  | "information_required"
  | "invalid"
  | "unsupported_specialist";

export type CeilingBulkheadTakeoff = {
  readonly status: CeilingBulkheadStatus;
  readonly resolution: PhysicalRequirementResolution;
  readonly reason: string | null;
  readonly nestedItemId: string;
  readonly componentId: string;
  readonly topologyAssumption: string | null;
  readonly lengthM: number | null;
  readonly depthM: number | null;
  readonly heightM: number | null;
  readonly undersideAreaM2: number | null;
  readonly verticalFaceAreaM2: number | null;
  readonly liningAreaM2: number | null;
  readonly exposedVerticalFaces: number | null;
  readonly longitudinalLm: number | null;
  readonly nogStations: number | null;
  readonly nogLm: number | null;
  readonly framingLm: number | null;
  readonly framingType: "timber" | "steel" | null;
  readonly liningType: CeilingBulkheadLining | null;
  readonly layerCount: 1 | null;
  readonly layerCountSource: "assumed_disclosed" | null;
  readonly layerAssumption: string | null;
  readonly installedSheets: number | null;
  readonly purchaseSheets: number | null;
  readonly wasteFactor: number | null;
  readonly labourBasisInstalled: number | null;
  readonly framingMaterialKey: string | null;
  readonly liningMaterialKey: string | null;
  readonly liningSpecification: string | null;
};

function classifyPositive(value: unknown): "missing" | "invalid" | "ok" {
  if (value == null) return "missing";
  if (typeof value !== "number" || !Number.isFinite(value)) return "invalid";
  if (value < 0) return "invalid";
  if (value === 0) return "missing";
  return "ok";
}

function framingIdentity(
  family: string,
  productFamily: string,
  description: string
): MaterialIdentity {
  return {
    family,
    productFamily,
    section: null,
    grade: null,
    treatment: null,
    treatmentKind: "unknown",
    treatmentCustom: null,
    processing: null,
    processingKind: "unknown",
    species: null,
    originalDescription: description,
  };
}

export const CEILING_BULKHEAD_STEEL_FRAMING_IDENTITY = framingIdentity(
  "steel",
  "bulkhead_framing",
  "Steel bulkhead framing — profile unresolved"
);

function emptyTakeoff(
  nestedItemId: string,
  componentId: string,
  status: CeilingBulkheadStatus,
  reason: string | null
): CeilingBulkheadTakeoff {
  return {
    status,
    resolution:
      status === "ok"
        ? PHYSICAL_REQUIREMENT_RESOLUTION.DERIVED
        : status === "unsupported_specialist"
          ? PHYSICAL_REQUIREMENT_RESOLUTION.INFORMATION_REQUIRED
          : status === "not_applicable"
            ? PHYSICAL_REQUIREMENT_RESOLUTION.KNOWN
            : PHYSICAL_REQUIREMENT_RESOLUTION.INFORMATION_REQUIRED,
    reason,
    nestedItemId,
    componentId,
    topologyAssumption: null,
    lengthM: null,
    depthM: null,
    heightM: null,
    undersideAreaM2: null,
    verticalFaceAreaM2: null,
    liningAreaM2: null,
    exposedVerticalFaces: null,
    longitudinalLm: null,
    nogStations: null,
    nogLm: null,
    framingLm: null,
    framingType: null,
    liningType: null,
    layerCount: null,
    layerCountSource: null,
    layerAssumption: null,
    installedSheets: null,
    purchaseSheets: null,
    wasteFactor: null,
    labourBasisInstalled: null,
    framingMaterialKey: null,
    liningMaterialKey: null,
    liningSpecification: null,
  };
}

function mapBulkheadLiningProduct(
  lining: CeilingBulkheadLining | null
): CeilingPlasterboardProduct | null {
  if (lining === "standard" || lining === "aqualine" || lining === "fyreline" || lining === "other") {
    return lining;
  }
  return null;
}

export function calculateCeilingBulkhead(params: {
  portion: CeilingPortion;
  bulkhead: CeilingBulkhead;
  materialWastageSettings?: MaterialWastageSettings | null;
}): CeilingBulkheadTakeoff {
  const nestedItemId = params.portion.id;
  const componentId = params.bulkhead.id;
  if (isUnsupportedCeilingBulkhead(params.bulkhead)) {
    return emptyTakeoff(
      nestedItemId,
      componentId,
      "unsupported_specialist",
      "Unsupported bulkhead form is not a conventional wall-adjacent downstand."
    );
  }

  const lengthState = classifyPositive(params.bulkhead.length_m);
  const depthState = classifyPositive(params.bulkhead.depth_m);
  const heightState = classifyPositive(params.bulkhead.height_m);
  if (
    lengthState === "invalid" ||
    depthState === "invalid" ||
    heightState === "invalid"
  ) {
    return emptyTakeoff(
      nestedItemId,
      componentId,
      "invalid",
      "Bulkhead length, depth, and height must be positive finite values."
    );
  }
  if (
    lengthState === "missing" ||
    depthState === "missing" ||
    heightState === "missing"
  ) {
    return emptyTakeoff(
      nestedItemId,
      componentId,
      "information_required",
      "Bulkhead length, depth, and height are required."
    );
  }

  const lengthM = params.bulkhead.length_m as number;
  const depthM = params.bulkhead.depth_m as number;
  const heightM = params.bulkhead.height_m as number;
  const undersideAreaM2 = round2(lengthM * depthM);
  const verticalFaceAreaM2 = round2(lengthM * heightM);
  const liningAreaM2 = round2(lengthM * (depthM + heightM));
  const longitudinalLm = round2(
    CEILINGS_BULKHEAD_LONGITUDINAL_MEMBERS * lengthM
  );
  const nogStations = runCountFromSpacing(
    lengthM,
    CEILINGS_BULKHEAD_NOG_SPACING_M
  );
  const nogLm = round2(nogStations * (depthM + heightM));
  const framingLm = round2(longitudinalLm + nogLm);

  const framingType = params.bulkhead.framing_type;
  if (framingType == null) {
    return emptyTakeoff(
      nestedItemId,
      componentId,
      "information_required",
      "Bulkhead framing type is required."
    );
  }

  const liningType = params.bulkhead.lining_type;
  if (liningType == null) {
    return emptyTakeoff(
      nestedItemId,
      componentId,
      "information_required",
      "Bulkhead lining type is required."
    );
  }

  const product = mapBulkheadLiningProduct(liningType);
  const thickness = params.bulkhead.thickness_mm;
  const plasterboard =
    liningType === "standard" ||
    liningType === "aqualine" ||
    liningType === "fyreline";
  if (plasterboard && thickness == null) {
    return emptyTakeoff(
      nestedItemId,
      componentId,
      "information_required",
      "Bulkhead plasterboard thickness is required."
    );
  }

  const sheetLengthMm = params.portion.lining.sheet_length_mm;
  const sheetWidthMm = params.portion.lining.sheet_width_mm;
  const sheetLengthOk =
    typeof sheetLengthMm === "number" &&
    Number.isFinite(sheetLengthMm) &&
    sheetLengthMm > 0;
  const sheetWidthOk =
    typeof sheetWidthMm === "number" &&
    Number.isFinite(sheetWidthMm) &&
    sheetWidthMm > 0;
  if (!sheetLengthOk || !sheetWidthOk) {
    return emptyTakeoff(
      nestedItemId,
      componentId,
      "information_required",
      "Bulkhead lining needs sheet length and width."
    );
  }

  const wastagePercent = resolveMaterialWastage(
    params.materialWastageSettings,
    "sheet_material"
  );
  const counted = countCoveredAreaSheets({
    areaM2: liningAreaM2,
    sheetLengthM: sheetLengthMm / 1000,
    sheetWidthM: sheetWidthMm / 1000,
    wastagePercent,
    layerCount: 1,
  });
  if (!counted) {
    return emptyTakeoff(
      nestedItemId,
      componentId,
      "information_required",
      "Bulkhead sheet count could not be derived from lining area and sheet size."
    );
  }

  const liningProduct = resolveCeilingPlasterboardProduct(
    product ?? "other",
    plasterboard ? thickness : "other",
    sheetLengthMm,
    sheetWidthMm
  );

  const framingMaterialKey =
    framingType === "timber"
      ? INTERNAL_WALLS_TIMBER_90_KEY
      : CEILING_BULKHEAD_STEEL_FRAMING_KEY;

  return {
    status: "ok",
    resolution: PHYSICAL_REQUIREMENT_RESOLUTION.DERIVED,
    reason: null,
    nestedItemId,
    componentId,
    topologyAssumption: CEILINGS_BULKHEAD_TOPOLOGY_ASSUMPTION,
    lengthM,
    depthM,
    heightM,
    undersideAreaM2,
    verticalFaceAreaM2,
    liningAreaM2,
    exposedVerticalFaces: 1,
    longitudinalLm,
    nogStations,
    nogLm,
    framingLm,
    framingType,
    liningType,
    layerCount: 1,
    layerCountSource: "assumed_disclosed",
    layerAssumption: CEILINGS_BULKHEAD_LAYERS_ASSUMPTION_STATEMENT,
    installedSheets: counted.installedSheets,
    purchaseSheets: counted.purchaseSheets,
    wasteFactor: counted.wasteFactor,
    labourBasisInstalled: counted.installedSheets,
    framingMaterialKey,
    liningMaterialKey: liningProduct.materialKey,
    liningSpecification: liningProduct.specification,
  };
}

export function calculateCeilingBulkheads(params: {
  portion: CeilingPortion;
  materialWastageSettings?: MaterialWastageSettings | null;
}): readonly CeilingBulkheadTakeoff[] {
  if (
    params.portion.has_bulkheads !== true &&
    params.portion.bulkheads.length === 0
  ) {
    return [];
  }
  return params.portion.bulkheads.map((bulkhead) =>
    calculateCeilingBulkhead({
      portion: params.portion,
      bulkhead,
      materialWastageSettings: params.materialWastageSettings,
    })
  );
}

