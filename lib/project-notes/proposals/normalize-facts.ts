import type { NoteProposalExtractionOutput } from "@/lib/ai/note-proposal-schema";
import {
  DERIVED_FACT_KEYS,
  inferUnitFromFactKey,
  normalizeCanonicalFactKey,
} from "@/lib/scopes/fact-keys";

export {
  DERIVED_FACT_KEYS,
  inferUnitFromFactKey as inferUnitFromKey,
  normalizeCanonicalFactKey as normalizeFactKey,
};

/**
 * Apply final canonical key / unit cleanup on already-normalised extraction output.
 */
export function normalizeNoteProposalFacts(
  extraction: NoteProposalExtractionOutput
): NoteProposalExtractionOutput {
  const facts = extraction.facts
    .map((fact) => {
      const key = normalizeCanonicalFactKey(fact.key, fact.work_area_type);
      if (DERIVED_FACT_KEYS.has(key)) {
        return null;
      }

      return {
        ...fact,
        key,
        unit: fact.unit ?? inferUnitFromFactKey(key),
      };
    })
    .filter((fact): fact is NonNullable<typeof fact> => fact !== null);

  return {
    ...extraction,
    facts,
  };
}
