import type {
  ClarifyAssumption,
  ClarifyCandidate,
} from "@/lib/assistant/clarify/types";

const STATEMENTS: Record<string, string> = {
  "deck.existing_deck_removal": "No demolition included",
  "deck.vertical_face_boards_required": "No fascia included",
  "deck.skirting_included": "No full-height deck skirting / screening",
  site_access: "Standard access",
  material_carry_distance: "Standard carry",
  waste_bin_access: "Standard waste handling",
  occupied_site: "Unoccupied site",
  quality_level: "Standard finish",
  "deck.access_type": "No steps included",
  "bathroom.plumbing_changes": "Standard plumbing allowance",
};

export function assumptionStatementForKey(key: string): string {
  return STATEMENTS[key] ?? `Assumed for now: ${key}`;
}

export function toClarifyAssumption(
  candidate: ClarifyCandidate
): ClarifyAssumption {
  return {
    id: `assumption:${candidate.id}`,
    label: candidate.label,
    statement:
      candidate.assumptionStatement ??
      assumptionStatementForKey(
        candidate.constraintKey ?? candidate.factKey ?? candidate.questionKey
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
