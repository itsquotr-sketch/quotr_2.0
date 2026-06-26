import { getRangeFactors } from "@/lib/estimate/rates";
import { round2 } from "@/lib/estimate/facts";
import type { OrganisationSettings } from "@/components/setup/types";
import type { PricingOwner } from "@/lib/estimate/pricing-ownership";
import {
  parseLineItemNotes,
  type AllowanceMinimumMeta,
  type LabourMinimumMeta,
  type QuantityBasis,
} from "@/lib/estimate/line-item-metadata";
import type { EstimateLineItemInput } from "@/lib/estimate/types";
import { getNumberFact } from "@/lib/estimate/facts";
import type { EstimateFact } from "@/lib/estimate/types";

export type ApplyLabourMinimumsParams = {
  calculatedHours: number;
  minCrewSize?: number;
  minDurationHours?: number;
  minTotalHours?: number;
  smallJobFactor?: number;
  accessFactor?: number;
  accessLabel?: string;
};

export type ApplyLabourMinimumsResult = {
  finalHours: number;
  metadata: LabourMinimumMeta;
};

export function applyLabourMinimums(
  params: ApplyLabourMinimumsParams
): ApplyLabourMinimumsResult {
  const accessFactor = params.accessFactor ?? 1;
  const smallJobFactor = params.smallJobFactor ?? 1;
  const minCrewSize = params.minCrewSize ?? 1;
  const minDurationHours = params.minDurationHours ?? 0;
  const minFromCrew = minCrewSize * minDurationHours;
  const minTotalHours = params.minTotalHours ?? minFromCrew;

  const scaledHours = round2(
    params.calculatedHours * accessFactor * smallJobFactor
  );
  const finalHours = round2(Math.max(scaledHours, minTotalHours));
  const minimumApplied = finalHours > scaledHours + 0.001;

  return {
    finalHours,
    metadata: {
      calculatedHours: round2(params.calculatedHours),
      finalHours,
      minimumApplied,
      minCrewSize: minCrewSize > 1 ? minCrewSize : undefined,
      minDurationHours: minDurationHours > 0 ? minDurationHours : undefined,
      minTotalHours: minTotalHours > 0 ? minTotalHours : undefined,
      accessFactor: accessFactor !== 1 ? accessFactor : undefined,
      accessLabel: params.accessLabel,
      smallJobFactor: smallJobFactor !== 1 ? smallJobFactor : undefined,
    },
  };
}

export type ApplyAllowanceMinimumParams = {
  calculatedCost: number;
  calculatedSell: number;
  minimumCost: number;
  minimumSell: number;
  reason: string;
  scopeKey?: string;
};

export type ApplyAllowanceMinimumResult = {
  cost: number;
  sell: number;
  minimumApplied: boolean;
  metadata?: AllowanceMinimumMeta;
};

export function applyAllowanceMinimum(
  params: ApplyAllowanceMinimumParams
): ApplyAllowanceMinimumResult {
  const minimumApplied =
    params.calculatedCost < params.minimumCost ||
    params.calculatedSell < params.minimumSell;

  if (!minimumApplied) {
    return {
      cost: round2(params.calculatedCost),
      sell: round2(params.calculatedSell),
      minimumApplied: false,
    };
  }

  return {
    cost: round2(Math.max(params.calculatedCost, params.minimumCost)),
    sell: round2(Math.max(params.calculatedSell, params.minimumSell)),
    minimumApplied: true,
    metadata: {
      minimumApplied: true,
      reason: params.reason,
      scopeKey: params.scopeKey,
      calculatedCost: round2(params.calculatedCost),
      calculatedSell: round2(params.calculatedSell),
      minimumCost: params.minimumCost,
      minimumSell: params.minimumSell,
    },
  };
}

function deriveMargins(recommendedCost: number, recommendedSell: number) {
  const grossProfit = round2(recommendedSell - recommendedCost);
  const marginPercent =
    recommendedSell > 0
      ? round2((grossProfit / recommendedSell) * 100)
      : 0;
  const markupPercent =
    recommendedCost > 0
      ? round2((grossProfit / recommendedCost) * 100)
      : 0;

  return { grossProfit, marginPercent, markupPercent };
}

export function rebuildLineItemAmounts(
  recommendedCost: number,
  recommendedSell: number,
  organisationSettings: OrganisationSettings | null
): Pick<
  EstimateLineItemInput,
  | "costLow"
  | "costHigh"
  | "sellLow"
  | "sellHigh"
  | "recommendedCost"
  | "recommendedSell"
  | "grossProfit"
  | "marginPercent"
  | "markupPercent"
