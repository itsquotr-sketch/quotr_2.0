/**
 * Map rationale codes to short “why suggested” copy.
 * Falls back to kind-based wording — never shows raw underscore codes.
 */

import { suggestionKindLabel } from "./labels";

const RATIONALE_HINTS: Readonly<Record<string, string>> = Object.freeze({
  "deck.demolition":
    "Replacing or removing an existing deck often needs demolition allowance.",
  "deck.substructure":
    "Deck work usually needs substructure consideration unless confirmed otherwise.",
  "deck.bearers": "Deck framing typically includes bearers.",
  "deck.joists": "Deck framing typically includes joists.",
  "deck.decking": "A deck scope usually includes the decking surface.",
  "deck.fascia": "Deck edges commonly include fascia.",
  "deck.stairs": "Level changes often imply stairs.",
  "deck.balustrades": "Raised decks often need balustrades or barriers.",
  "deck.coatings": "Deck surfaces commonly need coatings or finish protection.",
  "deck.waste": "Demolition or strip-out usually needs waste removal.",
  "deck.access": "Restricted access can change how deck work is delivered.",
  "bathroom.demolition": "Bathroom renovations often start with strip-out.",
  "bathroom.plumbing": "Bathroom work typically needs plumbing scope.",
  "bathroom.electrical": "Bathroom renovations often need electrical work.",
  "bathroom.waterproofing":
    "Wet areas usually need waterproofing before finishes.",
  "bathroom.tiling": "Bathroom renovations often include tiling.",
  "bathroom.fixtures": "Bathroom scope commonly includes fixtures.",
  "fitout.strip_out": "Fit-out changes often need strip-out.",
  "fitout.flooring": "Fit-out work often includes flooring.",
  "fitout.protection": "Occupied sites often need protection allowances.",
});

function humaniseRationaleFallback(code: string): string {
  const parts = code
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  if (parts.length === 0) return "Related project information supports this suggestion.";
  return `Suggested because of related ${parts.join(" ").toLowerCase()} scope.`;
}

export function whySuggestedText(params: {
  readonly rationaleCode: string | null | undefined;
  readonly suggestionKind: string | null | undefined;
  readonly originHint?: "deterministic" | "ai" | "unknown";
}): string {
  const code = String(params.rationaleCode ?? "").trim();
  if (code && RATIONALE_HINTS[code]) {
    return RATIONALE_HINTS[code];
  }

  const kind = String(params.suggestionKind ?? "").toUpperCase();
  switch (kind) {
    case "MISSING_SCOPE":
      return "Related accepted scope often includes this work, and it does not appear to be covered yet.";
    case "DEPENDENCY":
      return "This looks like prerequisite or dependent work for scope already on the project.";
    case "CLARIFICATION_REQUIRED":
      return "Quotr needs a clearer answer before this scope can be confirmed confidently.";
    case "DUPLICATE_WARNING":
      return "This may overlap with work already on the project.";
    case "CONFLICT_WARNING":
      return "This conflicts with existing facts, exclusions, or other suggestions.";
    case "POSSIBLE_EXCLUSION":
      return "This may be out of scope or optionally excluded — review before adding.";
    case "SUB_SCOPE":
      return "This is related child scope for work already identified.";
    case "WORK_AREA":
      return params.originHint === "ai"
        ? "Project information suggests this work area may be relevant."
        : "Structured scope checks suggest this work area may be relevant.";
    default:
      break;
  }

  if (code) return humaniseRationaleFallback(code);
  return `${suggestionKindLabel(params.suggestionKind)} based on your project information.`;
}
