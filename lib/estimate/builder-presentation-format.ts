/**
 * Shared Builder Review / labour-line presentation formatting.
 * Display only — does not change commercial money.
 *
 * NEVER render raw binary floats such as 1.1500000000000001.
 */

import { round2, round3 } from "@/lib/estimate/facts";
import type { LabourAdjustmentParts } from "@/lib/estimate/adjustments";

export function formatQuantity(value: number, maxDecimals = 2): string {
  if (!Number.isFinite(value)) return "—";
  const factor = 10 ** Math.max(0, maxDecimals);
  const rounded = Math.round(value * factor) / factor;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded);
}

/** Labour hours: always 2 decimals. */
export function formatLabourHours(hours: number): string {
  if (!Number.isFinite(hours)) return "—";
  return round2(hours).toFixed(2);
}

/** Productivity: up to 3 decimals, trailing zeros stripped. */
export function formatProductivity(hoursPerUnit: number): string {
  if (!Number.isFinite(hoursPerUnit)) return "—";
  const rounded = round3(hoursPerUnit);
  if (Number.isInteger(rounded)) return `${rounded}`;
  return String(rounded);
}

/** Linear metres: 1 decimal when not whole (150.0 → 150, 54.6 stays 54.6). */
export function formatLm(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}.0` : String(rounded);
}

export function formatAdjustmentPercent(factor: number): string {
  if (!Number.isFinite(factor) || factor === 1) return "";
  const pct = Math.round((factor - 1) * 100);
  if (pct === 0) return "";
  return pct > 0 ? `+${pct}%` : `${pct}%`;
}

/**
 * Primary-row adjustment copy.
 * Combined access+carry is one modifier: "+15% access/carry".
 */
export function formatLabourAdjustmentPrimary(
  factor: number,
  parts?: LabourAdjustmentParts | null
): string {
  if (parts) {
    const accessCarry = parts.accessAddend + parts.carryAddend;
    const bits: string[] = [];
    if (accessCarry > 0) {
      bits.push(`+${Math.round(accessCarry * 100)}% access/carry`);
    }
    if (parts.slopeAddend > 0) {
      bits.push(`+${Math.round(parts.slopeAddend * 100)}% slope`);
    }
    if (parts.occupiedAddend > 0) {
      bits.push(`+${Math.round(parts.occupiedAddend * 100)}% occupied`);
    }
    if (parts.hoursAddend > 0) {
      bits.push(`+${Math.round(parts.hoursAddend * 100)}% hours`);
    }
    if (bits.length > 0) return bits.join(" · ");
  }
  const pct = formatAdjustmentPercent(factor);
  return pct ? `${pct} access/carry` : "";
}

/** Expanded detail: Site access +10% / Carry +5%. */
export function formatLabourAdjustmentDetail(
  parts: LabourAdjustmentParts
): string {
  const bits: string[] = [];
  if (parts.accessAddend > 0) {
    bits.push(`Site access +${Math.round(parts.accessAddend * 100)}%`);
  }
  if (parts.carryAddend > 0) {
    bits.push(`Carry +${Math.round(parts.carryAddend * 100)}%`);
  }
  if (parts.slopeAddend > 0) {
    bits.push(`Site slope +${Math.round(parts.slopeAddend * 100)}%`);
  }
  if (parts.occupiedAddend > 0) {
    bits.push(`Occupied site +${Math.round(parts.occupiedAddend * 100)}%`);
  }
  if (parts.hoursAddend > 0) {
    bits.push(`Restricted hours +${Math.round(parts.hoursAddend * 100)}%`);
  }
  return bits.join(" · ");
}

export function formatRequiredPurchased(params: {
  required: number;
  purchased: number;
  unit: string;
  wastePercent?: number | null;
}): string {
  const req = params.unit === "lm" ? formatLm(params.required) : formatQuantity(params.required);
  const purch =
    params.unit === "lm" ? formatLm(params.purchased) : formatQuantity(params.purchased);
  const same = Math.abs(params.required - params.purchased) < 0.005;
  if (same) {
    return `${req} ${params.unit}`;
  }
  const waste =
    params.wastePercent != null && params.wastePercent > 0
      ? ` · ${formatQuantity(params.wastePercent, 1)}% waste`
      : "";
  return `${req} ${params.unit} required · ${purch} ${params.unit} purchased${waste}`;
}

export function formatLabourCalculationLine(params: {
  quantity: number;
  unit: string;
  hoursPerUnit: number;
  adjustmentFactor: number;
  adjustmentSummary?: string | null;
}): string {
  const qty =
    params.unit === "lm"
      ? formatLm(params.quantity)
      : formatQuantity(params.quantity);
  const prod = formatProductivity(params.hoursPerUnit);
  const adj =
    params.adjustmentSummary?.trim() ||
    formatLabourAdjustmentPrimary(params.adjustmentFactor);
  const core = `${qty} ${params.unit} × ${prod} h/${params.unit}`;
  return adj ? `${core} · ${adj}` : core;
}
