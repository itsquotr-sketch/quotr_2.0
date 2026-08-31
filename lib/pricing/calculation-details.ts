import { getMaterialBuildUps, parseLineItemNotes } from "@/lib/estimate/line-item-metadata";
import { getRateSourceLabel } from "@/lib/estimate/rate-source-labels";
import { formatPricingMoney, formatPricingPercent } from "@/lib/pricing/format";
import { inferCalculationMode } from "@/lib/pricing/pricing-item-calculation";
import type { PricingItem } from "@/lib/pricing/types";

export type CalculationDetailRow = {
  label: string;
  value: string;
};

export type PricingCalculationDetails = {
  kind: "material" | "labour" | "other";
  rows: CalculationDetailRow[];
};

function formatDetailNumber(value: number, maxFractionDigits = 3): string {
  return new Intl.NumberFormat("en-NZ", {
    maximumFractionDigits: maxFractionDigits,
    minimumFractionDigits: 0,
  }).format(value);
}

function formatQty(value: number, unit: string | null | undefined): string {
  const qty = formatDetailNumber(value);
  const trimmedUnit = unit?.trim();
  return trimmedUnit ? `${qty} ${trimmedUnit}` : qty;
}

function firstFiniteNumber(
  ...values: Array<number | null | undefined>
): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function rateSourceLabelFromNotes(notes: string | null): string | null {
  const { metadata } = parseLineItemNotes(notes);
  if (metadata.materialRateResolution?.display?.trim()) {
    return metadata.materialRateResolution.display.trim();
  }
  if (metadata.rateSourceType) {
    return getRateSourceLabel(metadata.rateSourceType);
  }
  return null;
}

/**
 * Explanatory rows only. Uses persisted item fields + stored metadata.
 * Does not recompute commercial totals.
 */
export function buildPricingCalculationDetails(
  item: PricingItem
): PricingCalculationDetails | null {
  const mode = inferCalculationMode({
    calculationMode: item.calculation_mode,
    quantity: item.quantity,
    unitCost: item.unit_cost,
    unitSell: item.unit_sell,
    totalCost: item.total_cost,
    totalSell: item.total_sell,
    productivityRate: item.productivity_rate,
    calculatedQuantity: item.calculated_quantity,
    itemType: item.item_type,
  });

  const { metadata } = parseLineItemNotes(item.notes_internal);
  const buildUps = getMaterialBuildUps(item.notes_internal);
  const primaryBuildUp = buildUps[0];
  const rows: CalculationDetailRow[] = [];

  if (mode === "productivity_labour" || item.item_type === "labour") {
    if (item.quantity != null) {
      rows.push({
        label: "Installed quantity",
        value: formatQty(item.quantity, item.unit),
      });
    }
    if (item.productivity_rate != null) {
      const unit = item.productivity_unit?.trim() || item.unit;
      rows.push({
        label: "Productivity",
        value: unit
          ? `${formatDetailNumber(item.productivity_rate, 4)} person-hours/${unit}`
          : formatDetailNumber(item.productivity_rate, 4),
      });
    }
    if (item.calculated_quantity != null) {
      rows.push({
        label: "Calculated labour",
        value: `${formatDetailNumber(item.calculated_quantity, 2)} hours`,
      });
    } else if (metadata.labourHours != null) {
      rows.push({
        label: "Calculated labour",
        value: `${formatDetailNumber(metadata.labourHours, 2)} hours`,
      });
    }
    if (item.unit_cost != null) {
      rows.push({
        label: "Labour rate",
        value: `${formatPricingMoney(item.unit_cost)}/hour`,
      });
    }
    if (item.cost_known) {
      rows.push({
        label: "Gross margin",
        value: formatPricingPercent(item.margin_percent),
      });
    }
    return rows.length > 0 ? { kind: "labour", rows } : null;
  }

  if (item.item_type === "material" || primaryBuildUp) {
    const required = firstFiniteNumber(
      typeof primaryBuildUp?.outputs?.baseLm === "number"
        ? primaryBuildUp.outputs.baseLm
        : null,
      typeof primaryBuildUp?.outputs?.baseAreaM2 === "number"
        ? primaryBuildUp.outputs.baseAreaM2
        : null,
      typeof primaryBuildUp?.outputs?.baseSheetCount === "number"
        ? primaryBuildUp.outputs.baseSheetCount
        : null,
      metadata.quantityBasis?.quantity
    );
    const purchased = firstFiniteNumber(
      typeof primaryBuildUp?.outputs?.totalLm === "number"
        ? primaryBuildUp.outputs.totalLm
        : null,
      typeof primaryBuildUp?.outputs?.totalAreaM2 === "number"
        ? primaryBuildUp.outputs.totalAreaM2
        : null,
      typeof primaryBuildUp?.outputs?.totalSheetCount === "number"
        ? primaryBuildUp.outputs.totalSheetCount
        : null,
      primaryBuildUp?.quantity,
      item.quantity
    );
    const unit =
      primaryBuildUp?.unit ??
      metadata.quantityBasis?.unit ??
      item.unit;

    if (required != null) {
      rows.push({
        label: "Required quantity",
        value: formatQty(required, unit),
      });
    }
    if (purchased != null && (required == null || purchased !== required)) {
      rows.push({
        label: "Purchased quantity",
        value: formatQty(purchased, unit),
      });
    } else if (purchased != null && required == null) {
      rows.push({
        label: "Quantity",
        value: formatQty(purchased, unit),
      });
    }

    const waste = firstFiniteNumber(
      primaryBuildUp?.wastagePercent,
      typeof primaryBuildUp?.inputs?.wastagePercent === "number"
        ? primaryBuildUp.inputs.wastagePercent
        : null
    );
    if (waste != null) {
      rows.push({
        label: "Waste",
        value: `${formatDetailNumber(waste, 1)}%`,
      });
    }

    if (item.unit_cost != null) {
      const rateUnit = primaryBuildUp?.rateUnit ?? item.unit;
      rows.push({
        label: "Rate",
        value: rateUnit
          ? `${formatPricingMoney(item.unit_cost)}/${rateUnit}`
          : formatPricingMoney(item.unit_cost),
      });
    }

    const rateSource = rateSourceLabelFromNotes(item.notes_internal);
    if (rateSource) {
      rows.push({ label: "Rate source", value: rateSource });
    } else if (metadata.rateSourceType) {
      rows.push({
        label: "Rate source",
        value: getRateSourceLabel(metadata.rateSourceType),
      });
    }

    if (item.cost_known) {
      rows.push({
        label: "Gross margin",
        value: formatPricingPercent(item.margin_percent),
      });
    }

    return rows.length > 0 ? { kind: "material", rows } : null;
  }

  if (item.quantity != null) {
    rows.push({
      label: "Quantity",
      value: formatQty(item.quantity, item.unit),
    });
  }
  if (item.unit_cost != null) {
    rows.push({
      label: "Unit cost",
      value: item.unit
        ? `${formatPricingMoney(item.unit_cost)}/${item.unit}`
        : formatPricingMoney(item.unit_cost),
    });
  }
  const rateSource = rateSourceLabelFromNotes(item.notes_internal);
  if (rateSource) {
    rows.push({ label: "Rate source", value: rateSource });
  }
  if (item.cost_known) {
    rows.push({
      label: "Gross margin",
      value: formatPricingPercent(item.margin_percent),
    });
  }

  return rows.length > 0 ? { kind: "other", rows } : null;
}
