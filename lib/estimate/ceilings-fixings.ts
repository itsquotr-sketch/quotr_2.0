/**
 * CEILINGS WA-04D — physical fixings / consumables allowance bases.
 *
 * No dollar values. WA-05 prices these bases. Tile & Grid standard
 * grid/tile rates include ordinary minor grid fixings — no second
 * allowance. Crossover clips / droppers / wire stay separately counted.
 */

import type { MaterialRequirement } from "@/lib/estimate/requirements";
import { buildMaterialRequirement } from "@/lib/estimate/material-requirement";
import type { EstimateWorkArea } from "@/lib/estimate/types";
import type { CeilingPortion } from "@/lib/estimate/ceilings-portions";
import type { CeilingTimberFramingTakeoff } from "@/lib/estimate/ceilings-framing";
import type { CeilingSteelFrameTakeoff, CeilingSuspendedTakeoff } from "@/lib/estimate/ceilings-steel";
import type { CeilingLiningTakeoff } from "@/lib/estimate/ceilings-lining";
import type { CeilingBulkheadTakeoff } from "@/lib/estimate/ceilings-bulkheads";

export const CEILINGS_FIXINGS_TIMBER_FRAMING_COMPONENT =
  "ceilings.fixings.timber_framing" as const;
export const CEILINGS_FIXINGS_STEEL_FRAMING_COMPONENT =
  "ceilings.fixings.steel_framing" as const;
export const CEILINGS_FIXINGS_PLASTERBOARD_COMPONENT =
  "ceilings.fixings.plasterboard" as const;
export const CEILINGS_FIXINGS_PLYWOOD_COMPONENT =
  "ceilings.fixings.plywood" as const;
export const CEILINGS_FIXINGS_TIMBER_LINING_COMPONENT =
  "ceilings.fixings.timber_lining" as const;
export const CEILINGS_FIXINGS_BULKHEAD_FRAMING_COMPONENT =
  "ceilings.fixings.bulkhead_framing" as const;
export const CEILINGS_FIXINGS_BULKHEAD_FRAMING_TIMBER_KEY =
  "ceilings.fixings.bulkhead_framing.timber" as const;
export const CEILINGS_FIXINGS_BULKHEAD_FRAMING_STEEL_KEY =
  "ceilings.fixings.bulkhead_framing.steel" as const;
export const CEILINGS_FIXINGS_BULKHEAD_LINING_COMPONENT =
  "ceilings.fixings.bulkhead_lining" as const;

export const CEILINGS_TILE_GRID_FIXINGS_DECISION =
  "Tile & Grid commercial grid m² is intended to include standard minor grid components and fixings. No separate residual allowance in V1." as const;

function allowance(params: {
  workArea: Pick<EstimateWorkArea, "id" | "type" | "name">;
  portion: CeilingPortion;
  componentKey: string;
  variantKey: string;
  description: string;
  specification: string;
  assumption: string;
  assumptionKey: string;
  baseQuantity: number;
  baseUnit: string;
  factKeys: readonly string[];
  materialKey?: string;
}): MaterialRequirement {
  return buildMaterialRequirement({
    workAreaId: params.workArea.id,
    workAreaType: params.workArea.type || "ceilings",
    componentKey: params.componentKey,
    variantKey: params.variantKey,
    description: params.description,
    confidence: "medium",
    assumptions: [
      {
        key: params.assumptionKey,
        text: params.assumption,
        source: "calculator_default",
      },
    ],
    provenance: {
      calculatorSource: "ceilings-physical",
      factKeys: [...params.factKeys],
      constraintKeys: [],
    },
    priced: false,
    materialKey: params.materialKey ?? params.componentKey,
    category: "FIXINGS",
    specification: params.specification,
    baseQuantity: params.baseQuantity,
    baseUnit: params.baseUnit,
    wasteFactor: 0,
    purchaseQuantity: params.baseQuantity,
    purchaseUnit: params.baseUnit,
    rateSource: "missing",
    unitCost: null,
    totalCost: null,
  });
}

function label(portion: CeilingPortion): string {
  return portion.label?.trim() || "Ceiling portion";
}

