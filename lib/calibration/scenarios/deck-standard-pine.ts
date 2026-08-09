import type { CalibrationScenario } from "@/lib/calibration/types";

/** STANDARD PINE DECK — NZ contractor language, calculator-aligned facts. */
export const DECK_STANDARD_PINE_V1: CalibrationScenario = {
  id: "deck.standard_pine.v1",
  version: "1",
  workAreaType: "deck",
  title: "Standard pine deck",
  summary: "New 5×3 m timber deck, ~0.5 m up, pine decking, no balustrade or stairs.",
  jobBrief:
    "Build a new 5 m × 3 m timber deck approximately 0.5 m above ground. New timber substructure, standard access, H3.2 treated pine decking. No balustrade. No stairs. No existing deck demolition.",
  facts: [
    { key: "deck.length_m", value: 5 },
    { key: "deck.width_m", value: 3 },
    { key: "deck.area_m2", value: 15 },
    { key: "deck.height_m", value: 0.5 },
    { key: "deck.level", value: "Elevated" },
    { key: "deck.board_material", value: "treated pine" },
    { key: "deck.substructure_included", value: true },
    { key: "deck.existing_deck_removal", value: false },
    { key: "deck.demolition_required", value: false },
    { key: "deck.has_stairs", value: false },
    { key: "deck.balustrade_required", value: false },
    { key: "deck.has_balustrade", value: false },
    { key: "deck.access", value: "Standard" },
  ],
  constraints: [
    { key: "access", label: "Access", value: "Standard residential" },
  ],
  scopeItems: [
    "New timber substructure",
    "H3.2 treated pine decking",
    "Fixings and consumables",
    "Exclude balustrade",
    "Exclude stairs",
    "Exclude demolition",
  ],
  questions: [
    {
      id: "labour_hours",
      label: "How many carpenter/builder hours would you normally allow?",
      help: "Your own labour only — not subcontractors.",
      kind: "number",
      unit: "hours",
    },
    {
      id: "materials_cost",
      label: "What would you roughly allow for materials (cost)?",
      help: "Substructure, decking, fixings — what it costs your business.",
      kind: "number",
      unit: "$",
    },
    {
      id: "other_cost",
      label: "Any other direct costs you would normally allow?",
      help: "Plant, waste, small hire — optional.",
      kind: "number",
      unit: "$",
      optional: true,
    },
    {
      id: "expected_total_cost",
      label: "What would you expect this job to cost your business in total?",
      help: "Optional override. If blank, Quotr sums materials + other (hours alone do not invent a labour $).",
      kind: "number",
      unit: "$",
      optional: true,
    },
    {
      id: "expected_sell",
      label: "What would you normally quote this job for?",
      kind: "number",
      unit: "$",
    },
    {
      id: "confidence",
      label: "How confident are you in these numbers?",
      kind: "confidence",
    },
    {
      id: "notes",
      label: "Anything else Quotr should know?",
      kind: "text",
      optional: true,
    },
  ],
};
