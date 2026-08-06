/**
 * Stage 3.1B.7C — “Used for” presentation from existing consumer mappings.
 * Omits when no reliable mapping exists. Never fabricates impacts.
 */

import {
  FACT_KEY_CONSUMERS,
  FACT_KEY_SCOPE_ITEM,
} from "@/lib/scopes/work-area-fact-context";

/** Humanise internal consumer labels for UI — no new claims. */
const CONSUMER_DISPLAY: Readonly<Record<string, string>> = Object.freeze({
  "Deck area derivation": "area calculation",
  "Deck estimate": "estimate range",
  "Deck demolition labour": "demolition labour",
  "Deck balustrade allowance": "balustrade allowance",
  "Deck stairs": "stairs allowance",
  "Pergola area derivation": "area calculation",
  "Pergola estimate": "estimate range",
  "Bathroom tiling": "tiling allowance",
});

const EXTRA_USED_FOR: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "deck.area_m2": ["material quantity", "labour allowance", "estimate range"],
  "deck.length_m": ["area calculation", "estimate range"],
  "deck.width_m": ["area calculation", "estimate range"],
});

export function usedForLabelsForFactKey(factKey: string): readonly string[] {
  if (EXTRA_USED_FOR[factKey]) {
    return EXTRA_USED_FOR[factKey]!;
  }
  const consumers = FACT_KEY_CONSUMERS[factKey];
  if (!consumers || consumers.length === 0) return [];
  return consumers.map((c) => CONSUMER_DISPLAY[c] ?? c.toLowerCase());
}

export function relatedScopeItemLabel(factKey: string): string | null {
  const id = FACT_KEY_SCOPE_ITEM[factKey];
  if (!id) return null;
  return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
