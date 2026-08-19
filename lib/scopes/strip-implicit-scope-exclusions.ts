/**
 * RECOVERY-4-R2 — drop AI-extracted negative optional-scope Facts that the
 * brief does not explicitly support. Does not invent inclusions.
 */

import type { AIExtractionOutput } from "@/lib/ai/schema";
import { isImplicitScopeExclusion } from "@/lib/assistant/job-plan/exclusion-provenance";

const OPTIONAL_NEGATIVE_KEYS = new Set([
  "deck.existing_deck_removal",
  "deck.vertical_face_boards_required",
  "deck.balustrade_required",
  "deck.handrail_required",
  "deck.access_type",
  "bathroom.demolition_required",
  "bathroom.tiling_included",
]);

export function stripImplicitScopeExclusions(
  extraction: AIExtractionOutput,
  briefText: string
): AIExtractionOutput {
  return {
    ...extraction,
    facts: extraction.facts.filter((fact) => {
      if (!OPTIONAL_NEGATIVE_KEYS.has(fact.key)) return true;
      return !isImplicitScopeExclusion({
        factKey: fact.key,
        value: fact.value,
        source: "ai",
        briefText,
      });
    }),
  };
}
