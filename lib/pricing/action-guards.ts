import type { ZodType } from "zod";
import type { AuthOrgResult } from "@/lib/security/auth-org-context";
import {
  updatePricingItemInputSchema,
  derivedCommercialPercentsSchema,
  type PricingItemInputParsed,
} from "@/lib/pricing/schemas";

/**
 * Pricing action guard helpers (Batch 2A.3A).
 *
 * Guard sequence for financial item mutations (including lump_sum):
 * 1. Runtime schema validation (Batch 2A.2 schemas) — before any load/write
 * 2. requireAuthOrgContext()
 * 3. Shared ownership asserts
 * 4. Existing calculatePricingItemTotals / persistence (unchanged arithmetic)
 * 5. Validate derived margin/markup bounds + finite non-negative totals before write
 * 6. Persist, then best-effort audit log (audit failure does not roll back item write)
 *
 * forwardTotalsMatchStored may still bypass quantity×rate cross-checks for
 * lump_sum; authoritative validation above runs before that path.
 */

export function firstZodErrorMessage(
  error: { issues: Array<{ message: string }> },
  fallback = "Invalid pricing input."
): string {
  return error.issues[0]?.message ?? fallback;
}

export function pricingAuthFailure(
  auth: AuthOrgResult
): { error: string } | null {
  if (auth.ok) {
    return null;
  }
  return { error: auth.error };
}

export function parsePricingInput<T>(
  schema: ZodType<T>,
  input: unknown,
  fallback = "Invalid pricing input."
): { ok: true; data: T } | { ok: false; error: string } {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error, fallback) };
  }
  return { ok: true, data: parsed.data };
}

/**
 * Pre-persistence schema guard for updatePricingItem.
 * Runs before ownership loads and before calculatePricingItemTotals.
 */
export function validateUpdatePricingItemPayload(
  pricingItemId: unknown,
  item: unknown
):
  | { ok: true; pricingItemId: string; item: PricingItemInputParsed }
  | { ok: false; error: string } {
  const parsed = parsePricingInput(updatePricingItemInputSchema, {
    pricingItemId,
    item,
  });
  if (!parsed.ok) {
    return parsed;
  }
  return {
    ok: true,
    pricingItemId: parsed.data.pricingItemId,
    item: parsed.data.item,
  };
}

/**
 * After totals are computed by existing pricing helpers, ensure persisted
 * commercial percents and money totals respect owner bounds without changing formulas.
 */
export function validateDerivedCommercialPercents(input: {
  marginPercent: number;
  markupPercent: number;
}): { ok: true } | { ok: false; error: string } {
  const parsed = derivedCommercialPercentsSchema.safeParse({
    margin_percent: input.marginPercent,
    markup_percent: input.markupPercent,
  });
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }
  return { ok: true };
}

export function isFiniteNonNegativeMoney(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

/**
 * Post-calculation check before persistence (all modes, including lump_sum).
 */
export function validateComputedItemForPersistence(input: {
  totalCost: number;
  totalSell: number;
  marginPercent: number;
  markupPercent: number;
}): { ok: true } | { ok: false; error: string } {
  if (!isFiniteNonNegativeMoney(input.totalCost)) {
    return {
      ok: false,
      error: "Total cost must be a finite number zero or greater.",
    };
  }
  if (!isFiniteNonNegativeMoney(input.totalSell)) {
    return {
      ok: false,
      error: "Total sell must be a finite number zero or greater.",
    };
  }
  return validateDerivedCommercialPercents({
    marginPercent: input.marginPercent,
    markupPercent: input.markupPercent,
  });
}
