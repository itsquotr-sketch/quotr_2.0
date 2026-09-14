/**
 * CEILINGS WA-04D — ceiling insulation physical takeoff.
 *
 * Installed m² = ceiling area. Area-only is valid. No invented product
 * identity or waste factor. No labour.
 */

import {
  PHYSICAL_REQUIREMENT_RESOLUTION,
  type PhysicalRequirementResolution,
} from "@/lib/estimate/physical-requirement-resolution";
import type { CeilingPortion } from "@/lib/estimate/ceilings-portions";
import type { CeilingGeometryTakeoff } from "@/lib/estimate/ceilings-geometry";
import type { MaterialIdentity } from "@/lib/materials/identity";
import {
  CEILING_INSULATION_THERMAL_KEY,
  ceilingInsulationMaterialKey,
  ceilingInsulationSpecification,
} from "@/lib/estimate/insulation-fallback";

export const CEILINGS_INSULATION_COMPONENT =
  "ceilings.insulation.material" as const;
export const CEILING_INSULATION_KEY = "ceiling.insulation.m2" as const;

export const CEILINGS_INSULATION_WASTAGE_UNRESOLVED =
  "Insulation wastage is unresolved in V1; installed quantity equals purchase quantity." as const;

export type CeilingInsulationStatus =
  | "ok"
  | "not_applicable"
  | "information_required"
  | "invalid";

export type CeilingInsulationTakeoff = {
  readonly status: CeilingInsulationStatus;
  readonly resolution: PhysicalRequirementResolution;
  readonly reason: string | null;
  readonly nestedItemId: string;
  readonly areaM2: number | null;
  readonly installedM2: number | null;
  readonly purchaseM2: number | null;
  readonly wasteFactor: number | null;
  readonly wastageUnresolved: boolean;
  readonly specText: string | null;
  readonly materialKey: string | null;
  readonly materialIdentity: MaterialIdentity | null;
};

function emptyTakeoff(
  nestedItemId: string,
  status: CeilingInsulationStatus,
  reason: string | null
): CeilingInsulationTakeoff {
  return {
    status,
    resolution:
      status === "ok"
        ? PHYSICAL_REQUIREMENT_RESOLUTION.DERIVED
        : status === "not_applicable"
          ? PHYSICAL_REQUIREMENT_RESOLUTION.KNOWN
          : PHYSICAL_REQUIREMENT_RESOLUTION.INFORMATION_REQUIRED,
    reason,
    nestedItemId,
    areaM2: null,
    installedM2: null,
    purchaseM2: null,
    wasteFactor: null,
    wastageUnresolved: true,
    specText: null,
    materialKey: null,
    materialIdentity: null,
  };
}

export function calculateCeilingInsulation(params: {
  portion: CeilingPortion;
  geometry: CeilingGeometryTakeoff;
}): CeilingInsulationTakeoff {
  const nestedItemId = params.portion.id;
  if (params.portion.finish.insulation_included !== true) {
    return emptyTakeoff(nestedItemId, "not_applicable", null);
  }
  if (params.geometry.status === "invalid") {
    return emptyTakeoff(
      nestedItemId,
      "invalid",
      params.geometry.reason ?? "Insulation needs a valid ceiling area."
    );
  }
  const areaM2 = params.geometry.area_m2;
  if (areaM2 == null || !(areaM2 > 0)) {
    return emptyTakeoff(
      nestedItemId,
      "information_required",
      "Insulation needs a ceiling area."
    );
  }
  const specText = params.portion.finish.insulation_type?.trim() || null;
  const materialKey = ceilingInsulationMaterialKey(specText);
  const specification = ceilingInsulationSpecification(specText);
  return {
    status: "ok",
    resolution: PHYSICAL_REQUIREMENT_RESOLUTION.DERIVED,
    reason: null,
    nestedItemId,
    areaM2,
    installedM2: areaM2,
    purchaseM2: areaM2,
    wasteFactor: null,
    wastageUnresolved: true,
    specText,
    materialKey,
    materialIdentity: {
      family: "insulation",
      productFamily: materialKey === CEILING_INSULATION_THERMAL_KEY
        ? "ceiling_insulation_thermal"
        : "ceiling_insulation",
      section: null,
      grade: null,
      treatment: null,
      treatmentKind: "unknown",
      treatmentCustom: null,
      processing: null,
      processingKind: "unknown",
      species: null,
      originalDescription: specification,
    },
  };
}
