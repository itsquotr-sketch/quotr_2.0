/**
 * FENCE-MATURITY-1A — canonical Fence information contract.
 * Assistant ask timing vs calculator consumption. Not a second takeoff model.
 */

export type FenceFactQuestionClass =
  | "HARD_MINIMUM"
  | "ASK_NOW"
  | "ASSUME_IF_SKIPPED"
  | "REFINE"
  | "DERIVED"
  | "NOT_CONSUMED";

export type FenceInformationContractRow = {
  readonly factKey: string;
  readonly questionClass: FenceFactQuestionClass;
  readonly calculatorConsumed: boolean;
  readonly physical: boolean;
  readonly commercial: boolean;
  readonly confidence: boolean;
  readonly reason: string;
};

export const FENCE_INFORMATION_CONTRACT: readonly FenceInformationContractRow[] = [
  {
    factKey: "fence.system",
    questionClass: "HARD_MINIMUM",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    confidence: true,
    reason: "Fence type. Four systems. Classifiable from fence.material for legacy.",
  },
  {
    factKey: "fence.material",
    questionClass: "HARD_MINIMUM",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    confidence: true,
    reason: "Legacy system/material. Satisfies type minimum when fence.system is absent.",
  },
  {
    factKey: "fence.length_m",
    questionClass: "HARD_MINIMUM",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    confidence: true,
    reason: "Complete fence line including gate openings.",
  },
  {
    factKey: "fence.height_m",
    questionClass: "HARD_MINIMUM",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    confidence: true,
    reason: "Fence height. Distinct from manufactured panel height.",
  },
  {
    factKey: "fence.timber_species",
    questionClass: "ASK_NOW",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    confidence: false,
    reason: "Visible timber species. Radiata assumed if skipped. Not used for in-ground posts.",
  },
  {
    factKey: "fence.board_thickness_mm",
    questionClass: "ASK_NOW",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    confidence: false,
    reason: "150×19 or 150×25. Changes identity/rate, not face coverage.",
  },
  {
    factKey: "fence.top_capping",
    questionClass: "ASK_NOW",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    confidence: false,
    reason: "Top capping included? Yes / No / Not sure. Missing assumes no.",
  },
  {
    factKey: "fence.gate_included",
    questionClass: "ASK_NOW",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    confidence: true,
    reason: "Gate included. TIMBER only. Missing assumes no. Stored but not consumed on Metal/Plastic modular.",
  },
  {
    factKey: "fence.modular_gate_requested",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: false,
    commercial: true,
    confidence: true,
    reason: "Explicit modular manufactured-gate request. Distinct from leftover Timber fence.gate_included. Unsupported → Pricing Required. Quote is not commercially ready until priced or Gate requested is set to No (client exclusion wording). Not timber gate geometry.",
  },
  {
    factKey: "fence.gate_count",
    questionClass: "ASK_NOW",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    confidence: false,
    reason: "Gate count when gate is yes.",
  },
  {
    factKey: "fence.gate_width_m",
    questionClass: "ASK_NOW",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    confidence: true,
    reason: "Gate width. 900 mm assumed if gate yes and width missing.",
  },
  {
    factKey: "fence.gate_position",
    questionClass: "ASSUME_IF_SKIPPED",
    calculatorConsumed: true,
    physical: true,
    commercial: false,
    confidence: false,
    reason: "At an end / Within the fence run / Not sure. Unresolved assumes within the run, gate centred.",
  },
  {
    factKey: "fence.gate_capping",
    questionClass: "ASSUME_IF_SKIPPED",
    calculatorConsumed: true,
    physical: true,
    commercial: false,
    confidence: false,
    reason: "Gate matches fence capping? Default Yes when top capping and gate are Yes.",
  },
  {
    factKey: "fence.slat_gap_mm",
    questionClass: "ASK_NOW",
    calculatorConsumed: true,
    physical: true,
    commercial: false,
    confidence: true,
    reason: "HORIZONTAL only. High-value quantity driver. 10 mm assumed if skipped. Isolated from vertical paling gap.",
  },
  {
    factKey: "fence.vertical_paling_gap_mm",
    questionClass: "ASSUME_IF_SKIPPED",
    calculatorConsumed: true,
    physical: true,
    commercial: false,
    confidence: false,
    reason: "VERTICAL PALING only. Default 0 mm. Disclosed estimating assumption. Isolated from horizontal slat gap.",
  },
  {
    factKey: "fence.demolition_required",
    questionClass: "ASK_NOW",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    confidence: false,
    reason: "Existing fence removal. Not silently omitted.",
  },
  {
    factKey: "fence.section_width_m",
    questionClass: "ASSUME_IF_SKIPPED",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    confidence: true,
    reason: "MODULAR only. Default 1.8 m. Builder can edit; recalculates geometry.",
  },
  {
    factKey: "fence.post_spacing_m",
    questionClass: "ASSUME_IF_SKIPPED",
    calculatorConsumed: true,
    physical: true,
    commercial: false,
    confidence: false,
    reason: "TIMBER only. Maximum post centres. Default 1.8 m. Not exact division.",
  },
  {
    factKey: "fence.post_embedment_m",
    questionClass: "ASSUME_IF_SKIPPED",
    calculatorConsumed: true,
    physical: true,
    commercial: false,
    confidence: true,
    reason: "Editable physical fact. Default 0.6 m. Not hard minimum. Not engineering.",
  },
  {
    factKey: "fence.post_stock_length_m",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: false,
    commercial: true,
    confidence: false,
    reason:
      "Optional purchased H4 100×100 stock length. When set and long enough, overrides the Quotr ladder. Does not change post geometry.",
  },
  {
    factKey: "fence.hole_diameter_m",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: true,
    commercial: false,
    confidence: false,
    reason: "Post-hole diameter (m). Default 0.3 m. Diameter not radius.",
  },
  {
    factKey: "fence.rail_count",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: true,
    commercial: false,
    confidence: false,
    reason: "Vertical paling rail override. Default derived from height.",
  },
  {
    factKey: "fence.rail_section",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: true,
    commercial: false,
    confidence: false,
    reason: "Fence rail section. Default treated H4 75×50 estimating identity. Not structural compliance.",
  },
  {
    factKey: "fence.horizontal_course_count",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: true,
    commercial: false,
    confidence: false,
    reason: "Explicit horizontal slat course count. Overrides derived fit-within-height count. Not silently rewritten.",
  },
  {
    factKey: "fence.section_count",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    confidence: false,
    reason: "Explicit purchased section count. Not silently rewritten.",
  },
  {
    factKey: "fence.section_height_m",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    confidence: true,
    reason: "Manufactured panel height. Attention / Pricing Required if it does not match fence height. Manufactured sections are not stretched.",
  },
  {
    factKey: "fence.metal_material",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    confidence: false,
    reason: "Aluminium vs steel for metal modular identity.",
  },
  {
    factKey: "fence.section_product_key",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    confidence: true,
    reason:
      "Company/Quotr modular section product key. Product width/height drive geometry unless the builder override is compatible.",
  },
  {
    factKey: "fence.modular_fixings_included",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: true,
    commercial: true,
    confidence: false,
    reason:
      "Whether the selected modular section product includes brackets/fixings. Yes = no separate fixings money.",
  },
  {
    factKey: "fence.paling_or_panel_type",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: true,
    commercial: false,
    confidence: false,
    reason: "Legacy orientation hint. fence.system is preferred.",
  },
  {
    factKey: "fence.slope_condition",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: false,
    commercial: false,
    confidence: true,
    reason: "Ground profile. Confidence/future stepping — not a terrain engine.",
  },
  {
    factKey: "fence.corner_count",
    questionClass: "REFINE",
    calculatorConsumed: false,
    physical: false,
    commercial: false,
    confidence: false,
    reason: "Captured for future run segmentation. 1A discloses straight-run.",
  },
  {
    factKey: "fence.disposal_required",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: false,
    commercial: true,
    confidence: false,
    reason: "Disposal allowance when existing fence is removed. Not invented rates.",
  },
  {
    factKey: "fence.finish_required",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: false,
    commercial: true,
    confidence: false,
    reason: "Finish included? No automatic money unless explicit Yes.",
  },
  {
    factKey: "fence.finish_type",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: false,
    commercial: true,
    confidence: false,
    reason: "Paint/stain type when finish is Yes.",
  },
  {
    factKey: "fence.finish_sides",
    questionClass: "REFINE",
    calculatorConsumed: true,
    physical: false,
    commercial: true,
    confidence: false,
    reason: "Finish sides when finish is Yes.",
  },
  {
    factKey: "fence.boundary_approval_status",
    questionClass: "NOT_CONSUMED",
    calculatorConsumed: true,
    physical: false,
    commercial: false,
    confidence: false,
    reason: "Risk note only. Not a physical driver.",
  },
  {
    factKey: "fence.services_risk",
    questionClass: "NOT_CONSUMED",
    calculatorConsumed: true,
    physical: false,
    commercial: false,
    confidence: false,
    reason: "Risk note only.",
  },
  {
    factKey: "site_access",
    questionClass: "ASK_NOW",
    calculatorConsumed: true,
    physical: false,
    commercial: true,
    confidence: false,
    reason: "Canonical Project Condition. Access-sensitive fence labour only.",
  },
  {
    factKey: "material_carry_distance",
    questionClass: "ASK_NOW",
    calculatorConsumed: true,
    physical: false,
    commercial: true,
    confidence: false,
    reason: "Canonical Project Condition. Not applied to every labour category.",
  },
];

const BY_KEY = new Map(
  FENCE_INFORMATION_CONTRACT.map((row) => [row.factKey, row])
);

export function fenceContractRow(
  factKey: string
): FenceInformationContractRow | undefined {
  return BY_KEY.get(factKey);
}

export function fenceFactQuestionClass(
  factKey: string
): FenceFactQuestionClass | null {
  return BY_KEY.get(factKey)?.questionClass ?? null;
}

export const FENCE_HARD_MINIMUM_FACT_KEYS = [
  "fence.system",
  "fence.material",
  "fence.length_m",
  "fence.height_m",
] as const;
