/**
 * Shared boundary-inclusive run count: ceil(span / spacing - epsilon) + 1.
 *
 * Matches Internal Walls studs (epsilon 1e-12). Deck / Retaining Wall callers
 * currently use ceil(span / spacing) + 1 without epsilon — do not migrate them
 * in this slice. Ceilings may depend on this helper from WA-04.
 */

export const RUN_COUNT_SPACING_EPSILON = 1e-12;

export function runCountFromSpacing(
  span: number,
  spacing: number,
  epsilon: number = RUN_COUNT_SPACING_EPSILON
): number {
  if (!(spacing > 0) || !(span > 0)) return 0;
  return Math.ceil(span / spacing - epsilon) + 1;
}
