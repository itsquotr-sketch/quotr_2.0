/**
 * ESTIMATING-FOUNDATION-02 / EF02-C1 — canonical Deck per-field question
 * descriptors. Classification (`askClass`) is owned by
 * `DECK_INFORMATION_CONTRACT`. This module adds section + relevance gates
 * and is the only runtime source Deck Clarify should consume.
 *
 * Conditional reveal stays here. Do not flatten parent gates.
 */
import type { ClarifyAskClass } from "@/lib/assistant/clarify/types";
import {
  shouldAskBalustrade,
  stepsAreRelevant,
} from "@/lib/assistant/clarify/suppress";
import {
  DECK_INFORMATION_CONTRACT,
  deckFactQuestionClass,
  isDeckClarifyAskClass,
  type DeckFactQuestionClass,
} from "@/lib/estimate/deck-information-contract";
import {
  deckStepsCommerciallyIncluded,
  newSubstructureIncluded,
  shouldAskPileReplacement,
} from "@/lib/estimate/deck-scope-2c";
import type { EstimateFact } from "@/lib/estimate/types";

export type DeckQuestionSection =
  | "geometry"
  | "boarding"
  | "structure"
  | "demolition"
  | "edges"
  | "access"
  | "balustrade"
  | "project_conditions"
  | "unused";

export type DeckQuestionRelevanceContext = {
  readonly facts: readonly {
    readonly key: string;
    readonly work_area_id: string | null;
    readonly value: unknown;
    readonly source?: string | null;
  }[];
  readonly workAreaId: string;
  readonly briefText: string | null;
};

export type DeckQuestionDescriptor = {
  readonly factKey: string;
  readonly askClass: DeckFactQuestionClass;
  readonly section: DeckQuestionSection;
  readonly isRelevant: (ctx: DeckQuestionRelevanceContext) => boolean;
};

const SECTIONS: Record<string, DeckQuestionSection> = {
  "deck.length_m": "geometry",
  "deck.width_m": "geometry",
  "deck.area_m2": "geometry",
  "deck.height_m": "geometry",
  "deck.level": "geometry",
  "deck.board_material": "boarding",
  "deck.board_width_mm": "boarding",
  "deck.board_direction": "boarding",
  "deck.ground_clearance_m": "boarding",
  "deck.fascia_material": "boarding",
  "deck.substructure_included": "structure",
  "deck.joist_centres_mm": "structure",
  "deck.joist_section": "structure",
  "deck.joist_direction": "structure",
  "deck.bearer_row_count": "structure",
  "deck.supports_per_bearer": "structure",
  "deck.footing_length_mm": "structure",
  "deck.footing_width_mm": "structure",
  "deck.footing_depth_mm": "structure",
  "deck.pile_or_post_count": "structure",
  "deck.concrete_to_supports": "structure",
  "deck.concrete_bags_per_hole": "structure",
  "deck.existing_deck_removal": "demolition",
  "deck.vertical_face_boards_required": "edges",
  "deck.skirting_included": "edges",
  "deck.access_type": "access",
  "deck.steps_included": "access",
  "deck.step_count": "access",
  "deck.step_width_m": "access",
  "deck.step_going_m": "access",
  "deck.balustrade_required": "balustrade",
  site_access: "project_conditions",
  material_carry_distance: "project_conditions",
  "deck.pergola_included": "unused",
};

function asEstimateFacts(
  facts: DeckQuestionRelevanceContext["facts"]
): EstimateFact[] {
  return facts as EstimateFact[];
}

function gateInput(ctx: DeckQuestionRelevanceContext) {
  return {
    facts: ctx.facts,
    briefText: ctx.briefText,
  };
}

/** Job Plan `showConcrete`: concrete is offered unless substructure is explicitly excluded. */
function showConcrete(ctx: DeckQuestionRelevanceContext): boolean {
  return newSubstructureIncluded(asEstimateFacts(ctx.facts), ctx.workAreaId);
}

export function deckFactIsRelevant(
  factKey: string,
  ctx: DeckQuestionRelevanceContext
): boolean {
  if (factKey === "site_access" || factKey === "material_carry_distance") {
    return false;
  }
  if (!factKey.startsWith("deck.")) return false;

  switch (factKey) {
    case "deck.steps_included":
    case "deck.access_type":
      return stepsAreRelevant(gateInput(ctx), ctx.workAreaId);
    case "deck.step_width_m":
    case "deck.step_going_m":
    case "deck.step_count":
      return deckStepsCommerciallyIncluded({
        facts: asEstimateFacts(ctx.facts),
        workAreaId: ctx.workAreaId,
      });
    case "deck.balustrade_required":
      return shouldAskBalustrade(gateInput(ctx), ctx.workAreaId);
    case "deck.concrete_to_supports":
    case "deck.concrete_bags_per_hole":
      return showConcrete(ctx);
    case "deck.pile_or_post_replacement_required":
    case "deck.pile_or_post_count":
      return shouldAskPileReplacement({
        facts: asEstimateFacts(ctx.facts),
        workAreaId: ctx.workAreaId,
      });
    default:
      return true;
  }
}

export function mapDeckAskClassToClarify(
  askClass: DeckFactQuestionClass
): ClarifyAskClass {
  if (askClass === "HARD_MINIMUM") return "HARD_MINIMUM";
  if (askClass === "ASK_NOW") return "ASK_NOW";
  if (askClass === "ASSUME_IF_SKIPPED") return "ASSUME_IF_SKIPPED";
  if (askClass === "ADVANCED") return "ADVANCED";
  if (askClass === "DERIVED") return "DERIVED_NEVER_ASK";
  return "REFINEMENT";
}

export function getDeckQuestionDescriptor(
  factKey: string
): DeckQuestionDescriptor | null {
  const row = DECK_INFORMATION_CONTRACT.find((r) => r.factKey === factKey);
  if (!row) return null;
  return {
    factKey: row.factKey,
    askClass: row.questionClass,
    section: SECTIONS[row.factKey] ?? "unused",
    isRelevant: (ctx) => deckFactIsRelevant(factKey, ctx),
  };
}

export function listDeckQuestionDescriptors(): readonly DeckQuestionDescriptor[] {
  return DECK_INFORMATION_CONTRACT.map((row) => ({
    factKey: row.factKey,
    askClass: row.questionClass,
    section: SECTIONS[row.factKey] ?? "unused",
    isRelevant: (ctx: DeckQuestionRelevanceContext) =>
      deckFactIsRelevant(row.factKey, ctx),
  }));
}

/** Deck facts Clarify must be able to generate when relevant and unresolved. */
export function listDeckClarifyDescriptors(): readonly DeckQuestionDescriptor[] {
  return listDeckQuestionDescriptors().filter(
    (row) =>
      row.factKey.startsWith("deck.") && isDeckClarifyAskClass(row.askClass)
  );
}

export function deckClarifyAskClass(factKey: string): ClarifyAskClass | null {
  const cls = deckFactQuestionClass(factKey);
  if (!cls) return null;
  return mapDeckAskClassToClarify(cls);
}
