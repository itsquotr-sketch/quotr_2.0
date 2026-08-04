import {
  MAX_GROSS_MARGIN_PERCENT,
  MIN_GROSS_MARGIN_PERCENT,
} from "../versioning";
import { isFiniteNumber, roundMoney } from "./money";

export class InvalidGrossMarginError extends Error {
  constructor(marginPercent: number) {
    super(
      `Invalid gross margin percent: ${marginPercent}. Must be between ${MIN_GROSS_MARGIN_PERCENT}% and ${MAX_GROSS_MARGIN_PERCENT}% inclusive.`
    );
    this.name = "InvalidGrossMarginError";
  }
}

/**
 * Sell from cost using gross margin (F-SFM):
 * sell = round2(cost / (1 - m/100))
 */
export function deriveSellFromCost(
  cost: number,
  marginPercent: number
): number {
  if (!isFiniteNumber(cost) || cost < 0) {
    throw new InvalidGrossMarginError(marginPercent);
  }
  if (
    !isFiniteNumber(marginPercent) ||
    marginPercent < MIN_GROSS_MARGIN_PERCENT ||
    marginPercent > MAX_GROSS_MARGIN_PERCENT
  ) {
    throw new InvalidGrossMarginError(marginPercent);
  }
  const divisor = 1 - marginPercent / 100;
  if (divisor <= 0) {
    throw new InvalidGrossMarginError(marginPercent);
  }
  return roundMoney(cost / divisor);
}
