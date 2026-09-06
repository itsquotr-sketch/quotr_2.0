import type {
  ClarifyAssumption,
  ClarifyCandidate,
} from "@/lib/assistant/clarify/types";
import {
  builderFacingAssumptionStatement,
  looksLikeInternalFactKey,
  safeFactPresentationLabel,
} from "@/lib/assistant/presentation/fact-key-labels";
import { isDisclosedAssumptionSource } from "@/lib/estimate/deck-board-width";
import type { EstimateFact } from "@/lib/estimate/types";

const STATEMENTS: Record<string, string> = {
  "deck.existing_deck_removal": "No demolition included",
  "deck.vertical_face_boards_required": "No fascia included",
  "deck.skirting_included": "No full-height deck skirting / screening",
  "deck.board_width_mm":
    "Assuming 140 mm decking boards. Confirm board width to calculate this from the job details.",
  site_access: "Standard access",
  material_carry_distance: "Standard carry",
  waste_bin_access: "Standard waste handling",
  occupied_site: "Unoccupied site",
  quality_level: "Standard finish",
  "deck.access_type": "No steps included",
  "bathroom.plumbing_changes": "Standard plumbing allowance",
  "deck.substructure_included": "Assuming new framing / substructure is included.",
};

export function assumptionStatementForKey(key: string): string {
  return builderFacingAssumptionStatement(key, STATEMENTS[key] ?? null);
}

export function toClarifyAssumption(
  candidate: ClarifyCandidate
): ClarifyAssumption {
  return {
    id: `assumption:${candidate.id}`,
    label:
      candidate.label && !looksLikeInternalFactKey(candidate.label)
        ? candidate.label
        : safeFactPresentationLabel(
            candidate.constraintKey ?? candidate.factKey ?? candidate.questionKey
          ),
    statement: builderFacingAssumptionStatement(
      candidate.constraintKey ?? candidate.factKey ?? candidate.questionKey,
      candidate.assumptionStatement ??
        assumptionStatementForKey(
          candidate.constraintKey ?? candidate.factKey ?? candidate.questionKey
        )
    ),
    factKey: candidate.factKey,
    constraintKey: candidate.constraintKey,
    workAreaId: candidate.workAreaId,
    source: "assumption",
    persistedExclusion: false,
  };
}

/**
 * Skipped assumable items become disclosures.
 * Does not persist false Facts / exclusions.
 */
export function assumptionsFromSkipped(
  skipped: readonly ClarifyCandidate[]
): ClarifyAssumption[] {
  return skipped
    .filter((c) => c.assumable && !c.blocksEstimate)
    .map(toClarifyAssumption);
}

export function assumptionsFromPersistedFacts(
  facts: readonly EstimateFact[]
): ClarifyAssumption[] {
  return facts
    .filter(
      (fact) =>
        isDisclosedAssumptionSource(fact.source) &&
        fact.value != null &&
        fact.value !== ""
    )
    .map((fact) => ({
      id: `assumption-fact:${fact.work_area_id ?? "project"}:${fact.key}`,
      label: safeFactPresentationLabel(fact.key),
      statement: assumptionStatementForKey(fact.key),
      factKey: fact.key,
      constraintKey: null,
      workAreaId: fact.work_area_id,
      source: "assumption" as const,
      persistedExclusion: false,
    }));
}