export function ceilingFixingsRequirements(params: {
  workArea: Pick<EstimateWorkArea, "id" | "type" | "name">;
  portion: CeilingPortion;
  timber: CeilingTimberFramingTakeoff;
  steel: CeilingSteelFrameTakeoff;
  suspended: CeilingSuspendedTakeoff;
  lining: CeilingLiningTakeoff;
  bulkheads: readonly CeilingBulkheadTakeoff[];
  includeFramingFixings?: boolean;
}): MaterialRequirement[] {
  const out: MaterialRequirement[] = [];
  const { workArea, portion } = params;
  const includeFramingFixings = params.includeFramingFixings !== false;

  if (
    includeFramingFixings &&
    params.timber.status === "ok" &&
    params.timber.installedFramingLM != null
  ) {
    out.push(
      allowance({
        workArea,
        portion,
        componentKey: CEILINGS_FIXINGS_TIMBER_FRAMING_COMPONENT,
        variantKey: portion.id,
        description: `${label(portion)} — timber framing fixings allowance`,
        specification: `${params.timber.installedFramingLM} lm timber framing · residual fixings allowance`,
        assumption:
          "Residual timber-framing fixings / consumables allowance on installed framing LM. Not a screw count.",
        assumptionKey: "ceilings.fixings.timber_framing",
        baseQuantity: params.timber.installedFramingLM,
        baseUnit: "lm",
        factKeys: ["ceilings.portions", "ceilings.portion.spacing_mm"],
      })
    );
  }

  const steelFrame =
    params.steel.status === "ok"
      ? params.steel
      : params.suspended.status === "ok"
        ? params.suspended.frame
        : null;
  if (includeFramingFixings && steelFrame && steelFrame.status === "ok") {
    const steelLm =
      (steelFrame.perimeterLm ?? 0) +
      (steelFrame.primaryLm ?? 0) +
      (steelFrame.furringLm ?? 0);
    if (steelLm > 0) {
      out.push(
        allowance({
          workArea,
          portion,
          componentKey: CEILINGS_FIXINGS_STEEL_FRAMING_COMPONENT,
          variantKey: portion.id,
          description: `${label(portion)} — steel framing residual fixings`,
          specification: `${steelLm} lm steel framing (excluding clips, droppers, and wire) · residual anchors/screws/minor fixings`,
          assumption:
            "Residual steel-framing consumables on installed steel LM. Crossover clips, droppers, and suspension wire are counted separately.",
          assumptionKey: "ceilings.fixings.steel_framing",
          baseQuantity: steelLm,
          baseUnit: "lm",
          factKeys: ["ceilings.portions"],
        })
      );
    }
  }

  if (params.lining.status === "ok" && params.lining.family === "plasterboard") {
    const area =
      params.lining.areaM2 != null && params.lining.layerCount != null
        ? params.lining.areaM2 * params.lining.layerCount
        : params.lining.areaM2;
    if (area != null && area > 0) {
      out.push(
        allowance({
          workArea,
          portion,
          componentKey: CEILINGS_FIXINGS_PLASTERBOARD_COMPONENT,
          variantKey: portion.id,
          description: `${label(portion)} — plasterboard fixings allowance`,
          specification: `${area} m² installed plasterboard · screws / minor lining consumables`,
          assumption:
            "Plasterboard lining fixings allowance on installed lining area. Not a screw-count takeoff.",
          assumptionKey: "ceilings.fixings.plasterboard",
          baseQuantity: area,
          baseUnit: "m2",
          factKeys: ["ceilings.portions", "ceilings.portion.lining_family"],
        })
      );
    }
  }

  if (params.lining.status === "ok" && params.lining.family === "plywood") {
    const area = params.lining.areaM2;
    if (area != null && area > 0) {
      out.push(
        allowance({
          workArea,
          portion,
          componentKey: CEILINGS_FIXINGS_PLYWOOD_COMPONENT,
          variantKey: portion.id,
          description: `${label(portion)} — plywood fixings allowance`,
          specification: `${area} m² installed plywood · residual fixings allowance`,
          assumption:
            "Plywood lining fixings allowance on installed lining area. Distinct from plasterboard.",
          assumptionKey: "ceilings.fixings.plywood",
          baseQuantity: area,
          baseUnit: "m2",
          factKeys: ["ceilings.portions", "ceilings.portion.lining_family"],
        })
      );
    }
  }

  if (
    params.lining.status === "ok" &&
    params.lining.family === "timber_lined" &&
    params.lining.installedLm != null
  ) {
    out.push(
      allowance({
        workArea,
        portion,
        componentKey: CEILINGS_FIXINGS_TIMBER_LINING_COMPONENT,
        variantKey: portion.id,
        description: `${label(portion)} — timber lining fixings allowance`,
        specification: `${params.lining.installedLm} lm timber lining · residual fixings allowance`,
        assumption:
          "Timber-lining fixings allowance on installed lining LM. Not a clip/nail count.",
        assumptionKey: "ceilings.fixings.timber_lining",
        baseQuantity: params.lining.installedLm,
        baseUnit: "lm",
        factKeys: ["ceilings.portions"],
      })
    );
  }

  for (const bulkhead of params.bulkheads) {
    if (bulkhead.status !== "ok") continue;
    const variantKey = `${portion.id}::${bulkhead.componentId}`;
    if (bulkhead.framingLm != null) {
      const timberFraming = bulkhead.framingType !== "steel";
      out.push(
        allowance({
          workArea,
          portion,
          componentKey: CEILINGS_FIXINGS_BULKHEAD_FRAMING_COMPONENT,
          variantKey,
          description: `${label(portion)} — bulkhead framing fixings`,
          specification: `${bulkhead.framingLm} lm bulkhead ${timberFraming ? "timber" : "steel"} framing · residual fixings allowance`,
          assumption:
            "Bulkhead framing residual fixings on installed bulkhead framing LM.",
          assumptionKey: "ceilings.fixings.bulkhead_framing",
          baseQuantity: bulkhead.framingLm,
          baseUnit: "lm",
          factKeys: ["ceilings.portions", "ceilings.bulkhead.length_m"],
          materialKey: timberFraming
            ? CEILINGS_FIXINGS_BULKHEAD_FRAMING_TIMBER_KEY
            : CEILINGS_FIXINGS_BULKHEAD_FRAMING_STEEL_KEY,
        })
      );
    }
    if (bulkhead.liningAreaM2 != null) {
      out.push(
        allowance({
          workArea,
          portion,
          componentKey: CEILINGS_FIXINGS_BULKHEAD_LINING_COMPONENT,
          variantKey,
          description: `${label(portion)} — bulkhead lining fixings`,
          specification: `${bulkhead.liningAreaM2} m² bulkhead lining · residual fixings allowance`,
          assumption:
            "Bulkhead lining residual fixings on installed bulkhead lining area.",
          assumptionKey: "ceilings.fixings.bulkhead_lining",
          baseQuantity: bulkhead.liningAreaM2,
          baseUnit: "m2",
          factKeys: ["ceilings.portions", "ceilings.bulkhead.lining_type"],
        })
      );
    }
  }

  return out;
}
