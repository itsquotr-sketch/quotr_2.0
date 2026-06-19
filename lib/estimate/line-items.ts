import { round2 } from "@/lib/estimate/facts";
import { getRangeFactors } from "@/lib/estimate/rates";
import type { OrganisationSettings } from "@/components/setup/types";
import type {
  EstimateLineItemInput,
  LineItemCategory,
} from "@/lib/estimate/types";

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

function buildAmounts(
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
  notes?: string;
  sortOrder: number;
  organisationSettings: OrganisationSettings | null;
}): EstimateLineItemInput {
  const adjustmentFactor = params.adjustmentFactor ?? 1;
  const qualityFactor = params.qualityFactor ?? 1;
  const labourHours = round2(
    params.quantity * params.productivityHoursPerUnit * adjustmentFactor * qualityFactor
  );
  const recommendedCost = round2(labourHours * params.labourCostRate);
  const recommendedSell = round2(labourHours * params.labourSellRate);

  const noteParts = [
    `${params.quantity} ${params.unit} × ${params.productivityHoursPerUnit} hrs/${params.unit} = ${labourHours} hrs`,
    params.notes,
  ].filter(Boolean);

  return {
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
    sortOrder: params.sortOrder,
    ...buildAmounts(
      recommendedCost,
      recommendedSell,
      params.organisationSettings
    ),
  };
}

export function createFixedLabourLineItem(params: {
  workAreaId: string;
  workAreaName: string;
  label: string;
  labourHours: number;
  labourCostRate: number;
  labourSellRate: number;
  rateSource: string;
  notes?: string;
  sortOrder: number;
  organisationSettings: OrganisationSettings | null;
}): EstimateLineItemInput {
  const recommendedCost = round2(params.labourHours * params.labourCostRate);
  const recommendedSell = round2(params.labourHours * params.labourSellRate);

  return {
    workAreaId: params.workAreaId,
    workAreaName: params.workAreaName,
    label: params.label,
    category: "labour",
    labourHours: params.labourHours,
    rateSource: params.rateSource,
    notes:
      params.notes ??
      `${params.labourHours} hrs @ $${params.labourCostRate}/hr cost`,
    sortOrder: params.sortOrder,
    ...buildAmounts(
      recommendedCost,
      recommendedSell,
      params.organisationSettings
    ),
  };
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
  notes?: string;
  sortOrder: number;
  organisationSettings: OrganisationSettings | null;
  qualityFactor?: number;
}): EstimateLineItemInput {
  const qualityFactor = params.qualityFactor ?? 1;
  const recommendedCost = round2(
    params.quantity * params.costRate * qualityFactor
  );
  const recommendedSell = round2(
    params.quantity * params.sellRate * qualityFactor
  );
  const amounts = buildAmounts(
    recommendedCost,
    recommendedSell,
    params.organisationSettings
  );

  return {
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
    ...amounts,
  };
}

export function createAllowanceLineItem(params: {
  workAreaId: string;
  workAreaName: string;
  label: string;
  category?: LineItemCategory;
  recommendedCost: number;
  recommendedSell: number;
  rateSource: string;
  notes?: string;
  sortOrder: number;
  organisationSettings: OrganisationSettings | null;
  qualityFactor?: number;
}): EstimateLineItemInput {
  const qualityFactor = params.qualityFactor ?? 1;
  const recommendedCost = round2(params.recommendedCost * qualityFactor);
  const recommendedSell = round2(params.recommendedSell * qualityFactor);

  return {
    workAreaId: params.workAreaId,
    workAreaName: params.workAreaName,
    label: params.label,
    category: params.category ?? "allowance",
    rateSource: params.rateSource,
    notes: params.notes,
    sortOrder: params.sortOrder,
    ...buildAmounts(
      recommendedCost,
      recommendedSell,
      params.organisationSettings
    ),
  };
}

export function buildLineItemNotes(item: EstimateLineItemInput): string | null {
  const parts: string[] = [];
  if (item.notes) parts.push(item.notes);
  if (item.labourHours != null) {
    parts.push(`${item.labourHours} labour hrs`);
  }
  if (item.quantity != null && item.unit) {
    parts.push(`${item.quantity} ${item.unit}`);
  }
  const joined = parts.join(" · ");
  return joined || null;
}
