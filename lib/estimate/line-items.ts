import { round2 } from "@/lib/estimate/facts";
import {
  formatLabourAdjustmentPrimary,
  formatLabourCalculationLine,
  formatLabourHours,
} from "@/lib/estimate/builder-presentation-format";
import { shapeLabourHours } from "@/lib/estimate/labour-hours";
import { buildPersistedLineItemNotes } from "@/lib/estimate/line-item-metadata";
import { normalizeRateSourceLabel } from "@/lib/estimate/rate-source-labels";
import {
  buildAuthoritativeEstimateAmounts,
  requireEstimateLabourMoney,
  requireEstimateLumpMoney,
  requireEstimateQuantityRateMoney,
} from "@/lib/estimate/estimate-commercial-engine-adapter";
import type { OrganisationSettings } from "@/components/setup/types";
import type {
  EstimateLineItemInput,
  LineItemCategory,
} from "@/lib/estimate/types";
import type { RateSourceType } from "@/lib/estimate/rate-source-labels";
import type { SellAuthority } from "@/lib/commercial-engine/core/cost-first-authority";

/**
 * Expected money via commercial engine; low/high via org range factors (domain).
 * Batch 2B.7.
 */
export function buildAmounts(
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
  const amounts = buildAuthoritativeEstimateAmounts(
    recommendedCost,
    recommendedSell,
    organisationSettings
  );
  return {
    recommendedCost: amounts.recommendedCost,
    recommendedSell: amounts.recommendedSell,
    costLow: amounts.costLow,
    costHigh: amounts.costHigh,
    sellLow: amounts.sellLow,
    sellHigh: amounts.sellHigh,
    grossProfit: amounts.grossProfit,
    marginPercent: amounts.marginPercent,
    markupPercent: amounts.markupPercent,
  };
}

type RateMetadata = {
  rateSource: string;
  rateSourceType?: RateSourceType;
  itemKey?: string;
  costRate?: number;
  sellRate?: number;
  sellDerivedFromMargin?: boolean;
  sellAuthority?: SellAuthority;
};

function withRateMetadata(
  item: EstimateLineItemInput,
  metadata: RateMetadata
): EstimateLineItemInput {
  const rateSourceType = metadata.rateSourceType;
  return {
    ...item,
    rateSource: rateSourceType
      ? metadata.rateSource
      : normalizeRateSourceLabel(metadata.rateSource),
    rateSourceType,
    itemKey: metadata.itemKey,
    costRate: metadata.costRate,
    sellRate: metadata.sellRate,
    sellDerivedFromMargin: metadata.sellDerivedFromMargin,
    sellAuthority: metadata.sellAuthority,
  };
}

