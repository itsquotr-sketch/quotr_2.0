import { SUBCONTRACTOR_RATE_UNITS, type SubcontractorRateUnit } from "@/lib/subcontractors/rate-book";

/** A work-area match is a suggestion. These checks decide whether a rate can be used. */

export type RateUseRefusal =
  | "QUANTITY"
  | "UNIT"
  | "CURRENCY"
  | "EXPIRED"
  | "NOT_CURRENT"
  | "RETIRED";

export function canonicalRateUnit(unit: string | null | undefined): SubcontractorRateUnit | null {
  const value = (unit ?? "").trim().toLowerCase().replace("²", "2").replace(/\s+/g, " ");
  if (value === "m2" || value === "sqm" || value === "sq m" || value === "square metre" || value === "square meter") return "m2";
  if (value === "m" || value === "lm" || value === "lineal metre" || value === "lineal meter") return "m";
  if (value === "item" || value === "each" || value === "no" || value === "nr") return "item";
  if (value === "hour" || value === "hours" || value === "hr" || value === "hrs") return "hour";
  if (value === "lump_sum" || value === "lump sum" || value === "allowance" || value === "ls") return "lump_sum";
  return (SUBCONTRACTOR_RATE_UNITS as readonly string[]).includes(value) ? (value as SubcontractorRateUnit) : null;
}

export function unitsAreCompatible(rateUnit: string, itemUnit: string | null | undefined): boolean {
  const rate = canonicalRateUnit(rateUnit);
  const item = canonicalRateUnit(itemUnit);
  return rate != null && item != null && rate === item;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Unit rates multiply once. A minimum replaces that product once.
 * A lump sum is the cost once. Quantity never multiplies it.
 */
export function supplierCostFromRate(input: {
  unit: string;
  unitCostExGst: number;
  minimumCharge: number | null;
  quantity: number | null;
}): { ok: true; costExGst: number; quantityUsed: number | null; minimumApplied: boolean } | { ok: false; code: "QUANTITY" | "UNIT" } {
  const unit = canonicalRateUnit(input.unit);
  if (!unit) return { ok: false, code: "UNIT" };
  if (!Number.isFinite(input.unitCostExGst) || input.unitCostExGst < 0) return { ok: false, code: "QUANTITY" };
  if (unit === "lump_sum") {
    if (input.quantity != null && (!Number.isFinite(input.quantity) || input.quantity < 0)) {
      return { ok: false, code: "QUANTITY" };
    }
    return { ok: true, costExGst: round2(input.unitCostExGst), quantityUsed: null, minimumApplied: false };
  }
  if (input.quantity == null || !Number.isFinite(input.quantity) || input.quantity <= 0) {
    return { ok: false, code: "QUANTITY" };
  }
  const extended = round2(input.unitCostExGst * input.quantity);
  const minimum = input.minimumCharge == null ? null : round2(input.minimumCharge);
  const minimumApplied = minimum != null && minimum > extended;
  return {
    ok: true,
    costExGst: minimumApplied ? minimum : extended,
    quantityUsed: round2(input.quantity),
    minimumApplied,
  };
}

function normaliseScope(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** Equality, or one scope containing the other when both are specific enough to mean the same work. */
export function rateScopeConflictsWithResponse(
  rateScope: string,
  includedScope: string | null | undefined,
  scopeLabel: string | null | undefined
): boolean {
  const rate = normaliseScope(rateScope);
  if (!rate) return false;
  return [includedScope, scopeLabel].some((candidate) => {
    const other = normaliseScope(candidate);
    if (!other) return false;
    if (rate === other) return true;
    if (rate.length < 8 || other.length < 8) return false;
    return rate.includes(other) || other.includes(rate);
  });
}

export function rateVersionUsable(input: {
  retired: boolean;
  currency: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  today: string;
}): { ok: true } | { ok: false; code: RateUseRefusal } {
  if (input.retired) return { ok: false, code: "RETIRED" };
  if (input.currency.trim().toUpperCase() !== "NZD") return { ok: false, code: "CURRENCY" };
  const from = input.effectiveFrom.slice(0, 10);
  const until = input.effectiveUntil ? input.effectiveUntil.slice(0, 10) : null;
  if (until && until < input.today) return { ok: false, code: "EXPIRED" };
  if (from > input.today) return { ok: false, code: "NOT_CURRENT" };
  return { ok: true };
}

export const RATE_RECONCILIATION_REQUIRED =
  "Choose whether to keep the supplier rate before updating pricing from the estimate.";
