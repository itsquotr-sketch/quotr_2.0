/** Calculation engine and formula pack versions (Batch 2B.3C). */

/**
 * Engine version — bump when contract shape, execution behaviour,
 * warning/error semantics, step generation, or replay mechanics change.
 * Documentation-only changes do not require a bump.
 */
export const ENGINE_VERSION = "2B.3C.0";

/**
 * Formula version — bump only when commercial arithmetic changes
 * (margin, GST, waste, rounding sequence, mode semantics).
 * Unchanged in 2B.3C (contract/replay only).
 */
export const FORMULA_VERSION = "2B.mvp.1";

export const DEFAULT_GROSS_MARGIN_PERCENT = 20;
export const MIN_GROSS_MARGIN_PERCENT = 0;
export const MAX_GROSS_MARGIN_PERCENT = 95;

export const DEFAULT_GST_RATE_PERCENT = 15;

/** Supported formula versions for exact replay in this pack. */
export const SUPPORTED_FORMULA_VERSIONS = Object.freeze([FORMULA_VERSION]);

/** Supported engine versions for exact replay in this pack. */
export const SUPPORTED_ENGINE_VERSIONS = Object.freeze([ENGINE_VERSION]);

export {
  ENGINE_VERSION as calculationEngineVersion,
  FORMULA_VERSION as formulaVersion,
};
