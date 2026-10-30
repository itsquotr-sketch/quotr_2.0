/**
 * Shared scope polarity for a brief.
 * Included, excluded, conditional, and unknown stay distinct.
 * A missing mention is unknown, not an exclusion.
 * "No demolition" is not "no preparation".
 */

import { explicitMaterialWastePercent } from "@/lib/estimate/explicit-material-waste";

export type ScopeTopic =
  | "stairs"
  | "balustrade"
  | "demolition"
  | "painting"
  | "preparation"
  | "substructure";

export type ScopePolarity = "included" | "excluded" | "contradiction" | null;

export type PileRetentionStance =
  | "conditional"
  | "replace"
  | "retain"
  | "contradiction"
  | null;

export const PILE_RETENTION_CONDITION =
  "Existing piles may be retained if sound after inspection";

const TOPIC_PATTERN: Record<ScopeTopic, RegExp> = {
  stairs: /\b(stairs?|steps?)\b/i,
  balustrade: /\b(balustrades?|railings?)\b/i,
  demolition: /\b(demolition|demolish\w*|rip(?:ping)? out|strip(?:ping)? out|remov(?:e|ing|ed|al))\b/i,
  painting: /\bpaint(?:ing|ed)?\b/i,
  preparation: /\b(prepar(?:e|ation|ing)|prep)\b/i,
  substructure: /\b(substructure|framing)\b/i,
};

const EXCLUSION_LEAD =
  /\b(do not include|don't include|not included|not including|not part of|by others|stay out|stays out|left out|are out|is out|excluding|exclude|excluded|without|no|do not|don't)\b/i;

/** Topic words that sit before the exclusion phrase: "painting is excluded", "skirting stays out". */
const TOPIC_BEFORE_EXCLUSION = new Set([
  "excluded",
  "stay out",
  "stays out",
  "left out",
  "are out",
  "is out",
  "not included",
  "not part of",
  "by others",
]);

/**
 * Readiness is not a request to paint. "Stop the plasterboard ready to paint"
 * and "ready for painting" stay stopping or preparation language.
 */
export function withoutFinishReadinessPhrases(sentence: string): string {
  return sentence
    .replace(/\bready for painting\b/g, " ")
    .replace(/\bready for paint\b/g, " ")
    .replace(/\bready to paint\b/g, " ")
    .replace(/\bready to be painted\b/g, " ")
    .replace(/\bso (?:they|it|the walls?) can be painted(?: later)?\b/g, " ")
    .replace(/\bcan be painted later\b/g, " ")
    .replace(/\bpainted later\b/g, " ");
}

export function sentenceTopicSignals(
  sentence: string,
  pattern: RegExp
): { included: boolean; excluded: boolean } {
  const lead = sentence.match(EXCLUSION_LEAD);
  if (lead?.index == null) {
    return { included: pattern.test(sentence), excluded: false };
  }
  const word = lead[1]?.toLowerCase() ?? "";
  const head = sentence.slice(0, lead.index);
  const tail = sentence.slice(lead.index + word.length);
  const topicBefore = TOPIC_BEFORE_EXCLUSION.has(word);
  const excluded = topicBefore
    ? pattern.test(head) || pattern.test(tail)
    : pattern.test(tail);
  const included = !topicBefore && pattern.test(head);
  return { included, excluded };
}

const PILE_MENTION = /\b(piles?|posts?)\b/i;
const PILE_CONDITIONAL =
  /\b(if sound|after inspection|subject to inspection|pending inspection|if the inspection|if inspection|may be retained|might be retained|can be retained|could be retained|can stay|may stay|retained if|keep if sound|reuse if sound)\b/i;
const PILE_REPLACE =
  /\b(replace(?:d|ment|ing)?|redo(?:ing|ne)|new piles|new posts)\b/i;
const PILE_RETAIN = /\b(retain|keep|reuse|remain)\b/i;

