/**
 * FENCE-MATURITY-1A — disclosed estimating defaults.
 * Not engineering compliance. Builder can edit / refine.
 */

export const FENCE_DEFAULT_MAX_POST_SPACING_DISCLOSURE =
  "Post centres assumed at 1.8 m maximum (Quotr estimating default, not structural design). Builder can edit.";

export const FENCE_DEFAULT_EMBEDMENT_DISCLOSURE =
  "Post embedment assumed at 0.6 m (Quotr estimating default, not engineering compliance). Builder can edit.";

export const FENCE_DEFAULT_HOLE_DIAMETER_DISCLOSURE =
  "Post-hole diameter assumed at 300 mm (Quotr estimating default). Builder can edit. Diameter is used internally — not radius.";

export const FENCE_DEFAULT_SLAT_GAP_DISCLOSURE =
  "Gap between horizontal boards/slats assumed at 10 mm (Quotr estimating default). Builder can edit — this changes board quantity.";

export const FENCE_DEFAULT_VERTICAL_PALING_GAP_MM = 0;

export const FENCE_VERTICAL_PALING_GAP_DISCLOSURE =
  "Vertical palings assumed installed without a deliberate gap.";

export const FENCE_VERTICAL_PALING_GAP_IMPROVE =
  "Confirm gap between vertical palings.";

export const FENCE_MODULAR_GATES_NOT_MODELLED =
  "Modular gates are not modelled in Fence 1A. Timber gate facts are stored but not consumed for metal or plastic systems.";

export const FENCE_DEFAULT_SECTION_WIDTH_DISCLOSURE =
  "Modular section width assumed at 1.8 m (Quotr estimating default unless a company/product width is set). Builder can edit.";

export const FENCE_DEFAULT_SPECIES_DISCLOSURE =
  "Visible timber species assumed as Radiata Pine for rate identity. Builder can change species. Posts/framing stay treated pine unless changed.";

export const FENCE_DEFAULT_BOARD_THICKNESS_DISCLOSURE =
  "Board section assumed 150 × 19 mm. Thickness changes material identity, not face coverage.";

export const FENCE_BOARD_WASTE_FACTOR = 0.05;
export const FENCE_BOARD_WASTE_DISCLOSURE =
  "Board/slat purchased length includes a 5% procurement/waste factor (Quotr LOW-CONFIDENCE estimating default), applied once. Company timber-framing wastage overrides when set.";

export const FENCE_METAL_DISPLACEMENT_DISCLOSURE =
  "Metal-post displacement not deducted because selected section area is not confirmed; concrete quantity is conservatively estimated.";

export const FENCE_PLASTIC_DISPLACEMENT_DISCLOSURE =
  "Plastic/composite post displacement not deducted because section metadata is not confirmed; concrete quantity is conservatively estimated.";

export const FENCE_HORIZONTAL_SUPPORT_DECISION =
  "Horizontal slats are assumed to span directly between fence posts. Confirm secondary battens/support if required by the selected system.";

export const FENCE_HORIZONTAL_SPAN_IMPROVE =
  "Confirm horizontal slat support / post spacing.";

export const FENCE_GATE_POSITION_ASSUMED_DISCLOSURE =
  "Gate position assumed within the fence run for estimating.";

export const FENCE_GATE_POST_SAME_SECTION_DISCLOSURE =
  "Gate posts assumed same section as fence posts.";

export const FENCE_GATE_CAPPING_ASSUMED_DISCLOSURE =
  "Gate top capping assumed to match the fence capping.";

export const FENCE_RAIL_SECTION_DEFAULT = "75x50";
export const FENCE_RAIL_SECTION_DISCLOSURE =
  "Fence rails assumed treated H4 75×50 — a common NZ paling rail section for estimating, not structural design. Builder can change the rail section.";

export const FENCE_POST_INSTALL_OWNERSHIP_R1 =
  "Post installation labour-h/post owns set-out, ordinary post-hole digging, moving posts/tools within the normal workface, and setting/plumbing/bracing posts. Do not add a second generic excavation labour line for ordinary fence-post holes.";

export const FENCE_CONCRETE_PLACE_OWNERSHIP_R1 =
  "Post-hole concrete placement owns bag handling at the workface, mixing, and placing. Carry adjustment, when applied later, is once per activity.";

export const FENCE_CARRY_OWNERSHIP_R1 =
  "Abnormal material_carry_distance may later adjust posts, rails, boards/panels, gate materials, and bagged concrete once each. Not commercially multiplied in 1A.";

export const FENCE_FINISH_NOT_INCLUDED =
  "Painting or staining is not included unless the builder explicitly includes finish scope.";

export const FENCE_TOP_ALLOWANCE_DISCLOSURE =
  "Post stock length is fence height plus embedment. No extra top allowance is added in Fence 1A.";

export const FENCE_PACKAGE_XOR_NOTE =
  "Fence 1A physical takeoff is independent of commercial authority. Package lm lines remain monetary authority. They are not detailed component calculations.";
