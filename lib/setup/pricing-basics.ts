/**
 * First-run pricing basics — labour cost + target gross margin.
 * Writes into existing rates / organisation_settings. No parallel store.
 */

import { CORE_LABOUR_STARTER_RATES } from "@/lib/setup/starter-rates";
import { DEFAULT_MARGIN_PERCENT } from "@/lib/estimate/constants";
import {
  MAX_GROSS_MARGIN_PERCENT,
  MIN_GROSS_MARGIN_PERCENT,
  validateMarginPercent,
} from "@/lib/security/margin-validation";

/** Canonical company labour row for onboarding: carpenter / builder hourly cost. */
export const ONBOARDING_LABOUR_RATE = CORE_LABOUR_STARTER_RATES[0];

export const PRICING_BASICS_DEFAULT_MARGIN = DEFAULT_MARGIN_PERCENT;

export function parseOptionalLabourCost(
  value: string | number | null | undefined
): { skip: true } | { skip: false; costRate: number } | { error: string } {
  if (value == null) return { skip: true };
  const raw = typeof value === "number" ? String(value) : value.trim();
  if (raw === "") return { skip: true };
  const costRate = Number(raw);
  if (!Number.isFinite(costRate) || costRate <= 0) {
    return { error: "Enter a labour cost greater than 0, or skip this for now." };
  }
  if (costRate > 10000) {
    return { error: "Labour cost looks too high. Check the hourly amount." };
  }
  return { skip: false, costRate };
}

export function parseOptionalTargetMargin(
  value: string | number | null | undefined
): { skip: true } | { skip: false; marginPercent: number } | { error: string } {
  if (value == null) return { skip: true };
  const raw = typeof value === "number" ? String(value) : value.trim();
  if (raw === "") return { skip: true };
  const marginPercent = Number(raw);
  const valid = validateMarginPercent(marginPercent);
  if (!valid.ok) {
    return {
      error: `Target gross margin must be between ${MIN_GROSS_MARGIN_PERCENT}% and ${MAX_GROSS_MARGIN_PERCENT}%.`,
    };
  }
  return { skip: false, marginPercent };
}

export function skippedMarginFallsBackTo(): number {
  return PRICING_BASICS_DEFAULT_MARGIN;
}
