/**
 * FENCE-MATURITY-1A — future productivity identities.
 * Starters are LOW-CONFIDENCE Quotr estimating hours. Not Company Rates.
 * Package labour (fence.labour_hours_per_lm) remains 1A money authority.
 */

import { POST_HOLE_CONCRETE_PLACE_HOURS_PER_BAG_STARTER } from "@/lib/estimate/post-hole-concrete";

export const FENCE_PRODUCTIVITY_KEYS = {
  postInstall: "fence.post.install.hours_per_post",
  framingLm: "fence.framing.hours_per_lm",
  verticalBoardsM2: "fence.board.vertical.hours_per_m2",
  horizontalSlatsM2: "fence.board.horizontal.hours_per_m2",
  cappingLm: "fence.capping.hours_per_lm",
  gateInstall: "fence.gate.install.hours_per_gate",
  postHoleConcreteBag: "fence.post_hole_concrete.place.hours_per_bag",
  sectionInstall: "fence.section.install.hours_per_section",
  /** Legacy package labour — 1A money path. */
  packageLm: "fence.labour_hours_per_lm",
  gateAllowance: "fence.gate_hours_allowance",
  demolitionLm: "fence.demolition_hours_per_lm",
} as const;

export const FENCE_PRODUCTIVITY_UNITS = {
  [FENCE_PRODUCTIVITY_KEYS.postInstall]: "post",
  [FENCE_PRODUCTIVITY_KEYS.framingLm]: "lm",
  [FENCE_PRODUCTIVITY_KEYS.verticalBoardsM2]: "m2",
  [FENCE_PRODUCTIVITY_KEYS.horizontalSlatsM2]: "m2",
  [FENCE_PRODUCTIVITY_KEYS.cappingLm]: "lm",
  [FENCE_PRODUCTIVITY_KEYS.gateInstall]: "gate",
  [FENCE_PRODUCTIVITY_KEYS.postHoleConcreteBag]: "bag",
  [FENCE_PRODUCTIVITY_KEYS.sectionInstall]: "section",
} as const;

/**
 * LOW-CONFIDENCE starters so labour-h/unit paths resolve.
 * Do not treat as calibrated Company Rates.
 */
export const FENCE_PRODUCTIVITY_STARTERS: Record<
  (typeof FENCE_PRODUCTIVITY_KEYS)[keyof typeof FENCE_PRODUCTIVITY_KEYS],
  number
> = {
  [FENCE_PRODUCTIVITY_KEYS.postInstall]: 0.45,
  [FENCE_PRODUCTIVITY_KEYS.framingLm]: 0.2,
  [FENCE_PRODUCTIVITY_KEYS.verticalBoardsM2]: 0.35,
  [FENCE_PRODUCTIVITY_KEYS.horizontalSlatsM2]: 0.4,
  [FENCE_PRODUCTIVITY_KEYS.cappingLm]: 0.08,
  [FENCE_PRODUCTIVITY_KEYS.gateInstall]: 1.5,
  [FENCE_PRODUCTIVITY_KEYS.postHoleConcreteBag]:
    POST_HOLE_CONCRETE_PLACE_HOURS_PER_BAG_STARTER,
  [FENCE_PRODUCTIVITY_KEYS.sectionInstall]: 0.35,
  [FENCE_PRODUCTIVITY_KEYS.packageLm]: 0.6,
  [FENCE_PRODUCTIVITY_KEYS.gateAllowance]: 2,
  [FENCE_PRODUCTIVITY_KEYS.demolitionLm]: 0.25,
};

export const FENCE_ACCESS_SENSITIVE_ACTIVITIES = [
  "post installation (includes layout, hole digging, set, plumb, normal carry)",
  "framing / rails",
  "board / slat / section installation",
  "gate installation",
  "top-cap installation",
] as const;

export const FENCE_NOT_ACCESS_MULTIPLIED = [
  "post-hole bagged concrete placement (not indiscriminately multiplied)",
] as const;

export const FENCE_POST_INSTALL_OWNERSHIP =
  "Post installation labour-h/post owns set-out, ordinary post-hole digging, moving posts/tools within the normal workface, and setting/plumbing/bracing posts. Do not add a second generic excavation labour line for ordinary fence-post holes.";

export const FENCE_CONCRETE_PLACE_OWNERSHIP =
  "Post-hole concrete placement owns bag handling at the workface, mixing, and placing. Carry adjustment, when applied later, is once on this activity.";

export const FENCE_CARRY_OWNERSHIP =
  "Abnormal material_carry_distance may later adjust posts, rails, boards/panels, gate materials, and bagged concrete once each where physically relevant. Not commercially multiplied in Fence 1A.";

export const FENCE_GATE_INSTALL_OWNERSHIP =
  "Gate installation labour-h/gate owns hanging, alignment, hinges/latch, and normal adjustment. Gate-frame timber quantity is material takeoff; frame assembly is not double-counted as a second fabrication labour line in 1A.";
