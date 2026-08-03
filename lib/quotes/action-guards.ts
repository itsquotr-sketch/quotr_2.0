import type { ZodType } from "zod";
import type { AuthOrgResult } from "@/lib/security/auth-org-context";
import {
  updateQuoteItemInputSchema,
  type QuoteItemInputParsed,
} from "@/lib/quotes/schemas";
import { moneyAmountSchema } from "@/lib/security/numeric-validation";

/**
 * Quote action guard helpers (Batch 2A.3B).
 *
 * Guard sequence for quote mutations:
 * 1. Runtime schema validation (Batch 2A.2 quote schemas)
 * 2. requireAuthOrgContext()
 * 3. Shared ownership asserts (quote / item / project / pricing document)
 * 4. Existing quote calculation helpers (unchanged arithmetic)
 * 5. Validate computed/client totals are finite and non-negative before write
 * 6. Persist; compensating cleanup on multi-step failure where already used
 */

export function firstZodErrorMessage(
  error: { issues: Array<{ message: string }> },
  fallback = "Invalid quote input."
): string {
  return error.issues[0]?.message ?? fallback;
}

export function quoteAuthFailure(
  auth: AuthOrgResult
): { error: string } | null {
  if (auth.ok) {
    return null;
  }
  return { error: auth.error };
}

export function parseQuoteInput<T>(
  schema: ZodType<T>,
  input: unknown,
  fallback = "Invalid quote input."
): { ok: true; data: T } | { ok: false; error: string } {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error, fallback) };
  }
  return { ok: true, data: parsed.data };
}

export function validateUpdateQuoteItemPayload(
  quoteItemId: unknown,
  item: unknown
):
  | { ok: true; quoteItemId: string; item: QuoteItemInputParsed }
  | { ok: false; error: string } {
  const parsed = parseQuoteInput(updateQuoteItemInputSchema, {
    quoteItemId,
    item,
  });
  if (!parsed.ok) {
    return parsed;
  }
  return {
    ok: true,
    quoteItemId: parsed.data.quoteItemId,
    item: parsed.data.item,
  };
}

export function isFiniteNonNegativeMoney(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

/**
 * After existing calculateQuoteItemTotal, ensure the persisted total is safe.
 * Does not change how the total was derived.
 */
export function validateQuoteItemTotalForPersistence(
  total: number
): { ok: true } | { ok: false; error: string } {
  const parsed = moneyAmountSchema.safeParse(total);
  if (!parsed.success) {
    return {
      ok: false,
      error: firstZodErrorMessage(parsed.error, "Total must be zero or greater."),
    };
  }
  return { ok: true };
}
