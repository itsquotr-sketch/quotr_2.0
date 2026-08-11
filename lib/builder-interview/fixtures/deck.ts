/**
 * Stage 3.2.1 — Deck fixture (Preview-validated style).
 */

import type { BuilderInterviewInput } from "@/lib/builder-interview/types";

export function buildDeckFixture(): BuilderInterviewInput {
  const deckId = "wa-deck-1";
  const demoId = "wa-demo-1";

  return {
    project: { id: "proj-deck", qualityLevel: "standard" },
    workAreas: [
      {
        id: deckId,
        type: "deck",
        name: "Deck",
        status: "confirmed",
        sortOrder: 1,
      },
      {
        id: demoId,
        type: "demolition",
        name: "Demolition / removal",
        status: "confirmed",
        sortOrder: 0,
      },
    ],
    facts: [
      {
        key: "deck.length_m",
        workAreaId: deckId,
        value: 6,
        source: "user",
      },
      {
        key: "deck.width_m",
        workAreaId: deckId,
        value: 4,
        source: "user",
      },
      {
        key: "deck.area_m2",
        workAreaId: deckId,
        value: 24,
        source: "derived",
      },
      {
        key: "deck.balustrade_required",
        workAreaId: deckId,
        value: false,
        source: "user",
      },
      {
        key: "deck.existing_deck_removal",
        workAreaId: deckId,
        value: true,
        source: "user",
      },
    ],
    constraints: [
      {
        key: "site_access",
        value: "Difficult",
        source: "user",
      },
      {
        key: "material_carry_distance",
        value: "10–30m",
        source: "user",
      },
    ],
    existingAssumptions: [],
  };
}
