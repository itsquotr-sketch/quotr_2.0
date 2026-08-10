/**
 * Stage 3.1B.7F-R5 — Site constraint confirmation fallback (existing taxonomy only).
 */

import { buildStaticConstraintQuestions } from "@/lib/assistant/mock-seed";
import type { Question } from "@/components/assistant/types";

export const SITE_CONSTRAINT_FALLBACK_INTRO =
  "No site constraints have been identified yet. Confirm anything that may affect how the work is carried out.";

/**
 * Concise confirmation questions from existing static seeds.
 * Does not invent values or new taxonomy keys.
 */
export function buildSiteConstraintFallbackQuestions(params?: {
  readonly workAreaTypes?: readonly string[];
}): Question[] {
  const seeds = buildStaticConstraintQuestions();
  const types = new Set(
    (params?.workAreaTypes ?? []).map((t) => t.toLowerCase())
  );
  const indoor =
    types.has("bathroom") ||
    types.has("kitchen") ||
    types.has("commercial_fitout") ||
    types.has("internal_walls") ||
    types.has("painting");

  // Always keep access + carry. Drop slope for indoor-only packages when known.
  return seeds.filter((q) => {
    if (q.key === "site_slope" && indoor && !types.has("deck")) {
      return false;
    }
    return true;
  });
}

/** True when no constraint answers have been provided yet. */
export function hasNoKnownConstraintValues(params: {
  readonly questions: readonly Question[];
  readonly answers: Readonly<
    Record<string, string | number | boolean | string[] | null | undefined>
  >;
}): boolean {
  if (params.questions.length === 0) return true;
  return params.questions.every((q) => {
    const v = params.answers[q.id];
    return v === null || v === undefined || v === "";
  });
}
