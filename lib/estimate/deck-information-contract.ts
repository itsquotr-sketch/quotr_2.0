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
    reason: "Fascia allowance; quantity from geometry when included.",
  },
  {
    factKey: "deck.access_type",
    questionClass: "ASK_NOW",
    calculatorConsumed: true,
    physical: false,
    commercial: true,
    reason: "Steps/stairs allowance. Not a stair engineering model.",
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
];

/**
 * Future optional: attached-edge / existing-deck connection as a Deck fact.
 * 2A-R1: brief attachment is PHYSICAL_CONTEXT_KNOWN only. No validated attached-edge
 * support model. Conservative freestanding support layout is disclosed; piles are
 * not deducted.
 */