> {
  const { low, high } = getRangeFactors(organisationSettings);
  const margins = deriveMargins(recommendedCost, recommendedSell);

  return {
    recommendedCost: round2(recommendedCost),
    recommendedSell: round2(recommendedSell),
    costLow: round2(recommendedCost * low),
    costHigh: round2(recommendedCost * high),
    sellLow: round2(recommendedSell * low),
    sellHigh: round2(recommendedSell * high),
    ...margins,
  };
}

export function applyAllowanceMinimumToLineItem(
  item: EstimateLineItemInput,
  params: Omit<ApplyAllowanceMinimumParams, "calculatedCost" | "calculatedSell">,
  organisationSettings: OrganisationSettings | null
): EstimateLineItemInput {
  const applied = applyAllowanceMinimum({
    calculatedCost: item.recommendedCost,
    calculatedSell: item.recommendedSell,
    ...params,
  });

  if (!applied.minimumApplied || !applied.metadata) {
    return item;
  }

  return {
    ...item,
    ...rebuildLineItemAmounts(applied.cost, applied.sell, organisationSettings),
    allowanceMinimum: applied.metadata,
  };
}

export function withCommercialMetadata(
  item: EstimateLineItemInput,
  meta: {
    quantityBasis?: QuantityBasis;
    labourMinimum?: LabourMinimumMeta;
    allowanceMinimum?: AllowanceMinimumMeta;
  }
): EstimateLineItemInput {
  return {
    ...item,
    quantityBasis: meta.quantityBasis ?? item.quantityBasis,
    labourMinimum: meta.labourMinimum ?? item.labourMinimum,
    allowanceMinimum: meta.allowanceMinimum ?? item.allowanceMinimum,
  };
}

export function createFixedLabourWithMinimums(params: {
  item: EstimateLineItemInput;
  labourMinimum: LabourMinimumMeta;
  organisationSettings: OrganisationSettings | null;
}): EstimateLineItemInput {
  const { item, labourMinimum, organisationSettings } = params;
  const costRate = item.costRate ?? 0;
  const sellRate = item.sellRate ?? 0;
  const recommendedCost = round2(labourMinimum.finalHours * costRate);
  const recommendedSell = round2(labourMinimum.finalHours * sellRate);

  return withCommercialMetadata(
    {
      ...item,
      labourHours: labourMinimum.finalHours,
      ...rebuildLineItemAmounts(
        recommendedCost,
        recommendedSell,
        organisationSettings
      ),
    },
    { labourMinimum }
  );
}

export function resolveBathroomTotalTilingArea(
  facts: EstimateFact[],
  workAreaId: string,
  effectiveArea: number,
  tilingIncluded: boolean | null
): { area: number; basis: QuantityBasis } {
  const floorArea = getNumberFact(facts, workAreaId, "bathroom.floor_tiling_area_m2");
  const wallArea = getNumberFact(facts, workAreaId, "bathroom.wall_tiling_area_m2");
  const totalDerived = getNumberFact(facts, workAreaId, "bathroom.total_tiling_area_m2");

  if (totalDerived && totalDerived > 0) {
    const formula =
      floorArea && wallArea
        ? "floor_tiling_area_m2 + wall_tiling_area_m2"
        : "bathroom.total_tiling_area_m2";
    return {
      area: totalDerived,
      basis: {
        sourceFact: "bathroom.total_tiling_area_m2",
        sourceLabel: "Total tiling area",
        quantity: totalDerived,
        unit: "m²",
        formula,
        confidence: floorArea && wallArea ? "derived" : "confirmed",
      },
    };
  }

  if (floorArea && wallArea) {
    const area = round2(floorArea + wallArea);
    return {
      area,
      basis: {
        sourceFact: "bathroom.total_tiling_area_m2",
        sourceLabel: "Total tiling area",
        quantity: area,
        unit: "m²",
        formula: "floor_tiling_area_m2 + wall_tiling_area_m2",
        confidence: "derived",
      },
    };
  }

  if (floorArea && !wallArea) {
    const assumedWall = round2(floorArea * 1.5);
    const area = round2(floorArea + assumedWall);
    return {
      area,
      basis: {
        sourceFact: "bathroom.floor_tiling_area_m2",
        sourceLabel: "Floor tiling area + assumed wall area",
        quantity: area,
        unit: "m²",
        formula: "floor_tiling_area_m2 + estimated wall tiling",
        confidence: "assumed",
      },
    };
  }

  if (wallArea) {
    return {
      area: wallArea,
      basis: {
        sourceFact: "bathroom.wall_tiling_area_m2",
        sourceLabel: "Wall tiling area",
        quantity: wallArea,
        unit: "m²",
        formula: "wall_tiling_area_m2",
        confidence: "confirmed",
      },
    };
  }

  if (tilingIncluded === false) {
    return {
      area: 0,
      basis: {
        sourceFact: "bathroom.tiling_included",
        sourceLabel: "Tiling excluded",
        quantity: 0,
        unit: "m²",
        confidence: "confirmed",
      },
    };
  }

  return {
    area: effectiveArea,
    basis: {
      sourceFact: "bathroom.area_m2",
      sourceLabel: "Bathroom floor area (fallback)",
      quantity: effectiveArea,
      unit: "m²",
      formula: "bathroom.area_m2 allowance fallback",
      confidence: "assumed",
    },
  };
}

