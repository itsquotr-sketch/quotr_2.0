/**
 * DECK-MATURITY-2A — canonical Deck estimating information contract.
 * Assistant ask timing vs calculator consumption. Not a second takeoff model.
 */
export type DeckFactQuestionClass =
  | "HARD_MINIMUM"
  | "ASK_NOW"
  | "ASSUME_IF_SKIPPED"
  | "REFINE"
  | "ADVANCED"
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
    reason:
      "Elevated labour / balustrade relevance. Asked in Details when unresolved; disclosed assumption if skipped.",
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
    questionClass: "ASSUME_IF_SKIPPED",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    reason: "Physical board coverage for lineal takeoff. 140 mm disclosed if skipped.",
  },
  {
    factKey: "deck.board_waste_percent",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    reason:
      "Explicit board waste from the brief. Company decking wastage applies only when this is absent. It is not asked, and it is not copied onto framing.",
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
    factKey: "deck.pile_or_post_replacement_required",
    questionClass: "ASK_NOW",
    calculatorConsumed: true,
    physical: false,
    commercial: true,
    reason:
      "Replacement labour/material only when existing supports may be reused. Not for a new substructure layout.",
  },
  {
    factKey: "deck.substructure_condition",
    questionClass: "ASK_NOW",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    reason:
      "Existing substructure condition. Affects reuse vs replacement. Asked only when existing supports remain.",
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
    reason:
      "Optional company bags per hole. When absent, bags come from the fill volume and the 20 kg yield. 2.5 is not a takeoff.",
  },
  {
    factKey: "deck.concrete_fill",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    reason: "Full hole or a specified fill depth. Unconfirmed fill stays a provisional bag count.",
  },
  {
    factKey: "deck.concrete_fill_depth_mm",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    reason: "Concrete depth when the hole is only partly concreted. The rest of the hole is unconcreted.",
  },
  {
    factKey: "deck.post_embedment_mm",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    reason: "Length of post inside the concrete. Required before post displacement is deducted.",
  },
  {
    factKey: "deck.concrete_bag_yield_m3",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    reason: "Company mixed yield for the 20 kg bag. Absent uses 0.01 m³ per bag.",
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
    factKey: "deck.hole_diameter_mm",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    reason: "Dug hole diameter. Assumed 350 mm circular when absent. Not a footing dimension.",
  },
  {
    factKey: "deck.hole_depth_mm",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    reason: "Dug hole depth. Assumed 600 mm when absent. Not a footing dimension.",
  },
  {
    factKey: "deck.hole_ground",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    reason: "Ordinary hand-dug soil uses the provisional hours. Other ground needs a job rate.",
  },
  {
    factKey: "deck.spoil_leaves_site",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: false,
    commercial: true,
    reason: "Legacy yes/no. deck.spoil_destination wins when the builder has chosen retain, remove, or undecided.",
  },
  {
    factKey: "deck.hole_length_mm",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    reason: "Rectangular hole length. Not a footing dimension.",
  },
  {
    factKey: "deck.hole_width_mm",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    reason: "Rectangular hole width. Not a footing dimension.",
  },
  {
    factKey: "deck.hole_shape",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    reason: "Circular or rectangular. Absent means an assumed circular hole, not a measured one.",
  },
  {
    factKey: "deck.hole_method",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    reason: "Hand, machine, or other. The 0.50 h/hole starter needs confirmed hand excavation.",
  },
  {
    factKey: "deck.hole_count",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    reason: "Hole count. Defaults to the confirmed post count. A different count needs a reason.",
  },
  {
    factKey: "deck.hole_count_reason",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: false,
    commercial: true,
    reason: "Why the hole count differs from the post count.",
  },
  {
    factKey: "deck.hole_job_hours_per_hole",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: false,
    commercial: true,
    reason: "Explicit job productivity when the ordinary starter does not apply.",
  },
  {
    factKey: "deck.spoil_destination",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: false,
    commercial: true,
    reason: "Retain on site, remove off site, or undecided. On site has no disposal money.",
  },
  {
    factKey: "deck.hole_hours_status",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: false,
    commercial: true,
    reason: "Unknown excavation hours. The ordinary 0.5 h/hole rate is not used.",
  },
  {
    factKey: "deck.spoil_haulage_choice",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: false,
    commercial: true,
    reason: "Use the $150 trip allowance, a job price, or a request for price. Off-site only.",
  },
  {
    factKey: "deck.spoil_haulage_job_cost",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: false,
    commercial: true,
    reason: "This job's haulage price when the allowance is replaced.",
  },
  {
    factKey: "deck.spoil_tip_choice",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: false,
    commercial: true,
    reason: "Use the $150 tip allowance, a job price, or a request for price. Off-site only.",
  },
  {
    factKey: "deck.spoil_tip_job_cost",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: false,
    commercial: true,
    reason: "This job's tip price when the allowance is replaced.",
  },
  {
    factKey: "deck.spoil_load_fit",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: false,
    commercial: true,
    reason: "Small clean local load, or a load that must not use the scaled allowance.",
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
    reason:
      "Skirting ground gap. Defaults 20 mm. Asked only when full-height skirting is included. Ordinary fascia does not use it.",
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
      "Step width for Step decking, framing, and tread-area labour. Default 1.0 m LOW-CONFIDENCE, disclosed. Do not infer the full deck edge. Do not emit unexplained detailed money if unresolved.",
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

export const DECK_CLARIFY_ASK_CLASSES = [
  "HARD_MINIMUM",
  "ASK_NOW",
  "ASSUME_IF_SKIPPED",
] as const satisfies readonly DeckFactQuestionClass[];

export function isDeckClarifyAskClass(
  questionClass: DeckFactQuestionClass | null
): boolean {
  return (
    questionClass === "HARD_MINIMUM" ||
    questionClass === "ASK_NOW" ||
    questionClass === "ASSUME_IF_SKIPPED"
  );
}

/** Level 1 blocking is derived from the Deck contract — not template P1/P2. */
export function mapDeckQuestionClassToLevel1(
  questionClass: DeckFactQuestionClass
): "HARD_MINIMUM" | "ASSUMABLE" | "REFINEMENT" {
  if (questionClass === "HARD_MINIMUM") return "HARD_MINIMUM";
  if (questionClass === "ASK_NOW" || questionClass === "ASSUME_IF_SKIPPED") {
    return "ASSUMABLE";
  }
  return "REFINEMENT";
}

/**
 * Future optional: attached-edge / existing-deck connection as a Deck fact.
 * 2A-R1: brief attachment is PHYSICAL_CONTEXT_KNOWN only. No validated attached-edge
 * support model. Conservative freestanding support layout is disclosed; piles are
 * not deducted.
 */
