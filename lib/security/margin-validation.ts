/** Organisation default margin bounds used in UI and server validation. */
export const MIN_MARGIN_PERCENT = 0;
export const MAX_MARGIN_PERCENT = 80;

export class InvalidMarginPercentError extends Error {
  constructor(marginPercent: number) {
    super(
      `Invalid margin percent: ${marginPercent}. Must be >= ${MIN_MARGIN_PERCENT} and < 100.`
    );
    this.name = "InvalidMarginPercentError";
  }
}

export function validateMarginPercent(
  margin: number
): { ok: true } | { ok: false; message: string } {
  if (!Number.isFinite(margin)) {
    return { ok: false, message: "Margin must be a number." };
  }
  if (margin < MIN_MARGIN_PERCENT) {
    return {
      ok: false,
      message: `Margin must be at least ${MIN_MARGIN_PERCENT}%.`,
    };
  }
  if (margin >= 100) {
    return { ok: false, message: "Margin must be less than 100%." };
  }
  if (margin > MAX_MARGIN_PERCENT) {
    return {
      ok: false,
      message: `Margin must be at most ${MAX_MARGIN_PERCENT}%.`,
    };
  }
  return { ok: true };
}

export function assertMarginPercentForEstimating(marginPercent: number): number {
  const result = validateMarginPercent(marginPercent);
  if (!result.ok) {
    throw new InvalidMarginPercentError(marginPercent);
  }
  return marginPercent;
}