export function resolveBathroomWaterproofingArea(
  facts: EstimateFact[],
  workAreaId: string,
  effectiveArea: number,
  tilingBasis: QuantityBasis | null
): { area: number | null; basis: QuantityBasis | null } {
  const explicit = getNumberFact(
    facts,
    workAreaId,
    "bathroom.waterproofing_area_m2"
  );
  if (explicit && explicit > 0) {
    return {
      area: explicit,
      basis: {
        sourceFact: "bathroom.waterproofing_area_m2",
        sourceLabel: "Waterproofing area",
        quantity: explicit,
        unit: "m²",
        confidence: "confirmed",
      },
    };
  }

  if (tilingBasis && tilingBasis.quantity > 0) {
    return {
      area: tilingBasis.quantity,
      basis: {
        sourceFact: tilingBasis.sourceFact,
        sourceLabel: "Wet area (tiling area proxy)",
        quantity: tilingBasis.quantity,
        unit: "m²",
        formula: tilingBasis.formula ?? "total tiling area as wet-area proxy",
        confidence: "derived",
      },
    };
  }

  const floorArea = getNumberFact(facts, workAreaId, "bathroom.floor_tiling_area_m2");
  const wallArea = getNumberFact(facts, workAreaId, "bathroom.wall_tiling_area_m2");
  if (floorArea || wallArea) {
    const area = round2((floorArea ?? 0) + (wallArea ?? 0));
    if (area > 0) {
      return {
        area,
        basis: {
          sourceFact: "bathroom.wet_area_m2",
          sourceLabel: "Wet area from tiling facts",
          quantity: area,
          unit: "m²",
          formula: "floor_tiling_area_m2 + wall_tiling_area_m2",
          confidence: "derived",
        },
      };
    }
  }

  if (effectiveArea > 0) {
    return {
      area: effectiveArea,
      basis: {
        sourceFact: "bathroom.area_m2",
        sourceLabel: "Bathroom area (minimum allowance fallback)",
        quantity: effectiveArea,
        unit: "m²",
        confidence: "assumed",
      },
    };
  }

  return { area: null, basis: null };
}

export function resolveBathroomWallLiningArea(
  facts: EstimateFact[],
  workAreaId: string,
  effectiveArea: number
): { area: number; basis: QuantityBasis } {
  const wallLiningArea = getNumberFact(
    facts,
    workAreaId,
    "bathroom.wall_lining_area_m2"
  );
  if (wallLiningArea && wallLiningArea > 0) {
    return {
      area: wallLiningArea,
      basis: {
        sourceFact: "bathroom.wall_lining_area_m2",
        sourceLabel: "Wall lining area",
        quantity: wallLiningArea,
        unit: "m²",
        confidence: "confirmed",
      },
    };
  }

  const wallTiling = getNumberFact(facts, workAreaId, "bathroom.wall_tiling_area_m2");
  if (wallTiling && wallTiling > 0) {
    return {
      area: wallTiling,
      basis: {
        sourceFact: "bathroom.wall_tiling_area_m2",
        sourceLabel: "Wall tiling area (wall lining proxy)",
        quantity: wallTiling,
        unit: "m²",
        confidence: "derived",
      },
    };
  }

  const totalTiling = getNumberFact(facts, workAreaId, "bathroom.total_tiling_area_m2");
  if (totalTiling && totalTiling > 0) {
    return {
      area: totalTiling,
      basis: {
        sourceFact: "bathroom.total_tiling_area_m2",
        sourceLabel: "Total tiling area (wall lining fallback)",
        quantity: totalTiling,
        unit: "m²",
        confidence: "assumed",
      },
    };
  }

  const perimeter = getNumberFact(facts, workAreaId, "bathroom.perimeter_m");
  const height = getNumberFact(facts, workAreaId, "bathroom.wall_height_m");
  if (perimeter && height) {
    const area = round2(perimeter * height);
    return {
      area,
      basis: {
        sourceFact: "bathroom.perimeter_m",
        sourceLabel: "Wall lining from perimeter × height",
        quantity: area,
        unit: "m²",
        formula: "perimeter_m × wall_height_m",
        confidence: "derived",
      },
    };
  }

  return {
    area: effectiveArea,
    basis: {
      sourceFact: "bathroom.area_m2",
      sourceLabel: "Bathroom floor area (fallback)",
      quantity: effectiveArea,
      unit: "m²",
      confidence: "assumed",
    },
  };
}