export function createLabourLineItem(params: {
  workAreaId: string;
  workAreaName: string;
  label: string;
  quantity: number;
  unit: string;
  productivityHoursPerUnit: number;
  labourCostRate: number;
  labourSellRate: number;
  adjustmentFactor?: number;
  qualityFactor?: number;
  rateSource: string;
  rateSourceType?: RateSourceType;
  itemKey?: string;
  componentKey?: string;
  sellDerivedFromMargin?: boolean;
  sellAuthority?: SellAuthority;
  notes?: string;
  adjustmentLabel?: string;
  sortOrder: number;
  organisationSettings: OrganisationSettings | null;
}): EstimateLineItemInput {
  const adjustmentFactor = params.adjustmentFactor ?? 1;
  const qualityFactor = params.qualityFactor ?? 1;
  // Domain owns hours shaping (qty × productivity × factors). Engine owns money.
  const labourHoursResult = shapeLabourHours({
    quantity: params.quantity,
    productivityHoursPerUnit: params.productivityHoursPerUnit,
    adjustmentFactor,
    qualityFactor,
  });
  const labourHours = labourHoursResult.adjustedHours;
  const money = requireEstimateLabourMoney({
    labourHours,
    labourCostRate: params.labourCostRate,
    labourSellRate: params.labourSellRate,
  });

  const adjustmentSummary =
    params.adjustmentLabel ??
    formatLabourAdjustmentPrimary(labourHoursResult.adjustmentFactor);
  const identitySummary = formatLabourCalculationLine({
    quantity: params.quantity,
    unit: params.unit,
    hoursPerUnit: params.productivityHoursPerUnit,
    adjustmentFactor: labourHoursResult.adjustmentFactor,
    adjustmentSummary,
  });
  const equation =
    labourHoursResult.adjustmentFactor !== 1
      ? `${formatLabourHours(labourHoursResult.baseHours)} base h · ${adjustmentSummary} → ${formatLabourHours(labourHours)} h`
      : `${formatLabourHours(labourHours)} h`;
  const noteParts = [equation, params.notes].filter(Boolean);

  return withRateMetadata(
    {
      workAreaId: params.workAreaId,
      workAreaName: params.workAreaName,
      label: params.label,
      category: "labour",
      quantity: params.quantity,
      unit: params.unit,
      labourHours,
      productivityRate: params.productivityHoursPerUnit,
      productivityUnit: params.unit,
      rateSource: params.rateSource,
      notes: noteParts.join(" · "),
      identitySummary,
      sortOrder: params.sortOrder,
      componentKey: params.componentKey,
      ...buildAmounts(
        money.recommendedCost,
        money.recommendedSell,
        params.organisationSettings
      ),
    },
    {
      rateSource: params.rateSource,
      rateSourceType: params.rateSourceType,
      itemKey: params.itemKey,
      costRate: params.labourCostRate,
      sellRate: params.labourSellRate,
      sellDerivedFromMargin: params.sellDerivedFromMargin,
      sellAuthority: params.sellAuthority,
    }
  );
}

export function createFixedLabourLineItem(params: {
  workAreaId: string;
  workAreaName: string;
  label: string;
  labourHours: number;
  labourCostRate: number;
  labourSellRate: number;
  rateSource: string;
  rateSourceType?: RateSourceType;
  itemKey?: string;
  sellDerivedFromMargin?: boolean;
  sellAuthority?: SellAuthority;
  notes?: string;
  sortOrder: number;
  organisationSettings: OrganisationSettings | null;
}): EstimateLineItemInput {
  const money = requireEstimateLabourMoney({
    labourHours: params.labourHours,
    labourCostRate: params.labourCostRate,
    labourSellRate: params.labourSellRate,
  });

  return withRateMetadata(
    {
      workAreaId: params.workAreaId,
      workAreaName: params.workAreaName,
      label: params.label,
      category: "labour",
      quantity: params.labourHours,
      unit: "hrs",
      labourHours: params.labourHours,
      rateSource: params.rateSource,
      notes:
        params.notes ??
        `${params.labourHours} hrs @ $${params.labourCostRate}/hr cost`,
      sortOrder: params.sortOrder,
      ...buildAmounts(
        money.recommendedCost,
        money.recommendedSell,
        params.organisationSettings
      ),
    },
    {
      rateSource: params.rateSource,
      rateSourceType: params.rateSourceType,
      itemKey: params.itemKey,
      costRate: params.labourCostRate,
      sellRate: params.labourSellRate,
      sellDerivedFromMargin: params.sellDerivedFromMargin,
      sellAuthority: params.sellAuthority,
    }
  );
}

export function createRateLineItem(params: {
  workAreaId: string;
  workAreaName: string;
  label: string;
  category: LineItemCategory;
  quantity: number;
  unit: string;
  costRate: number;
  sellRate: number;
  costRateLow?: number;
  costRateHigh?: number;
  sellRateLow?: number;
  sellRateHigh?: number;
  rateSource: string;
  rateSourceType?: RateSourceType;
  itemKey?: string;
  componentKey?: string;
  sellDerivedFromMargin?: boolean;
  sellAuthority?: SellAuthority;
  notes?: string;
  sortOrder: number;
  organisationSettings: OrganisationSettings | null;
  qualityFactor?: number;
}): EstimateLineItemInput {
  const qualityFactor = params.qualityFactor ?? 1;
  // Domain applies quality to quantity; engine multiplies qty × rates.
  const effectiveQuantity = round2(params.quantity * qualityFactor);
  const money = requireEstimateQuantityRateMoney({
    quantity: effectiveQuantity,
    unitCost: params.costRate,
    unitSell: params.sellRate,
  });

  return withRateMetadata(
    {
      workAreaId: params.workAreaId,
      workAreaName: params.workAreaName,
      label: params.label,
      category: params.category,
      quantity: params.quantity,
      unit: params.unit,
      rateSource: params.rateSource,
      notes:
        params.notes ??
        `${params.quantity} ${params.unit} × $${params.costRate}/${params.unit} cost`,
      sortOrder: params.sortOrder,
      componentKey: params.componentKey,
      ...buildAmounts(
        money.recommendedCost,
        money.recommendedSell,
        params.organisationSettings
      ),
    },
    {
      rateSource: params.rateSource,
      rateSourceType: params.rateSourceType,
      itemKey: params.itemKey,
      costRate: params.costRate,
      sellRate: params.sellRate,
      sellDerivedFromMargin: params.sellDerivedFromMargin,
      sellAuthority: params.sellAuthority,
    }
  );
}

