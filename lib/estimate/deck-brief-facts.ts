/**
 * Explicit Deck measurements in the job description.
 * A number is confirmed only when the sentence states that fact.
 * A deck edge copied onto the steps is not a step width.
 */

export const KWILA_DECK_JOURNEY_BRIEF =
  "Install 6m x 3.5m kwila deck, 0.7m high. Fascia board along 6m side. Steps down that are 3.5m wide. 140mm Kwila decking boards. New substructure, 16 poles, concrete included.";

function normalise(brief: string): string {
  return brief.trim().toLowerCase().replace(/\s+/g, " ");
}

export function explicitDeckStepWidthM(brief: string): number | null {
  const text = normalise(brief);
  const patterns = [
    /\bsteps?\b[^.]{0,80}?(\d+(?:\.\d+)?)\s*m\s+wide\b/,
    /\b(\d+(?:\.\d+)?)\s*m\s+wide\s+steps?\b/,
    /\bstep width(?:\s+of)?\s+(\d+(?:\.\d+)?)\s*m\b/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const value = Number(match[1]);
    if (Number.isFinite(value) && value > 0 && value <= 30) return value;
  }
  return null;
}

export function explicitDeckFasciaLengthM(brief: string): number | null {
  const text = normalise(brief);
  const match = text.match(/\bfascia\b[^.]{0,60}?(\d+(?:\.\d+)?)\s*m\b/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0 || value > 200) return null;
  return value;
}

export function explicitDeckPostCount(brief: string): number | null {
  const text = normalise(brief);
  const match = text.match(/\b(\d+)\s+(poles?|posts?|piles?)\b/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isInteger(value) || value <= 0 || value > 500) return null;
  return value;
}

export function explicitNewSubstructure(brief: string): boolean {
  return /\bnew substructure\b/.test(normalise(brief));
}

export function explicitConcreteIncluded(brief: string): boolean {
  const text = normalise(brief);
  if (/\b(no concrete|without concrete|concrete not included)\b/.test(text)) {
    return false;
  }
  return /\bconcrete included\b/.test(text);
}

export type DeckBriefFact = {
  readonly key: string;
  readonly label: string;
  readonly value: string | number | boolean;
  readonly unit?: string;
};

/** Facts the brief states outright. Absent keys stay unconfirmed. */
export function explicitDeckBriefFacts(brief: string): DeckBriefFact[] {
  const facts: DeckBriefFact[] = [];
  const stepWidth = explicitDeckStepWidthM(brief);
  if (stepWidth != null) {
    facts.push({
      key: "deck.step_width_m",
      label: "Step width",
      value: stepWidth,
      unit: "m",
    });
  }
  const fasciaLength = explicitDeckFasciaLengthM(brief);
  if (fasciaLength != null) {
    facts.push({
      key: "deck.vertical_face_board_length_lm",
      label: "Fascia length",
      value: fasciaLength,
      unit: "m",
    });
  }
  const posts = explicitDeckPostCount(brief);
  if (posts != null) {
    facts.push({
      key: "deck.pile_or_post_count",
      label: "Piles/posts count",
      value: posts,
    });
  }
  if (explicitNewSubstructure(brief)) {
    facts.push({
      key: "deck.substructure_included",
      label: "New framing / substructure",
      value: true,
    });
  }
  if (explicitConcreteIncluded(brief)) {
    facts.push({
      key: "deck.concrete_to_supports",
      label: "Concrete post footings",
      value: true,
    });
  }
  return facts;
}
