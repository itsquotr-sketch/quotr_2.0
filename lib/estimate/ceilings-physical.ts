/**
 * CEILINGS WA-04A — physical calculation kernel (geometry + timber direct-fix).
 *
 * Not hosted money. Not wired into calculateCeilings / customer estimate
 * output. Call from verifiers, the physical pipeline, or Preview diagnostics.
 *
 * Per-Portion, per-Work-Area. No same-product collapse. No lining, steel,
 * suspended, tile, bulkhead, labour, or waste percent in this slice.
 */

import { buildMaterialRequirement } from "@/lib/estimate/material-requirement";
import type { MaterialRequirement } from "@/lib/estimate/requirements";
import type { EstimateFact, EstimateWorkArea } from "@/lib/estimate/types";
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

export type CeilingPhysicalSource = "canonical" | "legacy_skipped" | "empty";

export type CeilingPortionPhysical = {
  readonly workAreaId: string;
  readonly nestedItemId: string;
  readonly geometry: CeilingGeometryTakeoff;
  readonly timber: CeilingTimberFramingTakeoff;
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

export function calculatePortionCeilingsPhysical(params: {
  workArea: Pick<EstimateWorkArea, "id" | "type" | "name">;
  portion: CeilingPortion;
}): {
  readonly portion: CeilingPortionPhysical;
  readonly requirement: MaterialRequirement | null;
} {
  const geometry = deriveCeilingGeometry(params.portion);
  const timber = calculateCeilingTimberFraming(params.portion, geometry);
  return {
    portion: {
      workAreaId: params.workArea.id,
      nestedItemId: params.portion.id,
      geometry,
      timber,
    },
    requirement: timberMaterialRequirement({
      workArea: params.workArea,
      portion: params.portion,
      timber,
    }),
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
    if (calculated.requirement) {
      requirements.push(calculated.requirement);
    }
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
