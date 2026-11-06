/**
 * Explicit job exclusions carried into a new Pricing draft.
 *
 * The organisation template stays a separate source. A saved draft is a
 * commercial edit and is not reseeded. Issued quote snapshots are not
 * written here; quote creation reads the draft fields it already has.
 */

import { parseInternalWallsWallTypes } from "@/lib/estimate/internal-walls-wall-types";

const TRADE_LABELS: Record<string, string> = {
  structural: "Structural work",
  plumbing: "Plumbing",
  fire: "Fire-system work",
  electrical: "Electrical",
};

export function jobExclusionLine(label: string): string {
  return `Excluded from this job: ${label}`;
}

function addLine(lines: string[], label: string) {
  const line = jobExclusionLine(label);
  if (!lines.some((row) => row.toLowerCase() === line.toLowerCase())) {
    lines.push(line);
  }
}

function wallTypeValue(value: unknown): unknown {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return value;
    }
  }
  return value;
}

function isExplicitFalse(value: unknown): boolean {
  if (value === false) return true;
  if (typeof value !== "string") return false;
  const normalised = value.trim().toLowerCase();
  return normalised === "false" || normalised === "no" || normalised === "none";
}

/** Explicit deck exclusions only. A missing fact is not an exclusion. */
const DECK_CLIENT_EXCLUSIONS: Record<string, string> = {
  "deck.existing_deck_removal": "Demolition",
  "deck.steps_included": "Stairs",
  "deck.balustrade_required": "Balustrade",
  "deck.painting_included": "Painting",
};

function hasIndependentPaintingScope(
  facts: readonly { key: string; value: unknown }[]
): boolean {
  return facts.some((fact) => {
    if (fact.key.startsWith("painting.") && fact.value != null && fact.value !== false) {
      return true;
    }
    return fact.key === "ceilings.painting_included" && fact.value === true;
  });
}

export function explicitJobExclusionLines(
  facts: readonly { key: string; value: unknown }[]
): string[] {
  const lines: string[] = [];
  const paintingLabel = hasIndependentPaintingScope(facts)
    ? "Painting to the new walls"
    : "Painting";
  for (const fact of facts) {
    if (fact.key === "internal_walls.wall_types") {
      const types = parseInternalWallsWallTypes(wallTypeValue(fact.value));
      if (types.some((row) => row.painting === "none")) addLine(lines, paintingLabel);
      if (types.some((row) => row.skirting === "none")) addLine(lines, "Skirting");
      if (types.some((row) => row.electrical === "none")) addLine(lines, "Electrical");
    }
    if (fact.key === "internal_walls.painting_included" && isExplicitFalse(fact.value)) {
      addLine(lines, paintingLabel);
    }
    if (fact.key === "doors.painting_included" && isExplicitFalse(fact.value)) {
      if (!lines.some((line) => line.toLowerCase().includes("painting"))) {
        addLine(lines, "Door painting");
      }
    }
    if (fact.key === "internal_walls.skirtings_included" && isExplicitFalse(fact.value)) {
      addLine(lines, "Skirting");
    }
    const deckLabel = DECK_CLIENT_EXCLUSIONS[fact.key];
    if (deckLabel && isExplicitFalse(fact.value)) addLine(lines, deckLabel);
    if (fact.key.endsWith(".coverage_note") && typeof fact.value === "string") {
      const match = fact.value.match(/Excluded trades:\s*([^.]+)/i);
      if (!match?.[1]) continue;
      for (const trade of match[1].split(",")) {
        const key = trade.trim().toLowerCase();
        if (!key) continue;
        addLine(lines, TRADE_LABELS[key] ?? trade.trim());
      }
    }
  }
  return lines;
}

/**
 * New drafts keep the template and add job lines that are not already in it.
 * An existing draft is returned unchanged.
 */
export function seedPricingClientExclusions(input: {
  templateLines: readonly string[];
  jobLines: readonly string[];
  existingDraftLines?: readonly string[] | null;
}): { lines: string[]; preservedEdit: boolean } {
  if (input.existingDraftLines != null) {
    return {
      lines: input.existingDraftLines.map((line) => line.trim()).filter(Boolean),
      preservedEdit: true,
    };
  }
  const lines: string[] = [];
  for (const line of [...input.templateLines, ...input.jobLines]) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (lines.some((row) => row.toLowerCase() === trimmed.toLowerCase())) continue;
    lines.push(trimmed);
  }
  return { lines, preservedEdit: false };
}