export function quantityBasisFrom(params: {
  sourceFact: string;
  sourceLabel: string;
  quantity: number;
  unit: string;
  formula?: string;
  confidence?: QuantityBasis["confidence"];
}): QuantityBasis {
  return {
    sourceFact: params.sourceFact,
    sourceLabel: params.sourceLabel,
    quantity: params.quantity,
    unit: params.unit,
    formula: params.formula,
    confidence: params.confidence,
  };
}

export function formatQuantityBasisDisplay(basis: QuantityBasis): string {
  const qty = `${basis.quantity} ${basis.unit}`;
  if (basis.formula && basis.confidence === "derived") {
    return `Derived from: ${basis.formula} (${qty})`;
  }
  return `Based on: ${qty} ${basis.sourceLabel.toLowerCase()}`;
}

export function formatLabourMinimumDisplay(meta: LabourMinimumMeta): string[] {
  const lines: string[] = [];
  if (meta.minimumApplied && meta.minCrewSize && meta.minDurationHours) {
    lines.push(
      `Minimum applied: ${meta.minCrewSize} people × ${meta.minDurationHours} hrs`
    );
  } else if (meta.minimumApplied && meta.minTotalHours) {
    lines.push(`Minimum applied: ${meta.minTotalHours} hrs`);
  }
  if (meta.accessLabel) {
    lines.push(`Access factor: ${meta.accessLabel}`);
  } else if (meta.accessFactor && meta.accessFactor !== 1) {
    lines.push(`Access factor: ×${meta.accessFactor}`);
  }
  if (meta.calculatedHours !== meta.finalHours) {
    lines.push(
      `Calculated ${meta.calculatedHours} hrs → ${meta.finalHours} hrs after minimums`
    );
  }
  return lines;
}

export function formatAllowanceMinimumDisplay(meta: AllowanceMinimumMeta): string {
  return meta.reason || "Minimum subcontractor allowance applied";
}

export type CommercialTrustItem = {
  quantityBasis?: QuantityBasis;
  labourMinimum?: LabourMinimumMeta;
  allowanceMinimum?: AllowanceMinimumMeta;
  pricingOwner?: PricingOwner;
  notes?: string;
};

export function getCommercialTrustDetailLines(item: CommercialTrustItem): string[] {
  const lines: string[] = [];

  if (item.quantityBasis) {
    lines.push(formatQuantityBasisDisplay(item.quantityBasis));
  }

  if (item.labourMinimum) {
    lines.push(...formatLabourMinimumDisplay(item.labourMinimum));
  }

  if (item.allowanceMinimum?.minimumApplied) {
    lines.push(formatAllowanceMinimumDisplay(item.allowanceMinimum));
  }

  const notesLower = item.notes?.toLowerCase() ?? "";
  if (
    item.pricingOwner === "client_supplied" ||
    notesLower.includes("client supplied") ||
    notesLower.includes("supply excluded")
  ) {
    lines.push("Client supplied: supply not priced");
  }

  return lines;
}

export function getCommercialTrustDetailLinesFromNotes(
  notes: string | null | undefined,
  pricingOwner?: PricingOwner
): string[] {
  const { metadata, displayNotes } = parseLineItemNotes(notes);
  return getCommercialTrustDetailLines({
    quantityBasis: metadata.quantityBasis,
    labourMinimum: metadata.labourMinimum,
    allowanceMinimum: metadata.allowanceMinimum,
    pricingOwner: pricingOwner ?? metadata.pricingOwner,
    notes: displayNotes,
  });
}

export function assertNoDuplicateEstimateLineItems(
  items: EstimateLineItemInput[]
): { duplicateLabels: string[]; duplicateOverlapGroups: string[] } {
  const labelCounts = new Map<string, number>();
  const overlapCounts = new Map<string, number>();

  for (const item of items) {
    if (item.includedInTotal === false) continue;
    labelCounts.set(item.label, (labelCounts.get(item.label) ?? 0) + 1);
    if (item.overlapGroup) {
      overlapCounts.set(
        item.overlapGroup,
        (overlapCounts.get(item.overlapGroup) ?? 0) + 1
      );
    }
  }

  const duplicateLabels = [...labelCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([label]) => label);
  const duplicateOverlapGroups = [...overlapCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([group]) => group);

  return { duplicateLabels, duplicateOverlapGroups };
}

export function lineItemRenderKey(
  item: { id?: string; workAreaName?: string; label: string; sortOrder?: number },
  index: number
): string {
  if (item.id) return item.id;
  return `${item.workAreaName ?? "item"}-${item.label}-${item.sortOrder ?? index}`;
}
