import {
  MAX_GROSS_MARGIN_PERCENT,
  MIN_GROSS_MARGIN_PERCENT,
} from "../versioning";
import { isFiniteNumber } from "../core/money";
import type { CalculationLineInput, ValidationIssue } from "../core/types";

function moneyFieldIssue(
  field: string,
  value: number | null | undefined,
  allowZero: boolean
): ValidationIssue | null {
  if (value == null) return null;
  if (!isFiniteNumber(value)) {
    return {
      code: "non_finite",
      message: `${field} must be a finite number.`,
      field,
    };
  }
  if (value < 0) {
    return {
      code: "negative_not_allowed",
      message: `${field} cannot be negative. Credits are out of MVP scope.`,
      field,
    };
  }
  if (!allowZero && value === 0) {
    return null;
  }
  return null;
}

/**
 * Validate line input before calculation.
 * Does not invent values; returns errors for invalid combinations.
 */
export function validateLineInput(
  input: CalculationLineInput
): ValidationIssue[] {
  const errors: ValidationIssue[] = [];

  if (
    input.mode !== "quantity_rate" &&
    input.mode !== "productivity_labour" &&
    input.mode !== "lump_sum"
  ) {
    errors.push({
      code: "invalid_mode",
      message: "Calculation mode must be quantity_rate, productivity_labour, or lump_sum.",
      field: "mode",
    });
    return errors;
  }

  const moneyFields: Array<[string, number | null | undefined]> = [
    ["quantity", input.quantity],
    ["unit_cost", input.unit_cost],
    ["unit_sell", input.unit_sell],
    ["total_cost", input.total_cost],
    ["total_sell", input.total_sell],
    ["productivity_rate", input.productivity_rate],
    ["calculated_quantity", input.calculated_quantity],
    ["waste_percent", input.waste_percent],
    ["target_gross_margin_percent", input.target_gross_margin_percent],
  ];

  for (const [field, value] of moneyFields) {
    const issue = moneyFieldIssue(field, value, true);
    if (issue) errors.push(issue);
  }

  if (input.target_gross_margin_percent != null) {
    const m = input.target_gross_margin_percent;
    if (
      isFiniteNumber(m) &&
      (m < MIN_GROSS_MARGIN_PERCENT || m > MAX_GROSS_MARGIN_PERCENT)
    ) {
      errors.push({
        code: "margin_out_of_bounds",
        message: `Gross margin must be between ${MIN_GROSS_MARGIN_PERCENT}% and ${MAX_GROSS_MARGIN_PERCENT}%.`,
        field: "target_gross_margin_percent",
      });
    }
  }

  if (input.waste_percent != null && isFiniteNumber(input.waste_percent)) {
    if (input.waste_percent < 0 || input.waste_percent > 50) {
      errors.push({
        code: "waste_out_of_bounds",
        message: "Waste percent must be between 0 and 50.",
        field: "waste_percent",
      });
    }
  }

  if (input.mode === "quantity_rate") {
    const qty = input.quantity;
    if (qty == null || !isFiniteNumber(qty) || qty <= 0) {
      errors.push({
        code: "quantity_required",
        message: "quantity_rate requires quantity greater than 0.",
        field: "quantity",
      });
    }
    const hasCostRate = input.unit_cost != null && isFiniteNumber(input.unit_cost);
    const hasSellRate = input.unit_sell != null && isFiniteNumber(input.unit_sell);
    const hasMargin =
      input.target_gross_margin_percent != null &&
      isFiniteNumber(input.target_gross_margin_percent);
    if (!hasCostRate && !hasSellRate) {
      errors.push({
        code: "rates_required",
        message: "quantity_rate requires unit_cost and/or unit_sell.",
        field: "unit_cost",
      });
    }
    if (hasCostRate && !hasSellRate && !hasMargin) {
      errors.push({
        code: "sell_or_margin_required",
        message:
          "quantity_rate with unit_cost but no unit_sell requires target_gross_margin_percent to derive sell.",
        field: "target_gross_margin_percent",
      });
    }
  }

  if (input.mode === "productivity_labour") {
    const hasHours =
      (input.calculated_quantity != null &&
        isFiniteNumber(input.calculated_quantity) &&
        input.calculated_quantity > 0) ||
      (input.quantity != null &&
        isFiniteNumber(input.quantity) &&
        input.quantity > 0 &&
        input.productivity_rate != null &&
        isFiniteNumber(input.productivity_rate) &&
        input.productivity_rate > 0);

    if (!hasHours) {
      errors.push({
        code: "hours_required",
        message:
          "productivity_labour requires calculated_quantity (hours) or quantity × productivity_rate.",
        field: "calculated_quantity",
      });
    }

    const hasCostRate = input.unit_cost != null && isFiniteNumber(input.unit_cost);
    const hasSellRate = input.unit_sell != null && isFiniteNumber(input.unit_sell);
    const hasMargin =
      input.target_gross_margin_percent != null &&
      isFiniteNumber(input.target_gross_margin_percent);

    if (!hasCostRate && !hasSellRate) {
      errors.push({
        code: "hourly_rates_required",
        message: "productivity_labour requires unit_cost and/or unit_sell hourly rates.",
        field: "unit_cost",
      });
    }
    if (hasCostRate && !hasSellRate && !hasMargin) {
      errors.push({
        code: "sell_or_margin_required",
        message:
          "productivity_labour with unit_cost but no unit_sell requires target_gross_margin_percent.",
        field: "target_gross_margin_percent",
      });
    }
  }

  if (input.mode === "lump_sum") {
    if (input.total_sell == null || !isFiniteNumber(input.total_sell)) {
      errors.push({
        code: "lump_sell_required",
        message: "lump_sum requires total_sell (finite, ≥ 0).",
        field: "total_sell",
      });
    }
    if (input.total_cost != null && !isFiniteNumber(input.total_cost)) {
      errors.push({
        code: "lump_cost_invalid",
        message: "lump_sum total_cost must be finite when provided.",
        field: "total_cost",
      });
    }
  }

  return errors;
}
