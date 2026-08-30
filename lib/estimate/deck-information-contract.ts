/**
 * DECK-MATURITY-2A — canonical Deck estimating information contract.
 * Assistant ask timing vs calculator consumption. Not a second takeoff model.
 */
export type DeckFactQuestionClass =
  | "HARD_MINIMUM"
  | "ASK_NOW"
  | "ASSUME_IF_SKIPPED"
  | "REFINE"
  | "DERIVED"
  | "NOT_CONSUMED";

export type DeckInformationContractRow = {
  readonly factKey: string;
  readonly questionClass: DeckFactQuestionClass;
  readonly calculatorConsumed: boolean;
  readonly physical: boolean;
  readonly commercial: boolean;
  readonly reason: string;
};

export const DECK_INFORMATION_CONTRACT: readonly DeckInformationContractRow[] = [
  {
    factKey: "deck.length_m",
    questionClass: "HARD_MINIMUM",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    reason: "Geometric plan length (often first-written dimension). Not structural joist direction.",
  },
  {
    factKey: "deck.width_m",
    questionClass: "HARD_MINIMUM",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    reason: "Geometric plan width (often second-written dimension). Not structural joist direction.",
  },
  {
    factKey: "deck.area_m2",
    questionClass: "HARD_MINIMUM",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    reason: "Package and decking quantity when L×W absent; derived when L×W known.",
  },
  {
    factKey: "deck.height_m",
    questionClass: "ASSUME_IF_SKIPPED",
    calculatorConsumed: true,
    physical: false,
    commercial: true,
    reason: "Elevated labour / balustrade relevance. Refine if unknown.",
  },
  {
    factKey: "deck.level",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: false,
    commercial: true,
    reason: "Fallback height class for labour.",
  },
  {
    factKey: "deck.board_material",
    questionClass: "ASSUME_IF_SKIPPED",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    reason: "Decking surface rate identity.",
  },
  {
    factKey: "deck.board_width_mm",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    reason: "Decking lm takeoff when area known.",
  },
  {
    factKey: "deck.board_direction",
    questionClass: "DERIVED",
    calculatorConsumed: true,
    physical: true,
    commercial: false,
    reason: "Default derived: boards perpendicular to planning joists. Explicit board direction forces joist direction. Stored length is not structural orientation.",
  },
  {
    factKey: "deck.substructure_included",
    questionClass: "ASK_NOW",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    reason: "Gates framing package money and physical takeoff.",
  },
  {
    factKey: "deck.existing_deck_removal",
    questionClass: "ASK_NOW",
    calculatorConsumed: true,
    physical: false,
    commercial: true,
    reason: "Demolition labour only if included.",
  },
  {
    factKey: "deck.vertical_face_boards_required",
    questionClass: "ASK_NOW",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    reason: "Fascia / edge boards; quantity from exposed perimeter when included. Not full-height skirting.",
  },
  {
    factKey: "deck.skirting_included",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    reason:
      "Optional full-height deck skirting / screening. Height-sensitive. Do not infer from fascia or elevation.",
  },
  {
    factKey: "deck.access_type",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: false,
    commercial: false,
    reason:
      "Logistics access only. Do not treat Single step or step-down as commercial Steps.",
  },
  {
    factKey: "deck.steps_included",
    questionClass: "ASK_NOW",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    reason:
      "Commercial Steps include. Height does not auto-include. Job Plan / brief only.",
  },
  {
    factKey: "deck.concrete_to_supports",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    reason: "Optional concrete at piles/posts. Only when supports are active. Not forced.",
  },
  {
    factKey: "deck.concrete_bags_per_hole",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    reason: "Bags per hole when concrete YES. Default 2.5. Round purchased bags up.",
  },
  {
    factKey: "deck.balustrade_required",
    questionClass: "ASK_NOW",
    calculatorConsumed: true,
    physical: false,
    commercial: true,
    reason: "Asked only when elevated or already evidenced. Not recommended for low-level.",
  },
  {
    factKey: "deck.joist_centres_mm",
    questionClass: "DERIVED",
    calculatorConsumed: true,
    physical: true,
    commercial: false,
    reason: "Default 450 mm estimating assumption. Consumed if the builder supplies it.",
  },
  {
    factKey: "deck.joist_section",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: true,
    commercial: false,
    reason: "Identity for planning spec only. Not a mandatory interview.",
  },
  {
    factKey: "deck.joist_direction",
    questionClass: "DERIVED",
    calculatorConsumed: true,
    physical: true,
    commercial: false,
    reason: "Default: joists span the shorter rectangle axis. Explicit fact wins. Not interviewed.",
  },
  {
    factKey: "deck.bearer_row_count",
    questionClass: "DERIVED",
    calculatorConsumed: true,
    physical: true,
    commercial: false,
    reason: "Estimated from 1.8 m spacing when layout unspecified. Do not ask pile/bearer counts.",
  },
  {
    factKey: "deck.supports_per_bearer",
    questionClass: "DERIVED",
    calculatorConsumed: true,
    physical: true,
    commercial: false,
    reason: "Estimated from 1.8 m along each bearer when layout unspecified.",
  },
  {
    factKey: "deck.footing_length_mm",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: true,
    commercial: false,
    reason: "Concrete volume only when all three footing dimensions exist.",
  },
  {
    factKey: "deck.footing_width_mm",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: true,
    commercial: false,
    reason: "Concrete volume only when all three footing dimensions exist.",
  },
  {
    factKey: "deck.footing_depth_mm",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: true,
    commercial: false,
    reason: "Concrete volume only when all three footing dimensions exist.",
  },
  {
    factKey: "deck.pile_or_post_count",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: false,
    commercial: true,
    reason: "Replacement allowance quantity only. Do not ask as takeoff — Quotr derives support count.",
  },
  {
    factKey: "site_access",
    questionClass: "ASK_NOW",
    calculatorConsumed: true,
    physical: false,
    commercial: true,
    reason: "Project Conditions — labour factor once.",
  },
  {
    factKey: "material_carry_distance",
    questionClass: "ASK_NOW",
    calculatorConsumed: true,
    physical: false,
    commercial: true,
    reason: "Project Conditions — labour factor once.",
  },
  {
    factKey: "deck.pergola_included",
    questionClass: "NOT_CONSUMED",
    calculatorConsumed: false,
    physical: false,
    commercial: false,
    reason: "Template fact; calculator does not consume.",
  },
  {
    factKey: "deck.ground_clearance_m",
    questionClass: "ASSUME_IF_SKIPPED",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    reason: "Fascia ground gap. Defaults 20 mm. Affects fascia board lm.",
  },
  {
    factKey: "deck.fascia_material",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: true,
    commercial: false,
    reason: "Fascia identity. Money still package $/lm until fascia rate is company-set.",
  },
  {
    factKey: "deck.step_count",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: true,
    commercial: false,
    reason: "Optional rise-count override after Steps are included. Default from height / 175 mm.",
  },
  {
    factKey: "deck.step_width_m",
    questionClass: "ASSUME_IF_SKIPPED",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    reason:
      "Stair width for Step decking, framing, and tread-area labour. Default 1.0 m LOW-CONFIDENCE, disclosed. Do not emit unexplained detailed money if unresolved.",
  },
  {
    factKey: "deck.step_going_m",
    questionClass: "ASSUME_IF_SKIPPED",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    reason:
      "Tread depth for Step decking quantity and tread-area labour. Default 280 mm LOW-CONFIDENCE, disclosed. Do not emit unexplained detailed money if unresolved.",
  },
];

export function deckFactQuestionClass(
  factKey: string
): DeckFactQuestionClass | null {
  return (
    DECK_INFORMATION_CONTRACT.find((row) => row.factKey === factKey)
      ?.questionClass ?? null
  );
}

/**
 * Future optional: attached-edge / existing-deck connection as a Deck fact.
 * 2A-R1: brief attachment is PHYSICAL_CONTEXT_KNOWN only. No validated attached-edge
 * support model. Conservative freestanding support layout is disclosed; piles are
 * not deducted.
 */