export function createAllowanceLineItem(params: {
  workAreaId: string;
  workAreaName: string;
  label: string;
  category?: LineItemCategory;
  recommendedCost: number;
  recommendedSell: number;
  rateSource: string;
  rateSourceType?: RateSourceType;
  itemKey?: string;
  componentKey?: string;
  sellDerivedFromMargin?: boolean;
  sellAuthority?: SellAuthority;
  notes?: string;
  sortOrder: number;
  organisationSettings: OrganisationSettings | null;
  qualityFactor?: number;
  quantity?: number;
  unit?: string;
  unitCost?: number;
  unitSell?: number;
}): EstimateLineItemInput {
  const qualityFactor = params.qualityFactor ?? 1;
  const recommendedCost = round2(params.recommendedCost * qualityFactor);
  const recommendedSell = round2(params.recommendedSell * qualityFactor);
  const money = requireEstimateLumpMoney({
    totalCost: recommendedCost,
    totalSell: recommendedSell,
  });
  const quantity = params.quantity ?? 1;
  const unit = params.unit ?? "allow";

  return withRateMetadata(
    {
      workAreaId: params.workAreaId,
      workAreaName: params.workAreaName,
      label: params.label,
      category: params.category ?? "allowance",
      quantity,
      unit,
      rateSource: params.rateSource,
      notes: params.notes,
      sortOrder: params.sortOrder,
      componentKey: params.componentKey,
      ...buildAmounts(
        money.recommendedCost,
        money.recommendedSell,
        params.organisationSettings
      ),
    },
    {
      rateSource: params.rateSource,
      rateSourceType: params.rateSourceType,
      itemKey: params.itemKey,
      costRate: params.unitCost ?? params.recommendedCost,
      sellRate: params.unitSell ?? params.recommendedSell,
      sellDerivedFromMargin: params.sellDerivedFromMargin,
      sellAuthority: params.sellAuthority,
    }
  );
}

export function buildLineItemNotes(item: EstimateLineItemInput): string | null {
  return buildPersistedLineItemNotes({
    notes: item.notes,
    metadata: {
      quantity: item.quantity,
      unit: item.unit,
      labourHours: item.labourHours,
      productivityRate: item.productivityRate,
      productivityUnit: item.productivityUnit,
      itemKey: item.itemKey,
      costRate: item.costRate,
      sellRate: item.sellRate,
      rateSourceType: item.rateSourceType,
      sellDerivedFromMargin: item.sellDerivedFromMargin,
      sellAuthority: item.sellAuthority,
      materialBuildUp: item.materialBuildUp,
      materialBuildUps:
        item.materialBuildUps ??
        (item.materialBuildUp ? [item.materialBuildUp] : undefined),
      materialRateResolution: item.materialRateResolution,
      pricingOwner: item.pricingOwner,
      scopeKey: item.scopeKey,
      overlapGroup: item.overlapGroup,
      includedInTotal: item.includedInTotal,
      clientVisible: item.clientVisible,
      pricingSource: item.pricingSource,
      quantityBasis: item.quantityBasis,
      labourMinimum: item.labourMinimum,
      allowanceMinimum: item.allowanceMinimum,
    },
  });
}
