/**
 * Deck vs External Stairs domain boundary.
 *
 * Simple steps integral to a Deck belong to `deck`, not `external_stairs`.
 * Independent stair assemblies still suggest `external_stairs`.
 *
 * Deterministic — do not rely on prompt wording alone.
 */

function normaliseBrief(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

const INDEPENDENT_EXTERNAL_STAIRS_PHRASES = [
  "external staircase",
  "outdoor staircase",
  "external stairs",
  "outdoor stairs",
  "new external stair",
  "replace external stair",
  "separate external stair",
  "standalone stair",
  "stair flight",
  "stairs between levels",
  "stringer stair",
  "landing and stair",
  "landing and stairs",
  "access stair",
  "access staircase",
] as const;

const INTEGRAL_DECK_STEP_PHRASES = [
  "step down included",
  "step-down included",
  "step down",
  "step-down",
  "single step",
  "deck step",
  "deck steps",
  "one step to ground",
  "one step down",
  "two steps to ground",
  "two steps from deck",
  "steps from deck",
  "steps to ground",
  "simple access steps",
  "access steps",
] as const;

function includesAny(text: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => text.includes(phrase));
}

export function briefHasIndependentExternalStairs(briefText: string): boolean {
  const brief = normaliseBrief(briefText);
  if (!brief) return false;
  if (includesAny(brief, INDEPENDENT_EXTERNAL_STAIRS_PHRASES)) return true;
  if (/\breplace\b.{0,24}\b(external\s+)?stairs?\b/.test(brief)) return true;
  if (/\bnew\b.{0,20}\bexternal\s+stairs?\b/.test(brief)) return true;
  if (/\bstaircase\b/.test(brief)) return true;
  if (/\bstair\s+set\b/.test(brief) && !briefHasDeck(brief)) return true;
  return false;
}

export function briefHasIntegralDeckStepLanguage(briefText: string): boolean {
  const brief = normaliseBrief(briefText);
  if (!brief) return false;
  if (includesAny(brief, INTEGRAL_DECK_STEP_PHRASES)) return true;
  if (/\b(one|two|three|four|five|\d+)\s+steps?\b/.test(brief)) return true;
  if (/\bsteps?\s+(included|down)\b/.test(brief)) return true;
  return false;
}

export function briefHasDeck(briefText: string): boolean {
  const brief = normaliseBrief(briefText);
  return (
    /\bdecks?\b/.test(brief) ||
    /\bdecking\b/.test(brief) ||
    brief.includes("kwila") ||
    brief.includes("hardwood deck")
  );
}

/**
 * Suggest a separate External Stairs work area only when the brief describes
 * a genuine independent stair assembly.
 *
 * If a Deck is identified and stair language is only simple/integral step
 * language, do not separately suggest `external_stairs`.
 */
export function shouldSuggestExternalStairs(params: {
  briefText: string;
  hasDeck?: boolean;
}): boolean {
  const brief = params.briefText;
  if (briefHasIndependentExternalStairs(brief)) return true;
  const hasDeck = params.hasDeck ?? briefHasDeck(brief);
  if (hasDeck && briefHasIntegralDeckStepLanguage(brief)) return false;
  if (hasDeck) return false;
  const normalised = normaliseBrief(brief);
  return (
    includesAny(normalised, [
      "external stair",
      "outdoor stair",
      "timber stair",
      "stair set",
    ]) || /\d+\s*-?\s*step/.test(normalised)
  );
}

export function shouldSuppressExternalStairsWorkArea(params: {
  briefText: string;
  workAreaTypes: readonly string[];
}): boolean {
  const hasDeck = params.workAreaTypes.includes("deck") || briefHasDeck(params.briefText);
  const hasStairs = params.workAreaTypes.includes("external_stairs");
  if (!hasStairs) return false;
  if (briefHasIndependentExternalStairs(params.briefText)) return false;
  return hasDeck && !shouldSuggestExternalStairs({
    briefText: params.briefText,
    hasDeck: true,
  });
}

export function filterIntegralDeckExternalStairsWorkAreas<
  T extends { type: string },
>(workAreas: readonly T[], briefText: string): T[] {
  const types = workAreas.map((wa) => wa.type);
  if (
    !shouldSuppressExternalStairsWorkArea({
      briefText,
      workAreaTypes: types,
    })
  ) {
    return [...workAreas];
  }
  return workAreas.filter((wa) => wa.type !== "external_stairs");
}

export function isExternalStairsFactKey(key: string): boolean {
  return key === "external_stairs" || key.startsWith("external_stairs.");
}