function normalise(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function sentences(text: string): string[] {
  const parts = normalise(text)
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [normalise(text)];
}

function sentenceForTopic(sentence: string): string {
  return withoutFinishReadinessPhrases(sentence).replace(
    /\bdemolition waste\b/g,
    " waste"
  );
}

/** A sentence that includes painting on a ceiling, floor, or deck is not partition painting. */
export function briefPaintsSeparateAssembly(briefText: string): boolean {
  const parts = normalise(briefText)
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const sentences = parts.length > 0 ? parts : [normalise(briefText)];
  for (const raw of sentences) {
    const sentence = withoutFinishReadinessPhrases(raw)
      .replace(/\b(?:ground|first|second|upper|lower) floors?\b/g, " ")
      .replace(/\bfloor levels?\b/g, " ");
    if (!/\b(ceilings?|deck(?:ing)?|flooring|laminate|vinyl|carpet|roofs?|floors?)\b/.test(sentence)) {
      continue;
    }
    const signals = sentenceTopicSignals(sentence, /\bpaint/);
    if (signals.included && !signals.excluded) return true;
  }
  return false;
}

export function scopeTopicPolarity(
  briefText: string,
  topic: ScopeTopic
): ScopePolarity {
  const pattern = TOPIC_PATTERN[topic];
  let included = false;
  let excluded = false;
  for (const raw of sentences(briefText)) {
    const sentence = sentenceForTopic(raw);
    if (!pattern.test(sentence)) continue;
    const signals = sentenceTopicSignals(sentence, pattern);
    if (signals.excluded) excluded = true;
    if (signals.included) included = true;
  }
  if (included && excluded) return "contradiction";
  if (excluded) return "excluded";
  if (included) return "included";
  return null;
}

export function pileRetentionStance(briefText: string): PileRetentionStance {
  let conditional = false;
  let replace = false;
  let retain = false;
  for (const raw of sentences(briefText)) {
    const sentence = sentenceForTopic(raw);
    if (!PILE_MENTION.test(sentence)) continue;
    if (PILE_CONDITIONAL.test(sentence)) {
      conditional = true;
      continue;
    }
    if (PILE_REPLACE.test(sentence)) {
      replace = true;
      continue;
    }
    if (PILE_RETAIN.test(sentence)) retain = true;
  }
  if (conditional && replace) return "contradiction";
  if (conditional) return "conditional";
  if (replace) return "replace";
  if (retain) return "retain";
  return null;
}

export function pileConditionTextIsPending(
  value: string | null | undefined
): boolean {
  return PILE_CONDITIONAL.test(value ?? "");
}

export type DeckScopeFactUpdate = {
  readonly key: string;
  readonly label: string;
  readonly value: string | boolean | number;
};

export type DeckScopeIntent = {
  readonly upserts: readonly DeckScopeFactUpdate[];
  readonly dropKeys: readonly string[];
  readonly dropPaintingWorkArea: boolean;
  readonly warnings: readonly string[];
};

export function deckScopeIntent(
  briefText: string,
  statedPileCount: number | null
): DeckScopeIntent {
  const upserts: DeckScopeFactUpdate[] = [];
  const dropKeys: string[] = [];
  const warnings: string[] = [];

  const demolition = scopeTopicPolarity(briefText, "demolition");
  const stairs = scopeTopicPolarity(briefText, "stairs");
  const balustrade = scopeTopicPolarity(briefText, "balustrade");
  const painting = scopeTopicPolarity(briefText, "painting");
  const substructure = scopeTopicPolarity(briefText, "substructure");
  const piles = pileRetentionStance(briefText);

  if (demolition === "contradiction") {
    warnings.push(
      "The brief both includes and excludes demolition. That conflict is left for review."
    );
  } else if (demolition === "excluded") {
    upserts.push({
      key: "deck.existing_deck_removal",
      label: "Existing deck removal",
      value: false,
    });
  } else if (demolition === "included") {
    upserts.push({
      key: "deck.existing_deck_removal",
      label: "Existing deck removal",
      value: true,
    });
  }

  if (stairs === "contradiction") {
    warnings.push(
      "The brief both includes and excludes stairs. That conflict is left for review."
    );
  } else if (stairs === "excluded") {
    upserts.push({
      key: "deck.steps_included",
      label: "Steps",
      value: false,
    });
    upserts.push({
      key: "deck.access_type",
      label: "Access type",
      value: "None",
    });
  }

  if (balustrade === "contradiction") {
    warnings.push(
      "The brief both includes and excludes balustrades. That conflict is left for review."
    );
  } else if (balustrade === "excluded") {
    upserts.push({
      key: "deck.balustrade_required",
      label: "Balustrade required",
      value: false,
    });
  }

  if (painting === "excluded") {
    upserts.push({
      key: "deck.painting_included",
      label: "Painting",
      value: false,
    });
  }

  if (substructure === "included") {
    upserts.push({
      key: "deck.substructure_included",
      label: "New framing / substructure",
      value: true,
    });
  }

  if (piles === "contradiction") {
    dropKeys.push("deck.pile_or_post_replacement_required");
    warnings.push(
      "The brief both replaces piles and keeps them subject to inspection. Neither was stored as decided."
    );
  } else if (piles === "conditional") {
    dropKeys.push("deck.pile_or_post_replacement_required");
    if (statedPileCount == null) dropKeys.push("deck.pile_or_post_count");
    upserts.push({
      key: "deck.substructure_condition",
      label: "Substructure condition",
      value: PILE_RETENTION_CONDITION,
    });
  } else if (piles === "replace") {
    upserts.push({
      key: "deck.pile_or_post_replacement_required",
      label: "Pile/post replacement",
      value: true,
    });
  } else if (piles === "retain") {
    upserts.push({
      key: "deck.pile_or_post_replacement_required",
      label: "Pile/post replacement",
      value: false,
    });
  }

  if (statedPileCount != null && piles !== "conditional" && piles !== "contradiction") {
    upserts.push({
      key: "deck.pile_or_post_count",
      label: "Piles/posts count",
      value: statedPileCount,
    });
  }

  const boardWaste = explicitMaterialWastePercent(briefText, "deck_boards");
  if (boardWaste != null) {
    upserts.push({
      key: "deck.board_waste_percent",
      label: "Board waste",
      value: boardWaste,
    });
  }

  return {
    upserts,
    dropKeys,
    dropPaintingWorkArea: painting === "excluded",
    warnings,
  };
}
